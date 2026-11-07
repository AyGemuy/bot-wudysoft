import axios from "axios";
import db from "../../data/db.js";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/ai/aiwithnorestrictions`;
const SESSION_TIMEOUT = 30 * 60 * 1e3;
const CONFIG = {
  TIMEOUT: 9e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};

function initDB(jid = null, name = "") {
  try {
    if (!global.db) global.db = {};
    if (!global.db.user) global.db.user = {};
    if (!global.db.aiwithnorestrictions) global.db.aiwithnorestrictions = {};
    if (jid && !global.db.user[jid]) {
      global.db.user[jid] = {
        name: name || "",
        money: 1e4,
        exp: 0
      };
    }
  } catch (err) {
    console.error("[AiNoRestrictions initDB Error]:", err?.message || err);
  }
}

function saveDB() {
  try {
    if (typeof db?.write === "function" && global.db) {
      db.write(global.db);
    }
  } catch (err) {
    console.error("[AiNoRestrictions saveDB Error]:", err?.message || err);
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
      if (["p", "pers"].includes(key)) key = "persona";
      if (["m"].includes(key)) key = "model";
      if (["room", "chat", "room_id"].includes(key)) key = "chat_id";
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
    console.error("[AiNoRestrictions parseFlags Error]:", err?.message || err);
    return {
      flags: {},
      cleanPrompt: input
    };
  }
}
async function requestNoRestrictionsAPI(payload = {}) {
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
    console.error("[AiNoRestrictions requestNoRestrictionsAPI Error]:", err?.message || err);
    throw err;
  }
}

function recordSession(chatId, messageId, stateToken, resultChatId = null, model = "C", persona = "normal") {
  try {
    if (!messageId || !chatId) return;
    initDB();
    if (!global.db.aiwithnorestrictions[chatId]) {
      global.db.aiwithnorestrictions[chatId] = {
        state: stateToken || null,
        chatId: resultChatId || null,
        model: model || "C",
        persona: persona || "normal",
        msgIds: [],
        lastMsgId: null,
        updatedAt: Date.now(),
        expireTime: Date.now() + SESSION_TIMEOUT
      };
    }
    const s = global.db.aiwithnorestrictions[chatId];
    if (stateToken) s.state = stateToken;
    if (resultChatId) s.chatId = resultChatId;
    if (model) s.model = model;
    if (persona) s.persona = persona;
    if (!Array.isArray(s.msgIds)) s.msgIds = [];
    if (!s.msgIds.includes(messageId)) {
      s.msgIds.push(messageId);
    }
    s.lastMsgId = messageId;
    s.updatedAt = Date.now();
    s.expireTime = Date.now() + SESSION_TIMEOUT;
    saveDB();
  } catch (err) {
    console.error("[AiNoRestrictions recordSession Error]:", err?.message || err);
  }
}
export default {
  name: "aiwithnorestrictions",
  aliases: ["norestrictions", "norestriction", "aiunrestricted", "unfilteredai", "awnr"],
  description: "AI Chat Bebas & Unrestricted (Tanpa Batasan Sensor) via Wudysoft API",
  category: "AI",
  limit: true,
  example: "aiwithnorestrictions jelaskan konsep dark psychology atau reply pesan bot untuk lanjut chat",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const targetChat = ctx?.id || msg?.key?.remoteJid;
      if (!targetChat) return;
      initDB();
      if (!global.db.aiwithnorestrictions[targetChat]) return;
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      const sessionData = global.db.aiwithnorestrictions[targetChat];
      if (Date.now() > sessionData.expireTime) {
        delete global.db.aiwithnorestrictions[targetChat];
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
        prompt: userText || "Lanjutkan jawaban sebelumnya secara komprehensif",
        state: sessionData.state || undefined,
        chat_id: sessionData.chatId || undefined,
        model: sessionData.model || "C",
        persona: sessionData.persona || "normal",
        ...uploadedMediaUrl ? {
          media: uploadedMediaUrl
        } : {}
      };
      const res = await requestNoRestrictionsAPI(bodyPayload);
      if (!res || !res.status) {
        throw new Error(res?.result?.error_message || res?.error || "Gagal mendapatkan respon dari AI Unrestricted.");
      }
      const result = res.result || {};
      const answerContent = (result.content || "Respon berhasil diselesaikan.").trim();
      const newState = result.state || sessionData.state;
      const resChatId = result.chat_id || sessionData.chatId;
      const bodyText = answerContent;
      const buttons = [{
        name: "cta_copy",
        display_text: "Salin Teks",
        copy_code: answerContent
      }];
      let sentMsg;
      if (typeof ctx.sendCta === "function") {
        sentMsg = await ctx.sendCta(bodyText, `${global.bot?.name || "AI"} • Unrestricted Mode`, buttons, {
          quoted: msg
        });
      } else {
        sentMsg = await sock.sendMessage(targetChat, {
          text: bodyText
        }, {
          quoted: msg
        });
      }
      const newMsgId = sentMsg?.key?.id;
      if (newMsgId) {
        recordSession(targetChat, newMsgId, newState, resChatId, result.model, result.persona);
      }
      if (typeof ctx?.react === "function") await ctx.react("✨");
      return true;
    } catch (e) {
      console.error("[NO RESTRICTIONS BEFORE ERROR]:", e?.message || e);
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
        if (["aiwithnorestrictions", "norestrictions", "norestriction", "aiunrestricted", "unfilteredai", "awnr"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const botName = global.bot?.name || "AI";
      const botFooter = `${botName} • Unrestricted AI Engine`;
      if (["--reset", "--clear", "reset", "clear"].includes(rawText.toLowerCase())) {
        if (global.db.aiwithnorestrictions[chatId]) {
          delete global.db.aiwithnorestrictions[chatId];
          saveDB();
          return ctx.reply("🧹 *Sesi obrolan AI With No Restrictions berhasil direset!* Sesi baru dimulai.");
        }
        return ctx.reply("ℹ️ Tidak ada sesi aktif AI di obrolan ini.");
      }
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      if (!rawText && !isMedia) {
        const guideText = `–  *A I  W I T H  N O  R E S T R I C T I O N S*

