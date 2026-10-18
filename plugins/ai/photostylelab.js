import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const BASE_URL = `${global.bot?.api?.wudysoft}/api/ai/img2img/ghibli/v7`;
const DEFAULT_STYLE = "Turn My Photo Into Studio Ghibli";
const DEFAULT_TYPE = "creative";
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
    if (["style", "template", "temp", "mode"].includes(lowerKey)) key = "style";
    if (["type", "mode_type"].includes(lowerKey)) key = "type";
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
  name: "photostylelab",
  aliases: ["labstyle", "ghibliv7"],
  description: "AI Photo Style Lab Engine Direct Execution (v7 API).",
  category: "AI",
  limit: true,
  example: "• Custom Style: photostylelab --style Cyberpunk --prompt add glasses\n• Reply Foto: Reply gambar dengan caption photostylelab Turn My Photo Into Anime",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["photostylelab", "labstyle", "ghibliv7"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (!rawText && !isMedia) {
        const guideText = `–  *P H O T O  S T Y L E  L A B*

Layanan eksperimen filter gaya visual foto menggunakan PhotoStyleLab v7 Engine.

┌  ◦  *Ubah Gaya Foto* :
│  ├ Reply gambar: \`${prefix}photostylelab --style Cyberpunk --prompt add glasses\`
│  └ Teks style langsung: \`${prefix}photostylelab Turn My Photo Into Anime\`
│
└  ◦  *Parameter Flag Tambahan* :
   ├ \`--style <nama_style>\` (Default: \`${DEFAULT_STYLE}\`)
   ├ \`--type <creative | exact | subtle>\` (Default: \`${DEFAULT_TYPE}\`)
   ├ \`--prompt <instruksi>\` (Contoh: \`--prompt add hat\`)
   ├ \`--imageUrl <url>\`
   └ \`--body <json_string>\``;
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
        return ctx.reply("❌ Kirim/reply gambar atau sertakan URL gambar via flag `--imageUrl <url>`.");
      }
      const selectedStyle = flags.style || cleanPrompt || DEFAULT_STYLE;
      const userPrompt = flags.prompt || (flags.style && cleanPrompt ? cleanPrompt : "");
      let bodyOverride = {};
      if (flags.body) {
        try {
          bodyOverride = typeof flags.body === "string" ? JSON.parse(flags.body) : flags.body;
          delete flags.body;
        } catch (e) {
          console.error("[PHOTOSTYLELAB] Invalid JSON in --body flag:", e.message);
        }
      }
      const payload = {
        imageUrl: uploadedImageUrl,
        type: flags.type || DEFAULT_TYPE,
        style: selectedStyle,
        prompt: userPrompt,
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
      if (!resData || resData.success === false) {
        throw new Error(resData?.message || resData?.error || "Gagal memproses gambar pada PhotoStyleLab server.");
      }
      const rawResult = resData.data || resData.result;
      if (!rawResult) {
        throw new Error("Tidak ada data gambar yang dikembalikan oleh server.");
      }
      let imageBuffer;
      if (typeof rawResult === "string" && (rawResult.startsWith("http://") || rawResult.startsWith("https://"))) {
        const imgRes = await axios.get(rawResult, {
          responseType: "arraybuffer",
          timeout: 6e4
        });
        imageBuffer = Buffer.from(imgRes.data);
      } else if (typeof rawResult === "string") {
        const cleanBase64 = rawResult.replace(/^data:image\/\w+;base64,/, "");
        imageBuffer = Buffer.from(cleanBase64, "base64");
      }
      if (!imageBuffer || imageBuffer.length === 0) {
        await ctx.react("❌");
        return ctx.reply("❌ Gambar hasil generasi kosong atau gagal dikonversi.");
      }
      let caption = `–  *P H O T O  S T Y L E  L A B*

Transformasi visual foto berhasil diselesaikan.

┌  ◦  *Style* : ${selectedStyle}
└  ◦  *Tipe* : \`${payload.type}\``;
      if (userPrompt) {
        caption += `\n\n–  *I N S T R U K S I*\n\n“${userPrompt}”`;
      }
      await sock.sendMessage(ctx.id, {
        image: imageBuffer,
        caption: caption.trim()
      }, {
        quoted: quotedMsg
      });
      await ctx.react("✅");
    } catch (error) {
      console.error("[PhotoStyleLab Error]:", error?.message || error);
      await ctx.react("❌");
      let errorMessage = error.message;
      if (error.response?.data) {
        try {
          const parsed = typeof error.response.data === "string" ? JSON.parse(error.response.data) : error.response.data;
          errorMessage = parsed.message || parsed.error || errorMessage;
        } catch {}
      }
      ctx.reply(`❌ PhotoStyleLab Error: ${errorMessage}`);
    }
  }
};