import { NextResponse } from "next/server";
import { loadSpecialists } from "@/lib/specialists";

export const runtime = "nodejs";

export async function GET() {
  const list = await loadSpecialists();
  const filtered = list.filter((s) => s.target_app === "cockpit" || s.target_app === "both");
  return NextResponse.json(
    filtered.map((s) => ({
      id: s.id,
      name: s.name,
      category: s.category,
      target_app: s.target_app,
      version: s.version,
      inputs: s.inputs,
    }))
  );
}
