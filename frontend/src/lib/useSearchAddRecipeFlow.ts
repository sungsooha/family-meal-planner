"use client";

import { useCallback, useState } from "react";
import { useRecipePrefill, PrefillCandidate } from "@/lib/useRecipePrefill";

export function useSearchAddRecipeFlow(openManual: () => void) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [manualFromSearch, setManualFromSearch] = useState(false);
  const prefill = useRecipePrefill();

  const openSearch = useCallback(() => setSearchOpen(true), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);

  const handleCandidate = useCallback(
    (candidate: PrefillCandidate) => {
      setSearchOpen(false);
      setManualFromSearch(true);
      openManual();
      prefill.startFromCandidate(candidate);
    },
    [openManual, prefill],
  );

  const reset = useCallback(() => {
    setManualFromSearch(false);
    prefill.reset();
  }, [prefill]);

  return {
    searchOpen,
    openSearch,
    closeSearch,
    manualFromSearch,
    handleCandidate,
    reset,
    prefill,
  };
}
