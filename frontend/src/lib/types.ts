export type CreatedRecipe = {
  recipe_id: string;
  name: string;
  name_original?: string;
  meal_types?: string[];
  servings?: number;
  source_url?: string | null;
  thumbnail_url?: string | null;
  notes?: string;
  ingredients?: Ingredient[];
  ingredients_original?: Ingredient[];
  instructions?: string[];
  instructions_original?: string[];
};

export type Ingredient = {
  name: string;
  quantity: number | string;
  unit: string;
};

export type Recipe = CreatedRecipe & {
  family_feedback_score?: number;
  family_feedback?: Record<string, number>;
};

export type DailyRecommendationCandidate = {
  id: string;
  run_id: string;
  source: "local" | "gemini" | "youtube";
  title: string;
  source_url?: string;
  thumbnail_url?: string | null;
  recipe_id?: string;
  is_existing?: boolean;
  meal_types?: string[];
  reason?: string;
  score?: number;
  rank?: number;
  status?: "new" | "accepted" | "discarded";
  assignment_status?: "assigned" | "added";
  autofill_status?: "running" | "success" | "failed" | "skipped";
  autofill_model?: string;
  autofill_cached?: boolean;
  autofill_error?: string;
};

export type DailyRecommendationRun = {
  id: string;
  date: string;
  created_at: string;
  status?: "ok" | "local-only" | "error" | "running";
  stage?: "collect" | "local" | "gemini" | "youtube" | "finalize";
  stage_detail?: {
    youtube_total?: number;
    youtube_done?: number;
    current_idea?: string;
  };
  reason?: string;
  model?: string;
  language?: "en" | "original";
  stats?: {
    existing_count?: number;
  };
  debug?: string[];
  candidates: DailyRecommendationCandidate[];
};

export type DailyRecommendationStore = {
  runs: DailyRecommendationRun[];
};
