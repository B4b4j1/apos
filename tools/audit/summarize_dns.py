import argparse
import re
import sys
from collections import Counter

QUERY_RE = re.compile(r"query\[(?:A|AAAA|HTTPS|SVCB)\] (\S+) from (\S+)$")

def extract_domains(lines, client_ip):
    counts = Counter()
    for line in lines:
        m = QUERY_RE.search(line.strip())
        if m and m.group(2) == client_ip:
            counts[m.group(1)] += 1
    return counts

def main(argv=None):
    p = argparse.ArgumentParser()
    p.add_argument("log")
    p.add_argument("--client", required=True)
    args = p.parse_args(argv)
    with open(args.log, encoding="utf-8") as f:
        counts = extract_domains(f, args.client)
    for domain, n in counts.most_common():
        print(f"{n}\t{domain}")
    return 0

if __name__ == "__main__":
    sys.exit(main())
