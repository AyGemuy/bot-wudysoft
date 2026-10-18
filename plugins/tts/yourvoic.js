import axios from "axios";
import db from "../../data/db.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
import {
  sendPTT
} from "../../lib/audio.js";
const CONFIG = {
  API_URL: `${global.bot?.api?.wudysoft}/api/misc/tts/v41`,
  TIMEOUT: 6e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  ITEMS_PER_PAGE: 10,
  CACHE_TTL: 1e3 * 60 * 60 * 24
};
let cachedVoices = {
  list: [],
  lastFetched: 0
};

function initDB(jid = null, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.yourVoic) global.db.yourVoic = {};
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
    if (typeof val === "string" && (val.startsWith('"') || val.startsWith("'"))) val = val.slice(1, -1);
    flags[key] = val;
  }
  const cleanText = rawStr.replace(/--([a-zA-Z0-9_-]+)(?:\s+("[^"]*"|'[^']*'|[^\s--]+))?/g, "").trim();
  return {
    flags: flags,
    cleanText: cleanText
  };
}
async function getVoiceList() {
  const now = Date.now();
  if (cachedVoices.list.length && now - cachedVoices.lastFetched < CONFIG.CACHE_TTL) return cachedVoices.list;
  const {
    data
  } = await axios.get(`${CONFIG.API_URL}?action=voice_list`, {
    headers: {
      "User-Agent": CONFIG.USER_AGENT
    },
    timeout: CONFIG.TIMEOUT
  });
  if (Array.isArray(data) && data.length) {
    cachedVoices = {
      list: data,
      lastFetched: now
    };
    return data;
  }
  return cachedVoices.list;
}
export default {
  name: "yourvoic",
  aliases: ["yourvoice", "tts41", "yvtts"],
  description: "Text-to-Speech YourVoic dengan Session Voice & Konversi Opus (Full DB)",
  category: "AI",
  limit: true,
  example: "yourvoic --list\nyourvoic halo semua\nyourvoic --info\nyourvoic --reset",
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
      const userSession = global.db.yourVoic[senderId] || null;
      const {
        flags,
        cleanText
      } = parseFlags(rawText);
      if (flags.reset || rawText === "--reset") {
        if (global.db.yourVoic[senderId]) {
          delete global.db.yourVoic[senderId];
          saveDB();
        }
        return ctx.reply(`– *Y O U R  V O I C*\n\n` + `┌ ◦ *Status* : Sesi suara berhasil direset\n` + `└ ◦ *Action* : Ketik ${prefix}yourvoic --list untuk memilih karakter baru.\n\n` + `${footer}`);
      }
      if (flags.info || flags.status || rawText === "--info") {
        if (!userSession) {
          return ctx.reply(`– *S T A T U S*\n\n` + `┌ ◦ *Status* : Belum ada sesi suara aktif\n` + `└ ◦ *Action* : Ketik ${prefix}yourvoic --list untuk memilih karakter.\n\n` + `${footer}`);
        }
        return ctx.reply(`– *S T A T U S*\n\n` + `┌ ◦ *User* : @${senderId.split("@")[0]}\n` + `│ ◦ *Character* : ${userSession.voiceName} (${userSession.gender})\n` + `└ ◦ *Description* : ${userSession.description}\n\n` + `_Ketik ${prefix}yourvoic <teks> untuk berbicara._\n\n` + `${footer}`, {
          mentions: [senderId]
        });
      }
      if (flags.setvoice) {
        const allVoices = await getVoiceList();
        const queryTarget = String(flags.setvoice).toLowerCase().trim();
        const found = allVoices.find(v => v.id?.toLowerCase() === queryTarget || v.name?.toLowerCase() === queryTarget);
        const newSession = {
          voiceId: found ? found.id : String(flags.setvoice),
          voiceName: found ? found.name : String(flags.setvoice),
          gender: found ? found.gender || "AI" : flags.gender || "AI",
          description: found ? found.description || "Natural" : "Natural",
          updatedAt: Date.now()
        };
        global.db.yourVoic[senderId] = newSession;
        saveDB();
        await ctx.react("✅");
        return ctx.reply(`– *Y O U R  V O I C*\n\n` + `┌ ◦ *Character* : ${newSession.voiceName} (${newSession.gender})\n` + `│ ◦ *Description* : ${newSession.description}\n` + `└ ◦ *Status* : Tersimpan ke sesi pengguna\n\n` + `_Ketik ${prefix}yourvoic <teks> untuk mulai berbicara._\n\n` + `${footer}`);
      }
      if (flags.list || flags.search || flags.query || rawText.startsWith("--list") || rawText.startsWith("--search") || flags.page) {
        await ctx.react("⏳");
        const allVoices = await getVoiceList();
        let filtered = allVoices;
        const q = String(flags.search || flags.query || !flags.page && cleanText || "").toLowerCase().trim();
        if (q && q !== "true") {
          filtered = filtered.filter(v => Object.values(v).some(val => String(val).toLowerCase().includes(q)));
        }
        const page = Math.max(1, Number(flags.page) || 1);
        const totalPages = Math.ceil(filtered.length / CONFIG.ITEMS_PER_PAGE) || 1;
        const pageItems = filtered.slice((page - 1) * CONFIG.ITEMS_PER_PAGE, page * CONFIG.ITEMS_PER_PAGE);
        if (!pageItems.length) {
          await ctx.react("❌");
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Karakter tidak ditemukan\n` + `└ ◦ *Query* : "${q}" (Halaman ${page})\n\n` + `${footer}`);
        }
        const femaleRows = pageItems.filter(v => v.gender === "female").map(v => ({
          title: `👩 ${v.name}`.slice(0, 24),
          id: `${prefix}yourvoic --setvoice "${v.id}" --gender "female"`,
          description: `${v.description || "Natural"} • ${v.english_us_name || v.name}`.slice(0, 60)
        }));
        const maleRows = pageItems.filter(v => v.gender === "male").map(v => ({
          title: `👨 ${v.name}`.slice(0, 24),
          id: `${prefix}yourvoic --setvoice "${v.id}" --gender "male"`,
          description: `${v.description || "Natural"} • ${v.english_us_name || v.name}`.slice(0, 60)
        }));
        const sections = [];
        if (femaleRows.length) {
          sections.push({
            title: `SUARA WANITA (Hal ${page})`,
            rows: femaleRows
          });
        }
        if (maleRows.length) {
          sections.push({
            title: `SUARA PRIA (Hal ${page})`,
            rows: maleRows
          });
        }
        let baseCmd = `${prefix}yourvoic`;
        if (q && q !== "true") baseCmd += ` --search "${q}"`;
        else baseCmd += ` --list`;
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: `PILIH KARAKTER (${pageItems.length})`,
            sections: sections
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
        const bodyText = `– *Y O U R  V O I C  -  V O I C E S*\n\n` + `┌ ◦ *Total* : ${filtered.length} Model Tersedia\n` + `│ ◦ *Page* : ${page} / ${totalPages}\n` + (q && q !== "true" ? `│ ◦ *Search* : "${q}"\n` : "") + `└ ◦ *Engine* : YourVoic AI TTS\n\n` + `_Pilih karakter suara pada tombol di bawah:_\n\n` + `${footer}`;
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
          fallback += [...femaleRows, ...maleRows].map(r => `• *${r.title}*\n  Perintah: \`${r.id}\``).join("\n\n");
          if (totalPages > 1) {
            fallback += `\n\n_Pindah Halaman: Ketik \`${baseCmd} --page ${page < totalPages ? page + 1 : page - 1}\`_`;
          }
          await ctx.reply(fallback);
        }
        await ctx.react("✅");
        return;
      }
      const selectedVoice = flags.voice || (userSession ? userSession.voiceId : null);
      if (!selectedVoice) {
        return ctx.reply(`– *Y O U R  V O I C*\n\n` + `┌ ◦ *Status* : Belum memilih karakter suara\n` + `│ ◦ *List* : ${prefix}yourvoic --list\n` + `└ ◦ *Search* : ${prefix}yourvoic --search <nama>\n\n` + `${footer}`);
      }
      const textToSpeak = cleanText || flags.text;
      if (!textToSpeak) {
        return ctx.reply(`– *Y O U R  V O I C*\n\n` + `┌ ◦ *Active* : ${userSession?.voiceName || selectedVoice}\n` + `│ ◦ *Usage* : ${prefix}yourvoic <teks>\n` + `└ ◦ *Example* : ${prefix}yourvoic Halo semuanya\n\n` + `${footer}`);
      }
      await ctx.react("⏳");
      await ctx.reply(`– *P R O C E S S*\n\n` + `┌ ◦ *Character* : ${userSession?.voiceName || selectedVoice}\n` + `│ ◦ *Text* : "${textToSpeak}"\n` + `└ ◦ *Status* : Memproses audio YourVoic...\n\n` + `${footer}`);
      const res = await axios.post(CONFIG.API_URL, {
        action: "generate",
        text: String(textToSpeak),
        voice: String(selectedVoice),
        language: flags.language || flags.lang || "en-US"
      }, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": CONFIG.USER_AGENT
        },
        timeout: CONFIG.TIMEOUT
      });
      const audioUrl = res.data?.result || res.data?.audio_url;
      if (!res.data?.success || !audioUrl) {
        throw new Error(res.data?.message || "Gagal membuat audio YourVoic.");
      }
      await sendPTT(sock, targetJid, audioUrl, quotedMsg);
      await ctx.react("🎙️");
    } catch (error) {
      console.error("[YourVoic Error]:", error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || error.message;
      ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : ${errMsg}\n` + `└ ◦ *Command* : ${ctx.command || "yourvoic"}\n\n` + `${footer}`);
    }
  }
};