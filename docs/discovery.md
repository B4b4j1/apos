# Découverte de l'appareil

- Modèle : LG 43UR74006LB (fourni par l'utilisateur, à confirmer par `collect-info.sh`)
- webOS : 10.3.2 (fourni par l'utilisateur)
- Méthode de root : « slopbro », via repo.webosbrew.org (fourni par l'utilisateur ; ce nom n'apparaît pas dans le guide webosbrew.org/rooting, à vérifier sur https://canirootmytv.com ou rootmy.tv avant toute manipulation)
- Version de l'outil root : à relever
- Version du firmware exacte (« Version du logiciel », à relever sur la TV) : à comparer à 13.40.90
- DNS local sur le routeur : inconnu (à vérifier)
- Enfants mineurs concernés : non

## Sources webosbrew.org consultées
- /rooting : méthodes et versions ; la liste ne couvre pas explicitement webOS 10.x.
- /develop/guides/with-root : root optionnel ; les scripts de démarrage vivent dans `/var/lib/webosbrew/init.d` (exécutés par `run-parts`).
- /develop/guides/system-mods : les partitions système sont des squashfs signés en lecture seule ; on remplace des fichiers par `mount --bind` ou on superpose un répertoire par `mount -t overlay`, et un script de démarrage refait les montages à chaque boot.
- /develop/guides/startup-script : mode failsafe (telnet root sans mot de passe pendant un boot en échec) ; `chmod +x` requis ; préfixe à deux chiffres pour l'ordre.

## Relevé SSH (2026-11-12, lecture seule)
- Accès : `ssh -i ~/.ssh/tv_apos root@192.168.1.28` (clé ed25519, sans mot de passe). Le mot de passe par défaut `alpine` est désactivé dès que `/home/root/.ssh/authorized_keys` existe.
- OS : `webOS TV 10.3.2` (ID `starfish`).
- Système de fichiers : `/` est un squashfs en lecture seule ; `/var` est un ext4 en lecture-écriture (`/dev/mmcblk0p53`). Confirme que `mv` dans `/usr/palm/services` n'est pas possible : il faut un system mod.
- `/var/lib/webosbrew/init.d` existe et est vide.
- Services Luna candidats à traiter (non décidé, à valider avec l'utilisateur) : `com.webos.service.acr` (reconnaissance automatique de contenu), `com.webos.service.admanager`, `com.webos.service.adoverlay`, `com.webos.service.familycare`, `com.webos.service.iotclient`, `com.webos.service.sportsalert`, `com.webos.service.tvstorepolicy`, `com.webos.service.hbbtv.serviceendpoints`, `com.webos.service.lsa`, `com.webos.service.billing`, `com.webos.service.google.signin`, `com.webos.service.universalqcard`, `com.webos.service.homeconnect`, `com.webos.service.matter`.
- Applications préinstallées : beaucoup de services de streaming (Netflix, Amazon, Disney+, Molotov, Pluto TV, Twitch, etc.) ; leur désactivation est une décision à part.
- Version de firmware exacte : non relevée (la commande `luna-send` n'a rien renvoyé).
