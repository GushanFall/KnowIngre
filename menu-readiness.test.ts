import { expect, test } from "bun:test";
import { ingredientReadiness } from "./frontend/menu-readiness.js";
import { buildCookPlan } from "./backend/cooking";

test("shopping labels use the same aggregate shortage as actual cooking", () => {
  const plan = buildCookPlan([{ name: "鸡蛋", amount: "2个" }, { name: "鸡蛋", amount: "2个" }],
    [{ id: "eggs", name: "鸡蛋", amount: "3", unit: "个" }], []);
  expect(ingredientReadiness("鸡蛋", plan)).toMatchObject({ status: "short", detail: "还差 1 个" });
});

test("stock presence alone does not mean ingredients are ready", () => {
  const plan = buildCookPlan([{ name: "番茄", amount: "200g" }], [{ id: "tomato", name: "番茄", amount: "3", unit: "个" }], []);
  expect(ingredientReadiness("番茄", plan)).toMatchObject({ status: "review", label: "待确认" });
  expect(ingredientReadiness("番茄", null)).toMatchObject({ status: "checking" });
  expect(ingredientReadiness("番茄", null, true)).toMatchObject({ status: "review" });
});

test("converted quantities, missing stock and pantry items get distinct states", () => {
  const plan = buildCookPlan([{ name: "面粉", amount: "200g" }, { name: "牛奶", amount: "100ml" }, { name: "生抽", amount: "1勺" }],
    [{ id: "flour", name: "面粉", amount: "1", unit: "kg" }, { id: "soy", name: "生抽", amount: "适量", category: "调料" }], []);
  expect(ingredientReadiness("面粉", plan)).toMatchObject({ status: "ready", detail: "本次需 0.2 kg" });
  expect(ingredientReadiness("牛奶", plan)).toMatchObject({ status: "missing" });
  expect(ingredientReadiness("生抽", plan)).toMatchObject({ status: "pantry" });
});
