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
  API_URL: `${global.bot?.api?.wudysoft}/api/search/searchemoji`,
  TIMEOUT: 3e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  MAX_PACK_LIMIT: 30
};
const emojiCache = new Map();

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /(?:--|-)([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1].toLowerCase();
    let rawVal = match[2];
    let val = true;
    const aliasMap = {
      vendor: ["v", "plat", "platform"],
      all: ["a", "semua", "pack"],
      index: ["i", "idx"],
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
      return await writeExifImg(buffer, exif);
    } catch {
      try {
        return await writeExifVid(buffer, exif);
      } catch {
        return buffer;
      }
    }
  }
}
async function callSearchEmojiApi(emoji) {
  const res = await axios.get(CONFIG.API_URL, {
    params: {
      emoji: emoji
    },
    headers: {
      "User-Agent": CONFIG.USER_AGENT
    },
    timeout: CONFIG.TIMEOUT
  });
  return res?.data;
}
export default {
  name: "searchemoji",
  aliases: ["semoji", "emojivendor", "emojiallvendor", "semojiplat"],
  description: "Download emoji platform vendor (Apple, Google, WhatsApp, dll) via SearchEmoji API (Mendukung Reply Quoted)",
  category: "Sticker",
  limit: true,
  example: "searchemoji 😀\nsearchemoji 😀 --vendor apple\nsearchemoji 😀 --all\nReply pesan dengan .searchemoji",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["searchemoji", "semoji", "emojivendor", "emojiallvendor", "semojiplat"].some(a => firstWord.endsWith(a))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const quotedText = (ctx.quoted?.text || ctx.quoted?.caption || ctx.quoted?.body || ctx.quoted?.message?.conversation || ctx.quoted?.message?.extendedTextMessage?.text || ctx.quotedText || "").trim();
      const {
        flags,
        cleanPrompt: initialPrompt
      } = parseFlags(rawText);
      let cleanPrompt = initialPrompt || quotedText;
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const authorName = global.bot?.author?.name || "SearchEmoji";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const senderId = ctx.sender || ctx.author || msg.key?.participant || msg.key?.remoteJid || ctx.id;
      if (!cleanPrompt && !flags.vendor && flags.index === undefined) {
        return ctx.reply(`🔍 *SEARCH EMOJI MULTI-PLATFORM (WUDYSOFT API)*\n\n` + `• *Cara Penggunaan:*\n` + `  👉 *Cari Emoji:* \`${prefix}searchemoji 😀\` atau reply emoji dengan \`${prefix}searchemoji\`\n` + `  👉 *Pilih Platform/Vendor:* \`${prefix}searchemoji 😀 --vendor apple\`\n` + `  👉 *Download Full Pack Stiker:* \`${prefix}searchemoji 😀 --all\`\n` + `  👉 *Pilih Berdasarkan Index:* \`${prefix}searchemoji 😀 -i 2\`\n\n` + `• *Daftar Vendor yang Didukung:*\n` + `  🍎 *Apple*, 🌐 *Google*, 📘 *Facebook*, ✖️ *X / Twitter*, 💻 *Microsoft*, 📱 *Samsung*, 💬 *Whatsapp*`);
      }
      await ctx.react("⏳");
      const targetEmoji = cleanPrompt || "😀";
      let emojiData = null;
      const userCached = emojiCache.get(senderId);
      if (userCached && userCached.character === targetEmoji && userCached.vendors?.length) {
        emojiData = userCached;
      } else {
        const apiRes = await callSearchEmojiApi(targetEmoji);
        if (!apiRes?.status || !apiRes?.result) {
          await ctx.react("❌");
          return ctx.reply(`❌ Gagal menemukan data emoji untuk "${targetEmoji}".`);
        }
        emojiData = apiRes.result;
        if (emojiCache.size > 50) emojiCache.clear();
        emojiCache.set(senderId, emojiData);
      }
      const vendors = emojiData?.vendors || [];
      if (!vendors.length) {
        await ctx.react("❌");
        return ctx.reply(`❌ Tidak ada platform vendor yang ditemukan untuk emoji "${targetEmoji}".`);
      }
      if (flags.vendor) {
        const vQuery = String(flags.vendor).toLowerCase().trim();
        const found = vendors.find(v => v.vendor?.toLowerCase().includes(vQuery) || v.imgPath?.toLowerCase().includes(vQuery));
        if (!found || !found.url) {
          await ctx.react("❌");
          return ctx.reply(`❌ Vendor "${flags.vendor}" tidak ditemukan.\nVendor yang tersedia: ${vendors.map(v => v.vendor).join(", ")}`);
        }
        const rawBuffer = await fetchBuffer(found.url);
        const exif = {
          packname: `${found.vendor} Emoji`,
          author: authorName,
          categories: [emojiData.character || "✨"]
        };
        const sticker = await buildStickerBuffer(rawBuffer, exif);
        await sock.sendMessage(ctx.id, {
          sticker: sticker
        }, {
          quoted: quotedMsg
        });
        return ctx.react("✅");
      }
      if (flags.index !== undefined) {
        const targetIdx = Number(flags.index) - 1;
        const found = vendors[targetIdx];
        if (!found || !found.url) {
          await ctx.react("❌");
          return ctx.reply(`❌ Vendor pada index #${flags.index} tidak ditemukan.`);
        }
        const rawBuffer = await fetchBuffer(found.url);
        const exif = {
          packname: `${found.vendor} Emoji`,
          author: authorName,
          categories: [emojiData.character || "✨"]
        };
        const sticker = await buildStickerBuffer(rawBuffer, exif);
        await sock.sendMessage(ctx.id, {
          sticker: sticker
        }, {
          quoted: quotedMsg
        });
        return ctx.react("✅");
      }
      if (flags.all) {
        const downloadedStickers = [];
        const processLimit = Math.min(vendors.length, CONFIG.MAX_PACK_LIMIT);
        for (let i = 0; i < processLimit; i++) {
          try {
            const v = vendors[i];
            if (!v?.url) continue;
            const rawBuffer = await fetchBuffer(v.url);
            const exif = {
              packname: `${emojiData.name || emojiData.character} Pack`,
              author: `${v.vendor} • ${authorName}`,
              categories: [emojiData.character || "✨"]
            };
            const webpBuffer = await buildStickerBuffer(rawBuffer, exif);
            downloadedStickers.push({
              buffer: webpBuffer,
              emoji: emojiData.character || "✨"
            });
          } catch (e) {
            console.error(`[SearchEmoji Pack Skip] Gagal unduh vendor ${vendors[i]?.vendor}:`, e?.message);
          }
        }
        if (!downloadedStickers.length) {
          await ctx.react("❌");
          return ctx.reply("❌ Gagal merakit stiker pack vendor emoji.");
        }
        ctx.reply(`⏳ Sedang membuat Sticker Pack dari ${downloadedStickers.length} platform vendor...`);
        await stickerPack(sock, ctx.id, downloadedStickers, {
          name: `${emojiData.name} (${emojiData.code})`,
          publisher: authorName,
          description: `All Platforms Emoji Pack for ${emojiData.name}`,
          quoted: quotedMsg
        });
        return ctx.react("✅");
      }
      const totalVendors = vendors.length;
      const itemsPerPage = 8;
      const totalPages = Math.ceil(totalVendors / itemsPerPage) || 1;
      let page = Number(flags.page) || 1;
      if (page < 1) page = 1;
      if (page > totalPages) page = totalPages;
      const startIndex = (page - 1) * itemsPerPage;
      const currentPageItems = vendors.slice(startIndex, startIndex + itemsPerPage);
      const actionRows = [{
        title: `📦 Unduh Full Pack (${totalVendors} Platform)`,
        id: `${prefix}searchemoji ${emojiData.character} --all`,
        description: `Kirim semua variasi vendor menjadi 1 Sticker Pack WhatsApp`
      }];
      const vendorRows = currentPageItems.map((v, i) => {
        const realIndex = startIndex + i + 1;
        return {
          title: `${emojiData.character} ${v.vendor}`,
          id: `${prefix}searchemoji ${emojiData.character} -i ${realIndex}`,
          description: `Pilih stiker versi platform ${v.vendor}`
        };
      });
      const listSections = [{
        title: `⚡ OPSI CEPAT`,
        rows: actionRows
      }, {
        title: `🎨 PILIH VENDOR (${page}/${totalPages})`,
        rows: vendorRows
      }];
      const bannerImage = vendors[0]?.url || "https://searchemoji.app/logo.png";
      const keywordsStr = emojiData.keywords?.slice(0, 5).join(", ") || "-";
      const bodyText = `🔍 *DETAIL SEARCH EMOJI*\n\n` + `• *Emoji:* ${emojiData.character} (${emojiData.name})\n` + `• *Unicode:* \`${emojiData.code}\`\n` + `• *Kategori:* ${emojiData.category} > ${emojiData.subcategory}\n` + `• *Versi:* v${emojiData.version}\n` + `• *Keywords:* _${keywordsStr}_\n` + `• *Total Platform:* ${totalVendors} Vendor\n\n` + `_Silakan pilih platform tertentu melalui tombol di bawah atau klik "Unduh Full Pack" untuk mengambil semua desain:_`;
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: `📂 PILIH PLATFORM VENDOR`,
          sections: listSections
        })
      }];
      if (page > 1) {
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `⬅️ Hal ${page - 1}`,
            id: `${prefix}searchemoji ${emojiData.character} -p ${page - 1}`
          })
        });
      }
      if (page < totalPages) {
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `➡️ Hal ${page + 1}`,
            id: `${prefix}searchemoji ${emojiData.character} -p ${page + 1}`
          })
        });
      }
      if (emojiData.source) {
        buttons.push({
          name: "cta_url",
          display_text: "🌐 Sumber SearchEmoji",
          url: emojiData.source
        });
      }
      const options = {
        image: bannerImage,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `${botName} • SearchEmoji`,
            button_title: "Pilih Platform"
          }
        },
        contextInfo: {
          forwardingScore: 999,
          isForwarded: true
        },
        quoted: quotedMsg
      };
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, `${botName} • SearchEmoji Suite`, buttons, options);
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
      console.error("[SearchEmoji Plugin Error]:", error?.message || error);
      await ctx.react("❌");
      let errorMessage = error?.message || "Terjadi kesalahan";
      if (error?.response?.data) {
        try {
          const parsed = typeof error.response.data === "string" ? JSON.parse(error.response.data) : error.response.data;
          errorMessage = parsed.error || parsed.message || errorMessage;
        } catch {}
      }
      ctx.reply(`❌ Terjadi kesalahan: ${errorMessage}`);
    }
  }
};