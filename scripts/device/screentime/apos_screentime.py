#!/usr/bin/env python3
"""Service ApOS de temps d'écran (s'exécute sur la TV, en root, bibliothèque standard seulement).

- Mesure : toutes les APOS_INTERVAL secondes, si la TV est allumée (état d'alimentation « Active »), note l'app
  au premier plan dans data/usage-AAAA-MM-JJ.log (« HH:MM:SS idApp »). Les jours passés sont résumés en .tsv.
- Limites : limite quotidienne et limites par app. À la limite : un message (toast) ou un verrouillage
  (ApOS est ramené au premier plan et affiche un écran de code PIN). Le code PIN prolonge d'une durée choisie.
- API locale : http://127.0.0.1:8742 (GET /state, POST /config /pin /verify /unlock /ack), réservée à la TV.
Aucune donnée ne quitte la TV.
"""
import hashlib
import hmac
import json
import os
import re
import subprocess
import sys
import threading
import time
from datetime import timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

APOS_ID = "com.apos.launcher"
PORT = 8742
SAFE_ID = re.compile(r"^[A-Za-z0-9._-]+$")
PIN_FORMAT = re.compile(r"^[0-9]{4,8}$")
DEFAULT_CONFIG = {"daily_limit": 0, "app_limits": {}, "action": "message", "extension": 1800, "pin_salt": "", "pin_hash": ""}
EXTENSIONS = (900, 1800, 3600)
MAX_PIN_FAILURES = 5
PIN_LOCKOUT_SECONDS = 60
TOAST_INTERVAL_SECONDS = 300
RELAUNCH_MIN_SECONDS = 5
PBKDF2_ROUNDS = 50000


def luna(uri, params, timeout=5):
    """Appel Luna via luna-send (stdin redirigé : sinon luna-send ne répond pas hors terminal)."""
    try:
        out = subprocess.run(["luna-send", "-n", "1", uri, json.dumps(params)], stdin=subprocess.DEVNULL,
                             capture_output=True, text=True, timeout=timeout).stdout
        start = out.find("{")
        return json.JSONDecoder().raw_decode(out[start:])[0] if start >= 0 else None
    except (OSError, ValueError, subprocess.SubprocessError):
        return None


def sanitize_config(raw):
    cfg = dict(DEFAULT_CONFIG)
    cfg["app_limits"] = {}
    if not isinstance(raw, dict):
        return cfg

    def seconds(v, low, high):
        return v if isinstance(v, int) and not isinstance(v, bool) and low <= v <= high else None

    daily = seconds(raw.get("daily_limit"), 0, 86400)
    if daily is not None:
        cfg["daily_limit"] = daily
    limits = raw.get("app_limits")
    if isinstance(limits, dict):
        for app_id, value in limits.items():
            ok = seconds(value, 10, 86400)
            if isinstance(app_id, str) and SAFE_ID.match(app_id) and ok is not None:
                cfg["app_limits"][app_id] = ok
    if raw.get("action") in ("message", "lock"):
        cfg["action"] = raw["action"]
    if raw.get("extension") in EXTENSIONS:
        cfg["extension"] = raw["extension"]
    if isinstance(raw.get("pin_salt"), str) and isinstance(raw.get("pin_hash"), str):
        cfg["pin_salt"], cfg["pin_hash"] = raw["pin_salt"], raw["pin_hash"]
    return cfg


def hash_pin(pin, salt_hex):
    return hashlib.pbkdf2_hmac("sha256", pin.encode(), bytes.fromhex(salt_hex), PBKDF2_ROUNDS).hex()


class TooManyAttempts(Exception):
    pass


class Usage:
    def __init__(self):
        self.apps = {}
        self.total = 0

    def add(self, app, seconds):
        self.apps[app] = self.apps.get(app, 0) + seconds
        self.total += seconds

    def load(self, path, interval):
        self.apps, self.total = {}, 0
        try:
            with open(path) as f:
                for line in f:
                    parts = line.split()
                    if len(parts) == 2 and SAFE_ID.match(parts[1]):
                        self.add(parts[1], interval)
        except OSError:
            pass


def write_json(path, data):
    tmp = path + ".tmp"
    with open(tmp, "w") as f:
        json.dump(data, f)
    os.replace(tmp, path)


