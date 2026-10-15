import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "remini",
  aliases: ["reminiai", "unblur"],
  description: "Meningkatkan kualitas foto menjadi jernih dan tajam via Remini AI",
  category: "Maker",
  limit: true,
  example: "reply gambar dengan .remini",
  execute: async (sock, ctx, msg) => {
    try {
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (!isMedia) {
        return ctx.reply(`🖼️ *IMAGE ENHANCER / REMINI*\n\n` + `👉 Balas/kirim gambar dengan caption: *${ctx.prefix || "."}remini*`);
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
      const {
        data
      } = await axios.get("https://api.termai.cc/api/tools/remini", {
        params: {
          url: imageUrlInput,
          key: global.api?.termaiKey || "Bell409"
        },
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 6e4
      });
      if (!data?.status || !data?.data?.url) {
        throw new Error(data?.message || "Gagal memproses peningkatan kualitas gambar.");
      }
      const resultUrl = data.data.url;
      await sock.sendMessage(ctx.id, {
        image: {
          url: resultUrl
        },
        caption: "✨ *Remini AI Selesai*\n_Kualitas gambar berhasil ditingkatkan!_"
      }, {
        quoted: quotedMsg
      });
      await ctx.react("✅");
    } catch (error) {
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Remini Error: ${errMsg}`);
    }
  }
};