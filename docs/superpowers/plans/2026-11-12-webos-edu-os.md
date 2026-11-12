# ApOS — Launcher éducatif sans publicité ni télémétrie pour webOS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommandé) ou superpowers:executing-plans pour exécuter ce plan tâche par tâche. Les étapes utilisent la syntaxe à cases `- [ ]` pour le suivi.

**Goal:** Remplacer l'écran d'accueil d'une TV LG webOS rootée par un launcher simple et local, sans publicité ni télémétrie, adapté à un usage éducatif (apps choisies, mode kiosque, médias locaux).

**Architecture:** Trois couches indépendantes. (1) Réseau : un résolveur DNS local bloque les domaines de publicité et de télémétrie identifiés par audit. (2) Appareil : des scripts root, réversibles et sauvegardés, désactivent les services Luna de collecte. (3) Interface : une application web webOS packagée (HTML/CSS/JS, sans dépendance réseau) sert de launcher, configurée par un fichier JSON local, et lancée au démarrage à la place de l'accueil LG.

**Tech Stack:** webOS TV (Luna service bus, applications web packagées), ares-cli du SDK webOS TV (`ares-package`, `ares-install`, `ares-launch`, `ares-inspect`), Homebrew Channel / outils root de la communauté webosbrew, Bash + shellcheck pour les scripts appareil, Python 3 + pytest pour les outils d'audit et de génération de blocklist, JavaScript vanilla + Vitest pour le launcher, dnsmasq ou Pi-hole pour le DNS local.

**Spec:** Aucun document de spec séparé. Les exigences du projet sont celles du message initial de l'utilisateur (2026-11-12), reprises dans « Global Constraints » ci-dessous.

## Global Constraints

