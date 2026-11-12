import json
import os
import sys
import tempfile

from PIL import Image

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import add_icon_colors as a  # noqa: E402


def make_app_dir(tmp, icons):
    os.makedirs(os.path.join(tmp, "config"))
    os.makedirs(os.path.join(tmp, "assets", "icons"))
    apps = []
    for name, img in icons.items():
        img.save(os.path.join(tmp, "assets", "icons", name + ".png"))
        apps.append({"id": name, "title": name, "icon": "assets/icons/" + name + ".png"})
    apps.append({"id": "noicon", "title": "noicon", "icon": ""})
    json.dump({"apps": apps}, open(os.path.join(tmp, "config", "launchpoints.json"), "w"))


def test_opaque_icon_gets_its_edge_color():
    with tempfile.TemporaryDirectory() as tmp:
        make_app_dir(tmp, {"red": Image.new("RGBA", (80, 80), (255, 0, 0, 255))})
        assert a.main([tmp]) == 0
        apps = json.load(open(os.path.join(tmp, "config", "launchpoints.json")))["apps"]
        assert apps[0]["color"] == "#ff0000"
        assert "color" not in apps[1]


def test_transparent_icon_gets_no_color():
    with tempfile.TemporaryDirectory() as tmp:
        make_app_dir(tmp, {"ghost": Image.new("RGBA", (80, 80), (0, 0, 0, 0))})
        a.main([tmp])
        apps = json.load(open(os.path.join(tmp, "config", "launchpoints.json")))["apps"]
        assert "color" not in apps[0]


def test_uses_edges_not_the_centre():
    with tempfile.TemporaryDirectory() as tmp:
        img = Image.new("RGBA", (80, 80), (0, 0, 255, 255))
        for x in range(30, 50):
            for y in range(30, 50):
                img.putpixel((x, y), (255, 255, 255, 255))
        make_app_dir(tmp, {"blue": img})
        a.main([tmp])
        apps = json.load(open(os.path.join(tmp, "config", "launchpoints.json")))["apps"]
        assert apps[0]["color"] == "#0000ff"
