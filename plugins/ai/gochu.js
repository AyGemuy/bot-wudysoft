import axios from "axios";
import db from "../../data/db.js";
import { upload } from "../../lib/upload.js";
import { simpleQuoted } from "../../lib/quoted.js";

const API_URL = `${global.bot?.api?.wudysoft}/api/ai/gochu`;
const SESSION_TIMEOUT = 30 * 60 * 1e3; // 30 Menit
const CONFIG = {
  TIMEOUT: 65e3,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  ITEMS_PER_PAGE: 7
};

function initDB(jid = null, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.gochuAi) global.db.gochuAi = {};
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

    if (["char", "character", "cid"].includes(key)) key = "char_id";
    if (["img", "image"].includes(key)) key = "media";
    if (["kategori", "cat"].includes(key)) key = "type";

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

async function requestGochuAi(params = {}, chatId = null) {
  let session = chatId && global.db.gochuAi?.[chatId] ? global.db.gochuAi[chatId] : null;
  let currentState = params.state || session?.state || undefined;

  const runRequest = async (stateVal) => {
    const qParams = { ...params };
    if (stateVal) qParams.state = stateVal;
    return await axios.get(API_URL, {
      params: qParams,
      headers: {
        "User-Agent": CONFIG.USER_AGENT
      },
      timeout: CONFIG.TIMEOUT
    });
  };

  try {
    const { data } = await runRequest(currentState);
    if (!data?.status) {
      throw new Error(data?.error || data?.message || "Gagal memproses permintaan ke Gochu AI.");
    }
    if (data?.state && chatId) {
      if (!global.db.gochuAi[chatId]) global.db.gochuAi[chatId] = {};
      global.db.gochuAi[chatId].state = data.state;
      saveDB();
    }
    return data;
  } catch (err) {
    const errMsg = err.response?.data?.error || err.message || "";
    // Jika auth atau sesi cookie rusak, auto-refresh state sesi baru
    if (currentState && /auth|cookie|token|unauthorized|session/i.test(errMsg)) {
      if (global.db.gochuAi[chatId]) global.db.gochuAi[chatId].state = null;
      const { data } = await runRequest(undefined);
      if (data?.status && data?.state && chatId) {
        global.db.gochuAi[chatId].state = data.state;
        saveDB();
      }
      return data;
    }
    throw new Error(errMsg || "Gagal menghubungi API Gochu.");
  }
}

