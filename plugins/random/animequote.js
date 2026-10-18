import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const CONFIG = {
  BASE_URL: `${global.bot?.api?.wudysoft}/api/quotes/anime`,
  TIMEOUT: 3e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  VERSIONS: {
    v2: {
      name: "Anime Quotes V2",
      desc: "Koleksi quotes anime multi-karakter (List)",
      type: "list"
    },
    v3: {
      name: "Anime Quotes V3",
      desc: "Quotes anime bergambar & kartu karakter HQ",
      type: "single"
    },
    v4: {
      name: "Anime Quotes V4",
      desc: "Koleksi quotes anime mendalam & filosofis (List)",
      type: "list"
    }
  }
};
const animeCache = new Map();

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /(?:--|-)([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1].toLowerCase();
    let rawVal = match[2];
    let val = true;
    const aliasMap = {
      version: ["v", "ver", "versi"],
      index: ["i", "idx", "num"],
      translate: ["tr", "tl", "terjemah", "arti"],
      tts: ["audio", "vn", "voice", "suara"],
      lang: ["l", "bahasa"]
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
async function fetchAnimeQuoteApi(version = "v2") {
  const ver = CONFIG.VERSIONS[version] ? version : "v2";
  const url = `${CONFIG.BASE_URL}/${ver}`;
  const res = await axios.get(url, {
    headers: {
      "User-Agent": CONFIG.USER_AGENT
    },
    timeout: CONFIG.TIMEOUT
  });
  return res.data;
}
async function translateText(text, targetLang = "id") {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
    const res = await axios.get(url, {
      headers: {
        "User-Agent": CONFIG.USER_AGENT
      },
      timeout: CONFIG.TIMEOUT
    });
    return res.data?.[0]?.map(x => x[0]).join("") || text;
  } catch {
    return text;
  }
}
async function fetchTTSBuffer(text, lang = "id") {
  const cleanText = text.replace(/["“”\n]/g, " ").slice(0, 200).trim();
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${lang}&client=tw-ob&q=${encodeURIComponent(cleanText)}`;
  const res = await axios.get(url, {
    responseType: "arraybuffer",
    headers: {
      "User-Agent": CONFIG.USER_AGENT
    },
    timeout: CONFIG.TIMEOUT
  });
  return Buffer.from(res.data);
}
export default {
  name: "animequote",
  aliases: ["animequotes", "kataanime", "quotesanime", "animquote"],
  description: "Mendapatkan kutipan kata-kata anime dari berbagai versi, dilengkapi terjemahan & TTS audio.",
  category: "Quotes",
  limit: true,
  example: "animequote\nanimequote -v v2\nanimequote -v v3\nanimequote -v v4 -i 2\nanimequote -v v2 -i 1 --tr\nanimequote -v v2 -i 1 --tts",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["animequote", "animequotes", "kataanime", "quotesanime", "animquote"].some(a => firstWord.endsWith(a))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "Paimon-bot";
      const botFooter = global.bot?.footer || `${botName} • Anime Quotes`;
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const senderId = ctx.sender || ctx.author || msg.key?.participant || msg.key?.remoteJid || ctx.id;
      let selectedVersion = null;
      if (flags.version) {
        selectedVersion = String(flags.version).toLowerCase();
      } else if (["v2", "v3", "v4"].includes(cleanPrompt.toLowerCase())) {
        selectedVersion = cleanPrompt.toLowerCase();
      }
      if (!selectedVersion && flags.index === undefined) {
        const versionRows = Object.entries(CONFIG.VERSIONS).map(([key, val]) => ({
          title: `🌸 ${val.name}`,
          id: `${prefix}animequote -v ${key}`,
          description: val.desc
        }));
        const bodyText = `–  *A N I M E  Q U O T E S*

Silakan tentukan versi basis data kutipan anime yang ingin Anda telusuri.

┌  ◦  *Versi 2* : Koleksi quotes multi-karakter (List)
│  ◦  *Versi 3* : Quotes bergambar & kartu karakter HQ
└  ◦  *Versi 4* : Quotes mendalam & filosofis (List)

Silakan pilih versi melalui menu tombol di bawah:`;
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "📂 PILIH VERSI QUOTES",
            sections: [{
              title: "VERSI DATABASE",
              rows: versionRows
            }]
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🎲 Acak Quotes V3",
            id: `${prefix}animequote -v v3`
          })
        }];
        const options = {
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 1,
              list_title: `${botName} • Anime Quotes`,
              button_title: "Buka Daftar Versi"
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
      const versionKey = ["v2", "v3", "v4"].includes(selectedVersion) ? selectedVersion : "v2";
      let cacheKey = `${senderId}_${versionKey}`;
      let quoteData = animeCache.get(cacheKey);
      if (!quoteData || flags.index === undefined) {
        const apiRes = await fetchAnimeQuoteApi(versionKey);
        if (!apiRes) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply(`❌ Gagal mengambil quotes anime versi ${versionKey.toUpperCase()}.`);
        }
        quoteData = {
          version: versionKey,
          items: Array.isArray(apiRes) ? apiRes : [apiRes]
        };
        if (animeCache.size > 50) animeCache.clear();
        animeCache.set(cacheKey, quoteData);
      }
      const items = quoteData.items || [];
      if (!items.length) {
        if (typeof ctx.react === "function") await ctx.react("❌");
        return ctx.reply("❌ Data quotes anime tidak ditemukan.");
      }
      if (CONFIG.VERSIONS[versionKey].type === "list" && flags.index === undefined) {
        const itemRows = items.map((item, idx) => {
          const charName = item.character || "Unknown Character";
          const animeTitle = item.anime || item.series || "Anime Series";
          const snippet = item.quote ? item.quote.length > 40 ? item.quote.slice(0, 37) + "..." : item.quote : "";
          return {
            title: `👤 ${charName.slice(0, 20)} (${animeTitle.slice(0, 15)})`,
            id: `${prefix}animequote -v ${versionKey} -i ${idx + 1}`,
            description: snippet
          };
        });
        const bodyText = `–  *A N I M E  Q U O T E S*

Ditemukan ${items.length} kutipan anime pada sesi database ini.

┌  ◦  *Versi* : ${versionKey.toUpperCase()}
└  ◦  *Total* : ${items.length} Kutipan

Silakan pilih karakter melalui menu tombol di bawah untuk membaca rinciannya.`;
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: `📂 DAFTAR QUOTES (${versionKey.toUpperCase()})`,
            sections: [{
              title: `PILIH DARI ${items.length} QUOTES`,
              rows: itemRows
            }]
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🔄 Muat List Baru",
            id: `${prefix}animequote -v ${versionKey}`
          })
        }];
        const options = {
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 1,
              list_title: `${botName} • Anime Quotes ${versionKey.toUpperCase()}`,
              button_title: "Pilih Quotes"
            }
          },
          quoted: quotedMsg
        };
        if (typeof ctx.react === "function") await ctx.react("✅");
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
      let targetIdx = 0;
      if (flags.index !== undefined) {
        targetIdx = Math.max(0, Math.min(Number(flags.index) - 1, items.length - 1));
      }
      const activeQuote = items[targetIdx] || items[0];
      const rawQuoteText = activeQuote.quote || "";
      const character = activeQuote.character || "Karakter Anime";
      const anime = activeQuote.anime || activeQuote.series || "Anime Series";
      const imageUrl = activeQuote.image || null;
      if (flags.tts) {
        const langTarget = flags.lang || (flags.translate ? "id" : "en");
        let ttsText = rawQuoteText;
        if (langTarget === "id" || flags.translate) {
          ttsText = await translateText(rawQuoteText, "id");
        }
        const audioBuffer = await fetchTTSBuffer(ttsText, langTarget);
        await sock.sendMessage(ctx.id, {
          audio: audioBuffer,
          mimetype: "audio/mp4",
          ptt: true
        }, {
          quoted: quotedMsg
        });
        if (typeof ctx.react === "function") await ctx.react("✅");
        return;
      }
      let translatedQuote = "";
      if (flags.translate) {
        translatedQuote = await translateText(rawQuoteText, "id");
      }
      let formattedText = `–  *A N I M E  Q U O T E*

┌  ◦  *Karakter* : ${character}
│  ◦  *Anime* : ${anime}
└  ◦  *Versi* : ${versionKey.toUpperCase()}

“${rawQuoteText.trim()}”\n`;
      if (translatedQuote) {
        formattedText += `\n–  *T E R J E M A H A N*

“${translatedQuote.trim()}”\n`;
      }
      formattedText += `\nSilakan pilih opsi di bawah untuk mendengarkan Voice Note (TTS) atau melihat kutipan lainnya:`;
      const currentIdxNum = targetIdx + 1;
      const buttons = [{
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🗣️ Dengarkan TTS (VN)",
          id: `${prefix}animequote -v ${versionKey} -i ${currentIdxNum} --tts`
        })
      }];
      if (!flags.translate) {
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🇮🇩 Terjemahkan (ID)",
            id: `${prefix}animequote -v ${versionKey} -i ${currentIdxNum} --tr`
          })
        });
      }
      buttons.push({
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🎲 Quotes Lainnya",
          id: `${prefix}animequote -v ${versionKey}`
        })
      });
      const options = {
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 3,
            list_title: `${botName} • Anime Quote Action`,
            button_title: "Opsi Quotes"
          }
        },
        contextInfo: {
          forwardingScore: 999,
          isForwarded: true
        },
        quoted: quotedMsg
      };
      if (imageUrl) {
        options.image = imageUrl;
      }
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(formattedText, botFooter, buttons, options);
      } else {
        if (imageUrl) {
          await sock.sendMessage(ctx.id, {
            image: {
              url: imageUrl
            },
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
      }
      if (typeof ctx.react === "function") await ctx.react("✅");
    } catch (error) {
      console.error("[AnimeQuote Feature Error]:", error?.message || error);
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