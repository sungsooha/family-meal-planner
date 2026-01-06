"use client";

import type { ReactNode } from "react";
import { SWRConfig } from "swr";
import { SWR_CONFIG } from "@/lib/cacheConfig";

type SWRProviderProps = {
  children: ReactNode;
};

export default function SWRProvider({ children }: SWRProviderProps) {
  return (
    <SWRConfig
      value={{
        fetcher: (resource: string) => fetch(resource).then((res) => res.json()),
        ...SWR_CONFIG,
      }}
    >
      {children}
    </SWRConfig>
  );
}
