import type { Database } from "bun:sqlite";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// VACUUM INTO produces a standalone snapshot, including committed WAL data.
// Read it before removing the private temporary directory so aborted downloads
// and failed requests cannot leave database copies on the server.
export function databaseBackup(db: Database): Response {
  const directory = mkdtempSync(join(tmpdir(), "knowingre-backup-"));
  try {
    const path = join(directory, "backup.db");
    db.query("VACUUM INTO ?").run(path);
    const bytes = readFileSync(path);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    return new Response(bytes, {
      headers: {
        "Content-Type": "application/vnd.sqlite3",
        "Content-Disposition": `attachment; filename="knowingre-${timestamp}.db"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
