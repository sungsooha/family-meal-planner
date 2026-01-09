import type { Ingredient } from "@/lib/types";

export const parseMealTypes = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export const parseIngredients = (value: string): Ingredient[] => {
  if (!value.trim()) return [];
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, qty, unit] = line.split(",").map((part) => part.trim());
      const quantity = Number.isNaN(Number(qty)) ? qty ?? "" : Number(qty);
      return { name: name ?? "", quantity, unit: unit ?? "" };
    });
};

export const parseInstructions = (value: string): string[] => {
  if (!value.trim()) return [];
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
};

export const formatIngredients = (items?: Ingredient[]) =>
  (items ?? [])
    .map((item) => `${item.name},${item.quantity ?? ""},${item.unit ?? ""}`.trim())
    .join("\n");

export const formatInstructions = (items?: string[]) => (items ?? []).join("\n");
