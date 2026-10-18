import {
  simpleQuoted
} from "../../lib/quoted.js";
import {
  sendPTT
} from "../../lib/audio.js";
export default {
  name: "tovn",
  aliases: ["toptt", "voicenote", "tovoice", "ptt"],
  description: "Ubah video atau audio biasa menjadi Voice Note (PTT) WhatsApp.",
  category: "Tools",
  example: "Reply video / audio dengan .tovn",
  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "WudysoftBot";
    const footer = global.footer || global.bot?.footer || `_${botName}_`;
    const targetJid = ctx.chat || ctx.id;
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
    try {
      const isMedia = ctx.mediaType === "video" || ctx.mediaType === "audio" || ctx.quoted?.mediaType === "video" || ctx.quoted?.mediaType === "audio" || (ctx.mimetype || ctx.quoted?.mimetype || "").match(/(video|audio)/);
      if (!isMedia) {
        const helpText = `– *T O  V N*\n\n` + `┌ ◦ *Usage* : ${prefix}tovn\n` + `│ ◦ *Quoted* : Balas berkas audio atau video dengan ${prefix}tovn\n` + `└ ◦ *Function* : Mengubah audio atau video menjadi Voice Note (PTT)\n\n` + `${footer}`;
        return ctx.reply(helpText);
      }
      await ctx.react("⏳");
      const buffer = await ctx.download();
      if (!buffer) {
        await ctx.react("❌");
        return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Gagal mengunduh media\n` + `└ ◦ *Info* : Berkas media tidak dapat diproses dari WhatsApp.\n\n` + `${footer}`);
      }
      await sendPTT(sock, targetJid, buffer, quotedMsg);
      await ctx.react("✅");
    } catch (error) {
      console.error("[tovn Error]:", error?.message || error);
      await ctx.react("❌");
      ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : ${error?.message || error}\n` + `└ ◦ *Command* : ${ctx.command || "tovn"}\n\n` + `${footer}`);
    }
  }
};