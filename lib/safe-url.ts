// SSRF-skydd för rutter som hämtar en användarangiven URL (seo/audit, competitors/analyze,
// images/upload). Dessa måste få hämta godtyckliga PUBLIKA sidor (t.ex. konkurrenter) — så
// domän-lås passar inte — men ALDRIG interna/privata adresser. assertSafePublicUrl blockerar
// localhost, privata IP-intervall och moln-metadata (169.254.169.254), inkl. via DNS-resolve.
import dns from "node:dns/promises";
import net from "node:net";

const PRIVATE_V4: RegExp[] = [
  /^0\./,
  /^10\./,
  /^127\./,
  /^169\.254\./, // link-local + moln-metadata
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // CGNAT 100.64/10
];

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) return PRIVATE_V4.some((re) => re.test(ip));
  if (net.isIPv6(ip)) {
    const x = ip.toLowerCase();
    if (x === "::1" || x === "::") return true;
    if (x.startsWith("fc") || x.startsWith("fd") || x.startsWith("fe80")) return true; // ULA + link-local
    // IPv4-mappad IPv6 (::ffff:a.b.c.d)
    const m = x.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (m) return isPrivateIp(m[1]);
  }
  return false;
}

// Kastar Error om url inte är en säker, publik http(s)-resurs. Returnerar annars URL-objektet.
export async function assertSafePublicUrl(raw: string): Promise<URL> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("Ogiltig URL");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("Endast http/https tillåtet");
  }
  const hostname = u.hostname.toLowerCase().replace(/^\[|\]$/g, ""); // strip ev. IPv6-klamrar
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    throw new Error("Intern host ej tillåten");
  }
  // IP-literal direkt i URL:en
  if (net.isIP(hostname) && isPrivateIp(hostname)) {
    throw new Error("Privat IP ej tillåten");
  }
  // Hostnamn → resolva och blockera om det pekar på privat IP (SSRF/DNS-rebinding-skydd).
  if (!net.isIP(hostname)) {
    try {
      const addrs = await dns.lookup(hostname, { all: true });
      if (addrs.some((a) => isPrivateIp(a.address))) {
        throw new Error("Host pekar på privat IP");
      }
    } catch (e) {
      // Bara vår egen "privat IP"-throw ska stoppa; DNS-fel av annan orsak lämnas till fetch.
      if (e instanceof Error && e.message.includes("privat IP")) throw e;
    }
  }
  return u;
}
