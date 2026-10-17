import { describe, expect, test } from "bun:test";
import { calculateDeduction, ingredientNamesMatch, normalizeAmountForStorage, parseQuantity } from "./unit-conversion";

describe("unit conversion", () => {
  test("keeps count amount separate from its unit", () => {
    const result = calculateDeduction({
      ingredientName: "鸡蛋", recipeAmount: "1个", inventoryAmount: "2", inventoryUnit: "个",
    });
    expect(result.status).toBe("ready");
    expect(result.remaining).toBe("1");
  });

  test("converts universal mass and volume units", () => {
    expect(calculateDeduction({
      ingredientName: "面粉", recipeAmount: "250g", inventoryAmount: "1", inventoryUnit: "kg",
    }).remaining).toBe("0.75");
    expect(calculateDeduction({
      ingredientName: "牛奶", recipeAmount: "1大勺", inventoryAmount: "100", inventoryUnit: "ml",
    }).remaining).toBe("85");
  });

  test("uses ingredient-specific count-to-weight rules in both directions", () => {
    const rules = [{ ingredient_key: "鸡蛋", from_unit: "个", to_unit: "g", factor: 55 }];
    expect(calculateDeduction({
      ingredientName: "鸡蛋", recipeAmount: "2个", inventoryAmount: "200", inventoryUnit: "g", rules,
    }).remaining).toBe("90");
    expect(calculateDeduction({
      ingredientName: "鸡蛋", recipeAmount: "100g", inventoryAmount: "5", inventoryUnit: "个", rules,
    }).remaining).toBe("3.181818");
  });

  test("composes ingredient rules with universal units and preserves partial pieces", () => {
    const rules = [{ ingredient_key: "番茄", from_unit: "个", to_unit: "g", factor: 200 }];
    expect(calculateDeduction({ ingredientName: "番茄", recipeAmount: "0.1kg", inventoryAmount: "3", inventoryUnit: "个", rules }))
      .toMatchObject({ status: "ready", convertedNeeded: 0.5, remaining: "2.5" });
    expect(calculateDeduction({ ingredientName: "番茄", recipeAmount: "2个", inventoryAmount: "1", inventoryUnit: "kg", rules }))
      .toMatchObject({ status: "ready", convertedNeeded: 0.4, remaining: "0.6" });
    expect(calculateDeduction({ ingredientName: "番茄", recipeAmount: "500g", inventoryAmount: "2", inventoryUnit: "袋",
      rules: [{ ingredient_key: "番茄", from_unit: "袋", to_unit: "kg", factor: 1 }] }))
      .toMatchObject({ status: "ready", remaining: "1.5" });
    expect(calculateDeduction({ ingredientName: "土豆", recipeAmount: "100g", inventoryAmount: "3", inventoryUnit: "个", rules }).status)
      .toBe("needs-conversion");
  });

  test("requires review for missing units instead of assuming the inventory unit", () => {
    expect(calculateDeduction({ ingredientName: "鸡蛋", recipeAmount: "2", inventoryAmount: "3", inventoryUnit: "个" }).status)
      .toBe("needs-conversion");
  });

  test("reconciles embedded units with a separate unit without silently changing quantities", () => {
    expect(parseQuantity("1kg", "g")).toMatchObject({ value: 1000, normalizedUnit: "g", ambiguous: false });
    expect(parseQuantity("2个", "g").ambiguous).toBe(true);
  });

  test("requires confirmation when no cross-dimension rule exists", () => {
    const result = calculateDeduction({
      ingredientName: "番茄", recipeAmount: "200g", inventoryAmount: "3", inventoryUnit: "个",
    });
    expect(result.status).toBe("needs-conversion");
    expect(result.conversionPrompt).toEqual({ fromUnit: "个", toUnit: "g" });
    expect(result.remaining).toBe("3");
  });

  test("supports fractions and preserves unparseable amounts", () => {
    expect(parseQuantity("1/2kg")).toMatchObject({ value: 0.5, normalizedUnit: "kg" });
    expect(calculateDeduction({
      ingredientName: "盐", recipeAmount: "适量", inventoryAmount: "100", inventoryUnit: "g",
    }).status).toBe("unparsed-recipe");
    expect(normalizeAmountForStorage("1个", "个")).toBe("1");
    expect(normalizeAmountForStorage("1kg", "g")).toBe("1kg");
  });

  test("requires review for numeric ranges", () => {
    expect(calculateDeduction({
      ingredientName: "鸡蛋", recipeAmount: "2-3个", inventoryAmount: "5", inventoryUnit: "个",
    }).status).toBe("ambiguous-recipe");
  });

  test("blocks known false ingredient suffix matches", () => {
    expect(ingredientNamesMatch("葱", "洋葱")).toBe(false);
    expect(ingredientNamesMatch("鸡蛋", "土鸡蛋")).toBe(true);
  });
});
