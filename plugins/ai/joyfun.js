import axios from "axios";
import db from "../../data/db.js";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/ai/joyfun`;
const SESSION_TIMEOUT = 20 * 60 * 1e3;
const CONFIG = {
  TIMEOUT: 9e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};

function initDB(jid = null, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.joyFun) global.db.joyFun = {};
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
    if (["res", "size", "aspect", "aspect_ratio", "ratio"].includes(key)) key = "resolution";
    if (["img", "media"].includes(key)) key = "image";
    if (["token_jwt", "jwt", "state"].includes(key)) key = "token";
    if (["models", "list"].includes(key) && rawVal === undefined) key = "listModels";
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
async function requestJoyFun(payload) {
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
  if (!global.db.joyFun[chatId]) {
    global.db.joyFun[chatId] = {
      token: null,
      model: "JoyFun Spicy",
      resolution: null,
      lastImageUrl: null,
      msgIds: [],
      lastMsgId: null,
      updatedAt: Date.now(),
      expireTime: Date.now() + SESSION_TIMEOUT
    };
  }
  const s = global.db.joyFun[chatId];
  if (sessionData.token !== undefined) s.token = sessionData.token;
  if (sessionData.model !== undefined) s.model = sessionData.model;
  if (sessionData.resolution !== undefined) s.resolution = sessionData.resolution;
  if (sessionData.lastImageUrl !== undefined) s.lastImageUrl = sessionData.lastImageUrl;
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
  name: "joyfun",
  aliases: ["joyfunai", "joyart", "joyai"],
  description: "High-Quality AI Image Generator & Editor via JoyFun Engines (Full DB Session).",
  category: "AI",
  limit: true,
  example: "joyfun a cute car --model 'JoyFun Spicy' --ratio 16:9",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const chatId = ctx?.id || msg?.key?.remoteJid;
      if (!chatId) return;
      initDB();
      if (!global.db.joyFun[chatId]) return;
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      const sessionData = global.db.joyFun[chatId];
      if (Date.now() > sessionData.expireTime) {
        delete global.db.joyFun[chatId];
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
      if (typeof ctx?.react === "function") await ctx.react("⏳");
      let uploadedImageUrl = null;
      if (isMedia && typeof ctx.download === "function") {
        const buffer = await ctx.download();
        if (buffer && Buffer.isBuffer(buffer)) {
          const uploadRes = await upload(buffer).catch(() => null);
          if (uploadRes?.status && uploadRes?.url) {
            uploadedImageUrl = uploadRes.url;
          }
        }
      }
      const bodyPayload = {
        prompt: userText || "make it higher quality, masterpiece, detailed",
        model: sessionData.model || "JoyFun Spicy",
        token: sessionData.token || null,
        ...sessionData.resolution ? {
          resolution: sessionData.resolution
        } : {},
        image: uploadedImageUrl || sessionData.lastImageUrl || null
      };
      const data = await requestJoyFun(bodyPayload);
      const resultImage = data?.result || data?.output_resource || data?.image;
      if (!data || data.status !== true && data.status !== "success" || !resultImage) {
        throw new Error(data?.message || "Gagal memproses gambar lanjutan.");
      }
      const returnedToken = data.token || bodyPayload.token || "";
      const selectedModelName = data.selected_model?.name || bodyPayload.model;
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • JoyFun Engine`;
      const bodyText = `–  *J O Y  F U N  A I*

Proses rekayasa visual (Image-to-Image) berhasil diselesaikan.

┌  ◦  *Model* : \`${selectedModelName}\`
│  ◦  *Mode* : Image-to-Image (I2I)
└  ◦  *Prompt* : ${bodyPayload.prompt}`;
      const buttons = [{
        name: "cta_copy",
        display_text: "🔑 Salin Token Sesi",
        copy_code: returnedToken
      }];
      let sentMsg;
      if (typeof ctx.sendCta === "function") {
        sentMsg = await ctx.sendCta(bodyText, botFooter, buttons, {
          title: "– JOYFUN AI IMAGE –",
          subtitle: `Model: ${selectedModelName}`,
          media: resultImage,
          quoted: msg
        });
      } else {
        sentMsg = await sock.sendMessage(ctx.id, {
          image: {
            url: resultImage
          },
          caption: bodyText
        }, {
          quoted: msg
        });
      }
      const newMsgId = sentMsg?.key?.id;
      if (newMsgId) {
        recordSessionMessage(chatId, newMsgId, {
          token: returnedToken,
          model: selectedModelName,
          resolution: bodyPayload.resolution,
          lastImageUrl: resultImage
        });
      }
      if (typeof ctx?.react === "function") await ctx.react("✅");
      return true;
    } catch (e) {
      console.error("[JOYFUN BEFORE ERROR]:", e.message);
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
        if (["joyfun", "joyfunai", "joyart", "joyai"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • JoyFun Engine`;
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (rawText === "--reset" || rawText === "--clear" || rawText === "reset" || rawText === "clear") {
        if (global.db.joyFun[chatId]) {
          delete global.db.joyFun[chatId];
          saveDB();
          return ctx.reply("🧹 *Sesi pengeditan JoyFun AI berhasil direset!* Anda dapat membuat gambar baru dari awal.");
        }
        return ctx.reply("ℹ️ Tidak ada sesi gambar JoyFun yang aktif di obrolan ini.");
      }
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      if (flags.listModels || rawText.includes("--models") || rawText.includes("--list") || rawText.trim() === "models") {
        await ctx.react("⏳");
        const {
          data
        } = await axios.get(API_URL, {
          headers: {
            "User-Agent": CONFIG.USER_AGENT
          },
          timeout: 3e4
        });
        const modelsList = data?.models || [];
        if (!modelsList.length) throw new Error("Gagal mengambil daftar model JoyFun.");
        let textList = `–  *J O Y  F U N  M O D E L S*\n\n`;
        modelsList.forEach((m, idx) => {
          textList += `┌  ◦  *${idx + 1}. ${m.name}*\n`;
          textList += `│  ◦  *Key* : \`${m.key}\`\n`;
          textList += `│  ◦  *Deskripsi* : ${m.desc || "-"}\n`;
          textList += `└  ◦  *Biaya/Waktu* : ${m.cost || "0"} pts (${m.time || "-"})\n\n`;
        });
        textList += `Gunakan parameter: \`--model "<nama_model>"\` untuk memilih model.`;
        await ctx.react("📋");
        return ctx.reply(textList.trim());
      }
      if (!rawText && !isMedia) {
        const guideText = `–  *J O Y  F U N  A I*

Layanan rendering visual berkualitas tinggi menggunakan JoyFun Engine dengan dukungan multi-turn editing.

┌  ◦  *Text-to-Image (T2I)* :
│  ├ \`${prefix}joyfun futuristic sports car in neon city\`
│  └ \`${prefix}joyfun cute anime girl --model "JoyFun Spicy Pro🔥" --ratio 16:9\`
│
├  ◦  *Image-to-Image (I2I)* :
│  └ Reply / kirim gambar: \`${prefix}joyfun turn into watercolor painting\`
│
├  ◦  *Sesi Berkelanjutan* :
│  └ Cukup *reply gambar hasil bot* untuk memodifikasi gambar tersebut!
│
└  ◦  *Parameter Flag Tambahan* :
   ├ \`--reset\` (Hapus sesi aktif)
   ├ \`--models\` (Lihat daftar model)
   ├ \`--ratio <16:9 | 1:1 | 9:16>\`
   └ \`--token <jwt>\``;
        return ctx.reply(guideText, {
          quoted: quotedMsg
        });
      }
      await ctx.react("⏳");
      let uploadedImageUrl = null;
      if (isMedia && typeof ctx.download === "function") {
        const buffer = await ctx.download();
        if (buffer && Buffer.isBuffer(buffer)) {
          const uploadRes = await upload(buffer).catch(() => null);
          if (uploadRes?.status && uploadRes?.url) {
            uploadedImageUrl = uploadRes.url;
          }
        }
      }
      const existingSession = global.db.joyFun[chatId];
      const modelToUse = flags.model || existingSession?.model || "JoyFun Spicy";
      const tokenToUse = flags.token || existingSession?.token || null;
      const resolutionToUse = flags.resolution || existingSession?.resolution || undefined;
      const imageToUse = uploadedImageUrl || flags.image || (existingSession?.lastImageUrl ? existingSession.lastImageUrl : null);
      const bodyPayload = {
        prompt: cleanPrompt || flags.prompt || (imageToUse ? "enhance quality, masterpiece" : "a beautiful digital artwork"),
        model: modelToUse,
        token: tokenToUse,
        ...resolutionToUse ? {
          resolution: resolutionToUse
        } : {},
        ...imageToUse ? {
          image: imageToUse
        } : {}
      };
      const data = await requestJoyFun(bodyPayload);
      const resultImage = data?.result || data?.output_resource || data?.image;
      if (!data || data.status !== true && data.status !== "success" || !resultImage) {
        throw new Error(data?.message || "API tidak mengembalikan hasil gambar yang valid.");
      }
      const mode = bodyPayload.image ? "Image-to-Image (I2I)" : "Text-to-Image (T2I)";
      const returnedToken = data.token || bodyPayload.token || "";
      const selectedModelName = data.selected_model?.name || bodyPayload.model;
      const bodyText = `–  *J O Y  F U N  A I*

Proses olah visual berhasil diselesaikan.

┌  ◦  *Mode* : ${mode}
└  ◦  *Model* : \`${selectedModelName}\`

–  *P R O M P T*

“${bodyPayload.prompt}”`;
      let nextCommand = `${prefix}joyfun <tulis_prompt_edit_lanjutan>`;
      if (returnedToken) nextCommand += ` --token ${returnedToken}`;
      const buttons = [{
        name: "cta_copy",
        display_text: "📋 Salin Lanjutan Edit",
        copy_code: nextCommand
      }];
      if (returnedToken) {
        buttons.push({
          name: "cta_copy",
          display_text: "🔑 Salin Token Saja",
          copy_code: returnedToken
        });
      }
      let sentMsg;
      if (typeof ctx.sendCta === "function") {
        sentMsg = await ctx.sendCta(bodyText, botFooter, buttons, {
          title: "– JOYFUN AI –",
          subtitle: `Model: ${selectedModelName}`,
          media: resultImage,
          quoted: quotedMsg
        });
      } else {
        await sock.sendMessage(ctx.id, {
          image: {
            url: resultImage
          },
          caption: bodyText
        }, {
          quoted: quotedMsg
        });
      }
      const sentMsgId = sentMsg?.key?.id;
      if (sentMsgId) {
        recordSessionMessage(chatId, sentMsgId, {
          token: returnedToken,
          model: selectedModelName,
          resolution: bodyPayload.resolution,
          lastImageUrl: resultImage
        });
      }
      await ctx.react("✅");
    } catch (error) {
      console.error("[JoyFun Error]:", error?.message || error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Terjadi kendala pada JoyFun AI: ${errMsg}`);
    }
  }
};