import "../studio-fonts.css";
import { notFound } from "next/navigation";
import { getTemplate } from "@/components/studio/registry";
import { normalizePayload, decodePayload, type StudioPayload } from "@/lib/studio/payload";
import { loadBrand } from "@/lib/studio/brand";

// Ren render-yta (ingen Cockpit-chrome — undantagen i app/layout.tsx isHmMotorSurface).
// Används av live-preview (iframe) OCH av Playwright-export. Payload via ?p=<base64-JSON>.
export const dynamic = "force-dynamic";

export default async function StudioRenderPage({
  params,
  searchParams,
}: {
  params: Promise<{ templateId: string }>;
  searchParams: Promise<{ p?: string }>;
}) {
  const { templateId } = await params;
  const sp = await searchParams;

  const def = getTemplate(templateId);
  if (!def) notFound();

  let payload: StudioPayload;
  if (sp.p) {
    try {
      payload = decodePayload(sp.p);
    } catch {
      payload = normalizePayload({ templateId });
    }
  } else {
    payload = normalizePayload({ templateId });
  }
  payload.templateId = templateId; // URL:en vinner över payload

  const brand = await loadBrand(payload.clientId);
  const Template = def.component;

  return (
    <div id="studio-render-root">
      <Template payload={payload} brand={brand} />
    </div>
  );
}
