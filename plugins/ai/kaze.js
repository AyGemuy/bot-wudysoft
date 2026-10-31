import axios from "axios";
import db from "../../data/db.js";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/ai/kaze/v1`;
const SESSION_TIMEOUT = 25 * 60 * 1e3;
const CONFIG = {
  TIMEOUT: 12e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};

function initDB(jid = null, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.kaze) global.db.kaze = {};
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
    if (["session_id", "sess"].includes(key)) key = "session";
    if (["token_jwt", "jwt"].includes(key)) key = "token";
    if (["image", "img", "imageurl"].includes(key)) key = "media";
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
async function requestKazeAI(payload) {
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

function recordSessionMessage(chatId, messageId, returnedSession, returnedToken) {
  if (!messageId || !chatId) return;
  initDB();
  if (!global.db.kaze[chatId]) {
    global.db.kaze[chatId] = {
      session: returnedSession || null,
      token: returnedToken || null,
      msgIds: [],
      lastMsgId: null,
      updatedAt: Date.now(),
      expireTime: Date.now() + SESSION_TIMEOUT
    };
  }
  const s = global.db.kaze[chatId];
  if (returnedSession) s.session = returnedSession;
  if (returnedToken) s.token = returnedToken;
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
  name: "kaze",
  aliases: ["kazeai", "kzai"],
  description: "AI Multimodal Agent (Chat, Visual Generation & Video Creation via Kaze Engine).",
  category: "AI",
  limit: true,
  example: "kaze buatkan gambar pemandangan cyberpunk atau reply pesan bot untuk melanjutkan percakapan",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const chatId = ctx?.id || msg?.key?.remoteJid;
      if (!chatId) return;
      initDB();
      if (!global.db.kaze[chatId]) return;
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      const sessionData = global.db.kaze[chatId];
      if (Date.now() > sessionData.expireTime) {
        delete global.db.kaze[chatId];
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
        prompt: userText || (uploadedMediaUrl ? "Tolong proses media ini" : "Lanjutkan"),
        session: sessionData.session || null,
        token: sessionData.token || null,
        ...uploadedMediaUrl ? {
          media: uploadedMediaUrl
        } : {}
      };
      const data = await requestKazeAI(bodyPayload);
      if (!data || !data.status) {
        throw new Error(data?.result?.error || data?.error || "Gagal mendapatkan respon dari Kaze AI.");
      }
      const resResult = data.result || {};
      const answerText = (resResult.text_content || (typeof resResult === "string" ? resResult : "Respon berhasil diselesaikan.")).trim();
      const returnedSession = data.session || bodyPayload.session || "";
      const returnedToken = data.token || bodyPayload.token || "";
      const mediaList = resResult.media_urls || [];
      const bodyText = answerText;
      let sentMsg;
      if (mediaList.length > 0) {
        for (let i = 0; i < mediaList.length; i++) {
          const mediaUrl = mediaList[i];
          const isVideo = mediaUrl.endsWith(".mp4");
          const caption = i === 0 ? bodyText : "";
          if (isVideo) {
            sentMsg = await sock.sendMessage(ctx.id, {
              video: {
                url: mediaUrl
              },
              caption: caption.trim()
            }, {
              quoted: msg
            });
          } else {
            sentMsg = await sock.sendMessage(ctx.id, {
              image: {
                url: mediaUrl
              },
              caption: caption.trim()
            }, {
              quoted: msg
            });
          }
        }
      } else {
        const buttons = [{
          name: "cta_copy",
          display_text: "Salin Jawaban",
          copy_code: answerText
        }];
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
      }
      const newMsgId = sentMsg?.key?.id;
      if (newMsgId) {
        recordSessionMessage(chatId, newMsgId, returnedSession, returnedToken);
      }
      if (typeof ctx?.react === "function") await ctx.react("✨");
      return true;
    } catch (e) {
      console.error("[KAZE BEFORE ERROR]:", e.message);
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
        if (["kaze", "kazeai", "kzai"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (["--reset", "--clear", "reset", "clear"].includes(rawText.toLowerCase())) {
        if (global.db.kaze[chatId]) {
          delete global.db.kaze[chatId];
          saveDB();
          return ctx.reply("🧹 *Sesi percakapan Kaze AI berhasil direset!* Topik baru dimulai.");
        }
        return ctx.reply("ℹ️ Tidak ada sesi aktif Kaze AI di room chat ini.");
      }
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      if (!rawText && !isMedia) {
        const guideText = `–  *K A Z E  A I*

