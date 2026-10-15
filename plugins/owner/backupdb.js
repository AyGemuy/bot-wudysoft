import fs from "fs";
import path from "path";
import {
  createReadStream
} from "fs";
import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "backupdb",
  aliases: ["backupdatabase", "dbbackup"],
  description: "Backup database bot",
  category: "Owner",
  owner: true,
  execute: async (sock, ctx, msg) => {
    try {
      const dbPath = path.join(process.cwd(), "data/database.json");
      if (!fs.existsSync(dbPath)) return ctx.reply("❌ Database tidak ditemukan.");
      const dbData = JSON.parse(fs.readFileSync(dbPath, "utf8"));
      const users = Object.keys(dbData.user || {}).length;
      const groups = Object.keys(dbData.group || {}).length;
      const timestamp = Date.now();
      const backupDir = path.join(process.cwd(), "tmp/other");
      fs.mkdirSync(backupDir, {
        recursive: true
      });
      const backupPath = path.join(backupDir, `db-${timestamp}.json`);
      fs.writeFileSync(backupPath, JSON.stringify(dbData, null, 2));
      const chunks = [];
      for await (const chunk of createReadStream(backupPath)) chunks.push(chunk);
      await sock.sendMessage(ctx.id, {
        document: Buffer.concat(chunks),
        fileName: `database-${timestamp}.json`,
        mimetype: "application/json",
        caption: `📊 *Database Backup*\n👤 Users: ${users}\n🏠 Groups: ${groups}`
      }, {
        quoted: simpleQuoted(ctx)
      });
      ctx.react("✅");
      fs.unlinkSync(backupPath);
    } catch (e) {
      ctx.reply(`❌ Error: ${e.message}`);
    }
  }
};