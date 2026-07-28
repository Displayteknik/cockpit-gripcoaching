"use client";

import "../render/studio-fonts.css";
import { useEffect, useState } from "react";
import { renderReel, NEUTRAL_BRAND, type RenderBrand } from "@/lib/studio/reel-render";
import type { ReelStoryboard } from "@/lib/studio/reels";

// Naken renderyta, samma princip som /studio/render/[templateId]: ingen Cockpit-chrome,
// ingen dataåtkomst, ingen inloggning. ALLT kommer in via ?p=<base64-JSON>, och bilderna
// är publika URL:er. Ytan används av Playwright för att bevisa att renderingen ger en
// spelbar mp4 utan att någon behöver sitta och klicka.
//
// WebCodecs kräver säker kontext, så den här sidan fungerar bara över https eller localhost.

declare global {
  interface Window {
    __reelKlar?: boolean;
    __reelFel?: string;
    __reelBas64?: string;
    __reelBytes?: number;
  }
}

export default function ReelRenderPage() {
  const [status, setStatus] = useState("startar");
  const [progress, setProgress] = useState(0);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const p = new URLSearchParams(window.location.search).get("p");
        if (!p) throw new Error("Ingen payload (?p=)");
        const json = JSON.parse(decodeURIComponent(escape(atob(p)))) as {
          storyboard: ReelStoryboard;
          brand?: RenderBrand;
        };

        setStatus("renderar");
        const blob = await renderReel(json.storyboard, json.brand || NEUTRAL_BRAND, (v) => setProgress(v));

        const buf = new Uint8Array(await blob.arrayBuffer());
        let bin = "";
        for (let i = 0; i < buf.length; i += 8192) {
          bin += String.fromCharCode(...buf.subarray(i, i + 8192));
        }
        window.__reelBas64 = btoa(bin);
        window.__reelBytes = buf.length;
        window.__reelKlar = true;
        setUrl(URL.createObjectURL(blob));
        setStatus("klar");
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        window.__reelFel = msg;
        window.__reelKlar = true;
        setStatus(`fel: ${msg}`);
      }
    })();
  }, []);

  return (
    <div style={{ fontFamily: "Inter, sans-serif", padding: 24 }}>
      <div id="reel-status" data-status={status}>
        {status} {progress > 0 && status === "renderar" ? `${Math.round(progress * 100)} %` : ""}
      </div>
      {url && (
        <video id="reel-video" src={url} controls playsInline style={{ width: 270, marginTop: 16, background: "#000" }} />
      )}
    </div>
  );
}
