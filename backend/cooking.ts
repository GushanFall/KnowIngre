import { calculateDeduction, ingredientNamesMatch, normalizeIngredientKey, parseQuantity, formatQuantity, type UnitConversionRule } from "../unit-conversion";

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
  const requirements = ingredients.filter((ing: any) => !ing.optional).map((ing: any) => {
    const exact = inventory.filter((item: any) => normalizeIngredientKey(ing.name) === normalizeIngredientKey(item.name));
    const candidates = exact.length ? exact : inventory.filter((item: any) => ingredientNamesMatch(ing.name, item.name));
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
        ingredientName: inv.name,
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
      conversionIngredientName: selected.inv.name,
      inventoryId: selected.inv.id,
      inventoryAmount: selected.result.status === "unparsed-inventory" || selected.result.stockQuantity === null
        ? selected.inv.amount : formatQuantity(selected.result.stockQuantity),
      inventoryUnit: selected.result.stockUnit,
      inventoryUpdatedAt: selected.inv.updated_at,
      inventoryVersion: Number(selected.inv.version || 1),
      ...selected.result,
    };
  });
  // One inventory record must have one final remaining quantity, even when
  // multiple recipes (or repeated recipe rows) consume it.
  const grouped = new Map<string, any>();
  const items: any[] = [];
  for (const item of requirements) {
    if (!item.inventoryId) { items.push(item); continue; }
    const previous = grouped.get(item.inventoryId);
    if (!previous) {
      const group = { ...item, requirements: [item] };
      grouped.set(item.inventoryId, group);
      items.push(group);
    } else {
      previous.requirements.push(item);
    }
  }
  for (const item of grouped.values()) {
    if (item.skipDeduction) continue;
    item.recipeAmount = item.requirements.map((entry: any) => entry.recipeAmount).join(" + ");
    const unresolved = item.requirements.find((entry: any) => entry.status !== "ready");
    if (unresolved) {
      item.status = unresolved.status;
      item.neededUnit = unresolved.neededUnit;
      item.conversionPrompt = unresolved.conversionPrompt;
      item.convertedNeeded = null;
      item.remaining = String(item.inventoryAmount ?? "");
    } else {
      item.convertedNeeded = item.requirements.reduce((total: number, entry: any) => total + entry.convertedNeeded, 0);
      item.remaining = formatQuantity(Math.max(0, item.stockQuantity - item.convertedNeeded));
      item.insufficient = item.convertedNeeded > item.stockQuantity + 1e-9;
      if (item.requirements.some((entry: any) => entry.conversionSource === "custom")) item.conversionSource = "custom";
      else if (item.requirements.some((entry: any) => entry.conversionSource === "universal")) item.conversionSource = "universal";
    }
  }
  return {
    items,
    requiresConfirmation: items.some((item: any) => item.inventoryId && !item.skipDeduction &&
      (item.status !== "ready" || item.insufficient)),
  };
}

export function isPantryInventory(item: any): boolean {
  if (!item) return false;
  const category = String(item.category || "").trim();
  return category === "调料" || category === "调味料" || category === "调味品";
}
