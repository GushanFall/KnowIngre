export type DeductionStatus =
  | "ready"
  | "needs-conversion"
  | "ambiguous-recipe"
  | "unparsed-recipe"
  | "unparsed-inventory";

export interface UnitConversionRule {
  ingredient_key?: string;
  ingredient_name?: string;
  from_unit: string;
  to_unit: string;
  factor: number;
}

export interface ParsedQuantity {
  value: number | null;
  unit: string;
  normalizedUnit: string;
  ambiguous: boolean;
}

export interface DeductionResult {
  status: DeductionStatus;
  stockQuantity: number | null;
  stockUnit: string;
  neededQuantity: number | null;
  neededUnit: string;
  convertedNeeded: number | null;
  remaining: string;
  conversionSource: "same-unit" | "universal" | "custom" | null;
  conversionPrompt?: { fromUnit: string; toUnit: string };
}

type UnitDefinition = { key: string; dimension: "mass" | "volume" | "count"; toBase: number };

const UNIT_ALIASES: Record<string, UnitDefinition> = {
  g: { key: "g", dimension: "mass", toBase: 1 },
  克: { key: "g", dimension: "mass", toBase: 1 },
  公克: { key: "g", dimension: "mass", toBase: 1 },
  kg: { key: "kg", dimension: "mass", toBase: 1000 },
  千克: { key: "kg", dimension: "mass", toBase: 1000 },
  公斤: { key: "kg", dimension: "mass", toBase: 1000 },
  斤: { key: "斤", dimension: "mass", toBase: 500 },
  两: { key: "两", dimension: "mass", toBase: 50 },
  ml: { key: "ml", dimension: "volume", toBase: 1 },
  毫升: { key: "ml", dimension: "volume", toBase: 1 },
  l: { key: "l", dimension: "volume", toBase: 1000 },
  升: { key: "l", dimension: "volume", toBase: 1000 },
  小勺: { key: "小勺", dimension: "volume", toBase: 5 },
  茶匙: { key: "小勺", dimension: "volume", toBase: 5 },
  tsp: { key: "小勺", dimension: "volume", toBase: 5 },
  大勺: { key: "大勺", dimension: "volume", toBase: 15 },
  汤匙: { key: "大勺", dimension: "volume", toBase: 15 },
  tbsp: { key: "大勺", dimension: "volume", toBase: 15 },
  个: { key: "个", dimension: "count", toBase: 1 },
  只: { key: "个", dimension: "count", toBase: 1 },
  枚: { key: "个", dimension: "count", toBase: 1 },
  颗: { key: "个", dimension: "count", toBase: 1 },
};

