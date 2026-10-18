import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "webscrape",
  aliases: ["scrapeweb", "webscraping"],
  description: "Scrape konten dari URL situs web",
  category: "Tools",
  example: "webscrape https://example.com [--text]",
  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "WudysoftBot";
    const footer = global.footer || global.bot?.footer || `_${botName}_`;
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
    try {
      const rawText = (ctx.query || "").trim();
      const args = rawText.split(/\s+/);
      const url = args.find(v => /^https?:\/\//i.test(v));
      if (!url) {
        const helpText = `– *W E B  S C R A P E*\n\n` + `┌ ◦ *Usage* : ${prefix}webscrape <url> [--text]\n` + `└ ◦ *Example* : ${prefix}webscrape https://example.com --text\n\n` + `${footer}`;
        return ctx.reply(helpText);
      }
      await ctx.react("⏳");
      const api = new URL("https://api.api-ninjas.com/v1/webscraper");
      api.searchParams.append("url", url);
      const isTextOnly = args.includes("--text") || args.includes("-t");
      if (isTextOnly) {
        api.searchParams.append("text_only", "true");
      }
      const res = await axios.get(api.toString(), {
        headers: {
          "X-Api-Key": "S8bcSHT0z15lVc1OGljv9ssbcouQE163Io6fkCDu"
        },
        timeout: 45e3
      });
      const data = res.data;
      const rawContent = data?.data || "";
      if (!rawContent.trim()) {
        await ctx.react("❌");
        return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Konten kosong\n` + `└ ◦ *Info* : Tidak ada data yang dapat diekstrak dari situs tersebut.\n\n` + `${footer}`);
      }
      const isTruncated = rawContent.length > 3500;
      const content = rawContent.substring(0, 3500).trim();
      const resultText = `– *W E B  S C R A P E*\n\n` + `┌ ◦ *URL* : ${url}\n` + `│ ◦ *Mode* : ${isTextOnly ? "Text Only" : "HTML / Raw"}\n` + `└ ◦ *Status* : ${isTruncated ? "Truncated (3500 Karakter)" : "Selesai"}\n\n` + `\`\`\`\n${content}\n\`\`\`\n\n` + `${footer}`;
      await sock.sendMessage(ctx.id, {
        text: resultText
      }, {
        quoted: quotedMsg
      });
      await ctx.react("✅");
    } catch (error) {
      await ctx.react("❌");
      const errMsg = error.response?.data?.error || error.response?.data?.message || error.message;
      ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : ${errMsg}\n` + `└ ◦ *Command* : ${ctx.command || "webscrape"}\n\n` + `${footer}`);
    }
  }
};