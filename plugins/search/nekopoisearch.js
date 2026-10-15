import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "nekopoisearch",
  aliases: ["nekopoi-search", "nekopoi"],
  description: "Mencari konten di Nekopoi",
  category: "Search",
  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "WudysoftBot";
    const footer = global.footer || global.bot?.footer || `_${botName}_`;
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
    try {
      const query = (ctx.query || ctx.args?.join(" ") || "").trim();
      if (!query) {
        const helpText = `– *N E K O P O I*\n\n` + `┌ ◦ *Usage* : ${prefix}nekopoisearch <query>\n` + `└ ◦ *Example* : ${prefix}nekopoisearch Shoujo Ramune\n\n` + `${footer}`;
        return ctx.reply(helpText);
      }
      await ctx.react("⏳");
      const {
        data
      } = await axios.get(`https://api.nekolabs.web.id/discovery/nekopoi/v1/search?q=${encodeURIComponent(query)}`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        },
        timeout: 3e4
      });
      if (!data?.result || !data.result.length) {
        await ctx.react("❌");
        return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Hasil tidak ditemukan\n` + `└ ◦ *Query* : "${query}"\n\n` + `${footer}`);
      }
      const first = data.result[0];
      const caption = `– *N E K O P O I*\n\n` + `┌ ◦ *Title* : ${first.title}\n` + `│ ◦ *Type* : ${first.type || "-"}\n` + `└ ◦ *Link* : ${first.url}\n\n` + `${footer}`;
      if (first.cover) {
        await sock.sendMessage(ctx.id, {
          image: {
            url: first.cover
          },
          caption: caption
        }, {
          quoted: quotedMsg
        });
      } else {
        await ctx.reply(caption, {
          quoted: quotedMsg
        });
      }
      await ctx.react("✅");
    } catch (error) {
      console.error("[Nekopoi Search Error]:", error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.message;
      ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : ${errMsg}\n` + `└ ◦ *Command* : ${ctx.command || "nekopoisearch"}\n\n` + `${footer}`);
    }
  }
};