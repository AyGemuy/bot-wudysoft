import axios from "axios";
import {
  writeExifImg
} from "../../lib/exif.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";

function splitEmojis(text) {
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter("en", {
      granularity: "grapheme"
    });
    return [...segmenter.segment(text)].map(s => s.segment);
  }
  return Array.from(text);
}

function extractEmojis(text) {
  if (!text || typeof text !== "string") return [];
  const graphemes = splitEmojis(text);
  const emojiRegex = /\p{Extended_Pictographic}|\p{Emoji_Presentation}/u;
  return graphemes.filter(char => emojiRegex.test(char) && !/^[\w\s\d.,!?:;@#$%^&*()_+=~`|\\/[\]{}<>-]$/.test(char));
}
export default {
  name: "emojimix",
  aliases: ["mix", "emomix", "semojimix", "mixemoji"],
  description: "Kombinasikan emoji menjadi stiker WhatsApp (Support Reply / Input)",
  category: "Sticker",
  example: "emojimix 😭+😂 atau reply emoji dengan .mix 😎",
  execute: async (sock, ctx, msg) => {
    const bot = global.bot || {};
    const prefix = ctx.prefix || ".";
    const botName = bot.name || "WudysoftBot";
    const footer = global.footer || bot.footer || `_${botName}_`;
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
    const chatId = ctx.chat || ctx.id;
    const argsRaw = (ctx.query || (ctx.args ? ctx.args.join("") : "")).replace(/\+/g, "").trim();
    const argsEmojis = extractEmojis(argsRaw);
    const quotedText = ctx.quoted?.text || ctx.quoted?.caption || ctx.quoted?.body || ctx.quoted?.msg?.caption || ctx.quoted?.msg?.text || "";
    const quotedEmojis = extractEmojis(quotedText);
    let targetEmojis = [];
    if (quotedEmojis.length > 0 && argsEmojis.length > 0) {
      targetEmojis = [quotedEmojis[0], argsEmojis[0]];
    } else if (argsEmojis.length > 0) {
      targetEmojis = argsEmojis;
    } else if (quotedEmojis.length > 0) {
      targetEmojis = quotedEmojis;
    }
    if (targetEmojis.length === 0) {
      const helpText = `– *E M O J I  M I X*\n\n` + `┌ ◦ *Usage* : ${prefix}emojimix <emoji + emoji>\n` + `│ ◦ *Quoted* : Balas pesan berisi emoji\n` + `└ ◦ *Function* : Menggabungkan 2 emoji via Google Emoji Kitchen\n\n` + `– *E X A M P L E*\n\n` + `┌ ◦ *Single* : ${prefix}emojimix 😁 (Otomatis duplikat)\n` + `│ ◦ *Combine* : ${prefix}emojimix 😭 + 😂\n` + `└ ◦ *Quoted* : Balas chat 😭 lalu ketik ${prefix}mix 😎\n\n` + `${footer}`;
      return ctx.reply(helpText);
    }
    if (targetEmojis.length === 1) {
      targetEmojis = [targetEmojis[0], targetEmojis[0]];
    }
    const finalEmoji = targetEmojis.slice(0, 2).join("");
    try {
      if (typeof ctx.react === "function") await ctx.react("⏳");
      const res = await axios.get(`${global.bot?.api?.wudysoft}/api/misc/emojimix/v4?emoji=${encodeURIComponent(finalEmoji)}`, {
        responseType: "arraybuffer",
        headers: {
          "User-Agent": "Mozilla/5.0"
        },
        timeout: 2e4
      });
      const buffer = Buffer.from(res.data);
      const exif = {
        packname: bot.sticker?.packname || botName,
        author: bot.sticker?.author || (bot.author?.number ? `wa.me/${bot.author.number}` : botName),
        categories: ["🎨", "🤖"]
      };
      const sticker = await writeExifImg(buffer, exif, false);
      await sock.sendMessage(chatId, {
        sticker: sticker,
        contextInfo: bot.utils?.contextInfo || undefined
      }, {
        quoted: quotedMsg
      });
      if (typeof ctx.react === "function") await ctx.react("✅");
    } catch (error) {
      console.error("[Emojimix Error]:", error);
      if (typeof ctx.react === "function") await ctx.react("❌");
      return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Kombinasi Tidak Didukung\n` + `│ ◦ *Target* : ${targetEmojis.slice(0, 2).join(" + ")}\n` + `└ ◦ *Detail* : Emoji tidak tersedia di database Google Kitchen.\n\n` + `${footer}`);
    }
  }
};