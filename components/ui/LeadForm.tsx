"use client";

import { useState, type FormEvent } from "react";

interface LeadFormProps {
  source: string;
  interest?: string;
  vehicleSlug?: string;
  vehicleTitle?: string;
  heading?: string;
  className?: string;
}

const inputCls =
  "w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none transition-all text-sm";

export function LeadForm({
  source,
  interest,
  vehicleSlug,
  vehicleTitle,
  heading = "Skicka ett meddelande",
  className = "",
}: LeadFormProps) {
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "sending") return;
    const form = e.currentTarget;
    const fd = new FormData(form);
    if (fd.get("company")) {
      setStatus("done"); // honeypot — tyst för bottar
      return;
    }
    setStatus("sending");
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fd.get("name"),
          email: fd.get("email"),
          phone: fd.get("phone"),
          interest: fd.get("interest") || interest || "",
          message: fd.get("message"),
          vehicle_slug: vehicleSlug || "",
          vehicle_title: vehicleTitle || "",
          source,
          company: fd.get("company") || "",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Något gick fel");
      form.reset();
      setStatus("done");
    } catch (err) {
      setErrorMsg((err as Error).message);
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className={`bg-surface-light rounded-2xl p-8 text-center ${className}`}>
        <h3 className="font-display text-xl font-bold text-text-primary mb-2">
          Tack — vi hör av oss!
        </h3>
        <p className="text-sm text-text-muted">
          Din förfrågan har skickats till HM Motor. Vi återkommer så snart vi kan, oftast samma dag.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={`bg-surface-light rounded-2xl p-8 ${className}`}>
      <h3 className="font-display text-xl font-bold text-text-primary mb-6">{heading}</h3>
      {vehicleTitle && (
        <p className="text-sm text-text-muted mb-4">
          Gäller: <span className="font-semibold text-text-primary">{vehicleTitle}</span>
        </p>
      )}
      <div className="space-y-4">
        {/* Honeypot — dolt för människor, fångar bottar */}
        <input
          type="text"
          name="company"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="hidden"
        />
        <div>
          <label htmlFor="lf-name" className="block text-sm font-medium text-text-primary mb-1">
            Namn
          </label>
          <input type="text" id="lf-name" name="name" required className={inputCls} />
        </div>
        <div>
          <label htmlFor="lf-email" className="block text-sm font-medium text-text-primary mb-1">
            E-post
          </label>
          <input type="email" id="lf-email" name="email" className={inputCls} />
        </div>
        <div>
          <label htmlFor="lf-phone" className="block text-sm font-medium text-text-primary mb-1">
            Telefon
          </label>
          <input type="tel" id="lf-phone" name="phone" className={inputCls} />
        </div>
        {!vehicleTitle && (
          <div>
            <label htmlFor="lf-interest" className="block text-sm font-medium text-text-primary mb-1">
              Intresse
            </label>
            <select id="lf-interest" name="interest" defaultValue={interest || ""} className={inputCls}>
              <option value="">Välj...</option>
              <option value="bil">Begagnad bil</option>
              <option value="atv">Fyrhjuling / UTV</option>
              <option value="moped">Moped / Elmoped</option>
              <option value="slapvagn">Släpvagn</option>
              <option value="tradgard">Trädgårdsmaskin</option>
              <option value="service">Service / Reparation</option>
              <option value="annat">Annat</option>
            </select>
          </div>
        )}
        <div>
          <label htmlFor="lf-message" className="block text-sm font-medium text-text-primary mb-1">
            Meddelande
          </label>
          <textarea
            id="lf-message"
            name="message"
            rows={4}
            required
            defaultValue={vehicleTitle ? `Hej! Jag är intresserad av ${vehicleTitle}. ` : ""}
            className={`${inputCls} resize-none`}
          />
        </div>
        <p className="text-xs text-text-muted">
          Ange minst e-post eller telefon så vi kan svara dig.
        </p>
        {status === "error" && (
          <p className="text-sm text-red-600">
            {errorMsg || "Något gick fel — försök igen eller ring oss."}
          </p>
        )}
        <button
          type="submit"
          disabled={status === "sending"}
          className="w-full bg-brand-blue hover:bg-brand-blue-dark text-white py-3.5 rounded-lg font-semibold transition-colors disabled:opacity-60"
        >
          {status === "sending"
            ? "Skickar…"
            : vehicleTitle
            ? "Skicka intresseanmälan"
            : "Skicka meddelande"}
        </button>
      </div>
    </form>
  );
}
