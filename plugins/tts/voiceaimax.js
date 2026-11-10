import axios from "axios";
import db from "../../data/db.js";
import { simpleQuoted } from "../../lib/quoted.js";
import { sendPTT } from "../../lib/audio.js";

const CONFIG = {
  API_URL: `${global.bot?.api?.wudysoft}/api/misc/tts/v66`,
  DEFAULT_VOICE_ID: "x5tvfc5X0Qh4cqmLpgrs",
  DEFAULT_VOICE_NAME: "Indonesian HD Voice",
  DEFAULT_LANG: "id",
  TIMEOUT: 120000,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  ITEMS_PER_PAGE: 6
};

function initDB(jid = null, name = "") {
  try {
    if (!global.db) global.db = {};
    if (!global.db.user) global.db.user = {};
    if (!global.db.voiceaimax) global.db.voiceaimax = {};
    if (jid && !global.db.user[jid]) {
      global.db.user[jid] = {
        name: name || "",
        money: 10000,
        exp: 0
      };
    }
  } catch (err) {
    console.error("[TTSv66 initDB Error]:", err?.message || err);
  }
}

function saveDB() {
  try {
    if (typeof db?.write === "function" && global.db) {
      db.write(global.db);
    }
  } catch (err) {
    console.error("[TTSv66 saveDB Error]:", err?.message || err);
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

      if (["v", "voice", "voice_id", "speaker", "id", "model_id"].includes(key)) key = "voice";
      if (["s", "search", "q", "query"].includes(key)) key = "search";
      if (["p", "page", "hal"].includes(key)) key = "page";
      if (["l", "lang", "language"].includes(key)) key = "lang";
      if (["spd", "speed", "tempo"].includes(key)) key = "speed";
      if (["pt", "pitch"].includes(key)) key = "pitch";
      if (["vol", "volume"].includes(key)) key = "vol";
      if (["m", "model"].includes(key)) key = "model";
      if (["credit", "kredit", "saldo"].includes(key)) key = "credit";
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
    console.error("[TTSv66 parseFlags Error]:", err?.message || err);
    return { flags: {}, cleanText: rawStr };
  }
}

async function requestVoiceAiMaxAPI(action, payload = {}) {
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
      throw new Error(data?.error || data?.result?.error_message || "Gagal memproses suara dari VoiceAiMax.");
    }
    return data;
  } catch (err) {
    const errMsg = err.response?.data?.error || err.response?.data?.result?.error_message || err.message;
    throw new Error(errMsg || "Terjadi kendala jaringan ke server VoiceAiMax.");
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
    console.error("[TTSv66 sendAudioResponse Error]:", err?.message || err);
    throw err;
  }
}

