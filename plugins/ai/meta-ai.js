import axios from "axios";
import db from "../../data/db.js";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/ai/meta`;
const SESSION_TIMEOUT = 20 * 60 * 1e3;
const CONFIG = {
  TIMEOUT: 65e3,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};

function initDB(jid = "", name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.metaAi) global.db.metaAi = {};
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

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /--([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1].toLowerCase();
    let rawVal = match[2];
    let val = true;
    if (["img", "image"].includes(key)) key = "media";
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
async function requestMetaAi(payload) {
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
    throw new Error(data?.result?.error_message || data?.error || data?.message || "Gagal memproses permintaan ke Meta AI.");
  }
  return data;
}
async function sendResponseMsg({
  sock,
  ctx,
  chatId,
  text,
  mediaUrl,
  quotedMsg
}) {
  if (mediaUrl) {
    return await sock.sendMessage(chatId, {
      image: {
        url: mediaUrl
      },
      caption: text
    }, {
      quoted: quotedMsg
    });
  }
  if (typeof ctx?.copyNForward === "function") {
    return await sock.sendMessage(chatId, {
      text: text
    }, {
      quoted: quotedMsg
    });
  }
  return await sock.sendMessage(chatId, {
    text: text
  }, {
    quoted: quotedMsg
  });
}

function recordSession(chatId, messageId, returnedChatId, updatedMessages) {
  if (!chatId) return;
  initDB();
  if (!global.db.metaAi[chatId]) {
    global.db.metaAi[chatId] = {
      chat_id: returnedChatId || null,
      messages: [],
      msgIds: [],
      lastMsgId: null,
      updatedAt: Date.now(),
      expireTime: Date.now() + SESSION_TIMEOUT
    };
  }
  const s = global.db.metaAi[chatId];
  if (returnedChatId) s.chat_id = returnedChatId;
  if (Array.isArray(updatedMessages) && updatedMessages.length > 0) {
    s.messages = updatedMessages.slice(-16);
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
  name: "metaai",
  aliases: ["meta", "ai", "meta-ai"],
  description: "Asisten cerdas Meta AI (13135550002) dengan isolasi sesi obrolan & dukungan Vision.",
  category: "AI",
  limit: true,
  example: "meta Halo Meta AI, apa kabar?\nmeta Buatkan puisi tentang alam --image <url>\nBalas/reply pesan bot untuk melanjutkan obrolan.",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const chatId = ctx?.id || msg?.key?.remoteJid;
      if (!chatId) return;
      initDB();
      const sessionData = global.db.metaAi[chatId];
      if (!sessionData) return;
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      if (Date.now() > sessionData.expireTime) {
        delete global.db.metaAi[chatId];
        saveDB();
        return;
      }
      const quotedStanzaId = ctx?.quoted?.id || msg?.message?.extendedTextMessage?.contextInfo?.stanzaId;
      const isQuotingMetaAi = quotedStanzaId && (quotedStanzaId === sessionData.lastMsgId || Array.isArray(sessionData.msgIds) && sessionData.msgIds.includes(quotedStanzaId));
      if (!isQuotingMetaAi) return;
      const userText = (ctx?.text || ctx?.query || msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "").trim();
      const prefixList = [".", "#", "!", "/", ctx?.prefix].filter(Boolean);
      if (prefixList.some(p => userText.startsWith(p))) return;
      const isMedia = ctx?.isMedia || ctx?.quoted?.isMedia;
      if (!userText && !isMedia) return;
      if (typeof ctx?.react === "function") await ctx.react("💬");
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
      const payload = {
        prompt: userText || (uploadedMediaUrl ? "Jelaskan isi gambar ini" : "Lanjutkan"),
        id: sessionData.chat_id || undefined,
        messages: Array.isArray(sessionData.messages) ? sessionData.messages : [],
        ...uploadedMediaUrl ? {
          media: uploadedMediaUrl
        } : {}
      };
      const data = await requestMetaAi(payload);
      const res = data?.result || {};
      const answerText = res.response || "Tidak ada respon teks.";
      let bodyText = `–  *M E T A  A I* (13135550002)

