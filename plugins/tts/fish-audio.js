import axios from "axios";
import db from "../../data/db.js";
import { simpleQuoted } from "../../lib/quoted.js";
import { sendPTT } from "../../lib/audio.js";
import { upload } from "../../lib/upload.js";

const CONFIG = {
  API_URL: `${global.bot?.api?.wudysoft}/api/misc/tts/v61`,
  DEFAULT_VOICE_ID: "5196af35f6ff4a0dbf541793fc9f2157",
  DEFAULT_VOICE_NAME: "Donald Trump",
  TIMEOUT: 90000,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  ITEMS_PER_PAGE: 6
};

function initDB(jid = null, name = "") {
  try {
    if (!global.db) global.db = {};
    if (!global.db.user) global.db.user = {};
    if (!global.db.ttsv61) global.db.ttsv61 = {};
    if (jid && !global.db.user[jid]) {
      global.db.user[jid] = {
        name: name || "",
        money: 10000,
        exp: 0
      };
    }
  } catch (err) {
    console.error("[TTSv61 initDB Error]:", err?.message || err);
  }
}

function saveDB() {
  try {
    if (typeof db?.write === "function" && global.db) {
      db.write(global.db);
    }
  } catch (err) {
    console.error("[TTSv61 saveDB Error]:", err?.message || err);
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

      if (["v", "voice", "voice_id", "id", "model"].includes(key)) key = "voice";
      if (["s", "search", "q", "query"].includes(key)) key = "search";
      if (["p", "page", "hal"].includes(key)) key = "page";
      if (["l", "lang", "language"].includes(key)) key = "lang";
      if (["c", "clone", "cloning"].includes(key)) key = "clone";
      if (["t", "transcribe", "stt"].includes(key)) key = "transcribe";
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
    console.error("[TTSv61 parseFlags Error]:", err?.message || err);
    return { flags: {}, cleanText: rawStr };
  }
}

async function requestVocalisAPI(action, payload = {}, isBinary = false) {
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
        throw new Error(parsed?.error || "Gagal memproses audio dari server.");
      }
      return {
        isBuffer: true,
        buffer: Buffer.from(response.data),
        mime: contentType || "audio/mpeg"
      };
    }

    if (response.status >= 400 || !response.data?.status) {
      throw new Error(response.data?.error || response.data?.message || `HTTP Error ${response.status}`);
    }

    return response.data;
  } catch (err) {
    console.error("[TTSv61 requestVocalisAPI Error]:", err?.message || err);
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
    console.error("[TTSv61 sendAudioResponse Error]:", err?.message || err);
    throw err;
  }
}

