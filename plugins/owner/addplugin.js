import fs from "fs";
import path from "path";
export default {
  name: "addplugin",
  aliases: ["addcommand", "tambahplugin"],
  description: "Menambahkan plugin baru",
  category: "Owner",
  owner: true,
  execute: async (sock, ctx, msg) => {
    try {
      const code = ctx.quoted?.text || "";
      if (!code) return ctx.reply("❌ Balas pesan yang berisi kode plugin.");
      const name = ctx.query;
      if (!name) return ctx.reply("❌ Nama plugin tidak ada.");
      const filename = name.endsWith(".js") ? name : `${name.replace(/\s+/g, "_").toLowerCase()}.js`;
      const dir = path.join(process.cwd(), "plugins");
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, {
        recursive: true
      });
      fs.writeFileSync(path.join(dir, filename), code, "utf8");
      ctx.reply(`✅ Plugin *${filename}* berhasil disimpan.`);
    } catch (e) {
      ctx.reply(`❌ Error: ${e.message}`);
    }
  }
};