import type { Database } from "bun:sqlite";
import { createHash, randomUUID } from "node:crypto";
import { buildCookPlan } from "./cooking";
import { ensureArray } from "./http";
import { formatQuantity, parseQuantity, type UnitConversionRule } from "../unit-conversion";

type Scope = { filterCol: string; extraWhere: string; ownerId: string; familyId: string | null; userId: string };

export class CookingError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export function cookRecipes(db: Database, scope: Scope, recipeIds: unknown, body: any, preview: boolean, batch: boolean) {
  if (!Array.isArray(recipeIds) || !recipeIds.length || recipeIds.length > 200 ||
    recipeIds.some(id => typeof id !== "string" || !id) || new Set(recipeIds).size !== recipeIds.length) {
    throw new CookingError("请提供有效且不重复的菜谱列表");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new CookingError("请求格式不正确");
  if (body.deductions !== undefined && !Array.isArray(body.deductions)) throw new CookingError("库存扣减格式不正确");
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  if (notes.length > 1000) throw new CookingError("备注不能超过1000个字符");

  const operation = db.transaction(() => {
    const { filterCol, ownerId, extraWhere } = scope;
    if (scope.familyId && !db.query("SELECT 1 FROM family_members WHERE family_id=? AND user_id=?").get(scope.familyId, scope.userId)) {
      throw new CookingError("家庭成员关系已变化，请刷新后重试", 409);
    }
    const menu = db.query(`SELECT recipe_id FROM today_menu WHERE ${filterCol}=?${extraWhere} ORDER BY recipe_id`).all(ownerId) as any[];
    if (batch && (menu.length !== recipeIds.length || menu.some(row => !recipeIds.includes(row.recipe_id)))) {
      throw new CookingError("今日菜单已变化，请刷新后重新确认", 409);
    }
    const recipes = recipeIds.map(id => {
      const recipe = db.query(`SELECT * FROM recipes WHERE id=? AND ${filterCol}=?${extraWhere}`).get(id, ownerId) as any;
      if (!recipe) throw new CookingError("菜谱不存在或无权访问", 404);
      return recipe;
    });
    const inventory = db.query(`SELECT * FROM inventory WHERE ${filterCol}=?${extraWhere} ORDER BY id`).all(ownerId) as any[];
    const conversions = db.query(`SELECT ingredient_key, from_unit, to_unit, factor FROM ingredient_unit_conversions
      WHERE owner_type=? AND owner_id=? ORDER BY id`).all(scope.familyId ? "family" : "personal", ownerId) as UnitConversionRule[];
    const plan = buildCookPlan(recipes.flatMap(recipe => ensureArray(recipe.ingredients)), inventory, conversions);
    const snapshot = createHash("sha256").update(JSON.stringify({ recipes, inventory, conversions, menu: batch ? menu : null })).digest("hex");
    if (preview) return { ...plan, snapshot };
    if (body.snapshot !== undefined && body.snapshot !== snapshot) {
      throw new CookingError("库存、菜谱或菜单已变化，请重新打开确认窗口", 409);
    }

    const manual = new Map<string, any>();
    for (const deduction of body.deductions || []) {
      if (!deduction || typeof deduction !== "object") throw new CookingError("库存扣减格式不正确");
      const item = plan.items.find(item => deduction.inventoryId
        ? item.inventoryId === deduction.inventoryId : item.name === deduction.name && item.inventoryId);
      if (!item) throw new CookingError("扣减的食材不属于本次菜谱");
      if (item.skipDeduction) continue;
      if (manual.has(item.inventoryId)) throw new CookingError("同一份库存只能确认一次剩余量");
      if (deduction.inventoryVersion !== undefined && deduction.inventoryVersion !== null &&
        Number(deduction.inventoryVersion) !== item.inventoryVersion) {
        throw new CookingError(`“${item.name}”的库存已被其他成员修改，请重新打开确认窗口`, 409);
      }
      const raw = String(deduction.remaining ?? "").trim();
      const unit = String(deduction.unit ?? item.inventoryUnit ?? "").trim();
      const parsed = parseQuantity(raw, unit);
      if (!deduction.remove && raw && (parsed.value === null || parsed.ambiguous || !Number.isFinite(parsed.value) || parsed.value < 0)) {
        throw new CookingError(`请为“${item.name}”填写有效的非负剩余量，或留空保持不变`);
      }
      manual.set(item.inventoryId, { remove: !!deduction.remove, amount: raw ? formatQuantity(parsed.value!) : "", unit });
    }
    for (const item of plan.items) {
      if (item.inventoryId && !item.skipDeduction && (item.status !== "ready" || item.insufficient) && !manual.has(item.inventoryId)) {
        throw new CookingError("部分食材的单位或库存余量需要确认，请确认后再提交", 409);
      }
    }

    const cookedAt = new Date().toISOString();
    for (const item of plan.items) {
      if (!item.inventoryId || item.skipDeduction) continue;
      const override = manual.get(item.inventoryId);
      const remaining = override ? override.amount : item.remaining;
      if (override?.remove || remaining === "0") {
        db.query("DELETE FROM inventory WHERE id=?").run(item.inventoryId);
      } else if (remaining) {
        db.query("UPDATE inventory SET amount=?, unit=?, version=COALESCE(version, 1)+1, updated_at=? WHERE id=?")
          .run(remaining, override ? override.unit : item.inventoryUnit, cookedAt, item.inventoryId);
      }
    }
    for (const recipe of recipes) {
      const dates = ensureArray(recipe.cooked_dates);
      dates.push(cookedAt);
      db.query("UPDATE recipes SET cooked_dates=?, updated_at=? WHERE id=?").run(JSON.stringify(dates), cookedAt, recipe.id);
      db.query(`INSERT INTO cook_history (id, recipe_id, recipe_name, user_id, family_id, cooked_at, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)`).run(randomUUID(), recipe.id, recipe.name, scope.userId, scope.familyId, cookedAt, notes);
      db.query(`DELETE FROM today_menu WHERE ${filterCol}=?${extraWhere} AND recipe_id=?`).run(ownerId, recipe.id);
    }
    return { ok: true, count: recipes.length, deductions: plan.items };
  });
  // The preview is read-only. Commit acquires a write lock before reading so
  // validation and every inventory/history/menu change share one transaction.
  return preview ? operation() : operation.immediate();
}
