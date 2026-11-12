# ApOS — launcher éducatif sans publicité ni télémétrie pour webOS

Projet personnel pour une TV LG webOS rootée. Trois couches : blocage DNS local, désactivation réversible des services de collecte, et un launcher web local.

## Ordre d'exécution
1. Relever les infos de l'appareil : `bash scripts/device/collect-info.sh <ip-tv>` (voir `docs/discovery.md`).
2. Audit DNS : `tools/audit/summarize_dns.py` (voir `docs/telemetry-audit.md`).
3. Générer la blocklist : `blocklist/build_blocklist.py`.
4. Déployer le DNS : `infra/dnsmasq.conf`, puis `scripts/net/verify-dns-block.sh`.
5. Désactiver les services : `scripts/device/disable-telemetry.sh --dry-run` puis sans l'option.
6. Packager et installer le launcher : `scripts/app/package.sh` puis `scripts/device/install-launcher.sh <ip-tv>`.

## Fonds d'écran et diaporama (launcher)
- Déposez vos photos originales dans `wallpapers-src/` (non versionné : elles sont lourdes et contiennent la position GPS).
- `build/venv/bin/python scripts/app/prepare_wallpapers.py wallpapers-src app/assets/wallpapers` les convertit en 1920x1080 léger (sans EXIF) avec vignettes et écrit `index.json` (non versionné aussi).
- Au lancement, l'app lit `assets/wallpapers/index.json` : diaporama par défaut (nouvelle photo toutes les 60 s, fondu enchaîné). Dans le dock : Réglages ApOS pour choisir Diaporama, Aucun fond ou une photo fixe.
- Des fonds peuvent aussi être déclarés à la main dans `app/config/wallpapers.js`. Aucune image n'est téléchargée : `scripts/app/package.sh` échoue si une référence `http(s)://` se trouve dans le paquet.

## Liste des apps (launcher)
- Une app web ne peut pas lister les apps via Luna. `bash scripts/device/refresh-apps.sh <ip-tv>` (avec `APOS_SSH_OPTS="-i ~/.ssh/tv_apos"` si besoin) génère sur la TV `config/launchpoints.json` et copie les icônes. À relancer après l'ajout ou la suppression d'une app, ou après une réinstallation d'ApOS.

## Tests
- Python : `build/venv/bin/python -m pytest tools blocklist scripts` (venv à créer dans `build/` avec pytest et pillow)
- JavaScript : `npm test`
- Scripts shell : `bats scripts/net/tests` et `bash scripts/device/tests/*.sh`

## Limites
- Pas de flash de firmware personnalisé.
- Dépend de la méthode de root et du modèle.
- Une mise à jour LG peut annuler les modifications (voir `docs/recovery.md`).
- Le code PIN du mode kiosque est un verrou contre les enfants, pas une protection de sécurité.
