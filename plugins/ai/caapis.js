import axios from "axios";
import db from "../../data/db.js";
import { upload } from "../../lib/upload.js";
import { simpleQuoted } from "../../lib/quoted.js";

const API_URL = `${global.bot?.api?.wudysoft}/api/ai/caapis`;

const CONFIG = {
  TIMEOUT: 120000,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};

const PRESET_STYLES = [
  { name: "Cyberpunk Anime", prompt: "cyberpunk anime style, vibrant neon glow, highly detailed, 8k render" },
  { name: "Studio Ghibli", prompt: "ghibli aesthetic, soft pastel colors, hand-drawn anime scenery, whimsical" },
  { name: "3D Pixar Cartoon", prompt: "3d cute cartoon character, pixar disney style, smooth lighting, octane render" },
  { name: "Photorealistic HD", prompt: "hyperrealistic portrait, sharp details, cinematic bokeh, 35mm photograph" },
  { name: "Fantasy Oil Painting", prompt: "epic fantasy oil painting, masterwork, dramatic rim lighting, intricate details" },
  { name: "Retro Pixel Art", prompt: "16-bit pixel art style, retro nostalgic arcade, vibrant color palette" }
];

function initDB(jid = null, name = "") {
  try {
    if (!global.db) global.db = {};
    if (!global.db.user) global.db.user = {};
    if (jid && !global.db.user[jid]) {
      global.db.user[jid] = {
        name: name || "",
        money: 10000,
        exp: 0
      };
    }
  } catch (err) {
    console.error("[Caapis initDB Error]:", err?.message || err);
  }
}

