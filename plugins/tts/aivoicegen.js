import axios from "axios";
import db from "../../data/db.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
import {
  sendPTT
} from "../../lib/audio.js";
const CONFIG = {
  API_URL: `${global.bot?.api?.wudysoft}/api/misc/tts/v57`,
  DEFAULT_VOICE: "xoCrBu0Re6807a59702179cfa9e078954784f43e7uPjtUJeN0_neural",
  DEFAULT_VOICE_NAME: "Javanese Neural",
  DEFAULT_LANG: "id-ID",
  TIMEOUT: 6e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
  ITEMS_PER_PAGE: 10
};

function initDB(jid = null, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.aiVoiceGen) global.db.aiVoiceGen = {};
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
async function requestAiVoiceGen(payload, senderId) {
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
    throw new Error(errMsg || "Gagal memproses permintaan AiVoiceGenerator API.");
  }
}
export default {
  name: "aivoicegen",
  aliases: ["ttsv57", "tts57", "aivoice", "avgtts"],
  description: "Text-to-Speech AiVoiceGenerator (v57) Multi-Language dengan Sesi & Full DB.",
  category: "AI",
  limit: true,
  example: "aivoicegen --list\naivoicegen Halo selamat pagi\naivoicegen Halo sedulur --lang jv-ID\naivoicegen --reset",
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
      const userSession = global.db.aiVoiceGen[senderId] || null;
      const {
        flags,
        cleanText
      } = parseFlags(rawText);
      if (flags.reset || rawText === "--reset") {
        if (global.db.aiVoiceGen[senderId]) {
          delete global.db.aiVoiceGen[senderId];
          saveDB();
        }
        return ctx.reply(`– *A I  V O I C E  G E N E R A T O R*\n\n` + `┌ ◦ *Status* : Sesi model suara berhasil direset\n` + `│ ◦ *Default Voice* : ${CONFIG.DEFAULT_VOICE_NAME}\n` + `│ ◦ *Default Lang* : ${CONFIG.DEFAULT_LANG}\n` + `└ ◦ *Action* : Ketik ${prefix}aivoicegen --list untuk melihat daftar suara.\n\n` + `${footer}`);
      }
      if (flags.info || flags.status || rawText === "--info") {
        const currentVoice = userSession?.voice || CONFIG.DEFAULT_VOICE;
        const currentVoiceName = userSession?.name || CONFIG.DEFAULT_VOICE_NAME;
        const currentLang = userSession?.lang || CONFIG.DEFAULT_LANG;
        return ctx.reply(`– *S T A T U S  A I  V O I C E  G E N*\n\n` + `┌ ◦ *User* : @${senderId.split("@")[0]}\n` + `│ ◦ *Voice Name* : ${currentVoiceName}\n` + `│ ◦ *Voice ID* : \`${currentVoice.slice(0, 16)}...\`\n` + `└ ◦ *Language* : ${currentLang}\n\n` + `_Ketik ${prefix}aivoicegen <teks> untuk berbicara._\n\n` + `${footer}`, {
          mentions: [senderId]
        });
      }
      if (flags.setvoice) {
        const targetVoice = String(flags.setvoice);
        const targetLang = flags.lang || userSession?.lang || CONFIG.DEFAULT_LANG;
        const targetName = flags.name || "Custom Voice";
        const newSession = {
          voice: targetVoice,
          name: targetName,
          lang: targetLang,
          updatedAt: Date.now()
        };
        global.db.aiVoiceGen[senderId] = newSession;
        saveDB();
        await ctx.react("✅");
        return ctx.reply(`– *A I  V O I C E  G E N E R A T O R*\n\n` + `┌ ◦ *Voice Name* : ${newSession.name}\n` + `│ ◦ *Voice ID* : \`${newSession.voice}\`\n` + `│ ◦ *Language* : ${newSession.lang}\n` + `└ ◦ *Status* : Tersimpan ke sesi pengguna\n\n` + `_Ketik ${prefix}aivoicegen <teks> untuk mulai berbicara._\n\n` + `${footer}`);
      }
      if (flags.search || flags.query || flags.list || rawText.startsWith("--search") || rawText.startsWith("--list") || flags.page) {
        const targetLang = flags.lang || userSession?.lang || "";
        const searchQuery = flags.search || flags.query || !flags.page && cleanText || "";
        await ctx.react("⏳");
        const payload = {
          action: "voice_list"
        };
        if (targetLang) payload.lang = targetLang;
        const data = await requestAiVoiceGen(payload, senderId);
        const result = data?.result || {};
        const allVoices = Array.isArray(result?.voices) ? result.voices : [];
        if (!allVoices.length) {
          await ctx.react("❌");
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Gagal memuat varian suara\n` + `└ ◦ *Info* : Tidak ada voice yang tersedia${targetLang ? ` untuk bahasa "${targetLang}"` : ""}.\n\n` + `${footer}`);
        }
        let matchedVoices = allVoices;
        if (searchQuery && searchQuery !== "true") {
          const q = String(searchQuery).toLowerCase();
          matchedVoices = allVoices.filter(v => {
            const name = (v.name || "").toLowerCase();
            const langCode = (v.languageCode || "").toLowerCase();
            const langName = (v.languageName || "").toLowerCase();
            return name.includes(q) || langCode.includes(q) || langName.includes(q);
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
          const vId = v.ids;
          const vName = v.name || "Unnamed Voice";
          const vLang = v.languageCode || "id-ID";
          const vGender = v.gender ? `(${v.gender})` : "";
          return {
            title: `🎙️ ${vName} ${vGender}`.slice(0, 24),
            id: `${prefix}aivoicegen --setvoice "${vId}" --name "${vName}" --lang "${vLang}"`,
            description: `Lang: ${v.languageName || vLang} | ID: ${vId.slice(0, 10)}...`.slice(0, 60)
          };
        });
        let baseCmd = `${prefix}aivoicegen`;
        if (targetLang) baseCmd += ` --lang "${targetLang}"`;
        if (searchQuery && searchQuery !== "true") baseCmd += ` --search "${searchQuery}"`;
        else baseCmd += ` --list`;
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: `PILIH MODEL SUARA (${pageItems.length})`,
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
        const bodyText = `– *A I  V O I C E  G E N E R A T O R  -  L I S T*\n\n` + `┌ ◦ *Filter Bahasa* : ${targetLang ? targetLang.toUpperCase() : "Semua"}\n` + `│ ◦ *Total Varian* : ${matchedVoices.length}\n` + `│ ◦ *Halaman* : ${page} / ${totalPages}\n` + `└ ◦ *Engine* : AiVoiceGen (v57)\n\n` + `_Pilih varian suara dari menu di bawah atau gunakan tombol navigasi halaman:_`;
        const options = {
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 1,
              divider_indices: [1],
              list_title: `${botName} • AI Voice Generator`,
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
      const textToSpeak = cleanText || flags.text;
      if (!textToSpeak) {
        const helpText = `– *A I  V O I C E  G E N E R A T O R*\n\n` + `┌ ◦ *Active Voice* : ${userSession?.name || selectedVoice}\n` + `│ ◦ *Active Lang* : ${selectedLang}\n` + `└ ◦ *Engine* : AiVoiceGen (v57)\n\n` + `– *U S A G E*\n\n` + `┌ ◦ *Bicara* : ${prefix}aivoicegen <teks>\n` + `│ ◦ *List Suara* : ${prefix}aivoicegen --list\n` + `│ ◦ *Cari Suara* : ${prefix}aivoicegen --search <query>\n` + `│ ◦ *Filter Bahasa* : ${prefix}aivoicegen --list --lang id-ID\n` + `└ ◦ *Custom* : ${prefix}aivoicegen <teks> --voice <voice_id/name> --lang id-ID\n\n` + `– *E X A M P L E*\n\n` + `└ ◦ ${prefix}aivoicegen Sugeng enjang sedulur sedoyo --lang jv-ID\n\n` + `${footer}`;
        return ctx.reply(helpText);
      }
      if (textToSpeak.length > 3e3) {
        return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : Panjang teks melebihi batas (maksimal 3000 karakter).\n` + `└ ◦ *Panjang Teks* : ${textToSpeak.length} karakter\n\n` + `${footer}`);
      }
      await ctx.react("⏳");
      const payload = {
        action: "create",
        text: String(textToSpeak),
        voice: String(selectedVoice),
        lang: String(selectedLang)
      };
      const data = await requestAiVoiceGen(payload, senderId);
      const result = data?.result || {};
      const audioBase64 = result.audio_base64;
      if (!audioBase64) {
        throw new Error(data?.error || result.message || "Gagal mendapatkan output audio base64 dari server.");
      }
      if (!global.db.aiVoiceGen[senderId]) {
        global.db.aiVoiceGen[senderId] = {
          voice: selectedVoice,
          name: result.voice_name || "Custom Voice",
          lang: result.language || selectedLang,
          updatedAt: Date.now()
        };
      } else {
        global.db.aiVoiceGen[senderId].voice = selectedVoice;
        if (result.voice_name) global.db.aiVoiceGen[senderId].name = result.voice_name;
        global.db.aiVoiceGen[senderId].lang = result.language || selectedLang;
        global.db.aiVoiceGen[senderId].updatedAt = Date.now();
      }
      saveDB();
      const audioBuffer = Buffer.from(audioBase64, "base64");
      await sendPTT(sock, targetJid, audioBuffer, quotedMsg);
      await ctx.react("🎙️");
    } catch (error) {
      console.error("[AiVoiceGen TTS Error]:", error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.error || error.response?.data?.message || error.message || "Terjadi kesalahan saat memproses text-to-speech.";
      ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : ${errMsg}\n` + `└ ◦ *Command* : ${ctx.command || "aivoicegen"}\n\n` + `${footer}`);
    }
  }
};