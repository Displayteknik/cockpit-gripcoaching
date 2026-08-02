// K2-4 DoD: piloten. Modulen PÅ för DT, av för alla andra, och kundvyns saldo
// svarar med ett riktigt konto (inte ett tomt läge) redan innan första anropet.
import { readFileSync } from "node:fs";
for (const l of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
}
const DT = "a6a33547-5ca7-475f-9a62-43ff2c74d000";
const { creditsAktivt, sakerstallKonto, hamtaSaldo, forbrukningKlartext } = await import("@/lib/credits");

console.log("credits aktivt för DT:", await creditsAktivt(DT));
const konto = await sakerstallKonto(DT);
console.log("konto:", konto ? `kvot ${konto.monthly_quota}, använt ${konto.used_this_period}, period ${konto.period_start}` : "kunde inte skapas");
const saldo = await hamtaSaldo(DT);
console.log("saldo som kundvyn visar:", JSON.stringify(saldo));
console.log("förbrukning i klartext (exempel):", forbrukningKlartext({ "social-bild": 14, video: 1, "hero-bild": 1 }));
