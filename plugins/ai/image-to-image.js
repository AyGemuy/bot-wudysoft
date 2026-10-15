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
  name: "imagetoimage",
  aliases: ["imagetoimage", "i2i", "t2i"],
  description: "AI Image Generator & Editor (T2I / I2I) via Image-to-Image API.",
  category: "AI",
  limit: true,
  example: "• Text-to-Image: imagetoimage cute cyberpunk cat\n• Image-to-Image: Reply gambar dengan caption imagetoimage add hat\n• Lanjut Edit: imagetoimage change background --state <token_state>",
  execute: async (sock, ctx, msg) => {
    try {
      let text = ctx.args?.join(" ")?.trim() || "";
      if (!text && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["imagetoimage", "i2i", "t2i"].some(alias => firstWord.endsWith(alias))) {
          text = raw.slice(firstWord.length).trim();
        }
      }
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • Image-to-Image AI`;
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (!text && !isMedia) {
        const guideText = `–  *I M A G E  T O  I M A G E*

Layanan manipulasi dan transformasi visual kecerdasan buatan berbasis multi-turn state.

┌  ◦  *Text-to-Image (T2I)* :
│  └ \`${prefix}imagetoimage cute cyberpunk cat\`
│
├  ◦  *Image-to-Image (I2I)* :
│  └ Reply / kirim gambar: \`${prefix}imagetoimage add hat\`
│
└  ◦  *Lanjut Sesi / Edit State* :
   └ \`${prefix}imagetoimage change background --state <token_state>\``;
        return ctx.reply(guideText, {
          quoted: quotedMsg
        });
      }
      await ctx.react("⏳");
      let prompt = text;
      let state = "";
      if (/--state\s+([^\s]+)/i.test(prompt)) {
        const match = prompt.match(/--state\s+([^\s]+)/i);
        if (match) state = match[1];
        prompt = prompt.replace(/--state\s+[^\s]+/gi, "").trim();
      }
      const body = {
        prompt: prompt || "enhance quality, masterpiece, 4k ultra detailed"
      };
      let imageUrl = "";
      if (isMedia) {
        const buffer = await ctx.download();
        if (buffer && Buffer.isBuffer(buffer)) {
          const uploadRes = await upload(buffer);
          if (uploadRes?.status && uploadRes?.url) {
            imageUrl = uploadRes.url;
            body.image = imageUrl;
          } else {
            await ctx.react("❌");
            return ctx.reply(`❌ Gagal mengunggah gambar: ${uploadRes?.message || "Server upload error"}`);
          }
        }
      }
      if (state) {
        body.state = state;
      }
      const {
        data
      } = await axios.post(`${global.bot?.api?.wudysoft}/api/ai/image-to-image`, body, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": CONFIG.USER_AGENT
        },
        timeout: CONFIG.TIMEOUT
      });
      if (!data || !data.status || !data.result) {
        await ctx.react("❌");
        return ctx.reply(`❌ Gagal memproses gambar: ${data?.message || "Respon server tidak valid."}`);
      }
      const resultImageUrl = data.result?.generate_url || data.result?.url || (typeof data.result === "string" ? data.result : null);
      const returnedState = data.result?.state || data.state || "";
      const mode = imageUrl ? "Image-to-Image (I2I)" : "Text-to-Image (T2I)";
      if (!resultImageUrl || typeof resultImageUrl !== "string") {
        await ctx.react("❌");
        return ctx.reply("❌ Gambar hasil tidak ditemukan pada respon API.");
      }
      const bodyText = `–  *I M A G E  T O  I M A G E*

Proses olah visual berhasil diselesaikan.

┌  ◦  *Mode* : ${mode}
└  ◦  *Status* : Selesai ✅

–  *P R O M P T*

“${prompt || "-"}”`;
      const buttons = [];
      if (returnedState) {
        const nextCommand = `${prefix}imagetoimage <tulis_prompt_edit_lanjutan> --state ${returnedState}`;
        buttons.push({
          name: "cta_copy",
          display_text: "📋 Salin Lanjutan Edit",
          copy_code: nextCommand
        }, {
          name: "cta_copy",
          display_text: "🔑 Salin State Token",
          copy_code: returnedState
        });
      }
      if (buttons.length > 0 && typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, botFooter, buttons, {
          title: "– IMAGE TO IMAGE –",
          subtitle: `Mode: ${mode}`,
          media: resultImageUrl,
          quoted: quotedMsg
        });
      } else {
        await sock.sendMessage(ctx.id, {
          image: {
            url: resultImageUrl
          },
          caption: bodyText
        }, {
          quoted: quotedMsg
        });
      }
      await ctx.react("✅");
    } catch (error) {
      console.error("[ImageToImage Error]:", error?.message || error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Terjadi kesalahan pada Image-to-Image AI: ${errMsg}`);
    }
  }
};