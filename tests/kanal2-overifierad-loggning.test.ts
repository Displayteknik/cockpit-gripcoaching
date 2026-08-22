// KANAL-2 tillägg (22/8, Håkans beslut): fail-closed är rätt, men den FÖRSTA riktiga
// inkopplingen av en av de fem overifierade kanalerna (tiktok/pinterest/youtube/
// threads/bluesky) ska loggas, inte tyst passera — så gissningen verifieras av
// verklig data i stället för att förbli en gissning för evigt.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { loggaOverifieradePlattformar } from "@/app/api/studio/ghl-accounts/route";
import { KANAL_ANATOMI } from "@/lib/kanal-anatomi";
import type { GhlKonto } from "@/lib/kanal-anatomi";

describe("loggaOverifieradePlattformar", () => {
  let spy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => { spy = vi.spyOn(console, "log").mockImplementation(() => {}); });

  it("en riktig tiktok-koppling loggas (gissningen bekräftad)", () => {
    const konton: GhlKonto[] = [{ platform: "tiktok" }];
    loggaOverifieradePlattformar("tenant-1", konton);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toContain("tiktok");
    expect(spy.mock.calls[0][0]).toContain("tenant-1");
  });

  it("en redan verifierad kanal (ig/fb/li/google) loggas ALDRIG — bara nya bevis är intressanta", () => {
    const konton: GhlKonto[] = [{ platform: "instagram" }, { platform: "facebook" }, { platform: "google" }];
    loggaOverifieradePlattformar("tenant-1", konton);
    expect(spy).not.toHaveBeenCalled();
  });

  it("en okänd plattformssträng (matchar ingen kanal alls) loggas inte här — inte vad funktionen bevakar", () => {
    const konton: GhlKonto[] = [{ platform: "snapchat" }];
    loggaOverifieradePlattformar("tenant-1", konton);
    expect(spy).not.toHaveBeenCalled();
  });

  it("flera overifierade kanaler i samma svep ger en loggrad var", () => {
    const konton: GhlKonto[] = [{ platform: "pinterest" }, { platform: "bluesky" }];
    loggaOverifieradePlattformar("tenant-2", konton);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("täcker exakt de fem kanaler som idag är markerade overifierade — inte fler, inte färre", () => {
    const overifierade = Object.values(KANAL_ANATOMI).filter((k) => !k.verifieradPlattformstrang);
    expect(overifierade.map((k) => k.key).sort()).toEqual(["bluesky", "pinterest", "threads", "tiktok", "youtube"]);
  });
});
