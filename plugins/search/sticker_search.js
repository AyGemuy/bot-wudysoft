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
export default {
  name: "sticker-search",
  aliases: ["stickersearch", "ssearch"],
  description: "Cari & unduh sticker pack dari Combot langsung jadi WhatsApp Sticker Pack",
  category: "Search",
  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "WudysoftBot";
    const footer = global.footer || global.bot?.footer || `_${botName}_`;
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
    const query = (ctx.query || ctx.args?.join(" ") || "").trim();
    if (!query) {
      const helpText = `– *S T I C K E R  S E A R C H*\n\n` + `┌ ◦ *Usage* : ${prefix}stickersearch <query>\n` + `└ ◦ *Example* : ${prefix}stickersearch cat\n\n` + `${footer}`;
      return ctx.reply(helpText);
    }
    try {
      if (typeof ctx.react === "function") await ctx.react("⏳");
      const res = await axios.post("https://api.siputzx.my.id/api/sticker/combot-search", {
        q: query,
        page: 1
      }, {
        headers: {
          "Content-Type": "application/json"
        },
        timeout: 3e4
      });
      const data = res.data?.data?.results;
      if (!data || !data.length) {
        if (typeof ctx.react === "function") await ctx.react("❌");
        return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Stiker tidak ditemukan\n` + `└ ◦ *Query* : "${query}"\n\n` + `${footer}`);
      }
      const pack = data[Math.floor(Math.random() * data.length)];
      const stickerUrls = pack.sticker_urls || [];
      if (!stickerUrls.length) {
        if (typeof ctx.react === "function") await ctx.react("❌");
        return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Pack stiker kosong\n` + `└ ◦ *Info* : Tidak ada item stiker di dalam pack tersebut.\n\n` + `${footer}`);
      }
      const authorName = global.bot?.author?.name || "Combot Search";
      const packTitle = pack.title || `${query.toUpperCase()} Pack`;
      const downloadedStickers = [];
      for (let i = 0; i < stickerUrls.length; i++) {
        try {
          const r = await axios.get(stickerUrls[i], {
            responseType: "arraybuffer",
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            },
            timeout: 2e4
          });
          const rawBuffer = Buffer.from(r.data);
          const exif = {
            packname: packTitle,
            author: authorName,
            categories: ["✨"]
          };
          const webpBuffer = await writeExif(rawBuffer, exif).catch(async () => {
            return await writeExifVid(rawBuffer, exif) || await writeExifImg(rawBuffer, exif) || rawBuffer;
          });
          downloadedStickers.push({
            buffer: webpBuffer,
            emoji: "✨"
          });
        } catch (err) {
          console.error("[StickerSearch Item Error]:", err?.message || err);
        }
      }
      if (!downloadedStickers.length) {
        if (typeof ctx.react === "function") await ctx.react("❌");
        return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Gagal mengunduh stiker\n` + `└ ◦ *Info* : Berkas gambar stiker gagal diunduh dari server.\n\n` + `${footer}`);
      }
      await stickerPack(sock, ctx.id, downloadedStickers, {
        name: packTitle,
        publisher: authorName,
        description: `Combot Sticker Search: ${query}`,
        quoted: quotedMsg
      });
      if (typeof ctx.react === "function") await ctx.react("✅");
    } catch (error) {
      console.error("[StickerSearch Error]:", error);
      if (typeof ctx.react === "function") await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.message;
      ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : ${errMsg}\n` + `└ ◦ *Command* : ${ctx.command || "stickersearch"}\n\n` + `${footer}`);
    }
  }
};