import axios from "axios";
import db from "../../data/db.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
import {
  sendPTT
} from "../../lib/audio.js";
const CONFIG = {
  API_URL: `${global.bot?.api?.wudysoft}/api/misc/tts/v55`,
  DEFAULT_SLUG: "anime-girl",
  DEFAULT_VOICE: 0,
  DEFAULT_LANG: "id",
  TIMEOUT: 6e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
  ITEMS_PER_PAGE: 10
};

function initDB(jid = null, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.anyVoiceLab) global.db.anyVoiceLab = {};
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
async function requestAnyVoiceLab(payload, senderId) {
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
    throw new Error(errMsg || "Gagal memproses permintaan AnyVoiceLab API.");
  }
}
export default {
  name: "anyvoicelab",
  aliases: ["ttsv55", "tts55", "voicelab", "avltts"],
  description: "Text-to-Speech AnyVoiceLab (Worker Token Gateway TTS v55) dengan Sesi & Full DB.",
  category: "AI",
  limit: true,
  example: "anyvoicelab --list\nanyvoicelab Halo selamat pagi\nanyvoicelab --slug anime-girl --voice 0 --lang id\nanyvoicelab --reset",
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
      const userSession = global.db.anyVoiceLab[senderId] || null;
      const {
        flags,
        cleanText
      } = parseFlags(rawText);
      if (flags.reset || rawText === "--reset") {
        if (global.db.anyVoiceLab[senderId]) {
          delete global.db.anyVoiceLab[senderId];
          saveDB();
        }
        return ctx.reply(`– *A N Y  V O I C E  L A B*\n\n` + `┌ ◦ *Status* : Sesi model suara berhasil direset\n` + `│ ◦ *Default Slug* : ${CONFIG.DEFAULT_SLUG}\n` + `│ ◦ *Default Voice* : Voice #${CONFIG.DEFAULT_VOICE + 1}\n` + `└ ◦ *Action* : Ketik ${prefix}anyvoicelab --list untuk melihat daftar suara.\n\n` + `${footer}`);
      }
      if (flags.info || flags.status || rawText === "--info") {
        const currentSlug = userSession?.slug || CONFIG.DEFAULT_SLUG;
        const currentVoice = userSession?.voice !== undefined ? userSession.voice : CONFIG.DEFAULT_VOICE;
        const currentLang = userSession?.lang || CONFIG.DEFAULT_LANG;
        return ctx.reply(`– *S T A T U S  A N Y  V O I C E  L A B*\n\n` + `┌ ◦ *User* : @${senderId.split("@")[0]}\n` + `│ ◦ *Slug Model* : ${currentSlug}\n` + `│ ◦ *Voice Index* : ${currentVoice} (${userSession?.name || `Voice ${Number(currentVoice) + 1}`})\n` + `└ ◦ *Language* : ${currentLang.toUpperCase()}\n\n` + `_Ketik ${prefix}anyvoicelab <teks> untuk berbicara._\n\n` + `${footer}`, {
          mentions: [senderId]
        });
      }
      if (flags.setvoice) {
        const targetSlug = flags.slug || userSession?.slug || CONFIG.DEFAULT_SLUG;
        const targetVoice = Number(flags.setvoice) || 0;
        const targetLang = flags.lang || userSession?.lang || CONFIG.DEFAULT_LANG;
        const newSession = {
          slug: targetSlug,
          voice: targetVoice,
          name: flags.name || `Voice ${targetVoice + 1}`,
          lang: targetLang,
          updatedAt: Date.now()
        };
        global.db.anyVoiceLab[senderId] = newSession;
        saveDB();
        await ctx.react("✅");
        return ctx.reply(`– *A N Y  V O I C E  L A B*\n\n` + `┌ ◦ *Slug* : \`${newSession.slug}\`\n` + `│ ◦ *Voice Index* : ${newSession.voice} (${newSession.name})\n` + `│ ◦ *Language* : ${newSession.lang.toUpperCase()}\n` + `└ ◦ *Status* : Tersimpan ke sesi pengguna\n\n` + `_Ketik ${prefix}anyvoicelab <teks> untuk mulai berbicara._\n\n` + `${footer}`);
      }
      if (flags.search || flags.query || flags.list || rawText.startsWith("--search") || rawText.startsWith("--list") || flags.page) {
        const targetSlug = flags.slug || userSession?.slug || CONFIG.DEFAULT_SLUG;
        const targetLang = flags.lang || userSession?.lang || CONFIG.DEFAULT_LANG;
        const searchQuery = flags.search || flags.query || !flags.page && cleanText || "";
        await ctx.react("⏳");
        const data = await requestAnyVoiceLab({
          action: "voice_list",
          slug: targetSlug,
          lang: targetLang
        }, senderId);
        const result = data?.result || {};
        const allVoices = Array.isArray(result?.voices) ? result.voices : [];
        if (!allVoices.length) {
          await ctx.react("❌");
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Gagal memuat varian suara\n` + `└ ◦ *Slug* : "${targetSlug}" tidak ditemukan atau tidak tersedia.\n\n` + `${footer}`);
        }
        let matchedVoices = allVoices;
        if (searchQuery && searchQuery !== "true") {
          const q = String(searchQuery).toLowerCase();
          matchedVoices = allVoices.filter(v => {
            const name = (v.display_name || "").toLowerCase();
            return name.includes(q) || String(v.index) === q;
          });
        }
        if (!matchedVoices.length) {
          await ctx.react("❌");
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Varian suara tidak ditemukan\n` + `└ ◦ *Query* : "${searchQuery}" pada slug "${targetSlug}"\n\n` + `${footer}`);
        }
        const page = Math.max(1, Number(flags.page) || 1);
        const totalPages = Math.ceil(matchedVoices.length / CONFIG.ITEMS_PER_PAGE) || 1;
        const pageItems = matchedVoices.slice((page - 1) * CONFIG.ITEMS_PER_PAGE, page * CONFIG.ITEMS_PER_PAGE);
        const voiceRows = pageItems.map(v => {
          const vIdx = v.index;
          const vName = v.display_name || `Voice ${vIdx + 1}`;
          return {
            title: `🎙️ ${vName}`.slice(0, 24),
            id: `${prefix}anyvoicelab --setvoice ${vIdx} --slug "${targetSlug}" --name "${vName}" --lang "${targetLang}"`,
            description: `Index: ${vIdx} | Slug: ${targetSlug}`.slice(0, 60)
          };
        });
        let baseCmd = `${prefix}anyvoicelab --slug "${targetSlug}" --lang "${targetLang}"`;
        if (searchQuery && searchQuery !== "true") baseCmd += ` --search "${searchQuery}"`;
        else baseCmd += ` --list`;
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: `PILIH VARIAN SUARA (${pageItems.length})`,
            sections: [{
              title: `VARIAN: ${targetSlug.toUpperCase()} (Hal ${page}/${totalPages})`,
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
        const bodyText = `– *A N Y  V O I C E  L A B  -  L I S T*\n\n` + `┌ ◦ *Character Slug* : \`${targetSlug}\`\n` + `│ ◦ *Language* : ${targetLang.toUpperCase()}\n` + `│ ◦ *Total Varian* : ${matchedVoices.length}\n` + `│ ◦ *Page* : ${page} / ${totalPages}\n` + `└ ◦ *Engine* : AnyVoiceLab (v55)\n\n` + `_Pilih varian suara dari menu di bawah atau gunakan tombol navigasi halaman:_`;
        const options = {
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 1,
              divider_indices: [1],
              list_title: `${botName} • Voice Lab Explorer`,
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
      const selectedSlug = flags.slug || userSession?.slug || CONFIG.DEFAULT_SLUG;
      const selectedVoice = flags.voice !== undefined ? Number(flags.voice) : userSession?.voice !== undefined ? userSession.voice : CONFIG.DEFAULT_VOICE;
      const selectedLang = flags.lang || userSession?.lang || CONFIG.DEFAULT_LANG;
      const textToSpeak = cleanText || flags.text;
      if (!textToSpeak) {
        const helpText = `– *A N Y  V O I C E  L A B*\n\n` + `┌ ◦ *Active Slug* : ${selectedSlug}\n` + `│ ◦ *Active Voice* : Index ${selectedVoice} (${userSession?.name || `Voice ${selectedVoice + 1}`})\n` + `│ ◦ *Active Lang* : ${selectedLang.toUpperCase()}\n` + `└ ◦ *Engine* : AnyVoiceLab (v55)\n\n` + `– *U S A G E*\n\n` + `┌ ◦ *Speak* : ${prefix}anyvoicelab <teks>\n` + `│ ◦ *List Suara* : ${prefix}anyvoicelab --list\n` + `│ ◦ *Ubah Karakter* : ${prefix}anyvoicelab --slug <nama_slug> --list\n` + `└ ◦ *Custom* : ${prefix}anyvoicelab <teks> --slug ${selectedSlug} --voice 0 --lang id\n\n` + `– *E X A M P L E*\n\n` + `└ ◦ ${prefix}anyvoicelab Halo semuanya, apa kabar hari ini?\n\n` + `${footer}`;
        return ctx.reply(helpText);
      }
      if (textToSpeak.length > 400) {
        return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : Panjang teks melebihi batas (400 karakter).\n` + `└ ◦ *Panjang Teks* : ${textToSpeak.length} karakter\n\n` + `${footer}`);
      }
      await ctx.react("⏳");
      const payload = {
        action: "create",
        text: String(textToSpeak),
        slug: String(selectedSlug),
        voice: Number(selectedVoice),
        lang: String(selectedLang)
      };
      const data = await requestAnyVoiceLab(payload, senderId);
      const result = data?.result || {};
      const audioBase64 = result.audio_base64;
      if (!audioBase64) {
        throw new Error(data?.error || result.message || "Gagal mendapatkan audio base64 dari server.");
      }
      if (!global.db.anyVoiceLab[senderId]) {
        global.db.anyVoiceLab[senderId] = {
          slug: selectedSlug,
          voice: selectedVoice,
          name: result.display_name || `Voice ${selectedVoice + 1}`,
          lang: selectedLang,
          updatedAt: Date.now()
        };
      } else {
        global.db.anyVoiceLab[senderId].slug = selectedSlug;
        global.db.anyVoiceLab[senderId].voice = selectedVoice;
        global.db.anyVoiceLab[senderId].lang = selectedLang;
        global.db.anyVoiceLab[senderId].updatedAt = Date.now();
      }
      saveDB();
      const audioBuffer = Buffer.from(audioBase64, "base64");
      await sendPTT(sock, targetJid, audioBuffer, quotedMsg);
      await ctx.react("🎙️");
    } catch (error) {
      console.error("[AnyVoiceLab TTS Error]:", error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.error || error.response?.data?.message || error.message || "Terjadi kesalahan internal saat memproses suara.";
      ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : ${errMsg}\n` + `└ ◦ *Command* : ${ctx.command || "anyvoicelab"}\n\n` + `${footer}`);
    }
  }
};