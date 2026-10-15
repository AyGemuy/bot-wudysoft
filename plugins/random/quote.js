import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
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
      random: ["r", "acak"]
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
export default {
  name: "quotes",
  aliases: ["quote", "katabijak", "bucin", "katabacot", "pakboy", "galau", "sadboy", "sindiran", "katailham"],
  description: "Menampilkan quotes random dari berbagai kategori (Bijak, Bucin, Pakboy, Sad, Sindiran, Bacot, Ilham)",
  category: "Quotes",
  limit: true,
  example: "quotes\nquotes bucin\nquotes --type sindiran\ngalau\npakboy",
  execute: async (sock, ctx, msg) => {
    try {
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
      const botName = global.bot?.name || "Paimon-bot";
      const botFooter = global.bot?.footer || `${botName} • Quotes Generator`;
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
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
      const formattedText = `–  *Q U O T E S*

┌  ◦  *Kategori* : ${catInfo.name} ${catInfo.emoji}
└  ◦  *Koleksi* : Generator Acak

“${quoteText.trim()}”

Gunakan tombol di bawah untuk mengambil kutipan serupa atau kategori lainnya.`;
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
          display_text: "🎲 Quotes Acak",
          id: `${prefix}quotes --random`
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
      const bannerMedia = global.bot?.media?.banner1 || global.bot?.media?.banner2 || null;
      const options = {
        image: bannerMedia,
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
      } else {
        await sock.sendMessage(ctx.id, {
          text: formattedText
        }, {
          quoted: quotedMsg
        });
      }
      if (typeof ctx.react === "function") await ctx.react("✅");
    } catch (error) {
      console.error("[Quotes Feature Error]:", error?.message || error);
      if (typeof ctx.react === "function") await ctx.react("❌");
      let errorMessage = error?.message || "Terjadi kesalahan";
      if (error?.response?.data) {
        try {
          const parsed = typeof error.response.data === "string" ? JSON.parse(error.response.data) : error.response.data;
          errorMessage = parsed.error || parsed.message || errorMessage;
        } catch {}
      }
      ctx.reply(`❌ Terjadi kesalahan: ${errorMessage}`);
    }
  }
};