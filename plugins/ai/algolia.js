import axios from "axios";
import db from "../../data/db.js";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/ai/algolia`;
const SESSION_TIMEOUT = 20 * 60 * 1e3;
const CONFIG = {
  TIMEOUT: 65e3,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};

function initDB(jid = null, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.algoliaAi) global.db.algoliaAi = {};
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
    if (["agent", "ag"].includes(key)) key = "agent_id";
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
async function requestAlgoliaAi(payload) {
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
    throw new Error(data?.result?.error_message || data?.error || data?.message || "Gagal memproses permintaan ke Algolia.");
  }
  return data;
}

function recordSession(chatId, messageId, returnedChatId, updatedMessages) {
  if (!chatId) return;
  initDB();
  if (!global.db.algoliaAi[chatId]) {
    global.db.algoliaAi[chatId] = {
      chat_id: returnedChatId || null,
      messages: [],
      msgIds: [],
      lastMsgId: null,
      updatedAt: Date.now(),
      expireTime: Date.now() + SESSION_TIMEOUT
    };
  }
  const s = global.db.algoliaAi[chatId];
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
  name: "algolia",
  aliases: ["algoliadoc", "algoliaai", "algdoc"],
  description: "AI Doc Search & Assistant berbasis Algolia Agent Studio (Full DB Session & Vision).",
  category: "AI",
  limit: true,
  example: "algolia Apa itu Algolia DocSearch?\nalgolia How to configure crawler? --agent <agent_id>\nBalas/reply pesan bot untuk melanjutkan obrolan.",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const chatId = ctx?.id || msg?.key?.remoteJid;
      if (!chatId) return;
      initDB();
      if (!global.db.algoliaAi[chatId]) return;
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      const sessionData = global.db.algoliaAi[chatId];
      if (Date.now() > sessionData.expireTime) {
        delete global.db.algoliaAi[chatId];
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
      const payload = {
        prompt: userText || (uploadedMediaUrl ? "Jelaskan isi gambar ini" : "Lanjutkan"),
        id: sessionData.chat_id || undefined,
        messages: Array.isArray(sessionData.messages) ? sessionData.messages : [],
        ...uploadedMediaUrl ? {
          media: uploadedMediaUrl
        } : {}
      };
      const data = await requestAlgoliaAi(payload);
      const res = data?.result || {};
      const answerText = res.response || "Tidak ada respon teks.";
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • Algolia Doc AI`;
      let bodyText = `–  *A L G O L I A  A G E N T*

┌  ◦  *Chat ID* : \`${res.chat_id || sessionData.chat_id || "-"}\`
└  ◦  *Prompt* : ${payload.prompt}

${answerText.trim()}`;
      if (Array.isArray(res.suggestions) && res.suggestions.length > 0) {
        bodyText += `\n\n💡 *Saran Pertanyaan Lanjutan:*\n`;
        res.suggestions.slice(0, 3).forEach((sug, i) => {
          bodyText += `${i + 1}. _${sug}_\n`;
        });
      }
      const buttons = [{
        name: "cta_copy",
        display_text: "📄 Salin Jawaban",
        copy_code: answerText
      }];
      if (Array.isArray(res.suggestions) && res.suggestions.length > 0) {
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `💡 ${res.suggestions[0]}`.slice(0, 20),
            id: `${ctx?.prefix || "."}algolia ${res.suggestions[0]}`
          })
        });
      }
      let sentMsg;
      if (typeof ctx.sendCta === "function") {
        sentMsg = await ctx.sendCta(bodyText, botFooter, buttons, {
          title: "– ALGOLIA AGENT ASSISTANT –",
          subtitle: `Session: ${res.chat_id ? "Active" : "New"}`,
          media: uploadedMediaUrl || null,
          quoted: msg
        });
      } else if (uploadedMediaUrl) {
        sentMsg = await sock.sendMessage(ctx.id, {
          image: {
            url: uploadedMediaUrl
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
      recordSession(chatId, newMsgId, res.chat_id || sessionData.chat_id, res.messages);
      if (typeof ctx?.react === "function") await ctx.react("✨");
      return true;
    } catch (e) {
      console.error("[ALGOLIA BEFORE ERROR]:", e.message);
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
        if (["algolia", "algoliadoc", "algoliaai", "algdoc"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • Algolia Doc AI`;
      if (rawText === "--reset" || rawText === "--clear" || rawText === "reset" || rawText === "clear") {
        if (global.db.algoliaAi[chatId]) {
          delete global.db.algoliaAi[chatId];
          saveDB();
          return ctx.reply("🧹 *Sesi percakapan Algolia AI berhasil direset!* Silakan ajukan topik baru.");
        }
        return ctx.reply("ℹ️ Tidak ada sesi Algolia AI yang aktif di percakapan ini.");
      }
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      if (!rawText && !isMedia) {
        const guideText = `–  *A L G O L I A  A G E N T*

Asisten cerdas pencarian dokumentasi & tanya jawab berbasis Algolia Agent Studio.

┌  ◦  *Chat Standar* :
│  └ \`${prefix}algolia Bagaimana cara integrasi DocSearch ke website?\`
│
├  ◦  *Analisis Gambar (Vision)* :
│  └ Balas/kirim gambar: \`${prefix}algolia Analisis flowchart ini\`
│
├  ◦  *Sesi Berkelanjutan* :
│  └ Cukup *reply pesan balasan bot* untuk melanjutkan obrolan secara otomatis!
│
└  ◦  *Parameter Flag Tambahan* :
   ├ \`--agent <agent_id>\` (Ubah target agent Algolia)
   ├ \`--media <image_url>\` (Kirim URL gambar eksplisit)
   └ \`--reset\` (Hapus sesi obrolan aktif saat ini)`;
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
      const existingSession = global.db.algoliaAi[chatId];
      const promptText = cleanPrompt || flags.prompt || (uploadedMediaUrl ? "Jelaskan gambar ini" : "Halo");
      const payload = {
        prompt: promptText,
        id: existingSession?.chat_id || undefined,
        messages: Array.isArray(existingSession?.messages) ? existingSession.messages : [],
        agent_id: flags.agent_id || undefined,
        ...uploadedMediaUrl ? {
          media: uploadedMediaUrl
        } : flags.media ? {
          media: flags.media
        } : {}
      };
      const data = await requestAlgoliaAi(payload);
      const res = data?.result || {};
      const answerText = res.response || "Tidak ada respon teks yang dihasilkan.";
      let bodyText = `–  *A L G O L I A  A G E N T*

┌  ◦  *Chat ID* : \`${res.chat_id || existingSession?.chat_id || "-"}\`
└  ◦  *Prompt* : ${promptText}

${answerText.trim()}`;
      if (Array.isArray(res.suggestions) && res.suggestions.length > 0) {
        bodyText += `\n\n💡 *Saran Pertanyaan Lanjutan:*\n`;
        res.suggestions.slice(0, 3).forEach((sug, i) => {
          bodyText += `${i + 1}. _${sug}_\n`;
        });
      }
      const buttons = [{
        name: "cta_copy",
        display_text: "📄 Salin Jawaban",
        copy_code: answerText
      }];
      if (Array.isArray(res.suggestions) && res.suggestions.length > 0) {
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `💡 ${res.suggestions[0]}`.slice(0, 20),
            id: `${prefix}algolia ${res.suggestions[0]}`
          })
        });
      }
      let sentMsg;
      if (typeof ctx.sendCta === "function") {
        sentMsg = await ctx.sendCta(bodyText, botFooter, buttons, {
          title: "– ALGOLIA AGENT ASSISTANT –",
          subtitle: `Session: ${res.chat_id ? "Active" : "New"}`,
          media: uploadedMediaUrl || null,
          quoted: quotedMsg
        });
      } else if (uploadedMediaUrl) {
        sentMsg = await sock.sendMessage(ctx.id, {
          image: {
            url: uploadedMediaUrl
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
      recordSession(chatId, sentMsgId, res.chat_id, res.messages);
      await ctx.react("✨");
    } catch (error) {
      console.error("[Algolia AI Error]:", error?.message || error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.result?.error_message || error.response?.data?.error || error.message || "Gagal memproses permintaan ke Algolia Agent.";
      ctx.reply(`❌ Terjadi kendala: ${errMsg}`);
    }
  }
};