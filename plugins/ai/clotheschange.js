import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const CONFIG = {
  DEFAULT_MODEL: "clothes_change_ai",
  TIMEOUT: 12e4,
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
      clothes: ["baju", "pakaian"],
      clothesImg: ["clothes-img", "cimg", "bajugambar"],
      aspectRatio: ["ar", "ratio", "rasio"],
      resolution: ["res", "resolusi"],
      count: ["cnt", "jumlah"],
      model: ["m", "mod"]
    };
    for (const [realKey, aliases] of Object.entries(aliasMap)) {
      if (aliases.includes(key)) key = realKey;
    }
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
  name: "clotheschange",
  aliases: ["gantibaju", "changeclothes", "clothesai"],
  description: "AI Clothes Change / Rekayasa dan ganti pakaian pada gambar secara realistis.",
  category: "AI",
  limit: true,
  example: "• Ganti Baju: Reply gambar dengan caption `clotheschange red hoodie`\n• Custom Style: `clotheschange woman in garden --clothes red wedding dress --ar 9:16 --res hd`",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["clotheschange", "gantibaju", "changeclothes", "clothesai"].some(a => firstWord.endsWith(a))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (!rawText && !isMedia) {
        const guideText = `–  *C L O T H E S  C H A N G E*

Layanan kecerdasan buatan untuk mengganti busana, pakaian, atau kostum pada subjek foto secara presisi.

┌  ◦  *Ganti Baju pada Foto* :
│  └ Reply / kirim foto: \`${prefix}clotheschange wearing elegant black suit\`
│
├  ◦  *Dengan Parameter Tambahan* :
│  └ \`${prefix}clotheschange woman in garden --clothes red wedding dress --ar 9:16 --res hd\`
│
└  ◦  *Daftar Opsi Flag* :
   ├ \`--clothes <deskripsi>\` : Detail jenis pakaian
   ├ \`--clothes-img <url>\` : URL referensi gambar baju
   ├ \`--ar <1:1 | 9:16 | 16:9>\` : Aspect Ratio gambar
   ├ \`--res <1080p | hd>\` : Resolusi gambar
   ├ \`--count <1-4>\` : Jumlah gambar hasil (output)
   └ \`--model <nama_model>\` : Model AI (Default: \`${CONFIG.DEFAULT_MODEL}\`)`;
        return ctx.reply(guideText, {
          quoted: quotedMsg
        });
      }
      if (typeof ctx.react === "function") await ctx.react("⏳");
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      const prompt = cleanPrompt || "change clothes";
      const clothes = flags.clothes || "";
      const clothesImage = flags.clothesImg || "";
      const model = flags.model || CONFIG.DEFAULT_MODEL;
      const aspectRatio = flags.aspectRatio || "";
      const resolution = flags.resolution || "";
      const outputCount = flags.count && !isNaN(flags.count) ? Math.min(Math.max(Number(flags.count), 1), 4) : 1;
      let targetImageUrl = null;
      if (isMedia) {
        const buffer = await ctx.download();
        if (!buffer || !Buffer.isBuffer(buffer)) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply("❌ Gagal mengunduh media dari pesan yang dikirim/direply.");
        }
        const uploadRes = await upload(buffer);
        if (!uploadRes?.status || !uploadRes?.url) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply(`❌ Gagal mengunggah gambar: ${uploadRes?.message || "Server upload error"}`);
        }
        targetImageUrl = uploadRes.url;
      }
      const body = {
        prompt: prompt,
        model: model,
        outputCount: outputCount
      };
      if (targetImageUrl) body.image = targetImageUrl;
      if (clothes) body.clothes = clothes;
      if (clothesImage) body.clothesImage = clothesImage;
      if (aspectRatio) body.aspectRatio = String(aspectRatio);
      if (resolution) body.resolution = String(resolution);
      const {
        data
      } = await axios.post(`${global.bot?.api?.wudysoft}/api/ai/clotheschange`, body, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": CONFIG.USER_AGENT
        },
        timeout: CONFIG.TIMEOUT
      });
      if (!data || !data.status || !data.result || data.result.length === 0) {
        if (typeof ctx.react === "function") await ctx.react("❌");
        return ctx.reply(`❌ Gagal memproses ganti baju: ${data?.message || "API tidak mengembalikan hasil gambar."}`);
      }
      let caption = `–  *C L O T H E S  C H A N G E*

Proses ganti pakaian berhasil diselesaikan.

┌  ◦  *Model* : \`${model}\`
│  ◦  *Pakaian* : ${clothes || "Auto-detect by Prompt"}
│  ◦  *Aspect Ratio* : ${aspectRatio || "Default"}
│  ◦  *Resolusi* : ${resolution || "Auto"}
└  ◦  *Jumlah Output* : ${outputCount} Foto

–  *P R O M P T*

“${prompt}”`;
      const results = Array.isArray(data.result) ? data.result : [data.result];
      for (let i = 0; i < results.length; i++) {
        await sock.sendMessage(ctx.id, {
          image: {
            url: results[i]
          },
          caption: i === 0 ? caption.trim() : ""
        }, {
          quoted: quotedMsg
        });
      }
      if (typeof ctx.react === "function") await ctx.react("✅");
    } catch (error) {
      console.error("[Clothes Change Error]:", error?.message || error);
      if (typeof ctx.react === "function") await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Terjadi kendala saat mengubah pakaian: ${errMsg}`);
    }
  }
};