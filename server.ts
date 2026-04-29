import { Database } from "bun:sqlite";
import { createHmac, randomUUID } from "node:crypto";

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
const JWT_SECRET = process.env.JWT_SECRET || randomUUID().replace(/-/g, "");
const TOKEN_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days

// ===== Database =====
const db = new Database("data.db");
db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;");

// Migration: add is_admin and family columns
try { db.exec("ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0"); } catch {}
try { db.exec("ALTER TABLE recipes ADD COLUMN family_id TEXT"); } catch {}
try { db.exec("ALTER TABLE inventory ADD COLUMN family_id TEXT"); } catch {}
try { db.exec("ALTER TABLE today_menu ADD COLUMN family_id TEXT"); } catch {}

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    is_admin INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS recipes (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    family_id TEXT REFERENCES families(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    tags TEXT DEFAULT '[]',
    ingredients TEXT DEFAULT '[]',
    steps TEXT DEFAULT '[]',
    notes TEXT DEFAULT '',
    source TEXT DEFAULT 'manual',
    rating INTEGER DEFAULT 0,
    cooked_dates TEXT DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS inventory (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    family_id TEXT REFERENCES families(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    amount TEXT DEFAULT '',
    unit TEXT DEFAULT '',
    category TEXT DEFAULT '其他',
    updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS today_menu (
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    family_id TEXT REFERENCES families(id) ON DELETE SET NULL,
    recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    added_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, recipe_id)
  );
  CREATE TABLE IF NOT EXISTS settings (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    base_url TEXT DEFAULT 'https://api.deepseek.com/v1',
    api_key TEXT DEFAULT '',
    model TEXT DEFAULT 'deepseek-v4-flash'
  );
  CREATE TABLE IF NOT EXISTS families (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    invite_code TEXT UNIQUE NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS family_members (
    family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (family_id, user_id)
  );
`);

// ===== JWT =====
function base64url(str: string): string {
  return btoa(str).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function signToken(payload: object): string {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(JSON.stringify(payload));
  const sig = createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}

function verifyToken(token: string): { sub: string } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, body, sig] = parts;
    const expected = createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
    if (sig !== expected) return null;
    const payload = JSON.parse(atob(body));
    if (payload.exp && payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

// ===== Auth Middleware =====
function auth(req: Request): string | null {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  const payload = verifyToken(token);
  return payload?.sub || null;
}

// ===== Scope Helper =====
function resolveScope(userId: string, url: URL): { filterCol: string; extraWhere: string; ownerId: string; familyId: string | null; userId: string } {
  if (url.searchParams.get("scope") === "family") {
    const member = db.query("SELECT family_id FROM family_members WHERE user_id = ?").get(userId) as any;
    if (member) return { filterCol: "family_id", extraWhere: "", ownerId: member.family_id, familyId: member.family_id, userId };
  }
  return { filterCol: "user_id", extraWhere: " AND family_id IS NULL", ownerId: userId, familyId: null, userId };
}

// ===== CORS =====
function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
  };
}

function json(obj: unknown, status = 200): Response {
  const body = JSON.stringify(obj);
  return new Response(body, {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

// ===== Request Helpers =====
function getParam(path: string, pattern: string): Record<string, string> {
  const re = pattern.replace(/:\w+/g, "([^/]+)");
  const m = new URL(path, "http://x").pathname.match(new RegExp(`^${re}$`));
  if (!m) return {};
  const keys = [...pattern.matchAll(/:(\w+)/g)].map(k => k[1]);
  const out: Record<string, string> = {};
  keys.forEach((k, i) => { out[k] = m[i + 1]; });
  return out;
}

// ===== Static File Serving =====
function serveStatic(pathname: string): Response | null {
  const files: Record<string, { content: string; type: string }> = {
    "/": { content: readFile("index.html"), type: "text/html; charset=utf-8" },
    "/index.html": { content: readFile("index.html"), type: "text/html; charset=utf-8" },
    "/login.html": { content: readFile("login.html"), type: "text/html; charset=utf-8" },
    "/styles.css": { content: readFile("styles.css"), type: "text/css; charset=utf-8" },
    "/app.js": { content: readFile("app.js"), type: "application/javascript; charset=utf-8" },
  };
  const f = files[pathname];
  if (!f) return null;
  return new Response(f.content, { headers: { "Content-Type": f.type, ...corsHeaders() } });
}

function readFile(name: string): string {
  try {
    return require("fs").readFileSync(name, "utf-8");
  } catch {
    return "";
  }
}

// ===== Router =====
async function handle(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const method = req.method;
  const path = url.pathname;

  // CORS preflight
  if (method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders() });

  // Static files
  const st = serveStatic(path);
  if (st) return st;

  // Auth routes
  if (method === "POST" && path === "/api/auth/register") {
    const { username, password } = await req.json();
    if (!username || !password || username.length < 2 || password.length < 4) {
      return json({ error: "用户名至少2位，密码至少4位" }, 400);
    }
    const existing = db.query("SELECT id FROM users WHERE username = ?").get(username as string);
    if (existing) return json({ error: "用户名已被占用" }, 409);
    const id = randomUUID();
    const hash = await Bun.password.hash(password as string);
    // First user is automatically admin
    const userCount = (db.query("SELECT COUNT(*) as c FROM users").get() as any).c;
    const isAdmin = userCount === 0 ? 1 : 0;
    db.query("INSERT INTO users (id, username, password_hash, is_admin) VALUES (?, ?, ?, ?)").run(id, username, hash, isAdmin);
    db.query("INSERT INTO settings (user_id) VALUES (?)").run(id);
    const token = signToken({ sub: id, exp: Date.now() + TOKEN_EXPIRY });
    return json({ token, user: { id, username, isAdmin: !!isAdmin } });
  }

  if (method === "POST" && path === "/api/auth/login") {
    const { username, password } = await req.json();
    const user = db.query("SELECT id, username, password_hash, is_admin FROM users WHERE username = ?").get(username as string) as any;
    if (!user) return json({ error: "用户名或密码错误" }, 401);
    const valid = await Bun.password.verify(password as string, user.password_hash);
    if (!valid) return json({ error: "用户名或密码错误" }, 401);
    const token = signToken({ sub: user.id, exp: Date.now() + TOKEN_EXPIRY });
    return json({ token, user: { id: user.id, username: user.username, isAdmin: !!user.is_admin } });
  }

  // All routes below require auth
  const userId = auth(req);
  if (!userId) return json({ error: "未登录或登录已过期" }, 401);

  if (method === "GET" && path === "/api/auth/me") {
    const user = db.query("SELECT id, username, is_admin FROM users WHERE id = ?").get(userId) as any;
    return json({ user: { id: user.id, username: user.username, isAdmin: !!user.is_admin } });
  }

  if (method === "PUT" && path === "/api/auth/password") {
    const { oldPassword, newPassword } = await req.json();
    if (!newPassword || newPassword.length < 4) return json({ error: "新密码至少4位" }, 400);
    const user = db.query("SELECT password_hash FROM users WHERE id = ?").get(userId) as any;
    const valid = await Bun.password.verify(oldPassword as string, user.password_hash);
    if (!valid) return json({ error: "旧密码不正确" }, 400);
    const hash = await Bun.password.hash(newPassword as string);
    db.query("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, userId);
    return json({ ok: true });
  }

  // Admin endpoints
  const isAdmin = (db.query("SELECT is_admin FROM users WHERE id = ?").get(userId) as any)?.is_admin;

  if (method === "GET" && path === "/api/admin/users" && isAdmin) {
    const users = db.query("SELECT id, username, is_admin, created_at FROM users ORDER BY created_at").all();
    return json(users);
  }

  if (method === "POST" && path === "/api/admin/reset-password" && isAdmin) {
    const { userId: targetId, newPassword } = await req.json();
    if (!targetId || !newPassword || newPassword.length < 4) return json({ error: "参数错误" }, 400);
    const hash = await Bun.password.hash(newPassword as string);
    db.query("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, targetId);
    return json({ ok: true });
  }

  // Family management
  const userFamily = db.query("SELECT f.id, f.name, f.invite_code FROM family_members fm JOIN families f ON f.id = fm.family_id WHERE fm.user_id = ?").get(userId) as any;

  if (method === "POST" && path === "/api/family/create") {
    if (userFamily) return json({ error: "你已在一个家庭中" }, 400);
    const { name } = await req.json();
    if (!name) return json({ error: "请输入家庭名称" }, 400);
    const id = randomUUID();
    const code = randomUUID().slice(0, 8);
    db.query("INSERT INTO families (id, name, invite_code) VALUES (?, ?, ?)").run(id, name, code);
    db.query("INSERT INTO family_members (family_id, user_id) VALUES (?, ?)").run(id, userId);
    return json({ id, name, inviteCode: code });
  }

  if (method === "POST" && path === "/api/family/join") {
    if (userFamily) return json({ error: "你已在一个家庭中" }, 400);
    const { code } = await req.json();
    const family = db.query("SELECT id, name FROM families WHERE invite_code = ?").get(code as string) as any;
    if (!family) return json({ error: "邀请码无效" }, 404);
    db.query("INSERT OR IGNORE INTO family_members (family_id, user_id) VALUES (?, ?)").run(family.id, userId);
    return json({ id: family.id, name: family.name });
  }

  if (method === "POST" && path === "/api/family/leave") {
    if (!userFamily) return json({ error: "未加入任何家庭" }, 400);
    db.query("DELETE FROM family_members WHERE family_id = ? AND user_id = ?").run(userFamily.id, userId);
    // Delete family if last member left
    const remaining = (db.query("SELECT COUNT(*) as c FROM family_members WHERE family_id = ?").get(userFamily.id) as any).c;
    if (remaining === 0) db.query("DELETE FROM families WHERE id = ?").run(userFamily.id);
    return json({ ok: true });
  }

  if (method === "POST" && path.startsWith("/api/recipes/") && path.endsWith("/sync")) {
    const recipeId = path.split("/")[3];
    const { to } = await req.json();
    // Try personal recipe first, then family recipe
    let recipe = db.query("SELECT * FROM recipes WHERE id = ? AND family_id IS NULL AND (user_id = ? OR family_id IS NULL)").get(recipeId, userId) as any;
    if (!recipe) recipe = db.query("SELECT * FROM recipes WHERE id = ? AND family_id IS NOT NULL").get(recipeId) as any;
    if (!recipe) return json({ error: "菜谱不存在" }, 404);

    if (to === "family") {
      if (!userFamily) return json({ error: "你未加入任何家庭" }, 400);
      const existing = db.query("SELECT id FROM recipes WHERE name = ? AND family_id = ?").get(recipe.name, userFamily.id);
      if (existing) return json({ error: "家庭中已存在同名菜谱" }, 409);
      const newId = randomUUID();
      db.query(`INSERT INTO recipes (id, user_id, family_id, name, tags, ingredients, steps, notes, source, rating, cooked_dates, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        newId, userId, userFamily.id, recipe.name, recipe.tags, recipe.ingredients, recipe.steps,
        recipe.notes, recipe.source, recipe.rating, recipe.cooked_dates, new Date().toISOString(), new Date().toISOString()
      );
      return json({ id: newId });
    }
    if (to === "personal") {
      if (!userFamily) return json({ error: "你未加入任何家庭" }, 400);
      const existing = db.query("SELECT id FROM recipes WHERE name = ? AND user_id = ? AND family_id IS NULL").get(recipe.name, userId);
      if (existing) return json({ error: "个人菜谱中已存在同名菜谱" }, 409);
      const newId = randomUUID();
      db.query(`INSERT INTO recipes (id, user_id, family_id, name, tags, ingredients, steps, notes, source, rating, cooked_dates, created_at, updated_at)
        VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        newId, userId, recipe.name, recipe.tags, recipe.ingredients, recipe.steps,
        recipe.notes, recipe.source, recipe.rating, recipe.cooked_dates, new Date().toISOString(), new Date().toISOString()
      );
      return json({ id: newId });
    }
    return json({ error: "无效的目标范围" }, 400);
  }

  if (method === "POST" && path === "/api/sync-all") {
    const { from, to } = await req.json();
    if (from === "personal" && to === "family") {
      if (!userFamily) return json({ error: "你未加入任何家庭" }, 400);
      const recipes = db.query("SELECT * FROM recipes WHERE user_id = ? AND family_id IS NULL").all(userId) as any[];
      let count = 0;
      for (const r of recipes) {
        const exists = db.query("SELECT id FROM recipes WHERE name = ? AND family_id = ?").get(r.name, userFamily.id);
        if (exists) continue;
        db.query(`INSERT INTO recipes (id, user_id, family_id, name, tags, ingredients, steps, notes, source, rating, cooked_dates, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
          randomUUID(), userId, userFamily.id, r.name, r.tags, r.ingredients, r.steps,
          r.notes, r.source, r.rating, r.cooked_dates, new Date().toISOString(), new Date().toISOString()
        );
        count++;
      }
      return json({ synced: count, skipped: recipes.length - count });
    }
    if (from === "family" && to === "personal") {
      if (!userFamily) return json({ error: "你未加入任何家庭" }, 400);
      const recipes = db.query("SELECT * FROM recipes WHERE family_id = ?").all(userFamily.id) as any[];
      let count = 0;
      for (const r of recipes) {
        const exists = db.query("SELECT id FROM recipes WHERE name = ? AND user_id = ? AND family_id IS NULL").get(r.name, userId);
        if (exists) continue;
        db.query(`INSERT INTO recipes (id, user_id, family_id, name, tags, ingredients, steps, notes, source, rating, cooked_dates, created_at, updated_at)
          VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
          randomUUID(), userId, r.name, r.tags, r.ingredients, r.steps,
          r.notes, r.source, r.rating, r.cooked_dates, new Date().toISOString(), new Date().toISOString()
        );
        count++;
      }
      return json({ synced: count, skipped: recipes.length - count });
    }
    return json({ error: "无效的同步方向" }, 400);
  }

  if (method === "GET" && path === "/api/family") {
    if (!userFamily) return json({ family: null, members: [] });
    const members = db.query("SELECT u.id, u.username FROM family_members fm JOIN users u ON u.id = fm.user_id WHERE fm.family_id = ?").all(userFamily.id);
    return json({ family: { id: userFamily.id, name: userFamily.name, inviteCode: userFamily.invite_code }, members });
  }

  // Scope-aware data access
  const scope = resolveScope(userId, url);
  const filterCol = scope.filterCol;
  const extraWhere = scope.extraWhere;
  const ownerId = scope.ownerId;

  // Settings
  if (method === "GET" && path === "/api/settings") {
    const row = db.query("SELECT base_url, api_key, model FROM settings WHERE user_id = ?").get(userId) as any;
    return json(row || { base_url: "https://api.deepseek.com/v1", api_key: "", model: "deepseek-v4-flash" });
  }
  if (method === "PUT" && path === "/api/settings") {
    const { baseUrl, apiKey, model } = await req.json();
    db.query("INSERT INTO settings (user_id, base_url, api_key, model) VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET base_url=excluded.base_url, api_key=excluded.api_key, model=excluded.model")
      .run(userId, baseUrl || "", apiKey || "", model || "deepseek-v4-flash");
    return json({ ok: true });
  }

  // Recipes
  if (method === "GET" && path === "/api/recipes") {
    const search = url.searchParams.get("search") || "";
    const tag = url.searchParams.get("tag") || "";
    let rows = db.query(`SELECT * FROM recipes WHERE ${filterCol} = ?${extraWhere} ORDER BY updated_at DESC`).all(ownerId) as any[];
    if (search) {
      const s = search.toLowerCase();
      rows = rows.filter(r =>
        r.name.toLowerCase().includes(s) ||
        JSON.parse(r.tags || "[]").some((t: string) => t.toLowerCase().includes(s)) ||
        JSON.parse(r.ingredients || "[]").some((i: any) => i.name.toLowerCase().includes(s))
      );
    }
    if (tag) {
      rows = rows.filter(r => JSON.parse(r.tags || "[]").includes(tag));
    }
    return json(rows.map(r => ({
      ...r,
      tags: JSON.parse(r.tags || "[]"),
      ingredients: JSON.parse(r.ingredients || "[]"),
      steps: JSON.parse(r.steps || "[]"),
      cookedDates: JSON.parse(r.cooked_dates || "[]"),
    })));
  }
  if (method === "POST" && path === "/api/recipes") {
    const body = await req.json();
    const id = body.id || randomUUID();
    db.query(`INSERT INTO recipes (id, user_id, family_id, name, tags, ingredients, steps, notes, source, rating, cooked_dates, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id, userId, scope.familyId, body.name, JSON.stringify(body.tags || []),
      JSON.stringify(body.ingredients || []), JSON.stringify(body.steps || []),
      body.notes || "", body.source || "manual", body.rating || 0,
      JSON.stringify(body.cookedDates || []), new Date().toISOString(), new Date().toISOString()
    );
    return json({ id });
  }
  if (method === "PUT" && path.startsWith("/api/recipes/")) {
    const id = path.split("/")[3];
    const existing = db.query(`SELECT id FROM recipes WHERE id = ? AND ${filterCol} = ?`).get(id, ownerId);
    if (!existing) return json({ error: "菜谱不存在" }, 404);
    const body = await req.json();
    db.query(`UPDATE recipes SET name=?, tags=?, ingredients=?, steps=?, notes=?, source=?, rating=?, cooked_dates=?, updated_at=? WHERE id=? AND ${filterCol}=?`)
      .run(body.name, JSON.stringify(body.tags || []), JSON.stringify(body.ingredients || []),
        JSON.stringify(body.steps || []), body.notes || "", body.source || "manual",
        body.rating || 0, JSON.stringify(body.cookedDates || []), new Date().toISOString(), id, ownerId);
    return json({ ok: true });
  }
  if (method === "DELETE" && path.startsWith("/api/recipes/")) {
    const id = path.split("/")[3];
    db.query(`DELETE FROM today_menu WHERE recipe_id = ? AND ${filterCol} = ?`).run(id, ownerId);
    db.query(`DELETE FROM recipes WHERE id = ? AND ${filterCol} = ?`).run(id, ownerId);
    return json({ ok: true });
  }

  // Inventory
  if (method === "GET" && path === "/api/inventory") {
    const rows = db.query(`SELECT * FROM inventory WHERE ${filterCol} = ?${extraWhere} ORDER BY updated_at DESC`).all(ownerId) as any[];
    return json(rows);
  }
  if (method === "POST" && path === "/api/inventory") {
    const body = await req.json();
    // Accumulate if same name exists
    const existing = db.query(`SELECT id, amount FROM inventory WHERE name = ? AND ${filterCol} = ?`).get(body.name, ownerId) as any;
    if (existing && body.amount) {
      const oldNum = parseFloat(existing.amount) || 0;
      const newNum = parseFloat(body.amount) || 0;
      const sum = String(oldNum + newNum);
      db.query("UPDATE inventory SET amount=?, unit=COALESCE(NULLIF(?, ''), unit), category=?, updated_at=? WHERE id=?")
        .run(sum, body.unit || "", body.category || "其他", new Date().toISOString(), existing.id);
      return json({ id: existing.id });
    }
    const id = body.id || randomUUID();
    db.query(`INSERT INTO inventory (id, user_id, family_id, name, amount, unit, category, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, userId, scope.familyId, body.name, body.amount || "", body.unit || "", body.category || "其他", new Date().toISOString());
    return json({ id });
  }
  if (method === "PUT" && path.startsWith("/api/inventory/")) {
    const id = path.split("/")[3];
    const body = await req.json();
    db.query(`UPDATE inventory SET name=?, amount=?, unit=?, category=?, updated_at=? WHERE id=? AND ${filterCol}=?`)
      .run(body.name, body.amount || "", body.unit || "", body.category || "其他", new Date().toISOString(), id, ownerId);
    return json({ ok: true });
  }
  if (method === "DELETE" && path.startsWith("/api/inventory/")) {
    const id = path.split("/")[3];
    db.query(`DELETE FROM inventory WHERE id = ? AND ${filterCol} = ?`).run(id, ownerId);
    return json({ ok: true });
  }

  // Today Menu
  if (method === "GET" && path === "/api/menu") {
    const rows = db.query(`SELECT recipe_id FROM today_menu WHERE ${filterCol} = ?${extraWhere} ORDER BY added_at DESC`).all(ownerId) as any[];
    return json(rows.map(r => r.recipe_id));
  }
  if (method === "POST" && path.startsWith("/api/menu/")) {
    const recipeId = path.split("/")[3];
    db.query(`INSERT OR IGNORE INTO today_menu (user_id, family_id, recipe_id) VALUES (?, ?, ?)`).run(userId, scope.familyId, recipeId);
    return json({ ok: true });
  }
  if (method === "DELETE" && path === "/api/menu") {
    db.query(`DELETE FROM today_menu WHERE ${filterCol} = ?${extraWhere}`).run(ownerId);
    return json({ ok: true });
  }
  if (method === "DELETE" && path.startsWith("/api/menu/")) {
    const recipeId = path.split("/")[3];
    db.query(`DELETE FROM today_menu WHERE ${filterCol} = ?${extraWhere} AND recipe_id = ?`).run(ownerId, recipeId);
    return json({ ok: true });
  }

  // Cook
  if (method === "POST" && path.startsWith("/api/cook/")) {
    const recipeId = path.split("/")[3];
    const body = await req.json().catch(() => ({}));
    const recipe = db.query(`SELECT * FROM recipes WHERE id = ? AND ${filterCol} = ?`).get(recipeId, ownerId) as any;
    if (!recipe) return json({ error: "菜谱不存在" }, 404);

    const ingredients = JSON.parse(recipe.ingredients || "[]");
    const inventory = db.query(`SELECT * FROM inventory WHERE ${filterCol} = ?${extraWhere}`).all(ownerId) as any[];

    if (body.deductions) {
      for (const d of body.deductions) {
        const inv = findInventoryMatch(d.name, inventory);
        if (!inv) continue;
        if (d.remove) {
          db.query(`DELETE FROM inventory WHERE id = ? AND ${filterCol} = ?`).run(inv.id, ownerId);
        } else if (d.remaining) {
          const remainNum = parseAmount(d.remaining);
          if (remainNum !== null && remainNum <= 0) {
            db.query(`DELETE FROM inventory WHERE id = ? AND ${filterCol} = ?`).run(inv.id, ownerId);
          } else {
            db.query(`UPDATE inventory SET amount=?, unit=?, updated_at=? WHERE id=? AND ${filterCol}=?`)
              .run(d.remaining, d.unit || inv.unit, new Date().toISOString(), inv.id, ownerId);
          }
        }
      }
    } else {
      for (const ing of ingredients) {
        if (ing.optional) continue;
        const inv = findInventoryMatch(ing.name, inventory);
        if (!inv) continue;
        const stockNum = parseAmount(inv.amount);
        const needNum = parseAmount(ing.amount);
        if (stockNum !== null && needNum !== null) {
          const remaining = Math.max(0, stockNum - needNum);
          if (remaining === 0) {
            db.query(`DELETE FROM inventory WHERE id = ? AND ${filterCol} = ?`).run(inv.id, ownerId);
          } else {
            db.query(`UPDATE inventory SET amount=?, updated_at=? WHERE id=? AND ${filterCol}=?`)
              .run(String(remaining) + (inv.unit || ""), new Date().toISOString(), inv.id, ownerId);
          }
        }
      }
    }

    // Mark cooked
    const cooked = JSON.parse(recipe.cooked_dates || "[]");
    cooked.push(new Date().toISOString());
    db.query("UPDATE recipes SET cooked_dates=?, updated_at=? WHERE id=?")
      .run(JSON.stringify(cooked), new Date().toISOString(), recipeId);

    // Remove from menu
    db.query(`DELETE FROM today_menu WHERE ${filterCol} = ?${extraWhere} AND recipe_id = ?`).run(ownerId, recipeId);

    return json({ ok: true });
  }

  return json({ error: "Not found" }, 404);
}

// ===== Helpers for cook deduction =====
function parseAmount(s: string): number | null {
  if (!s) return null;
  const m = s.trim().match(/^(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
}

function normalizeIngredientName(name: string): string {
  return name.trim()
    .replace(/[（(][^）)]*[）)]/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function findInventoryMatch(name: string, inventory: any[]): any | null {
  const norm = normalizeIngredientName(name);
  return inventory.find((i: any) => {
    const invNorm = normalizeIngredientName(i.name);
    if (invNorm === norm) return true;
    const long = invNorm.length >= norm.length ? invNorm : norm;
    const short = invNorm.length >= norm.length ? norm : invNorm;
    if (short.length >= 1 && long.endsWith(short)) return true;
    if (invNorm.length >= 2 && norm.length >= 2) {
      if (invNorm.includes(norm) || norm.includes(invNorm)) return true;
    }
    return false;
  }) || null;
}

// ===== Start =====
console.log(`🔐 JWT secret: ${JWT_SECRET.slice(0, 8)}...`);
console.log(`🌿 KnowIngre server running at http://localhost:${PORT}`);

Bun.serve({
  port: PORT,
  fetch: handle,
});
