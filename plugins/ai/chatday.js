import axios from "axios";
import db from "../../data/db.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/ai/chatday`;
const SESSION_TIMEOUT = 20 * 60 * 1e3;
const CONFIG = {
  TIMEOUT: 6e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};

function initDB(jid = null, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.chatDay) global.db.chatDay = {};
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
    if (["token", "token_state"].includes(key)) key = "state";
    if (["conv", "cid"].includes(key)) key = "conversation_id";
    if (["visitor", "vid"].includes(key)) key = "visitor_id";
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
async function requestChatDay(payload) {
  const res = await axios.post(API_URL, payload, {
    headers: {
      "Content-Type": "application/json",
      "User-Agent": CONFIG.USER_AGENT
    },
    timeout: CONFIG.TIMEOUT
  });
  return res.data;
}

function recordSessionMessage(chatId, messageId, sessionData) {
  if (!messageId || !chatId) return;
  initDB();
  if (!global.db.chatDay[chatId]) {
    global.db.chatDay[chatId] = {
      conversation_id: null,
      visitor_id: null,
      model: "chatday/ai-chat",
      state: null,
      msgIds: [],
      lastMsgId: null,
      updatedAt: Date.now(),
      expireTime: Date.now() + SESSION_TIMEOUT
    };
  }
  const s = global.db.chatDay[chatId];
  if (sessionData.conversation_id !== undefined) s.conversation_id = sessionData.conversation_id;
  if (sessionData.visitor_id !== undefined) s.visitor_id = sessionData.visitor_id;
  if (sessionData.model !== undefined) s.model = sessionData.model;
  if (sessionData.state !== undefined) s.state = sessionData.state;
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
  name: "chatday",
  aliases: ["cday", "chatdayai"],
  description: "AI Multi-Model & Session Chat via ChatDay (Full DB Session Reply).",
  category: "AI",
  limit: true,
  example: "chatday apa kabar bang --model openai/gpt-4o",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const chatId = ctx?.id || msg?.key?.remoteJid;
      if (!chatId) return;
      initDB();
      if (!global.db.chatDay[chatId]) return;
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      const sessionData = global.db.chatDay[chatId];
      if (Date.now() > sessionData.expireTime) {
        delete global.db.chatDay[chatId];
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
        prompt: userText,
        model: sessionData.model || "chatday/ai-chat",
        conversation_id: sessionData.conversation_id || null,
        visitor_id: sessionData.visitor_id || null,
        state: sessionData.state || null
      };
      const data = await requestChatDay(bodyPayload);
      if (!data || !data.status || !data.result) {
        throw new Error(data?.message || "Gagal mendapatkan respon dari ChatDay API.");
      }
      const answerText = (typeof data.result === "string" ? data.result : data.result?.content || "Tidak ada respon.").trim();
      const returnedState = data.state || bodyPayload.state || "";
      const convChunk = Array.isArray(data.chunks) ? data.chunks.find(c => c.type === "data-conversation")?.data : null;
      const conversationId = convChunk?.conversationId || bodyPayload.conversation_id || null;
      const bodyText = answerText;
      const buttons = [{
        name: "cta_copy",
        display_text: "📄 Salin Jawaban",
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
      if (newMsgId) {
        recordSessionMessage(chatId, newMsgId, {
          conversation_id: conversationId,
          visitor_id: bodyPayload.visitor_id,
          model: bodyPayload.model,
          state: returnedState
        });
      }
      if (typeof ctx?.react === "function") await ctx.react("✨");
      return true;
    } catch (e) {
      console.error("[CHATDAY BEFORE ERROR]:", e.message);
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
        if (["chatday", "cday", "chatdayai"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (rawText === "--reset" || rawText === "--clear" || rawText === "reset" || rawText === "clear") {
        if (global.db.chatDay[chatId]) {
          delete global.db.chatDay[chatId];
          saveDB();
          return ctx.reply("🧹 *Sesi ChatDay AI berhasil direset!* Riwayat percakapan telah dibersihkan.");
        }
        return ctx.reply("ℹ️ Tidak ada sesi ChatDay yang aktif di obrolan ini.");
      }
      if (!rawText) {
        const guideText = `–  *C H A T  D A Y*

Layanan asisten AI multi-model cerdas dengan memori percakapan berlanjut (Multi-Turn Session).

┌  ◦  *Chat Standar* :
│  └ \`${prefix}chatday apa kabar bang\`
│
├  ◦  *Pilihan Model Khusus* :
│  ├ \`${prefix}chatday Siapa kamu? --model openai/gpt-4o\`
│  └ \`${prefix}chatday Buatkan kode --model anthropic/claude-sonnet-4.6\`
│
├  ◦  *Sesi Berkelanjutan* :
│  └ Cukup *reply pesan bot* untuk melanjutkan obrolan secara otomatis!
│
└  ◦  *Parameter Flag Tambahan* :
   ├ \`--reset\` (Hapus sesi yang aktif)
   ├ \`--model <id_model>\`
   ├ \`--state <token_state>\`
   └ \`--conv <conversation_id>\``;
        return ctx.reply(guideText, {
          quoted: quotedMsg
        });
      }
      await ctx.react("💭");
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      const existingSession = global.db.chatDay[chatId];
      const modelToUse = flags.model || existingSession?.model || "chatday/ai-chat";
      const convToUse = flags.conversation_id || existingSession?.conversation_id || null;
      const visitorToUse = flags.visitor_id || existingSession?.visitor_id || null;
      const stateToUse = flags.state || existingSession?.state || null;
      const bodyPayload = {
        prompt: flags.prompt || cleanPrompt || "Halo",
        model: modelToUse,
        conversation_id: convToUse,
        visitor_id: visitorToUse,
        state: stateToUse
      };
      const data = await requestChatDay(bodyPayload);
      if (!data || !data.status || !data.result) {
        throw new Error(data?.message || "Gagal mendapatkan balasan dari ChatDay AI.");
      }
      const answerText = (typeof data.result === "string" ? data.result : data.result?.content || "Tidak ada respon.").trim();
      const returnedState = data.state || bodyPayload.state || "";
      const convChunk = Array.isArray(data.chunks) ? data.chunks.find(c => c.type === "data-conversation")?.data : null;
      const conversationId = convChunk?.conversationId || bodyPayload.conversation_id || null;
      const bodyText = answerText;
      const buttons = [{
        name: "cta_copy",
        display_text: "📄 Salin Jawaban",
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
          quoted: quotedMsg
        });
      } else {
        sentMsg = await sock.sendMessage(ctx.id, {
          text: bodyText
        }, {
          quoted: quotedMsg
        });
      }
      const questionMsgId = sentMsg?.key?.id;
      if (questionMsgId) {
        recordSessionMessage(chatId, questionMsgId, {
          conversation_id: conversationId,
          visitor_id: bodyPayload.visitor_id,
          model: bodyPayload.model,
          state: returnedState
        });
      }
      await ctx.react("✨");
    } catch (error) {
      console.error("[ChatDay Error]:", error?.message || error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Terjadi kendala pada ChatDay AI: ${errMsg}`);
    }
  }
};