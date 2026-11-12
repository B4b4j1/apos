// Appel d'un service Luna depuis une app web webOS (PalmServiceBridge). Aucun réseau.
export function lunaCall(uri, params, opts) {
  const options = opts || {};
  const Bridge = "bridge" in options ? options.bridge : (typeof window !== "undefined" ? window.PalmServiceBridge : undefined);
  const timeoutMs = options.timeoutMs || 5000;
  return new Promise((resolve, reject) => {
    if (!Bridge) { reject(new Error("no-bridge")); return; }
    const bridge = new Bridge();
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      try { if (bridge.cancel) bridge.cancel(); } catch (err) { /* ignore */ }
      reject(new Error("timeout"));
    }, timeoutMs);
    bridge.onservicecallback = (msg) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      let data;
      try { data = JSON.parse(msg); } catch (err) { reject(new Error("bad-json")); return; }
      if (data && data.returnValue === false) { reject(new Error(data.errorText || "luna-error")); return; }
      resolve(data);
    };
    bridge.call(uri, JSON.stringify(params || {}));
  });
}

export function launchApp(id, opts) {
  return lunaCall("luna://com.webos.applicationManager/launch", { id }, opts);
}
