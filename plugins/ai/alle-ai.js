import axios from "axios";
import db from "../../data/db.js";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/ai/alle-ai`;
const SESSION_TIMEOUT = 20 * 60 * 1e3;
const CONFIG = {
  TIMEOUT: 12e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};

function initDB(jid = null, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.alleAi) global.db.alleAi = {};
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
    if (["session", "session_id", "conversation_session", "conv"].includes(key)) key = "conversation";
    if (["web", "websearch"].includes(key)) key = "web_search";
    if (["token_jwt"].includes(key)) key = "token";
    if (["models"].includes(key)) key = "model";
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
async function requestAlleAi(payload) {
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

function recordSessionMessage(chatId, messageId, sessionData) {
  if (!messageId || !chatId) return;
  initDB();
  if (!global.db.alleAi[chatId]) {
    global.db.alleAi[chatId] = {
      conversation: null,
      token: null,
      model: null,
      web_search: false,
      combine: false,
      compare: false,
      msgIds: [],
      lastMsgId: null,
      updatedAt: Date.now(),
      expireTime: Date.now() + SESSION_TIMEOUT
    };
  }
  const s = global.db.alleAi[chatId];
  if (sessionData.conversation !== undefined) s.conversation = sessionData.conversation;
  if (sessionData.token !== undefined) s.token = sessionData.token;
  if (sessionData.model !== undefined) s.model = sessionData.model;
  if (sessionData.web_search !== undefined) s.web_search = sessionData.web_search;
  if (sessionData.combine !== undefined) s.combine = sessionData.combine;
  if (sessionData.compare !== undefined) s.compare = sessionData.compare;
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
  name: "alleai",
  aliases: ["alle", "alle-ai"],
  description: "Multimodel AI Ensemble with Web Search, Combine, Compare & Media Support (Full DB Session).",
  category: "AI",
  limit: true,
  example: "alleai Jelaskan gambar ini --web_search --compare",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const chatId = ctx?.id || msg?.key?.remoteJid;
      if (!chatId) return;
      initDB();
      if (!global.db.alleAi[chatId]) return;
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      const sessionData = global.db.alleAi[chatId];
      if (Date.now() > sessionData.expireTime) {
        delete global.db.alleAi[chatId];
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
        prompt: userText || (uploadedMediaUrl ? "Jelaskan media ini secara detail" : "Lanjutkan"),
        web_search: Boolean(sessionData.web_search ?? false),
        combine: Boolean(sessionData.combine ?? false),
        compare: Boolean(sessionData.compare ?? false),
        conversation: sessionData.conversation || null,
        token: sessionData.token || null,
        ...sessionData.model ? {
          model: sessionData.model
        } : {},
        ...uploadedMediaUrl ? {
          media: uploadedMediaUrl
        } : {}
      };
      const data = await requestAlleAi(bodyPayload);
      if (!data || !data.status || !data.result) {
        throw new Error(data?.message || "Gagal mendapatkan respon dari Alle AI.");
      }
      const resObj = data.result;
      const returnedSession = resObj.conversation_session || resObj.conversation || bodyPayload.conversation || "";
      const returnedToken = data.token || bodyPayload.token || "";
      const primaryResponse = resObj.response || "Tidak ada respon.";
      const outputs = resObj.outputs || {};
      let outputDetails = "";
      const modelKeys = Object.keys(outputs);
      if (bodyPayload.compare && modelKeys.length > 0) {
        for (const modelKey of modelKeys) {
          const modelRes = outputs[modelKey]?.response || outputs[modelKey]?.raw_response || "";
          outputDetails += `┌  ◦  *Model* : ${modelKey.toUpperCase()}\n“${modelRes.trim()}”\n\n`;
        }
      } else {
        outputDetails = primaryResponse;
      }
      const bodyText = outputDetails.trim();
      const buttons = [{
        name: "cta_copy",
        display_text: "📄 Salin Jawaban",
        copy_code: primaryResponse
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
          conversation: returnedSession,
          token: returnedToken,
          model: bodyPayload.model,
          web_search: bodyPayload.web_search,
          combine: bodyPayload.combine,
          compare: bodyPayload.compare
        });
      }
      if (typeof ctx?.react === "function") await ctx.react("✨");
      return true;
    } catch (e) {
      console.error("[ALLE-AI BEFORE ERROR]:", e.message);
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
        if (["alleai", "alle", "alle-ai"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (rawText === "--reset" || rawText === "--clear" || rawText === "reset" || rawText === "clear") {
        if (global.db.alleAi[chatId]) {
          delete global.db.alleAi[chatId];
          saveDB();
          return ctx.reply("🧹 *Sesi Alle AI berhasil direset!* Riwayat obrolan dan preferensi telah dibersihkan.");
        }
        return ctx.reply("ℹ️ Tidak ada sesi Alle AI yang aktif di obrolan ini.");
      }
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      if (!rawText && !isMedia) {
        const guideText = `–  *A L L E  A I*

