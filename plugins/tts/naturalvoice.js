import axios from "axios";
import db from "../../data/db.js";
import { simpleQuoted } from "../../lib/quoted.js";
import { sendPTT } from "../../lib/audio.js";
import { upload } from "../../lib/upload.js";

const CONFIG = {
  API_URL: `${global.bot?.api?.wudysoft}/api/misc/tts/v64`,
  DEFAULT_SPEAKER: "Adam",
  DEFAULT_TTS_TYPE: "kokoro",
  TIMEOUT: 120000,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  ITEMS_PER_PAGE: 6
};

function initDB(jid = null, name = "") {
  try {
    if (!global.db) global.db = {};
    if (!global.db.user) global.db.user = {};
    if (!global.db.naturalvoice) global.db.naturalvoice = {};
    if (jid && !global.db.user[jid]) {
      global.db.user[jid] = {
        name: name || "",
        money: 10000,
        exp: 0
      };
    }
  } catch (err) {
    console.error("[TTSv64 initDB Error]:", err?.message || err);
  }
}

function saveDB() {
  try {
    if (typeof db?.write === "function" && global.db) {
      db.write(global.db);
    }
  } catch (err) {
    console.error("[TTSv64 saveDB Error]:", err?.message || err);
  }
}

function parseFlags(rawStr = "") {
  try {
    const flags = {};
    const flagRegex = /(?:--|-)([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s--]+))?/g;
    let match;

    while ((match = flagRegex.exec(rawStr)) !== null) {
      let key = match[1].toLowerCase();
      let rawVal = match[2];
      let val = true;

      if (["v", "voice", "speaker", "tokoh", "model"].includes(key)) key = "speaker";
      if (["s", "search", "q", "query"].includes(key)) key = "search";
      if (["p", "page", "hal"].includes(key)) key = "page";
      if (["l", "lang", "language"].includes(key)) key = "lang";
      if (["g", "gender"].includes(key)) key = "gender";
      if (["t", "type", "engine"].includes(key)) key = "type";
      if (["c", "clone", "cloning"].includes(key)) key = "clone";
      if (["set", "setvoice"].includes(key)) key = "setvoice";

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

    const cleanText = rawStr.replace(/(?:--|-)([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s--]+))?/g, "").trim();
    return { flags, cleanText };
  } catch (err) {
    console.error("[TTSv64 parseFlags Error]:", err?.message || err);
    return { flags: {}, cleanText: rawStr };
  }
}

async function requestNaturalVoiceAPI(action, payload = {}) {
  try {
    const { data } = await axios.post(CONFIG.API_URL, {
      action: action,
      ...payload
    }, {
      headers: {
        "Content-Type": "application/json",
        "User-Agent": CONFIG.USER_AGENT
      },
      timeout: CONFIG.TIMEOUT
    });

    if (!data?.status) {
      throw new Error(data?.error || data?.result?.error || "Gagal memproses suara dari server Natural Voice.");
    }
    return data;
  } catch (err) {
    const errMsg = err.response?.data?.error || err.response?.data?.result?.error || err.message;
    throw new Error(errMsg || "Terjadi kendala jaringan ke server TTS v64.");
  }
}

async function sendAudioResponse(sock, targetJid, audioUrl, quotedMsg) {
  try {
    if (typeof sendPTT === "function") {
      try {
        await sendPTT(sock, targetJid, audioUrl, quotedMsg);
        return;
      } catch (_) {}
    }

    await sock.sendMessage(targetJid, {
      audio: { url: audioUrl },
      mimetype: "audio/mp4",
      ptt: true
    }, { quoted: quotedMsg });
  } catch (err) {
    console.error("[TTSv64 sendAudioResponse Error]:", err?.message || err);
    throw err;
  }
}

