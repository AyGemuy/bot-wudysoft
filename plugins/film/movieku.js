import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const CONFIG = {
  API_URL: `${global.bot?.api?.wudysoft}/api/film/movieku`,
  TIMEOUT: 45e3,
  ITEMS_PER_PAGE: 15
};
const moviekuCache = new Map();

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /(?:--|-)([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1].toLowerCase();
    let rawVal = match[2];
    let val = true;
    if (["detail", "d", "url", "link"].includes(key)) key = "detail";
    if (["search", "s", "query", "q"].includes(key)) key = "search";
    if (["home", "h", "latest", "l", "hot"].includes(key)) key = "home";
    if (["page", "p", "pg"].includes(key)) key = "page";
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
  if (!flags.detail) {
    const linkMatch = cleanPrompt.match(/https?:\/\/[^\s]*movieku[^\s]+/i);
    if (linkMatch) {
      flags.detail = linkMatch[0];
    }
  }
  return {
    flags: flags,
    cleanPrompt: cleanPrompt
  };
}
export default {
  name: "movieku",
  aliases: ["mku", "moviekufit", "nontonmovieku"],
  description: "Cari film/series, dapatkan link streaming & download langsung dari Movieku",
  category: "Film",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["movieku", "mku", "moviekufit", "nontonmovieku"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • Movieku`;
      const userName = ctx.pushname || (ctx.sender ? ctx.sender.split("@")[0] : "User");
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      if (!rawText && !cleanPrompt && Object.keys(flags).length === 0) {
        return ctx.reply(`–  *M O V I E K U*

Layanan streaming & unduh film serta serial TV Subtitle Indonesia.

┌  ◦  *Pencarian* : \`${prefix}movieku <judul film>\`
│  ◦  *Detail*    : \`${prefix}movieku -d <url-film>\`
└  ◦  *Terbaru*   : \`${prefix}movieku --latest\`

–  *F L A G S*

┌  ◦  \`--search, -s\`  : Cari judul film / series spesifik
├  ◦  \`--detail, -d\`  : Buka info lengkap & link download
├  ◦  \`--page, -p\`    : Navigasi nomor halaman pencarian
└  ◦  \`--latest, -l\`  : Daftar film dan rilisan terhangat`);
      }
      if (typeof ctx.react === "function") await ctx.react("⏳");
      if (flags.detail) {
        const targetUrl = String(flags.detail).trim();
        let item = null;
        const cached = moviekuCache.get(targetUrl);
        if (cached) {
          item = cached;
        } else {
          const {
            data
          } = await axios.get(CONFIG.API_URL, {
            params: {
              action: "detail",
              url: targetUrl
            },
            timeout: CONFIG.TIMEOUT
          });
          if (!data?.status || !data?.result) {
            if (typeof ctx.react === "function") await ctx.react("❌");
            return ctx.reply("❌ Gagal mengambil detail film. Tautan tidak valid.");
          }
          item = data.result;
          moviekuCache.set(targetUrl, item);
        }
        const genres = Array.isArray(item.genre) ? item.genre.join(", ") : "-";
        const stars = Array.isArray(item.stars) ? item.stars.slice(0, 5).join(", ") : "-";
        const downloads = item.download_links || [];
        const downloadRows = [];
        downloads.forEach(group => {
          (group.links || []).forEach(linkObj => {
            if (downloadRows.length < 20) {
              downloadRows.push({
                title: `📥 [${group.resolution || "HD"}] ${linkObj.host.slice(0, 15)}`,
                id: `.shorturl ${linkObj.url}`,
                description: `Server: ${linkObj.host} | Kualitas: ${group.resolution}`
              });
            }
          });
        });
        const buttons = [];
        if (item.stream_embed && item.stream_embed.startsWith("http")) {
          buttons.push({
            name: "cta_url",
            buttonParamsJson: JSON.stringify({
              display_text: "▶️ Putar Video Player",
              url: item.stream_embed,
              merchant_url: item.stream_embed
            })
          });
        }
        if (downloadRows.length > 0) {
          buttons.push({
            name: "single_select",
            buttonParamsJson: JSON.stringify({
              title: "📥 PILIH SERVER UNDUHAN",
              sections: [{
                title: "⚡ LINK DOWNLOAD BATCH / EPISODE",
                rows: downloadRows
              }]
            })
          });
        }
        const bodyText = `–  *M O V I E K U  D E T A I L*

┌  ◦  *Judul* : ${item.title || "-"}
│  ◦  *Rating* : ⭐ ${item.score || "-"}
│  ◦  *Kualitas* : ${item.quality || "HD"}
│  ◦  *Rilis* : ${item.release || "-"}
│  ◦  *Durasi* : ${item.duration || "-"}
│  ◦  *Genre* : ${genres}
│  ◦  *Negara* : ${Array.isArray(item.country) ? item.country.join(", ") : item.country || "-"}
└  ◦  *Pemeran* : ${stars}

–  *S I N O P S I S*
${item.synopsis ? item.synopsis.length > 350 ? item.synopsis.slice(0, 350) + "..." : item.synopsis : "Tidak ada ringkasan sinopsis."}

${item.stream_embed ? "Gunakan tombol *Putar Video Player* untuk menonton streaming!" : ""}
${downloadRows.length > 0 ? "Pilih tautan server dari tombol *PILIH SERVER UNDUHAN* untuk download." : ""}`;
        const posterImage = item.thumb || null;
        if (typeof ctx.sendCta === "function") {
          await ctx.sendCta(bodyText, botFooter, buttons, {
            image: posterImage,
            quoted: quotedMsg
          });
        } else {
          await sock.sendMessage(ctx.id, {
            image: posterImage ? {
              url: posterImage
            } : undefined,
            caption: bodyText
          }, {
            quoted: quotedMsg
          });
        }
        if (typeof ctx.react === "function") await ctx.react("✅");
        return;
      }
      if (flags.home) {
        const {
          data
        } = await axios.get(CONFIG.API_URL, {
          params: {
            action: "home"
          },
          timeout: CONFIG.TIMEOUT
        });
        const homeRes = data?.result;
        if (!data?.status || !homeRes) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply("❌ Gagal mengambil katalog beranda Movieku.");
        }
        const hotList = homeRes.hot_updates || [];
        const latestMovies = homeRes.latest_movies || [];
        const fullList = [...hotList, ...latestMovies];
        if (fullList.length === 0) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply("❌ Tidak ada katalog rilis terbaru saat ini.");
        }
        const rows = fullList.slice(0, CONFIG.ITEMS_PER_PAGE).map((item, idx) => ({
          title: `[#${idx + 1}] ${item.title.slice(0, 24)}`,
          id: `${prefix}movieku -d ${item.url}`,
          description: `Tipe: ${item.type} | Kualitas: ${item.quality} | Tahun: ${item.year || "-"}`
        }));
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "🎬 DAFTAR FILM HANGAT",
            sections: [{
              title: "🔥 HOT & LATEST MOVIES",
              rows: rows
            }]
          })
        }];
        const bodyText = `–  *M O V I E K U  H O T  U P D A T E S*

Berikut daftar film dan serial terhangat yang baru dirilis di Movieku.
Silakan klik tombol di bawah untuk melihat rincian & tautan player streaming.`;
        const topThumb = fullList[0]?.thumb || null;
        if (typeof ctx.sendCta === "function") {
          await ctx.sendCta(bodyText, botFooter, buttons, {
            image: topThumb,
            quoted: quotedMsg
          });
        } else {
          await sock.sendMessage(ctx.id, {
            image: topThumb ? {
              url: topThumb
            } : undefined,
            caption: bodyText
          }, {
            quoted: quotedMsg
          });
        }
        if (typeof ctx.react === "function") await ctx.react("✅");
        return;
      }
      const querySearch = flags.search ? String(flags.search).trim() : cleanPrompt;
      if (!querySearch) {
        if (typeof ctx.react === "function") await ctx.react("❌");
        return ctx.reply(`❌ Masukkan judul film yang ingin dicari!\nContoh: \`${prefix}movieku spiderman\``);
      }
      const page = Number(flags.page) || 1;
      const {
        data
      } = await axios.get(CONFIG.API_URL, {
        params: {
          action: "search",
          query: querySearch,
          page: page
        },
        timeout: CONFIG.TIMEOUT
      });
      const searchList = Array.isArray(data?.result) ? data.result : [];
      if (!data?.status || searchList.length === 0) {
        if (typeof ctx.react === "function") await ctx.react("❌");
        return ctx.reply(`❌ Film dengan judul "${querySearch}" tidak ditemukan.`);
      }
      const rows = searchList.slice(0, CONFIG.ITEMS_PER_PAGE).map((item, idx) => ({
        title: `[#${idx + 1}] ${item.title.slice(0, 24)}`,
        id: `${prefix}movieku -d ${item.url}`,
        description: `Tipe: ${item.type} | Kualitas: ${item.quality} | Tahun: ${item.year || "-"}`
      }));
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: "📂 PILIH HASIL PENCARIAN",
          sections: [{
            title: `🔎 Hasil: "${querySearch}" (Hal ${data.page || page}/${data.total_pages || 1})`,
            rows: rows
          }]
        })
      }];
      if (data.has_prev) {
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `⬅️ Hal ${page - 1}`,
            id: `${prefix}movieku "${querySearch}" -p ${page - 1}`
          })
        });
      }
      if (data.has_next) {
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `➡️ Hal ${page + 1}`,
            id: `${prefix}movieku "${querySearch}" -p ${page + 1}`
          })
        });
      }
      const bodyText = `Hi ${userName}!
Ditemukan *${searchList.length}* judul film untuk kata kunci: \`${querySearch}\`.

–  *H A S I L  P E N C A R I A N*

┌  ◦  *Kata Kunci* : ${querySearch}
└  ◦  *Halaman* : ${data.page || page} / ${data.total_pages || 1}

Silakan klik tombol *PILIH HASIL PENCARIAN* di bawah untuk melihat rincian & streaming.`;
      const topThumb = searchList[0]?.thumb || null;
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, botFooter, buttons, {
          image: topThumb,
          quoted: quotedMsg
        });
      } else {
        await sock.sendMessage(ctx.id, {
          image: topThumb ? {
            url: topThumb
          } : undefined,
          caption: bodyText
        }, {
          quoted: quotedMsg
        });
      }
      if (typeof ctx.react === "function") await ctx.react("✅");
    } catch (error) {
      console.error("[Movieku Error]:", error?.message || error);
      if (typeof ctx.react === "function") await ctx.react("❌");
      let errMsg = error.message;
      if (error.response?.data) {
        try {
          const parsed = typeof error.response.data === "string" ? JSON.parse(error.response.data) : error.response.data;
          errMsg = parsed.message || parsed.error || errMsg;
        } catch {}
      }
      ctx.reply(`❌ Terjadi kesalahan pada Movieku: ${errMsg}`);
    }
  }
};