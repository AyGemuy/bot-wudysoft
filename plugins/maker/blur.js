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
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (!isMedia) {
        return ctx.reply(`–  *B L U R  E F F E C T*

Silakan kirim atau balas gambar yang ingin diberi efek blur.

┌  ◦  *Cara Pakai* : Reply/kirim foto
└  ◦  *Command* : \`${prefix}blur\``);
      }
      ctx.react?.("⏳");
      const buffer = await ctx.download().catch(() => null);
      if (!buffer || !Buffer.isBuffer(buffer)) {
        ctx.react?.("❌");
        return ctx.reply("❌ Gagal mengunduh gambar dari pesan.");
      }
      const uploadRes = await upload(buffer);
      if (!uploadRes?.status || !uploadRes?.url) {
        ctx.react?.("❌");
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
      const captionText = `–  *B L U R  E F F E C T*

┌  ◦  *Status* : Sukses
└  ◦  *Proses* : Selesai`;
      await sock.sendMessage(ctx.id, {
        image: Buffer.from(response.data),
        caption: captionText
      }, {
        quoted: quotedMsg
      });
      ctx.react?.("✅");
    } catch (error) {
      ctx.react?.("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Blur Effect Error: ${errMsg}`);
    }
  }
};