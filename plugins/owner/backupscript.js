import fs from "fs";
import path from "path";
import {
  exec
} from "child_process";
import util from "util";
import {
  createReadStream
} from "fs";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const execAsync = util.promisify(exec);
export default {
  name: "backupscript",
  aliases: ["backup", "scriptbackup"],
  description: "Backup semua file script bot",
  category: "Owner",
  owner: true,
  execute: async (sock, ctx, msg) => {
    try {
      const root = process.cwd();
      const timestamp = Date.now();
      const backupDir = path.join(root, "tmp");
      fs.mkdirSync(backupDir, {
        recursive: true
      });
      const zipPath = path.join(backupDir, `script-${timestamp}.zip`);
      await ctx.reply("⏳ Membuat backup script...");
      await execAsync(`cd "${root}" && zip -r "${zipPath}" . -x "node_modules/*" "session/*" ".git/*" "tmp/*" "*.log"`);
      if (!fs.existsSync(zipPath)) return ctx.reply("❌ Backup gagal dibuat.");
      const chunks = [];
      for await (const chunk of createReadStream(zipPath)) chunks.push(chunk);
      await sock.sendMessage(ctx.id, {
        document: Buffer.concat(chunks),
        fileName: `script-${timestamp}.zip`,
        mimetype: "application/zip",
        caption: `📦 *Script Backup*\n⏰ ${new Date(timestamp).toLocaleString("id-ID")}`
      }, {
        quoted: simpleQuoted(ctx)
      });
      ctx.react("✅");
      fs.unlinkSync(zipPath);
    } catch (e) {
      ctx.reply(`❌ Error: ${e.message}`);
    }
  }
};