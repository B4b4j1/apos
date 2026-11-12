import sys

def build(entries, allowlist):
    out = set()
    for domain, _category, decision in entries:
        if decision != "bloquer":
            continue
        if domain in allowlist:
            continue
        out.add(domain)
    # IPv4 et IPv6 : la TV a une connectivité IPv6, un blocage IPv4 seul serait contourné.
    return [line for d in sorted(out) for line in (f"0.0.0.0 {d}", f":: {d}")]

def load_entries(path):
    rows = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            parts = line.rstrip("\n").split("\t")
            if len(parts) == 3:
                rows.append(tuple(parts))
    return rows

def load_allowlist(path):
    with open(path, encoding="utf-8") as f:
        return {l.strip() for l in f if l.strip() and not l.startswith("#")}

if __name__ == "__main__":
    audit, allow, out = sys.argv[1:4]
    lines = build(load_entries(audit), load_allowlist(allow))
    with open(out, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
