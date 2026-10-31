import axios from "axios";
import db from "../../data/db.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_BASE = `${global.bot?.api?.wudysoft}/api/ai/nsfwaichat`;
const SESSION_TIMEOUT = 25 * 60 * 1e3;
const formatTemplate = (text, userName, charName) => {
  if (!text || typeof text !== "string") return text;
  return text.replace(/\{\{user\}\}/gi, userName).replace(/\{\{char\}\}/gi, charName).replace(/<USER>/gi, userName).replace(/<CHAR>/gi, charName);
};

function initDB(jid = null, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.nsfwAiChat) global.db.nsfwAiChat = {};
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

function recordSessionMessage(chatId, messageId, botId) {
  if (!messageId || !chatId) return;
  initDB();
  if (!global.db.nsfwAiChat[chatId]) {
    global.db.nsfwAiChat[chatId] = {
      botId: botId || null,
      msgIds: [],
      lastMsgId: null,
      updatedAt: Date.now(),
      expireTime: Date.now() + SESSION_TIMEOUT
    };
  }
  const s = global.db.nsfwAiChat[chatId];
  if (botId) s.botId = botId;
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
  name: "nsfwaichat",
  aliases: ["nsfwaichat"],
  description: "Chat & Roleplay AI Karakter dengan format flag gampang (DB Session Support).",
  category: "AI",
  limit: true,
  example: "• Cari: `nsfwaichat --search subaru`\n• Detail: `nsfwaichat --detail <id>`\n• Chat: `nsfwaichat Halo apa kabar? --id <id>` (atau cukup reply pesan bot)",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const chatId = ctx?.id || msg?.key?.remoteJid;
      if (!chatId) return;
      initDB();
      if (!global.db.nsfwAiChat[chatId]) return;
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      const sessionData = global.db.nsfwAiChat[chatId];
      if (Date.now() > sessionData.expireTime) {
        delete global.db.nsfwAiChat[chatId];
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
      const userName = ctx.pushName || ctx.sender?.split("@")[0] || "User";
      const botId = sessionData.botId;
      if (!botId) return;
      const {
        data: chatRes
      } = await axios.get(API_BASE, {
        params: {
          action: "chat",
          id: botId,
          prompt: userText
        },
        timeout: 6e4
      });
      if (!chatRes || !chatRes.status || !chatRes.result) {
        throw new Error(chatRes?.message || "Karakter tidak merespon.");
      }
      const rawReply = chatRes.result?.text || "*(Karakter tidak merespon)*";
      const charName = chatRes.result?.bot_detail?.name || "AI Character";
      const avatarUrl = chatRes.result?.bot_detail?.avatar_url;
      const cleanReply = formatTemplate(rawReply, userName, charName).trim();
      const bodyText = cleanReply;
      const buttons = [{
        name: "cta_copy",
        display_text: "Salin Jawaban",
        copy_code: cleanReply
      }];
      let sentMsg;
      if (typeof ctx.sendCta === "function") {
        sentMsg = await ctx.sendCta(bodyText, "", buttons, {
          media: avatarUrl || null,
          quoted: msg
        });
      } else if (avatarUrl) {
        sentMsg = await sock.sendMessage(ctx.id, {
          image: {
            url: avatarUrl
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
        recordSessionMessage(chatId, newMsgId, botId);
      }
      if (typeof ctx?.react === "function") await ctx.react("✨");
      return true;
    } catch (e) {
      console.error("[NSFWAICHAT BEFORE ERROR]:", e.message);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      const chatId = ctx.id;
      initDB();
      const userName = ctx.pushName || ctx.sender?.split("@")[0] || "User";
      let text = ctx.args?.join(" ")?.trim() || "";
      if (!text && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (firstWord.endsWith("nsfwaichat")) {
          text = raw.slice(firstWord.length).trim();
        }
      }
      const quotedText = ctx.quoted?.text || ctx.quoted?.caption || "";
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (text === "--reset" || text === "--clear" || text === "reset" || text === "clear") {
        if (global.db.nsfwAiChat[chatId]) {
          delete global.db.nsfwAiChat[chatId];
          saveDB();
          return ctx.reply("🧹 *Sesi obrolan karakter berhasil direset!*");
        }
        return ctx.reply("ℹ️ Tidak ada sesi karakter yang sedang aktif.");
      }
      if (!text) {
        return ctx.reply(`🎭 *NSFW AI CHARACTER CHAT*\n\n` + `*1️⃣ Cari Karakter:* \n` + `  └ \`${prefix}nsfwaichat --search <nama_karakter>\`\n` + `  └ Contoh: \`${prefix}nsfwaichat --search subaru\`\n\n` + `*2️⃣ Lihat Detail Karakter:* \n` + `  └ \`${prefix}nsfwaichat --detail <id_karakter>\`\n\n` + `*3️⃣ Chat / Roleplay:*\n` + `  └ \`${prefix}nsfwaichat <pesan_kamu> --id <id_karakter>\`\n` + `  └ *Tips Praktis:* Cukup balas/reply pesan karakter untuk melanjutkan obrolan!`);
      }
      await ctx.react("⏳");
      let searchQuery = "";
      let detailId = "";
      let botId = "";
      let page = 1;
      let prompt = text;
      const searchMatch = prompt.match(/--(?:search|s)\s+([^--]+)/i);
      if (searchMatch) {
        searchQuery = searchMatch[1].trim();
        prompt = prompt.replace(searchMatch[0], "").trim();
      }
      const detailMatch = prompt.match(/--(?:detail|d)\s+([^\s]+)/i);
      if (detailMatch) {
        detailId = detailMatch[1].trim();
        prompt = prompt.replace(detailMatch[0], "").trim();
      }
      const idMatch = prompt.match(/--(?:id|char|bot)\s+([^\s]+)/i);
      if (idMatch) {
        botId = idMatch[1].trim();
        prompt = prompt.replace(idMatch[0], "").trim();
      }
      const pageMatch = prompt.match(/--(?:page|p)\s+(\d+)/i);
      if (pageMatch) {
        page = parseInt(pageMatch[1]) || 1;
        prompt = prompt.replace(pageMatch[0], "").trim();
      }
      if (!botId) {
        const existingSession = global.db.nsfwAiChat[chatId];
        if (existingSession?.botId) {
          botId = existingSession.botId;
        } else if (quotedText) {
          const idFromQuoted = quotedText.match(/🆔 (?:ID|Bot ID):\s*`([a-f0-9-]+)`/i) || quotedText.match(/--id\s+([a-f0-9-]+)/i) || quotedText.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
          if (idFromQuoted) {
            botId = idFromQuoted[1];
          }
        }
      }
      if (detailId) {
        const {
          data
        } = await axios.get(API_BASE, {
          params: {
            action: "detail",
            id: detailId
          },
          timeout: 3e4
        });
        if (!data || !data.status || !data.result) {
          await ctx.react("❌");
          return ctx.reply("❌ Gagal mengambil detail karakter. Pastikan ID valid.");
        }
        const bot = data.result;
        const charName = bot.name || "Character";
        const desc = formatTemplate(bot.description, userName, charName);
        const personality = formatTemplate(bot.personality, userName, charName);
        const firstMsg = formatTemplate(bot.first_message, userName, charName);
        let detailText = `👤 *PROFIL KARAKTER: ${charName.toUpperCase()}*\n\n`;
        detailText += `🆔 *ID:* \`${bot.id}\`\n`;
        detailText += `👤 *Creator:* ${bot.creator_name || "-"}\n`;
        if (desc) detailText += `📝 *Deskripsi:*\n${desc}\n\n`;
        if (personality) detailText += `🎭 *Kepribadian:*\n${personality.slice(0, 450)}...\n\n`;
        if (firstMsg) detailText += `💬 *Pesan Pembuka:*\n_${firstMsg.slice(0, 350)}_\n\n`;
        detailText += `👉 *Mulai Chat:* \`${prefix}nsfwaichat Halo! --id ${bot.id}\``;
        if (bot.avatar_url) {
          await sock.sendMessage(ctx.id, {
            image: {
              url: bot.avatar_url
            },
            caption: detailText.trim()
          }, {
            quoted: quotedMsg
          });
        } else {
          await sock.sendMessage(ctx.id, {
            text: detailText.trim()
          }, {
            quoted: quotedMsg
          });
        }
        await ctx.react("✅");
        return;
      }
      if (searchQuery || !botId && prompt) {
        const query = searchQuery || prompt;
        const {
          data
        } = await axios.get(API_BASE, {
          params: {
            action: "search",
            query: query,
            page: page
          },
          timeout: 3e4
        });
        if (!data || !data.status || !Array.isArray(data.result) || data.result.length === 0) {
          await ctx.react("❌");
          return ctx.reply(`❌ Tidak ditemukan karakter dengan kata kunci: *${query}*`);
        }
        let searchList = `🔍 *HASIL PENCARIAN (${query})*\n\n`;
        data.result.slice(0, 10).forEach((bot, i) => {
          const tags = bot.tags?.map(t => t.name).join(", ") || "-";
          const desc = formatTemplate(bot.description, userName, bot.name);
          searchList += `*${i + 1}. ${bot.name}*\n`;
          searchList += `🆔 *ID:* \`${bot.id}\`\n`;
          searchList += `🏷️ *Tags:* ${tags}\n`;
          if (desc) {
            searchList += `📝 *Desc:* ${desc.slice(0, 90).replace(/\n/g, " ")}...\n`;
          }
          searchList += `\n`;
        });
        searchList += `👉 *Cara Chat:* \`${prefix}nsfwaichat <pesan> --id <id_karakter>\`\n`;
        searchList += `👉 *Cara Lihat Profil:* \`${prefix}nsfwaichat --detail <id_karakter>\``;
        await sock.sendMessage(ctx.id, {
          text: searchList.trim()
        }, {
          quoted: quotedMsg
        });
        await ctx.react("✅");
        return;
      }
      if (!botId) {
        await ctx.react("❌");
        return ctx.reply(`❌ Masukkan ID karakter atau balas pesan karakter!\n\n` + `👉 *Format:* \`${prefix}nsfwaichat <pesan_kamu> --id <id_karakter>\`\n` + `👉 *Cari ID:* \`${prefix}nsfwaichat --search <nama>\``);
      }
      const {
        data: chatRes
      } = await axios.get(API_BASE, {
        params: {
          action: "chat",
          id: botId,
          prompt: prompt || "Hello"
        },
        timeout: 6e4
      });
      if (!chatRes || !chatRes.status || !chatRes.result) {
        await ctx.react("❌");
        return ctx.reply(`❌ Gagal mendapatkan balasan chat: ${chatRes?.message || "Server error"}`);
      }
      const rawReply = chatRes.result?.text || "*(Karakter tidak merespon)*";
      const charName = chatRes.result?.bot_detail?.name || "AI Character";
      const avatarUrl = chatRes.result?.bot_detail?.avatar_url;
      const cleanReply = formatTemplate(rawReply, userName, charName).trim();
      const bodyText = cleanReply;
      const buttons = [{
        name: "cta_copy",
        display_text: "Salin Jawaban",
        copy_code: cleanReply
      }];
      let sentMsg;
      if (typeof ctx.sendCta === "function") {
        sentMsg = await ctx.sendCta(bodyText, "", buttons, {
          media: avatarUrl || null,
          quoted: quotedMsg
        });
      } else if (avatarUrl) {
        sentMsg = await sock.sendMessage(ctx.id, {
          image: {
            url: avatarUrl
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
        recordSessionMessage(chatId, sentMsgId, botId);
      }
      await ctx.react("✨");
    } catch (error) {
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ NSFW AI Chat Error: ${errMsg}`);
    }
  }
};