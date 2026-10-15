import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "blur",
  aliases: ["makeblur", "blureffect"],
  description: "Memberikan efek blur pada gambar",
  category: "Maker",
  limit: true,
  execute: async (sock, ctx, msg) => {
    try {
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      if (!isMedia) {
        return ctx.reply(`🖼️ *BLUR EFFECT MAKER*\n\n` + `👉 Balas/kirim gambar dengan caption: *${ctx.prefix || "."}blur*`);
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
      const imageUrlInput = uploadRes.url;
      const response = await axios.get(`https://api.siputzx.my.id/api/canvas/blur?image=${encodeURIComponent(imageUrlInput)}`, {
        responseType: "arraybuffer",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 6e4
      });
      if (!response.data) {
        throw new Error("Gagal memproses efek blur pada gambar.");
      }
      await sock.sendMessage(ctx.id, {
        image: Buffer.from(response.data),
        caption: "✨ *Blur Effect Selesai*\n_Gambar berhasil diproses._"
      }, {
        quoted: simpleQuoted(ctx)
      });
      await ctx.react("✅");
    } catch (error) {
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Blur Effect Error: ${errMsg}`);
    }
  }
};