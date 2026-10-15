import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const CONFIG = {
  DEFAULT_MODEL: "NANO_BANANA",
  TIMEOUT: 9e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /(?:--|-)([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1].toLowerCase();
    let rawVal = match[2];
    let val = true;
    const aliasMap = {
      model: ["m", "mod"],
      aspectRatio: ["ar", "ratio", "rasio", "size"]
    };
    for (const [realKey, aliases] of Object.entries(aliasMap)) {
      if (aliases.includes(key)) key = realKey;
    }
    if (rawVal !== undefined) {
      if (rawVal.startsWith('"') && rawVal.endsWith('"') || rawVal.startsWith("'") && rawVal.endsWith("'")) {
        rawVal = rawVal.slice(1, -1);
      }
      val = rawVal;
    }
    flags[key] = val;
  }
  const cleanPrompt = input.replace(flagRegex, "").trim();
  return {
    flags: flags,
    cleanPrompt: cleanPrompt
  };
}
export default {
  name: "aienhancer",
  aliases: ["enhancer", "enhanceai", "aienhance"],
  description: "AI Image Generator & Transformer via AIEnhancer (Text-to-Image & Image-to-Image).",
  category: "AI",
  limit: true,
  example: "• Text-to-Image: aienhancer futuristic cyberpunk city --ar 16:9\n• Image-to-Image: Reply gambar dengan caption: aienhancer anime style",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["aienhancer", "enhancer", "enhanceai", "aienhance"].some(a => firstWord.endsWith(a))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      if (!rawText && !isMedia) {
        const guideText = `–  *A I  E N H A N C E R*

Layanan kecerdasan buatan untuk merender gambar dari teks atau merekayasa foto yang sudah ada.

┌  ◦  *Text-to-Image (T2I)* :
│  └ \`${prefix}aienhancer a futuristic girl in the rain --ar 16:9\`
│
├  ◦  *Image-to-Image (I2I)* :
│  └ Reply gambar lalu ketik: \`${prefix}aienhancer anime illustration style\`
│
└  ◦  *Parameter Tambahan* :
   ├ \`--model <nama_model>\` (Default: \`${CONFIG.DEFAULT_MODEL}\`)
   └ \`--ar <1:1 | 16:9 | 9:16 | 4:3 | 3:4>\``;
        return ctx.reply(guideText, {
          quoted: quotedMsg
        });
      }
      if (typeof ctx.react === "function") await ctx.react("⏳");
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      const model = flags.model || CONFIG.DEFAULT_MODEL;
      const aspectRatio = flags.aspectRatio || undefined;
      let imageUrl = null;
      if (isMedia) {
        const buffer = await ctx.download();
        if (!buffer || !Buffer.isBuffer(buffer)) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply("❌ Gagal mengunduh media dari gambar yang dikirim/direply.");
        }
        const uploadRes = await upload(buffer);
        if (!uploadRes?.status || !uploadRes?.url) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply(`❌ Gagal mengunggah gambar: ${uploadRes?.message || "Server upload error"}`);
        }
        imageUrl = uploadRes.url;
      }
      const finalPrompt = cleanPrompt || (imageUrl ? "enhance details, masterpiece, high quality" : "masterpiece, high quality");
      const body = {
        prompt: finalPrompt,
        image: imageUrl,
        model: model,
        ...aspectRatio ? {
          aspectRatio: aspectRatio
        } : {}
      };
      const {
        data
      } = await axios.post(`${global.bot?.api?.wudysoft}/api/ai/aienhancer`, body, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": CONFIG.USER_AGENT
        },
        timeout: CONFIG.TIMEOUT
      });
      const resObj = data?.result;
      const outputUrl = resObj?.output || (typeof resObj === "string" ? resObj : null) || data?.output;
      if (!data || data.status !== "success" && data.status !== true || !outputUrl) {
        if (typeof ctx.react === "function") await ctx.react("❌");
        return ctx.reply(`❌ Gagal memproses gambar: ${data?.message || resObj?.error || "API tidak mengembalikan output gambar."}`);
      }
      const mode = imageUrl ? "Image-to-Image (I2I)" : "Text-to-Image (T2I)";
      const caption = `–  *A I  E N H A N C E R*

┌  ◦  *Mode* : ${mode}
│  ◦  *Model* : \`${model}\`
│  ◦  *Aspect Ratio* : ${aspectRatio || "Default"}
└  ◦  *Task ID* : \`${resObj?.id || "-"}\`

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
      console.error("[AI Enhancer Error]:", error?.message || error);
      if (typeof ctx.react === "function") await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Terjadi kendala pada server AI Enhancer: ${errMsg}`);
    }
  }
};