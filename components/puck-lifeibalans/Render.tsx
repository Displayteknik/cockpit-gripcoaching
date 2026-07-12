"use client";

import { Render, type Data } from "@puckeditor/core";
import { puckConfigLifeibalans } from "@/lib/puck-config-lifeibalans";

export function LibRender({ data }: { data: Data }) {
  return <Render config={puckConfigLifeibalans} data={data} />;
}
