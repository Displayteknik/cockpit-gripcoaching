export default function LoggedOut() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="bg-white border border-gray-200 rounded-xl p-8 max-w-md text-center shadow-sm">
        <div className="text-emerald-500 text-4xl mb-3">✓</div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Du är utloggad</h1>
        <p className="text-sm text-gray-600">
          Använd din personliga länk för att logga in igen. Kontakta din konsult om du tappat den.
        </p>
      </div>
    </main>
  );
}
