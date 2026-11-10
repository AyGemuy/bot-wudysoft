import axios from "axios";
import db from "../../data/db.js";
import { simpleQuoted } from "../../lib/quoted.js";
import { sendPTT } from "../../lib/audio.js";

const CONFIG = {
  API_URL: `${global.bot?.api?.wudysoft}/api/misc/tts/v62`,
  DEFAULT_SPEAKER_ID: "8",
  DEFAULT_SPEAKER_NAME: "Ava V2",
  DEFAULT_LANG: "th",
  TIMEOUT: 90000,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  ITEMS_PER_PAGE: 6
};

function initDB(jid = null, name = "") {
  try {
    if (!global.db) global.db = {};
    if (!global.db.user) global.db.user = {};
    if (!global.db.botnoi) global.db.botnoi = {};
    if (jid && !global.db.user[jid]) {
      global.db.user[jid] = {
        name: name || "",
        money: 10000,
        exp: 0
      };
    }
  } catch (err) {
    console.error("[TTSv62 initDB Error]:", err?.message || err);
  }
}

function saveDB() {
  try {
    if (typeof db?.write === "function" && global.db) {
      db.write(global.db);
    }
  } catch (err) {
    console.error("[TTSv62 saveDB Error]:", err?.message || err);
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

      if (["v", "voice", "speaker", "id", "model"].includes(key)) key = "speaker";
      if (["s", "search", "q", "query"].includes(key)) key = "search";
      if (["p", "page", "hal"].includes(key)) key = "page";
      if (["l", "lang", "language"].includes(key)) key = "lang";
      if (["spd", "speed", "tempo"].includes(key)) key = "speed";
      if (["ver", "version"].includes(key)) key = "version";
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
    console.error("[TTSv62 parseFlags Error]:", err?.message || err);
    return { flags: {}, cleanText: rawStr };
  }
}

async function requestBotnoiAPI(action, payload = {}) {
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
      throw new Error(data?.error || data?.result?.error || "Gagal memproses permintaan suara ke Botnoi API.");
    }
    return data;
  } catch (err) {
    const errMsg = err.response?.data?.error || err.response?.data?.result?.error || err.message;
    throw new Error(errMsg || "Terjadi kendala jaringan ke server Botnoi.");
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
    console.error("[TTSv62 sendAudioResponse Error]:", err?.message || err);
    throw err;
  }
}

