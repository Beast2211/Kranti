"""Kranti Ganesh Mandal 2026 Management — FastAPI backend."""
import os
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

import requests
from fastapi import FastAPI, APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import StreamingResponse, Response
from fastapi.concurrency import run_in_threadpool
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
import io
import csv

from db import (
    users, members, payments, expenses, events, notifications,
    audit_logs, password_resets,
)
from security import (
    hash_password, verify_password, dummy_verify, issue_access_token,
    current_user, require_roles, now, token_digest, decode_token,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("mandal")

app = FastAPI(title="Kranti Ganesh Mandal 2026")
api = APIRouter(prefix="/api")

ADMIN_ROLES = ("super_admin", "admin")
ALL_ROLES = ("super_admin", "admin", "member")

# ---------------------------------------------------------------------------
# Emergent Object Storage (managed)
# ---------------------------------------------------------------------------
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "kranti-ganesh-mandal-2026"
_storage_key: Optional[str] = None


def init_storage() -> Optional[str]:
    global _storage_key
    if _storage_key:
        return _storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    _storage_key = resp.json()["storage_key"]
    return _storage_key


def put_object(path: str, data: bytes, content_type: str) -> dict:
    global _storage_key
    key = init_storage()
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data,
        timeout=120,
    )
    if resp.status_code == 503:
        _storage_key = None
        key = init_storage()
        resp = requests.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type},
            data=data,
            timeout=120,
        )
    resp.raise_for_status()
    return resp.json()


def get_object(path: str) -> tuple[bytes, str]:
    global _storage_key
    key = init_storage()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    if resp.status_code == 503:
        _storage_key = None
        key = init_storage()
        resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")

PAYMENT_MODES = {"Cash", "UPI", "Bank Transfer", "Other"}
EXPENSE_CATEGORIES = {
    "Decoration", "Electricity", "Sound System", "Lighting", "Prasad/Food",
    "Pooja Material", "Advertisement", "Transportation", "Cultural Program",
    "Miscellaneous",
}
EVENT_STATUSES = {"Upcoming", "Completed", "Cancelled"}


def uid() -> str:
    return str(uuid.uuid4())


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
async def write_audit(user: dict, action: str, module: str, record_id: str = "", details: str = ""):
    await audit_logs.insert_one({
        "id": uid(),
        "user_id": user["id"],
        "user_name": user.get("full_name") or user.get("user_id") or user.get("mobile"),
        "action": action,
        "module": module,
        "record_id": record_id,
        "details": details,
        "created_at": iso(now()),
    })


async def notify(audience: str, title: str, message: str, ntype: str = "info", user_id: Optional[str] = None):
    await notifications.insert_one({
        "id": uid(),
        "audience": audience,  # 'all' | 'admins' | 'user'
        "user_id": user_id,
        "title": title,
        "message": message,
        "type": ntype,
        "is_read": False,
        "created_at": iso(now()),
    })


def public_user(u: dict) -> dict:
    return {
        "id": u["id"],
        "full_name": u.get("full_name"),
        "user_id": u.get("user_id"),
        "mobile": u.get("mobile"),
        "email": u.get("email"),
        "role": u["role"],
        "status": u["status"],
        "created_at": u.get("created_at"),
    }


