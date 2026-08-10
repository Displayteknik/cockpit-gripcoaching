// @vitest-environment happy-dom
//
// UTKAST-1 DoD, automatiserad: bygg något halvvägs → "ladda om sidan" → allt kvar.
// Omladdningen simuleras genom att avmontera komponenten och montera en HELT ny — precis
// som en refresh: allt React-state är borta, bara localStorage finns kvar.

import { describe, expect, it, beforeEach } from "vitest";
import { createElement, useCallback, useMemo, useState } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useUtkast, utkastNyckel } from "@/lib/studio/useUtkast";

// Reflekterar Studios utkast: ämne, text på bilden, vald bild, bildtext, valda idéer.
interface Session {
  topic: string;
  headline1: string;
  imageUrl: string;
  caption: string;
  suggestions: { headline1: string }[];
}
const TOMT: Session = { topic: "", headline1: "", imageUrl: "", caption: "", suggestions: [] };

// En minimal "yta" som använder hooken exakt som Studio/blogg/veckoplan gör.
function Yta({ klientId, spion }: { klientId: string | null; spion: { session: Session; aterupptaget: boolean; nollstalld?: number; satt?: (p: Partial<Session>) => void } }) {
  const [s, setS] = useState<Session>(TOMT);
  const data = useMemo(() => s, [s]);
  const { aterupptaget } = useUtkast<Session>({
    yta: "test",
    klientId,
    data,
    aterstall: useCallback((d: Session) => setS({ ...TOMT, ...d }), []),
    harInnehall: useCallback((d: Session) => Boolean(d.topic || d.headline1 || d.imageUrl || d.caption || d.suggestions?.length), []),
    // Hakans fynd 10/8: vid klientbyte utan utkast maste ytan tommas, annars star
    // forra klientens texter kvar under den nya klientens namn.
    nollstall: useCallback(() => { setS(TOMT); spion.nollstalld = (spion.nollstalld ?? 0) + 1; }, [spion]),
    fordrojning: 0,
  });
  spion.session = s;
  spion.aterupptaget = aterupptaget;
  spion.satt = (p) => setS((prev) => ({ ...prev, ...p }));
  return null;
}

async function montera(klientId: string | null) {
  const el = document.createElement("div");
  document.body.appendChild(el);
  const spion = { session: TOMT, aterupptaget: false, nollstalld: 0 } as { session: Session; aterupptaget: boolean; nollstalld: number; satt?: (p: Partial<Session>) => void };
  let root: Root;
  await act(async () => {
    root = createRoot(el);
    root.render(createElement(Yta, { klientId, spion }));
  });
  // Låt debouncen (0 ms) och dess setState landa.
  await act(async () => { await new Promise((r) => setTimeout(r, 5)); });
  return {
    spion,
    async skriv(p: Partial<Session>) {
      await act(async () => { spion.satt!(p); });
      await act(async () => { await new Promise((r) => setTimeout(r, 5)); });
    },
    async laddaOm() {
      await act(async () => { root!.unmount(); });
      el.remove();
    },
  };
}

// happy-dom kommer med vitest-installationen (och @tiptap/html) — ingen ny beroendekedja.
// Flaggan talar om för React att act() är tillåtet här, annars varnar varje rendering.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  localStorage.clear();
});

