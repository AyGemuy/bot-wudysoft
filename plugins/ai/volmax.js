import axios from "axios";
import db from "../../data/db.js";
import { upload } from "../../lib/upload.js";
import { simpleQuoted } from "../../lib/quoted.js";

const API_URL = `${global.bot?.api?.wudysoft}/api/ai/volmax`;
const SESSION_TIMEOUT = 25 * 60 * 1e3; // 25 Menit
const CONFIG = {
  TIMEOUT: 60e3,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};

function initDB(jid = null, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.volmaxAi) global.db.volmaxAi = {};
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

    if (["ver", "v"].includes(key)) key = "gptVersion";
    if (["img", "image"].includes(key)) key = "media";

    if (rawVal !== undefined) {
      if ((rawVal.startsWith('"') && rawVal.endsWith('"')) || (rawVal.startsWith("'") && rawVal.endsWith("'"))) {
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
    flags,
    cleanPrompt
  };
}

// Request API Volmax
async function requestVolmaxAi(payload = {}) {
  const { data } = await axios.post(API_URL, payload, {
    headers: {
      "Content-Type": "application/json",
      "User-Agent": CONFIG.USER_AGENT
    },
    timeout: CONFIG.TIMEOUT
  }).catch(err => {
    // Fallback jika API mengharapkan GET query
    return axios.get(API_URL, {
      params: payload,
      headers: { "User-Agent": CONFIG.USER_AGENT },
      timeout: CONFIG.TIMEOUT
    });
  });

  if (!data || (data.status !== 200 && data.status !== true)) {
    throw new Error(data?.error || data?.message || "Gagal memproses respons dari Volmax AI.");
  }
  return data;
}

