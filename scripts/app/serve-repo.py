#!/usr/bin/env python3
"""Sert dist/repo/ sur le réseau local. À la racine, renvoie {"packages": [manifeste]} :
format lu par Homebrew Channel 0.7.3 (clé « packages », cf. parse() dans index.html)."""
import json, os, sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "dist", "repo")
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=os.path.abspath(ROOT), **kw)

    def do_GET(self):
        if self.path in ("/", "/index.json"):
            with open(os.path.join(ROOT, "com.apos.launcher.manifest.json"), "rb") as f:
                pkg = json.load(f)
                # URLs absolues : Homebrew Channel rejette les chemins relatifs à l'installation (« Only HTTP(S) protocols are supported »).
                base = "http://" + self.headers.get("Host", "")
                pkg["manifestUrl"] = base + "/com.apos.launcher.manifest.json"
                pkg["ipkUrl"] = base + "/" + pkg["ipkUrl"]
                body = json.dumps({"packages": [pkg]}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
