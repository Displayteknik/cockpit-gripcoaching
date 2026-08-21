"use client";

import SmartTextarea from "@/components/SmartTextarea";
import { FunctionGuide } from "@/components/FunctionGuide";
import ProfilGrind from "@/components/profile/ProfilGrind";
import UtkastRad from "@/components/UtkastRad";
import { useUtkast } from "@/lib/studio/useUtkast";
import { CTA_VAG_ETIKETT } from "@/lib/cta-vagar";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@supabase/supabase-js";
import {
  Image as ImageIcon, Download, Upload, Loader2, Wand2, Star,
  Maximize2, Save, Check, Search, RefreshCw, Trash2, Copy, FolderOpen, Send,
  ExternalLink, CalendarClock, ClipboardCheck, X, Pencil, LayoutGrid, Sparkles,
  ThumbsUp, ThumbsDown, Crop, Expand,
} from "lucide-react";
import { TEMPLATE_META, templatesForClient, isRecommendedFormat, templateNeedsImage } from "@/lib/studio/templates-meta";
import type { StudioFormat, StudioOverrides, StudioSlide, LogoVariantVal, CustomSize } from "@/lib/studio/payload";
import { DEFAULT_OVERRIDES, FORMAT_LABELS, FORMAT_DIMENSIONS, isStoryFormat, emptySlide, MAX_SLIDES, derivePostType, punktNummer, STUDIO_FONTS, LOGO_VARIANT_LABELS, effectiveDims, CUSTOM_SIZE_PRESETS } from "@/lib/studio/payload";
import { fangaAllaSlides, slideFilnamn } from "@/lib/studio/export-slides";
// Ett svar som inte är JSON ska säga VAD som hände, inte visa parserns text. Se lib/las-json.
import { lasJson } from "@/lib/las-json";
import { slaIhopSlides } from "@/lib/studio/slide-merge";
import { laddaBitmap, renderImageEdit, normalizeImageEdit, type ImageEdit } from "@/lib/studio/image-edit";
import BildRedigerare from "@/components/studio/BildRedigerare";
import { profileForDate, type CompassSchedule, type FunnelLevel, type DiscLetter } from "@/lib/content-compass/data";
import { FUNNEL_LABEL_SV, FOURA_LABEL_SV, DISC_LABEL_SV } from "@/lib/content-compass/labels";
import type { FourA } from "@/lib/content-framework";
import type { StudioBrand } from "@/lib/studio/brand";
import StudioEditor, { type ImagePatch } from "@/components/studio/StudioEditor";
import ChannelPreview, { type ChannelKey, CHANNEL_BRAND } from "@/components/studio/ChannelPreview";
import { KANAL_NYCKLAR, KANAL_ANATOMI, arAnsluten, arUtgangen, synligaKanaler } from "@/lib/kanal-anatomi";
import ScheduleQueue from "@/components/studio/ScheduleQueue";
import { toBlob } from "html-to-image";

interface ClientInfo { id: string; name: string; slug: string; primary_color: string }
// KVALITET-3/2b: `beskrivning` byggs på servern (byggBeskrivning i lib/studio/copy.ts) —
// 1–2 fullständiga meningar. Valfri här: äldre sparade förslag saknar fältet, då faller
// listan tillbaka på headline2/body (utan det gamla kolonlimmet som gav "aktuell?:").
interface Suggestion { hookType: string; headline1: string; headline2: string; body: string; beskrivning?: string }
interface StudioPost { id: string; template_id: string; format: StudioFormat; title: string; image_url: string | null; payload: Record<string, unknown>; updated_at: string }
interface GhlAccount { id: string; name: string; platform: string; type: string; avatar?: string; isExpired?: boolean }

// KLARSPRÅK-1 (Håkans fynd 12/8): "jag läste ordet konträr någonstans och fattar inte ens
// vad det betyder". Nyckeln till vänster är DATA — den är vad AI-flödena skriver i sin JSON
// och vad `lib/hook-typer` slår upp på, så den får inte röras. Etiketten till höger är det
// enda användaren ser, och den ska gå att förstå utan att slå upp något.
const HOOK_LABEL: Record<string, string> = {
  "fråga": "Fråga", "statistik": "Siffra", "konträr": "Tvärtom",
  "berättelse": "Berättelse", "påstående": "Påstående",
};

const SLIDE_KIND_LABEL: Record<string, string> = { hook: "Krok", point: "Punkt", cta: "Avslut" };
// Hakans fynd 10/8: valde han 3 punkter fick han 7 slides, och editorn radade upp FEM
// chip markta "Punkt". Insatsen och beviset ar kind "point" i datan (mallarna ritar tre
// slide-typer) men de ar inte anvandarens punkter. Etiketten laser rollen nar den finns.
const SLIDE_ROLL_LABEL: Record<string, string> = { insats: "Insats", bevis: "Bevis" };
function slideEtikett(s: { kind: string; roll?: string }): string {
  return (s.roll && SLIDE_ROLL_LABEL[s.roll]) || SLIDE_KIND_LABEL[s.kind] || "Slide";
}

// Punktnumret (01, 02 …) räknas i lib/studio/payload — samma källa som mallen ritar ur.
const punktNr = punktNummer;

// KANAL-2 (HELG-1 DEL 5, 2026-08-21): NIO möjliga kanaler i stället för tre hårdkodade,
// byggda ur lib/kanal-anatomi.ts (EN källa, delas med adapt-channel-routen och
// förhandsvisningen). `platform` = matchning mot GHL:s platform-sträng.
// Grafisk identitet (label/färg/gradient/ikon) hämtas ur CHANNEL_BRAND (EN källa).
//
// ⚠ ig/fb/li visas ALLTID (oförändrat beteende — IG har dessutom en egen native-koppling
// utanför GHL). De sex nya visas BARA när tenanten faktiskt har en matchande GHL-koppling
// (connectedOrExpiredChannelKeys nedan) — DoD:n är uttrycklig: "tenant utan GBP ser den
// inte". Se `dynamiskaKanaler` (beräknas i komponenten, kräver ghlAccounts).
const CHANNELS_BAS: { key: ChannelKey; platform: string }[] = KANAL_NYCKLAR.map((k) => ({
  key: k, platform: KANAL_ANATOMI[k].ghlPlatform,
}));
const CHANNELS: { key: ChannelKey; platform: string }[] = CHANNELS_BAS.filter((c) => ["ig", "fb", "li"].includes(c.key));

/** Tom post per kanal — generisk, håller Record<ChannelKey,T> komplett utan att en ny
 * kanal kräver en manuell rad varje gång. */
function tomKanalRecord<T>(varde: T): Record<ChannelKey, T> {
  return Object.fromEntries(KANAL_NYCKLAR.map((k) => [k, varde])) as Record<ChannelKey, T>;
}

// Fas D — bästa publiceringstid (HEURISTIK, branschstandard per plattform, INTE
// klientens egen data ännu). När engagemangsdata finns per inlägg kan detta bli
// data-drivet. dagar: JS getDay() 0=sön..6=lör. Vardagar = 1–5, LI Tis–Tors = 2–4.
// De sex nya kanalerna har ingen egen mätt branschstandard än — vardagar, förmiddag och
// eftermiddag är en neutral, rimlig default (samma spann som IG/FB) tills det finns data.
const VARDAG_DEFAULT = { dagar: [1, 2, 3, 4, 5], timmar: [10, 15] };
const BASTA_TIDER: Record<ChannelKey, { dagar: number[]; timmar: number[] }> = {
  ...tomKanalRecord(VARDAG_DEFAULT),
  ig: { dagar: [1, 2, 3, 4, 5], timmar: [11, 19] },
  fb: { dagar: [1, 2, 3, 4, 5], timmar: [9, 13] },
  li: { dagar: [2, 3, 4], timmar: [8, 12, 17] },
};
function tillLokalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
// Nästa bra tid-slot (minst 30 min fram) som matchar någon vald kanals bästa fönster.
function nastaBastaTid(channels: ChannelKey[]): string {
  const kandidater = channels.flatMap((k) => BASTA_TIDER[k] ? BASTA_TIDER[k].timmar.map((h) => ({ dagar: BASTA_TIDER[k].dagar, h })) : []);
  if (!kandidater.length) return "";
  const now = new Date();
  for (let addH = 1; addH < 24 * 14; addH++) {
    const t = new Date(now.getTime() + addH * 3600000);
    t.setMinutes(0, 0, 0);
    if (t.getTime() < now.getTime() + 30 * 60000) continue;
    if (kandidater.some((c) => c.h === t.getHours() && c.dagar.includes(t.getDay()))) return tillLokalInput(t);
  }
  return "";
}

const DEFAULT_COLOR = "#6B7280";

// Kort svenskt datum för "Tidigare skapelser" (t.ex. "5 jul") — ger snabb överblick.
function kortDatum(iso: string): string {
  try { return new Date(iso).toLocaleDateString("sv-SE", { day: "numeric", month: "short" }); } catch { return ""; }
}

// Pedagogiska stegfärger (1-6) — harmoniska men distinkta. Varje steg får sin färg på
// nummer, ram och skugga så det syns direkt vad som hör ihop. Ordning: Ämne, Format,
// Bild, Text på bilden, Bildtext, Kanaler.
const STEG_FARGER = ["#8b5cf6", "#6366f1", "#0ea5e9", "#f59e0b", "#10b981", "#f43f5e"];
// Ram för ett stegområde: neutral mjuk kant (gray-100) + tydlig färgad vänsterkant (4px)
// så varje steg syns direkt, plus mjuk färgad skugga. Matchar designsystemet (accent, inte
// färg på allt). Vänsterkanten gör flödet lätt att följa.
function stegRam(c: string): React.CSSProperties {
  // Longhand för alla sidor (blanda ALDRIG borderColor-shorthand med borderLeftColor →
  // React-varning + risk att vänsterkanten skrivs över vid rerender).
  return {
    borderTopColor: "#f3f4f6", borderRightColor: "#f3f4f6", borderBottomColor: "#f3f4f6",
    borderLeftColor: c, borderLeftWidth: 4, boxShadow: `0 6px 24px -12px ${c}80`,
  };
}

// Standardfärg + snabbval för penseldrags-rutan INNAN klientens grafiska profil hunnit
// laddas — swatches-useEffect nedan byter ut dessa mot kundens egna roll-färger så fort
// de finns. Rent neutrala: ingen enskild tenants varumärkesfärg får vara startvärdet här.
const DEFAULT_BRUSH = "#6B7280";
const BRUSH_SWATCHES: { name: string; hex: string }[] = [
  { name: "Grå", hex: "#6B7280" },
  { name: "Mörkgrå", hex: "#374151" },
  { name: "Ljusgrå", hex: "#D1D5DB" },
  { name: "Vit", hex: "#FFFFFF" },
];

// UTF-8-säker base64 (åäö) i webbläsaren — matchar serverns Buffer-base64.
function encodePayload(obj: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}

