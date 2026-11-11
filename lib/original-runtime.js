// Runs in the recovered interface. No page text, URLs or contact fields enter metrics.
export function initializeOriginal(config) {
  const key = "connect-metrics-" + config.slug;
  let session,
    choice = null;
  try {
    choice = localStorage.getItem(key);
  } catch {}
  const routes = new Map();
  config.catalogue.forEach((s) => {
    routes.set(s.route, s);
    if (s.type === "service") {
      routes.set("/servicios/" + s.legacyGroup + "/" + s.id, s);
      if (s.sourceId)
        routes.set("/servicios/" + s.legacyGroup + "/" + s.sourceId, s);
    }
  });
  const currentNode = () =>
    routes.get(location.hash.slice(1).split("?")[0]) || null;
  const currentService = () => {
    const node = currentNode();
    return node?.type === "service" ? node.id : null;
  };
  function send(kind, target = null, service = null, preference = null) {
    if (choice !== "yes" || config.demo) return;
    try {
      if (!session) {
        const k = "connect-session-" + config.slug;
        session = sessionStorage.getItem(k) || crypto.randomUUID();
        sessionStorage.setItem(k, session);
      }
      const payload = {
        slug: config.slug,
        id: crypto.randomUUID(),
        session,
        kind,
        target,
        service,
        preference,
        point: config.point,
        consent: true,
      };
      const body = JSON.stringify(payload);
      if (
        !navigator.sendBeacon ||
        !navigator.sendBeacon(
          "/api/interactions",
          new Blob([body], { type: "application/json" }),
        )
      )
        void fetch("/api/interactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        }).catch(() => {});
    } catch {}
  }
  let lastRoute = null;
  function page() {
    if (choice !== "yes") return;
    const route = location.hash || "#/";
    if (route === lastRoute) return;
    lastRoute = route;
    send("page_view");
    const node = currentNode();
    if (node?.type === "service") send("service_view", "service_info", node.id);
    else if (node?.type === "group")
      send("preference_view", "preference_info", null, node.id);
  }
  function click(event) {
    const control =
      event.target instanceof Element ? event.target.closest("a,button") : null;
    if (
      !control ||
      control.closest("[data-connect-privacy]") ||
      control.closest("[data-connect-contact]") ||
      control.closest("[data-connect-private]") ||
      control.disabled ||
      control.getAttribute("aria-disabled") === "true"
    )
      return;
    const href = control.getAttribute("href");
    const id = currentService();
    const node = currentNode();
    const preference = node?.type === "group" ? node.id : null;
    if (control.hasAttribute("data-connect-request")) {
      send("contact_started", "service_contact", id);
      return;
    }
    if (control.dataset.connectTarget === "store") {
      send("button_click", "store", id);
      return;
    }
    const channels = [
      ["agenda", "agenda_url"],
      ["instagram", "instagram_url"],
      ["tiktok", "tiktok_url"],
      ["youtube", "youtube_url"],
      ["whatsapp", "whatsapp_url"],
      ["website", "website_url"],
    ];
    for (const [target, field] of channels)
      if (href && config.channels[field] && href === config.channels[field]) {
        send(target + "_click", target, id, preference);
        return;
      }
    if (href && href.startsWith("mailto:")) {
      send("email_click", "email", id);
      return;
    }
    if (href && href.startsWith("#/")) {
      const path = href.slice(1).split("?")[0];
      if (routes.has(path)) return;
      const target =
        path === "/orientame"
          ? "orientame"
          : path.startsWith("/servicios")
            ? "services"
            : path.startsWith("/promos")
              ? "promos"
              : "navigation";
      send("button_click", target, id, preference);
      return;
    }
    const label = control.getAttribute("aria-label") || "";
    const close =
      /cerrar/i.test(label) || control.classList.contains("hoja__cerrar");
    const install = label === "Crear App";
    send(
      "button_click",
      install ? "install_app" : close ? "detail_close" : "detail_open",
      id,
      preference,
    );
  }
  document.addEventListener("click", click, true);
  document.addEventListener(
    "auxclick",
    (e) => {
      if (e.button === 1) click(e);
    },
    true,
  );
  window.addEventListener("hashchange", page);
  window.addEventListener("popstate", page);
  // React Router changes hash routes with history.pushState, which emits no hashchange.
  const observedRoot = document.getElementById("root");
  if (observedRoot)
    new MutationObserver(page).observe(observedRoot, {
      subtree: true,
      childList: true,
    });
  const host = document.createElement("aside");
  host.dataset.connectPrivacy = "";
  host.setAttribute("aria-label", "Preferencias de métricas");
  const style = document.createElement("style");
  style.textContent =
    "[data-connect-privacy]{position:fixed;z-index:30;left:12px;right:12px;bottom:calc(75px + env(safe-area-inset-bottom,0px));max-width:440px;margin:auto;background:#041a37f5;border:1px solid #3d799b;border-radius:16px;padding:15px;color:#dbeeff;font:12px/1.6 Montserrat,Arial,sans-serif;box-shadow:0 8px 30px #0008}[data-connect-privacy] p{margin:0 0 10px}[data-connect-privacy] button{min-height:44px;border:1px solid #4484a3;border-radius:9px;background:#0a3157;color:white;padding:8px 12px;margin-right:8px;font:inherit}[data-connect-privacy].privacy-small{left:auto;right:10px;bottom:calc(72px + env(safe-area-inset-bottom,0px));padding:0;border:0;background:transparent;box-shadow:none}[data-connect-privacy].privacy-small button{font-size:10px;background:#071b36}";
  document.head.append(style);
  function choose(value) {
    choice = value;
    try {
      localStorage.setItem(key, value);
    } catch {
      choice = "no";
    }
    draw();
    if (choice === "yes") {
      lastRoute = null;
      page();
    }
  }
  function draw() {
    host.replaceChildren();
    host.classList.toggle("privacy-small", choice !== null);
    if (choice === null) {
      const p = document.createElement("p");
      p.textContent =
        "¿Permites medir visitas y clics de CONNECT? No registramos nombres, correos ni información clínica.";
      host.append(p);
      for (const [text, val] of [
        ["Permitir métricas", "yes"],
        ["Solo lo necesario", "no"],
      ]) {
        const b = document.createElement("button");
        b.textContent = text;
        b.onclick = () => choose(val);
        host.append(b);
      }
    } else {
      const b = document.createElement("button");
      b.textContent = "Privacidad";
      b.onclick = () => {
        host.classList.remove("privacy-small");
        host.replaceChildren();
        const text = document.createElement("p");
        text.textContent =
          choice === "yes"
            ? "Métricas opcionales activadas."
            : "Métricas opcionales desactivadas.";
        host.append(text);
        const change = document.createElement("button");
        change.textContent =
          choice === "yes" ? "Desactivar métricas" : "Permitir métricas";
        change.onclick = () => choose(choice === "yes" ? "no" : "yes");
        const close = document.createElement("button");
        close.textContent = "Cerrar";
        close.onclick = draw;
        host.append(change, close);
      };
      host.append(b);
    }
  }
  document.body.append(host);
  draw();
  page();
}
