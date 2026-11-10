import axios from "axios";
import db from "../../data/db.js";
import { simpleQuoted } from "../../lib/quoted.js";
import { sendPTT } from "../../lib/audio.js";

const CONFIG = {
  API_URL: `${global.bot?.api?.wudysoft}/api/misc/tts/v65`,
  DEFAULT_VOICE: "rom",
  DEFAULT_VOICE_NAME: "Rom (Default Multilingual)",
  TIMEOUT: 90000,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  ITEMS_PER_PAGE: 6
};

const PRESET_VOICES = [
  { alias: "rom", id: "2Wb9uItPQ03dluWKNmPG", name: "Rom", desc: "Expressive Male • Multilingual" },
  { alias: "rachel", id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", desc: "Calm & Natural Female" },
  { alias: "brian", id: "nPczCjzI2devNBz1zQrb", name: "Brian", desc: "Deep & Authoritative Male" },
  { alias: "sarah", id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", desc: "Warm & Friendly Female" },
  { alias: "bella", id: "hpp4J3VqNfWAUOO0d1Us", name: "Bella", desc: "Soft & Pleasant Female" },
  { alias: "liam", id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam", desc: "Energetic Young Male" },
  { alias: "charlie", id: "IKne3meq5aSn9XLyUdCD", name: "Charlie", desc: "Casual & Conversational Male" },
  { alias: "george", id: "JBFqnCBsd6RMkjVDRZzb", name: "George", desc: "British Accent Male" },
  { alias: "alice", id: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice", desc: "British Accent Female" },
  { alias: "voen", id: "DJ74E8GS3xm0DR7wPOJU", name: "Voen", desc: "Clear & Crisp Character" },
  { alias: "tik", id: "OVFLaU4IcWuinLuKLwGl", name: "Tik", desc: "Social Media Style" },
  { alias: "rtx", id: "gI4iWOHRVnpQVbTIGOj2", name: "RTX", desc: "Gaming & Modern Voice" }
];

function initDB(jid = null, name = "") {
  try {
    if (!global.db) global.db = {};
    if (!global.db.user) global.db.user = {};
    if (!global.db.elevenlabs) global.db.elevenlabs = {};
    if (jid && !global.db.user[jid]) {
      global.db.user[jid] = {
        name: name || "",
        money: 10000,
        exp: 0
      };
    }
  } catch (err) {
    console.error("[TTSv65 initDB Error]:", err?.message || err);
  }
}

function saveDB() {
  try {
    if (typeof db?.write === "function" && global.db) {
      db.write(global.db);
    }
  } catch (err) {
    console.error("[TTSv65 saveDB Error]:", err?.message || err);
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
      if (["bal", "balance", "quota", "kuota"].includes(key)) key = "balance";
      if (["stab", "stability"].includes(key)) key = "stability";
      if (["sim", "similarity"].includes(key)) key = "similarity";
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
    console.error("[TTSv65 parseFlags Error]:", err?.message || err);
    return { flags: {}, cleanText: rawStr };
  }
}

async function requestElevenLabsAPI(action, payload = {}, isBinary = false) {
  try {
    const response = await axios({
      method: "POST",
      url: CONFIG.API_URL,
      data: { action, ...payload },
      headers: {
        "Content-Type": "application/json",
        "User-Agent": CONFIG.USER_AGENT
      },
      responseType: isBinary ? "arraybuffer" : "json",
      timeout: CONFIG.TIMEOUT,
      validateStatus: () => true
    });

    if (isBinary) {
      const contentType = response.headers?.["content-type"] || "";
      if (contentType.includes("application/json")) {
        const jsonText = Buffer.from(response.data).toString("utf-8");
        const parsed = JSON.parse(jsonText);
        throw new Error(parsed?.error || parsed?.result || "Gagal memproses audio.");
      }
      return {
        isBuffer: true,
        buffer: Buffer.from(response.data)
      };
    }

    if (response.status >= 400 || response.data?.status === false || response.data?.status === "error") {
      throw new Error(response.data?.error || response.data?.result || `HTTP Error ${response.status}`);
    }

    return response.data;
  } catch (err) {
    console.error("[TTSv65 requestElevenLabsAPI Error]:", err?.message || err);
    throw err;
  }
}

async function sendAudioResponse(sock, targetJid, audioBuffer, quotedMsg) {
  try {
    if (typeof sendPTT === "function") {
      try {
        await sendPTT(sock, targetJid, audioBuffer, quotedMsg);
        return;
      } catch (_) {}
    }

    await sock.sendMessage(targetJid, {
      audio: audioBuffer,
      mimetype: "audio/mp4",
      ptt: true
    }, { quoted: quotedMsg });
  } catch (err) {
    console.error("[TTSv65 sendAudioResponse Error]:", err?.message || err);
    throw err;
  }
}

export default {
  name: "ttsv65",
  aliases: ["eleven", "elevenlabs", "voice65", "tts65"],
  description: "AI Text-to-Speech Ultra-Realistis ElevenLabs Multilingual v2",
  category: "AI",
  limit: true,
  example: "ttsv65 Halo semuanya, selamat pagi! --voice rachel",

  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "ElevenLabs AI";
    const botFooter = `${botName} • ElevenLabs v65`;
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
    const targetJid = ctx.chat || ctx.id;
    const senderId = ctx.sender || ctx.author || msg.key?.participant || msg.key?.remoteJid || ctx.id;

    try {
      initDB(senderId, ctx.pushName);

      let rawText = (ctx.query || "").trim();
      if (!rawText && ctx.quoted?.text) rawText = ctx.quoted.text.trim();

      const userSession = global.db.elevenlabs[senderId] || {};
      const { flags, cleanText } = parseFlags(rawText);

      // 1. Reset Sesi
      if (flags.reset || rawText === "--reset") {
        if (global.db.elevenlabs[senderId]) {
          delete global.db.elevenlabs[senderId];
          saveDB();
        }
        return ctx.reply(`– *E L E V E N L A B S  v 6 5*\n\n` +
          `┌ ◦ *Status* : Sesi pengguna berhasil direset.\n` +
          `│ ◦ *Default Voice* : ${CONFIG.DEFAULT_VOICE_NAME}\n` +
          `└ ◦ *Pilihan Suara* : Ketik \`${prefix}ttsv65 --list\` untuk melihat karakter suara lain.\n\n` +
          `${botFooter}`);
      }

      // 2. Cek Sisa Kuota Karakter (Balance)
      if (flags.balance || rawText === "--balance") {
        await ctx.react("💰");
        const balData = await requestElevenLabsAPI("balance");
        const bal = balData?.result || {};

        return ctx.reply(`– *E L E V E N L A B S  Q U O T A*\n\n` +
          `┌ ◦ *Tier Akun* : ${bal.tier || "Free"}\n` +
          `│ ◦ *Sisa Kuota* : *${bal.remaining_characters?.toLocaleString("id-ID") ?? "-"}* Karakter\n` +
          `│ ◦ *Total Terpakai* : ${bal.character_count?.toLocaleString("id-ID") ?? "-"} / ${bal.character_limit?.toLocaleString("id-ID") ?? "-"}\n` +
          `└ ◦ *Status Kunci* : ${bal.status || "Aktif ✅"}\n\n` +
          `${botFooter}`, { quoted: quotedMsg });
      }

      // 3. Info Status Suara Aktif
      if (flags.info || rawText === "--info") {
        const activeVoice = userSession.voice || CONFIG.DEFAULT_VOICE;
        const activeName = userSession.voice_name || CONFIG.DEFAULT_VOICE_NAME;

        return ctx.reply(`– *E L E V E N L A B S  I N F O*\n\n` +
          `┌ ◦ *Pengguna* : @${senderId.split("@")[0]}\n` +
          `│ ◦ *Karakter Suara* : ${activeName} (\`${activeVoice}\`)\n` +
          `│ ◦ *Stability* : ${userSession.stability || 0.5}\n` +
          `│ ◦ *Similarity Boost* : ${userSession.similarity || 0.75}\n` +
          `└ ◦ *Model Engine* : Eleven Multilingual v2\n\n` +
          `_Ketik \`${prefix}ttsv65 <teks>\` untuk mulai berbicara._\n\n` +
          `${botFooter}`, { mentions: [senderId] });
      }

      // 4. Simpan Suara Default Pengguna
      if (flags.setvoice) {
        const voiceInput = String(flags.setvoice).toLowerCase().trim();
        const found = PRESET_VOICES.find(p => p.alias === voiceInput || p.id === voiceInput || p.name.toLowerCase() === voiceInput);
        const voiceAlias = found ? found.alias : voiceInput;
        const voiceName = found ? found.name : (flags.name || voiceInput);

        userSession.voice = voiceAlias;
        userSession.voice_name = voiceName;
        userSession.updatedAt = Date.now();
        global.db.elevenlabs[senderId] = userSession;
        saveDB();

        await ctx.react("✅");
        return ctx.reply(`– *E L E V E N L A B S  P R E S E T*\n\n` +
          `┌ ◦ *Karakter* : ${voiceName}\n` +
          `│ ◦ *Voice Code* : \`${voiceAlias}\`\n` +
          `└ ◦ *Status* : Tersimpan sebagai suara default Anda.\n\n` +
          `_Ketik \`${prefix}ttsv65 <teks>\` untuk berbicara dengan suara ini._\n\n` +
          `${botFooter}`);
      }

      // 5. Daftar & Pencarian Suara (Search & List)
      if (flags.list || flags.search || rawText.startsWith("--list") || rawText.startsWith("--search") || flags.page) {
        await ctx.react("🔍");
        const searchQuery = typeof flags.search === "string" ? flags.search : (typeof flags.list === "string" ? flags.list : cleanText);
        let voices = [...PRESET_VOICES];

        if (searchQuery && searchQuery !== "true") {
          const q = searchQuery.toLowerCase();
          voices = voices.filter(v => v.alias.includes(q) || v.name.toLowerCase().includes(q) || v.desc.toLowerCase().includes(q));
          // Jika tidak ada di preset lokal, coba cari di server ElevenLabs
          if (!voices.length) {
            const apiVoices = await requestElevenLabsAPI("voices", { query: searchQuery }).catch(() => null);
            if (apiVoices?.voices?.length) {
              voices = apiVoices.voices.map(v => ({
                alias: v.voice_id,
                id: v.voice_id,
                name: v.name,
                desc: `${v.category || "Voice"} • ${v.language || "en"}`
              }));
            }
          }
        }

        if (!voices.length) {
          await ctx.react("❌");
          return ctx.reply(`❌ Tidak ditemukan model suara dengan kata kunci "${searchQuery}".`);
        }

        const page = Math.max(1, Number(flags.page) || 1);
        const totalPages = Math.ceil(voices.length / CONFIG.ITEMS_PER_PAGE) || 1;
        const pageItems = voices.slice((page - 1) * CONFIG.ITEMS_PER_PAGE, page * CONFIG.ITEMS_PER_PAGE);

        const rows = pageItems.map((v, idx) => {
          const globalIdx = (page - 1) * CONFIG.ITEMS_PER_PAGE + idx + 1;
          return {
            title: `${globalIdx}. ${v.name}`,
            id: `${prefix}ttsv65 --setvoice "${v.alias}" --name "${v.name}"`,
            description: `${v.desc} (Kode: ${v.alias})`.slice(0, 60)
          };
        });

        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: `PILIH KARAKTER SUARA (${pageItems.length})`,
            sections: [{
              title: `DAFTAR MODEL ELEVENLABS (Hal ${page}/${totalPages})`,
              rows: rows
            }]
          })
        }];

        const baseCmd = `${prefix}ttsv65 ${searchQuery && searchQuery !== "true" ? `--search "${searchQuery}"` : "--list"}`;
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

        const bodyList = `– *E L E V E N L A B S  V O I C E S*\n\n` +
          `┌ ◦ *Total Model* : ${voices.length} Karakter Suara\n` +
          `│ ◦ *Halaman* : ${page} dari ${totalPages}\n` +
          (searchQuery && searchQuery !== "true" ? `│ ◦ *Pencarian* : "${searchQuery}"\n` : "") +
          `└ ◦ *Model* : ElevenLabs Multilingual v2\n\n` +
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

      // 6. Generate Text-to-Speech (TTS)
      const textToSpeak = cleanText || flags.text;

      // Panduan jika tanpa teks
      if (!textToSpeak) {
        const activeVoice = userSession.voice || CONFIG.DEFAULT_VOICE;
        const activeName = userSession.voice_name || CONFIG.DEFAULT_VOICE_NAME;

        const guideText = `– *E L E V E N L A B S  T T S  v 6 5*\n\n` +
          `┌ ◦ *Suara Aktif* : ${activeName} (\`${activeVoice}\`)\n` +
          `└ ◦ *Engine* : ElevenLabs Multilingual v2\n\n` +
          `– *P E R I N T A H  U T A M A*\n\n` +
          `┌ ◦ *Bicara (TTS)* :\n│   \`${prefix}ttsv65 Halo semuanya, apa kabar hari ini?\`\n` +
          `├ ◦ *Gunakan Karakter Lain* :\n│   \`${prefix}ttsv65 <teks> --voice rachel\`\n` +
          `│   \`${prefix}ttsv65 <teks> --voice brian\`\n` +
          `│   \`${prefix}ttsv65 <teks> --voice bella\`\n` +
          `├ ◦ *Daftar Semua Karakter* :\n│   \`${prefix}ttsv65 --list\`\n` +
          `├ ◦ *Cek Sisa Kuota Karakter* :\n│   \`${prefix}ttsv65 --balance\`\n` +
          `├ ◦ *Cek Info Pengaturan* :\n│   \`${prefix}ttsv65 --info\`\n` +
          `└ ◦ *Reset Pengaturan* :\n    \`${prefix}ttsv65 --reset\``;

        return ctx.reply(guideText, { quoted: quotedMsg });
      }

      if (textToSpeak.length > 500) {
        return ctx.reply(`❌ Teks terlalu panjang! Maksimal 500 karakter per permintaan.`);
      }

      await ctx.react("⏳");

      const voiceToUse = flags.voice || userSession.voice || CONFIG.DEFAULT_VOICE;
      const stabilityToUse = flags.stability !== undefined ? Number(flags.stability) : (userSession.stability ?? 0.5);
      const similarityToUse = flags.similarity !== undefined ? Number(flags.similarity) : (userSession.similarity ?? 0.75);

      // Gunakan raw=true agar API langsung mengembalikan binary audio mp3
      const audioResult = await requestElevenLabsAPI("generate", {
        text: textToSpeak,
        voice: String(voiceToUse),
        stability: stabilityToUse,
        similarity_boost: similarityToUse,
        raw: "true"
      }, true);

      if (!audioResult?.buffer) throw new Error("Gagal menerima file audio dari ElevenLabs.");

      await sendAudioResponse(sock, targetJid, audioResult.buffer, quotedMsg);
      await ctx.react("🎙️");

    } catch (error) {
      console.error("[TTSv65 Error]:", error);
      if (typeof ctx.react === "function") await ctx.react("❌");
      const errMsg = error.message || "Terjadi kesalahan saat memproses audio.";
      ctx.reply(`❌ *Kendala ElevenLabs TTS v65*: ${errMsg}`);
    }
  }
};