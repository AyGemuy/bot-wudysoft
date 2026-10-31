import axios from "axios";
import db from "../../data/db.js";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/ai/chatex`;
const SESSION_TIMEOUT = 20 * 60 * 1e3;
const CONFIG = {
  TIMEOUT: 9e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};

function initDB(jid = null, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.chatEx) global.db.chatEx = {};
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
    if (["media", "img"].includes(key)) key = "image";
    if (["token", "token_state"].includes(key)) key = "state";
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
async function requestChatEx(payload) {
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

function recordSessionMessage(chatId, messageId, returnedState) {
  if (!messageId || !chatId) return;
  initDB();
  if (!global.db.chatEx[chatId]) {
    global.db.chatEx[chatId] = {
      state: returnedState || null,
      msgIds: [],
      lastMsgId: null,
      updatedAt: Date.now(),
      expireTime: Date.now() + SESSION_TIMEOUT
    };
  }
  const s = global.db.chatEx[chatId];
  if (returnedState) s.state = returnedState;
  if (!Array.isArray(s.msgIds)) s.msgIds = [];
  if (!s.msgIds.includes(messageId)) {
    s.msgIds.push(messageId);
  }
  s.lastMsgId = messageId;
  s.updatedAt = Date.now();
  s.expireTime = Date.now() + SESSION_TIMEOUT;
  saveDB();
}
export default {
  name: "chatex",
  aliases: ["chatexai", "luna", "gpt56"],
  description: "Advanced AI Chat & Vision via ChatEx (GPT-5.6 Luna Engine) with DB Session.",
  category: "AI",
  limit: true,
  example: "chatex Jelaskan teori kuantum secara sederhana atau reply gambar dengan chatex",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const chatId = ctx?.id || msg?.key?.remoteJid;
      if (!chatId) return;
      initDB();
      if (!global.db.chatEx[chatId]) return;
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      const sessionData = global.db.chatEx[chatId];
      if (Date.now() > sessionData.expireTime) {
        delete global.db.chatEx[chatId];
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
      let uploadedImageUrl = null;
      if (isMedia && typeof ctx.download === "function") {
        const buffer = await ctx.download();
        if (buffer && Buffer.isBuffer(buffer)) {
          const uploadRes = await upload(buffer).catch(() => null);
          if (uploadRes?.status && uploadRes?.url) {
            uploadedImageUrl = uploadRes.url;
          }
        }
      }
      const bodyPayload = {
        prompt: userText || "Jelaskan gambar ini secara detail",
        state: sessionData.state || null,
        ...uploadedImageUrl ? {
          image: uploadedImageUrl
        } : {}
      };
      const data = await requestChatEx(bodyPayload);
      if (!data || !data.status || !data.result) {
        throw new Error(data?.message || "Gagal mendapatkan balasan dari ChatEx AI.");
      }
      const answerText = (typeof data.result === "string" ? data.result : data.result?.content || "Tidak ada respon.").trim();
      const returnedState = data.state || bodyPayload.state || "";
      const bodyText = answerText;
      const buttons = [{
        name: "cta_copy",
        display_text: "Salin Jawaban",
        copy_code: answerText
      }];
      if (returnedState) {
        buttons.push({
          name: "cta_copy",
          display_text: "🔑 Salin State Token",
          copy_code: returnedState
        });
      }
      let sentMsg;
      if (typeof ctx.sendCta === "function") {
        sentMsg = await ctx.sendCta(bodyText, "", buttons, {
          media: uploadedImageUrl || null,
          quoted: msg
        });
      } else if (uploadedImageUrl) {
        sentMsg = await sock.sendMessage(ctx.id, {
          image: {
            url: uploadedImageUrl
          },
          caption: bodyText
        }, {
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
      if (newMsgId) {
        recordSessionMessage(chatId, newMsgId, returnedState);
      }
      if (typeof ctx?.react === "function") await ctx.react("✨");
      return true;
    } catch (e) {
      console.error("[CHATEX BEFORE ERROR]:", e.message);
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
        if (["chatex", "chatexai", "luna", "gpt56"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (rawText === "--reset" || rawText === "--clear" || rawText === "reset" || rawText === "clear") {
        if (global.db.chatEx[chatId]) {
          delete global.db.chatEx[chatId];
          saveDB();
          return ctx.reply("🧹 *Sesi percakapan ChatEx AI berhasil direset!* Silakan mulai topik baru.");
        }
        return ctx.reply("ℹ️ Tidak ada sesi ChatEx yang aktif di room chat ini.");
      }
      if (!rawText && !isMedia) {
        const guideText = `–  *C H A T E X  A I*

