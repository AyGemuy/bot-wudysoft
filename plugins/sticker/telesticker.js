import axios from "axios";
import {
  writeExif,
  writeExifImg,
  writeExifVid,
  getWebpUrl
} from "../../lib/exif.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
import {
  stickerPack
} from "../../lib/pack.js";
const CONFIG = {
  API_URL: `${global.bot?.api?.wudysoft}/api/sticker/telegram/v1`,
  TIMEOUT: 3e4,
  API_TIMEOUT: 6e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 50
};
const teleCache = new Map();
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
        description: `Telegram Sticker Pack: ${packData.name}`,
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
      url: ["u", "link"],
      all: ["a", "semua", "pack"],
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
  if (!flags.url) {
    const teleMatch = cleanPrompt.match(/https?:\/\/t\.me\/addstickers\/[^\s]+/i) || cleanPrompt.match(/t\.me\/addstickers\/[^\s]+/i);
    if (teleMatch) {
      flags.url = teleMatch[0].startsWith("http") ? teleMatch[0] : `https://${teleMatch[0]}`;
    } else if (cleanPrompt.startsWith("http")) {
      flags.url = cleanPrompt;
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
  name: "telesticker",
  aliases: ["telestik", "telegramsticker", "tgsticker"],
  description: "Download stiker Telegram langsung jadi WhatsApp Sticker Pack",
  category: "Sticker",
  limit: true,
  example: "telesticker -u https://t.me/addstickers/MrCat atau telesticker <url> --all atau telesticker <url> -i 1",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["telesticker", "telestik", "telegramsticker", "tgsticker"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • Telegram Downloader`;
      const authorName = global.bot?.author?.name || "Telegram Downloader";
      const userName = ctx.pushname || ctx.sender.split("@")[0];
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const senderId = ctx.sender || ctx.author || msg.key?.participant || msg.key?.remoteJid || ctx.id;
      const {
        flags
      } = parseFlags(rawText);
      const targetUrl = flags.url || ctx.quoted?.text?.match(/https?:\/\/t\.me\/addstickers\/[^\s]+/i)?.[0];
      if (!targetUrl) {
        return ctx.reply(`–  *T E L E S T I C K E R*

Silakan masukkan tautan paket stiker Telegram yang valid.

┌  ◦  *Format* : ${prefix}telesticker <link> [flags]
│  ◦  *Full Pack* : ${prefix}telesticker <link> --all
│  ◦  *Single* : ${prefix}telesticker <link> -i 1
└  ◦  *Example* : ${prefix}telesticker https://t.me/addstickers/MrCat

–  *F L A G S*

┌  ◦  *-a, --all* : Unduh seluruh stiker pack
│  ◦  *-i, --index* : Unduh nomor stiker tertentu
│  ◦  *-l, --limit* : Batas maksimal (max: ${CONFIG.MAX_LIMIT})
└  ◦  *-p, --page* : Navigasi halaman stiker`);
      }
      await ctx.react("⏳");
      if (flags.index !== undefined) {
        let item = null;
        let setName = "Telegram Pack";
        const userCached = teleCache.get(senderId);
        const targetIndex = Number(flags.index) - 1;
        if (userCached && userCached.url === targetUrl && userCached.results?.[targetIndex]) {
          item = userCached.results[targetIndex];
          setName = item.set_name || userCached.setName || "Telegram Pack";
        } else {
          const {
            data
          } = await axios.post(CONFIG.API_URL, {
            query: targetUrl,
            index: flags.index
          }, {
            headers: {
              "Content-Type": "application/json"
            },
            timeout: CONFIG.API_TIMEOUT
          });
          const stickerResults = data?.result || [];
          if (!stickerResults.length) {
            await ctx.react("❌");
            return ctx.reply("❌ Stiker pada nomor index tersebut tidak ditemukan.");
          }
          item = stickerResults[0];
          setName = item.set_name || "Telegram Pack";
        }
        const downloadUrl = await getWebpUrl(item.file_url);
        const buffer = await fetchBuffer(downloadUrl);
        const exif = {
          packname: setName,
          author: authorName,
          categories: [item.emoji || "🤖"]
        };
        const sticker = await buildStickerBuffer(buffer, exif);
        await sock.sendMessage(ctx.id, {
          sticker: sticker
        }, {
          quoted: quotedMsg
        });
        return ctx.react("✅");
      }
      if (flags.all) {
        let stickerResults = [];
        const userCached = teleCache.get(senderId);
        if (userCached && userCached.url === targetUrl && userCached.results?.length > 0) {
          stickerResults = userCached.results;
        } else {
          let limit = Number(flags.limit) || CONFIG.DEFAULT_LIMIT;
          if (limit > CONFIG.MAX_LIMIT) limit = CONFIG.MAX_LIMIT;
          const bodyPayload = {
            query: targetUrl,
            all: true,
            ...flags.limit && {
              limit: limit
            }
          };
          const {
            data
          } = await axios.post(CONFIG.API_URL, bodyPayload, {
            headers: {
              "Content-Type": "application/json"
            },
            timeout: CONFIG.API_TIMEOUT
          });
          stickerResults = data?.result || [];
        }
        if (!stickerResults.length) {
          await ctx.react("❌");
          return ctx.reply("❌ Gagal memuat stiker dari pack Telegram tersebut.");
        }
        const setName = stickerResults[0]?.set_name || "Telegram Pack";
        const processLimit = flags.limit ? Math.min(stickerResults.length, flags.limit) : stickerResults.length;
        const downloadedStickers = [];
        for (let i = 0; i < processLimit; i++) {
          try {
            const item = stickerResults[i];
            const downloadUrl = await getWebpUrl(item.file_url);
            const rawBuffer = await fetchBuffer(downloadUrl);
            const exif = {
              packname: setName,
              author: authorName,
              categories: [item.emoji || "✨"]
            };
            const webpBuffer = await buildStickerBuffer(rawBuffer, exif);
            downloadedStickers.push({
              data: webpBuffer,
              emojis: [item.emoji || "✨"]
            });
          } catch (e) {
            console.error(`[TeleSticker Skip] Gagal unduh stiker ${setName}:`, e?.message);
          }
        }
        if (!downloadedStickers.length) {
          await ctx.react("❌");
          return ctx.reply("❌ Gagal mengunduh dan memproses berkas stiker.");
        }
        await ctx.reply(`–  *P R O C E S S I N G*

Sedang merakit ${downloadedStickers.length} stiker Telegram ke dalam format Sticker Pack WhatsApp...`);
        await sendSmartStickerPack(sock, ctx.id, {
          name: setName,
          publisher: authorName,
          stickers: downloadedStickers,
          cover: downloadedStickers[0]?.data
        }, {
          quoted: quotedMsg
        });
        return ctx.react("✅");
      }
      let stickerResults = [];
      let totalStickers = 0;
      const userCached = teleCache.get(senderId);
      if (userCached && userCached.url === targetUrl && userCached.results?.length > 0) {
        stickerResults = userCached.results;
        totalStickers = userCached.total || stickerResults.length;
      } else {
        const {
          data
        } = await axios.post(CONFIG.API_URL, {
          query: targetUrl,
          all: true
        }, {
          headers: {
            "Content-Type": "application/json"
          },
          timeout: CONFIG.API_TIMEOUT
        });
        stickerResults = data?.result || [];
        totalStickers = data.total || stickerResults.length;
        if (teleCache.size > 50) teleCache.clear();
        teleCache.set(senderId, {
          url: targetUrl,
          results: stickerResults,
          total: totalStickers,
          setName: stickerResults[0]?.set_name || "Telegram Pack"
        });
      }
      if (!stickerResults.length) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal memuat pack stiker Telegram tersebut.");
      }
      const topItem = stickerResults[0];
      const setName = topItem.set_name || "Telegram Pack";
      const teleUrl = targetUrl.startsWith("http") ? targetUrl : `https://t.me/addstickers/${setName}`;
      const itemsPerPage = 10;
      const totalPages = Math.ceil(totalStickers / itemsPerPage) || 1;
      let page = Number(flags.page) || 1;
      if (page < 1) page = 1;
      if (page > totalPages) page = totalPages;
      const startIndex = (page - 1) * itemsPerPage;
      const currentPageItems = stickerResults.slice(startIndex, startIndex + itemsPerPage);
      const actionRows = [{
        title: `📦 Unduh Full Pack (${totalStickers} Stiker)`,
        id: `${prefix}telesticker -u "${teleUrl}" --all`,
        description: `Kirim seluruh stiker sebagai paket WhatsApp resmi`
      }];
      const stickerRows = currentPageItems.map((stk, i) => {
        const emoji = stk.emoji || "✨";
        const realIndex = startIndex + i + 1;
        return {
          title: `${emoji} Stiker #${realIndex}`,
          id: `${prefix}telesticker -u "${teleUrl}" -i ${realIndex}`,
          description: `Resolusi: ${stk.width}x${stk.height}`
        };
      });
      const listSections = [{
        title: "⚡ OPSI CEPAT",
        rows: actionRows
      }, {
        title: `🖼️ PILIH SATUAN (Hal ${page}/${totalPages})`,
        rows: stickerRows
      }];
      const stickerType = topItem.is_animated ? "Animasi (.tgs)" : topItem.is_video ? "Video" : "Statis";
      const bannerImage = global.bot?.media?.banner1 || "https://files.catbox.moe/g2e6i5.jpg";
      const bodyText = `Hi ${userName}!
Berikut adalah rincian paket stiker Telegram yang ditemukan.

–  *T E L E S T I C K E R*

┌  ◦  *Pack* : ${setName}
│  ◦  *Total* : ${totalStickers} Stickers
│  ◦  *Type* : ${stickerType}
└  ◦  *Page* : ${page} / ${totalPages}

Pilih stiker satuan melalui menu di bawah atau unduh seluruh paket stiker.`;
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: "📂 DAFTAR & PILIHAN STIKER",
          sections: listSections
        })
      }];
      if (page > 1) {
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `⬅️ Hal ${page - 1}`,
            id: `${prefix}telesticker -u "${teleUrl}" -p ${page - 1}`
          })
        });
      }
      if (page < totalPages) {
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `➡️ Hal ${page + 1}`,
            id: `${prefix}telesticker -u "${teleUrl}" -p ${page + 1}`
          })
        });
      }
      buttons.push({
        name: "cta_url",
        buttonParamsJson: JSON.stringify({
          display_text: "🌐 Buka di Telegram",
          url: teleUrl,
          merchant_url: teleUrl
        })
      });
      const options = {
        image: bannerImage,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `${botName} • TeleSticker`,
            button_title: "Lihat Opsi"
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
            url: bannerImage
          },
          caption: bodyText
        }, {
          quoted: quotedMsg
        });
      }
      await ctx.react("✅");
    } catch (error) {
      console.error("[TeleSticker Error]:", error?.message || error);
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