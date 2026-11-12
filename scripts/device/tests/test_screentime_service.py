import json
import os
import sys
import tempfile
import threading
import urllib.error
import urllib.request
from datetime import datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "screentime"))
import apos_screentime as s  # noqa: E402


class FakeLuna:
    def __init__(self, power="Active", app="netflix"):
        self.power = power
        self.app = app
        self.calls = []

    def __call__(self, uri, params):
        self.calls.append((uri, params))
        if uri.endswith("getPowerState"):
            return {"state": self.power, "returnValue": True}
        if uri.endswith("getForegroundAppInfo"):
            return {"appId": self.app, "returnValue": True}
        return {"returnValue": True}

    def launched(self):
        return [p["id"] for u, p in self.calls if u.endswith("/launch")]

    def toasts(self):
        return [p["message"] for u, p in self.calls if u.endswith("createToast")]


class Clock:
    def __init__(self, dt):
        self.dt = dt

    def __call__(self):
        return self.dt

    def advance(self, seconds):
        from datetime import timedelta
        self.dt = self.dt + timedelta(seconds=seconds)


def make(tmp, power="Active", app="netflix", interval=10, dt=None):
    luna = FakeLuna(power, app)
    clock = Clock(dt or datetime(2026, 11, 12, 10, 0, 0))
    svc = s.Service(os.path.join(tmp, "data"), os.path.join(tmp, "config.json"), luna, clock, interval)
    return svc, luna, clock


def read_log(tmp, day="2026-11-12"):
    path = os.path.join(tmp, "data", "usage-" + day + ".log")
    return open(path).read().splitlines() if os.path.exists(path) else []


# ---------- collecte ----------

def test_records_the_foreground_app_when_active():
    with tempfile.TemporaryDirectory() as tmp:
        svc, _, _ = make(tmp)
        svc.tick()
        assert read_log(tmp) == ["10:00:00 netflix"]
        assert svc.usage.total == 10 and svc.usage.apps["netflix"] == 10


def test_records_nothing_when_not_active_or_without_app():
    for power, app in (("Screen Saver", "netflix"), ("Active Standby", "netflix"), ("Active", "")):
        with tempfile.TemporaryDirectory() as tmp:
            svc, _, _ = make(tmp, power, app)
            svc.tick()
            assert read_log(tmp) == [], (power, app)


def test_writes_meta_json():
    with tempfile.TemporaryDirectory() as tmp:
        make(tmp, interval=15)
        assert json.load(open(os.path.join(tmp, "data", "meta.json"))) == {"interval": 15}


def test_loads_today_log_on_start_and_compacts_older_days():
    with tempfile.TemporaryDirectory() as tmp:
        os.makedirs(os.path.join(tmp, "data"))
        open(os.path.join(tmp, "data", "usage-2026-11-12.log"), "w").write("09:00:00 a\n09:00:10 a\n")
        open(os.path.join(tmp, "data", "usage-2026-11-10.log"), "w").write("10:00:00 b\n10:00:10 c\n10:00:20 b\n")
        svc, _, _ = make(tmp)
        assert svc.usage.apps == {"a": 20}
        svc.tick()
        assert not os.path.exists(os.path.join(tmp, "data", "usage-2026-11-10.log"))
        summary = dict(l.split("\t") for l in open(os.path.join(tmp, "data", "usage-2026-11-10.tsv")).read().split("\n") if l)
        assert summary == {"b": "20", "c": "10"}


def test_new_day_resets_usage():
    with tempfile.TemporaryDirectory() as tmp:
        svc, _, clock = make(tmp, dt=datetime(2026, 11, 12, 23, 59, 55))
        svc.tick()
        clock.advance(20)  # minuit passé
        svc.tick()
        assert svc.usage.total == 10
        assert read_log(tmp, "2026-11-13") == ["00:00:15 netflix"]


# ---------- configuration et PIN ----------

def test_config_is_sanitized():
    cfg = s.sanitize_config({"daily_limit": -5, "app_limits": {"ok.app": 600, "bad id": 600, "x": "nope"}, "action": "explode", "extension": 7})
    assert cfg["daily_limit"] == 0
    assert cfg["app_limits"] == {"ok.app": 600}
    assert cfg["action"] == "message"
    assert cfg["extension"] == s.DEFAULT_CONFIG["extension"]


