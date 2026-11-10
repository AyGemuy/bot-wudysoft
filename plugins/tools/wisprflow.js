import axios from "axios";
import { simpleQuoted } from "../../lib/quoted.js";

const CONFIG = {
  API_URL: `${global.bot?.api?.wudysoft}/api/tools/transcribe/v10`,
  TIMEOUT: 60e3
};

// Cache state session WisprFlow agar tidak perlu selalu register akun baru
let cachedState = null;

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /(?:--|-)([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;

  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1].toLowerCase();
    let rawVal = match[2];
    let val = true;

    if (["lang", "l", "language", "bahasa"].includes(key)) key = "lang";
    if (["url", "u", "link", "audio"].includes(key)) key = "url";

    if (rawVal !== undefined) {
      if ((rawVal.startsWith('"') && rawVal.endsWith('"')) || (rawVal.startsWith("'") && rawVal.endsWith("'"))) {
        rawVal = rawVal.slice(1, -1);
      }
      val = rawVal;
    }
    flags[key] = val;
  }

  const cleanPrompt = input.replace(flagRegex, "").trim();
  return { flags, cleanPrompt };
}

export default {
  name: "wisprflow",
  aliases: ["transcribe", "stt", "voicetotext", "audiototext", "wispr"],
  description: "Transkripsi rekaman suara, voice note, atau file audio menjadi teks dengan WisprFlow AI",
  category: "Tools",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["wisprflow", "transcribe", "stt", "voicetotext", "audiototext", "wispr"].some((a) => firstWord.endsWith(a))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }

      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const { flags, cleanPrompt } = parseFlags(rawText);

      // Cari input audio (dari URL, Quoted Media, atau Media Langsung)
      let audioPayload = null;

      // 1. Cek jika ada input URL dari flag atau teks
      const targetUrl = flags.url || (cleanPrompt.startsWith("http://") || cleanPrompt.startsWith("https://") ? cleanPrompt : null);
      if (targetUrl) {
        audioPayload = targetUrl;
      }

      // 2. Jika bukan URL, cek media pesan (Audio / Voice Note / Video)
      if (!audioPayload) {
        let mediaTarget = null;

        // Cek Quoted Message
        if (ctx.quoted) {
          const qType = ctx.quoted.type || "";
          const qMime = ctx.quoted.mime || "";
          if (qType.includes("audio") || qType.includes("voice") || qType.includes("video") || qMime.includes("audio") || qMime.includes("video")) {
            mediaTarget = ctx.quoted;
          }
        }

        // Cek Direct Message
        if (!mediaTarget) {
          const mType = ctx.type || "";
          const mMime = ctx.mime || "";
          if (mType.includes("audio") || mType.includes("voice") || mType.includes("video") || mMime.includes("audio") || mMime.includes("video")) {
            mediaTarget = ctx;
          }
        }

        // Download buffer media jika tersedia
        if (mediaTarget) {
          if (typeof mediaTarget.download === "function") {
            const buf = await mediaTarget.download();
            if (buf && Buffer.isBuffer(buf)) {
              audioPayload = buf.toString("base64");
            }
          }
        }
      }

      // Validasi ketersediaan audio
      if (!audioPayload) {
        return ctx.reply(`–  *W I S P R F L O W  A I*

Layanan transkripsi Audio/Voice Note ke Teks dengan akurasi tinggi.

┌  ◦  *Kirim Audio/VN* : Beri caption \`${prefix}wisprflow\`
│  ◦  *Reply Audio/VN* : Balas pesan audio dengan \`${prefix}wisprflow\`
└  ◦  *Pakai URL*      : \`${prefix}wisprflow <url_audio.mp3>\`

–  *F L A G S*
┌  ◦  \`--lang, -l\` : Tentukan kode bahasa (contoh: \`id\`, \`en\`, \`ja\`)
└  ◦  \`--url, -u\`  : Masukkan tautan file audio langsung

_Contoh:_
\`${prefix}wisprflow --lang id\``);
      }

      if (typeof ctx.react === "function") await ctx.react("⏳");

      const targetLang = flags.lang ? [String(flags.lang).toLowerCase()] : ["id", "en"];

      // Request ke API WisprFlow v10 via POST BODY
      const { data } = await axios.post(
        CONFIG.API_URL,
        {
          action: "transcribe",
          audio: audioPayload,
          language: targetLang,
          state: cachedState
        },
        {
          timeout: CONFIG.TIMEOUT,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );

      // Simpan state session jika dikembalikan server
      if (data?.state) {
        cachedState = data.state;
      }

      const res = data?.result;
      const transcriptionText = res?.text?.trim();

      if (!data?.status || !transcriptionText) {
        if (typeof ctx.react === "function") await ctx.react("❌");
        return ctx.reply(`❌ Gagal mentranskripsi audio: ${data?.error || "Suara tidak terdengar jelas atau format audio tidak didukung."}`);
      }

      const durationSec = res?.total_time ? `${res.total_time.toFixed(2)} detik` : "-";
      const detectedLang = res?.detected_language ? String(res.detected_language).toUpperCase() : "-";
      const tokens = res?.generated_tokens || "-";

      const replyText = `–  *W I S P R F L O W  T R A N S C R I B E*

┌  ◦  *Bahasa Terdeteksi* : ${detectedLang}
│  ◦  *Durasi Proses*     : ${durationSec}
└  ◦  *Total Token*       : ${tokens}

–  *H A S I L  T R A N S K R I P S I*

"${transcriptionText}"`;

      await ctx.reply(replyText, { quoted: quotedMsg });

      if (typeof ctx.react === "function") await ctx.react("✅");
    } catch (error) {
      console.error("[WisprFlow Error]:", error?.message || error);
      if (typeof ctx.react === "function") await ctx.react("❌");

      let errMsg = error.message;
      if (error.response?.data) {
        try {
          const parsed = typeof error.response.data === "string" ? JSON.parse(error.response.data) : error.response.data;
          errMsg = parsed.message || parsed.error || errMsg;
        } catch {}
      }

      ctx.reply(`❌ Terjadi kesalahan pada WisprFlow: ${errMsg}`);
    }
  }
};