import hashlib
import json
import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import make_repo as m  # noqa: E402


def setup(tmp):
    ipk = os.path.join(tmp, "com.apos.launcher_0.2.0_all.ipk")
    open(ipk, "wb").write(b"contenu du paquet")
    info = os.path.join(tmp, "appinfo.json")
    json.dump({"id": "com.apos.launcher", "version": "0.2.0", "type": "web", "title": "ApOS"}, open(info, "w"))
    return ipk, info


def test_manifest_points_to_the_github_release_with_the_package_hash():
    with tempfile.TemporaryDirectory() as tmp:
        ipk, info = setup(tmp)
        out = os.path.join(tmp, "repo")
        m.main(["--owner", "digitalManiac", "--repo", "apos-webos", "--tag", "v0.2.0", "--ipk", ipk, "--appinfo", info, "--out", out])
        manifest = json.load(open(os.path.join(out, "com.apos.launcher.manifest.json")))
        assert manifest["id"] == "com.apos.launcher" and manifest["version"] == "0.2.0"
        assert manifest["ipkUrl"] == "https://github.com/digitalManiac/apos-webos/releases/download/v0.2.0/com.apos.launcher_0.2.0_all.ipk"
        assert manifest["ipkHash"]["sha256"] == hashlib.sha256(b"contenu du paquet").hexdigest()
        assert manifest["iconUri"] == "https://raw.githubusercontent.com/digitalManiac/apos-webos/main/app/icon.png"
        assert manifest["sourceUrl"] == "https://github.com/digitalManiac/apos-webos"
        assert manifest["rootRequired"] is False


def test_index_lists_the_package_with_an_absolute_manifest_url():
    with tempfile.TemporaryDirectory() as tmp:
        ipk, info = setup(tmp)
        out = os.path.join(tmp, "repo")
        m.main(["--owner", "o", "--repo", "r", "--tag", "v0.2.0", "--ipk", ipk, "--appinfo", info, "--out", out])
        index = json.load(open(os.path.join(out, "index.json")))
        assert [p["id"] for p in index["packages"]] == ["com.apos.launcher"]
        assert index["packages"][0]["manifestUrl"] == "https://raw.githubusercontent.com/o/r/main/repo/com.apos.launcher.manifest.json"


def test_rejects_unsafe_owner_repo_or_tag():
    with tempfile.TemporaryDirectory() as tmp:
        ipk, info = setup(tmp)
        for args in (["--owner", "a/b", "--repo", "r", "--tag", "v1"], ["--owner", "o", "--repo", "r r", "--tag", "v1"], ["--owner", "o", "--repo", "r", "--tag", "v1;rm"]):
            try:
                m.main(args + ["--ipk", ipk, "--appinfo", info, "--out", os.path.join(tmp, "x")])
                assert False, args
            except SystemExit:
                pass
