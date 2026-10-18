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
  name: "pokecut",
  aliases: ["pokecutai"],
  description: "AI Image Generator & Editor menggunakan Pokecut AI (T2I & I2I).",
  category: "AI",
  limit: true,
  example: "• Text-to-Image: pokecut cute pikachu cyberpunk style\n• Image-to-Image: Reply gambar dengan caption pokecut add sunglasses and hat",
  execute: async (sock, ctx, msg) => {
    try {
      let text = ctx.args?.join(" ")?.trim() || "";
      if (!text && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["pokecut", "pokecutai"].some(alias => firstWord.endsWith(alias))) {
          text = raw.slice(firstWord.length).trim();
        }
      }
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (!text && !isMedia) {
        const guideText = `–  *P O K E C U T  A I*

Layanan rendering visual dan manipulasi gambar menggunakan Pokecut AI Engine.

┌  ◦  *Text-to-Image (T2I)* :
│  └ \`${prefix}pokecut cute pikachu cyberpunk style\`
│
└  ◦  *Image-to-Image (I2I)* :
   └ Reply / kirim gambar: \`${prefix}pokecut add sunglasses and hat\``;
        return ctx.reply(guideText, {
          quoted: quotedMsg
        });
      }
      await ctx.react("⏳");
      const prompt = text || "enhance details, masterpiece, high resolution";
      const body = {
        prompt: prompt
      };
      let isI2I = false;
      if (isMedia) {
        const buffer = await ctx.download();
        if (buffer && Buffer.isBuffer(buffer)) {
          const uploadRes = await upload(buffer);
          if (uploadRes?.status && uploadRes?.url) {
            body.image = uploadRes.url;
            isI2I = true;
          } else {
            await ctx.react("❌");
            return ctx.reply(`❌ Gagal mengunggah gambar: ${uploadRes?.message || "Server upload error"}`);
          }
        }
      }
      const response = await axios.post(`${global.bot?.api?.wudysoft}/api/ai/pokecut`, body, {
        responseType: "arraybuffer",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": CONFIG.USER_AGENT
        },
        timeout: CONFIG.TIMEOUT
      });
      const imageBuffer = Buffer.from(response.data);
      if (!imageBuffer || imageBuffer.length === 0) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal mendapatkan gambar dari server Pokecut.");
      }
      const mode = isI2I ? "Image-to-Image (I2I)" : "Text-to-Image (T2I)";
      const caption = `–  *P O K E C U T  A I*

Proses olah visual berhasil diselesaikan.

┌  ◦  *Mode* : ${mode}
└  ◦  *Status* : Selesai ✅

–  *P R O M P T*

“${prompt}”`;
      await sock.sendMessage(ctx.id, {
        image: imageBuffer,
        caption: caption.trim()
      }, {
        quoted: quotedMsg
      });
      await ctx.react("✅");
    } catch (error) {
      console.error("[Pokecut Error]:", error?.message || error);
      await ctx.react("❌");
      let errorMessage = error.message;
      if (error.response?.data) {
        try {
          const parsed = JSON.parse(Buffer.from(error.response.data).toString("utf-8"));
          errorMessage = parsed.message || parsed.error || errorMessage;
        } catch {}
      }
      ctx.reply(`❌ Terjadi kendala pada Pokecut AI: ${errorMessage}`);
    }
  }
};