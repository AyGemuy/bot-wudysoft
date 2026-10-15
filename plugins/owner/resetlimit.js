import db from "../../data/db.js";
export default {
  name: "resetlimit",
  aliases: ["resetlmt", "resetallimit"],
  description: "Reset limit semua user (Owner)",
  category: "Owner",
  owner: true,
  execute: async (sock, ctx, msg) => {
    try {
      const defaultLimit = global.bot?.defaultLimit || 20;
      const count = db.resetAllLimits(defaultLimit);
      db.write(global.db);
      ctx.reply(`✅ *Reset Limit Berhasil*\n\n` + `👥 Total user direset: *${count}*\n` + `💳 Limit default: *${defaultLimit}*\n\n` + `ℹ️ User owner & premium tidak terpengaruh.`);
    } catch (e) {
      ctx.reply(`❌ Error: ${e.message}`);
    }
  }
};