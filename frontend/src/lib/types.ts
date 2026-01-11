export type RecipeBase = {
  recipe_id: string;
  name: string;
  name_original?: string | null;
  meal_types?: string[];
  meal_type?: string;
  servings?: number;
  source_url?: string | null;
  thumbnail_url?: string | null;
  notes?: string | null;
  ingredients?: Ingredient[];
  ingredients_original?: Ingredient[];
  instructions?: string[];
  instructions_original?: string[];
};

export type RecipeCreateRequest = RecipeBase;

export type Ingredient = {
  name: string;
  quantity: number | string;
  unit: string;
};

export type Recipe = RecipeBase & {
  family_feedback_score?: number;
  family_feedback?: Record<string, number>;
};

export type RecipeUpdateRequest = Recipe;

export type Meal = {
  recipe_id?: string;
  name?: string;
  ingredients?: Ingredient[];
  source_url?: string | null;
  meal_types?: string[];
  completed?: boolean;
  locked?: boolean;
} | null;

export type WeeklyPlan = {
  start_date: string;
  days: Array<{ date: string; meals: Record<string, Meal> }>;
};

export type DailyPlan = {
  date: string;
  meals: Record<string, Meal>;
};

export type ShoppingStateItem = {
  name: string;
  unit: string;
  quantity: string | number;
  manual?: boolean;
  lang?: string;
};

export type ShoppingItem = {
  name: string;
  unit: string;
  quantity: number | string;
  recipes_count: number;
  recipe_ids: string[];
  key: string;
};

export type ShoppingItemWithDefaults = ShoppingItem & {
  default_quantity: number | string;
  default_unit: string;
};

export type ShoppingPayload = {
  weekly_list: ShoppingItem[];
  shopping_items: ShoppingItemWithDefaults[];
  lang: string;
};

export type LocalRecipeResult = {
  recipe_id: string;
  name: string;
  name_original?: string | null;
  source_url?: string | null;
  thumbnail_url?: string | null;
};

export type RecipeSearchCandidate = {
  title: string;
  source_url: string;
  thumbnail_url?: string | null;
  servings?: number | string | null;
  ingredients?: string[];
  instructions?: string[];
  source_host?: string;
};

export type RecipeSearchRequest = {
  query: string;
  limit?: number;
  source?: "all" | "youtube" | "mcp";
  include_shorts?: boolean;
};

export type RecipeSearchResponse = {
  candidates: RecipeSearchCandidate[];
  notice?: string | null;
  hint?: string | null;
  error?: string;
};

export type LocalSearchResponse = LocalRecipeResult[];

export type WebSearchResult = {
  title: string;
  url: string;
  snippet?: string;
};

export type PlanActionPayload = {
  date?: string;
  meal?: string;
  start_date?: string;
  recipe_id?: string;
  locked?: boolean;
};

export type RecipeSource = {
  recipe_id: string;
  source: string;
  source_url?: string;
  thumbnail_url?: string;
  title?: string;
  top_comment?: string;
  description?: string;
};

export type RecipePrefill = {
  name?: string;
  name_original?: string;
  meal_types?: string[];
  servings?: number | string | null;
  source_url?: string | null;
  thumbnail_url?: string | null;
  ingredients_text?: string;
  ingredients_original_text?: string;
  instructions_text?: string;
  instructions_original_text?: string;
};

export type RecipePrefillResponse = {
  prefill: RecipePrefill;
  cached: boolean;
  model?: string;
  error?: string;
};

export type RecipePrefillRequest = {
  source_url: string;
  thumbnail_url?: string | null;
  force?: boolean;
  model?: string;
};

export type PrefillCandidate = {
  title: string;
  source_url: string;
  servings?: number | string | null;
  ingredients?: string[];
  instructions?: string[];
  thumbnail_url?: string | null;
};

export type ConfigResponse = {
  config: AppConfig;
};

export type ConfigUpdateRequest = {
  config: AppConfig;
};

export type ShoppingActionRequest = {
  action: "add" | "remove" | "update" | "add-manual";
  lang?: string;
  key?: string;
  name?: string;
  unit?: string;
  quantity?: string | number;
};

export type RecipeSummary = {
  recipe_id: string;
  name: string;
  name_original?: string | null;
  meal_types?: string[];
  meal_type?: string | null;
  servings?: number | string | null;
  source_url?: string | null;
  thumbnail_url?: string | null;
  notes?: string | null;
  family_feedback_score?: number | null;
  family_feedback?: Record<string, number> | null;
};

export type RecipeSummaryResponse = RecipeSummary[];

export type RecipesCreateResponse = {
  ok: boolean;
  error?: string;
};

export type RecipeDetailResponse = Recipe & {
  source_title?: string | null;
};

export type RecipeFeedbackRequest = {
  family_feedback: Record<string, number>;
};

export type RecipeFeedbackResponse = {
  recipe?: Recipe;
  error?: string;
};

export type BuyListsResponse = {
  lists: BuyList[];
};

export type PlanDatesResponse = {
  dates: string[];
};

export type DailyRecommendationsResponse = {
  runs: DailyRecommendationRun[];
};

export type DailyRecommendationsRunRequest = {
  date?: string;
  force?: boolean;
  language?: "en" | "original";
  run_id?: string;
};

export type DailyRecommendationsRunResponse = {
  run?: DailyRecommendationRun;
  reused?: boolean;
  error?: string;
};

export type DailyRecommendationAcceptRequest = {
  candidate_id: string;
  target_date?: string;
  meal?: string;
  assign?: boolean;
  start_date?: string;
};

export type DailyRecommendationDiscardRequest = {
  candidate_id: string;
};

export type DailyRecommendationAcceptResponse = {
  ok: boolean;
  recipe_id?: string;
  plan?: WeeklyPlan;
  run?: DailyRecommendationRun;
  autofill?: {
    attempted: boolean;
    ok: boolean;
    model?: string;
    cached?: boolean;
    error?: string;
  };
  error?: string;
};

export type DailyRecommendationDiscardResponse = {
  ok: boolean;
  run?: DailyRecommendationRun;
  error?: string;
};

export type DailyRecommendationDeleteResponse = {
  ok: boolean;
  runs?: DailyRecommendationRun[];
  error?: string;
};

export type AuthRequestLinkRequest = {
  email: string;
  redirectTo?: string;
};

export type AuthRequestLinkResponse = {
  ok?: boolean;
  error?: string;
};

export type AuthSignUpRequest = {
  email: string;
  password: string;
};

export type AuthSignUpResponse = {
  user_id?: string | null;
  error?: string;
};

export type BuyListResponse = {
  list?: BuyList;
  error?: string;
};

export type BuyListUpdateRequest = BuyList;

export type BuyListUpdateResponse = {
  ok: boolean;
  error?: string;
};

export type BuyListItem = {
  name: string;
  unit: string;
  quantity: string | number;
  key?: string;
};

export type BuyList = {
  id: string;
  week_start: string;
  week_end: string;
  saved_at: string;
  status: "open" | "locked";
  lang: string;
  items: BuyListItem[];
};

export type FamilyMember = {
  id: string;
  label: string;
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

export type AppConfig = {
  allow_repeats_if_needed?: boolean;
  family_size?: number;
  max_repeat_per_week?: number;
  family_members?: FamilyMember[];
  daily_reco_enabled?: boolean;
  daily_reco_max_chips?: number;
  daily_reco_expire_days?: number;
  daily_reco_candidates?: number;
  daily_reco_new_ratio?: number;
  daily_recommendations?: DailyRecommendationStore;
};
