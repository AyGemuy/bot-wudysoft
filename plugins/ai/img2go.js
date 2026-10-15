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
  name: "img2go",
  aliases: ["img2goai", "i2go"],
  description: "AI Image Generator & Editor via Img2Go Engine (T2I & I2I).",
  category: "AI",
  limit: true,
  example: "• Text-to-Image: img2go cute cat in the garden\n• Image-to-Image: Reply gambar dengan caption img2go turn into oil painting",
  execute: async (sock, ctx, msg) => {
    try {
      let text = ctx.args?.join(" ")?.trim() || "";
      if (!text && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["img2go", "img2goai", "i2go"].some(alias => firstWord.endsWith(alias))) {
          text = raw.slice(firstWord.length).trim();
        }
      }
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (!text && !isMedia) {
        const guideText = `–  *I M G 2 G O  A I*

Layanan rendering dan rekayasa gambar berbasis kecerdasan buatan (Text-to-Image & Image-to-Image).

┌  ◦  *Text-to-Image (T2I)* :
│  └ \`${prefix}img2go a futuristic anime landscape with sakura\`
│
└  ◦  *Image-to-Image (I2I)* :
   └ Reply / kirim gambar: \`${prefix}img2go change to watercolor style\``;
        return ctx.reply(guideText, {
          quoted: quotedMsg
        });
      }
      await ctx.react("⏳");
      let imageUrl = null;
      if (isMedia) {
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
        imageUrl = uploadRes.url;
      }
      const finalPrompt = text || (imageUrl ? "enhance details, masterpiece, high resolution" : "a cute cat");
      const body = {
        prompt: finalPrompt
      };
      if (imageUrl) {
        body.image = imageUrl;
      }
      const response = await axios.post(`${global.bot?.api?.wudysoft}/api/ai/img2go`, body, {
        responseType: "arraybuffer",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": CONFIG.USER_AGENT
        },
        timeout: CONFIG.TIMEOUT
      });
      const imageBuffer = Buffer.from(response.data);
      if (imageBuffer.length < 500) {
        try {
          const parsed = JSON.parse(imageBuffer.toString("utf-8"));
          if (parsed && (!parsed.status || parsed.error || parsed.message)) {
            await ctx.react("❌");
            return ctx.reply(`❌ Gagal: ${parsed.message || parsed.error || "Proses dibatalkan oleh server."}`);
          }
        } catch {}
      }
      if (!imageBuffer || imageBuffer.length === 0) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal memproses gambar dari server.");
      }
      const mode = imageUrl ? "Image-to-Image (I2I)" : "Text-to-Image (T2I)";
      const caption = `–  *I M G 2 G O  A I*

Proses olah visual berhasil diselesaikan.

┌  ◦  *Mode* : ${mode}
└  ◦  *Status* : Selesai ✅

–  *P R O M P T*

“${finalPrompt}”`;
      await sock.sendMessage(ctx.id, {
        image: imageBuffer,
        caption: caption.trim()
      }, {
        quoted: quotedMsg
      });
      await ctx.react("✅");
    } catch (error) {
      console.error("[Img2Go Error]:", error?.message || error);
      await ctx.react("❌");
      let errorMessage = error.message;
      if (error.response?.data) {
        try {
          const parsed = JSON.parse(Buffer.from(error.response.data).toString("utf-8"));
          errorMessage = parsed.message || parsed.error || errorMessage;
        } catch {}
      }
      ctx.reply(`❌ Terjadi kendala pada Img2Go: ${errorMessage}`);
    }
  }
};