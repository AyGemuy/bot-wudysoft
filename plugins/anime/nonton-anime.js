import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const CONFIG = {
  API_URL: `${global.bot?.api?.wudysoft}/api/anime/nonton-anime/v1`,
  TIMEOUT: 45e3,
  EPISODES_PER_PAGE: 15
};
const naCache = new Map();

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /(?:--|-)([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1].toLowerCase();
    let rawVal = match[2];
    let val = true;
    if (["detail", "d", "anime", "url", "link"].includes(key)) key = "detail";
    if (["stream", "episode", "ep", "e", "play"].includes(key)) key = "stream";
    if (["search", "s", "query", "q"].includes(key)) key = "search";
    if (["ongoing", "on", "og"].includes(key)) key = "ongoing";
    if (["schedule", "jadwal"].includes(key)) key = "schedule";
    if (["popular", "pop", "top"].includes(key)) key = "popular";
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
  if (!flags.detail && !flags.stream) {
    const epMatch = cleanPrompt.match(/https?:\/\/[^\s]*nontonanimeid\.[^\s]+\/episode\/[^\s]+/i);
    const animeMatch = cleanPrompt.match(/https?:\/\/[^\s]*nontonanimeid\.[^\s]+\/anime\/[^\s]+/i);
    if (epMatch) {
      flags.stream = epMatch[0];
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
  name: "nontonanime",
  aliases: ["naid", "nontonanimeid", "na"],
  description: "Cari anime, tonton streaming, download episode & cek jadwal dari NontonAnimeID",
  category: "Anime",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["nontonanime", "naid", "nontonanimeid", "na"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • NontonAnimeID`;
      const userName = ctx.pushname || (ctx.sender ? ctx.sender.split("@")[0] : "User");
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      if (!rawText && !cleanPrompt && Object.keys(flags).length === 0) {
        return ctx.reply(`–  *N O N T O N  A N I M E  I D*

Layanan streaming & unduh anime Subtitle Indonesia terlengkap.

┌  ◦  *Pencarian* : \`${prefix}nontonanime <judul anime>\`
│  ◦  *Detail*    : \`${prefix}nontonanime -d <url-anime>\`
│  ◦  *Nonton Ep* : \`${prefix}nontonanime -e <url-episode>\`
│  ◦  *Ongoing*   : \`${prefix}nontonanime --ongoing\`
└  ◦  *Jadwal*    : \`${prefix}nontonanime --schedule\`

–  *F L A G S*

┌  ◦  \`--search, -s\`   : Cari judul anime tertentu
├  ◦  \`--detail, -d\`   : Info anime & daftar episode
├  ◦  \`--stream, -e\`   : Tonton video & tautan unduhan
├  ◦  \`--ongoing, -og\` : Anime yang sedang tayang
├  ◦  \`--schedule\`     : Kalender jadwal rilis mingguan
└  ◦  \`--page, -p\`     : Nomor halaman`);
      }
      if (typeof ctx.react === "function") await ctx.react("⏳");
      if (flags.stream) {
        const targetUrl = String(flags.stream).trim();
        const {
          data
        } = await axios.get(CONFIG.API_URL, {
          params: {
            action: "stream",
            url: targetUrl
          },
          timeout: CONFIG.TIMEOUT
        });
        const res = data?.result;
        if (!data?.status || !res || typeof res === "string") {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply("❌ Gagal memuat episode anime. Tautan mungkin tidak valid atau kedaluwarsa.");
        }
        const buttons = [];
        if (res.default_video_url && res.default_video_url.startsWith("http")) {
          buttons.push({
            name: "cta_url",
            buttonParamsJson: JSON.stringify({
              display_text: "▶️ Putar Video Player",
              url: res.default_video_url,
              merchant_url: res.default_video_url
            })
          });
        }
        if (res.prev_episode_link) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "⬅️ Episode Sebelumnya",
              id: `${prefix}nontonanime -e ${res.prev_episode_link}`
            })
          });
        }
        if (res.next_episode_link) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "➡️ Episode Selanjutnya",
              id: `${prefix}nontonanime -e ${res.next_episode_link}`
            })
          });
        }
        if (res.anime_link) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "📋 Daftar Semua Episode",
              id: `${prefix}nontonanime -d ${res.anime_link}`
            })
          });
        }
        const downloadRows = [];
        (res.download_links || []).forEach(group => {
          (group.links || []).forEach(linkObj => {
            if (downloadRows.length < 20) {
              downloadRows.push({
                title: `📥 [${group.format}] ${linkObj.label.slice(0, 15)}`,
                id: `.shorturl ${linkObj.url}`,
                description: `Format: ${group.format} | Server: ${linkObj.label}`
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
                title: "SERVER & RESOLUSI",
                rows: downloadRows
              }]
            })
          });
        }
        const bodyText = `–  *N O N T O N  A N I M E  E P I S O D E*

┌  ◦  *Judul* : ${res.title || "-"}
│  ◦  *Anime* : ${res.anime_title || "-"}
│  ◦  *Server Video* : ${res.video_servers?.length || 1} Server
└  ◦  *Link Download* : ${downloadRows.length} Mirror

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
        const cached = naCache.get(targetUrl);
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
          if (!data?.status || !data?.result || typeof data.result === "string") {
            if (typeof ctx.react === "function") await ctx.react("❌");
            return ctx.reply("❌ Detail anime tidak ditemukan.");
          }
          anime = data.result;
          naCache.set(targetUrl, anime);
        }
        const allEpisodes = anime.episodes || [];
        const totalEp = allEpisodes.length;
        const page = Number(flags.page) || 1;
        const itemsPerPage = CONFIG.EPISODES_PER_PAGE;
        const totalPages = Math.ceil(totalEp / itemsPerPage) || 1;
        const startIndex = (page - 1) * itemsPerPage;
        const pagedEpisodes = allEpisodes.slice(startIndex, startIndex + itemsPerPage);
        const buttons = [];
        if (pagedEpisodes.length > 0) {
          const epRows = pagedEpisodes.map(ep => ({
            title: `🎬 ${ep.title.slice(0, 24)}`,
            id: `${prefix}nontonanime -e ${ep.link}`,
            description: `Rilis: ${ep.date || "-"}`
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
              display_text: "⚡ Tonton Episode Terbaru",
              id: `${prefix}nontonanime -e ${allEpisodes[0].link}`
            })
          });
        }
        if (anime.trailer && anime.trailer.startsWith("http")) {
          buttons.push({
            name: "cta_url",
            buttonParamsJson: JSON.stringify({
              display_text: "▶️ Tonton Trailer",
              url: anime.trailer,
              merchant_url: anime.trailer
            })
          });
        }
        const genres = Array.isArray(anime.genres) ? anime.genres.map(g => g.name).join(", ") : "-";
        const bodyText = `–  *N O N T O N  A N I M E  D E T A I L*

