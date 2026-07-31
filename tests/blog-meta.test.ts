// Enhetstester för klippOrdgrans (T-5 punkt 4) — metaTitle/metaDescription ska
// klippas på ordgräns, aldrig mitt i ord ("| Disp"-buggen ur TEXT1-mätningen).

import { describe, expect, it } from "vitest";
import { klippOrdgrans } from "@/lib/studio/blog";

describe("klippOrdgrans", () => {
  it("'| Disp'-buggen: kapar på ordgräns och städar dinglande avgränsare", () => {
    const s = "Misstaget som kostar mest vid köp av digitala skärmar | Displayteknik";
    const ut = klippOrdgrans(s, 60);
    expect(ut).toBe("Misstaget som kostar mest vid köp av digitala skärmar");
    expect(ut.length).toBeLessThanOrEqual(60);
  });

  it("kort sträng lämnas orörd", () => {
    expect(klippOrdgrans("Kort titel | Företaget", 60)).toBe("Kort titel | Företaget");
  });

  it("exakt på taket lämnas orörd", () => {
    const s = "a".repeat(60);
    expect(klippOrdgrans(s, 60)).toBe(s);
  });

  it("ett enda långt ord utan mellanslag hårdklipps på taket", () => {
    expect(klippOrdgrans("x".repeat(80), 60)).toBe("x".repeat(60));
  });

  it("klipper aldrig mitt i ett ord", () => {
    const ut = klippOrdgrans("Välj rätt ljusstyrka för skyltfönstret i vinterlandskapet nu", 55);
    expect(ut.length).toBeLessThanOrEqual(55);
    expect(ut.endsWith("vinterlandskapet") || !ut.includes("vinterlandskape")).toBe(true);
  });
});
