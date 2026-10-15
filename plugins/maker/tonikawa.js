import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "tonikawa",
  aliases: ["tonikawaframe", "tonikawamaker"],
  description: "Membuat gambar dengan frame anime Tonikawa",
  category: "Maker",
  limit: true,
  execute: async (sock, ctx, msg) => {
    try {
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      if (!isMedia) {
        return ctx.reply(`🌸 *TONIKAWA FRAME MAKER*\n\n` + `👉 Balas/kirim gambar dengan caption: *${ctx.prefix || "."}tonikawa*`);
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
      const response = await axios.get("https://some-random-api.com/canvas/misc/tonikawa", {
        params: {
          avatar: imageUrlInput
        },
        responseType: "arraybuffer",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 6e4
      });
      if (!response.data) {
        throw new Error("Gagal menerima hasil render frame Tonikawa.");
      }
      await sock.sendMessage(ctx.id, {
        image: Buffer.from(response.data),
        caption: "🌸 *Tonikawa Frame Selesai*\n_Gambar berhasil dibingkai!_"
      }, {
        quoted: simpleQuoted(ctx)
      });
      await ctx.react("✅");
    } catch (error) {
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Tonikawa Maker Error: ${errMsg}`);
    }
  }
};