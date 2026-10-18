import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
import {
  stickerPack
} from "../../lib/pack.js";
import {
  writeExif
} from "../../lib/exif.js";
const CONFIG = {
  API_URL: `${global.bot?.api?.wudysoft}/api/search/stickercloud`,
  TIMEOUT: 35e3,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  MAX_STICKERS_PER_PACK: 30
};

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /(?:--|-)([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1].toLowerCase();
    let rawVal = match[2];
    let val = true;
    const aliasMap = {
      slug: ["s", "pack", "id"],
      page: ["p", "pg"],
      index: ["i", "idx"],
      all: ["a", "full", "download"]
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
async function callStickerCloudApi(type, params = {}) {
  const res = await axios.get(CONFIG.API_URL, {
    params: {
      type: type,
      ...params
    },
    headers: {
      "User-Agent": CONFIG.USER_AGENT
    },
    timeout: CONFIG.TIMEOUT
  });
  return res?.data;
}
export default {
  name: "stickercloud",
  aliases: ["scloud", "stikercloud", "scpack", "stickerscloud"],
  description: "Cari dan download Sticker Pack WhatsApp dari database Stickers.cloud",
  category: "Sticker",
  limit: true,
  example: "stickercloud quby\n" + "stickercloud --slug chubbyquby\n" + "stickercloud spongebob --page 2\n" + "Reply chat dengan .stickercloud",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["stickercloud", "scloud", "stikercloud", "scpack", "stickerscloud"].some(a => firstWord.endsWith(a))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const quotedText = (ctx.quoted?.text || ctx.quoted?.caption || ctx.quoted?.body || ctx.quoted?.message?.conversation || ctx.quoted?.message?.extendedTextMessage?.text || ctx.quotedText || "").trim();
      const {
        flags,
        cleanPrompt: initialPrompt
      } = parseFlags(rawText);
      const query = initialPrompt || quotedText;
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const authorName = global.bot?.author?.name || "StickerCloud";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (!query && !flags.slug) {
        return ctx.reply(`☁️ *STICKERCLOUD PACK DOWNLOADER*\n\n` + `• *Cara Penggunaan:*\n` + `  👉 *Cari Pack Stiker:* \`${prefix}stickercloud <kata_kunci>\`\n` + `  👉 *Download 1 Pack Utuh:* \`${prefix}stickercloud --slug <nama-slug>\`\n` + `  👉 *Download Stiker by Index:* \`${prefix}stickercloud --slug <nama-slug> -i 1\`\n` + `  👉 *Cari via Reply Pesan:* Balas chat dengan \`${prefix}stickercloud\`\n\n` + `📌 *Contoh Perintah:*\n` + `• \`${prefix}stickercloud quby\`\n` + `• \`${prefix}stickercloud --slug chubbyquby\`\n` + `• \`${prefix}stickercloud pentol --page 2\``);
      }
      await ctx.react("⏳");
      const targetSlug = flags.slug ? String(flags.slug) : !query.includes(" ") && !flags.page ? query : null;
      if (flags.slug || targetSlug && flags.all) {
        const slugName = flags.slug ? String(flags.slug) : targetSlug;
        const data = await callStickerCloudApi("slug", {
          slug: slugName
        });
        if (!data?.success || !data?.result) {
          await ctx.react("❌");
          return ctx.reply(`❌ Pack stiker dengan slug "${slugName}" tidak ditemukan.`);
        }
        const pack = data.result;
        const stickersList = (pack.stickers || []).filter(s => s.sticker_src);
        if (!stickersList.length) {
          await ctx.react("❌");
          return ctx.reply(`❌ Tidak ada stiker di dalam pack "${pack.title}".`);
        }
        if (flags.index !== undefined) {
          const targetIdx = Number(flags.index) - 1;
          const selected = stickersList[targetIdx] || stickersList[0];
          const res = await axios.get(selected.sticker_src, {
            responseType: "arraybuffer"
          });
          const rawBuffer = Buffer.from(res.data);
          const exif = {
            packname: pack.title,
            author: authorName,
            categories: ["✨"]
          };
          const stickerBuf = await writeExif({
            data: rawBuffer,
            mimetype: "image/webp"
          }, exif);
          await sock.sendMessage(ctx.id, {
            sticker: stickerBuf
          }, {
            quoted: quotedMsg
          });
          return ctx.react("✅");
        }
        ctx.reply(`⏳ Sedang mengunduh ${Math.min(stickersList.length, CONFIG.MAX_STICKERS_PER_PACK)} stiker dari pack *${pack.title}*...`);
        const downloadedStickers = [];
        const limitCount = Math.min(stickersList.length, CONFIG.MAX_STICKERS_PER_PACK);
        for (let i = 0; i < limitCount; i++) {
          try {
            const item = stickersList[i];
            const res = await axios.get(item.sticker_src, {
              responseType: "arraybuffer",
              timeout: 2e4
            });
            downloadedStickers.push({
              buffer: Buffer.from(res.data),
              emoji: "✨"
            });
          } catch (err) {
            console.error(`[StickerCloud Skip] Gagal unduh stiker #${i + 1}:`, err?.message);
          }
        }
        if (!downloadedStickers.length) {
          await ctx.react("❌");
          return ctx.reply("❌ Gagal memproses stiker menjadi Sticker Pack WhatsApp.");
        }
        await stickerPack(sock, ctx.id, downloadedStickers, {
          name: pack.title,
          publisher: pack.author?.username || authorName,
          description: `Stickers from Stickers.cloud (${pack.slug})`,
          quoted: quotedMsg
        });
        return ctx.react("✅");
      }
      const page = Number(flags.page) || 1;
      const data = await callStickerCloudApi("search", {
        query: query,
        page: page
      });
      const packData = data?.result?.data || [];
      if (!data?.success || !packData.length) {
        await ctx.react("❌");
        return ctx.reply(`❌ Tidak ditemukan sticker pack dengan kata kunci "${query}".`);
      }
      const totalFound = data?.result?.total || packData.length;
      const currentPage = data?.result?.current_page || page;
      const lastPage = data?.result?.last_page || 1;
      const actionRows = packData.slice(0, 10).map((p, i) => ({
        title: `${p.title.slice(0, 24)} (${p.stickers?.length || 0} Stiker)`,
        id: `${prefix}stickercloud --slug ${p.slug}`,
        description: `Author: @${p.author?.username || "Anon"} | Animasi: ${p.animated ? "Ya" : "Tidak"}`
      }));
      const bodyText = `☁️ *HASIL PENCARIAN STICKERCLOUD*\n\n` + `• *Kata Kunci:* \`${query}\`\n` + `• *Total Pack:* ${totalFound} Pack (Hal ${currentPage}/${lastPage})\n\n` + `_Pilih salah satu pack stiker di menu bawah untuk langsung mengunduh seluruh stiker ke WhatsApp:_`;
      const bannerImage = packData[0]?.tray_src || packData[0]?.stickers?.[0]?.sticker_src || "https://files.catbox.moe/g2e6i5.jpg";
      if (typeof ctx.sendCta === "function") {
        const listSections = [{
          title: `📦 DAFTAR STICKER PACK`,
          rows: actionRows
        }];
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: `📂 PILIH STICKER PACK`,
            sections: listSections
          })
        }];
        if (currentPage > 1) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: `⬅️ Hal ${currentPage - 1}`,
              id: `${prefix}stickercloud ${query} -p ${currentPage - 1}`
            })
          });
        }
        if (currentPage < lastPage) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: `➡️ Hal ${currentPage + 1}`,
              id: `${prefix}stickercloud ${query} -p ${currentPage + 1}`
            })
          });
        }
        await ctx.sendCta(bodyText, `${botName} • StickerCloud`, buttons, {
          image: bannerImage,
          quoted: quotedMsg
        });
      } else {
        let listMsg = `${bodyText}\n\n`;
        actionRows.forEach((r, idx) => {
          listMsg += `*${idx + 1}.* ${r.title}\n   ${r.description}\n   📥 *Unduh:* \`${r.id}\`\n\n`;
        });
        await ctx.reply(listMsg.trim());
      }
      await ctx.react("✅");
    } catch (error) {
      console.error("[StickerCloud Plugin Error]:", error?.message || error);
      await ctx.react("❌");
      let errorMessage = error?.message || "Terjadi kesalahan";
      if (error?.response?.data) {
        try {
          const parsed = typeof error.response.data === "string" ? JSON.parse(error.response.data) : error.response.data;
          errorMessage = parsed.error || parsed.message || errorMessage;
        } catch {}
      }
      ctx.reply(`❌ Terjadi kesalahan saat memproses StickerCloud: ${errorMessage}`);
    }
  }
};