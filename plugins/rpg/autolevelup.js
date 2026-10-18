import db from "../../data/db.js";
export default {
  name: "autolevelup",
  aliases: ["autolvl", "autolevel"],
  description: "Aktifkan atau nonaktifkan pengiriman kartu gambar canvas saat pemain naik level",
  category: "Group",
  admin: true,
  group: true,
  example: ".autolevelup on / .autolevelup off",
  execute: async (sock, ctx, msg) => {
    const opt = (ctx.args[0] || "").toLowerCase();
    const prefix = ctx.prefix || ".";
    const senderNum = (ctx.sender || "").split("@")[0];
    if (!["on", "off", "enable", "disable", "1", "0"].includes(opt)) {
      const isAuto = global.db?.group?.[ctx.chat]?.autolevelup !== false;
      const guideText = `Hi @${senderNum}!
Pengaturan notifikasi kartu gambar evolusi RPG saat anggota grup naik level.

–  *A U T O  L E V E L U P*

┌  ◦  *Status* : ${isAuto ? "Enabled" : "Disabled"}
│  ◦  *Enable* : ${prefix}autolevelup on
└  ◦  *Disable* : ${prefix}autolevelup off`;
      return ctx.reply(guideText, {
        mentions: [ctx.sender]
      });
    }
    const isEnable = ["on", "enable", "1"].includes(opt);
    global.db.group = global.db.group || {};
    global.db.group[ctx.chat] = global.db.group[ctx.chat] || {};
    global.db.group[ctx.chat].autolevelup = isEnable;
    if (typeof db?.write === "function") {
      db.write(global.db);
    }
    await ctx.react(isEnable ? "✅" : "❌");
    const groupName = ctx.groupMetadata?.subject || "Grup ini";
    const successText = `–  *A U T O  L E V E L U P*

Notifikasi gambar level up berhasil ${isEnable ? "diaktifkan" : "dinonaktifkan"}.

┌  ◦  *Status* : ${isEnable ? "Enabled" : "Disabled"}
└  ◦  *Target* : ${groupName}`;
    await ctx.reply(successText);
  }
};