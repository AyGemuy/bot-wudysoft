import axios from "axios";
import db from "../../data/db.js";
import { upload } from "../../lib/upload.js";
import { simpleQuoted } from "../../lib/quoted.js";

const API_URL = `${global.bot?.api?.wudysoft}/api/ai/pixster`;
const SESSION_TIMEOUT = 25 * 60 * 1e3; // 25 Menit
const CONFIG = {
  TIMEOUT: 65e3,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  ITEMS_PER_PAGE: 8
};

function initDB(jid = null, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.pixsterAi) global.db.pixsterAi = {};
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
    if (["tipe", "type"].includes(key)) key = "mode";

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
  return {
    flags,
    cleanPrompt
  };
}

// Request API Pixster
async function requestPixsterAi(payload = {}) {
  const { data } = await axios.get(API_URL, {
    params: payload,
    headers: {
      "User-Agent": CONFIG.USER_AGENT
    },
    timeout: CONFIG.TIMEOUT
  });
  if (!data?.status) {
    throw new Error(data?.message || data?.details || "Gagal memproses permintaan ke Pixster AI.");
  }
  return data;
}

// Ekstraksi jawaban teks dari format respon chat / vision
function parseResponseText(resData) {
  if (!resData) return "Tidak ada respon teks.";
  if (typeof resData === "string") return resData;
  if (resData.response) return resData.response;
  if (Array.isArray(resData.candidates) && resData.candidates[0]?.content?.parts) {
    return resData.candidates[0].content.parts.map(p => p.text || "").join("\n").trim();
  }
  return JSON.stringify(resData);
}