function recordSession(chatId, messageId, updatedMessages, model) {
  if (!chatId) return;
  initDB();
  if (!global.db.volmaxAi[chatId]) {
    global.db.volmaxAi[chatId] = {
      messages: [],
      model: model || "gpt-4o-mini",
      msgIds: [],
      lastMsgId: null,
      updatedAt: Date.now(),
      expireTime: Date.now() + SESSION_TIMEOUT
    };
  }
  const s = global.db.volmaxAi[chatId];
  if (Array.isArray(updatedMessages) && updatedMessages.length > 0) {
    s.messages = updatedMessages.slice(-20); // Batasi memori riwayat 20 pesan terakhir
  }
  if (model) s.model = model;
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
  name: "volmax",
  aliases: ["volmaxai", "vlmax", "vmax"],
  description: "Asisten AI Percakapan Cerdas berbasis Volmax Azure GPT-4o-mini (Full Memory & Reply Listener).",
  category: "AI",
  limit: true,
  example: "volmax Halo, jelaskan apa itu black hole?\nBalas/reply pesan bot untuk melanjutkan percakapan secara langsung.",

  before: async (msg, { sock, ctx }) => {
    try {
      const chatId = ctx?.id || msg?.key?.remoteJid;
      if (!chatId) return;
      initDB();
      if (!global.db.volmaxAi[chatId]) return;

      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;

      const sessionData = global.db.volmaxAi[chatId];
      if (Date.now() > sessionData.expireTime) {
        delete global.db.volmaxAi[chatId];
        saveDB();
        return;
      }

      const quotedStanzaId = ctx?.quoted?.id || msg?.message?.extendedTextMessage?.contextInfo?.stanzaId;
      const isQuotingAi = quotedStanzaId && (
        quotedStanzaId === sessionData.lastMsgId ||
        (Array.isArray(sessionData.msgIds) && sessionData.msgIds.includes(quotedStanzaId))
      );

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
      const userPrompt = userText || (uploadedMediaUrl ? `Tolong analisa gambar ini: ${uploadedMediaUrl}` : "Lanjutkan");

      currentMessages.push({
        role: "user",
        content: userPrompt
      });

      const payload = {
        prompt: userPrompt,
        messages: currentMessages,
        gptVersion: sessionData.gptVersion || "4.0"
      };

      const data = await requestVolmaxAi(payload);
      const answerText = (data?.result || "Tidak ada respon teks.").trim();
      const botModel = data?.chunks?.model || "gpt-4o-mini";

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
        sentMsg = await ctx.sendCta(bodyText, `_Model: ${botModel}_`, buttons, {
          media: uploadedMediaUrl || null,
          quoted: msg
        });
      } else if (uploadedMediaUrl) {
        sentMsg = await sock.sendMessage(ctx.id, {
          image: { url: uploadedMediaUrl },
          caption: bodyText
        }, { quoted: msg });
      } else {
        sentMsg = await sock.sendMessage(ctx.id, {
          text: bodyText
        }, { quoted: msg });
      }

      const newMsgId = sentMsg?.key?.id;
      recordSession(chatId, newMsgId, currentMessages, botModel);

      if (typeof ctx?.react === "function") await ctx.react("✨");
      return true;
    } catch (e) {
      console.error("[VOLMAX BEFORE ERROR]:", e.message);
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
        if (["volmax", "volmaxai", "vlmax", "vmax"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }

      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;

      // 1. Reset Sesi
      if (rawText === "--reset" || rawText === "--clear" || rawText === "reset" || rawText === "clear") {
        if (global.db.volmaxAi[chatId]) {
          delete global.db.volmaxAi[chatId];
          saveDB();
          return ctx.reply("🧹 *Sesi percakapan Volmax AI berhasil direset!* Silakan mulai topik baru.");
        }
        return ctx.reply("ℹ️ Tidak ada sesi aktif di percakapan ini.");
      }

      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      if (!rawText && !isMedia) {
        const sessionData = global.db.volmaxAi[chatId];
        const activeModel = sessionData?.model || "gpt-4o-mini";
        const guideText = `–  *V O L M A X  A I*

Asisten cerdas performa tinggi dengan arsitektur Azure OpenAI GPT-4o-mini.

┌  ◦  *Model Aktif* : \`${activeModel}\`
│
├  ◦  *Chat Standar* :
│  └ \`${prefix}volmax Bagaimana cara kerja mesin kuantum?\`
│
├  ◦  *Analisis Gambar (Vision)* :
│  └ Kirim/balas gambar: \`${prefix}volmax Jelaskan isi gambar ini\`
│
├  ◦  *Sesi Berkelanjutan (Multi-Turn)* :
│  └ Cukup *reply pesan balasan bot* untuk melanjutkan obrolan secara langsung tanpa command!
│
└  ◦  *Flags Tambahan* :
   ├ \`--ver <4.0>\` (Versi model GPT)
   ├ \`--media <image_url>\` (Sertakan URL gambar eksplisit)
   └ \`--reset\` (Hapus riwayat obrolan)`;

        return ctx.reply(guideText, { quoted: quotedMsg });
      }

      await ctx.react("💭");

      const { flags, cleanPrompt } = parseFlags(rawText);

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

      const existingSession = global.db.volmaxAi[chatId];
      const currentMessages = Array.isArray(existingSession?.messages) ? [...existingSession.messages] : [];

      const promptText = cleanPrompt || flags.prompt || (uploadedMediaUrl ? `Tolong analisa gambar ini: ${uploadedMediaUrl}` : "Halo");
      currentMessages.push({
        role: "user",
        content: promptText
      });

      const payload = {
        prompt: promptText,
        messages: currentMessages,
        gptVersion: flags.gptVersion || existingSession?.gptVersion || "4.0",
        ...flags
      };

      const data = await requestVolmaxAi(payload);
      const answerText = (data?.result || "Tidak ada respon yang dihasilkan.").trim();
      const botModel = data?.chunks?.model || "gpt-4o-mini";

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
        sentMsg = await ctx.sendCta(bodyText, `_Model: ${botModel}_`, buttons, {
          media: uploadedMediaUrl || null,
          quoted: quotedMsg
        });
      } else if (uploadedMediaUrl) {
        sentMsg = await sock.sendMessage(ctx.id, {
          image: { url: uploadedMediaUrl },
          caption: bodyText
        }, { quoted: quotedMsg });
      } else {
        sentMsg = await sock.sendMessage(ctx.id, {
          text: bodyText
        }, { quoted: quotedMsg });
      }

      const sentMsgId = sentMsg?.key?.id;
      recordSession(chatId, sentMsgId, currentMessages, botModel);

      await ctx.react("✨");
    } catch (error) {
      console.error("[Volmax AI Error]:", error?.message || error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.error || error.message || "Gagal memproses permintaan ke Volmax AI.";
      ctx.reply(`❌ Terjadi kendala: ${errMsg}`);
    }
  }
};