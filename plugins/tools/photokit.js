import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/tools/photokit`;
const CONFIG = {
  TIMEOUT: 18e4,
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
    if (["strength", "str", "s"].includes(key)) key = "strength";
    if (["cutout", "use_cutout", "c"].includes(key)) key = "use_cutout";
    if (["seed"].includes(key)) key = "seed";
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
  name: "photokit",
  aliases: ["pkit", "pkai"],
  description: "AI Image Editing & Enhancer menggunakan PhotoKit API",
  category: "AI",
  limit: true,
  example: "• Reply/Kirim gambar: photokit cyberpunk style --strength 0.8 --cutout true --seed 12345",
  execute: async (sock, ctx, msg) => {
    try {
      let text = ctx.args?.join(" ")?.trim() || "";
      if (!text && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["photokit", "pkit", "pkai"].some(alias => firstWord.endsWith(alias))) {
          text = raw.slice(firstWord.length).trim();
        }
      }
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • PhotoKit Studio`;
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const {
        flags,
        cleanPrompt
      } = parseFlags(text);
      if (!isMedia || !cleanPrompt) {
        const guideText = `–  *P H O T O K I T  S T U D I O*

Layanan manipulasi & pengubahan visual berbasis AI Photokit.

┌  ◦  *Format* : Kirim/Reply gambar dengan caption:
│     \`${prefix}photokit <prompt> [flags]\`
│
├  ◦  *Contoh* :
│     \`${prefix}photokit change hair color to red --strength 0.8\`
│     \`${prefix}photokit turn into anime style --cutout false\`
│
└  ◦  *Parameter Flags* :
   ├ \`--strength, -s\` : Kekuatan efek (0.1 - 1.0, Default: 1)
   ├ \`--cutout, -c\`   : Ekstraksi latar/objek (true / false, Default: true)
   └ \`--seed\`         : Nilai seed rendering (Angka acak / opsional)`;
        return ctx.reply(guideText, {
          quoted: quotedMsg
        });
      }
      await ctx.react("⏳");
      const mediaBuffer = await ctx.download();
      if (!mediaBuffer || !Buffer.isBuffer(mediaBuffer)) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal mengunduh media dari pesan.");
      }
      const uploadRes = await upload(mediaBuffer);
      if (!uploadRes?.status || !uploadRes?.url) {
        await ctx.react("❌");
        return ctx.reply(`❌ Gagal mengunggah gambar: ${uploadRes?.message || "Server upload error"}`);
      }
      const strength = flags.strength !== undefined && !isNaN(flags.strength) ? Number(flags.strength) : 1;
      const useCutout = flags.use_cutout !== undefined ? Boolean(flags.use_cutout) : true;
      const seed = flags.seed !== undefined && !isNaN(flags.seed) ? Number(flags.seed) : null;
      const payload = {
        image: uploadRes.url,
        prompt: cleanPrompt,
        strength: strength,
        use_cutout: useCutout,
        seed: seed,
        timeout: CONFIG.TIMEOUT
      };
      const response = await axios.post(API_URL, payload, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": CONFIG.USER_AGENT
        },
        responseType: "arraybuffer",
        timeout: CONFIG.TIMEOUT
      });
      const responseBuffer = Buffer.from(response.data);
      if (!responseBuffer || responseBuffer.length === 0) {
        await ctx.react("❌");
        return ctx.reply("❌ Server tidak mengembalikan output visual.");
      }
      const contentType = response.headers["content-type"] || "";
      if (contentType.includes("application/json")) {
        try {
          const jsonErr = JSON.parse(responseBuffer.toString("utf-8"));
          await ctx.react("❌");
          return ctx.reply(`❌ Gagal: ${jsonErr.message || jsonErr.error || "Terjadi kesalahan pada sistem PhotoKit."}`);
        } catch {}
      }
      const captionText = `–  *P H O T O K I T  S T U D I O*

Proses editing visual berhasil diselesaikan.

┌  ◦  *Strength* : ${strength}
│  ◦  *Use Cutout* : ${useCutout ? "Aktif" : "Nonaktif"}
└  ◦  *Seed* : ${seed !== null ? seed : "Auto"}

–  *P R O M P T*

“${cleanPrompt}”`;
      const buttons = [{
        name: "cta_copy",
        buttonParamsJson: JSON.stringify({
          display_text: "📋 Salin Prompt",
          copy_code: cleanPrompt
        })
      }];
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(captionText, botFooter, buttons, {
          media: responseBuffer,
          quoted: quotedMsg
        });
      } else {
        await sock.sendMessage(ctx.id, {
          image: responseBuffer,
          caption: captionText
        }, {
          quoted: quotedMsg
        });
      }
      await ctx.react("✅");
    } catch (error) {
      console.error("[PhotoKit Error]:", error?.message || error);
      await ctx.react("❌");
      let errorMessage = error.message;
      if (error.response?.data) {
        try {
          const rawErr = Buffer.isBuffer(error.response.data) ? error.response.data.toString("utf-8") : error.response.data;
          const parsed = typeof rawErr === "string" ? JSON.parse(rawErr) : rawErr;
          errorMessage = parsed.message || parsed.error || errorMessage;
        } catch {}
      }
      ctx.reply(`❌ Terjadi kesalahan pada PhotoKit: ${errorMessage}`);
    }
  }
};