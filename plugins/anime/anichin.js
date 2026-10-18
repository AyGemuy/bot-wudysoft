import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const CONFIG = {
  API_URL: `${global.bot?.api?.wudysoft}/api/anime/anichin/v1`,
  TIMEOUT: 45e3,
  EPISODES_PER_PAGE: 15
};
const anichinCache = new Map();

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /(?:--|-)([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1].toLowerCase();
    let rawVal = match[2];
    let val = true;
    if (["detail", "d", "slug", "donghua"].includes(key)) key = "detail";
    if (["episode", "ep", "e", "stream", "play"].includes(key)) key = "episode";
    if (["search", "s", "query", "q"].includes(key)) key = "search";
    if (["schedule", "jadwal"].includes(key)) key = "schedule";
    if (["popular", "pop", "top"].includes(key)) key = "popular";
    if (["latest", "updates", "l"].includes(key)) key = "latest";
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
    const epMatch = cleanPrompt.match(/https?:\/\/[^\s]*anichin\.[^\s]+\/[^\s]*episode[^\s]*/i);
    const detailMatch = cleanPrompt.match(/https?:\/\/[^\s]*anichin\.[^\s]+\/[^\s]+/i);
    if (epMatch) {
      flags.episode = epMatch[0];
    } else if (detailMatch) {
      flags.detail = detailMatch[0];
    }
  }
  return {
    flags: flags,
    cleanPrompt: cleanPrompt
  };
}
export default {
  name: "anichin",
  aliases: ["donghua", "achin", "anichinmoe"],
  description: "Streaming & unduh Donghua (Anime China) Subtitle Indonesia dari Anichin",
  category: "Anime",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["anichin", "donghua", "achin", "anichinmoe"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • Anichin`;
      const userName = ctx.pushname || (ctx.sender ? ctx.sender.split("@")[0] : "User");
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      if (!rawText && !cleanPrompt && Object.keys(flags).length === 0) {
        return ctx.reply(`–  *A N I C H I N  D O N G H U A*

Pusat streaming & download Anime China (Donghua) Subtitle Indonesia.

┌  ◦  *Pencarian* : \`${prefix}anichin <judul donghua>\`
│  ◦  *Detail*    : \`${prefix}anichin -d <slug/url-donghua>\`
│  ◦  *Nonton Ep* : \`${prefix}anichin -e <slug/url-episode>\`
│  ◦  *Jadwal*    : \`${prefix}anichin --schedule\`
│  ◦  *Populer*   : \`${prefix}anichin --popular\`
└  ◦  *Terbaru*   : \`${prefix}anichin --latest\`

–  *F L A G S*

┌  ◦  \`--search, -s\`   : Cari judul donghua
├  ◦  \`--detail, -d\`   : Info detail, genre & list episode
├  ◦  \`--episode, -e\`  : Pemutar video & link unduh episode
├  ◦  \`--schedule\`     : Jadwal rilis mingguan
├  ◦  \`--popular\`      : Donghua terpopuler
├  ◦  \`--latest, -l\`   : Episode baru yang rilis
└  ◦  \`--page, -p\`     : Nomor halaman`);
      }
      if (typeof ctx.react === "function") await ctx.react("⏳");
      if (flags.episode) {
        const epSlug = String(flags.episode).trim();
        const {
          data
        } = await axios.get(CONFIG.API_URL, {
          params: {
            action: "episode",
            slug: epSlug
          },
          timeout: CONFIG.TIMEOUT
        });
        const res = data?.result;
        if (!data?.status || !res) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply("❌ Gagal memuat episode donghua. Tautan mungkin kedaluwarsa.");
        }
        const buttons = [];
        const topEmbed = res.stream_servers?.[0]?.embed_url || res.default_embed;
        if (topEmbed && topEmbed.startsWith("http")) {
          buttons.push({
            name: "cta_url",
            buttonParamsJson: JSON.stringify({
              display_text: `▶️ Putar Video (${res.stream_servers?.[0]?.server_name || "Player"})`,
              url: topEmbed,
              merchant_url: topEmbed
            })
          });
        }
        if (res.navigation?.prev) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "⬅️ Episode Sebelumnya",
              id: `${prefix}anichin -e ${res.navigation.prev}`
            })
          });
        }
        if (res.navigation?.next) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "➡️ Episode Selanjutnya",
              id: `${prefix}anichin -e ${res.navigation.next}`
            })
          });
        }
        const downloadRows = [];
        (res.downloads || []).forEach(dl => {
          (dl.servers || []).forEach(srv => {
            if (downloadRows.length < 20) {
              downloadRows.push({
                title: `📥 [${dl.resolution || "HD"}] ${srv.server.slice(0, 15)}`,
                id: `.shorturl ${srv.url}`,
                description: `Resolusi: ${dl.resolution || "-"} | Server: ${srv.server}`
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
        const sidebar = res.sidebar_episodes || [];
        if (sidebar.length > 0) {
          const epRows = sidebar.slice(0, 15).map(ep => ({
            title: `🎬 ${ep.title ? ep.title.slice(0, 24) : "Episode"}`,
            id: `${prefix}anichin -e ${ep.url}`,
            description: ep.info || "Tonton Episode"
          }));
          buttons.push({
            name: "single_select",
            buttonParamsJson: JSON.stringify({
              title: "📂 PILIH EPISODE LAIN",
              sections: [{
                title: "DAFTAR EPISODE TERSEDIA",
                rows: epRows
              }]
            })
          });
        }
        const bodyText = `–  *A N I C H I N  E P I S O D E*

┌  ◦  *Judul* : ${res.title || "-"}
│  ◦  *Server Tersedia* : ${res.stream_servers?.length || 1} Server
└  ◦  *Total Mirror DL* : ${downloadRows.length} Link

Gunakan tombol *Putar Video* untuk streaming atau pilih opsi di bawah untuk navigasi & download episode.`;
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
        const targetSlug = String(flags.detail).trim();
        let donghua = null;
        const cached = anichinCache.get(targetSlug);
        if (cached) {
          donghua = cached;
        } else {
          const {
            data
          } = await axios.get(CONFIG.API_URL, {
            params: {
              action: "detail",
              slug: targetSlug
            },
            timeout: CONFIG.TIMEOUT
          });
          if (!data?.status || !data?.result) {
            if (typeof ctx.react === "function") await ctx.react("❌");
            return ctx.reply("❌ Gagal memuat rincian donghua. Cek kembali tautan atau slug.");
          }
          donghua = data.result;
          anichinCache.set(targetSlug, donghua);
        }
        const allEpisodes = donghua.episodes || [];
        const totalEp = allEpisodes.length;
        const page = Number(flags.page) || 1;
        const itemsPerPage = CONFIG.EPISODES_PER_PAGE;
        const totalPages = Math.ceil(totalEp / itemsPerPage) || 1;
        const startIndex = (page - 1) * itemsPerPage;
        const pagedEpisodes = allEpisodes.slice(startIndex, startIndex + itemsPerPage);
        const buttons = [];
        if (pagedEpisodes.length > 0) {
          const epRows = pagedEpisodes.map(ep => ({
            title: `🎬 ${ep.title ? ep.title.slice(0, 24) : `Ep ${ep.episode_number}`}`,
            id: `${prefix}anichin -e ${ep.url}`,
            description: `Rilis: ${ep.release_date || "-"} | Status: ${ep.sub_status || "Sub Indo"}`
          }));
          buttons.push({
            name: "single_select",
            buttonParamsJson: JSON.stringify({
              title: "▶️ PILIH EPISODE NONTON",
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
              display_text: `⚡ Nonton Episode Terbaru (${allEpisodes[0].episode_number || "Terbaru"})`,
              id: `${prefix}anichin -e ${allEpisodes[0].url}`
            })
          });
        }
        if (donghua.trailer_url && donghua.trailer_url.startsWith("http")) {
          buttons.push({
            name: "cta_url",
            buttonParamsJson: JSON.stringify({
              display_text: "▶️ Tonton Trailer",
              url: donghua.trailer_url,
              merchant_url: donghua.trailer_url
            })
          });
        }
        const genres = donghua.genres?.join(", ") || "-";
        const metaStatus = donghua.details?.status || "-";
        const metaType = donghua.details?.type || "Donghua";
        const metaStudio = donghua.details?.studio || "-";
        const bodyText = `–  *A N I C H I N  D E T A I L*

┌  ◦  *Judul* : ${donghua.title}
│  ◦  *Alternatif* : ${donghua.alternative_title || "-"}
│  ◦  *Rating* : ⭐ ${donghua.rating || "-"}
│  ◦  *Tipe* : ${metaType}
│  ◦  *Status* : ${metaStatus}
│  ◦  *Studio* : ${metaStudio}
│  ◦  *Total Episode* : ${totalEp} Episode
└  ◦  *Genre* : ${genres}

–  *S I N O P S I S*
${donghua.synopsis ? donghua.synopsis.length > 350 ? donghua.synopsis.slice(0, 350) + "..." : donghua.synopsis : "Tidak ada ringkasan sinopsis."}

Klik *PILIH EPISODE NONTON* di bawah untuk menonton episode yang diinginkan!`;
        const posterImage = donghua.thumbnail || donghua.cover || null;
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
        const schedules = data?.result;
        if (!data?.status || !schedules) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply("❌ Gagal memuat jadwal rilis donghua.");
        }
        const sections = [];
        Object.entries(schedules).forEach(([day, items]) => {
          if (Array.isArray(items) && items.length > 0) {
            const rows = items.slice(0, 10).map(item => ({
              title: `📺 ${item.title.slice(0, 24)}`,
              id: `${prefix}anichin -d ${item.url}`,
              description: `Jam: ${item.time || "-"} | ${item.latest_episode || ""}`
            }));
            sections.push({
              title: `🗓️ HARI ${day.toUpperCase()} (${items.length} Donghua)`,
              rows: rows
            });
          }
        });
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "📅 PILIH JADWAL HARI INI",
            sections: sections
          })
        }];
        const bodyText = `–  *A N I C H I N  S C H E D U L E*

Jadwal tayang rilis Donghua Subtitle Indonesia setiap minggunya.
Silakan klik tombol *PILIH JADWAL HARI INI* di bawah untuk melihat rincian rilis per hari!`;
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
      if (flags.popular || flags.latest) {
        const isPop = Boolean(flags.popular);
        const action = isPop ? "popular" : "latest";
        const page = Number(flags.page) || 1;
        const {
          data
        } = await axios.get(CONFIG.API_URL, {
          params: {
            action: action,
            page: page
          },
          timeout: CONFIG.TIMEOUT
        });
        let list = [];
        if (isPop) {
          list = data?.result?.today || data?.result?.rankings?.weekly || [];
        } else {
          list = data?.result?.donghua_list || [];
        }
        if (!data?.status || list.length === 0) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply("❌ Tidak ada donghua yang ditemukan.");
        }
        const label = isPop ? "POPULER HARI INI" : "RILISAN TERBARU";
        const rows = list.slice(0, CONFIG.ITEMS_PER_PAGE).map((item, idx) => ({
          title: `[#${idx + 1}] ${item.title.slice(0, 24)}`,
          id: `${prefix}anichin -d ${item.url}`,
          description: `Tipe: ${item.type || "Donghua"} | ${item.episode || item.extra_info || "Sub Indo"}`
        }));
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: `📂 DAFTAR ${label}`,
            sections: [{
              title: `🔥 ANICHIN (${label})`,
              rows: rows
            }]
          })
        }];
        if (!isPop) {
          if (page > 1) {
            buttons.push({
              name: "quick_reply",
              buttonParamsJson: JSON.stringify({
                display_text: `⬅️ Hal ${page - 1}`,
                id: `${prefix}anichin --latest -p ${page - 1}`
              })
            });
          }
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: `➡️ Hal ${page + 1}`,
              id: `${prefix}anichin --latest -p ${page + 1}`
            })
          });
        }
        const bodyText = `–  *A N I C H I N  ${label}*

Berikut daftar donghua pilihan pada kategori ${label}.
Klik tombol di bawah untuk melihat rincian serta daftar episodenya.`;
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
        return ctx.reply(`❌ Masukkan judul donghua yang ingin dicari!\nContoh: \`${prefix}anichin soul land\``);
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
      const resSearch = data?.result;
      const searchList = resSearch?.donghua_list || [];
      if (!data?.status || searchList.length === 0) {
        if (typeof ctx.react === "function") await ctx.react("❌");
        return ctx.reply(`❌ Donghua dengan judul "${querySearch}" tidak ditemukan.`);
      }
      const rows = searchList.slice(0, CONFIG.ITEMS_PER_PAGE).map((item, idx) => ({
        title: `[#${idx + 1}] ${item.title.slice(0, 24)}`,
        id: `${prefix}anichin -d ${item.url}`,
        description: `Tipe: ${item.type || "Donghua"} | Status: ${item.status || "Ongoing"}`
      }));
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: "📂 PILIH HASIL PENCARIAN",
          sections: [{
            title: `🔎 Hasil: "${querySearch}" (Hal ${resSearch.current_page}/${resSearch.total_pages})`,
            rows: rows
          }]
        })
      }];
      if (resSearch.has_prev) {
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `⬅️ Hal ${page - 1}`,
            id: `${prefix}anichin "${querySearch}" -p ${page - 1}`
          })
        });
      }
      if (resSearch.has_next) {
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `➡️ Hal ${page + 1}`,
            id: `${prefix}anichin "${querySearch}" -p ${page + 1}`
          })
        });
      }
      const bodyText = `Hi ${userName}!
Ditemukan *${searchList.length}* judul donghua untuk kata kunci: \`${querySearch}\`.

–  *H A S I L  P E N C A R I A N*

┌  ◦  *Kata Kunci* : ${querySearch}
└  ◦  *Halaman* : ${resSearch.current_page} / ${resSearch.total_pages}

Silakan klik tombol *PILIH HASIL PENCARIAN* di bawah untuk melihat rincian & episode.`;
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
      console.error("[Anichin Error]:", error?.message || error);
      if (typeof ctx.react === "function") await ctx.react("❌");
      let errMsg = error.message;
      if (error.response?.data) {
        try {
          const parsed = typeof error.response.data === "string" ? JSON.parse(error.response.data) : error.response.data;
          errMsg = parsed.message || parsed.error || errMsg;
        } catch {}
      }
      ctx.reply(`❌ Terjadi kesalahan pada Anichin: ${errMsg}`);
    }
  }
};