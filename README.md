# ApOS — launcher éducatif sans publicité ni télémétrie pour webOS

Projet personnel pour une TV LG webOS rootée. Trois couches : blocage DNS local, désactivation réversible des services de collecte, et un launcher web local.

## Ordre d'exécution
1. Relever les infos de l'appareil : `bash scripts/device/collect-info.sh <ip-tv>` (voir `docs/discovery.md`).
2. Audit DNS : `tools/audit/summarize_dns.py` (voir `docs/telemetry-audit.md`).
3. Générer la blocklist : `blocklist/build_blocklist.py`.
4. Déployer le DNS : `infra/dnsmasq.conf`, puis `scripts/net/verify-dns-block.sh`.
5. Désactiver les services : `scripts/device/disable-telemetry.sh --dry-run` puis sans l'option.
6. Packager et installer le launcher : `scripts/app/package.sh` puis `scripts/device/install-launcher.sh <ip-tv>`.

## Tests
- Python : `python -m pytest tools blocklist`
- JavaScript : `npm test`
- Scripts shell : `bats scripts/net/tests` et `bash scripts/device/tests/*.sh`

## Limites
- Pas de flash de firmware personnalisé.
- Dépend de la méthode de root et du modèle.
- Une mise à jour LG peut annuler les modifications (voir `docs/recovery.md`).
- Le code PIN du mode kiosque est un verrou contre les enfants, pas une protection de sécurité.
