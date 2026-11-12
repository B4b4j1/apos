import os
import stat
import subprocess
import tempfile

SCRIPT = os.path.join(os.path.dirname(__file__), "..", "screentime", "apos-screentime.sh")


def fake_luna(bindir, power, app):
    """Faux luna-send : répond selon l'URI demandée."""
    path = os.path.join(bindir, "luna-send")
    with open(path, "w") as f:
        f.write(
            "#!/bin/sh\n"
            'for a in "$@"; do U="$a"; done\n'
            'case "$*" in\n'
            '  *getPowerState*) echo \'{ "state": "' + power + '", "returnValue": true }\' ;;\n'
            "  *getForegroundAppInfo*) echo '{\"returnValue\":true,\"appId\":\"" + app + "\",\"windowId\":\"\"}' ;;\n"
            "esac\n"
        )
    os.chmod(path, os.stat(path).st_mode | stat.S_IEXEC)


def run_once(data, bindir, interval="10"):
    env = dict(os.environ, PATH=bindir + ":" + os.environ["PATH"], APOS_DATA=data, APOS_INTERVAL=interval, APOS_ONCE="1")
    return subprocess.run(["sh", SCRIPT], env=env, capture_output=True, text=True, timeout=20)


def logs(data):
    return sorted(n for n in os.listdir(data) if n.endswith(".log"))


def test_records_the_foreground_app_when_the_tv_is_active():
    with tempfile.TemporaryDirectory() as data, tempfile.TemporaryDirectory() as bindir:
        fake_luna(bindir, "Active", "netflix")
        assert run_once(data, bindir).returncode == 0
        files = logs(data)
        assert len(files) == 1
        line = open(os.path.join(data, files[0])).read().strip()
        assert line.endswith(" netflix")


def test_records_nothing_in_screen_saver_or_standby():
    for state in ("Screen Saver", "Active Standby", "Suspend"):
        with tempfile.TemporaryDirectory() as data, tempfile.TemporaryDirectory() as bindir:
            fake_luna(bindir, state, "netflix")
            run_once(data, bindir)
            assert logs(data) == [], state


def test_records_nothing_without_a_foreground_app():
    with tempfile.TemporaryDirectory() as data, tempfile.TemporaryDirectory() as bindir:
        fake_luna(bindir, "Active", "")
        run_once(data, bindir)
        assert logs(data) == []


def test_writes_meta_json_with_the_sampling_interval():
    with tempfile.TemporaryDirectory() as data, tempfile.TemporaryDirectory() as bindir:
        fake_luna(bindir, "Screen Saver", "x")
        run_once(data, bindir, interval="15")
        assert '"interval":15' in open(os.path.join(data, "meta.json")).read().replace(" ", "")


def test_compacts_previous_days_into_a_summary():
    with tempfile.TemporaryDirectory() as data, tempfile.TemporaryDirectory() as bindir:
        fake_luna(bindir, "Screen Saver", "x")
        with open(os.path.join(data, "usage-2000-01-01.log"), "w") as f:
            f.write("10:00:00 netflix\n10:00:10 netflix\n10:00:20 youtube.leanback.v4\n")
        run_once(data, bindir, interval="10")
        assert not os.path.exists(os.path.join(data, "usage-2000-01-01.log"))
        summary = dict(line.split("\t") for line in open(os.path.join(data, "usage-2000-01-01.tsv")).read().split("\n") if line)
        assert summary == {"netflix": "20", "youtube.leanback.v4": "10"}
