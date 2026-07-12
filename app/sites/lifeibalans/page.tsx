import type { Metadata } from "next";
import { type Data } from "@puckeditor/core";
import { supabase } from "@/lib/supabase";
import { LibRender } from "@/components/puck-lifeibalans/Render";
import { LibHeader, LibFooter } from "@/components/puck-lifeibalans/chrome";
import { LIB_HOME_DATA } from "@/lib/puck-lifeibalans-default";

const CLIENT_SLUG = "lifeibalans";

export const metadata: Metadata = {
  title: { absolute: "Life i Balans — nervsystem, stress och klimakteriet" },
  description:
    "Förstå vad som händer i kroppen när stress möter klimakteriet. Utbildning och coaching av Linda Fernquist, leg. sjuksköterska. Gör Nervsystemstestet — gratis.",
  alternates: { canonical: "https://lifeibalans.se/" },
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
