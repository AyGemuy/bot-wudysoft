import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const CONFIG = {
  DATA_URL: "https://pastebin.com/raw/j9Hrx7V4",
  TIMEOUT: 3e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  CACHE_TTL: 1e3 * 60 * 60
};
const CATEGORY_META = {
  china: {
    name: "China",
    emoji: "🇨🇳",
    desc: "Foto cecan asal Tiongkok"
  },
  vietnam: {
    name: "Vietnam",
    emoji: "🇻🇳",
    desc: "Foto cecan asal Vietnam"
  },
  thailand: {
    name: "Thailand",
    emoji: "🇹🇭",
    desc: "Foto cecan asal Thailand"
  },
  indonesia: {
    name: "Indonesia",
    emoji: "🇮🇩",
    desc: "Foto cecan lokal Indonesia"
  },
  korea: {
    name: "Korea",
    emoji: "🇰🇷",
    desc: "Foto cecan ulzzang Korea"
  },
  japan: {
    name: "Jepang",
    emoji: "🇯🇵",
    desc: "Foto cecan asal Jepang"
  },
  malaysia: {
    name: "Malaysia",
    emoji: "🇲🇾",
    desc: "Foto cecan asal Malaysia"
  },
  justinaxie: {
    name: "Justina Xie",
    emoji: "✨",
    desc: "Koleksi foto Justina Xie"
  },
  jeni: {
    name: "Jennie (BLACKPINK)",
    emoji: "🖤",
    desc: "Koleksi foto Jennie Kim"
  },
  jiso: {
    name: "Jisoo (BLACKPINK)",
    emoji: "💖",
    desc: "Koleksi foto Kim Jisoo"
  },
  ryujin: {
    name: "Ryujin (ITZY)",
    emoji: "👑",
    desc: "Koleksi foto Shin Ryujin"
  },
  rose: {
    name: "Rosé (BLACKPINK)",
    emoji: "🌹",
    desc: "Koleksi foto Park Chaeyoung"
  },
  hijaber: {
    name: "Hijaber",
    emoji: "🧕",
    desc: "Foto cecan muslimah berhijab"
  }
};
let cachedData = null;
let lastFetch = 0;
async function fetchCecanData() {
  const now = Date.now();
  if (cachedData && now - lastFetch < CONFIG.CACHE_TTL) {
    return cachedData;
  }
  const res = await axios.get(CONFIG.DATA_URL, {
    headers: {
      "User-Agent": CONFIG.USER_AGENT
    },
    timeout: CONFIG.TIMEOUT
  });
  if (typeof res.data === "object" && res.data !== null) {
    cachedData = res.data;
  } else if (typeof res.data === "string") {
    cachedData = JSON.parse(res.data);
  }
  lastFetch = now;
  return cachedData;
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
      category: ["c", "cat", "kategori", "tipe"]
    };
    for (const [realKey, aliases] of Object.entries(aliasMap)) {
      if (aliases.includes(key)) key = realKey;
    }
    if (rawVal !== undefined) {
      if (rawVal.startsWith('"') && rawVal.endsWith('"') || rawVal.startsWith("'") && rawVal.endsWith("'")) {
        rawVal = rawVal.slice(1, -1);
      }
      val = rawVal;
    }
    flags[key] = val;
  }
  const cleanPrompt = input.replace(flagRegex, "").trim();
  return {
    flags: flags,
    cleanPrompt: cleanPrompt
  };
}

function getRandomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
export default {
  name: "cecan",
  aliases: ["cewe", "cewek", "asupan", "girl"],
  description: "Menampilkan koleksi foto cecan aesthetic dari Pastebin via Axios.",
  category: "Internet",
  limit: true,
  example: "cecan\ncecan indonesia\ncecan korea\ncecan hijaber\ncecan -c jeni\ncecan acak",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["cecan", "cewe", "cewek", "asupan", "girl"].some(a => firstWord.endsWith(a))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "Paimon-bot";
      const botFooter = global.bot?.footer || `${botName} • Cecan Gallery`;
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      let categoryArg = (flags.category || cleanPrompt || "").toLowerCase().trim();
      const cecanDb = await fetchCecanData();
      if (!cecanDb || typeof cecanDb !== "object") {
        if (typeof ctx.react === "function") await ctx.react("❌");
        return ctx.reply("❌ Gagal memuat database gambar dari Pastebin.");
      }
      const allKeys = Object.keys(cecanDb);
      if (!categoryArg) {
        const categoryRows = allKeys.map(key => {
          const meta = CATEGORY_META[key] || {
            name: key.toUpperCase(),
            emoji: "✨",
            desc: `Foto cecan kategori ${key}`
          };
          return {
            title: `${meta.emoji} Cecan ${meta.name}`,
            id: `${prefix}cecan ${key}`,
            description: `${meta.desc} (${cecanDb[key]?.length || 0} Foto)`
          };
        });
        const bodyText = `–  *C E C A N  G A L L E R Y*

Temukan koleksi potret cecan pilihan dari berbagai penjuru negara serta idol favorit.

┌  ◦  *Total Kategori* : ${allKeys.length} Kategori
│  ◦  *Database* : Pastebin Raw API
└  ◦  *Mode* : Single Pick & Randomizer

Silakan tentukan kategori melalui menu pilihan di bawah ini:`;
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "📂 PILIH KATEGORI CECAN",
            sections: [{
              title: "DAFTAR NEGARA & IDOL",
              rows: categoryRows
            }]
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🎲 Acak Semua Kategori",
            id: `${prefix}cecan acak`
          })
        }];
        const options = {
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 1,
              list_title: `${botName} • Cecan Categories`,
              button_title: "Buka Daftar Kategori"
            }
          },
          contextInfo: {
            forwardingScore: 999,
            isForwarded: true
          },
          quoted: quotedMsg
        };
        if (typeof ctx.sendCta === "function") {
          return await ctx.sendCta(bodyText, botFooter, buttons, options);
        } else {
          return await sock.sendMessage(ctx.id, {
            text: bodyText
          }, {
            quoted: quotedMsg
          });
        }
      }
      if (typeof ctx.react === "function") await ctx.react("⏳");
      let selectedKey = null;
      if (["acak", "random", "all", "bebas"].includes(categoryArg)) {
        selectedKey = getRandomItem(allKeys);
      } else {
        selectedKey = allKeys.find(k => k === categoryArg || categoryArg.includes(k));
      }
      if (!selectedKey || !Array.isArray(cecanDb[selectedKey]) || cecanDb[selectedKey].length === 0) {
        if (typeof ctx.react === "function") await ctx.react("❌");
        return ctx.reply(`❌ Kategori *"${categoryArg}"* tidak ditemukan!\n\n` + `Daftar kategori yang tersedia:\n` + allKeys.map(k => `• ${prefix}cecan ${k}`).join("\n"));
      }
      const imageList = cecanDb[selectedKey];
      const imageUrl = getRandomItem(imageList);
      const meta = CATEGORY_META[selectedKey] || {
        name: selectedKey.toUpperCase(),
        emoji: "✨"
      };
      const bodyText = `–  *C E C A N  G A L L E R Y*

┌  ◦  *Kategori* : ${meta.emoji} ${meta.name}
│  ◦  *Tersedia* : ${imageList.length} Foto
└  ◦  *CDN* : Catbox Storage

Tekan tombol di bawah untuk meminta foto lainnya:`;
      const buttons = [{
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: `🔄 Next (${meta.name.split(" ")[0]})`,
          id: `${prefix}cecan ${selectedKey}`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🎲 Acak Kategori",
          id: `${prefix}cecan acak`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "📂 Menu Kategori",
          id: `${prefix}cecan`
        })
      }];
      const options = {
        image: imageUrl,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 3,
            list_title: `${botName} • Cecan Preview`,
            button_title: "Opsi Cecan"
          }
        },
        contextInfo: {
          forwardingScore: 999,
          isForwarded: true
        },
        quoted: quotedMsg
      };
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, botFooter, buttons, options);
      } else {
        await sock.sendMessage(ctx.id, {
          image: {
            url: imageUrl
          },
          caption: bodyText
        }, {
          quoted: quotedMsg
        });
      }
      if (typeof ctx.react === "function") await ctx.react("✅");
    } catch (error) {
      console.error("[Cecan Feature Error]:", error?.message || error);
      if (typeof ctx.react === "function") await ctx.react("❌");
      ctx.reply(`❌ Terjadi kesalahan saat memuat data: ${error?.message || "Internal Server Error"}`);
    }
  }
};