import {
  simpleQuoted
} from "../../lib/quoted.js";
import {
  to8DAudio
} from "../../lib/audio.js";
export default {
  name: "8d",
  aliases: ["8daudio", "8kaudio", "audio8d", "audio8k", "apulsator"],
  description: "Ubah audio atau video menjadi efek 8D Audio Surround Stereo (Gunakan Headset/Earphone).",
  category: "Tools",
  limit: true,
  example: "Reply audio / vn / video dengan .8d",
  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "WudysoftBot";
    const footer = global.footer || global.bot?.footer || `_${botName}_`;
    const targetJid = ctx.chat || ctx.id;
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
    try {
      const isMedia = ctx.mediaType === "video" || ctx.mediaType === "audio" || ctx.quoted?.mediaType === "video" || ctx.quoted?.mediaType === "audio" || (ctx.mimetype || ctx.quoted?.mimetype || "").match(/(video|audio)/);
      if (!isMedia) {
        const helpText = `– *8 D  A U D I O*\n\n` + `┌ ◦ *Usage* : ${prefix}8d\n` + `│ ◦ *Quoted* : Balas audio, VN, atau video dengan ${prefix}8d\n` + `└ ◦ *Function* : Memberikan efek 8D Surround Stereo (Gunakan Headset)\n\n` + `${footer}`;
        return ctx.reply(helpText);
      }
      await ctx.react("⏳");
      const buffer = await ctx.download();
      if (!buffer) {
        await ctx.react("❌");
        return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Gagal mengunduh media\n` + `└ ◦ *Info* : Berkas media tidak dapat diproses dari WhatsApp.\n\n` + `${footer}`);
      }
      const eightDBuffer = await to8DAudio(buffer);
      await sock.sendMessage(targetJid, {
        audio: eightDBuffer,
        mimetype: "audio/mpeg",
        fileName: `8D_Audio_${Date.now()}.mp3`,
        ptt: false
      }, {
        quoted: quotedMsg
      });
      await ctx.react("🎧");
    } catch (error) {
      console.error("[8D Audio Error]:", error);
      await ctx.react("❌");
      ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : ${error?.message || error}\n` + `└ ◦ *Command* : ${ctx.command || "8d"}\n\n` + `${footer}`);
    }
  }
};