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
  API_URL: `${global.bot?.api?.wudysoft}/api/sticker/lines/v1`,
  TIMEOUT: 3e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 50
};
const slinCache = new Map();

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /(?:--|-)([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1].toLowerCase();
    let rawVal = match[2];
    let val = true;
    const aliasMap = {
      download: ["d", "get", "url", "id"],
      search: ["s", "q", "query", "find"],
      all: ["a", "pack", "semua"],
      limit: ["l"],
      page: ["p", "pg"]
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
  if (!flags.download && /^https?:\/\/.+/i.test(cleanPrompt)) {
    flags.download = cleanPrompt.split(/\s+/)[0];
  }
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
  name: "stickerline",
  aliases: ["linestick", "linesearch", "linesticker", "slin"],
  description: "Cari & unduh stiker resmi LINE Store langsung jadi WhatsApp Sticker Pack",
  category: "Sticker",
  limit: true,
  example: "stickerline Bear atau stickerline Bear --all atau stickerline -d <url_atau_id>",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["stickerline", "linestick", "linesearch", "linesticker", "slin"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • LINE Stickershop`;
      const authorName = global.bot?.author?.name || "LINE Store";
      const userName = ctx.pushname || ctx.sender.split("@")[0];
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const senderId = ctx.sender || ctx.author || msg.key?.participant || msg.key?.remoteJid || ctx.id;
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      if (flags.download) {
        await ctx.react("⏳");
        let targetUrl = String(flags.download).trim();
        if (!/^https?:\/\/.+/i.test(targetUrl)) {
          const userCache = slinCache.get(senderId);
          const cachedItem = userCache?.get(targetUrl);
          if (cachedItem) {
            targetUrl = cachedItem.payloadForProduct?.animationUrl || cachedItem.payloadForProduct?.staticUrl || cachedItem.listIcon?.src;
          }
        }
        if (!targetUrl || !/^https?:\/\/.+/i.test(targetUrl)) {
          await ctx.react("❌");
          return ctx.reply("❌ URL stiker tidak valid atau sesi pencarian telah kedaluwarsa. Silakan lakukan pencarian ulang.");
        }
        const buffer = await fetchBuffer(targetUrl);
        const exif = {
          packname: `LINE STICKER BY ${botName}`,
          author: authorName,
          categories: ["🐻"]
        };
        const sticker = await buildStickerBuffer(buffer, exif);
        await sock.sendMessage(ctx.id, {
          sticker: sticker
        }, {
          quoted: quotedMsg
        });
        return ctx.react("✅");
      }
      const query = flags.search || cleanPrompt;
      if (!query) {
        return ctx.reply(`–  *L I N E  S T I C K E R*

Silakan tentukan kata kunci pencarian atau masukkan tautan stiker LINE Store.

┌  ◦  *Search* : ${prefix}slin <kata_kunci>
│  ◦  *Full Pack* : ${prefix}slin <kata_kunci> --all
│  ◦  *Download* : ${prefix}slin -d <id_atau_url>
└  ◦  *Example* : ${prefix}slin Bear

–  *F L A G S*

┌  ◦  *-s, --search* : Kata kunci stiker
│  ◦  *-a, --all* : Unduh seluruh paket stiker
│  ◦  *-d, --download* : Unduh stiker spesifik via ID/URL
│  ◦  *-l, --limit* : Batas maksimal (max: ${CONFIG.MAX_LIMIT})
└  ◦  *-p, --page* : Navigasi halaman stiker`);
      }
      await ctx.react("⏳");
      let limit = Number(flags.limit) || CONFIG.DEFAULT_LIMIT;
      if (limit > CONFIG.MAX_LIMIT) limit = CONFIG.MAX_LIMIT;
      const {
        data
      } = await axios.post(CONFIG.API_URL, {
        query: query,
        offset: 0,
        limit: limit
      }, {
        headers: {
          "Content-Type": "application/json"
        },
        timeout: CONFIG.TIMEOUT
      });
      const items = data?.items || [];
      if (!items.length) {
        await ctx.react("❌");
        return ctx.reply(`❌ Tidak ditemukan stiker LINE untuk kata kunci: *"${query}"*`);
      }
      if (!slinCache.has(senderId)) {
        slinCache.set(senderId, new Map());
      }
      const userCache = slinCache.get(senderId);
      if (userCache.size > 100) userCache.clear();
      items.forEach(item => {
        if (item.id) userCache.set(String(item.id), item);
      });
      if (flags.all) {
        const downloadedStickers = [];
        for (const item of items) {
          try {
            const stikerUrl = item.payloadForProduct?.animationUrl || item.payloadForProduct?.staticUrl || item.listIcon?.src;
            if (!stikerUrl) continue;
            const rawBuffer = await fetchBuffer(stikerUrl);
            const exif = {
              packname: item.title || `${query} LINE Pack`,
              author: authorName,
              categories: ["🐻"]
            };
            const webpBuffer = await buildStickerBuffer(rawBuffer, exif);
            downloadedStickers.push({
              buffer: webpBuffer,
              emoji: "🐻"
            });
          } catch (e) {
            console.error(`[StickerLine Skip] Gagal unduh stiker item ID ${item.id}:`, e?.message);
          }
        }
        if (!downloadedStickers.length) {
          await ctx.react("❌");
          return ctx.reply("❌ Gagal mengunduh kumpulan stiker untuk pembuatan pack.");
        }
        await ctx.reply(`–  *P R O C E S S I N G*

Sedang merakit ${downloadedStickers.length} stiker LINE ke dalam format Sticker Pack WhatsApp...`);
        await stickerPack(sock, ctx.id, downloadedStickers, {
          name: `${query.toUpperCase()} LINE Pack`,
          publisher: authorName,
          description: `LINE Stickers: ${query}`,
          quoted: quotedMsg
        });
        return ctx.react("✅");
      }
      const itemsPerPage = 10;
      const totalItems = items.length;
      const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
      let page = Number(flags.page) || 1;
      if (page < 1) page = 1;
      if (page > totalPages) page = totalPages;
      const startIndex = (page - 1) * itemsPerPage;
      const currentPageItems = items.slice(startIndex, startIndex + itemsPerPage);
      const topItem = items[0];
      const previewThumb = topItem.listIcon?.src || topItem.payloadForProduct?.staticUrl || "https://stickershop.line-scdn.net/stickershop/v1/product/8924289/LINEStorePC/main.png";
      const listSections = [{
        title: "⚡ OPSI CEPAT",
        rows: [{
          title: `📦 Unduh Full Pack (${totalItems} Stiker)`,
          id: `${prefix}stickerline -s "${query}" -l ${limit} --all`,
          description: `Kirim seluruh ${totalItems} stiker ini sebagai satu WA Pack utuh`
        }]
      }, {
        title: `🖼️ PILIH SATUAN (Hal ${page}/${totalPages})`,
        rows: currentPageItems.map(item => ({
          title: `${item.hasAnimation ? "🎞️" : "🖼️"} ${item.title}`.slice(0, 24),
          id: `${prefix}stickerline -d ${item.id}`,
          description: `Author: ${item.authorName || "-"} | Harga: ${item.priceString || item.price || "Free"}`
        }))
      }];
      const lineStoreUrl = `https://store.line.me${topItem.productUrl || `/stickershop/product/${topItem.id}/en`}`;
      const bodyText = `Hi ${userName}!
Berikut adalah hasil pencarian stiker resmi LINE Store.

–  *L I N E  S T I C K E R*

┌  ◦  *Query* : ${query}
│  ◦  *Title* : ${topItem.title}
│  ◦  *Author* : ${topItem.authorName || "Unknown"}
│  ◦  *Found* : ${data.totalCount || totalItems} Stickers
└  ◦  *Page* : ${page} / ${totalPages}

Pilih stiker satuan melalui menu di bawah atau unduh seluruh paket stiker.`;
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: "📥 PILIH & UNDUH STIKER",
          sections: listSections
        })
      }];
      if (page > 1) {
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `⬅️ Hal ${page - 1}`,
            id: `${prefix}stickerline -s "${query}" -p ${page - 1}`
          })
        });
      }
      if (page < totalPages) {
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `➡️ Hal ${page + 1}`,
            id: `${prefix}stickerline -s "${query}" -p ${page + 1}`
          })
        });
      }
      buttons.push({
        name: "cta_url",
        buttonParamsJson: JSON.stringify({
          display_text: "🌐 Buka di LINE Store",
          url: lineStoreUrl,
          merchant_url: lineStoreUrl
        })
      });
      const options = {
        image: previewThumb,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `${botName} • LINE Sticker`,
            button_title: "Lihat Stiker"
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
      console.error("[StickerLine Error]:", error?.message || error);
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