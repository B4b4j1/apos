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

## Réglages d'ApOS (style Lumen)
- Accueil : horloge en haut à gauche, deux boutons ronds en haut à droite (Sources, Réglages), dock en verre avec la rangée d'apps.
- Appui long sur OK (ou bouton rouge) sur une tuile : réorganisation, flèches pour déplacer, OK pour valider.
- Réglages > Applications : masquer des apps ; Fonds d'écran : diaporama, photo fixe, durée, assombrissement ; Horloge : disposition (une ligne / empilée), position, 24 h / 12 h, date, secondes, taille ; Apparence : taille, forme et style des tuiles, noms, mise en valeur, taille du texte, animations, dock en verre, flous ; Système : réglages LG, accueil LG, recharger, à propos.
- Tous les réglages sont mémorisés dans le stockage local de l'app. La météo de Lumen n'est pas reprise : elle exige des appels réseau.

## Temps d'écran
- Un collecteur tourne sur la TV (`scripts/device/screentime/apos-screentime.sh`, lancé au démarrage par un script init.d). Toutes les 10 s, si la TV est allumée (état d'alimentation « Active »), il note l'app au premier plan dans `data/usage-AAAA-MM-JJ.log` de l'app ; les jours passés sont résumés en `.tsv` (90 jours conservés). Aucune donnée ne quitte la TV.
- Installation / retrait : `bash scripts/device/install-screentime.sh <ip-tv>` et `restore-screentime.sh <ip-tv>` (avec `APOS_SSH_OPTS="-i ~/.ssh/tv_apos"` si besoin).
- Widget sous l'horloge (réglable dans Horloge) : temps d'écran du jour, rafraîchi toutes les 15 s. Rapport : Réglages > Temps d'écran (aujourd'hui, hier, 7 jours, total et par app).
- Réinstaller ApOS depuis un paquet efface le dossier `data/` (l'historique) ; `scripts/device/deploy-app.sh <ip-tv>` le conserve.
- Les écrans de veille et la veille de la TV ne sont pas comptés. Le jour change à minuit selon le fuseau horaire de la TV.

## Liste des apps (launcher)
- Une app web ne peut pas lister les apps via Luna. `bash scripts/device/refresh-apps.sh <ip-tv>` (avec `APOS_SSH_OPTS="-i ~/.ssh/tv_apos"` si besoin) génère sur la TV `config/launchpoints.json`, copie les icônes et calcule la couleur de tuile de chaque app (sur le Mac, avec Pillow). À relancer après l'ajout ou la suppression d'une app, ou après une réinstallation d'ApOS.

## Tests
- Python : `build/venv/bin/python -m pytest tools blocklist scripts` (venv à créer dans `build/` avec pytest et pillow)
- JavaScript : `npm test`
- Scripts shell : `bats scripts/net/tests` et `bash scripts/device/tests/*.sh`

## Limites
- Pas de flash de firmware personnalisé.
- Dépend de la méthode de root et du modèle.
- Une mise à jour LG peut annuler les modifications (voir `docs/recovery.md`).
- Le code PIN du mode kiosque est un verrou contre les enfants, pas une protection de sécurité.
