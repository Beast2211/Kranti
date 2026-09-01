"""Backend tests for the two reported bug fixes:
  - Issue 1: delete member -> re-add same mobile with password works and can log in
  - Issue 2: super_admin set/reset password for member with or without a login
"""
import os
import time
import uuid

import pytest
import requests

BASE_URL = (os.environ.get("EXPO_PUBLIC_BACKEND_URL") or "https://mandal-admin-3.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

SUPER_ADMIN = {"identifier": "superadmin", "password": "Kranti@2026"}


def _auth(token): return {"Authorization": f"Bearer {token}"}


def _rand_mobile(prefix="9"):
    # 10-digit unique mobile
    return prefix + str(int(time.time() * 1000))[-9:] + str(uuid.uuid4().int % 10)


@pytest.fixture(scope="module")
def sa_token():
    r = requests.post(f"{API}/auth/login", json=SUPER_ADMIN, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_token(sa_token):
    uid_val = f"TEST_admin_{uuid.uuid4().hex[:6]}"
    pwd = "Admin@123"
    r = requests.post(f"{API}/admins", headers=_auth(sa_token),
                      json={"full_name": "TEST BugFix Admin", "user_id": uid_val, "password": pwd}, timeout=30)
    assert r.status_code == 200, r.text
    admin_id = r.json()["id"]
    r2 = requests.post(f"{API}/auth/login", json={"identifier": uid_val, "password": pwd}, timeout=30)
    assert r2.status_code == 200
    token = r2.json()["access_token"]
    yield token
    # cleanup
    try:
        requests.delete(f"{API}/admins/{admin_id}", headers=_auth(sa_token), timeout=30)
    except Exception:
        pass


# ============================ ISSUE 1 ============================
class TestDeleteAndReAddWithSameMobile:
    """Deleting a member with a login should hard-delete the user row so the
    same mobile+password can be registered again immediately."""

    def _mobile(self):
        return _rand_mobile("9")[:10]

    def test_create_delete_readd_with_password(self, sa_token):
        mobile = self._mobile()[:10]
        assert len(mobile) == 10
        pwd1 = "Pass@1111"
        pwd2 = "Pass@2222"

        # Create with login (password)
        r = requests.post(f"{API}/members", headers=_auth(sa_token), json={
            "full_name": "TEST BugFix Reset1",
            "mobile": mobile, "target_amount": 5000, "password": pwd1,
        }, timeout=30)
        assert r.status_code == 200, r.text
        m1 = r.json()
        assert m1["mobile"] == mobile

        # confirm first-user can log in
        r = requests.post(f"{API}/auth/login", json={"identifier": mobile, "password": pwd1}, timeout=30)
        assert r.status_code == 200, r.text

        # Delete
        r = requests.delete(f"{API}/members/{m1['id']}", headers=_auth(sa_token), timeout=30)
        assert r.status_code == 200, r.text

        # Old password should no longer work (user hard-deleted)
        r = requests.post(f"{API}/auth/login", json={"identifier": mobile, "password": pwd1}, timeout=30)
        assert r.status_code == 401

        # Re-add with SAME mobile and a new password — must succeed (no 409)
        r = requests.post(f"{API}/members", headers=_auth(sa_token), json={
            "full_name": "TEST BugFix Reset1 Again",
            "mobile": mobile, "target_amount": 5000, "password": pwd2,
        }, timeout=30)
        assert r.status_code == 200, f"Re-add failed: {r.status_code} {r.text}"
        m2 = r.json()
        assert m2["id"] != m1["id"]

        # Re-added member logs in
        r = requests.post(f"{API}/auth/login", json={"identifier": mobile, "password": pwd2}, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["user"]["role"] == "member"

        # cleanup
        requests.delete(f"{API}/members/{m2['id']}", headers=_auth(sa_token), timeout=30)

    def test_self_register_delete_readd_with_password(self, sa_token):
        mobile = _rand_mobile("8")[:10]
        pwd1 = "Self@1111"
        pwd2 = "Self@2222"

        # self-register
        r = requests.post(f"{API}/auth/register", json={
            "full_name": "TEST BugFix SelfReg", "mobile": mobile, "password": pwd1,
        }, timeout=30)
        assert r.status_code == 200, r.text

        # find pending member
        r = requests.get(f"{API}/members?status=pending", headers=_auth(sa_token), timeout=30)
        assert r.status_code == 200
        matches = [m for m in r.json() if m["mobile"] == mobile]
        assert matches, "pending self-registered member not found"
        mid = matches[0]["id"]

        # Delete the pending self-registered member (has login)
        r = requests.delete(f"{API}/members/{mid}", headers=_auth(sa_token), timeout=30)
        assert r.status_code == 200, r.text

        # Re-add with same mobile + password by super admin
        r = requests.post(f"{API}/members", headers=_auth(sa_token), json={
            "full_name": "TEST BugFix SelfReg Re-added",
            "mobile": mobile, "target_amount": 3000, "password": pwd2,
        }, timeout=30)
        assert r.status_code == 200, f"Re-add after self-register delete failed: {r.status_code} {r.text}"
        m2 = r.json()

        # login works with new password
        r = requests.post(f"{API}/auth/login", json={"identifier": mobile, "password": pwd2}, timeout=30)
        assert r.status_code == 200, r.text

        # cleanup
        requests.delete(f"{API}/members/{m2['id']}", headers=_auth(sa_token), timeout=30)


# ============================ ISSUE 2 ============================
class TestSetOrResetMemberPassword:
    def test_super_admin_sets_password_for_member_without_login(self, sa_token):
        mobile = _rand_mobile("7")[:10]
        # Create member WITHOUT password (no login)
        r = requests.post(f"{API}/members", headers=_auth(sa_token), json={
            "full_name": "TEST NoLogin Member", "mobile": mobile, "target_amount": 2000,
        }, timeout=30)
        assert r.status_code == 200, r.text
        m = r.json()
        assert m.get("profile_id") in (None, "", None)  # no linked login

        # Login as this mobile — must fail (no user exists)
        r = requests.post(f"{API}/auth/login", json={"identifier": mobile, "password": "AnyPass@123"}, timeout=30)
        assert r.status_code == 401

        # Super admin sets a password
        newpw = "SetPwd@2026"
        r = requests.post(f"{API}/members/{m['id']}/reset-password", headers=_auth(sa_token),
                          json={"new_password": newpw, "confirm_password": newpw}, timeout=30)
        assert r.status_code == 200, r.text

        # Member can now log in
        r = requests.post(f"{API}/auth/login", json={"identifier": mobile, "password": newpw}, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["user"]["role"] == "member"

        # Verify member now has profile_id
        r = requests.get(f"{API}/members/{m['id']}", headers=_auth(sa_token), timeout=30)
        assert r.status_code == 200
        assert r.json().get("profile_id")

        # cleanup
        requests.delete(f"{API}/members/{m['id']}", headers=_auth(sa_token), timeout=30)

    def test_super_admin_resets_password_for_member_with_login(self, sa_token):
        mobile = _rand_mobile("7")[:10]
        oldpw = "OldPwd@2026"
        newpw = "NewPwd@2026"
        # Create member WITH login
        r = requests.post(f"{API}/members", headers=_auth(sa_token), json={
            "full_name": "TEST WithLogin", "mobile": mobile, "target_amount": 1000, "password": oldpw,
        }, timeout=30)
        assert r.status_code == 200, r.text
        m = r.json()

        # Old password works
        r = requests.post(f"{API}/auth/login", json={"identifier": mobile, "password": oldpw}, timeout=30)
        assert r.status_code == 200

        # Super admin resets to new password
        r = requests.post(f"{API}/members/{m['id']}/reset-password", headers=_auth(sa_token),
                          json={"new_password": newpw, "confirm_password": newpw}, timeout=30)
        assert r.status_code == 200, r.text

        # Old password rejected (token_version bumped)
        r = requests.post(f"{API}/auth/login", json={"identifier": mobile, "password": oldpw}, timeout=30)
        assert r.status_code == 401

        # New password works
        r = requests.post(f"{API}/auth/login", json={"identifier": mobile, "password": newpw}, timeout=30)
        assert r.status_code == 200, r.text

        # cleanup
        requests.delete(f"{API}/members/{m['id']}", headers=_auth(sa_token), timeout=30)

    def test_admin_role_forbidden_from_reset_password(self, sa_token, admin_token):
        # Create a member first with SA
        mobile = _rand_mobile("6")[:10]
        r = requests.post(f"{API}/members", headers=_auth(sa_token), json={
            "full_name": "TEST AdminReset Target", "mobile": mobile, "target_amount": 500,
        }, timeout=30)
        assert r.status_code == 200
        m = r.json()

        # Regular admin tries reset — must 403
        r = requests.post(f"{API}/members/{m['id']}/reset-password", headers=_auth(admin_token),
                          json={"new_password": "Nope@1234", "confirm_password": "Nope@1234"}, timeout=30)
        assert r.status_code == 403, f"expected 403 got {r.status_code}: {r.text}"

        # cleanup
        requests.delete(f"{API}/members/{m['id']}", headers=_auth(sa_token), timeout=30)

    def test_reset_password_mismatched_confirmation_rejected(self, sa_token):
        mobile = _rand_mobile("6")[:10]
        r = requests.post(f"{API}/members", headers=_auth(sa_token), json={
            "full_name": "TEST Mismatch", "mobile": mobile, "target_amount": 100,
        }, timeout=30)
        assert r.status_code == 200
        m = r.json()
        r = requests.post(f"{API}/members/{m['id']}/reset-password", headers=_auth(sa_token),
                          json={"new_password": "abc123", "confirm_password": "different1"}, timeout=30)
        assert r.status_code in (400, 422), f"expected validation error got {r.status_code}: {r.text}"
        requests.delete(f"{API}/members/{m['id']}", headers=_auth(sa_token), timeout=30)