// customerMode = kundvyn (/k/studio): döljer byrå-only (GHL-config, CLI-payload),
// publicering endast Instagram-direkt. Admin-vyn (/dashboard/studio) = full.
export default function StudioMaker({ customerMode = false, entitledModules = null }: { customerMode?: boolean; entitledModules?: string[] | null }) {
  const [client, setClient] = useState<ClientInfo | null>(null);
  const [templateId, setTemplateId] = useState(TEMPLATE_META[0].id);
  const [format, setFormat] = useState<StudioFormat>("1080x1350");
  // OPTICUR-1 Etapp B: fri storlek ("Egen storlek/Skärm"). Satt = vinner över `format` för
  // canvasmåttet överallt (effectiveDims) — `format` ligger ändå kvar som giltigt värde,
  // orört, ifall customSize nollställs.
  const [customSize, setCustomSize] = useState<CustomSize | null>(null);
  const [headline1, setHeadline1] = useState("");
  const [headline2, setHeadline2] = useState("");
  const [body, setBody] = useState("");
  const [badgeEnabled, setBadgeEnabled] = useState(false);
  const [badgeLine1, setBadgeLine1] = useState("FRÅN");
  const [badgeLine2, setBadgeLine2] = useState("0 KR");
  const [imageUrl, setImageUrl] = useState("");
  // BILD-1: bildredigering i Skriv eget-läget. editedPreview = exakt publicerings-pixlarna
  // (samma canvas-funktion driver preview och publicering → pixelparitet per konstruktion).
  const [imageEdit, setImageEdit] = useState<ImageEdit | null>(null);
  const [editedPreview, setEditedPreview] = useState("");
  // Bildbeskrivning från Bildhjälpen, kopplad till URL:en den gäller (så den inte blir stale
  // om användaren byter bild). Textförslagen grundas i vad bilden faktiskt föreställer.
  const [aiImageDesc, setAiImageDesc] = useState<{ url: string; desc: string } | null>(null);
  // B3: exakt text som ska synas I bilden (eget fält, inte friprompten) + slingans resultat.
  // ETAPP K2-2: saldot ska synas DÄR media skapas, inte bara på en egen sida. Hämtas
  // bara i kundvyn; 403 (modulen av) ger null och då visas ingenting alls.
  const [creditSaldo, setCreditSaldo] = useState<{ saldo: number; procentKvar: number; bildpris: number } | null>(null);
  const [imgText, setImgText] = useState("");
  const [imgTextInfo, setImgTextInfo] = useState<{ metod: string; forsok: number; verifierad: boolean; avlastText: string } | null>(null);
  const [imageFocusY, setImageFocusY] = useState(40);
  const [imgComment, setImgComment] = useState("");
  // G-6: genererings-id for den AI-bild som visas just nu, plus kundens omdome om den.
  // Tummen fanns i ImagePicker och lovade "AI lar sig" — men Studios Bildhjalpen sparade
  // aldrig nagot och las aldrig nagot. Id:t binder omdomet till RATT generering i stallet
  // for att jamfora promptstrangar i efterhand.
  const [bildGenerationId, setBildGenerationId] = useState<string | null>(null);
  const [bildOmdome, setBildOmdome] = useState<1 | -1 | null>(null);
  const [bildOmdomeKommentar, setBildOmdomeKommentar] = useState("");
  const [bildOmdomeSparat, setBildOmdomeSparat] = useState(false);
  const [editingImg, setEditingImg] = useState(false);
  const [prevImageUrl, setPrevImageUrl] = useState("");
  const [brushColor, setBrushColor] = useState(DEFAULT_BRUSH);
  const [swatches, setSwatches] = useState(BRUSH_SWATCHES);
  const [contentFormats, setContentFormats] = useState<string[]>([]);
  const [overrides, setOverrides] = useState<StudioOverrides>(DEFAULT_OVERRIDES);
  const [slides, setSlides] = useState<StudioSlide[]>([]);
  const [slideIdx, setSlideIdx] = useState(0);
  const [genCarousel, setGenCarousel] = useState(false);
  // G-1c: genererings-id:n (generation_log) som bidragit till det som står i editorn.
  // En LISTA och inte ett värde: ett karusellinlägg kommer ur BÅDE karusellgenereringen
  // och captiongenereringen, och den som skriver om captionen tre gånger har fyra
  // genereringar bakom sitt inlägg. Ett enda fält hade tyst kastat alla utom den sista.
  // Töms vid sparning — kopplingen ska ske en gång per generering.
  const [generationIds, setGenerationIds] = useState<string[]>([]);
  const laggTillGeneration = useCallback((id: unknown) => {
    if (typeof id === "string" && id) setGenerationIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);
  const [genSlideImgs, setGenSlideImgs] = useState(""); // "" = idle, annars "2/5"-progress
  // Vilka slides som ska få en genererad bild. Standard = de som saknar bild; `rorda`
  // håller reda på vilka användaren själv klickat i eller ur, så standardvalet fortsätter
  // gälla för alla andra även när slides läggs till.
  const [bildvalRorda, setBildvalRorda] = useState<Set<number>>(new Set());
  const [bildvalExplicit, setBildvalExplicit] = useState<Set<number>>(new Set());
  const [videoUrl, setVideoUrl] = useState("");
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [brand, setBrand] = useState<StudioBrand | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [applyingPaste, setApplyingPaste] = useState(false);
  const [topic, setTopic] = useState("");
  // Två lägen: "simple" = Skriv eget (GHL-enkelt: text + klistra in bild + posta),
  // "template" = Mallar & guide (det stegvisa mall-flödet). Default = enkelt.
  // "improve" = Förbättra befintligt (klistra in ett inlägg → analys + skarpare version + DISC-varianter).
  const [mode, setMode] = useState<"simple" | "template" | "improve">("simple");
  const [impText, setImpText] = useState("");
  const [impBusy, setImpBusy] = useState(false);
  const [impAnalysis, setImpAnalysis] = useState<string[]>([]);
  const [impImproved, setImpImproved] = useState("");
  const [impDisc, setImpDisc] = useState<{ letter: string; label: string; color: string; text: string }[]>([]);
  const [impDiscBusy, setImpDiscBusy] = useState(false);
  const [impCopied, setImpCopied] = useState("");
  const [impProfileMatch, setImpProfileMatch] = useState<boolean | null>(null); // null = ingen profil att matcha mot

  const [uploading, setUploading] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [imgResults, setImgResults] = useState<{ url: string; thumb: string; credit: string }[]>([]);
  const [searchingImg, setSearchingImg] = useState<"stock" | "ai" | "">("");
  // Personligt mediabibliotek (uppladdade + AI-bilder) — återanvänd eller släng.
  const [showMedia, setShowMedia] = useState(false);
  const [mediaItems, setMediaItems] = useState<{ path: string; url: string; name: string; updated: string | null }[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [deletingPath, setDeletingPath] = useState("");
  const [editOpen, setEditOpen] = useState(false); // Fas C: inline-redigering (modal)
  const [scheduleRefresh, setScheduleRefresh] = useState(0); // bumpas efter schemaläggning → laddar om kön
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  // KVALITET-3/2a: löftesräkningen från API:t ("2 av 3 klara, generera fler") — visas
  // i stället för att tyst lämna två idéer och låta rubriken fortsätta säga tre.
  const [suggestMeddelande, setSuggestMeddelande] = useState("");
  const [posts, setPosts] = useState<StudioPost[]>([]);
  const [postQuery, setPostQuery] = useState(""); // sök i "Tidigare skapelser" på titel/det man skrev
  const [loadedPostId, setLoadedPostId] = useState<string | null>(null);
  const [savingPost, setSavingPost] = useState(false);
  const [caption, setCaption] = useState("");
  const [suggestingCaption, setSuggestingCaption] = useState(false);
  // Fas D — A/B-varianter av captionen (olika krok-vinklar) att jämföra och välja.
  // G-1c: varje variant bär sitt eget genererings-id, så den variant användaren VÄLJER
  // är den som binds till inlägget. De som inte väljs förblir ovalda i loggen — det är
  // just skillnaden mellan "genererat" och "använt" som gör mätningen värd något.
  // CTA-2: `ctaVag` är vägen framåt varianten fick tilldelad (kommentar/meddelande/spara-dela/
  // egen kanal). Den visas i kortet så skillnaden mellan varianterna syns FÖRE man läser dem.
  // TON-1: `ton` är tonläget varianten fick tilldelat (D/I/S/C). Det visas i kortet bredvid
  // kroken och vägen framåt, och när en variant väljs flyttas tonen upp i innehållsprofilen
  // — annars säger raden ett tonläge medan texten under är skriven i ett annat.
  const [captionVariants, setCaptionVariants] = useState<{ angle: string; ctaVag?: string; ton?: DiscLetter; caption: string; generationId?: string | null }[]>([]);
  const [loadingVariants, setLoadingVariants] = useState(false);
  const [ghlConnected, setGhlConnected] = useState<boolean | null>(null);
  const [ghlAccounts, setGhlAccounts] = useState<GhlAccount[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [ghlLocInput, setGhlLocInput] = useState("");
  const [ghlPitInput, setGhlPitInput] = useState("");
  const [connectingGhl, setConnectingGhl] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  // Content Compass: schema + dagens profil (förifylld, redigerbar).
  const [compassSchedule, setCompassSchedule] = useState<CompassSchedule | null>(null);
  const [compassEnabled, setCompassEnabled] = useState(false);
  const [compass, setCompass] = useState<{ funnel: FunnelLevel | null; four_a: FourA | null; disc: DiscLetter[] }>({ funnel: null, four_a: null, disc: [] });
  // CC-3: auto-klassa (fyll chips ur texten) + granska mot inläggsanatomin.
  const [compassBusy, setCompassBusy] = useState<"" | "classify" | "review">("");
  const [reviewResult, setReviewResult] = useState<{ passed: boolean; brister: string[]; sammanfattning: string } | null>(null);
  const [igConn, setIgConn] = useState<{ connected: boolean; handle: string | null } | null>(null);
  // Fas B — multi-kanal: valda kanaler (förikryssade efter koppling), per-kanal-caption,
  // per-kanal publiceringsstatus. Grund-captionen (steg 4) är källa; kanal-caption faller
  // tillbaka på den tills man anpassar.
  const [selectedChannels, setSelectedChannels] = useState<ChannelKey[]>(["ig"]);
  // KANAL-3 (Hakans beslut 13/8): utkast eller publicera direkt. Utkast ar grundlaget med
  // flit — det gar att angra i MySales, ett publicerat inlagg har redan motts av folk.
  const [publiceraDirekt, setPubliceraDirekt] = useState(false);
  const [channelsSeeded, setChannelsSeeded] = useState(false);
  const [channelCaptions, setChannelCaptions] = useState<Record<ChannelKey, string>>(() => tomKanalRecord(""));
  const [adapting, setAdapting] = useState(false);
  const [pubBusy, setPubBusy] = useState<ChannelKey | "">("");
  const [pubResult, setPubResult] = useState<Record<ChannelKey, "" | "ok" | "err">>(() => tomKanalRecord("" as const));
  // BILD-3: kvitto efter lyckad publicering — direktlänk, tid, format.
  const [pubReceipt, setPubReceipt] = useState<{ permalink: string; tid: string; format: string } | null>(null);
  const [copied, setCopied] = useState<ChannelKey | "">("");

  const meta = useMemo(() => TEMPLATE_META.find((t) => t.id === templateId)!, [templateId]);
  const primary = client?.primary_color || DEFAULT_COLOR;
  // ALDRIG falla tillbaka på en riktig klients slug — då läcker den klientens brand/footer
  // in i andras inlägg (loadBrand läser clients/<slug>/brand.json). Tom slug = neutral brand.
  const slug = client?.slug || "";
  // Mall-väljaren: använd RIKTIGA slugen (tom när klienten ännu inte laddats) så klient-exklusiva
  // mallar (t.ex. Opticur) ALDRIG visas för fel klient under laddning. Rot-fix mot footer-läckan.
  const availableTemplates = useMemo(
    () => templatesForClient(client?.slug || "", contentFormats as never, customerMode ? entitledModules : null),
    [client?.slug, contentFormats, customerMode, entitledModules],
  );

  // Vald mall stödjer kanske inte aktuellt format (t.ex. byte till Opticur-mall utan 9:16) → hoppa till mallens första.
  useEffect(() => {
    if (!meta.formats.includes(format)) setFormat(meta.formats[0]);
  }, [meta, format]);

  // Håkans fynd 20/8: bytte man FRÅN en fri-storleks-mall (Egen storlek/Skärm, delad yta)
  // TILL en fast-format-mall stod `customSize` kvar i state. StudioEditor mäter alltid ut
  // förhandsvisningsrutan via effectiveDims() (customSize vinner om den finns) — men en
  // fast-format-mall som opticur-foto-gul-ruta läser sin egen höjd direkt ur
  // FORMAT_DIMENSIONS[format] (1350px), inte effectiveDims. De två glider isär: rutan blev
  // t.ex. lika hög som den gamla fria storleken medan mallen själv bara fyllde 1350px av
  // den — resten stod tomt och grått. Samma "en delad funktion saknades"-mönster som
  // format-effekten ovan, nu för customSize.
  useEffect(() => {
    if (!meta.freeSize && customSize) setCustomSize(null);
  }, [meta, customSize]);

  useEffect(() => {
    fetch("/api/clients/active").then((r) => r.json()).then((c) => c && setClient(c)).catch(() => {});
    // Content Compass-schema (för förifylld dagsprofil). Tyst om modul/data saknas.
    fetch("/api/content-compass").then((r) => r.json()).then((d) => { if (d.schedule && d.enabled) { setCompassEnabled(true); setCompassSchedule({ days: d.schedule, cadence: d.cadence || "7" }); } }).catch(() => {});
  }, []);

  // Förifyll dagens Compass-profil från schemat (schemaläggnings-datum, annars idag).
  useEffect(() => {
    if (!compassSchedule) return;
    const p = profileForDate(compassSchedule, scheduleDate ? new Date(scheduleDate) : new Date());
    setCompass(p ? { funnel: p.funnel, four_a: p.four_a, disc: p.disc } : { funnel: null, four_a: null, disc: [] });
  }, [compassSchedule, scheduleDate]);

  // Resolved brand för live-editorn (samma som exporten använder).
  useEffect(() => {
    fetch("/api/studio/brand").then((r) => r.json()).then((d) => { if (d.brand) setBrand(d.brand); }).catch(() => {});
  }, [client]);

  // Färg-swatches ur klientens grafiska profil (roll-färger) — annars Opticur-standard.
  useEffect(() => {
    fetch("/api/brand-kit").then((r) => r.json()).then((d) => {
      const fmts = d?.kit?.contentProfile?.formats;
      if (Array.isArray(fmts)) setContentFormats(fmts);
      const col = d?.kit?.colors || {};
      const roles: { name: string; hex: string }[] = [
        { name: "Accent", hex: col.accent }, { name: "Primär", hex: col.primary },
        { name: "Primär ljus", hex: col.primaryLight }, { name: "Stödfärg", hex: col.support },
        { name: "Primär mörk", hex: col.primaryDeep },
      ].filter((x) => typeof x.hex === "string" && /^#/.test(x.hex));
      if (roles.length >= 2) setSwatches([...roles, { name: "Vit", hex: "#FFFFFF" }]);
    }).catch(() => {});
  }, [client]);

  const payload = useMemo(
    () => ({
      clientId: slug, templateId, format, customSize, headline1, headline2, body,
      badge: { enabled: meta.fields.badge && badgeEnabled, line1: badgeLine1, line2: badgeLine2 },
      imageUrl, imageFocusY, brushColor, overrides, slides, videoUrl, imageEdit,
      // Ämnet/grafikbriefen sparas med inlägget — annars tappas den vid omladdning och
      // Bildhjälpen står tom när man öppnar ett planerat utkast igen.
      brief: topic,
      // Spara läget så inlägget öppnas i samma vy det skapades i (mall vs skriv eget).
      mode,
    }),
    [slug, templateId, format, customSize, headline1, headline2, body, meta, badgeEnabled, badgeLine1, badgeLine2, imageUrl, imageFocusY, brushColor, overrides, slides, videoUrl, imageEdit, topic, mode],
  );

  const isCarousel = Boolean(meta.carousel);
  const slideCount = slides.length;
  const postType = derivePostType(format, videoUrl); // "post" | "story" | "reel"
  const needsImage = templateNeedsImage(templateId); // §00: mallar där bilden bär inlägget

  // "Tidigare skapelser": filtrera på det man skrev (titel) för snabb överblick.
  const visiblePosts = useMemo(() => {
    const q = postQuery.trim().toLowerCase();
    return q ? posts.filter((p) => (p.title || "").toLowerCase().includes(q)) : posts;
  }, [posts, postQuery]);

  // Seed en tom karusell (hook → 3 punkter → cta) när man byter till karusell-mallen.
  useEffect(() => {
    if (isCarousel && slides.length === 0) {
      setSlides([emptySlide("hook"), emptySlide("point"), emptySlide("point"), emptySlide("point"), emptySlide("cta")]);
      setSlideIdx(0);
    }
  }, [isCarousel, slides.length]);

  const updateSlide = useCallback((i: number, patch: Partial<StudioSlide>) => {
    setSlides((prev) => prev.map((s, n) => (n === i ? { ...s, ...patch } : s)));
  }, []);
  // Bild: i karusell-läge hör bilden till AKTUELL slide, annars till inlägget.
  const setImage = useCallback((url: string) => {
    if (isCarousel) updateSlide(slideIdx, { imageUrl: url });
    else { setImageUrl(url); setImageEdit(null); } // ny bild → redigeraren sätter färsk default
  }, [isCarousel, slideIdx, updateSlide]);
  // Aktuell bild att visa/redigera (slidens bild i karusell, annars inläggets).
  const curImg = isCarousel ? (slides[slideIdx]?.imageUrl || "") : imageUrl;
  // Bildvalet pekar på INDEX. Läggs en slide till, tas bort eller flyttas, syftar ett
  // sparat val på fel slide — då är standardvalet ("de som saknar bild") alltid rätt.
  const nollstallBildval = useCallback(() => {
    setBildvalRorda(new Set());
    setBildvalExplicit(new Set());
  }, []);
  const addSlide = useCallback(() => {
    nollstallBildval();
    setSlides((prev) => {
      if (prev.length >= MAX_SLIDES) return prev;
      // Ny punkt före ev. cta-sliden så avslutet stannar sist.
      const ctaAt = prev.findIndex((s) => s.kind === "cta");
      const at = ctaAt >= 0 ? ctaAt : prev.length;
      const next = [...prev];
      next.splice(at, 0, emptySlide("point"));
      setSlideIdx(at);
      return next;
    });
  }, [nollstallBildval]);
  const removeSlide = useCallback((i: number) => {
    nollstallBildval();
    setSlides((prev) => (prev.length <= 1 ? prev : prev.filter((_, n) => n !== i)));
  }, [nollstallBildval]);
  const moveSlide = useCallback((i: number, dir: -1 | 1) => {
    nollstallBildval();
    setSlides((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    setSlideIdx((cur) => Math.min(Math.max(0, cur + dir), MAX_SLIDES - 1));
  }, [nollstallBildval]);

  // Debouncad preview-URL så iframen inte laddar om vid varje tangenttryck.
  // _v = cache-brytare; "Uppdatera"-knappen sätter nytt värde → tvingar färsk render.
  const [nonce, setNonce] = useState(() => Date.now());
  const [previewSrc, setPreviewSrc] = useState("");
  useEffect(() => {
    const t = setTimeout(() => {
      const slideQ = isCarousel ? `&slide=${slideIdx}` : "";
      setPreviewSrc(`/studio/render/${templateId}?p=${encodeURIComponent(encodePayload(payload))}${slideQ}&_v=${nonce}`);
    }, 400);
    return () => clearTimeout(t);
  }, [payload, templateId, nonce, isCarousel, slideIdx]);

  // KVALITET-3/6b — serverns loggval in i live-editorn.
  // Rendern (/studio/render) hade hinten, men det är INTE den som blir de publicerade
  // pixlarna: export, "spara i biblioteket" och publicering fångar den dolda live-editorn
  // med html-to-image. Utan hint föll den tillbaka på vit-variant oavsett bakgrund.
  // Bara det som påverkar beslutet i beroendelistan — inte hela payloaden (varje
  // tangenttryck hade blivit ett anrop).
  // AKUT-KARUSELL: EN hint per slide, inte en hint för den slide man råkar titta på.
  // Karusellen exporteras som N bilder med N olika bakgrunder; delade vi hint hade en
  // mörk slide fått den ljusa slidens tunna vita logga — buggen BILD-6b stängde.
  // Hämtas i ETT anrop (slideIndexes) så debouncen inte blir N requests per tangenttryck.
  type LogoHint = { url: string; plate: "dark" | "light" | null } | null;
  const [logoHints, setLogoHints] = useState<LogoHint[]>([]);
  const logoHint: LogoHint = logoHints[isCarousel ? slideIdx : 0] ?? null;
  // Alla slidebilder i beroendelistan — byter EN slide bild ska hintarna räknas om.
  const logoBild = isCarousel ? slides.map((s) => s.imageUrl || "").join("|") : imageUrl;
  useEffect(() => {
    let avbruten = false;
    const t = setTimeout(() => {
      const antal = isCarousel ? Math.max(1, slideCount) : 1;
      fetch("/api/studio/logo-hint", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload, slideIndexes: Array.from({ length: antal }, (_, i) => i) }),
      })
        .then((r) => r.json())
        .then((d) => { if (!avbruten) setLogoHints(Array.isArray(d?.hints) ? d.hints : [d?.hint ?? null]); })
        .catch(() => { if (!avbruten) setLogoHints([]); });
    }, 500);
    return () => { avbruten = true; clearTimeout(t); };
    // payload läses inne i effekten men får inte styra den — se kommentaren ovan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId, format, logoBild, slideCount, isCarousel, overrides.logoVariant, brand?.content.overlayStyle, slug]);

  // Håll slide-index inom gränserna när slides ändras.
  useEffect(() => {
    if (slideIdx > Math.max(0, slideCount - 1)) setSlideIdx(Math.max(0, slideCount - 1));
  }, [slideCount, slideIdx]);

  const { w, h } = effectiveDims({ format, customSize });
  // Förhandsvisningen skalas efter den bredd den FAKTISKT får, inte efter en gissad siffra.
  // Buggen: skalan var hårdkodad 300/w medan karusellens pilar lägger px-11 (44 px per sida)
  // på behållaren. Kortet ritades 300 px brett i en ~265 px bred ruta med overflow-hidden →
  // högerkanten kapades, och rubriken såg ut att skrivas utanför ytan. Den gjorde den inte:
  // mätt i den riktiga renderingen slutar rubriken 217 px innanför kanten (2026-08-09).
  // En mätt bredd fixar samma fel på smala skärmar, i kundportalen och i framtida paneler.
  // CALLBACK-REF, inte useRef + useEffect([]): effekten kördes EN gång vid mount, och var
  // rutan inte i DOM:en just då fäste observern aldrig. Då stod skalan kvar på 300 och
  // rutan klippte — utan att något syntes i loggen. En callback-ref kallas av React exakt
  // när noden monteras och avmonteras, så mätningen kan inte missa.
  const [previewBoxW, setPreviewBoxW] = useState(300);
  const previewRo = useRef<ResizeObserver | null>(null);
  const mätBredd = useCallback((el: HTMLDivElement) => {
    const bredd = el.getBoundingClientRect().width;
    // Klamp: en orimlig mätning (0 när panelen är dold) får aldrig ge skala 0.
    if (bredd > 40) setPreviewBoxW(Math.min(bredd, 480));
  }, []);
  const previewBoxRef = useCallback((el: HTMLDivElement | null) => {
    previewRo.current?.disconnect();
    previewRo.current = null;
    if (!el) return;
    mätBredd(el); // direkt vid mount — innan första målningen hinner klippa något
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => mätBredd(el));
    ro.observe(el);
    previewRo.current = ro;
  }, [mätBredd]);
  const previewScale = previewBoxW / w;

  // ── Foto-uppladdning (signerad URL → Supabase Storage) ──
  const onFile = useCallback(async (file: File) => {
    setError(""); setUploading(true);
    try {
      const r = await fetch("/api/studio/upload-url", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, mime: file.type, size: file.size }),
      });
      const d = await lasJson<any>(r);
      if (!r.ok) throw new Error(d.error || "Uppladdning misslyckades");
      const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
      const up = await sb.storage.from(d.bucket).uploadToSignedUrl(d.path, d.token, file);
      if (up.error) throw new Error(up.error.message);
      setImage(d.publicUrl);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }, [setImage]);

  // Skriv eget-läget: klistra in en bild var som helst på sidan (Ctrl+V) → ladda upp.
  // Hoppar över när fokus ligger i ett textfält så vanlig text-inklistring funkar där.
  useEffect(() => {
    if (mode !== "simple") return;
    const onPaste = (e: ClipboardEvent) => {
      const ae = document.activeElement as HTMLElement | null;
      if (ae && (ae.tagName === "TEXTAREA" || ae.tagName === "INPUT" || ae.isContentEditable)) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const it of Array.from(items)) {
        if (it.type.startsWith("image/")) {
          const f = it.getAsFile();
          if (f) { e.preventDefault(); onFile(f); return; }
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [mode, onFile]);

  // Video-uppladdning (för reels) → studio-videos-bucketen. Studio-rendern blir 9:16-cover.
  const onVideoFile = useCallback(async (file: File) => {
    setError(""); setUploadingVideo(true);
    try {
      const r = await fetch("/api/studio/upload-url", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, mime: file.type, size: file.size }),
      });
      const d = await lasJson<any>(r);
      if (!r.ok) throw new Error(d.error || "Video-uppladdning misslyckades");
      const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
      const up = await sb.storage.from(d.bucket).uploadToSignedUrl(d.path, d.token, file);
      if (up.error) throw new Error(up.error.message);
      setVideoUrl(d.publicUrl);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploadingVideo(false);
    }
  }, []);

  // ETAPP K2-2: hämta saldot i kundvyn. Tyst vid 403/fel — en kund utan modulen ska
  // varken se en siffra eller ett felmeddelande om något hon inte har.
  const hamtaCredits = useCallback(async () => {
    if (!customerMode) return;
    try {
      const r = await fetch("/api/k/credits");
      if (!r.ok) { setCreditSaldo(null); return; }
      const d = await lasJson<any>(r);
      setCreditSaldo({ saldo: d.saldo, procentKvar: d.procentKvar, bildpris: d.priser?.["social-bild"] ?? 3 });
    } catch { setCreditSaldo(null); }
  }, [customerMode]);

  useEffect(() => { hamtaCredits(); }, [hamtaCredits]);

  // ── Bildförslag (Pexels-stock eller AI-genererad) ──
  const suggestImage = useCallback(async (mode: "stock" | "ai") => {
    setError(""); setSearchingImg(mode); setImgTextInfo(null);
    try {
      // ÄMNE-1 (Håkans fråga 15/8): skicka rubrik/underrubrik/text/ämne/caption VAR FÖR
      // SIG i stället för att klistra ihop dem till en enda `topic`-sträng här. Servern
      // avgör nu ämneskällan (caption > skapad text > Ämnesfält > tomt, samma regel som
      // bildtexten) — den gamla `topic || headline1 || caption`-ordningen lät Ämnesfältet
      // vinna OVILLKORLIGT så fort det var ifyllt, även när det pekade på ett gammalt inlägg.
      const r = await fetch("/api/studio/suggest-image", {
        method: "POST", headers: { "Content-Type": "application/json" },
        // B3: exactText = texten som ska synas I bilden → verifieringsslinga server-side.
        body: JSON.stringify({
          mode, headline: headline1, headline2, body, topic, caption,
          aspect: isStoryFormat(format) ? "story" : format === "1080x1350" ? "portrait" : "square",
          exactText: mode === "ai" ? imgText.trim() : "",
        }),
      });
      const d = await lasJson<any>(r);
      if (!r.ok) throw new Error(d.error || "Bildförslag misslyckades");
      setImgResults(d.photos || []);
      if (d.textInfo) setImgTextInfo(d.textInfo);
      // Saldot ändrades av just den här genereringen — läs om så siffran är sann.
      if (mode === "ai") hamtaCredits();
      // AI-läge ger en scenbeskrivning för den genererade bilden → koppla till dess URL.
      if (mode === "ai" && d.description && d.photos?.[0]?.url) setAiImageDesc({ url: String(d.photos[0].url), desc: String(d.description) });
      if (mode === "ai") {
        setBildGenerationId(d.generationId ? String(d.generationId) : null);
        setBildOmdome(null); setBildOmdomeKommentar(""); setBildOmdomeSparat(false);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSearchingImg("");
    }
  }, [topic, headline1, headline2, body, caption, format, imgText, hamtaCredits]);

  // ── Mediabibliotek: klientens sparade bilder (studio-images/<clientId>/) ──
  const loadMedia = useCallback(async () => {
    setLoadingMedia(true);
    try {
      const r = await fetch("/api/studio/media");
      const d = await lasJson<any>(r);
      if (r.ok) setMediaItems(Array.isArray(d.items) ? d.items : []);
    } catch { /* ignore */ } finally { setLoadingMedia(false); }
  }, []);
  const toggleMedia = useCallback(() => {
    setShowMedia((v) => { if (!v) loadMedia(); return !v; });
  }, [loadMedia]);
  const deleteMedia = useCallback(async (path: string) => {
    setDeletingPath(path);
    try {
      const r = await fetch("/api/studio/media", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });
      if (r.ok) setMediaItems((prev) => prev.filter((m) => m.path !== path));
    } catch { /* ignore */ } finally { setDeletingPath(""); }
  }, []);

  // §00: aldrig tom yta — generera on-brand bild ur inläggets innehåll och applicera direkt.
  // textOverride: generera ur EXAKT denna text (Skapa åt mig: den valda förslags-texten,
  // state hinner inte uppdateras i samma tick).
  const generateOnBrandImage = useCallback(async (textOverride?: string) => {
    setError(""); setSearchingImg("ai");
    try {
      // ÄMNE-1: `textOverride` bär den NYSS VALDA idén (applySuggestion, state hinner inte
      // uppdateras i samma tick) — den är då mer aktuell än headline1/body/topic-state och
      // skickas som den skapade textens innehåll, ensam. Utan override används samma
      // ämneskälla-prioritet som "Föreslå bild" (servern avgör: caption > text > ämne).
      const r = await fetch("/api/studio/suggest-image", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          textOverride
            ? { mode: "ai", body: textOverride.slice(0, 220), aspect: isStoryFormat(format) ? "story" : format === "1080x1350" ? "portrait" : "square" }
            : { mode: "ai", headline: headline1, headline2, body, topic, caption, aspect: isStoryFormat(format) ? "story" : format === "1080x1350" ? "portrait" : "square" },
        ),
      });
      const d = await lasJson<any>(r);
      if (!r.ok) throw new Error(d.error || "Bildgenerering misslyckades");
      const url = d.photos?.[0]?.url;
      if (url) {
        setImage(url);
        if (d.description) setAiImageDesc({ url, desc: String(d.description) });
        // G-6: nytt id, alltsa en ny bild — nollstall omdomet sa forra bildens tumme
        // inte star kvar och ser ut att galla den har.
        setBildGenerationId(d.generationId ? String(d.generationId) : null);
        setBildOmdome(null); setBildOmdomeKommentar(""); setBildOmdomeSparat(false);
      } else throw new Error("Ingen bild genererades");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSearchingImg("");
    }
  }, [headline1, headline2, topic, body, caption, format, setImage]);

  // ── G-6: omdöme om AI-bilden ───────────────────────────────────────────────
  // Sparar betyg + kundens egna ord, bundet till genereringen. Nästa bildgenerering
  // läser tillbaka det (lib/bildfeedback) — det är först då tummens löfte "AI lär sig"
  // blir sant. Fail-open: ett omdöme som inte kan sparas får aldrig störa arbetet.
  const sparaBildOmdome = useCallback(async (rating: 1 | -1) => {
    setBildOmdome(rating);
    try {
      await fetch("/api/images/feedback", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          generationId: bildGenerationId,
          prompt: aiImageDesc?.url === curImg ? aiImageDesc.desc : "",
          content_text: [headline1, topic].filter(Boolean).join(". ").slice(0, 500),
          image_url: curImg,
          kommentar: bildOmdomeKommentar,
        }),
      });
      setBildOmdomeSparat(true);
    } catch { /* tyst: omdömet är en bonus, inte ett steg i arbetet */ }
  }, [bildGenerationId, aiImageDesc, curImg, headline1, topic, bildOmdomeKommentar]);

  // ── Ändra bild via kommentar (bild-till-bild, Nano Banana) ──
  const editImage = useCallback(async () => {
    if (!curImg || !imgComment.trim()) return;
    setError(""); setEditingImg(true);
    try {
      const r = await fetch("/api/studio/edit-image", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: curImg, instruction: imgComment }),
      });
      const d = await lasJson<any>(r);
      if (!r.ok) throw new Error(d.error || "Bildändring misslyckades");
      setPrevImageUrl(curImg);
      setImage(d.url);
      setImgComment("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEditingImg(false);
    }
  }, [curImg, imgComment, setImage]);

  const undoImageEdit = useCallback(() => {
    if (!prevImageUrl) return;
    setImage(prevImageUrl);
    setPrevImageUrl("");
  }, [prevImageUrl, setImage]);

  // Direkt-manipulation av bilden i live-editorn (dra=flytta, scroll=zooma).
  const onImagePatch = useCallback((p: ImagePatch) => {
    if (p.imageFocusY !== undefined) setImageFocusY(p.imageFocusY);
    if (p.imageX !== undefined || p.imageScale !== undefined) {
      setOverrides((o) => ({ ...o, ...(p.imageX !== undefined ? { imageX: p.imageX } : {}), ...(p.imageScale !== undefined ? { imageScale: p.imageScale } : {}) }));
    }
  }, []);
  const setOv = useCallback((patch: Partial<StudioOverrides>) => setOverrides((o) => ({ ...o, ...patch })), []);

  // Fas C: inline-redigering — data-edit-fält (från mallen) → rätt state. Commit-on-blur.
  const onEditField = useCallback((field: string, text: string) => {
    if (field === "headline1") setHeadline1(text);
    else if (field === "headline2") setHeadline2(text);
    else if (field === "body") setBody(text);
    else if (field === "badge1") setBadgeLine1(text);
    else if (field === "badge2") setBadgeLine2(text);
    else if (field === "footerText") setOv({ footerText: text });
    else if (field === "slide-headline") updateSlide(slideIdx, { headline: text });
    else if (field === "slide-body") updateSlide(slideIdx, { body: text });
    else if (field.startsWith("list-")) {
      const idx = Number(field.slice(5));
      // Lista-mallen delar body på radbrytning/·/;/• → byt rätt punkt, bevara övriga.
      setBody((prev) => {
        const parts = prev.split(/\n|·|;|•/).map((s) => s.trim()).filter(Boolean);
        if (idx >= 0 && idx < parts.length) { parts[idx] = text; return parts.join("\n"); }
        return prev;
      });
    }
  }, [slideIdx, updateSlide, setOv]);

  // Klistra in eget utkast → AI delar upp i rubrik/underrubrik/brödtext.
  const applyPaste = useCallback(async () => {
    if (!pasteText.trim()) return;
    setApplyingPaste(true); setError("");
    try {
      const r = await fetch("/api/studio/parse-draft", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: pasteText, templateId }),
      });
      const d = await lasJson<any>(r);
      if (!r.ok) throw new Error(d.error || "Kunde inte tolka texten");
      if (typeof d.headline1 === "string") setHeadline1(d.headline1);
      if (typeof d.headline2 === "string") setHeadline2(d.headline2);
      if (typeof d.body === "string") setBody(d.body);
      setPasteText("");
    } catch (e) { setError((e as Error).message); } finally { setApplyingPaste(false); }
  }, [pasteText, templateId]);

  // ── Förbättra befintligt inlägg: analys + skarpare version (Brand-profilen som kontext) ──
  const improvePost = useCallback(async () => {
    if (!impText.trim()) return;
    setImpBusy(true); setError(""); setImpAnalysis([]); setImpImproved(""); setImpDisc([]);
    try {
      const r = await fetch("/api/studio/improve-post", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: impText }),
      });
      const d = await lasJson<any>(r);
      if (!r.ok) throw new Error(d.error || "Kunde inte förbättra inlägget");
      setImpAnalysis(Array.isArray(d.analysis) ? d.analysis : []);
      setImpImproved(d.improved || "");
      setImpProfileMatch(typeof d.profileMatch === "boolean" ? d.profileMatch : null);
    } catch (e) { setError((e as Error).message); } finally { setImpBusy(false); }
  }, [impText]);

  // Kör den förbättrade versionen genom DISC (röd/gul/grön/blå).
  const improveDisc = useCallback(async () => {
    if (!impImproved.trim()) return;
    setImpDiscBusy(true); setError("");
    try {
      const r = await fetch("/api/studio/improve-post", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: impImproved, mode: "disc" }),
      });
      const d = await lasJson<any>(r);
      if (!r.ok) throw new Error(d.error || "Kunde inte skapa varianter");
      setImpDisc(Array.isArray(d.variants) ? d.variants : []);
    } catch (e) { setError((e as Error).message); } finally { setImpDiscBusy(false); }
  }, [impImproved]);

  const copyText = useCallback(async (key: string, t: string) => {
    try { await navigator.clipboard.writeText(t); setImpCopied(key); setTimeout(() => setImpCopied(""), 1500); } catch { /* ignore */ }
  }, []);

  // ── AI-textförslag (3 hook-drivna varianter) ──
  const suggest = useCallback(async () => {
    setError(""); setSuggesting(true); setSuggestions([]); setSuggestMeddelande("");
    try {
      // Grunda förslagen i inläggets grundtext + bilden: skicka captionen och den aktuella
      // bilden. Beskrivningen skickas bara om den hör till just den bilden (annars gör
      // servern en snabb bildanalys). Så texten förstärker bildens roll istället för att krocka.
      const imgDesc = aiImageDesc && aiImageDesc.url === curImg ? aiImageDesc.desc : "";
      const r = await fetch("/api/studio/suggest-text", {
        method: "POST", headers: { "Content-Type": "application/json" },
        // G-2: videoUrl skiljer story (9:16 utan video) från reel — olika anatomi.
        body: JSON.stringify({ templateId, format, topic, caption, imageUrl: curImg, imageDescription: imgDesc, videoUrl }),
      });
      const d = await lasJson<any>(r);
      if (!r.ok) throw new Error(d.error || "Förslag misslyckades");
      setSuggestions(Array.isArray(d.suggestions) ? d.suggestions : []);
      // KVALITET-3/2a: API:t har redan räknat och skrivit meddelandet (lib/studio/copy.ts,
      // ideerMeddelande) — visa det i stället för att låta rubriken tyst lova tre.
      setSuggestMeddelande(typeof d.meddelande === "string" ? d.meddelande : "");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSuggesting(false);
    }
  }, [templateId, format, topic, caption, curImg, aiImageDesc]);

  // Skapa åt mig: efter användarens VAL av förslag genereras bilden ur den valda texten.
  const quickAutoImage = useRef(false);
  const applySuggestion = useCallback((s: Suggestion) => {
    setHeadline1(s.headline1 || "");
    setHeadline2(s.headline2 || "");
    setBody(s.body || "");
    setSuggestions([]); setSuggestMeddelande(""); // dölj listan efter val — annars ligger samma förslag kvar i både steg 1 och steg 4
    if (quickAutoImage.current) {
      quickAutoImage.current = false;
      void generateOnBrandImage([s.headline1, s.body].filter(Boolean).join(". "));
    }
  }, [generateOnBrandImage]);

  // BILD-2: diff-dialog när genereringen vill ersätta text användaren själv skrivit.
  // Default = Behåll (ingen destruktiv åtgärd utan aktivt val).
  const [carouselDiffs, setCarouselDiffs] = useState<{ index: number; nuvarande: { headline: string; body: string }; forslag: { headline: string; body: string }; anvand: boolean }[] | null>(null);

  // Generera hela karusellen (hook → punkter → cta) ur ämne + varumärkesröst.
  // BILD-2: användarens material är förstklassigt — egna bilder behålls ALLTID, egna texter
  // behålls (AI:s förslag hamnar i diff-dialogen), AI fyller bara luckor.
  const generateCarouselNow = useCallback(async () => {
    setError(""); setGenCarousel(true);
    try {
      const r = await fetch("/api/studio/carousel/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic || headline1, points: 3, compass }),
      });
      const d = await lasJson<any>(r);
      if (!r.ok) throw new Error(d.error || "Karusell-generering misslyckades");
      if (!Array.isArray(d.slides) || !d.slides.length) return;
      // G-1c: håll genererings-id:t tills inlägget sparas — då binds de ihop. Ligger i
      // state och inte i payloaden: kopplingen ska ske EN gång, inte varje gång ett
      // sparat inlägg öppnas och sparas om.
      laggTillGeneration(d.generationId);
      const nya: StudioSlide[] = d.slides;
      const gamla = slides;
      const harInnehall = gamla.some((s) => s.imageUrl || s.headline?.trim() || s.body?.trim());
      if (!harInnehall) { setSlides(nya); setSlideIdx(0); return; }
      // Slås ihop på ROLL, inte position — se lib/studio/slide-merge. Den gamla
      // positionsparningen gav två avslut så fort deckarna hade olika längd.
      const { merged, diffs } = slaIhopSlides(gamla, nya);
      setSlides(merged); setSlideIdx(0);
      if (diffs.length) setCarouselDiffs(diffs);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGenCarousel(false);
    }
  }, [topic, headline1, compass, slides, laggTillGeneration]);

  // Diff-dialogens "Använd valda förslag": bara aktivt ibockade slides får AI-texten.
  const applyCarouselDiffs = useCallback(() => {
    if (!carouselDiffs) return;
    setSlides((prev) => prev.map((s, i) => {
      const diff = carouselDiffs.find((x) => x.index === i && x.anvand);
      return diff ? { ...s, headline: diff.forslag.headline, body: diff.forslag.body } : s;
    }));
    setCarouselDiffs(null);
  }, [carouselDiffs]);

  // Skapa en on-brand AI-bild per slide (ämne = slidens egen text). Sekventiellt så
  // Gemini/Fal-kvoten inte spränger, med synlig progress. Sätter bilden direkt på varje slide.
  // Bildgenerering per slide gjorde förut om ALLA slides varje gång. Lade man till två
  // slides kastades de fem färdiga bilderna — och varje bild kostar credits. Nu väljer
  // man vilka. Standardvalet är "de som saknar bild", så den vanliga vägen (lägg till en
  // slide, skapa bild till just den) blir ett klick utan att röra det som redan är klart.
  const bildvalEffektivt = useCallback(
    (i: number) => (bildvalRorda.has(i) ? bildvalExplicit.has(i) : !slides[i]?.imageUrl),
    [bildvalRorda, bildvalExplicit, slides],
  );
  const valdaBildIndex = useMemo(
    () => slides.map((_, i) => i).filter((i) => bildvalEffektivt(i)),
    [slides, bildvalEffektivt],
  );
  // Valda slides som ännu saknar text. Fotot beskrivs ur slidens egen text, så en tom
  // slide ger ett generiskt motiv till samma kostnad som ett träffsäkert.
  const valdaUtanText = useMemo(
    () => valdaBildIndex.filter((i) => !(slides[i]?.headline || "").trim() && !(slides[i]?.body || "").trim()),
    [valdaBildIndex, slides],
  );
  const toggleBildval = useCallback((i: number) => {
    const pa = bildvalRorda.has(i) ? bildvalExplicit.has(i) : !slides[i]?.imageUrl;
    setBildvalRorda((prev) => new Set(prev).add(i));
    setBildvalExplicit((prev) => {
      const n = new Set(prev);
      if (pa) n.delete(i); else n.add(i);
      return n;
    });
  }, [bildvalRorda, bildvalExplicit, slides]);
  // "Alla" = markera allt explicit. "Bara de utan bild" = tillbaka till standardvalet.
  const markeraAllaBilder = useCallback(() => {
    setBildvalRorda(new Set(slides.map((_, i) => i)));
    setBildvalExplicit(new Set(slides.map((_, i) => i)));
  }, [slides]);

  const generateSlideImages = useCallback(async () => {
    setError("");
    const aspect = isStoryFormat(format) ? "story" : format === "1080x1350" ? "portrait" : "square";
    const list = slides;
    const valda = list.map((_, i) => i).filter((i) => bildvalEffektivt(i));
    if (!valda.length) return;
    try {
      for (let k = 0; k < valda.length; k++) {
        const n = valda[k];
        // Progressen räknar de VALDA, men namnger sliden — "3/4" utan att säga vilken
        // slide säger inget när man valt slide 2, 5, 6 och 7.
        setGenSlideImgs(`${k + 1}/${valda.length} (slide ${n + 1})`);
        const s = list[n];
        const t = [s.headline, s.body].filter(Boolean).join(". ").slice(0, 220) || topic || headline1 || "on-brand bild";
        // BILD-10 v2/K3: sliden måste säga VAR i serien den ligger. Utan position kan
        // rotationen inte dela ut olika personkategorier, och karusellen fick fem bilder
        // på samma man vid samma skärm. Rubrik och brödtext skickas var för sig så
        // bevismeningen (K2) kan härledas ur poängen och inte ur en hopklistrad rad.
        const r = await fetch("/api/studio/suggest-image", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "ai", topic: t, aspect,
            rubrik: s.headline || "", brodtext: s.body || "",
            serieIndex: n, serieAntal: list.length,
          }),
        });
        const d = await lasJson<any>(r);
        const url = d.photos?.[0]?.url;
        if (url) updateSlide(n, { imageUrl: url });
      }
      // Efter körningen har de valda fått bild → standardvalet blir tomt av sig självt.
      nollstallBildval();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGenSlideImgs("");
    }
  }, [slides, format, topic, headline1, updateSlide, bildvalEffektivt, nollstallBildval]);

  // Fånga den dolda full-skala-designen (#hidden canvas) till en PNG-blob i webbläsaren.
  // Delas av export + spara-i-bibliotek + publicera. Fungerar i molnet (Playwright gör inte det).
  const captureRef = useRef<HTMLDivElement>(null);
  const slideCaptureRefs = useRef<(HTMLDivElement | null)[]>([]);

  // En nod → en blob. Delad av både enkelbild och karusell så måtten sätts på ETT ställe.
  const nodeTillBlob = useCallback(async (node: HTMLDivElement | null): Promise<Blob | null> => {
    if (!node || !brand) return null;
    try {
      const { w: cw, h: ch } = effectiveDims({ format, customSize });
      if (document.fonts?.ready) await document.fonts.ready;
      await new Promise((r) => setTimeout(r, 150)); // låt bilden i den dolda editorn ladda klart
      return await toBlob(node, { width: cw, height: ch, pixelRatio: 1, cacheBust: true, backgroundColor: "#ffffff" });
    } catch {
      return null;
    }
  }, [brand, format, customSize]);

  const captureDesignBlob = useCallback(async (): Promise<Blob | null> => {
    // Karusell: den bild som representerar inlägget är omslaget (slide 1), aldrig den
    // slide användaren råkade stå på när han tryckte.
    if (isCarousel) return nodeTillBlob(slideCaptureRefs.current[0] ?? null);
    return nodeTillBlob(captureRef.current);
  }, [isCarousel, nodeTillBlob]);

  // AKUT-KARUSELL: ALLA slides som blobbar, i slide-ordning. Icke-karusell ger exakt en.
  // Ordning, fullständighet och felmeddelande ligger i lib/studio/export-slides så de går
  // att bevisa med test — en loop inne i en komponent går bara att verifiera med ögat.
  const captureAllBlobs = useCallback(async (): Promise<Blob[]> => {
    if (!isCarousel) {
      const b = await nodeTillBlob(captureRef.current);
      return b ? [b] : [];
    }
    return fangaAllaSlides(slideCount, (i) => slideCaptureRefs.current[i] ?? null, nodeTillBlob);
  }, [isCarousel, slideCount, nodeTillBlob]);

  // ── Export PNG — klient-render (fungerar i molnet, laddar ner den färdiga designen) ──
  // Karusell = N filer, namngivna 1av7, 2av7 … så ordningen syns i nedladdningsmappen.
  const exportPng = useCallback(async () => {
    setError(""); setExporting(true);
    try {
      const blobs = await captureAllBlobs();
      if (!blobs.length) throw new Error("Kunde inte skapa bilden, prova igen om en stund.");
      blobs.forEach((blob, i) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = slideFilnamn(`${slug}-${templateId}-${format}`, i, blobs.length);
        a.click();
        URL.revokeObjectURL(a.href);
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setExporting(false);
    }
  }, [captureAllBlobs, slug, templateId, format]);

  const downloadPayload = useCallback(() => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${slug}-${templateId}.json`;
    a.click();
  }, [payload, slug, templateId]);

  // Fyller hela editorn från en payload (delas av utkast + bibliotek).
  const applyPayload = useCallback((d: Record<string, unknown>) => {
    const badge = (d.badge ?? {}) as { enabled?: boolean; line1?: string; line2?: string };
    setTemplateId((d.templateId as string) ?? TEMPLATE_META[0].id);
    // Bara giltiga bildformat: sparad data kan innehålla annat (t.ex. veckoplanens
    // innehållsformat), och ett okänt värde kraschar mått-uppslagningen.
    const sparatFormat = d.format as StudioFormat;
    setFormat(sparatFormat && FORMAT_DIMENSIONS[sparatFormat] ? sparatFormat : "1080x1350");
    // OPTICUR-1 Etapp B: fri storlek, om sparad. Samma klampning som normalizePayload
    // (200-4096) så en trasig/manipulerad rad aldrig ger en orimlig canvas.
    const sparatCustom = d.customSize as { w?: number; h?: number; name?: string } | null | undefined;
    setCustomSize(
      sparatCustom && Number.isFinite(sparatCustom.w) && Number.isFinite(sparatCustom.h)
        ? { w: Math.round(Math.min(4096, Math.max(200, sparatCustom.w!))), h: Math.round(Math.min(4096, Math.max(200, sparatCustom.h!))), ...(sparatCustom.name ? { name: sparatCustom.name } : {}) }
        : null,
    );
    setHeadline1((d.headline1 as string) ?? ""); setHeadline2((d.headline2 as string) ?? ""); setBody((d.body as string) ?? "");
    setBadgeEnabled(!!badge.enabled); setBadgeLine1(badge.line1 ?? "FRÅN"); setBadgeLine2(badge.line2 ?? "0 KR");
    setImageUrl((d.imageUrl as string) ?? ""); setImageFocusY((d.imageFocusY as number) ?? 40);
    setImageEdit(normalizeImageEdit(d.imageEdit));
    setBrushColor((d.brushColor as string) || DEFAULT_BRUSH);
    setCaption((d.caption as string) ?? "");
    // Sammanslaget med tomKanalRecord: äldre sparade utkast (före KANAL-2) har bara
    // ig/fb/li i sitt channelCaptions-objekt, aldrig de sex nya nycklarna.
    setChannelCaptions({ ...tomKanalRecord(""), ...((d.channelCaptions as Partial<Record<ChannelKey, string>>) ?? {}) });
    setOverrides({ ...DEFAULT_OVERRIDES, ...((d.overrides as object) || {}) });
    setSlides(Array.isArray(d.slides) ? (d.slides as StudioSlide[]) : []);
    setSlideIdx(0);
    setVideoUrl((d.videoUrl as string) ?? "");
    setTopic((d.brief as string) ?? "");
    setPrevImageUrl("");
    // Öppna i rätt vy: sparat läge först, annars härlett. Ett inlägg med rubriktext på
    // bilden är ett mall-inlägg och måste visas i mall-läget, annars ser man inget.
    const sparatLage = d.mode === "template" || d.mode === "simple" ? (d.mode as "template" | "simple") : null;
    const harMallText = !!((d.headline1 as string) || (d.headline2 as string) || (d.body as string) || (Array.isArray(d.slides) && d.slides.length));
    setMode(sparatLage ?? (harMallText ? "template" : "simple"));
  }, []);

  // ── UTKAST-1: autospar av HELA sessionen, per klient-id ──
  // Payloaden ensam räckte inte: bildtext, kanal-captions, valda kanaler, förslagslistan,
  // Compass-chipsen och texten i bilden låg utanför den och nollades vid en omladdning.
  const utkastData = useMemo(
    () => ({ payload, caption, channelCaptions, selectedChannels, suggestions, compass, imgText, loadedPostId }),
    [payload, caption, channelCaptions, selectedChannels, suggestions, compass, imgText, loadedPostId],
  );
  type StudioUtkast = typeof utkastData;

  const aterstallUtkast = useCallback((d: StudioUtkast) => {
    if (d.payload) applyPayload(d.payload as unknown as Record<string, unknown>);
    setCaption(d.caption ?? "");
    if (d.channelCaptions) setChannelCaptions({ ...tomKanalRecord(""), ...d.channelCaptions });
    if (Array.isArray(d.selectedChannels) && d.selectedChannels.length) {
      setSelectedChannels(d.selectedChannels);
      setChannelsSeeded(true); // annars skriver kopplings-seeden över det återställda valet
    }
    if (Array.isArray(d.suggestions)) setSuggestions(d.suggestions);
    if (d.compass) setCompass(d.compass);
    setImgText(d.imgText ?? "");
    setLoadedPostId(d.loadedPostId ?? null);
  }, [applyPayload]);

  // Tomt läge sparas aldrig — annars "återupptar" man ingenting och raden blir brus.
  const utkastHarInnehall = useCallback((d: StudioUtkast) => {
    const p = d.payload;
    if (!p) return false;
    return Boolean(
      p.headline1?.trim() || p.headline2?.trim() || p.body?.trim() || p.imageUrl || p.videoUrl ||
      p.brief?.trim() || d.caption?.trim() || d.imgText?.trim() ||
      (Array.isArray(d.suggestions) && d.suggestions.length > 0) ||
      (Array.isArray(p.slides) && p.slides.some((s) => s.imageUrl || s.headline?.trim() || s.body?.trim())),
    );
  }, []);

  // Djuplänk från kalendern (?post=<id>) ska alltid vinna över utkastet — annars öppnar
  // man ett planerat inlägg och får förra sessionen i stället.
  const [djuplankPost] = useState(() => {
    if (typeof window === "undefined") return false;
    return Boolean(new URLSearchParams(window.location.search).get("post"));
  });

  // Tömmer ytan vid klientbyte när den nya klienten saknar utkast. Utan den stod
  // förra klientens texter kvar under den nya klientens namn (Håkans fynd 10/8).
  // Samma rensning som "Börja om", men utan glomUtkast — det finns inget att glömma.
  const tomYtan = useCallback(() => {
    setHeadline1(""); setHeadline2(""); setBody(""); setTopic("");
    setImageUrl(""); setImageEdit(null); setEditedPreview(""); setAiImageDesc(null);
    setImgText(""); setImgTextInfo(null); setVideoUrl("");
    setCaption(""); setChannelCaptions(tomKanalRecord(""));
    setSuggestions([]); setSlides([]); setSlideIdx(0);
    setOverrides(DEFAULT_OVERRIDES); setBadgeEnabled(false);
    setCustomSize(null);
    setLoadedPostId(null); setError("");
    setBildGenerationId(null); setBildOmdome(null); setBildOmdomeKommentar(""); setBildOmdomeSparat(false);
    // UTKAST-2: utkastet bär även Compass-chipsen och kanalvalet. Stod de kvar hörde de
    // fortfarande till förra klientens inlägg, och `channelsSeeded` hade dessutom hindrat
    // förikryssningen från att läsa den NYA klientens kopplingar.
    // ⚠ Ärlig gräns: kopplingsstatusen läses vid sidladdning, så förikryssningen efter ett
    // byte kan bara utgå från det som lästes då.
    setCompass({ funnel: null, four_a: null, disc: [] });
    setSelectedChannels(["ig"]); setChannelsSeeded(false);
  }, []);

  const { aterupptaget, sparatVid, glomUtkast } = useUtkast<StudioUtkast>({
    yta: "studio",
    klientId: djuplankPost ? null : client?.id,
    data: utkastData,
    aterstall: aterstallUtkast,
    harInnehall: utkastHarInnehall,
    nollstall: tomYtan,
  });

  // "Börja om" = släng utkastet OCH töm ytan, så raden inte kommer tillbaka direkt.
  // Samma tömning som vid klientbyte: EN källa, två anropare. Två listor som ska hålla
  // samma sak isär glider isär — den här bar redan fyra rader mindre än `tomYtan`
  // (bildomdömet från G-6 låg kvar bundet till en bild som inte fanns på skärmen).
  const borjaOm = useCallback(() => {
    glomUtkast();
    tomYtan();
  }, [glomUtkast, tomYtan]);

  // ── Bibliotek: tidigare skapelser (studio_posts) ──
  const refreshPosts = useCallback(async () => {
    try {
      const r = await fetch("/api/studio/posts");
      const d = await lasJson<any>(r);
      if (r.ok) setPosts(Array.isArray(d.posts) ? d.posts : []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { refreshPosts(); }, [refreshPosts, client]);

  // Spara aktuell skapelse i biblioteket. asNew=true → alltid ny kopia. Returnerar post-id.
  const savePost = useCallback(async (asNew = false): Promise<string | null> => {
    setError(""); setSavingPost(true);
    try {
      const title = headline1 || caption.slice(0, 40) || body.slice(0, 40) || "Namnlöst inlägg";
      const r = await fetch("/api/studio/posts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: asNew ? undefined : loadedPostId, title, payload: { ...payload, caption, channelCaptions }, compass, generationIds }),
      });
      const d = await lasJson<any>(r);
      if (!r.ok) throw new Error(d.error || "Kunde inte spara i biblioteket");
      const id = d.post?.id ?? null;
      setLoadedPostId(id);
      // G-1c: kopplingen är gjord. Töm, annars binds samma genereringar om till nästa
      // inlägg användaren sparar och loggen skulle påstå att en text blev två saker.
      if (generationIds.length) setGenerationIds([]);
      await refreshPosts();
      return id;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setSavingPost(false);
    }
  }, [headline1, body, caption, channelCaptions, loadedPostId, payload, refreshPosts, compass, generationIds]);

  // "Spara utkast" = spara i biblioteket så det syns i "Tidigare skapelser" längst ner.
  // Det lokala autosparet sköts av useUtkast och behöver ingen knapp.
  const saveDraftPersistent = useCallback(async () => {
    const id = await savePost(false);
    if (id) { setSaved(true); setTimeout(() => setSaved(false), 1500); }
  }, [savePost]);

  // KVALITET-3/3: veckoplanens inlägg bär bara UNDERLAG (brief + caption) — texten på
  // bilden ärvs aldrig från captionen. Öppnas ett sådant inlägg genereras affischtexten
  // ur inlägget (pa-bild-anatomin i lib/studio/copy.ts) och användaren väljer bland tre.
  const [behoverPabildText, setBehoverPabildText] = useState(false);
  // VECKA-2: samma sak, men som ett SYNLIGT besked. Håkan öppnade ett planerat inlägg, landade
  // på steg 1 med tre förslag och drog slutsatsen att inlägget inte var skrivet. Bildtexten ÄR
  // skriven — den ligger i steg 5. Det som är kvar är texten på bilden och bilden. Raden ligger
  // kvar tills på-bild-texten är satt, så den försvinner av sig själv när arbetet är gjort.
  const [oppnadeUnderlag, setOppnadeUnderlag] = useState(false);

  // Öppna en sparad skapelse i editorn för återanvändning/redigering.
  const openPost = useCallback((p: StudioPost) => {
    applyPayload(p.payload);
    setLoadedPostId(p.id);
    const d = (p.payload || {}) as Record<string, unknown>;
    const harPabild = Boolean(
      String(d.headline1 ?? "").trim() || String(d.body ?? "").trim() ||
      (Array.isArray(d.slides) && d.slides.length > 0),
    );
    const harUnderlag = Boolean(String(d.caption ?? "").trim() || String(d.brief ?? "").trim());
    setBehoverPabildText(!harPabild && harUnderlag);
    setOppnadeUnderlag(!harPabild && harUnderlag);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [applyPayload]);

  // Kör genereringen när captionen/briefen landat i state (applyPayload är asynkron mot render).
  useEffect(() => {
    if (!behoverPabildText || suggesting || suggestions.length > 0) return;
    if (!caption.trim() && !topic.trim()) return;
    setBehoverPabildText(false);
    void suggest();
  }, [behoverPabildText, suggesting, suggestions.length, caption, topic, suggest]);

  // Djuplänk från kalendern: /dashboard/studio?post=<id> öppnar inlägget med alla inställningar.
  const openedFromUrl = useRef(false);
  useEffect(() => {
    if (openedFromUrl.current || posts.length === 0) return;
    const id = new URLSearchParams(window.location.search).get("post");
    if (!id) { openedFromUrl.current = true; return; }
    const p = posts.find((x) => String(x.id) === id);
    if (p) { openPost(p); openedFromUrl.current = true; }
  }, [posts, openPost]);

  const deletePost = useCallback(async (id: string) => {
    try {
      const r = await fetch(`/api/studio/posts/${id}`, { method: "DELETE" });
      if (r.ok) {
        setPosts((prev) => prev.filter((p) => p.id !== id));
        if (loadedPostId === id) setLoadedPostId(null);
      }
    } catch { /* ignore */ }
  }, [loadedPostId]);

  // ── Publicering: GHL Social Planner (utkast) ──
  const refreshGhlAccounts = useCallback(async () => {
    try {
      const r = await fetch("/api/studio/ghl-accounts");
      const d = await lasJson<any>(r);
      setGhlConnected(!!d.connected);
      const accs: GhlAccount[] = Array.isArray(d.accounts) ? d.accounts : [];
      setGhlAccounts(accs);
      setSelectedAccounts(accs.filter((a) => !a.isExpired).map((a) => a.id));
    } catch { setGhlConnected(false); }
  }, []);
  // Hämta GHL-konton i BÅDE admin och kundläge — så kunden ser om FB/LI är kopplat via
  // MySales och kan publicera den vägen. Endast GHL-config-boxen (token) är admin-only.
  useEffect(() => { refreshGhlAccounts(); }, [refreshGhlAccounts, client]);

  // Instagram-kopplingsstatus (för direkt-IG-valet). Per aktiv klient.
  useEffect(() => {
    fetch("/api/instagram/connect")
      .then((r) => r.json())
      .then((d) => setIgConn({ connected: !!d.connected, handle: d.handle || null }))
      .catch(() => setIgConn({ connected: false, handle: null }));
  }, [client]);

  const connectGhl = useCallback(async () => {
    if (!ghlLocInput.trim() || !ghlPitInput.trim()) { setError("Fyll i location-id och token"); return; }
    setError(""); setConnectingGhl(true);
    try {
      const r = await fetch("/api/studio/ghl-config", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId: ghlLocInput.trim(), pit: ghlPitInput.trim() }),
      });
      const d = await lasJson<any>(r);
      if (!r.ok) throw new Error(d.error || "Kunde inte koppla");
      setGhlPitInput("");
      await refreshGhlAccounts();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setConnectingGhl(false);
    }
  }, [ghlLocInput, ghlPitInput, refreshGhlAccounts]);

  const disconnectGhl = useCallback(async () => {
    await fetch("/api/studio/ghl-config", { method: "DELETE" });
    setGhlAccounts([]); setSelectedAccounts([]); setGhlConnected(false);
  }, []);

  const suggestCaption = useCallback(async () => {
    setError(""); setSuggestingCaption(true);
    try {
      // ÄMNE-1: skickar den BEFINTLIGA captionen med. Finns en redan (knappen säger
      // "Skriv om") är den den starkaste ämneskällan — se lib/content/amneskalla.ts.
      // Utan den här raden regenererade "Skriv om" ur headline/body/ämne på nytt varje
      // gång, i stället för att vinkla om texten som redan stod där.
      const r = await fetch("/api/studio/suggest-caption", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ headline: headline1, headline2, body, topic, slides, postType, compass, caption }),
      });
      const d = await lasJson<any>(r);
      if (!r.ok) throw new Error(d.error || "Kunde inte föreslå bildtext");
      setCaption(d.caption || "");
      laggTillGeneration(d.generationId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSuggestingCaption(false);
    }
  }, [headline1, headline2, body, topic, slides, postType, compass, caption, laggTillGeneration]);

  // CC-3: auto-klassa inläggets text → fyll Content Compass-chips (redigerbara efteråt).
  const autoClassify = useCallback(async () => {
    const text = (caption || [headline1, body].filter(Boolean).join("\n\n")).trim();
    if (text.length < 20) { setError("Skriv lite text först så kan jag klassa den."); return; }
    setError(""); setCompassBusy("classify");
    try {
      const r = await fetch("/api/content/classify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      const d = await lasJson<any>(r);
      if (!r.ok) throw new Error(d.error || "Kunde inte klassa texten");
      setCompass({ funnel: (d.funnel || null) as FunnelLevel | null, four_a: (d.four_a || null) as FourA | null, disc: Array.isArray(d.disc) ? (d.disc as DiscLetter[]) : [] });
    } catch (e) { setError((e as Error).message); } finally { setCompassBusy(""); }
  }, [caption, headline1, body]);

  // CC-3: granska texten mot inläggsanatomin (hook, känsla, kund-nytta, exakt en CTA).
  const reviewText = useCallback(async () => {
    const text = (caption || [headline1, body].filter(Boolean).join("\n\n")).trim();
    if (text.length < 20) { setError("Skriv lite text först så kan jag granska den."); return; }
    setError(""); setCompassBusy("review"); setReviewResult(null);
    try {
      const r = await fetch("/api/content/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, funnel: compass.funnel || undefined }) });
      const d = await lasJson<any>(r);
      if (!r.ok) throw new Error(d.error || "Kunde inte granska texten");
      setReviewResult({ passed: !!d.passed, brister: Array.isArray(d.brister) ? d.brister : [], sammanfattning: d.sammanfattning || "" });
    } catch (e) { setError((e as Error).message); } finally { setCompassBusy(""); }
  }, [caption, headline1, body, compass.funnel]);

  // Fas D: A/B — generera 3 caption-varianter med olika krok-vinklar att jämföra.
  const suggestCaptionVariants = useCallback(async () => {
    setError(""); setLoadingVariants(true); setCaptionVariants([]);
    try {
      // ÄMNE-1: samma ämneskälla-prioritet som "Skriv om" — se kommentaren i suggestCaption.
      const r = await fetch("/api/studio/suggest-caption", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ headline: headline1, headline2, body, topic, slides, postType, variants: 3, compass, caption }),
      });
      const d = await lasJson<any>(r);
      if (!r.ok) throw new Error(d.error || "Kunde inte skapa varianter");
      setCaptionVariants(Array.isArray(d.variants) ? d.variants : []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingVariants(false);
    }
  }, [headline1, headline2, body, topic, slides, postType, compass, caption]);

  const toggleAccount = useCallback((id: string) => {
    setSelectedAccounts((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }, []);

  // ── Fas B: kanaldetektering, anpassning, per-kanal-publicering ──
  // Icke-utgångna GHL-konton för en plattform (facebook/linkedin/instagram/…).
  const ghlFor = useCallback(
    (platform: string) => ghlAccounts.filter((a) => a.platform.toLowerCase().includes(platform) && !a.isExpired),
    [ghlAccounts],
  );
  // KANAL-2 (HELG-1 DEL 5): kanalstatus + synlighet räknas ur DELAD, testad ren logik i
  // lib/kanal-anatomi.ts (arAnsluten/arUtgangen/synligaKanaler) — samma funktioner
  // tests/kanal-anatomi.test.ts låser, inte en egen uträkning här som kan glida isär.
  const channelConnected = useMemo<Record<ChannelKey, boolean>>(() => {
    const bas = tomKanalRecord(false);
    for (const k of KANAL_NYCKLAR) bas[k] = arAnsluten(k, ghlAccounts);
    bas.ig = !!igConn?.connected || bas.ig;
    return bas;
  }, [igConn, ghlAccounts]);
  // DEL 5 punkt 4: en koppling som FANNS men gått ut ska visas som "behöver förnyas",
  // aldrig försvinna tyst in i "ej kopplad" (som annars är omöjlig att skilja från
  // "aldrig kopplad" — det är precis den bugg beställningen pekar ut).
  const channelExpired = useMemo<Record<ChannelKey, boolean>>(() => {
    const bas = tomKanalRecord(false);
    for (const k of KANAL_NYCKLAR) bas[k] = arUtgangen(k, ghlAccounts);
    return bas;
  }, [ghlAccounts]);
  // DEL 5 punkt 1 + 3: kanalväljaren visar ALLA kanaler tenanten har kopplade i sin
  // planerare (ig/fb/li alltid synliga, övriga bara vid matchande koppling), filtrerat på
  // om inlägget faktiskt är video (postType "reel") mot varje kanals innehållskrav.
  const dynamiskaKanaler = useMemo(() => {
    const nycklar = synligaKanaler(ghlAccounts, postType === "reel");
    return CHANNELS_BAS.filter((c) => nycklar.includes(c.key));
  }, [ghlAccounts, postType]);

  // Effektiv caption för en kanal: den anpassade om den finns, annars grund-captionen.
  const capFor = useCallback((k: ChannelKey) => (channelCaptions[k]?.trim() ? channelCaptions[k] : caption), [channelCaptions, caption]);

  // Render-URL för preview-bilden (samma bild i alla enhetsramar). Karusell = första sliden.
  const channelRenderSrc = useMemo(
    () => `/studio/render/${templateId}?p=${encodeURIComponent(encodePayload(payload))}${isCarousel ? "&slide=0" : ""}`,
    [templateId, payload, isCarousel],
  );

  // Förikryssa kanaler efter vad klienten kopplat — en gång, när kopplingsstatus lästs in.
  useEffect(() => {
    if (channelsSeeded) return;
    if (igConn === null) return; // vänta tills IG-status finns
    if (ghlConnected === null) return; // vänta även på GHL-status (hämtas i båda lägena)
    const connected = CHANNELS.filter((c) => channelConnected[c.key]).map((c) => c.key);
    setSelectedChannels(connected.length ? connected : ["ig"]);
    setChannelsSeeded(true);
  }, [channelsSeeded, igConn, ghlConnected, customerMode, channelConnected]);

  const toggleChannel = useCallback((k: ChannelKey) => {
    setSelectedChannels((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  }, []);
  const setChannelCap = useCallback((k: ChannelKey, v: string) => {
    setChannelCaptions((prev) => ({ ...prev, [k]: v }));
  }, []);

  // Skriv en gång → AI anpassar grund-captionen per vald kanal (krok/längd/ton/hashtags).
  const adaptChannels = useCallback(async () => {
    const targets = selectedChannels.length ? selectedChannels : (["ig", "fb", "li"] as ChannelKey[]);
    setError(""); setAdapting(true);
    try {
      const r = await fetch("/api/studio/adapt-channel", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caption, headline: headline1, headline2, body, topic, slides, postType, channels: targets, compass }),
      });
      const d = await lasJson<any>(r);
      if (!r.ok) throw new Error(d.error || "Kunde inte anpassa per kanal");
      if (d.captions) setChannelCaptions((prev) => ({ ...prev, ...d.captions }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAdapting(false);
    }
  }, [selectedChannels, caption, headline1, headline2, body, topic, slides, postType, compass]);

  const copyChannelText = useCallback((k: ChannelKey) => {
    navigator.clipboard?.writeText(capFor(k)).then(() => { setCopied(k); setTimeout(() => setCopied(""), 1500); }).catch(() => {});
  }, [capFor]);

  // BILD-1: förhandsvisningen visar SAMMA canvas-output som publiceras (pixelparitet).
  // Debounce så drag i beskärningsramen inte renderar för varje pixel.
  useEffect(() => {
    if (mode !== "simple" || !imageUrl || !imageEdit) { setEditedPreview((p) => { if (p) URL.revokeObjectURL(p); return ""; }); return; }
    let aktiv = true;
    const t = setTimeout(async () => {
      try {
        const bm = await laddaBitmap(imageUrl);
        const blob = await renderImageEdit(bm, imageEdit);
        bm.close();
        if (!aktiv) return;
        const url = URL.createObjectURL(blob);
        setEditedPreview((prev) => { if (prev) URL.revokeObjectURL(prev); return url; });
      } catch { if (aktiv) setEditedPreview(""); }
    }, 250);
    return () => { aktiv = false; clearTimeout(t); };
  }, [mode, imageUrl, imageEdit]);

  // BILD-1: publiceringsbilden = exakt samma render som previewn, uppladdad till studio-images.
  const uploadEditedImage = useCallback(async (): Promise<string | null> => {
    if (!imageUrl || !imageEdit) return null;
    try {
      const bm = await laddaBitmap(imageUrl);
      const blob = await renderImageEdit(bm, imageEdit);
      bm.close();
      const file = new File([blob], `bild-${Date.now()}.jpg`, { type: "image/jpeg" });
      const r = await fetch("/api/studio/upload-url", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, mime: file.type, size: file.size }),
      });
      const d = await lasJson<any>(r);
      if (!r.ok) return null;
      const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
      const up = await sb.storage.from(d.bucket).uploadToSignedUrl(d.path, d.token, file);
      if (up.error) return null;
      return d.publicUrl as string;
    } catch {
      return null;
    }
  }, [imageUrl, imageEdit]);

  // Rendera den FÄRDIGA designen (bild + ram + text + badge) klient-sida till en PNG och
  // ladda upp den — så det är DESIGNEN som publiceras, inte råfotot. Playwright-export körs
  // bara lokalt (501 i moln); detta fångar samma live-render i webbläsaren. null = misslyckades.
  // Rendera + ladda upp designen till studio-images → durabel publik URL. null = misslyckades.
  // En blob → durabel publik URL i studio-images. null = misslyckades.
  const laddaUppBlob = useCallback(async (blob: Blob, namn: string): Promise<string | null> => {
    try {
      const file = new File([blob], namn, { type: "image/png" });
      const r = await fetch("/api/studio/upload-url", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, mime: file.type, size: file.size }),
      });
      const d = await lasJson<any>(r);
      if (!r.ok) return null;
      const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
      const up = await sb.storage.from(d.bucket).uploadToSignedUrl(d.path, d.token, file);
      if (up.error) return null;
      return d.publicUrl as string;
    } catch {
      return null;
    }
  }, []);

  const renderDesignPng = useCallback(async (): Promise<string | null> => {
    const blob = await captureDesignBlob();
    if (!blob) return null;
    return laddaUppBlob(blob, `design-${templateId}-${Date.now()}.png`);
  }, [captureDesignBlob, laddaUppBlob, templateId]);

  // AKUT-KARUSELL: alla slides renderade och uppladdade, i ordning. Tom lista = misslyckades.
  // Laddas upp sekventiellt: ordningen ÄR karusellens ordning, och en parallell upload som
  // svarar i annan takt hade gett slide 3 före slide 2 i Instagram-inlägget.
  const renderAllPngs = useCallback(async (): Promise<string[]> => {
    const blobs = await captureAllBlobs();
    if (!blobs.length) return [];
    const stamp = Date.now();
    const urls: string[] = [];
    for (let i = 0; i < blobs.length; i++) {
      const url = await laddaUppBlob(blobs[i], `design-${templateId}-${stamp}-${i + 1}.png`);
      if (!url) return [];
      urls.push(url);
    }
    return urls;
  }, [captureAllBlobs, laddaUppBlob, templateId]);

  // Spara den färdiga designen som en bild i mediabiblioteket (syns direkt + kan återanvändas).
  // Karusell sparar ALLA slides — annars ligger sex sjundedelar av arbetet kvar bara i webbläsaren.
  const [savingDesign, setSavingDesign] = useState(false);
  const saveDesignToLibrary = useCallback(async () => {
    setError(""); setSavingDesign(true);
    try {
      const urls = await renderAllPngs();
      if (!urls.length) throw new Error("Kunde inte skapa den färdiga bilden, prova igen om en stund.");
      setShowMedia(true);
      await loadMedia();
    } catch (e) { setError((e as Error).message); } finally { setSavingDesign(false); }
  }, [renderAllPngs, loadMedia]);

  // Publicera EN kanal: IG direkt (ig-graph), FB/LI via GHL (ghl-social) med den plattformens konton.
  const publishTo = useCallback(async (k: ChannelKey) => {
    setError(""); setPubBusy(k); setPubResult((p) => ({ ...p, [k]: "" }));
    try {
      // Skriv eget = publicera råfotot direkt (ingen mall). Reel = videon. Annars den
      // FÄRDIGA mall-designen (fallback: råfotot).
      // BILD-1: i Skriv eget publiceras den REDIGERADE bilden (samma pixlar som previewn),
      // inte råfotot. Utan redigering (t.ex. gammal draft) → råfotot som förut.
      // AKUT-KARUSELL: en karusell renderas till N bilder. slideUrls[0] är omslaget och
      // används som designUrl, så schemaläggning och GHL-vägen alltid har en bild att visa
      // även där karusell inte stöds. Under två slides är det inte en karusell.
      let slideUrls: string[] = [];
      if (mode !== "simple" && postType !== "reel" && isCarousel && slideCount >= 2) {
        slideUrls = await renderAllPngs();
        if (slideUrls.length !== slideCount) throw new Error("Kunde inte skapa alla karusellbilder. Prova igen om en stund.");
      }
      const designUrl = slideUrls.length
        ? slideUrls[0]
        : mode === "simple" ? ((await uploadEditedImage()) || imageUrl) : postType === "reel" ? imageUrl : (await renderDesignPng()) || imageUrl;
      // Schemalagt → säkerställ en biblioteks-rad så scheduled_at skrivs och inlägget syns i Kalendern.
      let postId = loadedPostId;
      if (scheduleDate && !postId) postId = await savePost(false);

      // Native IG-schemaläggning (UTAN GHL): tid vald + IG-direkt → köa jobb med den färdiga
      // bilden. Cronet publicerar vid rätt tid via IG Graph. FB/LI schemaläggs via GHL nedan.
      if (scheduleDate && k === "ig" && igConn?.connected) {
        const r = await fetch("/api/studio/schedule", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            channel: "ig-graph", caption: capFor("ig"), mediaUrl: designUrl, slideUrls, videoUrl, postType, format,
            title: headline1 || body.slice(0, 40) || "Inlägg",
            scheduledAt: new Date(scheduleDate).toISOString(), studioPostId: postId,
          }),
        });
        const d = await lasJson<any>(r);
        if (!r.ok) throw new Error(d.error || "Schemaläggning misslyckades");
        setPubResult((p) => ({ ...p, [k]: "ok" }));
        await refreshPosts(); loadMedia(); setScheduleRefresh((n) => n + 1);
        return;
      }

      let reqBody: Record<string, unknown>;
      // ★ KANAL-4: karusell till Instagram går i TVÅ steg. Ett anrop hann inte klart inom
      //   funktionens 60-sekunderstak (taket går inte att höja på Hobby-planen), och
      //   Håkans sjuslides-karusell föll med "det tog för lång tid". Nu förbereder vi
      //   containrarna i ett anrop och frågar sedan om publicering tills Meta är klar.
      if (k === "ig" && igConn?.connected && isCarousel && slideUrls.length >= 2) {
        const f = await fetch("/api/studio/publish", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postId, channel: "ig-graph", steg: "forbered", caption: capFor("ig"), slideUrls, format }),
        });
        const fd = await lasJson<any>(f);
        if (!f.ok) throw new Error(fd.error || "Kunde inte förbereda karusellen");

        // Meta behöver några sekunder per bild. Vi frågar i upp till två minuter, med
        // fem sekunder mellan försöken. Varje anrop är kort, så taket träffas aldrig.
        for (let n = 0; ; n++) {
          await new Promise((s) => setTimeout(s, 5000));
          const p = await fetch("/api/studio/publish", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ postId, channel: "ig-graph", steg: "publicera", creationId: fd.creationId, caption: capFor("ig") }),
          });
          const pd = await lasJson<any>(p);
          if (!p.ok) throw new Error(pd.error || "Publiceringen misslyckades");
          if (pd.steg === "publicerad") break;
          if (n >= 24) throw new Error("Instagram blev inte klar med bilderna i tid. Bilderna ligger kvar hos dem, prova publicera igen om en stund.");
        }
        setPubResult((p) => ({ ...p, [k]: "ok" }));
        await refreshPosts();
        loadMedia();
        return;
      }

      if (k === "ig" && igConn?.connected) {
        // Direkt till klientens Instagram — publiceras nu (inget utkast/schema).
        reqBody = { postId, channel: "ig-graph", caption: capFor("ig"), imageUrl: designUrl, slideUrls, videoUrl, format };
      } else {
        const platform = k === "fb" ? "facebook" : k === "li" ? "linkedin" : "instagram";
        const accs = ghlFor(platform).map((a) => a.id).filter((id) => selectedAccounts.includes(id));
        if (!accs.length) throw new Error(`Inga valda ${CHANNEL_BRAND[k].label}-konton i GHL.`);
        reqBody = { postId, channel: "ghl-social", accountIds: accs, caption: capFor(k), imageUrl: designUrl, slideUrls, videoUrl, format, scheduleDate: scheduleDate || undefined, publicera: publiceraDirekt };
      }
      const r = await fetch("/api/studio/publish", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reqBody),
      });
      const d = await lasJson<any>(r);
      if (!r.ok) throw new Error(d.error || "Publicering misslyckades");
      setPubResult((p) => ({ ...p, [k]: "ok" }));
      // BILD-3: publiceringskvitto med direktlänk till inlägget.
      if (k === "ig" && d.status === "published") {
        setPubReceipt({ permalink: d.permalink || "", tid: new Date().toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" }), format });
      }
      await refreshPosts();
      loadMedia(); // den renderade designen syns nu i mediabiblioteket
    } catch (e) {
      setError((e as Error).message);
      setPubResult((p) => ({ ...p, [k]: "err" }));
    } finally {
      setPubBusy("");
    }
  }, [igConn, loadedPostId, capFor, imageUrl, videoUrl, format, postType, mode, isCarousel, slideCount, renderAllPngs, renderDesignPng, uploadEditedImage, ghlFor, selectedAccounts, scheduleDate, publiceraDirekt, refreshPosts, loadMedia, savePost, headline1, body]);

  const fileRef = useRef<HTMLInputElement>(null);
  const simpleFileRef = useRef<HTMLInputElement>(null);
  const inputCls = "w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-gray-400 focus:ring-2 focus:ring-gray-100 outline-none";

  // ── Snabbstart (Greta-vägen): tre tydliga ingångar när inlägget är tomt ──
  const [quickBusy, setQuickBusy] = useState(false);
  const visaSnabbstart = !loadedPostId && mode !== "improve" && !imageUrl && !videoUrl
    && !headline1.trim() && !body.trim() && !caption.trim()
    && slides.every((s) => !s.imageUrl && !s.headline?.trim() && !s.body?.trim());

  // "Jag har ett foto" → Skriv eget + öppna filväljaren direkt (klicket är user-gesture).
  const startMedFoto = useCallback(() => {
    setMode("simple");
    setTimeout(() => simpleFileRef.current?.click(), 350);
  }, []);

  // "Jag har en idé" → mall-läget med fokus i ämnesfältet, så nästa steg är självklart.
  const startMedIde = useCallback(() => {
    setMode("template");
    setTimeout(() => {
      const el = document.getElementById("studio-amne") as HTMLInputElement | null;
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.focus();
    }, 350);
  }, []);

  // "Skapa åt mig" → tre förslag ur profilen som ANVÄNDAREN väljer bland (aldrig ett
  // auto-valt). Efter valet (applySuggestion) genereras bilden ur den VALDA texten.
  const skapaAtMig = useCallback(async () => {
    setMode("template"); setQuickBusy(true); setError("");
    try {
      const r = await fetch("/api/studio/suggest-text", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, format, topic: "", videoUrl }),
      });
      const d = await lasJson<any>(r);
      if (!r.ok) throw new Error(d.error || "Kunde inte skapa förslag, försök igen.");
      setSuggestions(Array.isArray(d.suggestions) ? d.suggestions : []);
      setSuggestMeddelande(typeof d.meddelande === "string" ? d.meddelande : "");
      quickAutoImage.current = true; // efter användarens val: generera bild ur vald text
      setTimeout(() => document.getElementById("studio-forslag")?.scrollIntoView({ behavior: "smooth", block: "center" }), 300);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setQuickBusy(false);
    }
  }, [templateId, format]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Header — premium band med mjuk klientfärgs-glöd */}
        <div className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm px-5 py-5 md:px-6">
          <div className="absolute -top-20 -right-10 w-64 h-64 rounded-full blur-3xl pointer-events-none" style={{ background: `${primary}14` }} />
          <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <span className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm" style={{ background: primary }}>
                <ImageIcon className="w-6 h-6 text-white" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-display font-bold text-2xl text-gray-900">Skapa inlägg</h1>
                  <FunctionGuide
                    primaryColor={primary}
                    title="Skapa inlägg"
                    what="Bygger färdiga inlägg till Instagram, Facebook och LinkedIn: bild, text på bilden och bildtext i din röst, utan Canva."
                    how="Välj mall och format, lägg till en bild (egen, sök eller genererad), skriv eller låt Skrivhjälpen föreslå rubrik och bildtext, förhandsgranska per kanal och schemalägg eller publicera."
                    tips={["Fyll i din brand-profil först så låter texten mer som du.", "Klicka 'Ge mig 3 idéer' för att jämföra olika krokar.", "Schemalägg direkt så hamnar inlägget i kalendern."]}
                  />
                </div>
                <p className="text-sm text-gray-500 mt-0.5">Färdiga inlägg till Instagram, Facebook och LinkedIn. I din röst, utan Canva.{client ? ` · ${client.name}` : ""}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={() => saveDraftPersistent()} className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50">
                {saved ? <Check className="w-4 h-4 text-emerald-600" /> : <Save className="w-4 h-4" />} Spara utkast
              </button>
            </div>
          </div>
        </div>

        {/* UTKAST-1: allt du hade kvar efter en omladdning — plus vägen att börja om. */}
        <UtkastRad aterupptaget={aterupptaget} sparatVid={sparatVid} onBorjaOm={borjaOm} />

        {/* PROFIL-1: mjuk grind — blockerar inget, men säger var kvaliteten sitter. */}
        <ProfilGrind href={customerMode ? "/k/profil" : "/dashboard/profil"} />

        {error && (
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {/* Snabbstart (Greta-vägen): tre kort som svarar på "hur börjar jag?" i användarens
            egna ord och leder rätt in i läget + första åtgärden. Visas bara när inlägget är
            tomt — så fort innehåll finns försvinner de och stör aldrig pågående arbete. */}
        {visaSnabbstart && (
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">Kom igång: välj det som stämmer</div>
            <div className="grid sm:grid-cols-3 gap-3">
              <button onClick={startMedFoto}
                className="text-left rounded-2xl border border-gray-100 bg-white p-4 shadow-sm hover:shadow-md hover:border-gray-200 transition-all flex items-start gap-3">
                <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${primary}14` }}>
                  <Upload className="w-5 h-5" style={{ color: primary }} />
                </span>
                <span className="leading-snug">
                  <span className="block text-sm font-bold text-gray-900">Jag har ett foto</span>
                  <span className="block text-xs text-gray-500 mt-0.5">Ladda upp, anpassa till Instagram och skriv texten.</span>
                </span>
              </button>
              <button onClick={startMedIde}
                className="text-left rounded-2xl border border-gray-100 bg-white p-4 shadow-sm hover:shadow-md hover:border-gray-200 transition-all flex items-start gap-3">
                <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${primary}14` }}>
                  <Sparkles className="w-5 h-5" style={{ color: primary }} />
                </span>
                <span className="leading-snug">
                  <span className="block text-sm font-bold text-gray-900">Jag har en idé</span>
                  <span className="block text-xs text-gray-500 mt-0.5">Skriv ämnet, så föreslår Skrivhjälpen text och bild.</span>
                </span>
              </button>
              <button onClick={skapaAtMig} disabled={quickBusy}
                className="text-left rounded-2xl border border-gray-100 bg-white p-4 shadow-sm hover:shadow-md hover:border-gray-200 transition-all flex items-start gap-3 disabled:opacity-60">
                <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: primary }}>
                  {quickBusy ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Wand2 className="w-5 h-5 text-white" />}
                </span>
                <span className="leading-snug">
                  <span className="block text-sm font-bold text-gray-900">{quickBusy ? "Skapar förslag…" : "Skapa åt mig"}</span>
                  <span className="block text-xs text-gray-500 mt-0.5">Få ett färdigt förslag ur er profil, justera och publicera.</span>
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Lägesväxel — pedagogiskt val av arbetssätt, premium segmenterad kontroll */}
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">Hur vill du skapa?</div>
          <div className="inline-flex rounded-2xl border border-gray-100 bg-white p-1.5 gap-1.5 shadow-sm">
            {([
              { k: "simple", label: "Skriv eget", hint: "Text + bild, klart", icon: Pencil },
              { k: "template", label: "Mallar & guide", hint: "Steg för steg", icon: LayoutGrid },
              { k: "improve", label: "Förbättra befintligt", hint: "Klistra in, få skarpare", icon: Wand2 },
            ] as const).map((m) => {
              const on = mode === m.k;
              const Icon = m.icon;
              return (
                <button key={m.k} onClick={() => setMode(m.k)}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-xl transition-colors"
                  style={on ? { background: `${primary}12` } : {}}>
                  <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors"
                    style={{ background: on ? primary : "#f3f4f6" }}>
                    <Icon className="w-[18px] h-[18px]" style={{ color: on ? "#fff" : "#9ca3af" }} />
                  </span>
                  <span className="text-left leading-tight">
                    <span className="block text-sm font-bold" style={{ color: on ? primary : "#374151" }}>{m.label}</span>
                    <span className="block text-xs text-gray-400 font-normal">{m.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── FÖRBÄTTRA BEFINTLIGT — klistra in ett inlägg, få analys + skarpare version + DISC ── */}
        {mode === "improve" && (
          <div className="space-y-6">
            <section className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-3">
              <div>
                <h2 className="font-display font-bold text-gray-900 text-lg flex items-center gap-2.5">
                  <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${primary}1a` }}>
                    <Wand2 className="w-[18px] h-[18px]" style={{ color: primary }} />
                  </span>
                  Klistra in ditt inlägg
                </h2>
                <p className="text-sm text-gray-500 mt-1 ml-12">Skrivhjälpen läser det, säger vad som redan är bra och vad som saknas, och skriver en skarpare version i din röst.</p>
              </div>
              <SmartTextarea value={impText} onChange={(e) => setImpText(e.target.value)} rows={7}
                placeholder="Klistra in inlägget du vill förbättra, eller prata in det." className={inputCls} />
              <button onClick={improvePost} disabled={impBusy || !impText.trim()}
                className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-lg text-white shadow-sm hover:opacity-90 disabled:opacity-40"
                style={{ background: primary }}>
                {impBusy ? <><Loader2 className="w-4 h-4 animate-spin" /> Läser och skriver om…</> : <><Wand2 className="w-4 h-4" /> Förbättra</>}
              </button>
            </section>

            {impAnalysis.length > 0 && (
              <section className="rounded-2xl border p-5 shadow-sm" style={{ borderColor: `${primary}33`, background: `${primary}0a` }}>
                <h3 className="font-display font-bold text-gray-900 text-base flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4" style={{ color: primary }} /> Så här läser jag inlägget
                </h3>
                <ul className="space-y-1.5">
                  {impAnalysis.map((a, i) => (
                    <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: primary }} />{a}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {impImproved && (
              <>
                <div className="grid lg:grid-cols-2 gap-6 items-start">
                  <section className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Ditt original</h3>
                    <p className="text-sm text-gray-500 whitespace-pre-wrap leading-relaxed">{impText}</p>
                  </section>
                  <section className="bg-white border rounded-2xl p-5 shadow-sm" style={{ borderColor: `${primary}55` }}>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: primary }}>Förbättrad version</h3>
                      <button onClick={() => copyText("main", impImproved)}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-800">
                        {impCopied === "main" ? <><Check className="w-3.5 h-3.5 text-emerald-600" /> Kopierad</> : <><Copy className="w-3.5 h-3.5" /> Kopiera</>}
                      </button>
                    </div>
                    <p className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">{impImproved}</p>
                    {impProfileMatch !== null && (
                      <p className="text-xs text-gray-400 mt-3 pt-3 border-t border-gray-100">
                        {impProfileMatch
                          ? "Förbättrat med stöd av din Brand-profil."
                          : "Förbättrat utifrån inläggets egen röst och målgrupp."}
                      </p>
                    )}
                  </section>
                </div>

                <div>
                  <button onClick={improveDisc} disabled={impDiscBusy}
                    className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-lg bg-white border-2 hover:bg-gray-50 disabled:opacity-40"
                    style={{ borderColor: `${primary}55`, color: primary }}>
                    {impDiscBusy ? <><Loader2 className="w-4 h-4 animate-spin" /> Skapar fyra varianter…</> : <><LayoutGrid className="w-4 h-4" /> Skapa fyra varianter</>}
                  </button>
                  <p className="text-xs text-gray-400 mt-1.5">En version per personlighetstyp, så du når fler med samma budskap.</p>
                </div>
              </>
            )}

            {impDisc.length > 0 && (
              <div className="grid md:grid-cols-2 gap-4">
                {impDisc.map((v) => {
                  const dot: Record<string, string> = { röd: "#dc2626", gul: "#f59e0b", grön: "#059669", blå: "#2563eb" };
                  return (
                    <section key={v.letter} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="inline-flex items-center gap-2 text-sm font-bold text-gray-900">
                          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: dot[v.color] || "#9ca3af" }} />
                          {v.color.charAt(0).toUpperCase() + v.color.slice(1)}
                          <span className="text-xs font-normal text-gray-400">{v.label}</span>
                        </span>
                        <button onClick={() => copyText(v.letter, v.text)}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-800">
                          {impCopied === v.letter ? <><Check className="w-3.5 h-3.5 text-emerald-600" /> Kopierad</> : <><Copy className="w-3.5 h-3.5" /> Kopiera</>}
                        </button>
                      </div>
                      <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{v.text}</p>
                    </section>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── SKRIV EGET (enkelt läge) — text + bild, publicera. Ingen mall. ── */}
        {mode === "simple" && (
          <div className="grid lg:grid-cols-2 gap-6 items-stretch">
            {/* Skriv */}
            <section className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display font-bold text-gray-900 text-lg flex items-center gap-2.5">
                  <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${primary}1a` }}>
                    <Pencil className="w-[18px] h-[18px]" style={{ color: primary }} />
                  </span>
                  Skriv ditt inlägg
                </h2>
                <button onClick={suggestCaption} disabled={suggestingCaption}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg border hover:bg-white disabled:opacity-40"
                  style={{ borderColor: `${primary}55`, color: primary }}>
                  {suggestingCaption ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />} Hjälp mig skriva
                </button>
              </div>
              <SmartTextarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={7}
                placeholder="Skriv precis det du vill säga. Eller tryck 'Hjälp mig skriva' så föreslår Skrivhjälpen en text i din röst."
                className={inputCls} />
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                <label className="block text-sm font-medium text-gray-600 mb-1.5">Vill du ha hjälp att skriva? Berätta kort vad det handlar om:</label>
                <input value={topic} onChange={(e) => setTopic(e.target.value)}
                  // Håkans fynd 10/8, två fel i en platshållare:
                  //  1. "sommarens buketter" är en blomsterbutik. Den stod hos AluCon, som
                  //     säljer profilsystem i aluminium — samma familj som veckoplanens
                  //     platshållare (FIX-1 C3b), skriven för EN kund och läst som en
                  //     instruktion av alla andra. Klientobjektet här bär ingen bransch,
                  //     så exemplet är neutralt i stället för gissat.
                  //  2. "20% på tisdagar" lärde ut att skriva en RABATT. Prisregeln
                  //     förbjuder priser i inlägg, och användarens egen text är den enda
                  //     väg som öppnar undantaget (anvandarText i prompt-core). Rutan bjöd
                  //     alltså in precis det som annars är spärrat.
                  // Exemplen nedan lär ut FORMATET — ett kort ämne — utan bransch och utan tal.
                  placeholder='t.ex. "en fråga vi får ofta" eller "det här är nytt hos oss"'
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-base outline-none focus:border-gray-400" />
              </div>
            </section>

            {/* Bild — flex-kolumn så släpp-ytan växer och fyller höjden (lika högt som Skriv). */}
            <section className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display font-bold text-gray-900 text-lg flex items-center gap-2.5">
                  <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${primary}1a` }}>
                    <ImageIcon className="w-[18px] h-[18px]" style={{ color: primary }} />
                  </span>
                  Bild <span className="text-sm font-normal text-gray-400">(valfritt)</span>
                </h2>
                {imageUrl && (
                  <button onClick={() => setImageUrl("")} className="text-xs text-gray-400 hover:text-red-600 inline-flex items-center gap-1">
                    <Trash2 className="w-3.5 h-3.5" /> Ta bort
                  </button>
                )}
              </div>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}
                onClick={() => simpleFileRef.current?.click()}
                className="rounded-xl border-2 border-dashed border-gray-200 hover:border-gray-300 cursor-pointer p-6 text-center transition-colors flex-1 flex flex-col items-center justify-center min-h-[140px]">
                {uploading ? (
                  <div className="flex items-center justify-center gap-2 text-sm text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> Laddar upp…</div>
                ) : imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imageUrl} alt="" className="max-h-56 mx-auto rounded-lg" />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-sm text-gray-500">
                    <span className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${primary}1a` }}>
                      <Upload className="w-5 h-5" style={{ color: primary }} />
                    </span>
                    Dra hit en bild, <strong>klistra in</strong> (Ctrl+V) eller klicka för att ladda upp
                  </div>
                )}
                <input ref={simpleFileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
              </div>
              {/* BILD-1: anpassa fotot till IG-format direkt här — aldrig mer Canva-omväg */}
              {imageUrl && (
                <BildRedigerare src={imageUrl} edit={imageEdit} onChange={setImageEdit}
                  primary={primary} brandColor={brand?.colors?.primary || primary} />
              )}
              <button onClick={toggleMedia}
                className="w-full inline-flex items-center justify-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50">
                <FolderOpen className="w-4 h-4" /> {showMedia ? "Dölj mina bilder" : "Mina bilder"}
              </button>
              {showMedia && (
                loadingMedia ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500 justify-center py-4"><Loader2 className="w-4 h-4 animate-spin" /> Hämtar dina bilder…</div>
                ) : mediaItems.length === 0 ? (
                  <div className="text-sm text-gray-500 text-center py-4">Inga sparade bilder än. Bilder du laddar upp dyker upp här.</div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {mediaItems.map((m) => (
                      <div key={m.path} className="relative group rounded-lg overflow-hidden border-2 aspect-square" style={{ borderColor: imageUrl === m.url ? primary : "transparent" }}>
                        <button onClick={() => setImageUrl(m.url)} className="w-full h-full" title="Använd den här bilden">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={m.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                        </button>
                        <button onClick={() => deleteMedia(m.path)} disabled={deletingPath === m.path} title="Ta bort bilden"
                          className="absolute top-1 right-1 w-6 h-6 rounded-md bg-white/90 border border-gray-200 flex items-center justify-center text-gray-500 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-100">
                          {deletingPath === m.path ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    ))}
                  </div>
                )
              )}
              {/* Bildhjälpen — skapa eller sök en passande bild ur din text (ingen egen bild krävs) */}
              <div className="pt-3 border-t border-gray-100 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-medium text-gray-600">Ingen egen bild? Låt Bildhjälpen föreslå en som passar din text.</div>
                  {/* K2-2: saldot syns där bilden faktiskt skapas, inte bara på egen sida. */}
                  {creditSaldo && (
                    <a href="/k/credits"
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                        creditSaldo.saldo <= 0 ? "bg-red-50 text-red-700"
                          : creditSaldo.procentKvar < 15 ? "bg-amber-50 text-amber-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                      title="Så mycket har du kvar av månadens bilder och video">
                      {creditSaldo.saldo <= 0
                        ? "Månadens bilder är slut"
                        : `${creditSaldo.saldo} credits kvar · en bild kostar ${creditSaldo.bildpris}`}
                    </a>
                  )}
                </div>
                {/* B3: exakt text i bilden — eget fält, stavas exakt via verifieringsslingan */}
                <input
                  value={imgText} onChange={(e) => setImgText(e.target.value)} maxLength={120}
                  placeholder="Text i bilden (valfri), t.ex. Öppet i sommar"
                  className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2"
                  style={{ ["--tw-ring-color" as string]: `${primary}55` }}
                />
                {/* BILD-10 (10/8): Bildhjälpen ritar inte längre text på egen hand — den
                    kunde inte stava ("HÄLLBARA PROFILER FÖR FRAMITDEN"). Det här fältet är
                    numera den ENDA vägen till ord i bilden, och texten ritas av oss.
                    Antyd aldrig att modellens egna skyltar är säkrade — de finns inte. */}
                <p className="text-xs text-gray-500 leading-relaxed">
                  Ska ett ord synas i bilden? Skriv det här, då ritar vi det, och det blir alltid rättstavat.
                  Bildhjälpen skriver inga egna ord i bilden.
                </p>
                <div className="flex gap-2">
                  <button onClick={() => suggestImage("ai")} disabled={!!searchingImg}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 text-sm font-semibold px-3 py-2.5 rounded-lg text-white shadow-sm hover:opacity-90 disabled:opacity-40"
                    style={{ background: primary }}>
                    {searchingImg === "ai" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />} Skapa bild åt mig
                  </button>
                  <button onClick={() => suggestImage("stock")} disabled={!!searchingImg}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 text-sm font-medium px-3 py-2.5 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40">
                    {searchingImg === "stock" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Sök foto
                  </button>
                </div>
                {imgResults.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {imgResults.map((p, i) => (
                      <button key={i} onClick={() => setImage(p.url)} title={p.credit}
                        className="rounded-lg overflow-hidden border-2 transition-colors aspect-square"
                        style={{ borderColor: imageUrl === p.url ? primary : "transparent" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.thumb} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
                {/* B3: slingans utfall — godkänt eller tydlig avvikelse-varning */}
                {imgTextInfo && (
                  imgTextInfo.verifierad ? (
                    <div className="text-xs rounded-lg px-3 py-2 bg-emerald-50 text-emerald-700 border border-emerald-100">
                      {imgTextInfo.metod === "programmatisk"
                        ? "Texten lades på stavningssäkert (bilden skapades utan text, texten renderades exakt ovanpå)."
                        : `Texten i bilden är kontrollerad och stämmer (godkänd på försök ${imgTextInfo.forsok}).`}
                    </div>
                  ) : (
                    <div className="text-xs rounded-lg px-3 py-2 bg-amber-50 text-amber-800 border border-amber-200">
                      Texten i bilden avviker: ”{imgTextInfo.avlastText || "ingen text hittades"}”. Prova igen eller byt formulering.
                    </div>
                  )
                )}
              </div>
              <p className="text-sm text-gray-500">Instagram kräver en bild. Facebook och LinkedIn funkar även utan.</p>
            </section>
          </div>
        )}

        {/* ── MALLAR & GUIDE (stegvis läge) ── */}
        {mode === "template" && (<>
        {/* Så funkar det — numrerad stepper i eget kort (pedagogisk översikt av flödet) */}
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm px-5 py-4">
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { n: 1, t: "Ämne" },
              { n: 2, t: "Format & mall" },
              { n: 3, t: "Bild" },
              { n: 4, t: "Text på bilden" },
              { n: 5, t: "Bildtext" },
              { n: 6, t: "Kanaler & publicera" },
            ].map((s, i, arr) => (
              <span key={s.n} className="inline-flex items-center gap-1.5">
                <span className="inline-flex items-center gap-2">
                  <StegNr n={s.n} color={STEG_FARGER[s.n - 1]} />
                  <span className="text-sm font-semibold text-gray-700">{s.t}</span>
                </span>
                {i < arr.length - 1 && <span className="w-5 h-px bg-gray-200 mx-1.5" />}
              </span>
            ))}
          </div>
        </div>

        <div className="grid lg:grid-cols-[1fr_360px] gap-8 items-start">
          {/* ── Vänster: formulär ── */}
          <div className="space-y-6">
            {/* VECKA-2: beskedet när ett planerat inlägg öppnas. Utan det ser sidan ut som en
                tom skaparyta och det redan skrivna arbetet syns inte. */}
            {oppnadeUnderlag && !headline1.trim() && !body.trim() && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
                <p className="font-semibold">Bildtexten är redan skriven, den ligger i steg 5.</p>
                <p className="mt-1 leading-relaxed">
                  Det som är kvar är <strong>texten på bilden</strong> (steg 4, tre förslag skrivs fram åt dig här nedan) och en <strong>bild</strong> (steg 3).
                  Texten på bilden skrivs i affischformat och kopieras aldrig ur bildtexten, därför är fältet tomt när du kommer hit.
                </p>
              </div>
            )}

            {/* Steg 1 · Ämne — vad ska inlägget handla om? Välj/skapa först, sen stil & bild. */}
            <section className="bg-white border rounded-2xl p-6 space-y-4" style={stegRam(STEG_FARGER[0])}>
              <div>
                <h2 className="font-display font-bold text-gray-900 text-lg flex items-center gap-2"><StegNr n={1} color={STEG_FARGER[0]} /> Ämne</h2>
                <p className="text-sm text-gray-500 mt-0.5 ml-9">Vad ska inlägget handla om? Skriv en rad, eller få 3 idéer att välja bland.</p>
              </div>
              {/* VECKA-2 (Håkans fynd 11/8): veckoplanens underlag är FLERRADIGT
                  ("Veckotema: …
                  Dagens vinkel: …"). I en enradig ruta kollapsar radbrytningen och
                  det läste som ett hopklistrat fel: "…för fastigheterDagens vinkel:". Fältet
                  växer till flera rader när underlaget har radbrytningar, och är en vanlig
                  enradig ruta annars. */}
              <div className="flex flex-col sm:flex-row gap-2">
                {topic.includes("\n") ? (
                  <textarea id="studio-amne" value={topic} onChange={(e) => setTopic(e.target.value)} rows={Math.min(5, topic.split("\n").length + 1)}
                    className={`${inputCls} leading-relaxed`} style={{ whiteSpace: "pre-wrap" }} />
                ) : (
                  <input id="studio-amne" value={topic} onChange={(e) => setTopic(e.target.value)}
                    placeholder={isCarousel ? "Ämne för karusellen, t.ex. 3 misstag att undvika, 5 tips" : "t.ex. ett erbjudande, en nyhet, veckans bukett"}
                    className={inputCls} />
                )}
                {!isCarousel && (
                  <button onClick={() => suggest()} disabled={suggesting}
                    className="shrink-0 inline-flex items-center justify-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-lg text-white shadow-sm hover:opacity-90 disabled:opacity-40"
                    style={{ background: STEG_FARGER[0] }}>
                    {suggesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />} Ge mig 3 idéer
                  </button>
                )}
              </div>
              {!isCarousel && suggestions.length > 0 && (
                <div className="space-y-2">
                  {/* KVALITET-3/3: förslagen ÄR färdigskriven text till bilden — skriven ur
                      ämnet och din röst, aldrig en avskrift av ämnet eller bildtexten. */}
                  <div className="text-xs font-medium text-gray-500">
                    {suggestions.length === 1
                      ? "Välj text till bilden. Förslaget är skrivet ur ditt ämne och din röst:"
                      : `Välj text till bilden. Alla ${suggestions.length === 3 ? "tre" : suggestions.length} är skrivna ur ditt ämne och din röst:`}
                  </div>
                  {/* KVALITET-3/2a: löftet var tre — säg det rakt ut när färre levererades,
                      i stället för att låta raden ovan låtsas att allt gick som utlovat. */}
                  {suggestMeddelande && (
                    <div className="text-xs text-amber-600">{suggestMeddelande}.</div>
                  )}
                  {suggestions.map((s, i) => (
                    <button key={i} onClick={() => applySuggestion(s)}
                      className="w-full text-left rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 p-3 transition-colors">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: `${primary}1a`, color: primary }}>
                          {HOOK_LABEL[s.hookType] || "Hook"}
                        </span>
                        <span className="text-sm font-bold text-gray-900 truncate">{s.headline1}</span>
                      </div>
                      <div className="text-xs text-gray-500 line-clamp-2">{s.beskrivning || [s.headline2, s.body].filter(Boolean).join(". ")}</div>
                    </button>
                  ))}
                </div>
              )}
              {isCarousel && <p className="text-xs text-gray-400">Skriv ämnet för karusellen här. Du bygger och genererar själva bilderna i steg 4.</p>}
            </section>

            {/* Steg 2 & 3 sida vid sida på breda skärmar (≥1536px) — använd bredden, kortare
                flöde. Under det staplas de så kolumnerna aldrig blir för trånga. */}
            <div className="grid 2xl:grid-cols-2 gap-6 items-stretch">
            {/* Steg 2 · Format & mall — flex-kolumn så mallrutorna växer och fyller höjden
                när kortet sträcks till samma höjd som Bild (ingen tom yta i botten). */}
            <section className="bg-white border rounded-2xl p-6 flex flex-col gap-4" style={stegRam(STEG_FARGER[1])}>
              <h2 className="font-display font-bold text-gray-900 text-lg flex items-center gap-2"><StegNr n={2} color={STEG_FARGER[1]} /> Format &amp; mall</h2>
              <div className="grid grid-cols-2 gap-3 flex-1 auto-rows-fr">
                {availableTemplates.map((t) => {
                  const active = t.id === templateId;
                  const rec = isRecommendedFormat(t, contentFormats as never);
                  return (
                    <button key={t.id} onClick={() => setTemplateId(t.id)}
                      className="text-left rounded-xl border px-4 py-3 transition-colors relative flex flex-col justify-center"
                      style={active ? { borderColor: primary, background: `${primary}0f` } : { borderColor: "#e5e7eb" }}>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-gray-900">{t.name}</span>
                        {rec && <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full" style={{ background: `${primary}1a`, color: primary }}>Föreslås</span>}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">{t.freeSize ? "Fri storlek" : t.formats.map((f) => FORMAT_LABELS[f]).join(" · ")}</div>
                    </button>
                  );
                })}
              </div>
              {meta.freeSize ? (
                <SkarmStorlekValjare
                  value={customSize}
                  onChange={setCustomSize}
                  saved={brand?.screenFormats || []}
                  primary={primary}
                  onSaved={(sf) => setBrand((b) => (b ? { ...b, screenFormats: sf } : b))}
                />
              ) : (
                <div className="flex flex-wrap gap-2">
                  {meta.formats.map((f) => {
                    const active = f === format;
                    return (
                      <button key={f} onClick={() => setFormat(f)}
                        className="flex-1 min-w-[90px] rounded-lg border px-3 py-2 text-sm font-medium transition-colors"
                        style={active ? { borderColor: primary, color: primary, background: `${primary}0f` } : { borderColor: "#e5e7eb", color: "#374151" }}>
                        {FORMAT_LABELS[f]}
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Foto */}
            {/* Steg 3 · Bild */}
            <section className="bg-white border rounded-2xl p-6 space-y-4" style={stegRam(STEG_FARGER[2])}>
              <h2 className="font-display font-bold text-gray-900 text-lg flex items-center gap-2"><StegNr n={3} color={STEG_FARGER[2]} /> Bild</h2>

              {isCarousel && (
                <div className="rounded-xl border p-3 text-xs text-gray-600" style={{ borderColor: `${primary}33`, background: `${primary}0a` }}>
                  Bilden läggs på <strong>slide {slideIdx + 1}/{slideCount}</strong> (den du ser i förhandsvisningen). Bläddra med pilarna för att sätta bild på fler slides, eller använd <strong>Skapa bilder till alla slides</strong> i steg 4.
                </div>
              )}

              {/* Mallen visar en bild — mjuk hjälp, inte varning */}
              {needsImage && !curImg && (
                <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: `${primary}33`, background: `${primary}0a` }}>
                  <div className="text-xs text-gray-600">Den här mallen visar en bild. Ladda upp din egen nedan, eller låt oss skapa en bild i din stil ur innehållet.</div>
                  <button onClick={() => generateOnBrandImage()} disabled={searchingImg === "ai"}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg text-white shadow-sm hover:opacity-90 disabled:opacity-40"
                    style={{ background: primary }}>
                    {searchingImg === "ai" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />} Skapa bild i din stil
                  </button>
                </div>
              )}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}
                onClick={() => fileRef.current?.click()}
                className="rounded-xl border-2 border-dashed border-gray-200 hover:border-gray-300 cursor-pointer p-6 text-center transition-colors"
              >
                {uploading ? (
                  <div className="flex items-center justify-center gap-2 text-sm text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> Laddar upp…</div>
                ) : curImg ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={curImg} alt="" className="max-h-40 mx-auto rounded-lg" />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-sm text-gray-500">
                    <span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${primary}1a` }}>
                      <Upload className="w-[18px] h-[18px]" style={{ color: primary }} />
                    </span>
                    Dra hit en bild eller klicka för att ladda upp
                  </div>
                )}
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
              </div>

              {/* Håkans fynd 20/8: format och "Hela bilden" fanns bara i Skriv eget
                  (BildRedigerare) — här i Mallar & guide fick man beskärningen (cover)
                  hårdkodad utan att kunna se eller ändra formatet där bilden faktiskt sitter,
                  bara uppe i steg 2. Samma två verktyg, återanvända här, bredvid fotot. */}
              {!isCarousel && (
                meta.freeSize ? (
                  <SkarmStorlekValjare value={customSize} onChange={setCustomSize} saved={brand?.screenFormats || []}
                    primary={primary} onSaved={(sf) => setBrand((b) => (b ? { ...b, screenFormats: sf } : b))} />
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {meta.formats.map((f) => {
                      const active = f === format;
                      return (
                        <button key={f} onClick={() => setFormat(f)}
                          className="flex-1 min-w-[90px] rounded-lg border px-3 py-2 text-sm font-medium transition-colors"
                          style={active ? { borderColor: primary, color: primary, background: `${primary}0f` } : { borderColor: "#e5e7eb", color: "#374151" }}>
                          {FORMAT_LABELS[f]}
                        </button>
                      );
                    })}
                  </div>
                )
              )}
              {curImg && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-500">Bilden:</span>
                  <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
                    <button onClick={() => setOv({ imageFit: "beskar" })}
                      className="px-2.5 py-1.5 inline-flex items-center gap-1"
                      style={overrides.imageFit !== "hela" ? { background: primary, color: "#fff" } : { background: "#fff", color: "#374151" }}>
                      <Crop className="w-3.5 h-3.5" /> Beskär
                    </button>
                    <button onClick={() => setOv({ imageFit: "hela" })}
                      className="px-2.5 py-1.5 inline-flex items-center gap-1"
                      style={overrides.imageFit === "hela" ? { background: primary, color: "#fff" } : { background: "#fff", color: "#374151" }}>
                      <Expand className="w-3.5 h-3.5" /> Hela bilden
                    </button>
                  </div>
                </div>
              )}

              {/* BILD-1: fokuspunkt-reglaget ersatt — bilden justeras direkt i förhandsvisningen */}
              {curImg && (
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-xs text-gray-400">Justera bilden direkt i förhandsvisningen: dra för att flytta, scrolla för att zooma.</p>
                  {/* En karusell-slide är komplett UTAN bild — då ritas den i varumärkets
                      färg (krok = primär, avslut = mörk, punkt = papper). Vägen tillbaka
                      saknades: en genererad bild gick att byta och att ändra, men inte att
                      ta bort. Ångrade man sig fanns ingen väg till textslidens utseende. */}
                  {isCarousel && (
                    <button onClick={() => updateSlide(slideIdx, { imageUrl: "" })}
                      className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900">
                      <Trash2 className="w-3.5 h-3.5" /> Ta bort bilden på slide {slideIdx + 1}
                    </button>
                  )}
                </div>
              )}

              {/* G-6: omdöme om AI-bilden. Visas BARA när bilden faktiskt kommer ur en
                  generering vi kan peka på — en tumme utan koppling hade varit samma
                  tomma löfte som före G-6. */}
              {curImg && bildGenerationId && (
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 space-y-2">
                  {/* BILD-11 (Håkans fynd 10/8): han skrev "för mörk" HÄR och undrade varför
                      "Ändra bild" inte gick att klicka — den rutan sitter längre ner och var
                      tom. Två rutor med samma utseende, en rad ifrån varandra, och bara den
                      ena tänder knappen. Rubrikerna säger nu vilken bild var ruta gäller. */}
                  <label className="block text-xs font-medium text-gray-600">
                    Passade bilden? Svaret ändrar inte den här bilden, det styr NÄSTA bild vi gör åt dig.
                  </label>
                  <SmartTextarea
                    value={bildOmdomeKommentar}
                    onChange={(e) => setBildOmdomeKommentar(e.target.value)}
                    rows={2}
                    placeholder='Valfritt: skriv varför. T.ex. "för mörkt", "fel sorts kunder" eller "precis rätt känsla"'
                    className={inputCls}
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => sparaBildOmdome(1)}
                      className={`inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg border transition-colors ${bildOmdome === 1 ? "bg-emerald-600 text-white border-emerald-600" : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"}`}
                    >
                      <ThumbsUp className="w-4 h-4" /> Bra bild
                    </button>
                    <button
                      onClick={() => sparaBildOmdome(-1)}
                      className={`inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg border transition-colors ${bildOmdome === -1 ? "bg-red-600 text-white border-red-600" : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"}`}
                    >
                      <ThumbsDown className="w-4 h-4" /> Passar inte
                    </button>
                    {bildOmdomeSparat && <span className="text-xs text-gray-500">Sparat, vi tar med det nästa gång.</span>}
                  </div>
                </div>
              )}

              {/* Ändra bilden via kommentar (AI redigerar den befintliga bilden) */}
              {curImg && (
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 space-y-2">
                  <label className="block text-xs font-medium text-gray-600">Ändra DEN HÄR bilden: skriv vad du vill</label>
                  <SmartTextarea value={imgComment} onChange={(e) => setImgComment(e.target.value)} rows={2}
                    placeholder='T.ex. "ljusare bakgrund", "visa produkten större" eller "ta bort personen i bakgrunden"'
                    className={inputCls} />
                  {/* BILD-11: skrev han sin önskan i omdömesrutan ovan är den inte förlorad —
                      erbjud den här, i stället för att låta honom skriva om den. */}
                  {!imgComment.trim() && bildOmdomeKommentar.trim() && (
                    <button type="button" onClick={() => setImgComment(bildOmdomeKommentar.trim())}
                      className="text-xs font-medium underline decoration-dotted" style={{ color: primary }}>
                      Använd det du skrev ovan: ”{bildOmdomeKommentar.trim().slice(0, 40)}”
                    </button>
                  )}
                  <div className="flex items-center gap-2">
                    <button onClick={editImage} disabled={editingImg || !imgComment.trim()}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg text-white shadow-sm hover:opacity-90 disabled:opacity-40"
                      style={{ background: primary }}>
                      {editingImg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />} Ändra bild
                    </button>
                    {/* En knapp som ser trasig ut är värre än en som säger varför den sover. */}
                    {!editingImg && !imgComment.trim() && (
                      <span className="text-xs text-gray-500">Skriv i rutan ovan först, då tänds knappen.</span>
                    )}
                    {prevImageUrl && (
                      <button onClick={undoImageEdit} disabled={editingImg}
                        className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40">
                        <RefreshCw className="w-4 h-4" /> Ångra ändring
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">Behåller komposition och stil, ändrar bara det du ber om.</p>
                </div>
              )}

              {/* Bildförslag: riktiga foton (Pexels) eller AI-genererat */}
              <div className="pt-3 border-t border-gray-100 space-y-3">
                <div className="text-xs font-medium text-gray-500">Ingen egen bild? Låt verktyget föreslå, utifrån ämnet {topic ? `"${topic}"` : "(fyll i i steg 1 · Ämne)"}.</div>
                <div className="flex gap-2">
                  <button onClick={() => suggestImage("stock")} disabled={!!searchingImg}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40">
                    {searchingImg === "stock" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Sök foto
                  </button>
                  <button onClick={() => suggestImage("ai")} disabled={!!searchingImg}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40">
                    {searchingImg === "ai" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />} Skapa en bild
                  </button>
                </div>
                {imgResults.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {imgResults.map((p, i) => (
                      <button key={i} onClick={() => setImage(p.url)} title={p.credit}
                        className="rounded-lg overflow-hidden border-2 transition-colors aspect-square"
                        style={{ borderColor: curImg === p.url ? primary : "transparent" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.thumb} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Mediabibliotek — dina uppladdade + AI-skapade + färdiga design-bilder. */}
              <div className="pt-3 border-t border-gray-100 space-y-3">
                {/* Spara den FÄRDIGA designen (bild + ram + text) som en bild i biblioteket. */}
                <button onClick={saveDesignToLibrary} disabled={savingDesign || !brand}
                  className="w-full inline-flex items-center justify-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg text-white shadow-sm hover:opacity-90 disabled:opacity-40"
                  style={{ background: primary }}>
                  {savingDesign ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Spara bild i Mina bilder
                </button>
                <p className="text-xs text-gray-400 -mt-1">Sätter ihop bild, ram och text till en färdig bild, samma som publiceras. Dyker upp nedan.</p>

                <button onClick={toggleMedia}
                  className="w-full inline-flex items-center justify-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50">
                  <FolderOpen className="w-4 h-4" /> {showMedia ? "Dölj mina bilder" : "Mina bilder"}
                </button>
                {showMedia && (
                  loadingMedia ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500 justify-center py-4"><Loader2 className="w-4 h-4 animate-spin" /> Hämtar dina bilder…</div>
                  ) : mediaItems.length === 0 ? (
                    <div className="text-sm text-gray-500 text-center py-4">Inga sparade bilder än. Bilder du laddar upp eller genererar dyker upp här.</div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {mediaItems.map((m) => (
                        <div key={m.path} className="relative group rounded-lg overflow-hidden border-2 aspect-square" style={{ borderColor: curImg === m.url ? primary : "transparent" }}>
                          <button onClick={() => setImage(m.url)} className="w-full h-full" title="Använd den här bilden">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={m.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                          </button>
                          <button onClick={() => deleteMedia(m.path)} disabled={deletingPath === m.path} title="Ta bort bilden"
                            className="absolute top-1 right-1 w-6 h-6 rounded-md bg-white/90 border border-gray-200 flex items-center justify-center text-gray-500 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-100">
                            {deletingPath === m.path ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                          {curImg === m.url && <span className="absolute bottom-1 left-1 text-xs font-bold px-1.5 py-0.5 rounded text-white" style={{ background: primary }}>Vald</span>}
                        </div>
                      ))}
                    </div>
                  )
                )}
              </div>
            </section>
            </div>

            {/* Video (reel) — bara i 9:16 */}
            {isStoryFormat(format) && (
              <section className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-display font-bold text-gray-900 text-lg">Video (reel)</h2>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: `${primary}1a`, color: primary }}>
                    {postType === "reel" ? "Blir reel" : "Blir story"}
                  </span>
                </div>
                <p className="text-xs text-gray-500">Ladda upp en video så publiceras inlägget som <strong>reel</strong>. Studio-bilden ovan blir omslag/cover. Utan video blir 9:16-inlägget en <strong>story</strong>.</p>
                {videoUrl ? (
                  <div className="flex items-center gap-3">
                    <video src={videoUrl} className="w-24 rounded-lg border border-gray-100" style={{ aspectRatio: "9/16", objectFit: "cover" }} muted />
                    <div className="flex-1 text-xs text-gray-500 truncate">Video uppladdad</div>
                    <button onClick={() => setVideoUrl("")} className="text-xs text-red-500 hover:text-red-700 inline-flex items-center gap-1"><Trash2 className="w-3.5 h-3.5" /> Ta bort</button>
                  </div>
                ) : (
                  <label className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 cursor-pointer">
                    {uploadingVideo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Ladda upp video (MP4/MOV)
                    <input type="file" accept="video/mp4,video/quicktime,video/webm" className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) onVideoFile(f); }} />
                  </label>
                )}
              </section>
            )}

            {/* Text */}
            {/* Steg 4 · Text på bilden — ämne + idéer bor i steg 1 */}
            <section className="bg-white border rounded-2xl p-6 space-y-4" style={stegRam(STEG_FARGER[3])}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-display font-bold text-gray-900 text-lg flex items-center gap-2"><StegNr n={4} color={STEG_FARGER[3]} /> {isCarousel ? "Karusell" : "Text på bilden"}</h2>
                  {!isCarousel && <p className="text-xs text-gray-500 mt-0.5 ml-9">Rubrik och text som syns i <strong>själva bilden</strong>.</p>}
                </div>
                {isCarousel && (
                  <button onClick={generateCarouselNow} disabled={genCarousel}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg text-white shadow-sm hover:opacity-90 disabled:opacity-40"
                    style={{ background: primary }}>
                    {genCarousel ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />} Generera karusell
                  </button>
                )}
              </div>

              {isCarousel && slideCount > 0 && (
                <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-3">
                  {/* ORDVALET ÄR VIKTIGT: "bild" betydde två saker i samma ruta — den
                      exporterade PNG:n (som VARJE slide blir) och fotot bakom texten (som
                      bara vissa slides har). Håkan läste rutan som "skapa slidesen" och
                      undrade om en textslide räknades. Därför heter allt här FOTO.
                      Bildvalet: förut gjordes alla slides om varje gång, så två nya slides
                      kastade fem färdiga foton — och varje foto kostar credits. */}
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="text-xs font-semibold text-gray-600">Foto bakom texten</div>
                    <div className="flex items-center gap-2 text-xs">
                      <button onClick={markeraAllaBilder} disabled={!!genSlideImgs}
                        className="text-gray-500 hover:text-gray-800 underline underline-offset-2 disabled:opacity-40">Alla</button>
                      <span className="text-gray-300">·</span>
                      <button onClick={nollstallBildval} disabled={!!genSlideImgs}
                        className="text-gray-500 hover:text-gray-800 underline underline-offset-2 disabled:opacity-40">Bara de utan foto</button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">
                    Alla slides blir bilder när karusellen exporteras. Det här väljer bara vilka som ska ha ett <strong>foto</strong> bakom texten. Slides du lämnar tomma får varumärkets färg.
                  </p>
                  <div className="flex flex-wrap gap-1.5 mb-2.5">
                    {slides.map((s, i) => {
                      const vald = bildvalEffektivt(i);
                      const harBild = !!s.imageUrl;
                      return (
                        <button key={i} onClick={() => toggleBildval(i)} disabled={!!genSlideImgs}
                          title={harBild ? `Slide ${i + 1} har redan ett foto` : `Slide ${i + 1} har bara text`}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors disabled:opacity-50 ${
                            vald ? "bg-white shadow-sm" : "bg-transparent border-gray-200 text-gray-500 hover:bg-white"
                          }`}
                          style={vald ? { borderColor: primary, color: primary } : undefined}>
                          <span className={`w-3.5 h-3.5 rounded-[4px] border flex items-center justify-center ${vald ? "text-white" : "border-gray-300"}`}
                            style={vald ? { background: primary, borderColor: primary } : undefined}>
                            {vald && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
                          </span>
                          {i + 1}. {slideEtikett(s)}
                          {/* Punktnumret är INTE slidens plats — slide 6 kan bära "04".
                              Förut stod de två siffrorna nakna intill varandra ("2. Punkt 01")
                              och lästes som ett enda tal. Numret ritas nu som den BRICKA det
                              faktiskt är på sliden, så ögat ser att det hör till punkten och
                              inte till ordningen. Värdet räknas fram ur listan vid varje
                              rendering — lägg till eller ta bort en punkt och resten numreras om. */}
                          {punktNr(slides, i) !== null && (
                            <span
                              title={`Står som ${String(punktNr(slides, i)).padStart(2, "0")} på själva sliden`}
                              className="text-xs font-bold tabular-nums px-1 py-0.5 rounded border border-gray-200 bg-gray-50 text-gray-500 leading-none"
                            >
                              {String(punktNr(slides, i)).padStart(2, "0")}
                            </span>
                          )}
                          {harBild && <span className="text-xs text-gray-400">har foto</span>}
                        </button>
                      );
                    })}
                  </div>
                  {/* Fotot beskrivs UR SLIDENS EGEN TEXT (se generateSlideImages). En tom
                      slide faller tillbaka på ämnet och ger ett generiskt motiv — och det
                      kostar lika mycket som ett träffsäkert. Säg det INNAN pengarna går. */}
                  {valdaUtanText.length > 0 && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2 mb-2">
                      {valdaUtanText.length === 1
                        ? `Slide ${valdaUtanText[0] + 1} har ingen text än.`
                        : `Slide ${valdaUtanText.map((i) => i + 1).join(", ")} har ingen text än.`}{" "}
                      Fotot beskrivs utifrån slidens text, så det blir generiskt. Skriv texten först, eller tryck <strong>Generera karusell</strong>.
                    </p>
                  )}
                  <button onClick={generateSlideImages} disabled={!!genSlideImgs || valdaBildIndex.length === 0}
                    className="w-full inline-flex items-center justify-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg bg-white border-2 hover:bg-gray-50 disabled:opacity-50"
                    style={{ borderColor: `${primary}55`, color: primary }}>
                    {genSlideImgs
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Skapar foto {genSlideImgs}…</>
                      : <><ImageIcon className="w-4 h-4" /> {valdaBildIndex.length === 0 ? "Ingen slide vald, inga foton skapas" : `Skapa foto till ${valdaBildIndex.length} ${valdaBildIndex.length === 1 ? "slide" : "slides"}`}</>}
                  </button>
                  <p className="text-xs text-gray-500 mt-1.5">
                    Foton som redan finns rörs inte om du inte kryssar i dem. Eget foto på en slide: bläddra dit med pilarna och ladda upp under <strong>Bild</strong>. Ångrar du ett foto tar du bort det på sliden.
                  </p>
                </div>
              )}

              {/* Föreslå rubrik & text direkt här — Greta ska inte behöva gå tillbaka till steg 1 (ej karusell) */}
              {!isCarousel && (
              <div className="rounded-xl border p-3 space-y-3" style={{ borderColor: `${STEG_FARGER[3]}33`, background: `${STEG_FARGER[3]}0a` }}>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <p className="text-sm text-gray-600">Vet du inte vad du ska skriva? Låt <strong>Skrivhjälpen</strong> föreslå rubrik och text{topic ? " utifrån ditt ämne" : ""}.</p>
                  <button onClick={() => suggest()} disabled={suggesting}
                    className="shrink-0 inline-flex items-center justify-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-lg text-white shadow-sm hover:opacity-90 disabled:opacity-40"
                    style={{ background: STEG_FARGER[3] }}>
                    {suggesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />} Föreslå rubrik &amp; text
                  </button>
                </div>
                {suggestions.length > 0 && (
                  <div className="space-y-2">
                    <div id="studio-forslag" className="text-xs font-medium text-gray-500">Klicka ett förslag, då fylls rubrik och text i nedan:</div>
                    {suggestions.map((s, i) => (
                      <button key={i} onClick={() => applySuggestion(s)}
                        className="w-full text-left rounded-xl border border-gray-200 hover:border-gray-300 bg-white/70 hover:bg-white p-3 transition-colors">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: `${primary}1a`, color: primary }}>
                            {HOOK_LABEL[s.hookType] || "Hook"}
                          </span>
                          <span className="text-sm font-bold text-gray-900 truncate">{s.headline1}</span>
                        </div>
                        <div className="text-xs text-gray-500 line-clamp-2">{s.beskrivning || [s.headline2, s.body].filter(Boolean).join(". ")}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              )}

              {/* Klistra in eget utkast (ej karusell) */}
              {!isCarousel && (
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 space-y-2">
                <label className="block text-sm font-medium text-gray-600">Har du ett eget utkast? Klistra in. Skrivhjälpen delar upp i rubrik och text</label>
                <SmartTextarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} rows={2} placeholder="Klistra in din egen text här…" className={inputCls} />
                <button onClick={() => applyPaste()} disabled={applyingPaste || !pasteText.trim()}
                  className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40">
                  {applyingPaste ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />} Använd min text
                </button>
              </div>
              )}

              {isCarousel ? (
                <div className="space-y-3">
                  {/* Slide-flikar */}
                  <div className="flex flex-wrap gap-1.5">
                    {slides.map((s, i) => (
                      <button key={i} onClick={() => setSlideIdx(i)}
                        className="rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors"
                        style={i === slideIdx ? { borderColor: primary, color: primary, background: `${primary}0f` } : { borderColor: "#e5e7eb", color: "#6b7280" }}>
                        {i + 1}. {slideEtikett(s)}
                        {punktNr(slides, i) !== null && (
                          <span className="ml-1 text-xs font-bold text-gray-400 tabular-nums">{String(punktNr(slides, i)).padStart(2, "0")}</span>
                        )}
                      </button>
                    ))}
                    {slides.length < MAX_SLIDES && (
                      <button onClick={addSlide} className="rounded-lg border border-dashed border-gray-300 px-2.5 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-50">+ Slide</button>
                    )}
                  </div>

                  {/* Aktiv slide */}
                  {slides[slideIdx] && (
                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex gap-1.5">
                          {(["hook", "point", "cta"] as StudioSlide["kind"][]).map((k) => (
                            <button key={k} onClick={() => updateSlide(slideIdx, { kind: k, roll: undefined })}
                              className="rounded-md border px-2 py-1 text-xs font-medium transition-colors"
                              style={slides[slideIdx].kind === k ? { borderColor: primary, color: primary, background: "#fff" } : { borderColor: "#e5e7eb", color: "#9ca3af" }}>
                              {SLIDE_KIND_LABEL[k]}
                            </button>
                          ))}
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => moveSlide(slideIdx, -1)} disabled={slideIdx === 0} className="px-1.5 py-1 rounded text-gray-400 hover:text-gray-700 disabled:opacity-30" title="Flytta upp">↑</button>
                          <button onClick={() => moveSlide(slideIdx, 1)} disabled={slideIdx === slides.length - 1} className="px-1.5 py-1 rounded text-gray-400 hover:text-gray-700 disabled:opacity-30" title="Flytta ner">↓</button>
                          <button onClick={() => removeSlide(slideIdx)} disabled={slides.length <= 1} className="px-1.5 py-1 rounded text-red-400 hover:text-red-600 disabled:opacity-30" title="Ta bort"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1.5">Rubrik</label>
                        <input value={slides[slideIdx].headline} onChange={(e) => updateSlide(slideIdx, { headline: e.target.value })} className={inputCls} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1.5">Text</label>
                        <SmartTextarea value={slides[slideIdx].body} onChange={(e) => updateSlide(slideIdx, { body: e.target.value })} rows={3} className={inputCls} />
                      </div>
                    </div>
                  )}
                  <div className="text-xs text-gray-400">{slides.length} slides · exporteras som {slides.length} bilder, i den här ordningen. Krok först, avslut sist.</div>
                </div>
              ) : (
              <div className="space-y-3">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1.5">{meta.fields.headline1}</label>
                    <input value={headline1} onChange={(e) => setHeadline1(e.target.value)} className={inputCls} />
                    {headline1.length > meta.headlineSoftMax && (
                      <div className="text-xs text-amber-600 mt-1">Rubriken är {headline1.length} tecken, bryter troligen till 2 rader i denna mall (ryms ~{meta.headlineSoftMax}).</div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1.5">{meta.fields.headline2}</label>
                    <input value={headline2} onChange={(e) => setHeadline2(e.target.value)} className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1.5">{meta.fields.body}</label>
                  <SmartTextarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} className={inputCls} />
                </div>
              </div>
              )}

              {meta.fields.badge && (
                <div className="pt-2 border-t border-gray-100 space-y-3">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={badgeEnabled} onChange={(e) => setBadgeEnabled(e.target.checked)} style={{ accentColor: primary }} />
                    <Star className="w-4 h-4" style={{ color: primary }} /> Visa pris-stjärna
                  </label>
                  {badgeEnabled && (
                    <div className="grid grid-cols-2 gap-3">
                      <input value={badgeLine1} onChange={(e) => setBadgeLine1(e.target.value)} placeholder="Rad 1" className={inputCls} />
                      <input value={badgeLine2} onChange={(e) => setBadgeLine2(e.target.value)} placeholder="Rad 2" className={inputCls} />
                    </div>
                  )}
                </div>
              )}

              {meta.fields.brush && (
                <div className="pt-2 border-t border-gray-100 space-y-2">
                  <label className="block text-xs font-medium text-gray-500">Färg på rutan</label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {swatches.map((s) => {
                      const active = brushColor.toUpperCase() === s.hex.toUpperCase();
                      return (
                        <button key={s.hex} onClick={() => setBrushColor(s.hex)} title={s.name}
                          className="w-8 h-8 rounded-full border transition-transform hover:scale-110"
                          style={{
                            background: s.hex,
                            borderColor: active ? "#111827" : "#e5e7eb",
                            boxShadow: active ? "0 0 0 2px #fff, 0 0 0 4px #111827" : "none",
                          }} />
                      );
                    })}
                    <label className="w-8 h-8 rounded-full border border-dashed border-gray-300 flex items-center justify-center cursor-pointer relative overflow-hidden" title="Egen färg">
                      <span className="text-xs text-gray-500">+</span>
                      <input type="color" value={brushColor} onChange={(e) => setBrushColor(e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer" />
                    </label>
                    <button onClick={() => setBrushColor(DEFAULT_BRUSH)} className="text-xs text-gray-500 hover:text-gray-700 ml-1">Återställ</button>
                  </div>
                </div>
              )}
            </section>

            {/* Steg 5 · Bildtext (caption) — förstaklassig, hälften av inlägget */}
            <section className="bg-white border rounded-2xl p-6 space-y-3" style={stegRam(STEG_FARGER[4])}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display font-bold text-gray-900 text-lg flex items-center gap-2"><StegNr n={5} color={STEG_FARGER[4]} /> Bildtext</h2>
                  <p className="text-xs text-gray-500 mt-0.5 ml-9">Texten <strong>under bilden</strong> på Instagram: kroken som fångar, värdet, en uppmaning och några hashtags.</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={suggestCaptionVariants} disabled={loadingVariants || suggestingCaption}
                    title="Få 3 varianter att jämföra: olika krok, olika tonläge och olika väg framåt"
                    className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg border shadow-sm hover:bg-gray-50 disabled:opacity-40"
                    style={{ borderColor: `${primary}55`, color: primary }}>
                    {loadingVariants ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />} Ge mig 3 att välja på
                  </button>
                  <button onClick={suggestCaption} disabled={suggestingCaption || loadingVariants}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg text-white shadow-sm hover:opacity-90 disabled:opacity-40"
                    style={{ background: primary }}>
                    {suggestingCaption ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />} {caption ? "Skriv om" : "Föreslå bildtext"}
                  </button>
                </div>
              </div>

              {compassEnabled && (
                <div className="rounded-xl border border-violet-100 bg-violet-50/40 p-3 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-violet-700" title="Ger inlägget rätt ton och syfte utan att du behöver kunna teorin.">Innehållsprofil</span>
                  <select value={compass.four_a || ""} onChange={(e) => setCompass((c) => ({ ...c, four_a: (e.target.value || null) as FourA | null }))} title="Berättarform" className="rounded-lg border border-violet-200 bg-white px-2 py-1 text-xs">
                    <option value="">Berättarform</option>
                    {(["analytical", "aspirational", "actionable", "authentic"] as FourA[]).map((o) => <option key={o} value={o}>{FOURA_LABEL_SV[o]}</option>)}
                  </select>
                  <select value={compass.funnel || ""} onChange={(e) => setCompass((c) => ({ ...c, funnel: (e.target.value || null) as FunnelLevel | null }))} title="Var i kundresan inlägget hör hemma" className="rounded-lg border border-violet-200 bg-white px-2 py-1 text-xs">
                    <option value="">Steg i kundresan</option>
                    {(["tofu", "mofu", "bofu"] as FunnelLevel[]).map((o) => <option key={o} value={o}>{FUNNEL_LABEL_SV[o]}</option>)}
                  </select>
                  <div className="flex items-center gap-1">
                    {(["D", "I", "S", "C"] as DiscLetter[]).map((letter) => {
                      const on = compass.disc.includes(letter);
                      return (
                        <button key={letter} type="button" title={DISC_LABEL_SV[letter]} onClick={() => setCompass((c) => ({ ...c, disc: c.disc.includes(letter) ? c.disc.filter((x) => x !== letter) : [...c.disc, letter] }))}
                          className={`w-7 h-7 rounded-md text-xs font-bold border transition-colors ${on ? "text-white border-transparent" : "text-gray-400 border-gray-200 hover:bg-white"}`}
                          style={on ? { background: letter === "D" ? "#ef4444" : letter === "I" ? "#f59e0b" : letter === "S" ? "#10b981" : "#3b82f6" } : {}}>
                          {letter}
                        </button>
                      );
                    })}
                  </div>
                  <div className="ml-auto flex items-center gap-1.5">
                    <button type="button" onClick={autoClassify} disabled={!!compassBusy}
                      title="Läs texten och fyll i funnel, 4A och DISC automatiskt"
                      className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-violet-200 bg-white text-violet-700 hover:bg-violet-50 disabled:opacity-40">
                      {compassBusy === "classify" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />} Auto-klassa
                    </button>
                    <button type="button" onClick={reviewText} disabled={!!compassBusy}
                      title="Granska texten mot inläggsanatomin: hook, känsla, kund-nytta och exakt en CTA"
                      className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-violet-200 bg-white text-violet-700 hover:bg-violet-50 disabled:opacity-40">
                      {compassBusy === "review" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ClipboardCheck className="w-3.5 h-3.5" />} Granska
                    </button>
                  </div>
                  <span className="w-full text-sm text-violet-600">Förslag för dagen: styr ton och struktur. Ändra fritt. Tre förslag ger tre tonlägen, med det här först.</span>
                  {reviewResult && (
                    <div className={`w-full rounded-lg border p-3 mt-1 ${reviewResult.passed ? "border-emerald-200 bg-emerald-50/60" : "border-amber-200 bg-amber-50/60"}`}>
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-800">
                        {reviewResult.passed ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <X className="w-3.5 h-3.5 text-amber-600" />}
                        {reviewResult.passed ? "Följer anatomin" : "Kan bli bättre"}
                        <button type="button" onClick={() => setReviewResult(null)} className="ml-auto text-gray-400 hover:text-gray-700">Dölj</button>
                      </div>
                      {reviewResult.brister.length > 0 && (
                        <ul className="mt-1.5 space-y-0.5 text-xs text-amber-800">
                          {reviewResult.brister.map((b, i) => <li key={i}>· {b}</li>)}
                        </ul>
                      )}
                      {reviewResult.sammanfattning && <p className="mt-1 text-xs text-gray-500">{reviewResult.sammanfattning}</p>}
                    </div>
                  )}
                </div>
              )}

              {/* A/B-varianter — jämför krokar, välj en */}
              {captionVariants.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Välj en variant: olika krok, olika tonläge, olika väg framåt</span>
                    <button onClick={() => setCaptionVariants([])} className="text-xs text-gray-400 hover:text-gray-700">Dölj</button>
                  </div>
                  <div className="grid sm:grid-cols-3 gap-2">
                    {captionVariants.map((v, i) => {
                      const vald = caption.trim() === v.caption.trim();
                      return (
                        <button key={i} onClick={() => { setCaption(v.caption); laggTillGeneration(v.generationId); if (v.ton) setCompass((c) => ({ ...c, disc: [v.ton as DiscLetter] })); }}
                          className={`text-left rounded-xl border p-3 transition-all hover:shadow-sm ${vald ? "ring-2" : ""}`}
                          style={vald ? { borderColor: primary, boxShadow: `0 0 0 2px ${primary}` } : { borderColor: "#e5e7eb" }}>
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <span className="text-xs font-bold uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ background: `${primary}1a`, color: primary }}>{v.angle}</span>
                            {v.ctaVag && <span className="text-xs text-gray-500">{CTA_VAG_ETIKETT[v.ctaVag] || v.ctaVag}</span>}
                            {vald && <span className="text-xs font-semibold text-emerald-600">✓ vald</span>}
                          </div>
                          {v.ton && (
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <span className="w-5 h-5 rounded text-xs font-bold text-white flex items-center justify-center flex-shrink-0"
                                style={{ background: v.ton === "D" ? "#ef4444" : v.ton === "I" ? "#f59e0b" : v.ton === "S" ? "#10b981" : "#3b82f6" }}>{v.ton}</span>
                              <span className="text-xs text-gray-500">{DISC_LABEL_SV[v.ton]}</span>
                            </div>
                          )}
                          <p className="text-xs text-gray-700 whitespace-pre-wrap line-clamp-[10] leading-relaxed">{v.caption}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <SmartTextarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={7}
                placeholder="Skriv bildtexten här, eller låt Skrivhjälpen föreslå en ur inläggets innehåll och din röst…"
                className={`${inputCls} leading-relaxed`} style={{ whiteSpace: "pre-wrap" }} />
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>{caption.trim() ? `${caption.length} tecken` : "Ingen bildtext än"}</span>
                <span>{isCarousel ? "Grundas på karusellens slides" : postType === "reel" ? "Anpassad för reel" : "Grundas på inläggets innehåll"}</span>
              </div>
            </section>
          </div>

          {/* ── Höger: live-preview (sticky) ── */}
          <div className="lg:sticky lg:top-6 space-y-4">
            <section className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display font-bold text-gray-900 text-sm uppercase tracking-wide text-gray-500">Förhandsvisning</h2>
                <div className="flex items-center gap-3">
                  {isCarousel && slideCount > 0 && (
                    <div className="flex items-center gap-1.5 mr-1">
                      <button onClick={() => setSlideIdx((i) => Math.max(0, i - 1))} disabled={slideIdx === 0} className="w-6 h-6 rounded-md border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-30" title="Föregående slide">‹</button>
                      <span className="text-xs font-semibold text-gray-500 tabular-nums">Slide {slideIdx + 1}/{slideCount}</span>
                      <button onClick={() => setSlideIdx((i) => Math.min(slideCount - 1, i + 1))} disabled={slideIdx >= slideCount - 1} className="w-6 h-6 rounded-md border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-30" title="Nästa slide">›</button>
                    </div>
                  )}
                  <button onClick={() => setNonce(Date.now())} title="Ladda om förhandsvisningen (färsk render)" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
                    <RefreshCw className="w-3.5 h-3.5" /> Uppdatera
                  </button>
                  <a href={previewSrc} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
                    <Maximize2 className="w-3.5 h-3.5" /> Full storlek
                  </a>
                </div>
              </div>
              {/* Ingen px-padding här längre. Karusellpilarna låg i 44 px breda gutters,
                  vilket krympte rutan under den skala kortet ritades i — kortet blev
                  bredare än rutan och overflow:hidden kapade högerkanten. Pilarna ligger
                  nu som överlägg på kortets kanter (vanlig karusell-UX), så rutan får hela
                  bredden och orsaken är borta, inte bara kompenserad. */}
              <div className="relative mx-auto">
                {/* Mätpunkten för previewScale: den här rutan ÄR den tillgängliga bredden. */}
                <div ref={previewBoxRef} className="relative rounded-xl overflow-hidden border border-gray-100 bg-gray-100">
                  <StudioEditor templateId={templateId} payload={payload} brand={brand} scale={previewScale} onImagePatch={onImagePatch} onTextPatch={setOv} editColor={primary} slideIndex={isCarousel ? slideIdx : undefined} logoHint={logoHint} />
                  {!imageUrl && !videoUrl && !headline1.trim() && !body.trim() && (!isCarousel || slides.every((s) => !s.headline?.trim() && !s.body?.trim())) && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center gap-2 p-6 bg-white/85 backdrop-blur-sm">
                      <span className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: `${primary}1a` }}>
                        <Wand2 className="w-5 h-5" style={{ color: primary }} />
                      </span>
                      <div className="text-sm font-semibold text-gray-800">Ditt inlägg visas här</div>
                      <p className="text-xs text-gray-500 max-w-[220px]">Skriv text i <strong>steg 4</strong>, eller få idéer i <strong>steg 1</strong>. Då ser du resultatet direkt.</p>
                    </div>
                  )}
                </div>
                {isCarousel && slideCount > 1 && (
                  <>
                    <button onClick={() => setSlideIdx((i) => Math.max(0, i - 1))} disabled={slideIdx === 0} className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/95 shadow-md border border-gray-200 flex items-center justify-center text-lg text-gray-700 hover:bg-white disabled:opacity-30 z-10" title="Föregående slide">‹</button>
                    <button onClick={() => setSlideIdx((i) => Math.min(slideCount - 1, i + 1))} disabled={slideIdx >= slideCount - 1} className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/95 shadow-md border border-gray-200 flex items-center justify-center text-lg text-gray-700 hover:bg-white disabled:opacity-30 z-10" title="Nästa slide">›</button>
                  </>
                )}
              </div>
              {payload.imageUrl && (
                <p className="text-xs text-gray-400 text-center mt-2">Dra i bilden för att flytta · scrolla för att zooma · dra i en text för att placera den</p>
              )}
              <button onClick={() => setEditOpen(true)} disabled={!brand}
                className="w-full mt-3 inline-flex items-center justify-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-lg text-white shadow-sm hover:opacity-90 disabled:opacity-40"
                style={{ background: primary }}>
                <Wand2 className="w-4 h-4" /> Redigera direkt på bilden
              </button>
            </section>

            {/* Redigera — tweak-lager (delad EditControls, samma i modalen) */}
            <section className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <EditControls overrides={overrides} setOv={setOv} onReset={() => setOverrides(DEFAULT_OVERRIDES)}
                primary={primary} hasImage={!!payload.imageUrl} showBrush={!!meta.fields.brush} showBadge={!!meta.fields.badge} swatches={swatches} showFooterScale={!!meta.hasFooterScale} />
            </section>

            {/* Spara i biblioteket (återanvändbar skapelse) */}
            <div className="rounded-xl border border-gray-100 bg-white shadow-sm p-3 space-y-2">
              <button onClick={() => savePost(false)} disabled={savingPost}
                className="w-full inline-flex items-center justify-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-lg text-white shadow-sm hover:opacity-90 disabled:opacity-40"
                style={{ background: primary }}>
                {savingPost ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {loadedPostId ? "Uppdatera i Mina inlägg" : "Spara i Mina inlägg"}
              </button>
              {loadedPostId && (
                <button onClick={() => savePost(true)} disabled={savingPost}
                  className="w-full inline-flex items-center justify-center gap-2 text-sm font-medium px-4 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40">
                  <Copy className="w-4 h-4" /> Spara som ny
                </button>
              )}
              {loadedPostId && <p className="text-xs text-gray-400 text-center">Redigerar en sparad skapelse, uppdatera den eller spara som ny.</p>}
            </div>

            <button onClick={exportPng} disabled={exporting}
              className="w-full inline-flex items-center justify-center gap-2 text-sm font-semibold px-4 py-3 rounded-xl text-white shadow-sm hover:opacity-90 disabled:opacity-40"
              style={{ background: primary }}>
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Ladda ner bilden
            </button>
            {!customerMode && (
              <>
                <button onClick={downloadPayload} className="w-full inline-flex items-center justify-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50">
                  Ladda ner payload (för CLI-export)
                </button>
                <p className="text-xs text-gray-400 text-center px-2">
                  &quot;Exportera PNG&quot; renderas i webbläsaren och funkar även i molnet. Payload/CLI (<code className="bg-gray-100 px-1 rounded">npm run studio:export</code>) finns kvar som pixelperfekt reserv.
                </p>
              </>
            )}

            <p className="text-xs text-gray-400 text-center px-2">Kanaler, förhandsvisning och publicering: <strong>steg 6</strong> längre ner.</p>
          </div>
        </div>
        </>)}

        {/* ── Kanaler & publicera — delas av Skriv eget + Mallar (steg 6). Ej i Förbättra-läget. ── */}
        {mode !== "improve" && (
        <section className="bg-white border rounded-2xl p-6 space-y-5" style={stegRam(STEG_FARGER[5])}>
          <div className="flex items-center gap-2.5 flex-wrap">
            {mode === "template" ? <StegNr n={6} color={STEG_FARGER[5]} /> : (
              <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${primary}1a` }}>
                <Send className="w-[18px] h-[18px]" style={{ color: primary }} />
              </span>
            )}
            <h2 className="font-display font-bold text-gray-900 text-lg">{mode === "simple" ? "Publicera" : "Kanaler & publicera"}</h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: `${primary}1a`, color: primary }}>
              {mode === "simple" ? "Inlägg" : postType === "reel" ? "Reel" : postType === "story" ? "Story" : isCarousel ? "Karusell" : "Inlägg"}
            </span>
            <span className="ml-auto text-xs text-gray-500">Skriv en gång, se och anpassa för varje plattform.</span>
          </div>

          {/* Greta-tydlig avslutning: EN självklar primär-åtgärd + guide anpassad efter läget */}
          <div className="rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center gap-3" style={{ borderColor: `${primary}33`, background: `${primary}08` }}>
            <div className="flex-1">
              <div className="font-semibold text-gray-900">Klar med inlägget?</div>
              <div className="text-sm text-gray-600 mt-0.5">
                {CHANNELS.some((c) => channelConnected[c.key])
                  ? "Spara det så du hittar det senare, eller publicera/schemalägg direkt nedan."
                  : "Spara det i Mina inlägg. Sen postar du enkelt: kopiera texten och ladda ner bilden nedan (eller koppla Instagram för att posta direkt härifrån)."}
              </div>
            </div>
            <button onClick={saveDraftPersistent} disabled={savingPost}
              className="inline-flex items-center justify-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-lg text-white shadow-sm hover:opacity-90 disabled:opacity-40 flex-shrink-0"
              style={{ background: primary }}>
              {savingPost ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {saved ? "Sparat i Mina inlägg ✓" : "Spara i Mina inlägg"}
            </button>
          </div>

          {/* Kanalväljare — förikryssad efter vad klienten kopplat. DEL 5: ig/fb/li alltid
              synliga, övriga bara när det finns en matchande GHL-koppling (dynamiskaKanaler
              filtrerar redan på det + på innehållstyp) — se definitionen ovan. */}
          <div className="flex flex-wrap items-center gap-2">
            {dynamiskaKanaler.map(({ key }) => {
              const on = selectedChannels.includes(key);
              const conn = channelConnected[key];
              const utgangen = channelExpired[key];
              const brand = CHANNEL_BRAND[key];
              const { Icon } = brand;
              return (
                <button key={key} onClick={() => toggleChannel(key)}
                  className="inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold transition-colors"
                  style={on ? { borderColor: brand.color, color: brand.color, background: `${brand.color}12` } : { borderColor: "#e5e7eb", color: "#6b7280" }}>
                  <span className="w-5 h-5 rounded-md flex items-center justify-center text-white" style={{ background: on ? brand.gradient : "#9ca3af" }}>
                    <Icon className="w-3 h-3" />
                  </span>
                  {brand.label}
                  {/* KANAL-3b (Hakans fynd 13/8): Gittes Instagram var kopplad i MySales,
                      men Cockpit saknade nyckeln till hennes konto — och da stod ALLA tre
                      kanalerna som "ej kopplad". Det ar tva helt olika saker, och att kalla
                      dem samma sak skickar felsokningen at fel hall: hon letar efter sin
                      Instagram-koppling nar det ar en nyckel som fattas hos oss.
                      Samma regel som resten av systemet: sag vad som faktiskt ar fel.
                      DEL 5 punkt 4: en UTGÅNGEN koppling far en egen etikett — den ska aldrig
                      se ut som "ej kopplad" (det ser ut som att kunden aldrig kopplat nagot,
                      nar hon i sjalva verket bara behover fornya). */}
                  <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full"
                    title={conn ? undefined : utgangen ? "Kopplingen i MySales har gått ut. Förnya den där, sedan syns kanalen som kopplad igen." : ghlConnected === false ? "Cockpit saknar nyckeln till kundens MySales-konto. Kopplingen i MySales kan vara helt korrekt, det ar nyckeln hit som fattas." : undefined}
                    style={conn ? { background: "#dcfce7", color: "#15803d" } : utgangen ? { background: "#fee2e2", color: "#b91c1c" } : ghlConnected === false ? { background: "#fef3c7", color: "#92400e" } : { background: "#f3f4f6", color: "#9ca3af" }}>
                    {conn ? "kopplad" : utgangen ? "behöver förnyas" : ghlConnected === false ? "nyckel saknas" : "ej kopplad"}
                  </span>
                </button>
              );
            })}
            <button onClick={adaptChannels} disabled={adapting || (!caption.trim() && !headline1.trim() && slides.every((s) => !s.headline?.trim()))}
              className="ml-auto inline-flex items-center gap-1.5 text-sm font-semibold px-3.5 py-2 rounded-xl text-white shadow-sm hover:opacity-90 disabled:opacity-40"
              style={{ background: primary }}>
              {adapting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />} Anpassa texten per kanal
            </button>
          </div>
          {!caption.trim() && (
            <div className="text-xs text-gray-500">Tips: {mode === "simple" ? <>skriv ditt inlägg ovan först</> : <>skriv eller föreslå en bildtext i <strong>steg 5</strong> först</>}, den blir grunden Skrivhjälpen anpassar per kanal.</div>
          )}

          {/* Schemalägg (valfritt) — gäller alla kanaler. IG schemaläggs nativt (utan GHL); FB/LI via GHL. */}
          {selectedChannels.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600"><CalendarClock className="w-4 h-4" /> Schemalägg</span>
              <input type="datetime-local" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-gray-400 outline-none" />
              <button
                onClick={() => { const t = nastaBastaTid(selectedChannels); if (t) setScheduleDate(t); }}
                title="Föreslå nästa bra publiceringstid (branschstandard per plattform)"
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border hover:bg-white"
                style={{ borderColor: `${primary}55`, color: primary }}>
                <Wand2 className="w-3.5 h-3.5" /> Bästa tid
              </button>
              {scheduleDate ? (
                <button onClick={() => setScheduleDate("")} className="text-xs text-gray-400 hover:text-gray-600">Rensa (publicera direkt)</button>
              ) : (
                <span className="text-xs text-gray-400">Lämna tom för direkt. "Bästa tid" föreslår de tider folk oftast är aktiva (inte din egen statistik än).</span>
              )}
            </div>
          )}

          {selectedChannels.length === 0 ? (
            <div className="text-sm text-gray-500 text-center py-6">Välj minst en kanal ovan för att förhandsgranska.</div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {CHANNELS.filter((c) => selectedChannels.includes(c.key)).map(({ key }) => {
                const brand = CHANNEL_BRAND[key];
                const label = brand.label;
                const { Icon } = brand;
                const eff = capFor(key);
                const busy = pubBusy === key;
                const res = pubResult[key];
                const igDirect = key === "ig" && !!igConn?.connected;
                const ghlAccs = ghlFor(key === "fb" ? "facebook" : key === "li" ? "linkedin" : "instagram");
                const canPublish = igDirect || (!igDirect && ghlAccs.some((a) => selectedAccounts.includes(a.id)));
                // Instagram/sociala kräver media. Mall-läget renderar alltid en design, men
                // i Skriv eget publiceras råfotot → utan bild dör publiceringen med kryptiskt
                // fel. Reel kräver video. Guarda knappen istället för att låta det spricka.
                const missingMedia = postType === "reel" ? !videoUrl : (mode === "simple" && !imageUrl);
                const openUrl = key === "li" ? "https://www.linkedin.com/feed/" : key === "fb" ? "https://www.facebook.com/" : "https://www.instagram.com/";
                return (
                  <div key={key} className="space-y-3">
                    <ChannelPreview channel={key} renderSrc={channelRenderSrc} format={format} caption={eff}
                      clientName={client?.name || slug} handle={key === "ig" ? igConn?.handle : null} primary={primary}
                      imageSrc={mode === "simple" ? (editedPreview || imageUrl) : undefined}
                      imageEditRatio={mode === "simple" ? imageEdit?.ratio : undefined}
                      hasImageText={mode === "simple" ? !!imgText.trim() : undefined}
                      // Ett-klicks-fix: Kvadrat klipps i IG:s rutnät → byt till Porträtt direkt i varningen
                      // (mall-läget; i Skriv eget styr bildredigerarens formatval istället).
                      onFixFormat={key === "ig" && mode !== "simple" && format === "1080x1080" && meta.formats.includes("1080x1350") ? () => setFormat("1080x1350") : undefined} />

                    {/* Per-kanal-caption (redigerbar) — faller tillbaka på grund-captionen */}
                    <div className="rounded-xl border bg-gray-50 p-2.5 space-y-1.5" style={{ borderColor: `${brand.color}26` }}>
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide" style={{ color: brand.color }}>
                          <span className="w-4 h-4 rounded flex items-center justify-center text-white" style={{ background: brand.gradient }}>
                            <Icon className="w-2.5 h-2.5" />
                          </span>
                          {label}-text
                        </span>
                        <button onClick={() => copyChannelText(key)} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800">
                          {copied === key ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />} Kopiera
                        </button>
                      </div>
                      <textarea value={channelCaptions[key]} onChange={(e) => setChannelCap(key, e.target.value)}
                        rows={4} placeholder={caption.trim() ? "Använder grundtexten, ändra via knappen eller skriv här." : (mode === "simple" ? "Ingen text än, skriv ovan." : "Ingen bildtext än (steg 5).")}
                        className="w-full rounded-lg border border-gray-200 px-2.5 py-2 text-xs leading-relaxed focus:border-gray-400 outline-none bg-white" style={{ whiteSpace: "pre-wrap" }} />
                    </div>

                    {/* Publiceringsrouting per kanal */}
                    {igDirect ? (
                      <>
                      <button onClick={() => publishTo(key)} disabled={busy || !eff.trim() || missingMedia}
                        className="w-full inline-flex items-center justify-center gap-2 text-sm font-semibold px-3 py-2 rounded-lg text-white shadow-sm hover:opacity-90 disabled:opacity-40"
                        style={{ background: brand.gradient }}>
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : res === "ok" ? <Check className="w-4 h-4" /> : scheduleDate ? <CalendarClock className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                        {res === "ok" ? (scheduleDate ? "Schemalagt på Instagram ✓" : "Publicerat på Instagram ✓") : (scheduleDate ? "Schemalägg på Instagram" : "Publicera nu på Instagram")}
                      </button>
                      {missingMedia && <p className="text-xs text-amber-600">{postType === "reel" ? "Lägg till en video för att publicera en reel." : "Lägg till en bild för att publicera på Instagram."}</p>}
                      {isCarousel && slideCount >= 2 && !missingMedia && (
                        <p className="text-xs text-gray-500">Publiceras som karusell med alla {slideCount} bilderna.</p>
                      )}
                      </>
                    ) : canPublish ? (
                      <>
                      {/* KANAL-3: utkast eller direkt. Doljs nar en tid ar vald — da ar
                          valet redan gjort, och tva besked som sager olika saker forvirrar.
                          Karusell tvingas till utkast: flera bilder mot GHL ar inte bevisat. */}
                      {!scheduleDate && (
                        <div className="flex items-center gap-1 mb-2">
                          {([[false, "Spara som utkast"], [true, "Publicera direkt"]] as const).map(([v, txt]) => {
                            const vald = publiceraDirekt === v;
                            const sparrad = v === true && isCarousel && slideCount >= 2;
                            return (
                              <button key={txt} type="button" disabled={sparrad}
                                onClick={() => setPubliceraDirekt(v)}
                                title={sparrad ? "Karuseller skapas alltid som utkast — flera bilder mot MySales ar inte bevisat an." : undefined}
                                className={`flex-1 text-sm font-semibold px-2.5 py-1.5 rounded-lg border transition-colors disabled:opacity-40 ${vald ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}>
                                {txt}
                              </button>
                            );
                          })}
                        </div>
                      )}
                      <button onClick={() => publishTo(key)} disabled={busy || !eff.trim() || missingMedia}
                        className="w-full inline-flex items-center justify-center gap-2 text-sm font-semibold px-3 py-2 rounded-lg text-white shadow-sm hover:opacity-90 disabled:opacity-40"
                        style={{ background: brand.gradient }}>
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : res === "ok" ? <Check className="w-4 h-4" /> : scheduleDate ? <CalendarClock className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                        {res === "ok"
                          ? (scheduleDate ? `Schemalagt på ${label} ✓` : publiceraDirekt && !(isCarousel && slideCount >= 2) ? `Publicerat på ${label} ✓` : `Utkast skapat på ${label} ✓`)
                          : (scheduleDate ? `Schemalägg på ${label}` : publiceraDirekt && !(isCarousel && slideCount >= 2) ? `Publicera nu på ${label}` : `Skapa utkast på ${label}`)}
                      </button>
                      {missingMedia && <p className="text-xs text-amber-600">{postType === "reel" ? "Lägg till en video för att kunna publicera." : "Lägg till en bild för att kunna publicera."}</p>}
                      {isCarousel && slideCount >= 2 && !missingMedia && (
                        // Ärligt läge: alla {n} bilder skickas med, men att GHL behåller dem
                        // som karusell är INTE verifierat mot skarpt konto. Säg det rakt ut
                        // i stället för att lova något vi inte mätt.
                        <p className="text-xs text-amber-600">Alla {slideCount} bilderna skickas med som utkast. Kontrollera i {label} att hela karusellen följde med innan du publicerar. Instagram direkt är den väg vi vet håller ihop karusellen.</p>
                      )}
                      </>
                    ) : (
                      // Fallback: ingen direktväg (t.ex. LinkedIn utan GHL, eller kundläge) → kopiera + öppna.
                      <div className="space-y-1.5">
                        <a href={openUrl} target="_blank" rel="noopener" onClick={() => copyChannelText(key)}
                          className="w-full inline-flex items-center justify-center gap-2 text-sm font-medium px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50">
                          {copied === key ? <Check className="w-4 h-4 text-emerald-600" /> : <ExternalLink className="w-4 h-4" />} Kopiera text &amp; öppna {label}
                        </a>
                        <p className="text-xs text-gray-400">{label} kan inte publiceras direkt härifrån. Ladda ner bilden ovan, kopiera texten och lägg upp den själv{customerMode ? "" : ", eller koppla FB/LI nedan"}.</p>
                      </div>
                    )}
                    {res === "err" && <p className="text-xs text-red-500">Publicering misslyckades. Se felrutan högst upp.</p>}
                  </div>
                );
              })}
            </div>
          )}

          {/* BILD-3: publiceringskvitto — direktlänk till inlägget, tid, tenant och format */}
          {pubReceipt && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex flex-wrap items-center gap-3">
              <span className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0"><Check className="w-5 h-5 text-emerald-700" /></span>
              <div className="flex-1 min-w-[200px]">
                <div className="font-semibold text-emerald-900">Publicerat på Instagram</div>
                <div className="text-xs text-emerald-700 mt-0.5">{pubReceipt.tid} · {client?.name || "din klient"} · {FORMAT_LABELS[pubReceipt.format as StudioFormat] || pubReceipt.format}</div>
              </div>
              {pubReceipt.permalink ? (
                <a href={pubReceipt.permalink} target="_blank" rel="noopener"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold px-3.5 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">
                  <ExternalLink className="w-4 h-4" /> Öppna inlägget
                </a>
              ) : (
                <span className="text-xs text-emerald-700">Inlägget syns på kontots profil.</span>
              )}
              <button onClick={() => setPubReceipt(null)} className="text-emerald-400 hover:text-emerald-700" title="Stäng"><X className="w-4 h-4" /></button>
            </div>
          )}

          {/* GHL-koppling & kontoval (byrå-only) — driver FB/LI-publiceringen ovan */}
          {!customerMode && (selectedChannels.includes("fb") || selectedChannels.includes("li") || (selectedChannels.includes("ig") && !igConn?.connected)) && (
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">GHL Social Planner (Facebook / LinkedIn)</span>
                {ghlConnected && <button onClick={disconnectGhl} className="ml-auto text-xs text-gray-400 hover:text-red-600">Koppla från</button>}
              </div>
              {ghlConnected === null ? (
                <div className="text-xs text-gray-400 flex items-center gap-1"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Kollar koppling…</div>
              ) : !ghlConnected ? (
                <div className="space-y-2">
                  <div className="text-xs text-gray-600">Koppla {client?.name || "klienten"}s GHL för att publicera FB/LI. Skapa en <span className="font-medium">Private Integration-token</span> (scope: Social Media + View Users) i klientens GHL.</div>
                  <input value={ghlLocInput} onChange={(e) => setGhlLocInput(e.target.value)} placeholder="Location-id (t.ex. ZWqjUhS3f77BPpOiyMHK)" className={inputCls}
                    name="ghl-location-id" autoComplete="off" data-lpignore="true" data-1p-ignore data-form-type="other" spellCheck={false} />
                  <input value={ghlPitInput} onChange={(e) => setGhlPitInput(e.target.value)} type="text" placeholder="Private Integration-token (pit-…)" className={`${inputCls} font-mono`}
                    name="ghl-pit-token" autoComplete="off" data-lpignore="true" data-1p-ignore data-form-type="other" spellCheck={false} />
                  <button onClick={connectGhl} disabled={connectingGhl}
                    className="inline-flex items-center justify-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg text-white shadow-sm hover:opacity-90 disabled:opacity-40"
                    style={{ background: primary }}>
                    {connectingGhl ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Koppla GHL
                  </button>
                </div>
              ) : ghlAccounts.length === 0 ? (
                <div className="text-xs text-gray-500">Inga kopplade sociala konton i GHL för den här klienten.</div>
              ) : (
                <div className="space-y-1">
                  <div className="text-xs font-medium text-gray-500">Publicera till konton</div>
                  {ghlAccounts.map((a) => (
                    <label key={a.id} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={selectedAccounts.includes(a.id)} onChange={() => toggleAccount(a.id)} disabled={a.isExpired} style={{ accentColor: primary }} />
                      <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 capitalize">{a.platform}</span>
                      <span className="truncate">{a.name}</span>
                      {a.isExpired && <span className="text-xs text-red-500">(utgången)</span>}
                    </label>
                  ))}
                  <p className="text-xs text-gray-400 pt-1">Utan schema-tid ovan: utkast i GHL. Med tid: schemaläggs i Social Planner.</p>
                </div>
              )}
            </div>
          )}
          {customerMode && (selectedChannels.includes("fb") || selectedChannels.includes("li")) && (
            <p className="text-xs text-gray-400">
              {ghlConnected
                ? "Är kanalen kopplad via MySales publicerar du direkt härifrån. Är den inte kopplad, kopiera texten och lägg upp manuellt, eller be din byrå koppla den."
                : "Facebook och LinkedIn förhandsvisas här. När de kopplats via MySales kan du publicera direkt, annars kopiera texten och lägg upp manuellt."}
            </p>
          )}
        </section>
        )}

        {/* ── Schemalagt & kö (native IG + blogg) — avboka/ändra tid. Admin + kund. ── */}
        {mode !== "improve" && <ScheduleQueue primary={primary} refreshKey={scheduleRefresh} />}

        {/* ── Mina inlägg (återanvänd & redigera) ── */}
        {mode !== "improve" && posts.length === 0 && (
          <section className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2.5 mb-2">
              <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${primary}1a` }}>
                <FolderOpen className="w-[18px] h-[18px]" style={{ color: primary }} />
              </span>
              <h2 className="font-display font-bold text-gray-900 text-lg">Mina inlägg</h2>
            </div>
            <p className="text-sm text-gray-500">Här samlas inläggen du sparar. Skapa ett inlägg ovan och tryck <strong>Spara i Mina inlägg</strong>, sen hittar du det här när du vill återanvända eller redigera.</p>
          </section>
        )}
        {mode !== "improve" && posts.length > 0 && (
          <section className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${primary}1a` }}>
                  <FolderOpen className="w-[18px] h-[18px]" style={{ color: primary }} />
                </span>
                <h2 className="font-display font-bold text-gray-900 text-lg">Mina inlägg</h2>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 tabular-nums">{visiblePosts.length}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative flex-1 sm:flex-none">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input value={postQuery} onChange={(e) => setPostQuery(e.target.value)} placeholder="Sök på det du skrev…"
                    className="w-full sm:w-60 rounded-lg border border-gray-200 pl-9 pr-3 py-2 text-sm focus:border-gray-400 focus:ring-2 focus:ring-gray-100 outline-none" />
                </div>
                <button onClick={refreshPosts} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 flex-shrink-0">
                  <RefreshCw className="w-3.5 h-3.5" /> Uppdatera
                </button>
              </div>
            </div>
            {visiblePosts.length === 0 ? (
              <div className="text-center text-sm text-gray-400 py-8">Inga skapelser matchar <strong className="text-gray-500">{postQuery}</strong>. Prova ett annat ord.</div>
            ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {visiblePosts.map((p) => {
                const pCustom = p.payload?.customSize as { w?: number; h?: number } | null | undefined;
                const { w: pw, h: ph } =
                  pCustom && Number.isFinite(pCustom.w) && Number.isFinite(pCustom.h)
                    ? { w: pCustom.w as number, h: pCustom.h as number }
                    : (FORMAT_DIMENSIONS[p.format] ?? FORMAT_DIMENSIONS["1080x1350"]);
                const cardW = 150;
                const s = cardW / pw;
                const active = loadedPostId === p.id;
                return (
                  <div key={p.id} className="group rounded-xl border overflow-hidden transition-shadow hover:shadow-md" style={{ borderColor: active ? primary : "#f3f4f6" }}>
                    <div className="bg-gray-100 overflow-hidden mx-auto" style={{ width: cardW, height: ph * s }}>
                      <iframe title={p.title} scrolling="no"
                        src={`/studio/render/${p.template_id}?p=${encodeURIComponent(encodePayload(p.payload))}`}
                        style={{ width: pw, height: ph, border: 0, transform: `scale(${s})`, transformOrigin: "top left", pointerEvents: "none" }} />
                    </div>
                    <div className="p-2.5 space-y-1.5">
                      <div className="text-xs font-semibold text-gray-800 truncate leading-snug" title={p.title}>{p.title}</div>
                      <div className="flex items-center gap-1 text-xs text-gray-400"><CalendarClock className="w-3 h-3 flex-shrink-0" /> {kortDatum(p.updated_at)}</div>
                      <div className="flex items-center gap-1 pt-0.5">
                        <button onClick={() => openPost(p)}
                          className="flex-1 inline-flex items-center justify-center gap-1 text-xs font-semibold px-2 py-1.5 rounded-lg text-white hover:opacity-90"
                          style={{ background: primary }}>
                          <FolderOpen className="w-3.5 h-3.5" /> Öppna
                        </button>
                        <button onClick={() => deletePost(p.id)} title="Ta bort"
                          className="inline-flex items-center justify-center px-2 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-400 hover:text-red-600 hover:border-red-200">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            )}
          </section>
        )}

        {/* Fas C: inline-redigering — förstorad canvas i modal. Klicka text→skriv (contentEditable,
            commit-on-blur), klicka bild→byt. Ändringar syncar live till formulär + previews. */}
        {editOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setEditOpen(false)} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[94vh] flex flex-col overflow-hidden">
              {/* Header */}
              <div className="flex items-start justify-between gap-6 p-5 border-b border-gray-100">
                <div>
                  <h3 className="font-display font-bold text-gray-900 text-lg">Redigera direkt</h3>
                  <p className="text-sm text-gray-500 max-w-md">Klicka en <strong>text</strong> och skriv direkt · klicka <strong>bilden</strong> för att byta. Justera typsnitt, storlek och färg till höger.</p>
                </div>
                <button onClick={() => setEditOpen(false)}
                  className="shrink-0 inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg text-white shadow-sm hover:opacity-90"
                  style={{ background: primary }}>
                  <Check className="w-4 h-4" /> Klar
                </button>
              </div>
              {/* Kropp: bild till vänster, full redigering till höger. Vänster scrollar → aldrig klippt botten. */}
              <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
                <div className="flex-1 min-h-0 overflow-auto bg-gray-50 p-5 flex flex-col items-center gap-3">
                  {(() => { const editScale = Math.min(420 / w, 560 / h); return (
                    <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-100 shadow-sm flex-shrink-0" style={{ width: w * editScale }}>
                      <StudioEditor templateId={templateId} payload={payload} brand={brand} scale={editScale}
                        onImagePatch={onImagePatch} slideIndex={isCarousel ? slideIdx : undefined}
                        editMode onEditField={onEditField} onEditImage={() => fileRef.current?.click()} editColor={primary} logoHint={logoHint} />
                    </div>
                  ); })()}
                  {isCarousel && (
                    <div className="flex flex-wrap justify-center gap-1.5">
                      {slides.map((s, i) => (
                        <button key={i} onClick={() => setSlideIdx(i)}
                          className="rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors"
                          style={i === slideIdx ? { borderColor: primary, color: primary, background: `${primary}0f` } : { borderColor: "#e5e7eb", color: "#6b7280" }}>
                          {i + 1}. {slideEtikett(s)}
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="text-sm text-gray-400 text-center">Byter du bild öppnas filväljaren. Fler bildval finns i <strong>steg 3 · Bild</strong>.</p>
                </div>
                <div className="w-full lg:w-80 flex-shrink-0 border-t lg:border-t-0 lg:border-l border-gray-100 overflow-auto p-5">
                  <EditControls overrides={overrides} setOv={setOv} onReset={() => setOverrides(DEFAULT_OVERRIDES)}
                    primary={primary} hasImage={!!payload.imageUrl} showBrush={!!meta.fields.brush} showBadge={!!meta.fields.badge} swatches={swatches} showFooterScale={!!meta.hasFooterScale} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Dold full-skala render (scale=1) — fångas klient-sida av html-to-image vid publicering
            så DESIGNEN publiceras, inte råfotot. Off-screen, påverkar inte layouten. */}
        <div aria-hidden style={{ position: "fixed", left: -99999, top: 0, width: w, height: h, pointerEvents: "none", opacity: 0, zIndex: -1 }}>
          {isCarousel ? (
            // AKUT-KARUSELL: ALLA slides renderas här, en nod var. Tidigare fanns EN nod som
            // ritade den slide man råkade titta på — därför blev en 7-slides-karusell en enda
            // bild i export och publicering, trots att gränssnittet lovade sju. Att rendera
            // alla samtidigt (i stället för att stega slideIdx och vänta på omritning) gör
            // fångsten deterministisk: ingen väntan på React-commit mitt i en exportloop.
            slides.map((_, i) => (
              <div key={i} ref={(el) => { slideCaptureRefs.current[i] = el; }}>
                <StudioEditor templateId={templateId} payload={payload} brand={brand} scale={1} onImagePatch={() => {}} slideIndex={i} logoHint={logoHints[i] ?? null} />
              </div>
            ))
          ) : (
            <div ref={captureRef}>
              <StudioEditor templateId={templateId} payload={payload} brand={brand} scale={1} onImagePatch={() => {}} slideIndex={undefined} logoHint={logoHint} />
            </div>
          )}
        </div>
      </div>

      {/* BILD-2: diff-dialog — genereringen ersätter ALDRIG din text utan aktivt val. Portal
          (fixed overlay inuti transformerad förfader klipps annars, se lessons). */}
      {carouselDiffs && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-5 space-y-4 max-h-[80vh] overflow-y-auto">
            <div>
              <h3 className="font-display font-bold text-gray-900 text-lg">Dina texter behålls</h3>
              <p className="text-sm text-gray-500 mt-1">Skrivhjälpen föreslog ny text för slides du redan skrivit. Inget ersätts utan att du bockar i det.</p>
            </div>
            {carouselDiffs.map((d, di) => (
              <label key={d.index} className="block rounded-xl border border-gray-100 bg-gray-50 p-3 space-y-1.5 cursor-pointer">
                <span className="flex items-center gap-2 text-xs font-semibold text-gray-600">
                  <input type="checkbox" checked={d.anvand}
                    onChange={(e) => setCarouselDiffs((prev) => prev ? prev.map((x, xi) => xi === di ? { ...x, anvand: e.target.checked } : x) : prev)}
                    style={{ accentColor: primary }} />
                  Slide {d.index + 1}: använd förslaget
                </span>
                <span className="block text-xs text-gray-500"><strong>Din text:</strong> {d.nuvarande.headline}{d.nuvarande.body ? ` — ${d.nuvarande.body}` : ""}</span>
                <span className="block text-xs text-gray-500"><strong>Förslag:</strong> {d.forslag.headline}{d.forslag.body ? ` — ${d.forslag.body}` : ""}</span>
              </label>
            ))}
            <div className="flex items-center justify-end gap-2 pt-1">
              <button onClick={() => setCarouselDiffs(null)} className="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50">
                Behåll allt (rekommenderas)
              </button>
              <button onClick={applyCarouselDiffs} disabled={!carouselDiffs.some((d) => d.anvand)}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40" style={{ background: primary }}>
                Använd valda förslag
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

// Numrerad steg-bricka — gör flödet begripligt (steg 1-6).
function StegNr({ n, color }: { n: number; color: string }) {
  return (
    <span className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
      style={{ background: color, boxShadow: `0 2px 8px -2px ${color}80` }}>
      {n}
    </span>
  );
}

// OPTICUR-1 Etapp B (B1) — fri storlek i pixlar, "som i Canva": fritt fält är kärnan,
// snabbknappar (vanliga mått + tenantens egna sparade) är genvägar ovanpå det.
function SkarmStorlekValjare({ value, onChange, saved, primary, onSaved }: {
  value: CustomSize | null;
  onChange: (v: CustomSize) => void;
  saved: { name: string; w: number; h: number }[];
  primary: string;
  onSaved: (sf: { name: string; w: number; h: number }[]) => void;
}) {
  const v: CustomSize = value || { w: CUSTOM_SIZE_PRESETS[0].w, h: CUSTOM_SIZE_PRESETS[0].h };
  const [namn, setNamn] = useState("");
  const [sparar, setSparar] = useState(false);
  const [fel, setFel] = useState("");

  // Fri storlek behöver ett startvärde — sätt genvägens första mått om inget valt än.
  useEffect(() => {
    if (!value) onChange(CUSTOM_SIZE_PRESETS[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const satt = (patch: Partial<CustomSize>) => {
    const w = Math.round(Math.min(4096, Math.max(200, patch.w ?? v.w)));
    const h = Math.round(Math.min(4096, Math.max(200, patch.h ?? v.h)));
    onChange({ w, h, ...(v.name ? { name: v.name } : {}) });
  };

  const spara = async () => {
    if (!namn.trim()) { setFel("Skriv ett namn först"); return; }
    setSparar(true); setFel("");
    try {
      const r = await fetch("/api/studio/screen-formats", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: namn.trim(), w: v.w, h: v.h }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setFel(d.error || "Kunde inte spara"); return; }
      onSaved(d.screenFormats || []);
      onChange({ w: v.w, h: v.h, name: namn.trim() });
      setNamn("");
    } catch {
      setFel("Nätverksfel — försök igen");
    } finally {
      setSparar(false);
    }
  };

  const taBort = async (namnAttTa: string) => {
    try {
      const r = await fetch("/api/studio/screen-formats", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: namnAttTa }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) onSaved(d.screenFormats || []);
    } catch { /* tyst — inget kritiskt om borttagning inte lyckas direkt */ }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1.5 text-sm text-gray-600">
          Bredd
          <input type="number" min={200} max={4096} value={v.w}
            onChange={(e) => satt({ w: Number(e.target.value) })}
            className="w-20 rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:border-gray-400 outline-none" />
        </label>
        <span className="text-gray-300">×</span>
        <label className="flex items-center gap-1.5 text-sm text-gray-600">
          Höjd
          <input type="number" min={200} max={4096} value={v.h}
            onChange={(e) => satt({ h: Number(e.target.value) })}
            className="w-20 rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:border-gray-400 outline-none" />
        </label>
        <span className="text-xs text-gray-400">px · 200–4096</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {CUSTOM_SIZE_PRESETS.map((p) => {
          const active = v.w === p.w && v.h === p.h;
          return (
            <button key={p.label} onClick={() => onChange({ w: p.w, h: p.h })}
              className="rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors"
              style={active ? { borderColor: primary, color: primary, background: `${primary}0f` } : { borderColor: "#e5e7eb", color: "#374151" }}>
              {p.label}
            </button>
          );
        })}
      </div>

      {saved.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-xs font-semibold text-gray-500">Sparade mått</div>
          <div className="flex flex-wrap gap-2">
            {saved.map((s) => {
              const active = v.w === s.w && v.h === s.h && v.name === s.name;
              return (
                <div key={s.name} className="flex items-center gap-1 rounded-lg border overflow-hidden"
                  style={active ? { borderColor: primary } : { borderColor: "#e5e7eb" }}>
                  <button onClick={() => onChange(s)}
                    className="px-3 py-1.5 text-xs font-medium"
                    style={active ? { color: primary, background: `${primary}0f` } : { color: "#374151" }}>
                    {s.name} <span className="text-gray-400">{s.w}×{s.h}</span>
                  </button>
                  <button onClick={() => taBort(s.name)} title="Ta bort" className="px-2 py-1.5 text-gray-400 hover:text-red-500">×</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <input value={namn} onChange={(e) => setNamn(e.target.value)} placeholder="Namn, t.ex. Infartsskärmen"
          className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-gray-400 outline-none" />
        <button onClick={spara} disabled={sparar}
          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          style={{ background: primary }}>
          {sparar ? "Sparar…" : "Spara mått"}
        </button>
      </div>
      {fel && <p className="text-xs text-red-500">{fel}</p>}
    </div>
  );
}

// Full redigering av text (typsnitt, storlek, färg, radavstånd) + bildzoom. Delas mellan
// mall-lägets högerkolumn OCH "Redigera direkt"-modalen (bild vänster, detta till höger).
// Håkans besked 19/8: färgval på text/rubrik/textbakgrund ska ENBART gå att välja bland
// tenantens uppsatta brand-färger — ingen fri färgruta (till skillnad från penseldragets
// swatch-väljare, som medvetet har en "+"-genväg till valfri hex). Samma swatch-lista
// (klientens kit.colors) som redan laddas för brush-väljaren, återanvänd här.
function FargSwatchar({ value, onChange, swatches, standardLabel = "Standard" }: {
  value: string;
  onChange: (hex: string) => void;
  swatches: { name: string; hex: string }[];
  standardLabel?: string;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <button onClick={() => onChange("")} title={standardLabel === "Ingen" ? "Ingen platta" : "Mallens standardfärg"}
        className="w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-110"
        style={!value
          ? { border: "2px solid #111827", boxShadow: "0 0 0 2px #fff, 0 0 0 4px #111827" }
          : { border: "1px dashed #d1d5db", opacity: 0.6 }}>
        <span className="block w-4 h-px bg-gray-400 rotate-45" />
      </button>
      {swatches.map((s) => {
        const active = value?.toUpperCase() === s.hex.toUpperCase();
        return (
          <button key={s.hex} onClick={() => onChange(s.hex)} title={s.name}
            className="w-8 h-8 rounded-full border transition-transform hover:scale-110"
            style={{ background: s.hex, borderColor: active ? "#111827" : "#e5e7eb", boxShadow: active ? "0 0 0 2px #fff, 0 0 0 4px #111827" : "none" }} />
        );
      })}
    </div>
  );
}

function EditControls({ overrides, setOv, onReset, primary, hasImage, showBrush, showBadge, swatches, showFooterScale }: {
  overrides: StudioOverrides;
  setOv: (patch: Partial<StudioOverrides>) => void;
  onReset: () => void;
  primary: string;
  hasImage: boolean;
  showBrush: boolean;
  showBadge: boolean;
  swatches: { name: string; hex: string }[];
  showFooterScale?: boolean;
}) {
  const inputCls = "w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-gray-400 focus:ring-2 focus:ring-gray-100 outline-none";
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold text-sm uppercase tracking-wide text-gray-500">Typsnitt &amp; storlek</h3>
        <button onClick={onReset} className="text-xs text-gray-400 hover:text-gray-700">Återställ</button>
      </div>
      <div className="space-y-2.5">
        <div className="text-sm font-medium text-gray-600">Textstorlek: per ruta</div>
        <div>
          <label className="block text-xs text-gray-500 mb-0.5">Rubrik ({Math.round(overrides.h1Scale * 100)}%)</label>
          <input type="range" min={0.5} max={2} step={0.05} value={overrides.h1Scale} onChange={(e) => setOv({ h1Scale: Number(e.target.value) })} className="w-full" style={{ accentColor: primary }} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-0.5">Underrubrik ({Math.round(overrides.h2Scale * 100)}%)</label>
          <input type="range" min={0.5} max={2} step={0.05} value={overrides.h2Scale} onChange={(e) => setOv({ h2Scale: Number(e.target.value) })} className="w-full" style={{ accentColor: primary }} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-0.5">Brödtext ({Math.round(overrides.bodyScale * 100)}%)</label>
          <input type="range" min={0.5} max={2} step={0.05} value={overrides.bodyScale} onChange={(e) => setOv({ bodyScale: Number(e.target.value) })} className="w-full" style={{ accentColor: primary }} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-0.5">Radavstånd ({Math.round(overrides.lineScale * 100)}%)</label>
          <input type="range" min={0.8} max={1.8} step={0.05} value={overrides.lineScale} onChange={(e) => setOv({ lineScale: Number(e.target.value) })} className="w-full" style={{ accentColor: primary }} />
        </div>
        {showFooterScale && (
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">Fotplatta ({Math.round(overrides.footerScale * 100)}%)</label>
            <input type="range" min={0.5} max={2} step={0.05} value={overrides.footerScale} onChange={(e) => setOv({ footerScale: Number(e.target.value) })} className="w-full" style={{ accentColor: primary }} />
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1.5">Rubrikfärg</label>
          <FargSwatchar value={overrides.headlineColor} onChange={(hex) => setOv({ headlineColor: hex })} swatches={swatches} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1.5">Textfärg</label>
          <FargSwatchar value={overrides.bodyColor} onChange={(hex) => setOv({ bodyColor: hex })} swatches={swatches} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1.5">Typsnitt</label>
          <select value={overrides.fontFamily} onChange={(e) => setOv({ fontFamily: e.target.value })} className={inputCls} style={{ fontFamily: overrides.fontFamily ? `${overrides.fontFamily}, sans-serif` : undefined }}>
            <option value="">Standard (mall)</option>
            {STUDIO_FONTS.map((f) => <option key={f} value={f} style={{ fontFamily: `${f}, sans-serif` }}>{f}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1.5">Textbakgrund</label>
          <FargSwatchar value={overrides.textBg} onChange={(hex) => setOv({ textBg: hex })} swatches={swatches} standardLabel="Ingen" />
        </div>
      </div>
      {hasImage && (
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1.5">Bildzoom ({Math.round(overrides.imageScale * 100)}%)</label>
          <input type="range" min={1} max={3} step={0.05} value={overrides.imageScale} onChange={(e) => setOv({ imageScale: Number(e.target.value) })} className="w-full" style={{ accentColor: primary }} />
        </div>
      )}
      {/* KVALITET-3/6b — loggan väljs automatiskt efter bakgrunden, men du bestämmer.
          Automatiken är grunden, sista ordet är ditt. Sparas med inlägget. */}
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-1.5">Logotypen på bilden</label>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(LOGO_VARIANT_LABELS) as LogoVariantVal[]).map((v) => {
            const aktiv = (overrides.logoVariant || "") === v;
            return (
              <button key={v || "auto"} onClick={() => setOv({ logoVariant: v })}
                className="text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors"
                style={aktiv ? { borderColor: primary, background: `${primary}14`, color: primary } : { borderColor: "#e5e7eb", color: "#6b7280" }}>
                {LOGO_VARIANT_LABELS[v]}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-gray-400 mt-1.5">
          Auto mäter bakgrunden bakom loggan och väljer ljus eller mörk variant. Ser den fel ut — välj själv.
        </p>
      </div>
      {(showBrush || showBadge) && (
        <div className="flex flex-wrap gap-4 pt-1">
          {showBrush && (
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={!overrides.hideBrush} onChange={(e) => setOv({ hideBrush: !e.target.checked })} style={{ accentColor: primary }} /> Penselruta
            </label>
          )}
          {showBadge && (
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={!overrides.hideBadge} onChange={(e) => setOv({ hideBadge: !e.target.checked })} style={{ accentColor: primary }} /> Badge
            </label>
          )}
        </div>
      )}
    </div>
  );
}
