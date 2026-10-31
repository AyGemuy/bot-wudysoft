import axios from "axios";
import db from "../../data/db.js";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/ai/chattide`;
const SESSION_TIMEOUT = 25 * 60 * 1e3;
const MAX_HISTORY = 10;
const CONFIG = {
  TIMEOUT: 12e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};

function initDB(jid = null, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.chattide) global.db.chattide = {};
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
    if (["image", "img", "imageurl"].includes(key)) key = "image";
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
async function requestChattideAI(payload) {
  const {
    data
  } = await axios.post(API_URL, payload, {
    headers: {
      "Content-Type": "application/json",
      "User-Agent": CONFIG.USER_AGENT
    },
    timeout: CONFIG.TIMEOUT
  });
  return data;
}

function recordSessionMessage(chatId, messageId, userText, assistantText) {
  if (!messageId || !chatId) return;
  initDB();
  if (!global.db.chattide[chatId]) {
    global.db.chattide[chatId] = {
      messages: [],
      msgIds: [],
      lastMsgId: null,
      updatedAt: Date.now(),
      expireTime: Date.now() + SESSION_TIMEOUT
    };
  }
  const s = global.db.chattide[chatId];
  if (!Array.isArray(s.messages)) s.messages = [];
  if (!Array.isArray(s.msgIds)) s.msgIds = [];
  if (userText) {
    s.messages.push({
      role: "user",
      content: [{
        type: "text",
        text: userText
      }]
    });
  }
  if (assistantText) {
    s.messages.push({
      role: "assistant",
      content: [{
        type: "text",
        text: assistantText
      }]
    });
  }
  if (s.messages.length > MAX_HISTORY * 2) {
    s.messages = s.messages.slice(-MAX_HISTORY * 2);
  }
  if (!s.msgIds.includes(messageId)) {
    s.msgIds.push(messageId);
  }
  s.lastMsgId = messageId;
  s.updatedAt = Date.now();
  s.expireTime = Date.now() + SESSION_TIMEOUT;
  saveDB();
}
export default {
  name: "chattide",
  aliases: ["tide", "chattideai", "gpt4mini"],
  description: "AI Conversational Agent powered by Chattide (GPT-4.1 Mini & Vision).",
  category: "AI",
  limit: true,
  example: "chattide jelaskan teori relativitas atau reply pesan bot untuk melanjutkan percakapan",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const chatId = ctx?.id || msg?.key?.remoteJid;
      if (!chatId) return;
      initDB();
      if (!global.db.chattide[chatId]) return;
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      const sessionData = global.db.chattide[chatId];
      if (Date.now() > sessionData.expireTime) {
        delete global.db.chattide[chatId];
        saveDB();
        return;
      }
      const quotedStanzaId = ctx?.quoted?.id || msg?.message?.extendedTextMessage?.contextInfo?.stanzaId;
      const isQuotingAi = quotedStanzaId && (quotedStanzaId === sessionData.lastMsgId || Array.isArray(sessionData.msgIds) && sessionData.msgIds.includes(quotedStanzaId));
      if (!isQuotingAi) return;
      const userText = (ctx?.text || ctx?.query || msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "").trim();
      const prefixList = [".", "#", "!", "/", ctx?.prefix].filter(Boolean);
      if (prefixList.some(p => userText.startsWith(p))) return;
      const isMedia = ctx?.isMedia || ctx?.quoted?.isMedia;
      if (!userText && !isMedia) return;
      if (typeof ctx?.react === "function") await ctx.react("💭");
      let uploadedMediaUrl = null;
      if (isMedia && typeof ctx.download === "function") {
        const buffer = await ctx.download();
        if (buffer && Buffer.isBuffer(buffer)) {
          const uploadRes = await upload(buffer).catch(() => null);
          if (uploadRes?.status && uploadRes?.url) {
            uploadedMediaUrl = uploadRes.url;
          }
        }
      }
      const bodyPayload = {
        prompt: userText || (uploadedMediaUrl ? "Tolong jelaskan gambar ini." : "Lanjutkan."),
        messages: sessionData.messages || [],
        ...uploadedMediaUrl ? {
          image: uploadedMediaUrl
        } : {}
      };
      const data = await requestChattideAI(bodyPayload);
      if (!data || !data.status) {
        throw new Error(data?.error || data?.message || "Gagal mendapatkan respon dari Chattide AI.");
      }
      const answerText = (data.result || "Respon kosong diterima.").trim();
      let sentMsg;
      const buttons = [{
        name: "cta_copy",
        display_text: "Salin Jawaban",
        copy_code: answerText
      }];
      if (typeof ctx.sendCta === "function") {
        sentMsg = await ctx.sendCta(answerText, "", buttons, {
          quoted: msg
        });
      } else {
        sentMsg = await sock.sendMessage(ctx.id, {
          text: answerText
        }, {
          quoted: msg
        });
      }
      const newMsgId = sentMsg?.key?.id;
      if (newMsgId) {
        recordSessionMessage(chatId, newMsgId, bodyPayload.prompt, answerText);
      }
      if (typeof ctx?.react === "function") await ctx.react("✨");
      return true;
    } catch (e) {
      console.error("[CHATTIDE BEFORE ERROR]:", e.message);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      const chatId = ctx.id;
      initDB();
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["chattide", "tide", "chattideai", "gpt4mini"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (["--reset", "--clear", "reset", "clear"].includes(rawText.toLowerCase())) {
        if (global.db.chattide[chatId]) {
          delete global.db.chattide[chatId];
          saveDB();
          return ctx.reply("🧹 *Sesi percakapan Chattide AI berhasil direset!* Topik baru dimulai.");
        }
        return ctx.reply("ℹ️ Tidak ada sesi percakapan aktif Chattide di room chat ini.");
      }
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      if (!rawText && !isMedia) {
        const guideText = `–  *C H A T T I D E  A I*

