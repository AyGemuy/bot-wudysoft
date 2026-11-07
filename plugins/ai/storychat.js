import axios from "axios";
import db from "../../data/db.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/ai/storychat`;
const SESSION_TIMEOUT = 30 * 60 * 1e3;
const CONFIG = {
  TIMEOUT: 9e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};

function initDB(jid = null, name = "") {
  try {
    if (!global.db) global.db = {};
    if (!global.db.user) global.db.user = {};
    if (!global.db.storychat) global.db.storychat = {};
    if (jid && !global.db.user[jid]) {
      global.db.user[jid] = {
        name: name || "",
        money: 1e4,
        exp: 0
      };
    }
  } catch (err) {
    console.error("[StoryChat initDB Error]:", err?.message || err);
  }
}

function saveDB() {
  try {
    if (typeof db?.write === "function" && global.db) {
      db.write(global.db);
    }
  } catch (err) {
    console.error("[StoryChat saveDB Error]:", err?.message || err);
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
      if (["c", "char", "char_id", "character_id"].includes(key)) key = "id";
      if (["q", "find"].includes(key)) key = "search";
      if (["trend", "top", "popular"].includes(key)) key = "trending";
      if (["restart", "reset", "clear"].includes(key)) key = "reset";
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
    console.error("[StoryChat parseFlags Error]:", err?.message || err);
    return {
      flags: {},
      cleanPrompt: input
    };
  }
}
async function requestStoryChatAPI(payload = {}) {
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
    console.error("[StoryChat requestStoryChatAPI Error]:", err?.message || err);
    throw err;
  }
}

