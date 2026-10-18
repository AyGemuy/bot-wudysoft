import axios from "axios";
import db from "../../data/db.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
import {
  sendPTT
} from "../../lib/audio.js";
const CONFIG = {
  API_URL: `${global.bot?.api?.wudysoft}/api/misc/tts/v56`,
  DEFAULT_VOICE: "161",
  DEFAULT_VOICE_NAME: "Ardi",
  DEFAULT_LANG: "id-ID",
  DEFAULT_ENGINE: "ms",
  DEFAULT_SPEED: "0",
  TIMEOUT: 6e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
  ITEMS_PER_PAGE: 10
};

function initDB(jid = null, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.naturalReaders) global.db.naturalReaders = {};
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
async function requestNaturalReaders(payload, senderId) {
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
    throw new Error(errMsg || "Gagal memproses permintaan NaturalReaders API.");
  }
}
export default {
  name: "naturalreaders",
  aliases: ["ttsv56", "tts56", "nrtts", "naturalreader"],
  description: "Text-to-Speech NaturalReaders Multi-Engine (v56) dengan Sesi & Full DB.",
  category: "AI",
  limit: true,
  example: "naturalreaders --list\nnaturalreaders Halo selamat pagi semua\nnaturalreaders Hello world --lang en-US --voice Andrew\nnaturalreaders --reset",
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
      const userSession = global.db.naturalReaders[senderId] || null;
      const {
        flags,
        cleanText
      } = parseFlags(rawText);
      if (flags.reset || rawText === "--reset") {
        if (global.db.naturalReaders[senderId]) {
          delete global.db.naturalReaders[senderId];
          saveDB();
        }
        return ctx.reply(`– *N A T U R A L  R E A D E R S*\n\n` + `┌ ◦ *Status* : Sesi model suara berhasil direset\n` + `│ ◦ *Default Voice* : ${CONFIG.DEFAULT_VOICE_NAME} (ID: ${CONFIG.DEFAULT_VOICE})\n` + `│ ◦ *Default Lang* : ${CONFIG.DEFAULT_LANG}\n` + `│ ◦ *Default Engine* : ${CONFIG.DEFAULT_ENGINE.toUpperCase()}\n` + `└ ◦ *Action* : Ketik ${prefix}naturalreaders --list untuk melihat daftar suara.\n\n` + `${footer}`);
      }
      if (flags.info || flags.status || rawText === "--info") {
        const currentVoice = userSession?.voice || CONFIG.DEFAULT_VOICE;
        const currentVoiceName = userSession?.name || CONFIG.DEFAULT_VOICE_NAME;
        const currentLang = userSession?.lang || CONFIG.DEFAULT_LANG;
        const currentEngine = userSession?.engine || CONFIG.DEFAULT_ENGINE;
        const currentSpeed = userSession?.speed ?? CONFIG.DEFAULT_SPEED;
        return ctx.reply(`– *S T A T U S  N A T U R A L  R E A D E R S*\n\n` + `┌ ◦ *User* : @${senderId.split("@")[0]}\n` + `│ ◦ *Voice Name* : ${currentVoiceName}\n` + `│ ◦ *Voice ID* : \`${currentVoice}\`\n` + `│ ◦ *Language* : ${currentLang}\n` + `│ ◦ *Engine* : ${currentEngine.toUpperCase()}\n` + `└ ◦ *Speed* : ${currentSpeed}\n\n` + `_Ketik ${prefix}naturalreaders <teks> untuk berbicara._\n\n` + `${footer}`, {
          mentions: [senderId]
        });
      }
      if (flags.setvoice) {
        const targetVoice = String(flags.setvoice);
        const targetLang = flags.lang || userSession?.lang || CONFIG.DEFAULT_LANG;
        const targetName = flags.name || "Custom Voice";
        const targetEngine = flags.engine || userSession?.engine || CONFIG.DEFAULT_ENGINE;
        const targetSpeed = flags.speed !== undefined ? String(flags.speed) : userSession?.speed ?? CONFIG.DEFAULT_SPEED;
        const newSession = {
          voice: targetVoice,
          name: targetName,
          lang: targetLang,
          engine: targetEngine,
          speed: targetSpeed,
          updatedAt: Date.now()
        };
        global.db.naturalReaders[senderId] = newSession;
        saveDB();
        await ctx.react("✅");
        return ctx.reply(`– *N A T U R A L  R E A D E R S*\n\n` + `┌ ◦ *Voice Name* : ${newSession.name}\n` + `│ ◦ *Voice ID* : \`${newSession.voice}\`\n` + `│ ◦ *Language* : ${newSession.lang}\n` + `│ ◦ *Engine* : ${newSession.engine.toUpperCase()}\n` + `└ ◦ *Status* : Tersimpan ke sesi pengguna\n\n` + `_Ketik ${prefix}naturalreaders <teks> untuk mulai berbicara._\n\n` + `${footer}`);
      }
      if (flags.search || flags.query || flags.list || rawText.startsWith("--search") || rawText.startsWith("--list") || flags.page) {
        const targetLang = flags.lang || userSession?.lang || "";
        const searchQuery = flags.search || flags.query || !flags.page && cleanText || "";
        await ctx.react("⏳");
        const payload = {
          action: "voice_list"
        };
        if (targetLang) payload.lang = targetLang;
        const data = await requestNaturalReaders(payload, senderId);
        const result = data?.result || {};
        const allVoices = Array.isArray(result?.voices) ? result.voices : [];
        if (!allVoices.length) {
          await ctx.react("❌");
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Gagal memuat varian suara\n` + `└ ◦ *Info* : Tidak ada voice yang cocok${targetLang ? ` untuk bahasa "${targetLang}"` : ""}.\n\n` + `${footer}`);
        }
        let matchedVoices = allVoices;
        if (searchQuery && searchQuery !== "true") {
          const q = String(searchQuery).toLowerCase();
          matchedVoices = allVoices.filter(v => {
            const name = (v.name || "").toLowerCase();
            const id = String(v.voice_id || "").toLowerCase();
            const locale = (v.locale || "").toLowerCase();
            const langName = (v.language || "").toLowerCase();
            return name.includes(q) || id === q || locale.includes(q) || langName.includes(q);
          });
        }
        if (!matchedVoices.length) {
          await ctx.react("❌");
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Varian suara tidak ditemukan\n` + `└ ◦ *Query* : "${searchQuery}"\n\n` + `${footer}`);
        }
        const page = Math.max(1, Number(flags.page) || 1);
        const totalPages = Math.ceil(matchedVoices.length / CONFIG.ITEMS_PER_PAGE) || 1;
        const pageItems = matchedVoices.slice((page - 1) * CONFIG.ITEMS_PER_PAGE, page * CONFIG.ITEMS_PER_PAGE);
        const voiceRows = pageItems.map(v => {
          const vId = v.voice_id;
          const vName = v.name || "Unnamed";
          const vLocale = v.locale || "en-US";
          const vEngine = v.engine || "ms";
          return {
            title: `🎙️ ${vName} (${vEngine.toUpperCase()})`.slice(0, 24),
            id: `${prefix}naturalreaders --setvoice "${vId}" --name "${vName}" --lang "${vLocale}" --engine "${vEngine}"`,
            description: `Locale: ${vLocale} | ID: ${vId}`.slice(0, 60)
          };
        });
        let baseCmd = `${prefix}naturalreaders`;
        if (targetLang) baseCmd += ` --lang "${targetLang}"`;
        if (searchQuery && searchQuery !== "true") baseCmd += ` --search "${searchQuery}"`;
        else baseCmd += ` --list`;
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: `PILIH MODEL NATURALREADERS (${pageItems.length})`,
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
        const bodyText = `– *N A T U R A L  R E A D E R S  -  L I S T*\n\n` + `┌ ◦ *Filter Bahasa* : ${targetLang ? targetLang : "Semua"}\n` + `│ ◦ *Total Varian* : ${matchedVoices.length}\n` + `│ ◦ *Halaman* : ${page} / ${totalPages}\n` + `└ ◦ *Engine* : NaturalReaders (v56)\n\n` + `_Pilih varian suara dari menu di bawah atau gunakan tombol navigasi halaman:_`;
        const options = {
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 1,
              divider_indices: [1],
              list_title: `${botName} • Natural Readers Catalog`,
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
      const selectedLang = flags.lang || userSession?.lang || CONFIG.DEFAULT_LANG;
      const selectedEngine = flags.engine || userSession?.engine || CONFIG.DEFAULT_ENGINE;
      const selectedSpeed = flags.speed !== undefined ? String(flags.speed) : userSession?.speed ?? CONFIG.DEFAULT_SPEED;
      const textToSpeak = cleanText || flags.text;
      if (!textToSpeak) {
        const helpText = `– *N A T U R A L  R E A D E R S*\n\n` + `┌ ◦ *Active Voice* : ${userSession?.name || selectedVoice} (ID: ${selectedVoice})\n` + `│ ◦ *Active Lang* : ${selectedLang}\n` + `│ ◦ *Active Engine* : ${selectedEngine.toUpperCase()}\n` + `│ ◦ *Active Speed* : ${selectedSpeed}\n` + `└ ◦ *Engine Version* : v56 (AWS Cognito SigV4)\n\n` + `– *U S A G E*\n\n` + `┌ ◦ *Bicara* : ${prefix}naturalreaders <teks>\n` + `│ ◦ *List Suara* : ${prefix}naturalreaders --list\n` + `│ ◦ *Cari Suara* : ${prefix}naturalreaders --search <nama>\n` + `│ ◦ *Filter Bahasa* : ${prefix}naturalreaders --list --lang id-ID\n` + `└ ◦ *Custom* : ${prefix}naturalreaders <teks> --voice 161 --lang id-ID --speed 0\n\n` + `– *E X A M P L E*\n\n` + `└ ◦ ${prefix}naturalreaders Halo semuanya selamat pagi selamat beraktivitas!\n\n` + `${footer}`;
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
        lang: String(selectedLang),
        engine: String(selectedEngine),
        speed: String(selectedSpeed)
      };
      const data = await requestNaturalReaders(payload, senderId);
      const result = data?.result || {};
      const audioBase64 = result.audio_base64;
      if (!audioBase64) {
        throw new Error(data?.error || result.message || "Gagal mendapatkan output audio base64 dari server.");
      }
      if (!global.db.naturalReaders[senderId]) {
        global.db.naturalReaders[senderId] = {
          voice: selectedVoice,
          name: result.voice_name || "Custom Voice",
          lang: result.language || selectedLang,
          engine: result.engine || selectedEngine,
          speed: selectedSpeed,
          updatedAt: Date.now()
        };
      } else {
        global.db.naturalReaders[senderId].voice = selectedVoice;
        if (result.voice_name) global.db.naturalReaders[senderId].name = result.voice_name;
        global.db.naturalReaders[senderId].lang = result.language || selectedLang;
        global.db.naturalReaders[senderId].engine = result.engine || selectedEngine;
        global.db.naturalReaders[senderId].speed = selectedSpeed;
        global.db.naturalReaders[senderId].updatedAt = Date.now();
      }
      saveDB();
      const audioBuffer = Buffer.from(audioBase64, "base64");
      await sendPTT(sock, targetJid, audioBuffer, quotedMsg);
      await ctx.react("🎙️");
    } catch (error) {
      console.error("[NaturalReaders TTS Error]:", error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.error || error.response?.data?.message || error.message || "Terjadi kesalahan saat memproses text-to-speech NaturalReaders.";
      ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : ${errMsg}\n` + `└ ◦ *Command* : ${ctx.command || "naturalreaders"}\n\n` + `${footer}`);
    }
  }
};