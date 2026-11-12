# Restauration et récupération

## Revenir en arrière
1. Services LG : `bash scripts/device/restore-telemetry.sh backups/<horodatage> <ip-tv>`
2. Launcher : `bash scripts/device/restore-launcher.sh <ip-tv>` puis redémarrer la TV.
3. DNS : retirer la TV de la configuration DHCP du résolveur local.

## En cas d'écran noir
La méthode exacte dépend de la méthode de root relevée dans `docs/discovery.md` (Tâche 0). Consulter la documentation de la communauté webosbrew pour votre modèle. Une sauvegarde `device-backup.tar.gz` se trouve dans `backups/`.

## Mise à jour du firmware LG
Une mise à jour peut réactiver les services de collecte ou retirer le launcher. Après chaque mise à jour, lancer `bash scripts/device/verify-telemetry.sh <ip-tv>` et relancer `disable-telemetry.sh` si nécessaire.
