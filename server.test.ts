import { beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const testDirectory = mkdtempSync(join(tmpdir(), "knowingre-server-"));
process.env.KNOWINGRE_DB_PATH = join(testDirectory, "data.db");
process.env.JWT_SECRET = "integration-test-secret";

let handle: (request: Request) => Promise<Response>;
let token = "";

async function request(path: string, method = "GET", body?: unknown, authToken = token) {
  const headers: Record<string, string> = {};
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await handle(new Request(`http://localhost${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  }));
  return { status: response.status, data: await response.json() as any };
}

beforeAll(async () => {
  ({ handle } = await import("./server"));
  const registered = await request("/api/auth/register", "POST", { username: "测试用户", password: "test1234" });
  expect(registered.status).toBe(200);
  token = registered.data.token;
});

describe("cook deduction API", () => {
  test("deducts matching count units without duplicating the unit", async () => {
    await request("/api/inventory", "POST", {
      id: "egg-stock", name: "鸡蛋", amount: "2", unit: "个", category: "蛋奶",
    });
    await request("/api/recipes", "POST", {
      id: "egg-recipe", name: "煎蛋",
      ingredients: [{ name: "鸡蛋", amount: "1个", optional: false }], steps: [],
    });

    const recipes = await request("/api/recipes");
    expect(recipes.data.find((item: any) => item.id === "egg-recipe").ingredients[0])
      .toMatchObject({ amount: "1个", quantity: 1, unit: "个" });

    const preview = await request("/api/cook/egg-recipe/preview", "POST", {});
    expect(preview.data.items[0]).toMatchObject({ status: "ready", remaining: "1" });
    expect((await request("/api/cook/egg-recipe", "POST", {})).status).toBe(200);

    const inventory = await request("/api/inventory");
    expect(inventory.data.find((item: any) => item.id === "egg-stock")).toMatchObject({ amount: "1", unit: "个" });
  });

  test("blocks incompatible units until a reusable ingredient rule exists", async () => {
    await request("/api/inventory", "POST", {
      id: "tomato-stock", name: "番茄", amount: "3", unit: "个", category: "蔬菜",
    });
    await request("/api/recipes", "POST", {
      id: "tomato-recipe", name: "番茄汤",
      ingredients: [{ name: "番茄", amount: "200g", optional: false }], steps: [],
    });

    const unresolved = await request("/api/cook/tomato-recipe/preview", "POST", {});
    expect(unresolved.data.requiresConfirmation).toBe(true);
    expect(unresolved.data.items[0]).toMatchObject({
      status: "needs-conversion",
      conversionPrompt: { fromUnit: "个", toUnit: "g" },
    });
    expect((await request("/api/cook/tomato-recipe", "POST", {})).status).toBe(409);

    expect((await request("/api/unit-conversions", "POST", {
      ingredientName: "番茄", fromUnit: "个", toUnit: "g", factor: 100,
    })).status).toBe(200);
    const converted = await request("/api/cook/tomato-recipe/preview", "POST", {});
    expect(converted.data.items[0]).toMatchObject({
      status: "ready", convertedNeeded: 2, remaining: "1", conversionSource: "custom",
    });
    expect((await request("/api/cook/tomato-recipe", "POST", {})).status).toBe(200);

    const inventory = await request("/api/inventory");
    expect(inventory.data.find((item: any) => item.id === "tomato-stock")).toMatchObject({ amount: "1", unit: "个" });
  });

  test("converts universal units automatically", async () => {
    await request("/api/inventory", "POST", {
      id: "flour-stock", name: "面粉", amount: "1", unit: "kg", category: "主食",
    });
    await request("/api/recipes", "POST", {
      id: "flour-recipe", name: "面饼",
      ingredients: [{ name: "面粉", amount: "250g", optional: false }], steps: [],
    });
    const preview = await request("/api/cook/flour-recipe/preview", "POST", {});
    expect(preview.data.items[0]).toMatchObject({
      status: "ready", convertedNeeded: 0.25, remaining: "0.75", conversionSource: "universal",
    });
  });

  test("does not match scallion to onion", async () => {
    await request("/api/inventory", "POST", {
      id: "onion-stock", name: "洋葱", amount: "2", unit: "个", category: "蔬菜",
    });
    await request("/api/recipes", "POST", {
      id: "scallion-recipe", name: "葱油菜",
      ingredients: [{ name: "葱", amount: "1个", optional: false }], steps: [],
    });
    const preview = await request("/api/cook/scallion-recipe/preview", "POST", {});
    expect(preview.data.items[0]).toMatchObject({ status: "missing-inventory", inventoryId: null });
  });

  test("requires confirmation for numeric ranges", async () => {
    await request("/api/inventory", "POST", {
      id: "range-egg", name: "鹌鹑蛋", amount: "8", unit: "个", category: "蛋奶",
    });
    await request("/api/recipes", "POST", {
      id: "range-recipe", name: "区间用量菜",
      ingredients: [{ name: "鹌鹑蛋", amount: "2-3个", optional: false }], steps: [],
    });
    const preview = await request("/api/cook/range-recipe/preview", "POST", {});
    expect(preview.data).toMatchObject({ requiresConfirmation: true });
    expect(preview.data.items[0].status).toBe("ambiguous-recipe");
    expect((await request("/api/cook/range-recipe", "POST", {})).status).toBe(409);
  });

  test("rejects stale manual deductions", async () => {
    await request("/api/inventory", "POST", {
      id: "stale-stock", name: "土豆", amount: "5", unit: "个", category: "蔬菜",
    });
    await request("/api/recipes", "POST", {
      id: "stale-recipe", name: "土豆菜",
      ingredients: [{ name: "土豆", amount: "1个", optional: false }], steps: [],
    });
    const preview = await request("/api/cook/stale-recipe/preview", "POST", {});
    const item = preview.data.items[0];
    await request("/api/inventory/stale-stock", "PUT", { name: "土豆", amount: "6", unit: "个", category: "蔬菜" });
    const result = await request("/api/cook/stale-recipe", "POST", {
      deductions: [{
        name: "土豆", inventoryId: "stale-stock", inventoryVersion: item.inventoryVersion,
        remaining: "4", unit: "个", remove: false,
      }],
    });
    expect(result.status).toBe(409);
    const inventory = await request("/api/inventory");
    expect(inventory.data.find((entry: any) => entry.id === "stale-stock").amount).toBe("6");
  });
});

describe("cooking history API", () => {
  test("records a cook and can undo the matching legacy date", async () => {
    await request("/api/recipes", "POST", {
      id: "history-recipe", name: "历史测试菜", tags: ["家常"], ingredients: [], steps: [],
    });
    expect((await request("/api/cook/history-recipe", "POST", {})).status).toBe(200);

    const history = await request("/api/history");
    const entry = history.data.find((item: any) => item.recipeId === "history-recipe");
    expect(entry).toMatchObject({ recipeName: "历史测试菜", recipeTags: ["家常"], username: "测试用户" });

    const recipeAfterCook = (await request("/api/recipes")).data.find((item: any) => item.id === "history-recipe");
    expect(recipeAfterCook.cookedDates).toEqual([entry.cookedAt]);

    const outsider = await request("/api/auth/register", "POST", { username: "足迹旁观者", password: "test1234" }, "");
    expect((await request(`/api/history/${entry.id}`, "DELETE", undefined, outsider.data.token)).status).toBe(404);
    expect((await request(`/api/history/${entry.id}`, "DELETE")).status).toBe(200);
    expect((await request("/api/history")).data.some((item: any) => item.id === entry.id)).toBe(false);

    const recipeAfterUndo = (await request("/api/recipes")).data.find((item: any) => item.id === "history-recipe");
    expect(recipeAfterUndo.cookedDates).toEqual([]);
  });

  test("keeps family history separate and attributes new records", async () => {
    const registered = await request("/api/auth/register", "POST", { username: "足迹家庭用户", password: "test1234" }, "");
    const familyToken = registered.data.token;
    expect((await request("/api/family/create", "POST", { name: "足迹家庭" }, familyToken)).status).toBe(200);
    await request("/api/recipes?scope=family", "POST", {
      id: "family-history-recipe", name: "家庭晚餐", ingredients: [], steps: [],
    }, familyToken);
    expect((await request("/api/cook/family-history-recipe?scope=family", "POST", {}, familyToken)).status).toBe(200);

    const familyHistory = await request("/api/history?scope=family", "GET", undefined, familyToken);
    expect(familyHistory.data.find((item: any) => item.recipeId === "family-history-recipe"))
      .toMatchObject({ recipeName: "家庭晚餐", username: "足迹家庭用户" });
    const personalHistory = await request("/api/history", "GET", undefined, familyToken);
    expect(personalHistory.data.some((item: any) => item.recipeId === "family-history-recipe")).toBe(false);
  });

  test("restores history from old backups without duplicating it", async () => {
    const backup = {
      recipes: [{
        id: "legacy-backup-recipe", name: "旧备份菜", ingredients: [], steps: [],
        cookedDates: ["2025-01-02T03:04:05.000Z", "2025-01-02T03:04:05.000Z"],
      }],
      inventory: [], todayMenu: [], unitConversions: [],
    };
    const first = await request("/api/import", "POST", backup);
    const second = await request("/api/import", "POST", backup);
    expect(first.data.history).toBe(2);
    expect(second.data.history).toBe(0);
    const history = await request("/api/history");
    expect(history.data.filter((item: any) => item.recipeId === "legacy-backup-recipe")).toHaveLength(2);
  });
});

describe("scope and authorization", () => {
  test("keeps personal inventory separate from family inventory", async () => {
    expect((await request("/api/family/create", "POST", { name: "测试家庭" })).status).toBe(200);
    await request("/api/inventory?scope=family", "POST", {
      id: "family-duck-egg", name: "鸭蛋", amount: "2", unit: "个", category: "蛋奶",
    });
    await request("/api/inventory", "POST", {
      id: "personal-duck-egg", name: "鸭蛋", amount: "3", unit: "个", category: "蛋奶",
    });
    const personal = await request("/api/inventory");
    const family = await request("/api/inventory?scope=family");
    expect(personal.data.find((entry: any) => entry.id === "personal-duck-egg")).toMatchObject({ amount: "3", family_id: null });
    expect(family.data.find((entry: any) => entry.id === "family-duck-egg")).toMatchObject({ amount: "2" });
  });

  test("does not allow syncing another user's private recipe", async () => {
    await request("/api/recipes", "POST", { id: "private-owner-recipe", name: "私人菜谱", ingredients: [], steps: [] });
    const registered = await request("/api/auth/register", "POST", { username: "第二用户", password: "test1234" }, "");
    const secondToken = registered.data.token;
    await request("/api/family/create", "POST", { name: "第二家庭" }, secondToken);
    const result = await request("/api/recipes/private-owner-recipe/sync", "POST", { to: "family" }, secondToken);
    expect(result.status).toBe(404);
    const familyRecipes = await request("/api/recipes?scope=family", "GET", undefined, secondToken);
    expect(familyRecipes.data).toHaveLength(0);
  });
});

describe("safe import", () => {
  test("updates matching IDs and keeps unrelated data", async () => {
    await request("/api/recipes", "POST", { id: "import-existing", name: "旧名称", ingredients: [], steps: [] });
    await request("/api/recipes", "POST", { id: "import-unrelated", name: "保留菜谱", ingredients: [], steps: [] });
    const result = await request("/api/import", "POST", {
      recipes: [
        { id: "import-existing", name: "新名称", ingredients: [], steps: [] },
        { id: "import-new", name: "新增菜谱", ingredients: [], steps: [] },
      ],
      inventory: [{ id: "import-stock", name: "牛奶", amount: "1L", unit: "L", category: "蛋奶" }],
      todayMenu: ["import-new"],
      unitConversions: [],
    });
    expect(result.status).toBe(200);
    expect(result.data).toMatchObject({ recipesCreated: 1, recipesUpdated: 1, inventoryCreated: 1 });
    const recipes = await request("/api/recipes");
    expect(recipes.data.find((entry: any) => entry.id === "import-existing").name).toBe("新名称");
    expect(recipes.data.some((entry: any) => entry.id === "import-unrelated")).toBe(true);
    const inventory = await request("/api/inventory");
    expect(inventory.data.find((entry: any) => entry.id === "import-stock")).toMatchObject({ amount: "1", unit: "L" });
  });
});
