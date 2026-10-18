import axios from "axios";
import db from "../../data/db.js";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/ai/anonymousai`;
const SESSION_TIMEOUT = 20 * 60 * 1e3;
const CONFIG = {
  TIMEOUT: 75e3,
  DEFAULT_TOOL: "auto",
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36"
};

function initDB(jid = null, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.anonAi) global.db.anonAi = {};
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
    if (["t"].includes(key)) key = "tool";
    if (["think", "reason"].includes(key)) key = "thinking";
    if (["web", "browsing"].includes(key)) key = "search";
    if (["img", "image", "doc"].includes(key)) key = "media";
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
async function requestAnonymousAi(payload) {
  const {
    data
  } = await axios.post(API_URL, payload, {
    headers: {
      "Content-Type": "application/json",
      "User-Agent": CONFIG.USER_AGENT
    },
    timeout: CONFIG.TIMEOUT
  });
  if (!data?.success && data?.status === false) {
    throw new Error(data?.error || data?.message || "Gagal memproses permintaan ke AnonymousAI.");
  }
  return data;
}

function recordSession(chatId, messageId, tool, updatedHistory) {
  if (!chatId) return;
  initDB();
  if (!global.db.anonAi[chatId]) {
    global.db.anonAi[chatId] = {
      tool: tool || CONFIG.DEFAULT_TOOL,
      history: [],
      msgIds: [],
      lastMsgId: null,
      updatedAt: Date.now(),
      expireTime: Date.now() + SESSION_TIMEOUT
    };
  }
  const s = global.db.anonAi[chatId];
  if (tool) s.tool = tool;
  if (Array.isArray(updatedHistory) && updatedHistory.length > 0) {
    s.history = updatedHistory.slice(-14);
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
  name: "anonai",
  aliases: ["anonymousai", "anona", "freeai"],
  description: "Asisten AI Anonymous dengan 130+ Fitur Khusus, Vision, Web Search & Sesi DB.",
  category: "AI",
  limit: true,
  example: "anonai Apa perbedaan let dan const di JavaScript?\nanonai --tool bug-fixer <masukkan kode error>\nanonai Analisis diagram ini (kirim/balas gambar)\nBalas pesan bot untuk melanjutkan obrolan.",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const chatId = ctx?.id || msg?.key?.remoteJid;
      if (!chatId) return;
      initDB();
      if (!global.db.anonAi[chatId]) return;
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      const sessionData = global.db.anonAi[chatId];
      if (Date.now() > sessionData.expireTime) {
        delete global.db.anonAi[chatId];
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
        prompt: userText || (uploadedMediaUrl ? "Jelaskan dan analisis berkas ini secara detail" : "Lanjutkan"),
        tool: sessionData.tool || CONFIG.DEFAULT_TOOL,
        history: Array.isArray(sessionData.history) ? sessionData.history : [],
        search: true,
        ...uploadedMediaUrl ? {
          media: uploadedMediaUrl
        } : {}
      };
      const data = await requestAnonymousAi(payload);
      const answerText = (data.output || data.result?.output || "Tidak ada respon.").trim();
      const bodyText = answerText;
      const buttons = [{
        name: "cta_copy",
        display_text: "📄 Salin Jawaban",
        copy_code: answerText
      }];
      let sentMsg;
      if (typeof ctx.sendCta === "function") {
        sentMsg = await ctx.sendCta(bodyText, "", buttons, {
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
      recordSession(chatId, newMsgId, payload.tool, data.history);
      if (typeof ctx?.react === "function") await ctx.react("✨");
      return true;
    } catch (e) {
      console.error("[ANON-AI BEFORE ERROR]:", e.message);
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
        if (["anonai", "anonymousai", "anona", "freeai"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • Anonymous AI`;
      if (rawText === "--reset" || rawText === "--clear" || rawText === "reset" || rawText === "clear") {
        if (global.db.anonAi[chatId]) {
          delete global.db.anonAi[chatId];
          saveDB();
          return ctx.reply("🧹 *Sesi obrolan Anonymous AI berhasil direset!* Silakan mulai topik baru.");
        }
        return ctx.reply("ℹ️ Tidak ada sesi Anonymous AI yang aktif di obrolan ini.");
      }
      if (rawText === "--tools" || rawText === "--list") {
        const popularTools = ["auto", "code-assistant", "bug-fixer", "python-ai", "sql-generator", "math-solver", "translator", "paraphrasing-tool", "grammar-checker", "email-writer", "blog-draft", "resume-builder", "seo-meta", "ai-detector", "ai-humanizer", "pdf-summariser", "research-summarizer"];
        return ctx.reply(`–  *P O P U L A R  A I  T O O L S*\n\n` + popularTools.map(t => `• \`${t}\``).join("\n") + `\n\n_Dan 100+ tools lainnya. Gunakan flag \`--tool <nama_tool>\`._\n\n` + `${botFooter}`);
      }
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      if (!rawText && !isMedia) {
        const guideText = `–  *A N O N Y M O U S  A I*

Asisten AI serba bisa dengan dukungan 130+ tools khusus, vision, dan web search real-time.

┌  ◦  *Chat Standar* :
│  └ \`${prefix}anonai Jelaskan cara kerja Docker container\`
│
├  ◦  *Gunakan Tool Khusus* :
│  └ \`${prefix}anonai --tool bug-fixer Perbaiki kode TypeError ini\`
│
├  ◦  *Analisis Gambar / Dokumen (Vision)* :
│  └ Balas / kirim media: \`${prefix}anonai Jelaskan isi gambar ini\`
│
├  ◦  *Sesi Berkelanjutan* :
│  └ Cukup *reply pesan bot* untuk melanjutkan percakapan!
│
└  ◦  *Parameter Flag Tambahan* :
   ├ \`--tools\` (Lihat daftar tools populer)
   ├ \`--tool <nama_tool>\` (Pilih mode fungsi AI)
   ├ \`--thinking true\` (Aktifkan penalaran mendalam)
   ├ \`--search false\` (Matikan web browsing)
   └ \`--reset\` (Hapus sesi chat yang sedang berjalan)`;
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
      const existingSession = global.db.anonAi[chatId];
      const activeTool = flags.tool || existingSession?.tool || CONFIG.DEFAULT_TOOL;
      const promptText = cleanPrompt || flags.prompt || (uploadedMediaUrl ? "Jelaskan dan analisis berkas media ini" : "Halo");
      const payload = {
        prompt: promptText,
        tool: activeTool,
        history: existingSession?.history || [],
        thinking: Boolean(flags.thinking ?? false),
        search: Boolean(flags.search ?? true),
        ...uploadedMediaUrl ? {
          media: uploadedMediaUrl
        } : flags.media ? {
          media: flags.media
        } : {}
      };
      const data = await requestAnonymousAi(payload);
      const answerText = (data.output || data.result?.output || "Tidak ada respon teks.").trim();
      const bodyText = answerText;
      const buttons = [{
        name: "cta_copy",
        display_text: "📄 Salin Jawaban",
        copy_code: answerText
      }];
      let sentMsg;
      if (typeof ctx.sendCta === "function") {
        sentMsg = await ctx.sendCta(bodyText, "", buttons, {
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
      recordSession(chatId, sentMsgId, activeTool, data.history);
      await ctx.react("✨");
    } catch (error) {
      console.error("[Anonymous AI Error]:", error?.message || error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.error || error.response?.data?.message || error.message || "Gagal memproses permintaan ke Anonymous AI.";
      ctx.reply(`❌ Terjadi kendala: ${errMsg}`);
    }
  }
};