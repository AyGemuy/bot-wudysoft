import axios from "axios";
import db from "../../data/db.js";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/ai/appzoneai`;
const SESSION_TIMEOUT = 20 * 60 * 1e3;
const CONFIG = {
  TIMEOUT: 9e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};

function initDB(jid = null, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.appZoneAi) global.db.appZoneAi = {};
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
  const flagRegex = /(?:--|-)([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1].toLowerCase();
    let rawVal = match[2];
    let val = true;
    const aliasMap = {
      model: ["m", "mod"]
    };
    for (const [realKey, aliases] of Object.entries(aliasMap)) {
      if (aliases.includes(key)) key = realKey;
    }
    if (rawVal !== undefined) {
      if (rawVal.startsWith('"') && rawVal.endsWith('"') || rawVal.startsWith("'") && rawVal.endsWith("'")) {
        rawVal = rawVal.slice(1, -1);
      }
      val = rawVal;
    }
    flags[key] = val;
  }
  const cleanPrompt = input.replace(flagRegex, "").trim();
  return {
    flags: flags,
    cleanPrompt: cleanPrompt
  };
}
async function requestAppZone(payload) {
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

function recordSessionMessage(chatId, messageId, updatedMessages, model) {
  if (!messageId || !chatId) return;
  initDB();
  if (!global.db.appZoneAi[chatId]) {
    global.db.appZoneAi[chatId] = {
      model: model || null,
      messages: [],
      msgIds: [],
      lastMsgId: null,
      updatedAt: Date.now(),
      expireTime: Date.now() + SESSION_TIMEOUT
    };
  }
  const s = global.db.appZoneAi[chatId];
  if (model) s.model = model;
  if (Array.isArray(updatedMessages) && updatedMessages.length > 0) {
    s.messages = updatedMessages.slice(-20);
  }
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
  name: "appzoneai",
  aliases: ["appzone", "azai", "gpt5"],
  description: "AI Chat Assistant & Vision (Teks & Gambar) via AppZone AI Engine with DB Session.",
  category: "AI",
  limit: true,
  example: "• Teks: appzoneai jelaskan teori relativitas\n• Vision: Reply foto dengan appzoneai jelaskan gambar ini\n• Model: appzoneai halo! --model gpt-5.4-mini\nBalas/reply pesan bot untuk melanjutkan obrolan.",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const chatId = ctx?.id || msg?.key?.remoteJid;
      if (!chatId) return;
      initDB();
      if (!global.db.appZoneAi[chatId]) return;
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      const sessionData = global.db.appZoneAi[chatId];
      if (Date.now() > sessionData.expireTime) {
        delete global.db.appZoneAi[chatId];
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
      if (typeof ctx?.react === "function") await ctx.react("⏳");
      let mediaUrl = null;
      if (isMedia && typeof ctx.download === "function") {
        const buffer = await ctx.download();
        if (buffer && Buffer.isBuffer(buffer)) {
          const uploadRes = await upload(buffer).catch(() => null);
          if (uploadRes?.status && uploadRes?.url) {
            mediaUrl = uploadRes.url;
          }
        }
      }
      const promptText = userText || (mediaUrl ? "Deskripsikan dan jelaskan gambar ini secara mendalam." : "Lanjutkan");
      const currentMessages = Array.isArray(sessionData.messages) ? [...sessionData.messages] : [];
      currentMessages.push({
        role: "user",
        content: promptText
      });
      const body = {
        prompt: promptText,
        messages: currentMessages,
        ...sessionData.model ? {
          model: sessionData.model
        } : {},
        ...mediaUrl ? {
          media: mediaUrl
        } : {}
      };
      const data = await requestAppZone(body);
      if (!data || data.status !== true || !data.result) {
        throw new Error(data?.message || data?.error || "AI tidak memberikan respon.");
      }
      const answerText = data.result.trim();
      const bodyText = answerText;
      const buttons = [{
        name: "cta_copy",
        display_text: "📄 Salin Jawaban",
        copy_code: answerText
      }];
      let sentMsg;
      if (typeof ctx.sendCta === "function") {
        sentMsg = await ctx.sendCta(bodyText, "", buttons, {
          media: mediaUrl || null,
          quoted: msg
        });
      } else if (mediaUrl) {
        sentMsg = await sock.sendMessage(ctx.id, {
          image: {
            url: mediaUrl
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
        currentMessages.push({
          role: "assistant",
          content: answerText
        });
        recordSessionMessage(chatId, newMsgId, currentMessages, sessionData.model);
      }
      if (typeof ctx?.react === "function") await ctx.react("✅");
      return true;
    } catch (e) {
      console.error("[APPZONE-AI BEFORE ERROR]:", e.message);
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
        if (["appzoneai", "appzone", "azai", "gpt5"].some(a => firstWord.endsWith(a))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      if (rawText === "--reset" || rawText === "--clear" || rawText === "reset" || rawText === "clear") {
        if (global.db.appZoneAi[chatId]) {
          delete global.db.appZoneAi[chatId];
          saveDB();
          return ctx.reply("🧹 *Sesi percakapan AppZone AI berhasil direset!* Silakan mulai topik baru.");
        }
        return ctx.reply("ℹ️ Tidak ada sesi AppZone AI yang aktif di room chat ini.");
      }
      if (!rawText && !isMedia) {
        const guideText = `–  *A P P Z O N E  A I*

