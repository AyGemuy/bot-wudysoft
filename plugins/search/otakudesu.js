import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "otakudesu",
  aliases: ["otakudesu-search", "otakudesus"],
  description: "Mencari anime di Otakudesu",
  category: "Search",
  example: "otakudesu Naruto",
  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "WudysoftBot";
    const footer = global.footer || global.bot?.footer || `_${botName}_`;
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
    try {
      const query = (ctx.query || ctx.args?.join(" ") || "").trim();
      if (!query) {
        const helpText = `– *O T A K U D E S U*\n\n` + `┌ ◦ *Usage* : ${prefix}otakudesu <query>\n` + `└ ◦ *Example* : ${prefix}otakudesu Naruto\n\n` + `${footer}`;
        return ctx.reply(helpText);
      }
      await ctx.react("⏳");
      const {
        data
      } = await axios.get(`https://api.nekolabs.web.id/discovery/otakudesu/search?q=${encodeURIComponent(query)}`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        },
        timeout: 3e4
      });
      if (!data?.success || !data.result?.length) {
        await ctx.react("❌");
        return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Anime tidak ditemukan\n` + `└ ◦ *Query* : "${query}"\n\n` + `${footer}`);
      }
      const a = data.result[0];
      const genres = Array.isArray(a.genres) ? a.genres.join(", ") : a.genres || "-";
      const caption = `– *O T A K U D E S U*\n\n` + `┌ ◦ *Title* : ${a.title}\n` + `│ ◦ *Rating* : ${a.rating || "-"}\n` + `│ ◦ *Status* : ${a.status || "-"}\n` + `│ ◦ *Genre* : ${genres}\n` + `└ ◦ *Link* : ${a.url}\n\n` + `${footer}`;
      if (a.cover) {
        await sock.sendMessage(ctx.id, {
          image: {
            url: a.cover
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
      console.error("[Otakudesu Error]:", error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.message;
      ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : ${errMsg}\n` + `└ ◦ *Command* : ${ctx.command || "otakudesu"}\n\n` + `${footer}`);
    }
  }
};