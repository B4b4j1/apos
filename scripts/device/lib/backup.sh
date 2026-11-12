#!/usr/bin/env bash
backup_remote() {  # $1 = hôte, $2 = dossier de sauvegarde local
  local host="$1" dest="$2"
  mkdir -p "$dest"
  ssh "root@${host}" 'tar -C / -czf - etc/hosts usr/palm/services 2>/dev/null' > "$dest/device-backup.tar.gz"
  echo "backup -> $dest/device-backup.tar.gz"
}
