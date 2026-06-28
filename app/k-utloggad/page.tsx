import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Utloggad · MySales Pro" },
  robots: { index: false, follow: false },
};

export default function LoggedOut() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="bg-white border border-gray-200 rounded-xl p-8 max-w-md text-center shadow-sm">
        <div className="text-emerald-500 text-4xl mb-3">✓</div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Du är utloggad</h1>
        <p className="text-sm text-gray-600 mb-5">
          Logga in igen med ditt användarnamn och lösenord. Har du en personlig länk fungerar den också — kontakta din konsult om du tappat den.
        </p>
        <a
          href="/logga-in"
          className="inline-flex items-center justify-center w-full bg-gray-900 text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors"
        >
          Logga in
        </a>
      </div>
    </main>
  );
}
