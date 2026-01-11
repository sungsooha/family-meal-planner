export function buildGeminiRecipePrompt(input: {
  title: string;
  description: string;
  topComment: string;
  linkedText?: string;
  linkedUrl?: string | null;
}): string {
  const { title, description, topComment, linkedText, linkedUrl } = input;
  return [
    "You are extracting a recipe from a YouTube video.",
    "Use the description or top comment if they contain ingredients/instructions.",
    linkedUrl
      ? `If a linked recipe page is provided, prioritize its ingredients/instructions: ${linkedUrl}`
      : "If a linked recipe page is provided, prioritize its ingredients/instructions.",
    "Ignore sponsorships, promos, and unrelated chatter.",
    "Return ONLY valid JSON with keys:",
    "name, name_original, meal_types, servings, ingredients, ingredients_original, instructions, instructions_original.",
    "- name is English; name_original is Korean.",
    "- Keep name and name_original concise (<= 80 characters). Drop hashtags or extra promo text.",
    "- meal_types is an array (e.g. breakfast, lunch, dinner, snack). Always infer at least one meal type from the recipe and context even if it is not explicitly stated.",
    "- servings is a number if possible.",
    "- ingredients/ingredients_original are arrays of {name, quantity, unit}.",
    "- instructions/instructions_original are arrays of strings.",
    "- Always provide both English and Korean. If translation is unclear, repeat the original text in both fields.",
    "- Quantities should be numeric when possible, else 0.",
    "",
    `Title:\n${title}`,
    "",
    `Top comment:\n${topComment}`,
    "",
    `Description:\n${description}`,
    linkedText ? "" : "",
    linkedText ? `Linked page text:\n${linkedText}` : "",
  ].join("\n");
}
