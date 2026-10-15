import axios from "axios";
import db from "../../data/db.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
import {
  sendPTT
} from "../../lib/audio.js";
const CONFIG = {
  API_URL: `${global.bot?.api?.wudysoft}/api/misc/tts/v58`,
  DEFAULT_VOICE: "b441c4fd-4910-4c55-ae56-f0291057e2cc",
  DEFAULT_VOICE_NAME: "Siti - Ad Narrator",
  DEFAULT_LANG: "id",
  DEFAULT_MODEL: "sonic-3.6",
  TIMEOUT: 6e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
  ITEMS_PER_PAGE: 10
};

function initDB(jid = null, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.cartesiaTTS) global.db.cartesiaTTS = {};
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
async function requestCartesia(payload, senderId) {
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
    throw new Error(errMsg || "Gagal memproses permintaan Cartesia TTS API.");
  }
}
export default {
  name: "cartesia",
  aliases: ["ttsv58", "tts58", "cartesiatt", "cartesiatts"],
  description: "Ultra-Realistic Text-to-Speech Cartesia Sonic (v58) dengan Sesi & Full DB.",
  category: "AI",
  limit: true,
  example: "cartesia --list\ncartesia Halo selamat pagi dunia!\ncartesia Hello, have a nice day! --lang en\ncartesia --reset",
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
      const userSession = global.db.cartesiaTTS[senderId] || null;
      const {
        flags,
        cleanText
      } = parseFlags(rawText);
      if (flags.reset || rawText === "--reset") {
        if (global.db.cartesiaTTS[senderId]) {
          delete global.db.cartesiaTTS[senderId];
          saveDB();
        }
        return ctx.reply(`– *C A R T E S I A  T T S*\n\n` + `┌ ◦ *Status* : Sesi model suara berhasil direset\n` + `│ ◦ *Default Voice* : ${CONFIG.DEFAULT_VOICE_NAME}\n` + `│ ◦ *Default Lang* : ${CONFIG.DEFAULT_LANG.toUpperCase()}\n` + `│ ◦ *Default Model* : ${CONFIG.DEFAULT_MODEL}\n` + `└ ◦ *Action* : Ketik ${prefix}cartesia --list untuk melihat daftar suara.\n\n` + `${footer}`);
      }
      if (flags.info || flags.status || rawText === "--info") {
        const currentVoice = userSession?.voice || CONFIG.DEFAULT_VOICE;
        const currentVoiceName = userSession?.name || CONFIG.DEFAULT_VOICE_NAME;
        const currentLang = userSession?.lang || CONFIG.DEFAULT_LANG;
        const currentModel = userSession?.model || CONFIG.DEFAULT_MODEL;
        return ctx.reply(`– *S T A T U S  C A R T E S I A  T T S*\n\n` + `┌ ◦ *User* : @${senderId.split("@")[0]}\n` + `│ ◦ *Voice Name* : ${currentVoiceName}\n` + `│ ◦ *Voice ID* : \`${currentVoice}\`\n` + `│ ◦ *Language* : ${currentLang.toUpperCase()}\n` + `└ ◦ *Model* : ${currentModel}\n\n` + `_Ketik ${prefix}cartesia <teks> untuk berbicara._\n\n` + `${footer}`, {
          mentions: [senderId]
        });
      }
      if (flags.setvoice) {
        const targetVoice = String(flags.setvoice);
        const targetLang = flags.lang || userSession?.lang || CONFIG.DEFAULT_LANG;
        const targetName = flags.name || "Custom Voice";
        const targetModel = flags.model || userSession?.model || CONFIG.DEFAULT_MODEL;
        const newSession = {
          voice: targetVoice,
          name: targetName,
          lang: targetLang,
          model: targetModel,
          updatedAt: Date.now()
        };
        global.db.cartesiaTTS[senderId] = newSession;
        saveDB();
        await ctx.react("✅");
        return ctx.reply(`– *C A R T E S I A  T T S*\n\n` + `┌ ◦ *Voice Name* : ${newSession.name}\n` + `│ ◦ *Voice ID* : \`${newSession.voice}\`\n` + `│ ◦ *Language* : ${newSession.lang.toUpperCase()}\n` + `│ ◦ *Model* : ${newSession.model}\n` + `└ ◦ *Status* : Tersimpan ke sesi pengguna\n\n` + `_Ketik ${prefix}cartesia <teks> untuk mulai berbicara._\n\n` + `${footer}`);
      }
      if (flags.search || flags.query || flags.list || rawText.startsWith("--search") || rawText.startsWith("--list") || flags.page) {
        const targetLang = (flags.lang || userSession?.lang || "id").toLowerCase();
        const searchQuery = flags.search || flags.query || !flags.page && cleanText || "";
        await ctx.react("⏳");
        const payload = {
          action: "voice_list"
        };
        if (targetLang && targetLang !== "all") payload.lang = targetLang;
        const data = await requestCartesia(payload, senderId);
        const result = data?.result || {};
        const allVoices = Array.isArray(result?.voices) ? result.voices : [];
        if (!allVoices.length) {
          await ctx.react("❌");
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Gagal memuat varian suara\n` + `└ ◦ *Info* : Tidak ada voice yang tersedia untuk bahasa "${targetLang}".\n\n` + `${footer}`);
        }
        let matchedVoices = allVoices;
        if (searchQuery && searchQuery !== "true") {
          const q = String(searchQuery).toLowerCase();
          matchedVoices = allVoices.filter(v => {
            const name = (v.name || "").toLowerCase();
            const langCode = (v.language || "").toLowerCase();
            const gender = (v.gender || "").toLowerCase();
            return name.includes(q) || langCode.includes(q) || gender.includes(q) || v.id.toLowerCase() === q;
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
          const vId = v.id;
          const vName = v.name || "Unknown Voice";
          const vLang = v.language || "id";
          const vGender = v.gender ? `[${v.gender.slice(0, 1).toUpperCase()}]` : "";
          return {
            title: `🎙️ ${vGender} ${vName}`.slice(0, 24),
            id: `${prefix}cartesia --setvoice "${vId}" --name "${vName}" --lang "${vLang}"`,
            description: `Lang: ${vLang.toUpperCase()} | Gender: ${v.gender || "unknown"}`.slice(0, 60)
          };
        });
        let baseCmd = `${prefix}cartesia`;
        if (targetLang) baseCmd += ` --lang "${targetLang}"`;
        if (searchQuery && searchQuery !== "true") baseCmd += ` --search "${searchQuery}"`;
        else baseCmd += ` --list`;
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: `PILIH MODEL CARTESIA (${pageItems.length})`,
            sections: [{
              title: `HALAMAN ${page} DARI ${totalPages} (${targetLang.toUpperCase()})`,
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
        const bodyText = `– *C A R T E S I A  T T S  -  L I S T*\n\n` + `┌ ◦ *Filter Bahasa* : ${targetLang.toUpperCase()}\n` + `│ ◦ *Total Varian* : ${matchedVoices.length}\n` + `│ ◦ *Halaman* : ${page} / ${totalPages}\n` + `└ ◦ *Engine* : Cartesia Sonic (v58)\n\n` + `_Pilih suara dari opsi list di bawah atau ubah halaman dengan tombol navigasi:_`;
        const options = {
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 1,
              divider_indices: [1],
              list_title: `${botName} • Cartesia Voices`,
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
      const selectedVoice = flags.voice || userSession?.voice || "";
      const selectedLang = flags.lang || userSession?.lang || CONFIG.DEFAULT_LANG;
      const selectedModel = flags.model || userSession?.model || CONFIG.DEFAULT_MODEL;
      const textToSpeak = cleanText || flags.text;
      if (!textToSpeak) {
        const helpText = `– *C A R T E S I A  T T S*\n\n` + `┌ ◦ *Active Voice* : ${userSession?.name || "Auto by Lang"}\n` + `│ ◦ *Active Lang* : ${selectedLang.toUpperCase()}\n` + `│ ◦ *Active Model* : ${selectedModel}\n` + `└ ◦ *Engine* : Cartesia Sonic (v58)\n\n` + `– *U S A G E*\n\n` + `┌ ◦ *Bicara* : ${prefix}cartesia <teks>\n` + `│ ◦ *List Suara* : ${prefix}cartesia --list\n` + `│ ◦ *Cari Suara* : ${prefix}cartesia --search <query>\n` + `│ ◦ *Filter Bahasa* : ${prefix}cartesia --list --lang en\n` + `└ ◦ *Custom* : ${prefix}cartesia <teks> --voice Siti --lang id\n\n` + `– *E X A M P L E*\n\n` + `└ ◦ ${prefix}cartesia Halo semua, selamat datang di layanan kami!\n\n` + `${footer}`;
        return ctx.reply(helpText);
      }
      if (textToSpeak.length > 2e3) {
        return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : Panjang teks melebihi batas (maksimal 2000 karakter).\n` + `└ ◦ *Panjang Teks* : ${textToSpeak.length} karakter\n\n` + `${footer}`);
      }
      await ctx.react("⏳");
      const payload = {
        action: "create",
        text: String(textToSpeak),
        lang: String(selectedLang).toLowerCase(),
        model: String(selectedModel)
      };
      if (selectedVoice) {
        payload.voice = String(selectedVoice);
      }
      const data = await requestCartesia(payload, senderId);
      const result = data?.result || {};
      const audioBase64 = result.audio_base64;
      if (!audioBase64) {
        throw new Error(data?.error || result.message || "Gagal mendapatkan output audio base64 dari Cartesia.");
      }
      if (!global.db.cartesiaTTS[senderId]) {
        global.db.cartesiaTTS[senderId] = {
          voice: result.voice_id || selectedVoice,
          name: result.voice_name || "Custom Voice",
          lang: result.language || selectedLang,
          model: result.model || selectedModel,
          updatedAt: Date.now()
        };
      } else {
        if (result.voice_id) global.db.cartesiaTTS[senderId].voice = result.voice_id;
        if (result.voice_name) global.db.cartesiaTTS[senderId].name = result.voice_name;
        global.db.cartesiaTTS[senderId].lang = result.language || selectedLang;
        global.db.cartesiaTTS[senderId].model = result.model || selectedModel;
        global.db.cartesiaTTS[senderId].updatedAt = Date.now();
      }
      saveDB();
      const audioBuffer = Buffer.from(audioBase64, "base64");
      await sendPTT(sock, targetJid, audioBuffer, quotedMsg);
      await ctx.react("🎙️");
    } catch (error) {
      console.error("[Cartesia TTS Error]:", error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.error || error.response?.data?.message || error.message || "Terjadi kesalahan saat memproses text-to-speech Cartesia.";
      ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : ${errMsg}\n` + `└ ◦ *Command* : ${ctx.command || "cartesia"}\n\n` + `${footer}`);
    }
  }
};