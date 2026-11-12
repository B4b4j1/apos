export async function hashPin(pin, salt) {
  if (!/^\d{4}$/.test(pin)) throw new Error("Le code doit comporter 4 chiffres");
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}

export async function checkPin(pin, salt, expectedHash) {
  try { return (await hashPin(pin, salt)) === expectedHash; }
  catch { return false; }
}

export function isAppAllowed(id, allowlist) {
  return allowlist.includes(id);
}
