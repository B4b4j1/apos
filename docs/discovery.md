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
