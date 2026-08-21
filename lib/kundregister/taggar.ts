// KUNDREGISTER-1, DEL 4-tillägget (HELG-1, 2026-08-21): kundbegripliga taggnamn + delad
// filtrering. Delas mellan kundregistrets egen yta (components/Kundregister.tsx) och det
// kommande nyhetsbrevflödets mottagarurval (platform_modules "newsletter", ej byggt än)
// — samma taggfilter ska styra båda, inte återuppfinnas i en andra komponent.
//
// ⚠ SYSTEMMÄSSIGT, INTE PER KUND: taggarna som faktiskt går att filtrera på räknas alltid
// ur det tenanten HAR i MySales (se app/api/kundregister/route.ts), aldrig ur en handskriven
// lista — en tagg som ingen kontakt bär ska inte gå att välja. Formateringen nedan är därför
// en GENERISK omskrivning (versaler, bindestreck → mellanslag, kända förkortningar), inte en
// per-tenant ordbok — en sådan hade krävt att känna till varje kunds egna taggar i förväg,
// vilket motsäger hela poängen med att läsa dem ur verkligheten.

/** Ord som ska behålla sin egen skrivning i stället för Versal-Varje-Ord. */
const SARSKILDA_ORD: Record<string, string> = {
  mysales: "MySales",
  ghl: "GHL",
  seo: "SEO",
  aeo: "AEO",
  vip: "VIP",
  dm: "DM",
  cta: "CTA",
};

/**
 * Rå GHL-tagg ("offert-lead", "mysales coach") → kundbegripligt namn ("Offert-lead",
 * "MySales Coach"). Rent format, ingen semantisk gissning — filtreringen sker alltid på
 * RÅ-taggen (se `matcharTaggar`), aldrig på det formaterade namnet, så en framtida
 * omformatering aldrig kan tysta ett filter som redan fungerar.
 */
export function visningsnamnForTagg(raTagg: string): string {
  const versalEllerForkortning = (ord: string, forstaIOrdet: boolean) => {
    const kand = SARSKILDA_ORD[ord.toLowerCase()];
    if (kand) return kand;
    if (!ord) return ord;
    // Bara ordets FÖRSTA bindestreck-del versaliseras ("Offert-lead", inte "Offert-Lead")
    // — en sammansättning är ett ord, inte en egen rubrik per del.
    return forstaIOrdet ? ord[0].toUpperCase() + ord.slice(1).toLowerCase() : ord.toLowerCase();
  };
  return raTagg
    .split(/[\s_]+/)
    .map((ordMedBindestreck) =>
      ordMedBindestreck
        .split("-")
        .map((del, i) => versalEllerForkortning(del, i === 0))
        .join("-"),
    )
    .join(" ");
}

/** En kontakt matchar om den bär MINST EN av de valda taggarna (OR) — naturligt för både
 * "visa mig lead ELLER offert-lead" och ett framtida nyhetsbrevs mottagarurval, där man
 * oftast vill nå flera segment i ett utskick, inte bara skärningen mellan dem. */
export function matcharTaggar(kontaktTaggar: string[], valdaTaggar: string[]): boolean {
  if (!valdaTaggar.length) return true;
  const set = new Set(kontaktTaggar);
  return valdaTaggar.some((t) => set.has(t));
}

export function matcharKalla(kontaktKalla: string, valdaKallor: string[]): boolean {
  if (!valdaKallor.length) return true;
  return valdaKallor.includes(kontaktKalla);
}
