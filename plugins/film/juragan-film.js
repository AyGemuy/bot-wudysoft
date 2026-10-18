import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const CONFIG = {
  API_URL: `${global.bot?.api?.wudysoft}/api/film/juragan-film`,
  TIMEOUT: 6e4,
  ITEMS_PER_PAGE: 15
};
const juraganCache = new Map();

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /(?:--|-)([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1].toLowerCase();
    let rawVal = match[2];
    let val = true;
    if (["detail", "d", "url", "link", "slug"].includes(key)) key = "detail";
    if (["search", "s", "query", "q"].includes(key)) key = "search";
    if (["home", "h", "latest", "l"].includes(key)) key = "home";
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
    const linkMatch = cleanPrompt.match(/https?:\/\/[^\s]*juragan\.film\/[^\s]+/i);
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
  name: "juraganfilm",
  aliases: ["juragan", "jfilm", "jf", "nontonfilm"],
  description: "Cari film/serial TV dan dapatkan link nonton streaming dari JuraganFilm",
  category: "Film",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["juraganfilm", "juragan", "jfilm", "jf", "nontonfilm"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • JuraganFilm`;
      const userName = ctx.pushname || (ctx.sender ? ctx.sender.split("@")[0] : "User");
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      if (!rawText && !cleanPrompt && Object.keys(flags).length === 0) {
        return ctx.reply(`–  *J U R A G A N  F I L M*

Layanan katalog dan streaming Film Layar Lebar & Serial TV Subtitle Indonesia.

┌  ◦  *Pencarian* : \`${prefix}juraganfilm <judul film>\`
│  ◦  *Detail*    : \`${prefix}juraganfilm -d <url/slug-film>\`
└  ◦  *Terbaru*   : \`${prefix}juraganfilm --latest\`

–  *F L A G S*

┌  ◦  \`--search, -s\`  : Cari judul film / TV series
├  ◦  \`--detail, -d\`  : Buka detail info & link player
├  ◦  \`--page, -p\`    : Halaman paginasi
└  ◦  \`--latest, -l\`  : Rekomendasi & film rilis terbaru`);
      }
      if (typeof ctx.react === "function") await ctx.react("⏳");
      if (flags.detail) {
        const targetUrl = String(flags.detail).trim();
        let item = null;
        const cached = juraganCache.get(targetUrl);
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
          if (!data?.status || !data?.result || typeof data.result === "string") {
            if (typeof ctx.react === "function") await ctx.react("❌");
            return ctx.reply(`❌ Gagal: ${typeof data?.result === "string" ? data.result : "Film tidak ditemukan."}`);
          }
          item = data.result;
          juraganCache.set(targetUrl, item);
        }
        const genres = Array.isArray(item.genres) ? item.genres.join(", ") : "-";
        const cast = Array.isArray(item.cast) ? item.cast.slice(0, 5).join(", ") : "-";
        const episodes = item.episode_links || [];
        const buttons = [];
        if (item.iframe_src && item.iframe_src.startsWith("http")) {
          buttons.push({
            name: "cta_url",
            buttonParamsJson: JSON.stringify({
              display_text: "▶️ Putar Streaming Film",
              url: item.iframe_src,
              merchant_url: item.iframe_src
            })
          });
        }
        if (episodes.length > 0) {
          const epRows = episodes.slice(0, 20).map(ep => ({
            title: `🎬 ${ep.text.slice(0, 24)}`,
            id: `${prefix}juraganfilm -d ${ep.href}`,
            description: ep.current ? "• Sedang Dipilih •" : `Buka ${ep.text}`
          }));
          buttons.push({
            name: "single_select",
            buttonParamsJson: JSON.stringify({
              title: "📂 PILIH EPISODE LAIN",
              sections: [{
                title: `DAFTAR EPISODE (${episodes.length} Total)`,
                rows: epRows
              }]
            })
          });
        }
        const bodyText = `–  *J U R A G A N  F I L M  D E T A I L*

┌  ◦  *Judul* : ${item.title}
│  ◦  *Tipe* : ${item.type || "Movie"}
│  ◦  *Rating* : ⭐ ${item.rating || "-"} ${item.rating_percent ? `(${item.rating_percent}%)` : ""}
│  ◦  *Kualitas* : ${item.quality || "HD"}
│  ◦  *Rilis* : ${item.year || item.release_date || "-"}
│  ◦  *Durasi* : ${item.duration || "-"}
│  ◦  *Genre* : ${genres}
│  ◦  *Negara* : ${Array.isArray(item.country) ? item.country.join(", ") : item.country || "-"}
└  ◦  *Pemeran* : ${cast}

–  *S I N O P S I S*
${item.synopsis ? item.synopsis.length > 350 ? item.synopsis.slice(0, 350) + "..." : item.synopsis : "Tidak ada ringkasan cerita."}

${item.iframe_src ? "Klik tombol *Putar Streaming Film* di bawah untuk langsung menonton!" : ""}`;
        const posterImage = item.poster || null;
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
        const page = Number(flags.page) || 1;
        const {
          data
        } = await axios.get(CONFIG.API_URL, {
          params: {
            action: "home",
            page: page
          },
          timeout: CONFIG.TIMEOUT
        });
        const homeData = data?.result;
        if (!data?.status || !homeData || typeof homeData === "string") {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply("❌ Gagal memuat katalog beranda film.");
        }
        const movieList = homeData.latest_movie || homeData.box_office || Object.values(homeData).find(val => Array.isArray(val) && val.length > 0) || [];
        if (movieList.length === 0) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply("❌ Tidak ada film yang ditemukan.");
        }
        const rows = movieList.slice(0, CONFIG.ITEMS_PER_PAGE).map((m, idx) => ({
          title: `[#${idx + 1}] ${m.title.slice(0, 24)}`,
          id: `${prefix}juraganfilm -d ${m.link || m.url}`,
          description: `⭐ ${m.rating || "-"} | ${m.quality || "HD"} | ${m.year || "-"} | ${m.type || "Movie"}`
        }));
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "🎬 PILIH FILM TERBARU",
            sections: [{
              title: `🔥 KATALOG TERBARU (Halaman ${page})`,
              rows: rows
            }]
          })
        }];
        if (page > 1) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: `⬅️ Hal ${page - 1}`,
              id: `${prefix}juraganfilm --latest -p ${page - 1}`
            })
          });
        }
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `➡️ Hal ${page + 1}`,
            id: `${prefix}juraganfilm --latest -p ${page + 1}`
          })
        });
        const bodyText = `–  *J U R A G A N  F I L M  T E R B A R U*

Berikut daftar film dan serial rilis terbaru di JuraganFilm (Hal ${page}).
Silakan klik tombol *PILIH FILM TERBARU* di bawah untuk melihat detail info dan menonton.`;
        const topPoster = movieList[0]?.poster || null;
        if (typeof ctx.sendCta === "function") {
          await ctx.sendCta(bodyText, botFooter, buttons, {
            image: topPoster,
            quoted: quotedMsg
          });
        } else {
          await sock.sendMessage(ctx.id, {
            image: topPoster ? {
              url: topPoster
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
        return ctx.reply(`❌ Masukkan judul film yang ingin dicari!\nContoh: \`${prefix}juraganfilm avatar\``);
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
        id: `${prefix}juraganfilm -d ${item.link || item.url}`,
        description: `⭐ ${item.rating || "-"} | ${item.quality || "HD"} | ${item.year || "-"} | ${item.type || "Movie"}`
      }));
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: "📂 PILIH HASIL PENCARIAN",
          sections: [{
            title: `🔎 Hasil: "${querySearch}" (${searchList.length} Ditemukan)`,
            rows: rows
          }]
        })
      }];
      if (page > 1) {
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `⬅️ Hal ${page - 1}`,
            id: `${prefix}juraganfilm "${querySearch}" -p ${page - 1}`
          })
        });
      }
      if (searchList.length >= CONFIG.ITEMS_PER_PAGE) {
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `➡️ Hal ${page + 1}`,
            id: `${prefix}juraganfilm "${querySearch}" -p ${page + 1}`
          })
        });
      }
      const bodyText = `Hi ${userName}!
Ditemukan *${searchList.length}* judul film untuk kata kunci: \`${querySearch}\`.

–  *H A S I L  P E N C A R I A N*

Silakan klik tombol *PILIH HASIL PENCARIAN* di bawah untuk melihat rincian & streaming.`;
      const topPoster = searchList[0]?.poster || null;
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, botFooter, buttons, {
          image: topPoster,
          quoted: quotedMsg
        });
      } else {
        await sock.sendMessage(ctx.id, {
          image: topPoster ? {
            url: topPoster
          } : undefined,
          caption: bodyText
        }, {
          quoted: quotedMsg
        });
      }
      if (typeof ctx.react === "function") await ctx.react("✅");
    } catch (error) {
      console.error("[JuraganFilm Error]:", error?.message || error);
      if (typeof ctx.react === "function") await ctx.react("❌");
      let errMsg = error.message;
      if (error.response?.data) {
        try {
          const parsed = typeof error.response.data === "string" ? JSON.parse(error.response.data) : error.response.data;
          errMsg = parsed.message || parsed.error || parsed.result || errMsg;
        } catch {}
      }
      ctx.reply(`❌ Terjadi kesalahan pada JuraganFilm: ${errMsg}`);
    }
  }
};