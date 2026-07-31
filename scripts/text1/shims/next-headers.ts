// TEXT-1 FÖRE-BATCH — shim för "next/headers" när lib-koden körs utanför Next-runtime.
// Produktionen rörs INTE: mappningen sker enbart via scripts/text1/tsconfig.json (tsx --tsconfig).
// Kakorna sätts av batch-skriptet (admin_session signerad med riktiga ADMIN_SESSION_SECRET
// + active_client_id per profil) så resolveClientId/getActiveClientId resolverar rätt tenant
// exakt som i en inloggad admin-session.

const store = new Map<string, string>();

export function __setBatchCookie(name: string, value: string): void {
  store.set(name, value);
}

export function __clearBatchCookies(): void {
  store.clear();
}

export async function cookies() {
  return {
    get(name: string) {
      const value = store.get(name);
      return value === undefined ? undefined : { name, value };
    },
    getAll() {
      return Array.from(store.entries()).map(([name, value]) => ({ name, value }));
    },
    has(name: string) {
      return store.has(name);
    },
    set(name: string, value: string) {
      store.set(name, value);
    },
    delete(name: string) {
      store.delete(name);
    },
  };
}

export async function headers() {
  return {
    get(_name: string): string | null {
      return null; // ingen referer → admin-vägen används (aldrig kundportal-vägen)
    },
    has() {
      return false;
    },
    entries() {
      return [][Symbol.iterator]();
    },
  };
}

export async function draftMode() {
  return { isEnabled: false, enable() {}, disable() {} };
}