def test_pin_can_be_set_verified_changed_and_cleared():
    with tempfile.TemporaryDirectory() as tmp:
        svc, _, _ = make(tmp)
        assert svc.state()["has_pin"] is False
        svc.set_pin("1234")
        assert svc.state()["has_pin"] is True
        assert svc.verify("1234") and not svc.verify("0000")
        try:
            svc.set_pin("5678", old="0000")
            assert False, "doit refuser un mauvais ancien code"
        except PermissionError:
            pass
        svc.set_pin("5678", old="1234")
        assert svc.verify("5678")
        svc.set_pin("", old="5678")
        assert svc.state()["has_pin"] is False


def test_pin_must_be_4_to_8_digits():
    with tempfile.TemporaryDirectory() as tmp:
        svc, _, _ = make(tmp)
        for bad in ("12", "abcd", "123456789", "12 4"):
            try:
                svc.set_pin(bad)
                assert False, bad
            except ValueError:
                pass


def test_config_changes_require_the_pin_when_one_is_set():
    with tempfile.TemporaryDirectory() as tmp:
        svc, _, _ = make(tmp)
        svc.set_config({"daily_limit": 3600})
        svc.set_pin("1234")
        try:
            svc.set_config({"daily_limit": 0})
            assert False
        except PermissionError:
            pass
        svc.set_config({"daily_limit": 7200}, pin="1234")
        assert svc.state()["config"]["daily_limit"] == 7200


def test_config_and_pin_hash_persist_and_hash_is_never_exposed():
    with tempfile.TemporaryDirectory() as tmp:
        svc, _, _ = make(tmp)
        svc.set_config({"daily_limit": 600})
        svc.set_pin("1234")
        again, _, _ = make(tmp)
        assert again.state()["config"]["daily_limit"] == 600 and again.verify("1234")
        text = json.dumps(again.state())
        assert "pin_hash" not in text and "pin_salt" not in text


def test_wrong_pin_attempts_are_throttled():
    with tempfile.TemporaryDirectory() as tmp:
        svc, _, clock = make(tmp)
        svc.set_pin("1234")
        for _ in range(s.MAX_PIN_FAILURES):
            assert not svc.verify("0000")
        try:
            svc.verify("1234")
            assert False, "doit être bloqué"
        except s.TooManyAttempts:
            pass
        clock.advance(s.PIN_LOCKOUT_SECONDS + 1)
        assert svc.verify("1234")


# ---------- limites ----------

def test_message_action_shows_a_toast_once_per_interval():
    with tempfile.TemporaryDirectory() as tmp:
        svc, luna, clock = make(tmp)
        svc.set_config({"daily_limit": 20, "action": "message"})
        for _ in range(3):
            svc.tick()
            clock.advance(10)
        assert len(luna.toasts()) == 1
        assert luna.launched() == []
        assert svc.state()["over_limit"] is True and svc.state()["locked"] is False
        clock.advance(s.TOAST_INTERVAL_SECONDS)
        svc.tick()
        assert len(luna.toasts()) == 2


def test_lock_action_brings_apos_to_the_front_when_over_the_daily_limit():
    with tempfile.TemporaryDirectory() as tmp:
        svc, luna, clock = make(tmp)
        svc.set_config({"daily_limit": 20, "action": "lock"})
        for _ in range(3):
            svc.tick()
            clock.advance(10)
        assert luna.launched() and set(luna.launched()) == {s.APOS_ID}
        st = svc.state()
        assert st["locked"] is True and st["reason"] == "daily"


def test_lock_does_not_relaunch_apos_when_it_is_already_in_front():
    with tempfile.TemporaryDirectory() as tmp:
        svc, luna, clock = make(tmp, app=s.APOS_ID)
        svc.set_config({"daily_limit": 20, "action": "lock"})
        for _ in range(4):
            svc.tick()
            clock.advance(10)
        assert luna.launched() == []
        assert svc.state()["locked"] is True


