import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const CONFIG = {
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
      model: ["m", "mod"]
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
  name: "appzoneai",
  aliases: ["appzone", "azai", "gpt5"],
  description: "AI Chat Assistant & Vision (Teks & Gambar) via AppZone AI Engine.",
  category: "AI",
  limit: true,
  example: "• Teks: appzoneai jelaskan teori relativitas\n• Vision: Reply foto dengan appzoneai jelaskan gambar ini\n• Model: appzoneai halo! --model gpt-5.4-mini",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["appzoneai", "appzone", "azai", "gpt5"].some(a => firstWord.endsWith(a))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      if (!rawText && !isMedia) {
        const guideText = `–  *A P P Z O N E  A I*

Asisten kecerdasan buatan serbaguna untuk percakapan teks, penulisan kode, dan analisis visual gambar.

┌  ◦  *Mode Percakapan (Teks)* :
│  └ \`${prefix}appzoneai buatkan kode web scraping python\`
│
├  ◦  *Mode Vision (Analisis Foto)* :
│  └ Reply / kirim gambar: \`${prefix}appzoneai jelaskan isi foto ini\`
│
└  ◦  *Opsi Model Tambahan* :
   └ \`${prefix}appzoneai halo! --model gpt-5.4-mini\``;
        return ctx.reply(guideText, {
          quoted: quotedMsg
        });
      }
      if (typeof ctx.react === "function") await ctx.react("⏳");
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      const selectedModel = flags.model || "";
      let mediaUrl = "";
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
        mediaUrl = uploadRes.url;
      }
      const finalPrompt = cleanPrompt || (mediaUrl ? "Deskripsikan dan jelaskan gambar ini secara mendalam." : "Halo!");
      const body = {
        prompt: finalPrompt,
        messages: [{
          role: "user",
          content: finalPrompt
        }]
      };
      if (selectedModel) body.model = selectedModel;
      if (mediaUrl) body.media = mediaUrl;
      const {
        data
      } = await axios.post(`${global.bot?.api?.wudysoft}/api/ai/appzoneai`, body, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": CONFIG.USER_AGENT
        },
        timeout: CONFIG.TIMEOUT
      });
      if (!data || data.status !== true || !data.result) {
        if (typeof ctx.react === "function") await ctx.react("❌");
        return ctx.reply(`❌ Gagal memproses permintaan: ${data?.message || data?.error || "AI tidak memberikan respon."}`);
      }
      const responseText = data.result.trim();
      await sock.sendMessage(ctx.id, {
        text: responseText
      }, {
        quoted: quotedMsg
      });
      if (typeof ctx.react === "function") await ctx.react("✅");
    } catch (error) {
      console.error("[AppZone AI Error]:", error?.message || error);
      if (typeof ctx.react === "function") await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Terjadi kendala pada server AppZone AI: ${errMsg}`);
    }
  }
};