import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const BASE_URL = `${global.bot?.api?.wudysoft}/api/ai/img2img/ghibli/v5`;
const DEFAULT_PROMPT = "Ghibli art style";
const CONFIG = {
  TIMEOUT: 9e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};

function parseFlags(input) {
  const flags = {};
  const flagRegex = /--([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1];
    let rawVal = match[2];
    let val = true;
    const lowerKey = key.toLowerCase();
    if (["image", "img", "imageurl"].includes(lowerKey)) key = "imageUrl";
    if (["prompt", "text", "caption"].includes(lowerKey)) key = "prompt";
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
  name: "ghibliart",
  aliases: ["ghibliartai", "ghibliv5"],
  description: "AI Ghibli Art Generator Direct Execution (v5 API).",
  category: "AI",
  limit: true,
  example: "• Reply Foto: ghibliart convert to ghibli style\n• URL: ghibliart add hat --imageUrl https://...",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["ghibliart", "ghibliartai", "ghibliv5"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (!rawText && !isMedia) {
        const guideText = `–  *G H I B L I  A R T*

Layanan transformasi gaya visual Studio Ghibli (Image-to-Image v5 Engine).

┌  ◦  *Transformasi dari Foto* :
│  └ Reply / kirim gambar: \`${prefix}ghibliart convert to anime style\`
│
├  ◦  *Menggunakan URL Gambar* :
│  └ \`${prefix}ghibliart anime aesthetic --imageUrl <url>\`
│
└  ◦  *Parameter Flag* :
   ├ \`--prompt <teks>\` (Instruksi perubahan gaya)
   ├ \`--imageUrl <url>\` (Input URL gambar langsung)
   └ \`--body <json_string>\` (Override payload JSON penuh)`;
        return ctx.reply(guideText, {
          quoted: quotedMsg
        });
      }
      await ctx.react("⏳");
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      let uploadedImageUrl = flags.imageUrl || null;
      if (isMedia && !uploadedImageUrl) {
        const buffer = await ctx.download();
        if (buffer && Buffer.isBuffer(buffer)) {
          const uploadRes = await upload(buffer).catch(() => null);
          if (uploadRes?.status && uploadRes?.url) {
            uploadedImageUrl = uploadRes.url;
          } else {
            await ctx.react("❌");
            return ctx.reply(`❌ Gagal mengunggah gambar: ${uploadRes?.message || "Server upload error"}`);
          }
        }
      }
      if (!uploadedImageUrl) {
        await ctx.react("❌");
        return ctx.reply(`❌ Kirim/reply gambar atau sertakan URL gambar via flag \`--imageUrl <url>\`.`);
      }
      const userPrompt = flags.prompt || cleanPrompt || DEFAULT_PROMPT;
      let bodyOverride = {};
      if (flags.body) {
        try {
          bodyOverride = typeof flags.body === "string" ? JSON.parse(flags.body) : flags.body;
          delete flags.body;
        } catch (e) {
          console.error("[GHIBLIART] Invalid JSON in --body flag:", e.message);
        }
      }
      const payload = {
        prompt: userPrompt,
        imageUrl: uploadedImageUrl,
        ...flags,
        ...bodyOverride
      };
      const response = await axios.post(BASE_URL, payload, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": CONFIG.USER_AGENT
        },
        timeout: CONFIG.TIMEOUT
      });
      const resData = response.data;
      if (resData?.state === "fail" || resData?.failMsg) {
        throw new Error(resData?.failMsg || "Gagal memproses gambar pada GhibliArt server.");
      }
      const resultUrl = resData?.imageUrl || resData?.result;
      if (!resultUrl) {
        throw new Error("Tidak ada URL gambar hasil yang dikembalikan oleh server.");
      }
      const imgRes = await axios.get(resultUrl, {
        responseType: "arraybuffer",
        timeout: 6e4
      });
      const imageBuffer = Buffer.from(imgRes.data);
      if (!imageBuffer || imageBuffer.length === 0) {
        await ctx.react("❌");
        return ctx.reply("❌ Gambar hasil generasi kosong atau gagal diunduh.");
      }
      const caption = `–  *G H I B L I  A R T*

Transformasi visual gaya Ghibli berhasil diselesaikan.

┌  ◦  *UUID* : \`${resData?.uuid || "-"}\`
└  ◦  *Engine* : GhibliArt v5

–  *P R O M P T*

“${userPrompt}”`;
      await sock.sendMessage(ctx.id, {
        image: imageBuffer,
        caption: caption.trim()
      }, {
        quoted: quotedMsg
      });
      await ctx.react("✅");
    } catch (error) {
      console.error("[GhibliArt Error]:", error?.message || error);
      await ctx.react("❌");
      let errorMessage = error.message;
      if (error.response?.data) {
        try {
          const parsed = typeof error.response.data === "string" ? JSON.parse(error.response.data) : error.response.data;
          errorMessage = parsed.message || parsed.failMsg || errorMessage;
        } catch {}
      }
      ctx.reply(`❌ Terjadi kendala pada GhibliArt: ${errorMessage}`);
    }
  }
};