- Aucun appel réseau sortant depuis le launcher (pas de CDN, pas de SDK d'analytics, pas de polices distantes, pas de fetch de configuration distante).
- Aucun SDK tiers de suivi, publicité ou crash-reporting, dans l'application comme dans les scripts.
- Tous les assets (CSS, JS, polices, images) sont embarqués dans le paquet.
- Le launcher démarre et reste utilisable sans connexion Internet.
- Chaque modification de l'appareil est précédée d'une sauvegarde et annulable par un script de restauration.
- Interface en français ; identifiants de code en anglais.
- Version minimale de webOS : celle relevée dans `docs/discovery.md` (Tâche 0). La Tâche 5 la déclare dans `appinfo.json`.
- Pas de modification du firmware (pas de flash de firmware personnalisé) dans ce plan.

## Review Focus

1. **TV hors ligne au démarrage** : le launcher doit s'afficher, avec les apps locales disponibles, sans attendre le réseau. Test : Tâche 5 (rendu sans réseau) et Tâche 10 (test de démarrage hors ligne).
2. **Fichier de configuration malformé ou absent** : repli sur une configuration par défaut, jamais d'écran noir. Test : Tâche 6.
3. **Mise à jour du firmware LG qui réactive les services de collecte** : détection et ré-application des scripts. Test : Tâche 4 (script `verify`) et Tâche 10 (checklist après mise à jour).
4. **Touche Retour de la télécommande** : doit ramener au niveau précédent, puis quitter proprement, sans boucle de lancement. Test : Tâche 7.
5. **Périphérique USB ou dossier média retiré pendant la lecture** : message d'erreur explicite, pas de plantage du launcher. Test : Tâche 9.

---

### Task 0: Découverte et référence de l'appareil

**Files:**
- Create: `docs/discovery.md`
- Create: `scripts/device/collect-info.sh`

**Interfaces:**
- Consumes: rien.
- Produces: `docs/discovery.md` avec modèle exact, version webOS, version firmware, méthode de root, version de l'outil root, adresse IP, méthode SSH. Les tâches suivantes lisent la version webOS dans ce fichier.

- [ ] **Step 1: Écrire le script de collecte (dry-run, lecture seule)**

```bash
#!/usr/bin/env bash
# scripts/device/collect-info.sh
# Lecture seule : affiche les informations de l'appareil. N'écrit rien sur la TV.
set -euo pipefail
TV_HOST="${1:?usage: collect-info.sh <ip-tv>}"
ssh -o BatchMode=yes "root@${TV_HOST}" '
  echo "== release =="; cat /etc/os-release 2>/dev/null || true
  echo "== webos =="; grep -ri "webos_release\|version" /etc/palm-build-info 2>/dev/null | head -n 20 || true
  echo "== services Luna (noms) =="; ls /usr/palm/services 2>/dev/null | head -n 200 || true
  echo "== apps installées =="; ls /media/cryptofs/apps/usr/palm/applications 2>/dev/null || true
'
```

- [ ] **Step 2: Vérifier que le script échoue proprement sans argument**

Run: `bash scripts/device/collect-info.sh`
Expected: message `usage: collect-info.sh <ip-tv>` et code de sortie non nul.

- [ ] **Step 3: Exécuter le script sur la TV et rédiger `docs/discovery.md`**

Remplir le fichier avec : modèle et année, version webOS exacte, version firmware, méthode de root utilisée et version de l'outil, accès SSH confirmé (oui/non), sortie du script. Noter aussi si le mode développeur est activé.

- [ ] **Step 4: Vérifier le fichier**

Run: `grep -E "^- (Modèle|webOS|Firmware|Méthode root)" docs/discovery.md`
Expected: quatre lignes non vides.

- [ ] **Step 5: Initialiser le dépôt git et committer**

```bash
cd <dossier-du-projet>
git init
git add docs/discovery.md scripts/device/collect-info.sh docs/superpowers/plans/2026-11-12-webos-edu-os.md
git commit -m "docs: add device discovery and implementation plan"
```

---

### Task 1: Audit du trafic publicitaire et télémétrique

**Files:**
- Create: `tools/audit/summarize_dns.py`
- Create: `tools/audit/tests/test_summarize_dns.py`
- Create: `tools/audit/tests/fixtures/dnsmasq.log`
- Create: `docs/telemetry-audit.md`

**Interfaces:**
- Consumes: journal DNS (format dnsmasq `query[A] domaine from <ip>`) capturé sur le réseau local.
- Produces: `summarize_dns.py <log> --client <ip-tv>` affiche les domaines uniques interrogés par la TV, triés par nombre de requêtes. Fonction `extract_domains(lines, client_ip) -> Counter[str]`.

- [ ] **Step 1: Écrire le fichier de fixture**

```text
Nov 12 10:00:01 dnsmasq[1]: query[A] ad.example-lg.test from 192.168.1.50
Nov 12 10:00:02 dnsmasq[1]: query[AAAA] ad.example-lg.test from 192.168.1.50
Nov 12 10:00:03 dnsmasq[1]: query[A] tracker.example-lg.test from 192.168.1.50
Nov 12 10:00:04 dnsmasq[1]: query[A] www.wikipedia.org from 192.168.1.20
Nov 12 10:00:05 dnsmasq[1]: reply ad.example-lg.test is 0.0.0.0
```

- [ ] **Step 2: Écrire le test qui échoue**

```python
# tools/audit/tests/test_summarize_dns.py
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
```

- [ ] **Step 3: Lancer le test pour vérifier l'échec**

Run: `pytest tools/audit/tests/test_summarize_dns.py -v`
Expected: FAIL, `ModuleNotFoundError: tools.audit.summarize_dns`.

- [ ] **Step 4: Implémenter le minimum**

```python
# tools/audit/summarize_dns.py
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
```

- [ ] **Step 5: Lancer le test pour vérifier le succès**

Run: `pytest tools/audit/tests/test_summarize_dns.py -v`
Expected: PASS (3 tests).

- [ ] **Step 6: Capturer 48 h de trafic réel et rédiger l'audit**

Activer le journal DNS sur le routeur (ou Pi-hole), laisser la TV en veille et naviguer dans l'accueil LG pendant 48 h. Lancer `python tools/audit/summarize_dns.py <log> --client <ip-tv> > docs/telemetry-audit.tsv`, puis ajouter à chaque ligne deux colonnes séparées par des tabulations : catégorie (publicité, télémétrie, mise à jour, fonctionnel) et décision (`bloquer` / `autoriser`). Le fichier au format `domaine<TAB>catégorie<TAB>décision` est consommé par la Tâche 2. Rédiger `docs/telemetry-audit.md` pour les conclusions.

- [ ] **Step 7: Committer**

```bash
git add tools/audit docs/telemetry-audit.md
git commit -m "feat: add DNS audit tool and telemetry audit"
```

---

### Task 2: Génération de la blocklist

**Files:**
- Create: `blocklist/allowlist.txt`
- Create: `blocklist/build_blocklist.py`
- Create: `blocklist/tests/test_build_blocklist.py`
- Create: `blocklist/edu-tv.hosts` (généré)

**Interfaces:**
- Consumes: `docs/telemetry-audit.md` (domaines à bloquer, une ligne `domaine<TAB>catégorie<TAB>décision`), `blocklist/allowlist.txt`.
- Produces: `build(entries, allowlist) -> list[str]` renvoie des lignes au format hosts `0.0.0.0 domaine`. Fichier `blocklist/edu-tv.hosts` consommé par la Tâche 3.

- [ ] **Step 1: Écrire les tests qui échouent**

```python
# blocklist/tests/test_build_blocklist.py
from blocklist.build_blocklist import build

def test_blocks_domains_marked_block():
    entries = [("ad.example-lg.test", "publicité", "bloquer")]
    assert build(entries, allowlist=set()) == ["0.0.0.0 ad.example-lg.test"]

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
    assert build(entries, allowlist=set()) == ["0.0.0.0 a.test", "0.0.0.0 b.test"]
```

- [ ] **Step 2: Lancer les tests pour vérifier l'échec**

Run: `pytest blocklist/tests -v`
Expected: FAIL, `ModuleNotFoundError: blocklist.build_blocklist`.

- [ ] **Step 3: Implémenter**

```python
# blocklist/build_blocklist.py
import sys

def build(entries, allowlist):
    out = set()
    for domain, _category, decision in entries:
        if decision != "bloquer":
            continue
        if domain in allowlist:
            continue
        out.add(domain)
    return [f"0.0.0.0 {d}" for d in sorted(out)]

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
```

- [ ] **Step 4: Lancer les tests pour vérifier le succès**

Run: `pytest blocklist/tests -v`
Expected: PASS (4 tests).

- [ ] **Step 5: Générer la blocklist réelle**

Run: `python blocklist/build_blocklist.py docs/telemetry-audit.tsv blocklist/allowlist.txt blocklist/edu-tv.hosts`
Expected: fichier non vide ; `grep -c "^0.0.0.0" blocklist/edu-tv.hosts` affiche le nombre de domaines bloqués.

- [ ] **Step 6: Committer**

```bash
git add blocklist
git commit -m "feat: generate blocklist from telemetry audit"
```

---

### Task 3: Application réseau du blocage (DNS local)

**Files:**
- Create: `infra/dnsmasq.conf`
- Create: `scripts/net/verify-dns-block.sh`
- Create: `scripts/net/tests/test_verify_dns_block.bats`

**Interfaces:**
- Consumes: `blocklist/edu-tv.hosts` (Tâche 2).
- Produces: `infra/dnsmasq.conf` qui inclut la blocklist via `addn-hosts=`. Script `verify-dns-block.sh <resolver-ip>` qui retourne 0 si chaque domaine bloqué renvoie `0.0.0.0` et au moins un domaine autorisé se résout.

- [ ] **Step 1: Écrire le test bats qui échoue**

Créer d'abord la fixture `scripts/net/tests/fixtures/blocked.txt` : une ligne `0.0.0.0 ad.example-lg.test`.

```bash
# scripts/net/tests/test_verify_dns_block.bats
#!/usr/bin/env bats

@test "usage error without resolver argument" {
  run bash scripts/net/verify-dns-block.sh
  [ "$status" -ne 0 ]
  [[ "$output" == *"usage"* ]]
}

@test "fails when a blocked domain resolves to a real address" {
  # Résolveur factice : aucun blocage, doit échouer.
  run bash scripts/net/verify-dns-block.sh 127.0.0.1:5399 scripts/net/tests/fixtures/blocked.txt
  [ "$status" -ne 0 ]
}
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

Run: `bats scripts/net/tests/test_verify_dns_block.bats`
Expected: FAIL (le script n'existe pas).

- [ ] **Step 3: Implémenter le script de vérification**

```bash
#!/usr/bin/env bash
# scripts/net/verify-dns-block.sh
set -euo pipefail
RESOLVER="${1:?usage: verify-dns-block.sh <resolver[:port]> [liste-domaines]}"
LIST="${2:-blocklist/edu-tv.hosts}"
HOST="${RESOLVER%%:*}"
PORT="${RESOLVER#*:}"; [[ "$PORT" == "$RESOLVER" ]] && PORT=53
fail=0
while read -r _ domain; do
  [[ -z "${domain:-}" ]] && continue
  ans=$(dig +short +time=2 +tries=1 @"$HOST" -p "$PORT" "$domain" A | head -n1)
  if [[ "$ans" != "0.0.0.0" ]]; then
    echo "NON BLOQUÉ: $domain -> ${ans:-aucune réponse}"
    fail=1
  fi
done < <(grep '^0.0.0.0' "$LIST")
exit $fail
```

- [ ] **Step 4: Lancer le test pour vérifier le succès**

Run: `bats scripts/net/tests/test_verify_dns_block.bats`
Expected: PASS (2 tests).

- [ ] **Step 5: Déployer dnsmasq sur le routeur ou Pi-hole**

Écrire `infra/dnsmasq.conf` :

```conf
# infra/dnsmasq.conf
addn-hosts=/chemin/absolu/vers/blocklist/edu-tv.hosts
no-resolv
server=1.1.1.1
```

Redémarrer le service DNS, puis configurer le DHCP pour que la TV utilise ce résolveur. Run: `bash scripts/net/verify-dns-block.sh <ip-du-resolveur>` Expected: aucune ligne `NON BLOQUÉ`, code de sortie 0.

- [ ] **Step 6: Committer**

```bash
git add infra scripts/net
git commit -m "feat: enforce telemetry blocklist via local DNS"
```

---

### Task 4: Désactivation des services de collecte sur l'appareil

**Files:**
- Create: `scripts/device/lib/backup.sh`
- Create: `scripts/device/disable-telemetry.sh`
- Create: `scripts/device/restore-telemetry.sh`
- Create: `scripts/device/verify-telemetry.sh`
- Create: `scripts/device/tests/test_disable_dry_run.sh`
- Create: `docs/device-changes.md`

**Interfaces:**
- Consumes: liste des services à désactiver établie dans `docs/telemetry-audit.md` (Tâche 1) et relevée sur l'appareil (Tâche 0).
- Produces: `disable-telemetry.sh [--dry-run] <ip-tv>` ; sauvegarde dans `backups/<horodatage>/` ; `restore-telemetry.sh <dossier-sauvegarde> <ip-tv>` ; `verify-telemetry.sh <ip-tv>` qui retourne 0 si aucun service listé n'est actif.

- [ ] **Step 1: Écrire le test de dry-run qui échoue**

```bash
#!/usr/bin/env bash
# scripts/device/tests/test_disable_dry_run.sh
set -euo pipefail
out=$(bash scripts/device/disable-telemetry.sh --dry-run 192.0.2.10)
echo "$out" | grep -q "DRY-RUN" || { echo "pas de marqueur DRY-RUN"; exit 1; }
echo "$out" | grep -q "backup" || { echo "pas d'étape de sauvegarde"; exit 1; }
# Aucune commande destructive ne doit apparaître en dry-run
if echo "$out" | grep -E "rm -rf|mv .* /dev/null"; then
  echo "commande destructive en dry-run"; exit 1
fi
echo "OK"
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

Run: `bash scripts/device/tests/test_disable_dry_run.sh`
Expected: FAIL (`disable-telemetry.sh` absent).

- [ ] **Step 3: Implémenter la sauvegarde et le script de désactivation**

```bash
# scripts/device/lib/backup.sh
backup_remote() {  # $1 = hôte, $2 = dossier de sauvegarde local
  local host="$1" dest="$2"
  mkdir -p "$dest"
  ssh "root@${host}" 'tar -C / -czf - etc/hosts usr/palm/services 2>/dev/null' > "$dest/device-backup.tar.gz"
  echo "backup -> $dest/device-backup.tar.gz"
}
```

```bash
#!/usr/bin/env bash
# scripts/device/disable-telemetry.sh
set -euo pipefail
source "$(dirname "$0")/lib/backup.sh"
DRY=0
if [[ "${1:-}" == "--dry-run" ]]; then DRY=1; shift; fi
HOST="${1:?usage: disable-telemetry.sh [--dry-run] <ip-tv>}"
STAMP=$(date +%Y%m%d-%H%M%S)
DEST="backups/${STAMP}"
SERVICES_FILE="scripts/device/services-to-disable.txt"

run() { if [[ $DRY -eq 1 ]]; then echo "DRY-RUN: $*"; else eval "$@"; fi; }

run "backup_remote ${HOST} ${DEST}"
while read -r svc; do
  [[ -z "$svc" || "$svc" == \#* ]] && continue
  run "ssh root@${HOST} 'mv /usr/palm/services/${svc} /usr/palm/services/${svc}.disabled-by-apos'"
done < "$SERVICES_FILE"
echo "$STAMP" > "$DEST.stamp" 2>/dev/null || true
```

Créer `scripts/device/services-to-disable.txt` à partir de la Tâche 1 (un nom de service par ligne, commentaires avec `#`).

- [ ] **Step 4: Lancer le test pour vérifier le succès**

Run: `bash scripts/device/tests/test_disable_dry_run.sh`
Expected: `OK`.

- [ ] **Step 5: Implémenter restauration et vérification**

```bash
#!/usr/bin/env bash
# scripts/device/restore-telemetry.sh
set -euo pipefail
BACKUP_DIR="${1:?usage: restore-telemetry.sh <dossier-sauvegarde> <ip-tv>}"
HOST="${2:?usage: restore-telemetry.sh <dossier-sauvegarde> <ip-tv>}"
for f in $(ssh "root@${HOST}" 'ls /usr/palm/services | grep "\.disabled-by-apos$"' || true); do
  orig="${f%.disabled-by-apos}"
  ssh "root@${HOST}" "mv /usr/palm/services/${f} /usr/palm/services/${orig}"
done
echo "services restaurés depuis ${BACKUP_DIR}"
```

```bash
#!/usr/bin/env bash
# scripts/device/verify-telemetry.sh
set -euo pipefail
HOST="${1:?usage: verify-telemetry.sh <ip-tv>}"
active=$(ssh "root@${HOST}" 'ls /usr/palm/services 2>/dev/null' | grep -Ff <(grep -v '^#' scripts/device/services-to-disable.txt | grep -v '^$') || true)
if [[ -n "$active" ]]; then echo "ACTIFS: $active"; exit 1; fi
echo "OK: aucun service de collecte actif"
```

- [ ] **Step 6: Tester sur la TV puis committer**

Run: `bash scripts/device/disable-telemetry.sh --dry-run <ip-tv>` puis, après revue, `bash scripts/device/disable-telemetry.sh <ip-tv>`, puis `bash scripts/device/verify-telemetry.sh <ip-tv>` Expected: `OK: aucun service de collecte actif`. Tester aussi `restore-telemetry.sh` puis re-désactiver. Consigner chaque changement dans `docs/device-changes.md`.

```bash
shellcheck scripts/device/*.sh scripts/device/lib/*.sh
git add scripts/device docs/device-changes.md
git commit -m "feat: add reversible telemetry service disabling"
```

---

### Task 5: Squelette de l'application launcher webOS

**Files:**
- Create: `app/appinfo.json`
- Create: `app/index.html`
- Create: `app/css/launcher.css`
- Create: `app/js/main.js`
- Create: `app/tests/appinfo.test.js`
- Create: `package.json`
- Create: `scripts/app/package.sh`

**Interfaces:**
- Consumes: version webOS minimale dans `docs/discovery.md` (Tâche 0).
- Produces: paquet installable (`ares-package app`) avec `id` = `com.apos.launcher`, `type` = `web`, `main` = `index.html`. Module `main.js` expose `render(root, catalog)`.

- [ ] **Step 1: Écrire le test qui échoue sur le manifeste**

```js
// app/tests/appinfo.test.js
import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

const info = JSON.parse(readFileSync(new URL("../appinfo.json", import.meta.url)));

describe("appinfo.json", () => {
  it("declares a web app with the expected id and entry point", () => {
    expect(info.id).toBe("com.apos.launcher");
    expect(info.type).toBe("web");
    expect(info.main).toBe("index.html");
  });
  it("declares no network permission beyond local", () => {
    expect(info.requiredPermissions ?? []).not.toContain("network.external");
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

Run: `npx vitest run app/tests/appinfo.test.js`
Expected: FAIL (`appinfo.json` absent).

- [ ] **Step 3: Créer le manifeste et la page d'accueil minimales**

```json
{
  "id": "com.apos.launcher",
  "version": "0.1.0",
  "vendor": "ApOS",
  "type": "web",
  "main": "index.html",
  "title": "ApOS",
  "icon": "icon.png",
  "requiredPermissions": [],
  "resolution": "1920x1080"
}
```

```html
<!-- app/index.html -->
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; img-src 'self' data:; script-src 'self'; style-src 'self'">
  <link rel="stylesheet" href="css/launcher.css">
  <title>ApOS</title>
</head>
<body>
  <main id="root"></main>
  <script type="module" src="js/main.js"></script>
</body>
</html>
```

`app/js/main.js` : `export function render(root, catalog) { root.textContent = "ApOS"; }` puis appel au démarrage avec `document.getElementById("root")`.

`package.json` : déclarer `vitest` en devDependency et un script `"test": "vitest run"`.

- [ ] **Step 4: Relancer le test pour vérifier le succès**

Run: `npx vitest run app/tests/appinfo.test.js`
Expected: PASS (2 tests). Vérifier que `minWebOSVersion` ou équivalent correspond à `docs/discovery.md` si le champ existe dans le manifeste de la version webOS visée.

- [ ] **Step 5: Script de packaging et test d'installation**

```bash
#!/usr/bin/env bash
# scripts/app/package.sh
set -euo pipefail
ares-package app -o dist/
ls dist/com.apos.launcher_*.ipk
```

Run: `bash scripts/app/package.sh` puis `ares-install --device tv dist/com.apos.launcher_0.1.0_all.ipk` et `ares-launch --device tv com.apos.launcher`. Expected: le texte « ApOS » s'affiche sur la TV.

- [ ] **Step 6: Committer**

```bash
git add app package.json scripts/app
git commit -m "feat: scaffold webOS launcher app"
```

---

### Task 6: Catalogue et configuration locale

**Files:**
- Create: `app/js/catalog.js`
- Create: `app/config/default-catalog.json`
- Create: `app/tests/catalog.test.js`

**Interfaces:**
- Consumes: rien en amont.
- Produces: `loadCatalog(jsonText) -> { apps: Entry[], media: Entry[], warnings: string[] }` où `Entry = { id: string, title: string, kind: "app" | "folder", target: string }`. Ne lève jamais d'exception : en cas d'erreur, renvoie le catalogue par défaut et un avertissement.

- [ ] **Step 1: Écrire les tests qui échouent**

```js
// app/tests/catalog.test.js
import { describe, it, expect } from "vitest";
import { loadCatalog } from "../js/catalog.js";
import defaults from "../config/default-catalog.json" with { type: "json" };

describe("loadCatalog", () => {
  it("falls back to defaults on malformed JSON, never throws", () => {
    const c = loadCatalog("{ pas du json");
    expect(c.apps.length).toBe(defaults.apps.length);
    expect(c.warnings.length).toBeGreaterThan(0);
  });
  it("falls back to defaults when the input is empty or missing", () => {
    expect(loadCatalog("").apps.length).toBe(defaults.apps.length);
    expect(loadCatalog(undefined).apps.length).toBe(defaults.apps.length);
  });
  it("drops entries with remote URLs and warns", () => {
    const text = JSON.stringify({ apps: [{ id: "x", title: "X", kind: "app", target: "https://evil.test/app" }], media: [] });
    const c = loadCatalog(text);
    expect(c.apps.find(a => a.id === "x")).toBeUndefined();
    expect(c.warnings.join(" ")).toMatch(/distant|remote/i);
  });
  it("keeps valid local entries", () => {
    const text = JSON.stringify({ apps: [{ id: "lecture", title: "Lecture", kind: "app", target: "com.example.reader" }], media: [] });
    expect(loadCatalog(text).apps.map(a => a.id)).toEqual(["lecture"]);
  });
});
```

- [ ] **Step 2: Lancer les tests pour vérifier l'échec**

Run: `npx vitest run app/tests/catalog.test.js`
Expected: FAIL (`catalog.js` absent).

- [ ] **Step 3: Implémenter**

```js
// app/js/catalog.js
import defaults from "../config/default-catalog.json" with { type: "json" };

const REMOTE = /^(https?:|\/\/)/i;

function validEntry(e) {
  return e && typeof e.id === "string" && typeof e.title === "string"
    && (e.kind === "app" || e.kind === "folder") && typeof e.target === "string";
}

export function loadCatalog(text) {
  const warnings = [];
  let parsed;
  try {
    if (!text) throw new Error("configuration vide");
    parsed = JSON.parse(text);
  } catch (err) {
    return { apps: defaults.apps.slice(), media: defaults.media.slice(), warnings: [`Configuration par défaut utilisée : ${err.message}`] };
  }
  const keep = (list, label) => (Array.isArray(list) ? list : []).filter(e => {
    if (!validEntry(e)) { warnings.push(`${label} invalide ignoré`); return false; }
    if (REMOTE.test(e.target)) { warnings.push(`${label} « ${e.id} » ignoré : cible distante`); return false; }
    return true;
  });
  return { apps: keep(parsed.apps, "app"), media: keep(parsed.media, "média"), warnings };
}
```

`app/config/default-catalog.json` : `{ "apps": [{ "id": "accueil", "title": "Accueil", "kind": "app", "target": "com.apos.launcher" }], "media": [] }`.

- [ ] **Step 4: Lancer les tests pour vérifier le succès**

Run: `npx vitest run app/tests/catalog.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Committer**

```bash
git add app/js/catalog.js app/config app/tests/catalog.test.js
git commit -m "feat: add local catalog loader with safe fallback"
```

---

### Task 7: Navigation à la télécommande

**Files:**
- Create: `app/js/focus.js`
- Create: `app/tests/focus.test.js`
- Modify: `app/js/main.js`

**Interfaces:**
- Consumes: `Entry[]` de la Tâche 6.
- Produces: `createFocus(count, columns) -> { move(dir) => index, index: number }` où `dir` ∈ `"left" | "right" | "up" | "down"`. Un module `back.js` gère la touche Retour : `handleBack(stack) -> "pop" | "exit"`.

- [ ] **Step 1: Écrire les tests qui échouent**

```js
// app/tests/focus.test.js
import { describe, it, expect } from "vitest";
import { createFocus } from "../js/focus.js";
import { handleBack } from "../js/back.js";

describe("createFocus", () => {
  it("moves right and stops at the last item", () => {
    const f = createFocus(3, 3);
    f.move("right"); f.move("right"); f.move("right");
    expect(f.index).toBe(2);
  });
  it("moves down by one row of columns", () => {
    const f = createFocus(6, 3);
    f.move("down");
    expect(f.index).toBe(3);
  });
  it("does not move left below zero", () => {
    const f = createFocus(3, 3);
    f.move("left");
    expect(f.index).toBe(0);
  });
  it("handles zero items without error", () => {
    const f = createFocus(0, 3);
    f.move("right");
    expect(f.index).toBe(0);
  });
});

describe("handleBack", () => {
  it("returns pop when a sub-screen is open", () => {
    expect(handleBack(["home", "media"])).toBe("pop");
  });
  it("returns exit at the root, never loops", () => {
    expect(handleBack(["home"])).toBe("exit");
    expect(handleBack([])).toBe("exit");
  });
});
```

- [ ] **Step 2: Lancer les tests pour vérifier l'échec**

Run: `npx vitest run app/tests/focus.test.js`
Expected: FAIL.

- [ ] **Step 3: Implémenter**

```js
// app/js/focus.js
export function createFocus(count, columns) {
  const state = { index: 0 };
  const cols = Math.max(1, columns);
  return {
    get index() { return state.index; },
    move(dir) {
      if (count === 0) { state.index = 0; return state.index; }
      let i = state.index;
      if (dir === "right") i = Math.min(count - 1, i + 1);
      if (dir === "left") i = Math.max(0, i - 1);
      if (dir === "down") i = Math.min(count - 1, i + cols);
      if (dir === "up") i = Math.max(0, i - cols);
      state.index = i;
      return i;
    },
  };
}
```

```js
// app/js/back.js
export function handleBack(stack) {
  return stack.length > 1 ? "pop" : "exit";
}
```

Dans `main.js`, brancher les touches (`keydown`, codes 37/38/39/40 pour les flèches, 461 ou `Escape` pour Retour selon le modèle — à confirmer sur la TV et à noter dans `docs/discovery.md`).

- [ ] **Step 4: Lancer les tests pour vérifier le succès**

Run: `npx vitest run app/tests`
Expected: PASS.

- [ ] **Step 5: Test manuel sur la TV puis committer**

Checklist sur la TV : flèches (les 4 directions), bord de liste, Retour depuis un sous-écran, Retour à l'accueil quitte le launcher sans relancer. Consigner le résultat dans `docs/test-reports/focus.md`.

```bash
git add app/js/focus.js app/js/back.js app/js/main.js app/tests/focus.test.js docs/test-reports
git commit -m "feat: add remote focus navigation and back handling"
```

---

### Task 8: Installation comme accueil et lancement au démarrage

**Files:**
- Create: `scripts/device/install-launcher.sh`
- Create: `scripts/device/restore-launcher.sh`
- Create: `docs/boot-integration.md`

**Interfaces:**
- Consumes: paquet `dist/com.apos.launcher_*.ipk` (Tâche 5), méthode de lancement au démarrage relevée dans `docs/discovery.md` (Tâche 0).
- Produces: `install-launcher.sh <ip-tv>` installe le paquet et configure le lancement au démarrage ; `restore-launcher.sh <ip-tv>` annule.

- [ ] **Step 1: Écrire le test de dry-run qui échoue**

```bash
#!/usr/bin/env bash
# scripts/device/tests/test_install_dry_run.sh
set -euo pipefail
out=$(bash scripts/device/install-launcher.sh --dry-run 192.0.2.10)
echo "$out" | grep -q "DRY-RUN" || { echo "pas de marqueur DRY-RUN"; exit 1; }
echo "$out" | grep -q "ares-install" || { echo "installation absente"; exit 1; }
echo "OK"
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

Run: `bash scripts/device/tests/test_install_dry_run.sh`
Expected: FAIL.

- [ ] **Step 3: Implémenter**

```bash
#!/usr/bin/env bash
# scripts/device/install-launcher.sh
set -euo pipefail
DRY=0
if [[ "${1:-}" == "--dry-run" ]]; then DRY=1; shift; fi
HOST="${1:?usage: install-launcher.sh [--dry-run] <ip-tv>}"
IPK=$(ls dist/com.apos.launcher_*.ipk | tail -n1)
run() { if [[ $DRY -eq 1 ]]; then echo "DRY-RUN: $*"; else eval "$@"; fi; }
run "ares-install --device tv '${IPK}'"
run "ssh root@${HOST} 'echo com.apos.launcher > /var/lib/apos/autostart-app'"
```

`restore-launcher.sh` : désinstaller `com.apos.launcher` avec `ares-install --remove`, supprimer le fichier de démarrage, relancer l'accueil LG avec `luna-send`. Vérifier la commande exacte sur la TV avant de la figer (noter le résultat dans `docs/boot-integration.md`).

- [ ] **Step 4: Lancer le test pour vérifier le succès**

Run: `bash scripts/device/tests/test_install_dry_run.sh`
Expected: `OK`.

- [ ] **Step 5: Test réel puis committer**

Run: `bash scripts/device/install-launcher.sh <ip-tv>`, puis éteindre et rallumer la TV. Expected: ApOS s'affiche au démarrage. Tester `restore-launcher.sh` puis réinstaller.

```bash
shellcheck scripts/device/install-launcher.sh scripts/device/restore-launcher.sh
git add scripts/device docs/boot-integration.md
git commit -m "feat: install launcher as boot app with restore path"
```

---

### Task 9: Mode kiosque éducatif et médias locaux

**Files:**
- Create: `app/js/kiosk.js`
- Create: `app/js/media.js`
- Create: `app/tests/kiosk.test.js`
- Create: `app/tests/media.test.js`

**Interfaces:**
- Consumes: `Entry[]` (Tâche 6), `createFocus` (Tâche 7).
- Produces: `hashPin(pin, salt) -> string` (SHA-256 via `crypto.subtle`), `checkPin(pin, salt, expectedHash) -> Promise<boolean>`, `isAppAllowed(id, allowlist) -> boolean`. `media.js` : `listMedia(entries, readDir) -> { items, error }`, qui renvoie `error` sans lever d'exception si le dossier est absent.

- [ ] **Step 1: Écrire les tests qui échouent**

```js
// app/tests/kiosk.test.js
import { describe, it, expect } from "vitest";
import { hashPin, checkPin, isAppAllowed } from "../js/kiosk.js";

describe("kiosk PIN", () => {
  it("accepts the right PIN and rejects a wrong one", async () => {
    const h = await hashPin("1234", "salt-a");
    expect(await checkPin("1234", "salt-a", h)).toBe(true);
    expect(await checkPin("0000", "salt-a", h)).toBe(false);
  });
  it("produces different hashes for different salts", async () => {
    expect(await hashPin("1234", "a")).not.toBe(await hashPin("1234", "b"));
  });
  it("rejects a PIN that is not four digits", async () => {
    await expect(hashPin("12", "s")).rejects.toThrow(/4 chiffres/);
  });
});

describe("isAppAllowed", () => {
  it("allows only listed ids", () => {
    expect(isAppAllowed("lecture", ["lecture"])).toBe(true);
    expect(isAppAllowed("navigateur", ["lecture"])).toBe(false);
  });
});
```

```js
// app/tests/media.test.js
import { describe, it, expect } from "vitest";
import { listMedia } from "../js/media.js";

describe("listMedia", () => {
  it("returns an error instead of throwing when the folder is missing", () => {
    const r = listMedia([{ id: "m", title: "M", kind: "folder", target: "/media/usb/x" }], () => { throw new Error("ENOENT"); });
    expect(r.items).toEqual([]);
    expect(r.error).toMatch(/introuvable|indisponible/i);
  });
  it("lists files from an available folder", () => {
    const r = listMedia([{ id: "m", title: "M", kind: "folder", target: "/media/usb/x" }], () => ["a.mp4", "b.mp4"]);
    expect(r.items.map(i => i.name)).toEqual(["a.mp4", "b.mp4"]);
    expect(r.error).toBeUndefined();
  });
});
```

- [ ] **Step 2: Lancer les tests pour vérifier l'échec**

Run: `npx vitest run app/tests/kiosk.test.js app/tests/media.test.js`
Expected: FAIL.

- [ ] **Step 3: Implémenter**

```js
// app/js/kiosk.js
export async function hashPin(pin, salt) {
  if (!/^\d{4}$/.test(pin)) throw new Error("Le code doit comporter 4 chiffres");
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}

export async function checkPin(pin, salt, expectedHash) {
  try { return (await hashPin(pin, salt)) === expectedHash; }
  catch { return false; }
}

export function isAppAllowed(id, allowlist) {
  return allowlist.includes(id);
}
```

```js
// app/js/media.js
export function listMedia(entries, readDir) {
  const items = [];
  let error;
  for (const e of entries.filter(x => x.kind === "folder")) {
    try {
      for (const name of readDir(e.target)) items.push({ name, source: e.id });
    } catch {
      error = `Dossier « ${e.title} » introuvable ou indisponible`;
    }
  }
  return error ? { items, error } : { items };
}
```

- [ ] **Step 4: Lancer les tests pour vérifier le succès**

Run: `npx vitest run app/tests`
Expected: PASS.

- [ ] **Step 5: Test manuel sur la TV puis committer**

Brancher une clé USB, vérifier la liste. Débrancher pendant la lecture : message d'erreur affiché, launcher toujours actif. Consigner dans `docs/test-reports/media.md`.

```bash
git add app/js/kiosk.js app/js/media.js app/tests docs/test-reports
git commit -m "feat: add kiosk PIN and local media listing"
```

---

### Task 10: Vérification finale et documentation de récupération

**Files:**
- Create: `docs/test-reports/offline-boot.md`
- Create: `docs/test-reports/telemetry-48h.md`
- Create: `docs/recovery.md`
- Create: `README.md`

**Interfaces:**
- Consumes: toutes les tâches précédentes.
- Produces: rapports de test datés et guide de récupération.

- [ ] **Step 1: Test de démarrage hors ligne**

Déconnecter la TV du réseau (ou couper le routeur), redémarrer. Expected : ApOS s'affiche, l'app « Accueil » se lance, aucun message d'erreur réseau bloquant. Noter le résultat dans `docs/test-reports/offline-boot.md`.

- [ ] **Step 2: Test de non-télémétrie sur 48 h**

Lancer `summarize_dns.py` sur le journal DNS de 48 h. Run: `python tools/audit/summarize_dns.py <journal> --client <ip-tv>` puis `bash scripts/net/verify-dns-block.sh <ip-resolveur>`. Expected : aucun domaine marqué « bloquer » ne reçoit une réponse autre que `0.0.0.0`. Noter le résultat dans `docs/test-reports/telemetry-48h.md`.

- [ ] **Step 3: Test de mise à jour firmware**

Après une mise à jour LG (si elle a lieu), lancer `bash scripts/device/verify-telemetry.sh <ip-tv>`. Si ACTIFS apparaît, relancer `disable-telemetry.sh`. Consigner dans `docs/recovery.md`.

- [ ] **Step 4: Rédiger `docs/recovery.md`**

Contenu : restauration via `restore-telemetry.sh` et `restore-launcher.sh` ; retour à l'accueil LG ; procédure de récupération en cas d'écran noir (méthode de root documentée dans `docs/discovery.md`, mode sans échec, réinstallation par la méthode de la communauté) ; avertissement : une mise à jour firmware peut annuler les modifications.

- [ ] **Step 5: Rédiger `README.md` et committer**

Contenu : objectif, prérequis, ordre d'exécution des scripts (Tâches 0 à 8), limites (pas de flash firmware, dépendance à la méthode de root, garantie).

```bash
git add docs README.md
git commit -m "docs: add verification reports, recovery guide and README"
```

---

## Self-Review (effectuée)

- **Couverture du spec :** simplicité (Tâches 5-7), sans publicité et sans télémétrie (Tâches 1-4), personnalisation éducative (Tâches 6, 9), TV rootée (Tâches 0, 4, 8), vérification (Tâche 10).
- **Placeholders :** les valeurs qui dépendent de l'appareil (version webOS, méthode root, chemins de services, codes touche Retour, méthode de lancement au démarrage) sont relevées en Tâche 0 et Tâche 8, et non inventées ici.
- **Cohérence des types :** `Entry`, `loadCatalog`, `createFocus`, `handleBack`, `listMedia` utilisés de manière cohérente entre tâches.
- **Review Focus :** chaque ligne est couverte par une tâche propriétaire.

## Points à confirmer par l'utilisateur

1. Modèle exact de la TV, année et version webOS.
2. Méthode de root utilisée (et version de l'outil), car elle conditionne les scripts des Tâches 4 et 8.
3. Votre routeur permet-il un DNS local (dnsmasq, Pi-hole) ?
4. Usage éducatif : enfants mineurs concernés ? (impacte les exigences RGPD ; le plan suppose déjà zéro collecte.)
