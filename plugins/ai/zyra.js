import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const CONFIG = {
  TIMEOUT: 6e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};
export default {
  name: "zyra",
  aliases: ["zyraai", "geminizyra"],
  description: "AI Chat Assistant & Vision menggunakan Zyra Engine (Gemini 2.5 Flash).",
  category: "AI",
  limit: true,
  example: "• Chat: zyra jelaskan teori relativitas secara singkat\n• Vision: Reply gambar dengan caption zyra gambar apa ini?",
  execute: async (sock, ctx, msg) => {
    try {
      let text = ctx.args?.join(" ")?.trim() || "";
      if (!text && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["zyra", "zyraai", "geminizyra"].some(alias => firstWord.endsWith(alias))) {
          text = raw.slice(firstWord.length).trim();
        }
      }
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (!text && !isMedia) {
        const guideText = `–  *Z Y R A  A I*

Layanan asisten cerdas multimodal bertenaga Gemini 2.5 Flash untuk percakapan teks dan analisis visual foto.

┌  ◦  *Mode Percakapan (Teks)* :
│  └ \`${prefix}zyra buatkan puisi tentang senja\`
│
└  ◦  *Mode Vision (Analisis Foto)* :
   └ Reply / kirim gambar: \`${prefix}zyra jelaskan isi gambar ini secara detail\``;
        return ctx.reply(guideText, {
          quoted: quotedMsg
        });
      }
      await ctx.react("💭");
      let mediaUrl = null;
      if (isMedia) {
        const buffer = await ctx.download();
        if (buffer && Buffer.isBuffer(buffer)) {
          const uploadRes = await upload(buffer);
          if (uploadRes?.status && uploadRes?.url) {
            mediaUrl = uploadRes.url;
          } else {
            await ctx.react("❌");
            return ctx.reply(`❌ Gagal mengunggah gambar: ${uploadRes?.message || "Server upload error"}`);
          }
        }
      }
      const body = {
        prompt: text || (mediaUrl ? "Jelaskan gambar ini secara detail dan mendalam" : "Halo!"),
        messages: [],
        media: mediaUrl
      };
      const {
        data
      } = await axios.post(`${global.bot?.api?.wudysoft}/api/ai/zyra`, body, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": CONFIG.USER_AGENT
        },
        timeout: CONFIG.TIMEOUT
      });
      if (!data || !data.status) {
        throw new Error(data?.message || "Gagal mendapatkan respon dari Zyra AI.");
      }
      const answerText = data.result || data.chunks?.[0]?.candidates?.[0]?.content?.parts?.[0]?.text || "Tidak ada respon yang diterima.";
      const responseText = `–  *Z Y R A  A I*

${answerText.trim()}`;
      await sock.sendMessage(ctx.id, {
        text: responseText
      }, {
        quoted: quotedMsg
      });
      await ctx.react("✨");
    } catch (error) {
      console.error("[Zyra AI Error]:", error?.message || error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Terjadi kendala pada Zyra AI: ${errMsg}`);
    }
  }
};