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
  API_URL: `${global.bot?.api?.wudysoft}/api/sticker/stickerly/v1`,
  TIMEOUT: 3e4,
  API_TIMEOUT: 6e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 30
};
const stickerlyCache = new Map();
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
        description: `Sticker.ly: ${packData.name}`,
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
      id: ["packid", "p", "pack", "code"],
      search: ["s", "q", "query"],
      all: ["a", "semua"],
      trending: ["trend", "tr"],
      index: ["i", "idx"],
      limit: ["l"],
      page: ["pg"]
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
    const linkMatch = cleanPrompt.match(/sticker\.ly\/s\/([A-Za-z0-9_-]+)/i);
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
  name: "stickerly",
  aliases: ["stikerly", "sly", "lysticker", "spack"],
  description: "Cari & unduh stiker Sticker.ly langsung jadi WhatsApp Sticker Pack",
  category: "Sticker",
  limit: true,
  example: "• Cari: .stickerly masha\n• Full Pack: .stickerly --id QJ1ZF8\n• Satuan: .stickerly --id QJ1ZF8 -i 1\n• Trending: .stickerly --trending",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["stickerly", "stikerly", "sly", "lysticker", "spack"].some(a => firstWord.endsWith(a))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • Sticker.ly Engine`;
      const authorName = global.bot?.author?.name || "Sticker.ly Pack";
      const userName = ctx.pushname || ctx.sender.split("@")[0];
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const senderId = ctx.sender || ctx.author || msg.key?.participant || msg.key?.remoteJid || ctx.id;
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      const query = flags.search || cleanPrompt;
      if (flags.trending) {
        await ctx.react?.("⏳");
        const {
          data
        } = await axios.get(CONFIG.API_URL, {
          params: {
            action: "trending"
          },
          timeout: CONFIG.TIMEOUT
        });
        const keywords = data?.keywords || [];
        if (!keywords.length) {
          await ctx.react?.("❌");
          return ctx.reply("❌ Gagal memuat kata kunci trending dari Sticker.ly.");
        }
        const trendList = keywords.slice(0, 15).map((item, idx) => {
          const isLast = idx === Math.min(keywords.length, 15) - 1;
          const branch = isLast ? "└" : "│";
          const newBadge = item.isNew ? " *(Baru)*" : "";
          return `${branch}  ◦  *${idx + 1}.* ${item.keyword}${newBadge}`;
        }).join("\n");
        const trendRows = keywords.slice(0, 10).map((item, i) => ({
          title: `🔍 ${item.keyword}`.slice(0, 24),
          id: `${prefix}stickerly ${item.keyword}`,
          description: `Cari stiker untuk topik "${item.keyword}"`
        }));
        const bodyText = `–  *T R E N D I N G  S T I C K E R S*

Berikut adalah kata kunci stiker yang sedang tren di Sticker.ly saat ini:

${trendList}

