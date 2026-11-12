#!/usr/bin/env bash
# Copie, sur la TV, les éléments personnels de l'app installée vers /var/lib/webosbrew/apos (copie persistante).
set -euo pipefail
HOST="${1:?usage: persist-assets.sh <ip-tv>}"
APP=/media/developer/apps/usr/palm/applications/com.apos.launcher
PERSIST=/var/lib/webosbrew/apos
# shellcheck disable=SC2206
SSH_OPTS=(-o BatchMode=yes ${APOS_SSH_OPTS:-})
ssh "${SSH_OPTS[@]}" "root@${HOST}" "mkdir -p $PERSIST/assets $PERSIST/config && \
  { [ -d $APP/assets/wallpapers ] && rm -rf $PERSIST/assets/wallpapers && cp -r $APP/assets/wallpapers $PERSIST/assets/; \
    [ -d $APP/assets/icons ] && rm -rf $PERSIST/assets/icons && cp -r $APP/assets/icons $PERSIST/assets/; \
    [ -f $APP/config/launchpoints.json ] && cp $APP/config/launchpoints.json $PERSIST/config/; true; } && \
  du -sh $PERSIST | sed 's/^/copie persistante : /'"
