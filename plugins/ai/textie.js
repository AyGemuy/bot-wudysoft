import axios from "axios";
import db from "../../data/db.js";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/ai/textie`;
const SESSION_TIMEOUT = 25 * 60 * 1e3;
const CONFIG = {
  TIMEOUT: 6e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};

function initDB(jid = null, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.textieAi) global.db.textieAi = {};
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
async function requestTextieAi(payload = {}) {
  const {
    data
  } = await axios.post(API_URL, payload, {
    headers: {
      "Content-Type": "application/json",
      "User-Agent": CONFIG.USER_AGENT
    },
    timeout: CONFIG.TIMEOUT
  }).catch(err => {
    return axios.get(API_URL, {
      params: payload,
      headers: {
        "User-Agent": CONFIG.USER_AGENT
      },
      timeout: CONFIG.TIMEOUT
    });
  });
  if (!data?.status) {
    throw new Error(data?.result || data?.error || data?.message || "Gagal memproses respons dari Textie AI.");
  }
  return data;
}

function recordSession(chatId, messageId, updatedMessages, isTest = false) {
  if (!chatId) return;
  initDB();
  if (!global.db.textieAi[chatId]) {
    global.db.textieAi[chatId] = {
      messages: [],
      test: Boolean(isTest),
      msgIds: [],
      lastMsgId: null,
      updatedAt: Date.now(),
      expireTime: Date.now() + SESSION_TIMEOUT
    };
  }
  const s = global.db.textieAi[chatId];
  if (Array.isArray(updatedMessages) && updatedMessages.length > 0) {
    s.messages = updatedMessages.slice(-20);
  }
  if (typeof isTest === "boolean") s.test = isTest;
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
  name: "textie",
  aliases: ["textieai", "txtai", "textychat"],
  description: "Asisten AI Cerdas Real-time berbasis Textie Generative AI (Full DB Memory & Reply Listener).",
  category: "AI",
  limit: true,
  example: "textie Buatkan teks copywriter jualan kopi\nBalas/reply pesan bot untuk melanjutkan obrolan.",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const chatId = ctx?.id || msg?.key?.remoteJid;
      if (!chatId) return;
      initDB();
      if (!global.db.textieAi[chatId]) return;
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      const sessionData = global.db.textieAi[chatId];
      if (Date.now() > sessionData.expireTime) {
        delete global.db.textieAi[chatId];
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
      const currentMessages = Array.isArray(sessionData.messages) ? [...sessionData.messages] : [];
      const userPrompt = userText || (uploadedMediaUrl ? `Media attached: ${uploadedMediaUrl}` : "Lanjutkan");
      currentMessages.push({
        role: "user",
        content: userPrompt
      });
      const payload = {
        prompt: userPrompt,
        messages: currentMessages,
        test: Boolean(sessionData.test)
      };
      const data = await requestTextieAi(payload);
      const answerText = (data?.result || "Tidak ada respon.").trim();
      currentMessages.push({
        role: "assistant",
        content: answerText
      });
      const bodyText = answerText;
      const buttons = [{
        name: "cta_copy",
        display_text: "📄 Salin Jawaban",
        copy_code: answerText
      }];
      let sentMsg;
      if (typeof ctx.sendCta === "function") {
        sentMsg = await ctx.sendCta(bodyText, `_Textie AI Chat Engine_`, buttons, {
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
      recordSession(chatId, newMsgId, currentMessages, sessionData.test);
      if (typeof ctx?.react === "function") await ctx.react("✨");
      return true;
    } catch (e) {
      console.error("[TEXTIE BEFORE ERROR]:", e.message);
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
        if (["textie", "textieai", "txtai", "textychat"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (rawText === "--reset" || rawText === "--clear" || rawText === "reset" || rawText === "clear") {
        if (global.db.textieAi[chatId]) {
          delete global.db.textieAi[chatId];
          saveDB();
          return ctx.reply("🧹 *Sesi percakapan Textie AI berhasil direset!* Silakan mulai topik baru.");
        }
        return ctx.reply("ℹ️ Tidak ada sesi aktif di percakapan ini.");
      }
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      if (!rawText && !isMedia) {
        const guideText = `–  *T E X T I E  A I*

Asisten percakapan cerdas yang responsif, adaptif, dan akurat berbasis Textie AI.

┌  ◦  *Chat Standar* :
│  └ \`${prefix}textie Buatkan esai 3 paragraf tentang teknologi ramah lingkungan\`
│
├  ◦  *Mode Test (Fast Sandbox)* :
│  └ \`${prefix}textie Berikan tips wawancara kerja --test\`
│
├  ◦  *Sesi Berkelanjutan (Multi-Turn)* :
│  └ Cukup *reply pesan balasan bot* untuk melanjutkan obrolan secara langsung tanpa perlu command!
│
└  ◦  *Flags Tambahan* :
   ├ \`--test\` (Gunakan sandbox test channel)
   ├ \`--media <image_url>\` (Sertakan URL gambar)
   └ \`--reset\` (Hapus riwayat obrolan)`;
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
      const existingSession = global.db.textieAi[chatId];
      const currentMessages = Array.isArray(existingSession?.messages) ? [...existingSession.messages] : [];
      const promptText = cleanPrompt || flags.prompt || (uploadedMediaUrl ? `Media attached: ${uploadedMediaUrl}` : "Halo");
      currentMessages.push({
        role: "user",
        content: promptText
      });
      const isTest = flags.test === true || Boolean(existingSession?.test);
      const payload = {
        prompt: promptText,
        messages: currentMessages,
        test: isTest,
        ...flags
      };
      const data = await requestTextieAi(payload);
      const answerText = (data?.result || "Tidak ada respon yang dihasilkan.").trim();
      currentMessages.push({
        role: "assistant",
        content: answerText
      });
      const bodyText = answerText;
      const buttons = [{
        name: "cta_copy",
        display_text: "📄 Salin Jawaban",
        copy_code: answerText
      }];
      let sentMsg;
      if (typeof ctx.sendCta === "function") {
        sentMsg = await ctx.sendCta(bodyText, `_Textie AI Chat Engine${isTest ? " (Test Mode)" : ""}_`, buttons, {
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
      recordSession(chatId, sentMsgId, currentMessages, isTest);
      await ctx.react("✨");
    } catch (error) {
      console.error("[Textie AI Error]:", error?.message || error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.error || error.message || "Gagal memproses permintaan ke Textie AI.";
      ctx.reply(`❌ Terjadi kendala: ${errMsg}`);
    }
  }
};