function recordSession(chatId, messageId, model, lastMedia) {
  if (!chatId) return;
  initDB();
  if (!global.db.pixsterAi[chatId]) {
    global.db.pixsterAi[chatId] = {
      model: model || "gpt-5-nano",
      last_media: lastMedia || null,
      msgIds: [],
      lastMsgId: null,
      updatedAt: Date.now(),
      expireTime: Date.now() + SESSION_TIMEOUT
    };
  }
  const s = global.db.pixsterAi[chatId];
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
  name: "pixster",
  aliases: ["pixsterai", "pxai", "pixchat"],
  description: "AI Multimodal Assistant berbasis Pixster (Chat GPT-5, Claude, Gemini Vision & DB Session).",
  category: "AI",
  limit: true,
  example: "pixster Jelaskan teori relativitas\npixster Analisis gambar ini (kirim/balas gambar)\nBalas/reply pesan bot untuk melanjutkan percakapan.",

  before: async (msg, { sock, ctx }) => {
    try {
      const chatId = ctx?.id || msg?.key?.remoteJid;
      if (!chatId) return;
      initDB();
      if (!global.db.pixsterAi[chatId]) return;

      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;

      const sessionData = global.db.pixsterAi[chatId];
      if (Date.now() > sessionData.expireTime) {
        delete global.db.pixsterAi[chatId];
        saveDB();
        return;
      }

      const quotedStanzaId = ctx?.quoted?.id || msg?.message?.extendedTextMessage?.contextInfo?.stanzaId;
      const isQuotingAi = quotedStanzaId && (
        quotedStanzaId === sessionData.lastMsgId ||
        (Array.isArray(sessionData.msgIds) && sessionData.msgIds.includes(quotedStanzaId))
      );

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
      const mode = activeMedia ? "vision" : "chat";
      const modelToUse = mode === "vision" ? "gemini-2.5-flash" : (sessionData.model || "gpt-5-nano");

      const payload = {
        mode: mode,
        prompt: userText || (activeMedia ? "Jelaskan gambar ini" : "Lanjutkan"),
        model: modelToUse,
        ...(activeMedia ? { image: activeMedia } : {})
      };

      const data = await requestPixsterAi(payload);
      const answerText = parseResponseText(data?.data);
      const bodyText = answerText;

      const buttons = [{
        name: "cta_copy",
        display_text: "📄 Salin Jawaban",
        copy_code: answerText
      }];

      let sentMsg;
      if (typeof ctx.sendCta === "function") {
        sentMsg = await ctx.sendCta(bodyText, `_Model: ${data?.data?.modelUsed || data?.data?.modelVersion || modelToUse}_`, buttons, {
          media: activeMedia || null,
          quoted: msg
        });
      } else if (activeMedia) {
        sentMsg = await sock.sendMessage(ctx.id, {
          image: { url: activeMedia },
          caption: bodyText
        }, { quoted: msg });
      } else {
        sentMsg = await sock.sendMessage(ctx.id, {
          text: bodyText
        }, { quoted: msg });
      }

      const newMsgId = sentMsg?.key?.id;
      recordSession(chatId, newMsgId, sessionData.model, activeMedia);

      if (typeof ctx?.react === "function") await ctx.react("✨");
      return true;
    } catch (e) {
      console.error("[PIXSTER BEFORE ERROR]:", e.message);
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
        if (["pixster", "pixsterai", "pxai", "pixchat"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }

      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;

      // 1. Reset Sesi
      if (rawText === "--reset" || rawText === "--clear" || rawText === "reset" || rawText === "clear") {
        if (global.db.pixsterAi[chatId]) {
          delete global.db.pixsterAi[chatId];
          saveDB();
          return ctx.reply("🧹 *Sesi percakapan Pixster AI berhasil direset!* Silakan mulai topik baru.");
        }
        return ctx.reply("ℹ️ Tidak ada sesi aktif di percakapan ini.");
      }

      const { flags, cleanPrompt } = parseFlags(rawText);
      const existingSession = global.db.pixsterAi[chatId];

      // 2. Set Model Pilihan
      if (flags.setmodel) {
        const chosenModel = String(flags.setmodel).trim();
        recordSession(chatId, null, chosenModel, existingSession?.last_media);

        await ctx.react("✅");
        return ctx.reply(
          `–  *P I X S T E R  A I*\n\n` +
          `┌  ◦  *Model Aktif* : \`${chosenModel}\`\n` +
          `└  ◦  *Status* : Tersimpan ke sesi chat Anda\n\n` +
          `_Ketik \`${prefix}pixster <pertanyaan>\` untuk mulai berbicara dengan model ini._`
        );
      }

      // 3. CTA Pagination List Models
      if (flags.models || flags.list || rawText.startsWith("--list") || flags.page) {
        const availableModels = [
          { name: "gpt-5-nano", type: "Chat", desc: "Fast & Smartest Next-Gen OpenAI Model" },
          { name: "gpt-4o-mini", type: "Chat / Vision", desc: "Efficient & High-Performance Multimodal" },
          { name: "gpt-4o", type: "Chat / Vision", desc: "Flagship Omni Intelligence" },
          { name: "gpt-4", type: "Chat", desc: "Standard GPT-4 Reasoning Engine" },
          { name: "gpt-3.5-turbo", type: "Chat", desc: "Classic High-Speed Conversational" },
          { name: "gemini-2.5-flash", type: "Chat / Vision", desc: "Google Ultra-Fast Next-Gen Vision" },
          { name: "gemini-1.5-flash", type: "Chat / Vision", desc: "Google Flash Long Context & Vision" },
          { name: "claude-3-5-sonnet", type: "Chat", desc: "Anthropic Top-Tier Coding & Nuance" }
        ];

        const searchQuery = flags.search || flags.query || (!flags.page && cleanPrompt) || "";
        let matched = availableModels;
        if (searchQuery && searchQuery !== "true") {
          const kw = searchQuery.toLowerCase();
          matched = availableModels.filter(m => m.name.toLowerCase().includes(kw) || m.desc.toLowerCase().includes(kw));
        }

        const page = Math.max(1, Number(flags.page) || 1);
        const totalPages = Math.ceil(matched.length / CONFIG.ITEMS_PER_PAGE) || 1;
        const pageItems = matched.slice((page - 1) * CONFIG.ITEMS_PER_PAGE, page * CONFIG.ITEMS_PER_PAGE);

        const rows = pageItems.map((m, idx) => {
          const globalIdx = (page - 1) * CONFIG.ITEMS_PER_PAGE + idx + 1;
          return {
            title: `${globalIdx}. ${m.name}`.slice(0, 24),
            id: `${prefix}pixster --setmodel "${m.name}"`,
            description: `[${m.type}] ${m.desc}`.slice(0, 60)
          };
        });

        let baseCmd = `${prefix}pixster`;
        if (searchQuery && searchQuery !== "true") baseCmd += ` --search "${searchQuery}"`;
        else baseCmd += ` --list`;

        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: `PILIH MODEL AI (${pageItems.length})`,
            sections: [{
              title: `DAFTAR MODEL (Hal ${page}/${totalPages})`,
              rows: rows
            }]
          })
        }];

        if (page > 1) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: `⬅️ Hal ${page - 1}`,
              id: `${baseCmd} --page ${page - 1}`
            })
          });
        }
        if (page < totalPages) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: `➡️ Hal ${page + 1}`,
              id: `${baseCmd} --page ${page + 1}`
            })
          });
        }

        const bodyText = `–  *P I X S T E R  -  M O D E L S*\n\n` +
          `┌  ◦  *Total Model* : ${matched.length}\n` +
          `├  ◦  *Halaman* : ${page} / ${totalPages}\n` +
          `└  ◦  *Penyedia* : OpenAI, Anthropic, Google Gemini\n\n` +
          `_Pilih model yang ingin digunakan melalui menu di bawah:_`;

        const options = {
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 1,
              divider_indices: [1],
              list_title: `Pixster Models`,
              button_title: `Buka Hal ${page}`
            }
          },
          quoted: quotedMsg
        };

        if (typeof ctx.sendCta === "function") {
          await ctx.sendCta(bodyText, "", buttons, options);
        } else {
          let fallback = `${bodyText}\n\n` + rows.map(r => `• *${r.title}*\n  Perintah: \`${r.id}\``).join("\n\n");
          if (totalPages > 1) {
            fallback += `\n\n_Pindah Halaman: Ketik \`${baseCmd} --page ${page < totalPages ? page + 1 : page - 1}\`_`;
          }
          await ctx.reply(fallback);
        }

        await ctx.react("✅");
        return;
      }

      // 4. Mode Chat & Vision
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      if (!rawText && !isMedia) {
        const activeModel = existingSession?.model || "gpt-5-nano";
        const guideText = `–  *P I X S T E R  A I*

Asisten percakapan cerdas multimodal berbasis ChatGPT-5, Gemini 2.5 & Claude.

┌  ◦  *Model Aktif* : \`${activeModel}\`
│
├  ◦  *Chat Standar* :
│  └ \`${prefix}pixster Berikan ide topik skripsi informatika\`
│
├  ◦  *Analisis Gambar (Vision)* :
│  └ Kirim/balas gambar: \`${prefix}pixster Jelaskan apa yang terjadi di foto ini\`
│
├  ◦  *Ganti Model AI (CTA Menu)* :
│  └ \`${prefix}pixster --list\`
│
├  ◦  *Sesi Berkelanjutan (Multi-Turn)* :
│  └ Cukup *reply pesan balasan bot* untuk melanjutkan obrolan secara langsung!
│
└  ◦  *Flags Tambahan* :
   ├ \`--model <nama_model>\` (Pakai model spesifik)
   ├ \`--media <image_url>\` (Sertakan URL gambar)
   └ \`--reset\` (Hapus riwayat sesi)`;

        return ctx.reply(guideText, { quoted: quotedMsg });
      }

      await ctx.react("💭");

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

      const inputImage = uploadedMediaUrl || flags.media || null;
      const mode = inputImage ? "vision" : "chat";
      const modelToUse = flags.model || (mode === "vision" ? "gemini-2.5-flash" : (existingSession?.model || "gpt-5-nano"));
      const promptText = cleanPrompt || flags.prompt || (inputImage ? "Describe this image in detail" : "Halo");

      const payload = {
        mode: mode,
        prompt: promptText,
        model: modelToUse,
        ...(inputImage ? { image: inputImage } : {})
      };

      const data = await requestPixsterAi(payload);
      const answerText = parseResponseText(data?.data);
      const bodyText = answerText;

      const buttons = [{
        name: "cta_copy",
        display_text: "📄 Salin Jawaban",
        copy_code: answerText
      }];

      let sentMsg;
      if (typeof ctx.sendCta === "function") {
        sentMsg = await ctx.sendCta(bodyText, `_Model: ${data?.data?.modelUsed || data?.data?.modelVersion || modelToUse}_`, buttons, {
          media: inputImage || null,
          quoted: quotedMsg
        });
      } else if (inputImage) {
        sentMsg = await sock.sendMessage(ctx.id, {
          image: { url: inputImage },
          caption: bodyText
        }, { quoted: quotedMsg });
      } else {
        sentMsg = await sock.sendMessage(ctx.id, {
          text: bodyText
        }, { quoted: quotedMsg });
      }

      const sentMsgId = sentMsg?.key?.id;
      recordSession(chatId, sentMsgId, existingSession?.model || modelToUse, inputImage);

      await ctx.react("✨");
    } catch (error) {
      console.error("[Pixster AI Error]:", error?.message || error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.details || error.message || "Gagal memproses permintaan ke Pixster AI.";
      ctx.reply(`❌ Terjadi kendala: ${errMsg}`);
    }
  }
};