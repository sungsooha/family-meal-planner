"use client";

import type { ReactNode } from "react";
import { SWRConfig } from "swr";

type SWRProviderProps = {
  children: ReactNode;
};

export default function SWRProvider({ children }: SWRProviderProps) {
  return (
    <SWRConfig
      value={{
        fetcher: (resource: string) => fetch(resource).then((res) => res.json()),
        dedupingInterval: 300000,
        revalidateOnFocus: true,
        revalidateOnReconnect: false,
        keepPreviousData: true,
      }}
    >
      {children}
    </SWRConfig>
  );
}
