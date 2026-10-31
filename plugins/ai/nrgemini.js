import axios from "axios";
import db from "../../data/db.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/ai/naturalreaders`;
const SESSION_TIMEOUT = 20 * 60 * 1e3;
const CONFIG = {
  TIMEOUT: 6e4,
  DEFAULT_MODEL: "38flash",
  AVAILABLE_MODELS: [{
    id: "38flash",
    name: "Gemini 1.5 Flash (Default)"
  }, {
    id: "25flash-default",
    name: "Gemini 2.5 Flash"
  }, {
    id: "25lite",
    name: "Gemini 2.5 Lite"
  }, {
    id: "25native",
    name: "Gemini 2.5 Native"
  }],
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36"
};

function initDB(jid = null, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.nrGemini) global.db.nrGemini = {};
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

function parseFlags(input) {
  const flags = {};
  const flagRegex = /--([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1].toLowerCase();
    let rawVal = match[2];
    let val = true;
    if (["m"].includes(key)) key = "model";
    if (["ctx", "c"].includes(key)) key = "context";
    if (["temp", "t"].includes(key)) key = "temperature";
    if (rawVal !== undefined) {
      if (rawVal.startsWith('"') && rawVal.endsWith('"') || rawVal.startsWith("'") && rawVal.endsWith("'")) {
        rawVal = rawVal.slice(1, -1);
      }
      if (rawVal === "true") val = true;
      else if (rawVal === "false") val = false;
      else if (!isNaN(rawVal) && rawVal.trim() !== "") val = Number(rawVal);
      else val = rawVal;
    }
    flags[key] = val;
  }
  const cleanPrompt = input.replace(flagRegex, "").trim();
  return {
    flags: flags,
    cleanPrompt: cleanPrompt
  };
}
async function requestNrGemini(payload) {
  const {
    data
  } = await axios.post(API_URL, payload, {
    headers: {
      "Content-Type": "application/json",
      "User-Agent": CONFIG.USER_AGENT
    },
    timeout: CONFIG.TIMEOUT
  });
  if (!data?.status) {
    throw new Error(data?.error || data?.message || data?.result?.message || "Response status false dari server NaturalReaders Gemini.");
  }
  return data;
}

