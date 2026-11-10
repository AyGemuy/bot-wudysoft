import axios from "axios";
import db from "../../data/db.js";
import { simpleQuoted } from "../../lib/quoted.js";
import { sendPTT } from "../../lib/audio.js";

const CONFIG = {
  API_URL: `${global.bot?.api?.wudysoft}/api/misc/tts/v63`,
  DEFAULT_VOICE_ID: "af_heart",
  DEFAULT_VOICE_NAME: "Heart (US Female)",
  TIMEOUT: 90000,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  ITEMS_PER_PAGE: 6
};

function initDB(jid = null, name = "") {
  try {
    if (!global.db) global.db = {};
    if (!global.db.user) global.db.user = {};
    if (!global.db.voiceclone) global.db.voiceclone = {};
    if (jid && !global.db.user[jid]) {
      global.db.user[jid] = {
        name: name || "",
        money: 10000,
        exp: 0
      };
    }
  } catch (err) {
    console.error("[TTSv63 initDB Error]:", err?.message || err);
  }
}

function saveDB() {
  try {
    if (typeof db?.write === "function" && global.db) {
      db.write(global.db);
    }
  } catch (err) {
    console.error("[TTSv63 saveDB Error]:", err?.message || err);
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

      if (["v", "voice", "voice_id", "speaker", "model"].includes(key)) key = "voice";
      if (["s", "search", "q", "query"].includes(key)) key = "search";
      if (["p", "page", "hal"].includes(key)) key = "page";
      if (["l", "lang", "language"].includes(key)) key = "lang";
      if (["g", "gender", "jeniskelamin"].includes(key)) key = "gender";
      if (["spd", "speed", "tempo"].includes(key)) key = "speed";
      if (["set", "setvoice"].includes(key)) key = "setvoice";
      if (["quota", "usage", "kuota"].includes(key)) key = "quota";

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
    console.error("[TTSv63 parseFlags Error]:", err?.message || err);
    return { flags: {}, cleanText: rawStr };
  }
}

async function requestVoiceCloneAPI(action, payload = {}) {
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
      throw new Error(data?.error || data?.result?.error || "Gagal memproses permintaan audio.");
    }
    return data;
  } catch (err) {
    const errMsg = err.response?.data?.error || err.response?.data?.result?.error || err.message;
    throw new Error(errMsg || "Terjadi kendala jaringan ke server VoiceClone.");
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
    console.error("[TTSv63 sendAudioResponse Error]:", err?.message || err);
    throw err;
  }
}

