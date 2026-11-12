from blocklist.build_blocklist import build

def test_blocks_domains_marked_block():
    entries = [("ad.example-lg.test", "publicité", "bloquer")]
    assert build(entries, allowlist=set()) == ["0.0.0.0 ad.example-lg.test", ":: ad.example-lg.test"]

def test_skips_domains_marked_allow():
    entries = [("update.example-lg.test", "mise à jour", "autoriser")]
    assert build(entries, allowlist=set()) == []

def test_allowlist_always_wins_over_block_decision():
    entries = [("api.example-lg.test", "fonctionnel", "bloquer")]
    assert build(entries, allowlist={"api.example-lg.test"}) == []

def test_output_is_sorted_and_deduplicated():
    entries = [
        ("b.test", "publicité", "bloquer"),
        ("a.test", "publicité", "bloquer"),
        ("a.test", "publicité", "bloquer"),
    ]
    assert build(entries, allowlist=set()) == ["0.0.0.0 a.test", ":: a.test", "0.0.0.0 b.test", ":: b.test"]