export function normalizeIngredientKey(name: string): string {
  return String(name || "").trim()
    .replace(/[（(][^）)]*[）)]/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

const INGREDIENT_MATCH_BLOCKLIST = new Set([
  "洋葱|葱",
  "葱|洋葱",
]);

export function ingredientNamesMatch(recipeName: string, inventoryName: string): boolean {
  const recipeKey = normalizeIngredientKey(recipeName);
  const inventoryKey = normalizeIngredientKey(inventoryName);
  if (!recipeKey || !inventoryKey) return false;
  if (recipeKey === inventoryKey) return true;
  if (INGREDIENT_MATCH_BLOCKLIST.has(`${recipeKey}|${inventoryKey}`)) return false;
  const long = inventoryKey.length >= recipeKey.length ? inventoryKey : recipeKey;
  const short = inventoryKey.length >= recipeKey.length ? recipeKey : inventoryKey;
  if (short.length >= 1 && long.endsWith(short)) return true;
  return inventoryKey.length >= 2 && recipeKey.length >= 2
    && (inventoryKey.includes(recipeKey) || recipeKey.includes(inventoryKey));
}

export function normalizeUnit(unit: string): string {
  const raw = String(unit || "").trim().replace(/。$/, "");
  if (!raw) return "";
  const lookup = /^[a-zA-Z]+$/.test(raw) ? raw.toLowerCase() : raw;
  return UNIT_ALIASES[lookup]?.key || lookup;
}

export function getUnitDefinition(unit: string): UnitDefinition | null {
  const normalized = normalizeUnit(unit);
  return Object.values(UNIT_ALIASES).find(def => def.key === normalized) || null;
}

export function parseQuantity(amount: unknown, separateUnit = ""): ParsedQuantity {
  let raw = String(amount ?? "").trim();
  const explicitUnit = String(separateUnit || "").trim();
  raw = raw.replace(/^[约大概近似]\s*/, "");

  let value: number | null = null;
  let consumed = "";
  let ambiguous = false;

  const range = raw.match(/^(\d+(?:\.\d+)?)\s*(?:-|~|～|至|到)\s*(\d+(?:\.\d+)?)/);
  if (range) {
    ambiguous = true;
    consumed = range[0];
  } else {
    const mixedFraction = raw.match(/^(\d+)\s*[又+]\s*(\d+)\s*[\/／]\s*(\d+)/);
    const fraction = raw.match(/^(\d+)\s*[\/／]\s*(\d+)/);
    const decimal = raw.match(/^(\d+(?:\.\d+)?)/);
    if (mixedFraction && Number(mixedFraction[3]) !== 0) {
      value = Number(mixedFraction[1]) + Number(mixedFraction[2]) / Number(mixedFraction[3]);
      consumed = mixedFraction[0];
    } else if (fraction && Number(fraction[2]) !== 0) {
      value = Number(fraction[1]) / Number(fraction[2]);
      consumed = fraction[0];
    } else if (raw.startsWith("半")) {
      value = 0.5;
      consumed = "半";
    } else if (decimal) {
      value = Number(decimal[1]);
      consumed = decimal[0];
    }
  }

  const textUnit = consumed ? raw.slice(consumed.length).trim() : "";
  const unit = explicitUnit || textUnit;
  if (value !== null && !Number.isFinite(value)) value = null;
  // Historical data can include both "1kg" and a separate "g" unit.
  // Convert compatible units rather than silently reading this as 1g.
  if (value !== null && textUnit && explicitUnit && normalizeUnit(textUnit) !== normalizeUnit(explicitUnit)) {
    const converted = universalConversion(value, textUnit, explicitUnit);
    if (converted === null) ambiguous = true;
    else value = converted;
  }
  return { value, unit, normalizedUnit: normalizeUnit(unit), ambiguous };
}

export function formatQuantity(value: number): string {
  if (!Number.isFinite(value)) return "";
  return String(Number(value.toFixed(6)));
}

function universalConversion(value: number, fromUnit: string, toUnit: string): number | null {
  const from = getUnitDefinition(fromUnit);
  const to = getUnitDefinition(toUnit);
  if (!from || !to || from.dimension !== to.dimension) return null;
  return value * from.toBase / to.toBase;
}

function convertWithRule(
  value: number,
  ingredientName: string,
  fromUnit: string,
  toUnit: string,
  rules: UnitConversionRule[],
): number | null {
  const ingredientKey = normalizeIngredientKey(ingredientName);
  const from = normalizeUnit(fromUnit);
  const to = normalizeUnit(toUnit);
  for (const rule of rules) {
    const ruleKey = rule.ingredient_key || normalizeIngredientKey(rule.ingredient_name || "");
    if (ruleKey !== ingredientKey || !Number.isFinite(Number(rule.factor)) || !(Number(rule.factor) > 0)) continue;
    const ruleFrom = normalizeUnit(rule.from_unit);
    const ruleTo = normalizeUnit(rule.to_unit);
    // One ingredient-specific bridge may have universal conversions on either
    // side: 1袋=500g also supports 袋 -> kg and kg -> 袋.
    for (const [start, end, factor] of [
      [ruleFrom, ruleTo, Number(rule.factor)],
      [ruleTo, ruleFrom, 1 / Number(rule.factor)],
    ] as const) {
      const atStart = from === start ? value : universalConversion(value, from, start);
      if (atStart === null) continue;
      const atEnd = atStart * factor;
      const result = end === to ? atEnd : universalConversion(atEnd, end, to);
      if (result !== null && Number.isFinite(result)) return result;
    }
  }
  return null;
}

function conversionPrompt(fromUnit: string, toUnit: string): { fromUnit: string; toUnit: string } {
  const fromDef = getUnitDefinition(fromUnit);
  const toDef = getUnitDefinition(toUnit);
  // Piece-to-weight prompts are easier to answer as "1个 = ?g" regardless
  // of which direction the current deduction needs.
  if (toDef?.dimension === "count" && fromDef?.dimension !== "count") {
    return { fromUnit: toUnit, toUnit: fromUnit };
  }
  return { fromUnit, toUnit };
}

export function calculateDeduction(input: {
  ingredientName: string;
  recipeAmount: unknown;
  recipeUnit?: string;
  inventoryAmount: unknown;
  inventoryUnit?: string;
  rules?: UnitConversionRule[];
}): DeductionResult {
  const needed = parseQuantity(input.recipeAmount, input.recipeUnit || "");
  const stock = parseQuantity(input.inventoryAmount, input.inventoryUnit || "");
  const stockUnit = stock.unit || String(input.inventoryUnit || "").trim();
  const neededUnit = needed.unit;

  if (stock.value === null || stock.ambiguous) {
    return {
      status: "unparsed-inventory", stockQuantity: stock.value, stockUnit,
      neededQuantity: needed.value, neededUnit, convertedNeeded: null,
      remaining: String(input.inventoryAmount ?? ""), conversionSource: null,
    };
  }
  if (needed.ambiguous) {
    return {
      status: "ambiguous-recipe", stockQuantity: stock.value, stockUnit,
      neededQuantity: null, neededUnit, convertedNeeded: null,
      remaining: formatQuantity(stock.value), conversionSource: null,
    };
  }
  if (needed.value === null) {
    return {
      status: "unparsed-recipe", stockQuantity: stock.value, stockUnit,
      neededQuantity: needed.value, neededUnit, convertedNeeded: null,
      remaining: formatQuantity(stock.value), conversionSource: null,
    };
  }

  let converted: number | null = null;
  let source: DeductionResult["conversionSource"] = null;
  const normalizedStockUnit = normalizeUnit(stockUnit);
  const normalizedNeededUnit = normalizeUnit(neededUnit);

  if (normalizedNeededUnit && normalizedNeededUnit === normalizedStockUnit) {
    converted = needed.value;
    source = "same-unit";
  } else if (normalizedNeededUnit && normalizedStockUnit) {
    converted = universalConversion(needed.value, neededUnit, stockUnit);
    if (converted !== null) source = "universal";
    if (converted === null) {
      converted = convertWithRule(needed.value, input.ingredientName, neededUnit, stockUnit, input.rules || []);
      if (converted !== null) source = "custom";
    }
  }

  if (converted === null) {
    return {
      status: "needs-conversion", stockQuantity: stock.value, stockUnit,
      neededQuantity: needed.value, neededUnit, convertedNeeded: null,
      remaining: formatQuantity(stock.value), conversionSource: null,
      conversionPrompt: conversionPrompt(neededUnit, stockUnit),
    };
  }

  // Preserve fractions: rounding each recipe up over-deducts shared ingredients.
  const remaining = Math.max(0, stock.value - converted);
  return {
    status: "ready", stockQuantity: stock.value, stockUnit,
    neededQuantity: needed.value, neededUnit, convertedNeeded: converted,
    remaining: formatQuantity(remaining), conversionSource: source,
  };
}

export function normalizeAmountForStorage(amount: unknown, unit: string): string {
  const raw = String(amount ?? "").trim();
  const cleanUnit = String(unit || "").trim();
  if (cleanUnit && raw.endsWith(cleanUnit)) {
    const candidate = raw.slice(0, -cleanUnit.length).trim();
    const parsed = parseQuantity(candidate);
    if (parsed.value !== null && !parsed.ambiguous && !parsed.normalizedUnit) return candidate;
  }
  return raw;
}
