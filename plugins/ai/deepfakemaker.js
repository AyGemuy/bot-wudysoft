import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/ai/deepfakemaker/gen`;
const CONFIG = {
  TIMEOUT: 9e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /--([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1];
    let rawVal = match[2];
    let val = true;
    if (["image", "img", "imageurl"].includes(key.toLowerCase())) key = "imageUrl";
    if (rawVal !== undefined) {
      if (rawVal.startsWith('"') && rawVal.endsWith('"') || rawVal.startsWith("'") && rawVal.endsWith("'")) {
        rawVal = rawVal.slice(1, -1);
      }
      if (rawVal === "true") val = true;
      else if (rawVal === "false") val = false;
      else if (!isNaN(rawVal) && rawVal.trim() !== "") val = Number(rawVal);
      else val = rawVal;
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
  name: "deepfakemaker",
  aliases: ["dfm", "deepfake"],
  description: "AI Image Generator & Stylizer via DeepfakeMaker (T2I & I2I).",
  category: "AI",
  limit: true,
  example: "• Text-to-Image: deepfakemaker cybernetic samurai portrait\n• Image-to-Image: Reply gambar dengan caption: deepfakemaker add hat and sunglasses",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["deepfakemaker", "dfm", "deepfake"].some(a => firstWord.endsWith(a))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (!rawText && !isMedia) {
        const guideText = `–  *D E E P F A K E  M A K E R*

Layanan manipulasi dan rendering visual AI (Text-to-Image & Image-to-Image).

┌  ◦  *Text-to-Image (T2I)* :
│  └ \`${prefix}deepfakemaker cybernetic samurai portrait\`
│
├  ◦  *Image-to-Image (I2I)* :
│  └ Reply / kirim gambar: \`${prefix}deepfakemaker add hat and sunglasses\`
│
└  ◦  *Parameter Flag* :
   ├ \`--imageUrl <url>\` (Input URL gambar manual)
   ├ \`--mode <mode>\` (Contoh: \`--mode img2img\`)
   └ \`--body <json_string>\` (Override payload JSON penuh)`;
        return ctx.reply(guideText, {
          quoted: quotedMsg
        });
      }
      if (typeof ctx.react === "function") await ctx.react("⏳");
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      const prompt = cleanPrompt || "enhance details, masterpiece, high resolution";
      let uploadedImageUrl = flags.imageUrl || null;
      let isI2I = Boolean(uploadedImageUrl);
      if (isMedia && !uploadedImageUrl) {
        const buffer = await ctx.download();
        if (buffer && Buffer.isBuffer(buffer)) {
          const uploadRes = await upload(buffer).catch(() => null);
          if (uploadRes?.status && uploadRes?.url) {
            uploadedImageUrl = uploadRes.url;
            isI2I = true;
          } else {
            if (typeof ctx.react === "function") await ctx.react("❌");
            return ctx.reply(`❌ Gagal mengunggah gambar: ${uploadRes?.message || "Server upload error"}`);
          }
        }
      }
      let bodyOverride = {};
      if (flags.body) {
        try {
          bodyOverride = typeof flags.body === "string" ? JSON.parse(flags.body) : flags.body;
          delete flags.body;
        } catch (e) {
          console.error("[DEEPFAKEMAKER] Invalid JSON in --body flag:", e.message);
        }
      }
      const payload = {
        prompt: prompt,
        ...uploadedImageUrl ? {
          imageUrl: uploadedImageUrl
        } : {},
        ...flags,
        ...bodyOverride
      };
      const response = await axios.get(API_URL, {
        params: payload,
        headers: {
          "User-Agent": CONFIG.USER_AGENT
        },
        timeout: CONFIG.TIMEOUT
      });
      const resData = response.data;
      const resultUrl = resData?.generate_url || resData?.data?.generate_url;
      if (!resData?.success || !resultUrl) {
        throw new Error(resData?.message || "Gagal mendapatkan URL hasil generasi dari server.");
      }
      const imgRes = await axios.get(resultUrl, {
        responseType: "arraybuffer",
        timeout: 6e4
      });
      const imageBuffer = Buffer.from(imgRes.data);
      if (!imageBuffer || imageBuffer.length === 0) {
        if (typeof ctx.react === "function") await ctx.react("❌");
        return ctx.reply("❌ Gambar hasil generasi kosong atau gagal diunduh.");
      }
      const caption = `–  *D E E P F A K E  M A K E R*

Render gambar berhasil diproses oleh sistem kecerdasan buatan.

┌  ◦  *Mode* : ${isI2I ? "Image-to-Image (I2I)" : "Text-to-Image (T2I)"}
└  ◦  *Attempt* : ${resData?.attempt || 1}

–  *P R O M P T*

“${prompt}”`;
      await sock.sendMessage(ctx.id, {
        image: imageBuffer,
        caption: caption.trim()
      }, {
        quoted: quotedMsg
      });
      if (typeof ctx.react === "function") await ctx.react("✅");
    } catch (error) {
      console.error("[DeepfakeMaker Error]:", error?.message || error);
      if (typeof ctx.react === "function") await ctx.react("❌");
      let errorMessage = error.message;
      if (error.response?.data) {
        try {
          const parsed = typeof error.response.data === "string" ? JSON.parse(error.response.data) : error.response.data;
          errorMessage = parsed.message || parsed.error || errorMessage;
        } catch {}
      }
      ctx.reply(`❌ DeepfakeMaker Error: ${errorMessage}`);
    }
  }
};