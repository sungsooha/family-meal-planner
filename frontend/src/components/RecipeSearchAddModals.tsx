"use client";

import ManualRecipeModal from "@/components/ManualRecipeModal";
import RecipeSearchModal from "@/components/RecipeSearchModal";
import { PrefillCandidate, useSearchAddRecipeFlow } from "@/lib/useSearchAddRecipeFlow";

type Props = {
  manualOpen: boolean;
  onManualClose: () => void;
  onManualCreated: (recipe: { recipe_id: string }) => void | Promise<void>;
  searchFlow: ReturnType<typeof useSearchAddRecipeFlow>;
  defaultBackLabel?: string;
  onDefaultBack?: () => void;
  searchInitialQuery?: string;
};

export default function RecipeSearchAddModals({
  manualOpen,
  onManualClose,
  onManualCreated,
  searchFlow,
  defaultBackLabel,
  onDefaultBack,
  searchInitialQuery = "",
}: Props) {
  const handleSearchCandidate = (candidate: PrefillCandidate) => {
    searchFlow.handleCandidate(candidate);
  };

  const backLabel = searchFlow.manualFromSearch ? "Back to search results" : defaultBackLabel;
  const onBack = searchFlow.manualFromSearch
    ? () => {
        onManualClose();
        searchFlow.openSearch();
      }
    : onDefaultBack;

  return (
    <>
      {manualOpen && (
        <ManualRecipeModal
          open={manualOpen}
          onClose={() => {
            onManualClose();
            searchFlow.reset();
          }}
          onCreated={onManualCreated}
          prefill={searchFlow.prefill.prefill}
          backLabel={backLabel}
          onBack={onBack}
          loading={searchFlow.prefill.loading}
          loadingLabel="Auto-filling from YouTube with"
          loadingModel={searchFlow.prefill.loadingModel ?? undefined}
          errorMessage={searchFlow.prefill.error}
          noticeMessage={searchFlow.prefill.notice}
          onRetryPrefill={searchFlow.prefill.sourceUrl ? searchFlow.prefill.retryPrefill : undefined}
          retryLabel="Retry auto-fill"
        />
      )}
      {searchFlow.searchOpen && (
        <RecipeSearchModal
          open={searchFlow.searchOpen}
          onClose={searchFlow.closeSearch}
          onUseCandidate={handleSearchCandidate}
          initialQuery={searchInitialQuery}
        />
      )}
    </>
  );
}
