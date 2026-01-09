export type CreatedRecipe = {
  recipe_id: string;
  name: string;
  name_original?: string;
  meal_types?: string[];
  servings?: number;
  source_url?: string | null;
  thumbnail_url?: string | null;
  notes?: string;
  ingredients?: Array<{ name: string; quantity: number | string; unit: string }>;
  ingredients_original?: Array<{ name: string; quantity: number | string; unit: string }>;
  instructions?: string[];
  instructions_original?: string[];
};

export type Recipe = CreatedRecipe & {
  family_feedback_score?: number;
  family_feedback?: Record<string, number>;
};
