import { calculateDeduction, ingredientNamesMatch, parseQuantity, type UnitConversionRule } from "../unit-conversion";

// ===== Helpers for cook deduction =====
export function normalizeRecipeIngredients(ingredients: any[]): any[] {
  return ingredients.map((ingredient: any) => {
    const sourceAmount = ingredient.amount !== undefined ? ingredient.amount : ingredient.quantity;
    const parsed = parseQuantity(sourceAmount, ingredient.unit || "");
    if (parsed.value !== null && !parsed.ambiguous) {
      return { ...ingredient, quantity: parsed.value, unit: parsed.unit };
    }
    const normalized = { ...ingredient };
    delete normalized.quantity;
    return normalized;
  });
}

export function buildCookPlan(ingredients: any[], inventory: any[], conversions: UnitConversionRule[]) {
  const items = ingredients.filter((ing: any) => !ing.optional).map((ing: any) => {
    const candidates = inventory.filter((item: any) => ingredientNamesMatch(ing.name, item.name));
    const recipeAmount = ing.quantity ?? ing.amount ?? "";
    const recipeUnit = ing.unit || "";
    if (!candidates.length) {
      return {
        name: ing.name,
        recipeAmount: ing.amount || `${recipeAmount}${recipeUnit}`,
        status: "missing-inventory",
        inventoryId: null,
      };
    }

    const pantryMatch = candidates.find(isPantryInventory);
    if (pantryMatch) {
      return {
        name: ing.name,
        recipeAmount: ing.amount || `${recipeAmount}${recipeUnit}`,
        status: "pantry",
        skipDeduction: true,
        inventoryId: pantryMatch.id,
        inventoryAmount: pantryMatch.amount,
        inventoryUnit: pantryMatch.unit || "",
        inventoryUpdatedAt: pantryMatch.updated_at,
        inventoryVersion: Number(pantryMatch.version || 1),
        remaining: String(pantryMatch.amount ?? ""),
      };
    }

    const evaluated = candidates.map((inv: any) => ({
      inv,
      result: calculateDeduction({
        ingredientName: ing.name,
        recipeAmount,
        recipeUnit,
        inventoryAmount: inv.amount,
        inventoryUnit: inv.unit,
        rules: conversions,
      }),
    }));
    const priority: Record<string, number> = {
      ready: 0,
      "needs-conversion": 1,
      "ambiguous-recipe": 2,
      "unparsed-recipe": 3,
      "unparsed-inventory": 4,
    };
    evaluated.sort((a, b) => (priority[a.result.status] ?? 9) - (priority[b.result.status] ?? 9));
    const selected = evaluated[0];
    return {
      name: ing.name,
      recipeAmount: ing.amount || `${recipeAmount}${recipeUnit}`,
      inventoryId: selected.inv.id,
      inventoryAmount: selected.inv.amount,
      inventoryUnit: selected.inv.unit || "",
      inventoryUpdatedAt: selected.inv.updated_at,
      inventoryVersion: Number(selected.inv.version || 1),
      ...selected.result,
    };
  });
  return {
    items,
    requiresConfirmation: items.some((item: any) =>
      item.status === "needs-conversion" || item.status === "ambiguous-recipe" || item.status === "unparsed-inventory"),
  };
}

export function isPantryInventory(item: any): boolean {
  if (!item) return false;
  const category = String(item.category || "").trim();
  return category === "调料" || category === "调味料" || category === "调味品";
}

export function parseAmount(s: string): number | null {
  if (!s) return null;
  const m = s.trim().match(/^(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
}

export function findInventoryMatch(name: string, inventory: any[]): any | null {
  return inventory.find((i: any) => ingredientNamesMatch(name, i.name)) || null;
}

