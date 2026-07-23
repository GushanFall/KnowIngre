import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

test("migrates legacy cooked_dates without modifying or duplicating them", () => {
  const directory = mkdtempSync(join(tmpdir(), "knowingre-history-migration-"));
  const databasePath = join(directory, "legacy.db");
  const legacy = new Database(databasePath);
  legacy.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
      is_admin INTEGER DEFAULT 0, created_at TEXT
    );
    CREATE TABLE families (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, invite_code TEXT UNIQUE NOT NULL, created_at TEXT
    );
    CREATE TABLE recipes (
      id TEXT PRIMARY KEY, user_id TEXT, family_id TEXT, name TEXT NOT NULL,
      tags TEXT DEFAULT '[]', ingredients TEXT DEFAULT '[]', steps TEXT DEFAULT '[]',
      notes TEXT DEFAULT '', source TEXT DEFAULT 'manual', rating INTEGER DEFAULT 0,
      cooked_dates TEXT DEFAULT '[]', created_at TEXT, updated_at TEXT
    );
    INSERT INTO users (id, username, password_hash) VALUES ('legacy-user', '旧用户', 'unused');
    INSERT INTO families (id, name, invite_code) VALUES ('old-family', '旧家庭', 'old-code');
    INSERT INTO recipes (id, user_id, family_id, name, cooked_dates) VALUES
      ('legacy-personal', 'legacy-user', NULL, '旧私房菜', '["2024-01-01T10:00:00.000Z","2024-02-02T10:00:00.000Z"]'),
      ('legacy-family', 'legacy-user', 'old-family', '旧家庭菜', '["2024-03-03T10:00:00.000Z"]');
  `);
  legacy.close();

  const runMigration = () => spawnSync(process.execPath, ["-e", "await import('./server.ts')"], {
    cwd: import.meta.dir,
    env: { ...process.env, KNOWINGRE_DB_PATH: databasePath, JWT_SECRET: "migration-test-secret" },
    encoding: "utf8",
  });
  const firstRun = runMigration();
  expect(firstRun.status, firstRun.stderr).toBe(0);
  const secondRun = runMigration();
  expect(secondRun.status, secondRun.stderr).toBe(0);

  const migrated = new Database(databasePath);
  const rows = migrated.query("SELECT recipe_id, user_id, family_id, cooked_at FROM cook_history ORDER BY cooked_at").all() as any[];
  expect(rows).toHaveLength(3);
  expect(rows[0]).toMatchObject({ recipe_id: "legacy-personal", user_id: "legacy-user", family_id: null });
  expect(rows[2]).toMatchObject({ recipe_id: "legacy-family", user_id: null, family_id: "old-family" });
  const original = migrated.query("SELECT cooked_dates FROM recipes WHERE id='legacy-personal'").get() as any;
  expect(JSON.parse(original.cooked_dates)).toEqual(["2024-01-01T10:00:00.000Z", "2024-02-02T10:00:00.000Z"]);
  expect((migrated.query("PRAGMA integrity_check").get() as any).integrity_check).toBe("ok");
  migrated.close();
});
