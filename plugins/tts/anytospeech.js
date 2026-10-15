import axios from "axios";
import db from "../../data/db.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
import {
  sendPTT
} from "../../lib/audio.js";
const CONFIG = {
  API_URL: `${global.bot?.api?.wudysoft}/api/misc/tts/v54`,
  DEFAULT_VOICE: "Kore",
  DEFAULT_ANIME_VOICE: "anime-girl",
  DEFAULT_LANG: "english",
  TIMEOUT: 6e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  ITEMS_PER_PAGE: 10
};

function initDB(jid = null, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.anyToSpeech) global.db.anyToSpeech = {};
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
async function requestAnyToSpeech(payload, senderId) {
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
    throw new Error(errMsg || "Gagal memproses permintaan AnyToSpeech API.");
  }
}
export default {
  name: "anytospeech",
  aliases: ["ttsv54", "tts54", "anitts", "animevoice", "ats"],
  description: "Text-to-Speech AI AnyToSpeech (Anime & Multi-Language TTS v54) dengan Sesi & Full DB.",
  category: "AI",
  limit: true,
  example: "anytospeech --anime --list\nanytospeech Halo selamat pagi\nanytospeech --info\nanytospeech --reset",
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
      const userSession = global.db.anyToSpeech[senderId] || null;
      const {
        flags,
        cleanText
      } = parseFlags(rawText);
      if (flags.reset || rawText === "--reset") {
        if (global.db.anyToSpeech[senderId]) {
          delete global.db.anyToSpeech[senderId];
          saveDB();
        }
        return ctx.reply(`– *A N Y  T O  S P E E C H*\n\n` + `┌ ◦ *Status* : Sesi karakter & model suara berhasil direset\n` + `│ ◦ *Default Mode* : Standard (${CONFIG.DEFAULT_VOICE})\n` + `└ ◦ *Action* : Ketik ${prefix}anytospeech --list untuk memilih karakter baru.\n\n` + `${footer}`);
      }
      if (flags.info || flags.status || rawText === "--info") {
        const isAnime = userSession ? userSession.anime : false;
        const currentVoice = userSession?.voice || (isAnime ? CONFIG.DEFAULT_ANIME_VOICE : CONFIG.DEFAULT_VOICE);
        const currentLang = userSession?.lang || CONFIG.DEFAULT_LANG;
        return ctx.reply(`– *S T A T U S*\n\n` + `┌ ◦ *User* : @${senderId.split("@")[0]}\n` + `│ ◦ *Mode* : ${isAnime ? "Anime / Famous Character" : "Standard Multi-Language"}\n` + `│ ◦ *Voice ID* : ${currentVoice}\n` + `│ ◦ *Display Name* : ${userSession?.name || currentVoice}\n` + `└ ◦ *Language* : ${currentLang}\n\n` + `_Ketik ${prefix}anytospeech <teks> untuk berbicara._\n\n` + `${footer}`, {
          mentions: [senderId]
        });
      }
      if (flags.setvoice) {
        const isAnime = flags.anime === true || String(flags.anime) === "true";
        const voiceName = String(flags.setvoice).trim();
        const langTarget = flags.lang || userSession?.lang || CONFIG.DEFAULT_LANG;
        const newSession = {
          voice: voiceName,
          name: flags.name || voiceName,
          anime: isAnime,
          lang: langTarget,
          provider: flags.provider || userSession?.provider || "gemini",
          updatedAt: Date.now()
        };
        global.db.anyToSpeech[senderId] = newSession;
        saveDB();
        await ctx.react("✅");
        return ctx.reply(`– *A N Y  T O  S P E E C H*\n\n` + `┌ ◦ *Model Voice* : ${newSession.name}\n` + `│ ◦ *Voice ID* : \`${newSession.voice}\`\n` + `│ ◦ *Mode* : ${isAnime ? "Anime / Famous" : "Standard TTS"}\n` + `│ ◦ *Language* : ${newSession.lang}\n` + `└ ◦ *Status* : Tersimpan ke sesi pengguna\n\n` + `_Ketik ${prefix}anytospeech <teks> untuk mulai berbicara._\n\n` + `${footer}`);
      }
      if (flags.search || flags.query || flags.list || rawText.startsWith("--search") || rawText.startsWith("--list") || flags.page) {
        const isAnime = flags.anime === true || String(flags.anime) === "true" || userSession?.anime && flags.anime === undefined;
        const selectedLang = flags.lang || userSession?.lang || CONFIG.DEFAULT_LANG;
        const searchQuery = flags.search || flags.query || !flags.page && cleanText || "";
        await ctx.react("⏳");
        const data = await requestAnyToSpeech({
          action: "voice_list",
          anime: isAnime,
          lang: selectedLang
        }, senderId);
        const allVoices = Array.isArray(data?.result?.voices) ? data.result.voices : [];
        if (!allVoices.length) {
          await ctx.react("❌");
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Gagal memuat daftar suara\n` + `└ ◦ *Info* : Server AnyToSpeech v54 tidak merespons.\n\n` + `${footer}`);
        }
        let matchedVoices = allVoices;
        if (searchQuery && searchQuery !== "true") {
          const filterKeyword = String(searchQuery).toLowerCase();
          matchedVoices = allVoices.filter(v => {
            const name = (v.display_name || v.slug || v.voice || "").toLowerCase();
            const desc = (v.description || "").toLowerCase();
            return name.includes(filterKeyword) || desc.includes(filterKeyword);
          });
        }
        if (!matchedVoices.length) {
          await ctx.react("❌");
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Model suara tidak ditemukan\n` + `└ ◦ *Query* : "${searchQuery}"\n\n` + `${footer}`);
        }
        const page = Math.max(1, Number(flags.page) || 1);
        const totalPages = Math.ceil(matchedVoices.length / CONFIG.ITEMS_PER_PAGE) || 1;
        const pageItems = matchedVoices.slice((page - 1) * CONFIG.ITEMS_PER_PAGE, page * CONFIG.ITEMS_PER_PAGE);
        if (!pageItems.length) {
          await ctx.react("❌");
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Halaman kosong\n` + `└ ◦ *Info* : Halaman ${page} tidak memiliki data suara.\n\n` + `${footer}`);
        }
        const voiceRows = pageItems.map((v, i) => {
          const globalIdx = (page - 1) * CONFIG.ITEMS_PER_PAGE + i + 1;
          const voiceId = v.slug || v.voice;
          const displayName = v.display_name || voiceId;
          const subInfo = v.description ? v.description.slice(0, 45) : v.gender || (isAnime ? "Anime Voice" : `Locale: ${v.lang || selectedLang}`);
          return {
            title: `${globalIdx}. ${displayName}`.slice(0, 24),
            id: `${prefix}anytospeech --setvoice "${voiceId}" --name "${displayName}" ${isAnime ? "--anime" : `--lang "${selectedLang}"`}`,
            description: `${subInfo} • ID: ${voiceId}`.slice(0, 60)
          };
        });
        let baseCmd = `${prefix}anytospeech`;
        if (isAnime) baseCmd += ` --anime`;
        if (!isAnime && selectedLang) baseCmd += ` --lang "${selectedLang}"`;
        if (searchQuery && searchQuery !== "true") baseCmd += ` --search "${searchQuery}"`;
        else baseCmd += ` --list`;
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: `PILIH MODEL SUARA (${pageItems.length})`,
            sections: [{
              title: `DAFTAR MODEL: ${isAnime ? "ANIME" : selectedLang.toUpperCase()} (Hal ${page}/${totalPages})`,
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
        const bodyText = `– *A N Y  T O  S P E E C H  -  L I S T*\n\n` + `┌ ◦ *Mode* : ${isAnime ? "Anime / Famous Character" : "Standard Multi-Language"}\n` + `│ ◦ *Language* : ${selectedLang}\n` + (searchQuery && searchQuery !== "true" ? `│ ◦ *Search* : "${searchQuery}"\n` : "") + `│ ◦ *Total* : ${matchedVoices.length} Model\n` + `│ ◦ *Page* : ${page} / ${totalPages}\n` + `└ ◦ *Engine* : AnyToSpeech (v54)\n\n` + `_Pilih model suara dari menu di bawah atau gunakan tombol navigasi halaman:_`;
        const options = {
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 1,
              divider_indices: [1],
              list_title: `${botName} • Voice Explorer`,
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
      const isAnime = flags.anime !== undefined ? flags.anime === true || String(flags.anime) === "true" : userSession ? userSession.anime : false;
      const selectedVoice = flags.voice || flags.slug || userSession?.voice || (isAnime ? CONFIG.DEFAULT_ANIME_VOICE : CONFIG.DEFAULT_VOICE);
      const selectedLang = flags.lang || userSession?.lang || CONFIG.DEFAULT_LANG;
      const textToSpeak = cleanText || flags.text;
      if (!textToSpeak) {
        const helpText = `– *A N Y  T O  S P E E C H*\n\n` + `┌ ◦ *Active Voice* : ${userSession?.name || selectedVoice}\n` + `│ ◦ *Mode* : ${isAnime ? "Anime" : "Standard"}\n` + `└ ◦ *Engine* : AnyToSpeech (v54)\n\n` + `– *U S A G E*\n\n` + `┌ ◦ *Speak* : ${prefix}anytospeech <teks>\n` + `│ ◦ *List Anime* : ${prefix}anytospeech --anime --list\n` + `│ ◦ *List Standard* : ${prefix}anytospeech --lang english --list\n` + `│ ◦ *Search* : ${prefix}anytospeech --search <nama>\n` + `└ ◦ *Custom* : ${prefix}anytospeech <teks> --voice <voice_id>\n\n` + `– *E X A M P L E*\n\n` + `└ ◦ ${prefix}anytospeech Konnichiwa minna-san, selamat datang!\n\n` + `${footer}`;
        return ctx.reply(helpText);
      }
      if (textToSpeak.length > 500) {
        return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : Panjang teks melebihi batas maksimal 500 karakter.\n` + `└ ◦ *Panjang Teks* : ${textToSpeak.length} karakter\n\n` + `${footer}`);
      }
      await ctx.react("⏳");
      const payload = {
        action: "create",
        text: String(textToSpeak),
        anime: isAnime,
        voice: String(selectedVoice),
        slug: String(selectedVoice),
        lang: selectedLang,
        vibe: flags.vibe || userSession?.vibe || "none",
        provider: flags.provider || userSession?.provider || "gemini"
      };
      const data = await requestAnyToSpeech(payload, senderId);
      const audioUrl = data?.result?.audio_url;
      if (!audioUrl) {
        throw new Error(data?.error || data?.result?.message || "Gagal mendapatkan URL audio.");
      }
      if (!global.db.anyToSpeech[senderId]) {
        global.db.anyToSpeech[senderId] = {
          voice: selectedVoice,
          name: flags.name || selectedVoice,
          anime: isAnime,
          lang: selectedLang,
          updatedAt: Date.now()
        };
      } else {
        global.db.anyToSpeech[senderId].voice = selectedVoice;
        global.db.anyToSpeech[senderId].updatedAt = Date.now();
      }
      saveDB();
      await sendPTT(sock, targetJid, audioUrl, quotedMsg);
      await ctx.react("🎙️");
    } catch (error) {
      console.error("[AnyToSpeech TTS Error]:", error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.error || error.response?.data?.message || error.message || "Terjadi kesalahan internal saat memproses suara.";
      ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : ${errMsg}\n` + `└ ◦ *Command* : ${ctx.command || "anytospeech"}\n\n` + `${footer}`);
    }
  }
};