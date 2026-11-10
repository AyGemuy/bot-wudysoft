import axios from "axios";
import db from "../../data/db.js";
import { upload } from "../../lib/upload.js";

const API_URL = `${global.bot?.api?.wudysoft}/api/ai/luzia`;
const SESSION_TIMEOUT = 25 * 60 * 1e3; // 25 Menit
const CONFIG = {
  TIMEOUT: 12e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};

const PRESET_CHARACTERS = [
  {
    id: "LuzIA",
    alias: "luzia",
    name: "Luzia",
    tagline: "Your everything AI 🫶",
    pronouns: "she/her",
    avatar: "https://d33vogf129z46d.cloudfront.net/luzia_thumbnail_3d.png"
  },
  {
    id: "professor",
    alias: "teacher",
    name: "Teacher (Professor)",
    tagline: "The nerd who explains 🤓",
    pronouns: "she/her",
    avatar: "https://d33vogf129z46d.cloudfront.net/professor_thumbnail_3d.png"
  },
  {
    id: "journaling",
    alias: "friend",
    name: "Friend",
    tagline: "Your ride or die forever ✨",
    pronouns: "she/her",
    avatar: "https://d33vogf129z46d.cloudfront.net/friend_thumbnail_3d.png"
  },
  {
    id: "luzia_bro",
    alias: "elias",
    name: "Elias",
    tagline: "The bro who listens 🤙",
    pronouns: "he/him",
    avatar: "https://d33vogf129z46d.cloudfront.net/elias_thumbnail_3d.png"
  },
  {
    id: "toki",
    alias: "toki",
    name: "Toki",
    tagline: "Tok-Tok! Toki is here 🐣",
    pronouns: "other",
    avatar: "https://d33vogf129z46d.cloudfront.net/toki_thumbnail_3d.png"
  }
];

function initDB(jid = null, name = "") {
  try {
    if (!global.db) global.db = {};
    if (!global.db.user) global.db.user = {};
    if (!global.db.luzia) global.db.luzia = {};
    if (jid && !global.db.user[jid]) {
      global.db.user[jid] = {
        name: name || "",
        money: 1e4,
        exp: 0
      };
    }
  } catch (err) {
    console.error("[Luzia initDB Error]:", err?.message || err);
  }
}

