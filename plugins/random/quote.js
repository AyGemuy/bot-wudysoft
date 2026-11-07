import axios from "axios";
import fs from "fs";
import path from "path";
import {
  fileURLToPath
} from "url";
import db from "../../data/db.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = path.resolve(__dirname, "../../lib/quotes-html");
const DEFAULT_THEME = "aura";
const ITEMS_PER_PAGE = 7;
const CONFIG = {
  BASE_URL: `${global.bot?.api?.wudysoft}/api/quotes`,
  TIMEOUT: 3e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  CATEGORIES: {
    bacot: {
      name: "Bacot / Savage",
      emoji: "🗣️",
      desc: "Quotes ceplas-ceplos & barbar",
      aliases: ["bacot", "barbar", "savage"]
    },
    bijak: {
      name: "Kata Bijak",
      emoji: "💡",
      desc: "Kata motivasi, inspiratif & kehidupan",
      aliases: ["bijak", "motivasi", "quote", "quotes"]
    },
    bucin: {
      name: "Bucin / Romantis",
      emoji: "❤️",
      desc: "Kata cinta, baper & gombalan manis",
      aliases: ["bucin", "romantis", "love", "cinta"]
    },
    pakboy: {
      name: "Pakboy / Playful",
      emoji: "🕶️",
      desc: "Gombalan maut ala pakboy",
      aliases: ["pakboy", "playboy", "buaya"]
    },
    sad: {
      name: "Sad / Galau",
      emoji: "🥀",
      desc: "Kata-kata galau, sedih & patah hati",
      aliases: ["sad", "galau", "sedih", "patahhati"]
    },
    sindiran: {
      name: "Sindiran Pedas",
      emoji: "🗡️",
      desc: "Kata sindiran halus hingga menusuk",
      aliases: ["sindiran", "nyindir", "pedas"]
    },
    ilham: {
      name: "Kata-Kata Ilham",
      emoji: "✨",
      desc: "Kata mutiara random khas Ilham",
      aliases: ["ilham", "katailham"]
    }
  }
};

function initDB(jid = null) {
  if (!global.db) global.db = {};
  if (!global.db.quotesHtml) global.db.quotesHtml = {};
}

