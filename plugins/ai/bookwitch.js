import axios from "axios";
import db from "../../data/db.js";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/ai/bookwitch`;
const SESSION_TIMEOUT = 30 * 60 * 1e3;
const CONFIG = {
  TIMEOUT: 9e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};

function initDB(jid = null, name = "") {
  try {
    if (!global.db) global.db = {};
    if (!global.db.user) global.db.user = {};
    if (!global.db.bookwitch) global.db.bookwitch = {};
    if (jid && !global.db.user[jid]) {
      global.db.user[jid] = {
        name: name || "",
        money: 1e4,
        exp: 0
      };
    }
  } catch (err) {
    console.error("[BookWitch initDB Error]:", err?.message || err);
  }
}

function saveDB() {
  try {
    if (typeof db?.write === "function" && global.db) {
      db.write(global.db);
    }
  } catch (err) {
    console.error("[BookWitch saveDB Error]:", err?.message || err);
  }
}

function parseFlags(input = "") {
  try {
    const flags = {};
    const flagRegex = /(?:--|-)([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
    let match;
    while ((match = flagRegex.exec(input)) !== null) {
      let key = match[1].toLowerCase();
      let rawVal = match[2];
      let val = true;
      if (["restart", "reset", "clear"].includes(key)) key = "reset";
      if (["img", "image", "mediaurl"].includes(key)) key = "media";
      if (["s", "session", "token"].includes(key)) key = "state";
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
  } catch (err) {
    console.error("[BookWitch parseFlags Error]:", err?.message || err);
    return {
      flags: {},
      cleanPrompt: input
    };
  }
}
async function requestBookWitchAPI(payload = {}) {
  try {
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
  } catch (err) {
    console.error("[BookWitch requestBookWitchAPI Error]:", err?.message || err);
    throw err;
  }
}

function recordSession(chatId, messageId, stateToken, messagesCount = 0) {
  try {
    if (!messageId || !chatId) return;
    initDB();
    if (!global.db.bookwitch[chatId]) {
      global.db.bookwitch[chatId] = {
        state: stateToken || null,
        messagesCount: messagesCount,
        msgIds: [],
        lastMsgId: null,
        updatedAt: Date.now(),
        expireTime: Date.now() + SESSION_TIMEOUT
      };
    }
    const s = global.db.bookwitch[chatId];
    if (stateToken) s.state = stateToken;
    if (messagesCount) s.messagesCount = messagesCount;
    if (!Array.isArray(s.msgIds)) s.msgIds = [];
    if (!s.msgIds.includes(messageId)) {
      s.msgIds.push(messageId);
    }
    s.lastMsgId = messageId;
    s.updatedAt = Date.now();
    s.expireTime = Date.now() + SESSION_TIMEOUT;
    saveDB();
  } catch (err) {
    console.error("[BookWitch recordSession Error]:", err?.message || err);
  }
}
export default {
  name: "bookwitch",
  aliases: ["bwai", "bookwitchai", "witchai"],
  description: "AI Assistant Pintar & Story Explorer (BookWitch AI) via Wudysoft API",
  category: "AI",
  limit: true,
  example: "bookwitch jelaskan sinopsis novel laskar pelangi atau reply bot untuk lanjut chat",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const chatId = ctx?.id || msg?.key?.remoteJid;
      if (!chatId) return;
      initDB();
      if (!global.db.bookwitch[chatId]) return;
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      const sessionData = global.db.bookwitch[chatId];
      if (Date.now() > sessionData.expireTime) {
        delete global.db.bookwitch[chatId];
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
        prompt: userText || "Lanjutkan penjelasan sebelumnya",
        state: sessionData.state || undefined,
        ...uploadedMediaUrl ? {
          media: uploadedMediaUrl
        } : {}
      };
      const res = await requestBookWitchAPI(bodyPayload);
      if (!res || !res.status) {
        throw new Error(res?.result?.error_message || res?.error || "Gagal mendapatkan respon dari BookWitch AI.");
      }
      const result = res.result || {};
      const answerContent = (result.content || "Respon berhasil diselesaikan.").trim();
      const newState = result.state || sessionData.state;
      const count = result.messages_count || sessionData.messagesCount + 2;
      const bodyText = answerContent;
      const buttons = [{
        name: "cta_copy",
        display_text: "Salin Jawaban",
        copy_code: answerContent
      }];
      let sentMsg;
      if (typeof ctx.sendCta === "function") {
        sentMsg = await ctx.sendCta(bodyText, `${global.bot?.name || "BookWitch"} • AI Assistant`, buttons, {
          quoted: msg
        });
      } else {
        sentMsg = await sock.sendMessage(chatId, {
          text: bodyText
        }, {
          quoted: msg
        });
      }
      const newMsgId = sentMsg?.key?.id;
      if (newMsgId) {
        recordSession(chatId, newMsgId, newState, count);
      }
      if (typeof ctx?.react === "function") await ctx.react("✨");
      return true;
    } catch (e) {
      console.error("[BOOKWITCH BEFORE ERROR]:", e?.message || e);
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
        if (["bookwitch", "bwai", "bookwitchai", "witchai"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const botName = global.bot?.name || "BookWitch";
      const botFooter = `${botName} • BookWitch AI Assistant`;
      if (["--reset", "--clear", "reset", "clear"].includes(rawText.toLowerCase())) {
        if (global.db.bookwitch[chatId]) {
          delete global.db.bookwitch[chatId];
          saveDB();
          return ctx.reply("🧹 *Sesi percakapan BookWitch AI berhasil direset!* Topik baru dapat dimulai.");
        }
        return ctx.reply("ℹ️ Tidak ada sesi aktif BookWitch AI di obrolan ini.");
      }
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      if (!rawText && !isMedia) {
        const guideText = `–  *B O O K W I T C H  A I*

