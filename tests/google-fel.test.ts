import { describe, it, expect } from "vitest";
import { tolkaGoogleFel } from "@/lib/hq/google-fel";

// Felsvaren är kopierade ordagrant ur skarpa anrop mot Håkans koppling 2026-08-02.

const API_AV = JSON.stringify({
  error: {
    code: 403,
    message:
      "Google Calendar API has not been used in project 773740289261 before or it is disabled. Enable it by visiting https://console.developers.google.com/apis/api/calendar-json.googleapis.com/overview?project=773740289261 then retry.",
    status: "PERMISSION_DENIED",
  },
});

describe("tolkaGoogleFel", () => {
  it("förklarar avstängt API i klarspråk och länkar till rätt projekt", () => {
    const f = tolkaGoogleFel(403, API_AV, "kalender");
    expect(f.text).toContain("Google Calendar API är inte påslaget");
    expect(f.text).toContain("773740289261");
    expect(f.lank).toBe("https://console.cloud.google.com/apis/library/calendar-json.googleapis.com?project=773740289261");
    expect(f.lankText).toBe("Slå på Google Calendar API");
  });

  it("pekar på Gmail-biblioteket när det är Gmail som är avstängt", () => {
    const f = tolkaGoogleFel(403, API_AV.replace("Google Calendar API", "Gmail API"), "gmail");
    expect(f.lank).toContain("gmail.googleapis.com");
    expect(f.text).toContain("Gmail API är inte påslaget");
  });

  // Utan projektnumret ska länken ändå fungera, bara utan förvalt projekt.
  it("klarar sig utan projektnummer i svaret", () => {
    const f = tolkaGoogleFel(403, '{"error":{"message":"Gmail API ... it is disabled"}}', "gmail");
    expect(f.lank).toBe("https://console.cloud.google.com/apis/library/gmail.googleapis.com");
  });

  it("skiljer saknad behörighet från avstängt API", () => {
    const f = tolkaGoogleFel(403, '{"error":{"message":"Request had insufficient authentication scopes."}}', "gmail");
    expect(f.text).toContain("saknar behörighet");
    expect(f.lank).toBeUndefined();
  });

  it("utgången koppling ber om omkoppling", () => {
    expect(tolkaGoogleFel(401, "invalid_grant", "kalender").text).toContain("gått ut");
  });

  it("kvotfel säger att man ska vänta", () => {
    expect(tolkaGoogleFel(429, "Rate Limit Exceeded", "kalender").text).toContain("gräns");
  });

  // Det viktigaste: rå JSON får aldrig hamna i ansiktet på användaren.
  it("okänt fel behåller Googles mening men aldrig hela JSON-svaret", () => {
    const f = tolkaGoogleFel(500, '{"error":{"code":500,"message":"Backend error","status":"INTERNAL"}}', "kalender");
    expect(f.text).toBe("Google Calendar API svarade 500. Backend error");
    expect(f.text).not.toContain("{");
    expect(f.text).not.toContain('"code"');
  });

  it("svar som inte är JSON kastar inte", () => {
    expect(() => tolkaGoogleFel(502, "<html>Bad Gateway</html>", "gmail")).not.toThrow();
    expect(tolkaGoogleFel(502, "<html>Bad Gateway</html>", "gmail").text).toBe("Gmail API svarade 502.");
  });

  it("inga tankstreck i någon feltext", () => {
    for (const [s, k] of [[403, API_AV], [401, "invalid_grant"], [429, "quota"], [500, "{}"]] as const) {
      expect(tolkaGoogleFel(s as number, String(k), "kalender").text).not.toContain("—");
    }
  });
});
