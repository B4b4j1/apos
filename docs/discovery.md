# Découverte de l'appareil

- Modèle : LG 43UR74006LB (fourni par l'utilisateur, à confirmer par `collect-info.sh`)
- Version logicielle (Réglages, relevée par l'utilisateur) : 33.31.75 ; à comparer à la version rootable 13.40.90 de CanI.RootMy.TV. Vérification impossible depuis cet environnement : canirootmytv.com et canirootmy.tv ne se résolvent pas (ERR_NAME_NOT_RESOLVED), rootmy.tv ne propose que RootMyTV v1/v2, déclaré obsolète. Un accès root SSH existe déjà sur cette TV, donc le root est présent sur ce firmware ; le risque porte sur la persistance après une mise à jour LG.
- webOS : « webOS25 / 10.3.2-33 » (relevé sur l'écran Informations de la TV, 2026-11-12) ; stockage interne 0,71 / 1,44 Go disponibles. Les identifiants matériels (MAC, ESN, Widevine) ne sont pas consignés dans le dépôt.
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
- Version de firmware exacte : non relevée (la commande `luna-send` n'a rien renvoyé). Le numéro fourni par l'utilisateur (10.3.2-33) est une version webOS et ne correspond pas forcément au format « 13.40.90 » de CanI.RootMy.TV : à confirmer dans Réglages > Général > À propos de ce téléviseur (« Version du logiciel »).

## Tentative d'installation du launcher (2026-11-12)
- `ares-setup-device` : appareil `tv` enregistré (root@192.168.1.28:22, clé `openSsh: tv_apos`) ; `ares-device -i` répond (modèle 43UR74006LB, SDK 10.3.2, firmware 33.31.75).
- `ares-install --device tv dist/com.apos.launcher_0.1.0_all.ipk` échoue : « Unable to exec » (le serveur SSH refuse le canal d'exécution demandé par ares).
- `luna-send` lancé en SSH ne renvoie rien (pas de réponse, code 0) : le bus Luna n'est pas joignable depuis une session SSH root.
- Les apps déjà installées (`/media/developer/apps/usr/palm/applications/`) : org.webosbrew.hbchannel, org.webosbrew.appupdateblocker, tv.stremioorigin.app, youtube.leanback.v4, ooo.lew.lifesgoodwithoutspying.
- Le paquet copié dans `/media/developer/` pour un essai a été supprimé.
- Aucun changement durable sur la TV ; le launcher n'est pas installé.
- Essai via la méthode « Manual » du README Homebrew Channel (`luna-send-pub -i luna://com.webos.appInstallService/dev/install`, `ipkUrl` dans /tmp) : aucune réponse, aucune app installée. Le fichier temporaire a été supprimé.

## Réglages Homebrew Channel (captures utilisateur, 2026-11-12)
- webosbrew version 0.7.3 ; Root status : ok.
- Telnet : désactivé. SSH Server : activé. Block system updates : activé. Failsafe mode : désactivé.
- Dépôts : repo.webosbrew.org (défaut) et repo.webosbrew.org « Extra non-free software », tous deux activés. Bouton « Add repository » présent.
- Reboot requis après changement de configuration.