┌  ◦  *Session ID* : \`${res.chat_id || sessionData.chat_id || "-"}\`
└  ◦  *Prompt* : ${payload.prompt}

${answerText.trim()}`;
      const sentMsg = await sendResponseMsg({
        sock: sock,
        ctx: ctx,
        chatId: chatId,
        text: bodyText,
        mediaUrl: uploadedMediaUrl,
        quotedMsg: msg
      });
      const newMsgId = sentMsg?.key?.id;
      recordSession(chatId, newMsgId, res.chat_id || sessionData.chat_id, res.messages);
      if (typeof ctx?.react === "function") await ctx.react("✨");
      return true;
    } catch (e) {
      console.error("[META AI BEFORE ERROR]:", e.message);
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
        if (["meta", "metaai", "ai", "meta-ai"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (rawText === "--reset" || rawText === "--clear" || rawText === "reset" || rawText === "clear") {
        if (global.db.metaAi[chatId]) {
          delete global.db.metaAi[chatId];
          saveDB();
          return ctx.reply("🧹 *Sesi obrolan Meta AI berhasil direset!* Silakan mulai percakapan baru.");
        }
        return ctx.reply("ℹ️ Tidak ada sesi Meta AI yang aktif di chat ini.");
      }
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      if (!rawText && !isMedia) {
        const guideText = `–  *M E T A  A I* (13135550002)

Asisten AI resmi dari Meta yang terintegrasi melalui bot.

┌  ◦  *Penggunaan Standar* :
│  └ \`${prefix}meta Halo, perkenalkan dirimu!\`
│
├  ◦  *Analisis Gambar (Vision)* :
│  └ Kirim/balas gambar dengan caption: \`${prefix}meta Deskripsikan objek ini\`
│
├  ◦  *Chat Berkelanjutan* :
│  └ Cukup *reply pesan balasan bot* untuk melanjutkan obrolan!
│
└  ◦  *Perintah Tambahan* :
   ├ \`--media <url>\` (Kirim URL gambar eksplisit)
   └ \`--reset\` (Hapus sesi aktif saat ini)`;
        return ctx.reply(guideText, {
          quoted: quotedMsg
        });
      }
      await ctx.react("💬");
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
      const existingSession = global.db.metaAi[chatId];
      const promptText = cleanPrompt || flags.prompt || (uploadedMediaUrl ? "Jelaskan gambar ini" : "Halo");
      const payload = {
        prompt: promptText,
        id: existingSession?.chat_id || undefined,
        messages: Array.isArray(existingSession?.messages) ? existingSession.messages : [],
        ...uploadedMediaUrl ? {
          media: uploadedMediaUrl
        } : flags.media ? {
          media: flags.media
        } : {}
      };
      const data = await requestMetaAi(payload);
      const res = data?.result || {};
      const answerText = res.response || "Tidak ada respon teks yang dihasilkan.";
      let bodyText = `–  *M E T A  A I* (13135550002)

┌  ◦  *Session ID* : \`${res.chat_id || existingSession?.chat_id || "-"}\`
└  ◦  *Prompt* : ${promptText}

${answerText.trim()}`;
      const sentMsg = await sendResponseMsg({
        sock: sock,
        ctx: ctx,
        chatId: chatId,
        text: bodyText,
        mediaUrl: uploadedMediaUrl,
        quotedMsg: quotedMsg
      });
      const sentMsgId = sentMsg?.key?.id;
      recordSession(chatId, sentMsgId, res.chat_id, res.messages);
      await ctx.react("✨");
    } catch (error) {
      console.error("[Meta AI Error]:", error?.message || error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.result?.error_message || error.response?.data?.error || error.message || "Gagal memproses permintaan ke Meta AI.";
      ctx.reply(`❌ Terjadi kendala: ${errMsg}`);
    }
  }
};