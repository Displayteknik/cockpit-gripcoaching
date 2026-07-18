"use client";

// Fas B — per-kanal-förhandsvisning i enhetsramar (som GHL). Visar SAMMA renderade
// Studio-bild men med kanalens egen caption och dess trunkering ("…mer"/"…se mer"),
// så kunden ser exakt hur inlägget möter läsaren på varje plattform.
import { Heart, MessageCircle, Send, Bookmark, ThumbsUp, Repeat2, Globe } from "lucide-react";
import { FORMAT_DIMENSIONS, type StudioFormat } from "@/lib/studio/payload";

export type ChannelKey = "ig" | "fb" | "li";

// Var texten viks ihop på respektive plattform (ungefärligt, matchar hur flödet klipper).
const FOLD: Record<ChannelKey, number> = { ig: 110, fb: 220, li: 140 };
const MORE: Record<ChannelKey, string> = { ig: "… mer", fb: "Se mer", li: "…se mer" };

// Klipp captionen där plattformen viker den: vid dubbel radbrytning eller teckengräns,
// helst vid ett ordslut så inget ord kapas mitt itu.
function foldCaption(text: string, k: ChannelKey): { shown: string; more: boolean } {
  const t = (text || "").replace(/\r/g, "").trim();
  if (!t) return { shown: "", more: false };
  const limit = FOLD[k];
  const para = t.indexOf("\n\n");
  let cut = para >= 0 && para < limit ? para : limit;
  if (t.length <= cut && (para < 0 || para >= limit)) return { shown: t, more: false };
  let s = t.slice(0, cut);
  const sp = s.lastIndexOf(" ");
  if (sp > 60) s = s.slice(0, sp);
  return { shown: s.trim(), more: true };
}

function initials(name: string): string {
  return (name || "?").trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

interface Props {
  channel: ChannelKey;
  renderSrc: string; // /studio/render/<templateId>?p=<encoded>
  format: StudioFormat;
  caption: string;
  clientName: string;
  handle?: string | null;
  primary: string;
  mediaWidth?: number;
}

export default function ChannelPreview({ channel, renderSrc, format, caption, clientName, handle, primary, mediaWidth = 264 }: Props) {
  const { w, h } = FORMAT_DIMENSIONS[format] ?? FORMAT_DIMENSIONS["1080x1350"];
  const MW = mediaWidth;
  const MH = Math.round((MW * h) / w);
  const fold = foldCaption(caption, channel);
  const at = handle ? `@${handle.replace(/^@/, "")}` : "";

  const Media = (
    <div className="overflow-hidden bg-gray-100" style={{ width: MW, height: MH }}>
      <iframe title={`${channel}-preview`} scrolling="no" src={renderSrc}
        style={{ width: w, height: h, border: 0, transform: `scale(${MW / w})`, transformOrigin: "top left", pointerEvents: "none" }} />
    </div>
  );

  const Avatar = (
    <span className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0" style={{ background: primary }}>
      {initials(clientName)}
    </span>
  );

  const CaptionText = (
    <span className="text-[13px] leading-snug text-gray-800">
      {fold.shown}
      {fold.more && <span className="text-gray-400"> {MORE[channel]}</span>}
    </span>
  );

  // ── Instagram: bild överst, ikon-rad, caption "handle text …mer" ──
  if (channel === "ig") {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm" style={{ width: MW }}>
        <div className="flex items-center gap-2 px-3 py-2.5">
          {Avatar}
          <span className="text-[13px] font-semibold text-gray-900 truncate">{at || clientName}</span>
          <span className="ml-auto text-gray-400 text-lg leading-none">⋯</span>
        </div>
        {Media}
        <div className="px-3 pt-2.5 pb-3 space-y-2">
          <div className="flex items-center gap-4 text-gray-800">
            <Heart className="w-[22px] h-[22px]" />
            <MessageCircle className="w-[22px] h-[22px]" />
            <Send className="w-[22px] h-[22px]" />
            <Bookmark className="w-[22px] h-[22px] ml-auto" />
          </div>
          <div>
            <span className="text-[13px] font-semibold text-gray-900 mr-1.5">{at ? at.replace("@", "") : clientName}</span>
            {caption.trim() ? CaptionText : <span className="text-[13px] text-gray-400 italic">Ingen bildtext än</span>}
          </div>
        </div>
      </div>
    );
  }

  // ── Facebook: header, caption ÖVER bilden, reaktionsrad ──
  if (channel === "fb") {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm" style={{ width: MW }}>
        <div className="flex items-center gap-2 px-3 py-2.5">
          {Avatar}
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-gray-900 truncate">{clientName}</div>
            <div className="text-[11px] text-gray-400 flex items-center gap-1">Nyss · <Globe className="w-3 h-3" /></div>
          </div>
        </div>
        <div className="px-3 pb-2.5">
          {caption.trim() ? CaptionText : <span className="text-[13px] text-gray-400 italic">Ingen bildtext än</span>}
        </div>
        {Media}
        <div className="flex items-center justify-around px-3 py-2 text-gray-500 text-[13px] border-t border-gray-100 mt-0.5">
          <span className="flex items-center gap-1.5"><ThumbsUp className="w-[18px] h-[18px]" /> Gilla</span>
          <span className="flex items-center gap-1.5"><MessageCircle className="w-[18px] h-[18px]" /> Kommentera</span>
          <span className="flex items-center gap-1.5"><Send className="w-[18px] h-[18px]" /> Dela</span>
        </div>
      </div>
    );
  }

  // ── LinkedIn: header med namn+roll, caption med "…se mer"-veck, bild under ──
  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm" style={{ width: MW }}>
      <div className="flex items-center gap-2 px-3 py-2.5">
        {Avatar}
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-gray-900 truncate">{clientName}</div>
          <div className="text-[11px] text-gray-400 truncate">Företagssida · Nyss</div>
        </div>
      </div>
      <div className="px-3 pb-2.5">
        {caption.trim() ? CaptionText : <span className="text-[13px] text-gray-400 italic">Ingen bildtext än</span>}
      </div>
      {Media}
      <div className="flex items-center justify-around px-3 py-2 text-gray-500 text-[13px] border-t border-gray-100 mt-0.5">
        <span className="flex items-center gap-1.5"><ThumbsUp className="w-[18px] h-[18px]" /> Gilla</span>
        <span className="flex items-center gap-1.5"><MessageCircle className="w-[18px] h-[18px]" /> Kommentera</span>
        <span className="flex items-center gap-1.5"><Repeat2 className="w-[18px] h-[18px]" /> Dela</span>
      </div>
    </div>
  );
}
