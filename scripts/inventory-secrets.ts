// ANSLUT-4 — inventering av hemligheter.
// Två jobb:
//   1. Hittar HÅRDKODADE hemligheter i repot (JWT/eyJ, Supabase-PAT sbp_, Resend re_,
//      långa hex-secrets) UTANFÖR env-filer → dessa ska aldrig ligga i koden.
//   2. Listar var känsliga env-nycklar KONSUMERAS (process.env.NAMN) så rotation blir spårbar.
//
// Usage:  npx tsx scripts/inventory-secrets.ts
// Exit-kod 1 om någon hårdkodad hemlighet hittas.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, extname } from "node:path";

const ROOT = process.cwd();
const SKIP_DIRS = new Set([".git", "node_modules", ".next", "dist", "build", ".vercel", "qa-screens", "scratchpad"]);
const SCAN_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".md", ".sql", ".yml", ".yaml"]);
// Env-filer undantas från hårdkod-jakten (där SKA hemligheterna bo).
const IS_ENV_FILE = (name: string) => /^\.env(\..*)?$/.test(name) || name.endsWith(".env");

const SECRET_PATTERNS: { name: string; re: RegExp }[] = [
  { name: "JWT / Supabase-nyckel (eyJ)", re: /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/g },
  { name: "Supabase PAT (sbp_)", re: /sbp_[A-Za-z0-9]{30,}/g },
  { name: "Resend-nyckel (re_)", re: /re_[A-Za-z0-9_]{20,}/g },
  { name: "OpenAI/Anthropic-nyckel (sk-)", re: /sk-[A-Za-z0-9_-]{20,}/g },
];

// Känsliga env-namn vi vill spåra konsumtion av.
const SENSITIVE_ENV = [
  "SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "IG_APP_SECRET", "TOKEN_ENC_KEY",
  "ADMIN_SESSION_SECRET", "ADMIN_PASSWORD", "RESEND_API_KEY", "CRON_SECRET", "GEMINI_API_KEY",
  "ANTHROPIC_API_KEY", "FAL_KEY", "PEXELS_API_KEY", "PIXABAY_API_KEY", "ELKS_API_PASSWORD",
  "ELKS_API_USERNAME", "IG_WEBHOOK_VERIFY_TOKEN", "META_OAUTH_REDIRECT",
];

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) {
      if (!SKIP_DIRS.has(entry)) walk(full, files);
    } else if (SCAN_EXT.has(extname(entry)) && !IS_ENV_FILE(entry)) {
      files.push(full);
    }
  }
  return files;
}

function mask(s: string): string {
  return s.length <= 12 ? "***" : `${s.slice(0, 6)}…${s.slice(-4)}`;
}

const files = walk(ROOT);
const findings: string[] = [];
const envUsage = new Map<string, string[]>();

for (const f of files) {
  const rel = relative(ROOT, f);
  let text: string;
  try { text = readFileSync(f, "utf8"); } catch { continue; }
  const lines = text.split(/\r?\n/);

  lines.forEach((line, i) => {
    for (const p of SECRET_PATTERNS) {
      p.re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = p.re.exec(line))) {
        findings.push(`  ${rel}:${i + 1}  [${p.name}]  ${mask(m[0])}`);
      }
    }
    for (const name of SENSITIVE_ENV) {
      if (line.includes(`process.env.${name}`)) {
        if (!envUsage.has(name)) envUsage.set(name, []);
        const arr = envUsage.get(name)!;
        const loc = `${rel}:${i + 1}`;
        if (!arr.includes(loc)) arr.push(loc);
      }
    }
  });
}

console.log(`\n=== Hårdkodade hemligheter (utanför env-filer) ===`);
if (findings.length === 0) {
  console.log("  Inga hittade. ✓");
} else {
  findings.forEach((l) => console.log(l));
}

console.log(`\n=== Var känsliga env-nycklar konsumeras ===`);
for (const name of SENSITIVE_ENV) {
  const uses = envUsage.get(name);
  console.log(`  ${name.padEnd(32)} ${uses && uses.length ? uses.join(", ") : "(används inte i koden)"}`);
}

console.log(`\nSkannade ${files.length} filer.\n`);
process.exit(findings.length === 0 ? 0 : 1);
