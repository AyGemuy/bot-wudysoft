import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/tools/ocr/v7`;
export default {
  name: "ocr",
  aliases: ["imagetotext", "scantext", "textfromimage", "readtext"],
  description: "Mengekstrak dan membaca teks dari gambar menggunakan AI OCR",
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
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Gagal mengunduh gambar\n` + `└ ◦ *Info* : File media tidak dapat diproses dari pesan WhatsApp.\n\n` + `${footer}`);
        }
        const uploadRes = await upload(buffer);
        if (!uploadRes?.status || !uploadRes?.url) {
          await ctx.react("❌");
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Gagal mengunggah gambar\n` + `└ ◦ *Info* : ${uploadRes?.message || "Server upload error"}\n\n` + `${footer}`);
        }
        imageUrlInput = uploadRes.url;
      } else {
        const helpText = `– *O C R*\n\n` + `┌ ◦ *Usage* : ${prefix}ocr <url>\n` + `│ ◦ *Quoted* : Balas/kirim gambar dengan caption ${prefix}ocr\n` + `└ ◦ *Function* : Mengekstrak teks dari gambar (Image to Text)\n\n` + `${footer}`;
        return ctx.reply(helpText);
      }
      await ctx.react("⏳");
      const {
        data
      } = await axios.post(API_URL, {
        image: imageUrlInput
      }, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 6e4
      });
      const extractedText = data?.value || data?.paragraphs?.map(p => p.content).filter(Boolean).join("\n") || "";
      if (!extractedText.trim()) {
        await ctx.react("❌");
        return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Tidak ada teks terdeteksi\n` + `└ ◦ *Detail* : Pastikan gambar memiliki teks yang jelas dan terbaca.\n\n` + `${footer}`);
      }
      const duration = data?.duration || "-";
      const totalParagraphs = data?.paragraphs?.length || 0;
      const resultMessage = `– *O C R*\n\n` + `┌ ◦ *Duration* : ${duration}\n` + `└ ◦ *Paragraphs* : ${totalParagraphs}\n\n` + `\`\`\`\n${extractedText.trim()}\n\`\`\`\n\n` + `${footer}`;
      await sock.sendMessage(ctx.id, {
        text: resultMessage
      }, {
        quoted: quotedMsg
      });
      await ctx.react("✅");
    } catch (error) {
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : ${errMsg}\n` + `└ ◦ *Command* : ${ctx.command || "ocr"}\n\n` + `${footer}`);
    }
  }
};