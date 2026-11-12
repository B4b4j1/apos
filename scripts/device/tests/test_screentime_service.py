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


# ---------- persistance (survit à une mise à jour d'ApOS par Homebrew Channel) ----------

def make_persist(tmp, **kw):
    app = os.path.join(tmp, "app")
    persist = os.path.join(tmp, "persist")
    os.makedirs(app, exist_ok=True)
    luna = FakeLuna(**kw)
    clock = Clock(datetime(2026, 11, 12, 10, 0, 0))
    svc = s.Service(os.path.join(app, "data"), os.path.join(tmp, "config.json"), luna, clock, 10,
                    app_dir=app, persist_dir=persist)
    return svc, app, persist


def test_restore_assets_copies_missing_files_but_never_overwrites():
    with tempfile.TemporaryDirectory() as tmp:
        persist = os.path.join(tmp, "persist")
        os.makedirs(os.path.join(persist, "assets", "wallpapers"))
        os.makedirs(os.path.join(persist, "assets", "icons"))
        os.makedirs(os.path.join(persist, "config"))
        open(os.path.join(persist, "assets", "wallpapers", "wp-01.jpg"), "w").write("photo")
        open(os.path.join(persist, "assets", "icons", "a.png"), "w").write("icone")
        open(os.path.join(persist, "config", "launchpoints.json"), "w").write("{}")
        svc, app, _ = make_persist(tmp)
        svc.restore_assets()
        assert open(os.path.join(app, "assets", "wallpapers", "wp-01.jpg")).read() == "photo"
        assert open(os.path.join(app, "assets", "icons", "a.png")).read() == "icone"
        assert open(os.path.join(app, "config", "launchpoints.json")).read() == "{}"
        open(os.path.join(app, "config", "launchpoints.json"), "w").write("modifié")
        svc.restore_assets()
        assert open(os.path.join(app, "config", "launchpoints.json")).read() == "modifié"


def test_data_is_backed_up_and_restored_after_an_update_wipes_the_app_folder():
    with tempfile.TemporaryDirectory() as tmp:
        svc, app, persist = make_persist(tmp)
        svc.tick()
        svc.backup_data()
        assert os.path.exists(os.path.join(persist, "data", "usage-2026-11-12.log"))
        import shutil
        shutil.rmtree(app)  # mise à jour d'ApOS : le dossier de l'app est remplacé
        again, app2, _ = make_persist(tmp)
        assert open(os.path.join(app2, "data", "usage-2026-11-12.log")).read().strip().endswith("netflix")
        assert again.usage.total == 10


def test_restored_raw_logs_are_skipped_when_a_summary_already_exists():
    with tempfile.TemporaryDirectory() as tmp:
        persist = os.path.join(tmp, "persist", "data")
        os.makedirs(persist)
        open(os.path.join(persist, "usage-2026-11-01.log"), "w").write("10:00:00 a\n")
        open(os.path.join(persist, "usage-2026-11-01.tsv"), "w").write("a\t10\n")
        svc, app, _ = make_persist(tmp)
        assert not os.path.exists(os.path.join(app, "data", "usage-2026-11-01.log"))
        assert os.path.exists(os.path.join(app, "data", "usage-2026-11-01.tsv"))


# ---------- mise à jour depuis le dépôt GitHub ----------

import hashlib  # noqa: E402


def make_updater(tmp_path, current="0.2.0", index=None, ipk=b"IPKDATA", luna=None):
    app = os.path.join(tmp_path, "app")
    os.makedirs(app)
    with open(os.path.join(app, "appinfo.json"), "w") as f:
        json.dump({"id": "com.apos.launcher", "version": current}, f)
    pkg = {"id": "com.apos.launcher", "version": "0.3.0", "ipkUrl": "https://example.test/a.ipk",
           "ipkHash": {"sha256": hashlib.sha256(ipk).hexdigest()}}
    if index is not None:
        pkg.update(index)
    fetched = []

    def get(url, limit):
        fetched.append(url)
        if url.endswith("index.json"):
            return json.dumps({"packages": [pkg]}).encode()
        return ipk

    luna = luna or FakeLuna()
    up = s.Updater(app, "https://example.test/index.json", get, luna, os.path.join(tmp_path, "tmp"))
    return up, luna, fetched


def test_version_tuple_orders_and_rejects_garbage():
    assert s.version_tuple("0.10.0") > s.version_tuple("0.9.9")
    for bad in ("", "x", "1.2", "1.2.3.4", "1.2.-3"):
        try:
            s.version_tuple(bad)
            assert False, bad
        except ValueError:
            pass


def test_check_reports_newer_version(tmp_path):
    up, _, _ = make_updater(str(tmp_path))
    r = up.check()
    assert r == {"current": "0.2.0", "latest": "0.3.0", "available": True, "error": ""}
    assert up.status() == r


def test_check_same_or_older_is_not_available(tmp_path):
    up, _, _ = make_updater(str(tmp_path), current="0.3.0")
    assert up.check()["available"] is False
    up, _, _ = make_updater(str(tmp_path / "b"), current="9.0.0")
    assert up.check()["available"] is False


def test_check_network_failure_is_reported_not_raised(tmp_path):
    up, _, _ = make_updater(str(tmp_path))
    up.get = lambda url, limit: (_ for _ in ()).throw(OSError("down"))
    r = up.check()
    assert r["available"] is False and r["error"] == "dépôt injoignable"


