type RecipePayload = {
  name: string;
  tags: string[];
  ingredients: Array<{ name: string; amount: string; optional: boolean }>;
  steps: string[];
  notes: string;
  source: string;
  rating: number;
  cookedDates: string[];
};

export function validateRecipePayload(raw: any): { value?: RecipePayload; error?: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { error: "菜谱数据格式不正确" };

  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!name || name.length > 100) return { error: "菜名不能为空且不能超过 100 个字符" };

  const rawTags = raw.tags ?? [];
  if (!Array.isArray(rawTags)) return { error: "菜谱标签格式不正确" };
  const tags = [...new Set(rawTags.map((tag: any) => typeof tag === "string" ? tag.trim() : "").filter(Boolean))];
  if (tags.length > 12 || tags.some(tag => tag.length > 30)) return { error: "菜谱标签过多或过长" };

  const rawIngredients = raw.ingredients ?? [];
  if (!Array.isArray(rawIngredients) || rawIngredients.length > 100) return { error: "食材列表格式不正确或数量过多" };
  const ingredients: RecipePayload["ingredients"] = [];
  for (const ingredient of rawIngredients) {
    if (!ingredient || typeof ingredient !== "object" || Array.isArray(ingredient)) return { error: "食材数据格式不正确" };
    const ingredientName = typeof ingredient.name === "string" ? ingredient.name.trim() : "";
    if (!ingredientName || ingredientName.length > 100) return { error: "食材名称不能为空且不能超过 100 个字符" };
    const amountSource = ingredient.amount ?? ingredient.quantity ?? "";
    const amount = typeof amountSource === "number" ? String(amountSource) : (typeof amountSource === "string" ? amountSource.trim() : "");
    const unit = typeof ingredient.unit === "string" ? ingredient.unit.trim() : "";
    const displayAmount = amount && unit && !amount.endsWith(unit) ? `${amount}${unit}` : amount;
    if (displayAmount.length > 100) return { error: `食材「${ingredientName}」的用量过长` };
    ingredients.push({ name: ingredientName, amount: displayAmount, optional: ingredient.optional === true });
  }

  const rawSteps = raw.steps ?? [];
  if (!Array.isArray(rawSteps) || rawSteps.length > 100) return { error: "步骤列表格式不正确或数量过多" };
  const steps: string[] = [];
  for (const step of rawSteps) {
    if (typeof step !== "string") return { error: "每条烹饪步骤都必须是文字" };
    const normalized = step.trim();
    if (!normalized) continue;
    if (normalized.length > 2000) return { error: "单条烹饪步骤不能超过 2000 个字符" };
    steps.push(normalized);
  }

  const notes = typeof raw.notes === "string" ? raw.notes.trim() : "";
  if (notes.length > 5000) return { error: "菜谱备注不能超过 5000 个字符" };
  const source = typeof raw.source === "string" && raw.source.trim() ? raw.source.trim().slice(0, 30) : "manual";
  const ratingNumber = Number(raw.rating ?? 0);
  const rating = Number.isFinite(ratingNumber) ? Math.max(0, Math.min(5, Math.round(ratingNumber))) : 0;

  const rawCookedDates = raw.cookedDates ?? raw.cooked_dates ?? [];
  if (!Array.isArray(rawCookedDates) || rawCookedDates.length > 10000) return { error: "烹饪日期格式不正确" };
  const cookedDates = rawCookedDates.filter((date: any) => typeof date === "string" && !Number.isNaN(new Date(date).getTime()));

  return { value: { name, tags, ingredients, steps, notes, source, rating, cookedDates } };
}