export default {
  name: "ttsv61",
  aliases: ["vocalis", "fishaudio", "voice61", "tts61"],
  description: "AI Text-to-Speech & Voice Clone dengan ribuan model suara (Fish Audio Engine v61)",
  category: "AI",
  limit: true,
  example: "ttsv61 Hello America --voice 5196af35f6ff4a0dbf541793fc9f2157",

  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "Vocalis AI";
    const botFooter = `${botName} • Fish Audio v61`;
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
    const targetJid = ctx.chat || ctx.id;
    const senderId = ctx.sender || ctx.author || msg.key?.participant || msg.key?.remoteJid || ctx.id;

    try {
      initDB(senderId, ctx.pushName);

      let rawText = (ctx.query || "").trim();
      if (!rawText && ctx.quoted?.text) rawText = ctx.quoted.text.trim();

      const userSession = global.db.ttsv61[senderId] || {};
      const { flags, cleanText } = parseFlags(rawText);

      // 1. Reset Sesi Pengguna
      if (flags.reset || rawText === "--reset") {
        if (global.db.ttsv61[senderId]) {
          delete global.db.ttsv61[senderId];
          saveDB();
        }
        return ctx.reply(`– *V O C A L I S  T T S  v 6 1*\n\n` +
          `┌ ◦ *Status* : Sesi suara pengguna berhasil direset.\n` +
          `│ ◦ *Default Voice* : ${CONFIG.DEFAULT_VOICE_NAME}\n` +
          `└ ◦ *Pencarian* : Ketik \`${prefix}ttsv61 --search <nama_tokoh>\` untuk mencari suara lain.\n\n` +
          `${botFooter}`);
      }

      // 2. Info Suara Aktif
      if (flags.info || rawText === "--info") {
        const activeId = userSession.voice_id || CONFIG.DEFAULT_VOICE_ID;
        const activeName = userSession.voice_name || CONFIG.DEFAULT_VOICE_NAME;
        return ctx.reply(`– *V O C A L I S  I N F O*\n\n` +
          `┌ ◦ *Pengguna* : @${senderId.split("@")[0]}\n` +
          `│ ◦ *Model Suara* : ${activeName}\n` +
          `└ ◦ *Voice ID* : \`${activeId}\`\n\n` +
          `_Ketik \`${prefix}ttsv61 <teks>\` untuk mulai berbicara._\n\n` +
          `${botFooter}`, { mentions: [senderId] });
      }

      // 3. Simpan Preset Suara Pengguna
      if (flags.setvoice) {
        const voiceId = String(flags.setvoice).trim();
        const voiceName = flags.name || voiceId;
        userSession.voice_id = voiceId;
        userSession.voice_name = voiceName;
        userSession.updatedAt = Date.now();
        global.db.ttsv61[senderId] = userSession;
        saveDB();

        await ctx.react("✅");
        return ctx.reply(`– *V O C A L I S  P R E S E T*\n\n` +
          `┌ ◦ *Karakter* : ${voiceName}\n` +
          `│ ◦ *Voice ID* : \`${voiceId}\`\n` +
          `└ ◦ *Status* : Tersimpan sebagai suara default.\n\n` +
          `_Ketik \`${prefix}ttsv61 <teks>\` untuk berbicara dengan suara ini._\n\n` +
          `${botFooter}`);
      }

      // 4. Cari Karakter Suara di Library (Search & List)
      if (flags.search || flags.list || rawText.startsWith("--search") || rawText.startsWith("--list") || flags.page) {
        await ctx.react("🔍");
        const searchQuery = typeof flags.search === "string" ? flags.search : (typeof flags.list === "string" ? flags.list : cleanText);
        const page = Math.max(1, Number(flags.page) || 1);

        const data = await requestVocalisAPI("search", {
          q: searchQuery && searchQuery !== "true" ? searchQuery : "",
          page: page,
          page_size: CONFIG.ITEMS_PER_PAGE,
          language: flags.lang || undefined
        });

        const items = data?.result?.items || [];
        if (!items.length) {
          await ctx.react("❌");
          return ctx.reply(`❌ Tidak ditemukan model suara dengan kata kunci "${searchQuery || "all"}".`);
        }

        const totalItems = data?.result?.total || items.length;
        const totalPages = Math.ceil(totalItems / CONFIG.ITEMS_PER_PAGE) || 1;

        const rows = items.map((item, idx) => {
          const globalIdx = (page - 1) * CONFIG.ITEMS_PER_PAGE + idx + 1;
          const vName = (item.title || item.name || "Unknown").slice(0, 24);
          const author = item.authorName ? `by ${item.authorName}` : "";
          const desc = item.description ? item.description.slice(0, 45) : (item.tags ? item.tags.slice(0, 3).join(", ") : author);

          return {
            title: `${globalIdx}. ${vName}`,
            id: `${prefix}ttsv61 --setvoice "${item.id}" --name "${vName}"`,
            description: `${desc} • ID: ${item.id.slice(0, 8)}...`.slice(0, 60)
          };
        });

        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: `PILIH MODEL SUARA (${items.length})`,
            sections: [{
              title: `HASIL PENCARIAN (Hal ${page}/${totalPages})`,
              rows: rows
            }]
          })
        }];

        const baseCmd = `${prefix}ttsv61 ${searchQuery && searchQuery !== "true" ? `--search "${searchQuery}"` : "--list"}`;
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

        const bodyList = `– *V O C A L I S  V O I C E  L I B R A R Y*\n\n` +
          `┌ ◦ *Pencarian* : "${searchQuery || "Semua Populer"}"\n` +
          `│ ◦ *Total Model* : ${totalItems} Suara\n` +
          `│ ◦ *Halaman* : ${page} dari ${totalPages}\n` +
          `└ ◦ *Engine* : Fish Audio Repository\n\n` +
          `_Pilih karakter suara melalui menu di bawah:_`;

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

      // Deteksi Media Audio bila dikirim / di-quote
      let audioBuffer = null;
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      const mediaType = ctx.type || ctx.quoted?.type || "";

      if (isMedia && (mediaType.includes("audio") || ctx.quoted?.isAudio)) {
        try {
          audioBuffer = await ctx.download();
        } catch (_) {}
      }

      // 5. Transkripsi Suara ke Teks (Speech-to-Text)
      if (flags.transcribe) {
        if (!audioBuffer) {
          return ctx.reply(`❌ Harap lampirkan atau balas (*reply*) pesan suara / audio yang ingin ditranskripsi ke teks.`);
        }
        await ctx.react("✍️");
        const uploadRes = await upload(audioBuffer).catch(() => null);
        if (!uploadRes?.url) throw new Error("Gagal mengunggah file audio ke server.");

        const sttData = await requestVocalisAPI("transcribe", { audio: uploadRes.url });
        const textResult = sttData?.result?.text || sttData?.result || "Tidak ada teks yang terdeteksi.";

        return ctx.reply(`– *V O C A L I S  T R A N S C R I B E*\n\n` +
          `┌ ◦ *Hasil Transkripsi* :\n` +
          `"${textResult}"\n\n` +
          `${botFooter}`, { quoted: quotedMsg });
      }

      // 6. Voice Cloning (Tiru Suara dari Audio VN / Sampel)
      if (flags.clone || (audioBuffer && cleanText)) {
        const textToSay = cleanText || flags.text;
        if (!textToSay) {
          return ctx.reply(`❌ Harap masukkan teks yang ingin diucapkan!\nContoh: Balas audio dengan \`${prefix}ttsv61 Halo aku meniru suaramu\``);
        }

        let audioUrl = flags.audio || null;
        if (audioBuffer && Buffer.isBuffer(audioBuffer)) {
          const up = await upload(audioBuffer).catch(() => null);
          if (up?.url) audioUrl = up.url;
        }

        if (!audioUrl) {
          return ctx.reply(`❌ Harap lampirkan atau balas (*reply*) pesan suara/audio sebagai sampel suara kloning.`);
        }

        await ctx.react("🎙️");
        const clonedAudio = await requestVocalisAPI("clone", {
          audio: audioUrl,
          text: textToSay,
          transcript: flags.transcript || ""
        }, true);

        if (!clonedAudio?.buffer) throw new Error("Gagal mendapatkan audio hasil kloning.");

        await sendAudioResponse(sock, targetJid, clonedAudio.buffer, quotedMsg);
        await ctx.react("✨");
        return;
      }

      // 7. Text-to-Speech (TTS Standar / Preset)
      const textToSpeak = cleanText || flags.text;

      // Panduan jika tanpa teks & tanpa audio
      if (!textToSpeak) {
        const activeId = userSession.voice_id || CONFIG.DEFAULT_VOICE_ID;
        const activeName = userSession.voice_name || CONFIG.DEFAULT_VOICE_NAME;

        const guideText = `– *V O C A L I S  T T S  v 6 1*\n\n` +
          `┌ ◦ *Suara Aktif* : ${activeName}\n` +
          `│ ◦ *Voice ID* : \`${activeId}\`\n` +
          `└ ◦ *Engine* : Fish Audio Neural Synthesis\n\n` +
          `– *P E R I N T A H  U T A M A*\n\n` +
          `┌ ◦ *Bicara (TTS)* :\n│   \`${prefix}ttsv61 Hello America, let's make it great again!\`\n` +
          `├ ◦ *Gunakan Suara Tertentu* :\n│   \`${prefix}ttsv61 <teks> --voice <voice_id>\`\n` +
          `├ ◦ *Cari Model Suara* :\n│   \`${prefix}ttsv61 --search "trump"\` atau \`${prefix}ttsv61 --list\`\n` +
          `├ ◦ *Kloning Suara (Clone)* :\n│   Kirim/balas audio: \`${prefix}ttsv61 Halo kawan --clone\`\n` +
          `├ ◦ *Transkripsi Audio (STT)* :\n│   Balas audio dengan: \`${prefix}ttsv61 --transcribe\`\n` +
          `└ ◦ *Reset Suara* :\n    \`${prefix}ttsv61 --reset\``;

        return ctx.reply(guideText, { quoted: quotedMsg });
      }

      if (textToSpeak.length > 1000) {
        return ctx.reply(`❌ Teks terlalu panjang! Maksimal 1.000 karakter per permintaan.`);
      }

      await ctx.react("⏳");

      const voiceIdToUse = flags.voice || userSession.voice_id || CONFIG.DEFAULT_VOICE_ID;
      const audioResult = await requestVocalisAPI("generate", {
        text: textToSpeak,
        voice_id: voiceIdToUse
      }, true);

      if (!audioResult?.buffer) throw new Error("Gagal memperoleh data audio hasil generate.");

      await sendAudioResponse(sock, targetJid, audioResult.buffer, quotedMsg);
      await ctx.react("🎙️");

    } catch (error) {
      console.error("[TTSv61 Error]:", error);
      if (typeof ctx.react === "function") await ctx.react("❌");
      const errMsg = error.message || "Terjadi kesalahan saat memproses suara.";
      ctx.reply(`❌ *Kendala TTS v61*: ${errMsg}`);
    }
  }
};