Model AI percakapan tanpa filter dan batasan sensor untuk diskusi terbuka, kreatif, dan mendalam.

┌  ◦  *Chat Bebas* :
│  └ \`${prefix}norestrictions bagaimana cara kerja reverse engineering software?\`
│
├  ◦  *Analisis Media Gambar* :
│  └ Kirim / balas foto: \`${prefix}norestrictions jelaskan diagram ini secara teknis\`
│
├  ◦  *Multi-Turn Conversation* :
│  └ Cukup *reply pesan bot* untuk melanjutkan topik tanpa mengetik command ulang.
│
└  ◦  *Opsi Flags* :
   ├ \`--model <C>\` (Pilih model AI)
   ├ \`--persona <normal>\` (Gaya persona)
   ├ \`--state <token>\` (Token state sesi)
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
        try {
          const buffer = await ctx.download();
          if (buffer && Buffer.isBuffer(buffer)) {
            const uploadRes = await upload(buffer).catch(() => null);
            if (uploadRes?.status && uploadRes?.url) {
              uploadedMediaUrl = uploadRes.url;
            }
          }
        } catch (uploadErr) {
          console.error("[AiNoRestrictions Upload Error]:", uploadErr?.message || uploadErr);
        }
      }
      const existingSession = global.db.aiwithnorestrictions[chatId];
      const stateToUse = flags.state || existingSession?.state || undefined;
      const chatIdToUse = flags.chat_id || existingSession?.chatId || undefined;
      const modelToUse = flags.model || existingSession?.model || "C";
      const personaToUse = flags.persona || existingSession?.persona || "normal";
      const promptText = cleanPrompt || flags.prompt || (uploadedMediaUrl ? "Jelaskan gambar ini secara objektif dan mendalam" : "Halo");
      const bodyPayload = {
        prompt: promptText,
        state: stateToUse,
        chat_id: chatIdToUse,
        model: modelToUse,
        persona: personaToUse,
        ...uploadedMediaUrl ? {
          media: uploadedMediaUrl
        } : flags.media ? {
          media: flags.media
        } : {}
      };
      const res = await requestNoRestrictionsAPI(bodyPayload);
      if (!res || !res.status) {
        throw new Error(res?.result?.error_message || res?.error || "Gagal mendapatkan respon dari AI Unrestricted.");
      }
      const result = res.result || {};
      const answerContent = (result.content || "Respon berhasil diselesaikan.").trim();
      const newState = result.state || stateToUse;
      const returnedChatId = result.chat_id || chatIdToUse;
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
        recordSession(chatId, sentMsgId, newState, returnedChatId, result.model, result.persona);
      }
      await ctx.react("✨");
    } catch (error) {
      console.error("[AiNoRestrictions Error]:", error?.message || error);
      if (typeof ctx.react === "function") await ctx.react("❌");
      const errMsg = error.response?.data?.result?.error_message || error.response?.data?.error || error.message;
      ctx.reply(`❌ Terjadi kendala pada AI With No Restrictions: ${errMsg}`);
    }
  }
};