┌  ◦  *Judul* : ${anime.title}
│  ◦  *Skor* : ⭐ ${anime.score || "-"}
│  ◦  *Tipe* : ${anime.type || "TV Series"}
│  ◦  *Status* : ${anime.status || "-"}
│  ◦  *Total Episode* : ${anime.total_episodes || totalEp}
│  ◦  *Durasi* : ${anime.episode_duration || "-"}
│  ◦  *Musim* : ${anime.season || "-"}
└  ◦  *Genre* : ${genres}

–  *S I N O P S I S*
${anime.synopsis ? anime.synopsis.length > 350 ? anime.synopsis.slice(0, 350) + "..." : anime.synopsis : "Tidak ada ringkasan cerita."}

Klik tombol *PILIH EPISODE UNTUK NONTON* di bawah untuk mulai memutar video!`;
        const posterImage = anime.poster || null;
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
      if (flags.ongoing) {
        const page = Number(flags.page) || 1;
        const {
          data
        } = await axios.get(CONFIG.API_URL, {
          params: {
            action: "ongoing",
            page: page
          },
          timeout: CONFIG.TIMEOUT
        });
        const list = Array.isArray(data?.result) ? data.result : [];
        if (!data?.status || list.length === 0) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply("❌ Tidak ada data anime ongoing saat ini.");
        }
        const rows = list.slice(0, CONFIG.ITEMS_PER_PAGE).map((item, idx) => ({
          title: `[#${idx + 1}] ${item.title.slice(0, 24)}`,
          id: `${prefix}nontonanime -d ${item.link}`,
          description: `Episode: ${item.current_episode || "-"} | Skor: ⭐ ${item.rating || "-"}`
        }));
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "🔥 PILIH ANIME ONGOING",
            sections: [{
              title: `SEDANG TAYANG (Halaman ${page})`,
              rows: rows
            }]
          })
        }];
        if (page > 1) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: `⬅️ Hal ${page - 1}`,
              id: `${prefix}nontonanime --ongoing -p ${page - 1}`
            })
          });
        }
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `➡️ Hal ${page + 1}`,
            id: `${prefix}nontonanime --ongoing -p ${page + 1}`
          })
        });
        const bodyText = `–  *A N I M E  O N G O I N G*

Berikut daftar anime yang sedang tayang (Halaman ${page}).
Klik tombol di bawah untuk melihat rincian serta daftar episode.`;
        const topImage = list[0]?.image || null;
        if (typeof ctx.sendCta === "function") {
          await ctx.sendCta(bodyText, botFooter, buttons, {
            image: topImage,
            quoted: quotedMsg
          });
        } else {
          await sock.sendMessage(ctx.id, {
            image: topImage ? {
              url: topImage
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
        const calendar = data?.result?.kalender_rilis;
        if (!data?.status || !calendar) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply("❌ Gagal memuat jadwal rilis anime.");
        }
        const sections = [];
        Object.entries(calendar).forEach(([day, val]) => {
          const series = val?.series || [];
          if (series.length > 0) {
            const rows = series.slice(0, 10).map(s => ({
              title: `📺 ${s.title.slice(0, 24)}`,
              id: `${prefix}nontonanime -d ${s.link}`,
              description: `Jam: ${s.time || "-"} | Episode: ${s.episode || "-"}`
            }));
            sections.push({
              title: `🗓️ ${day.toUpperCase()} (${val.date_text || ""})`,
              rows: rows
            });
          }
        });
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "📅 LIHAT JADWAL HARI INI",
            sections: sections
          })
        }];
        const bodyText = `–  *J A D W A L  R I L I S  A N I M E*

Jadwal pembaruan episode anime mingguan di NontonAnimeID.
Silakan klik tombol di bawah untuk memilih anime berdasarkan hari tayang!`;
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
      const querySearch = flags.search ? String(flags.search).trim() : cleanPrompt;
      if (!querySearch) {
        if (typeof ctx.react === "function") await ctx.react("❌");
        return ctx.reply(`❌ Masukkan judul anime yang ingin dicari!\nContoh: \`${prefix}nontonanime one piece\``);
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
        return ctx.reply(`❌ Anime dengan judul "${querySearch}" tidak ditemukan.`);
      }
      const rows = searchList.slice(0, CONFIG.ITEMS_PER_PAGE).map((item, idx) => ({
        title: `[#${idx + 1}] ${item.title.slice(0, 24)}`,
        id: `${prefix}nontonanime -d ${item.link}`,
        description: `⭐ ${item.rating || "-"} | ${item.type || "Anime"} | ${item.season || ""}`
      }));
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: "📂 PILIH HASIL PENCARIAN",
          sections: [{
            title: `🔎 Hasil: "${querySearch}" (Halaman ${page})`,
            rows: rows
          }]
        })
      }];
      if (page > 1) {
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `⬅️ Hal ${page - 1}`,
            id: `${prefix}nontonanime "${querySearch}" -p ${page - 1}`
          })
        });
      }
      if (searchList.length >= CONFIG.ITEMS_PER_PAGE) {
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `➡️ Hal ${page + 1}`,
            id: `${prefix}nontonanime "${querySearch}" -p ${page + 1}`
          })
        });
      }
      const bodyText = `Hi ${userName}!
Ditemukan *${searchList.length}* judul anime untuk kata kunci: \`${querySearch}\`.

–  *H A S I L  P E N C A R I A N*

Silakan klik tombol *PILIH HASIL PENCARIAN* di bawah untuk melihat rincian & streaming.`;
      const topImage = searchList[0]?.image || null;
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, botFooter, buttons, {
          image: topImage,
          quoted: quotedMsg
        });
      } else {
        await sock.sendMessage(ctx.id, {
          image: topImage ? {
            url: topImage
          } : undefined,
          caption: bodyText
        }, {
          quoted: quotedMsg
        });
      }
      if (typeof ctx.react === "function") await ctx.react("✅");
    } catch (error) {
      console.error("[NontonAnime Error]:", error?.message || error);
      if (typeof ctx.react === "function") await ctx.react("❌");
      let errMsg = error.message;
      if (error.response?.data) {
        try {
          const parsed = typeof error.response.data === "string" ? JSON.parse(error.response.data) : error.response.data;
          errMsg = parsed.message || parsed.error || errMsg;
        } catch {}
      }
      ctx.reply(`❌ Terjadi kesalahan pada NontonAnime: ${errMsg}`);
    }
  }
};