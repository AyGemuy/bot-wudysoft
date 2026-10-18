import axios from "axios";
import db from "../../data/db.js";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/ai/nolo-ai`;
const SESSION_TIMEOUT = 20 * 60 * 1e3;
const CONFIG = {
  TIMEOUT: 6e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};

function initDB(jid = null, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.noloAi) global.db.noloAi = {};
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
    if (["token", "state_token"].includes(key)) key = "state";
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
async function requestNoloAI(payload) {
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
  if (!global.db.noloAi[chatId]) {
    global.db.noloAi[chatId] = {
      state: returnedState || null,
      msgIds: [],
      lastMsgId: null,
      updatedAt: Date.now(),
      expireTime: Date.now() + SESSION_TIMEOUT
    };
  }
  const s = global.db.noloAi[chatId];
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
  name: "noloai",
  aliases: ["noloai", "nolo"],
  description: "Chat dengan Nolo AI (Custom State & Direct Image Support) via DB Session.",
  category: "AI",
  limit: true,
  example: "• Obrolan: noloai siapa presiden pertama indonesia?\n• Sesi Lanjutan: Reply pesan bot untuk melanjutkan obrolan\n• Analisis Foto: Reply gambar dengan caption nolo analisis",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const chatId = ctx?.id || msg?.key?.remoteJid;
      if (!chatId) return;
      initDB();
      if (!global.db.noloAi[chatId]) return;
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      const sessionData = global.db.noloAi[chatId];
      if (Date.now() > sessionData.expireTime) {
        delete global.db.noloAi[chatId];
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
          } else {
            uploadedImageUrl = `data:image/jpeg;base64,${buffer.toString("base64")}`;
          }
        }
      }
      const payload = {
        prompt: userText || "Jelaskan gambar ini secara detail",
        state: sessionData.state || null,
        ...uploadedImageUrl ? {
          image: uploadedImageUrl
        } : {}
      };
      const data = await requestNoloAI(payload);
      if (!data || !data.status) {
        throw new Error(data?.message || "Gagal mendapatkan balasan dari Nolo AI.");
      }
      const answerText = (data.result?.text || data.result?.job_result?.cleaned_text || "Tidak ada balasan.").trim();
      const returnedState = data.state || "";
      const bodyText = answerText;
      const buttons = [{
        name: "cta_copy",
        display_text: "📄 Salin Jawaban",
        copy_code: answerText
      }];
      if (returnedState && returnedState !== "-") {
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
      console.error("[NOLO-AI BEFORE ERROR]:", e.message);
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
        if (["noloai", "nolo"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (rawText === "--reset" || rawText === "--clear" || rawText === "reset" || rawText === "clear") {
        if (global.db.noloAi[chatId]) {
          delete global.db.noloAi[chatId];
          saveDB();
          return ctx.reply("🧹 *Sesi percakapan Nolo AI berhasil direset!* Silakan mulai topik baru.");
        }
        return ctx.reply("ℹ️ Tidak ada sesi Nolo AI yang aktif di room chat ini.");
      }
      if (!rawText && !isMedia) {
        const guideText = `–  *N O L O  A I*

Layanan asisten percakapan cerdas multimodal dengan memori sesi DB dan analisis gambar.

┌  ◦  *Format Standar (Teks)* :
│  └ \`${prefix}noloai jelaskan teori relativitas\`
│
├  ◦  *Analisis Gambar (Vision)* :
│  └ Reply / kirim gambar: \`${prefix}nolo analisis gambar ini secara detail\`
│
├  ◦  *Sesi Berkelanjutan* :
│  └ Cukup *reply pesan bot* untuk melanjutkan obrolan secara langsung!
│
└  ◦  *Parameter Flag Tambahan* :
   ├ \`--reset\` (Hapus sesi aktif)
   └ \`--state <token>\``;
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
          } else {
            uploadedImageUrl = `data:image/jpeg;base64,${buffer.toString("base64")}`;
          }
        }
      }
      const existingSession = global.db.noloAi[chatId];
      const stateToUse = flags.state || existingSession?.state || null;
      const payload = {
        prompt: cleanPrompt || flags.prompt || (uploadedImageUrl ? "Jelaskan gambar ini secara detail" : "Halo!"),
        ...stateToUse ? {
          state: stateToUse
        } : {},
        ...uploadedImageUrl ? {
          image: uploadedImageUrl
        } : {}
      };
      const data = await requestNoloAI(payload);
      if (!data || !data.status) {
        throw new Error(data?.message || "Gagal mendapatkan balasan dari Nolo AI.");
      }
      const answerText = (data.result?.text || data.result?.job_result?.cleaned_text || "Tidak ada balasan.").trim();
      const returnedState = data.state || "";
      const bodyText = answerText;
      const buttons = [{
        name: "cta_copy",
        display_text: "📄 Salin Jawaban",
        copy_code: answerText
      }];
      if (returnedState && returnedState !== "-") {
        const nextCommand = `${prefix}nolo <tulis_pertanyaan_lanjutan> --state ${returnedState}`;
        buttons.push({
          name: "cta_copy",
          display_text: "📋 Salin Lanjutan Sesi",
          copy_code: nextCommand
        }, {
          name: "cta_copy",
          display_text: "🔑 Salin State Token",
          copy_code: returnedState
        });
      }
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
      console.error("[Nolo AI Error]:", error?.message || error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Terjadi kendala pada Nolo AI: ${errMsg}`);
    }
  }
};