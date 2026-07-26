import { NextResponse } from "next/server";
import { requireAdmin, getAdminScope } from "@/lib/api-auth";
import { smsConfigured, smsDryrunDefault, smsSender, smsTestPhone, smsCostPerPart } from "@/lib/sms/elks";

export const runtime = "nodejs";

// GET — status för SMS-verktyget. Endast huvudadmin (oscopad ägar-session).
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  if ((await getAdminScope()) !== null) {
    return NextResponse.json({ error: "Endast huvudadmin har åtkomst" }, { status: 403 });
  }

  return NextResponse.json({
    configured: smsConfigured(),   // 46elks-nycklar satta?
    dryrun: smsDryrunDefault(),    // true = validerar men skickar inget
    sender: smsSender(),           // default-avsändare (sanerad)
    testPhone: smsTestPhone(),     // ditt eget testnummer
    costPerPart: smsCostPerPart(), // öre-pris för uppskattning
  });
}