async def member_payments_sum(member_id: str) -> float:
    cur = payments.aggregate([
        {"$match": {"member_id": member_id, "deleted_at": None}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
    ])
    docs = await cur.to_list(1)
    return float(docs[0]["total"]) if docs else 0.0


async def enrich_member(m: dict) -> dict:
    paid = await member_payments_sum(m["id"])
    target = float(m.get("target_amount", 0) or 0)
    advance = float(m.get("advance_amount", 0) or 0)
    collected = advance + paid  # advance is treated as already collected
    pending = target - collected
    return {
        "id": m["id"],
        "profile_id": m.get("profile_id"),
        "full_name": m.get("full_name"),
        "mobile": m.get("mobile"),
        "email": m.get("email"),
        "address": m.get("address"),
        "joining_date": m.get("joining_date"),
        "status": m.get("status"),
        "target_amount": target,
        "advance_amount": advance,
        "paid_amount": paid,
        "collected": collected,
        "pending": pending,
        "created_at": m.get("created_at"),
    }


# ---------------------------------------------------------------------------
# Auth models
# ---------------------------------------------------------------------------
class RegisterBody(BaseModel):
    full_name: str = Field(min_length=2)
    mobile: str
    password: str = Field(min_length=6)

    @field_validator("mobile")
    @classmethod
    def valid_mobile(cls, v: str) -> str:
        digits = "".join(ch for ch in v if ch.isdigit())
        if len(digits) < 10:
            raise ValueError("Enter a valid mobile number")
        return digits[-10:]


class LoginBody(BaseModel):
    identifier: str
    password: str


class ChangePasswordBody(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6)


class ForgotBody(BaseModel):
    identifier: str


class ResetBody(BaseModel):
    token: str
    new_password: str = Field(min_length=6)


# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------
@api.post("/auth/register")
async def register(body: RegisterBody):
    existing = await users.find_one({"mobile": body.mobile})
    if existing:
        raise HTTPException(status_code=409, detail="This mobile number is already registered.")
    t = iso(now())
    user_id = uid()
    user_doc = {
        "id": user_id,
        "full_name": body.full_name.strip(),
        "user_id": None,
        "mobile": body.mobile,
        "email": None,
        "role": "member",
        "status": "pending",
        "password_hash": hash_password(body.password),
        "token_version": 0,
        "created_at": t,
        "updated_at": t,
    }
    await users.insert_one(user_doc)
    member_doc = {
        "id": uid(),
        "profile_id": user_id,
        "full_name": body.full_name.strip(),
        "mobile": body.mobile,
        "email": None,
        "address": None,
        "joining_date": t,
        "status": "pending",
        "target_amount": 0,
        "advance_amount": 0,
        "created_by": user_id,
        "created_at": t,
        "updated_at": t,
        "deleted_at": None,
    }
    await members.insert_one(member_doc)
    await notify("admins", "New member registration",
                 f"{body.full_name.strip()} ({body.mobile}) requested to join.", "approval")
    return {"message": "Registration received. Your account is pending approval.", "status": "pending"}


@api.post("/auth/login")
async def login(body: LoginBody):
    ident = body.identifier.strip()
    digits = "".join(ch for ch in ident if ch.isdigit())
    query = {"$or": [{"user_id": ident}, {"mobile": ident}]}
    if len(digits) >= 10:
        query["$or"].append({"mobile": digits[-10:]})
    u = await users.find_one(query)
    valid = verify_password(body.password, u["password_hash"]) if u else dummy_verify(body.password)
    if not u or not valid:
        raise HTTPException(status_code=401, detail="Invalid User ID or Password.")
    if u["status"] == "pending":
        raise HTTPException(status_code=403, detail="Your registration is pending approval.")
    if u["status"] == "rejected":
        raise HTTPException(status_code=403, detail="Your registration was rejected.")
    if u["status"] != "active":
        raise HTTPException(status_code=403, detail="Your account is not active. Contact an administrator.")
    token = issue_access_token(u)
    return {"access_token": token, "token_type": "bearer", "user": public_user(u)}


@api.get("/auth/me")
async def me(user: dict = Depends(current_user)):
    return public_user(user)


@api.post("/auth/logout")
async def logout(user: dict = Depends(current_user)):
    await users.update_one({"id": user["id"]}, {"$inc": {"token_version": 1}})
    return {"message": "Logged out"}


@api.post("/auth/change-password")
async def change_password(body: ChangePasswordBody, user: dict = Depends(current_user)):
    if not verify_password(body.current_password, user["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")
    await users.update_one(
        {"id": user["id"]},
        {"$set": {"password_hash": hash_password(body.new_password), "updated_at": iso(now())},
         "$inc": {"token_version": 1}},
    )
    return {"message": "Password changed. Please sign in again."}


@api.post("/auth/forgot")
async def forgot(body: ForgotBody):
    ident = body.identifier.strip()
    digits = "".join(ch for ch in ident if ch.isdigit())
    query = {"$or": [{"user_id": ident}, {"mobile": ident}]}
    if len(digits) >= 10:
        query["$or"].append({"mobile": digits[-10:]})
    u = await users.find_one(query)
    resp = {"message": "If the account exists, a recovery code has been generated."}
    if u:
        raw = uid().replace("-", "")[:8].upper()
        await password_resets.insert_one({
            "id": uid(),
            "user_id": u["id"],
            "token_hash": token_digest(raw),
            "expires_at": iso(now() + timedelta(minutes=30)),
            "used": False,
            "created_at": iso(now()),
        })
        # No SMS/email provider configured — surface code for in-app recovery.
        resp["recovery_code"] = raw
    return resp


@api.post("/auth/reset")
async def reset(body: ResetBody):
    r = await password_resets.find_one({"token_hash": token_digest(body.token.strip().upper()), "used": False})
    if not r or r["expires_at"] < iso(now()):
        raise HTTPException(status_code=400, detail="Invalid or expired recovery code.")
    await password_resets.update_one({"id": r["id"]}, {"$set": {"used": True}})
    await users.update_one(
        {"id": r["user_id"]},
        {"$set": {"password_hash": hash_password(body.new_password)}, "$inc": {"token_version": 1}},
    )
    return {"message": "Password reset. Please sign in with your new password."}


# ---------------------------------------------------------------------------
# Admin management (super_admin only)
# ---------------------------------------------------------------------------
class AdminCreate(BaseModel):
    full_name: str = Field(min_length=2)
    user_id: str = Field(min_length=3)
    password: str = Field(min_length=6)
    email: Optional[str] = None
    mobile: Optional[str] = None


class AdminUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    mobile: Optional[str] = None
    password: Optional[str] = None


@api.get("/admins")
async def list_admins(user: dict = Depends(require_roles("super_admin"))):
    cur = users.find({"role": {"$in": ["admin", "super_admin"]}}, {"_id": 0}).sort("created_at", -1)
    docs = await cur.to_list(500)
    return [public_user(u) for u in docs]


@api.post("/admins")
async def create_admin(body: AdminCreate, user: dict = Depends(require_roles("super_admin"))):
    if await users.find_one({"user_id": body.user_id}):
        raise HTTPException(status_code=409, detail="This User ID is already taken.")
    t = iso(now())
    doc = {
        "id": uid(),
        "full_name": body.full_name.strip(),
        "user_id": body.user_id.strip(),
        "mobile": body.mobile,
        "email": body.email,
        "role": "admin",
        "status": "active",
        "password_hash": hash_password(body.password),
        "token_version": 0,
        "created_at": t,
        "updated_at": t,
    }
    await users.insert_one(doc)
    await write_audit(user, "ADMIN_CREATED", "admins", doc["id"], f"Created admin {body.user_id}")
    return public_user(doc)


@api.put("/admins/{admin_id}")
async def update_admin(admin_id: str, body: AdminUpdate, user: dict = Depends(require_roles("super_admin"))):
    target = await users.find_one({"id": admin_id})
    if not target or target["role"] not in ("admin", "super_admin"):
        raise HTTPException(status_code=404, detail="Admin not found")
    update = {"updated_at": iso(now())}
    if body.full_name is not None:
        update["full_name"] = body.full_name.strip()
    if body.email is not None:
        update["email"] = body.email
    if body.mobile is not None:
        update["mobile"] = body.mobile
    inc = {}
    if body.password:
        update["password_hash"] = hash_password(body.password)
        inc["token_version"] = 1
    ops = {"$set": update}
    if inc:
        ops["$inc"] = inc
    await users.update_one({"id": admin_id}, ops)
    await write_audit(user, "ADMIN_UPDATED", "admins", admin_id, "Updated admin details")
    doc = await users.find_one({"id": admin_id}, {"_id": 0})
    return public_user(doc)


@api.post("/admins/{admin_id}/status")
async def set_admin_status(admin_id: str, active: bool = Query(...), user: dict = Depends(require_roles("super_admin"))):
    target = await users.find_one({"id": admin_id})
    if not target or target["role"] != "admin":
        raise HTTPException(status_code=404, detail="Admin not found")
    status = "active" if active else "deactivated"
    await users.update_one({"id": admin_id}, {"$set": {"status": status, "updated_at": iso(now())}, "$inc": {"token_version": 1}})
    await write_audit(user, "ADMIN_ACTIVATED" if active else "ADMIN_DEACTIVATED", "admins", admin_id, f"Set status {status}")
    doc = await users.find_one({"id": admin_id}, {"_id": 0})
    return public_user(doc)


# ---------------------------------------------------------------------------
# Members
# ---------------------------------------------------------------------------
class MemberCreate(BaseModel):
    full_name: str = Field(min_length=2)
    mobile: str
    email: Optional[str] = None
    address: Optional[str] = None
    target_amount: float = 0
    advance_amount: float = 0
    password: Optional[str] = None  # if set, creates a login for the member

    @field_validator("mobile")
    @classmethod
    def valid_mobile(cls, v: str) -> str:
        digits = "".join(ch for ch in v if ch.isdigit())
        if len(digits) < 10:
            raise ValueError("Enter a valid mobile number")
        return digits[-10:]

    @field_validator("target_amount", "advance_amount")
    @classmethod
    def non_negative(cls, v: float) -> float:
        if v < 0:
            raise ValueError("Amount cannot be negative")
        return v


class MemberUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    target_amount: Optional[float] = None
    advance_amount: Optional[float] = None


@api.get("/members")
async def list_members(
    status: Optional[str] = None,
    search: Optional[str] = None,
    user: dict = Depends(current_user),
):
    q: dict = {"deleted_at": None}
    if status:
        q["status"] = status
    if search:
        q["$or"] = [
            {"full_name": {"$regex": search, "$options": "i"}},
            {"mobile": {"$regex": search, "$options": "i"}},
        ]
    cur = members.find(q, {"_id": 0}).sort("created_at", -1)
    docs = await cur.to_list(1000)
    return [await enrich_member(m) for m in docs]


@api.get("/members/{member_id}")
async def get_member(member_id: str, user: dict = Depends(current_user)):
    m = await members.find_one({"id": member_id, "deleted_at": None}, {"_id": 0})
    if not m:
        raise HTTPException(status_code=404, detail="Member not found")
    return await enrich_member(m)


@api.post("/members")
async def create_member(body: MemberCreate, user: dict = Depends(require_roles(*ADMIN_ROLES))):
    if await members.find_one({"mobile": body.mobile, "deleted_at": None}):
        raise HTTPException(status_code=409, detail="This mobile number is already registered.")
    t = iso(now())
    profile_id = None
    if body.password:
        if await users.find_one({"mobile": body.mobile}):
            raise HTTPException(status_code=409, detail="This mobile number is already registered.")
        profile_id = uid()
        await users.insert_one({
            "id": profile_id,
            "full_name": body.full_name.strip(),
            "user_id": None,
            "mobile": body.mobile,
            "email": body.email,
            "role": "member",
            "status": "active",
            "password_hash": hash_password(body.password),
            "token_version": 0,
            "created_at": t,
            "updated_at": t,
        })
    doc = {
        "id": uid(),
        "profile_id": profile_id,
        "full_name": body.full_name.strip(),
        "mobile": body.mobile,
        "email": body.email,
        "address": body.address,
        "joining_date": t,
        "status": "active",
        "target_amount": body.target_amount,
        "advance_amount": body.advance_amount,
        "created_by": user["id"],
        "created_at": t,
        "updated_at": t,
        "deleted_at": None,
    }
    await members.insert_one(doc)
    await write_audit(user, "MEMBER_CREATED", "members", doc["id"], f"Added member {body.full_name}")
    return await enrich_member(doc)


@api.put("/members/{member_id}")
async def update_member(member_id: str, body: MemberUpdate, user: dict = Depends(require_roles(*ADMIN_ROLES))):
    m = await members.find_one({"id": member_id, "deleted_at": None})
    if not m:
        raise HTTPException(status_code=404, detail="Member not found")
    update = {"updated_at": iso(now())}
    for f in ("full_name", "email", "address", "target_amount", "advance_amount"):
        val = getattr(body, f)
        if val is not None:
            if f in ("target_amount", "advance_amount") and val < 0:
                raise HTTPException(status_code=400, detail="Amount cannot be negative")
            update[f] = val
    await members.update_one({"id": member_id}, {"$set": update})
    await write_audit(user, "MEMBER_UPDATED", "members", member_id, "Updated member")
    doc = await members.find_one({"id": member_id}, {"_id": 0})
    return await enrich_member(doc)


@api.delete("/members/{member_id}")
async def delete_member(member_id: str, user: dict = Depends(require_roles(*ADMIN_ROLES))):
    m = await members.find_one({"id": member_id, "deleted_at": None})
    if not m:
        raise HTTPException(status_code=404, detail="Member not found")
    await members.update_one({"id": member_id}, {"$set": {"deleted_at": iso(now())}})
    if m.get("profile_id"):
        await users.update_one({"id": m["profile_id"]}, {"$set": {"status": "deactivated"}, "$inc": {"token_version": 1}})
    await write_audit(user, "MEMBER_DELETED", "members", member_id, f"Deleted {m.get('full_name')}")
    return {"message": "Member deleted"}


@api.post("/members/{member_id}/approve")
async def approve_member(member_id: str, user: dict = Depends(require_roles(*ADMIN_ROLES))):
    m = await members.find_one({"id": member_id, "deleted_at": None})
    if not m:
        raise HTTPException(status_code=404, detail="Member not found")
    await members.update_one({"id": member_id}, {"$set": {"status": "active", "updated_at": iso(now())}})
    if m.get("profile_id"):
        await users.update_one({"id": m["profile_id"]}, {"$set": {"status": "active"}})
        await notify("user", "Registration approved",
                     "Your membership has been approved. You can now sign in.", "success", m["profile_id"])
    await write_audit(user, "MEMBER_APPROVED", "members", member_id, f"Approved {m.get('full_name')}")
    doc = await members.find_one({"id": member_id}, {"_id": 0})
    return await enrich_member(doc)


@api.post("/members/{member_id}/reject")
async def reject_member(member_id: str, user: dict = Depends(require_roles(*ADMIN_ROLES))):
    m = await members.find_one({"id": member_id, "deleted_at": None})
    if not m:
        raise HTTPException(status_code=404, detail="Member not found")
    await members.update_one({"id": member_id}, {"$set": {"status": "rejected", "updated_at": iso(now())}})
    if m.get("profile_id"):
        await users.update_one({"id": m["profile_id"]}, {"$set": {"status": "rejected"}, "$inc": {"token_version": 1}})
        await notify("user", "Registration rejected",
                     "Your membership request was not approved. Contact an administrator.", "error", m["profile_id"])
    await write_audit(user, "MEMBER_REJECTED", "members", member_id, f"Rejected {m.get('full_name')}")
    doc = await members.find_one({"id": member_id}, {"_id": 0})
    return await enrich_member(doc)


# ---------------------------------------------------------------------------
# Vargani payments
# ---------------------------------------------------------------------------
class PaymentCreate(BaseModel):
    member_id: str
    amount: float
    payment_mode: str
    payment_date: Optional[str] = None
    transaction_number: Optional[str] = None
    remarks: Optional[str] = None
    allow_overpay: bool = False

    @field_validator("amount")
    @classmethod
    def positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Payment amount must be greater than zero")
        return v

    @field_validator("payment_mode")
    @classmethod
    def valid_mode(cls, v: str) -> str:
        if v not in PAYMENT_MODES:
            raise ValueError("Invalid payment mode")
        return v


@api.get("/payments")
async def list_payments(
    member_id: Optional[str] = None,
    user: dict = Depends(current_user),
):
    q: dict = {"deleted_at": None}
    if member_id:
        q["member_id"] = member_id
    cur = payments.find(q, {"_id": 0}).sort("payment_date", -1)
    docs = await cur.to_list(1000)
    ids = list({d["member_id"] for d in docs})
    mmap = {}
    if ids:
        mcur = members.find({"id": {"$in": ids}}, {"_id": 0, "id": 1, "full_name": 1})
        for m in await mcur.to_list(1000):
            mmap[m["id"]] = m["full_name"]
    for d in docs:
        d["member_name"] = mmap.get(d["member_id"], "Unknown")
    return docs


@api.get("/payments/{payment_id}")
async def get_payment(payment_id: str, user: dict = Depends(current_user)):
    p = await payments.find_one({"id": payment_id, "deleted_at": None}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Payment not found")
    m = await members.find_one({"id": p["member_id"]}, {"_id": 0, "full_name": 1})
    p["member_name"] = m.get("full_name") if m else "Unknown"
    return p


@api.post("/payments")
async def create_payment(body: PaymentCreate, user: dict = Depends(require_roles(*ADMIN_ROLES))):
    m = await members.find_one({"id": body.member_id, "deleted_at": None})
    if not m:
        raise HTTPException(status_code=404, detail="Member not found")
    paid = await member_payments_sum(body.member_id)
    advance = float(m.get("advance_amount", 0) or 0)
    collected = advance + paid
    pending = float(m.get("target_amount", 0) or 0) - collected
    if not body.allow_overpay and body.amount > pending and pending >= 0:
        raise HTTPException(
            status_code=400,
            detail=f"Payment (₹{body.amount:,.0f}) exceeds pending Vargani (₹{pending:,.0f}).",
        )
    t = iso(now())
    doc = {
        "id": uid(),
        "member_id": body.member_id,
        "amount": body.amount,
        "payment_date": body.payment_date or t,
        "payment_mode": body.payment_mode,
        "transaction_number": body.transaction_number,
        "remarks": body.remarks,
        "created_by": user["id"],
        "created_at": t,
        "updated_at": t,
        "deleted_at": None,
    }
    await payments.insert_one(doc)
    await write_audit(user, "VARGANI_PAYMENT_ADDED", "vargani", doc["id"],
                      f"₹{body.amount:,.0f} from {m.get('full_name')}")
    await notify("admins", "New Vargani payment",
                 f"₹{body.amount:,.0f} recorded for {m.get('full_name')}.", "payment")
    doc.pop("_id", None)
    doc["member_name"] = m.get("full_name")
    return doc


@api.put("/payments/{payment_id}")
async def update_payment(payment_id: str, body: PaymentCreate, user: dict = Depends(require_roles(*ADMIN_ROLES))):
    p = await payments.find_one({"id": payment_id, "deleted_at": None})
    if not p:
        raise HTTPException(status_code=404, detail="Payment not found")
    await payments.update_one({"id": payment_id}, {"$set": {
        "amount": body.amount,
        "payment_mode": body.payment_mode,
        "payment_date": body.payment_date or p["payment_date"],
        "transaction_number": body.transaction_number,
        "remarks": body.remarks,
        "updated_at": iso(now()),
    }})
    await write_audit(user, "VARGANI_PAYMENT_UPDATED", "vargani", payment_id, "Updated payment")
    doc = await payments.find_one({"id": payment_id}, {"_id": 0})
    return doc


@api.delete("/payments/{payment_id}")
async def delete_payment(payment_id: str, user: dict = Depends(require_roles(*ADMIN_ROLES))):
    p = await payments.find_one({"id": payment_id, "deleted_at": None})
    if not p:
        raise HTTPException(status_code=404, detail="Payment not found")
    await payments.update_one({"id": payment_id}, {"$set": {"deleted_at": iso(now())}})
    await write_audit(user, "VARGANI_PAYMENT_DELETED", "vargani", payment_id, "Deleted payment")
    return {"message": "Payment deleted"}


# ---------------------------------------------------------------------------
# Expenses
# ---------------------------------------------------------------------------
class ExpenseCreate(BaseModel):
    title: str = Field(min_length=1)
    category: str
    amount: float
    expense_date: Optional[str] = None
    paid_by: Optional[str] = None
    payment_mode: Optional[str] = None
    vendor: Optional[str] = None
    description: Optional[str] = None
    receipt_url: Optional[str] = None
    remarks: Optional[str] = None

    @field_validator("amount")
    @classmethod
    def positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Expense amount must be greater than zero")
        return v

    @field_validator("category")
    @classmethod
    def valid_cat(cls, v: str) -> str:
        if v not in EXPENSE_CATEGORIES:
            raise ValueError("Invalid category")
        return v


@api.get("/expenses")
async def list_expenses(
    category: Optional[str] = None,
    search: Optional[str] = None,
    user: dict = Depends(current_user),
):
    q: dict = {"deleted_at": None}
    if category:
        q["category"] = category
    if search:
        q["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"vendor": {"$regex": search, "$options": "i"}},
        ]
    cur = expenses.find(q, {"_id": 0}).sort("expense_date", -1)
    return await cur.to_list(1000)


@api.get("/expenses/{expense_id}")
async def get_expense(expense_id: str, user: dict = Depends(current_user)):
    e = await expenses.find_one({"id": expense_id, "deleted_at": None}, {"_id": 0})
    if not e:
        raise HTTPException(status_code=404, detail="Expense not found")
    return e


@api.post("/expenses")
async def create_expense(body: ExpenseCreate, user: dict = Depends(require_roles(*ADMIN_ROLES))):
    t = iso(now())
    doc = {
        "id": uid(),
        "title": body.title.strip(),
        "category": body.category,
        "amount": body.amount,
        "expense_date": body.expense_date or t,
        "paid_by": body.paid_by,
        "payment_mode": body.payment_mode,
        "vendor": body.vendor,
        "description": body.description,
        "receipt_url": body.receipt_url,
        "remarks": body.remarks,
        "created_by": user["id"],
        "created_at": t,
        "updated_at": t,
        "deleted_at": None,
    }
    await expenses.insert_one(doc)
    await write_audit(user, "EXPENSE_ADDED", "expenses", doc["id"], f"{body.title} ₹{body.amount:,.0f}")
    await notify("admins", "New expense added", f"{body.title} — ₹{body.amount:,.0f}", "expense")
    doc.pop("_id", None)
    return doc


@api.put("/expenses/{expense_id}")
async def update_expense(expense_id: str, body: ExpenseCreate, user: dict = Depends(require_roles(*ADMIN_ROLES))):
    e = await expenses.find_one({"id": expense_id, "deleted_at": None})
    if not e:
        raise HTTPException(status_code=404, detail="Expense not found")
    await expenses.update_one({"id": expense_id}, {"$set": {
        "title": body.title.strip(),
        "category": body.category,
        "amount": body.amount,
        "expense_date": body.expense_date or e["expense_date"],
        "paid_by": body.paid_by,
        "payment_mode": body.payment_mode,
        "vendor": body.vendor,
        "description": body.description,
        "receipt_url": body.receipt_url,
        "remarks": body.remarks,
        "updated_at": iso(now()),
    }})
    await write_audit(user, "EXPENSE_UPDATED", "expenses", expense_id, "Updated expense")
    doc = await expenses.find_one({"id": expense_id}, {"_id": 0})
    return doc


@api.delete("/expenses/{expense_id}")
async def delete_expense(expense_id: str, user: dict = Depends(require_roles(*ADMIN_ROLES))):
    e = await expenses.find_one({"id": expense_id, "deleted_at": None})
    if not e:
        raise HTTPException(status_code=404, detail="Expense not found")
    await expenses.update_one({"id": expense_id}, {"$set": {"deleted_at": iso(now())}})
    await write_audit(user, "EXPENSE_DELETED", "expenses", expense_id, "Deleted expense")
    return {"message": "Expense deleted"}


# ---------------------------------------------------------------------------
# Events
# ---------------------------------------------------------------------------
class EventCreate(BaseModel):
    event_name: str = Field(min_length=1)
    event_date: str
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    location: Optional[str] = None
    organizer: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    status: str = "Upcoming"

    @field_validator("status")
    @classmethod
    def valid_status(cls, v: str) -> str:
        if v not in EVENT_STATUSES:
            raise ValueError("Invalid status")
        return v


@api.get("/events")
async def list_events(status: Optional[str] = None, user: dict = Depends(current_user)):
    q: dict = {"deleted_at": None}
    if status:
        q["status"] = status
    cur = events.find(q, {"_id": 0}).sort("event_date", 1)
    return await cur.to_list(1000)


@api.get("/events/{event_id}")
async def get_event(event_id: str, user: dict = Depends(current_user)):
    e = await events.find_one({"id": event_id, "deleted_at": None}, {"_id": 0})
    if not e:
        raise HTTPException(status_code=404, detail="Event not found")
    return e


@api.post("/events")
async def create_event(body: EventCreate, user: dict = Depends(require_roles(*ADMIN_ROLES))):
    t = iso(now())
    doc = {
        "id": uid(),
        "event_name": body.event_name.strip(),
        "event_date": body.event_date,
        "start_time": body.start_time,
        "end_time": body.end_time,
        "location": body.location,
        "organizer": body.organizer,
        "description": body.description,
        "image_url": body.image_url,
        "status": body.status,
        "created_by": user["id"],
        "created_at": t,
        "updated_at": t,
        "deleted_at": None,
    }
    await events.insert_one(doc)
    await write_audit(user, "EVENT_CREATED", "events", doc["id"], body.event_name)
    await notify("all", "New event", f"{body.event_name} scheduled.", "event")
    doc.pop("_id", None)
    return doc


@api.put("/events/{event_id}")
async def update_event(event_id: str, body: EventCreate, user: dict = Depends(require_roles(*ADMIN_ROLES))):
    e = await events.find_one({"id": event_id, "deleted_at": None})
    if not e:
        raise HTTPException(status_code=404, detail="Event not found")
    await events.update_one({"id": event_id}, {"$set": {
        "event_name": body.event_name.strip(),
        "event_date": body.event_date,
        "start_time": body.start_time,
        "end_time": body.end_time,
        "location": body.location,
        "organizer": body.organizer,
        "description": body.description,
        "image_url": body.image_url,
        "status": body.status,
        "updated_at": iso(now()),
    }})
    await write_audit(user, "EVENT_UPDATED", "events", event_id, body.event_name)
    await notify("all", "Event updated", f"{body.event_name} was updated.", "event")
    doc = await events.find_one({"id": event_id}, {"_id": 0})
    return doc


@api.delete("/events/{event_id}")
async def delete_event(event_id: str, user: dict = Depends(require_roles(*ADMIN_ROLES))):
    e = await events.find_one({"id": event_id, "deleted_at": None})
    if not e:
        raise HTTPException(status_code=404, detail="Event not found")
    await events.update_one({"id": event_id}, {"$set": {"deleted_at": iso(now())}})
    await write_audit(user, "EVENT_DELETED", "events", event_id, e.get("event_name"))
    return {"message": "Event deleted"}


# ---------------------------------------------------------------------------
# Dashboard & reports
# ---------------------------------------------------------------------------
async def _sum(collection, match: dict, field: str) -> float:
    cur = collection.aggregate([
        {"$match": match},
        {"$group": {"_id": None, "total": {"$sum": f"${field}"}}},
    ])
    docs = await cur.to_list(1)
    return float(docs[0]["total"]) if docs else 0.0


@api.get("/dashboard")
async def dashboard(user: dict = Depends(current_user)):
    total_target = await _sum(members, {"deleted_at": None, "status": "active"}, "target_amount")
    total_advance = await _sum(members, {"deleted_at": None, "status": "active"}, "advance_amount")
    total_paid = await _sum(payments, {"deleted_at": None}, "amount")
    total_collected = total_paid + total_advance  # advance counts as collected
    total_expenses = await _sum(expenses, {"deleted_at": None}, "amount")
    total_pending = total_target - total_collected
    net_balance = total_collected - total_expenses

    today = now().date().isoformat()
    ev_cur = events.find(
        {"deleted_at": None, "status": "Upcoming", "event_date": {"$gte": today}}, {"_id": 0}
    ).sort("event_date", 1).limit(5)
    upcoming = await ev_cur.to_list(5)

    member_count = await members.count_documents({"deleted_at": None, "status": "active"})
    pending_count = await members.count_documents({"deleted_at": None, "status": "pending"})

    act_cur = audit_logs.find({}, {"_id": 0}).sort("created_at", -1).limit(8)
    recent = await act_cur.to_list(8)

    # Member's own Vargani summary (for payment reminder banner)
    my_vargani = None
    my_member = await members.find_one(
        {"profile_id": user["id"], "deleted_at": None}, {"_id": 0}
    )
    if my_member:
        enriched = await enrich_member(my_member)
        my_vargani = {
            "full_name": enriched["full_name"],
            "target_amount": enriched["target_amount"],
            "collected": enriched["collected"],
            "pending": enriched["pending"],
        }

    return {
        "total_target": total_target,
        "total_collected": total_collected,
        "total_pending": total_pending,
        "total_advance": total_advance,
        "total_expenses": total_expenses,
        "net_balance": net_balance,
        "member_count": member_count,
        "pending_approvals": pending_count,
        "collection_percent": round((total_collected / total_target * 100) if total_target > 0 else 0, 1),
        "upcoming_events": upcoming,
        "recent_activity": recent,
        "my_vargani": my_vargani,
    }


@api.get("/reports/vargani")
async def report_vargani(user: dict = Depends(current_user)):
    cur = members.find({"deleted_at": None, "status": "active"}, {"_id": 0}).sort("full_name", 1)
    docs = await cur.to_list(1000)
    rows = [await enrich_member(m) for m in docs]
    paid = [r for r in rows if r["pending"] <= 0 and r["target_amount"] > 0]
    partial = [r for r in rows if 0 < r["pending"] < r["target_amount"]]
    unpaid = [r for r in rows if r["collected"] == 0 and r["target_amount"] > 0]
    return {
        "total_target": sum(r["target_amount"] for r in rows),
        "total_collected": sum(r["collected"] for r in rows),
        "total_advance": sum(r["advance_amount"] for r in rows),
        "total_pending": sum(r["target_amount"] for r in rows) - sum(r["collected"] for r in rows),
        "paid_count": len(paid),
        "partial_count": len(partial),
        "pending_count": len(unpaid),
        "members": rows,
    }


@api.get("/reports/expenses")
async def report_expenses(user: dict = Depends(current_user)):
    cur = expenses.find({"deleted_at": None}, {"_id": 0})
    docs = await cur.to_list(2000)
    by_cat: dict = {}
    by_month: dict = {}
    for e in docs:
        by_cat[e["category"]] = by_cat.get(e["category"], 0) + e["amount"]
        month = (e.get("expense_date") or "")[:7]
        if month:
            by_month[month] = by_month.get(month, 0) + e["amount"]
    return {
        "total": sum(e["amount"] for e in docs),
        "count": len(docs),
        "by_category": [{"category": k, "amount": v} for k, v in sorted(by_cat.items(), key=lambda x: -x[1])],
        "by_month": [{"month": k, "amount": v} for k, v in sorted(by_month.items())],
    }


@api.get("/reports/events")
async def report_events(user: dict = Depends(current_user)):
    result = {}
    for s in EVENT_STATUSES:
        result[s.lower()] = await events.count_documents({"deleted_at": None, "status": s})
    return result


@api.get("/reports/vargani/export")
async def export_vargani(user: dict = Depends(require_roles(*ADMIN_ROLES))):
    cur = members.find({"deleted_at": None}, {"_id": 0}).sort("full_name", 1)
    docs = await cur.to_list(2000)
    rows = [await enrich_member(m) for m in docs]
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["Name", "Mobile", "Target", "Advance", "Collected", "Pending", "Status"])
    for r in rows:
        w.writerow([r["full_name"], r["mobile"], r["target_amount"], r["advance_amount"],
                    r["collected"], r["pending"], r["status"]])
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=vargani_report.csv"},
    )


@api.get("/reports/expenses/export")
async def export_expenses(user: dict = Depends(require_roles(*ADMIN_ROLES))):
    cur = expenses.find({"deleted_at": None}, {"_id": 0}).sort("expense_date", -1)
    docs = await cur.to_list(5000)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["Title", "Category", "Amount", "Date", "Vendor", "Paid By", "Mode"])
    for e in docs:
        w.writerow([e["title"], e["category"], e["amount"], (e.get("expense_date") or "")[:10],
                    e.get("vendor") or "", e.get("paid_by") or "", e.get("payment_mode") or ""])
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=expense_report.csv"},
    )


