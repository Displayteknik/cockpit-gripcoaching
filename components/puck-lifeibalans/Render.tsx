"use client";

import { Render, type Data } from "@puckeditor/core";
import { puckConfigLifeibalans } from "@/lib/puck-config-lifeibalans";

export function LibRender({ data, basePath }: { data: Data; basePath?: string }) {
  return <Render config={puckConfigLifeibalans} data={data} metadata={{ basePath }} />;
}
