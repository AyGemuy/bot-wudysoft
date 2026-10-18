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
  API_URL: `${global.bot?.api?.wudysoft}/api/sticker/fstik`,
  TIMEOUT: 3e4,
  API_TIMEOUT: 6e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  MAX_LIMIT: 50
};
const fstikCache = new Map();
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
        description: `Fstik Stickers: ${packData.name}`,
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
      download: ["d", "get", "id"],
      search: ["s", "q", "query", "find"],
      all: ["a", "semua"],
      limit: ["l"],
      page: ["p", "pg"],
      pack: ["set"]
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
async function fetchStickerBuffer(fileId) {
  const res = await axios.post(CONFIG.API_URL, {
    action: "download",
    id: fileId
  }, {
    responseType: "arraybuffer",
    headers: {
      "Content-Type": "application/json",
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
  name: "fstik",
  aliases: ["findstik", "fsticker", "stickersr"],
  description: "Cari & unduh stiker Fstik/Telegram langsung jadi WhatsApp Sticker Pack",
  category: "Sticker",
  limit: true,
  example: "fstik quby atau fstik quby --all atau fstik -d <file_id>",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["fstik", "findstik", "fsticker", "stickersr"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • Fstik Engine`;
      const authorName = global.bot?.author?.name || "Fstik Search";
      const userName = ctx.pushname || ctx.sender.split("@")[0];
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const senderId = ctx.sender || ctx.author || msg.key?.participant || msg.key?.remoteJid || ctx.id;
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      if (flags.download) {
        await ctx.react("⏳");
        const rawBuffer = await fetchStickerBuffer(flags.download);
        const exif = {
          packname: `STICKER BY ${botName}`,
          author: authorName,
          categories: ["🤖"]
        };
        const sticker = await buildStickerBuffer(rawBuffer, exif);
        await sock.sendMessage(ctx.id, {
          sticker: sticker
        }, {
          quoted: quotedMsg
        });
        return ctx.react("✅");
      }
      const query = flags.search || cleanPrompt;
      if (!query) {
        return ctx.reply(`–  *F S T I K*

Silakan tentukan kata kunci pencarian paket stiker.

┌  ◦  *Search* : ${prefix}fstik <query>
│  ◦  *Full Pack* : ${prefix}fstik <query> --all
│  ◦  *Download* : ${prefix}fstik -d <file_id>
└  ◦  *Example* : ${prefix}fstik quby

–  *F L A G S*

┌  ◦  *-s, --search* : Kata kunci pencarian
│  ◦  *-a, --all* : Unduh seluruh paket stiker
│  ◦  *-d, --download* : Unduh stiker spesifik via file_id
│  ◦  *--pack* : Pilih paket stiker tertentu
└  ◦  *-p, --page* : Navigasi halaman stiker`);
      }
      await ctx.react("⏳");
      let sets = [];
      let selectedSet = null;
      let totalPacksCount = 0;
      if (flags.pack && fstikCache.has(senderId)) {
        const userCache = fstikCache.get(senderId);
        selectedSet = userCache.get(flags.pack.toLowerCase());
      }
      if (!selectedSet) {
        const limit = Number(flags.limit) || 15;
        const {
          data
        } = await axios.post(CONFIG.API_URL, {
          action: "search",
          query: query,
          limit: limit
        }, {
          headers: {
            "Content-Type": "application/json",
            "User-Agent": CONFIG.USER_AGENT
          },
          timeout: CONFIG.API_TIMEOUT
        });
        if (!data?.ok || !data?.result?.stickerSets?.length) {
          await ctx.react("❌");
          return ctx.reply(`❌ Tidak ditemukan stiker untuk kata kunci: *"${query}"*`);
        }
        sets = data.result.stickerSets;
        totalPacksCount = data.result.totalCount || sets.length;
        if (!fstikCache.has(senderId)) {
          fstikCache.set(senderId, new Map());
        }
        const userCache = fstikCache.get(senderId);
        if (userCache.size > 50) userCache.clear();
        sets.forEach(s => {
          if (s.name) userCache.set(s.name.toLowerCase(), s);
        });
        userCache.set("__meta_total_count", totalPacksCount);
        selectedSet = flags.pack ? sets.find(s => (s.name || "").toLowerCase() === flags.pack.toLowerCase()) || sets[0] : sets[0];
      } else {
        const userCache = fstikCache.get(senderId);
        totalPacksCount = userCache.get("__meta_total_count") || 1;
        sets = [selectedSet];
      }
      const stickers = selectedSet.stickers || [];
      if (!stickers.length) {
        await ctx.react("❌");
        return ctx.reply("❌ Paket stiker ditemukan namun tidak ada item stiker di dalamnya.");
      }
      const setName = selectedSet.title || selectedSet.name || `${query} Pack`;
      if (flags.all) {
        const downloadedStickers = [];
        const processLimit = Math.min(stickers.length, CONFIG.MAX_LIMIT);
        await ctx.reply(`–  *P R O C E S S I N G*

Sedang mengunduh ${processLimit} stiker Fstik ke dalam format Sticker Pack WhatsApp...`);
        for (let i = 0; i < processLimit; i++) {
          try {
            const stk = stickers[i];
            const rawBuffer = await fetchStickerBuffer(stk.file_id);
            const exif = {
              packname: setName,
              author: authorName,
              categories: [stk.emoji || "✨"]
            };
            const webpBuffer = await buildStickerBuffer(rawBuffer, exif);
            downloadedStickers.push({
              data: webpBuffer,
              emojis: [stk.emoji || "✨"]
            });
          } catch (e) {
            console.error(`[Fstik Skip] Gagal unduh item ${i}:`, e?.message);
          }
        }
        if (!downloadedStickers.length) {
          await ctx.react("❌");
          return ctx.reply("❌ Gagal mengunduh berkas stiker untuk pembuatan pack.");
        }
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
      const itemsPerPage = 10;
      const totalItems = stickers.length;
      const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
      let page = Number(flags.page) || 1;
      if (page < 1) page = 1;
      if (page > totalPages) page = totalPages;
      const startIndex = (page - 1) * itemsPerPage;
      const currentPageStickers = stickers.slice(startIndex, startIndex + itemsPerPage);
      const actionRows = [{
        title: `📦 Unduh Full Pack (${totalItems} Stiker)`,
        id: `${prefix}fstik -s "${query}" --pack "${selectedSet.name}" --all`,
        description: `Kirim seluruh ${totalItems} stiker sebagai paket WhatsApp resmi`
      }];
      const stickerRows = currentPageStickers.map((stk, index) => {
        const emoji = stk.emoji || "✨";
        const itemNumber = startIndex + index + 1;
        return {
          title: `${emoji} Stiker #${itemNumber}`,
          id: `${prefix}fstik -d ${stk.file_id}`,
          description: `Emoji: ${emoji} | Resolusi: ${stk.width}x${stk.height}`
        };
      });
      const listSections = [{
        title: "⚡ OPSI CEPAT",
        rows: actionRows
      }, {
        title: `🖼️ PILIH SATUAN (Hal ${page}/${totalPages})`,
        rows: stickerRows
      }];
      if (sets.length > 1) {
        const otherSetRows = sets.filter(s => s.name !== selectedSet.name).slice(0, 5).map(set => ({
          title: `[#] ${(set.title || set.name).slice(0, 24)}`,
          id: `${prefix}fstik -s "${query}" --pack "${set.name}"`,
          description: `Total ${set.stickers?.length || 0} stiker`
        }));
        if (otherSetRows.length > 0) {
          listSections.push({
            title: `📂 PAKET LAINNYA (${otherSetRows.length})`,
            rows: otherSetRows
          });
        }
      }
      const bodyText = `Hi ${userName}!
Berikut adalah hasil penelusuran stiker Fstik yang ditemukan.

–  *F S T I K*

┌  ◦  *Pack* : ${setName}
│  ◦  *Total* : ${stickers.length} Stickers
│  ◦  *Page* : ${page} / ${totalPages}
└  ◦  *Packs Found* : ${totalPacksCount} Packs

Pilih stiker satuan melalui menu di bawah atau unduh seluruh paket stiker.`;
      const bannerImage = global.bot?.media?.banner1 || "https://files.catbox.moe/g2e6i5.jpg";
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: `📂 PILIH STIKER (${currentPageStickers.length})`,
          sections: listSections
        })
      }];
      if (page > 1) {
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `⬅️ Hal ${page - 1}`,
            id: `${prefix}fstik -s "${query}" --pack "${selectedSet.name}" -p ${page - 1}`
          })
        });
      }
      if (page < totalPages) {
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `➡️ Hal ${page + 1}`,
            id: `${prefix}fstik -s "${query}" --pack "${selectedSet.name}" -p ${page + 1}`
          })
        });
      }
      const options = {
        image: bannerImage,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `${botName} • Fstik Stickers`,
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
            url: bannerImage
          },
          caption: bodyText
        }, {
          quoted: quotedMsg
        });
      }
      await ctx.react("✅");
    } catch (error) {
      console.error("[Fstik Search Error]:", error?.message || error);
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