"use client";

export const SWR_CONFIG = {
  dedupingInterval: Number(process.env.NEXT_PUBLIC_SWR_DEDUPING_INTERVAL ?? 300000),
  revalidateOnFocus: (process.env.NEXT_PUBLIC_SWR_REVALIDATE_ON_FOCUS ?? "false") === "true",
  revalidateOnReconnect: (process.env.NEXT_PUBLIC_SWR_REVALIDATE_ON_RECONNECT ?? "false") === "true",
  keepPreviousData: (process.env.NEXT_PUBLIC_SWR_KEEP_PREVIOUS_DATA ?? "true") === "true",
};
