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
  API_URL: `${global.bot?.api?.wudysoft}/api/search/emoji`,
  TIMEOUT: 3e4,
  API_TIMEOUT: 6e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 40
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
      type: ["t", "provider"],
      vendor: ["v", "plat", "platform"],
      all: ["a", "semua", "pack"],
      index: ["i", "idx"],
      mashup: ["m", "kitchen", "combine"],
      noto: ["n", "notoemoji"],
      gg: ["g", "emojigg"],
      allprovider: ["ap", "emojiall"],
      graph: ["eg", "emojigraph"],
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
async function callEmojiApi(payload = {}) {
  const res = await axios.post(CONFIG.API_URL, payload, {
    headers: {
      "Content-Type": "application/json",
      "User-Agent": CONFIG.USER_AGENT
    },
    timeout: CONFIG.API_TIMEOUT
  });
  return res?.data;
}
export default {
  name: "emoji",
  aliases: ["emojisticker", "emojipedia", "emojikitchen", "mashup", "notoemoji", "emojigg"],
  description: "Download emoji multi-vendor, Emoji Kitchen Mashup, atau Custom Emoji via Wudysoft API",
  category: "Sticker",
  limit: true,
  example: "emoji 😭\nReply pesan dengan .emoji\nReply pesan dengan .emoji --vendor apple\nemoji 🐱 🚀 (Kitchen)\nemoji 😭 --all",
  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "WudysoftBot";
    const authorName = global.bot?.author?.name || "Emoji Downloader";
    const footer = global.footer || global.bot?.footer || `_${botName}_`;
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
    const senderId = ctx.sender || ctx.author || msg.key?.participant || msg.key?.remoteJid || ctx.id;
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["emoji", "emojisticker", "emojipedia", "emojikitchen", "mashup", "notoemoji", "emojigg"].some(a => firstWord.endsWith(a))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const quotedText = (ctx.quoted?.text || ctx.quoted?.caption || ctx.quoted?.body || ctx.quoted?.message?.conversation || ctx.quoted?.message?.extendedTextMessage?.text || ctx.quotedText || "").trim();
      const {
        flags,
        cleanPrompt: initialPrompt
      } = parseFlags(rawText);
      let cleanPrompt = initialPrompt || quotedText;
      const argsArray = cleanPrompt.split(/\s+/).filter(Boolean);
      if (!cleanPrompt && !flags.vendor && flags.index === undefined) {
        const helpText = `– *E M O J I*\n\n` + `┌ ◦ *Usage* : ${prefix}emoji <emoji>\n` + `│ ◦ *Quoted* : Balas pesan berisi emoji dengan ${prefix}emoji\n` + `└ ◦ *Function* : Mengunduh emoji multi-vendor & Emoji Kitchen\n\n` + `– *E X A M P L E*\n\n` + `┌ ◦ *Multi Vendor* : ${prefix}emoji 😭\n` + `│ ◦ *Specific Vendor* : ${prefix}emoji 😭 --vendor apple\n` + `│ ◦ *Kitchen Mashup* : ${prefix}emoji 🐱 🚀\n` + `│ ◦ *All Vendors Pack* : ${prefix}emoji 😭 --all\n` + `│ ◦ *Google Noto HQ* : ${prefix}emoji 🔥 --noto\n` + `└ ◦ *Custom Emoji* : ${prefix}emoji pepe --gg\n\n` + `${footer}`;
        return ctx.reply(helpText);
      }
      await ctx.react("⏳");
      const isMashup = flags.mashup || argsArray.length >= 2 || cleanPrompt.includes("+");
      if (isMashup && !flags.gg && !flags.noto && !flags.all && flags.index === undefined) {
        const parts = cleanPrompt.includes("+") ? cleanPrompt.split("+") : argsArray;
        const e1 = parts[0]?.trim();
        const e2 = parts[1]?.trim();
        if (e1 && e2) {
          const apiRes = await callEmojiApi({
            type: "mashup",
            query: e1,
            target: e2
          });
          const mashupUrl = apiRes?.result?.mashup_url;
          if (!mashupUrl) {
            await ctx.react("❌");
            return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Kombinasi tidak didukung\n` + `└ ◦ *Combo* : ${e1} + ${e2}\n\n` + `${footer}`);
          }
          const rawBuffer = await fetchBuffer(mashupUrl);
          const exif = {
            packname: `Emoji Kitchen: ${e1} + ${e2}`,
            author: authorName,
            categories: [e1, e2]
          };
          const sticker = await buildStickerBuffer(rawBuffer, exif);
          await sock.sendMessage(ctx.id, {
            sticker: sticker
          }, {
            quoted: quotedMsg
          });
          await ctx.react("✅");
          return;
        }
      }
      if (flags.noto) {
        const apiRes = await callEmojiApi({
          type: "notoemoji",
          query: cleanPrompt
        });
        const imgUrl = apiRes?.result?.image_url;
        if (!imgUrl) {
          await ctx.react("❌");
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Karakter tidak valid\n` + `└ ◦ *Info* : Emoji tidak didukung oleh Google Noto.\n\n` + `${footer}`);
        }
        const rawBuffer = await fetchBuffer(imgUrl);
        const exif = {
          packname: "Google Noto Emoji",
          author: authorName,
          categories: [cleanPrompt]
        };
        const sticker = await buildStickerBuffer(rawBuffer, exif);
        await sock.sendMessage(ctx.id, {
          sticker: sticker
        }, {
          quoted: quotedMsg
        });
        await ctx.react("✅");
        return;
      }
      if (flags.gg) {
        const apiRes = await callEmojiApi({
          type: "emojigg",
          query: cleanPrompt
        });
        const ggItems = apiRes?.result || [];
        if (!Array.isArray(ggItems) || !ggItems.length) {
          await ctx.react("❌");
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Emoji tidak ditemukan\n` + `└ ◦ *Query* : "${cleanPrompt}" (Emoji.gg)\n\n` + `${footer}`);
        }
        const targetItem = flags.index ? ggItems[Number(flags.index) - 1] || ggItems[0] : ggItems[0];
        const downloadUrl = targetItem?.image;
        if (!downloadUrl) {
          await ctx.react("❌");
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Gambar tidak tersedia\n` + `└ ◦ *Info* : Gagal memperoleh URL dari Emoji.gg.\n\n` + `${footer}`);
        }
        const rawBuffer = await fetchBuffer(downloadUrl);
        const exif = {
          packname: `Emoji.gg: ${targetItem.title}`,
          author: authorName,
          categories: ["✨"]
        };
        const sticker = await buildStickerBuffer(rawBuffer, exif);
        await sock.sendMessage(ctx.id, {
          sticker: sticker
        }, {
          quoted: quotedMsg
        });
        await ctx.react("✅");
        return;
      }
      const targetEmoji = cleanPrompt || "😭";
      let emojiData = null;
      const userCached = emojiCache.get(senderId);
      if (userCached && userCached.query === targetEmoji && userCached.vendors?.length) {
        emojiData = userCached;
      } else {
        const apiRes = await callEmojiApi({
          type: flags.graph ? "emojigraph" : flags.allprovider ? "emojiall" : "emojipedia",
          query: targetEmoji
        });
        if (!apiRes?.status || !apiRes?.result) {
          await ctx.react("❌");
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Data emoji tidak ditemukan\n` + `└ ◦ *Target* : "${targetEmoji}"\n\n` + `${footer}`);
        }
        emojiData = {
          query: targetEmoji,
          title: apiRes.result.title || apiRes.result.slug || targetEmoji,
          code: apiRes.result.code || targetEmoji,
          slug: apiRes.result.slug || targetEmoji,
          vendors: apiRes.result.vendors || []
        };
        if (emojiCache.size > 50) emojiCache.clear();
        emojiCache.set(senderId, emojiData);
      }
      const vendors = emojiData?.vendors || [];
      if (!vendors.length) {
        await ctx.react("❌");
        return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Vendor tidak ditemukan\n` + `└ ◦ *Info* : Tidak ada variasi platform untuk emoji "${targetEmoji}".\n\n` + `${footer}`);
      }
      if (flags.vendor) {
        const vQuery = String(flags.vendor).toLowerCase().trim();
        const found = vendors.find(v => v.name?.toLowerCase().includes(vQuery));
        if (!found || !found.image) {
          await ctx.react("❌");
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Vendor tidak ditemukan\n` + `└ ◦ *Available* : ${vendors.map(v => v.name).join(", ")}\n\n` + `${footer}`);
        }
        const rawBuffer = await fetchBuffer(found.image);
        const exif = {
          packname: `${found.name} Emoji`,
          author: authorName,
          categories: [emojiData.code]
        };
        const sticker = await buildStickerBuffer(rawBuffer, exif);
        await sock.sendMessage(ctx.id, {
          sticker: sticker
        }, {
          quoted: quotedMsg
        });
        await ctx.react("✅");
        return;
      }
      if (flags.index !== undefined) {
        const targetIdx = Number(flags.index) - 1;
        const found = vendors[targetIdx];
        if (!found || !found.image) {
          await ctx.react("❌");
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Index vendor salah\n` + `└ ◦ *Index* : #${flags.index}\n\n` + `${footer}`);
        }
        const rawBuffer = await fetchBuffer(found.image);
        const exif = {
          packname: `${found.name} Emoji`,
          author: authorName,
          categories: [emojiData.code]
        };
        const sticker = await buildStickerBuffer(rawBuffer, exif);
        await sock.sendMessage(ctx.id, {
          sticker: sticker
        }, {
          quoted: quotedMsg
        });
        await ctx.react("✅");
        return;
      }
      if (flags.all) {
        const downloadedStickers = [];
        const processLimit = Math.min(vendors.length, CONFIG.MAX_LIMIT);
        for (let i = 0; i < processLimit; i++) {
          try {
            const v = vendors[i];
            if (!v?.image) continue;
            const rawBuffer = await fetchBuffer(v.image);
            const exif = {
              packname: `${emojiData.title} Pack`,
              author: `${v.name} • ${authorName}`,
              categories: [emojiData.code]
            };
            const webpBuffer = await buildStickerBuffer(rawBuffer, exif);
            downloadedStickers.push({
              buffer: webpBuffer,
              emoji: emojiData.code || "✨"
            });
          } catch (e) {
            console.error(`[EmojiPack Skip] Gagal unduh vendor ${vendors[i]?.name}:`, e?.message);
          }
        }
        if (!downloadedStickers.length) {
          await ctx.react("❌");
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Gagal memproses pack\n` + `└ ◦ *Info* : Berkas gambar vendor tidak dapat diunduh.\n\n` + `${footer}`);
        }
        await stickerPack(sock, ctx.id, downloadedStickers, {
          name: `${emojiData.title} (${emojiData.code})`,
          publisher: authorName,
          description: `All Vendors Emoji Pack for ${emojiData.title}`,
          quoted: quotedMsg
        });
        await ctx.react("✅");
        return;
      }
      const totalVendors = vendors.length;
      const itemsPerPage = 10;
      const totalPages = Math.ceil(totalVendors / itemsPerPage) || 1;
      let page = Number(flags.page) || 1;
      if (page < 1) page = 1;
      if (page > totalPages) page = totalPages;
      const startIndex = (page - 1) * itemsPerPage;
      const currentPageItems = vendors.slice(startIndex, startIndex + itemsPerPage);
      const actionRows = [{
        title: `Unduh Full Pack (${totalVendors} Vendor)`,
        id: `${prefix}emoji ${emojiData.code} --all`,
        description: "Kirim semua variasi vendor sebagai 1 Sticker Pack"
      }, {
        title: "Google Noto Emoji HQ",
        id: `${prefix}emoji ${emojiData.code} --noto`,
        description: "Unduh versi resolusi tinggi 512px dari Google Noto"
      }];
      const vendorRows = currentPageItems.map((v, i) => {
        const realIndex = startIndex + i + 1;
        return {
          title: `${emojiData.code} ${v.name}`.slice(0, 24),
          id: `${prefix}emoji ${emojiData.code} -i ${realIndex}`,
          description: `Pilih stiker versi vendor ${v.name}`
        };
      });
      const listSections = [{
        title: "OPSI CEPAT",
        rows: actionRows
      }, {
        title: `PILIH VENDOR (Hal ${page}/${totalPages})`,
        rows: vendorRows
      }];
      const bannerImage = vendors[0]?.image || "https://files.catbox.moe/g2e6i5.jpg";
      const bodyText = `– *E M O J I*\n\n` + `┌ ◦ *Emoji* : ${emojiData.code} (${emojiData.title})\n` + `│ ◦ *Total* : ${totalVendors} Platform Vendor\n` + `│ ◦ *Slug* : ${emojiData.slug}\n` + `└ ◦ *Action* : Pilih variasi vendor pada tombol di bawah\n\n` + `${footer}`;
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: "DAFTAR DESAIN VENDOR",
          sections: listSections
        })
      }];
      if (page > 1) {
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `Hal ${page - 1}`,
            id: `${prefix}emoji ${emojiData.code} -p ${page - 1}`
          })
        });
      }
      if (page < totalPages) {
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `Hal ${page + 1}`,
            id: `${prefix}emoji ${emojiData.code} -p ${page + 1}`
          })
        });
      }
      buttons.push({
        name: "cta_url",
        buttonParamsJson: JSON.stringify({
          display_text: "Buka di Emojipedia",
          url: `https://emojipedia.org/${emojiData.slug}`
        })
      });
      const options = {
        image: bannerImage,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `${botName} • Emoji Suite`,
            button_title: "Pilih Vendor"
          }
        },
        contextInfo: {
          forwardingScore: 999,
          isForwarded: true
        },
        quoted: quotedMsg
      };
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, `${botName} • Emoji Suite`, buttons, options);
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
      console.error("[Emoji Feature Error]:", error);
      await ctx.react("❌");
      let errorMessage = error?.message || "Terjadi kesalahan";
      if (error?.response?.data) {
        try {
          const parsed = typeof error.response.data === "string" ? JSON.parse(error.response.data) : error.response.data;
          errorMessage = parsed.error || parsed.message || errorMessage;
        } catch {}
      }
      ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : ${errorMessage}\n` + `└ ◦ *Command* : ${ctx.command || "emoji"}\n\n` + `${footer}`);
    }
  }
};