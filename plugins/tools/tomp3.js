import {
  simpleQuoted
} from "../../lib/quoted.js";
import {
  toMP3
} from "../../lib/audio.js";
export default {
  name: "tomp3",
  aliases: ["toaudio", "getaudio", "mp3"],
  description: "Ubah video atau voice note (PTT) menjadi file audio MP3 murni.",
  category: "Tools",
  example: "Reply video / vn / audio dengan .tomp3",
  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "WudysoftBot";
    const footer = global.footer || global.bot?.footer || `_${botName}_`;
    const targetJid = ctx.chat || ctx.id;
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
    try {
      const isMedia = ctx.mediaType === "video" || ctx.mediaType === "audio" || ctx.quoted?.mediaType === "video" || ctx.quoted?.mediaType === "audio" || (ctx.mimetype || ctx.quoted?.mimetype || "").match(/(video|audio)/);
      if (!isMedia) {
        const helpText = `– *T O  M P 3*\n\n` + `┌ ◦ *Usage* : ${prefix}tomp3\n` + `│ ◦ *Quoted* : Balas video atau voice note dengan ${prefix}tomp3\n` + `└ ◦ *Function* : Mengonversi media menjadi berkas audio MP3 murni\n\n` + `${footer}`;
        return ctx.reply(helpText);
      }
      await ctx.react("⏳");
      const buffer = await ctx.download();
      if (!buffer) {
        await ctx.react("❌");
        return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Gagal mengunduh media\n` + `└ ◦ *Info* : Berkas media tidak dapat diproses dari WhatsApp.\n\n` + `${footer}`);
      }
      const mp3Buffer = await toMP3(buffer);
      await sock.sendMessage(targetJid, {
        audio: mp3Buffer,
        mimetype: "audio/mpeg",
        fileName: `audio_${Date.now()}.mp3`,
        ptt: false
      }, {
        quoted: quotedMsg
      });
      await ctx.react("✅");
    } catch (error) {
      console.error("[tomp3 Error]:", error?.message || error);
      await ctx.react("❌");
      ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : ${error?.message || error}\n` + `└ ◦ *Command* : ${ctx.command || "tomp3"}\n\n` + `${footer}`);
    }
  }
};