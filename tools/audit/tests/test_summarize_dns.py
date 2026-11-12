from pathlib import Path
from collections import Counter
from tools.audit.summarize_dns import extract_domains

FIXTURE = Path(__file__).parent / "fixtures" / "dnsmasq.log"

def test_counts_only_queries_from_tv():
    lines = FIXTURE.read_text().splitlines()
    result = extract_domains(lines, client_ip="192.168.1.50")
    assert result == Counter({"ad.example-lg.test": 2, "tracker.example-lg.test": 1})

def test_ignores_other_clients_and_replies():
    lines = FIXTURE.read_text().splitlines()
    result = extract_domains(lines, client_ip="192.168.1.20")
    assert result == Counter({"www.wikipedia.org": 1})

def test_empty_input_returns_empty_counter():
    assert extract_domains([], client_ip="192.168.1.50") == Counter()
