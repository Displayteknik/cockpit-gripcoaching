import { NextResponse } from "next/server";
import { getActiveClient } from "@/lib/client-context";
import { getAdminScope } from "@/lib/api-auth";

export const runtime = "nodejs";

export async function GET() {
  const c = await getActiveClient();
  // scoped = sessionen är låst till en klient (t.ex. HM Motor) → UI döljer klientväxling/agentur-flikar.
  const scoped = !!(await getAdminScope());
  return NextResponse.json(c ? { ...c, scoped } : c);
}
