import {
  simpleQuoted
} from "../../lib/quoted.js";
import {
  isAnimatedWebp,
  webpToPNG,
  webpToMP4
} from "../../lib/media.js";
export default {
  name: "toimg",
  aliases: ["sticker2media", "stikertoimg", "tovid", "tovideo", "tomp4", "togif", "stikertogif"],
  description: "Ubah stiker menjadi gambar PNG (statis), video MP4, atau animasi GIF WhatsApp.",
  category: "Tools",
  example: "Reply stiker dengan .toimg, .tovid, atau .togif",
  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "WudysoftBot";
    const footer = global.footer || global.bot?.footer || `_${botName}_`;
    const targetJid = ctx.chat || ctx.id;
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
    try {
      const isSticker = ctx.mediaType === "sticker" || ctx.quoted?.mediaType === "sticker" || (ctx.mimetype || ctx.quoted?.mimetype || "").includes("webp");
      if (!isSticker) {
        const helpText = `– *T O  I M G*\n\n` + `┌ ◦ *Usage* : ${prefix}toimg\n` + `│ ◦ *Quoted* : Balas stiker dengan ${prefix}toimg / ${prefix}tovid / ${prefix}togif\n` + `└ ◦ *Function* : Mengubah stiker menjadi gambar (PNG), video (MP4), atau GIF\n\n` + `${footer}`;
        return ctx.reply(helpText);
      }
      await ctx.react("⏳");
      const downloadFn = ctx.quoted?.download || ctx.download;
      const buffer = typeof downloadFn === "function" ? await downloadFn.call(ctx.quoted || ctx) : null;
      if (!buffer || !Buffer.isBuffer(buffer)) {
        await ctx.react("❌");
        return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Gagal mengunduh stiker\n` + `└ ◦ *Info* : Berkas stiker tidak dapat diproses dari WhatsApp.\n\n` + `${footer}`);
      }
      const cmd = (ctx.cmd || ctx.command || "").toLowerCase();
      const isForceImg = cmd === "toimg" || cmd === "stikertoimg";
      const isForceVid = cmd === "tovid" || cmd === "tovideo" || cmd === "tomp4";
      const isForceGif = cmd === "togif" || cmd === "stikertogif";
      const isAnim = isAnimatedWebp(buffer);
      if (isForceGif) {
        const videoResult = await webpToMP4(buffer);
        const videoPayload = Buffer.isBuffer(videoResult) ? {
          video: videoResult
        } : {
          video: {
            url: videoResult
          }
        };
        const caption = `– *T O  G I F*\n\n` + `┌ ◦ *Type* : Animated GIF\n` + `└ ◦ *Status* : Berhasil dikonversi\n\n` + `${footer}`;
        await sock.sendMessage(targetJid, {
          ...videoPayload,
          caption: caption,
          gifPlayback: true,
          gifAttribution: Math.floor(2 * Math.random()) + 1
        }, {
          quoted: quotedMsg
        });
      } else if (isForceVid || !isForceImg && isAnim) {
        const videoResult = await webpToMP4(buffer);
        const videoPayload = Buffer.isBuffer(videoResult) ? {
          video: videoResult
        } : {
          video: {
            url: videoResult
          }
        };
        const caption = `– *T O  V I D*\n\n` + `┌ ◦ *Type* : Video MP4\n` + `└ ◦ *Status* : Berhasil dikonversi\n\n` + `${footer}`;
        await sock.sendMessage(targetJid, {
          ...videoPayload,
          caption: caption,
          mimetype: "video/mp4"
        }, {
          quoted: quotedMsg
        });
      } else {
        const imageBuffer = await webpToPNG(buffer);
        const caption = `– *T O  I M G*\n\n` + `┌ ◦ *Type* : Image PNG\n` + `└ ◦ *Status* : Berhasil dikonversi\n\n` + `${footer}`;
        await sock.sendMessage(targetJid, {
          image: imageBuffer,
          caption: caption,
          mimetype: "image/png"
        }, {
          quoted: quotedMsg
        });
      }
      await ctx.react("✅");
    } catch (error) {
      console.error("[toimg Error]:", error);
      await ctx.react("❌");
      ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : ${error?.message || error}\n` + `└ ◦ *Command* : ${ctx.command || "toimg"}\n\n` + `${footer}`);
    }
  }
};