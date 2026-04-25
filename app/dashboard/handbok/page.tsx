"use client";

import Link from "next/link";
import { BookOpen, Sparkles, Target, MessageCircle, Calendar, Pencil, Rocket, FileText, Copy, Users } from "lucide-react";

export default function HandbokPage() {
  return (
    <div className="max-w-3xl space-y-8 pb-16">
      <div>
        <h1 className="font-display text-3xl font-bold text-gray-900 flex items-center gap-3">
          <BookOpen className="w-7 h-7 text-brand-blue" />
          Handbok
        </h1>
        <p className="text-gray-500 mt-2">
          Hur du driver säljmaskinen optimalt — och hur samma mall återanvänds för dina coaching-klienter.
        </p>
      </div>

      <Card icon={Rocket} color="blue" title="0. Första gången — setup (10 min)">
        <Ol>
          <li>Gå till <Link href="/dashboard/profil" className="link">Brand-profil</Link> och kör <strong>ICP-wizarden</strong> + <strong>Ton-wizarden</strong>. Fyll i resten med AI-fyll-knapparna.</li>
          <li>Gå till <Link href="/dashboard/fordon" className="link">Fordon</Link> och lägg in minst 5 fordon med bilder och specs.</li>
          <li>Öppna <Link href="/dashboard/social" className="link">Social</Link> — skapa 3 inlägg för att testa tonen. Korrigera profilen om något skaver.</li>
          <li>Kolla <Link href="/" className="link">publika sajten</Link> — coach-widgeten ska fungera nere till höger.</li>
        </Ol>
        <Tip>När profilen är satt läser <em>alla</em> generatorer den automatiskt. Du behöver aldrig upprepa ton/ICP i prompts.</Tip>
      </Card>

      <Card icon={Calendar} color="purple" title="Daglig/veckorutin — 15 min per dag">
        <Ol>
          <li><strong>Måndag:</strong> Kolla <Link href="/dashboard" className="link">översikten</Link>. Ser du nya leads? Följ upp inom 2 h.</li>
          <li><strong>Tis/Tor:</strong> Skapa 2 sociala inlägg i <Link href="/dashboard/social" className="link">Social</Link>. Rotera mellan fråge-hook, berättelse, djärvt påstående.</li>
          <li><strong>Ons:</strong> Granska bloggutkast (blogg-maskinen körde kl 07). Publicera eller skicka tillbaka för omskrivning.</li>
          <li><strong>Fredag:</strong> Kolla <Link href="/dashboard/blogg-maskin" className="link">kön</Link> — minst 3 ämnen framåt för kommande vecka.</li>
        </Ol>
      </Card>

      <Card icon={Sparkles} color="purple" title="Social-generator — så får du konverterande inlägg">
        <Ol>
          <li>Välj plattform (IG eller FB) och format som passar syftet.</li>
          <li>Koppla ett fordon om inlägget ska sälja något specifikt — Gemini använder specs automatiskt.</li>
          <li>Ange vinkel och ev. extra info (säsong, kampanj).</li>
          <li>Generera → granska → <Copy className="w-3.5 h-3.5 inline -mt-0.5" /> kopiera → posta. Markera godkänd <Users className="w-3.5 h-3.5 inline -mt-0.5" /> så är den sparad som referens.</li>
        </Ol>
        <Tip>Låt inte AI posta direkt. Läs alltid igenom och ändra EN detalj — då blir det ditt.</Tip>
      </Card>

      <Card icon={FileText} color="emerald" title="Blogg-maskin — automatiserat SEO-bygge">
        <Ol>
          <li>Klicka <strong>&quot;Föreslå 8 ämnen&quot;</strong> — Gemini ser på lagret och gör SEO-förslag.</li>
          <li>Lägg till de som passar i kön (prio 8–10 = köp-heta, 5–7 = trust, 1–4 = nice-to-have).</li>
          <li><strong>Cron kör automatiskt mån/ons/fre kl 07:00</strong> och tar nästa ämne. Utkast läggs i blogg-tabellen som <em>ej publicerat</em>.</li>
          <li>Granska utkast i <Link href="/dashboard/blogg" className="link">Blogg</Link>, justera, publicera manuellt.</li>
          <li>Behöver du något NU? Klicka <em>&quot;Kör nu&quot;</em> på ämnet.</li>
        </Ol>
      </Card>

      <Card icon={MessageCircle} color="blue" title="Coach-widget på sajten">
        <p className="mb-3">Syns nere till höger på publika sajten. Har tillgång till hela lagret + brand-profil. Hjälper kunden hitta rätt fordon, ger bytesvärde-grovskattning, fångar leads.</p>
        <Ol>
          <li>När kunden lämnar telefonnummer → automatisk lead i <Link href="/dashboard/fordon" className="link">databasen</Link> (tabell <code>hm_leads</code>).</li>
          <li>Justera coachens beteende i <Link href="/dashboard/profil" className="link">Brand-profil → Tonregler + GÖR/GÖR INTE</Link>.</li>
          <li>Testa själv genom att öppna publika sajten och klicka chat-bubblan.</li>
        </Ol>
      </Card>

      <Card icon={Pencil} color="amber" title="Redigera sidor (Puck-editor)">
        <p>Klicka <Link href="/admin" className="link">&quot;Sideditor&quot;</Link> uppe i headern. Drag &amp; drop, designverktyg för typografi, färger, gradienter, bilder. Spara = publicerat direkt (Supabase).</p>
      </Card>

      <div className="bg-gradient-to-br from-purple-50 via-blue-50 to-emerald-50 border border-purple-100 rounded-xl p-6">
        <h2 className="font-display text-xl font-bold text-gray-900 flex items-center gap-2 mb-3">
          <Target className="w-6 h-6 text-purple-600" />
          Så återanvänder du mallen för andra coaching-klienter
        </h2>
        <p className="text-sm text-gray-700 leading-relaxed mb-4">
          Den här sajten är byggd som en mall. All klient-specifik info ligger i <strong>brand-profilen</strong> och <strong>Supabase-tabellerna</strong> — inte i koden.
        </p>
        <Ol>
          <li><strong>Forka repot</strong> (GitHub: <code>Displayteknik/hmmotor-next</code> → Use this template).</li>
          <li><strong>Skapa nya Supabase-tabeller</strong> med samma schema eller byt projekt-ref i env-variabler.</li>
          <li><strong>Byt tabellprefix</strong> från <code>hm_</code> till klientens prefix (t.ex. <code>dk_</code>) om ni delar Supabase-projekt.</li>
          <li><strong>Deploya till Vercel</strong> — en egen domän per klient.</li>
          <li><strong>Logga in på nya dashboarden</strong> → kör ICP-wizard + Ton-wizard → klart på 30 min.</li>
        </Ol>
        <Tip>
          Klient-specifik &quot;hemlig sås&quot; = <code>knowledge/</code>-mappens markdown-filer. De är generella för ett vertikal (bilhandel här). För coaching-klient i ny bransch: byt ut <code>company.md</code>, <code>viral-hooks.md</code> kan oftast behållas, <code>conversion.md</code> behöver branschtrigger-anpassning.
        </Tip>
      </div>

      <Card icon={AlertIcon} color="red" title="Vanliga fällor">
        <ul className="list-disc pl-5 space-y-2 text-sm">
          <li>Glöm inte justera <strong>brand-profilen</strong> löpande. Saknas den blir AI generisk.</li>
          <li>Publicera aldrig AI-text utan att läsa. Hitta EN sak att ändra så blir det ditt.</li>
          <li>Om Gemini svarar konstigt → sänk <em>temperature</em> i koden (default 0.8), eller fyll i mer i profilen.</li>
          <li>Cron på Vercel kräver <code>CRON_SECRET</code> i env-vars. Utan den körs cron öppet (OK första veckan, fixa innan prod).</li>
          <li>Supabase anon-key används just nu — bra för dig som ensam ägare, inte bra för multi-user. Dra till service-role om det skalar.</li>
        </ul>
      </Card>
    </div>
  );
}

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

const colorMap = {
  blue: "bg-blue-50 text-blue-600 border-blue-100",
  purple: "bg-purple-50 text-purple-600 border-purple-100",
  emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
  amber: "bg-amber-50 text-amber-600 border-amber-100",
  red: "bg-red-50 text-red-600 border-red-100",
} as const;

function Card({ icon: Icon, color, title, children }: { icon: React.ComponentType<{ className?: string }>; color: keyof typeof colorMap; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h2 className="font-display font-bold text-lg text-gray-900 flex items-center gap-2 mb-3">
        <span className={`w-8 h-8 rounded-lg flex items-center justify-center border ${colorMap[color]}`}>
          <Icon className="w-4 h-4" />
        </span>
        {title}
      </h2>
      <div className="text-sm text-gray-700 leading-relaxed space-y-2">{children}</div>
    </div>
  );
}

function Ol({ children }: { children: React.ReactNode }) {
  return <ol className="list-decimal pl-5 space-y-2">{children}</ol>;
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 bg-amber-50 border-l-2 border-amber-400 px-3 py-2 rounded text-xs text-amber-900">
      💡 {children}
    </div>
  );
}
