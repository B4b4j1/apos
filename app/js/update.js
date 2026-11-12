// Texte affiché pour l'état de la mise à jour (résultat de POST /update/check du service de temps d'écran).
export function updateSummary(update) {
  if (!update) return { value: "Jamais vérifié", available: false };
  if (update.error) return { value: update.error === "index invalide" ? "Réponse invalide" : "Dépôt injoignable", available: false };
  if (update.available) return { value: "Version " + update.latest + " disponible", available: true };
  return { value: "À jour", available: false };
}

export function installErrorMessage(status) {
  if (status === 0) return "Service injoignable.";
  if (status === 400) return "Installation impossible : vérifiez la connexion ou réessayez.";
  return "Échec de l'installation.";
}
