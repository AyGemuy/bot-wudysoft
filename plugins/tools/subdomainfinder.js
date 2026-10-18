import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "subdomainfinder",
  aliases: ["subdomain", "findsubdomain"],
  description: "Cari subdomain via crt.sh",
  category: "Tools",
  example: "subdomainfinder example.com",
  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "WudysoftBot";
    const footer = global.footer || global.bot?.footer || `_${botName}_`;
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
    try {
      const domainInput = (ctx.query || ctx.args?.[0] || "").trim().toLowerCase();
      if (!domainInput) {
        const helpText = `– *S U B D O M A I N*\n\n` + `┌ ◦ *Usage* : ${prefix}subdomainfinder <domain>\n` + `└ ◦ *Example* : ${prefix}subdomainfinder example.com\n\n` + `${footer}`;
        return ctx.reply(helpText);
      }
      await ctx.react("⏳");
      const res = await axios.get(`https://crt.sh/?q=%25.${domainInput}&output=json`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        },
        timeout: 3e4
      });
      if (!Array.isArray(res.data) || res.data.length === 0) {
        await ctx.react("❌");
        return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Tidak ada hasil\n` + `└ ◦ *Info* : Data sertifikat tidak ditemukan di crt.sh.\n\n` + `${footer}`);
      }
      const subdomains = [...new Set(res.data.flatMap(v => (v.name_value || "").split("\n")).map(v => v.replace(/^\*\./, "").trim()).filter(v => v.endsWith(domainInput)))];
      if (!subdomains.length) {
        await ctx.react("❌");
        return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Subdomain tidak ditemukan\n` + `└ ◦ *Domain* : ${domainInput}\n\n` + `${footer}`);
      }
      const limited = subdomains.slice(0, 30);
      const resultText = `– *S U B D O M A I N*\n\n` + `┌ ◦ *Domain* : ${domainInput}\n` + `│ ◦ *Total* : ${subdomains.length} Subdomain\n` + `└ ◦ *Showing* : ${limited.length} Data\n\n` + limited.map((v, i) => `${i + 1}. ${v}`).join("\n") + `\n\n${footer}`;
      await sock.sendMessage(ctx.id, {
        text: resultText
      }, {
        quoted: quotedMsg
      });
      await ctx.react("✅");
    } catch (error) {
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.message;
      ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : ${errMsg}\n` + `└ ◦ *Command* : ${ctx.command || "subdomainfinder"}\n\n` + `${footer}`);
    }
  }
};