Pilih kata kunci di bawah untuk langsung mencari paket stiker.`;
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "🔥 PILIH TREN STIKER",
            sections: [{
              title: "Kata Kunci Populer",
              rows: trendRows
            }]
          })
        }];
        const options = {
          contextInfo: {
            mentionedJid: [ctx.sender],
            forwardingScore: 999,
            isForwarded: true
          },
          quoted: quotedMsg
        };
        await ctx.react?.("✅");
        if (typeof ctx.sendCta === "function") {
          return await ctx.sendCta(bodyText, botFooter, buttons, options);
        } else {
          return await ctx.reply(bodyText, {
            quoted: quotedMsg
          });
        }
      }
      if (flags.id) {
        const packId = String(flags.id).trim();
        await ctx.react?.("⏳");
        const {
          data
        } = await axios.get(CONFIG.API_URL, {
          params: {
            action: "pack_det",
            id: packId
          },
          timeout: CONFIG.API_TIMEOUT
        });
        const packInfo = data?.stickerPack || data;
        const stickersList = data?.stickers || [];
        const prefixUrl = data?.resourceUrlPrefix || packInfo?.resourceUrlPrefix || "";
        if (!stickersList.length && !packInfo?.resourceFileNames?.length) {
          await ctx.react?.("❌");
          return ctx.reply(`❌ Paket stiker dengan ID *"${packId}"* tidak ditemukan atau bersifat privat.`);
        }
        const setName = packInfo?.name || "Sticker.ly Pack";
        const packAuthor = packInfo?.authorName || authorName;
        const rawFiles = stickersList.length > 0 ? stickersList.map(s => s.fileName) : packInfo.resourceFileNames || [];
        if (flags.index !== undefined) {
          const targetIndex = Number(flags.index) - 1;
          const fileName = rawFiles[targetIndex];
          if (!fileName) {
            await ctx.react?.("❌");
            return ctx.reply(`❌ Stiker nomor #${flags.index} tidak ada. Paket ini hanya memiliki ${rawFiles.length} stiker.`);
          }
          const fileUrl = `${prefixUrl}${fileName}`;
          const rawBuffer = await fetchBuffer(fileUrl);
          const exif = {
            packname: setName,
            author: packAuthor,
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
        const processLimit = Math.min(rawFiles.length, CONFIG.MAX_LIMIT);
        await ctx.reply(`–  *P R O C E S S I N G*

Sedang mengunduh ${processLimit} stiker dari Sticker.ly ke dalam format Sticker Pack WhatsApp...`);
        const downloadedStickers = [];
        for (let i = 0; i < processLimit; i++) {
          try {
            const fileName = rawFiles[i];
            const fileUrl = `${prefixUrl}${fileName}`;
            const rawBuffer = await fetchBuffer(fileUrl);
            const exif = {
              packname: setName,
              author: packAuthor,
              categories: ["✨"]
            };
            const webpBuffer = await buildStickerBuffer(rawBuffer, exif);
            downloadedStickers.push({
              data: webpBuffer,
              emojis: ["✨"]
            });
          } catch (e) {
            console.error(`[Stickerly Skip] Gagal unduh stiker index ${i}:`, e?.message);
          }
        }
        if (!downloadedStickers.length) {
          await ctx.react?.("❌");
          return ctx.reply("❌ Gagal mengunduh berkas stiker dari paket ini.");
        }
        await sendSmartStickerPack(sock, ctx.id, {
          name: setName,
          publisher: packAuthor,
          stickers: downloadedStickers,
          cover: downloadedStickers[0]?.data
        }, {
          quoted: quotedMsg
        });
        return ctx.react?.("✅");
      }
      if (!query) {
        return ctx.reply(`–  *S T I C K E R . L Y*

Jelajahi dan unduh jutaan paket stiker resmi dari Sticker.ly.

┌  ◦  *Pencarian* : \`${prefix}stickerly <kata_kunci>\`
│  ◦  *Unduh Pack* : \`${prefix}stickerly --id <packId>\`
│  ◦  *Unduh Satuan* : \`${prefix}stickerly --id <packId> -i 1\`
│  ◦  *Stiker Tren* : \`${prefix}stickerly --trending\`
└  ◦  *Example* : \`${prefix}stickerly masha\`

–  *D A F T A R  F L A G S*

┌  ◦  *--id <id>* : Unduh paket stiker via ID atau link
│  ◦  *-i, --index <n>* : Unduh nomor stiker tertentu
│  ◦  *--trending* : Jelajahi topik stiker yang sedang viral
└  ◦  *-p, --page <n>* : Navigasi nomor halaman`);
      }
      await ctx.react?.("⏳");
      const {
        data
      } = await axios.get(CONFIG.API_URL, {
        params: {
          action: "pack_search",
          keyword: query
        },
        timeout: CONFIG.API_TIMEOUT
      });
      const stickerPacks = data?.stickerPacks || [];
      if (!stickerPacks.length) {
        await ctx.react?.("❌");
        return ctx.reply(`❌ Tidak ditemukan stiker untuk kata kunci: *"${query}"*`);
      }
      if (!stickerlyCache.has(senderId)) {
        stickerlyCache.set(senderId, new Map());
      }
      const userCache = stickerlyCache.get(senderId);
      if (userCache.size > 50) userCache.clear();
      stickerPacks.forEach(pack => {
        if (pack.packId) userCache.set(pack.packId, pack);
      });
      if (flags.all) {
        const topPack = stickerPacks[0];
        const resFiles = topPack.resourceFiles || [];
        const prefixUrl = topPack.resourceUrlPrefix || "";
        const processLimit = Math.min(resFiles.length, CONFIG.MAX_LIMIT);
        await ctx.reply(`–  *P R O C E S S I N G*

Sedang merakit ${processLimit} stiker dari pack *"${topPack.name}"*...`);
        const downloadedStickers = [];
        for (let i = 0; i < processLimit; i++) {
          try {
            const fileName = resFiles[i];
            const fileUrl = `${prefixUrl}${fileName}`;
            const rawBuffer = await fetchBuffer(fileUrl);
            const exif = {
              packname: topPack.name,
              author: topPack.authorName || authorName,
              categories: ["✨"]
            };
            const webpBuffer = await buildStickerBuffer(rawBuffer, exif);
            downloadedStickers.push({
              data: webpBuffer,
              emojis: ["✨"]
            });
          } catch (_) {}
        }
        if (!downloadedStickers.length) {
          await ctx.react?.("❌");
          return ctx.reply("❌ Gagal mengunduh stiker.");
        }
        await sendSmartStickerPack(sock, ctx.id, {
          name: topPack.name,
          publisher: topPack.authorName || authorName,
          stickers: downloadedStickers,
          cover: downloadedStickers[0]?.data
        }, {
          quoted: quotedMsg
        });
        return ctx.react?.("✅");
      }
      const itemsPerPage = 8;
      const totalItems = stickerPacks.length;
      const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
      let page = Number(flags.page) || 1;
      if (page < 1) page = 1;
      if (page > totalPages) page = totalPages;
      const startIndex = (page - 1) * itemsPerPage;
      const currentPacks = stickerPacks.slice(startIndex, startIndex + itemsPerPage);
      const topPack = stickerPacks[0];
      const actionRows = [{
        title: `📦 Unduh Pack Teratas`,
        id: `${prefix}stickerly --id ${topPack.packId}`,
        description: `Judul: ${topPack.name.slice(0, 28)} (${topPack.resourceFiles?.length || 0} Stiker)`
      }];
      const packRows = currentPacks.map((pack, idx) => {
        const itemNumber = startIndex + idx + 1;
        const animatedTag = pack.animated || pack.isAnimated ? "🎞️ " : "";
        return {
          title: `[#${itemNumber}] ${animatedTag}${pack.name}`.slice(0, 24),
          id: `${prefix}stickerly --id ${pack.packId}`,
          description: `ID: ${pack.packId} • By: ${pack.authorName || "-"} • ${pack.resourceFiles?.length || 0} Stiker`
        };
      });
      const listSections = [{
        title: "⚡ OPSI CEPAT",
        rows: actionRows
      }, {
        title: `🖼️ PILIH PACK (Hal ${page}/${totalPages})`,
        rows: packRows
      }];
      const previewThumb = topPack.resourceUrlPrefix && topPack.resourceFiles?.[0] ? `${topPack.resourceUrlPrefix}${topPack.resourceFiles[0]}` : topPack.user?.profileUrl || "https://files.catbox.moe/g2e6i5.jpg";
      const bodyText = `Hi ${userName}!
Berikut adalah hasil pencarian paket stiker dari Sticker.ly.

–  *S T I C K E R . L Y*

┌  ◦  *Query* : ${query}
│  ◦  *Top Pack* : ${topPack.name}
│  ◦  *Author* : ${topPack.authorName || "-"}
│  ◦  *Total Stiker* : ${topPack.resourceFiles?.length || 0} Item
│  ◦  *Downloads* : ${topPack.exportCount?.toLocaleString("id-ID") || 0}x
└  ◦  *Page* : ${page} / ${totalPages}

Pilih paket stiker pada menu di bawah untuk mengunduh seluruh stiker.`;
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: `📂 DAFTAR STICKER PACK (${totalItems})`,
          sections: listSections
        })
      }];
      if (page > 1) {
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `⬅️ Hal ${page - 1}`,
            id: `${prefix}stickerly -s "${query}" -p ${page - 1}`
          })
        });
      }
      if (page < totalPages) {
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `➡️ Hal ${page + 1}`,
            id: `${prefix}stickerly -s "${query}" -p ${page + 1}`
          })
        });
      }
      const options = {
        image: previewThumb,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `${botName} • Sticker.ly`,
            button_title: "Lihat Koleksi"
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
      console.error("[Sticker.ly Error]:", error?.message || error);
      await ctx.react?.("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || error.message;
      ctx.reply(`❌ Terjadi kesalahan pada Sticker.ly: ${errMsg}`);
    }
  }
};