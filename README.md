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

## Temps d'écran, limites et code PIN
- Un service Python tourne sur la TV (`scripts/device/screentime/apos_screentime.py`, lancé au démarrage par `init.d/70-apos-screentime`). Toutes les 10 s, si la TV est allumée (état « Active »), il note l'app au premier plan dans `data/usage-AAAA-MM-JJ.log` de l'app ; les jours passés sont résumés en `.tsv` (90 jours conservés). Aucune donnée ne quitte la TV. L'économiseur d'écran et la veille ne sont pas comptés.
- Installation / retrait : `bash scripts/device/install-screentime.sh <ip-tv>` et `restore-screentime.sh <ip-tv>` (avec `APOS_SSH_OPTS="-i ~/.ssh/tv_apos"` si besoin).
- Widget sous l'horloge (réglable dans Horloge) : temps d'écran du jour, rafraîchi toutes les 15 s.
- Réglages > Temps d'écran : histogramme des 7 derniers jours, total et par app (aujourd'hui, hier, 7 jours), puis les limites.
- Limites : limite quotidienne et limites par application. À la limite : « Message » (notification sur la TV, rappelée toutes les 5 min) ou « Verrouillage » (ApOS revient au premier plan et affiche un écran de code PIN ; Retour et flèche gauche ne le ferment pas). Le bon code prolonge de 15, 30 ou 60 min. Pour une limite d'app, « Fermer » quitte l'écran sans prolonger.
- Code PIN (4 à 8 chiffres) : protège la modification des limites et débloque l'écran de blocage. Il est stocké salé et haché (PBKDF2) dans `/var/lib/webosbrew/apos-screentime.json`, jamais renvoyé par l'API ; 5 essais faux bloquent la saisie 1 minute. Sans code défini, la prolongation est libre.
- API locale `http://127.0.0.1:8742` (état, configuration, code PIN, déblocage) : liée à la TV uniquement. Une autre app de la TV pourrait l'appeler ; le code PIN protège les changements de configuration.
- Limites de la protection : c'est un cadre familial, pas une sécurité forte. Quelqu'un qui accède à la TV en SSH ou à Homebrew Channel peut arrêter le service. Éteindre la TV arrête aussi le comptage.
- Réinstaller ApOS depuis un paquet efface le dossier `data/` (l'historique) ; `scripts/device/deploy-app.sh <ip-tv>` le conserve.
- Fuseau horaire : `scripts/device/set-timezone.sh <ip-tv> [zone]` (Europe/Paris par défaut ; retour : `Etc/GMT-0`). Le jour du rapport change à minuit selon ce fuseau.

## Bouton Home de la télécommande

Réglages > Système > « Bouton Home de la télécommande » : ApOS (le bouton Home ramène vers ApOS) ou webOS (comportement d'origine, par défaut).
Le service de la TV s'abonne à l'app au premier plan (interrogation toutes les 2 s en secours) ; dès que l'accueil LG apparaît, il relance ApOS (l'accueil LG reste visible environ 0,3 s).
Le bouton « Retour vers webOS » (icône maison, à droite des réglages) ouvre l'accueil LG sans redirection. Garde-fou : après 5 redirections en 30 s,
la redirection se met en pause 10 minutes. Désactivation d'urgence : `ssh root@<tv> "sed -i 's/\"home_redirect\": true/\"home_redirect\": false/' /var/lib/webosbrew/apos-screentime.json; kill \$(cat /tmp/apos-screentime.pid)"`.

## Compagnons (avatars)

Les avatars se sélectionnent aussi aux flèches de la télécommande (flèche haut depuis les apps), OK déclenche leur animation.
Trois petits personnages côte à côte en haut à droite de l'accueil (`app/js/avatar.js`, réglage Apparence > Compagnons : tous les trois, un seul ou aucun) : un chat, une licorne et un lapin. Ils réagissent au lancement d'une app (contents), à l'entrée dans les réglages (curieux), à la réorganisation (surpris, ils sautent), à un réglage enregistré ou une mise à jour (fiers). Ils dorment (couchés) la nuit (22 h à 7 h) ou après 3 minutes sans action, et s'inquiètent à partir de 80 % de la limite quotidienne ou à l'écran de blocage. Leurs yeux suivent le pointeur (souris, Magic Remote) : seules les pupilles bougent, pas l'avatar ; elles reviennent au centre après 6 s d'immobilité.

Un clic sur un compagnon déclenche son animation : le chat miaule (bulle « Miaou ! ») puis sourit ; la licorne sourit et un rayon arc-en-ciel sort de sa corne ; le lapin sourit, sort une carotte et la mange (trois images, de la carotte entière au trognon).

Les personnages sont des images WebP locales (`app/assets/companions/<id>/`, 120 à 175 Ko par compagnon) : une tête par humeur aux yeux vides, une pupille séparée, deux poses (couché, saut) et, pour le lapin, les images de la carotte. Les positions des yeux et de la corne sont dans `app/js/companion-data.js`. Les planches sources (PNG, non versionnées) vont dans `companions-src/<id>/` ; `python scripts/app/build-companions.py` recadre, convertit et détecte les yeux, puis régénère les WebP et `companion-data.js`.

## Liste des apps (launcher)
- Une app web ne peut pas lister les apps via Luna. `bash scripts/device/refresh-apps.sh <ip-tv>` (avec `APOS_SSH_OPTS="-i ~/.ssh/tv_apos"` si besoin) génère sur la TV `config/launchpoints.json`, copie les icônes et calcule la couleur de tuile de chaque app (sur le Mac, avec Pillow). À relancer après l'ajout ou la suppression d'une app, ou après une réinstallation d'ApOS.

## Publication et installation par Homebrew Channel
- Publier : `gh auth login` avec le compte propriétaire, puis `bash scripts/app/publish.sh <compte> <dépôt>` (option `--dry-run` pour simuler). Le script construit le paquet propre (sans photos, icônes ni données), génère `repo/index.json` et le manifeste, pousse le dépôt et crée la release avec le `.ipk`.
- Sur la TV : Homebrew Channel > Réglages > Add repository, URL `https://raw.githubusercontent.com/<compte>/<dépôt>/main/repo/index.json` (ou `ares-launch org.webosbrew.hbchannel -p '{"launchMode":"addRepository","url":"…"}'` pour pré-remplir le champ). L'app ApOS apparaît dans la liste ; INSTALL ou UPDATE.
- Mise à jour : augmenter `version` dans `app/appinfo.json`, relancer `bash scripts/app/publish.sh B4b4j1 apos` (compte `gh` actif : `B4b4j1`). Homebrew Channel propose UPDATE, et ApOS lui-même : Réglages > Mise à jour > Rechercher, puis Installer (le service de la TV télécharge le `.ipk` depuis ce dépôt, vérifie son SHA-256 et l'installe ; vérification uniquement à la demande, rien n'est envoyé). Le service lui-même (`apos_screentime.py`) n'est pas dans le paquet : après une évolution du service, relancer `scripts/device/install-screentime.sh <ip-tv>`.
- Une mise à jour remplace le dossier de l'app : le service de temps d'écran restaure ensuite, depuis `/var/lib/webosbrew/apos`, les photos, les icônes, la liste des apps et l'historique (dans la minute). Relancer ApOS pour les voir. Remplir cette copie : `scripts/device/sync-assets.sh <ip-tv>` (photos et icônes locales) ou `refresh-apps.sh`.
- Première installation sur une TV vierge : installer le paquet, puis `install-screentime.sh`, `apply-hosts-block.sh`, `refresh-apps.sh`, `sync-assets.sh`.

## Licence
MIT, voir `LICENSE`. Notices tierces : `THIRD_PARTY_NOTICES.md`.

## Tests
- Python : `build/venv/bin/python -m pytest tools blocklist scripts` (venv à créer dans `build/` avec pytest et pillow)
- JavaScript : `npm test`
- Scripts shell : `bats scripts/net/tests` et `bash scripts/device/tests/*.sh`

## Limites
- Pas de flash de firmware personnalisé.
- Dépend de la méthode de root et du modèle.
- Une mise à jour LG peut annuler les modifications (voir `docs/recovery.md`).
- Le code PIN du mode kiosque est un verrou contre les enfants, pas une protection de sécurité.