# ---------------------------------------------------------------------------
# Notifications & audit
# ---------------------------------------------------------------------------
@api.get("/notifications")
async def list_notifications(user: dict = Depends(current_user)):
    conds = [{"audience": "all"}, {"audience": "user", "user_id": user["id"]}]
    if user["role"] in ADMIN_ROLES:
        conds.append({"audience": "admins"})
    cur = notifications.find({"$or": conds}, {"_id": 0}).sort("created_at", -1).limit(100)
    docs = await cur.to_list(100)
    unread = sum(1 for d in docs if not d.get("is_read"))
    return {"notifications": docs, "unread": unread}


@api.post("/notifications/{notif_id}/read")
async def mark_read(notif_id: str, user: dict = Depends(current_user)):
    await notifications.update_one({"id": notif_id}, {"$set": {"is_read": True}})
    return {"message": "ok"}


@api.post("/notifications/read-all")
async def mark_all_read(user: dict = Depends(current_user)):
    conds = [{"audience": "all"}, {"audience": "user", "user_id": user["id"]}]
    if user["role"] in ADMIN_ROLES:
        conds.append({"audience": "admins"})
    await notifications.update_many({"$or": conds}, {"$set": {"is_read": True}})
    return {"message": "ok"}


@api.get("/audit-logs")
async def list_audit(user: dict = Depends(require_roles("super_admin"))):
    cur = audit_logs.find({}, {"_id": 0}).sort("created_at", -1).limit(200)
    return await cur.to_list(200)


