// Cockpit universal tracking pixel.
// Anvandning: <script src="https://cockpit.gripcoaching.se/pixel.js" async></script>
// Skickar minimal besokardata till /api/track. Klient-id resolvas server-side via hostname.
(function () {
  if (typeof window === "undefined") return;
  if (window.__cockpitPixelLoaded) return;
  window.__cockpitPixelLoaded = true;

  var ENDPOINT = "https://cockpit.gripcoaching.se/api/track";
  var SESSION_KEY = "ck_sid";
  var FIRST_SEEN_KEY = "ck_first";
  var LAST_PATH_KEY = "ck_last_path";

  function rid() {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
  function ss() {
    try {
      var id = sessionStorage.getItem(SESSION_KEY);
      if (!id) {
        id = rid();
        sessionStorage.setItem(SESSION_KEY, id);
      }
      return id;
    } catch (e) {
      return null;
    }
  }
  function isReturning() {
    try {
      var f = localStorage.getItem(FIRST_SEEN_KEY);
      if (!f) {
        localStorage.setItem(FIRST_SEEN_KEY, String(Date.now()));
        return false;
      }
      return true;
    } catch (e) {
      return null;
    }
  }
  function shouldSkip() {
    var ua = (navigator.userAgent || "").toLowerCase();
    if (/bot|crawl|spider|preview|lighthouse|pingdom|uptime/.test(ua)) return true;
    return false;
  }
  function strip(p) {
    if (!p) return "";
    return p.split("#")[0].slice(0, 500);
  }
  function send(path, extra) {
    if (shouldSkip()) return;
    var loadMs = null;
    try {
      var nav = performance.getEntriesByType("navigation")[0];
      if (nav && nav.loadEventEnd > 0) loadMs = Math.round(nav.loadEventEnd - nav.startTime);
    } catch (e) {}
    var body = {
      path: strip(path || location.pathname + location.search),
      referrer: document.referrer || null,
      session_id: ss(),
      is_returning: isReturning(),
      page_load_ms: loadMs,
      screen_w: window.innerWidth,
    };
    if (extra) for (var k in extra) body[k] = extra[k];
    try {
      // Foredra sendBeacon nar tillgangligt - storre chans att leverera vid pagehide
      if (navigator.sendBeacon) {
        var blob = new Blob([JSON.stringify(body)], { type: "application/json" });
        if (navigator.sendBeacon(ENDPOINT, blob)) return;
      }
      fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        keepalive: true,
      }).catch(function () {});
    } catch (e) {}
  }

  // Initial pageview
  function initial() {
    try {
      sessionStorage.setItem(LAST_PATH_KEY, location.pathname);
    } catch (e) {}
    send(location.pathname + location.search);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initial, { once: true });
  } else {
    initial();
  }

  // SPA-stod: lyssna pa pushState/replaceState/popstate
  var lastPath = location.pathname;
  function maybeTrack() {
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      send(location.pathname + location.search);
    }
  }
  ["pushState", "replaceState"].forEach(function (m) {
    var orig = history[m];
    history[m] = function () {
      var r = orig.apply(this, arguments);
      setTimeout(maybeTrack, 0);
      return r;
    };
  });
  window.addEventListener("popstate", maybeTrack);
})();