export default {
  name: "ttsv64",
  aliases: ["naturalvoice", "voxlab", "voice64", "tts64"],
  description: "AI Text-to-Speech Natural Voice v64 (Famous Celebs, English, Bahasa Jawa & Multilingual)",
  category: "AI",
  limit: true,
  example: "ttsv64 Hello I am Elon Musk --speaker \"Elon Musk\" atau ttsv64 Sugeng enjang --speaker \"Agus\"",

  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "Natural Voice AI";
    const botFooter = `${botName} • VoxLab Engine v64`;
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
    const targetJid = ctx.chat || ctx.id;
    const senderId = ctx.sender || ctx.author || msg.key?.participant || msg.key?.remoteJid || ctx.id;

    try {
      initDB(senderId, ctx.pushName);

      let rawText = (ctx.query || "").trim();
      if (!rawText && ctx.quoted?.text) rawText = ctx.quoted.text.trim();

      const userSession = global.db.naturalvoice[senderId] || {};
      const { flags, cleanText } = parseFlags(rawText);

      // 1. Reset Sesi Pengguna
      if (flags.reset || rawText === "--reset") {
        if (global.db.naturalvoice[senderId]) {
          delete global.db.naturalvoice[senderId];
          saveDB();
        }
        return ctx.reply(`– *N A T U R A L  V O I C E  v 6 4*\n\n` +
          `┌ ◦ *Status* : Sesi pengguna berhasil direset.\n` +
          `│ ◦ *Default Speaker* : ${CONFIG.DEFAULT_SPEAKER}\n` +
          `└ ◦ *Pencarian* : Ketik \`${prefix}ttsv64 --list\` untuk melihat ratusan tokoh suara.\n\n` +
          `${botFooter}`);
      }

      // 2. Info Status Suara Aktif
      if (flags.info || rawText === "--info") {
        const activeSpeaker = userSession.speaker || CONFIG.DEFAULT_SPEAKER;
        const activeType = userSession.tts_type || CONFIG.DEFAULT_TTS_TYPE;

        return ctx.reply(`– *N A T U R A L  V O I C E  I N F O*\n\n` +
          `┌ ◦ *Pengguna* : @${senderId.split("@")[0]}\n` +
          `│ ◦ *Speaker Aktif* : ${activeSpeaker}\n` +
          `│ ◦ *Engine Type* : ${activeType.toUpperCase()}\n` +
          `└ ◦ *Sesi Auth* : ${userSession.state ? "Tersimpan ✅" : "Otomatis"}\n\n` +
          `_Ketik \`${prefix}ttsv64 <teks>\` untuk mulai berbicara._\n\n` +
          `${botFooter}`, { mentions: [senderId] });
      }

      // 3. Simpan Speaker Default Pengguna
      if (flags.setvoice) {
        const speakerName = String(flags.setvoice).trim();
        const ttsType = flags.type || (speakerName.toLowerCase().includes("agus") || speakerName.toLowerCase().includes("budi") ? "mimic" : "kokoro");
        const mimicId = flags.mimic || "";

        userSession.speaker = speakerName;
        userSession.tts_type = ttsType;
        if (mimicId) userSession.mimic_speaker = mimicId;
        userSession.updatedAt = Date.now();
        global.db.naturalvoice[senderId] = userSession;
        saveDB();

        await ctx.react("✅");
        return ctx.reply(`– *P R E S E T  S U A R A*\n\n` +
          `┌ ◦ *Karakter* : ${speakerName}\n` +
          `│ ◦ *Engine* : ${ttsType.toUpperCase()}\n` +
          `└ ◦ *Status* : Tersimpan sebagai suara aktif Anda.\n\n` +
          `_Ketik \`${prefix}ttsv64 <teks>\` untuk berbicara dengan suara ini._\n\n` +
          `${botFooter}`);
      }

      // 4. Daftar & Pencarian Suara (Search & List)
      if (flags.list || flags.search || rawText.startsWith("--list") || rawText.startsWith("--search") || flags.page) {
        await ctx.react("🔍");
        const searchQuery = typeof flags.search === "string" ? flags.search : (typeof flags.list === "string" ? flags.list : cleanText);

        const voiceData = await requestNaturalVoiceAPI("voice_list", {
          state: userSession.state || undefined,
          lang: flags.lang || undefined,
          gender: flags.gender || undefined,
          type: flags.type || undefined,
          search: searchQuery && searchQuery !== "true" ? searchQuery : undefined
        });

        if (voiceData.state) {
          userSession.state = voiceData.state;
          global.db.naturalvoice[senderId] = userSession;
          saveDB();
        }

        const voices = voiceData?.result?.voices || [];
        if (!voices.length) {
          await ctx.react("❌");
          return ctx.reply(`❌ Tidak ditemukan model suara untuk kata kunci "${searchQuery || "semua"}".`);
        }

        const page = Math.max(1, Number(flags.page) || 1);
        const totalPages = Math.ceil(voices.length / CONFIG.ITEMS_PER_PAGE) || 1;
        const pageItems = voices.slice((page - 1) * CONFIG.ITEMS_PER_PAGE, page * CONFIG.ITEMS_PER_PAGE);

        const rows = pageItems.map((v, idx) => {
          const globalIdx = (page - 1) * CONFIG.ITEMS_PER_PAGE + idx + 1;
          const sName = v.speaker.slice(0, 24);
          const country = v.country || "Global";
          const tags = Array.isArray(v.tags) && v.tags.length ? v.tags.join(", ") : v.tts_type;
          const mimicParam = v.mimic_speaker ? ` --mimic "${v.mimic_speaker}"` : "";

          return {
            title: `${globalIdx}. ${sName}`,
            id: `${prefix}ttsv64 --setvoice "${v.speaker}" --type "${v.tts_type}"${mimicParam}`,
            description: `${v.gender || "Voice"} • ${country} • ${tags}`.slice(0, 60)
          };
        });

        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: `PILIH KARAKTER SUARA (${pageItems.length})`,
            sections: [{
              title: `DAFTAR MODEL TOKOH (Hal ${page}/${totalPages})`,
              rows: rows
            }]
          })
        }];

        const baseCmd = `${prefix}ttsv64 ${searchQuery && searchQuery !== "true" ? `--search "${searchQuery}"` : "--list"}`;
        if (page > 1) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: `⬅️ Hal ${page - 1}`,
              id: `${baseCmd} --page ${page - 1}`
            })
          });
        }
        if (page < totalPages) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: `➡️ Hal ${page + 1}`,
              id: `${baseCmd} --page ${page + 1}`
            })
          });
        }

        const bodyList = `– *N A T U R A L  V O I C E  L I B R A R Y*\n\n` +
          `┌ ◦ *Total Model* : ${voices.length} Tokoh Suara\n` +
          `│ ◦ *Halaman* : ${page} dari ${totalPages}\n` +
          (searchQuery && searchQuery !== "true" ? `│ ◦ *Pencarian* : "${searchQuery}"\n` : "") +
          `└ ◦ *Engine* : Multi-Engine Neural Audio\n\n` +
          `_Pilih karakter tokoh melalui tombol menu di bawah:_`;

        if (typeof ctx.sendCta === "function") {
          await ctx.sendCta(bodyList, botFooter, buttons, { quoted: quotedMsg });
        } else {
          let textFallback = `${bodyList}\n\n`;
          rows.forEach(r => {
            textFallback += `• *${r.title}*\n  Perintah: \`${r.id}\`\n\n`;
          });
          await ctx.reply(textFallback.trim(), { quoted: quotedMsg });
        }

        await ctx.react("✅");
        return;
      }

      // Deteksi Media Audio bila dikirim / di-quote untuk Voice Cloning
      let audioBuffer = null;
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      const mediaType = ctx.type || ctx.quoted?.type || "";

      if (isMedia && (mediaType.includes("audio") || ctx.quoted?.isAudio)) {
        try {
          audioBuffer = await ctx.download();
        } catch (_) {}
      }

      // 5. Voice Cloning Instan dari Audio
      if (flags.clone || (audioBuffer && cleanText)) {
        const textToClone = cleanText || flags.text;
        if (!textToClone) {
          return ctx.reply(`❌ Masukkan teks yang ingin diucapkan!\nContoh: Balas VN/Audio dengan \`${prefix}ttsv64 Halo dunia --clone\``);
        }

        let audioUrl = flags.audio || null;
        if (audioBuffer && Buffer.isBuffer(audioBuffer)) {
          const up = await upload(audioBuffer).catch(() => null);
          if (up?.url) audioUrl = up.url;
        }

        if (!audioUrl) {
          return ctx.reply(`❌ Harap lampirkan atau balas pesan suara (VN) sebagai sampel kloning suara.`);
        }

        await ctx.react("🎙️");
        const cloneData = await requestNaturalVoiceAPI("create", {
          state: userSession.state || undefined,
          text: textToClone,
          speaker: "Clone",
          type: "cloning",
          cloning_audio_url: audioUrl
        });

        if (cloneData.state) {
          userSession.state = cloneData.state;
          global.db.naturalvoice[senderId] = userSession;
          saveDB();
        }

        const finalAudio = cloneData?.result?.audio_url;
        if (!finalAudio) throw new Error("Gagal memperoleh URL audio kloning.");

        await sendAudioResponse(sock, targetJid, finalAudio, quotedMsg);
        await ctx.react("✨");
        return;
      }

      // 6. Generate Text-to-Speech (TTS)
      const textToSpeak = cleanText || flags.text;

      // Panduan jika tanpa teks & tanpa audio
      if (!textToSpeak) {
        const activeSpeaker = userSession.speaker || CONFIG.DEFAULT_SPEAKER;

        const guideText = `– *N A T U R A L  V O I C E  v 6 4*\n\n` +
          `┌ ◦ *Suara Aktif* : ${activeSpeaker}\n` +
          `└ ◦ *Engine* : Multi-Engine (Kokoro & Mimic)\n\n` +
          `– *P E R I N T A H  U T A M A*\n\n` +
          `┌ ◦ *Bicara (TTS)* :\n│   \`${prefix}ttsv64 Hello world, welcome to the future!\`\n` +
          `├ ◦ *Gunakan Tokoh Dunia* :\n│   \`${prefix}ttsv64 I love Tesla and SpaceX --speaker "Elon Musk"\`\n` +
          `│   \`${prefix}ttsv64 We will make America great --speaker "Donald Trump"\`\n` +
          `│   \`${prefix}ttsv64 I am the night, I am Batman --speaker "Batman"\`\n` +
          `├ ◦ *Suara Bahasa Jawa* :\n│   \`${prefix}ttsv64 Kulo nyuwun pangapunten --speaker "Agus"\`\n` +
          `├ ◦ *Kloning Suara (Clone)* :\n│   Balas VN/Audio: \`${prefix}ttsv64 Halo teman --clone\`\n` +
          `├ ◦ *Daftar Tokoh Suara* :\n│   \`${prefix}ttsv64 --list\` atau \`${prefix}ttsv64 --search "Trump"\`\n` +
          `├ ◦ *Info Pengaturan* :\n│   \`${prefix}ttsv64 --info\`\n` +
          `└ ◦ *Reset Pengaturan* :\n    \`${prefix}ttsv64 --reset\``;

        return ctx.reply(guideText, { quoted: quotedMsg });
      }

      if (textToSpeak.length > 500) {
        return ctx.reply(`❌ Teks terlalu panjang! Maksimal 500 karakter per permintaan.`);
      }

      await ctx.react("⏳");

      const speakerToUse = flags.speaker || userSession.speaker || CONFIG.DEFAULT_SPEAKER;
      const typeToUse = flags.type || userSession.tts_type || (
        speakerToUse.toLowerCase().includes("agus") ||
        speakerToUse.toLowerCase().includes("budi") ||
        speakerToUse.toLowerCase().includes("joko") ||
        speakerToUse.toLowerCase().includes("mentari") ? "mimic" : CONFIG.DEFAULT_TTS_TYPE
      );
      const mimicToUse = flags.mimic || userSession.mimic_speaker || "";

      const ttsData = await requestNaturalVoiceAPI("create", {
        state: userSession.state || undefined,
        text: textToSpeak,
        speaker: speakerToUse,
        type: typeToUse,
        mimic_speaker: mimicToUse
      });

      if (ttsData.state) {
        userSession.state = ttsData.state;
        global.db.naturalvoice[senderId] = userSession;
        saveDB();
      }

      const audioUrl = ttsData?.result?.audio_url;
      if (!audioUrl) throw new Error("Gagal memperoleh URL audio dari server Natural Voice.");

      await sendAudioResponse(sock, targetJid, audioUrl, quotedMsg);
      await ctx.react("🎙️");

    } catch (error) {
      console.error("[TTSv64 Error]:", error);
      if (typeof ctx.react === "function") await ctx.react("❌");
      const errMsg = error.message || "Terjadi kesalahan saat memproses audio.";
      ctx.reply(`❌ *Kendala Natural Voice v64*: ${errMsg}`);
    }
  }
};