"use client";

// UTKAST-1 — autospar av pågående arbete, en gemensam hook för alla skapar-ytor.
//
// Problemet den löser: en refresh (eller ett tappat nät, eller en felnavigering) nollade
// allt man höll på med. Studio hade sedan BILD-2 ett halvt autospar — det SKREV till
// localStorage men ingenting LÄSTE tillbaka automatiskt, och nyckeln byggdes på slug som
// är tom sträng innan klienten hunnit laddas (alla tenants delade då samma "tomma" hink).
//
// Regler som gäller alla ytor:
//  1. Nyckeln innehåller ALLTID klient-id. Utan känd klient skrivs ingenting — ett utkast
//     får aldrig kunna läcka mellan tenants.
//  2. Debounce: skriv inte vid varje tangenttryck.
//  3. Tomt läge sparas inte, och rensar ett gammalt utkast (annars "återupptar" man tomhet).
//  4. Vid sidladdning återställs utkastet automatiskt och ytan visar en diskret rad
//     ("Fortsätter där du var") med möjlighet att börja om — som rensar utkastet.

import { useCallback, useEffect, useRef, useState } from "react";

const PREFIX = "cockpit-utkast";
const VERSION = 1;

interface Kuvert<T> {
  v: number;
  sparatVid: number; // epoch ms
  data: T;
}

/**
 * Nyckeln för ett utkast. Tom sträng när klienten inte är känd — och en tom nyckel
 * betyder att hooken varken läser eller skriver. Detta är tenant-spärren: utan
 * klient-id finns ingen hink att skriva i, så två klienter kan aldrig dela utkast.
 */
export function utkastNyckel(yta: string, klientId: string | null | undefined): string {
  if (!yta || !klientId) return "";
  return `${PREFIX}:${yta}:${klientId}`;
}

/** Tolkar ett lagrat kuvert. Fel version, trasig JSON eller saknad data → null. */
export function tolkaUtkast<T>(raw: string | null): { data: T; sparatVid: number | null } | null {
  if (!raw) return null;
  try {
    const kuvert = JSON.parse(raw) as Kuvert<T>;
    if (!kuvert || kuvert.v !== VERSION || kuvert.data == null) return null;
    return { data: kuvert.data, sparatVid: typeof kuvert.sparatVid === "number" ? kuvert.sparatVid : null };
  } catch {
    return null;
  }
}

export interface UtkastLage {
  /** Ett utkast återställdes vid sidladdning → visa "Fortsätter där du var". */
  aterupptaget: boolean;
  /** När utkastet senast sparades (epoch ms), eller null. */
  sparatVid: number | null;
  /** "Börja om": rensar utkastet och döljer raden. Nollställer INTE formuläret — det gör ytan själv. */
  glomUtkast: () => void;
}

export interface UtkastOpts<T> {
  /** Ytans namn, t.ex. "studio", "blogg", "nyhetsbrev", "veckoplan", "reels". */
  yta: string;
  /** Aktiv klient. null/tom = vänta; hooken varken läser eller skriver utan klient. */
  klientId: string | null | undefined;
  /** Aktuellt läge att spara. Memoisera i ytan så effekten inte går varje render. */
  data: T;
  /** Fyller ytan från ett sparat utkast. Måste vara stabil (useCallback). */
  aterstall: (d: T) => void;
  /** Finns det något värt att spara/återställa? Tomt läge sparas aldrig. */
  harInnehall: (d: T) => boolean;
  /**
   * Tömmer ytan. Anropas när man BYTER klient och den nya klienten saknar utkast.
   *
   * Utan den stod förra klientens texter kvar under den nya klientens namn — Håkans
   * fynd 10/8. Anropas ALDRIG vid första sidladdningen: då finns inget att tömma, och
   * ett nollställande där hade slagit sönder djuplänkar och öppnade inlägg.
   */
  nollstall?: () => void;
  /** Debounce i ms innan skrivning. Default 800. */
  fordrojning?: number;
}

