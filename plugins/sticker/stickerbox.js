import axios from "axios";
import {
  writeExif,
  writeExifImg,
  writeExifVid
} from "../../lib/exif.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
import {
  stickerPack
} from "../../lib/pack.js";
const CONFIG = {
  API_URL: `${global.bot?.api?.wudysoft}/api/sticker/stickerbox`,
  TIMEOUT: 3e4,
  API_TIMEOUT: 6e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  MAX_LIMIT: 50
};
const sboxCache = new Map();

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /(?:--|-)([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1].toLowerCase();
    let rawVal = match[2];
    let val = true;
    const aliasMap = {
      id: ["code", "i"],
      search: ["s", "title", "t"],
      categories: ["cat", "c"],
      recommendations: ["rec", "r"],
      page: ["pg", "p"]
    };
    for (const [realKey, aliases] of Object.entries(aliasMap)) {
      if (aliases.includes(key)) key = realKey;
    }
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
async function fetchBuffer(url) {
  const res = await axios.get(url, {
    responseType: "arraybuffer",
    headers: {
      "User-Agent": CONFIG.USER_AGENT
    },
    timeout: CONFIG.TIMEOUT
  });
  return Buffer.from(res.data);
}
async function buildStickerBuffer(buffer, exif) {
  try {
    return await writeExif(buffer, exif);
  } catch {
    try {
      return await writeExifVid(buffer, exif);
    } catch {
      try {
        return await writeExifImg(buffer, exif);
      } catch {
        return buffer;
      }
    }
  }
}
export default {
  name: "stickerbox",
  aliases: ["sbox", "stikbox"],
  description: "Cari & unduh stiker dari Stickerbox langsung jadi WhatsApp Sticker Pack",
  category: "Sticker",
  limit: true,
  example: "sbox cat atau sbox --categories atau sbox --recommendations",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["stickerbox", "sbox", "stikbox"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • Stickerbox Engine`;
      const authorName = global.bot?.author?.name || "Stickerbox";
      const userName = ctx.pushname || ctx.sender.split("@")[0];
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const senderId = ctx.sender || ctx.author || msg.key?.participant || msg.key?.remoteJid || ctx.id;
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      let action = "search";
      let page = Number(flags.page) || 1;
      let query = flags.search || cleanPrompt;
      if (flags.categories) action = "categories";
      else if (flags.recommendations) action = "recommendations";
      else if (!query && !flags.id) action = "recommendations";
      if (!query && !flags.id && !flags.categories && !flags.recommendations) {
        return ctx.reply(`–  *S T I C K E R B O X*

Silakan tentukan kata kunci pencarian stiker atau gunakan opsi flag.

┌  ◦  *Search* : ${prefix}sbox <query>
│  ◦  *Recommendations* : ${prefix}sbox --rec
│  ◦  *Categories* : ${prefix}sbox --cat
└  ◦  *Example* : ${prefix}sbox cat

–  *F L A G S*

┌  ◦  *-i, --id* : Unduh pack spesifik via kode
│  ◦  *-s, --search* : Cari berdasarkan judul
└  ◦  *-p, --page* : Navigasi nomor halaman`);
      }
      await ctx.react("⏳");
      if (flags.id) {
        const stickerCode = String(flags.id).trim();
        let targetPack = null;
        if (sboxCache.has(senderId)) {
          targetPack = sboxCache.get(senderId).get(stickerCode);
        }
        if (!targetPack) {
          const searchTitle = String(flags.search || "").trim();
          if (!searchTitle) {
            await ctx.react("❌");
            return ctx.reply("❌ Sticker Pack tidak ditemukan dalam cache sesi. Harap cari ulang atau sertakan judul dengan flag `-s <judul>`.");
          }
          const {
            data
          } = await axios.post(CONFIG.API_URL, {
            action: "search",
            title: searchTitle,
            page: 1
          }, {
            timeout: CONFIG.API_TIMEOUT
          });
          const packList = Array.isArray(data) ? data : data?.result || [];
          targetPack = packList.find(p => p.stickerCode === stickerCode) || packList[0];
        }
        if (!targetPack || !targetPack.stickerItems?.length) {
          await ctx.react("❌");
          return ctx.reply(`❌ Sticker Pack dengan kode *"${stickerCode}"* tidak ditemukan.`);
        }
        const downloadedStickers = [];
        const processLimit = Math.min(targetPack.stickerItems.length, CONFIG.MAX_LIMIT);
        await ctx.reply(`–  *P R O C E S S I N G*

Sedang mengunduh ${processLimit} stiker dari Stickerbox ke dalam format Sticker Pack...`);
        for (let i = 0; i < processLimit; i++) {
          try {
            const url = targetPack.stickerItems[i];
            const rawBuffer = await fetchBuffer(url);
            const exif = {
              packname: targetPack.title || `${stickerCode} Pack`,
              author: authorName,
              categories: ["✨"]
            };
            const webpBuffer = await buildStickerBuffer(rawBuffer, exif);
            downloadedStickers.push({
              buffer: webpBuffer,
              emoji: "✨"
            });
          } catch (err) {
            console.error(`[Stickerbox Skip] Gagal unduh item ${i}:`, err?.message);
          }
        }
        if (!downloadedStickers.length) {
          await ctx.react("❌");
          return ctx.reply("❌ Gagal mengunduh berkas gambar stiker.");
        }
        await stickerPack(sock, ctx.id, downloadedStickers, {
          name: targetPack.title || `${stickerCode} Pack`,
          publisher: authorName,
          description: `Stickerbox: ${targetPack.title}`,
          quoted: quotedMsg
        });
        return ctx.react("✅");
      }
      const payload = {
        action: action
      };
      if (action === "search") {
        payload.title = query;
        payload.page = page;
      } else {
        payload.lang = "id";
      }
      const {
        data
      } = await axios.post(CONFIG.API_URL, payload, {
        timeout: CONFIG.API_TIMEOUT
      });
      if (action === "categories") {
        if (!Array.isArray(data) || !data.length) {
          await ctx.react("❌");
          return ctx.reply("❌ Gagal memuat daftar kategori stiker.");
        }
        const categoryLines = data.map((cat, idx) => {
          const isLast = idx === data.length - 1;
          const branch = isLast ? "└" : "│";
          return `${branch}  ◦  *${cat.id}* : ${cat.description} ${cat.animated ? "(Animasi)" : ""}`;
        }).join("\n");
        const catText = `–  *C A T E G O R I E S*

${categoryLines}`;
        await ctx.react("✅");
        return ctx.reply(catText);
      }
      let stickers = [];
      let listTitle = "DAFTAR STICKER PACK";
      if (action === "recommendations") {
        if (data?.lines && data.lines.length > 0) {
          stickers = data.lines[0].stickers || [];
          listTitle = `REKOMENDASI: ${data.lines[0].title.toUpperCase()}`;
        }
      } else {
        stickers = Array.isArray(data) ? data : [];
      }
      if (!stickers.length) {
        await ctx.react("❌");
        return ctx.reply("❌ Tidak ditemukan sticker pack untuk kriteria tersebut.");
      }
      if (!sboxCache.has(senderId)) {
        sboxCache.set(senderId, new Map());
      }
      const userCache = sboxCache.get(senderId);
      if (userCache.size > 50) userCache.clear();
      stickers.forEach(pack => {
        if (pack.stickerCode) userCache.set(pack.stickerCode, pack);
      });
      const topPack = stickers[0];
      const previewThumb = topPack.stickerItems?.[0] || "https://files.catbox.moe/g2e6i5.jpg";
      const actionRows = [{
        title: "📦 Unduh Pack Teratas",
        id: `${prefix}sbox --id ${topPack.stickerCode}`,
        description: `Judul: ${topPack.title.slice(0, 30)} | Total: ${topPack.stickerItems?.length || 0} stiker`
      }];
      const packRows = stickers.map((item, idx) => {
        const itemNumber = (page - 1) * 10 + idx + 1;
        return {
          title: `[#${itemNumber}] ${item.title}`.slice(0, 24),
          id: `${prefix}sbox --id ${item.stickerCode}`,
          description: `Total: ${item.stickerItems?.length || 0} Stiker | Animasi: ${item.animated ? "Ya" : "Tidak"}`
        };
      });
      const listSections = [{
        title: "⚡ OPSI CEPAT",
        rows: actionRows
      }, {
        title: `🖼️ ${listTitle} ${action === "search" ? `(Hal ${page})` : ""}`,
        rows: packRows
      }];
      const bodyText = `Hi ${userName}!
Berikut adalah hasil penelusuran paket stiker dari Stickerbox.

–  *S T I C K E R B O X*

┌  ◦  *Mode* : ${action.toUpperCase()}
│  ◦  *Query* : ${query || "-"}
│  ◦  *Top Pack* : ${topPack.title}
│  ◦  *Stickers* : ${topPack.stickerItems?.length || 0} Items
└  ◦  *Total* : ${stickers.length} Packs

Pilih sticker pack pada menu di bawah untuk mengunduh seluruh isi paket stiker.`;
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: `📂 PILIH STICKER PACK (${stickers.length})`,
          sections: listSections
        })
      }];
      if (action === "search") {
        if (page > 1) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: `⬅️ Hal ${page - 1}`,
              id: `${prefix}sbox -s "${query}" -p ${page - 1}`
            })
          });
        }
        if (stickers.length >= 10) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: `➡️ Hal ${page + 1}`,
              id: `${prefix}sbox -s "${query}" -p ${page + 1}`
            })
          });
        }
      }
      buttons.push({
        name: "cta_url",
        buttonParamsJson: JSON.stringify({
          display_text: "🌐 Web Archive URL",
          url: topPack.webpArchiveUrl || "https://static.tgsurf.com/",
          merchant_url: topPack.webpArchiveUrl || "https://static.tgsurf.com/"
        })
      });
      const options = {
        image: previewThumb,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `${botName} • Stickerbox`,
            button_title: "Lihat Pack"
          }
        },
        contextInfo: {
          forwardingScore: 999,
          isForwarded: true
        },
        quoted: quotedMsg
      };
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, botFooter, buttons, options);
      } else {
        await sock.sendMessage(ctx.id, {
          image: {
            url: previewThumb
          },
          caption: bodyText
        }, {
          quoted: quotedMsg
        });
      }
      await ctx.react("✅");
    } catch (error) {
      console.error("[Stickerbox Error]:", error?.message || error);
      await ctx.react("❌");
      let errorMessage = error.message;
      if (error.response?.data) {
        try {
          const parsed = typeof error.response.data === "string" ? JSON.parse(error.response.data) : error.response.data;
          errorMessage = parsed.message || parsed.error || errorMessage;
        } catch {}
      }
      ctx.reply(`❌ Terjadi kesalahan: ${errorMessage}`);
    }
  }
};