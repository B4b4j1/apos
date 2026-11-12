// Client de l'API locale du service de temps d'écran (127.0.0.1:8742, réservée à la TV).
export const API_BASE = "http://127.0.0.1:8742";

export function createApi(base, fetchFn) {
  const doFetch = fetchFn || ((url, opts) => fetch(url, opts));
  return {
    state() {
      return doFetch(base + "/state", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
    },
    post(path, body) {
      return doFetch(base + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        .then((r) => r.json().then((json) => ({ status: r.status, body: json }), () => ({ status: r.status, body: {} })))
        .catch(() => ({ status: 0, body: {} }));
    },
  };
}