Layanan ensemble multi-model AI dengan kemampuan pencarian web real-time, komparasi respon, dan analisis visual foto.

┌  ◦  *Chat Standar* :
│  └ \`${prefix}alleai Jelaskan teori relativitas Einstein\`
│
├  ◦  *Pencarian Web (Real-Time)* :
│  └ \`${prefix}alleai Berita teknologi hari ini --web_search\`
│
├  ◦  *Mode Compare (Bandingkan Model)* :
│  └ \`${prefix}alleai Buatkan puisi tentang senja --compare\`
│
├  ◦  *Mode Combine (Sintesis Jawaban)* :
│  └ \`${prefix}alleai Cara membuat website dari nol --combine\`
│
├  ◦  *Analisis Media (Vision)* :
│  └ Kirim / balas gambar: \`${prefix}alleai Jelaskan detail gambar ini\`
│
└  ◦  *Parameter Flag Tambahan* :
   ├ \`--reset\` (Hapus sesi aktif)
   ├ \`--model <nama_model>\`
   ├ \`--conversation <id>\`
   └ \`--token <token>\``;
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
      const existingSession = global.db.alleAi[chatId];
      const conversationToUse = flags.conversation || existingSession?.conversation || null;
      const tokenToUse = flags.token || existingSession?.token || null;
      const modelToUse = flags.model || existingSession?.model || undefined;
      const webSearchToUse = flags.web_search !== undefined ? Boolean(flags.web_search) : Boolean(existingSession?.web_search);
      const combineToUse = flags.combine !== undefined ? Boolean(flags.combine) : Boolean(existingSession?.combine);
      const compareToUse = flags.compare !== undefined ? Boolean(flags.compare) : Boolean(existingSession?.compare);
      const bodyPayload = {
        prompt: flags.prompt || cleanPrompt || (uploadedMediaUrl ? "Jelaskan media/gambar ini secara detail" : "Halo"),
        web_search: webSearchToUse,
        combine: combineToUse,
        compare: compareToUse,
        conversation: conversationToUse,
        token: tokenToUse,
        ...modelToUse ? {
          model: modelToUse
        } : {},
        ...flags.messages ? {
          messages: typeof flags.messages === "string" ? JSON.parse(flags.messages) : flags.messages
        } : {},
        ...uploadedMediaUrl ? {
          media: uploadedMediaUrl
        } : flags.media ? {
          media: flags.media
        } : {},
        ...flags
      };
      const data = await requestAlleAi(bodyPayload);
      if (!data || !data.status || !data.result) {
        throw new Error(data?.message || "Gagal mendapatkan respon dari Alle AI.");
      }
      const resObj = data.result;
      const returnedSession = resObj.conversation_session || resObj.conversation || bodyPayload.conversation || "";
      const returnedToken = data.token || bodyPayload.token || "";
      const primaryResponse = resObj.response || "Tidak ada respon.";
      const outputs = resObj.outputs || {};
      let outputDetails = "";
      const modelKeys = Object.keys(outputs);
      if (bodyPayload.compare && modelKeys.length > 0) {
        for (const modelKey of modelKeys) {
          const modelRes = outputs[modelKey]?.response || outputs[modelKey]?.raw_response || "";
          outputDetails += `┌  ◦  *Model* : ${modelKey.toUpperCase()}\n“${modelRes.trim()}”\n\n`;
        }
      } else {
        outputDetails = primaryResponse;
      }
      const bodyText = outputDetails.trim();
      let nextCommand = `${prefix}alleai <tulis_prompt_lanjutan>`;
      if (returnedSession) nextCommand += ` --conversation ${returnedSession}`;
      if (returnedToken) nextCommand += ` --token ${returnedToken}`;
      if (bodyPayload.web_search) nextCommand += ` --web_search`;
      if (bodyPayload.combine) nextCommand += ` --combine`;
      if (bodyPayload.compare) nextCommand += ` --compare`;
      const buttons = [{
        name: "cta_copy",
        display_text: "📋 Salin Lanjutan Sesi",
        copy_code: nextCommand
      }];
      if (returnedToken) {
        buttons.push({
          name: "cta_copy",
          display_text: "🔑 Salin Token Saja",
          copy_code: returnedToken
        });
      }
      buttons.push({
        name: "cta_copy",
        display_text: "📄 Salin Jawaban",
        copy_code: primaryResponse
      });
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
          conversation: returnedSession,
          token: returnedToken,
          model: bodyPayload.model,
          web_search: bodyPayload.web_search,
          combine: bodyPayload.combine,
          compare: bodyPayload.compare
        });
      }
      await ctx.react("✨");
    } catch (error) {
      console.error("[Alle AI Error]:", error?.message || error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Terjadi kendala pada Alle AI: ${errMsg}`);
    }
  }
};