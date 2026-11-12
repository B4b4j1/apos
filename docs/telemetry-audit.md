# Audit télémétrie et publicité — blocage par /etc/hosts

## Origine de la liste
- `docs/telemetry-audit.tsv` (domaine, catégorie, décision) reprend les 506 noms d'hôtes LG de la liste générée par l'app « Life's Good Without Spying », trouvée sur la TV le 2026-11-12 (`/var/lib/webosbrew/lifesgoodwithoutspying.hosts`), plus `ad.doubleclick.net` et `hesads.akamaized.net` (relevés par Lumen).
- Les catégories sont déduites du domaine (suffixe) : publicité (lgsmartad.com…), ACR (alphonso.tv), télémétrie (lgtvcommon.com, lgtviot.com), ThinQ, recommandations, services LG webOS, LG Channels, mises à jour.
- Ce n'est PAS une capture DNS de 48 h de cette TV : la liste n'est ni exhaustive ni vérifiée domaine par domaine. À compléter avec `tools/audit/summarize_dns.py` si un journal DNS devient disponible.

## Mécanisme
- `scripts/device/apply-hosts-block.sh <ip-tv>` génère `blocklist/edu-tv.hosts` (IPv4 `0.0.0.0` et IPv6 `::`), l'installe dans `/var/lib/webosbrew/apos-hosts.block` et pose `/var/lib/webosbrew/init.d/50-apos-hosts`, exécuté à chaque démarrage après Homebrew Channel. Il ajoute un bloc délimité à `/etc/hosts` (fichier volatile, recréé à chaque démarrage). Idempotent.
- Retour arrière : `scripts/device/restore-hosts-block.sh <ip-tv>`.

## Limites
- Un fichier hosts ne bloque que les noms exacts listés, pas les adresses IP directes ni le DNS chiffré.
- Bloquer des domaines LG peut désactiver des fonctions LG (LG Channels, recommandations, ThinQ, boutique LG). Les apps de streaming testées par résolution (Netflix, YouTube, Google) ne sont pas bloquées ; leur fonctionnement réel doit être vérifié sur la TV.
- L'app « Life's Good Without Spying » est désactivée sur cette TV (dernier job « disable » le 2026-11-03) ; ce blocage ne dépend pas d'elle. Ne pas la réactiver en même temps sans vérifier les conflits.
