#!/bin/sh
# ApOS : mesure du temps d'écran. Toutes les APOS_INTERVAL secondes, si la TV est allumée (état « Active »),
# ajoute l'app au premier plan à data/usage-AAAA-MM-JJ.log (une ligne « HH:MM:SS idApp » par mesure).
# Les journaux des jours passés sont résumés en usage-AAAA-MM-JJ.tsv (idApp<TAB>secondes) puis supprimés.
# Aucune donnée ne quitte la TV. APOS_ONCE=1 : une seule mesure (tests).
DIR="${APOS_DATA:-/media/developer/apps/usr/palm/applications/com.apos.launcher/data}"
INTERVAL="${APOS_INTERVAL:-10}"

mkdir -p "$DIR"
echo "{\"interval\":$INTERVAL}" > "$DIR/meta.json"

# luna-send doit lire un stdin redirigé, sinon il ne répond pas dans une session sans terminal.
power_state() {
    luna-send -n 1 luna://com.webos.service.tvpower/power/getPowerState '{}' </dev/null 2>/dev/null \
        | sed -n 's/.*"state": *"\([^"]*\)".*/\1/p' | head -n 1
}

foreground_app() {
    luna-send -n 1 luna://com.webos.applicationManager/getForegroundAppInfo '{}' </dev/null 2>/dev/null \
        | sed -n 's/.*"appId": *"\([^"]*\)".*/\1/p' | head -n 1
}

compact_old_days() {
    today="$1"
    for f in "$DIR"/usage-*.log; do
        [ -e "$f" ] || continue
        case "$f" in *"usage-$today.log") continue ;; esac
        day="${f##*usage-}"
        day="${day%.log}"
        awk -v iv="$INTERVAL" '{ c[$2]++ } END { for (k in c) print k "\t" c[k] * iv }' "$f" > "$DIR/usage-$day.tsv" && rm -f "$f"
    done
    # on garde 90 jours de résumés
    find "$DIR" -name 'usage-*.tsv' -mtime +90 -exec rm -f {} \; 2>/dev/null
}

last_day=""
while true; do
    today="$(date +%Y-%m-%d)"
    if [ "$today" != "$last_day" ]; then
        compact_old_days "$today"
        last_day="$today"
    fi
    if [ "$(power_state)" = "Active" ]; then
        app="$(foreground_app)"
        [ -n "$app" ] && echo "$(date +%H:%M:%S) $app" >> "$DIR/usage-$today.log"
    fi
    [ -n "$APOS_ONCE" ] && exit 0
    sleep "$INTERVAL"
done
