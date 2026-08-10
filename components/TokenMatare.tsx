"use client";

import Link from "next/link";
import { Sparkles, Plus, AlertTriangle } from "lucide-react";

// BETAL-1 (B-1) — MySALES TOKENS.
//
// Kundvänt namn är "tokens" överallt i gränssnittet. Internt heter det fortfarande
// credits (tabeller, prislista, kod) — ingen riskabel omdöpning i datalagret.
//
// Två skepnader, samma siffror och samma varningsnivåer:
//   · kompakt — sitter i sidomenyn så saldot alltid syns
//   · kort    — i kundens översikt, med förklaring och påfyllningsknapp
//
// Varningsnivåer: 80 procent = gul, 95 procent = tydlig, 100 procent = slut.

export interface Tokenlage {
  anvant: number;
  tak: number;
}

const nf = new Intl.NumberFormat("sv-SE");

export type Niva = "ok" | "varning" | "kritisk" | "slut";

export function niva({ anvant, tak }: Tokenlage): Niva {
  if (tak <= 0) return "ok";
  const procent = (anvant / tak) * 100;
  if (procent >= 100) return "slut";
  if (procent >= 95) return "kritisk";
  if (procent >= 80) return "varning";
  return "ok";
}

const FARG: Record<Niva, string> = {
  ok: "",              // klientens egen färg används
  varning: "#d97706",
  kritisk: "#ea580c",
  slut: "#dc2626",
};

function farg(n: Niva, primary: string): string {
  return FARG[n] || primary;
}

/** Nästa månadsskifte i klartext, så "förnyas den 1:a" blir ett riktigt datum. */
export function nastaFornyelse(): string {
  const nu = new Date();
  return new Date(nu.getFullYear(), nu.getMonth() + 1, 1).toLocaleDateString("sv-SE", { day: "numeric", month: "long" });
}

// ── Kompakt: sidomenyn ──────────────────────────────────────────────────────

export function TokenMatareKompakt({ tokens, primaryColor }: { tokens: Tokenlage; primaryColor: string }) {
  const n = niva(tokens);
  const f = farg(n, primaryColor);
  const kvar = Math.max(0, tokens.tak - tokens.anvant);
  const procent = tokens.tak > 0 ? Math.min(100, (tokens.anvant / tokens.tak) * 100) : 0;

  return (
    <Link
      href="/k/credits"
      className="block rounded-xl border border-gray-100 bg-gray-50/70 px-3 py-2.5 hover:bg-gray-50 transition-colors"
      title="Se hur dina tokens används"
    >
      <div className="flex items-center gap-2">
        <span
          className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: `${f}1a` }}
        >
          <Sparkles className="w-3.5 h-3.5" style={{ color: f }} />
        </span>
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Tokens</span>
        <span className="ml-auto text-xs font-bold tabular-nums" style={{ color: f }}>
          {nf.format(kvar)}
        </span>
      </div>
      <div className="mt-2 h-1.5 w-full rounded-full bg-gray-200/70 overflow-hidden">
        <div className="h-1.5 rounded-full transition-all" style={{ width: `${Math.max(3, procent)}%`, background: f }} />
      </div>
      <p className="mt-1.5 text-xs text-gray-500 tabular-nums">
        {nf.format(tokens.anvant)} av {nf.format(tokens.tak)} använda
      </p>
    </Link>
  );
}

// ── Kort: kundens översikt ──────────────────────────────────────────────────

export function TokenKort({
  tokens,
  primaryColor,
  onFyllPa,
  laddar,
  kompaktRubrik,
}: {
  tokens: Tokenlage;
  primaryColor: string;
  onFyllPa?: () => void;
  laddar?: boolean;
  kompaktRubrik?: boolean;
}) {
  const n = niva(tokens);
  const f = farg(n, primaryColor);
  const kvar = Math.max(0, tokens.tak - tokens.anvant);
  const procent = tokens.tak > 0 ? Math.min(100, (tokens.anvant / tokens.tak) * 100) : 0;

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <span
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${f}1a` }}
          >
            <Sparkles className="w-[18px] h-[18px]" style={{ color: f }} />
          </span>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Tokens</div>
            {!kompaktRubrik && (
              <div className="text-sm text-gray-600">Förnyas {nastaFornyelse()}</div>
            )}
          </div>
        </div>

        {onFyllPa && (
          <button
            onClick={onFyllPa}
            disabled={laddar}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors"
          >
            <Plus className="w-4 h-4" /> Fyll på tokens
          </button>
        )}
      </div>

      <div className="mt-5 flex items-end gap-3">
        <div className="font-display text-4xl font-bold tabular-nums" style={{ color: f }}>
          {nf.format(kvar)}
        </div>
        <div className="pb-1 text-sm text-gray-600">kvar</div>
      </div>

      <div className="mt-3 h-2.5 w-full rounded-full bg-gray-100 overflow-hidden">
        <div className="h-2.5 rounded-full transition-all" style={{ width: `${Math.max(2, procent)}%`, background: f }} />
      </div>

      <p className="mt-2.5 text-sm text-gray-700 tabular-nums">
        <strong>{nf.format(tokens.anvant)}</strong> av <strong>{nf.format(tokens.tak)}</strong> använda
      </p>

      <p className="mt-3 text-xs text-gray-500 leading-relaxed">
        Tokens används när du skapar bilder och video. Texter är alltid obegränsade.
      </p>

      <TokenVarning niva={n} kvar={kvar} />
    </section>
  );
}

// ── Varningarna ─────────────────────────────────────────────────────────────

export function TokenVarning({ niva: n, kvar }: { niva: Niva; kvar: number }) {
  if (n === "ok") return null;

  if (n === "slut") {
    return (
      <div className="mt-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
        <div className="text-sm">
          <p className="font-semibold text-red-800">Månadens tokens är slut</p>
          <p className="mt-0.5 text-red-700">
            Du kan fortsätta skriva texter som vanligt, de drar ingenting. Nya bilder går att skapa igen{" "}
            {nastaFornyelse()}, eller så fyller du på nu.
          </p>
        </div>
      </div>
    );
  }

  if (n === "kritisk") {
    return (
      <div className="mt-4 flex items-start gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-orange-600" />
        <div className="text-sm">
          <p className="font-semibold text-orange-900">Det är nästan slut</p>
          <p className="mt-0.5 text-orange-800">
            Bara {nf.format(kvar)} tokens kvar. Fyll på nu så slipper du avbrott mitt i arbetet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      Du har använt fyra femtedelar av månadens tokens. {nf.format(kvar)} kvar till {nastaFornyelse()}.
    </div>
  );
}
