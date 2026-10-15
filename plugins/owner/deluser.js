import {
  makeJid
} from "../../core/tools.js";
import db from "../../data/db.js";
export default {
  name: "deluser",
  aliases: ["deleteuser", "hapususer"],
  description: "Hapus user dari database",
  category: "Owner",
  owner: true,
  execute: async (sock, ctx, msg) => {
    try {
      if (!ctx.args.length) return ctx.reply(`⚡ Format: ${ctx.prefix}deluser [nomor]`);
      const jid = makeJid(ctx.args[0]);
      if (!global.db.user[jid]) return ctx.reply(`❌ User tidak ditemukan.`);
      delete global.db.user[jid];
      db.write(global.db);
      ctx.reply(`🗑️ *User Dihapus*\n👤 ${jid.split("@")[0]}`);
    } catch (e) {
      ctx.reply(`❌ Error: ${e.message}`);
    }
  }
};