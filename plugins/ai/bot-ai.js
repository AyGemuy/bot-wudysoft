import db from "../../data/db.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const AI_BOT_CONFIG = {
  revoply: {
    name: "RevoplyAI",
    jid: "491741542225@s.whatsapp.net",
    description: "Smart AI-powered chatbot system"
  },
  shmooz: {
    name: "Shmooz AI",
    jid: "12014166644@s.whatsapp.net",
    description: "Personal AI Assistant di WhatsApp"
  },
  guidegeek: {
    name: "GuideGeek",
    jid: "12058922070@s.whatsapp.net",
    description: "Personal AI Travel Assistant"
  },
  mobilegpt: {
    name: "MobileGPT",
    jid: "27767346284@s.whatsapp.net",
    description: "AI Assistant powered by ChatGPT technology"
  }
};
const DEFAULT_BOT_KEY = "revoply";
const SESSION_TIMEOUT = 30 * 60 * 1e3;
const RESPONSE_TIMEOUT = 90 * 1e3;
const FORWARD_DELAY_MIN = 300;
const FORWARD_DELAY_MAX = 800;
const FORWARDING_SCORE = false;

function initDB(jid = null, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.aiBot) global.db.aiBot = {};
  if (jid && !global.db.user[jid]) {
    global.db.user[jid] = {
      name: name || "",
      aiBotSelected: null,
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

function getBotList() {
  return Object.entries(AI_BOT_CONFIG).map(([key, val]) => ({
    key: key,
    ...val
  }));
}

function findBotByKey(key = "") {
  const k = String(key).toLowerCase().trim();
  if (AI_BOT_CONFIG[k]) return {
    key: k,
    ...AI_BOT_CONFIG[k]
  };
  return null;
}

function normJid(jid = "") {
  return String(jid).split(":")[0].split("@")[0].replace(/[^0-9]/g, "");
}

function findBotByJid(jid = "") {
  const clean = normJid(jid);
  if (!clean) return null;
  for (const [key, val] of Object.entries(AI_BOT_CONFIG)) {
    if (normJid(val.jid) === clean) return {
      key: key,
      ...val
    };
  }
  return null;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function autoDetectBot(senderId, chatId) {
  initDB(senderId);
  const userSelected = global.db.user?.[senderId]?.aiBotSelected;
  if (userSelected) {
    const bot = findBotByKey(userSelected);
    if (bot) return bot;
  }
  const chatSession = global.db.aiBot?.[chatId];
  if (chatSession?.botKey) {
    const bot = findBotByKey(chatSession.botKey);
    if (bot) return bot;
  }
  const defBot = findBotByKey(DEFAULT_BOT_KEY);
  if (defBot) return defBot;
  const list = getBotList();
  return list[0] || null;
}
async function doCopyNForward(sock, targetJid, msg, quoted) {
  if (typeof sock.copyNForward === "function") {
    return await sock.copyNForward(targetJid, msg, FORWARDING_SCORE, {}, quoted);
  }
  try {
    return await sock.sendMessage(targetJid, {
      forward: msg,
      forwardingScore: 0
    }, {
      quoted: quoted
    });
  } catch {
    return await sock.sendMessage(targetJid, {
      forward: msg
    }, {
      quoted: quoted
    });
  }
}
async function forwardToOrigin(sock, session, msg) {
  const originJid = session.originChat;
  const quoted = session.lastUserMsg || undefined;
  return await doCopyNForward(sock, originJid, msg, quoted);
}
export default {
  name: "aibot",
  aliases: ["botai", "aichat", "botchat"],
  description: "Chat dengan AI Bot lain di WhatsApp (Bot-to-Bot) via full copy n forward. Auto-detect bot.",
  category: "AI",
  limit: true,
  example: "aibot Halo, siapa kamu?\naibot --bot shmooz\naibot --bot shmooz Halo!\naibot --reset",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const chatId = ctx?.id || msg?.key?.remoteJid;
      if (!chatId) return;
      initDB();
      const candidates = [ctx?.sender, ctx?.senderAlt, ctx?.userPhoneJid, ctx?.senderNumber].filter(Boolean);
      let senderBot = null;
      for (const c of candidates) {
        senderBot = findBotByJid(c);
        if (senderBot) break;
      }
      if (!senderBot) return;
      const allSessions = global.db.aiBot || {};
      const matchedList = [];
      for (const [sessionChatId, session] of Object.entries(allSessions)) {
        if (!session?.botKey) continue;
        if (session.botKey !== senderBot.key) continue;
        if (Date.now() > (session.expireTime || 0)) continue;
        if (!session.awaitingResponse) continue;
        if (normJid(session.botJid) !== normJid(senderBot.jid)) continue;
        matchedList.push({
          sessionChatId: sessionChatId,
          session: session
        });
      }
      if (!matchedList.length) return;
      if (typeof ctx?.react === "function") await ctx.react("🤖");
      const botMsgTs = Number(msg?.messageTimestamp || ctx?.messageTimestamp || Math.floor(Date.now() / 1e3));
      const botMsgId = msg?.key?.id || null;
      for (const {
          session
        }
        of matchedList) {
        try {
          if (!Array.isArray(session.forwardedIds)) session.forwardedIds = [];
          if (botMsgId && session.forwardedIds.includes(botMsgId)) continue;
          const since = Number(session.awaitingSince || 0);
          if (since && botMsgTs * 1e3 + 2e3 < since) continue;
          await sleep(FORWARD_DELAY_MIN + Math.random() * (FORWARD_DELAY_MAX - FORWARD_DELAY_MIN));
          await forwardToOrigin(sock, session, msg);
          if (botMsgId) {
            session.forwardedIds.push(botMsgId);
            if (session.forwardedIds.length > 50) session.forwardedIds = session.forwardedIds.slice(-50);
          }
          session.lastBotMsgId = botMsgId;
          session.lastBotAt = Date.now();
          session.updatedAt = Date.now();
          session.expireTime = Date.now() + SESSION_TIMEOUT;
          saveDB();
        } catch (fwdErr) {
          console.error("[AIBOT FORWARD ERROR]:", fwdErr?.message || fwdErr);
        }
      }
      if (typeof ctx?.react === "function") await ctx.react("✅");
      return true;
    } catch (e) {
      console.error("[AIBOT BEFORE ERROR]:", e.message);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      const chatId = ctx.id;
      const isGroup = Boolean(ctx.isGroup || ctx.group);
      const senderId = ctx.sender || ctx.userPhoneJid || ctx.author || msg.key?.participant || msg.key?.remoteJid || ctx.id;
      initDB(senderId, ctx.pushName);
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["aibot", "botai", "aichat", "botchat"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (["--reset", "--clear", "reset", "clear"].includes(rawText)) {
        if (global.db.aiBot?.[chatId]) {
          delete global.db.aiBot[chatId];
          saveDB();
          return ctx.reply("🧹 *Sesi AI Bot berhasil direset!*");
        }
        return ctx.reply("ℹ️ Tidak ada sesi AI Bot yang aktif di percakapan ini.");
      }
      const setMatch = rawText.match(/^--(?:bot|set)\s+(\S+)\s*([\s\S]*)$/i);
      let forcedBot = null;
      if (setMatch) {
        const bot = findBotByKey(setMatch[1]);
        if (!bot) {
          return ctx.reply(`❌ Bot tidak ditemukan. Tersedia: ${getBotList().map(b => b.key).join(", ")}`);
        }
        forcedBot = bot;
        rawText = (setMatch[2] || "").trim();
        if (global.db.user[senderId]) global.db.user[senderId].aiBotSelected = bot.key;
        if (!global.db.aiBot[chatId]) global.db.aiBot[chatId] = {};
        const sess = global.db.aiBot[chatId];
        sess.botKey = bot.key;
        sess.botJid = bot.jid;
        sess.botName = bot.name;
        sess.originChat = chatId;
        sess.isGroup = isGroup;
        sess.requester = senderId;
        sess.requesterParticipant = isGroup ? senderId : null;
        sess.awaitingResponse = false;
        sess.forwardedIds = [];
        sess.updatedAt = Date.now();
        sess.expireTime = Date.now() + SESSION_TIMEOUT;
        saveDB();
        await ctx.react("✅");
        const setInfoText = `–  *A I  B O T*\n\n┌  ◦  *Bot Aktif* : ${bot.name}\n├  ◦  *JID* : \`${bot.jid.split("@")[0]}\`\n└  ◦  *Deskripsi* : ${bot.description}\n\n_Ketik \`${prefix}aibot <pesan>\` untuk mulai mengobrol._`;
        await ctx.reply(setInfoText, {
          quoted: quotedMsg
        });
        if (!rawText) return;
      }
      const targetBot = forcedBot || autoDetectBot(senderId, chatId);
      if (!targetBot) {
        return ctx.reply("❌ Tidak ada AI bot yang tersedia saat ini.");
      }
      if (!rawText || rawText === "--list" || rawText === "--menu" || rawText === "menu") {
        const bots = getBotList();
        const rows = bots.map((b, idx) => ({
          title: `${idx + 1}. ${b.name}`.slice(0, 24),
          id: `${prefix}aibot --bot ${b.key} Halo!`,
          description: `${b.description.slice(0, 48)} • ${b.jid.split("@")[0]}`.slice(0, 60)
        }));
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "PILIH AI BOT",
            sections: [{
              title: "AIBOT ROSTER",
              rows: rows
            }]
          })
        }];
        const bodyText = `–  *A I  B O T  C H A T*

┌  ◦  *Bot Default* : ${targetBot.name}
├  ◦  *Total Bot* : ${bots.length}
└  ◦  *Mode* : Full Copy & Forward

_Langsung kirim pesan \`${prefix}aibot <pesan>\` untuk chat otomatis._
_Ganti bot: \`${prefix}aibot --bot <key> <pesan>\`_`;
        const options = {
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 1,
              divider_indices: [1],
              list_title: "AI Bot • Characters",
              button_title: "Buka Daftar Bot"
            }
          },
          quoted: quotedMsg
        };
        if (typeof ctx.sendCta === "function") {
          await ctx.sendCta(bodyText, "", buttons, options);
        } else {
          let fallback = `${bodyText}\n\n` + rows.map(r => `• *${r.title}*\n  ${r.description}\n  \`${r.id}\``).join("\n\n");
          await ctx.reply(fallback);
        }
        return;
      }
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      if (!rawText && !isMedia) {
        return ctx.reply(`ℹ️ Kirim pesan, contoh:\n\`${prefix}aibot Halo, siapa kamu?\``);
      }
      await ctx.react("💭");
      if (!global.db.aiBot[chatId]) global.db.aiBot[chatId] = {};
      const session = global.db.aiBot[chatId];
      session.botKey = targetBot.key;
      session.botJid = targetBot.jid;
      session.botName = targetBot.name;
      session.originChat = chatId;
      session.isGroup = isGroup;
      session.requester = senderId;
      session.requesterParticipant = isGroup ? senderId : null;
      session.lastUserMsg = msg;
      session.awaitingResponse = true;
      session.awaitingSince = Date.now();
      session.forwardedIds = [];
      session.updatedAt = Date.now();
      session.expireTime = Date.now() + SESSION_TIMEOUT;
      saveDB();
      const botJid = targetBot.jid;
      const promptText = rawText || (isMedia ? "Tolong tanggapi media ini." : "Halo");
      if (isMedia && typeof ctx.download === "function") {
        const buffer = await ctx.download();
        if (buffer && Buffer.isBuffer(buffer)) {
          const mime = ctx.mimetype || ctx.quoted?.mimetype || "";
          if (mime.startsWith("image/")) {
            await sock.sendMessage(botJid, {
              image: buffer,
              caption: promptText
            });
          } else if (mime.startsWith("video/")) {
            await sock.sendMessage(botJid, {
              video: buffer,
              caption: promptText
            });
          } else if (mime.startsWith("audio/")) {
            await sock.sendMessage(botJid, {
              audio: buffer,
              mimetype: mime,
              ptt: false
            });
            if (promptText) await sock.sendMessage(botJid, {
              text: promptText
            });
          } else {
            await sock.sendMessage(botJid, {
              document: buffer,
              mimetype: mime || "application/octet-stream",
              fileName: ctx.fileName || "file",
              caption: promptText
            });
          }
        } else {
          await sock.sendMessage(botJid, {
            text: promptText
          });
        }
      } else {
        await sock.sendMessage(botJid, {
          text: promptText
        });
      }
      await ctx.react("📨");
      const sessionKey = chatId;
      const startedAt = session.awaitingSince;
      setTimeout(() => {
        try {
          const s = global.db.aiBot?.[sessionKey];
          if (s && s.awaitingResponse && s.awaitingSince === startedAt) {
            s.awaitingResponse = false;
            s.updatedAt = Date.now();
            saveDB();
          }
        } catch (_) {}
      }, RESPONSE_TIMEOUT);
    } catch (error) {
      console.error("[AIBOT ERROR]:", error?.message || error);
      await ctx.react("❌");
      ctx.reply(`❌ Terjadi kendala: ${error.message || "Gagal memproses permintaan."}`);
    }
  }
};