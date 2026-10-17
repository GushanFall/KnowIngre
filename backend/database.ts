import { Database } from "bun:sqlite";
import { randomUUID } from "node:crypto";

// ===== Database =====
export const db = new Database(process.env.KNOWINGRE_DB_PATH || "data.db");
db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;");

// Migration: add is_admin and family columns
try { db.exec("ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0"); } catch {}
try { db.exec("ALTER TABLE recipes ADD COLUMN family_id TEXT"); } catch {}
try { db.exec("ALTER TABLE inventory ADD COLUMN family_id TEXT"); } catch {}
try { db.exec("ALTER TABLE inventory ADD COLUMN version INTEGER DEFAULT 1"); } catch {}
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
    version INTEGER DEFAULT 1,
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
  CREATE TABLE IF NOT EXISTS ingredient_unit_conversions (
    id TEXT PRIMARY KEY,
    owner_type TEXT NOT NULL CHECK(owner_type IN ('personal', 'family')),
    owner_id TEXT NOT NULL,
    ingredient_key TEXT NOT NULL,
    ingredient_name TEXT NOT NULL,
    from_unit TEXT NOT NULL,
    to_unit TEXT NOT NULL,
    factor REAL NOT NULL CHECK(factor > 0),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(owner_type, owner_id, ingredient_key, from_unit, to_unit)
  );
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS app_metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS cook_history (
    id TEXT PRIMARY KEY,
    recipe_id TEXT REFERENCES recipes(id) ON DELETE SET NULL,
    recipe_name TEXT NOT NULL,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    family_id TEXT REFERENCES families(id) ON DELETE SET NULL,
    cooked_at TEXT NOT NULL,
    servings REAL,
    notes TEXT DEFAULT '',
    legacy_key TEXT UNIQUE,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_cook_history_user_date ON cook_history(user_id, cooked_at);
  CREATE INDEX IF NOT EXISTS idx_cook_history_family_date ON cook_history(family_id, cooked_at);
  INSERT OR IGNORE INTO schema_migrations (version) VALUES ('2026-07-unit-conversions-v1');
`);

function migrateLegacyInventoryAmounts() {
  const version = "2026-07-inventory-unit-cleanup-v1";
  if (db.query("SELECT version FROM schema_migrations WHERE version=?").get(version)) return;
  const migrate = db.transaction(() => {
    const rows = db.query("SELECT id, amount, unit FROM inventory WHERE TRIM(COALESCE(unit, '')) <> ''").all() as any[];
    for (const row of rows) {
      const amount = String(row.amount || "").trim();
      const unit = String(row.unit || "").trim();
      if (!amount.endsWith(unit)) continue;
      const numericPart = amount.slice(0, -unit.length).trim();
      if (!/^\d+(?:\.\d+)?$/.test(numericPart)) continue;
      db.query("UPDATE inventory SET amount=?, version=COALESCE(version, 1)+1 WHERE id=?").run(numericPart, row.id);
    }
    db.query("INSERT INTO schema_migrations (version) VALUES (?)").run(version);
  });
  migrate();
}

function migrateCookHistory() {
  const version = "2026-07-cook-history-v1";
  if (db.query("SELECT version FROM schema_migrations WHERE version=?").get(version)) return;
  const migrate = db.transaction(() => {
    const recipes = db.query("SELECT id, name, user_id, family_id, cooked_dates FROM recipes").all() as any[];
    const insert = db.query(`INSERT OR IGNORE INTO cook_history
      (id, recipe_id, recipe_name, user_id, family_id, cooked_at, legacy_key)
      VALUES (?, ?, ?, ?, ?, ?, ?)`);
    for (const recipe of recipes) {
      let dates: unknown[] = [];
      try {
        const parsed = JSON.parse(recipe.cooked_dates || "[]");
        if (Array.isArray(parsed)) dates = parsed;
      } catch {}
      dates.forEach((rawDate, index) => {
        if (typeof rawDate !== "string" || !rawDate.trim()) return;
        const cookedAt = rawDate.trim();
        const familyId = recipe.family_id && db.query("SELECT 1 FROM families WHERE id=?").get(recipe.family_id)
          ? recipe.family_id
          : null;
        const personalUserId = !familyId && recipe.user_id && db.query("SELECT 1 FROM users WHERE id=?").get(recipe.user_id)
          ? recipe.user_id
          : null;
        insert.run(
          randomUUID(), recipe.id, recipe.name,
          personalUserId, familyId, cookedAt,
          `${recipe.id}:${index}:${cookedAt}`,
        );
      });
    }
    db.query("INSERT INTO schema_migrations (version) VALUES (?)").run(version);
  });
  migrate();
}

function migrateFamilyMenuUniqueness() {
  const version = "2026-07-family-menu-unique-v1";
  if (db.query("SELECT version FROM schema_migrations WHERE version=?").get(version)) return;
  const migrate = db.transaction(() => {
    const duplicateGroups = db.query(`SELECT family_id, recipe_id
      FROM today_menu
      WHERE family_id IS NOT NULL
      GROUP BY family_id, recipe_id
      HAVING COUNT(*) > 1`).all() as any[];
    for (const group of duplicateGroups) {
      const keep = db.query(`SELECT rowid FROM today_menu
        WHERE family_id=? AND recipe_id=?
        ORDER BY added_at DESC, rowid DESC LIMIT 1`).get(group.family_id, group.recipe_id) as any;
      if (!keep) continue;
      db.query(`DELETE FROM today_menu
        WHERE family_id=? AND recipe_id=? AND rowid<>?`)
        .run(group.family_id, group.recipe_id, keep.rowid);
    }
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_today_menu_family_recipe
      ON today_menu(family_id, recipe_id) WHERE family_id IS NOT NULL`);
    db.query("INSERT INTO schema_migrations (version) VALUES (?)").run(version);
  });
  migrate();
}

function resolveJwtSecret(): string {
  const configured = String(process.env.JWT_SECRET || "").trim();
  if (configured) return configured;
  const existing = db.query("SELECT value FROM app_metadata WHERE key='jwt_secret'").get() as any;
  if (existing?.value) return existing.value;
  const generated = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
  db.query("INSERT INTO app_metadata (key, value) VALUES ('jwt_secret', ?)").run(generated);
  return generated;
}

migrateLegacyInventoryAmounts();
migrateCookHistory();
migrateFamilyMenuUniqueness();
export const JWT_SECRET = resolveJwtSecret();