export default {
  name: "ttsv66",
  aliases: ["voiceaimax", "aimax", "voice66", "tts66"],
  description: "AI Text-to-Speech Ultra HD VoiceAiMax (Indonesian, English & Multilingual v66)",
  category: "AI",
  limit: true,
  example: "ttsv66 Halo semuanya, selamat datang! --speed 1.0",

  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "VoiceAiMax";
    const botFooter = `${botName} • Speech 2.8 HD v66`;
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
    const targetJid = ctx.chat || ctx.id;
    const senderId = ctx.sender || ctx.author || msg.key?.participant || msg.key?.remoteJid || ctx.id;

    try {
      initDB(senderId, ctx.pushName);

      let rawText = (ctx.query || "").trim();
      if (!rawText && ctx.quoted?.text) rawText = ctx.quoted.text.trim();

      const userSession = global.db.voiceaimax[senderId] || {};
      const { flags, cleanText } = parseFlags(rawText);

      // 1. Reset Sesi
      if (flags.reset || rawText === "--reset") {
        if (global.db.voiceaimax[senderId]) {
          delete global.db.voiceaimax[senderId];
          saveDB();
        }
        return ctx.reply(`– *V O I C E A I M A X  v 6 6*\n\n` +
          `┌ ◦ *Status* : Sesi pengguna berhasil direset.\n` +
          `│ ◦ *Default Voice* : ${CONFIG.DEFAULT_VOICE_NAME} (\`${CONFIG.DEFAULT_VOICE_ID}\`)\n` +
          `└ ◦ *Pencarian* : Ketik \`${prefix}ttsv66 --list\` untuk melihat katalog suara bahasa Indonesia.\n\n` +
          `${botFooter}`);
      }

      // 2. Info Status & Saldo Kredit Akun
      if (flags.info || flags.credit || rawText === "--info" || rawText === "--credit") {
        await ctx.react("⏳");
        const infoData = await requestVoiceAiMaxAPI("info", {
          state: userSession.state || undefined
        }).catch(() => null);

        if (infoData?.state) {
          userSession.state = infoData.state;
          global.db.voiceaimax[senderId] = userSession;
          saveDB();
        }

        const activeId = userSession.voice_id || CONFIG.DEFAULT_VOICE_ID;
        const activeName = userSession.voice_name || CONFIG.DEFAULT_VOICE_NAME;
        const credits = infoData?.result?.credit ?? userSession.state?.credit ?? "Unlimited/Auto";

        return ctx.reply(`– *V O I C E A I M A X  I N F O*\n\n` +
          `┌ ◦ *Pengguna* : @${senderId.split("@")[0]}\n` +
          `│ ◦ *Suara Aktif* : ${activeName}\n` +
          `│ ◦ *Voice ID* : \`${activeId}\`\n` +
          `│ ◦ *Kecepatan* : ${userSession.speed || 1}x\n` +
          `│ ◦ *Pitch* : ${userSession.pitch || 0}\n` +
          `└ ◦ *Kredit Server* : ${credits} Poin\n\n` +
          `_Ketik \`${prefix}ttsv66 <teks>\` untuk mulai berbicara._\n\n` +
          `${botFooter}`, { mentions: [senderId] });
      }

      // 3. Simpan Preset Suara Pengguna
      if (flags.setvoice) {
        const voiceId = String(flags.setvoice).trim();
        const voiceName = flags.name || voiceId;
        userSession.voice_id = voiceId;
        userSession.voice_name = voiceName;
        userSession.updatedAt = Date.now();
        global.db.voiceaimax[senderId] = userSession;
        saveDB();

        await ctx.react("✅");
        return ctx.reply(`– *V O I C E A I M A X  P R E S E T*\n\n` +
          `┌ ◦ *Karakter* : ${voiceName}\n` +
          `│ ◦ *Voice ID* : \`${voiceId}\`\n` +
          `└ ◦ *Status* : Tersimpan sebagai suara default Anda.\n\n` +
          `_Ketik \`${prefix}ttsv66 <teks>\` untuk berbicara dengan suara ini._\n\n` +
          `${botFooter}`);
      }

      // 4. Daftar & Pencarian Suara (Search & List)
      if (flags.list || flags.search || rawText.startsWith("--list") || rawText.startsWith("--search") || flags.page) {
        await ctx.react("🔍");
        const searchQuery = typeof flags.search === "string" ? flags.search : (typeof flags.list === "string" ? flags.list : cleanText);
        const selectedLang = flags.lang || userSession.lang || CONFIG.DEFAULT_LANG;

        let voiceData;
        if (searchQuery && searchQuery !== "true") {
          voiceData = await requestVoiceAiMaxAPI("search", {
            state: userSession.state || undefined,
            q: searchQuery,
            language: selectedLang
          });
        } else {
          voiceData = await requestVoiceAiMaxAPI("list", {
            state: userSession.state || undefined,
            language: selectedLang,
            limit: 60
          });
        }

        if (voiceData.state) {
          userSession.state = voiceData.state;
          global.db.voiceaimax[senderId] = userSession;
          saveDB();
        }

        const voices = voiceData?.result?.voices || [];
        if (!voices.length) {
          await ctx.react("❌");
          return ctx.reply(`❌ Tidak ditemukan model suara untuk kata kunci "${searchQuery || selectedLang}".`);
        }

        const page = Math.max(1, Number(flags.page) || 1);
        const totalPages = Math.ceil(voices.length / CONFIG.ITEMS_PER_PAGE) || 1;
        const pageItems = voices.slice((page - 1) * CONFIG.ITEMS_PER_PAGE, page * CONFIG.ITEMS_PER_PAGE);

        const rows = pageItems.map((v, idx) => {
          const globalIdx = (page - 1) * CONFIG.ITEMS_PER_PAGE + idx + 1;
          const vName = (v.name || v.voice_id).slice(0, 24);
          const gender = v.gender ? v.gender.charAt(0).toUpperCase() + v.gender.slice(1) : "Voice";
          const desc = v.description ? v.description.slice(0, 45) : (v.category || "HD Natural");

          return {
            title: `${globalIdx}. ${vName}`,
            id: `${prefix}ttsv66 --setvoice "${v.voice_id}" --name "${vName}"`,
            description: `${gender} • ${desc} (ID: ${v.voice_id.slice(0, 8)}...)`.slice(0, 60)
          };
        });

        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: `PILIH SUARA HD (${pageItems.length})`,
            sections: [{
              title: `KATALOG SUARA: ${selectedLang.toUpperCase()} (Hal ${page}/${totalPages})`,
              rows: rows
            }]
          })
        }];

        const baseCmd = `${prefix}ttsv66 ${searchQuery && searchQuery !== "true" ? `--search "${searchQuery}"` : "--list"}`;
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

        const bodyList = `– *V O I C E A I M A X  L I B R A R Y*\n\n` +
          `┌ ◦ *Bahasa* : ${selectedLang.toUpperCase()}\n` +
          `│ ◦ *Total Model* : ${voices.length} Suara HD\n` +
          `│ ◦ *Halaman* : ${page} dari ${totalPages}\n` +
          (searchQuery && searchQuery !== "true" ? `│ ◦ *Pencarian* : "${searchQuery}"\n` : "") +
          `└ ◦ *Model Engine* : Speech 2.8 HD\n\n` +
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

        const guideText = `– *V O I C E A I M A X  v 6 6*\n\n` +
          `┌ ◦ *Suara Aktif* : ${activeName}\n` +
          `│ ◦ *Voice ID* : \`${activeId}\`\n` +
          `└ ◦ *Engine* : Speech 2.8 HD Synthesis\n\n` +
          `– *P E R I N T A H  U T A M A*\n\n` +
          `┌ ◦ *Bicara (TTS)* :\n│   \`${prefix}ttsv66 Halo semuanya, selamat beraktivitas!\`\n` +
          `├ ◦ *Gunakan Karakter Lain* :\n│   \`${prefix}ttsv66 <teks> --voice "RWiGLY9uXI70QL540WNd"\`\n` +
          `├ ◦ *Atur Nada & Tempo* :\n│   \`${prefix}ttsv66 <teks> --speed 1.2 --pitch 2\`\n` +
          `├ ◦ *Daftar Suara Bahasa Indonesia* :\n│   \`${prefix}ttsv66 --list\` atau \`${prefix}ttsv66 --search "Putra"\`\n` +
          `├ ◦ *Cek Info & Kredit* :\n│   \`${prefix}ttsv66 --info\`\n` +
          `└ ◦ *Reset Pengaturan* :\n    \`${prefix}ttsv66 --reset\``;

        return ctx.reply(guideText, { quoted: quotedMsg });
      }

      if (textToSpeak.length > 500) {
        return ctx.reply(`❌ Teks terlalu panjang! Maksimal 500 karakter per permintaan.`);
      }

      await ctx.react("⏳");

      const voiceIdToUse = flags.voice || userSession.voice_id || CONFIG.DEFAULT_VOICE_ID;
      const speedToUse = flags.speed ? Number(flags.speed) : (userSession.speed || 1);
      const pitchToUse = flags.pitch ? Number(flags.pitch) : (userSession.pitch || 0);
      const volToUse = flags.vol ? Number(flags.vol) : (userSession.vol || 1);
      const langToUse = flags.lang || userSession.lang || "Indonesian";

      const ttsData = await requestVoiceAiMaxAPI("tts", {
        state: userSession.state || undefined,
        text: textToSpeak,
        voice_id: String(voiceIdToUse),
        speed: speedToUse,
        pitch: pitchToUse,
        vol: volToUse,
        model: flags.model || "speech-2.8-hd",
        language: langToUse
      });

      if (ttsData.state) {
        userSession.state = ttsData.state;
        global.db.voiceaimax[senderId] = userSession;
        saveDB();
      }

      const audioUrl = ttsData?.result?.audio_url;
      if (!audioUrl) throw new Error("Gagal memperoleh tautan audio dari server VoiceAiMax.");

      await sendAudioResponse(sock, targetJid, audioUrl, quotedMsg);
      await ctx.react("🎙️");

    } catch (error) {
      console.error("[TTSv66 Error]:", error);
      if (typeof ctx.react === "function") await ctx.react("❌");
      const errMsg = error.message || "Terjadi kesalahan saat memproses audio.";
      ctx.reply(`❌ *Kendala VoiceAiMax TTS v66*: ${errMsg}`);
    }
  }
};