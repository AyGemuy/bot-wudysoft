import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "tiktoksearch",
  aliases: ["ttsearch", "tiktok-search"],
  description: "Mencari video di TikTok",
  category: "Search",
  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "WudysoftBot";
    const footer = global.footer || global.bot?.footer || `_${botName}_`;
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
    try {
      const query = (ctx.query || ctx.args?.join(" ") || "").trim();
      if (!query) {
        const helpText = `– *T I K T O K*\n\n` + `┌ ◦ *Usage* : ${prefix}tiktoksearch <query>\n` + `└ ◦ *Example* : ${prefix}tiktoksearch jedag jedug viral\n\n` + `${footer}`;
        return ctx.reply(helpText);
      }
      await ctx.react("⏳");
      const res = await axios.post("https://tikwm.com/api/feed/search", new URLSearchParams({
        keywords: query,
        count: 12,
        cursor: 0,
        web: 1,
        hd: 1
      }).toString(), {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          Cookie: "current_langange=en;",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        },
        timeout: 3e4
      });
      const vids = res.data?.data?.videos;
      if (!vids || !vids.length) {
        await ctx.react("❌");
        return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Video tidak ditemukan\n` + `└ ◦ *Query* : "${query}"\n\n` + `${footer}`);
      }
      const v = vids[Math.floor(Math.random() * vids.length)];
      const caption = `– *T I K T O K*\n\n` + `┌ ◦ *Title* : ${v.title || "-"}\n` + `│ ◦ *Author* : ${v.author?.nickname || "-"} (@${v.author?.unique_id || "-"})\n` + `│ ◦ *Region* : ${v.region || "-"}\n` + `│ ◦ *Likes* : ${(v.digg_count || 0).toLocaleString("id-ID")}\n` + `│ ◦ *Comments* : ${(v.comment_count || 0).toLocaleString("id-ID")}\n` + `└ ◦ *Audio* : https://tikwm.com${v.music || ""}\n\n` + `${footer}`;
      await sock.sendMessage(ctx.id, {
        video: {
          url: `https://tikwm.com${v.play}`
        },
        caption: caption
      }, {
        quoted: quotedMsg
      });
      await ctx.react("✅");
    } catch (error) {
      console.error("[TikTok Search Error]:", error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.message;
      ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : ${errMsg}\n` + `└ ◦ *Command* : ${ctx.command || "tiktoksearch"}\n\n` + `${footer}`);
    }
  }
};