export default {
  name: "ttsv63",
  aliases: ["voiceclone", "kokoro", "voice63", "tts63"],
  description: "AI Text-to-Speech Alami & Realistis (Kokoro Engine v63 - US/UK English)",
  category: "AI",
  limit: true,
  example: "ttsv63 Hello, have a wonderful day! --voice af_heart",

  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "Kokoro AI";
    const botFooter = `${botName} • VoiceClone TTS v63`;
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
    const targetJid = ctx.chat || ctx.id;
    const senderId = ctx.sender || ctx.author || msg.key?.participant || msg.key?.remoteJid || ctx.id;

    try {
      initDB(senderId, ctx.pushName);

      let rawText = (ctx.query || "").trim();
      if (!rawText && ctx.quoted?.text) rawText = ctx.quoted.text.trim();

      const userSession = global.db.voiceclone[senderId] || {};
      const { flags, cleanText } = parseFlags(rawText);

      // 1. Reset Sesi Pengguna
      if (flags.reset || rawText === "--reset") {
        if (global.db.voiceclone[senderId]) {
          delete global.db.voiceclone[senderId];
          saveDB();
        }
        return ctx.reply(`– *V O I C E C L O N E  v 6 3*\n\n` +
          `┌ ◦ *Status* : Sesi pengguna berhasil direset.\n` +
          `│ ◦ *Default Voice* : ${CONFIG.DEFAULT_VOICE_NAME} (\`${CONFIG.DEFAULT_VOICE_ID}\`)\n` +
          `└ ◦ *Pencarian* : Ketik \`${prefix}ttsv63 --list\` untuk melihat daftar model suara natural.\n\n` +
          `${botFooter}`);
      }

      // 2. Info Status & Kuota Pengguna
      if (flags.info || flags.quota || rawText === "--info" || rawText === "--quota") {
        await ctx.react("⏳");
        const usageData = await requestVoiceCloneAPI("usage", {
          state: userSession.state || undefined
        }).catch(() => null);

        if (usageData?.state) {
          userSession.state = usageData.state;
          global.db.voiceclone[senderId] = userSession;
          saveDB();
        }

        const activeId = userSession.voice_id || CONFIG.DEFAULT_VOICE_ID;
        const activeName = userSession.voice_name || CONFIG.DEFAULT_VOICE_NAME;
        const remMinutes = usageData?.result?.remaining_minutes ?? userSession.remaining_minutes ?? 0.5;

        return ctx.reply(`– *V O I C E C L O N E  I N F O*\n\n` +
          `┌ ◦ *Pengguna* : @${senderId.split("@")[0]}\n` +
          `│ ◦ *Suara Aktif* : ${activeName}\n` +
          `│ ◦ *Voice ID* : \`${activeId}\`\n` +
          `│ ◦ *Kecepatan* : ${userSession.speed || 1}x\n` +
          `└ ◦ *Sisa Kuota* : ±${Number(remMinutes).toFixed(2)} Menit (Auto-Renew)\n\n` +
          `_Ketik \`${prefix}ttsv63 <teks>\` untuk mulai berbicara._\n\n` +
          `${botFooter}`, { mentions: [senderId] });
      }

      // 3. Simpan Preset Suara Pengguna
      if (flags.setvoice) {
        const voiceId = String(flags.setvoice).trim();
        const voiceName = flags.name || voiceId;
        userSession.voice_id = voiceId;
        userSession.voice_name = voiceName;
        userSession.updatedAt = Date.now();
        global.db.voiceclone[senderId] = userSession;
        saveDB();

        await ctx.react("✅");
        return ctx.reply(`– *V O I C E C L O N E  P R E S E T*\n\n` +
          `┌ ◦ *Model Suara* : ${voiceName}\n` +
          `│ ◦ *Voice ID* : \`${voiceId}\`\n` +
          `└ ◦ *Status* : Tersimpan sebagai suara default Anda.\n\n` +
          `_Ketik \`${prefix}ttsv63 <teks>\` untuk berbicara dengan suara ini._\n\n` +
          `${botFooter}`);
      }

      // 4. Daftar & Pencarian Suara (Search & List)
      if (flags.list || flags.search || rawText.startsWith("--list") || rawText.startsWith("--search") || flags.page) {
        await ctx.react("🔍");
        const searchQuery = typeof flags.search === "string" ? flags.search : (typeof flags.list === "string" ? flags.list : cleanText);

        const voiceData = await requestVoiceCloneAPI("voice_list", {
          state: userSession.state || undefined,
          language: flags.lang || undefined,
          gender: flags.gender || undefined,
          search: searchQuery && searchQuery !== "true" ? searchQuery : undefined
        });

        if (voiceData.state) {
          userSession.state = voiceData.state;
          global.db.voiceclone[senderId] = userSession;
          saveDB();
        }

        const voices = voiceData?.result?.voices || [];
        if (!voices.length) {
          await ctx.react("❌");
          return ctx.reply(`❌ Tidak ditemukan model suara untuk kata kunci "${searchQuery || "all"}".`);
        }

        const page = Math.max(1, Number(flags.page) || 1);
        const totalPages = Math.ceil(voices.length / CONFIG.ITEMS_PER_PAGE) || 1;
        const pageItems = voices.slice((page - 1) * CONFIG.ITEMS_PER_PAGE, page * CONFIG.ITEMS_PER_PAGE);

        const rows = pageItems.map((v, idx) => {
          const globalIdx = (page - 1) * CONFIG.ITEMS_PER_PAGE + idx + 1;
          const vName = (v.name || v.id).slice(0, 24);
          const accent = v.accent ? `${v.accent.toUpperCase()}` : (v.language || "EN");
          const gender = v.gender ? v.gender.charAt(0).toUpperCase() + v.gender.slice(1) : "Voice";

          return {
            title: `${globalIdx}. ${vName}`,
            id: `${prefix}ttsv63 --setvoice "${v.id}" --name "${vName}"`,
            description: `${gender} • ${accent} (ID: ${v.id})`.slice(0, 60)
          };
        });

        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: `PILIH MODEL SUARA (${pageItems.length})`,
            sections: [{
              title: `DAFTAR SUARA KOKORO (Hal ${page}/${totalPages})`,
              rows: rows
            }]
          })
        }];

        const baseCmd = `${prefix}ttsv63 ${searchQuery && searchQuery !== "true" ? `--search "${searchQuery}"` : "--list"}`;
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

        const bodyList = `– *V O I C E C L O N E  L I B R A R Y*\n\n` +
          `┌ ◦ *Total Model* : ${voices.length} Suara Alami\n` +
          `│ ◦ *Halaman* : ${page} dari ${totalPages}\n` +
          (searchQuery && searchQuery !== "true" ? `│ ◦ *Pencarian* : "${searchQuery}"\n` : "") +
          `└ ◦ *Engine* : Kokoro-82M Natural Voice\n\n` +
          `_Pilih karakter suara melalui tombol menu di bawah:_`;

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

      // 5. Generate Text-to-Speech (TTS)
      const textToSpeak = cleanText || flags.text;

      // Panduan jika tanpa teks
      if (!textToSpeak) {
        const activeId = userSession.voice_id || CONFIG.DEFAULT_VOICE_ID;
        const activeName = userSession.voice_name || CONFIG.DEFAULT_VOICE_NAME;

        const guideText = `– *V O I C E C L O N E  T T S  v 6 3*\n\n` +
          `┌ ◦ *Suara Aktif* : ${activeName}\n` +
          `│ ◦ *Voice ID* : \`${activeId}\`\n` +
          `└ ◦ *Engine* : Kokoro-82M Neural Model\n\n` +
          `– *P E R I N T A H  U T A M A*\n\n` +
          `┌ ◦ *Bicara (TTS)* :\n│   \`${prefix}ttsv63 Hello, this is a human-like voice!\`\n` +
          `├ ◦ *Ganti Karakter Suara* :\n│   \`${prefix}ttsv63 <teks> --voice am_adam\`\n` +
          `├ ◦ *Atur Kecepatan (Speed)* :\n│   \`${prefix}ttsv63 <teks> --speed 1.2\`\n` +
          `├ ◦ *Daftar Suara* :\n│   \`${prefix}ttsv63 --list\` atau \`${prefix}ttsv63 --search "female"\`\n` +
          `├ ◦ *Cek Kuota & Info* :\n│   \`${prefix}ttsv63 --info\`\n` +
          `└ ◦ *Reset Pengaturan* :\n    \`${prefix}ttsv63 --reset\``;

        return ctx.reply(guideText, { quoted: quotedMsg });
      }

      if (textToSpeak.length > 500) {
        return ctx.reply(`❌ Teks terlalu panjang! Maksimal 500 karakter per permintaan.`);
      }

      await ctx.react("⏳");

      const voiceIdToUse = flags.voice || userSession.voice_id || CONFIG.DEFAULT_VOICE_ID;
      const speedToUse = flags.speed ? Number(flags.speed) : (userSession.speed || 1);

      const ttsData = await requestVoiceCloneAPI("create", {
        state: userSession.state || undefined,
        text: textToSpeak,
        voice_id: String(voiceIdToUse),
        speed: speedToUse
      });

      if (ttsData.state) {
        userSession.state = ttsData.state;
      }
      if (ttsData.result?.remaining_minutes !== undefined) {
        userSession.remaining_minutes = ttsData.result.remaining_minutes;
      }
      global.db.voiceclone[senderId] = userSession;
      saveDB();

      const audioUrl = ttsData?.result?.audio_url;
      if (!audioUrl) throw new Error("Gagal memperoleh URL audio hasil generate.");

      await sendAudioResponse(sock, targetJid, audioUrl, quotedMsg);
      await ctx.react("🎙️");

    } catch (error) {
      console.error("[TTSv63 Error]:", error);
      if (typeof ctx.react === "function") await ctx.react("❌");
      const errMsg = error.message || "Terjadi kesalahan saat memproses audio.";
      ctx.reply(`❌ *Kendala VoiceClone TTS v63*: ${errMsg}`);
    }
  }
};