Agen asisten cerdas multimodal (Text, Image Generation, Restyle Photo & Video).

┌  ◦  *Chat / Tanya Jawab* :
│  └ \`${prefix}kaze jelaskan sejarah singkat komputasi awan\`
│
├  ◦  *Generasi Visual / Video* :
│  └ \`${prefix}kaze buatkan gambar robot cyberpunk di tokyo\`
│
├  ◦  *Manipulasi Media (Vision/I2I)* :
│  └ Kirim / balas gambar: \`${prefix}kaze ubah foto ini menjadi lukisan cat minyak\`
│
├  ◦  *Multi-Turn Conversation* :
│  └ Cukup *reply pesan bot* untuk melanjutkan obrolan secara langsung.
│
└  ◦  *Override Flags* :
   ├ \`--reset\` (Hapus riwayat sesi)
   ├ \`--session <session_str>\`
   ├ \`--token <jwt_token>\`
   └ \`--media <url>\``;
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
      const existingSession = global.db.kaze[chatId];
      const sessionToUse = flags.session || existingSession?.session || null;
      const tokenToUse = flags.token || existingSession?.token || null;
      const bodyPayload = {
        prompt: flags.prompt || cleanPrompt || (uploadedMediaUrl ? "Jelaskan dan olah gambar ini" : "Halo"),
        session: sessionToUse,
        token: tokenToUse,
        ...uploadedMediaUrl ? {
          media: uploadedMediaUrl
        } : flags.media ? {
          media: flags.media
        } : {},
        ...flags
      };
      const data = await requestKazeAI(bodyPayload);
      if (!data || !data.status) {
        throw new Error(data?.result?.error || data?.error || "Gagal mendapatkan respon dari Kaze AI.");
      }
      const resResult = data.result || {};
      const answerText = (resResult.text_content || (typeof resResult === "string" ? resResult : "Respon berhasil diterima.")).trim();
      const returnedSession = data.session || bodyPayload.session || "";
      const returnedToken = data.token || bodyPayload.token || "";
      const mediaList = resResult.media_urls || [];
      const bodyText = answerText;
      let sentMsg;
      if (mediaList.length > 0) {
        for (let i = 0; i < mediaList.length; i++) {
          const mediaUrl = mediaList[i];
          const isVideo = mediaUrl.endsWith(".mp4");
          const caption = i === 0 ? bodyText : "";
          if (isVideo) {
            sentMsg = await sock.sendMessage(ctx.id, {
              video: {
                url: mediaUrl
              },
              caption: caption.trim()
            }, {
              quoted: quotedMsg
            });
          } else {
            sentMsg = await sock.sendMessage(ctx.id, {
              image: {
                url: mediaUrl
              },
              caption: caption.trim()
            }, {
              quoted: quotedMsg
            });
          }
        }
      } else {
        const buttons = [{
          name: "cta_copy",
          display_text: "Salin Jawaban",
          copy_code: answerText
        }];
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
      }
      const sentMsgId = sentMsg?.key?.id;
      if (sentMsgId) {
        recordSessionMessage(chatId, sentMsgId, returnedSession, returnedToken);
      }
      await ctx.react("✨");
    } catch (error) {
      console.error("[Kaze AI Error]:", error?.message || error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.result?.error || error.response?.data?.error || error.response?.data?.message || error.message;
      ctx.reply(`❌ Terjadi kendala pada Kaze AI: ${errMsg}`);
    }
  }
};