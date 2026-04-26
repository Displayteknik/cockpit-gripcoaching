// Microsoft Clarity — gratis heatmaps + session replays.
// Läser clarity_id från klientens settings och injekterar script-tag.

import { supabaseServer } from "@/lib/supabase-admin";
import { getActiveClientId } from "@/lib/client-context";

export default async function ClarityScript() {
  const clientId = await getActiveClientId();
  const sb = supabaseServer();
  const { data } = await sb.from("hm_settings").select("value").eq("client_id", clientId).eq("key", "clarity_id").maybeSingle();
  const id = data?.value;
  if (!id) return null;
  const code = `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${id}");`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
