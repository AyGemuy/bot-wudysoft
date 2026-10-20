import axios from "axios";
import db from "../../data/db.js";
import { upload } from "../../lib/upload.js";
import { simpleQuoted } from "../../lib/quoted.js";

const API_URL = `${global.bot?.api?.wudysoft}/api/ai/thebetter`;
const SESSION_TIMEOUT = 25 * 60 * 1e3; // 25 Menit
const CONFIG = {
  TIMEOUT: 18e4, // 180 detik sesuai polling pemrosesan gambar S3
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  ITEMS_PER_PAGE: 8
};

function initDB(jid = null, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.thebetterAi) global.db.thebetterAi = {};
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

    if (["mod", "m"].includes(key)) key = "mode";
    if (["img", "image"].includes(key)) key = "media";
    if (["theme", "template", "tpl"].includes(key)) key = "theme_id";

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

// Request API TheBetter AI (Dukungan JSON & Buffer Binary Gambar)
async function requestTheBetterAi(payload = {}, asBuffer = false) {
  const config = {
    headers: { "User-Agent": CONFIG.USER_AGENT },
    timeout: CONFIG.TIMEOUT
  };

  if (asBuffer) {
    config.responseType = "arraybuffer";
  }

  const res = await axios.get(API_URL, {
    params: payload,
    ...config
  }).catch(err => {
    // Fallback POST jika diperlukan
    return axios.post(API_URL, payload, { ...config });
  });

  if (asBuffer) {
    return {
      buffer: Buffer.from(res.data),
      contentType: res.headers["content-type"] || "image/jpeg"
    };
  }

  return res.data;
}

