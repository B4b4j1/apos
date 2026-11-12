import os
import subprocess
import tempfile

SCRIPT = os.path.join(os.path.dirname(__file__), "..", "hosts-block", "50-apos-hosts")
BASE = "127.0.0.1\tlocalhost\n127.0.1.1 LGwebOSTV\n"
LIST = "0.0.0.0 ad.test\n:: ad.test\n"


def run(hosts, lst, *args):
    env = dict(os.environ, HOSTS_FILE=hosts, APOS_LIST=lst)
    return subprocess.run(["sh", SCRIPT, *args], env=env, capture_output=True, text=True)


def setup(tmp):
    hosts = os.path.join(tmp, "hosts")
    lst = os.path.join(tmp, "list")
    open(hosts, "w").write(BASE)
    open(lst, "w").write(LIST)
    return hosts, lst


def test_appends_the_block_and_keeps_existing_lines():
    with tempfile.TemporaryDirectory() as tmp:
        hosts, lst = setup(tmp)
        assert run(hosts, lst).returncode == 0
        text = open(hosts).read()
        assert text.startswith(BASE)
        assert "0.0.0.0 ad.test" in text and ":: ad.test" in text


def test_is_idempotent():
    with tempfile.TemporaryDirectory() as tmp:
        hosts, lst = setup(tmp)
        run(hosts, lst)
        run(hosts, lst)
        assert open(hosts).read().count("0.0.0.0 ad.test") == 1


def test_replaces_the_previous_block_when_the_list_changes():
    with tempfile.TemporaryDirectory() as tmp:
        hosts, lst = setup(tmp)
        run(hosts, lst)
        open(lst, "w").write("0.0.0.0 other.test\n")
        run(hosts, lst)
        text = open(hosts).read()
        assert "other.test" in text and "ad.test" not in text


def test_does_nothing_without_a_list():
    with tempfile.TemporaryDirectory() as tmp:
        hosts, lst = setup(tmp)
        os.remove(lst)
        assert run(hosts, lst).returncode == 0
        assert open(hosts).read() == BASE


def test_remove_restores_the_original_content():
    with tempfile.TemporaryDirectory() as tmp:
        hosts, lst = setup(tmp)
        run(hosts, lst)
        assert run(hosts, lst, "remove").returncode == 0
        assert open(hosts).read() == BASE