function saveDB() {
  if (typeof db?.write === "function" && global.db) {
    db.write(global.db);
  }
}

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /(?:--|-)([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1].toLowerCase();
    let rawVal = match[2];
    let val = true;
    const aliasMap = {
      type: ["t", "category", "cat", "jenis"],
      random: ["r", "acak"],
      theme: ["th", "tema", "template", "tpl"],
      settheme: ["st", "settema", "set"],
      list: ["ls", "daftartema", "listtpl"],
      page: ["p", "hal", "halaman"],
      search: ["q", "query", "cari"],
      reset: ["clear", "default"]
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

function resolveCategory(input = "") {
  const clean = input.toLowerCase().trim();
  for (const [key, val] of Object.entries(CONFIG.CATEGORIES)) {
    if (key === clean || val.aliases.includes(clean)) {
      return key;
    }
  }
  return null;
}
async function fetchQuote(category) {
  const targetCategory = CONFIG.CATEGORIES[category] ? category : "bijak";
  const url = `${CONFIG.BASE_URL}/${targetCategory}`;
  const res = await axios.get(url, {
    headers: {
      "User-Agent": CONFIG.USER_AGENT
    },
    timeout: CONFIG.TIMEOUT
  });
  if (res.data && typeof res.data === "object") {
    return res.data.quote || res.data.result || res.data.message || JSON.stringify(res.data);
  }
  return String(res.data || "");
}

function listQuoteTemplates() {
  try {
    return fs.readdirSync(TEMPLATE_DIR).filter(f => f.endsWith(".html")).map(f => f.replace(/\.html$/i, ""));
  } catch {
    return [DEFAULT_THEME];
  }
}

function loadAndInjectTemplate(themeName, {
  quote,
  category,
  emoji,
  botName
}) {
  const safeName = String(themeName || DEFAULT_THEME).replace(/[^a-z0-9_-]/gi, "");
  let filePath = path.join(TEMPLATE_DIR, `${safeName}.html`);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(TEMPLATE_DIR, `${DEFAULT_THEME}.html`);
  }
  if (!fs.existsSync(filePath)) {
    throw new Error(`File template "${safeName}.html" tidak ditemukan di ${TEMPLATE_DIR}`);
  }
  let html = fs.readFileSync(filePath, "utf-8");
  html = html.replace(/\{\{QUOTE\}\}/g, quote);
  html = html.replace(/\{\{CATEGORY\}\}/g, category);
  html = html.replace(/\{\{EMOJI\}\}/g, emoji);
  html = html.replace(/\{\{BOT_NAME\}\}/g, botName);
  return html;
}
async function renderHtmlToImage(htmlContent) {
  const rawApi = global.bot?.api?.wudysoft || "";
  const cleanApi = rawApi.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  const baseUrl = `https://${cleanApi}/api/tools/html2img/`;
  const headers = {
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
  };
  const payload = {
    html: htmlContent,
    fullPage: true,
    quality: 100
  };
  const versions = ["v5", "v1", "v2", "v3", "v4", "v6", "v7", "v8", "v9", "v10"];
  for (const ver of versions) {
    try {
      const res = await axios.post(`${baseUrl}${ver}`, payload, {
        headers: headers,
        timeout: 2e4
      });
      const imgUrl = res.data?.url || res.data?.result || (typeof res.data === "string" ? res.data : null);
      if (imgUrl && /^https?:\/\//i.test(imgUrl)) {
        const imgRes = await axios.get(imgUrl, {
          responseType: "arraybuffer",
          timeout: 15e3
        });
        if (imgRes.data) return Buffer.from(imgRes.data);
      }
    } catch {
      continue;
    }
  }
  return null;
}
export default {
  name: "quotes",
  aliases: ["quote", "katabijak", "bucin", "katabacot", "pakboy", "galau", "sadboy", "sindiran", "katailham"],
  description: "Quotes aesthetic dengan banner HTML2IMG & pilihan tema trending dari database/list",
  category: "Quotes",
  limit: true,
  example: "quotes\nquotes bucin\nquotes --list\nquotes --settheme linear\nquotes --theme island",
  execute: async (sock, ctx, msg) => {
    try {
      const chatId = ctx.id;
      initDB(chatId);
      let rawText = ctx.args?.join(" ")?.trim() || "";
      let commandUsed = ctx.command || "quotes";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        const allAliases = ["quotes", "quote", "katabijak", "bucin", "katabacot", "pakboy", "galau", "sadboy", "sindiran", "katailham"];
        if (allAliases.some(a => firstWord.endsWith(a))) {
          rawText = raw.slice(firstWord.length).trim();
          commandUsed = firstWord.replace(/^[./!#]/, "");
        }
      }
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "Neoxr Bot";
      const botFooter = global.bot?.footer || `${botName} • Daily Quotes`;
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (flags.reset || ["--reset", "reset", "--clear"].includes(rawText.toLowerCase())) {
        if (global.db.quotesHtml[chatId]) {
          delete global.db.quotesHtml[chatId];
          saveDB();
          return ctx.reply(`–  *Q U O T E S  -  T E M A*\n\n🧹 *Tema quotes berhasil direset ke mode acak/default!*`);
        }
        return ctx.reply("ℹ️ Belum ada pengaturan tema kustom pada obrolan ini.");
      }
      if (flags.settheme) {
        const chosen = String(flags.settheme).toLowerCase().trim();
        const available = listQuoteTemplates();
        if (!available.includes(chosen)) {
          return ctx.reply(`–  *Q U O T E S  -  T E M A*\n\n` + `❌ Tema *"${chosen}"* tidak ditemukan di folder template!\n\n` + `_Ketik \`${prefix}quotes --list\` untuk melihat daftar tema yang tersedia._`);
        }
        if (!global.db.quotesHtml[chatId]) global.db.quotesHtml[chatId] = {};
        global.db.quotesHtml[chatId].theme = chosen;
        global.db.quotesHtml[chatId].updatedAt = Date.now();
        saveDB();
        if (typeof ctx.react === "function") await ctx.react("✅");
        return ctx.reply(`–  *Q U O T E S  -  T E M A*\n\n` + `┌  ◦  *Status* : Berhasil Disetel\n` + `├  ◦  *Tema Aktif* : ${chosen.toUpperCase()}\n` + `└  ◦  *File* : \`${chosen}.html\`\n\n` + `_Tema ini akan selalu digunakan untuk banner quotes Anda. Ketik \`${prefix}quotes\` untuk mencoba!_`);
      }
      if (flags.list || flags.page || ["--list", "list", "daftartema"].includes(rawText.toLowerCase())) {
        if (typeof ctx.react === "function") await ctx.react("⏳");
        const allTemplates = listQuoteTemplates();
        if (!allTemplates.length) {
          return ctx.reply(`❌ Tidak ada file template .html di dalam folder lib/quotes-html/`);
        }
        let searchQuery = flags.search || "";
        if (!searchQuery && !flags.page && cleanPrompt && !/^(?:hal|page|\d+)$/i.test(cleanPrompt)) {
          searchQuery = cleanPrompt;
        }
        let matched = allTemplates;
        if (searchQuery && searchQuery !== "true") {
          const kw = searchQuery.toLowerCase();
          matched = allTemplates.filter(t => t.toLowerCase().includes(kw));
        }
        if (!matched.length) {
          return ctx.reply(`❌ Tema quotes tidak ditemukan dengan kata kunci: "${searchQuery}"`);
        }
        const page = Math.max(1, Number(flags.page) || 1);
        const totalPages = Math.ceil(matched.length / ITEMS_PER_PAGE) || 1;
        const pageItems = matched.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
        const rows = pageItems.map((tpl, idx) => {
          const globalIdx = (page - 1) * ITEMS_PER_PAGE + idx + 1;
          return {
            title: `${globalIdx}. ${tpl.toUpperCase()}`,
            id: `${prefix}quotes --settheme ${tpl}`,
            description: `Terapkan tema banner: ${tpl}.html`
          };
        });
        let baseCmd = `${prefix}quotes`;
        if (searchQuery && searchQuery !== "true") baseCmd += ` --search "${searchQuery}"`;
        else baseCmd += ` --list`;
        const listButtons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: `PILIH TEMA BANNER (${pageItems.length})`,
            sections: [{
              title: `TEMA TERSEDIA (Hal ${page}/${totalPages})`,
              rows: rows
            }]
          })
        }];
        if (page > 1) {
          listButtons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: `⬅️ Hal ${page - 1}`,
              id: `${baseCmd} --page ${page - 1}`
            })
          });
        }
        if (page < totalPages) {
          listButtons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: `➡️ Hal ${page + 1}`,
              id: `${baseCmd} --page ${page + 1}`
            })
          });
        }
        const currentActiveTheme = global.db.quotesHtml[chatId]?.theme || "Acak / Random";
        const bodyText = `–  *Q U O T E S  -  T E M A  L I S T*\n\n` + `┌  ◦  *Tema Aktif Saat Ini* : ${currentActiveTheme.toUpperCase()}\n` + `├  ◦  *Total Template* : ${matched.length} Desain\n` + `└  ◦  *Halaman* : ${page} / ${totalPages}\n\n` + `_Pilih salah satu tema dari daftar menu di bawah untuk menyetelnya sebagai banner bawaan:_`;
        const options = {
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 1,
              divider_indices: [1],
              list_title: `Quotes • Themes`,
              button_title: `Buka Hal ${page}`
            }
          },
          quoted: quotedMsg
        };
        if (typeof ctx.sendCta === "function") {
          await ctx.sendCta(bodyText, botFooter, listButtons, options);
        } else {
          let fallback = `${bodyText}\n\n` + rows.map(r => `• *${r.title}*\n  Set: \`${r.id}\``).join("\n\n");
          if (totalPages > 1) {
            fallback += `\n\n_Pindah Halaman: \`${baseCmd} --page ${page < totalPages ? page + 1 : page - 1}\`_`;
          }
          await ctx.reply(fallback);
        }
        if (typeof ctx.react === "function") await ctx.react("✅");
        return;
      }
      let selectedCategory = resolveCategory(flags.type) || resolveCategory(cleanPrompt) || resolveCategory(commandUsed);
      if (!selectedCategory || flags.random) {
        const categoryKeys = Object.keys(CONFIG.CATEGORIES);
        selectedCategory = categoryKeys[Math.floor(Math.random() * categoryKeys.length)];
      }
      if (typeof ctx.react === "function") await ctx.react("⏳");
      const quoteText = await fetchQuote(selectedCategory);
      if (!quoteText) {
        if (typeof ctx.react === "function") await ctx.react("❌");
        return ctx.reply("❌ Gagal memuat kutipan quotes. Coba lagi beberapa saat lagi.");
      }
      const catInfo = CONFIG.CATEGORIES[selectedCategory];
      const availableThemes = listQuoteTemplates();
      const savedTheme = global.db.quotesHtml[chatId]?.theme;
      let chosenTheme = flags.theme?.toLowerCase() || savedTheme;
      if (!chosenTheme || !availableThemes.includes(chosenTheme)) {
        chosenTheme = availableThemes[Math.floor(Math.random() * availableThemes.length)] || DEFAULT_THEME;
      }
      const htmlContent = loadAndInjectTemplate(chosenTheme, {
        quote: quoteText.trim(),
        category: catInfo.name,
        emoji: catInfo.emoji,
        botName: botName.toUpperCase()
      });
      const bannerBuffer = await renderHtmlToImage(htmlContent);
      let formattedText = `–  *Q U O T E S*\n\n`;
      formattedText += `┌  ◦  *Kategori* : ${catInfo.name} ${catInfo.emoji}\n`;
      formattedText += `├  ◦  *Tema Banner* : \`${chosenTheme}.html\` ${savedTheme === chosenTheme ? "(Tersimpan)" : "(Acak)"}\n`;
      formattedText += `└  ◦  *Koleksi* : Generator Acak\n\n`;
      formattedText += `“${quoteText.trim()}”\n\n`;
      formattedText += `_Gunakan tombol di bawah untuk mengambil kutipan serupa atau kategori lainnya:_`;
      const categoryRows = Object.entries(CONFIG.CATEGORIES).map(([key, data]) => ({
        title: `${data.emoji} ${data.name}`,
        id: `${prefix}quotes ${key}`,
        description: data.desc
      }));
      const buttons = [{
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: `🔄 Quotes ${catInfo.name} Lagi`,
          id: `${prefix}quotes ${selectedCategory}`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🎨 Ganti / Pilih Tema",
          id: `${prefix}quotes --list`
        })
      }, {
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: "📂 PILIH KATEGORI QUOTES",
          sections: [{
            title: "DAFTAR KATEGORI QUOTES",
            rows: categoryRows
          }]
        })
      }];
      const options = {
        image: bannerBuffer || global.bot?.media?.banner1 || null,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 2,
            list_title: `${botName} • Quotes Generator`,
            button_title: "Pilih Kategori"
          }
        },
        contextInfo: {
          forwardingScore: 999,
          isForwarded: true
        },
        quoted: quotedMsg
      };
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(formattedText, botFooter, buttons, options);
      } else if (bannerBuffer) {
        await sock.sendMessage(ctx.id, {
          image: bannerBuffer,
          caption: formattedText
        }, {
          quoted: quotedMsg
        });
      } else {
        await sock.sendMessage(ctx.id, {
          text: formattedText
        }, {
          quoted: quotedMsg
        });
      }
      if (typeof ctx.react === "function") await ctx.react("✨");
    } catch (error) {
      console.error("[Quotes Feature Error]:", error?.message || error);
      if (typeof ctx.react === "function") await ctx.react("❌");
      ctx.reply(`❌ Terjadi kesalahan: ${error?.message || error}`);
    }
  }
};