function parseFlags(input = "") {
  try {
    const flags = {};
    const flagRegex = /(?:--|-)([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
    let match;

    while ((match = flagRegex.exec(input)) !== null) {
      let key = match[1].toLowerCase();
      let rawVal = match[2];
      let val = true;

      if (["m", "mode", "action", "type"].includes(key)) key = "mode";
      if (["p", "prompt", "text"].includes(key)) key = "prompt";
      if (["neg", "negative", "negative_prompt"].includes(key)) key = "negative_prompt";
      if (["w", "width"].includes(key)) key = "width";
      if (["h", "height"].includes(key)) key = "height";
      if (["img", "image", "foto", "url"].includes(key)) key = "image";

      // Flag switch instan untuk mode
      if (["nobg", "rembg"].includes(key)) {
        flags.mode = "nobg";
        continue;
      }
      if (["upscale", "hd"].includes(key)) {
        flags.mode = "upscale";
        continue;
      }
      if (["gen", "generate"].includes(key)) {
        flags.mode = "gen";
        continue;
      }
      if (["filter"].includes(key)) {
        flags.mode = "filter";
        continue;
      }

      if (rawVal !== undefined) {
        if ((rawVal.startsWith('"') && rawVal.endsWith('"')) || (rawVal.startsWith("'") && rawVal.endsWith("'"))) {
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
    return { flags, cleanPrompt };
  } catch (err) {
    console.error("[Caapis parseFlags Error]:", err?.message || err);
    return { flags: {}, cleanPrompt: input };
  }
}

async function requestCaapisAPI(payload = {}) {
  try {
    const response = await axios.post(API_URL, payload, {
      headers: {
        "Content-Type": "application/json",
        "User-Agent": CONFIG.USER_AGENT
      },
      responseType: "arraybuffer",
      timeout: CONFIG.TIMEOUT,
      validateStatus: () => true
    });

    const contentType = response.headers?.["content-type"] || "";

    // Cek jika API merespon error dalam bentuk JSON
    if (contentType.includes("application/json")) {
      const jsonText = Buffer.from(response.data).toString("utf-8");
      try {
        const parsed = JSON.parse(jsonText);
        return { isBuffer: false, data: parsed };
      } catch {
        return { isBuffer: false, data: { status: false, error: jsonText } };
      }
    }

    // Jika respon biner gambar langsung (image/png atau image/jpeg)
    if (contentType.startsWith("image/") || Buffer.isBuffer(response.data)) {
      return {
        isBuffer: true,
        buffer: Buffer.from(response.data),
        mime: contentType.split(";")[0] || "image/png"
      };
    }

    return { isBuffer: false, data: { status: false, error: "Format respon tidak didukung." } };
  } catch (err) {
    console.error("[Caapis requestCaapisAPI Error]:", err?.response?.data || err?.message || err);
    throw err;
  }
}

export default {
  name: "caapis",
  aliases: ["caai", "caimg"],
  description: "Multifunctional AI Visual Engine (Logo/Image Gen, AI Filter, Background Remover & Upscaler)",
  category: "AI",
  limit: true,
  example: "caapis futuristic sports car logo --mode gen",

  execute: async (sock, ctx, msg) => {
    try {
      const chatId = ctx.id;
      initDB();

      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        const detected = ["caapis", "caai", "caimg"].find(alias => firstWord.endsWith(alias));
        if (detected) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }

      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const botName = global.bot?.name || "Caapis AI";
      const botFooter = `${botName} • Visual Art Studio`;
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;

      const { flags, cleanPrompt } = parseFlags(rawText);

      // Download Media Gambar bila ada
      let uploadedMediaUrl = flags.image || null;
      if (isMedia && typeof ctx.download === "function") {
        try {
          const buffer = await ctx.download();
          if (buffer && Buffer.isBuffer(buffer)) {
            const uploadRes = await upload(buffer).catch(() => null);
            if (uploadRes?.status && uploadRes?.url) {
              uploadedMediaUrl = uploadRes.url;
            }
          }
        } catch (_) {}
      }

      // Deteksi Target Mode
      let targetMode = (flags.mode || "").toLowerCase();
      if (!targetMode) {
        if (isMedia && cleanPrompt) targetMode = "filter";
        else if (!isMedia && cleanPrompt) targetMode = "gen";
      }

      // Menu Panduan Interaktif saat tanpa teks & tanpa media
      if (!cleanPrompt && !isMedia && !flags.mode) {
        const rows = PRESET_STYLES.map(st => ({
          title: st.name,
          id: `${prefix}caapis --mode gen --prompt "${st.prompt}"`,
          description: `Generate visual dengan gaya ${st.name}`
        }));

        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "🎨 CONTOH GAYA VISUAL GEN",
            sections: [{
              title: "PILIHAN INSPIRASI PROMPT",
              rows: rows
            }]
          })
        }];

        const guideText = `–  *C A A P I S  A I  S T U D I O*

Layanan visual bertenaga AI dengan 4 mode pemrosesan:

┌  ◦  *1. Text-to-Image / Logo (gen)* :
│  └ \`${prefix}caapis lion esport logo glowing vector --mode gen\`
│
├  ◦  *2. AI Photo Style Filter (filter)* :
│  └ Kirim/balas foto: \`${prefix}caapis anime cyberpunk style --mode filter\`
│
├  ◦  *3. Hapus Background (nobg)* :
│  └ Kirim/balas foto: \`${prefix}caapis --mode nobg\` (atau \`--nobg\`)
│
├  ◦  *4. HD Image Upscaler (upscale)* :
│  └ Kirim/balas foto: \`${prefix}caapis --mode upscale\` (atau \`--upscale\`)
│
└  ◦  *Parameter Opsional* :
   ├ \`--width <1024>\` & \`--height <1024>\` (Mode Gen)
   └ \`--neg "<negative prompt>"\` (Mode Filter)`;

        if (typeof ctx.sendCta === "function") {
          return await ctx.sendCta(guideText, botFooter, buttons, { quoted: quotedMsg });
        }
        return ctx.reply(guideText, { quoted: quotedMsg });
      }

      if (!targetMode) targetMode = isMedia ? "filter" : "gen";

      // 1. Validasi Kebutuhan Input per Mode
      if (["nobg", "upscale"].includes(targetMode)) {
        if (!uploadedMediaUrl) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply(`❌ Harap kirimkan atau balas (*reply*) foto yang ingin diproses (${targetMode.toUpperCase()})!\n\n*Format:*\n\`${prefix}caapis --mode ${targetMode}\``);
        }
      }

      if (targetMode === "filter") {
        if (!uploadedMediaUrl) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply(`❌ Mode filter memerlukan foto!\nKirimkan atau balas foto dengan prompt gaya yang diinginkan.\n\n*Contoh:*\n\`${prefix}caapis anime ghibli aesthetic --mode filter\``);
        }
        if (!cleanPrompt && !flags.prompt) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply(`❌ Masukkan deskripsi gaya filter yang ingin diterapkan.\nContoh: \`${prefix}caapis cybernetic neon robot --mode filter\``);
        }
      }

      if (targetMode === "gen") {
        if (!cleanPrompt && !flags.prompt) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply(`❌ Masukkan prompt deskripsi gambar yang ingin dibuat!\nContoh: \`${prefix}caapis cute robotic kitten in futuristic city --mode gen\``);
        }
      }

      await ctx.react("⏳");

      // 2. Susun Payload Request
      const promptText = flags.prompt || cleanPrompt || "";
      const payload = {
        mode: targetMode,
        ...(promptText ? { prompt: promptText } : {}),
        ...(uploadedMediaUrl ? { image: uploadedMediaUrl } : {}),
        ...(flags.negative_prompt ? { negative_prompt: flags.negative_prompt } : {}),
        width: flags.width ? String(flags.width) : "1024",
        height: flags.height ? String(flags.height) : "1024"
      };

      // 3. Eksekusi Request API
      const result = await requestCaapisAPI(payload);

      if (!result.isBuffer) {
        const errorMsg = result.data?.error || result.data?.message || "Gagal memproses permintaan AI.";
        throw new Error(errorMsg);
      }

      // 4. Susun Caption Informasi
      let caption = "";
      if (targetMode === "gen") {
        caption = `–  *C A A P I S  L O G O  &  G E N*

┌  ◦  *Prompt* : "${promptText}"
├  ◦  *Resolusi* : ${payload.width}x${payload.height}
└  ◦  *Engine* : Caapis AI Text-to-Image`;
      } else if (targetMode === "filter") {
        caption = `–  *C A A P I S  A I  F I L T E R*

┌  ◦  *Gaya* : "${promptText}"
${flags.negative_prompt ? `├  ◦  *Negative* : "${flags.negative_prompt}"\n` : ""}└  ◦  *Engine* : Caapis Neural Style Transfer`;
      } else if (targetMode === "nobg") {
        caption = `✨ *BACKGROUND REMOVAL BERHASIL*\n\n└ _Latar belakang foto telah dihapus secara presisi._`;
      } else if (targetMode === "upscale") {
        caption = `🔍 *IMAGE UPSCALING BERHASIL*\n\n└ _Resolusi dan detail ketajaman foto telah ditingkatkan._`;
      }

      // 5. Kirim Gambar Hasil
      await sock.sendMessage(chatId, {
        image: result.buffer,
        caption: caption.trim(),
        mimetype: result.mime
      }, { quoted: quotedMsg });

      await ctx.react("🎨");
    } catch (error) {
      console.error("[Caapis AI Error]:", error?.message || error);
      if (typeof ctx.react === "function") await ctx.react("❌");
      const errMsg = error.response?.data?.error || error.response?.data?.message || error.message;
      ctx.reply(`❌ Kendala Caapis AI Studio: ${errMsg}`);
    }
  }
};