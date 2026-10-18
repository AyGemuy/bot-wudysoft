import axios from "axios";
import db from "../../data/db.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
import {
  sendPTT
} from "../../lib/audio.js";
const CONFIG = {
  API_URL: `${global.bot?.api?.wudysoft}/api/misc/tts/v59`,
  DEFAULT_VOICE: "af_kore",
  DEFAULT_VOICE_NAME: "Kore (American Female)",
  DEFAULT_EMOTION: "calm",
  DEFAULT_LANG: "en",
  TIMEOUT: 6e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
  ITEMS_PER_PAGE: 10
};

function initDB(jid = null, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.aiVocalTTS) global.db.aiVocalTTS = {};
  if (jid && !global.db.user[jid]) {
    global.db.user[jid] = {
      name: name || "",
      money: 1e4,
      exp: 0
    };
  }
}

function saveDB() {
  if (typeof db?.write === "function" && global.db) {
    db.write(global.db);
  }
}

function parseFlags(rawStr = "") {
  const flags = {};
  const flagRegex = /--([a-zA-Z0-9_-]+)(?:\s+("[^"]*"|'[^']*'|[^\s--]+))?/g;
  let match;
  while ((match = flagRegex.exec(rawStr)) !== null) {
    const key = match[1].toLowerCase();
    let val = match[2] ? match[2].trim() : true;
    if (typeof val === "string" && (val.startsWith('"') || val.startsWith("'"))) {
      val = val.slice(1, -1);
    }
    flags[key] = val;
  }
  const cleanText = rawStr.replace(/--([a-zA-Z0-9_-]+)(?:\s+("[^"]*"|'[^']*'|[^\s--]+))?/g, "").trim();
  return {
    flags: flags,
    cleanText: cleanText
  };
}
async function requestAIVocal(payload, senderId) {
  initDB(senderId);
  try {
    const res = await axios.post(CONFIG.API_URL, payload, {
      headers: {
        "Content-Type": "application/json",
        "User-Agent": CONFIG.USER_AGENT
      },
      timeout: CONFIG.TIMEOUT
    });
    const data = res.data;
    if (!data?.status) {
      throw new Error(data?.error || data?.message || data?.result?.message || "Response status false dari server.");
    }
    return data;
  } catch (error) {
    const errMsg = error.response?.data?.error || error.response?.data?.message || error.message;
    throw new Error(errMsg || "Gagal memproses permintaan AIVocal TTS API.");
  }
}
export default {
  name: "aivocal",
  aliases: ["ttsv59", "tts59", "vocaltts", "aivocalio"],
  description: "Text-to-Speech AIVocal Expressive (v59) dengan Pengaturan Emosi, Sesi & Full DB.",
  category: "AI",
  limit: true,
  example: "aivocal --list\naivocal Hello good morning!\naivocal Wow that's amazing! --emotion happy\naivocal --setemotion angry\naivocal --reset",
  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "WudysoftBot";
    const footer = global.footer || global.bot?.footer || `_${botName}_`;
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
    const targetJid = ctx.chat || ctx.id;
    try {
      const senderId = ctx.sender || ctx.author || msg.key?.participant || msg.key?.remoteJid || ctx.id;
      initDB(senderId, ctx.pushName);
      let rawText = (ctx.query || "").trim();
      if (!rawText && ctx.quoted?.text) rawText = ctx.quoted.text.trim();
      const userSession = global.db.aiVocalTTS[senderId] || null;
      const {
        flags,
        cleanText
      } = parseFlags(rawText);
      if (flags.reset || rawText === "--reset") {
        if (global.db.aiVocalTTS[senderId]) {
          delete global.db.aiVocalTTS[senderId];
          saveDB();
        }
        return ctx.reply(`– *A I  V O C A L  T T S*\n\n` + `┌ ◦ *Status* : Sesi model suara berhasil direset\n` + `│ ◦ *Default Voice* : ${CONFIG.DEFAULT_VOICE_NAME}\n` + `│ ◦ *Default Emotion* : ${CONFIG.DEFAULT_EMOTION}\n` + `│ ◦ *Default Lang* : ${CONFIG.DEFAULT_LANG.toUpperCase()}\n` + `└ ◦ *Action* : Ketik ${prefix}aivocal --list untuk melihat daftar suara.\n\n` + `${footer}`);
      }
      if (flags.info || flags.status || rawText === "--info") {
        const currentVoice = userSession?.voice || CONFIG.DEFAULT_VOICE;
        const currentVoiceName = userSession?.name || CONFIG.DEFAULT_VOICE_NAME;
        const currentEmotion = userSession?.emotion || CONFIG.DEFAULT_EMOTION;
        const currentSpeed = userSession?.speed || 1;
        return ctx.reply(`– *S T A T U S  A I  V O C A L*\n\n` + `┌ ◦ *User* : @${senderId.split("@")[0]}\n` + `│ ◦ *Voice Name* : ${currentVoiceName}\n` + `│ ◦ *Voice ID* : \`${currentVoice}\`\n` + `│ ◦ *Emotion* : ${currentEmotion.toUpperCase()}\n` + `└ ◦ *Speed* : ${currentSpeed}x\n\n` + `_Ketik ${prefix}aivocal <teks> untuk berbicara._\n\n` + `${footer}`, {
          mentions: [senderId]
        });
      }
      if (flags.setemotion) {
        const targetEmotion = String(flags.setemotion).toLowerCase();
        const validEmotions = ["calm", "happy", "sad", "angry", "fearful", "disgusted", "surprised"];
        if (!validEmotions.includes(targetEmotion)) {
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : Emosi "${targetEmotion}" tidak valid.\n` + `└ ◦ *Pilihan Emosi* : ${validEmotions.join(", ")}\n\n` + `${footer}`);
        }
        if (!global.db.aiVocalTTS[senderId]) {
          global.db.aiVocalTTS[senderId] = {
            voice: CONFIG.DEFAULT_VOICE,
            name: CONFIG.DEFAULT_VOICE_NAME,
            emotion: targetEmotion,
            speed: 1,
            updatedAt: Date.now()
          };
        } else {
          global.db.aiVocalTTS[senderId].emotion = targetEmotion;
          global.db.aiVocalTTS[senderId].updatedAt = Date.now();
        }
        saveDB();
        await ctx.react("✅");
        return ctx.reply(`– *A I  V O C A L  T T S*\n\n` + `┌ ◦ *Emotion* : ${targetEmotion.toUpperCase()}\n` + `└ ◦ *Status* : Emosi berhasil disimpan ke profil sesi.\n\n` + `${footer}`);
      }
      if (flags.setvoice) {
        const targetVoice = String(flags.setvoice);
        const targetName = flags.name || "Custom Voice";
        const targetEmotion = flags.emotion || userSession?.emotion || CONFIG.DEFAULT_EMOTION;
        const newSession = {
          voice: targetVoice,
          name: targetName,
          emotion: targetEmotion,
          speed: Number(flags.speed) || userSession?.speed || 1,
          updatedAt: Date.now()
        };
        global.db.aiVocalTTS[senderId] = newSession;
        saveDB();
        await ctx.react("✅");
        return ctx.reply(`– *A I  V O C A L  T T S*\n\n` + `┌ ◦ *Voice Name* : ${newSession.name}\n` + `│ ◦ *Voice ID* : \`${newSession.voice}\`\n` + `│ ◦ *Emotion* : ${newSession.emotion.toUpperCase()}\n` + `└ ◦ *Status* : Tersimpan ke sesi pengguna\n\n` + `_Ketik ${prefix}aivocal <teks> untuk mulai berbicara._\n\n` + `${footer}`);
      }
      if (flags.search || flags.query || flags.list || rawText.startsWith("--search") || rawText.startsWith("--list") || flags.page) {
        const targetLang = flags.lang || "";
        const targetGender = flags.gender || "";
        const searchQuery = flags.search || flags.query || !flags.page && cleanText || "";
        await ctx.react("⏳");
        const payload = {
          action: "voice_list"
        };
        if (targetLang) payload.lang = targetLang;
        if (targetGender) payload.gender = targetGender;
        const data = await requestAIVocal(payload, senderId);
        const result = data?.result || {};
        const allVoices = Array.isArray(result?.voices) ? result.voices : [];
        if (!allVoices.length) {
          await ctx.react("❌");
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Gagal memuat daftar suara\n` + `└ ◦ *Info* : Tidak ada voice yang cocok dengan filter yang ditentukan.\n\n` + `${footer}`);
        }
        let matchedVoices = allVoices;
        if (searchQuery && searchQuery !== "true") {
          const q = String(searchQuery).toLowerCase();
          matchedVoices = allVoices.filter(v => {
            const name = (v.name || "").toLowerCase();
            const id = (v.id || "").toLowerCase();
            const accent = (v.accent || "").toLowerCase();
            return name.includes(q) || id.includes(q) || accent.includes(q);
          });
        }
        if (!matchedVoices.length) {
          await ctx.react("❌");
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Varian suara tidak ditemukan\n` + `└ ◦ *Query* : "${searchQuery}"\n\n` + `${footer}`);
        }
        const page = Math.max(1, Number(flags.page) || 1);
        const totalPages = Math.ceil(matchedVoices.length / CONFIG.ITEMS_PER_PAGE) || 1;
        const pageItems = matchedVoices.slice((page - 1) * CONFIG.ITEMS_PER_PAGE, page * CONFIG.ITEMS_PER_PAGE);
        const currentEmotion = userSession?.emotion || CONFIG.DEFAULT_EMOTION;
        const voiceRows = pageItems.map(v => {
          const vId = v.id;
          const vName = v.name || "Unknown";
          const vGender = v.gender ? `[${v.gender.slice(0, 1).toUpperCase()}]` : "";
          const vAccent = v.accent ? `(${v.accent.replace("en_", "").toUpperCase()})` : "";
          return {
            title: `🎙️ ${vGender} ${vName} ${vAccent}`.slice(0, 24),
            id: `${prefix}aivocal --setvoice "${vId}" --name "${vName}" --emotion "${currentEmotion}"`,
            description: `ID: ${vId} | Lang: ${v.lang?.toUpperCase() || "EN"}`.slice(0, 60)
          };
        });
        let baseCmd = `${prefix}aivocal`;
        if (targetLang) baseCmd += ` --lang "${targetLang}"`;
        if (targetGender) baseCmd += ` --gender "${targetGender}"`;
        if (searchQuery && searchQuery !== "true") baseCmd += ` --search "${searchQuery}"`;
        else baseCmd += ` --list`;
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: `PILIH MODEL AIVOCAL (${pageItems.length})`,
            sections: [{
              title: `HALAMAN ${page} DARI ${totalPages}`,
              rows: voiceRows
            }]
          })
        }];
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
        const bodyText = `– *A I  V O C A L  T T S  -  L I S T*\n\n` + `┌ ◦ *Filter Bahasa* : ${targetLang ? targetLang.toUpperCase() : "Semua"}\n` + `│ ◦ *Total Varian* : ${matchedVoices.length}\n` + `│ ◦ *Halaman* : ${page} / ${totalPages}\n` + `└ ◦ *Engine* : AIVocal Expressive (v59)\n\n` + `_Pilih suara dari opsi list di bawah atau ubah halaman dengan tombol navigasi:_`;
        const options = {
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 1,
              divider_indices: [1],
              list_title: `${botName} • AIVocal Catalog`,
              button_title: `Buka Hal ${page}`
            }
          },
          quoted: quotedMsg
        };
        if (typeof ctx.sendCta === "function") {
          await ctx.sendCta(bodyText, footer, buttons, options);
        } else {
          let fallback = `${bodyText}\n\n`;
          fallback += voiceRows.map(r => `• *${r.title}*\n  Perintah: \`${r.id}\``).join("\n\n");
          if (totalPages > 1) {
            fallback += `\n\n_Pindah Halaman: Ketik \`${baseCmd} --page ${page < totalPages ? page + 1 : page - 1}\`_`;
          }
          await ctx.reply(fallback);
        }
        await ctx.react("✅");
        return;
      }
      const selectedVoice = flags.voice || userSession?.voice || CONFIG.DEFAULT_VOICE;
      const selectedEmotion = flags.emotion || userSession?.emotion || CONFIG.DEFAULT_EMOTION;
      const selectedSpeed = flags.speed !== undefined ? Number(flags.speed) : userSession?.speed !== undefined ? userSession.speed : 1;
      const textToSpeak = cleanText || flags.text;
      if (!textToSpeak) {
        const helpText = `– *A I  V O C A L  T T S*\n\n` + `┌ ◦ *Active Voice* : ${userSession?.name || selectedVoice}\n` + `│ ◦ *Active Emotion* : ${selectedEmotion.toUpperCase()}\n` + `│ ◦ *Active Speed* : ${selectedSpeed}x\n` + `└ ◦ *Engine* : AIVocal (v59)\n\n` + `– *U S A G E*\n\n` + `┌ ◦ *Bicara* : ${prefix}aivocal <teks>\n` + `│ ◦ *List Suara* : ${prefix}aivocal --list\n` + `│ ◦ *Cari Suara* : ${prefix}aivocal --search <nama/aksen>\n` + `│ ◦ *Ubah Emosi* : ${prefix}aivocal <teks> --emotion happy\n` + `└ ◦ *Daftar Emosi* : calm, happy, sad, angry, fearful, disgusted, surprised\n\n` + `– *E X A M P L E*\n\n` + `└ ◦ ${prefix}aivocal Congratulations on your big achievement! --emotion happy\n\n` + `${footer}`;
        return ctx.reply(helpText);
      }
      if (textToSpeak.length > 2500) {
        return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : Panjang teks melebihi batas (maksimal 2500 karakter).\n` + `└ ◦ *Panjang Teks* : ${textToSpeak.length} karakter\n\n` + `${footer}`);
      }
      await ctx.react("⏳");
      const payload = {
        action: "create",
        text: String(textToSpeak),
        voice: String(selectedVoice),
        emotion: String(selectedEmotion).toLowerCase(),
        speed: Number(selectedSpeed) || 1
      };
      const data = await requestAIVocal(payload, senderId);
      const result = data?.result || {};
      const audioBase64 = result.audio_base64;
      if (!audioBase64) {
        throw new Error(data?.error || result.message || "Gagal mendapatkan output audio base64 dari AIVocal.");
      }
      if (!global.db.aiVocalTTS[senderId]) {
        global.db.aiVocalTTS[senderId] = {
          voice: selectedVoice,
          name: result.voice_name || "Custom Voice",
          emotion: selectedEmotion,
          speed: selectedSpeed,
          updatedAt: Date.now()
        };
      } else {
        global.db.aiVocalTTS[senderId].voice = selectedVoice;
        if (result.voice_name) global.db.aiVocalTTS[senderId].name = result.voice_name;
        global.db.aiVocalTTS[senderId].emotion = selectedEmotion;
        global.db.aiVocalTTS[senderId].speed = selectedSpeed;
        global.db.aiVocalTTS[senderId].updatedAt = Date.now();
      }
      saveDB();
      const audioBuffer = Buffer.from(audioBase64, "base64");
      await sendPTT(sock, targetJid, audioBuffer, quotedMsg);
      await ctx.react("🎙️");
    } catch (error) {
      console.error("[AIVocal TTS Error]:", error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.error || error.response?.data?.message || error.message || "Terjadi kesalahan saat memproses text-to-speech AIVocal.";
      ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : ${errMsg}\n` + `└ ◦ *Command* : ${ctx.command || "aivocal"}\n\n` + `${footer}`);
    }
  }
};