Asisten cerdas multimodal untuk menjawab pertanyaan, eksplorasi buku, dan diskusi interaktif.

┌  ◦  *Tanya Jawab AI* :
│  └ \`${prefix}bookwitch rekomendasikan novel fiksi ilmiah terbaik\`
│
├  ◦  *Analisis Gambar / Dokumen* :
│  └ Kirim / balas foto buku: \`${prefix}bookwitch ringkas buku ini\`
│
├  ◦  *Multi-Turn Conversation* :
│  └ Cukup *reply pesan bot* untuk melanjutkan obrolan secara otomatis.
│
└  ◦  *Opsi Flags* :
   ├ \`--state <token>\` (Lanjutkan sesi state tertentu)
   ├ \`--media <url>\` (Sertakan gambar dari URL)
   └ \`--reset\` (Hapus sesi chat aktif)`;
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
        try {
          const buffer = await ctx.download();
          if (buffer && Buffer.isBuffer(buffer)) {
            const uploadRes = await upload(buffer).catch(() => null);
            if (uploadRes?.status && uploadRes?.url) {
              uploadedMediaUrl = uploadRes.url;
            }
          }
        } catch (uploadErr) {
          console.error("[BookWitch Upload Error]:", uploadErr?.message || uploadErr);
        }
      }
      const existingSession = global.db.bookwitch[chatId];
      const stateToUse = flags.state || existingSession?.state || undefined;
      const promptText = cleanPrompt || flags.prompt || (uploadedMediaUrl ? "Jelaskan isi gambar ini secara mendalam" : "Halo");
      const bodyPayload = {
        prompt: promptText,
        state: stateToUse,
        ...uploadedMediaUrl ? {
          media: uploadedMediaUrl
        } : flags.media ? {
          media: flags.media
        } : {}
      };
      const res = await requestBookWitchAPI(bodyPayload);
      if (!res || !res.status) {
        throw new Error(res?.result?.error_message || res?.error || "Gagal mendapatkan respon dari BookWitch AI.");
      }
      const result = res.result || {};
      const answerContent = (result.content || "Respon berhasil diselesaikan.").trim();
      const newState = result.state || stateToUse;
      const totalMessages = result.messages_count || 2;
      const bodyText = answerContent;
      const buttons = [{
        name: "cta_copy",
        display_text: "Salin Jawaban",
        copy_code: answerContent
      }];
      let sentMsg;
      if (typeof ctx.sendCta === "function") {
        sentMsg = await ctx.sendCta(bodyText, botFooter, buttons, {
          image: uploadedMediaUrl || undefined,
          quoted: quotedMsg
        });
      } else {
        sentMsg = await sock.sendMessage(chatId, {
          image: uploadedMediaUrl ? {
            url: uploadedMediaUrl
          } : undefined,
          caption: bodyText
        }, {
          quoted: quotedMsg
        });
      }
      const sentMsgId = sentMsg?.key?.id;
      if (sentMsgId) {
        recordSession(chatId, sentMsgId, newState, totalMessages);
      }
      await ctx.react("✨");
    } catch (error) {
      console.error("[BookWitch Error]:", error?.message || error);
      if (typeof ctx.react === "function") await ctx.react("❌");
      const errMsg = error.response?.data?.result?.error_message || error.response?.data?.error || error.message;
      ctx.reply(`❌ Terjadi kendala pada BookWitch AI: ${errMsg}`);
    }
  }
};