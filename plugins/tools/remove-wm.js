import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/tools/remove-wm/v2`;
export default {
  name: "removewm",
  aliases: ["nowm", "rmwm", "hapuswm", "watermarkremove"],
  description: "Menghapus watermark pada gambar menggunakan AI (POST API)",
  category: "Tools",
  limit: true,
  example: "reply gambar atau kirim link gambar",
  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "WudysoftBot";
    const footer = global.footer || global.bot?.footer || `_${botName}_`;
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
    try {
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      const text = (ctx.query || ctx.text || "").trim();
      let imageUrlInput = "";
      if (text.startsWith("http://") || text.startsWith("https://")) {
        imageUrlInput = text;
      } else if (isMedia) {
        await ctx.react("⏳");
        const buffer = await ctx.download();
        if (!buffer || !Buffer.isBuffer(buffer)) {
          await ctx.react("❌");
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Gagal mengunduh gambar\n` + `└ ◦ *Info* : Berkas media tidak dapat diproses dari WhatsApp.\n\n` + `${footer}`);
        }
        const uploadRes = await upload(buffer);
        if (!uploadRes?.status || !uploadRes?.url) {
          await ctx.react("❌");
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Gagal mengunggah gambar\n` + `└ ◦ *Info* : ${uploadRes?.message || "Server upload error"}\n\n` + `${footer}`);
        }
        imageUrlInput = uploadRes.url;
      } else {
        const helpText = `– *R E M O V E  W M*\n\n` + `┌ ◦ *Usage* : ${prefix}removewm <url>\n` + `│ ◦ *Quoted* : Balas atau kirim gambar dengan ${prefix}removewm\n` + `└ ◦ *Function* : Menghapus watermark pada gambar menggunakan AI\n\n` + `${footer}`;
        return ctx.reply(helpText);
      }
      await ctx.react("⏳");
      const {
        data
      } = await axios.post(API_URL, {
        imageUrl: imageUrlInput
      }, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 6e4
      });
      const resultImageUrl = typeof data?.result === "string" ? data.result : data?.result?.url || data?.result?.imageUrl || data?.imageUrl;
      if (!resultImageUrl) {
        throw new Error(data?.message || "Gambar hasil watermark removal tidak ditemukan.");
      }
      const caption = `– *R E M O V E  W M*\n\n` + `┌ ◦ *Engine* : AI Watermark Remover v2\n` + `└ ◦ *Status* : Berhasil dibersihkan\n\n` + `${footer}`;
      await sock.sendMessage(ctx.id, {
        image: {
          url: resultImageUrl
        },
        caption: caption
      }, {
        quoted: quotedMsg
      });
      await ctx.react("✅");
    } catch (error) {
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : ${errMsg}\n` + `└ ◦ *Command* : ${ctx.command || "removewm"}\n\n` + `${footer}`);
    }
  }
};