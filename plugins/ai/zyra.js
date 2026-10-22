import axios from "axios";
import db from "../../data/db.js";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/ai/zyra`;
const SESSION_TIMEOUT = 25 * 60 * 1e3;
const CONFIG = {
  TIMEOUT: 65e3,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};

function initDB(jid = null, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.zyraAi) global.db.zyraAi = {};
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

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /--([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1].toLowerCase();
    let rawVal = match[2];
    let val = true;
    if (["mod", "m"].includes(key)) key = "model";
    if (["img", "image"].includes(key)) key = "media";
    if (["generate", "draw", "txt2img"].includes(key)) key = "is_image";
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
async function requestZyraAi(payload = {}) {
  const {
    data
  } = await axios.post(API_URL, payload, {
    headers: {
      "Content-Type": "application/json",
      "User-Agent": CONFIG.USER_AGENT
    },
    timeout: CONFIG.TIMEOUT
  }).catch(err => {
    return axios.get(API_URL, {
      params: payload,
      headers: {
        "User-Agent": CONFIG.USER_AGENT
      },
      timeout: CONFIG.TIMEOUT
    });
  });
  if (!data?.status) {
    throw new Error(data?.message || data?.error || "Gagal memproses respons dari Zyra AI.");
  }
  return data;
}

function recordSession(chatId, messageId, updatedHistory, model, lastMedia) {
  if (!chatId) return;
  initDB();
  if (!global.db.zyraAi[chatId]) {
    global.db.zyraAi[chatId] = {
      history: [],
      model: model || "gemini-2.5-flash",
      last_media: lastMedia || null,
      msgIds: [],
      lastMsgId: null,
      updatedAt: Date.now(),
      expireTime: Date.now() + SESSION_TIMEOUT
    };
  }
  const s = global.db.zyraAi[chatId];
  if (Array.isArray(updatedHistory) && updatedHistory.length > 0) {
    s.history = updatedHistory.slice(-20);
  }
  if (model) s.model = model;
  if (lastMedia) s.last_media = lastMedia;
  if (messageId) {
    if (!Array.isArray(s.msgIds)) s.msgIds = [];
    if (!s.msgIds.includes(messageId)) s.msgIds.push(messageId);
    s.lastMsgId = messageId;
  }
  s.updatedAt = Date.now();
  s.expireTime = Date.now() + SESSION_TIMEOUT;
  saveDB();
}
export default {
  name: "zyra",
  aliases: ["zyraai", "geminizyra"],
  description: "AI Multimodal Assistant berbasis Zyra Engine (Gemini 2.5 Flash, Vision & Flux Image Gen).",
  category: "AI",
  limit: true,
  example: "zyra Jelaskan teori relativitas\nzyra cute cat --image\nBalas/reply pesan bot untuk melanjutkan percakapan.",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const chatId = ctx?.id || msg?.key?.remoteJid;
      if (!chatId) return;
      initDB();
      if (!global.db.zyraAi[chatId]) return;
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      const sessionData = global.db.zyraAi[chatId];
      if (Date.now() > sessionData.expireTime) {
        delete global.db.zyraAi[chatId];
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
      const activeMedia = uploadedMediaUrl || sessionData.last_media;
      const promptText = userText || (activeMedia ? "Jelaskan gambar ini secara detail" : "Lanjutkan");
      const payload = {
        mode: "chat",
        prompt: promptText,
        messages: Array.isArray(sessionData.history) ? sessionData.history : [],
        model: sessionData.model || "gemini-2.5-flash",
        ...activeMedia ? {
          media: activeMedia
        } : {}
      };
      const data = await requestZyraAi(payload);
      const answerText = (data.result || data.chunks?.[0]?.candidates?.[0]?.content?.parts?.[0]?.text || "Tidak ada respon.").trim();
      const bodyText = answerText;
      const buttons = [{
        name: "cta_copy",
        display_text: "📄 Salin Jawaban",
        copy_code: answerText
      }];
      let sentMsg;
      if (typeof ctx.sendCta === "function") {
        sentMsg = await ctx.sendCta(bodyText, `_Model: ${payload.model}_`, buttons, {
          media: activeMedia || null,
          quoted: msg
        });
      } else if (activeMedia) {
        sentMsg = await sock.sendMessage(ctx.id, {
          image: {
            url: activeMedia
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
      recordSession(chatId, newMsgId, data.history || sessionData.history, payload.model, activeMedia);
      if (typeof ctx?.react === "function") await ctx.react("✨");
      return true;
    } catch (e) {
      console.error("[ZYRA BEFORE ERROR]:", e.message);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      const chatId = ctx.id;
      const senderId = ctx.sender || ctx.author || msg.key?.participant || msg.key?.remoteJid || ctx.id;
      initDB(senderId, ctx.pushName);
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["zyra", "zyraai", "geminizyra"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (rawText === "--reset" || rawText === "--clear" || rawText === "reset" || rawText === "clear") {
        if (global.db.zyraAi[chatId]) {
          delete global.db.zyraAi[chatId];
          saveDB();
          return ctx.reply("🧹 *Sesi percakapan Zyra AI berhasil direset!* Silakan mulai obrolan baru.");
        }
        return ctx.reply("ℹ️ Tidak ada sesi aktif di percakapan ini.");
      }
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      if (!rawText && !isMedia) {
        const sessionData = global.db.zyraAi[chatId];
        const activeModel = sessionData?.model || "gemini-2.5-flash";
        const guideText = `–  *Z Y R A  A I*

