import fs from "fs";
import path from "path";
export default {
  name: "saveplugin",
  aliases: ["savecommand", "sp", "updateplugin"],
  description: "Memperbarui kode plugin",
  category: "Owner",
  owner: true,
  execute: async (sock, ctx, msg) => {
    try {
      const code = ctx.quoted?.text || "";
      if (!code) return ctx.reply("❌ Balas pesan yang berisi kode plugin baru.");
      const name = ctx.args[0];
      if (!name) return ctx.reply("❌ Nama plugin tidak ada.");
      const filename = name.endsWith(".js") ? name : `${name.toLowerCase()}.js`;
      const target = path.join(process.cwd(), "plugins", filename);
      if (!fs.existsSync(target)) return ctx.reply(`❌ Plugin *${filename}* tidak ditemukan.`);
      fs.writeFileSync(target, code, "utf8");
      ctx.reply(`📝 Plugin *${filename}* berhasil diperbarui.`);
    } catch (e) {
      ctx.reply(`❌ Error: ${e.message}`);
    }
  }
};