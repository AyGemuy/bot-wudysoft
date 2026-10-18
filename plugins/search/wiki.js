import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const CONFIG = {
  API_URL: `${global.bot?.api?.wudysoft}/api/search/wiki`,
  TIMEOUT: 35e3,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
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
      full: ["f", "lengkap", "all"],
      list: ["l", "daftar", "raw"],
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
async function callWikiApi(query, detail = true, related = true) {
  const res = await axios.get(CONFIG.API_URL, {
    params: {
      query: query,
      detail: detail ? "true" : "false",
      related: related ? "true" : "false"
    },
    headers: {
      "User-Agent": CONFIG.USER_AGENT
    },
    timeout: CONFIG.TIMEOUT
  });
  return res?.data;
}
export default {
  name: "wiki",
  aliases: ["wikipedia", "wikisearch", "ensiklopedia", "wikip"],
  description: "Cari ringkasan ensiklopedia, biografi tokoh, sejarah, dan informasi lengkap dari Wikipedia",
  category: "Information",
  limit: true,
  example: "wiki Prabowo Subianto\nwiki Albert Einstein --full\nReply chat dengan .wiki",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["wiki", "wikipedia", "wikisearch", "ensiklopedia", "wikip"].some(a => firstWord.endsWith(a))) {
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
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (!query) {
        return ctx.reply(`📚 *WIKIPEDIA ENSIKLOPEDIA INDONESIA*\n\n` + `• *Cara Penggunaan:*\n` + `  👉 *Cari Topik/Tokoh:* \`${prefix}wiki <kata_kunci>\`\n` + `  👉 *Cari Artikel Lengkap:* \`${prefix}wiki <kata_kunci> --full\`\n` + `  👉 *Cari via Reply Pesan:* Balas pesan berisi teks dengan \`${prefix}wiki\`\n\n` + `📌 *Contoh Perintah:*\n` + `• \`${prefix}wiki Prabowo Subianto\`\n` + `• \`${prefix}wiki Black Hole\`\n` + `• \`${prefix}wiki Indonesia --full\``);
      }
      await ctx.react("⏳");
      const data = await callWikiApi(query, true, true);
      const results = Array.isArray(data) ? data : data?.result || [];
      if (!results.length) {
        await ctx.react("❌");
        return ctx.reply(`❌ Tidak ditemukan artikel Wikipedia untuk kata kunci "${query}".`);
      }
      const article = results[0];
      const thumbUrl = article.thumbnail || article.images?.[0]?.url || null;
      let infoboxText = "";
      if (article.infobox && typeof article.infobox === "object") {
        const entries = Object.entries(article.infobox).slice(0, 8);
        if (entries.length) {
          infoboxText = `📌 *INFO CEPAT:*\n` + entries.map(([k, v]) => `• *${k}:* ${v}`).join("\n") + `\n\n`;
        }
      }
      let contentText = "";
      if (Array.isArray(article.sections) && article.sections.length > 0) {
        const limitSection = flags.full ? 5 : 2;
        const selectedSections = article.sections.slice(0, limitSection);
        selectedSections.forEach(sec => {
          const heading = (sec.heading || "").replace(/\s*sunting\s*$/i, "").trim();
          let body = (sec.content || "").trim();
          if (!flags.full && body.length > 600) {
            body = body.slice(0, 600) + "...";
          }
          if (heading && body) {
            contentText += `📖 *${heading}*\n${body}\n\n`;
          }
        });
      }
      if (!contentText) {
        contentText = `${article.description || "Tidak ada deskripsi singkat."}\n\n`;
      }
      const bodyCaption = `📚 *WIKIPEDIA: ${article.title.toUpperCase()}*\n` + (article.description ? `_${article.description}_\n\n` : "\n") + `${infoboxText}` + `${contentText.trim()}\n\n` + `🌐 *Link Wikipedia:* ${article.url}\n` + `📊 *Total Referensi:* ${article.stats?.references || 0} Sumber`;
      const otherArticles = results.slice(1, 6).concat(article.related_articles || []).slice(0, 8);
      const actionRows = otherArticles.filter((item, idx, self) => item.title && self.findIndex(t => t.title === item.title) === idx).map((item, i) => ({
        title: `${item.title.slice(0, 30)}`,
        id: `${prefix}wiki ${item.title}`,
        description: (item.description || "Lihat artikel ini").slice(0, 45)
      }));
      if (thumbUrl) {
        if (actionRows.length && typeof ctx.sendCta === "function") {
          const listSections = [{
            title: `🔍 ARTIKEL TERKAIT`,
            rows: actionRows
          }];
          const buttons = [{
            name: "single_select",
            buttonParamsJson: JSON.stringify({
              title: `📂 PILIH ARTIKEL LAIN`,
              sections: listSections
            })
          }, {
            name: "cta_url",
            display_text: "🌐 Baca di Web Wikipedia",
            url: article.url
          }];
          await ctx.sendCta(bodyCaption, `${botName} • Wikipedia`, buttons, {
            image: thumbUrl,
            quoted: quotedMsg
          });
        } else {
          await sock.sendMessage(ctx.id, {
            image: {
              url: thumbUrl
            },
            caption: bodyCaption
          }, {
            quoted: quotedMsg
          });
        }
      } else {
        if (actionRows.length && typeof ctx.sendCta === "function") {
          const listSections = [{
            title: `🔍 ARTIKEL TERKAIT`,
            rows: actionRows
          }];
          const buttons = [{
            name: "single_select",
            buttonParamsJson: JSON.stringify({
              title: `📂 PILIH ARTIKEL LAIN`,
              sections: listSections
            })
          }, {
            name: "cta_url",
            display_text: "🌐 Baca di Web Wikipedia",
            url: article.url
          }];
          await ctx.sendCta(bodyCaption, `${botName} • Wikipedia`, buttons, {
            quoted: quotedMsg
          });
        } else {
          await ctx.reply(bodyCaption);
        }
      }
      await ctx.react("✅");
    } catch (error) {
      console.error("[Wiki Plugin Error]:", error?.message || error);
      await ctx.react("❌");
      let errorMessage = error?.message || "Terjadi kesalahan";
      if (error?.response?.data) {
        try {
          const parsed = typeof error.response.data === "string" ? JSON.parse(error.response.data) : error.response.data;
          errorMessage = parsed.error || parsed.message || errorMessage;
        } catch {}
      }
      ctx.reply(`❌ Terjadi kesalahan saat memproses Wikipedia: ${errorMessage}`);
    }
  }
};