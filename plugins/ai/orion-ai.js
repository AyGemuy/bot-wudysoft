import axios from "axios";
import db from "../../data/db.js";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/ai/orion-ai`;
const SESSION_TIMEOUT = 20 * 60 * 1e3;
const CONFIG = {
  TIMEOUT: 9e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};

function initDB(jid = null, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.orionAi) global.db.orionAi = {};
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
    if (["chatmodel", "model_chat"].includes(key)) key = "chatModel";
    if (["imagemodel", "model_img", "imgmodel"].includes(key)) key = "imageModel";
    if (["chat_id", "cid"].includes(key)) key = "chatId";
    if (["aspect", "ar"].includes(key)) key = "aspectRatio";
    if (["img", "image", "draw", "generate"].includes(key)) key = "gen";
    if (["list", "model"].includes(key) && rawVal === undefined) key = "models";
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
async function requestOrion(payload) {
  const res = await axios.post(API_URL, payload, {
    headers: {
      "Content-Type": "application/json",
      "User-Agent": CONFIG.USER_AGENT
    },
    timeout: CONFIG.TIMEOUT
  });
  return res.data;
}

function recordSessionMessage(chatId, messageId, sessionData) {
  if (!messageId || !chatId) return;
  initDB();
  if (!global.db.orionAi[chatId]) {
    global.db.orionAi[chatId] = {
      chatId: null,
      chatModel: null,
      imageModel: null,
      msgIds: [],
      lastMsgId: null,
      updatedAt: Date.now(),
      expireTime: Date.now() + SESSION_TIMEOUT
    };
  }
  const s = global.db.orionAi[chatId];
  if (sessionData.chatId !== undefined) s.chatId = sessionData.chatId;
  if (sessionData.chatModel !== undefined) s.chatModel = sessionData.chatModel;
  if (sessionData.imageModel !== undefined) s.imageModel = sessionData.imageModel;
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
  name: "orionai",
  aliases: ["orion", "orion-ai", "orionchat"],
  description: "Advanced Multi-Model AI Assistant & Image Generator via Orion AI.",
  category: "AI",
  limit: true,
  example: "• Chat: orionai apa kabar bang\n• Gambar: orionai buatkan gambar kucing --gen\n• Daftar Model: orionai --models",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const chatId = ctx?.id || msg?.key?.remoteJid;
      if (!chatId) return;
      initDB();
      if (!global.db.orionAi[chatId]) return;
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      const sessionData = global.db.orionAi[chatId];
      if (Date.now() > sessionData.expireTime) {
        delete global.db.orionAi[chatId];
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
        content: userText || (uploadedMediaUrl ? "Jelaskan media/gambar ini secara detail" : "Lanjutkan"),
        chatId: sessionData.chatId || null,
        chatModel: sessionData.chatModel || null,
        imageModel: sessionData.imageModel || null,
        ...uploadedMediaUrl ? {
          attachments: [uploadedMediaUrl]
        } : {}
      };
      const res = await requestOrion(bodyPayload);
      if (!res || !res.ok || !res.data) {
        throw new Error(res?.message || res?.error || "Gagal mendapatkan respon dari Orion AI.");
      }
      const resultData = res.data;
      const answerText = (resultData.text || "Tidak ada respon teks.").trim();
      const newChatId = resultData.chatId || sessionData.chatId || null;
      const attImages = (resultData.att || []).filter(a => a.mimeType && a.mimeType.startsWith("image/"));
      const bodyText = answerText;
      const buttons = [{
        name: "cta_copy",
        display_text: "Salin Jawaban",
        copy_code: answerText
      }];
      let sentMsg;
      if (attImages.length > 0) {
        sentMsg = await sock.sendMessage(ctx.id, {
          image: {
            url: attImages[0].url
          },
          caption: bodyText
        }, {
          quoted: msg
        });
      } else if (typeof ctx.sendCta === "function") {
        sentMsg = await ctx.sendCta(bodyText, "", buttons, {
          media: uploadedMediaUrl || null,
          quoted: msg
        });
      } else if (uploadedMediaUrl) {
        sentMsg = await sock.sendMessage(ctx.id, {
          image: {
            url: uploadedMediaUrl
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
        recordSessionMessage(chatId, newMsgId, {
          chatId: newChatId,
          chatModel: bodyPayload.chatModel,
          imageModel: bodyPayload.imageModel
        });
      }
      if (typeof ctx?.react === "function") await ctx.react("✨");
      return true;
    } catch (e) {
      console.error("[ORION BEFORE ERROR]:", e.message);
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
        if (["orionai", "orion", "orion-ai"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (rawText === "--reset" || rawText === "--clear" || rawText === "reset" || rawText === "clear") {
        if (global.db.orionAi[chatId]) {
          delete global.db.orionAi[chatId];
          saveDB();
          return ctx.reply("🧹 *Sesi percakapan Orion AI berhasil direset!* Silakan mulai topik baru.");
        }
        return ctx.reply("ℹ️ Tidak ada sesi Orion AI yang aktif di room chat ini.");
      }
      if (rawText.includes("--models") || rawText.includes("--list") || rawText.trim() === "models") {
        await ctx.react("⏳");
        const resModels = await axios.get(`${API_URL}?mode=models`, {
          headers: {
            "User-Agent": CONFIG.USER_AGENT
          },
          timeout: 3e4
        });
        const modelsData = resModels.data?.data;
        if (!modelsData) throw new Error("Gagal mengambil daftar model Orion AI.");
        let textList = `–  *O R I O N  A I  M O D E L S*\n\n`;
        textList += `┌  ◦  *Chat / Language Models* :\n`;
        (modelsData.chat || []).forEach(m => {
          textList += `│  • \`${m.id}\` — *${m.name}* (${m.pro ? "PRO" : "FREE"})\n`;
        });
        textList += `└  ◦  *Total* : ${(modelsData.chat || []).length} Models\n\n`;
        textList += `┌  ◦  *Image Generation Models* :\n`;
        (modelsData.img || []).forEach(m => {
          textList += `│  • \`${m.id}\` — *${m.name}* (${m.pro ? "PRO" : "FREE"})\n`;
        });
        textList += `└  ◦  *Total* : ${(modelsData.img || []).length} Models`;
        await ctx.react("📋");
        return ctx.reply(textList);
      }
      if (!rawText && !isMedia) {
        const guideText = `–  *O R I O N  A I*

Layanan asisten AI multi-model mutakhir untuk percakapan teks, penulisan kode, dan pembuatan gambar.

┌  ◦  *Chat Standar* :
│  └ \`${prefix}orionai Halo, apa kabar?\`
│
├  ◦  *Pilihan Model Chat* :
│  ├ \`${prefix}orionai Jelaskan fisika kuantum --model claude-sonnet-5\`
│  └ \`${prefix}orionai Buatkan kode Python --model deepseek-reasoner\`
│
├  ◦  *Generate Gambar (T2I)* :
│  ├ \`${prefix}orionai a cute cat in the garden --gen\`
│  └ \`${prefix}orionai cyberpunk city --gen --imagemodel flux-2-dev --aspect 16:9\`
│
├  ◦  *Edit Gambar (I2I)* :
│  └ Kirim / balas gambar: \`${prefix}orionai make this anime style --gen\`
│
├  ◦  *Multi-Turn Conversation* :
│  └ Cukup *reply pesan bot* untuk melanjutkan percakapan.
│
└  ◦  *Parameter Flag Tambahan* :
   ├ \`--reset\` (Hapus sesi aktif)
   └ \`--models\` (Lihat daftar model lengkap)`;
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
      const isGenMode = Boolean(flags.gen || flags.mode === "gen");
      if (isGenMode) {
        const genPayload = {
          mode: "gen",
          prompt: cleanPrompt || flags.prompt || "a beautiful digital art",
          imageModel: flags.imageModel || flags.model || "flux-2-dev",
          ...flags.aspectRatio ? {
            aspectRatio: flags.aspectRatio
          } : {},
          ...uploadedMediaUrl ? {
            media: uploadedMediaUrl
          } : {}
        };
        const res = await requestOrion(genPayload);
        if (!res || !res.ok || !res.data) {
          throw new Error(res?.message || res?.error || "Gagal meng-generate gambar dari Orion AI.");
        }
        const dataGen = res.data;
        const images = dataGen.images || [];
        const captionText = (dataGen.text || genPayload.prompt).trim();
        if (images.length > 0 && images[0].url) {
          await sock.sendMessage(ctx.id, {
            image: {
              url: images[0].url
            },
            caption: captionText
          }, {
            quoted: quotedMsg
          });
        } else {
          await ctx.reply(captionText);
        }
        await ctx.react("🎨");
        return;
      }
      const existingSession = global.db.orionAi[chatId];
      const chatModelToUse = flags.chatModel || flags.model || existingSession?.chatModel || null;
      const chatIdToUse = flags.chatId || existingSession?.chatId || null;
      const bodyPayload = {
        mode: "chat",
        content: cleanPrompt || flags.content || (uploadedMediaUrl ? "Jelaskan gambar ini secara detail" : "Halo"),
        chatId: chatIdToUse,
        chatModel: chatModelToUse,
        imageModel: flags.imageModel || existingSession?.imageModel || null,
        ...flags.thinking !== undefined ? {
          thinking: Boolean(flags.thinking)
        } : {},
        ...uploadedMediaUrl ? {
          attachments: [uploadedMediaUrl]
        } : {}
      };
      const res = await requestOrion(bodyPayload);
      if (!res || !res.ok || !res.data) {
        throw new Error(res?.message || res?.error || "Gagal mendapatkan respon dari Orion AI.");
      }
      const resultData = res.data;
      const answerText = (resultData.text || "Tidak ada respon teks.").trim();
      const returnedChatId = resultData.chatId || bodyPayload.chatId || null;
      const attImages = (resultData.att || []).filter(a => a.mimeType && a.mimeType.startsWith("image/"));
      const bodyText = answerText;
      let nextCommand = `${prefix}orionai <tulis_prompt_lanjutan>`;
      if (returnedChatId) nextCommand += ` --chatId ${returnedChatId}`;
      if (bodyPayload.chatModel) nextCommand += ` --model ${bodyPayload.chatModel}`;
      const buttons = [{
        name: "cta_copy",
        display_text: "Salin Lanjutan Sesi",
        copy_code: nextCommand
      }, {
        name: "cta_copy",
        display_text: "Salin Jawaban",
        copy_code: answerText
      }];
      let sentMsg;
      if (attImages.length > 0) {
        sentMsg = await sock.sendMessage(ctx.id, {
          image: {
            url: attImages[0].url
          },
          caption: bodyText
        }, {
          quoted: quotedMsg
        });
      } else if (typeof ctx.sendCta === "function") {
        sentMsg = await ctx.sendCta(bodyText, "", buttons, {
          media: uploadedMediaUrl || null,
          quoted: quotedMsg
        });
      } else if (uploadedMediaUrl) {
        sentMsg = await sock.sendMessage(ctx.id, {
          image: {
            url: uploadedMediaUrl
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
        recordSessionMessage(chatId, sentMsgId, {
          chatId: returnedChatId,
          chatModel: bodyPayload.chatModel,
          imageModel: bodyPayload.imageModel
        });
      }
      await ctx.react("✨");
    } catch (error) {
      console.error("[Orion AI Error]:", error?.message || error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Terjadi kendala pada Orion AI: ${errMsg}`);
    }
  }
};