Asisten kecerdasan buatan serbaguna untuk percakapan teks, penulisan kode, dan analisis visual gambar.

┌  ◦  *Mode Percakapan (Teks)* :
│  └ \`${prefix}appzoneai buatkan kode web scraping python\`
│
├  ◦  *Mode Vision (Analisis Foto)* :
│  └ Reply / kirim gambar: \`${prefix}appzoneai jelaskan isi foto ini\`
│
├  ◦  *Sesi Berkelanjutan* :
│  └ Cukup *reply pesan balasan bot* untuk melanjutkan obrolan secara otomatis!
│
└  ◦  *Parameter Flag Tambahan* :
   ├ \`--reset\` (Hapus sesi aktif)
   └ \`--model <nama_model>\` (Contoh: gpt-5.4-mini)`;
        return ctx.reply(guideText, {
          quoted: quotedMsg
        });
      }
      if (typeof ctx.react === "function") await ctx.react("⏳");
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      let mediaUrl = "";
      if (isMedia) {
        const buffer = await ctx.download();
        if (!buffer || !Buffer.isBuffer(buffer)) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply("❌ Gagal mengunduh media dari pesan yang dikirim/direply.");
        }
        const uploadRes = await upload(buffer);
        if (!uploadRes?.status || !uploadRes?.url) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply(`❌ Gagal mengunggah gambar: ${uploadRes?.message || "Server upload error"}`);
        }
        mediaUrl = uploadRes.url;
      }
      const existingSession = global.db.appZoneAi[chatId];
      const modelToUse = flags.model || existingSession?.model || undefined;
      const currentMessages = Array.isArray(existingSession?.messages) ? [...existingSession.messages] : [];
      const finalPrompt = cleanPrompt || (mediaUrl ? "Deskripsikan dan jelaskan gambar ini secara mendalam." : "Halo!");
      currentMessages.push({
        role: "user",
        content: finalPrompt
      });
      const body = {
        prompt: finalPrompt,
        messages: currentMessages,
        ...modelToUse ? {
          model: modelToUse
        } : {},
        ...mediaUrl ? {
          media: mediaUrl
        } : {}
      };
      const data = await requestAppZone(body);
      if (!data || data.status !== true || !data.result) {
        if (typeof ctx.react === "function") await ctx.react("❌");
        return ctx.reply(`❌ Gagal memproses permintaan: ${data?.message || data?.error || "AI tidak memberikan respon."}`);
      }
      const answerText = data.result.trim();
      const bodyText = answerText;
      const buttons = [{
        name: "cta_copy",
        display_text: "📄 Salin Jawaban",
        copy_code: answerText
      }];
      let sentMsg;
      if (typeof ctx.sendCta === "function") {
        sentMsg = await ctx.sendCta(bodyText, "", buttons, {
          media: mediaUrl || null,
          quoted: quotedMsg
        });
      } else if (mediaUrl) {
        sentMsg = await sock.sendMessage(ctx.id, {
          image: {
            url: mediaUrl
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
        currentMessages.push({
          role: "assistant",
          content: answerText
        });
        recordSessionMessage(chatId, sentMsgId, currentMessages, modelToUse);
      }
      if (typeof ctx.react === "function") await ctx.react("✅");
    } catch (error) {
      console.error("[AppZone AI Error]:", error?.message || error);
      if (typeof ctx.react === "function") await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Terjadi kendala pada server AppZone AI: ${errMsg}`);
    }
  }
};