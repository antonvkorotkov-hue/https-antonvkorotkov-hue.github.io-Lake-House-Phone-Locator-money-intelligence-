"""Run from repository root: pip install -r sportsbook_service/requirements.txt && pytest sportsbook_service/test_app.py"""
import importlib
import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def service(tmp_path, monkeypatch):
    monkeypatch.setenv("LH_LEAGUE_DB", str(tmp_path / "test.db"))
    monkeypatch.setenv("LH_DEV_INSECURE_COOKIE", "1")
    sys.path.insert(0, str(Path(__file__).parent))
    sys.modules.pop("app", None)
    backend = importlib.import_module("app")
    backend.bootstrap_admin("owner", "very-long-owner-password")
    yield TestClient(backend.app)
    sys.modules.pop("app", None)


def login(client, username, password):
    r = client.post("/api/login", json={"username": username, "password": password})
    assert r.status_code == 200
    return client.cookies.get("lh_csrf")


def join_member(admin, code, user):
    member = TestClient(admin.app) if False else None
    # A separate client simulates another user/device.
    from fastapi.testclient import TestClient
    app = importlib.import_module("app").app
    member = TestClient(app)
    res = member.post("/api/join", json={
        "username": user, "password": "member-test-password-123", "invite": code
    })
    assert res.status_code == 200, res.text
    return member


def test_invite_permissions_and_pick_idempotency(service):
    admin = service
    csrf = login(admin, "owner", "very-long-owner-password")
    code = admin.post("/api/invites", headers={"X-CSRF-Token": csrf}).json()["invitation_code"]
    friend = join_member(admin, code, "friend")
    assert friend.get("/api/me").json()["role"] == "member"
    token = friend.cookies.get("lh_csrf")
    assert friend.post("/api/invites", headers={"X-CSRF-Token": token}).status_code == 403
    pick = {"quote_id": "demo-home", "stake_points": 100, "request_key": "unique-request-123"}
    r = friend.post("/api/picks", json=pick, headers={"X-CSRF-Token": token})
    assert r.status_code == 200 and r.json()["duplicate"] is False
    assert friend.get("/api/me").json()["balance_points"] == 900
    r2 = friend.post("/api/picks", json=pick, headers={"X-CSRF-Token": token})
    assert r2.json()["duplicate"] is True
    assert friend.get("/api/me").json()["balance_points"] == 900
    assert len(friend.get("/api/picks").json()) == 1
    assert friend.post("/api/picks", json={**pick, "stake_points": 101},
                       headers={"X-CSRF-Token": token}).status_code == 409
    assert friend.post("/api/picks", json={"quote_id": "demo-away",
                       "stake_points": 1000, "request_key": "another-request-xyz"},
                       headers={"X-CSRF-Token": token}).status_code == 400
    assert friend.get("/api/me").json()["balance_points"] == 900


def test_one_time_invites_and_csrf(service):
    csrf = login(service, "owner", "very-long-owner-password")
    code = service.post("/api/invites", headers={"X-CSRF-Token": csrf}).json()["invitation_code"]
    friend = join_member(service, code, "secondfriend")
    replay = friend.post("/api/join", json={"username": "thirdfriend",
        "password": "member-test-password-123", "invite": code})
    assert replay.status_code == 400
    missing_csrf = friend.post("/api/picks", json={"quote_id": "demo-home",
        "stake_points": 1, "request_key": "unverified-request"})
    assert missing_csrf.status_code == 403


def test_admin_cannot_be_bootstrapped_twice(service):
    backend = importlib.import_module("app")
    with pytest.raises(ValueError):
        backend.bootstrap_admin("owner2", "another-valid-long-password")
