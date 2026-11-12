import json
import os
import sys
import tempfile

from PIL import Image

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import prepare_wallpapers as p  # noqa: E402


def test_fit_landscape_is_cover_cropped_to_1080p():
    out = p.fit_image(Image.new("RGB", (4000, 2000), "red"))
    assert out.size == (1920, 1080)


def test_fit_portrait_is_letterboxed_on_a_blurred_background():
    out = p.fit_image(Image.new("RGB", (3000, 4000), "blue"))
    assert out.size == (1920, 1080)


def test_fit_applies_exif_orientation():
    img = Image.new("RGB", (400, 200), "green")
    exif = Image.Exif()
    exif[274] = 6  # tourner de 90° : l'image devient portrait
    img.info["exif"] = exif.tobytes()
    tmp = tempfile.NamedTemporaryFile(suffix=".jpg", delete=False)
    img.save(tmp.name, exif=exif)
    out = p.fit_image(Image.open(tmp.name))
    os.unlink(tmp.name)
    assert out.size == (1920, 1080)


def test_main_writes_images_thumbs_and_index_without_exif():
    with tempfile.TemporaryDirectory() as src, tempfile.TemporaryDirectory() as out:
        for name in ("b.JPG", "a.jpg"):
            img = Image.new("RGB", (800, 450), "white")
            exif = Image.Exif()
            exif[306] = "2026:09:12 12:00:00"
            img.save(os.path.join(src, name), exif=exif)
        open(os.path.join(src, "notes.txt"), "w").write("ignorer")
        assert p.main([src, out]) == 0
        index = json.load(open(os.path.join(out, "index.json")))
        assert [e["id"] for e in index] == ["wp-01", "wp-02"]
        assert index[0]["src"] == "assets/wallpapers/wp-01.jpg"
        assert index[0]["thumb"] == "assets/wallpapers/wp-01-thumb.jpg"
        for e in index:
            for key in ("src", "thumb"):
                path = os.path.join(out, os.path.basename(e[key]))
                im = Image.open(path)
                assert not im.getexif()
        assert Image.open(os.path.join(out, "wp-01-thumb.jpg")).size == (480, 270)


def test_main_skips_portrait_photos_and_numbers_the_rest_sequentially():
    with tempfile.TemporaryDirectory() as src, tempfile.TemporaryDirectory() as out:
        Image.new("RGB", (900, 1600), "red").save(os.path.join(src, "a-portrait.jpg"))
        Image.new("RGB", (1600, 900), "green").save(os.path.join(src, "b-wide.jpg"))
        Image.new("RGB", (1200, 900), "blue").save(os.path.join(src, "c-4x3.jpg"))
        rotated = Image.new("RGB", (1600, 900), "white")
        exif = Image.Exif()
        exif[274] = 6  # stocké en paysage mais affiché en portrait
        rotated.save(os.path.join(src, "d-rotated.jpg"), exif=exif)
        assert p.main([src, out]) == 0
        index = json.load(open(os.path.join(out, "index.json")))
        assert [e["id"] for e in index] == ["wp-01", "wp-02"]
        assert not os.path.exists(os.path.join(out, "wp-03.jpg"))


def test_is_portrait_uses_the_oriented_size():
    assert p.is_portrait(Image.new("RGB", (900, 1600)))
    assert not p.is_portrait(Image.new("RGB", (1600, 900)))
    assert not p.is_portrait(Image.new("RGB", (900, 900)))
