import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/tools/scanqr/v2`;
export default {
  name: "scanqr",
  aliases: ["qrscan", "readqr", "barcodescan", "scanbarcode"],
  description: "Membaca dan memindai isi kode QR atau Barcode dari gambar",
  category: "Tools",
  limit: true,
  example: "reply gambar QR atau kirim link gambar QR",
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
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Gagal mengunduh gambar\n` + `└ ◦ *Info* : File media tidak dapat diproses dari WhatsApp.\n\n` + `${footer}`);
        }
        const uploadRes = await upload(buffer);
        if (!uploadRes?.status || !uploadRes?.url) {
          await ctx.react("❌");
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Gagal mengunggah gambar\n` + `└ ◦ *Info* : ${uploadRes?.message || "Server upload error"}\n\n` + `${footer}`);
        }
        imageUrlInput = uploadRes.url;
      } else {
        const helpText = `– *S C A N  Q R*\n\n` + `┌ ◦ *Usage* : ${prefix}scanqr <url>\n` + `│ ◦ *Quoted* : Balas atau kirim gambar QR/Barcode dengan ${prefix}scanqr\n` + `└ ◦ *Function* : Membaca dan memindai isi kode QR atau Barcode\n\n` + `${footer}`;
        return ctx.reply(helpText);
      }
      await ctx.react("⏳");
      const {
        data
      } = await axios.post(API_URL, {
        url: imageUrlInput
      }, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 3e4
      });
      const scanResult = data?.result;
      if (!scanResult || !scanResult.raw && !scanResult.parsed) {
        await ctx.react("❌");
        return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Kode QR tidak terdeteksi\n` + `└ ◦ *Detail* : Pastikan gambar kode QR / Barcode terlihat jelas.\n\n` + `${footer}`);
      }
      const parsedText = scanResult.parsed || scanResult.raw || "-";
      const format = scanResult.format || "QR_CODE";
      const type = scanResult.result || "TEXT";
      const resultText = `– *S C A N  Q R*\n\n` + `┌ ◦ *Format* : ${format}\n` + `└ ◦ *Type* : ${type}\n\n` + `\`\`\`\n${parsedText}\n\`\`\`\n\n` + `${footer}`;
      await sock.sendMessage(ctx.id, {
        text: resultText
      }, {
        quoted: quotedMsg
      });
      await ctx.react("✅");
    } catch (error) {
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : ${errMsg}\n` + `└ ◦ *Command* : ${ctx.command || "scanqr"}\n\n` + `${footer}`);
    }
  }
};