class Service:
    def __init__(self, data_dir, config_path, luna_fn, now, interval=10, state_path=None):
        self.data_dir = data_dir
        self.config_path = config_path
        self.state_path = state_path or os.path.join(os.path.dirname(config_path) or ".", "apos-screentime-state.json")
        self.luna = luna_fn
        self.now = now
        self.interval = interval
        self.lock = threading.RLock()
        self.usage = Usage()
        self.last_app = ""
        self.locked_app = None
        self.extra_daily = 0
        self.extra_apps = {}
        self.pin_failures = 0
        self.pin_locked_until = None
        self.last_toast = None
        self.last_launch = None
        os.makedirs(data_dir, exist_ok=True)
        write_json(os.path.join(data_dir, "meta.json"), {"interval": interval})
        self.config = self._load_config()
        self.day = self.now().strftime("%Y-%m-%d")
        self._load_state()
        self.usage.load(self._log_path(self.day), interval)
        self._compact_old_days()

    # ---------- fichiers ----------

    def _log_path(self, day):
        return os.path.join(self.data_dir, "usage-" + day + ".log")

    def _load_config(self):
        try:
            with open(self.config_path) as f:
                return sanitize_config(json.load(f))
        except (OSError, ValueError):
            return sanitize_config({})

    def _save_config(self):
        write_json(self.config_path, self.config)

    def _load_state(self):
        try:
            with open(self.state_path) as f:
                st = json.load(f)
        except (OSError, ValueError):
            return
        if isinstance(st, dict) and st.get("day") == self.day:
            self.extra_daily = int(st.get("extra_daily", 0))
            self.extra_apps = {k: int(v) for k, v in (st.get("extra_apps") or {}).items() if SAFE_ID.match(k)}

    def _save_state(self):
        write_json(self.state_path, {"day": self.day, "extra_daily": self.extra_daily, "extra_apps": self.extra_apps})

    def _compact_old_days(self):
        for name in sorted(os.listdir(self.data_dir)):
            if not (name.startswith("usage-") and name.endswith(".log")) or name == "usage-" + self.day + ".log":
                continue
            counts = {}
            path = os.path.join(self.data_dir, name)
            with open(path) as f:
                for line in f:
                    parts = line.split()
                    if len(parts) == 2 and SAFE_ID.match(parts[1]):
                        counts[parts[1]] = counts.get(parts[1], 0) + self.interval
            with open(os.path.join(self.data_dir, name[:-4] + ".tsv"), "w") as out:
                for app, seconds in counts.items():
                    out.write("%s\t%d\n" % (app, seconds))
            os.remove(path)
        cutoff = time.time() - 90 * 86400
        for name in os.listdir(self.data_dir):
            path = os.path.join(self.data_dir, name)
            if name.startswith("usage-") and name.endswith(".tsv") and os.path.getmtime(path) < cutoff:
                os.remove(path)

    # ---------- mesure ----------

    def _roll_day(self):
        today = self.now().strftime("%Y-%m-%d")
        if today != self.day:
            self.day = today
            self.usage = Usage()
            self.extra_daily, self.extra_apps, self.locked_app = 0, {}, None
            self._save_state()
            self._compact_old_days()

    def tick(self):
        with self.lock:
            self._roll_day()
            power = (self.luna("luna://com.webos.service.tvpower/power/getPowerState", {}) or {}).get("state")
            if power != "Active":
                return
            app = (self.luna("luna://com.webos.applicationManager/getForegroundAppInfo", {}) or {}).get("appId") or ""
            if not app or not SAFE_ID.match(app):
                return
            self.last_app = app
            with open(self._log_path(self.day), "a") as f:
                f.write("%s %s\n" % (self.now().strftime("%H:%M:%S"), app))
            self.usage.add(app, self.interval)
            self._enforce()

    # ---------- limites ----------

    def _status(self):
        cfg = self.config
        daily = cfg["daily_limit"]
        allowed_daily = daily + self.extra_daily if daily else None
        if allowed_daily is not None and self.usage.total >= allowed_daily:
            return {"over": True, "reason": "daily", "app": None, "allowed": allowed_daily}
        for app in [self.locked_app, self.last_app]:
            if app and app in cfg["app_limits"]:
                allowed = cfg["app_limits"][app] + self.extra_apps.get(app, 0)
                if self.usage.apps.get(app, 0) >= allowed:
                    if app == self.last_app:
                        self.locked_app = app
                    return {"over": True, "reason": "app", "app": app, "allowed": allowed}
        if self.locked_app:
            self.locked_app = None
        return {"over": False, "reason": None, "app": None, "allowed": allowed_daily}

    def _enforce(self):
        status = self._status()
        if not status["over"]:
            return
        now = self.now()
        if self.config["action"] == "message":
            if self.last_toast is None or (now - self.last_toast).total_seconds() >= TOAST_INTERVAL_SECONDS:
                self.last_toast = now
                text = "Temps d'écran : limite quotidienne atteinte" if status["reason"] == "daily" else "Temps d'écran : limite atteinte pour " + status["app"]
                self.luna("luna://com.webos.notification/createToast", {"message": text})
            return
        # verrouillage : ApOS revient au premier plan (jamais en boucle serrée)
        concerned = status["reason"] == "daily" or self.last_app == status["app"]
        if concerned and self.last_app != APOS_ID:
            if self.last_launch is None or (now - self.last_launch).total_seconds() >= RELAUNCH_MIN_SECONDS:
                self.last_launch = now
                self.luna("luna://com.webos.applicationManager/launch", {"id": APOS_ID})

    def state(self):
        with self.lock:
            status = self._status()
            public = {k: v for k, v in self.config.items() if k not in ("pin_salt", "pin_hash")}
            locked = status["over"] and self.config["action"] == "lock"
            return {
                "day": self.day, "total": self.usage.total, "apps": dict(self.usage.apps), "config": public,
                "has_pin": bool(self.config["pin_hash"]), "over_limit": status["over"], "locked": locked,
                "reason": status["reason"], "app": status["app"], "allowed": status["allowed"],
                "action": self.config["action"],
            }

    # ---------- code PIN et configuration ----------

    def verify(self, pin):
        with self.lock:
            now = self.now()
            if self.pin_locked_until is not None and now < self.pin_locked_until:
                raise TooManyAttempts()
            if not self.config["pin_hash"]:
                return True
            ok = isinstance(pin, str) and PIN_FORMAT.match(pin) is not None and hmac.compare_digest(
                hash_pin(pin, self.config["pin_salt"]), self.config["pin_hash"])
            if ok:
                self.pin_failures, self.pin_locked_until = 0, None
                return True
            self.pin_failures += 1
            if self.pin_failures >= MAX_PIN_FAILURES:
                self.pin_failures = 0
                self.pin_locked_until = now + timedelta(seconds=PIN_LOCKOUT_SECONDS)
            return False

    def _require_pin(self, pin):
        if self.config["pin_hash"] and not self.verify(pin):
            raise PermissionError("code PIN requis")

    def set_config(self, values, pin=None):
        with self.lock:
            self._require_pin(pin)
            merged = dict(self.config)
            for key in ("daily_limit", "app_limits", "action", "extension"):
                if key in values:
                    merged[key] = values[key]
            self.config = sanitize_config(merged)
            self._save_config()

    def set_pin(self, new, old=None):
        with self.lock:
            if new != "" and (not isinstance(new, str) or not PIN_FORMAT.match(new)):
                raise ValueError("le code doit comporter 4 à 8 chiffres")
            self._require_pin(old)
            if new == "":
                self.config["pin_salt"], self.config["pin_hash"] = "", ""
            else:
                salt = os.urandom(16).hex()
                self.config["pin_salt"], self.config["pin_hash"] = salt, hash_pin(new, salt)
            self._save_config()

    def unlock(self, pin):
        with self.lock:
            status = self._status()
            if not status["over"]:
                return False
            if not self.verify(pin):
                return False
            ext = self.config["extension"]
            if status["reason"] == "daily":
                self.extra_daily += ext
            else:
                self.extra_apps[status["app"]] = self.extra_apps.get(status["app"], 0) + ext
                self.locked_app = None
            self._save_state()
            return True

    def acknowledge(self):
        """Ferme l'écran de blocage d'une limite d'app (sans prolongation). Sans effet pour la limite quotidienne."""
        with self.lock:
            if self.locked_app:
                self.locked_app = None
                self.last_app = ""


