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
  API_URL: `${global.bot?.api?.wudysoft}/api/sticker/giphy`,
  TIMEOUT: 3e4,
  API_TIMEOUT: 6e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 30
};
const giphyCache = new Map();
async function sendSmartStickerPack(sock, jid, packData, options = {}) {
  const {
    quoted
  } = options;
  if (typeof sock?.stickerPackMessage === "function") {
    try {
      return await sock.stickerPackMessage(jid, packData, {
        quoted: quoted
      });
    } catch (_) {}
  }
  try {
    return await sock.sendMessage(jid, {
      stickerPack: packData
    }, {
      quoted: quoted
    });
  } catch (_) {}
  if (typeof stickerPack === "function") {
    try {
      const formattedForLib = packData.stickers.map(s => ({
        buffer: s.data,
        emoji: s.emojis?.[0] || "✨"
      }));
      return await stickerPack(sock, jid, formattedForLib, {
        name: packData.name,
        publisher: packData.publisher,
        description: `GIPHY Stickers: ${packData.name}`,
        quoted: quoted
      });
    } catch (_) {}
  }
  for (let i = 0; i < packData.stickers.length; i++) {
    const item = packData.stickers[i];
    await sock.sendMessage(jid, {
      sticker: item.data
    }, {
      quoted: i === 0 ? quoted : undefined
    });
    if (i < packData.stickers.length - 1) {
      await new Promise(r => setTimeout(r, 600));
    }
  }
}

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /(?:--|-)([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1].toLowerCase();
    let rawVal = match[2];
    let val = true;
    const aliasMap = {
      id: ["gifid", "g"],
      search: ["s", "q", "query"],
      all: ["a", "semua", "pack"],
      trending: ["trend", "tr", "pop"],
      index: ["i", "idx"],
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
  if (!flags.id) {
    const linkMatch = cleanPrompt.match(/giphy\.com\/stickers\/[^\s]+-([a-zA-Z0-9]+)/i);
    if (linkMatch) {
      flags.id = linkMatch[1];
    }
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
  name: "giphy",
  aliases: ["giphysticker", "gstick", "giphystickers", "giph"],
  description: "Cari stiker animasi transparan GIPHY & buat WhatsApp Sticker Pack",
  category: "Sticker",
  limit: true,
  example: "• Cari: .giphy pentol\n• Full Pack: .giphy pentol --all\n• Unduh Satuan: .giphy --id dmv5WyCkOWKPbnLtFH\n• Trending: .giphy --trending",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["giphy", "giphysticker", "gstick", "giphystickers", "giph"].some(a => firstWord.endsWith(a))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • GIPHY Stickers`;
      const authorName = global.bot?.author?.name || "GIPHY";
      const userName = ctx.pushname || ctx.sender.split("@")[0];
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const senderId = ctx.sender || ctx.author || msg.key?.participant || msg.key?.remoteJid || ctx.id;
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      const query = flags.search || cleanPrompt;
      if (flags.id) {
        const stickerId = String(flags.id).trim();
        await ctx.react?.("⏳");
        const {
          data
        } = await axios.get(CONFIG.API_URL, {
          params: {
            action: "detail_gif",
            id: stickerId
          },
          timeout: CONFIG.API_TIMEOUT
        });
        const stickerItem = data?.data;
        if (!stickerItem) {
          await ctx.react?.("❌");
          return ctx.reply(`❌ Stiker GIPHY dengan ID *"${stickerId}"* tidak ditemukan.`);
        }
        const images = stickerItem.images || {};
        const mediaUrl = images.original?.webp || images.fixed_height?.webp || images.original?.url || images.fixed_height?.url;
        if (!mediaUrl) {
          await ctx.react?.("❌");
          return ctx.reply("❌ Berkas media stiker tidak tersedia.");
        }
        const rawBuffer = await fetchBuffer(mediaUrl);
        const exif = {
          packname: stickerItem.title || "GIPHY Sticker",
          author: authorName,
          categories: ["✨"]
        };
        const stickerBuf = await buildStickerBuffer(rawBuffer, exif);
        await sock.sendMessage(ctx.id, {
          sticker: stickerBuf
        }, {
          quoted: quotedMsg
        });
        return ctx.react?.("✅");
      }
      let action = "search_stickers";
      let requestParams = {
        action: action
      };
      if (flags.trending || !query && !flags.id) {
        action = "trending_stickers";
        requestParams = {
          action: action
        };
      } else {
        requestParams = {
          action: "search_stickers",
          q: query
        };
      }
      if (!query && !flags.trending && !flags.id) {
        return ctx.reply(`–  *G I P H Y  S T I C K E R S*

Cari dan unduh stiker animasi transparan resmi dari GIPHY.

┌  ◦  *Pencarian* : \`${prefix}giphy <kata_kunci>\`
│  ◦  *Full Pack* : \`${prefix}giphy <kata_kunci> --all\`
│  ◦  *Unduh Satuan* : \`${prefix}giphy --id <sticker_id>\`
│  ◦  *Stiker Tren* : \`${prefix}giphy --trending\`
└  ◦  *Example* : \`${prefix}giphy pentol\`

–  *D A F T A R  F L A G S*

┌  ◦  *--id <id>* : Unduh stiker spesifik via ID/Link
│  ◦  *-a, --all* : Unduh seluruh hasil menjadi Sticker Pack
│  ◦  *-i, --index <n>* : Unduh stiker nomor tertentu
│  ◦  *--trending* : Jelajahi stiker yang sedang tren
└  ◦  *-p, --page <n>* : Navigasi nomor halaman`);
      }
      await ctx.react?.("⏳");
      const {
        data
      } = await axios.get(CONFIG.API_URL, {
        params: requestParams,
        timeout: CONFIG.API_TIMEOUT
      });
      const stickerList = data?.data || [];
      if (!stickerList.length) {
        await ctx.react?.("❌");
        return ctx.reply(`❌ Tidak ditemukan stiker untuk kata kunci: *"${query || "Trending"}"*`);
      }
      if (!giphyCache.has(senderId)) {
        giphyCache.set(senderId, new Map());
      }
      const userCache = giphyCache.get(senderId);
      if (userCache.size > 50) userCache.clear();
      stickerList.forEach(item => {
        if (item.id) userCache.set(item.id, item);
      });
      if (flags.all) {
        let limit = Number(flags.limit) || CONFIG.DEFAULT_LIMIT;
        if (limit > CONFIG.MAX_LIMIT) limit = CONFIG.MAX_LIMIT;
        const processItems = stickerList.slice(0, limit);
        const packTitle = query ? `${query.toUpperCase()} GIPHY` : "Trending GIPHY";
        await ctx.reply(`–  *P R O C E S S I N G*

Sedang mengunduh ${processItems.length} stiker dari GIPHY ke dalam format Sticker Pack WhatsApp...`);
        const downloadedStickers = [];
        for (let i = 0; i < processItems.length; i++) {
          try {
            const item = processItems[i];
            const images = item.images || {};
            const mediaUrl = images.fixed_height?.webp || images.original?.webp || images.fixed_height?.url || images.original?.url;
            if (!mediaUrl) continue;
            const rawBuffer = await fetchBuffer(mediaUrl);
            const exif = {
              packname: packTitle,
              author: authorName,
              categories: ["✨"]
            };
            const webpBuffer = await buildStickerBuffer(rawBuffer, exif);
            downloadedStickers.push({
              data: webpBuffer,
              emojis: ["✨"]
            });
          } catch (err) {
            console.error(`[GIPHY Skip] Gagal unduh stiker item ${i}:`, err?.message);
          }
        }
        if (!downloadedStickers.length) {
          await ctx.react?.("❌");
          return ctx.reply("❌ Gagal mengunduh kumpulan stiker GIPHY.");
        }
        await sendSmartStickerPack(sock, ctx.id, {
          name: packTitle,
          publisher: authorName,
          stickers: downloadedStickers,
          cover: downloadedStickers[0]?.data
        }, {
          quoted: quotedMsg
        });
        return ctx.react?.("✅");
      }
      const itemsPerPage = 8;
      const totalItems = stickerList.length;
      const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
      let page = Number(flags.page) || 1;
      if (page < 1) page = 1;
      if (page > totalPages) page = totalPages;
      const startIndex = (page - 1) * itemsPerPage;
      const currentPageItems = stickerList.slice(startIndex, startIndex + itemsPerPage);
      const topSticker = stickerList[0];
      const actionRows = [{
        title: `📦 Unduh Full Pack (${Math.min(totalItems, CONFIG.MAX_LIMIT)} Stiker)`,
        id: `${prefix}giphy ${query ? `"${query}"` : "--trending"} --all`,
        description: `Kirim seluruh stiker sebagai satu paket resmi WhatsApp`
      }];
      const stickerRows = currentPageItems.map((item, idx) => {
        const realIndex = startIndex + idx + 1;
        const cleanTitle = (item.title || `Stiker #${realIndex}`).replace(/Sticker by.*$/i, "").trim();
        return {
          title: `[#${realIndex}] ${cleanTitle}`.slice(0, 24),
          id: `${prefix}giphy --id ${item.id}`,
          description: `Author: ${item.username || item.user?.display_name || "GIPHY"} • ID: ${item.id}`
        };
      });
      const listSections = [{
        title: "⚡ OPSI CEPAT",
        rows: actionRows
      }, {
        title: `🖼️ PILIH SATUAN (Hal ${page}/${totalPages})`,
        rows: stickerRows
      }];
      const previewThumb = topSticker.images?.fixed_height?.url || topSticker.images?.original?.url || "https://files.catbox.moe/g2e6i5.jpg";
      const bodyText = `Hi ${userName}!
Berikut adalah hasil penelusuran stiker animasi GIPHY.

–  *G I P H Y  S T I C K E R S*

┌  ◦  *Mode* : ${action === "trending_stickers" ? "TRENDING" : "SEARCH"}
│  ◦  *Query* : ${query || "Trending Topik"}
│  ◦  *Top Item* : ${(topSticker.title || "GIPHY Sticker").slice(0, 28)}
│  ◦  *Total Ditemukan* : ${totalItems} Stiker
└  ◦  *Page* : ${page} / ${totalPages}

Pilih stiker satuan melalui menu di bawah atau unduh seluruh paket stiker.`;
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: `📂 DAFTAR STIKER GIPHY (${totalItems})`,
          sections: listSections
        })
      }];
      if (page > 1) {
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `⬅️ Hal ${page - 1}`,
            id: `${prefix}giphy ${query ? `"${query}"` : "--trending"} -p ${page - 1}`
          })
        });
      }
      if (page < totalPages) {
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `➡️ Hal ${page + 1}`,
            id: `${prefix}giphy ${query ? `"${query}"` : "--trending"} -p ${page + 1}`
          })
        });
      }
      const options = {
        image: previewThumb,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `${botName} • GIPHY`,
            button_title: "Lihat Stiker"
          }
        },
        contextInfo: {
          mentionedJid: [ctx.sender],
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
      await ctx.react?.("✅");
    } catch (error) {
      console.error("[GIPHY Error]:", error?.message || error);
      await ctx.react?.("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || error.message;
      ctx.reply(`❌ Terjadi kesalahan pada GIPHY: ${errMsg}`);
    }
  }
};