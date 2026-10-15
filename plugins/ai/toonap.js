import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_BASE = `${global.bot?.api?.wudysoft}/api/ai/toonap`;
const CONFIG = {
  TIMEOUT: 9e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};
export default {
  name: "toonap",
  aliases: ["toonme", "cartoon", "kartun", "toonapp"],
  description: "Ubah foto menjadi kartun/anime menggunakan ToonApp AI.",
  category: "AI",
  limit: true,
  example: "• Reply gambar: toonap --style cosplay-cartoon\n• Cek style: toonap --styles",
  execute: async (sock, ctx, msg) => {
    try {
      let text = ctx.args?.join(" ")?.trim() || "";
      if (!text && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["toonap", "toonme", "cartoon", "kartun", "toonapp"].some(alias => firstWord.endsWith(alias))) {
          text = raw.slice(firstWord.length).trim();
        }
      }
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (!text && !isMedia) {
        const guideText = `–  *T O O N  A P P  A I*

Layanan transformasi foto potret menjadi karakter kartun dan anime 2D/3D.

┌  ◦  *Ubah Foto ke Kartun* :
│  ├ Reply / kirim gambar: \`${prefix}toonap\`
│  └ Dengan style: \`${prefix}toonap --style cosplay-cartoon\`
│
└  ◦  *Daftar Style Tersedia* :
   └ \`${prefix}toonap --styles\``;
        return ctx.reply(guideText, {
          quoted: quotedMsg
        });
      }
      const lowerText = text.toLowerCase();
      if (lowerText.startsWith("styles") || lowerText.includes("--styles") || lowerText.includes("--style-list")) {
        await ctx.react("⏳");
        const {
          data
        } = await axios.post(API_BASE, {
          action: "styles"
        }, {
          headers: {
            "Content-Type": "application/json",
            "User-Agent": CONFIG.USER_AGENT
          },
          timeout: 3e4
        });
        if (!data || !data.status || !Array.isArray(data.result) || data.result.length === 0) {
          await ctx.react("❌");
          return ctx.reply("❌ Gagal mengambil daftar styles dari server.");
        }
        let styleList = `–  *T O O N  A P P  S T Y L E S*\n\n`;
        data.result.forEach((st, i) => {
          styleList += `┌  ◦  *${i + 1}. ${st.name || "Unknown"}*\n`;
          styleList += `└  ◦  *ID* : \`${st.id}\`\n\n`;
        });
        styleList += `Gunakan style dengan cara:\n\`${prefix}toonap --style <id_style>\``;
        await ctx.react("📋");
        return sock.sendMessage(ctx.id, {
          text: styleList.trim()
        }, {
          quoted: quotedMsg
        });
      }
      if (!isMedia) {
        return ctx.reply("❌ Harap kirim atau reply gambar yang ingin diubah menjadi kartun!");
      }
      await ctx.react("⏳");
      let style = "";
      if (text.includes("--style")) {
        const parts = text.split("--style");
        style = parts[1]?.trim().split(/\s+/)[0] || "";
      } else if (text) {
        style = text.split(/\s+/)[0].trim();
      }
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
      const body = {
        action: "generate",
        image: uploadRes.url
      };
      if (style) {
        body.style = style;
      }
      const {
        data
      } = await axios.post(API_BASE, body, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": CONFIG.USER_AGENT
        },
        timeout: CONFIG.TIMEOUT
      });
      const resObj = data?.result;
      const resultUrl = resObj?.url || (typeof resObj === "string" ? resObj : null);
      if (!data || !data.status || !resultUrl) {
        await ctx.react("❌");
        return ctx.reply(`❌ Gagal mengubah foto menjadi kartun: ${data?.message || "API tidak mengembalikan hasil."}`);
      }
      const usedStyle = resObj?.style || style || "Default";
      const correlationId = resObj?.correlation_id;
      const faceId = resObj?.face_id;
      let caption = `–  *T O O N  A P P  A I*

Transformasi kartun visual berhasil diselesaikan.

┌  ◦  *Style* : \`${usedStyle}\``;
      if (faceId) caption += `\n│  ◦  *Face ID* : \`${faceId}\``;
      if (correlationId) caption += `\n└  ◦  *Correlation ID* : \`${correlationId}\``;
      else caption += `\n└  ◦  *Status* : Selesai ✅`;
      await sock.sendMessage(ctx.id, {
        image: {
          url: resultUrl
        },
        caption: caption.trim()
      }, {
        quoted: quotedMsg
      });
      await ctx.react("✅");
    } catch (error) {
      console.error("[ToonApp Error]:", error?.message || error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Terjadi kendala pada ToonApp: ${errMsg}`);
    }
  }
};