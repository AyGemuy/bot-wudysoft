import axios from "axios";
import db from "../../data/db.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
import {
  sendPTT
} from "../../lib/audio.js";
const CONFIG = {
  API_URL: `${global.bot?.api?.wudysoft}/api/misc/tts/v25`,
  TIMEOUT: 9e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  ITEMS_PER_PAGE: 10
};
let cachedVoices = null;

function initDB(jid = null, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.expresso) global.db.expresso = {};
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

function formatVoiceName(item) {
  if (item.name) return item.name;
  const path = item.path_on_server || "";
  const parts = path.split("/");
  const filename = parts[parts.length - 1] || path;
  const cleanName = filename.replace(/\.(wav|mp3)$/i, "").replace(/[_-]/g, " ");
  if (path.startsWith("expresso/")) {
    const match = path.match(/ex\d+-ex\d+_([a-zA-Z-]+)_/);
    const emo = match ? match[1].toUpperCase() : "EXPRESSO";
    return `Expresso (${emo})`;
  }
  if (path.startsWith("ears/")) {
    const speaker = parts[1] || "P001";
    const emoMatch = filename.match(/emo_([a-zA-Z]+)_/);
    const emo = emoMatch ? emoMatch[1].toUpperCase() : "NATURAL";
    return `EARS ${speaker.toUpperCase()} (${emo})`;
  }
  return cleanName.replace(/\b\w/g, c => c.toUpperCase());
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
  if (cachedVoices && cachedVoices.length) return cachedVoices;
  const {
    data
  } = await axios.get(`${CONFIG.API_URL}?action=voice_list`, {
    headers: {
      "User-Agent": CONFIG.USER_AGENT
    },
    timeout: CONFIG.TIMEOUT
  });
  const list = Array.isArray(data) ? data : [];
  if (list.length) {
    cachedVoices = list.map(item => ({
      path: item.path_on_server,
      name: formatVoiceName(item)
    }));
    return cachedVoices;
  }
  return [];
}
export default {
  name: "expresso",
  aliases: ["tts25", "emotts", "kyutai", "suaraemosi"],
  description: "Text-to-Speech AI Emosional dengan Session Voice & Konversi Opus (Full DB)",
  category: "AI",
  limit: true,
  example: "expresso --search angry\nexpresso halo kawan\nexpresso --info\nexpresso --reset",
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
      const userSession = global.db.expresso[senderId] || null;
      const {
        flags,
        cleanText
      } = parseFlags(rawText);
      if (flags.reset || rawText === "--reset") {
        if (global.db.expresso[senderId]) {
          delete global.db.expresso[senderId];
          saveDB();
        }
        return ctx.reply(`– *E X P R E S S O*\n\n` + `┌ ◦ *Status* : Sesi emosi suara berhasil direset\n` + `└ ◦ *Action* : Ketik ${prefix}expresso --list untuk memilih suara baru.\n\n` + `${footer}`);
      }
      if (flags.info || flags.status || rawText === "--info") {
        if (!userSession) {
          return ctx.reply(`– *S T A T U S*\n\n` + `┌ ◦ *Status* : Belum ada sesi suara aktif\n` + `└ ◦ *Action* : Ketik ${prefix}expresso --list untuk memilih emosi.\n\n` + `${footer}`);
        }
        return ctx.reply(`– *S T A T U S*\n\n` + `┌ ◦ *User* : @${senderId.split("@")[0]}\n` + `│ ◦ *Emotion* : ${userSession.voiceName}\n` + `└ ◦ *Path* : ${userSession.voicePath}\n\n` + `_Ketik ${prefix}expresso <teks> untuk berbicara._\n\n` + `${footer}`, {
          mentions: [senderId]
        });
      }
      if (flags.setvoice) {
        const allVoices = await getVoiceList();
        const queryTarget = String(flags.setvoice).toLowerCase().trim();
        const found = allVoices.find(v => v.path.toLowerCase().includes(queryTarget) || v.name.toLowerCase().includes(queryTarget));
        const newSession = {
          voicePath: found ? found.path : String(flags.setvoice),
          voiceName: found ? found.name : flags.name || "Custom Emotion",
          updatedAt: Date.now()
        };
        global.db.expresso[senderId] = newSession;
        saveDB();
        await ctx.react("✅");
        return ctx.reply(`– *E X P R E S S O*\n\n` + `┌ ◦ *Emotion* : ${newSession.voiceName}\n` + `│ ◦ *Path* : ${newSession.voicePath}\n` + `└ ◦ *Status* : Tersimpan ke sesi pengguna\n\n` + `_Ketik ${prefix}expresso <teks> untuk mulai menghasilkan suara._\n\n` + `${footer}`);
      }
      if (flags.list || flags.search || flags.query || flags.emotion || rawText.startsWith("--list") || rawText.startsWith("--search") || flags.page) {
        await ctx.react("⏳");
        const allVoices = await getVoiceList();
        let filtered = allVoices;
        const q = String(flags.search || flags.query || flags.emotion || !flags.page && cleanText || "").toLowerCase().trim();
        if (q && q !== "true") {
          filtered = filtered.filter(v => v.name.toLowerCase().includes(q) || v.path.toLowerCase().includes(q));
        }
        const page = Math.max(1, Number(flags.page) || 1);
        const totalPages = Math.ceil(filtered.length / CONFIG.ITEMS_PER_PAGE) || 1;
        const pageItems = filtered.slice((page - 1) * CONFIG.ITEMS_PER_PAGE, page * CONFIG.ITEMS_PER_PAGE);
        if (!pageItems.length) {
          await ctx.react("❌");
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Emosi tidak ditemukan\n` + `└ ◦ *Query* : ${q} (Halaman ${page})\n\n` + `${footer}`);
        }
        const rows = pageItems.map(v => ({
          title: `🎭 ${v.name}`.slice(0, 24),
          id: `${prefix}expresso --setvoice "${v.path}" --name "${v.name}"`,
          description: `Path: ${v.path.slice(0, 45)}...`
        }));
        let baseCmd = `${prefix}expresso`;
        if (q && q !== "true") baseCmd += ` --search "${q}"`;
        else baseCmd += ` --list`;
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: `PILIH EMOSI SUARA (${pageItems.length})`,
            sections: [{
              title: `DAFTAR EMOSI (Hal ${page}/${totalPages})`,
              rows: rows
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
        const bodyText = `– *E X P R E S S O  -  V O I C E S*\n\n` + `┌ ◦ *Total* : ${filtered.length} Emosi Tersedia\n` + `│ ◦ *Page* : ${page} / ${totalPages}\n` + (q && q !== "true" ? `│ ◦ *Search* : "${q}"\n` : "") + `└ ◦ *Engine* : Kyutai Expresso TTS\n\n` + `_Pilih karakter emosi suara pada menu di bawah:_\n\n` + `${footer}`;
        const options = {
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 1,
              divider_indices: [1],
              list_title: `${botName} • Emotion Explorer`,
              button_title: `Buka Hal ${page}`
            }
          },
          quoted: quotedMsg
        };
        if (typeof ctx.sendCta === "function") {
          await ctx.sendCta(bodyText, footer, buttons, options);
        } else {
          let fallback = `${bodyText}\n\n`;
          fallback += rows.map(r => `• *${r.title}*\n  Perintah: \`${r.id}\``).join("\n\n");
          if (totalPages > 1) {
            fallback += `\n\n_Pindah Halaman: Ketik \`${baseCmd} --page ${page < totalPages ? page + 1 : page - 1}\`_`;
          }
          await ctx.reply(fallback);
        }
        await ctx.react("✅");
        return;
      }
      const selectedVoice = flags.voice || (userSession ? userSession.voicePath : null);
      if (!selectedVoice) {
        return ctx.reply(`– *E X P R E S S O*\n\n` + `┌ ◦ *Status* : Belum memilih karakter suara emosi\n` + `│ ◦ *Daftar* : ${prefix}expresso --list\n` + `└ ◦ *Pencarian* : ${prefix}expresso --search <emosi>\n\n` + `${footer}`);
      }
      const textToSpeak = cleanText || flags.text;
      if (!textToSpeak) {
        return ctx.reply(`– *E X P R E S S O*\n\n` + `┌ ◦ *Active* : ${userSession?.voiceName || selectedVoice}\n` + `│ ◦ *Usage* : ${prefix}expresso <teks>\n` + `└ ◦ *Example* : ${prefix}expresso Halo semuanya apa kabar?\n\n` + `${footer}`);
      }
      await ctx.react("⏳");
      await ctx.reply(`– *P R O C E S S*\n\n` + `┌ ◦ *Model* : ${userSession?.voiceName || "Emotion Model"}\n` + `│ ◦ *Text* : "${textToSpeak}"\n` + `└ ◦ *Status* : Memproses audio emosional...\n\n` + `${footer}`);
      const res = await axios.post(CONFIG.API_URL, {
        action: "generate",
        text: String(textToSpeak),
        voice: String(selectedVoice)
      }, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": CONFIG.USER_AGENT
        },
        timeout: CONFIG.TIMEOUT
      });
      const audioUrl = res.data?.result || res.data?.url || res.data?.audio_url;
      if (!audioUrl) throw new Error(res.data?.error || "Gagal mendapatkan audio dari server Expresso.");
      await sendPTT(sock, targetJid, audioUrl, quotedMsg);
      await ctx.react("🎙️");
    } catch (error) {
      console.error("[Expresso Error]:", error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || error.message;
      ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : ${errMsg}\n` + `└ ◦ *Command* : ${ctx.command || "expresso"}\n\n` + `${footer}`);
    }
  }
};