def test_check_rejects_non_https_ipk_and_bad_index(tmp_path):
    up, _, _ = make_updater(str(tmp_path), index={"ipkUrl": "http://example.test/a.ipk"})
    assert up.check()["error"] == "index invalide"
    up, _, _ = make_updater(str(tmp_path / "b"), index={"version": "abc"})
    assert up.check()["error"] == "index invalide"


def test_install_downloads_verifies_and_calls_installer(tmp_path):
    up, luna, fetched = make_updater(str(tmp_path))
    assert up.install() is True
    uri, params = luna.calls[-1]
    assert uri == "luna://com.webos.appInstallService/dev/install"
    assert params["ipkUrl"].endswith(".ipk") and os.path.exists(params["ipkUrl"])
    with open(params["ipkUrl"], "rb") as f:
        assert f.read() == b"IPKDATA"
    assert fetched[-1] == "https://example.test/a.ipk"


def test_install_refuses_bad_hash_and_up_to_date(tmp_path):
    up, luna, _ = make_updater(str(tmp_path), index={"ipkHash": {"sha256": "0" * 64}})
    try:
        up.install()
        assert False
    except ValueError as err:
        assert "contrôle d'intégrité" in str(err)
    assert luna.calls == []
    up, luna, _ = make_updater(str(tmp_path / "b"), current="0.3.0")
    try:
        up.install()
        assert False
    except ValueError as err:
        assert "à jour" in str(err)
    assert luna.calls == []


def test_http_update_endpoints(tmp_path):
    up, luna, _ = make_updater(str(tmp_path))
    svc, _, _ = make(str(tmp_path / "svc"))
    svc.updater = up
    server, base = start_server(svc)
    try:
        assert call(base, "GET", "/state")[1]["update"] is None
        status, body, _ = call(base, "POST", "/update/check", {})
        assert status == 200 and body["available"] is True and body["latest"] == "0.3.0"
        assert call(base, "GET", "/state")[1]["update"]["latest"] == "0.3.0"
        assert call(base, "POST", "/update/install", {})[0] == 200
        assert luna.calls[-1][0].endswith("/dev/install")
    finally:
        server.shutdown()


# ---------- bouton Home ----------

def test_home_redirect_is_off_by_default_and_ignored_when_off():
    with tempfile.TemporaryDirectory() as tmp:
        svc, luna, _ = make(tmp, app="com.webos.app.home")
        svc.home_tick()
        assert luna.launched() == []


def test_home_redirect_launches_apos_when_lg_home_appears():
    with tempfile.TemporaryDirectory() as tmp:
        svc, luna, clock = make(tmp, app="com.webos.app.home")
        svc.set_home(True)
        svc.home_tick()
        assert luna.launched() == ["com.apos.launcher"]
        svc.home_tick()  # toujours l'accueil LG une seconde plus tard : pas de second lancement immédiat
        assert luna.launched() == ["com.apos.launcher"]
        clock.advance(4)
        svc.home_tick()
        assert luna.launched() == ["com.apos.launcher", "com.apos.launcher"]


def test_home_redirect_ignores_other_apps():
    with tempfile.TemporaryDirectory() as tmp:
        svc, luna, _ = make(tmp, app="netflix")
        svc.set_home(True)
        svc.home_tick()
        assert luna.launched() == []


def test_open_lg_home_suspends_redirect_until_leaving_lg_home():
    with tempfile.TemporaryDirectory() as tmp:
        svc, luna, clock = make(tmp, app="com.apos.launcher")
        svc.set_home(True)
        svc.open_lg_home()
        assert luna.launched() == ["com.webos.app.home"]
        luna.app = "com.webos.app.home"
        clock.advance(2)
        svc.home_tick()
        clock.advance(60)
        svc.home_tick()
        assert luna.launched() == ["com.webos.app.home"]  # l'utilisateur reste sur l'accueil LG
        luna.app = "netflix"
        svc.home_tick()
        luna.app = "com.webos.app.home"  # nouvel appui sur Home : redirection de nouveau active
        clock.advance(5)
        svc.home_tick()
        assert luna.launched()[-1] == "com.apos.launcher"


def test_open_lg_home_pass_expires_if_lg_home_never_shows():
    with tempfile.TemporaryDirectory() as tmp:
        svc, luna, clock = make(tmp, app="netflix")
        svc.set_home(True)
        svc.open_lg_home()
        clock.advance(30)
        svc.home_tick()
        luna.app = "com.webos.app.home"
        svc.home_tick()
        assert luna.launched()[-1] == "com.apos.launcher"


def test_home_redirect_pauses_after_a_loop():
    with tempfile.TemporaryDirectory() as tmp:
        svc, luna, clock = make(tmp, app="com.webos.app.home")
        svc.set_home(True)
        for _ in range(5):
            svc.home_tick()
            clock.advance(4)
        n = len(luna.launched())
        svc.home_tick()
        assert len(luna.launched()) == n and luna.toasts()
        clock.advance(60)
        svc.home_tick()
        assert len(luna.launched()) == n  # toujours en pause
        clock.advance(600)
        svc.home_tick()
        assert len(luna.launched()) == n + 1


def test_home_setting_persists_and_validates():
    with tempfile.TemporaryDirectory() as tmp:
        svc, _, _ = make(tmp)
        svc.set_home(True)
        assert json.load(open(os.path.join(tmp, "config.json")))["home_redirect"] is True
        assert svc.state()["config"]["home_redirect"] is True
        try:
            svc.set_home("oui")
            assert False
        except ValueError:
            pass
