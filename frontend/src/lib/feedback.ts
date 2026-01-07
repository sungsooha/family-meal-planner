export type FamilyFeedback = Record<string, number>;

function coerceFeedbackValue(value: unknown): number {
  if (typeof value === "number") {
    if (value > 0) return 1;
    if (value < 0) return -1;
    return 0;
  }
  if (typeof value === "string") {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed || trimmed === "neutral") return 0;
    if (trimmed === "up" || trimmed === "thumbs_up" || trimmed === "like") return 1;
    if (trimmed === "down" || trimmed === "thumbs_down" || trimmed === "dislike") return -1;
    const numeric = Number(trimmed);
    if (!Number.isNaN(numeric)) return coerceFeedbackValue(numeric);
    return 0;
  }
  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if ("value" in record) return coerceFeedbackValue(record.value);
    if ("rating" in record) return coerceFeedbackValue(record.rating);
  }
  return 0;
}

export function normalizeFeedback(feedback?: Record<string, unknown> | null): FamilyFeedback | undefined {
  if (!feedback) return undefined;
  const normalized: FamilyFeedback = {};
  Object.entries(feedback).forEach(([key, value]) => {
    normalized[key] = coerceFeedbackValue(value);
  });
  return normalized;
}

export function getFeedbackSummary(feedback?: FamilyFeedback) {
  const normalized = normalizeFeedback(feedback) ?? {};
  const values = Object.values(normalized);
  const summary = {
    up: 0,
    down: 0,
    neutral: 0,
    total: values.length,
  };
  values.forEach((value) => {
    if (value > 0) summary.up += 1;
    else if (value < 0) summary.down += 1;
    else summary.neutral += 1;
  });
  return summary;
}
