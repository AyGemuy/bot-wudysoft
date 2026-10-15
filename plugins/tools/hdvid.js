import {
  simpleQuoted
} from "../../lib/quoted.js";
import {
  enhanceHDVideo
} from "../../lib/video.js";
export default {
  name: "hdvid",
  aliases: ["hdvideo", "vidhd", "enhancevid", "jernihkanvideo"],
  description: "Tingkatkan kualitas & kejernihan video menjadi Ultra HD via filter AI Denoise & Enhancer.",
  category: "Tools",
  limit: true,
  example: "Kirim / reply video dengan .hdvid",
  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "WudysoftBot";
    const footer = global.footer || global.bot?.footer || `_${botName}_`;
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
    const targetJid = ctx.chat || ctx.id;
    try {
      const mediaType = ctx.mediaType || ctx.quoted?.mediaType || "";
      const mimetype = (ctx.mimetype || ctx.quoted?.mimetype || "").toLowerCase();
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      const isVideo = mediaType === "video" || mimetype.startsWith("video/") || mimetype.includes("mp4") || mimetype.includes("mkv");
      if (!isMedia || !isVideo) {
        const helpText = `– *H D  V I D*\n\n` + `┌ ◦ *Usage* : ${prefix}hdvid\n` + `│ ◦ *Quoted* : Kirim atau balas video dengan ${prefix}hdvid\n` + `└ ◦ *Function* : Menjernihkan resolusi video menggunakan filter AI Denoise & Enhancer\n\n` + `${footer}`;
        return ctx.reply(helpText);
      }
      await ctx.react("⏳");
      await ctx.reply(`– *P R O C E S S*\n\n` + `┌ ◦ *Status* : Memproses peningkatan resolusi video\n` + `└ ◦ *Info* : Membutuhkan waktu beberapa saat tergantung durasi video.\n\n` + `${footer}`);
      const rawBuffer = await ctx.download();
      if (!rawBuffer || !Buffer.isBuffer(rawBuffer)) {
        await ctx.react("❌");
        return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Gagal mengunduh video\n` + `└ ◦ *Info* : File media tidak dapat diproses dari pesan WhatsApp.\n\n` + `${footer}`);
      }
      const hdBuffer = await enhanceHDVideo(rawBuffer);
      const caption = `– *H D  V I D*\n\n` + `┌ ◦ *Filter* : hqdn3d + nlmeans + deband + unsharp\n` + `│ ◦ *Codec* : libx264 (CRF 18 / Ultra HD)\n` + `└ ◦ *Color* : Enhanced Contrast & Saturation\n\n` + `${footer}`;
      await sock.sendMessage(targetJid, {
        video: hdBuffer,
        mimetype: "video/mp4",
        caption: caption
      }, {
        quoted: quotedMsg
      });
      await ctx.react("✅");
    } catch (error) {
      console.error("[HDVID Error]:", error);
      await ctx.react("❌");
      ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : ${error?.message || error}\n` + `└ ◦ *Command* : ${ctx.command || "hdvid"}\n\n` + `${footer}`);
    }
  }
};