Layanan kecerdasan buatan GPT-5.6 Luna dengan fitur sesi percakapan berkelanjutan (DB Session) dan vision.

┌  ◦  *Chat Standar* :
│  └ \`${prefix}chatex Jelaskan cara kerja fusi nuklir\`
│
├  ◦  *Analisis Gambar / Vision* :
│  └ Kirim / balas gambar: \`${prefix}chatex Jelaskan apa yang ada di gambar ini\`
│
├  ◦  *Sesi Berkelanjutan* :
│  └ Cukup *reply pesan balasan bot* untuk melanjutkan percakapan!
│
└  ◦  *Parameter Flag Tambahan* :
   ├ \`--reset\` (Hapus sesi aktif)
   ├ \`--state <state_token>\`
   └ \`--image <url>\``;
        return ctx.reply(guideText, {
          quoted: quotedMsg
        });
      }
      await ctx.react("💭");
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      let uploadedImageUrl = null;
      if (isMedia) {
        const buffer = await ctx.download();
        if (buffer && Buffer.isBuffer(buffer)) {
          const uploadRes = await upload(buffer).catch(() => null);
          if (uploadRes?.status && uploadRes?.url) {
            uploadedImageUrl = uploadRes.url;
          }
        }
      }
      const existingSession = global.db.chatEx[chatId];
      const stateToUse = flags.state || existingSession?.state || null;
      const promptText = cleanPrompt || flags.prompt || (uploadedImageUrl ? "Jelaskan gambar ini secara detail" : "Halo");
      const bodyPayload = {
        prompt: promptText,
        state: stateToUse,
        ...uploadedImageUrl ? {
          image: uploadedImageUrl
        } : flags.image ? {
          image: flags.image
        } : {},
        ...flags.messages ? {
          messages: typeof flags.messages === "string" ? JSON.parse(flags.messages) : flags.messages
        } : {},
        ...flags
      };
      const data = await requestChatEx(bodyPayload);
      if (!data || !data.status || !data.result) {
        throw new Error(data?.message || "Gagal mendapatkan balasan dari ChatEx AI.");
      }
      const answerText = (typeof data.result === "string" ? data.result : data.result?.content || "Tidak ada respon.").trim();
      const returnedState = data.state || bodyPayload.state || "";
      const bodyText = answerText;
      let nextCommand = `${prefix}chatex <tulis_prompt_lanjutan>`;
      if (returnedState) nextCommand += ` --state ${returnedState}`;
      const buttons = [{
        name: "cta_copy",
        display_text: "📋 Salin Lanjutan Sesi",
        copy_code: nextCommand
      }];
      if (returnedState) {
        buttons.push({
          name: "cta_copy",
          display_text: "Salin State Saja",
          copy_code: returnedState
        });
      }
      buttons.push({
        name: "cta_copy",
        display_text: "Salin Jawaban",
        copy_code: answerText
      });
      let sentMsg;
      if (typeof ctx.sendCta === "function") {
        sentMsg = await ctx.sendCta(bodyText, "", buttons, {
          media: uploadedImageUrl || null,
          quoted: quotedMsg
        });
      } else if (uploadedImageUrl) {
        sentMsg = await sock.sendMessage(ctx.id, {
          image: {
            url: uploadedImageUrl
          },
          caption: bodyText
        }, {
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
      if (sentMsgId) {
        recordSessionMessage(chatId, sentMsgId, returnedState);
      }
      await ctx.react("✨");
    } catch (error) {
      console.error("[ChatEx AI Error]:", error?.message || error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ ChatEx AI Error: ${errMsg}`);
    }
  }
};