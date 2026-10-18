import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const CONFIG = {
  API_URL: `${global.bot?.api?.wudysoft}/api/anime/alqanime`,
  TIMEOUT: 45e3,
  ITEMS_PER_PAGE: 15
};
const alqCache = new Map();

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
    if (["page", "p", "pg"].includes(key)) key = "page";
    if (["latest", "updates", "l"].includes(key)) key = "latest";
    if (["ongoing", "on", "og"].includes(key)) key = "ongoing";
    if (["popular", "pop", "top"].includes(key)) key = "popular";
    if (["movie", "movies", "film", "m"].includes(key)) key = "movies";
    if (["completed", "tammat", "end"].includes(key)) key = "completed";
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
    const linkMatch = cleanPrompt.match(/https?:\/\/[^\s]*alqanime\.net\/[^\s]+/i);
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
  name: "alqanime",
  aliases: ["alq", "alqa", "nime", "animeindo"],
  description: "Streaming info & unduh batch anime subtitle Indonesia dari Alqanime",
  category: "Anime",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["alqanime", "alq", "alqa", "nime", "animeindo"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • Alqanime`;
      const userName = ctx.pushname || (ctx.sender ? ctx.sender.split("@")[0] : "User");
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      if (!rawText && !cleanPrompt && Object.keys(flags).length === 0) {
        return ctx.reply(`–  *A L Q A N I M E  S T U D I O*

Layanan informasi & unduh berkas anime Subtitle Indonesia (Batch & Episode).

┌  ◦  *Pencarian* : \`${prefix}alqanime <judul anime>\`
│  ◦  *Detail*    : \`${prefix}alqanime -d <url/slug-anime>\`
│  ◦  *Rilis Baru*: \`${prefix}alqanime --latest [page]\`
│  ◦  *Ongoing*   : \`${prefix}alqanime --ongoing\`
│  ◦  *Populer*   : \`${prefix}alqanime --popular\`
└  ◦  *Movie*     : \`${prefix}alqanime --movies\`

–  *F L A G S*

┌  ◦  \`--search, -s\`    : Cari judul anime spesifik
├  ◦  \`--detail, -d\`    : Buka detail info & link unduhan
├  ◦  \`--page, -p\`      : Nomor halaman pagination
├  ◦  \`--ongoing, -og\`  : Daftar anime yang sedang tayang
├  ◦  \`--popular, -pop\` : Anime terpopuler
├  ◦  \`--completed\`    : Daftar anime yang sudah tamat
└  ◦  \`--movies, -m\`   : Daftar anime film layar lebar`);
      }
      if (typeof ctx.react === "function") await ctx.react("⏳");
      if (flags.detail) {
        let targetParam = String(flags.detail).trim();
        const isUrl = targetParam.startsWith("http");
        const cached = alqCache.get(targetParam);
        let anime = null;
        if (cached) {
          anime = cached;
        } else {
          const {
            data
          } = await axios.get(CONFIG.API_URL, {
            params: isUrl ? {
              action: "detail",
              url: targetParam
            } : {
              action: "detail",
              slug: targetParam
            },
            timeout: CONFIG.TIMEOUT
          });
          if (!data?.status || !data?.result) {
            if (typeof ctx.react === "function") await ctx.react("❌");
            return ctx.reply(`❌ Gagal: ${data?.result || "Anime tidak ditemukan atau URL tidak valid."}`);
          }
          anime = data.result;
          alqCache.set(targetParam, anime);
        }
        const genres = anime.genres?.map(g => g.title).join(", ") || "-";
        const downloads = anime.downloads || [];
        const downloadRows = [];
        downloads.forEach(group => {
          (group.items || []).forEach(item => {
            (item.servers || []).forEach(srv => {
              if (downloadRows.length < 20) {
                downloadRows.push({
                  title: `📥 [${item.resolution || "SD"}] ${srv.server.slice(0, 15)}`,
                  id: `.shorturl ${srv.url}`,
                  description: `${group.title ? group.title.slice(0, 30) : "Download link"}`
                });
              }
            });
          });
        });
        const buttons = [];
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
        const bodyText = `–  *A L Q A N I M E  D E T A I L*

┌  ◦  *Judul* : ${anime.title}
│  ◦  *Jepang* : ${anime.alternative_title || "-"}
│  ◦  *Skor* : ⭐ ${anime.score || "-"}
│  ◦  *Status* : ${anime.status || "-"}
│  ◦  *Tipe* : ${anime.type || "TV"}
│  ◦  *Episode* : ${anime.episodes_count || "-"}
│  ◦  *Durasi* : ${anime.duration || "-"}
│  ◦  *Musim* : ${anime.season || "-"}
│  ◦  *Studio* : ${anime.studio || "-"}
└  ◦  *Genre* : ${genres}

–  *S I N O P S I S*
${anime.synopsis ? anime.synopsis.length > 350 ? anime.synopsis.slice(0, 350) + "..." : anime.synopsis : "Tidak ada sinopsis."}

${downloadRows.length > 0 ? "Silakan klik tombol *PILIH SERVER UNDUHAN* di bawah untuk melihat tautan mirror unduhan!" : "_Link unduhan belum tersedia untuk judul ini._"}`;
        const posterImage = anime.thumbnail || anime.cover || null;
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
        const {
          data
        } = await axios.get(CONFIG.API_URL, {
          params: {
            action: "ongoing"
          },
          timeout: CONFIG.TIMEOUT
        });
        const list = data?.result?.data || [];
        if (!data?.status || list.length === 0) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply("❌ Tidak ada data anime ongoing saat ini.");
        }
        const rows = list.slice(0, 15).map((item, idx) => ({
          title: `[#${idx + 1}] ${item.title.slice(0, 24)}`,
          id: `${prefix}alqanime -d ${item.url}`,
          description: `Update: ${item.episode || "Terbaru"}`
        }));
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "📺 DAFTAR ANIME ONGOING",
            sections: [{
              title: `🔥 SEDANG TAYANG (${list.length} Anime)`,
              rows: rows
            }]
          })
        }];
        const bodyText = `–  *A L Q A N I M E  O N G O I N G*

Ditemukan *${list.length}* anime yang sedang berlangsung (Ongoing).
Klik tombol di bawah untuk memilih anime dan mendapatkan link unduhan.`;
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
      if (flags.popular) {
        const range = typeof flags.popular === "string" ? flags.popular : "weekly";
        const {
          data
        } = await axios.get(CONFIG.API_URL, {
          params: {
            action: "popular",
            range: range
          },
          timeout: CONFIG.TIMEOUT
        });
        const list = data?.result?.data || [];
        if (!data?.status || list.length === 0) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply("❌ Gagal memuat daftar anime populer.");
        }
        const rows = list.slice(0, 15).map((item, idx) => ({
          title: `[#${item.rank || idx + 1}] ${item.title.slice(0, 24)}`,
          id: `${prefix}alqanime -d ${item.url}`,
          description: `Rating: ⭐ ${item.score || "-"} | Genre: ${item.genres?.slice(0, 2)?.join(", ") || "-"}`
        }));
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "⭐ ANIME TERPOPULER",
            sections: [{
              title: `🔥 POPULAR (${range.toUpperCase()})`,
              rows: rows
            }]
          })
        }];
        const bodyText = `–  *A L Q A N I M E  P O P U L E R*

Berikut daftar anime paling banyak ditonton (${range}).
Silakan klik tombol di bawah untuk rincian selengkapnya.`;
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
      if (flags.latest || flags.completed || flags.movies) {
        let action = "latest";
        let label = "RILISAN TERBARU";
        if (flags.completed) {
          action = "completed";
          label = "TAMAT / COMPLETED";
        } else if (flags.movies) {
          action = "movies";
          label = "FILM LAYAR LEBAR (MOVIE)";
        }
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
        const resData = data?.result;
        const list = resData?.data || [];
        if (!data?.status || list.length === 0) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply("❌ Tidak ada anime yang ditemukan pada kategori ini.");
        }
        const rows = list.slice(0, CONFIG.ITEMS_PER_PAGE).map((item, idx) => ({
          title: `[#${idx + 1}] ${item.title.slice(0, 24)}`,
          id: `${prefix}alqanime -d ${item.url}`,
          description: `Tipe: ${item.type || "-"} | Status: ${item.status || "-"} | ${item.episode || ""}`
        }));
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: `📂 DAFTAR ANIME ${label}`,
            sections: [{
              title: `🎬 ${label} (Halaman ${resData.current_page}/${resData.total_pages})`,
              rows: rows
            }]
          })
        }];
        const flagKey = flags.completed ? "--completed" : flags.movies ? "--movies" : "--latest";
        if (resData.has_prev_page) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: `⬅️ Hal ${page - 1}`,
              id: `${prefix}alqanime ${flagKey} -p ${page - 1}`
            })
          });
        }
        if (resData.has_next_page) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: `➡️ Hal ${page + 1}`,
              id: `${prefix}alqanime ${flagKey} -p ${page + 1}`
            })
          });
        }
        const bodyText = `–  *A L Q A N I M E  ${label}*

┌  ◦  *Halaman* : ${resData.current_page} / ${resData.total_pages}
└  ◦  *Total Tampil* : ${list.length} Judul

Klik tombol *DAFTAR ANIME ${label}* untuk memilih anime yang ingin diunduh.`;
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
        return ctx.reply(`❌ Masukkan judul anime yang ingin dicari!\nContoh: \`${prefix}alqanime naruto\``);
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
      const searchList = resSearch?.data || [];
      if (!data?.status || searchList.length === 0) {
        if (typeof ctx.react === "function") await ctx.react("❌");
        return ctx.reply(`❌ Anime dengan kata kunci "${querySearch}" tidak ditemukan.`);
      }
      const rows = searchList.slice(0, CONFIG.ITEMS_PER_PAGE).map((item, idx) => ({
        title: `[#${idx + 1}] ${item.title.slice(0, 24)}`,
        id: `${prefix}alqanime -d ${item.url}`,
        description: `Tipe: ${item.type || "-"} | Skor: ⭐ ${item.score || "-"} | Status: ${item.status || "-"}`
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
      if (resSearch.has_prev_page) {
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `⬅️ Hal ${page - 1}`,
            id: `${prefix}alqanime "${querySearch}" -p ${page - 1}`
          })
        });
      }
      if (resSearch.has_next_page) {
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `➡️ Hal ${page + 1}`,
            id: `${prefix}alqanime "${querySearch}" -p ${page + 1}`
          })
        });
      }
      const bodyText = `Hi ${userName}!
Ditemukan *${searchList.length}* judul anime untuk kata kunci: \`${querySearch}\`.

–  *H A S I L  P E N C A R I A N*

┌  ◦  *Kata Kunci* : ${querySearch}
└  ◦  *Halaman* : ${resSearch.current_page} / ${resSearch.total_pages}

Silakan klik tombol *PILIH HASIL PENCARIAN* di bawah untuk melihat rincian & tautan unduh.`;
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
      console.error("[Alqanime Error]:", error?.message || error);
      if (typeof ctx.react === "function") await ctx.react("❌");
      let errMsg = error.message;
      if (error.response?.data) {
        try {
          const parsed = typeof error.response.data === "string" ? JSON.parse(error.response.data) : error.response.data;
          errMsg = parsed.message || parsed.error || errMsg;
        } catch {}
      }
      ctx.reply(`❌ Terjadi kesalahan pada Alqanime: ${errMsg}`);
    }
  }
};