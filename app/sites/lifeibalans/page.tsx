import type { Metadata } from "next";
import { type Data } from "@puckeditor/core";
import { supabase } from "@/lib/supabase";
import { LibRender } from "@/components/puck-lifeibalans/Render";
import { LibHeader, LibFooter } from "@/components/puck-lifeibalans/chrome";
import { LIB_HOME_DATA } from "@/lib/puck-lifeibalans-default";

const CLIENT_SLUG = "lifeibalans";

const TITLE = "Life i Balans — nervsystem, stress och klimakteriet";
const DESC =
  "Förstå vad som händer i kroppen när stress möter klimakteriet. Utbildning och coaching av Linda Fernquist, leg. sjuksköterska. Gör Nervsystemstestet — gratis.";

// OBS: metadataBase pekar på nuvarande live-host (Cockpit) så OG-bilden resolvar
// NU. Byt till https://lifeibalans.se när DNS pekats om. Detta klipper HM Motors
// root-OG (bild + siteName) för Life i Balans-länkar.
export const metadata: Metadata = {
  metadataBase: new URL("https://cockpit.gripcoaching.se"),
  title: { absolute: TITLE },
  description: DESC,
  alternates: { canonical: "https://lifeibalans.se/" },
  openGraph: {
    type: "website",
    locale: "sv_SE",
    siteName: "Life i Balans",
    url: "https://cockpit.gripcoaching.se/sites/lifeibalans",
    title: TITLE,
    description: DESC,
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC },
};

export async function getLifeibalansClientId(): Promise<string | null> {
  const { data } = await supabase.from("clients").select("id").eq("slug", CLIENT_SLUG).single();
  return data?.id || null;
}

export default async function LifeibalansHome() {
  const clientId = await getLifeibalansClientId();
  let pageData: Data = LIB_HOME_DATA;
  if (clientId) {
    const { data: page } = await supabase
      .from("hm_pages")
      .select("data")
      .eq("client_id", clientId)
      .eq("slug", "index")
      .eq("is_published", true)
      .single();
    if (page?.data) pageData = page.data as Data;
  }
  return (
    <>
      <LibHeader />
      <main>
        <LibRender data={pageData} />
      </main>
      <LibFooter />
    </>
  );
}
