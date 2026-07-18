"use client";

// Fas B — per-kanal-förhandsvisning i enhetsramar (som GHL). Visar SAMMA renderade
// Studio-bild men med kanalens egen caption, dess trunkering ("…mer"/"…se mer") och
// plattformens egen grafik/färg, så det syns direkt vilken del som är IG/FB/LI.
import { Heart, MessageCircle, Send, Bookmark, ThumbsUp, Repeat2, Globe } from "lucide-react";
import { FORMAT_DIMENSIONS, type StudioFormat } from "@/lib/studio/payload";

export type ChannelKey = "ig" | "fb" | "li";

// ── Brand-glyfer (lucide slutade exportera dem) — små inline-SVG:er ──
export function IgIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="2" y="2" width="20" height="20" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}
export function FbIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M13.5 22v-8h2.7l.4-3.1h-3.1V8.9c0-.9.25-1.5 1.55-1.5H17V4.6c-.3-.04-1.3-.13-2.46-.13-2.44 0-4.1 1.49-4.1 4.22v2.35H7.7V14h2.74v8h3.06z" />
    </svg>
  );
}
export function LiIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.55V9h3.57v11.45zM22.22 0H1.77C.8 0 0 .78 0 1.75v20.5C0 23.22.8 24 1.77 24h20.45c.98 0 1.78-.78 1.78-1.75V1.75C24 .78 23.2 0 22.22 0z" />
    </svg>
  );
}

// EN källa för kanalernas grafiska identitet (rubrik, chip, textetikett + ramaccent).
export const CHANNEL_BRAND: Record<ChannelKey, { label: string; color: string; gradient: string; Icon: (p: { className?: string }) => React.JSX.Element }> = {
  ig: { label: "Instagram", color: "#DD2A7B", gradient: "linear-gradient(135deg,#FEDA75 0%,#FA7E1E 25%,#D62976 55%,#962FBF 80%,#4F5BD5 100%)", Icon: IgIcon },
  fb: { label: "Facebook", color: "#1877F2", gradient: "linear-gradient(135deg,#1877F2,#0a5fd0)", Icon: FbIcon },
  li: { label: "LinkedIn", color: "#0A66C2", gradient: "linear-gradient(135deg,#0A66C2,#004182)", Icon: LiIcon },
};

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
  const brand = CHANNEL_BRAND[channel];
  const { Icon } = brand;

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

  const EmptyCaption = <span className="text-[13px] text-gray-400 italic">Ingen bildtext än</span>;

  // Plattforms-rubrik ovanför ramen — logga i brandfärg + namn. Gör det glasklart vilken kanal.
  const Header = (
    <div className="flex items-center gap-2">
      <span className="w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-sm" style={{ background: brand.gradient }}>
        <Icon className="w-[18px] h-[18px]" />
      </span>
      <span className="text-sm font-bold tracking-tight" style={{ color: brand.color }}>{brand.label}</span>
      <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full" style={{ background: `${brand.color}14`, color: brand.color }}>
        Förhandsvisning
      </span>
    </div>
  );

  // Kortram med brandfärgad topp-accent + tonad kant.
  function Card({ children }: { children: React.ReactNode }) {
    return (
      <div className="rounded-2xl bg-white overflow-hidden shadow-sm border" style={{ width: MW, borderColor: `${brand.color}33` }}>
        <div style={{ height: 3, background: brand.gradient }} />
        {children}
      </div>
    );
  }

  let card: React.JSX.Element;

  // ── Instagram: bild överst, ikon-rad, caption "handle text …mer" ──
  if (channel === "ig") {
    card = (
      <Card>
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
            {caption.trim() ? CaptionText : EmptyCaption}
          </div>
        </div>
      </Card>
    );
  } else if (channel === "fb") {
    // ── Facebook: header, caption ÖVER bilden, reaktionsrad ──
    card = (
      <Card>
        <div className="flex items-center gap-2 px-3 py-2.5">
          {Avatar}
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-gray-900 truncate">{clientName}</div>
            <div className="text-[11px] text-gray-400 flex items-center gap-1">Nyss · <Globe className="w-3 h-3" /></div>
          </div>
        </div>
        <div className="px-3 pb-2.5">{caption.trim() ? CaptionText : EmptyCaption}</div>
        {Media}
        <div className="flex items-center justify-around px-3 py-2 text-gray-500 text-[13px] border-t border-gray-100 mt-0.5">
          <span className="flex items-center gap-1.5"><ThumbsUp className="w-[18px] h-[18px]" /> Gilla</span>
          <span className="flex items-center gap-1.5"><MessageCircle className="w-[18px] h-[18px]" /> Kommentera</span>
          <span className="flex items-center gap-1.5"><Send className="w-[18px] h-[18px]" /> Dela</span>
        </div>
      </Card>
    );
  } else {
    // ── LinkedIn: header med namn+roll, caption med "…se mer"-veck, bild under ──
    card = (
      <Card>
        <div className="flex items-center gap-2 px-3 py-2.5">
          {Avatar}
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-gray-900 truncate">{clientName}</div>
            <div className="text-[11px] text-gray-400 truncate">Företagssida · Nyss</div>
          </div>
        </div>
        <div className="px-3 pb-2.5">{caption.trim() ? CaptionText : EmptyCaption}</div>
        {Media}
        <div className="flex items-center justify-around px-3 py-2 text-gray-500 text-[13px] border-t border-gray-100 mt-0.5">
          <span className="flex items-center gap-1.5"><ThumbsUp className="w-[18px] h-[18px]" /> Gilla</span>
          <span className="flex items-center gap-1.5"><MessageCircle className="w-[18px] h-[18px]" /> Kommentera</span>
          <span className="flex items-center gap-1.5"><Repeat2 className="w-[18px] h-[18px]" /> Dela</span>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-2.5" style={{ width: MW }}>
      {Header}
      {card}
    </div>
  );
}