describe("UTKAST-1 — omladdning behåller allt", () => {
  it("halvfärdigt arbete överlever en omladdning", async () => {
    const a = await montera("klient-1");
    await a.skriv({ topic: "höstens erbjudande", headline1: "SYNS I SOLEN", imageUrl: "https://x/bild.png", caption: "Utkast till bildtext", suggestions: [{ headline1: "Alternativ A" }] });
    expect(a.spion.aterupptaget).toBe(false); // inget att återuppta första gången
    await a.laddaOm();

    const b = await montera("klient-1");
    expect(b.spion.session.topic).toBe("höstens erbjudande");
    expect(b.spion.session.headline1).toBe("SYNS I SOLEN");
    expect(b.spion.session.imageUrl).toBe("https://x/bild.png");
    expect(b.spion.session.caption).toBe("Utkast till bildtext");
    expect(b.spion.session.suggestions).toEqual([{ headline1: "Alternativ A" }]);
    expect(b.spion.aterupptaget).toBe(true); // → raden "Fortsätter där du var" visas
  });

  it("utkastet läcker ALDRIG till en annan klient", async () => {
    const a = await montera("klient-1");
    await a.skriv({ topic: "klient 1:s hemlighet" });
    await a.laddaOm();

    const b = await montera("klient-2");
    expect(b.spion.session.topic).toBe("");
    expect(b.spion.aterupptaget).toBe(false);
    expect(localStorage.getItem(utkastNyckel("test", "klient-2"))).toBeNull();

    // ...och klient 1:s utkast ligger kvar orört.
    await b.laddaOm();
    const c = await montera("klient-1");
    expect(c.spion.session.topic).toBe("klient 1:s hemlighet");
  });

  it("skriver ingenting alls innan klienten är känd", async () => {
    const a = await montera(null);
    await a.skriv({ topic: "skrivet före inloggning" });
    expect(localStorage.length).toBe(0);
  });

  it("tomt läge sparas inte — raden dyker inte upp av sig själv", async () => {
    const a = await montera("klient-1");
    await a.skriv({ topic: "" });
    expect(localStorage.getItem(utkastNyckel("test", "klient-1"))).toBeNull();
    await a.laddaOm();
    const b = await montera("klient-1");
    expect(b.spion.aterupptaget).toBe(false);
  });

  it("tömmer man ytan rensas utkastet — omladdning ger tomt, inte spöket", async () => {
    const a = await montera("klient-1");
    await a.skriv({ topic: "något" });
    expect(localStorage.getItem(utkastNyckel("test", "klient-1"))).not.toBeNull();
    await a.skriv({ topic: "" });
    expect(localStorage.getItem(utkastNyckel("test", "klient-1"))).toBeNull();
  });
});

describe("UTKAST · klientbyte lämnar aldrig kvar förra klientens text", () => {
  // Håkans fynd 10/8: han stod på AluCon men såg Displaytekniks skyltförslag. Effekten
  // returnerade direkt när den NYA klienten saknade utkast — utan att tömma ytan. Ingen
  // data läckte mellan konton (allt är byråvyn), men nästa klick kunde ha publicerat fel
  // kunds text i rätt kunds kanal.
  it("byte till en klient UTAN utkast tömmer ytan", async () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    const spion = { session: TOMT, aterupptaget: false, nollstalld: 0 } as { session: Session; aterupptaget: boolean; nollstalld: number; satt?: (p: Partial<Session>) => void };
    let root: Root;
    await act(async () => {
      root = createRoot(el);
      root.render(createElement(Yta, { klientId: "klient-A", spion }));
    });
    // Klient A får innehåll som autosparas.
    await act(async () => { spion.satt!({ topic: "A:s ämne", headline1: "A:s rubrik" }); });
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(spion.session.headline1).toBe("A:s rubrik");

    // Byt till klient B, som aldrig sparat något.
    await act(async () => { root!.render(createElement(Yta, { klientId: "klient-B", spion })); });
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });

    expect(spion.nollstalld).toBe(1);
    expect(spion.session.headline1).toBe("");
    expect(spion.session.topic).toBe("");
  });

  it("första laddningen nollställer ALDRIG", async () => {
    // Vid sidladdning finns inget att tömma, och ett nollställande där hade slagit
    // sönder djuplänkar och öppnade inlägg.
    const el = document.createElement("div");
    document.body.appendChild(el);
    const spion = { session: TOMT, aterupptaget: false, nollstalld: 0 } as { session: Session; aterupptaget: boolean; nollstalld: number; satt?: (p: Partial<Session>) => void };
    await act(async () => { createRoot(el).render(createElement(Yta, { klientId: "helt-ny-klient", spion })); });
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(spion.nollstalld).toBe(0);
  });
});
