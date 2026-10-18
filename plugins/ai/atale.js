import axios from "axios";
import db from "../../data/db.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/ai/atale`;
const SESSION_TIMEOUT = 20 * 60 * 1e3;
const CONFIG = {
  TIMEOUT: 9e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};

function initDB(jid = null, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.atale) global.db.atale = {};
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
    if (["session_id", "sess"].includes(key)) key = "sessionid";
    if (["bot_id", "botid", "bot"].includes(key)) key = "botid";
    if (["image", "img"].includes(key)) key = "media";
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
async function requestATale(payload) {
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
  if (!global.db.atale[chatId]) {
    global.db.atale[chatId] = {
      botId: null,
      sessionId: null,
      state: null,
      msgIds: [],
      lastMsgId: null,
      updatedAt: Date.now(),
      expireTime: Date.now() + SESSION_TIMEOUT
    };
  }
  const s = global.db.atale[chatId];
  if (sessionData.botId !== undefined) s.botId = sessionData.botId;
  if (sessionData.sessionId !== undefined) s.sessionId = sessionData.sessionId;
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
  name: "atale",
  aliases: ["atale-ai", "ataleai"],
  description: "AI Character Chat & Search via ATale Engine (Full DB Session Reply).",
  category: "AI",
  limit: true,
  example: "• Cari: atale search Aizawa\n• Chat: atale Halo --botid 161594",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const chatId = ctx?.id || msg?.key?.remoteJid;
      if (!chatId) return;
      initDB();
      if (!global.db.atale[chatId]) return;
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      const sessionData = global.db.atale[chatId];
      if (Date.now() > sessionData.expireTime) {
        delete global.db.atale[chatId];
        saveDB();
        return;
      }
      const quotedStanzaId = ctx?.quoted?.id || msg?.message?.extendedTextMessage?.contextInfo?.stanzaId;
      const isQuotingAi = quotedStanzaId && (quotedStanzaId === sessionData.lastMsgId || Array.isArray(sessionData.msgIds) && sessionData.msgIds.includes(quotedStanzaId));
      if (!isQuotingAi) return;
      const userText = (ctx?.text || ctx?.query || msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "").trim();
      const prefixList = [".", "#", "!", "/", ctx?.prefix].filter(Boolean);
      if (prefixList.some(p => userText.startsWith(p))) return;
      if (!userText) return;
      if (typeof ctx?.react === "function") await ctx.react("💭");
      const bodyPayload = {
        action: "chat",
        prompt: userText || "Lanjutkan",
        botId: sessionData.botId,
        sessionId: sessionData.sessionId || null,
        state: sessionData.state || null
      };
      const data = await requestATale(bodyPayload);
      if (!data || !data.status || !data.result) {
        throw new Error(data?.message || "Gagal mendapatkan respon dari ATale.");
      }
      const answerText = (data.result || "Tidak ada respon.").trim();
      const returnedSessionId = data.chunks?.[0]?.sessionId || bodyPayload.sessionId || "";
      const returnedState = data.state || bodyPayload.state || "";
      const bodyText = answerText;
      const buttons = [{
        name: "cta_copy",
        display_text: "📄 Salin Jawaban",
        copy_code: answerText
      }];
      let sentMsg;
      if (typeof ctx.sendCta === "function") {
        sentMsg = await ctx.sendCta(bodyText, "", buttons, {
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
          botId: bodyPayload.botId,
          sessionId: returnedSessionId,
          state: returnedState
        });
      }
      if (typeof ctx?.react === "function") await ctx.react("✨");
      return true;
    } catch (e) {
      console.error("[ATALE BEFORE ERROR]:", e.message);
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
        if (["atale", "atale-ai", "ataleai"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (rawText === "--reset" || rawText === "--clear" || rawText === "reset" || rawText === "clear") {
        if (global.db.atale[chatId]) {
          delete global.db.atale[chatId];
          saveDB();
          return ctx.reply("🧹 *Sesi obrolan karakter ATale berhasil direset!* Anda dapat memulai percakapan baru.");
        }
        return ctx.reply("ℹ️ Tidak ada sesi karakter ATale yang aktif di chat ini.");
      }
      if (!rawText) {
        const guideText = `–  *A T A L E  C H A R A C T E R*

Layanan percakapan karakter fiksi bertenaga AI dengan memori percakapan berlanjut (Multi-Turn Session).

┌  ◦  *Cari Karakter* :
│  └ \`${prefix}atale search Aizawa\`
│
├  ◦  *Karakter Beranda (Home)* :
│  └ \`${prefix}atale home\`
│
├  ◦  *Mulai Chat dengan Karakter* :
│  └ \`${prefix}atale Halo! --botid 161594\`
│
├  ◦  *Sesi Berkelanjutan* :
│  └ Cukup *reply pesan bot* untuk melanjutkan obrolan secara langsung!
│
└  ◦  *Parameter Flag Tambahan* :
   ├ \`--reset\` (Hapus sesi karakter aktif)
   ├ \`--botid <id_karakter>\`
   └ \`--sessionid <session_id>\``;
        return ctx.reply(guideText, {
          quoted: quotedMsg
        });
      }
      await ctx.react("💭");
      const [command, ...args] = rawText.split(/\s+/);
      const isSearch = command.toLowerCase() === "search";
      const isHome = command.toLowerCase() === "home";
      if (isSearch || isHome) {
        const payload = isSearch ? {
          action: "search",
          query: args.join(" ") || ""
        } : {
          action: "home"
        };
        const data = await requestATale(payload);
        if (!data || !data.status || !data.result || !Array.isArray(data.result)) {
          throw new Error("Gagal mengambil data karakter dari ATale.");
        }
        if (data.result.length === 0) {
          return ctx.reply("❌ Tidak ditemukan karakter untuk pencarian tersebut.");
        }
        let txt = `–  *A T A L E  ${isSearch ? "S E A R C H" : "H O M E"}*\n\n`;
        const limitRes = data.result.slice(0, 7);
        limitRes.forEach((bot, i) => {
          txt += `┌  ◦  *${i + 1}. ${bot.displayName}*\n`;
          txt += `│  ◦  *ID* : \`${bot.id}\`\n`;
          txt += `│  ◦  *Tags* : ${bot.tags || "-"}\n`;
          txt += `└  ◦  *Intro* : ${bot.description ? bot.description.slice(0, 90).replace(/\n/g, " ") + "..." : "-"}\n\n`;
        });
        txt += `Ketik: \`${prefix}atale <pesan> --botid <ID>\` untuk memulai chat.`;
        if (limitRes[0]?.avatar) {
          return sock.sendMessage(ctx.id, {
            image: {
              url: limitRes[0].avatar
            },
            caption: txt.trim()
          }, {
            quoted: quotedMsg
          });
        } else {
          return ctx.reply(txt.trim());
        }
      }
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      const existingSession = global.db.atale[chatId];
      const botId = flags.botid || flags.bot || flags.bot_id || existingSession?.botId;
      if (!botId) {
        return ctx.reply(`❌ Harap sertakan ID Karakter!\nContoh: \`${prefix}atale Hai --botid 161594\``);
      }
      const sessionIdToUse = flags.sessionid || existingSession?.sessionId || null;
      const stateToUse = flags.state || existingSession?.state || null;
      const bodyPayload = {
        action: "chat",
        prompt: cleanPrompt || "Halo",
        botId: parseInt(botId),
        sessionId: sessionIdToUse,
        state: stateToUse
      };
      const data = await requestATale(bodyPayload);
      if (!data || !data.status || !data.result) {
        throw new Error(data?.message || "Gagal mendapatkan respon chat dari ATale.");
      }
      const answerText = (data.result || "Tidak ada respon.").trim();
      const returnedSessionId = data.chunks?.[0]?.sessionId || bodyPayload.sessionId || "";
      const returnedState = data.state || bodyPayload.state || "";
      const bodyText = answerText;
      let nextCommand = `${prefix}atale <pesan> --botid ${bodyPayload.botId}`;
      if (returnedSessionId) nextCommand += ` --sessionid ${returnedSessionId}`;
      const buttons = [{
        name: "cta_copy",
        display_text: "📋 Salin Format Lanjut",
        copy_code: nextCommand
      }, {
        name: "cta_copy",
        display_text: "📄 Salin Jawaban",
        copy_code: answerText
      }];
      let sentMsg;
      if (typeof ctx.sendCta === "function") {
        sentMsg = await ctx.sendCta(bodyText, "", buttons, {
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
          botId: bodyPayload.botId,
          sessionId: returnedSessionId,
          state: returnedState
        });
      }
      await ctx.react("✨");
    } catch (error) {
      console.error("[ATale Error]:", error?.message || error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Terjadi kendala pada ATale: ${errMsg}`);
    }
  }
};