function recordSession(chatId, messageId, charId, charName, messages = [], avatarUrl = null) {
  try {
    if (!messageId || !chatId) return;
    initDB();
    if (!global.db.storychat[chatId]) {
      global.db.storychat[chatId] = {
        charId: charId || null,
        charName: charName || "Immersive Storyteller",
        avatarUrl: avatarUrl || null,
        messages: [],
        msgIds: [],
        lastMsgId: null,
        updatedAt: Date.now(),
        expireTime: Date.now() + SESSION_TIMEOUT
      };
    }
    const s = global.db.storychat[chatId];
    if (charId) s.charId = charId;
    if (charName) s.charName = charName;
    if (avatarUrl) s.avatarUrl = avatarUrl;
    if (Array.isArray(messages) && messages.length > 0) {
      s.messages = messages;
    }
    if (!Array.isArray(s.msgIds)) s.msgIds = [];
    if (!s.msgIds.includes(messageId)) {
      s.msgIds.push(messageId);
    }
    s.lastMsgId = messageId;
    s.updatedAt = Date.now();
    s.expireTime = Date.now() + SESSION_TIMEOUT;
    saveDB();
  } catch (err) {
    console.error("[StoryChat recordSession Error]:", err?.message || err);
  }
}
export default {
  name: "storychat",
  aliases: ["stchat", "storyai", "scai"],
  description: "AI Immersive Storytelling & Roleplay Chat (Trending, Search, & Multi-Turn Chat)",
  category: "AI",
  limit: true,
  example: "storychat halo atau storychat --trending atau reply bot untuk lanjut cerita",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const chatId = ctx?.id || msg?.key?.remoteJid;
      if (!chatId) return;
      initDB();
      if (!global.db.storychat[chatId]) return;
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      const sessionData = global.db.storychat[chatId];
      if (Date.now() > sessionData.expireTime) {
        delete global.db.storychat[chatId];
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
      if (typeof ctx?.react === "function") await ctx.react("📖");
      const userName = ctx.pushname || (ctx.sender ? ctx.sender.split("@")[0] : "User");
      const payload = {
        action: "chat",
        prompt: userText,
        id: sessionData.charId || undefined,
        user_name: userName,
        messages: Array.isArray(sessionData.messages) ? sessionData.messages : []
      };
      const res = await requestStoryChatAPI(payload);
      if (!res || !res.status) {
        throw new Error(res?.error || res?.result?.error || "Gagal melanjutkan roleplay cerita.");
      }
      const replyText = (res?.result?.reply || "The story continues in silence...").trim();
      const updatedMessages = res?.result?.messages || payload.messages;
      const characterDisplayName = sessionData.charName || "STORYTELLER";
      const bodyText = replyText;
      const buttons = [{
        name: "cta_copy",
        display_text: "Salin Cerita",
        copy_code: replyText
      }];
      let sentMsg;
      if (typeof ctx.sendCta === "function") {
        sentMsg = await ctx.sendCta(bodyText, `${characterDisplayName} • StoryChat AI`, buttons, {
          image: sessionData.avatarUrl || undefined,
          quoted: msg
        });
      } else {
        sentMsg = await sock.sendMessage(chatId, {
          image: sessionData.avatarUrl ? {
            url: sessionData.avatarUrl
          } : undefined,
          caption: bodyText
        }, {
          quoted: msg
        });
      }
      const newMsgId = sentMsg?.key?.id;
      if (newMsgId) {
        recordSession(chatId, newMsgId, sessionData.charId, sessionData.charName, updatedMessages, sessionData.avatarUrl);
      }
      if (typeof ctx?.react === "function") await ctx.react("✨");
      return true;
    } catch (e) {
      console.error("[STORYCHAT BEFORE ERROR]:", e?.message || e);
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
        if (["storychat", "stchat", "storyai", "scai"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const userName = ctx.pushname || (ctx.sender ? ctx.sender.split("@")[0] : "User");
      const botFooter = `${global.bot?.name || "StoryChat"} • Immersive AI`;
      if (["--reset", "--clear", "reset", "clear"].includes(rawText.toLowerCase())) {
        if (global.db.storychat[chatId]) {
          delete global.db.storychat[chatId];
          saveDB();
          return ctx.reply("🧹 *Sesi cerita StoryChat berhasil direset!* Alur cerita baru dapat dimulai.");
        }
        return ctx.reply("ℹ️ Tidak ada sesi aktif StoryChat di obrolan ini.");
      }
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      if (flags.trending || ["trending", "trend"].includes(rawText.toLowerCase())) {
        await ctx.react("🔥");
        const res = await requestStoryChatAPI({
          action: "trending",
          page: 1,
          limit: 10
        });
        const list = res?.result || [];
        if (!res?.status || !Array.isArray(list) || list.length === 0) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply("❌ Gagal memuat daftar karakter trending saat ini.");
        }
        const rows = list.map((c, idx) => {
          const charName = c?.character_name || c?.characterName || c?.name || "Karakter";
          const charId = c?._id || c?.id || "";
          const desc = c?.description || c?.greeting || "Karakter populer StoryChat";
          return {
            title: `[#${idx + 1}] ${charName.slice(0, 24)}`,
            id: `${prefix}storychat --id ${charId} Hello, let us begin our journey...`,
            description: desc.slice(0, 60)
          };
        });
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "🔥 PILIH KARAKTER TRENDING",
            sections: [{
              title: "10 KARAKTER TERPOPULER SAAT INI",
              rows: rows
            }]
          })
        }];
        const topChar = list[0];
        const topBanner = topChar?.avatar_url || topChar?.avatarUrl || global.bot?.media?.banner1 || null;
        const bodyText = `Hi ${userName}!\nBerikut adalah daftar karakter terpopuler di *StoryChat*.\n\nSilakan klik tombol *PILIH KARAKTER TRENDING* di bawah untuk langsung berinteraksi dengan karakter favoritmu:`;
        if (typeof ctx.sendCta === "function") {
          await ctx.sendCta(bodyText, botFooter, buttons, {
            image: topBanner,
            quoted: quotedMsg
          });
        } else {
          let fallbackText = `${bodyText}\n\n`;
          list.forEach((c, i) => {
            const name = c?.character_name || c?.characterName || "Karakter";
            const cid = c?._id || c?.id;
            fallbackText += `*${i + 1}. ${name}*\n↳ ID: \`${cid}\`\n\n`;
          });
          fallbackText += `Ketik: \`${prefix}storychat --id <ID> <pesan>\``;
          await ctx.reply(fallbackText, {
            quoted: quotedMsg
          });
        }
        if (typeof ctx.react === "function") await ctx.react("✅");
        return;
      }
      if (flags.search || rawText.toLowerCase().startsWith("search ")) {
        const querySearch = typeof flags.search === "string" ? flags.search : cleanPrompt.replace(/^search\s+/i, "");
        if (!querySearch) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply(`❌ Masukkan kata kunci pencarian karakter!\nContoh: \`${prefix}storychat --search demon\``);
        }
        await ctx.react("🔍");
        const res = await requestStoryChatAPI({
          action: "search",
          query: querySearch
        });
        const charactersList = res?.result?.characters || res?.result || [];
        if (!res?.status || !Array.isArray(charactersList) || charactersList.length === 0) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply(`❌ Tidak ditemukan karakter dengan kata kunci: "${querySearch}"`);
        }
        const rows = charactersList.slice(0, 10).map((c, idx) => {
          const charName = c?.character_name || c?.characterName || c?.name || "Karakter";
          const charId = c?._id || c?.id || "";
          const desc = c?.description || "Karakter StoryChat";
          return {
            title: `[#${idx + 1}] ${charName.slice(0, 24)}`,
            id: `${prefix}storychat --id ${charId} Hello, who are you?`,
            description: desc.slice(0, 60)
          };
        });
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "🔍 PILIH HASIL PENCARIAN",
            sections: [{
              title: `HASIL UNTUK: "${querySearch.toUpperCase()}"`,
              rows: rows
            }]
          })
        }];
        const bodyText = `Ditemukan *${charactersList.length}* karakter untuk pencarian \`${querySearch}\`.\nSilakan pilih salah satu dari menu di bawah:`;
        if (typeof ctx.sendCta === "function") {
          await ctx.sendCta(bodyText, botFooter, buttons, {
            quoted: quotedMsg
          });
        } else {
          let fallback = `${bodyText}\n\n`;
          charactersList.slice(0, 10).forEach((c, i) => {
            const name = c?.character_name || c?.characterName || "Karakter";
            const cid = c?._id || c?.id;
            fallback += `*${i + 1}. ${name}* (\`${cid}\`)\n`;
          });
          fallback += `\nKetik: \`${prefix}storychat --id <ID> <pesan>\``;
          await ctx.reply(fallback, {
            quoted: quotedMsg
          });
        }
        if (typeof ctx.react === "function") await ctx.react("✅");
        return;
      }
      if (!rawText) {
        const guideText = `–  *S T O R Y C H A T  A I*

Platform interaktif storytelling roleplay berbasis simulasi realitas dan karakter bebas.

┌  ◦  *1. Chat Roleplay Bebas* :
│  └ \`${prefix}storychat I step inside the ancient tavern looking for shelter.\`
│
├  ◦  *2. Jelajahi Karakter Trending* :
│  └ \`${prefix}storychat --trending\`
│
├  ◦  *3. Cari Karakter Sesuai Genre* :
│  └ \`${prefix}storychat --search cyberpunk\`
│
├  ◦  *4. Pilih Karakter via ID* :
│  └ \`${prefix}storychat --id <CHAR_ID> Hello there...\`
│
├  ◦  *5. Multi-Turn Story* :
│  └ Cukup *reply pesan bot* untuk melanjutkan cerita.
│
└  ◦  *Opsi Flags* :
   ├ \`--trending\` (Karakter viral)
   ├ \`--search <query>\` (Cari karakter)
   ├ \`--id <character_id>\` (Pilih ID karakter)
   └ \`--reset\` (Hapus memori cerita)`;
        return ctx.reply(guideText, {
          quoted: quotedMsg
        });
      }
      await ctx.react("📖");
      const existingSession = global.db.storychat[chatId];
      const targetCharId = flags.id || existingSession?.charId || undefined;
      let currentMessages = [];
      if (existingSession && Array.isArray(existingSession.messages)) {
        if (flags.id && flags.id !== existingSession.charId) {
          currentMessages = [];
        } else {
          currentMessages = existingSession.messages;
        }
      }
      const promptUser = cleanPrompt || flags.prompt || "Hello";
      const payload = {
        action: "chat",
        prompt: promptUser,
        id: targetCharId,
        user_name: userName,
        messages: currentMessages
      };
      const res = await requestStoryChatAPI(payload);
      if (!res || !res.status) {
        throw new Error(res?.error || res?.result?.error || "Gagal memproses cerita StoryChat.");
      }
      const replyContent = (res?.result?.reply || "The scene unfolds in silence...").trim();
      const updatedMessages = res?.result?.messages || [...currentMessages, {
        role: "user",
        content: promptUser
      }, {
        role: "assistant",
        content: replyContent
      }];
      const bodyText = replyContent;
      const buttons = [{
        name: "cta_copy",
        display_text: "Salin Teks Cerita",
        copy_code: replyContent
      }];
      let sentMsg;
      if (typeof ctx.sendCta === "function") {
        sentMsg = await ctx.sendCta(bodyText, botFooter, buttons, {
          quoted: quotedMsg
        });
      } else {
        sentMsg = await sock.sendMessage(chatId, {
          text: bodyText
        }, {
          quoted: quotedMsg
        });
      }
      const sentMsgId = sentMsg?.key?.id;
      if (sentMsgId) {
        recordSession(chatId, sentMsgId, targetCharId, existingSession?.charName || "StoryChat Character", updatedMessages);
      }
      await ctx.react("✨");
    } catch (error) {
      console.error("[StoryChat Error]:", error?.message || error);
      if (typeof ctx.react === "function") await ctx.react("❌");
      const errMsg = error.response?.data?.error || error.response?.data?.result?.error || error.message;
      ctx.reply(`❌ Terjadi kendala pada StoryChat AI: ${errMsg}`);
    }
  }
};