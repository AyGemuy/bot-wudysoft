import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const CONFIG = {
  API_URL: `${global.bot?.api?.wudysoft}/api/anime/samehadaku/v3`,
  TIMEOUT: 45e3,
  EPISODES_PER_PAGE: 15
};
const samehadaCache = new Map();

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /(?:--|-)([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1].toLowerCase();
    let rawVal = match[2];
    let val = true;
    if (["detail", "d", "anime", "url", "link"].includes(key)) key = "detail";
    if (["episode", "ep", "e", "download", "dl", "stream", "play"].includes(key)) key = "episode";
    if (["search", "s", "query", "q"].includes(key)) key = "search";
    if (["schedule", "jadwal"].includes(key)) key = "schedule";
    if (["latest", "updates", "l"].includes(key)) key = "latest";
    if (["top", "top10", "pop", "popular"].includes(key)) key = "top";
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
  if (!flags.detail && !flags.episode) {
    const epMatch = cleanPrompt.match(/https?:\/\/[^\s]*samehadaku\.[^\s]+\/[^\s]*episode[^\s]*/i);
    const animeMatch = cleanPrompt.match(/https?:\/\/[^\s]*samehadaku\.[^\s]+\/anime\/[^\s]+/i);
    if (epMatch) {
      flags.episode = epMatch[0];
    } else if (animeMatch) {
      flags.detail = animeMatch[0];
    }
  }
  return {
    flags: flags,
    cleanPrompt: cleanPrompt
  };
}
export default {
  name: "samehadaku",
  aliases: ["samehada", "smhd", "same"],
  description: "Cari anime, tonton streaming, download episode & cek jadwal dari Samehadaku",
  category: "Anime",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["samehadaku", "samehada", "smhd", "same"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • Samehadaku`;
      const userName = ctx.pushname || (ctx.sender ? ctx.sender.split("@")[0] : "User");
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      if (!rawText && !cleanPrompt && Object.keys(flags).length === 0) {
        return ctx.reply(`–  *S A M E H A D A K U*

Layanan streaming & unduh anime Subtitle Indonesia terlengkap dan terupdate.

┌  ◦  *Pencarian* : \`${prefix}samehadaku <judul anime>\`
│  ◦  *Detail*    : \`${prefix}samehadaku -d <url-anime>\`
│  ◦  *Nonton Ep* : \`${prefix}samehadaku -e <url-episode>\`
│  ◦  *Terbaru*   : \`${prefix}samehadaku --latest\`
│  ◦  *Top 10*    : \`${prefix}samehadaku --top\`
└  ◦  *Jadwal*    : \`${prefix}samehadaku --schedule\`

–  *F L A G S*

┌  ◦  \`--search, -s\`   : Cari judul anime tertentu
├  ◦  \`--detail, -d\`   : Info anime & daftar episode
├  ◦  \`--episode, -e\`  : Pemutar video & mirror unduhan
├  ◦  \`--schedule\`     : Jadwal rilis mingguan
├  ◦  \`--top\`          : Top 10 anime terpopuler
└  ◦  \`--latest, -l\`   : Episode anime yang baru rilis`);
      }
      if (typeof ctx.react === "function") await ctx.react("⏳");
      if (flags.episode) {
        const targetUrl = String(flags.episode).trim();
        const {
          data
        } = await axios.get(CONFIG.API_URL, {
          params: {
            action: "download",
            url: targetUrl
          },
          timeout: CONFIG.TIMEOUT
        });
        const res = data?.data;
        if (!data?.ok || !res) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply(`❌ Gagal: ${data?.error || "Episode anime tidak ditemukan atau tautan kedaluwarsa."}`);
        }
        const buttons = [];
        if (res.playerEmbedUrl && res.playerEmbedUrl.startsWith("http")) {
          buttons.push({
            name: "cta_url",
            buttonParamsJson: JSON.stringify({
              display_text: "▶️ Putar Video Player",
              url: res.playerEmbedUrl,
              merchant_url: res.playerEmbedUrl
            })
          });
        }
        if (res.navigation?.prevUrl) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "⬅️ Episode Sebelumnya",
              id: `${prefix}samehadaku -e ${res.navigation.prevUrl}`
            })
          });
        }
        if (res.navigation?.nextUrl) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "➡️ Episode Selanjutnya",
              id: `${prefix}samehadaku -e ${res.navigation.nextUrl}`
            })
          });
        }
        if (res.navigation?.allEpisodesUrl) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "📋 Semua Episode",
              id: `${prefix}samehadaku -d ${res.navigation.allEpisodesUrl}`
            })
          });
        }
        const downloadRows = [];
        (res.downloadLinks || []).forEach(group => {
          (group.mirrors || []).forEach(m => {
            if (downloadRows.length < 20) {
              downloadRows.push({
                title: `📥 [${group.quality}] ${m.host.slice(0, 15)}`,
                id: `.shorturl ${m.url}`,
                description: `Kualitas: ${group.quality} | Server: ${m.host}`
              });
            }
          });
        });
        if (downloadRows.length > 0) {
          buttons.push({
            name: "single_select",
            buttonParamsJson: JSON.stringify({
              title: "📥 DOWNLOAD EPISODE INI",
              sections: [{
                title: "PILIH SERVER & RESOLUSI",
                rows: downloadRows
              }]
            })
          });
        }
        const bodyText = `–  *S A M E H A D A K U  E P I S O D E*

┌  ◦  *Judul* : ${res.title || "-"}
│  ◦  *Anime* : ${res.animeTitle || "-"}
│  ◦  *Episode* : ${res.episodeNumber || "Terbaru"}
│  ◦  *Rilis* : ${res.releaseTime || "-"}
└  ◦  *Mirror Unduhan* : ${downloadRows.length} Link

Klik *Putar Video Player* untuk menonton streaming atau pilih link download melalui menu di bawah.`;
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
        const targetUrl = String(flags.detail).trim();
        let anime = null;
        const cached = samehadaCache.get(targetUrl);
        if (cached) {
          anime = cached;
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
          if (!data?.ok || !data?.data) {
            if (typeof ctx.react === "function") await ctx.react("❌");
            return ctx.reply(`❌ Gagal: ${data?.error || "Detail anime tidak ditemukan."}`);
          }
          anime = data.data;
          samehadaCache.set(targetUrl, anime);
        }
        const allEpisodes = anime.episodes || [];
        const totalEp = anime.totalEpisodes || allEpisodes.length;
        const page = Number(flags.page) || 1;
        const itemsPerPage = CONFIG.EPISODES_PER_PAGE;
        const totalPages = Math.ceil(totalEp / itemsPerPage) || 1;
        const startIndex = (page - 1) * itemsPerPage;
        const pagedEpisodes = allEpisodes.slice(startIndex, startIndex + itemsPerPage);
        const buttons = [];
        if (pagedEpisodes.length > 0) {
          const epRows = pagedEpisodes.map(ep => ({
            title: `🎬 ${ep.title.slice(0, 24)}`,
            id: `${prefix}samehadaku -e ${ep.url}`,
            description: `Rilis: ${ep.releaseDate || "-"} | Nomor: ${ep.number || "-"}`
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
        if (allEpisodes[0]?.url) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "⚡ Tonton Episode 1",
              id: `${prefix}samehadaku -e ${allEpisodes[0].url}`
            })
          });
        }
        if (allEpisodes[allEpisodes.length - 1]?.url && allEpisodes.length > 1) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "🔥 Episode Paling Baru",
              id: `${prefix}samehadaku -e ${allEpisodes[allEpisodes.length - 1].url}`
            })
          });
        }
        const genres = Array.isArray(anime.genres) ? anime.genres.map(g => g.name).join(", ") : "-";
        const metaStatus = typeof anime.details?.status === "string" ? anime.details.status : "-";
        const metaType = typeof anime.details?.type === "string" ? anime.details.type : "TV";
        const metaSeason = typeof anime.details?.season === "string" ? anime.details.season : "-";
        const bodyText = `–  *S A M E H A D A K U  D E T A I L*

┌  ◦  *Judul* : ${anime.title}
│  ◦  *Skor* : ⭐ ${anime.rating || "-"} (${anime.ratingCount || 0} Votes)
│  ◦  *Tipe* : ${metaType}
│  ◦  *Status* : ${metaStatus}
│  ◦  *Musim* : ${metaSeason}
│  ◦  *Total Episode* : ${totalEp} Episode
└  ◦  *Genre* : ${genres}

–  *S I N O P S I S*
${anime.synopsis ? anime.synopsis.length > 350 ? anime.synopsis.slice(0, 350) + "..." : anime.synopsis : "Tidak ada ringkasan sinopsis."}

Klik tombol *PILIH EPISODE UNTUK NONTON* di bawah untuk mulai streaming & unduh!`;
        const posterImage = anime.thumbnail || null;
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
      if (flags.schedule) {
        const {
          data
        } = await axios.get(CONFIG.API_URL, {
          params: {
            action: "schedule"
          },
          timeout: CONFIG.TIMEOUT
        });
        const schedules = data?.data?.schedule || [];
        if (!data?.ok || schedules.length === 0) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply("❌ Gagal memuat jadwal rilis anime Samehadaku.");
        }
        const rows = schedules.slice(0, 20).map((item, idx) => ({
          title: `[#${idx + 1}] ${item.title.slice(0, 24)}`,
          id: `${prefix}samehadaku -d ${item.url}`,
          description: `Jam: ${item.releaseTime || "-"} | ⭐ ${item.score || "-"} | ${item.genre || ""}`
        }));
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "📅 PILIH ANIME DARI JADWAL",
            sections: [{
              title: `🔥 JADWAL RILIS (${schedules.length} Anime)`,
              rows: rows
            }]
          })
        }];
        const bodyText = `–  *S A M E H A D A K U  J A D W A L*

Jadwal rilis episode anime terbaru di Samehadaku.
Silakan klik tombol *PILIH ANIME DARI JADWAL* di bawah untuk melihat rincian anime!`;
        const topThumbnail = schedules[0]?.thumbnail || null;
        if (typeof ctx.sendCta === "function") {
          await ctx.sendCta(bodyText, botFooter, buttons, {
            image: topThumbnail,
            quoted: quotedMsg
          });
        } else {
          await sock.sendMessage(ctx.id, {
            image: topThumbnail ? {
              url: topThumbnail
            } : undefined,
            caption: bodyText
          }, {
            quoted: quotedMsg
          });
        }
        if (typeof ctx.react === "function") await ctx.react("✅");
        return;
      }
      if (flags.top || flags.latest) {
        const {
          data
        } = await axios.get(CONFIG.API_URL, {
          params: {
            action: "home"
          },
          timeout: CONFIG.TIMEOUT
        });
        if (!data?.ok || !data?.data) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply("❌ Gagal mengambil katalog beranda Samehadaku.");
        }
        const isTop = Boolean(flags.top);
        const list = isTop ? data.data.top10 || [] : data.data.latestAnime || [];
        const label = isTop ? "TOP 10 ANIME POPULER" : "EPISODE TERBARU (LATEST)";
        if (list.length === 0) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply(`❌ Tidak ada anime pada kategori ${label}.`);
        }
        const rows = list.slice(0, 15).map((item, idx) => ({
          title: `[#${item.rank || idx + 1}] ${item.title.slice(0, 24)}`,
          id: item.episode ? `${prefix}samehadaku -e ${item.url}` : `${prefix}samehadaku -d ${item.url}`,
          description: item.episode ? `Episode: ${item.episode} | ${item.releasedOn || ""}` : `Rating: ⭐ ${item.rating || "-"}`
        }));
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: `📂 DAFTAR ${label}`,
            sections: [{
              title: `🔥 SAMEHADAKU (${label})`,
              rows: rows
            }]
          })
        }];
        const bodyText = `–  *S A M E H A D A K U  ${label}*

Berikut daftar anime pada kategori ${label}.
Klik tombol di bawah untuk melihat rincian serta memutar episode!`;
        const topThumbnail = list[0]?.thumbnail || null;
        if (typeof ctx.sendCta === "function") {
          await ctx.sendCta(bodyText, botFooter, buttons, {
            image: topThumbnail,
            quoted: quotedMsg
          });
        } else {
          await sock.sendMessage(ctx.id, {
            image: topThumbnail ? {
              url: topThumbnail
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
        return ctx.reply(`❌ Masukkan judul anime yang ingin dicari!\nContoh: \`${prefix}samehadaku bleach\``);
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
      const searchList = data?.data || [];
      if (!data?.ok || searchList.length === 0) {
        if (typeof ctx.react === "function") await ctx.react("❌");
        return ctx.reply(`❌ Anime dengan kata kunci "${querySearch}" tidak ditemukan.`);
      }
      const rows = searchList.slice(0, CONFIG.ITEMS_PER_PAGE).map((item, idx) => ({
        title: `[#${idx + 1}] ${item.title.slice(0, 24)}`,
        id: `${prefix}samehadaku -d ${item.url}`,
        description: `⭐ ${item.score || "-"} | ${item.type || "Anime"} | Status: ${item.status || "-"}`
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
      const bodyText = `Hi ${userName}!
Ditemukan *${searchList.length}* judul anime untuk kata kunci: \`${querySearch}\`.

–  *H A S I L  P E N C A R I A N*

Silakan klik tombol *PILIH HASIL PENCARIAN* di bawah untuk melihat rincian & streaming.`;
      const topThumb = searchList[0]?.thumbnail || null;
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
      console.error("[Samehadaku Error]:", error?.message || error);
      if (typeof ctx.react === "function") await ctx.react("❌");
      let errMsg = error.message;
      if (error.response?.data) {
        try {
          const parsed = typeof error.response.data === "string" ? JSON.parse(error.response.data) : error.response.data;
          errMsg = parsed.error || parsed.message || errMsg;
        } catch {}
      }
      ctx.reply(`❌ Terjadi kesalahan pada Samehadaku: ${errMsg}`);
    }
  }
};