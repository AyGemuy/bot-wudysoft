import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const CONFIG = {
  TIMEOUT: 9e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};
export default {
  name: "ezimgeditor",
  aliases: ["ezimage", "ezedit", "ezai"],
  description: "AI Image Generator & Editor via EZ Image Editor (T2I & I2I).",
  category: "AI",
  limit: true,
  example: "• Text-to-Image: ezimgeditor a cute cat in the garden\n• Image-to-Image: Reply gambar dengan caption: ezimgeditor add sunglasses",
  execute: async (sock, ctx, msg) => {
    try {
      let text = ctx.args?.join(" ")?.trim() || "";
      if (!text && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["ezimgeditor", "ezimage", "ezedit", "ezai"].some(a => firstWord.endsWith(a))) {
          text = raw.slice(firstWord.length).trim();
        }
      }
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (!text && !isMedia) {
        const guideText = `–  *E Z  I M A G E  E D I T O R*

Layanan render visual instan untuk pembuatan gambar baru atau pengeditan foto yang sudah ada.

┌  ◦  *Text-to-Image (T2I)* :
│  └ \`${prefix}ezimgeditor a futuristic neon cyberpunk city\`
│
└  ◦  *Image-to-Image (I2I)* :
   └ Reply / kirim gambar: \`${prefix}ezimgeditor change hair color to red\``;
        return ctx.reply(guideText, {
          quoted: quotedMsg
        });
      }
      if (typeof ctx.react === "function") await ctx.react("⏳");
      let imageUrl = null;
      if (isMedia) {
        const buffer = await ctx.download();
        if (!buffer || !Buffer.isBuffer(buffer)) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply("❌ Gagal mengunduh gambar dari pesan.");
        }
        const uploadRes = await upload(buffer);
        if (!uploadRes?.status || !uploadRes?.url) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply(`❌ Gagal mengunggah gambar: ${uploadRes?.message || "Server upload error"}`);
        }
        imageUrl = uploadRes.url;
      }
      const finalPrompt = text || (imageUrl ? "enhance details, masterpiece, high quality" : "a cute cat");
      const body = {
        prompt: finalPrompt
      };
      if (imageUrl) {
        body.image = imageUrl;
      }
      const {
        data
      } = await axios.post(`${global.bot?.api?.wudysoft}/api/ai/ezimgeditor`, body, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": CONFIG.USER_AGENT
        },
        timeout: CONFIG.TIMEOUT
      });
      const outputUrl = data?.url || data?.result?.url || data?.result;
      if (!data || data.success !== true && data.status !== true || !outputUrl) {
        if (typeof ctx.react === "function") await ctx.react("❌");
        return ctx.reply(`❌ Gagal memproses gambar: ${data?.message || data?.error || "API tidak mengembalikan hasil."}`);
      }
      const mode = imageUrl ? "Image-to-Image (I2I)" : "Text-to-Image (T2I)";
      const caption = `–  *E Z  I M A G E  E D I T O R*

Proses manipulasi visual berhasil diselesaikan.

┌  ◦  *Mode* : ${mode}
└  ◦  *Status* : Selesai ✅

–  *P R O M P T*

“${finalPrompt}”`;
      await sock.sendMessage(ctx.id, {
        image: {
          url: outputUrl
        },
        caption: caption.trim()
      }, {
        quoted: quotedMsg
      });
      if (typeof ctx.react === "function") await ctx.react("✅");
    } catch (error) {
      console.error("[EZ Image Editor Error]:", error?.message || error);
      if (typeof ctx.react === "function") await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Terjadi kendala pada EZ Image Editor: ${errMsg}`);
    }
  }
};