import axios from "axios";
import db from "../../data/db.js";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/ai/chat-box`;
const SESSION_TIMEOUT = 25 * 60 * 1e3;
const CONFIG = {
  TIMEOUT: 12e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};
const FALLBACK_FILTERS = [{
  name: "ANIME",
  isFree: true,
  isViral: false
}, {
  name: "BARBIE_KEN",
  isFree: false,
  isViral: true
}, {
  name: "DOG_HUMAN_TO_DOG",
  isFree: true,
  isViral: false
}, {
  name: "TOONIFY",
  isFree: true,
  isViral: false
}, {
  name: "CARTOON_3D",
  isFree: false,
  isViral: true
}, {
  name: "SIMPSON",
  isFree: true,
  isViral: true
}, {
  name: "LEGO",
  isFree: false,
  isViral: true
}, {
  name: "CRYING",
  isFree: false,
  isViral: false
}, {
  name: "EMOJI_FACE",
  isFree: true,
  isViral: true
}, {
  name: "MINECRAFT",
  isFree: true,
  isViral: true
}, {
  name: "ZOMBIE",
  isFree: false,
  isViral: false
}, {
  name: "QUEEN",
  isFree: false,
  isViral: false
}, {
  name: "VINTAGE_PORTRAIT",
  isFree: false,
  isViral: false
}, {
  name: "GIRL_BOY",
  isFree: false,
  isViral: false
}, {
  name: "OLD",
  isFree: true,
  isViral: false
}, {
  name: "SMURF",
  isFree: false,
  isViral: false
}, {
  name: "MONSTER",
  isFree: true,
  isViral: false
}, {
  name: "SHREK",
  isFree: false,
  isViral: false
}, {
  name: "PIXEL_ART",
  isFree: true,
  isViral: false
}, {
  name: "ACTION_FIGURE",
  isFree: false,
  isViral: false
}, {
  name: "MUPPET",
  isFree: false,
  isViral: false
}, {
  name: "CLOWN",
  isFree: false,
  isViral: false
}, {
  name: "KRUEGER",
  isFree: false,
  isViral: false
}, {
  name: "DOUGH_FACE",
  isFree: false,
  isViral: false
}];
let cachedFiltersList = null;
let lastCacheFetchTime = 0;

function initDB(jid = null, name = "") {
  try {
    if (!global.db) global.db = {};
    if (!global.db.user) global.db.user = {};
    if (!global.db.chatbox) global.db.chatbox = {};
    if (jid && !global.db.user[jid]) {
      global.db.user[jid] = {
        name: name || "",
        money: 1e4,
        exp: 0
      };
    }
  } catch (err) {
    console.error("[ChatBox initDB Error]:", err?.message || err);
  }
}

function saveDB() {
  try {
    if (typeof db?.write === "function" && global.db) {
      db.write(global.db);
    }
  } catch (err) {
    console.error("[ChatBox saveDB Error]:", err?.message || err);
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
      if (["room", "room_id", "session"].includes(key)) key = "room_id";
      if (["m", "type"].includes(key)) key = "mode";
      if (["f"].includes(key)) key = "filter";
      if (["img", "image", "mediaurl"].includes(key)) key = "media";
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
    console.error("[ChatBox parseFlags Error]:", err?.message || err);
    return {
      flags: {},
      cleanPrompt: input
    };
  }
}
async function requestWudysoftAPI(payload = {}) {
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
    console.error("[ChatBox requestWudysoftAPI Error]:", err?.message || err);
    throw err;
  }
}

function extractChatBoxResult(resResult = {}) {
  let answerText = resResult.response || resResult.message || "";
  if (!answerText && Array.isArray(resResult.chunks)) {
    const completeChunk = resResult.chunks.find(c => c.event === "complete" || c.data?.type === "complete");
    if (completeChunk?.data?.fullMessage?.message) {
      answerText = completeChunk.data.fullMessage.message;
    } else {
      const contentParts = resResult.chunks.filter(c => (c.event === "chunk" || c.data?.type === "chunk") && c.data?.content).map(c => c.data.content);
      if (contentParts.length > 0) {
        answerText = contentParts.join("");
      }
    }
  }
  let chatTitle = resResult.title || "";
  if (!chatTitle && Array.isArray(resResult.chunks)) {
    const titleChunk = resResult.chunks.find(c => c.event === "chat_title" || c.data?.type === "chat_title");
    if (titleChunk?.data?.content) {
      chatTitle = titleChunk.data.content;
    }
  }
  return {
    text: (answerText || "Respon berhasil diselesaikan.").trim(),
    title: chatTitle || null,
    model: resResult.model || "AI Chat",
    tokens: resResult.token_usage?.total_tokens || null,
    roomId: resResult.room_id || null,
    messageId: resResult.message_id || null
  };
}
async function getWudysoftFilters() {
  try {
    const oneHour = 60 * 60 * 1e3;
    if (cachedFiltersList && Date.now() - lastCacheFetchTime < oneHour) {
      return cachedFiltersList;
    }
    const res = await requestWudysoftAPI({
      mode: "filters"
    });
    const filters = res?.result?.filters || res?.filters;
    if (res?.status && Array.isArray(filters) && filters.length > 0) {
      cachedFiltersList = filters;
      lastCacheFetchTime = Date.now();
      return cachedFiltersList;
    }
    return cachedFiltersList || FALLBACK_FILTERS;
  } catch (err) {
    console.error("[ChatBox getWudysoftFilters Error]:", err?.message || err);
    return cachedFiltersList || FALLBACK_FILTERS;
  }
}
async function validateFilter(filterInput = "") {
  try {
    const available = await getWudysoftFilters();
    const raw = (filterInput || "").toString().trim().toUpperCase().replace(/\s+/g, "_");
    const matched = available.find(f => {
      const cleanName = (f?.name || "").toUpperCase();
      return cleanName === raw || cleanName.replace(/_/g, "") === raw.replace(/_/g, "");
    });
    return {
      valid: Boolean(matched),
      matched: matched || null,
      availableList: available
    };
  } catch (err) {
    console.error("[ChatBox validateFilter Error]:", err?.message || err);
    return {
      valid: false,
      matched: null,
      availableList: FALLBACK_FILTERS
    };
  }
}

function recordSessionMessage(chatId, messageId, roomId) {
  try {
    if (!messageId || !chatId) return;
    initDB();
    if (!global.db.chatbox[chatId]) {
      global.db.chatbox[chatId] = {
        roomId: roomId || null,
        msgIds: [],
        lastMsgId: null,
        updatedAt: Date.now(),
        expireTime: Date.now() + SESSION_TIMEOUT
      };
    }
    const s = global.db.chatbox[chatId];
    if (roomId) s.roomId = roomId;
    if (!Array.isArray(s.msgIds)) s.msgIds = [];
    if (!s.msgIds.includes(messageId)) {
      s.msgIds.push(messageId);
    }
    s.lastMsgId = messageId;
    s.updatedAt = Date.now();
    s.expireTime = Date.now() + SESSION_TIMEOUT;
    saveDB();
  } catch (err) {
    console.error("[ChatBox recordSessionMessage Error]:", err?.message || err);
  }
}
export default {
  name: "chatbox",
  aliases: ["cbox", "cbai"],
  description: "AI Multimodal ChatBox via Wudysoft API (Chat, Visual Gen & Auto-Validated Filters)",
  category: "AI",
  limit: true,
  example: "chatbox halo atau chatbox --mode filter ANIME",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const chatId = ctx?.id || msg?.key?.remoteJid;
      if (!chatId) return;
      initDB();
      if (!global.db.chatbox[chatId]) return;
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      const sessionData = global.db.chatbox[chatId];
      if (Date.now() > sessionData.expireTime) {
        delete global.db.chatbox[chatId];
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
        mode: "chat",
        prompt: userText || "Lanjutkan percakapan ini secara detail",
        room_id: sessionData.roomId || null,
        ...uploadedMediaUrl ? {
          media: uploadedMediaUrl
        } : {}
      };
      const data = await requestWudysoftAPI(bodyPayload);
      if (!data || !data.status) {
        throw new Error(data?.result?.error_message || data?.error || "Gagal mendapatkan respon dari ChatBox AI.");
      }
      const parsed = extractChatBoxResult(data.result);
      const returnedRoomId = parsed.roomId || sessionData.roomId;
      const formattedReply = `${parsed.text}\n\n${parsed.tokens ? `\n_Tokens: ${parsed.tokens}_` : ""}`;
      const buttons = [{
        name: "cta_copy",
        display_text: "Salin Jawaban",
        copy_code: parsed.text
      }];
      let sentMsg;
      if (typeof ctx.sendCta === "function") {
        sentMsg = await ctx.sendCta(formattedReply, "", buttons, {
          quoted: msg
        });
      } else {
        sentMsg = await sock.sendMessage(ctx.id, {
          text: formattedReply
        }, {
          quoted: msg
        });
      }
      const newMsgId = sentMsg?.key?.id;
      if (newMsgId) {
        recordSessionMessage(chatId, newMsgId, returnedRoomId);
      }
      if (typeof ctx?.react === "function") await ctx.react("✨");
      return true;
    } catch (e) {
      console.error("[CHATBOX BEFORE ERROR]:", e?.message || e);
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
        if (["chatbox", "cbox", "cbai"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const botName = global.bot?.name || "ChatBox";
      const botFooter = global.bot?.footer || `${botName} • Wudysoft Engine`;
      if (["--filters", "-filters", "filters", "filterlist", "listfilter"].includes(rawText.toLowerCase())) {
        const liveFilters = await getWudysoftFilters();
        let listText = `–  *D A F T A R  F I L T E R  C H A T B O X*\n\n`;
        liveFilters.forEach((f, i) => {
          const badges = [];
          if (f.isViral) badges.push("🔥 Viral");
          if (f.isFree) badges.push("🆓 Free");
          const bStr = badges.length > 0 ? ` [${badges.join(" | ")}]` : "";
          listText += `*${i + 1}.* \`${f.name}\`${bStr}\n`;
        });
        listText += `\n*Format Perintah*:\nKirim/balas foto dengan: \`${prefix}chatbox --mode filter --filter <NAMA_FILTER>\``;
        return ctx.reply(listText, {
          quoted: quotedMsg
        });
      }
      if (["--reset", "--clear", "reset", "clear"].includes(rawText.toLowerCase())) {
        if (global.db.chatbox[chatId]) {
          delete global.db.chatbox[chatId];
          saveDB();
          return ctx.reply("🧹 *Sesi percakapan ChatBox AI berhasil direset!* Ruang obrolan baru dimulai.");
        }
        return ctx.reply("ℹ️ Tidak ada sesi aktif ChatBox AI di room chat ini.");
      }
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      if (!rawText && !isMedia) {
        const guideText = `–  *C H A T B O X  A I*

Asisten cerdas multimodal full API (Chat, Visual Gen & Auto-Validated Filters).

┌  ◦  *Chat / Tanya Jawab* :
│  └ \`${prefix}chatbox jelaskan hukum kekekalan energi\`
│
├  ◦  *Generasi Visual (Image Gen)* :
│  └ \`${prefix}chatbox --mode gen anime cyberpunk girl neon lights\`
│
├  ◦  *Auto-Validated Image Filter* :
│  └ Kirim/balas foto: \`${prefix}chatbox --mode filter ANIME\`
│  └ Cek filter resmi: \`${prefix}chatbox --filters\`
│
├  ◦  *Multi-Turn Conversation* :
│  └ Cukup *reply pesan bot* untuk melanjutkan percakapan.
│
└  ◦  *Opsi Flags* :
   ├ \`--mode <chat|gen|filter>\`
   ├ \`--filter <nama_filter>\`
   ├ \`--filters\` (Lihat daftar filter)
   ├ \`--room <room_id>\`
   └ \`--reset\` (Hapus sesi)`;
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
      let selectedMode = (flags.mode || "").toLowerCase();
      if (!selectedMode) {
        if (flags.gen || flags.generate || flags.image) {
          selectedMode = "gen";
        } else if (flags.filter) {
          selectedMode = "filter";
        } else if (isMedia && cleanPrompt) {
          const checkFilter = await validateFilter(cleanPrompt);
          if (checkFilter.valid) {
            selectedMode = "filter";
            flags.filter = checkFilter.matched.name;
          } else {
            selectedMode = "chat";
          }
        } else {
          selectedMode = "chat";
        }
      }
      const existingSession = global.db.chatbox[chatId];
      const roomIdToUse = flags.room_id || existingSession?.roomId || null;
      if (selectedMode === "gen" || selectedMode === "generate" || selectedMode === "image") {
        const promptGen = cleanPrompt || flags.prompt;
        if (!promptGen) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply(`❌ Masukkan prompt deskripsi gambar.\nContoh: \`${prefix}chatbox --mode gen anime cyberpunk girl neon lights\``);
        }
        const bodyPayload = {
          mode: "gen",
          prompt: promptGen,
          room_id: roomIdToUse,
          ...uploadedMediaUrl ? {
            media: uploadedMediaUrl
          } : flags.media ? {
            media: flags.media
          } : {}
        };
        const data = await requestWudysoftAPI(bodyPayload);
        if (!data?.status || !data.result?.image_url) {
          throw new Error(data?.result?.error_message || data?.error || "Gagal melakukan generate gambar.");
        }
        const resResult = data.result || {};
        const caption = `–  *C H A T B O X  I M A G E*

┌  ◦  *Prompt* : ${promptGen}
└  ◦  *Room ID* : ${resResult.room_id || "-"}`;
        const sentMsg = await sock.sendMessage(ctx.id, {
          image: {
            url: resResult.image_url
          },
          caption: caption.trim()
        }, {
          quoted: quotedMsg
        });
        if (sentMsg?.key?.id && resResult.room_id) {
          recordSessionMessage(chatId, sentMsg.key.id, resResult.room_id);
        }
        await ctx.react("✨");
        return;
      }
      if (selectedMode === "filter") {
        const targetMedia = uploadedMediaUrl || flags.media;
        if (!targetMedia) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply(`❌ Harap kirimkan atau balas foto dengan perintah filter.\nContoh: \`${prefix}chatbox --mode filter ANIME\``);
        }
        let inputFilter = (flags.filter || cleanPrompt || "").toString().trim();
        if (!inputFilter || inputFilter.toUpperCase() === "TRUE" || inputFilter.toUpperCase() === "FILTER") {
          const liveFilters = await getWudysoftFilters();
          const filterRows = liveFilters.map(f => {
            const tag = f.isViral ? "🔥 Viral" : f.isFree ? "🆓 Free" : "✨ Filter";
            return {
              title: f.name.replace(/_/g, " "),
              id: `${prefix}chatbox --mode filter --filter ${f.name} --media "${targetMedia}"`,
              description: `Status: ${tag}`
            };
          });
          const buttons = [{
            name: "single_select",
            buttonParamsJson: JSON.stringify({
              title: "🎨 PILIH FILTER FOTO",
              sections: [{
                title: `DAFTAR FILTER TERSEDIA (${liveFilters.length} PILIHAN)`,
                rows: filterRows
              }]
            })
          }];
          const bodySelect = `Silakan klik tombol *PILIH FILTER FOTO* di bawah untuk menerapkan transformasi efek pada gambar Anda:`;
          if (typeof ctx.sendCta === "function") {
            await ctx.sendCta(bodySelect, botFooter, buttons, {
              image: targetMedia,
              quoted: quotedMsg
            });
          } else {
            let fallbackList = `${bodySelect}\n\n`;
            liveFilters.forEach(f => {
              fallbackList += `• \`${f.name}\`\n`;
            });
            fallbackList += `\nKetik: \`${prefix}chatbox --mode filter <NAMA_FILTER>\``;
            await ctx.reply(fallbackList, {
              quoted: quotedMsg
            });
          }
          if (typeof ctx.react === "function") await ctx.react("✅");
          return;
        }
        const check = await validateFilter(inputFilter);
        if (!check.valid) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          const validNames = check.availableList.map(f => `\`${f.name}\``).join(", ");
          return ctx.reply(`❌ Filter *"${inputFilter}"* tidak valid!\n\n*Pilihan filter resmi yang tersedia:*\n${validNames}`);
        }
        const validFilterName = check.matched.name;
        const bodyPayload = {
          mode: "filter",
          filter: validFilterName,
          media: targetMedia,
          room_id: roomIdToUse
        };
        const data = await requestWudysoftAPI(bodyPayload);
        if (!data?.status || !data.result?.image_url) {
          throw new Error(data?.result?.error_message || data?.error || "Gagal menerapkan filter pada gambar.");
        }
        const resResult = data.result || {};
        const caption = `–  *C H A T B O X  F I L T E R*

┌  ◦  *Filter* : ${validFilterName} ${check.matched.isViral ? "🔥" : ""} ${check.matched.isFree ? "🆓" : ""}
└  ◦  *Room ID* : ${resResult.room_id || "-"}`;
        const sentMsg = await sock.sendMessage(ctx.id, {
          image: {
            url: resResult.image_url
          },
          caption: caption.trim()
        }, {
          quoted: quotedMsg
        });
        if (sentMsg?.key?.id && resResult.room_id) {
          recordSessionMessage(chatId, sentMsg.key.id, resResult.room_id);
        }
        await ctx.react("✨");
        return;
      }
      const promptChat = flags.prompt || cleanPrompt || (uploadedMediaUrl ? "Jelaskan gambar ini" : "Halo");
      const bodyPayload = {
        mode: "chat",
        prompt: promptChat,
        room_id: roomIdToUse,
        ...uploadedMediaUrl ? {
          media: uploadedMediaUrl
        } : flags.media ? {
          media: flags.media
        } : {}
      };
      const data = await requestWudysoftAPI(bodyPayload);
      if (!data?.status) {
        throw new Error(data?.result?.error_message || data?.error || "Gagal memproses pesan chat.");
      }
      const parsed = extractChatBoxResult(data.result);
      const returnedRoomId = parsed.roomId || roomIdToUse;
      let responseText = `${parsed.text}\n\n`;
      if (parsed.title || parsed.tokens) {
        responseText += `\n┌  ◦  *Topik* : ${parsed.title || "Diskusi"}\n└  ◦  *Model* : ${parsed.model} (${parsed.tokens || "-"} tokens)`;
      }
      const buttons = [{
        name: "cta_copy",
        display_text: "Salin Jawaban",
        copy_code: parsed.text
      }];
      let sentMsg;
      if (typeof ctx.sendCta === "function") {
        sentMsg = await ctx.sendCta(responseText, botFooter, buttons, {
          quoted: quotedMsg
        });
      } else {
        sentMsg = await sock.sendMessage(ctx.id, {
          text: responseText
        }, {
          quoted: quotedMsg
        });
      }
      const sentMsgId = sentMsg?.key?.id;
      if (sentMsgId && returnedRoomId) {
        recordSessionMessage(chatId, sentMsgId, returnedRoomId);
      }
      await ctx.react("✨");
    } catch (error) {
      console.error("[ChatBox AI Error]:", error?.message || error);
      if (typeof ctx.react === "function") await ctx.react("❌");
      const errMsg = error.response?.data?.result?.error_message || error.response?.data?.error || error.response?.data?.message || error.message;
      ctx.reply(`❌ Terjadi kendala pada ChatBox AI: ${errMsg}`);
    }
  }
};