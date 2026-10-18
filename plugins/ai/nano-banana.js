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
  name: "nanobanana",
  aliases: ["bananaai", "nanobananaai", "nbai"],
  description: "AI Image Generator & Editor menggunakan Nano Banana Engine v65 (T2I & I2I).",
  category: "AI",
  limit: true,
  example: "• Text-to-Image: nanobanana a cute cat in the sky moon\n• Image-to-Image: Reply gambar dengan caption nanobanana transform into anime style\n• Override Payload: nanobanana a futuristic city --aspect_ratio 16:9 --style cyberpunk",
  execute: async (sock, ctx, msg) => {
    try {
      let text = ctx.args?.join(" ")?.trim() || "";
      if (!text && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["nanobanana", "bananaai", "nanobananaai", "nbai"].some(alias => firstWord.endsWith(alias))) {
          text = raw.slice(firstWord.length).trim();
        }
      }
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (!text && !isMedia) {
        const guideText = `–  *N A N O  B A N A N A  A I*

Layanan rendering visual berkecepatan tinggi menggunakan Nano Banana Engine v65.

┌  ◦  *Text-to-Image (T2I)* :
│  └ \`${prefix}nanobanana a cute cat in the sky moon\`
│
├  ◦  *Image-to-Image (I2I)* :
│  └ Reply / kirim gambar: \`${prefix}nanobanana transform into anime style\`
│
└  ◦  *Custom Payload Override* :
   └ \`${prefix}nanobanana futuristic city --aspect_ratio 16:9 --style cyberpunk\``;
        return ctx.reply(guideText, {
          quoted: quotedMsg
        });
      }
      await ctx.react("⏳");
      const restPayload = {};
      const flagRegex = /--([a-zA-Z0-9_]+)\s+([^\s]+)/g;
      let match;
      while ((match = flagRegex.exec(text)) !== null) {
        const key = match[1];
        const value = match[2];
        restPayload[key] = value;
      }
      let prompt = text.replace(/--[a-zA-Z0-9_]+\s+[^\s]+/g, "").trim();
      let imageUrl = null;
      if (isMedia) {
        const buffer = await ctx.download();
        if (buffer && Buffer.isBuffer(buffer)) {
          const uploadRes = await upload(buffer);
          if (uploadRes?.status && uploadRes?.url) {
            imageUrl = uploadRes.url;
          } else {
            await ctx.react("❌");
            return ctx.reply(`❌ Gagal mengunggah gambar: ${uploadRes?.message || "Upload error"}`);
          }
        }
      }
      const body = {
        prompt: prompt || "masterpiece, ultra detailed, 8k resolution",
        ...imageUrl ? {
          image: imageUrl
        } : {},
        ...restPayload
      };
      const {
        data
      } = await axios.post(`${global.bot?.api?.wudysoft}/api/ai/nano-banana/v65`, body, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": CONFIG.USER_AGENT
        },
        timeout: CONFIG.TIMEOUT
      });
      const outputImageUrl = data?.output || data?.result?.output || (Array.isArray(data?.result) ? data.result[0] : data?.result) || data?.url;
      if (!outputImageUrl || typeof outputImageUrl !== "string") {
        await ctx.react("❌");
        return ctx.reply(`❌ Gagal menghasilkan gambar: ${data?.message || "Respon API tidak sesuai."}`);
      }
      const mode = imageUrl ? "Image-to-Image (I2I)" : "Text-to-Image (T2I)";
      const caption = `–  *N A N O  B A N A N A  A I*

Proses olah visual berhasil diselesaikan.

┌  ◦  *Mode* : ${mode}
│  ◦  *Task ID* : \`${data.id || "-"}\`
└  ◦  *Tipe* : ${data.type || "Default"}

–  *P R O M P T*

“${prompt || "-"}”`;
      await sock.sendMessage(ctx.id, {
        image: {
          url: outputImageUrl
        },
        caption: caption.trim()
      }, {
        quoted: quotedMsg
      });
      await ctx.react("✅");
    } catch (error) {
      console.error("[Nano Banana Error]:", error?.message || error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Terjadi kendala pada Nano Banana: ${errMsg}`);
    }
  }
};