function saveDB() {
  try {
    if (typeof db?.write === "function" && global.db) {
      db.write(global.db);
    }
  } catch (err) {
    console.error("[Luzia saveDB Error]:", err?.message || err);
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

    if (["char", "character", "c", "role", "p", "persona"].includes(key)) key = "character";
    if (["setchar", "setcharacter", "setrole", "set"].includes(key)) key = "setchar";
    if (["restart", "reset", "clear"].includes(key)) key = "reset";
    if (["image", "img", "imageurl"].includes(key)) key = "media";
    if (["search", "web", "websearch"].includes(key)) key = "websearch";
    if (["reason", "reasoning"].includes(key)) key = "reasoning";
    if (["list", "chars", "characters"].includes(key)) key = "list";

    if (rawVal !== undefined) {
      if ((rawVal.startsWith('"') && rawVal.endsWith('"')) || (rawVal.startsWith("'") && rawVal.endsWith("'"))) {
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
  return { flags, cleanPrompt };
}

function resolveCharacter(query = "") {
  const q = (query || "").toString().trim().toLowerCase();
  const found = PRESET_CHARACTERS.find(
    c => c.id.toLowerCase() === q || c.alias.toLowerCase() === q || c.name.toLowerCase().includes(q)
  );
  return found || PRESET_CHARACTERS[0];
}

async function requestLuziaAPI(payload = {}) {
  const { data } = await axios.post(API_URL, payload, {
    headers: {
      "Content-Type": "application/json",
      "User-Agent": CONFIG.USER_AGENT
    },
    timeout: CONFIG.TIMEOUT
  });
  return data;
}

function recordSessionMessage(chatId, messageId, characterData, returnedState) {
  if (!messageId || !chatId) return;
  initDB();
  if (!global.db.luzia[chatId]) {
    global.db.luzia[chatId] = {
      character: characterData?.id || "LuzIA",
      character_name: characterData?.name || "Luzia",
      state: returnedState || null,
      msgIds: [],
      lastMsgId: null,
      updatedAt: Date.now(),
      expireTime: Date.now() + SESSION_TIMEOUT
    };
  }
  const s = global.db.luzia[chatId];
  if (characterData) {
    s.character = characterData.id;
    s.character_name = characterData.name;
  }
  if (returnedState) s.state = returnedState;
  if (!Array.isArray(s.msgIds)) s.msgIds = [];
  if (!s.msgIds.includes(messageId)) {
    s.msgIds.push(messageId);
  }
  s.lastMsgId = messageId;
  s.updatedAt = Date.now();
  s.expireTime = Date.now() + SESSION_TIMEOUT;
  saveDB();
}

async function deliverResponse({ sock, ctx, chatId, msg, answerText, mediaUrls }) {
  let sentMsg = null;
  const bodyText = (answerText || "").trim();

  // Pengiriman Media Visual (Gambar / Video)
  if (mediaUrls && mediaUrls.length > 0) {
    for (let i = 0; i < mediaUrls.length; i++) {
      const mediaUrl = mediaUrls[i];
      const isVideo = mediaUrl.endsWith(".mp4");
      const caption = i === 0 ? bodyText : "";

      if (isVideo) {
        sentMsg = await sock.sendMessage(chatId, {
          video: { url: mediaUrl },
          caption: caption.trim()
        }, { quoted: msg });
      } else {
        sentMsg = await sock.sendMessage(chatId, {
          image: { url: mediaUrl },
          caption: caption.trim()
        }, { quoted: msg });
      }
    }
  } else {
    // Tombol CTA Salin Jawaban
    const buttons = [{
      name: "cta_copy",
      display_text: "Salin Jawaban",
      copy_code: bodyText
    }];

    if (typeof ctx.sendCta === "function") {
      try {
        sentMsg = await ctx.sendCta(bodyText, "", buttons, { quoted: msg });
      } catch (_) {
        sentMsg = null;
      }
    }

    // Fallback jika CTA tidak didukung perangkat
    if (!sentMsg) {
      sentMsg = await sock.sendMessage(chatId, {
        text: bodyText
      }, { quoted: msg });
    }
  }

  return sentMsg;
}

export default {
  name: "luzia",
  aliases: ["luzi", "lz", "luna"],
  description: "AI Multimodal Agent & Multi-Personality (Chat, Web Search & Visual Creation via Luzia Engine).",
  category: "AI",
  limit: true,
  example: "luzia buatkan gambar rubah cyberpunk atau reply pesan bot untuk melanjutkan percakapan",

  before: async (msg, { sock, ctx }) => {
    try {
      const chatId = ctx?.id || msg?.key?.remoteJid;
      if (!chatId) return;

      initDB();
      if (!global.db.luzia[chatId]) return;

      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;

      const sessionData = global.db.luzia[chatId];
      if (Date.now() > sessionData.expireTime) {
        delete global.db.luzia[chatId];
        saveDB();
        return;
      }

      const quotedStanzaId = ctx?.quoted?.id || msg?.message?.extendedTextMessage?.contextInfo?.stanzaId;
      const isQuotingAi = quotedStanzaId && (quotedStanzaId === sessionData.lastMsgId || (Array.isArray(sessionData.msgIds) && sessionData.msgIds.includes(quotedStanzaId)));
      if (!isQuotingAi) return;

      const userText = (ctx?.text || ctx?.query || msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "").trim();
      const prefixList = [".", "#", "!", "/", ctx?.prefix].filter(Boolean);
      if (prefixList.some(p => userText.startsWith(p))) return;

      const isMedia = ctx?.isMedia || ctx?.quoted?.isMedia;
      if (!userText && !isMedia) return;

      if (typeof ctx?.react === "function") await ctx.react("💭");

      let uploadedMedia = null;
      if (isMedia && typeof ctx.download === "function") {
        try {
          const buffer = await ctx.download();
          if (buffer && Buffer.isBuffer(buffer)) {
            const uploadRes = await upload(buffer).catch(() => null);
            uploadedMedia = uploadRes?.status && uploadRes?.url ? uploadRes.url : buffer.toString("base64");
          }
        } catch (_) {}
      }

      const currentChar = resolveCharacter(sessionData.character);
      const bodyPayload = {
        action: "chat",
        prompt: userText || (uploadedMedia ? "Tolong proses media ini" : "Lanjutkan percakapan"),
        character: currentChar.id,
        state: sessionData.state || null,
        ...(uploadedMedia ? { media: uploadedMedia } : {})
      };

      const data = await requestLuziaAPI(bodyPayload);
      if (!data || !data.status) {
        throw new Error(data?.result?.error || data?.error || "Gagal mendapatkan respon dari Luzia AI.");
      }

      const resResult = data.result || {};
      let answerText = (resResult.content || (typeof resResult === "string" ? resResult : "Respon berhasil diterima.")).trim();

      const mediaList = [];
      const vidUrl = resResult.video?.url || (typeof resResult.video === "string" ? resResult.video : null);
      const imgUrl = resResult.image?.url || (typeof resResult.image === "string" ? resResult.image : null);

      if (vidUrl) mediaList.push(vidUrl);
      if (imgUrl) mediaList.push(imgUrl);

      if (answerText.includes("![image](")) {
        const extracted = answerText.split("![image](")?.[1]?.split(")")?.[0];
        if (extracted && !mediaList.includes(extracted)) {
          mediaList.push(extracted);
        }
        answerText = answerText.replace(/!\[image\]\([^)]+\)/g, "").trim();
      }

      const sentMsg = await deliverResponse({
        sock,
        ctx,
        chatId,
        msg,
        answerText,
        mediaUrls: mediaList
      });

      const newMsgId = sentMsg?.key?.id;
      if (newMsgId) {
        recordSessionMessage(chatId, newMsgId, currentChar, data.state || sessionData.state);
      }

      if (typeof ctx?.react === "function") await ctx.react("✨");
      return true;
    } catch (e) {
      console.error("[LUZIA BEFORE ERROR]:", e?.message || e);
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
        if (["luzia", "luzi", "lz", "luna"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }

      const prefix = ctx.prefix || ".";

      // 1. Reset Sesi Percakapan
      if (["--reset", "--clear", "reset", "clear"].includes(rawText.toLowerCase())) {
        if (global.db.luzia[chatId]) {
          delete global.db.luzia[chatId];
          saveDB();
          return ctx.reply("🧹 *Sesi percakapan Luzia AI berhasil direset!* Topik baru dimulai.");
        }
        return ctx.reply("ℹ️ Tidak ada sesi aktif Luzia AI di room chat ini.");
      }

      const { flags, cleanPrompt } = parseFlags(rawText);

      // 2. Set Karakter (langsung lewat flag / trigger CTA)
      const setCharTarget = flags.setchar || (cleanPrompt.toLowerCase().startsWith("setchar ") ? cleanPrompt.slice(8).trim() : null);
      if (setCharTarget) {
        const charSelected = resolveCharacter(setCharTarget);
        if (!global.db.luzia[chatId]) {
          global.db.luzia[chatId] = {
            character: charSelected.id,
            character_name: charSelected.name,
            state: null,
            msgIds: [],
            lastMsgId: null,
            updatedAt: Date.now(),
            expireTime: Date.now() + SESSION_TIMEOUT
          };
        } else {
          global.db.luzia[chatId].character = charSelected.id;
          global.db.luzia[chatId].character_name = charSelected.name;
          global.db.luzia[chatId].updatedAt = Date.now();
        }
        saveDB();

        const successText = `✅ *Karakter Luzia berhasil diubah!*\n\n┌  ◦  *Nama* : ${charSelected.name}\n├  ◦  *Alias* : \`${charSelected.alias}\`\n├  ◦  *Pronouns* : ${charSelected.pronouns}\n└  ◦  *Bio* : _${charSelected.tagline}_\n\nSilakan langsung mulai percakapan bersama *${charSelected.name}*!`;
        if (charSelected.avatar) {
          return await sock.sendMessage(chatId, {
            image: { url: charSelected.avatar },
            caption: successText
          }, { quoted: msg });
        }
        return ctx.reply(successText, { quoted: msg });
      }

      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;

      // 3. Panduan Interaktif & Menu CTA Single Select
      if ((!rawText && !isMedia) || flags.list) {
        const activeCharId = global.db.luzia[chatId]?.character || "LuzIA";
        const currentActive = resolveCharacter(activeCharId);

        const rows = PRESET_CHARACTERS.map(c => ({
          header: c.name,
          title: `${c.name} ${c.id === currentActive.id ? "✓ (Aktif)" : ""}`,
          description: `${c.tagline} (${c.pronouns})`,
          id: `${prefix}luzia --setchar ${c.alias}`
        }));

        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "🎭 Pilih Karakter Luzia",
            sections: [{
              title: "PILIHAN KARAKTER RESMI",
              rows: rows
            }]
          })
        }];

        const guideText = `–  *L U Z I A  A I*

Agen asisten multimodal & multi-karakter (Chat, Web Search, Vision & Visual Generation via Luzia Engine).

┌  ◦  *Karakter Aktif* : *${currentActive.name}* (\`${currentActive.alias}\`)
│
├  ◦  *Chat / Tanya Jawab* :
│  └ \`${prefix}luzia jelaskan fenomena black hole secara santai\`
│
├  ◦  *Generasi Visual* :
│  └ \`${prefix}luzia buatkan gambar kucing berjaket cyberpunk\`
│
├  ◦  *Pencarian Web Real-time* :
│  └ \`${prefix}luzia berita teknologi AI hari ini --websearch\`
│
├  ◦  *Ganti Kepribadian / Persona* :
│  └ Klik tombol *Pilih Karakter* di bawah atau gunakan:
│     \`${prefix}luzia --char teacher <pesan>\`
│
├  ◦  *Multi-Turn Conversation* :
│  └ Cukup *reply pesan bot* untuk melanjutkan obrolan secara langsung.
│
└  ◦  *Override Flags* :
   ├ \`--reset\` (Hapus riwayat sesi percakapan)
   ├ \`--setchar <alias>\` (Set karakter permanen)
   ├ \`--char <alias>\` (Gunakan karakter sementara)
   ├ \`--websearch\` (Aktifkan penelusuran daring)
   ├ \`--reasoning\` (Aktifkan pemikiran mendalam)
   └ \`--media <url>\``;

        if (typeof ctx.sendCta === "function") {
          try {
            return await ctx.sendCta(guideText, `${global.bot?.name || "Luzia"} • AI Assistant`, buttons, {
              image: currentActive.avatar,
              quoted: msg
            });
          } catch (_) {}
        }
        return ctx.reply(guideText, { quoted: msg });
      }

      await ctx.react("💭");

      let uploadedMedia = flags.media || null;
      if (isMedia && typeof ctx.download === "function") {
        try {
          const buffer = await ctx.download();
          if (buffer && Buffer.isBuffer(buffer)) {
            const uploadRes = await upload(buffer).catch(() => null);
            uploadedMedia = uploadRes?.status && uploadRes?.url ? uploadRes.url : buffer.toString("base64");
          }
        } catch (_) {}
      }

      const existingSession = global.db.luzia[chatId];
      const targetChar = resolveCharacter(flags.character || existingSession?.character || "LuzIA");
      const stateToUse = existingSession?.state || null;

      // Payload JSON murni sesuai spesifikasi LuziaClient
      const bodyPayload = {
        action: "chat",
        prompt: cleanPrompt || (uploadedMedia ? "Jelaskan dan olah gambar ini" : "Halo"),
        character: targetChar.id,
        isWebSearch: Boolean(flags.websearch),
        reasoning: Boolean(flags.reasoning),
        ...(stateToUse ? { state: stateToUse } : {}),
        ...(uploadedMedia ? { media: uploadedMedia } : {})
      };

      const data = await requestLuziaAPI(bodyPayload);
      if (!data || !data.status) {
        throw new Error(data?.result?.error || data?.error || "Gagal mendapatkan respon dari Luzia AI.");
      }

      const resResult = data.result || {};
      let answerText = (resResult.content || (typeof resResult === "string" ? resResult : "Respon berhasil diterima.")).trim();

      const mediaList = [];
      const vidUrl = resResult.video?.url || (typeof resResult.video === "string" ? resResult.video : null);
      const imgUrl = resResult.image?.url || (typeof resResult.image === "string" ? resResult.image : null);

      if (vidUrl) mediaList.push(vidUrl);
      if (imgUrl) mediaList.push(imgUrl);

      if (answerText.includes("![image](")) {
        const extracted = answerText.split("![image](")?.[1]?.split(")")?.[0];
        if (extracted && !mediaList.includes(extracted)) {
          mediaList.push(extracted);
        }
        answerText = answerText.replace(/!\[image\]\([^)]+\)/g, "").trim();
      }

      const sentMsg = await deliverResponse({
        sock,
        ctx,
        chatId,
        msg,
        answerText,
        mediaUrls: mediaList
      });

      const sentMsgId = sentMsg?.key?.id;
      if (sentMsgId) {
        recordSessionMessage(chatId, sentMsgId, targetChar, data.state || stateToUse);
      }

      await ctx.react("✨");
    } catch (error) {
      console.error("[Luzia AI Error]:", error?.message || error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.result?.error || error.response?.data?.error || error.response?.data?.message || error.message;
      ctx.reply(`❌ Terjadi kendala pada Luzia AI: ${errMsg}`);
    }
  }
};