"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LayoutDashboard, Loader2, Lock } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const from = params.get("from") || "/dashboard";
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const r = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!r.ok) {
      const msg = await r.json().catch(() => ({}));
      setError(msg.error || "Inloggning misslyckades");
      setLoading(false);
      return;
    }
    // Hård navigering så proxy ser den nya cookien direkt
    window.location.href = from.startsWith("/") ? from : "/dashboard";
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
            <LayoutDashboard className="w-5 h-5 text-white" />
          </div>
          <div className="leading-tight">
            <div className="font-display font-bold text-base text-gray-900">Cockpit</div>
            <div className="text-[11px] text-gray-500">GripCoaching</div>
          </div>
        </div>

        <form onSubmit={submit} className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
          <h1 className="text-lg font-display font-bold text-gray-900 mb-1 flex items-center gap-2">
            <Lock className="w-4 h-4 text-gray-400" /> Logga in
          </h1>
          <p className="text-sm text-gray-500 mb-4">Adminytan är skyddad. Ange lösenordet för att fortsätta.</p>

          <label className="text-sm font-medium text-gray-700 mb-1 block">Lösenord</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            autoComplete="current-password"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
          />

          {error && <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full mt-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white py-2.5 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            Logga in
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