def test_app_limit_locks_only_that_app():
    with tempfile.TemporaryDirectory() as tmp:
        svc, luna, clock = make(tmp, app="netflix")
        svc.set_config({"app_limits": {"netflix": 20}, "action": "lock"})
        for _ in range(3):
            svc.tick()
            clock.advance(10)
        assert luna.launched()
        st = svc.state()
        assert st["locked"] is True and st["reason"] == "app" and st["app"] == "netflix"
        luna.app = "youtube.leanback.v4"
        luna.calls.clear()
        svc.tick()
        assert luna.launched() == []  # une autre app n'est pas bloquée


def test_unlock_with_the_pin_grants_an_extension():
    with tempfile.TemporaryDirectory() as tmp:
        svc, luna, clock = make(tmp, app=s.APOS_ID)
        svc.set_config({"daily_limit": 20, "action": "lock", "extension": 900})
        svc.set_pin("1234")
        for _ in range(3):
            svc.tick()
            clock.advance(10)
        assert svc.state()["locked"] is True
        assert svc.unlock("0000") is False
        assert svc.state()["locked"] is True
        assert svc.unlock("1234") is True
        st = svc.state()
        assert st["locked"] is False and st["over_limit"] is False
        assert st["allowed"] == 20 + 900


def test_unlock_without_a_pin_is_refused_when_nothing_is_locked():
    with tempfile.TemporaryDirectory() as tmp:
        svc, _, _ = make(tmp)
        svc.set_pin("1234")
        assert svc.unlock("1234") is False


def test_extension_survives_a_restart_on_the_same_day():
    with tempfile.TemporaryDirectory() as tmp:
        svc, _, clock = make(tmp, app=s.APOS_ID)
        svc.set_config({"daily_limit": 20, "action": "lock", "extension": 900})
        svc.set_pin("1234")
        for _ in range(3):
            svc.tick()
            clock.advance(10)
        svc.unlock("1234")
        again, _, _ = make(tmp, app=s.APOS_ID, dt=clock.dt)
        assert again.state()["allowed"] == 920


def test_changing_the_limit_clears_the_lock():
    with tempfile.TemporaryDirectory() as tmp:
        svc, _, clock = make(tmp, app=s.APOS_ID)
        svc.set_config({"daily_limit": 20, "action": "lock"})
        for _ in range(3):
            svc.tick()
            clock.advance(10)
        assert svc.state()["locked"] is True
        svc.set_config({"daily_limit": 7200})
        assert svc.state()["locked"] is False


# ---------- API HTTP ----------

def start_server(svc):
    server = s.make_server(svc, "127.0.0.1", 0)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server, "http://127.0.0.1:%d" % server.server_address[1]


def call(base, method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(base + path, data=data, method=method, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            return r.status, json.loads(r.read().decode() or "{}"), r.headers
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode() or "{}"), e.headers


def test_http_state_config_pin_and_cors():
    with tempfile.TemporaryDirectory() as tmp:
        svc, _, _ = make(tmp)
        server, base = start_server(svc)
        try:
            status, state, headers = call(base, "GET", "/state")
            assert status == 200 and state["total"] == 0 and headers["Access-Control-Allow-Origin"] == "*"
            assert call(base, "POST", "/config", {"daily_limit": 3600, "action": "lock"})[0] == 200
            assert call(base, "POST", "/pin", {"new": "1234"})[0] == 200
            assert call(base, "POST", "/config", {"daily_limit": 0})[0] == 403
            assert call(base, "POST", "/config", {"daily_limit": 7200, "pin": "1234"})[0] == 200
            assert call(base, "POST", "/verify", {"pin": "0000"})[1] == {"ok": False}
            assert call(base, "POST", "/verify", {"pin": "1234"})[1] == {"ok": True}
            assert call(base, "POST", "/pin", {"new": "12"})[0] == 400
            assert call(base, "GET", "/nope")[0] == 404
            assert call(base, "OPTIONS", "/config")[0] in (200, 204)
        finally:
            server.shutdown()


def test_http_is_bound_to_localhost_only():
    with tempfile.TemporaryDirectory() as tmp:
        svc, _, _ = make(tmp)
        server, _ = start_server(svc)
        try:
            assert server.server_address[0] == "127.0.0.1"
        finally:
            server.shutdown()
