// Reset a user's password
// Usage: bun run reset-password.ts <username> <new-password>
import { Database } from "bun:sqlite";

const db = new Database("data.db");

const username = Bun.argv[2];
const newPassword = Bun.argv[3];

if (!username || !newPassword) {
  console.log("用法: bun run reset-password.ts <用户名> <新密码>");
  process.exit(1);
}

const user = db.query("SELECT id FROM users WHERE username = ?").get(username);
if (!user) {
  console.log(`用户 "${username}" 不存在`);
  process.exit(1);
}

const hash = await Bun.password.hash(newPassword);
db.query("UPDATE users SET password_hash = ? WHERE username = ?").run(hash, username);
console.log(`✅ 用户 "${username}" 密码已重置`);
