// lasJson — ett svar som inte är JSON ska säga VAD som hände.
//
// Skarpt fall 2026-08-09 på live: Studio visade
//   «Unexpected token 'A', "An error o"... is not valid JSON»
// Det är JSON.parse som fått Vercels textfelsida. Meddelandet sa varken vilken statuskod
// svaret hade eller vad användaren skulle göra — och mönstret `await r.json()` fanns på
// 27 ställen i StudioMaker ensam, så vilken route som helst som föll gav samma rad.

import { describe, expect, it } from "vitest";
import { lasJson } from "@/lib/las-json";

const svar = (kropp: string, status = 200) =>
  ({ status, text: async () => kropp }) as unknown as Response;

describe("lasJson", () => {
  it("giltig JSON beter sig precis som förut", async () => {
    await expect(lasJson(svar('{"ok":true,"n":3}'))).resolves.toEqual({ ok: true, n: 3 });
  });

  it("Vercels textfelsida ger statuskoden och en åtgärd, inte parserns text", async () => {
    const p = lasJson(svar("An error occurred with your deployment", 500));
    await expect(p).rejects.toThrow(/HTTP 500/);
    await expect(p).rejects.not.toThrow(/Unexpected token/);
  });

  it("timeout pekar ut att anropet tog för lång tid", async () => {
    await expect(lasJson(svar("The request timed out", 504))).rejects.toThrow(/för lång tid/);
  });

  it("utloggad säger att man ska logga in igen, inte 'oväntat svar'", async () => {
    await expect(lasJson(svar("<html>Unauthorized</html>", 401))).rejects.toThrow(/logga in igen/);
    await expect(lasJson(svar("Forbidden", 403))).rejects.toThrow(/logga in igen/);
  });

  it("för stort innehåll får sin egen förklaring", async () => {
    await expect(lasJson(svar("Payload Too Large", 413))).rejects.toThrow(/för stort/);
  });

  it("kroppen kortas — en HTML-sida ska inte tapetsera felrutan", async () => {
    const lang = "x".repeat(5000);
    try {
      await lasJson(svar(lang, 502));
      throw new Error("skulle ha kastat");
    } catch (e) {
      expect((e as Error).message.length).toBeLessThan(220);
    }
  });

  it("tom kropp ger fortfarande statuskoden", async () => {
    await expect(lasJson(svar("", 500))).rejects.toThrow(/HTTP 500/);
  });
});
