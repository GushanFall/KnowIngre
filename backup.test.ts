import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { databaseBackup } from "./backend/backup";

test("backs up committed WAL changes into one independently readable file", async () => {
  const directory = mkdtempSync(join(tmpdir(), "knowingre-wal-test-"));
  const source = new Database(join(directory, "source.db"));
  try {
    source.exec("PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0; CREATE TABLE items (id TEXT PRIMARY KEY, amount INTEGER)");
    source.query("INSERT INTO items VALUES (?, ?)").run("latest", 7);
    // A raw copy of the main file cannot see this committed change yet.
    writeFileSync(join(directory, "raw-copy.db"), readFileSync(join(directory, "source.db")));
    const raw = new Database(join(directory, "raw-copy.db"));
    try {
      expect(raw.query("SELECT name FROM sqlite_master WHERE name='items'").get()).toBeNull();
    } finally {
      raw.close();
    }

    const response = databaseBackup(source);
    writeFileSync(join(directory, "snapshot.db"), new Uint8Array(await response.arrayBuffer()));
    const snapshot = new Database(join(directory, "snapshot.db"), { readonly: true });
    try {
      expect(snapshot.query("SELECT * FROM items").all()).toEqual([{ id: "latest", amount: 7 }]);
      expect(snapshot.query("PRAGMA integrity_check").get()).toEqual({ integrity_check: "ok" });
    } finally {
      snapshot.close();
    }
  } finally {
    source.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("removes temporary snapshots even when the backup fails", () => {
  const before = readdirSync(tmpdir()).filter(name => name.startsWith("knowingre-backup-"));
  const source = new Database(":memory:");
  try {
    source.exec("CREATE TABLE items (id INTEGER); BEGIN");
    expect(() => databaseBackup(source)).toThrow();
    expect(readdirSync(tmpdir()).filter(name => name.startsWith("knowingre-backup-"))).toEqual(before);
  } finally {
    source.close();
  }
});