Asisten cerdas berbasis Chattide (*GPT-4.1 Mini*) dengan dukungan Vision & Multi-Turn.

┌  ◦  *Chat / Diskusi* :
│  └ \`${prefix}chattide jelaskan cara kerja neural network\`
│
├  ◦  *Analisis Gambar (Vision)* :
│  └ Kirim / balas gambar: \`${prefix}chattide tolong jelaskan apa yang ada pada gambar ini\`
│
├  ◦  *Multi-Turn Conversation* :
│  └ Cukup *reply pesan bot* langsung tanpa perlu ketik ulang command.
│
└  ◦  *Opsi Perintah* :
   ├ \`--reset\` (Hapus riwayat sesi room ini)
   ├ \`--model <nama_model>\` (Opsional ubah model)
   └ \`--image <url>\` (Sertakan tautan gambar)`;
        return ctx.reply(guideText, {
          quoted: quotedMsg
        });
      }
      await ctx.react("💭");
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      let uploadedMediaUrl = null;
      if (isMedia) {
        const buffer = await ctx.download();
        if (buffer && Buffer.isBuffer(buffer)) {
          const uploadRes = await upload(buffer).catch(() => null);
          if (uploadRes?.status && uploadRes?.url) {
            uploadedMediaUrl = uploadRes.url;
          }
        }
      }
      const existingSession = global.db.chattide[chatId];
      const previousMessages = existingSession?.messages || [];
      const bodyPayload = {
        prompt: cleanPrompt || (uploadedMediaUrl ? "Jelaskan gambar ini." : "Halo!"),
        messages: previousMessages,
        ...uploadedMediaUrl ? {
          image: uploadedMediaUrl
        } : flags.image ? {
          image: flags.image
        } : {},
        ...flags
      };
      const data = await requestChattideAI(bodyPayload);
      if (!data || !data.status) {
        throw new Error(data?.error || data?.message || "Gagal mendapatkan respon dari Chattide AI.");
      }
      const answerText = (data.result || "Respon kosong diterima.").trim();
      let sentMsg;
      const buttons = [{
        name: "cta_copy",
        display_text: "Salin Jawaban",
        copy_code: answerText
      }];
      if (typeof ctx.sendCta === "function") {
        sentMsg = await ctx.sendCta(answerText, "", buttons, {
          quoted: quotedMsg
        });
      } else {
        sentMsg = await sock.sendMessage(ctx.id, {
          text: answerText
        }, {
          quoted: quotedMsg
        });
      }
      const sentMsgId = sentMsg?.key?.id;
      if (sentMsgId) {
        recordSessionMessage(chatId, sentMsgId, bodyPayload.prompt, answerText);
      }
      await ctx.react("✨");
    } catch (error) {
      console.error("[Chattide AI Error]:", error?.message || error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.error || error.response?.data?.message || error.message;
      ctx.reply(`❌ Terjadi kendala pada Chattide AI: ${errMsg}`);
    }
  }
};