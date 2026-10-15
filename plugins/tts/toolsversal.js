import axios from "axios";
import db from "../../data/db.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
import {
  sendPTT
} from "../../lib/audio.js";
const CONFIG = {
  API_URL: `${global.bot?.api?.wudysoft}/api/misc/tts/v53`,
  DEFAULT_VOICE: "ja-JP-NanamiNeural",
  DEFAULT_LANG: "ja-JP",
  TIMEOUT: 6e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  ITEMS_PER_PAGE: 10
};

function initDB(jid = null, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.toolversal) global.db.toolversal = {};
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
async function requestToolversal(payload, senderId) {
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
    throw new Error(errMsg || "Gagal memproses permintaan Toolversal API.");
  }
}
export default {
  name: "toolversal",
  aliases: ["ttsv53", "tts53", "animetts", "tooltts"],
  description: "Text-to-Speech AI Toolversal (Anime & Multi-Language TTS v53) dengan Sesi & Full DB.",
  category: "AI",
  limit: true,
  example: "toolversal --list\ntoolversal Konnichiwa minna-san\ntoolversal --lang ja-JP --voice ja-JP-NanamiNeural\ntoolversal --reset",
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
      const userSession = global.db.toolversal[senderId] || null;
      const {
        flags,
        cleanText
      } = parseFlags(rawText);
      if (flags.reset || rawText === "--reset") {
        if (global.db.toolversal[senderId]) {
          delete global.db.toolversal[senderId];
          saveDB();
        }
        return ctx.reply(`– *T O O L V E R S A L  T T S*\n\n` + `┌ ◦ *Status* : Sesi model suara anime berhasil direset\n` + `│ ◦ *Default Voice* : ${CONFIG.DEFAULT_VOICE}\n` + `│ ◦ *Default Lang* : ${CONFIG.DEFAULT_LANG}\n` + `└ ◦ *Action* : Ketik ${prefix}toolversal --list untuk memilih karakter baru.\n\n` + `${footer}`);
      }
      if (flags.info || flags.status || rawText === "--info") {
        const currentVoice = userSession?.voice || CONFIG.DEFAULT_VOICE;
        const currentLang = userSession?.lang || CONFIG.DEFAULT_LANG;
        const currentRate = userSession?.rate || 1;
        const currentPitch = userSession?.pitch || 1;
        return ctx.reply(`– *S T A T U S  T O O L V E R S A L*\n\n` + `┌ ◦ *User* : @${senderId.split("@")[0]}\n` + `│ ◦ *Model Voice* : ${currentVoice}\n` + `│ ◦ *Display Name* : ${userSession?.name || currentVoice}\n` + `│ ◦ *Language* : ${currentLang}\n` + `│ ◦ *Speed Rate* : ${currentRate}x\n` + `└ ◦ *Pitch* : ${currentPitch}x\n\n` + `_Ketik ${prefix}toolversal <teks> untuk berbicara._\n\n` + `${footer}`, {
          mentions: [senderId]
        });
      }
      if (flags.setvoice) {
        const voiceName = String(flags.setvoice).trim();
        const targetLang = flags.lang || userSession?.lang || CONFIG.DEFAULT_LANG;
        const newSession = {
          voice: voiceName,
          name: flags.name || voiceName,
          lang: targetLang,
          rate: flags.rate ? parseFloat(flags.rate) : userSession?.rate || 1,
          pitch: flags.pitch ? parseFloat(flags.pitch) : userSession?.pitch || 1,
          style: flags.style || userSession?.style || "",
          updatedAt: Date.now()
        };
        global.db.toolversal[senderId] = newSession;
        saveDB();
        await ctx.react("✅");
        return ctx.reply(`– *T O O L V E R S A L  T T S*\n\n` + `┌ ◦ *Model Voice* : ${newSession.name}\n` + `│ ◦ *Voice ID* : \`${newSession.voice}\`\n` + `│ ◦ *Language* : ${newSession.lang}\n` + `│ ◦ *Speed Rate* : ${newSession.rate}x\n` + `└ ◦ *Status* : Tersimpan ke sesi pengguna\n\n` + `_Ketik ${prefix}toolversal <teks> untuk mulai berbicara._\n\n` + `${footer}`);
      }
      if (flags.search || flags.query || flags.list || rawText.startsWith("--search") || rawText.startsWith("--list") || flags.page) {
        const targetLang = flags.lang || userSession?.lang || CONFIG.DEFAULT_LANG;
        const searchQuery = flags.search || flags.query || !flags.page && cleanText || "";
        await ctx.react("⏳");
        const data = await requestToolversal({
          action: "voice_list",
          lang: targetLang
        }, senderId);
        const result = data?.result || {};
        const allVoices = Array.isArray(result?.voices) ? result.voices : [];
        if (!allVoices.length) {
          await ctx.react("❌");
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Gagal memuat daftar speaker\n` + `└ ◦ *Language* : "${targetLang}" tidak memiliki model suara aktif.\n\n` + `${footer}`);
        }
        let matchedVoices = allVoices;
        if (searchQuery && searchQuery !== "true") {
          const q = String(searchQuery).toLowerCase();
          matchedVoices = allVoices.filter(v => {
            const name = (v.name || "").toLowerCase();
            const displayName = (v.display_name || "").toLowerCase();
            const localName = (v.local_name || "").toLowerCase();
            return name.includes(q) || displayName.includes(q) || localName.includes(q);
          });
        }
        if (!matchedVoices.length) {
          await ctx.react("❌");
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Model suara tidak ditemukan\n` + `└ ◦ *Query* : "${searchQuery}" untuk bahasa [${targetLang}]\n\n` + `${footer}`);
        }
        const page = Math.max(1, Number(flags.page) || 1);
        const totalPages = Math.ceil(matchedVoices.length / CONFIG.ITEMS_PER_PAGE) || 1;
        const pageItems = matchedVoices.slice((page - 1) * CONFIG.ITEMS_PER_PAGE, page * CONFIG.ITEMS_PER_PAGE);
        const voiceRows = pageItems.map(v => {
          const vName = v.display_name || v.local_name || v.name;
          const genderType = v.gender ? `${v.gender} • ` : "";
          const desc = `${genderType}${v.voice_type || "Anime Neural"}`.slice(0, 50);
          return {
            title: `🎙️ ${vName}`.slice(0, 24),
            id: `${prefix}toolversal --setvoice "${v.name}" --name "${vName}" --lang "${targetLang}"`,
            description: `${desc} • ID: ${v.name}`.slice(0, 60)
          };
        });
        let baseCmd = `${prefix}toolversal --lang "${targetLang}"`;
        if (searchQuery && searchQuery !== "true") baseCmd += ` --search "${searchQuery}"`;
        else baseCmd += ` --list`;
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: `PILIH MODEL SUARA (${pageItems.length})`,
            sections: [{
              title: `DAFTAR MODEL: ${targetLang} (Hal ${page}/${totalPages})`,
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
        const bodyText = `– *T O O L V E R S A L  -  V O I C E S*\n\n` + `┌ ◦ *Language* : ${targetLang}\n` + `│ ◦ *Total Model* : ${matchedVoices.length}\n` + `│ ◦ *Page* : ${page} / ${totalPages}\n` + `└ ◦ *Engine* : Toolversal Anime TTS (v53)\n\n` + `_Pilih karakter suara dari menu di bawah atau gunakan navigasi halaman:_`;
        const options = {
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 1,
              divider_indices: [1],
              list_title: `${botName} • Anime TTS Explorer`,
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
      const speedRate = flags.rate ? parseFloat(flags.rate) : userSession?.rate || 1;
      const pitchVal = flags.pitch ? parseFloat(flags.pitch) : userSession?.pitch || 1;
      const textToSpeak = cleanText || flags.text;
      if (!textToSpeak) {
        const helpText = `– *T O O L V E R S A L  T T S*\n\n` + `┌ ◦ *Active Voice* : ${userSession?.name || selectedVoice}\n` + `│ ◦ *Active Lang* : ${selectedLang}\n` + `└ ◦ *Engine* : Anime Text-to-Speech (v53)\n\n` + `– *U S A G E*\n\n` + `┌ ◦ *Speak* : ${prefix}toolversal <teks>\n` + `│ ◦ *List Suara* : ${prefix}toolversal --list\n` + `│ ◦ *Pilih Bahasa* : ${prefix}toolversal --lang ja-JP --list\n` + `│ ◦ *Search* : ${prefix}toolversal --search <nama>\n` + `└ ◦ *Custom* : ${prefix}toolversal <teks> --voice ${selectedVoice} --rate 1.1\n\n` + `– *E X A M P L E*\n\n` + `└ ◦ ${prefix}toolversal Konnichiwa, watashi wa anime character desu!\n\n` + `${footer}`;
        return ctx.reply(helpText);
      }
      if (textToSpeak.length > 800) {
        return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : Panjang teks melebihi batas (800 karakter).\n` + `└ ◦ *Panjang Teks* : ${textToSpeak.length} karakter\n\n` + `${footer}`);
      }
      await ctx.react("⏳");
      const payload = {
        action: "create",
        text: String(textToSpeak),
        voice: String(selectedVoice),
        lang: String(selectedLang),
        rate: speedRate,
        pitch: pitchVal,
        style: flags.style || userSession?.style || ""
      };
      const data = await requestToolversal(payload, senderId);
      const result = data?.result || {};
      const audioUrl = result.public_url || result.download_url;
      const audioBase64 = result.audio_base64;
      if (!audioUrl && !audioBase64) {
        throw new Error(data?.error || result.message || "Gagal mendapatkan audio dari server.");
      }
      if (!global.db.toolversal[senderId]) {
        global.db.toolversal[senderId] = {
          voice: selectedVoice,
          name: flags.name || selectedVoice,
          lang: selectedLang,
          rate: speedRate,
          pitch: pitchVal,
          updatedAt: Date.now()
        };
      } else {
        global.db.toolversal[senderId].voice = selectedVoice;
        global.db.toolversal[senderId].lang = selectedLang;
        global.db.toolversal[senderId].rate = speedRate;
        global.db.toolversal[senderId].pitch = pitchVal;
        global.db.toolversal[senderId].updatedAt = Date.now();
      }
      saveDB();
      const audioSource = audioUrl && audioUrl.startsWith("http") ? audioUrl : Buffer.from(audioBase64, "base64");
      await sendPTT(sock, targetJid, audioSource, quotedMsg);
      await ctx.react("🎙️");
    } catch (error) {
      console.error("[Toolversal TTS Error]:", error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.error || error.response?.data?.message || error.message || "Terjadi kesalahan internal saat memproses suara.";
      ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : ${errMsg}\n` + `└ ◦ *Command* : ${ctx.command || "toolversal"}\n\n` + `${footer}`);
    }
  }
};