function recordSession(chatId, messageId, returnedState, charId, charName) {
  if (!chatId) return;
  initDB();
  if (!global.db.gochuAi[chatId]) {
    global.db.gochuAi[chatId] = {
      state: returnedState || null,
      char_id: charId || "suzume",
      char_name: charName || "Suzume",
      msgIds: [],
      lastMsgId: null,
      updatedAt: Date.now(),
      expireTime: Date.now() + SESSION_TIMEOUT
    };
  }
  const s = global.db.gochuAi[chatId];
  if (returnedState) s.state = returnedState;
  if (charId) s.char_id = charId;
  if (charName) s.char_name = charName;
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
  name: "gochu",
  aliases: ["gochuai", "cai", "roleplay", "rpchat"],
  description: "AI Character & Roleplay Chat berbasis Gochu Engine (Full DB Session & Vision).",
  category: "AI",
  limit: true,
  example: "gochu Halo suzume, sedang baca buku apa?\ngochu --list (Pilih karakter)\nBalas/reply pesan bot untuk melanjutkan obrolan.",

  before: async (msg, { sock, ctx }) => {
    try {
      const chatId = ctx?.id || msg?.key?.remoteJid;
      if (!chatId) return;
      initDB();
      if (!global.db.gochuAi[chatId]) return;

      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;

      const sessionData = global.db.gochuAi[chatId];
      if (Date.now() > sessionData.expireTime) {
        delete global.db.gochuAi[chatId];
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

      const payload = {
        action: "chat",
        prompt: userText || (uploadedMediaUrl ? "Look at this photo" : "Hello"),
        char_id: sessionData.char_id || "suzume",
        ...uploadedMediaUrl ? { media: uploadedMediaUrl } : {}
      };

      const data = await requestGochuAi(payload, chatId);
      const answerText = (data?.result || "Tidak ada respon.").trim();
      const bodyText = answerText;

      const buttons = [{
        name: "cta_copy",
        display_text: "📄 Salin Jawaban",
        copy_code: answerText
      }];

      let sentMsg;
      if (typeof ctx.sendCta === "function") {
        sentMsg = await ctx.sendCta(bodyText, `_Karakter: ${sessionData.char_name || sessionData.char_id}_`, buttons, {
          media: uploadedMediaUrl || null,
          quoted: msg
        });
      } else if (uploadedMediaUrl) {
        sentMsg = await sock.sendMessage(ctx.id, {
          image: { url: uploadedMediaUrl },
          caption: bodyText
        }, { quoted: msg });
      } else {
        sentMsg = await sock.sendMessage(ctx.id, {
          text: bodyText
        }, { quoted: msg });
      }

      const newMsgId = sentMsg?.key?.id;
      recordSession(chatId, newMsgId, data.state || sessionData.state, sessionData.char_id, sessionData.char_name);

      if (typeof ctx?.react === "function") await ctx.react("✨");
      return true;
    } catch (e) {
      console.error("[GOCHU BEFORE ERROR]:", e.message);
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
        if (["gochu", "gochuai", "cai", "roleplay", "rpchat"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }

      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;

      // Reset Sesi Chat
      if (rawText === "--reset" || rawText === "--clear" || rawText === "reset" || rawText === "clear") {
        if (global.db.gochuAi[chatId]) {
          delete global.db.gochuAi[chatId];
          saveDB();
          return ctx.reply("🧹 *Sesi percakapan Gochu AI berhasil direset!* Silakan mulai obrolan baru.");
        }
        return ctx.reply("ℹ️ Tidak ada sesi Gochu AI yang aktif di percakapan ini.");
      }

      const { flags, cleanPrompt } = parseFlags(rawText);

      // Set Karakter Pilihan
      if (flags.setchar) {
        const charId = String(flags.setchar).trim();
        const charName = flags.name || charId;

        if (!global.db.gochuAi[chatId]) global.db.gochuAi[chatId] = {};
        global.db.gochuAi[chatId].char_id = charId;
        global.db.gochuAi[chatId].char_name = charName;
        global.db.gochuAi[chatId].updatedAt = Date.now();
        global.db.gochuAi[chatId].expireTime = Date.now() + SESSION_TIMEOUT;
        saveDB();

        await ctx.react("✅");
        return ctx.reply(`–  *G O C H U  A I*\n\n┌  ◦  *Karakter Aktif* : ${charName}\n└  ◦  *ID Karakter* : \`${charId}\`\n\n_Ketik \`${prefix}gochu <pesan>\` atau reply pesan untuk mulai berbicara._`);
      }

      // CTA Pagination: Daftar Karakter
      if (flags.list || flags.characters || rawText.startsWith("--list") || flags.page) {
        await ctx.react("⏳");
        const charType = flags.type || "anime";
        const data = await requestGochuAi({
          action: "character",
          type: charType
        }, chatId);

        const allChars = Array.isArray(data?.result) ? data.result : [];
        if (!allChars.length) {
          await ctx.react("❌");
          return ctx.reply("❌ Gagal memuat daftar karakter dari server Gochu AI.");
        }

        const searchQuery = flags.search || flags.query || (!flags.page && cleanPrompt) || "";
        let matchedChars = allChars;
        if (searchQuery && searchQuery !== "true") {
          const kw = searchQuery.toLowerCase();
          matchedChars = allChars.filter(c => (c.name || "").toLowerCase().includes(kw) || (c.description || "").toLowerCase().includes(kw));
        }

        if (!matchedChars.length) {
          await ctx.react("❌");
          return ctx.reply(`❌ Karakter tidak ditemukan dengan kata kunci "${searchQuery}".`);
        }

        const page = Math.max(1, Number(flags.page) || 1);
        const totalPages = Math.ceil(matchedChars.length / CONFIG.ITEMS_PER_PAGE) || 1;
        const pageItems = matchedChars.slice((page - 1) * CONFIG.ITEMS_PER_PAGE, page * CONFIG.ITEMS_PER_PAGE);

        const rows = pageItems.map((c, idx) => {
          const globalIdx = (page - 1) * CONFIG.ITEMS_PER_PAGE + idx + 1;
          const cid = String(c.id);
          const name = c.name || `Char #${cid}`;
          const cleanDesc = (c.description || "").replace(/[\r\n]+/g, " ");

          return {
            title: `${globalIdx}. ${name}`.slice(0, 24),
            id: `${prefix}gochu --setchar "${cid}" --name "${name}"`,
            description: `${cleanDesc.slice(0, 48)} • ID: ${cid}`.slice(0, 60)
          };
        });

        let baseCmd = `${prefix}gochu`;
        if (charType) baseCmd += ` --type ${charType}`;
        if (searchQuery && searchQuery !== "true") baseCmd += ` --search "${searchQuery}"`;
        else baseCmd += ` --list`;

        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: `PILIH KARAKTER (${pageItems.length})`,
            sections: [{
              title: `GOCHU: ${charType.toUpperCase()} (Hal ${page}/${totalPages})`,
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

        const bodyText = `–  *G O C H U  A I  -  R O S T E R*\n\n┌  ◦  *Kategori* : ${charType.toUpperCase()}\n├  ◦  *Total Karakter* : ${matchedChars.length}\n└  ◦  *Halaman* : ${page} / ${totalPages}\n\n_Pilih karakter dari menu tombol di bawah untuk mengobrol:_`;

        const options = {
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 1,
              divider_indices: [1],
              list_title: `Gochu • Characters`,
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

      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      if (!rawText && !isMedia) {
        const sessionData = global.db.gochuAi[chatId];
        const activeChar = sessionData?.char_name || sessionData?.char_id || "Suzume (Default)";
        const guideText = `–  *G O C H U  A I*

Asisten roleplay cerdas dan interaktif berbasis karakter virtual Gochu AI.

┌  ◦  *Karakter Aktif* : ${activeChar}
│
├  ◦  *Chat Standar* :
│  └ \`${prefix}gochu Hai, apa yang sedang kamu lakukan?\`
│
├  ◦  *Roleplay dengan Gambar (Vision)* :
│  └ Balas/kirim gambar: \`${prefix}gochu Berikan tanggapanmu tentang fotoku ini\`
│
├  ◦  *Pilih Karakter (CTA Menu)* :
│  ├ \`${prefix}gochu --list\` (Karakter Anime)
│  ├ \`${prefix}gochu --list --type women\` (Karakter Wanita)
│  └ \`${prefix}gochu --list --type men\` (Karakter Pria)
│
├  ◦  *Sesi Berkelanjutan* :
│  └ Cukup *reply pesan balasan bot* untuk melanjutkan obrolan secara langsung!
│
└  ◦  *Parameter Flag Tambahan* :
   ├ \`--char <char_id>\` (Chat langsung ke karakter tertentu)
   ├ \`--search <nama>\` (Cari nama karakter)
   ├ \`--media <image_url>\` (Kirim URL gambar eksplisit)
   └ \`--reset\` (Hapus sesi percakapan aktif)`;

        return ctx.reply(guideText, {
          quoted: quotedMsg
        });
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

      const existingSession = global.db.gochuAi[chatId];
      const targetCharId = flags.char_id || existingSession?.char_id || "suzume";
      const targetCharName = existingSession?.char_name || targetCharId;
      const promptText = cleanPrompt || flags.prompt || (uploadedMediaUrl ? "Look at this image" : "Hello");

      const payload = {
        action: "chat",
        prompt: promptText,
        char_id: targetCharId,
        ...uploadedMediaUrl ? { media: uploadedMediaUrl } : flags.media ? { media: flags.media } : {}
      };

      const data = await requestGochuAi(payload, chatId);
      const answerText = (data?.result || "Tidak ada respon teks.").trim();
      const bodyText = answerText;

      const buttons = [{
        name: "cta_copy",
        display_text: "📄 Salin Jawaban",
        copy_code: answerText
      }];

      let sentMsg;
      if (typeof ctx.sendCta === "function") {
        sentMsg = await ctx.sendCta(bodyText, `_Karakter: ${targetCharName}_`, buttons, {
          media: uploadedMediaUrl || null,
          quoted: quotedMsg
        });
      } else if (uploadedMediaUrl) {
        sentMsg = await sock.sendMessage(ctx.id, {
          image: { url: uploadedMediaUrl },
          caption: bodyText
        }, { quoted: quotedMsg });
      } else {
        sentMsg = await sock.sendMessage(ctx.id, {
          text: bodyText
        }, { quoted: quotedMsg });
      }

      const sentMsgId = sentMsg?.key?.id;
      recordSession(chatId, sentMsgId, data.state || existingSession?.state, targetCharId, targetCharName);

      await ctx.react("✨");
    } catch (error) {
      console.error("[Gochu AI Error]:", error?.message || error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.error || error.message || "Gagal memproses permintaan ke Gochu AI.";
      ctx.reply(`❌ Terjadi kendala: ${errMsg}`);
    }
  }
};