import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "clothoff",
  aliases: ["undress", "clothai", "removeclothes"],
  description: "AI Clothoff Image Processing",
  category: "AI",
  limit: true,
  example: "Reply/kirim gambar dengan caption `clothoff`",
  execute: async (sock, ctx, msg) => {
    try {
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      if (!isMedia) {
        return ctx.reply(`🔞 *CLOTHOFF AI IMAGE PROCESSOR*\n\n` + `Harap kirim atau balas (reply) foto orang yang ingin diproses!\n\n` + `👉 *Cara Penggunaan:*\n` + `Balas gambar dengan: \`${ctx.prefix || "."}clothoff\``);
      }
      await ctx.react("⏳");
      const buffer = await ctx.download();
      if (!buffer || !Buffer.isBuffer(buffer)) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal mengunduh gambar dari pesan.");
      }
      const uploadRes = await upload(buffer);
      if (!uploadRes?.status || !uploadRes?.url) {
        await ctx.react("❌");
        return ctx.reply(`❌ Gagal mengunggah gambar: ${uploadRes?.message || "Server upload error"}`);
      }
      const response = await axios.post(`${global.bot?.api?.wudysoft}/api/ai/clothoff`, {
        image: uploadRes.url
      }, {
        responseType: "arraybuffer",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 12e4
      });
      const imageBuffer = Buffer.from(response.data);
      if (imageBuffer.length < 500) {
        try {
          const parsed = JSON.parse(imageBuffer.toString("utf-8"));
          if (parsed && (!parsed.status || parsed.error || parsed.message)) {
            await ctx.react("❌");
            return ctx.reply(`❌ Gagal: ${parsed.message || parsed.error || "Proses dibatalkan oleh server."}`);
          }
        } catch {}
      }
      if (!imageBuffer || imageBuffer.length === 0) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal memproses gambar dari server.");
      }
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const caption = `✅ *Clothoff AI Selesai*`;
      await sock.sendMessage(ctx.id, {
        image: imageBuffer,
        caption: caption.trim()
      }, {
        quoted: quotedMsg
      });
      await ctx.react("✅");
    } catch (error) {
      await ctx.react("❌");
      let errorMessage = error.message;
      if (error.response?.data) {
        try {
          const parsed = JSON.parse(Buffer.from(error.response.data).toString("utf-8"));
          errorMessage = parsed.message || parsed.error || errorMessage;
        } catch {}
      }
      ctx.reply(`❌ Clothoff Error: ${errorMessage}`);
    }
  }
};