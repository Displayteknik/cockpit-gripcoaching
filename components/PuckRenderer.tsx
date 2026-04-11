"use client";

import { Render, type Data } from "@puckeditor/core";
import { puckConfig } from "@/lib/puck-config";

interface PuckRendererProps {
  data: Data;
}

export function PuckRenderer({ data }: PuckRendererProps) {
  return <Render config={puckConfig} data={data} />;
}
