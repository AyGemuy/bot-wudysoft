import axios from "axios";
import db from "../../data/db.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
import {
  sendPTT
} from "../../lib/audio.js";
const CONFIG = {
  API_URL: `${global.bot?.api?.wudysoft}/api/misc/tts/v44`,
  TIMEOUT: 9e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  ITEMS_PER_PAGE: 10,
  CACHE_TTL: 1e3 * 60 * 60 * 24
};
const EMOTIONS = ["auto", "neutral", "happy", "sad", "angry", "fearful", "disgusted", "surprised"];
let cachedModels = {
  list: [],
  lastFetched: 0
};

function initDB(jid = null, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.voiceAi) global.db.voiceAi = {};
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
async function getVoiceModels() {
  const now = Date.now();
  if (cachedModels.list.length && now - cachedModels.lastFetched < CONFIG.CACHE_TTL) return cachedModels.list;
  const {
    data
  } = await axios.get(`${CONFIG.API_URL}?action=voice_models`, {
    headers: {
      "User-Agent": CONFIG.USER_AGENT
    },
    timeout: CONFIG.TIMEOUT
  });
  const list = data?.data || (Array.isArray(data) ? data : []);
  if (Array.isArray(list) && list.length) {
    cachedModels = {
      list: list,
      lastFetched: now
    };
    return list;
  }
  return cachedModels.list;
}
export default {
  name: "voiceai",
  aliases: ["tts44", "azvoice", "celebritytts", "donaldtts"],
  description: "Voice AI Celebrity TTS v44 dengan Session Model & Konversi Opus (Full DB)",
  category: "AI",
  limit: true,
  example: "voiceai --search donald\nvoiceai halo kawan\nvoiceai --info\nvoiceai --reset",
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
      const userSession = global.db.voiceAi[senderId] || null;
      const {
        flags,
        cleanText
      } = parseFlags(rawText);
      if (flags.reset || rawText === "--reset") {
        if (global.db.voiceAi[senderId]) {
          delete global.db.voiceAi[senderId];
          saveDB();
        }
        return ctx.reply(`– *V O I C E  A I*\n\n` + `┌ ◦ *Status* : Sesi model suara berhasil direset\n` + `└ ◦ *Action* : Ketik ${prefix}voiceai --list untuk memilih model baru.\n\n` + `${footer}`);
      }
      if (flags.info || flags.status || rawText === "--info") {
        if (!userSession) {
          return ctx.reply(`– *S T A T U S*\n\n` + `┌ ◦ *Status* : Belum ada sesi model aktif\n` + `└ ◦ *Action* : Ketik ${prefix}voiceai --list untuk memilih model.\n\n` + `${footer}`);
        }
        return ctx.reply(`– *S T A T U S*\n\n` + `┌ ◦ *User* : @${senderId.split("@")[0]}\n` + `│ ◦ *Model* : ${userSession.modelName}\n` + `│ ◦ *Model ID* : ${userSession.modelId}\n` + `└ ◦ *Emotion* : ${userSession.emotion}\n\n` + `_Ketik ${prefix}voiceai <teks> untuk berbicara._\n\n` + `${footer}`, {
          mentions: [senderId]
        });
      }
      if (flags.setvoice) {
        const allModels = await getVoiceModels();
        const queryTarget = String(flags.setvoice).toLowerCase().trim();
        const found = allModels.find(m => String(m.id) === queryTarget || m.name?.toLowerCase().includes(queryTarget));
        const newSession = {
          modelId: found ? found.id : Number(flags.setvoice),
          modelName: found ? found.name : flags.name || `Model #${flags.setvoice}`,
          emotion: flags.emotion && EMOTIONS.includes(flags.emotion) ? flags.emotion : "neutral",
          pitch: Number(flags.pitch || 0),
          speed: Number(flags.speed || 1),
          volume: Number(flags.volume || 1),
          updatedAt: Date.now()
        };
        global.db.voiceAi[senderId] = newSession;
        saveDB();
        await ctx.react("✅");
        return ctx.reply(`– *V O I C E  A I*\n\n` + `┌ ◦ *Model* : ${newSession.modelName}\n` + `│ ◦ *Model ID* : ${newSession.modelId}\n` + `│ ◦ *Emotion* : ${newSession.emotion}\n` + `└ ◦ *Status* : Tersimpan ke sesi pengguna\n\n` + `_Ketik ${prefix}voiceai <teks> untuk mulai berbicara._\n\n` + `${footer}`);
      }
      if (flags.list || flags.search || flags.query || rawText.startsWith("--list") || rawText.startsWith("--search") || flags.page) {
        await ctx.react("⏳");
        const allModels = await getVoiceModels();
        let filtered = allModels;
        const q = String(flags.search || flags.query || !flags.page && cleanText || "").toLowerCase().trim();
        if (q && q !== "true") {
          filtered = filtered.filter(m => m.name?.toLowerCase().includes(q) || String(m.id) === q);
        }
        const page = Math.max(1, Number(flags.page) || 1);
        const totalPages = Math.ceil(filtered.length / CONFIG.ITEMS_PER_PAGE) || 1;
        const pageItems = filtered.slice((page - 1) * CONFIG.ITEMS_PER_PAGE, page * CONFIG.ITEMS_PER_PAGE);
        if (!pageItems.length) {
          await ctx.react("❌");
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Model suara tidak ditemukan\n` + `└ ◦ *Query* : "${q}" (Halaman ${page})\n\n` + `${footer}`);
        }
        const modelRows = pageItems.map(m => ({
          title: `🎙️ ${m.name}`.slice(0, 24),
          id: `${prefix}voiceai --setvoice "${m.id}" --name "${m.name}"`,
          description: `${m.isPremium ? "Premium" : "Free"} • ID: ${m.id}`.slice(0, 60)
        }));
        let baseCmd = `${prefix}voiceai`;
        if (q && q !== "true") baseCmd += ` --search "${q}"`;
        else baseCmd += ` --list`;
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: `PILIH MODEL SUARA (${pageItems.length})`,
            sections: [{
              title: `DAFTAR MODEL (Hal ${page}/${totalPages})`,
              rows: modelRows
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
        const bodyText = `– *V O I C E  A I  -  M O D E L S*\n\n` + `┌ ◦ *Total* : ${filtered.length} Karakter Tersedia\n` + `│ ◦ *Page* : ${page} / ${totalPages}\n` + (q && q !== "true" ? `│ ◦ *Search* : "${q}"\n` : "") + `└ ◦ *Engine* : Voice AI Celebrity TTS\n\n` + `_Pilih karakter suara pada tombol di bawah:_\n\n` + `${footer}`;
        const options = {
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 1,
              divider_indices: [1],
              list_title: `${botName} • Model Explorer`,
              button_title: `Buka Hal ${page}`
            }
          },
          quoted: quotedMsg
        };
        if (typeof ctx.sendCta === "function") {
          await ctx.sendCta(bodyText, footer, buttons, options);
        } else {
          let fallback = `${bodyText}\n\n`;
          fallback += modelRows.map(r => `• *${r.title}*\n  Perintah: \`${r.id}\``).join("\n\n");
          if (totalPages > 1) {
            fallback += `\n\n_Pindah Halaman: Ketik \`${baseCmd} --page ${page < totalPages ? page + 1 : page - 1}\`_`;
          }
          await ctx.reply(fallback);
        }
        await ctx.react("✅");
        return;
      }
      const selectedModelId = flags.model || flags.voice || (userSession ? userSession.modelId : null);
      if (!selectedModelId) {
        return ctx.reply(`– *V O I C E  A I*\n\n` + `┌ ◦ *Status* : Belum memilih model suara\n` + `│ ◦ *List* : ${prefix}voiceai --list\n` + `└ ◦ *Search* : ${prefix}voiceai --search <nama>\n\n` + `${footer}`);
      }
      const textToSpeak = cleanText || flags.text;
      if (!textToSpeak) {
        return ctx.reply(`– *V O I C E  A I*\n\n` + `┌ ◦ *Active* : ${userSession?.modelName || `Model #${selectedModelId}`}\n` + `│ ◦ *Usage* : ${prefix}voiceai <teks>\n` + `└ ◦ *Example* : ${prefix}voiceai Halo kawan semuanya!\n\n` + `${footer}`);
      }
      await ctx.react("⏳");
      const selectedEmotion = flags.emotion && EMOTIONS.includes(flags.emotion) ? flags.emotion : userSession?.emotion || "neutral";
      await ctx.reply(`– *P R O C E S S*\n\n` + `┌ ◦ *Model* : ${userSession?.modelName || `Model #${selectedModelId}`}\n` + `│ ◦ *Emotion* : ${selectedEmotion.toUpperCase()}\n` + `│ ◦ *Text* : "${textToSpeak}"\n` + `└ ◦ *Status* : Memproses audio Voice AI...\n\n` + `${footer}`);
      const res = await axios.post(CONFIG.API_URL, {
        action: "tts_v2",
        prompt: String(textToSpeak),
        model_id: Number(selectedModelId),
        emotion: selectedEmotion,
        pitch: Number(flags.pitch !== undefined ? flags.pitch : userSession?.pitch || 0),
        speed: Number(flags.speed !== undefined ? flags.speed : userSession?.speed || 1),
        volume: Number(flags.volume !== undefined ? flags.volume : userSession?.volume || 1)
      }, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": CONFIG.USER_AGENT
        },
        timeout: CONFIG.TIMEOUT
      });
      const responseData = res.data?.data || res.data?.result || {};
      const audioUrl = responseData.voiceUrl || responseData.audio_url || res.data?.voiceUrl;
      if (!res.data?.status || !audioUrl) throw new Error(res.data?.errorMessage || "Gagal membuat audio Voice AI.");
      await sendPTT(sock, targetJid, audioUrl, quotedMsg);
      await ctx.react("🎙️");
    } catch (error) {
      console.error("[VoiceAI Error]:", error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || error.message;
      ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : ${errMsg}\n` + `└ ◦ *Command* : ${ctx.command || "voiceai"}\n\n` + `${footer}`);
    }
  }
};