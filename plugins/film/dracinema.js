import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const CONFIG = {
  API_URL: `${global.bot?.api?.wudysoft}/api/film/dracinema`,
  TIMEOUT: 45e3,
  EPISODES_PER_PAGE: 15
};
const draciCache = new Map();

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /(?:--|-)([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1].toLowerCase();
    let rawVal = match[2];
    let val = true;
    if (["detail", "d", "movie"].includes(key)) key = "detail";
    if (["play", "p", "chapter", "ep", "stream"].includes(key)) key = "play";
    if (["search", "s", "query", "q"].includes(key)) key = "search";
    if (["popular", "pop", "top"].includes(key)) key = "popular";
    if (["category", "cat", "genre"].includes(key)) key = "category";
    if (["page", "pg"].includes(key)) key = "page";
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
  if (!flags.detail && !flags.play) {
    const playMatch = cleanPrompt.match(/https?:\/\/[^\s]*dracinema\.com\/play\/[^\s]+/i);
    const movieMatch = cleanPrompt.match(/https?:\/\/[^\s]*dracinema\.com\/movie\/[^\s]+/i);
    if (playMatch) {
      flags.play = playMatch[0];
    } else if (movieMatch) {
      flags.detail = movieMatch[0];
    }
  }
  return {
    flags: flags,
    cleanPrompt: cleanPrompt
  };
}
export default {
  name: "dracinema",
  aliases: ["draci", "dracin", "dramabox", "shortdrama"],
  description: "Cari, lihat daftar episode, dan streaming Drama Asia/Short Drama dari Dracinema",
  category: "Film",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["dracinema", "draci", "dracin", "dramabox", "shortdrama"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • Dracinema`;
      const userName = ctx.pushname || (ctx.sender ? ctx.sender.split("@")[0] : "User");
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      if (!rawText && !cleanPrompt && Object.keys(flags).length === 0) {
        return ctx.reply(`–  *D R A C I N E M A*

Layanan streaming Drama Pendek (Short Drama) & Drama Asia Subtitle Indonesia.

┌  ◦  *Pencarian* : \`${prefix}dracinema <judul drama>\`
│  ◦  *Detail*    : \`${prefix}dracinema -d <url/movie-path>\`
│  ◦  *Streaming* : \`${prefix}dracinema -p <url/play-path>\`
│  ◦  *Populer*   : \`${prefix}dracinema --popular\`
└  ◦  *Kategori*  : \`${prefix}dracinema --category <tipe>\`

–  *F L A G S*

┌  ◦  \`--search, -s\`   : Cari judul drama tertentu
├  ◦  \`--detail, -d\`   : Lihat sinopsis & daftar episode
├  ◦  \`--play, -p\`     : Tonton / streaming episode
├  ◦  \`--popular\`      : Drama terpopuler saat ini
└  ◦  \`--category\`     : Filter drama berdasarkan kategori`);
      }
      if (typeof ctx.react === "function") await ctx.react("⏳");
      if (flags.play) {
        const playUrl = String(flags.play).trim();
        const {
          data
        } = await axios.get(CONFIG.API_URL, {
          params: {
            action: "chapter",
            url: playUrl
          },
          timeout: CONFIG.TIMEOUT
        });
        const res = data?.result;
        if (!data?.status || !res) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply("❌ Gagal memuat video episode atau tautan kedaluwarsa.");
        }
        const streams = res.streams || [];
        const episodes = res.episodes || [];
        const topStream = streams[0] || null;
        const currentNum = parseInt(res.current_episode?.replace(/\D/g, "") || "1", 10);
        const nextEp = episodes.find(e => e.episode === currentNum + 1);
        const prevEp = episodes.find(e => e.episode === currentNum - 1);
        const buttons = [];
        if (topStream?.video_url) {
          buttons.push({
            name: "cta_url",
            buttonParamsJson: JSON.stringify({
              display_text: `▶️ Putar Video (${topStream.quality || "HD"})`,
              url: topStream.video_url,
              merchant_url: topStream.video_url
            })
          });
        }
        if (prevEp?.link) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: `⬅️ Episode ${prevEp.episode}`,
              id: `${prefix}dracinema -p ${prevEp.link}`
            })
          });
        }
        if (nextEp?.link) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: `➡️ Episode ${nextEp.episode}`,
              id: `${prefix}dracinema -p ${nextEp.link}`
            })
          });
        }
        if (episodes.length > 0) {
          const epRows = episodes.slice(0, 20).map(ep => ({
            title: `🎬 Episode ${ep.episode}`,
            id: `${prefix}dracinema -p ${ep.link}`,
            description: ep.is_active ? "• Sedang Ditonton •" : ep.title || `Episode ${ep.episode}`
          }));
          buttons.push({
            name: "single_select",
            buttonParamsJson: JSON.stringify({
              title: "📂 PILIH EPISODE LAIN",
              sections: [{
                title: "DAFTAR EPISODE",
                rows: epRows
              }]
            })
          });
        }
        const qualitiesText = streams.map(s => `\`${s.quality}\``).join(", ") || "Default";
        const bodyText = `–  *D R A C I N E M A  P L A Y E R*

┌  ◦  *Judul* : ${res.series_title || "-"}
│  ◦  *Episode* : ${res.current_episode || "-"}
│  ◦  *Kualitas* : ${qualitiesText}
└  ◦  *Total Episode* : ${episodes.length}

–  *S I N O P S I S*
${res.synopsis ? res.synopsis.length > 250 ? res.synopsis.slice(0, 250) + "..." : res.synopsis : "Tidak ada sinopsis."}

Gunakan tombol di bawah untuk memutar video atau berpindah episode.`;
        if (typeof ctx.sendCta === "function") {
          await ctx.sendCta(bodyText, botFooter, buttons, {
            quoted: quotedMsg
          });
        } else {
          await ctx.reply(bodyText, {
            quoted: quotedMsg
          });
        }
        if (typeof ctx.react === "function") await ctx.react("✅");
        return;
      }
      if (flags.detail) {
        const detailUrl = String(flags.detail).trim();
        let drama = null;
        const cached = draciCache.get(detailUrl);
        if (cached) {
          drama = cached;
        } else {
          const {
            data
          } = await axios.get(CONFIG.API_URL, {
            params: {
              action: "detail",
              url: detailUrl
            },
            timeout: CONFIG.TIMEOUT
          });
          if (!data?.status || !data?.result) {
            if (typeof ctx.react === "function") await ctx.react("❌");
            return ctx.reply("❌ Detail drama tidak ditemukan.");
          }
          drama = data.result;
          draciCache.set(detailUrl, drama);
        }
        const allEpisodes = drama.episodes || [];
        const totalEp = drama.total_episodes || allEpisodes.length;
        const page = Number(flags.page) || 1;
        const itemsPerPage = CONFIG.EPISODES_PER_PAGE;
        const totalPages = Math.ceil(allEpisodes.length / itemsPerPage) || 1;
        const startIndex = (page - 1) * itemsPerPage;
        const pagedEpisodes = allEpisodes.slice(startIndex, startIndex + itemsPerPage);
        const buttons = [];
        if (pagedEpisodes.length > 0) {
          const epRows = pagedEpisodes.map(ep => ({
            title: `🎬 ${ep.episode}`,
            id: `${prefix}dracinema -p ${ep.link}`,
            description: ep.title ? ep.title.slice(0, 30) : `Tonton ${ep.episode}`
          }));
          buttons.push({
            name: "single_select",
            buttonParamsJson: JSON.stringify({
              title: "▶️ PILIH EPISODE UNTUK NONTON",
              sections: [{
                title: `DAFTAR EPISODE (Hal ${page}/${totalPages} • Total: ${totalEp})`,
                rows: epRows
              }]
            })
          });
        }
        if (allEpisodes[0]?.link) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "⚡ Tonton Episode 1",
              id: `${prefix}dracinema -p ${allEpisodes[0].link}`
            })
          });
        }
        const genres = Array.isArray(drama.genres) ? drama.genres.join(", ") : "-";
        const bodyText = `–  *D R A C I N E M A  D E T A I L*

┌  ◦  *Judul* : ${drama.title}
│  ◦  *Total Episode* : ${totalEp} Episode
│  ◦  *Genre* : ${genres}
│  ◦  *Bahasa* : ${drama.metadata?.language?.toUpperCase() || "ID"}
└  ◦  *Rating Usia* : ${drama.metadata?.content_rating || "Semua Umur"}

–  *S I N O P S I S*
${drama.synopsis ? drama.synopsis.length > 350 ? drama.synopsis.slice(0, 350) + "..." : drama.synopsis : "Tidak ada deskripsi."}

Klik tombol *PILIH EPISODE UNTUK NONTON* di bawah untuk mulai streaming!`;
        const posterImage = drama.poster || null;
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
      if (flags.popular) {
        const {
          data
        } = await axios.get(CONFIG.API_URL, {
          params: {
            action: "home"
          },
          timeout: CONFIG.TIMEOUT
        });
        const popularList = data?.result?.popular_dramas || data?.result?.featured_dramas || [];
        if (!data?.status || popularList.length === 0) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply("❌ Tidak dapat memuat daftar drama populer saat ini.");
        }
        const rows = popularList.slice(0, 15).map((item, idx) => ({
          title: `[#${idx + 1}] ${item.title.slice(0, 24)}`,
          id: `${prefix}dracinema -d ${item.url}`,
          description: `Lihat episode & streaming`
        }));
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "🔥 PILIH DRAMA POPULER",
            sections: [{
              title: "DRAMA PILIHAN POPULER",
              rows: rows
            }]
          })
        }];
        const bodyText = `–  *D R A C I N E M A  P O P U L E R*

Berikut daftar drama pendek terpopuler dan paling banyak ditonton.
Silakan klik tombol di bawah untuk melihat rincian serta daftar episodenya.`;
        const topPoster = popularList[0]?.poster || null;
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
        return ctx.reply(`❌ Masukkan judul drama yang ingin dicari!\nContoh: \`${prefix}dracinema bos dingin\``);
      }
      const {
        data
      } = await axios.get(CONFIG.API_URL, {
        params: {
          action: "search",
          query: querySearch
        },
        timeout: CONFIG.TIMEOUT
      });
      const searchList = data?.result || [];
      if (!data?.status || searchList.length === 0) {
        if (typeof ctx.react === "function") await ctx.react("❌");
        return ctx.reply(`❌ Drama dengan judul "${querySearch}" tidak ditemukan.`);
      }
      const rows = searchList.slice(0, 15).map((item, idx) => ({
        title: `[#${idx + 1}] ${item.book_name.slice(0, 24)}`,
        id: `${prefix}dracinema -d ${item.detail_url}`,
        description: `Total: ${item.chapter_count || "-"} Episode | ${item.introduction ? item.introduction.slice(0, 30) : ""}`
      }));
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: "📂 PILIH HASIL DRAMA",
          sections: [{
            title: `🔎 Pencarian: "${querySearch}" (${searchList.length} Ditemukan)`,
            rows: rows
          }]
        })
      }];
      const bodyText = `Hi ${userName}!
Ditemukan *${searchList.length}* drama untuk kata kunci: \`${querySearch}\`.

–  *H A S I L  P E N C A R I A N*

Silakan klik tombol *PILIH HASIL DRAMA* di bawah untuk melihat detail episode & streaming.`;
      const topCover = searchList[0]?.cover || null;
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, botFooter, buttons, {
          image: topCover,
          quoted: quotedMsg
        });
      } else {
        await sock.sendMessage(ctx.id, {
          image: topCover ? {
            url: topCover
          } : undefined,
          caption: bodyText
        }, {
          quoted: quotedMsg
        });
      }
      if (typeof ctx.react === "function") await ctx.react("✅");
    } catch (error) {
      console.error("[Dracinema Error]:", error?.message || error);
      if (typeof ctx.react === "function") await ctx.react("❌");
      let errMsg = error.message;
      if (error.response?.data) {
        try {
          const parsed = typeof error.response.data === "string" ? JSON.parse(error.response.data) : error.response.data;
          errMsg = parsed.message || parsed.error || errMsg;
        } catch {}
      }
      ctx.reply(`❌ Terjadi kesalahan pada Dracinema: ${errMsg}`);
    }
  }
};