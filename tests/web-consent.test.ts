import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { webTrackerScript } from "../lib/web-tracker";
function browser(cookie = "", type = "optin", forced = 0) {
  const events = new Map<string, ((e: unknown) => void)[]>();
  const requests: { kind: string; target: string | null }[] = [];
  const storage = new Map<string, string>();
  class Element {
    dataset: Record<string, string> = {};
    closest() {
      return this;
    }
  }
  class HTMLAnchorElement extends Element {
    href = "https://www.instagram.com/novogen.temuco";
  }
  const window = {
    complianz: { consenttype: type, forceEnableStats: forced },
    cmplz_get_cookie: () => cookie,
    cmplz_has_consent: () => cookie === "allow" || type === "optout",
    addEventListener() {},
    CONNECTMetrics: undefined as unknown as { setConsent(v: boolean): void },
  };
  const doc = {
    currentScript: {
      src: "https://connect.example/web-tracker.js",
      dataset: { slug: "novogen", consent: "complianz" },
    },
    addEventListener(name: string, fn: (e: unknown) => void) {
      events.set(name, [...(events.get(name) ?? []), fn]);
    },
  };
  vm.runInNewContext(webTrackerScript, {
    window,
    document: doc,
    URL,
    Element,
    HTMLAnchorElement,
    crypto: { randomUUID: () => crypto.randomUUID() },
    sessionStorage: {
      getItem: (key: string) => storage.get(key),
      setItem: (k: string, v: string) => storage.set(k, v),
    },
    fetch: (_u: string, options: { body: string }) => {
      requests.push(JSON.parse(options.body));
      return Promise.resolve({});
    },
  });
  return {
    requests,
    storage,
    window,
    setCookie(v: string) {
      cookie = v;
    },
    dispatch(name: string) {
      for (const f of events.get(name) ?? []) f({});
    },
    click() {
      for (const f of events.get("click") ?? [])
        f({ target: new HTMLAnchorElement() });
    },
  };
}
test("Complianz opt-in: no identifiers or events before acceptance; revoke stops clicks", () => {
  const b = browser();
  b.click();
  b.window.CONNECTMetrics.setConsent(true);
  assert.equal(b.requests.length, 0);
  assert.equal(b.storage.size, 0);
  b.setCookie("allow");
  b.dispatch("cmplz_status_change");
  assert.equal(b.requests.length, 1);
  assert.equal(b.requests[0].kind, "page_view");
  b.click();
  assert.equal(b.requests[1].kind, "instagram_click");
  b.setCookie("deny");
  b.dispatch("cmplz_status_change");
  b.click();
  assert.equal(b.requests.length, 2);
});
test("saved acceptance resumes and cookie expiry stops without a CMP event", () => {
  const b = browser("allow");
  assert.equal(b.requests.length, 1);
  b.setCookie("");
  b.click();
  assert.equal(b.requests.length, 1);
});
test("opt-out defaults and forced statistics never activate the integration", () => {
  for (const [cookie, type, forced] of [
    ["", "optout", 0],
    ["allow", "optout", 0],
    ["allow", "optin", 1],
  ] as const) {
    const b = browser(cookie, type, forced);
    b.dispatch("cmplz_status_change");
    b.click();
    b.window.CONNECTMetrics.setConsent(true);
    assert.equal(b.requests.length, 0);
    assert.equal(b.storage.size, 0);
  }
});
