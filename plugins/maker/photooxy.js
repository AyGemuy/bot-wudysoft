import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const DEFAULT_THEME_URL = "https://photooxy.com/create-blackpink-style-logo-effects-online-for-free-417.html";
export default {
  name: "photooxy",
  aliases: ["photooxy"],
  description: "Buat logo efek teks kustom via PhotoOxy / TextMaker API",
  category: "Maker",
  limit: true,
  example: "photooxy <teks> [--url <link_photooxy>]",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = (ctx.query || ctx.text || "").trim();
      if (!rawText) {
        return ctx.reply(`✨ *TEXT / LOGO MAKER*\n\n` + `Masukkan teks yang ingin dijadikan logo/efek!\n\n` + `👉 *Penggunaan Dasar:*\n` + `\`${ctx.prefix || "."}photooxy WudysoftBot\`\n\n` + `⚙️ *Dengan URL Template Kustom:*\n` + `\`${ctx.prefix || "."}photooxy WudysoftBot --url https://photooxy.com/logo-effects/...\`\n\n` + `📌 *Format Alternatif (Pemisah |):*\n` + `\`${ctx.prefix || "."}photooxy https://photooxy.com/... | NamaTeks\``);
      }
      await ctx.react("⏳");
      let themeUrl = DEFAULT_THEME_URL;
      let text = rawText;
      const urlMatch = text.match(/--url\s+([^\s]+)/i);
      if (urlMatch) {
        themeUrl = urlMatch[1];
        text = text.replace(urlMatch[0], "").trim();
      } else if (text.includes("|")) {
        const parts = text.split("|").map(p => p.trim());
        if (parts[0].startsWith("http")) {
          themeUrl = parts[0];
          text = parts.slice(1).join(" ");
        } else if (parts[1].startsWith("http")) {
          themeUrl = parts[1];
          text = parts[0];
        }
      }
      if (!text) {
        await ctx.react("❌");
        return ctx.reply("❌ Teks logo tidak boleh kosong!");
      }
      const body = {
        url: themeUrl,
        text: text
      };
      const {
        data
      } = await axios.post(`${global.bot?.api?.wudysoft}/api/maker/text`, body, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 6e4
      });
      const resultUrl = data?.url || data?.result?.url || data?.result;
      if (!data || !data.success && !data.status && !resultUrl || !resultUrl) {
        await ctx.react("❌");
        return ctx.reply(`❌ Gagal membuat efek teks: ${data?.message || "Template tidak didukung atau server error."}`);
      }
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const caption = `✨ *Text Maker Selesai*\n\n` + `📝 *Teks:* \`${text}\`\n` + `🎨 *Template:* ${themeUrl.length > 40 ? themeUrl.substring(0, 40) + "..." : themeUrl}`;
      await sock.sendMessage(ctx.id, {
        image: {
          url: resultUrl
        },
        caption: caption.trim()
      }, {
        quoted: quotedMsg
      });
      await ctx.react("✅");
    } catch (error) {
      await ctx.react("❌");
      ctx.reply(`❌ Text Maker Error: ${error.response?.data?.message || error.message}`);
    }
  }
};