# ---------------------------------------------------------------------------
# File upload / serve (Emergent Object Storage)
# ---------------------------------------------------------------------------
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/jpg"}
MAX_UPLOAD_BYTES = 8 * 1024 * 1024  # 8 MB


@api.post("/upload")
async def upload_file(file: UploadFile = File(...), user: dict = Depends(require_roles(*ADMIN_ROLES))):
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="Image too large (max 8 MB).")
    content_type = file.content_type or "application/octet-stream"
    if content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Only image files are allowed.")
    ext = (file.filename or "img.jpg").rsplit(".", 1)[-1].lower()
    if ext not in ("jpg", "jpeg", "png", "webp", "heic"):
        ext = "jpg"
    path = f"{APP_NAME}/uploads/{user['id']}/{uid()}.{ext}"
    try:
        await run_in_threadpool(put_object, path, data, content_type)
    except requests.HTTPError as e:
        code = e.response.status_code if e.response is not None else 500
        if code == 402:
            raise HTTPException(status_code=402, detail="Storage credit limit reached.")
        raise HTTPException(status_code=502, detail="Upload failed. Please try again.")
    return {"path": path}


@api.get("/files/{path:path}")
async def serve_file(path: str, token: Optional[str] = Query(None)):
    # Auth via query token (web <img>) since Authorization headers aren't sendable there.
    if not token or not decode_token(token):
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        content, ctype = await run_in_threadpool(get_object, path)
    except requests.HTTPError:
        raise HTTPException(status_code=404, detail="File not found")
    return Response(content=content, media_type=ctype, headers={"Cache-Control": "public, max-age=86400"})


