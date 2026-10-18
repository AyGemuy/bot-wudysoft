import axios from "axios";
import db from "../../data/db.js";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/ai/deeparena`;
const SESSION_TIMEOUT = 20 * 60 * 1e3;
const CONFIG = {
  TIMEOUT: 9e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};

function initDB(jid = null, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.deepArena) global.db.deepArena = {};
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
    if (["state", "session", "sess", "session_id"].includes(key)) key = "state";
    if (["image", "img", "media"].includes(key)) key = "media";
    if (["reasoning", "think", "thought"].includes(key)) key = "reasoning";
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
async function requestDeepArena(payload) {
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

function formatArenaResult(result, reasoning = null, showReasoning = false) {
  let text = "";
  if (typeof result === "string") {
    return result;
  }
  const resA = result?.A || "";
  const resB = result?.B || "";
  if (resA && resB) {
    text += `┌  ◦  *Model A* :\n“${resA.trim()}”\n\n`;
    text += `└  ◦  *Model B* :\n“${resB.trim()}”`;
  } else if (resA) {
    text += `${resA.trim()}`;
  } else if (resB) {
    text += `${resB.trim()}`;
  } else {
    text = "Tidak ada teks respon.";
  }
  if (showReasoning && reasoning) {
    const reasonA = reasoning?.A ? `┌  ◦  *Reasoning A* :\n_${reasoning.A.slice(0, 300)}..._\n\n` : "";
    const reasonB = reasoning?.B ? `└  ◦  *Reasoning B* :\n_${reasoning.B.slice(0, 300)}..._\n\n` : "";
    if (reasonA || reasonB) {
      text = `${reasonA}${reasonB}` + text;
    }
  }
  return text;
}

function recordSessionMessage(chatId, messageId, sessionData) {
  if (!messageId || !chatId) return;
  initDB();
  if (!global.db.deepArena[chatId]) {
    global.db.deepArena[chatId] = {
      state: null,
      msgIds: [],
      lastMsgId: null,
      updatedAt: Date.now(),
      expireTime: Date.now() + SESSION_TIMEOUT
    };
  }
  const s = global.db.deepArena[chatId];
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
  name: "deeparena",
  aliases: ["deep-arena", "darena", "arenaai"],
  description: "AI Dual Battle & Multimodal Assistant via DeepArena (Full DB Session Reply).",
  category: "AI",
  limit: true,
  example: "deeparena Jelaskan cara kerja mobil listrik atau reply pesan bot untuk melanjutkan",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const chatId = ctx?.id || msg?.key?.remoteJid;
      if (!chatId) return;
      initDB();
      if (!global.db.deepArena[chatId]) return;
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      const sessionData = global.db.deepArena[chatId];
      if (Date.now() > sessionData.expireTime) {
        delete global.db.deepArena[chatId];
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
        prompt: userText || (uploadedMediaUrl ? "Jelaskan gambar ini secara detail" : "Lanjutkan"),
        state: sessionData.state || null,
        ...uploadedMediaUrl ? {
          media: uploadedMediaUrl
        } : {}
      };
      const data = await requestDeepArena(bodyPayload);
      if (!data || data.status !== "success" && data.status !== true || !data.result) {
        throw new Error(data?.message || "Gagal mendapatkan respon dari DeepArena.");
      }
      const answerText = formatArenaResult(data.result, data.reasoning, false).trim();
      const returnedState = data.state || bodyPayload.state || null;
      const bodyText = answerText;
      const copyText = typeof data.result === "string" ? data.result : data.result?.A || data.result?.B || answerText;
      const buttons = [{
        name: "cta_copy",
        display_text: "📄 Salin Jawaban",
        copy_code: copyText
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
      if (newMsgId) {
        recordSessionMessage(chatId, newMsgId, {
          state: returnedState
        });
      }
      if (typeof ctx?.react === "function") await ctx.react("✨");
      return true;
    } catch (e) {
      console.error("[DEEPARENA BEFORE ERROR]:", e.message);
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
        if (["deeparena", "deep-arena", "darena", "arenaai"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (rawText === "--reset" || rawText === "--clear" || rawText === "reset" || rawText === "clear") {
        if (global.db.deepArena[chatId]) {
          delete global.db.deepArena[chatId];
          saveDB();
          return ctx.reply("🧹 *Sesi DeepArena berhasil direset!* Riwayat pertempuran model telah dibersihkan.");
        }
        return ctx.reply("ℹ️ Tidak ada sesi DeepArena yang aktif di obrolan ini.");
      }
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      if (!rawText && !isMedia) {
        const guideText = `–  *D E E P  A R E N A*

Layanan perbandingan dua model AI secara bersamaan (Dual Battle) dengan memori percakapan berlanjut (Multi-Turn Session).

┌  ◦  *Chat & Dual Respon* :
│  └ \`${prefix}deeparena Jelaskan teori relativitas secara singkat\`
│
├  ◦  *Analisis Gambar (Vision)* :
│  └ Kirim / balas gambar: \`${prefix}deeparena Jelaskan isi gambar ini\`
│
├  ◦  *Sesi Berkelanjutan* :
│  └ Cukup *reply pesan bot* untuk melanjutkan obrolan secara otomatis!
│
└  ◦  *Parameter Flag Tambahan* :
   ├ \`--reset\` (Hapus sesi pertempuran model aktif)
   ├ \`--think\` (Tampilkan proses penalaran / reasoning)
   ├ \`--media <url>\`
   └ \`--state <json_state>\``;
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
      const existingSession = global.db.deepArena[chatId];
      let stateToUse = null;
      if (flags.state) {
        stateToUse = typeof flags.state === "string" ? JSON.parse(flags.state) : flags.state;
      } else if (existingSession?.state) {
        stateToUse = existingSession.state;
      }
      const bodyPayload = {
        prompt: cleanPrompt || (uploadedMediaUrl ? "Jelaskan gambar ini secara detail" : "Halo"),
        state: stateToUse,
        ...uploadedMediaUrl ? {
          media: uploadedMediaUrl
        } : flags.media ? {
          media: flags.media
        } : {}
      };
      const data = await requestDeepArena(bodyPayload);
      if (!data || data.status !== "success" && data.status !== true || !data.result) {
        throw new Error(data?.message || "Gagal mendapatkan respon dari DeepArena.");
      }
      const showReasoning = Boolean(flags.reasoning || flags.think);
      const answerText = formatArenaResult(data.result, data.reasoning, showReasoning).trim();
      const returnedState = data.state || bodyPayload.state || null;
      const sessionCode = returnedState?.sessionCode || (typeof returnedState === "string" ? returnedState : "");
      const bodyText = answerText;
      const copyText = typeof data.result === "string" ? data.result : data.result?.A || data.result?.B || answerText;
      const buttons = [{
        name: "cta_copy",
        display_text: "📄 Salin Jawaban",
        copy_code: copyText
      }];
      if (sessionCode) {
        buttons.push({
          name: "cta_copy",
          display_text: "🔑 Salin Session Code",
          copy_code: sessionCode
        });
      }
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
      if (sentMsgId) {
        recordSessionMessage(chatId, sentMsgId, {
          state: returnedState
        });
      }
      await ctx.react("✨");
    } catch (error) {
      console.error("[DeepArena Error]:", error?.message || error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Terjadi kendala pada DeepArena: ${errMsg}`);
    }
  }
};