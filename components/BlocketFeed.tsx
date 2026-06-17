"use client";

import { useEffect } from "react";

// Officiellt Bytbil/Blocket Accesspaket-flöde för HM Motor.
// Laddar Blockets widget och renderar den i #tfap-root.
const BASE_URL = "https://hmmotor.accesspaket.bytbilcms.com/";
const REST_URL = BASE_URL + "wp-json/accesspackage/v1";
const BUILD_URL = BASE_URL + "app/mu-plugins/triggerfish-bytbil-accesspaket/frontend/build/";

// postId pekar på en sparad vy i Blockets WP-admin ("Sidor"). Den configen ligger
// på endpoints (/page/:id, /posts/:id) som INTE är CORS-öppna → en extern sajt som
// hmmotor.se kan inte läsa dem, och widgeten fastnar då på "Laddar...".
// Default = ingen postId → hela feeden (/cars, CORS-öppen). Widgeten har egna filter.
export function BlocketFeed({ postId }: { postId?: number }) {
  useEffect(() => {
    // Blockets widget läser dessa som GLOBALER (window.*). Originalsnutten deklarerar
    // dem på toppnivå i en inline-<script>; här sätter vi dem explicit på window
    // INNAN widget-scripten laddas — annars fastnar filtren på "Laddar...".
    const w = window as unknown as Record<string, unknown>;
    w.baseUrl = BASE_URL;
    w.restUrl = REST_URL;
    w.buildUrl = BUILD_URL;
    // Sätt bara postId om den uttryckligen angetts (annars visas hela lagret).
    if (postId && postId > 0) {
      w.postId = postId;
    }

    const getJSON = (url: string, cb: (json: { entrypoints: Record<string, string> }) => void) => {
      const xhr = new XMLHttpRequest();
      xhr.open("GET", url, true);
      xhr.onload = () => {
        if (xhr.status !== 200) return;
        cb(JSON.parse(xhr.response));
      };
      xhr.send();
    };

    getJSON(BUILD_URL + "asset-manifest.json?siteUrl=" + REST_URL, (json) => {
      Object.values(json.entrypoints || {}).forEach((file) => {
        if (!file) return;
        if (file.indexOf(".css") !== -1) {
          const href = BUILD_URL + file;
          // Ladda inte in samma CSS två gånger vid client-side-navigering.
          if (document.querySelector(`link[href="${href}"]`)) return;
          const link = document.createElement("link");
          link.rel = "stylesheet";
          link.type = "text/css";
          link.href = href;
          document.head.appendChild(link);
        } else {
          // JS appendas på nytt vid varje mount så widgeten initierar om i den nya noden.
          const script = document.createElement("script");
          script.src = BUILD_URL + file;
          script.type = "text/javascript";
          document.head.appendChild(script);
        }
      });
    });
  }, [postId]);

  return (
    <div className="max-w-[1320px] mx-auto px-6 py-10">
      <div id="tfap-root" className="tfap-app" />
    </div>
  );
}
