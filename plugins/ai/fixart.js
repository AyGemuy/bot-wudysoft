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
  name: "fixart",
  aliases: ["fixartai"],
  description: "AI Image Generator / Editor menggunakan FixArt (T2I & I2I).",
  category: "AI",
  limit: true,
  example: "• Text-to-Image: fixart cat with sunglasses\n• Image-to-Image: Reply gambar dengan caption fixart add hat\n• Lanjut Edit: fixart add sunglasses --state <state_token>",
  execute: async (sock, ctx, msg) => {
    try {
      let text = ctx.args?.join(" ")?.trim() || "";
      if (!text && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (firstWord.endsWith("fixart") || firstWord.endsWith("fixartai")) {
          text = raw.slice(firstWord.length).trim();
        }
      }
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • FixArt AI`;
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (!text && !isMedia) {
        const guideText = `–  *F I X A R T  A I*

Layanan render visual dan rekayasa foto berbasis kecerdasan buatan dengan fitur editing multi-turn state.

┌  ◦  *Text-to-Image (T2I)* :
│  └ \`${prefix}fixart cat with sunglasses\`
│
├  ◦  *Image-to-Image (I2I)* :
│  └ Reply / kirim gambar: \`${prefix}fixart add hat\`
│
└  ◦  *Lanjut Sesi / Edit State* :
   └ \`${prefix}fixart add sunglasses --state <state_token>\``;
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
        prompt: prompt || "enhance quality, masterpiece, 4k"
      };
      if (isMedia) {
        const buffer = await ctx.download();
        if (!buffer || !Buffer.isBuffer(buffer)) {
          await ctx.react("❌");
          return ctx.reply("❌ Gagal mengunduh media dari pesan.");
        }
        const uploadRes = await upload(buffer);
        if (!uploadRes?.status || !uploadRes?.url) {
          await ctx.react("❌");
          return ctx.reply(`❌ Gagal mengunggah gambar: ${uploadRes?.message || "Server upload error"}`);
        }
        body.image = uploadRes.url;
      }
      if (state) {
        body.state = state;
      }
      const {
        data
      } = await axios.post(`${global.bot?.api?.wudysoft}/api/ai/fixart`, body, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": CONFIG.USER_AGENT
        },
        timeout: CONFIG.TIMEOUT
      });
      const resultImage = data?.result || data?.resultUrl || data?.image;
      if (!data || data.status !== true && data.status !== "success" || !resultImage) {
        await ctx.react("❌");
        return ctx.reply(`❌ Gagal memproses gambar: ${data?.message || "API tidak mengembalikan hasil."}`);
      }
      const mode = body.image ? "Image-to-Image (I2I)" : "Text-to-Image (T2I)";
      const returnedState = data.state || "";
      const bodyText = `–  *F I X A R T  A I*

Proses olah visual berhasil diselesaikan.

┌  ◦  *Mode* : ${mode}
└  ◦  *Status* : Selesai ✅

–  *P R O M P T*

“${body.prompt}”`;
      const buttons = [];
      if (returnedState) {
        const nextCommand = `${prefix}fixart <tulis_prompt_edit_lanjutan> --state ${returnedState}`;
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
          title: "– FIXART AI –",
          subtitle: `Mode: ${mode}`,
          media: resultImage,
          quoted: quotedMsg
        });
      } else {
        await sock.sendMessage(ctx.id, {
          image: {
            url: resultImage
          },
          caption: bodyText
        }, {
          quoted: quotedMsg
        });
      }
      await ctx.react("✅");
    } catch (error) {
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Terjadi kesalahan pada FixArt: ${errMsg}`);
    }
  }
};