"""Tests for /api/dashboard my_vargani feature (payment reminder banner)."""
import os
import requests

BASE_URL = (os.environ.get("EXPO_PUBLIC_BACKEND_URL") or "https://mandal-admin-3.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

SUPER_ADMIN = {"identifier": "superadmin", "password": "Kranti@2026"}
MEMBER = {"identifier": "9998887770", "password": "Member@2026"}


def _auth(t): return {"Authorization": f"Bearer {t}"}


def _login(payload):
    r = requests.post(f"{API}/auth/login", json=payload, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


class TestDashboardMyVargani:
    def test_super_admin_my_vargani_is_null(self):
        tok = _login(SUPER_ADMIN)["access_token"]
        r = requests.get(f"{API}/dashboard", headers=_auth(tok), timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "my_vargani" in body, "dashboard response missing my_vargani key"
        assert body["my_vargani"] is None, f"expected null for super_admin, got {body['my_vargani']}"

    def test_member_my_vargani_object(self):
        login = _login(MEMBER)
        assert login["user"]["role"] == "member"
        tok = login["access_token"]
        r = requests.get(f"{API}/dashboard", headers=_auth(tok), timeout=30)
        assert r.status_code == 200, r.text
        mv = r.json().get("my_vargani")
        assert mv is not None, "member dashboard.my_vargani should not be null"
        assert set(mv.keys()) >= {"full_name", "target_amount", "collected", "pending"}
        assert mv["target_amount"] == 5000, mv
        assert mv["collected"] == 1000, mv
        assert mv["pending"] == 4000, mv
        assert isinstance(mv["full_name"], str) and mv["full_name"]
