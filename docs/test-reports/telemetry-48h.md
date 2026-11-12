# Test : absence de télémétrie sur 48 h

Statut : NON EXÉCUTÉ (nécessite 48 h de journal DNS réel et le résolveur déployé).

Procédure : `python tools/audit/summarize_dns.py <journal> --client <ip-tv>` puis `bash scripts/net/verify-dns-block.sh <ip-resolveur>`. Attendu : aucun domaine « bloquer » ne reçoit une autre réponse que `0.0.0.0`.
