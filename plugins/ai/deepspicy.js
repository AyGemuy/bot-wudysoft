import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const CONFIG = {
  TIMEOUT: 12e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};
export default {
  name: "deepspicy",
  aliases: ["dspicy", "deepspicyai"],
  description: "AI Image Generator & Editor via DeepSpicy Engine (T2I & I2I).",
  category: "AI",
  limit: true,
  example: "• Text-to-Image: deepspicy a beautiful girl in kimono --ar 16:9\n• Image-to-Image: Reply gambar dengan caption deepspicy realistic style",
  execute: async (sock, ctx, msg) => {
    try {
      let text = ctx.args?.join(" ")?.trim() || "";
      if (!text && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["deepspicy", "dspicy", "deepspicyai"].some(a => firstWord.endsWith(a))) {
          text = raw.slice(firstWord.length).trim();
        }
      }
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • DeepSpicy AI`;
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (!text && !isMedia) {
        const guideText = `–  *D E E P S P I C Y  A I*

Layanan generator dan editor visual berbasis kecerdasan buatan (Text-to-Image & Image-to-Image).

┌  ◦  *Text-to-Image (T2I)* :
│  └ \`${prefix}deepspicy beautiful woman in neon city --ar 16:9\`
│
├  ◦  *Image-to-Image (I2I)* :
│  └ Reply / kirim gambar: \`${prefix}deepspicy enhance quality, realistic\`
│
└  ◦  *Daftar Parameter Flag* :
   ├ \`--ar <16:9 | 9:16 | 1:1 | 4:3 | 3:4>\`
   ├ \`--model <model_type>\`
   ├ \`--res <resolusi>\`
   ├ \`--count <1-4>\` (Jumlah output)
   └ \`--token <token_jwt>\` (Token sesi)`;
        return ctx.reply(guideText, {
          quoted: quotedMsg
        });
      }
      await ctx.react("⏳");
      let prompt = text;
      let modelType = "";
      let aspectRatio = "";
      let resolution = "";
      let numOutputs = 1;
      let token = "";
      if (/--token\s+([^\s]+)/i.test(prompt)) {
        const match = prompt.match(/--token\s+([^\s]+)/i);
        if (match) token = match[1];
        prompt = prompt.replace(/--token\s+[^\s]+/gi, "").trim();
      }
      if (/--model\s+([^\s]+)/i.test(prompt)) {
        const match = prompt.match(/--model\s+([^\s]+)/i);
        if (match) modelType = match[1];
        prompt = prompt.replace(/--model\s+[^\s]+/gi, "").trim();
      }
      if (/--(?:ar|ratio|aspect_ratio)\s+([^\s]+)/i.test(prompt)) {
        const match = prompt.match(/--(?:ar|ratio|aspect_ratio)\s+([^\s]+)/i);
        if (match) aspectRatio = match[1];
        prompt = prompt.replace(/--(?:ar|ratio|aspect_ratio)\s+[^\s]+/gi, "").trim();
      }
      if (/--(?:res|resolution)\s+([^\s]+)/i.test(prompt)) {
        const match = prompt.match(/--(?:res|resolution)\s+([^\s]+)/i);
        if (match) resolution = match[1];
        prompt = prompt.replace(/--(?:res|resolution)\s+[^\s]+/gi, "").trim();
      }
      if (/--(?:count|outputs)\s+([^\s]+)/i.test(prompt)) {
        const match = prompt.match(/--(?:count|outputs)\s+([^\s]+)/i);
        if (match) numOutputs = parseInt(match[1]) || 1;
        prompt = prompt.replace(/--(?:count|outputs)\s+[^\s]+/gi, "").trim();
      }
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
      const body = {
        prompt: prompt || (imageUrl ? "enhance details, masterpiece, ultra high res" : "masterpiece, ultra detailed, 8k")
      };
      if (imageUrl) body.image = imageUrl;
      if (token) body.token = token;
      if (modelType) body.model_type = modelType;
      if (aspectRatio) body.aspect_ratio = aspectRatio;
      if (resolution) body.resolution = resolution;
      if (numOutputs > 1) body.num_outputs = numOutputs;
      const {
        data
      } = await axios.post(`${global.bot?.api?.wudysoft}/api/ai/deepspicy`, body, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": CONFIG.USER_AGENT
        },
        timeout: CONFIG.TIMEOUT
      });
      const isSuccess = data?.status === "succeeded" || data?.status === "success" || data?.status === true;
      const results = Array.isArray(data?.result) ? data.result : data?.result ? [data.result] : [];
      if (!data || !isSuccess || results.length === 0) {
        await ctx.react("❌");
        return ctx.reply(`❌ Gagal memproses gambar: ${data?.message || data?.error || "API tidak mengembalikan hasil."}`);
      }
      const mode = imageUrl ? "Image-to-Image (I2I)" : "Text-to-Image (T2I)";
      const returnedToken = data.token || token || "";
      let bodyText = `–  *D E E P S P I C Y  A I*

Proses render visual berhasil diselesaikan.

┌  ◦  *Mode* : ${mode}
│  ◦  *Model* : \`${modelType || "Default"}\`
│  ◦  *Aspect Ratio* : ${aspectRatio || "Default"}
└  ◦  *Resolusi* : ${resolution || "Auto"}

–  *P R O M P T*

“${body.prompt}”`;
      const buttons = [];
      if (returnedToken) {
        const nextCommand = `${prefix}deepspicy --token ${returnedToken}`;
        buttons.push({
          name: "cta_copy",
          display_text: "📋 Salin Sesi Token",
          copy_code: nextCommand
        }, {
          name: "cta_copy",
          display_text: "🔑 Salin Token Saja",
          copy_code: returnedToken
        });
      }
      if (buttons.length > 0 && typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, botFooter, buttons, {
          title: "– DEEPSPICY AI –",
          subtitle: `Mode: ${mode}`,
          media: results[0],
          quoted: quotedMsg
        });
      } else {
        await sock.sendMessage(ctx.id, {
          image: {
            url: results[0]
          },
          caption: bodyText
        }, {
          quoted: quotedMsg
        });
      }
      for (let i = 1; i < results.length; i++) {
        await sock.sendMessage(ctx.id, {
          image: {
            url: results[i]
          }
        }, {
          quoted: quotedMsg
        });
      }
      await ctx.react("✅");
    } catch (error) {
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Terjadi kendala pada DeepSpicy: ${errMsg}`);
    }
  }
};