import json
import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import gen_launchpoints as g  # noqa: E402


def make_app(root, app_id, info, icon_bytes=b"\x89PNG"):
    d = os.path.join(root, app_id)
    os.makedirs(d)
    with open(os.path.join(d, "appinfo.json"), "w") as f:
        f.write(info if isinstance(info, str) else json.dumps(info))
    if icon_bytes is not None:
        with open(os.path.join(d, "icon.png"), "wb") as f:
            f.write(icon_bytes)


def test_lists_visible_apps_and_copies_icons():
    with tempfile.TemporaryDirectory() as root, tempfile.TemporaryDirectory() as out:
        make_app(root, "netflix", {"id": "netflix", "title": "Netflix", "icon": "icon.png"})
        apps = g.scan([root], out)
        assert apps == [{"id": "netflix", "title": "Netflix", "icon": "assets/icons/netflix.png"}]
        assert os.path.exists(os.path.join(out, "assets", "icons", "netflix.png"))


def test_skips_invisible_excluded_and_unparsable():
    with tempfile.TemporaryDirectory() as root, tempfile.TemporaryDirectory() as out:
        make_app(root, "hidden", {"id": "hidden", "title": "H", "visible": False})
        make_app(root, "com.apos.launcher", {"id": "com.apos.launcher", "title": "ApOS"})
        make_app(root, "broken", "{ pas du json")
        make_app(root, "ok", {"id": "ok", "title": "Ok"}, icon_bytes=None)
        apps = g.scan([root], out)
        assert [a["id"] for a in apps] == ["ok"]
        assert apps[0]["icon"] == ""


def test_dedupes_across_roots_and_sorts_by_title():
    with tempfile.TemporaryDirectory() as r1, tempfile.TemporaryDirectory() as r2, tempfile.TemporaryDirectory() as out:
        make_app(r1, "b", {"id": "b", "title": "Zeta"}, icon_bytes=None)
        make_app(r2, "b", {"id": "b", "title": "Dup"}, icon_bytes=None)
        make_app(r2, "a", {"id": "a", "title": "alpha"}, icon_bytes=None)
        apps = g.scan([r1, r2], out)
        assert [a["title"] for a in apps] == ["alpha", "Zeta"]


def test_ignores_icons_outside_the_app_or_with_unsafe_names():
    with tempfile.TemporaryDirectory() as root, tempfile.TemporaryDirectory() as out:
        make_app(root, "x", {"id": "x", "title": "X", "icon": "../../etc/passwd"}, icon_bytes=None)
        make_app(root, "y", {"id": "../evil", "title": "Y", "icon": "icon.png"})
        apps = g.scan([root], out)
        assert [a["id"] for a in apps] == ["x"]
        assert apps[0]["icon"] == ""


def test_writes_launchpoints_json():
    with tempfile.TemporaryDirectory() as root, tempfile.TemporaryDirectory() as out:
        make_app(root, "a", {"id": "a", "title": "A"}, icon_bytes=None)
        g.main([out, root])
        data = json.load(open(os.path.join(out, "config", "launchpoints.json")))
        assert data["apps"][0]["id"] == "a"