Layanan asisten cerdas multimodal bertenaga Vertex Gemini 2.5 Flash & Flux Image Generator.

┌  ◦  *Model Aktif* : \`${activeModel}\`
│
├  ◦  *Mode Percakapan (Teks)* :
│  └ \`${prefix}zyra Jelaskan perbedaan AI dan Machine Learning\`
│
├  ◦  *Mode Vision (Analisis Foto)* :
│  └ Kirim/balas gambar: \`${prefix}zyra Analisis isi foto ini secara detail\`
│
├  ◦  *Mode Image Generation (Flux Engine)* :
│  └ \`${prefix}zyra cute cat --image\`
│
├  ◦  *Sesi Berkelanjutan (Multi-Turn)* :
│  └ Cukup *reply pesan balasan bot* untuk melanjutkan obrolan secara langsung tanpa command!
│
└  ◦  *Flags Tambahan* :
   ├ \`--image\` (Hasilkan gambar visual)
   ├ \`--model <nama_model>\` (Pakai model spesifik)
   ├ \`--media <image_url>\` (Sertakan URL gambar)
   └ \`--reset\` (Hapus riwayat obrolan)`;
        return ctx.reply(guideText, {
          quoted: quotedMsg
        });
      }
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
      const isImageGen = flags.is_image === true || flags.mode === "image";
      const existingSession = global.db.zyraAi[chatId];
      const activeMedia = uploadedMediaUrl || flags.media || null;
      const modelToUse = flags.model || existingSession?.model || "gemini-2.5-flash";
      if (isImageGen) {
        await ctx.react("🎨");
        const promptImage = cleanPrompt || "A cute cat artwork masterpiece";
        const payload = {
          mode: "image",
          prompt: promptImage,
          width: flags.width || 512,
          height: flags.height || 512,
          steps: flags.steps || 20,
          ...flags
        };
        const data = await requestZyraAi(payload);
        const imageUrl = data?.result?.url || (typeof data?.result === "string" ? data.result : null);
        if (!imageUrl) throw new Error("Gagal menerima URL gambar dari Zyra AI.");
        const seedInfo = data?.result?.seed !== undefined ? data.result.seed : "-";
        const costInfo = data?.result?.cost !== undefined ? data.result.cost : "-";
        const captionText = `–  *Z Y R A  I M A G E*\n\n` + `┌  ◦  *Prompt* : ${promptImage}\n` + `├  ◦  *Seed* : ${seedInfo}\n` + `├  ◦  *Cost* : ${costInfo}\n` + `└  ◦  *Engine* : Flux Gen / Firebase Storage`;
        const buttons = [{
          name: "cta_copy",
          display_text: "📄 Salin Prompt",
          copy_code: promptImage
        }];
        if (typeof ctx.sendCta === "function") {
          await ctx.sendCta(captionText, "", buttons, {
            media: imageUrl,
            quoted: quotedMsg
          });
        } else {
          await sock.sendMessage(ctx.id, {
            image: {
              url: imageUrl
            },
            caption: captionText
          }, {
            quoted: quotedMsg
          });
        }
        await ctx.react("✨");
        return;
      }
      await ctx.react("💭");
      const promptText = cleanPrompt || flags.prompt || (activeMedia ? "Jelaskan gambar ini secara detail dan mendalam" : "Halo!");
      const payload = {
        mode: "chat",
        prompt: promptText,
        messages: Array.isArray(existingSession?.history) ? existingSession.history : [],
        model: modelToUse,
        ...activeMedia ? {
          media: activeMedia
        } : {},
        ...flags
      };
      const data = await requestZyraAi(payload);
      const answerText = (data.result || data.chunks?.[0]?.candidates?.[0]?.content?.parts?.[0]?.text || "Tidak ada respon yang diterima.").trim();
      const bodyText = answerText;
      const buttons = [{
        name: "cta_copy",
        display_text: "📄 Salin Jawaban",
        copy_code: answerText
      }];
      let sentMsg;
      if (typeof ctx.sendCta === "function") {
        sentMsg = await ctx.sendCta(bodyText, `_Model: ${modelToUse}_`, buttons, {
          media: activeMedia || null,
          quoted: quotedMsg
        });
      } else if (activeMedia) {
        sentMsg = await sock.sendMessage(ctx.id, {
          image: {
            url: activeMedia
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
      recordSession(chatId, sentMsgId, data.history || existingSession?.history, modelToUse, activeMedia);
      await ctx.react("✨");
    } catch (error) {
      console.error("[Zyra AI Error]:", error?.message || error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || error.message || "Gagal memproses permintaan ke Zyra AI.";
      ctx.reply(`❌ Terjadi kendala: ${errMsg}`);
    }
  }
};