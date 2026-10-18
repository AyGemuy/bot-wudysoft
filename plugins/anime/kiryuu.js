import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const CONFIG = {
  API_URL: `${global.bot?.api?.wudysoft}/api/anime/kiryuu/v3`,
  TIMEOUT: 45e3,
  CHAPTERS_PER_PAGE: 15
};
const kiryuuCache = new Map();

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /(?:--|-)([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1].toLowerCase();
    let rawVal = match[2];
    let val = true;
    if (["detail", "d", "manga", "komik", "slug"].includes(key)) key = "detail";
    if (["chapter", "c", "baca", "read", "ch"].includes(key)) key = "chapter";
    if (["search", "s", "query", "q"].includes(key)) key = "search";
    if (["popular", "pop", "top"].includes(key)) key = "popular";
    if (["latest", "updates", "l", "home", "h"].includes(key)) key = "home";
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
  if (!flags.detail && !flags.chapter) {
    const chMatch = cleanPrompt.match(/https?:\/\/[^\s]*kiryuu\.[^\s]+\/[^\s]*chapter[^\s]*/i);
    const mangaMatch = cleanPrompt.match(/https?:\/\/[^\s]*kiryuu\.[^\s]+\/manga\/[^\s]+/i);
    if (chMatch) {
      flags.chapter = chMatch[0];
    } else if (mangaMatch) {
      flags.detail = mangaMatch[0];
    }
  }
  return {
    flags: flags,
    cleanPrompt: cleanPrompt
  };
}
export default {
  name: "kiryuu",
  aliases: ["kiryu", "krymanga", "bacakiryuu"],
  description: "Cari & baca komik Manga/Manhwa/Manhua Sub Indo dari Kiryuu",
  category: "Anime",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["kiryuu", "kiryu", "krymanga", "bacakiryuu"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • Kiryuu`;
      const userName = ctx.pushname || (ctx.sender ? ctx.sender.split("@")[0] : "User");
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      if (!rawText && !cleanPrompt && Object.keys(flags).length === 0) {
        return ctx.reply(`–  *K I R Y U U  M A N G A*

Portal baca komik Manga, Manhwa, dan Manhua berbahasa Indonesia.

┌  ◦  *Pencarian* : \`${prefix}kiryuu <judul komik>\`
│  ◦  *Detail*    : \`${prefix}kiryuu -d <slug/url-manga>\`
│  ◦  *Baca Ch*   : \`${prefix}kiryuu -c <slug/url-chapter>\`
│  ◦  *Populer*   : \`${prefix}kiryuu --popular\`
└  ◦  *Terbaru*   : \`${prefix}kiryuu --home\`

–  *F L A G S*

┌  ◦  \`--search, -s\`  : Cari judul komik spesifik
├  ◦  \`--detail, -d\`  : Lihat sinopsis & daftar chapter
├  ◦  \`--chapter, -c\` : Buka halaman & pratinjau chapter
├  ◦  \`--popular\`     : Komik trending terpopuler
├  ◦  \`--home, -h\`    : Update rilisan terbaru
└  ◦  \`--page, -p\`    : Navigasi halaman chapter`);
      }
      if (typeof ctx.react === "function") await ctx.react("⏳");
      if (flags.chapter) {
        const target = String(flags.chapter).trim();
        const {
          data
        } = await axios.get(CONFIG.API_URL, {
          params: {
            action: "download",
            url: target
          },
          timeout: CONFIG.TIMEOUT
        });
        const res = data?.result;
        if (!data?.status || !res || !res.images?.length) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply("❌ Gagal memuat chapter komik. Halaman mungkin tidak tersedia.");
        }
        const buttons = [];
        if (res.prev_chapter_url) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "⬅️ Bab Sebelumnya",
              id: `${prefix}kiryuu -c ${res.prev_chapter_url}`
            })
          });
        }
        if (res.next_chapter_url) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "➡️ Bab Selanjutnya",
              id: `${prefix}kiryuu -c ${res.next_chapter_url}`
            })
          });
        }
        if (res.url) {
          buttons.push({
            name: "cta_url",
            buttonParamsJson: JSON.stringify({
              display_text: "🌐 Baca di Web (Full HD)",
              url: res.url,
              merchant_url: res.url
            })
          });
        }
        const totalPages = res.images.length;
        const bodyText = `–  *K I R Y U U  R E A D E R*

┌  ◦  *Chapter* : \`${res.slug || "Reading"}\`
│  ◦  *Total Gambar* : ${totalPages} Halaman
└  ◦  *Status* : Siap Dibaca

Pratinjau halaman pembuka ditampilkan di atas.
Gunakan tombol navigasi di bawah untuk berpindah bab atau buka di browser untuk membaca seluruh gambar secara leluasa!`;
        const previewImage = res.images[0] || null;
        if (typeof ctx.sendCta === "function") {
          await ctx.sendCta(bodyText, botFooter, buttons, {
            image: previewImage,
            quoted: quotedMsg
          });
        } else {
          await sock.sendMessage(ctx.id, {
            image: previewImage ? {
              url: previewImage
            } : undefined,
            caption: bodyText
          }, {
            quoted: quotedMsg
          });
        }
        if (typeof ctx.react === "function") await ctx.react("✅");
        return;
      }
      if (flags.detail) {
        const target = String(flags.detail).trim();
        let comic = null;
        const cached = kiryuuCache.get(target);
        if (cached) {
          comic = cached;
        } else {
          const {
            data
          } = await axios.get(CONFIG.API_URL, {
            params: {
              action: "detail",
              url: target
            },
            timeout: CONFIG.TIMEOUT
          });
          if (!data?.status || !data?.result) {
            if (typeof ctx.react === "function") await ctx.react("❌");
            return ctx.reply("❌ Rincian komik tidak ditemukan.");
          }
          comic = data.result;
          kiryuuCache.set(target, comic);
        }
        const allChapters = comic.chapters || [];
        const totalCh = allChapters.length;
        const page = Number(flags.page) || 1;
        const itemsPerPage = CONFIG.CHAPTERS_PER_PAGE;
        const totalPages = Math.ceil(totalCh / itemsPerPage) || 1;
        const startIndex = (page - 1) * itemsPerPage;
        const pagedChapters = allChapters.slice(startIndex, startIndex + itemsPerPage);
        const buttons = [];
        if (pagedChapters.length > 0) {
          const chRows = pagedChapters.map(ch => ({
            title: `📖 ${ch.chapter_title ? ch.chapter_title.slice(0, 24) : "Chapter"}`,
            id: `${prefix}kiryuu -c ${ch.chapter_url}`,
            description: `Rilis: ${ch.uploaded_at || "Tersedia"}`
          }));
          buttons.push({
            name: "single_select",
            buttonParamsJson: JSON.stringify({
              title: "📖 PILIH CHAPTER UNTUK BACA",
              sections: [{
                title: `DAFTAR CHAPTER (Hal ${page}/${totalPages} • Total: ${totalCh})`,
                rows: chRows
              }]
            })
          });
        }
        if (page > 1) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: `⬅️ Hal ${page - 1}`,
              id: `${prefix}kiryuu -d ${comic.slug || target} -p ${page - 1}`
            })
          });
        }
        if (page < totalPages) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: `➡️ Hal ${page + 1}`,
              id: `${prefix}kiryuu -d ${comic.slug || target} -p ${page + 1}`
            })
          });
        }
        if (allChapters[0]?.chapter_url) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: `⚡ Bab Terbaru (${allChapters[0].chapter_title?.slice(0, 15) || "Terbaru"})`,
              id: `${prefix}kiryuu -c ${allChapters[0].chapter_url}`
            })
          });
        }
        const genres = comic.genres?.join(", ") || "-";
        const bodyText = `–  *K I R Y U U  D E T A I L*

┌  ◦  *Judul* : ${comic.title || "-"}
│  ◦  *Alternatif* : ${comic.alt_title || "-"}
│  ◦  *Rating* : ⭐ ${comic.rating || "-"}
│  ◦  *Tipe* : ${comic.type || "Manga"}
│  ◦  *Status* : ${comic.status || "-"}
│  ◦  *Penulis* : ${comic.author || "-"}
│  ◦  *Total Chapter* : ${totalCh} Bab
└  ◦  *Genre* : ${genres}

–  *S I N O P S I S*
${comic.synopsis ? comic.synopsis.length > 350 ? comic.synopsis.slice(0, 350) + "..." : comic.synopsis : "Tidak ada ringkasan sinopsis."}

Klik tombol *PILIH CHAPTER UNTUK BACA* di bawah untuk mulai membaca!`;
        const posterImage = comic.cover || null;
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
      if (flags.popular || flags.home) {
        const {
          data
        } = await axios.get(CONFIG.API_URL, {
          params: {
            action: "home"
          },
          timeout: CONFIG.TIMEOUT
        });
        const resHome = data?.result;
        if (!data?.status || !resHome) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply("❌ Gagal mengambil katalog komik terbaru.");
        }
        const isPop = Boolean(flags.popular);
        const list = isPop ? resHome.popular_today || resHome.top_series || [] : resHome.latest_updates || resHome.project_updates || [];
        const label = isPop ? "POPULER HARI INI" : "RILISAN TERBARU";
        if (list.length === 0) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply(`❌ Tidak ada komik pada kategori ${label}.`);
        }
        const rows = list.slice(0, 15).map((item, idx) => ({
          title: `[#${item.rank || idx + 1}] ${item.title.slice(0, 24)}`,
          id: `${prefix}kiryuu -d ${item.url}`,
          description: `Tipe: ${item.type || "Manga"} | ${item.rating ? `⭐ ${item.rating}` : item.status || "Update"}`
        }));
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: `📂 DAFTAR ${label}`,
            sections: [{
              title: `🔥 KIRYUU (${label})`,
              rows: rows
            }]
          })
        }];
        const bodyText = `–  *K I R Y U U  ${label}*

Berikut daftar komik pilihan pada kategori ${label}.
Klik tombol di bawah untuk melihat detail informasi & daftar chapter.`;
        const topCover = list[0]?.cover || null;
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
        return;
      }
      const querySearch = flags.search ? String(flags.search).trim() : cleanPrompt;
      if (!querySearch) {
        if (typeof ctx.react === "function") await ctx.react("❌");
        return ctx.reply(`❌ Masukkan judul komik yang ingin dicari!\nContoh: \`${prefix}kiryuu martial peak\``);
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
      const searchList = data?.result?.results || [];
      if (!data?.status || searchList.length === 0) {
        if (typeof ctx.react === "function") await ctx.react("❌");
        return ctx.reply(`❌ Komik dengan judul "${querySearch}" tidak ditemukan.`);
      }
      const rows = searchList.slice(0, CONFIG.ITEMS_PER_PAGE).map((item, idx) => ({
        title: `[#${idx + 1}] ${item.title.slice(0, 24)}`,
        id: `${prefix}kiryuu -d ${item.url}`,
        description: item.synopsis ? item.synopsis.slice(0, 35) : "Lihat detail komik"
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
Ditemukan *${searchList.length}* judul komik untuk kata kunci: \`${querySearch}\`.

–  *H A S I L  P E N C A R I A N*

Silakan klik tombol *PILIH HASIL PENCARIAN* di bawah untuk melihat rincian & chapter.`;
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
      console.error("[Kiryuu Error]:", error?.message || error);
      if (typeof ctx.react === "function") await ctx.react("❌");
      let errMsg = error.message;
      if (error.response?.data) {
        try {
          const parsed = typeof error.response.data === "string" ? JSON.parse(error.response.data) : error.response.data;
          errMsg = parsed.error || parsed.message || errMsg;
        } catch {}
      }
      ctx.reply(`❌ Terjadi kesalahan pada Kiryuu: ${errMsg}`);
    }
  }
};