# ---------- API HTTP locale ----------

def make_server(service, host="127.0.0.1", port=PORT):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def _send(self, status, body):
            data = b"" if status == 204 else json.dumps(body).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(data)

        def do_OPTIONS(self):
            self._send(204, {})

        def do_GET(self):
            if self.path == "/state":
                self._send(200, service.state())
            else:
                self._send(404, {"error": "inconnu"})

        def do_POST(self):
            try:
                length = int(self.headers.get("Content-Length") or 0)
                body = json.loads(self.rfile.read(length).decode() or "{}") if length <= 65536 else None
            except ValueError:
                body = None
            if not isinstance(body, dict):
                self._send(400, {"error": "corps JSON invalide"})
                return
            try:
                if self.path == "/config":
                    service.set_config(body, pin=body.get("pin"))
                    self._send(200, {"ok": True})
                elif self.path == "/pin":
                    service.set_pin(body.get("new", ""), old=body.get("old"))
                    self._send(200, {"ok": True})
                elif self.path == "/verify":
                    self._send(200, {"ok": service.verify(body.get("pin"))})
                elif self.path == "/unlock":
                    self._send(200, {"ok": service.unlock(body.get("pin"))})
                elif self.path == "/ack":
                    service.acknowledge()
                    self._send(200, {"ok": True})
                else:
                    self._send(404, {"error": "inconnu"})
            except PermissionError:
                self._send(403, {"error": "pin"})
            except TooManyAttempts:
                self._send(429, {"error": "trop d'essais"})
            except ValueError as err:
                self._send(400, {"error": str(err)})

    server = ThreadingHTTPServer((host, port), Handler)
    server.daemon_threads = True
    return server


def main():
    from datetime import datetime
    data_dir = os.environ.get("APOS_DATA", "/media/developer/apps/usr/palm/applications/com.apos.launcher/data")
    config = os.environ.get("APOS_CONFIG", "/var/lib/webosbrew/apos-screentime.json")
    interval = int(os.environ.get("APOS_INTERVAL", "10"))
    service = Service(data_dir, config, luna, datetime.now, interval)
    server = make_server(service)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    while True:
        try:
            service.tick()
        except Exception as err:  # le service ne doit jamais s'arrêter
            sys.stderr.write("tick: %r\n" % (err,))
        time.sleep(interval)


if __name__ == "__main__":
    main()
