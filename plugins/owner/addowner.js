import {
  simpleQuoted
} from "../../lib/quoted.js";
import {
  makeJid,
  ensureUser
} from "../../core/tools.js";
import db from "../../data/db.js";
export default {
  name: "addowner",
  aliases: ["tambahowner"],
  description: "Menambahkan nomor ke daftar owner",
  category: "Owner",
  owner: true,
  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
    try {
      const raw = ctx.args[0]?.replace(/\D/g, "") || "";
      const jid = raw ? makeJid(raw) : ctx.quoted?.sender;
      if (!jid) {
        return ctx.reply(`–  *A D D  O W N E R*

Silakan tentukan nomor target atau reply pesan pengguna yang ingin dijadikan owner.

┌  ◦  *Format* : ${prefix}addowner <nomor>
└  ◦  *Example* : ${prefix}addowner 6281234567890`);
      }
      if (typeof ctx.react === "function") await ctx.react("⏳");
      const noJid = jid.split("@")[0];
      ensureUser(jid, noJid);
      if (!global.db.user[jid]) global.db.user[jid] = {};
      global.db.user[jid].ownerAcces = true;
      if (!global.bot.owner) global.bot.owner = [];
      if (!global.bot.owner.includes(noJid)) {
        global.bot.owner.push(noJid);
      }
      if (typeof db.write === "function") {
        db.write(global.db);
      }
      const successText = `–  *A D D  O W N E R*

┌  ◦  *Status* : Sukses
│  ◦  *Target* : @${noJid}
└  ◦  *Akses* : Owner Level Granted

Nomor tersebut telah berhasil diberikan hak akses penuh sebagai owner bot.`;
      await sock.sendMessage(ctx.id, {
        text: successText,
        mentions: [jid]
      }, {
        quoted: quotedMsg
      });
      if (typeof ctx.react === "function") await ctx.react("✅");
    } catch (e) {
      if (typeof ctx.react === "function") await ctx.react("❌");
      ctx.reply(`❌ Error: ${e.message}`);
    }
  }
};