export function useUtkast<T>({
  yta,
  klientId,
  data,
  aterstall,
  harInnehall,
  nollstall,
  fordrojning = 800,
}: UtkastOpts<T>): UtkastLage {
  const nyckel = utkastNyckel(yta, klientId);
  const [aterupptaget, setAterupptaget] = useState(false);
  const [sparatVid, setSparatVid] = useState<number | null>(null);

  // Vilken nyckel som redan lästs — så återställningen sker EN gång per klient, och så
  // autosparet aldrig hinner skriva över utkastet innan det hunnit läsas.
  const lastNyckel = useRef("");

  // Senaste callbacks utan att trigga om effekterna (ytorna skickar ofta inline-funktioner).
  const aterstallRef = useRef(aterstall);
  aterstallRef.current = aterstall;
  const harInnehallRef = useRef(harInnehall);
  harInnehallRef.current = harInnehall;
  const nollstallRef = useRef(nollstall);
  nollstallRef.current = nollstall;

  // ── Läs vid sidladdning / klientbyte ──
  useEffect(() => {
    if (!nyckel || lastNyckel.current === nyckel) return;
    // ⚠ Håkans fynd 10/8: ETT KLIENTBYTE ÄR INTE EN SIDLADDNING.
    // Bytte man till en klient UTAN sparat utkast returnerade effekten direkt, och
    // förra klientens texter stod kvar på skärmen under den nya klientens namn:
    // Displaytekniks skyltförslag låg kvar när AluCon var vald. Ingen data läckte
    // mellan konton — allt är byråvyn — men nästa klick kunde ha publicerat fel
    // kunds text i rätt kunds kanal.
    //
    // `byte` skiljer det verkliga bytet från första läsningen: vid sidladdning finns
    // ingenting att tömma, och att nollställa då hade slagit sönder djuplänkar och
    // återställda inlägg.
    const byte = lastNyckel.current !== "";
    lastNyckel.current = nyckel;
    setAterupptaget(false);
    setSparatVid(null);
    const tomYtan = () => { if (byte) nollstallRef.current?.(); };
    try {
      const tolkat = tolkaUtkast<T>(localStorage.getItem(nyckel));
      if (!tolkat) { localStorage.removeItem(nyckel); tomYtan(); return; }
      if (!harInnehallRef.current(tolkat.data)) { localStorage.removeItem(nyckel); tomYtan(); return; }
      aterstallRef.current(tolkat.data);
      setAterupptaget(true);
      setSparatVid(tolkat.sparatVid);
    } catch {
      // Trasig/ofullständig JSON ska aldrig blockera ytan.
      try { localStorage.removeItem(nyckel); } catch { /* ignorera */ }
      tomYtan();
    }
  }, [nyckel]);

  // ── Autospara (debounce) ──
  useEffect(() => {
    // Skriv aldrig innan läsningen skett för DENNA nyckel — annars skrivs utkastet
    // över av det tomma startläget i samma render-svep som sidan laddas.
    if (!nyckel || lastNyckel.current !== nyckel) return;
    const t = setTimeout(() => {
      try {
        if (!harInnehallRef.current(data)) {
          localStorage.removeItem(nyckel);
          setSparatVid(null);
          return;
        }
        const sparat = Date.now();
        const kuvert: Kuvert<T> = { v: VERSION, sparatVid: sparat, data };
        localStorage.setItem(nyckel, JSON.stringify(kuvert));
        setSparatVid(sparat);
      } catch {
        // Full kvot / privat läge: autosparet är en bekvämlighet, aldrig ett hinder.
      }
    }, fordrojning);
    return () => clearTimeout(t);
  }, [nyckel, data, fordrojning]);

  const glomUtkast = useCallback(() => {
    try { if (nyckel) localStorage.removeItem(nyckel); } catch { /* ignorera */ }
    setAterupptaget(false);
    setSparatVid(null);
  }, [nyckel]);

  return { aterupptaget, sparatVid, glomUtkast };
}

/** "14:32" — klockslag för raden "Fortsätter där du var". Tom sträng om tiden saknas. */
export function utkastTid(sparatVid: number | null): string {
  if (!sparatVid) return "";
  try {
    return new Date(sparatVid).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}