function recordSession(chatId, messageId, mode, lastMedia, themeId, themeName) {
  if (!chatId) return;
  initDB();
  if (!global.db.thebetterAi[chatId]) {
    global.db.thebetterAi[chatId] = {
      mode: mode || "enhance",
      last_media: lastMedia || null,
      theme_id: themeId || null,
      theme_name: themeName || null,
      msgIds: [],
      lastMsgId: null,
      updatedAt: Date.now(),
      expireTime: Date.now() + SESSION_TIMEOUT
    };
  }
  const s = global.db.thebetterAi[chatId];
  if (mode) s.mode = mode;
  if (lastMedia) s.last_media = lastMedia;
  if (themeId) s.theme_id = themeId;
  if (themeName) s.theme_name = themeName;
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
  name: "thebetter",
  aliases: ["thebetterai", "remini", "tbai", "hdphoto"],
  description: "Ultra HD Photo Enhancer, Restyle, Face-Swapper & Edit via TheBetter Engine (Full DB Session & Vision).",
  category: "AI",
  limit: true,
  example: "thebetter --mode enhance (Kirim/balas foto)\nthebetter add sunglasses --mode chat-edit\nBalas/reply media bot untuk memproses transformasi ulang.",

  before: async (msg, { sock, ctx }) => {
    try {
      const chatId = ctx?.id || msg?.key?.remoteJid;
      if (!chatId) return;
      initDB();
      if (!global.db.thebetterAi[chatId]) return;

      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;

      const sessionData = global.db.thebetterAi[chatId];
      if (Date.now() > sessionData.expireTime) {
        delete global.db.thebetterAi[chatId];
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

      if (typeof ctx?.react === "function") await ctx.react("🎨");

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

      const inputImage = uploadedMediaUrl || sessionData.last_media;
      if (!inputImage) return;

      const { flags, cleanPrompt } = parseFlags(userText);
      const activeMode = flags.mode || (cleanPrompt ? "chat-edit" : (sessionData.mode || "enhance"));

      const queryParams = {
        action: "generate",
        mode: activeMode,
        image: inputImage,
        prompt: cleanPrompt || "Enhance details and quality",
        theme_id: flags.theme_id || sessionData.theme_id || undefined,
        ...flags
      };

      const resultMedia = await requestTheBetterAi(queryParams, true);
      if (!resultMedia?.buffer) throw new Error("Gagal menghasilkan gambar dari TheBetter AI.");

      const bodyText = `–  *T H E  B E T T E R  A I*\n\n` +
        `┌  ◦  *Mode* : ${activeMode}\n` +
        `├  ◦  *Prompt* : ${queryParams.prompt || "-"}\n` +
        `└  ◦  *Engine* : Photo Enhancer v3.11`;

      const uploadResult = await upload(resultMedia.buffer).catch(() => null);
      const finalUrl = uploadResult?.url || null;

      const buttons = [{
        name: "cta_copy",
        display_text: "📄 Salin Prompt",
        copy_code: queryParams.prompt || activeMode
      }];

      let sentMsg;
      if (typeof ctx.sendCta === "function" && finalUrl) {
        sentMsg = await ctx.sendCta(bodyText, "", buttons, {
          media: finalUrl,
          quoted: msg
        });
      } else {
        sentMsg = await sock.sendMessage(ctx.id, {
          image: resultMedia.buffer,
          caption: bodyText
        }, { quoted: msg });
      }

      const newMsgId = sentMsg?.key?.id;
      recordSession(chatId, newMsgId, activeMode, finalUrl || inputImage, sessionData.theme_id, sessionData.theme_name);

      if (typeof ctx?.react === "function") await ctx.react("✨");
      return true;
    } catch (e) {
      console.error("[THEBETTER BEFORE ERROR]:", e.message);
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
        if (["thebetter", "thebetterai", "remini", "tbai", "hdphoto"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }

      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;

      // 1. Reset Sesi
      if (rawText === "--reset" || rawText === "--clear" || rawText === "reset" || rawText === "clear") {
        if (global.db.thebetterAi[chatId]) {
          delete global.db.thebetterAi[chatId];
          saveDB();
          return ctx.reply("🧹 *Sesi TheBetter AI berhasil direset!* Preferensi template & mode telah dibersihkan.");
        }
        return ctx.reply("ℹ️ Tidak ada sesi aktif di percakapan ini.");
      }

      const { flags, cleanPrompt } = parseFlags(rawText);
      const existingSession = global.db.thebetterAi[chatId];

      // 2. Set Template Pilihan
      if (flags.settemplate || flags.settheme) {
        const themeId = String(flags.settemplate || flags.settheme).trim();
        const themeName = flags.name || themeId;

        recordSession(chatId, null, "face-swapper", existingSession?.last_media, themeId, themeName);

        await ctx.react("✅");
        return ctx.reply(
          `–  *T H E  B E T T E R  A I*\n\n` +
          `┌  ◦  *Preset Template* : ${themeName}\n` +
          `├  ◦  *Theme ID* : \`${themeId}\`\n` +
          `└  ◦  *Mode Otomatis* : \`face-swapper\`\n\n` +
          `_Kirim atau balas foto dengan perintah \`${prefix}thebetter\` untuk menerapkan template ini._`
        );
      }

      // 3. CTA Pagination List Templates
      if (flags.templates || flags.list || rawText.startsWith("--templates") || rawText.startsWith("--list") || flags.page) {
        await ctx.react("⏳");
        const res = await requestTheBetterAi({
          action: "templates",
          query: flags.search || flags.query || undefined
        });

        const list = res?.result?.list || [];
        if (!list.length) {
          await ctx.react("❌");
          return ctx.reply("❌ Tidak ada template yang ditemukan.");
        }

        const searchQuery = flags.search || flags.query || (!flags.page && cleanPrompt) || "";
        let matched = list;
        if (searchQuery && searchQuery !== "true") {
          const kw = searchQuery.toLowerCase();
          matched = list.filter(t => (t.name || "").toLowerCase().includes(kw) || (t.theme_id || "").toLowerCase().includes(kw));
        }

        if (!matched.length) {
          await ctx.react("❌");
          return ctx.reply(`❌ Template tidak ditemukan dengan kata kunci "${searchQuery}".`);
        }

        const page = Math.max(1, Number(flags.page) || 1);
        const totalPages = Math.ceil(matched.length / CONFIG.ITEMS_PER_PAGE) || 1;
        const pageItems = matched.slice((page - 1) * CONFIG.ITEMS_PER_PAGE, page * CONFIG.ITEMS_PER_PAGE);

        const rows = pageItems.map((item, idx) => {
          const globalIdx = (page - 1) * CONFIG.ITEMS_PER_PAGE + idx + 1;
          const tid = item.theme_id;
          const name = item.name || tid;
          const tag = item.tag_name ? `[${item.tag_name.toUpperCase()}] ` : "";

          return {
            title: `${globalIdx}. ${name}`.slice(0, 24),
            id: `${prefix}thebetter --settheme "${tid}" --name "${name}"`,
            description: `${tag}ID: ${tid}`.slice(0, 60)
          };
        });

        let baseCmd = `${prefix}thebetter`;
        if (searchQuery && searchQuery !== "true") baseCmd += ` --search "${searchQuery}"`;
        else baseCmd += ` --list`;

        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: `PILIH TEMPLATE (${pageItems.length})`,
            sections: [{
              title: `THEBETTER TEMPLATES (Hal ${page}/${totalPages})`,
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

        const bodyText = `–  *T H E  B E T T E R  -  T E M P L A T E S*\n\n` +
          `┌  ◦  *Total Template* : ${matched.length}\n` +
          `├  ◦  *Halaman* : ${page} / ${totalPages}\n` +
          `└  ◦  *Kategori* : Face Swapper & Thematic Outfits\n\n` +
          `_Pilih template yang ingin digunakan dari menu di bawah:_`;

        const options = {
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 1,
              divider_indices: [1],
              list_title: `TheBetter Themes`,
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

      // 4. Generate Mode
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      if (!isMedia && !flags.media) {
        const activeTheme = existingSession?.theme_name || existingSession?.theme_id || "None";
        const guideText = `–  *T H E  B E T T E R  A I*

Solusi Ultra HD Photo Enhancement, Colorize, Face-Swap, dan AI Edit.

┌  ◦  *Template Aktif* : ${activeTheme}
│
├  ◦  *HD Enhancer (Remini Mode)* :
│  └ Kirim/balas foto: \`${prefix}thebetter --mode enhance\`
│
├  ◦  *AI Chat-Edit (Instruksi Teks)* :
│  └ Kirim/balas foto: \`${prefix}thebetter add a red beret and sunglasses\`
│
├  ◦  *Face-Swap (Template Restyle)* :
│  └ Kirim/balas foto: \`${prefix}thebetter --mode face-swapper --theme <theme_id>\`
│
├  ◦  *Mode Restorasi Lainnya* :
│  ├ \`--mode colorize\` (Mewarnai foto jadul B/W)
│  ├ \`--mode descratch\` (Menghilangkan goresan)
│  └ \`--mode restore\` (Restorasi penuh foto rusak)
│
├  ◦  *Pilih Template (CTA List)* :
│  └ \`${prefix}thebetter --list\`
│
├  ◦  *Sesi Berkelanjutan (Multi-Turn)* :
│  └ Cukup *reply foto hasil bot* dengan instruksi baru untuk mengedit ulang!
│
└  ◦  *Flags Tambahan* :
   ├ \`--mode <enhance|colorize|descratch|restore|face-swapper|chat-edit>\`
   ├ \`--theme <theme_id>\` (Gunakan tema face-swap)
   └ \`--reset\` (Hapus riwayat sesi)`;

        return ctx.reply(guideText, { quoted: quotedMsg });
      }

      await ctx.react("🎨");

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
      if (!inputImage) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal memproses atau mengunggah gambar input.");
      }

      const chosenMode = flags.mode || (cleanPrompt ? "chat-edit" : (existingSession?.theme_id ? "face-swapper" : "enhance"));
      const targetTheme = flags.theme_id || existingSession?.theme_id || undefined;

      const queryParams = {
        action: "generate",
        mode: chosenMode,
        image: inputImage,
        prompt: cleanPrompt || (chosenMode === "chat-edit" ? "enhance subject" : undefined),
        theme_id: targetTheme,
        ...flags
      };

      const resultMedia = await requestTheBetterAi(queryParams, true);
      if (!resultMedia?.buffer) throw new Error("Gagal menerima gambar hasil pemrosesan.");

      const bodyText = `–  *T H E  B E T T E R  A I*\n\n` +
        `┌  ◦  *Mode* : ${chosenMode}\n` +
        `├  ◦  *Theme* : ${targetTheme || "-"}\n` +
        `└  ◦  *Engine* : Photo Enhancer v3.11`;

      const uploadResult = await upload(resultMedia.buffer).catch(() => null);
      const finalUrl = uploadResult?.url || null;

      const buttons = [{
        name: "cta_copy",
        display_text: "📄 Salin Mode",
        copy_code: chosenMode
      }];

      let sentMsg;
      if (typeof ctx.sendCta === "function" && finalUrl) {
        sentMsg = await ctx.sendCta(bodyText, "", buttons, {
          media: finalUrl,
          quoted: quotedMsg
        });
      } else {
        sentMsg = await sock.sendMessage(ctx.id, {
          image: resultMedia.buffer,
          caption: bodyText
        }, { quoted: quotedMsg });
      }

      const sentMsgId = sentMsg?.key?.id;
      recordSession(
        chatId,
        sentMsgId,
        chosenMode,
        finalUrl || inputImage,
        targetTheme,
        existingSession?.theme_name
      );

      await ctx.react("✨");
    } catch (error) {
      console.error("[TheBetter AI Error]:", error?.message || error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.error || error.message || "Gagal memproses gambar pada TheBetter AI.";
      ctx.reply(`❌ Terjadi kendala: ${errMsg}`);
    }
  }
};