function recordSession(chatId, messageId, userPrompt, botReply, model) {
  if (!chatId) return;
  initDB();
  if (!global.db.nrGemini[chatId]) {
    global.db.nrGemini[chatId] = {
      model: model || CONFIG.DEFAULT_MODEL,
      history: [],
      msgIds: [],
      lastMsgId: null,
      updatedAt: Date.now(),
      expireTime: Date.now() + SESSION_TIMEOUT
    };
  }
  const s = global.db.nrGemini[chatId];
  if (model) s.model = model;
  if (!Array.isArray(s.history)) s.history = [];
  if (userPrompt && botReply) {
    s.history.push({
      role: "user",
      parts: [{
        text: userPrompt
      }]
    });
    s.history.push({
      role: "model",
      parts: [{
        text: botReply
      }]
    });
    if (s.history.length > 20) {
      s.history = s.history.slice(s.history.length - 20);
    }
  }
  if (messageId) {
    if (!Array.isArray(s.msgIds)) s.msgIds = [];
    if (!s.msgIds.includes(messageId)) s.msgIds.push(messageId);
    s.lastMsgId = messageId;
  }
  s.updatedAt = Date.now();
  s.expireTime = Date.now() + SESSION_TIMEOUT;
  saveDB();
}
export default {
  name: "nrgemini",
  aliases: ["nr-gemini", "gemininr", "nrgemi"],
  description: "Asisten AI Google Gemini via NaturalReaders Engine (Multi-Turn Chat Session).",
  category: "AI",
  limit: true,
  example: "nrgemini Jelaskan lubang hitam\nnrgemini --model 25flash-default Buatkan puisi\nBalas/reply pesan bot untuk melanjutkan percakapan",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const chatId = ctx?.id || msg?.key?.remoteJid;
      if (!chatId) return;
      initDB();
      if (!global.db.nrGemini[chatId]) return;
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      const sessionData = global.db.nrGemini[chatId];
      if (Date.now() > sessionData.expireTime) {
        delete global.db.nrGemini[chatId];
        saveDB();
        return;
      }
      const quotedStanzaId = ctx?.quoted?.id || msg?.message?.extendedTextMessage?.contextInfo?.stanzaId;
      const isQuotingAi = quotedStanzaId && (quotedStanzaId === sessionData.lastMsgId || Array.isArray(sessionData.msgIds) && sessionData.msgIds.includes(quotedStanzaId));
      if (!isQuotingAi) return;
      const userText = (ctx?.text || ctx?.query || msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "").trim();
      const prefixList = [".", "#", "!", "/", ctx?.prefix].filter(Boolean);
      if (prefixList.some(p => userText.startsWith(p))) return;
      if (!userText) return;
      if (typeof ctx?.react === "function") await ctx.react("💭");
      const bodyPayload = {
        action: "ask",
        prompt: userText,
        model: sessionData.model || CONFIG.DEFAULT_MODEL,
        history: sessionData.history || []
      };
      const data = await requestNrGemini(bodyPayload);
      const result = data?.result || {};
      const answerText = (typeof result === "string" ? result : result.reply || "Tidak ada respon.").trim();
      const bodyText = answerText;
      const buttons = [{
        name: "cta_copy",
        display_text: "Salin Jawaban",
        copy_code: answerText
      }];
      let sentMsg;
      if (typeof ctx.sendCta === "function") {
        sentMsg = await ctx.sendCta(bodyText, "", buttons, {
          quoted: msg
        });
      } else {
        sentMsg = await sock.sendMessage(ctx.id, {
          text: bodyText
        }, {
          quoted: msg
        });
      }
      const newMsgId = sentMsg?.key?.id;
      recordSession(chatId, newMsgId, userText, answerText, result.model || sessionData.model);
      if (typeof ctx?.react === "function") await ctx.react("✨");
      return true;
    } catch (e) {
      console.error("[NR-GEMINI BEFORE ERROR]:", e.message);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      const chatId = ctx.id;
      const senderId = ctx.sender || ctx.author || msg.key?.participant || msg.key?.remoteJid || ctx.id;
      initDB(senderId, ctx.pushName);
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["nrgemini", "nr-gemini", "gemininr", "nrgemi"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • NaturalReaders Gemini`;
      if (rawText === "--reset" || rawText === "--clear" || rawText === "reset" || rawText === "clear") {
        if (global.db.nrGemini[chatId]) {
          delete global.db.nrGemini[chatId];
          saveDB();
          return ctx.reply("🧹 *Sesi percakapan Natural Gemini berhasil direset!* Silakan mulai topik baru.");
        }
        return ctx.reply("ℹ️ Tidak ada sesi Natural Gemini yang aktif di obrolan ini.");
      }
      if (rawText === "--models" || rawText === "--list") {
        const modelList = CONFIG.AVAILABLE_MODELS.map(m => `┌ ◦ *ID* : \`${m.id}\`\n└ ◦ *Nama* : ${m.name}`).join("\n\n");
        return ctx.reply(`–  *D A F T A R  M O D E L  G E M I N I*\n\n` + `${modelList}\n\n` + `_Gunakan flag \`--model <id_model>\` untuk mengganti engine model._\n\n` + `${botFooter}`);
      }
      if (!rawText) {
        const guideText = `–  *N A T U R A L  G E M I N I*

Layanan asisten cerdas Gemini via NaturalReaders Engine dengan memori percakapan berlanjut.

┌  ◦  *Chat Standar* :
│  └ \`${prefix}nrgemini Jelaskan teori relativitas secara ringkas\`
│
├  ◦  *Pilih Model AI* :
│  └ \`${prefix}nrgemini --model 25flash-default Buatkan kode Python\`
│
├  ◦  *Sesi Berkelanjutan* :
│  └ Cukup *reply pesan bot* untuk melanjutkan obrolan secara otomatis!
│
└  ◦  *Parameter Flag* :
   ├ \`--models\` (Melihat daftar model yang tersedia)
   ├ \`--model <id>\` (38flash, 25flash-default, 25lite, 25native)
   ├ \`--context <teks>\` (Konteks acuan / instruksi sistem)
   └ \`--reset\` (Hapus sesi aktif di chat)`;
        return ctx.reply(guideText, {
          quoted: quotedMsg
        });
      }
      await ctx.react("💭");
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      const existingSession = global.db.nrGemini[chatId];
      const modelToUse = flags.model || existingSession?.model || CONFIG.DEFAULT_MODEL;
      const bodyPayload = {
        action: "ask",
        prompt: cleanPrompt || flags.prompt,
        model: modelToUse,
        context: flags.context || "",
        history: existingSession?.history || [],
        temperature: flags.temperature ? Number(flags.temperature) : .7
      };
      if (!bodyPayload.prompt) {
        return ctx.reply("❌ Masukkan pertanyaan atau instruksi teks.");
      }
      const data = await requestNrGemini(bodyPayload);
      const result = data?.result || {};
      const answerText = (typeof result === "string" ? result : result.reply || "Tidak ada respon.").trim();
      const bodyText = answerText;
      const buttons = [{
        name: "cta_copy",
        display_text: "Salin Jawaban",
        copy_code: answerText
      }];
      let sentMsg;
      if (typeof ctx.sendCta === "function") {
        sentMsg = await ctx.sendCta(bodyText, "", buttons, {
          quoted: quotedMsg
        });
      } else {
        sentMsg = await sock.sendMessage(ctx.id, {
          text: bodyText
        }, {
          quoted: quotedMsg
        });
      }
      const sentMsgId = sentMsg?.key?.id;
      recordSession(chatId, sentMsgId, bodyPayload.prompt, answerText, result.model || modelToUse);
      await ctx.react("✨");
    } catch (error) {
      console.error("[NR-Gemini Error]:", error?.message || error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || error.message || "Gagal memproses permintaan ke Natural Gemini.";
      ctx.reply(`❌ Terjadi kesalahan pada Natural Gemini: ${errMsg}`);
    }
  }
};