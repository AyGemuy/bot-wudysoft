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
  API_URL: `${global.bot?.api?.wudysoft}/api/sticker/combot`,
  TIMEOUT: 3e4,
  API_TIMEOUT: 6e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  MAX_LIMIT: 50
};
const combotCache = new Map();

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /(?:--|-)([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1].toLowerCase();
    let rawVal = match[2];
    let val = true;
    const aliasMap = {
      id: ["packid", "p"],
      search: ["s", "q", "query"],
      all: ["a", "pack", "semua"],
      popular: ["pop"],
      trending: ["trend", "tr"],
      top: ["top"],
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
  name: "combot",
  aliases: ["combotsticker", "cstick", "combots"],
  description: "Cari & unduh stiker Combot Telegram langsung jadi WhatsApp Sticker Pack",
  category: "Sticker",
  limit: true,
  example: "combot cat atau combot --id mariy44 atau combot --trending atau combot --popular",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["combot", "combotsticker", "cstick", "combots"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • Combot Stickers`;
      const authorName = global.bot?.author?.name || "Combot Stickers";
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
      if (flags.popular) action = "popular";
      else if (flags.trending) action = "trending";
      else if (flags.top) action = "top";
      else if (!query && !flags.id) action = "trending";
      if (!query && !flags.id && !flags.popular && !flags.trending && !flags.top) {
        return ctx.reply(`–  *C O M B O T*

Silakan tentukan kata kunci pencarian stiker atau gunakan opsi flag.

┌  ◦  *Search* : ${prefix}combot <query>
│  ◦  *Trending* : ${prefix}combot --trending
│  ◦  *Popular* : ${prefix}combot --popular
│  ◦  *Download* : ${prefix}combot --id <pack_id>
└  ◦  *Example* : ${prefix}combot cat

–  *F L A G S*

┌  ◦  *--id* : Unduh pack spesifik via ID
│  ◦  *-s, --search* : Cari berdasarkan judul
│  ◦  *--trending* : Daftar stiker sedang tren
│  ◦  *--popular* : Daftar stiker terpopuler
└  ◦  *-p, --page* : Navigasi nomor halaman`);
      }
      await ctx.react("⏳");
      if (flags.id) {
        const packId = String(flags.id).replace(/^https?:\/\/t\.me\/addstickers\//i, "").trim();
        let targetPack = null;
        if (combotCache.has(senderId)) {
          targetPack = combotCache.get(senderId).get(packId);
        }
        if (!targetPack) {
          const {
            data
          } = await axios.post(CONFIG.API_URL, {
            action: "search",
            query: packId,
            page: 1
          }, {
            timeout: CONFIG.API_TIMEOUT
          });
          const packList = data?.result?.stickers || [];
          targetPack = packList.find(p => p.id.toLowerCase() === packId.toLowerCase()) || packList[0];
        }
        if (!targetPack || !targetPack.url?.length) {
          await ctx.react("❌");
          return ctx.reply(`❌ Sticker Pack dengan ID *"${packId}"* tidak ditemukan.`);
        }
        const downloadedStickers = [];
        const processLimit = Math.min(targetPack.url.length, CONFIG.MAX_LIMIT);
        await ctx.reply(`–  *P R O C E S S I N G*

Sedang mengunduh ${processLimit} stiker Combot ke dalam format Sticker Pack WhatsApp...`);
        for (let i = 0; i < processLimit; i++) {
          try {
            const url = targetPack.url[i];
            const emoji = targetPack.emojis?.[i] || "✨";
            const rawBuffer = await fetchBuffer(url);
            const exif = {
              packname: targetPack.title || `${packId} Pack`,
              author: authorName,
              categories: [emoji]
            };
            const webpBuffer = await buildStickerBuffer(rawBuffer, exif);
            downloadedStickers.push({
              buffer: webpBuffer,
              emoji: emoji
            });
          } catch (err) {
            console.error(`[Combot Skip] Gagal unduh item ${i}:`, err?.message);
          }
        }
        if (!downloadedStickers.length) {
          await ctx.react("❌");
          return ctx.reply("❌ Gagal mengunduh berkas stiker dari pack tersebut.");
        }
        await stickerPack(sock, ctx.id, downloadedStickers, {
          name: targetPack.title || `${packId} Pack`,
          publisher: authorName,
          description: `Combot Pack: ${targetPack.title || packId}`,
          quoted: quotedMsg
        });
        return ctx.react("✅");
      }
      const payload = {
        action: action,
        page: page
      };
      if (action === "search") payload.query = query;
      const {
        data
      } = await axios.post(CONFIG.API_URL, payload, {
        timeout: CONFIG.API_TIMEOUT
      });
      const stickers = data?.result?.stickers || [];
      if (!stickers.length) {
        await ctx.react("❌");
        return ctx.reply("❌ Tidak ditemukan sticker pack untuk kriteria tersebut.");
      }
      if (!combotCache.has(senderId)) {
        combotCache.set(senderId, new Map());
      }
      const userCache = combotCache.get(senderId);
      if (userCache.size > 50) userCache.clear();
      stickers.forEach(pack => {
        if (pack.id) userCache.set(pack.id, pack);
      });
      const topPack = stickers[0];
      const totalResults = data.result?.total_results || stickers.length;
      const totalPages = data.result?.total_pages || 1;
      const actionRows = [{
        title: "📦 Unduh Pack Teratas",
        id: `${prefix}combot --id ${topPack.id}`,
        description: `Unduh total ${topPack.total_stickers} stiker jadi WhatsApp Pack`
      }];
      const packRows = stickers.map((item, idx) => {
        const itemNumber = (page - 1) * 10 + idx + 1;
        return {
          title: `[#${itemNumber}] ${item.title}`.slice(0, 24),
          id: `${prefix}combot --id ${item.id}`,
          description: `Stiker: ${item.total_stickers} | Dipakai: ${item.uses || 0}x`
        };
      });
      const listSections = [{
        title: "⚡ OPSI CEPAT",
        rows: actionRows
      }, {
        title: `🖼️ DAFTAR STICKER PACK (Hal ${page}/${totalPages})`,
        rows: packRows
      }];
      const previewThumb = topPack.url?.[0] || "https://files.catbox.moe/g2e6i5.jpg";
      const bodyText = `Hi ${userName}!
Berikut adalah hasil penelusuran stiker Combot Telegram.

–  *C O M B O T*

┌  ◦  *Action* : ${action.toUpperCase()}
│  ◦  *Top Pack* : ${topPack.title}
│  ◦  *Stickers* : ${topPack.total_stickers} Items
│  ◦  *Found* : ${totalResults} Packs
└  ◦  *Page* : ${page} / ${totalPages}

Pilih sticker pack pada menu di bawah untuk mengunduh seluruh isi paket stiker.`;
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: `📂 PILIH STICKER PACK (${stickers.length})`,
          sections: listSections
        })
      }];
      if (page > 1) {
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `⬅️ Hal ${page - 1}`,
            id: `${prefix}combot --${action} ${action === "search" ? `"${query}"` : ""} -p ${page - 1}`
          })
        });
      }
      if (page < totalPages) {
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `➡️ Hal ${page + 1}`,
            id: `${prefix}combot --${action} ${action === "search" ? `"${query}"` : ""} -p ${page + 1}`
          })
        });
      }
      buttons.push({
        name: "cta_url",
        buttonParamsJson: JSON.stringify({
          display_text: "🌐 Buka di Telegram",
          url: topPack.telegram || `https://t.me/addstickers/${topPack.id}`,
          merchant_url: topPack.telegram || `https://t.me/addstickers/${topPack.id}`
        })
      });
      const options = {
        image: previewThumb,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `${botName} • Combot Sticker`,
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
      console.error("[Combot Error]:", error?.message || error);
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