@api.get("/")
async def root():
    return {"app": "Kranti Ganesh Mandal 2026 Management", "status": "ok"}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await users.create_index("id", unique=True)
    await users.create_index("mobile", sparse=True)
    await users.create_index("user_id", sparse=True)
    await members.create_index("id", unique=True)
    await payments.create_index("member_id")

    try:
        await run_in_threadpool(init_storage)
        logger.info("Object storage initialized")
    except Exception as e:
        logger.warning("Object storage init failed: %s", e)

    sa_user_id = os.environ.get("SUPER_ADMIN_USER_ID")
    sa_password = os.environ.get("SUPER_ADMIN_PASSWORD")
    if sa_user_id and sa_password:
        existing = await users.find_one({"user_id": sa_user_id})
        if not existing:
            t = iso(now())
            await users.insert_one({
                "id": uid(),
                "full_name": os.environ.get("SUPER_ADMIN_NAME", "Super Admin"),
                "user_id": sa_user_id,
                "mobile": None,
                "email": None,
                "role": "super_admin",
                "status": "active",
                "password_hash": hash_password(sa_password),
                "token_version": 0,
                "created_at": t,
                "updated_at": t,
            })
            logger.info("Seeded super admin '%s'", sa_user_id)


@app.on_event("shutdown")
async def shutdown():
    from db import client
    client.close()