export default {
  name: "ttsv62",
  aliases: ["botnoi", "thaitts", "voice62", "tts62"],
  description: "AI Text-to-Speech Botnoi Voice Engine v62 (Thai & English Multi-Speaker)",
  category: "AI",
  limit: true,
  example: "ttsv62 สวัสดีครับ --speaker 8 atau ttsv62 Hello world --speaker 4 --speed 1.2",

  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "Botnoi AI";
    const botFooter = `${botName} • Botnoi Voice v62`;
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
    const targetJid = ctx.chat || ctx.id;
    const senderId = ctx.sender || ctx.author || msg.key?.participant || msg.key?.remoteJid || ctx.id;

    try {
      initDB(senderId, ctx.pushName);

      let rawText = (ctx.query || "").trim();
      if (!rawText && ctx.quoted?.text) rawText = ctx.quoted.text.trim();

      const userSession = global.db.botnoi[senderId] || {};
      const { flags, cleanText } = parseFlags(rawText);

      // 1. Reset Sesi
      if (flags.reset || rawText === "--reset") {
        if (global.db.botnoi[senderId]) {
          delete global.db.botnoi[senderId];
          saveDB();
        }
        return ctx.reply(`– *B O T N O I  V O I C E  v 6 2*\n\n` +
          `┌ ◦ *Status* : Sesi pengguna berhasil direset.\n` +
          `│ ◦ *Default Voice* : ${CONFIG.DEFAULT_SPEAKER_NAME} (ID: ${CONFIG.DEFAULT_SPEAKER_ID})\n` +
          `└ ◦ *Pencarian* : Ketik \`${prefix}ttsv62 --list\` untuk melihat karakter suara lain.\n\n` +
          `${botFooter}`);
      }

      // 2. Info Status Suara Aktif
      if (flags.info || rawText === "--info") {
        const activeId = userSession.speaker_id || CONFIG.DEFAULT_SPEAKER_ID;
        const activeName = userSession.speaker_name || CONFIG.DEFAULT_SPEAKER_NAME;
        const activeLang = userSession.lang || CONFIG.DEFAULT_LANG;
        const activeSpeed = userSession.speed || 1;

        return ctx.reply(`– *B O T N O I  I N F O*\n\n` +
          `┌ ◦ *Pengguna* : @${senderId.split("@")[0]}\n` +
          `│ ◦ *Model Suara* : ${activeName}\n` +
          `│ ◦ *Speaker ID* : \`${activeId}\`\n` +
          `│ ◦ *Language* : ${activeLang.toUpperCase()}\n` +
          `│ ◦ *Kecepatan* : ${activeSpeed}x\n` +
          `└ ◦ *Poin Akun* : ${userSession.points ?? "Auto-renew"}\n\n` +
          `_Ketik \`${prefix}ttsv62 <teks>\` untuk mulai berbicara._\n\n` +
          `${botFooter}`, { mentions: [senderId] });
      }

      // 3. Simpan Speaker Default Pengguna
      if (flags.setvoice) {
        const speakerId = String(flags.setvoice).trim();
        const speakerName = flags.name || `Speaker ${speakerId}`;
        userSession.speaker_id = speakerId;
        userSession.speaker_name = speakerName;
        userSession.updatedAt = Date.now();
        global.db.botnoi[senderId] = userSession;
        saveDB();

        await ctx.react("✅");
        return ctx.reply(`– *B O T N O I  P R E S E T*\n\n` +
          `┌ ◦ *Karakter* : ${speakerName}\n` +
          `│ ◦ *Speaker ID* : \`${speakerId}\`\n` +
          `└ ◦ *Status* : Berhasil disimpan sebagai suara aktif Anda.\n\n` +
          `_Ketik \`${prefix}ttsv62 <teks>\` untuk berbicara dengan suara ini._\n\n` +
          `${botFooter}`);
      }

      // 4. Daftar & Pencarian Suara (Search & List)
      if (flags.list || flags.search || rawText.startsWith("--list") || rawText.startsWith("--search") || flags.page) {
        await ctx.react("🔍");
        const searchQuery = typeof flags.search === "string" ? flags.search : (typeof flags.list === "string" ? flags.list : cleanText);
        const selectedLang = flags.lang || userSession.lang || "th";

        const voiceData = await requestBotnoiAPI("voice_list", {
          state: userSession.state || undefined,
          type: flags.type || "v2",
          lang: selectedLang,
          search: searchQuery && searchQuery !== "true" ? searchQuery : undefined
        });

        if (voiceData.state) {
          userSession.state = voiceData.state;
          global.db.botnoi[senderId] = userSession;
          saveDB();
        }

        const speakers = voiceData?.result?.speakers || [];
        if (!speakers.length) {
          await ctx.react("❌");
          return ctx.reply(`❌ Tidak ditemukan karakter suara untuk kata kunci "${searchQuery || selectedLang}".`);
        }

        const page = Math.max(1, Number(flags.page) || 1);
        const totalPages = Math.ceil(speakers.length / CONFIG.ITEMS_PER_PAGE) || 1;
        const pageItems = speakers.slice((page - 1) * CONFIG.ITEMS_PER_PAGE, page * CONFIG.ITEMS_PER_PAGE);

        const rows = pageItems.map((sp, idx) => {
          const globalIdx = (page - 1) * CONFIG.ITEMS_PER_PAGE + idx + 1;
          const sName = (sp.eng_name || sp.thai_name || `Speaker ${sp.speaker_id}`).slice(0, 24);
          const gender = sp.eng_gender || sp.gender || "Voice";
          const styles = Array.isArray(sp.eng_speech_style) && sp.eng_speech_style.length ? sp.eng_speech_style.join(", ") : (sp.eng_age_style || "Normal");

          return {
            title: `${globalIdx}. ${sName}`,
            id: `${prefix}ttsv62 --setvoice "${sp.speaker_id}" --name "${sName}"`,
            description: `${gender} • ${styles} (ID: ${sp.speaker_id})`.slice(0, 60)
          };
        });

        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: `PILIH KARAKTER SUARA (${pageItems.length})`,
            sections: [{
              title: `DAFTAR MODEL (Hal ${page}/${totalPages})`,
              rows: rows
            }]
          })
        }];

        const baseCmd = `${prefix}ttsv62 ${searchQuery && searchQuery !== "true" ? `--search "${searchQuery}"` : "--list"}`;
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

        const bodyList = `– *B O T N O I  V O I C E  L I B R A R Y*\n\n` +
          `┌ ◦ *Kategori* : ${voiceData?.result?.category || "v2"}\n` +
          `│ ◦ *Total Model* : ${speakers.length} Karakter\n` +
          `│ ◦ *Halaman* : ${page} dari ${totalPages}\n` +
          (searchQuery && searchQuery !== "true" ? `│ ◦ *Pencarian* : "${searchQuery}"\n` : "") +
          `└ ◦ *Engine* : Botnoi AI Voice Synthesis\n\n` +
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
        const activeId = userSession.speaker_id || CONFIG.DEFAULT_SPEAKER_ID;
        const activeName = userSession.speaker_name || CONFIG.DEFAULT_SPEAKER_NAME;

        const guideText = `– *B O T N O I  V O I C E  v 6 2*\n\n` +
          `┌ ◦ *Suara Aktif* : ${activeName} (ID: ${activeId})\n` +
          `└ ◦ *Engine* : Botnoi Neural Audio\n\n` +
          `– *P E R I N T A H  U T A M A*\n\n` +
          `┌ ◦ *Bicara (TTS)* :\n│   \`${prefix}ttsv62 สวัสดีครับ ยินดีที่ได้รู้จัก\`\n` +
          `├ ◦ *Pilih Speaker Khusus* :\n│   \`${prefix}ttsv62 Hello world --speaker 4\`\n` +
          `├ ◦ *Atur Kecepatan (Speed)* :\n│   \`${prefix}ttsv62 <teks> --speed 1.2\`\n` +
          `├ ◦ *Daftar Suara* :\n│   \`${prefix}ttsv62 --list\` atau \`${prefix}ttsv62 --search "Ava"\`\n` +
          `├ ◦ *Cek Info Status* :\n│   \`${prefix}ttsv62 --info\`\n` +
          `└ ◦ *Reset Suara* :\n    \`${prefix}ttsv62 --reset\``;

        return ctx.reply(guideText, { quoted: quotedMsg });
      }

      if (textToSpeak.length > 500) {
        return ctx.reply(`❌ Teks terlalu panjang! Maksimal 500 karakter per permintaan.`);
      }

      await ctx.react("⏳");

      const speakerIdToUse = flags.speaker || userSession.speaker_id || CONFIG.DEFAULT_SPEAKER_ID;
      const speedToUse = flags.speed ? Number(flags.speed) : (userSession.speed || 1);
      const langToUse = flags.lang || userSession.lang || CONFIG.DEFAULT_LANG;

      const ttsData = await requestBotnoiAPI("create", {
        state: userSession.state || undefined,
        text: textToSpeak,
        speaker: String(speakerIdToUse),
        speed: speedToUse,
        version: flags.version || "v2",
        language: langToUse
      });

      if (ttsData.state) {
        userSession.state = ttsData.state;
      }
      if (ttsData.result?.point_left !== undefined) {
        userSession.points = ttsData.result.point_left;
      }
      global.db.botnoi[senderId] = userSession;
      saveDB();

      const audioUrl = ttsData?.result?.audio_url;
      if (!audioUrl) throw new Error("Gagal menerima URL audio dari server Botnoi.");

      await sendAudioResponse(sock, targetJid, audioUrl, quotedMsg);
      await ctx.react("🎙️");

    } catch (error) {
      console.error("[TTSv62 Error]:", error);
      if (typeof ctx.react === "function") await ctx.react("❌");
      const errMsg = error.message || "Terjadi kesalahan saat memproses audio.";
      ctx.reply(`❌ *Kendala Botnoi TTS v62*: ${errMsg}`);
    }
  }
};