import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const CONFIG = {
  API_URL: `${global.bot?.api?.wudysoft}/api/anime/baca-komik/v3`,
  TIMEOUT: 45e3,
  CHAPTERS_PER_PAGE: 15
};
const bacaKomikCache = new Map();

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /(?:--|-)([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1].toLowerCase();
    let rawVal = match[2];
    let val = true;
    if (["detail", "d", "manga", "komik", "url"].includes(key)) key = "detail";
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
    const chMatch = cleanPrompt.match(/https?:\/\/[^\s]*komiku\.[^\s]+\/[^\s]*chapter[^\s]*/i);
    const mangaMatch = cleanPrompt.match(/https?:\/\/[^\s]*komiku\.[^\s]+\/manga\/[^\s]+/i);
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
  name: "bacakomik",
  aliases: ["komiku", "bkomik", "kmk"],
  description: "Cari & baca komik Manga/Manhwa/Manhua Sub Indo dari Komiku.org",
  category: "Anime",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["bacakomik", "komiku", "bkomik", "kmk"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • Komiku`;
      const userName = ctx.pushname || (ctx.sender ? ctx.sender.split("@")[0] : "User");
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      if (!rawText && !cleanPrompt && Object.keys(flags).length === 0) {
        return ctx.reply(`–  *K O M I K U  O R G*

Layanan baca komik Manga, Manhwa, dan Manhua berbahasa Indonesia.

┌  ◦  *Pencarian* : \`${prefix}bacakomik <judul komik>\`
│  ◦  *Detail*    : \`${prefix}bacakomik -d <url-komik>\`
│  ◦  *Baca Ch*   : \`${prefix}bacakomik -c <url-chapter>\`
│  ◦  *Populer*   : \`${prefix}bacakomik --popular\`
└  ◦  *Terbaru*   : \`${prefix}bacakomik --home\`

–  *F L A G S*

┌  ◦  \`--search, -s\`  : Cari judul komik tertentu
├  ◦  \`--detail, -d\`  : Lihat info komik & list chapter
├  ◦  \`--chapter, -c\` : Buka halaman & pratinjau chapter
├  ◦  \`--popular\`     : Komik rekomendasi terpopuler
├  ◦  \`--home, -h\`    : Update rilisan komik terbaru
└  ◦  \`--page, -p\`    : Navigasi halaman chapter`);
      }
      if (typeof ctx.react === "function") await ctx.react("⏳");
      if (flags.chapter) {
        const targetUrl = String(flags.chapter).trim();
        const {
          data
        } = await axios.get(CONFIG.API_URL, {
          params: {
            action: "download",
            url: targetUrl
          },
          timeout: CONFIG.TIMEOUT
        });
        if (!data?.status || !data?.images || !data.images.length) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply("❌ Gagal memuat chapter komik. Halaman mungkin tidak tersedia.");
        }
        const buttons = [];
        if (data.nav?.prev) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "⬅️ Bab Sebelumnya",
              id: `${prefix}bacakomik -c ${data.nav.prev}`
            })
          });
        }
        if (data.nav?.next) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "➡️ Bab Selanjutnya",
              id: `${prefix}bacakomik -c ${data.nav.next}`
            })
          });
        }
        if (data.series?.url) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "📋 Daftar Chapter",
              id: `${prefix}bacakomik -d ${data.series.url}`
            })
          });
        }
        buttons.push({
          name: "cta_url",
          buttonParamsJson: JSON.stringify({
            display_text: "🌐 Baca di Web (Full HD)",
            url: targetUrl,
            merchant_url: targetUrl
          })
        });
        const totalPages = data.total_images || data.images.length;
        const bodyText = `–  *K O M I K U  R E A D E R*

┌  ◦  *Judul* : ${data.title || "-"}
│  ◦  *Komik* : ${data.series?.title || "-"}
│  ◦  *Total Gambar* : ${totalPages} Halaman
└  ◦  *Status* : Siap Dibaca

Pratinjau halaman pembuka ditampilkan di atas.
Gunakan tombol navigasi di bawah untuk berpindah bab atau buka tautan browser untuk membaca full!`;
        const previewImage = data.images[0]?.url || null;
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
        const targetUrl = String(flags.detail).trim();
        let comic = null;
        const cached = bacaKomikCache.get(targetUrl);
        if (cached) {
          comic = cached;
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
          if (!data?.status || !data?.title) {
            if (typeof ctx.react === "function") await ctx.react("❌");
            return ctx.reply("❌ Rincian komik tidak ditemukan atau tautan salah.");
          }
          comic = data;
          bacaKomikCache.set(targetUrl, comic);
        }
        const allChapters = comic.chapters || [];
        const totalCh = comic.total_chapters || allChapters.length;
        const page = Number(flags.page) || 1;
        const itemsPerPage = CONFIG.CHAPTERS_PER_PAGE;
        const totalPages = Math.ceil(totalCh / itemsPerPage) || 1;
        const startIndex = (page - 1) * itemsPerPage;
        const pagedChapters = allChapters.slice(startIndex, startIndex + itemsPerPage);
        const buttons = [];
        if (pagedChapters.length > 0) {
          const chRows = pagedChapters.map(ch => ({
            title: `📖 ${ch.title.slice(0, 24)}`,
            id: `${prefix}bacakomik -c ${ch.url}`,
            description: `Rilis: ${ch.date || "-"} | Pembaca: ${ch.views || 0}`
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
              id: `${prefix}bacakomik -d ${targetUrl} -p ${page - 1}`
            })
          });
        }
        if (page < totalPages) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: `➡️ Hal ${page + 1}`,
              id: `${prefix}bacakomik -d ${targetUrl} -p ${page + 1}`
            })
          });
        }
        if (comic.latest_chapter_url) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "⚡ Baca Bab Paling Baru",
              id: `${prefix}bacakomik -c ${comic.latest_chapter_url}`
            })
          });
        }
        if (comic.first_chapter_url) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "🌱 Mulai Dari Bab 1",
              id: `${prefix}bacakomik -c ${comic.first_chapter_url}`
            })
          });
        }
        const genres = Array.isArray(comic.genres) ? comic.genres.join(", ") : "-";
        const bodyText = `–  *K O M I K U  D E T A I L*

┌  ◦  *Judul* : ${comic.title || "-"}
│  ◦  *Alternatif* : ${comic.alt_title || "-"}
│  ◦  *Tipe* : ${comic.type || "Manga"}
│  ◦  *Status* : ${comic.status || "-"}
│  ◦  *Pengarang* : ${comic.author || "-"}
│  ◦  *Total Chapter* : ${totalCh} Bab
└  ◦  *Genre* : ${genres}

–  *S I N O P S I S*
${comic.description ? comic.description.length > 350 ? comic.description.slice(0, 350) + "..." : comic.description : "Tidak ada ringkasan sinopsis."}

Klik tombol *PILIH CHAPTER UNTUK BACA* di bawah untuk mulai membaca!`;
        const posterImage = comic.thumbnail || null;
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
        if (!data?.status) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply("❌ Gagal mengambil katalog komik terbaru.");
        }
        const isPop = Boolean(flags.popular);
        const list = isPop ? data.popular || [] : data.latest || [];
        const label = isPop ? "REKOMENDASI POPULER" : "RILISAN TERBARU";
        if (list.length === 0) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply(`❌ Tidak ada komik pada kategori ${label}.`);
        }
        const rows = list.slice(0, 15).map((item, idx) => ({
          title: `[#${idx + 1}] ${item.title.slice(0, 24)}`,
          id: `${prefix}bacakomik -d ${item.link}`,
          description: `Chapter: ${item.latest_chapter || item.chapter || "-"} | ${item.genre || item.info || ""}`
        }));
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: `📂 DAFTAR ${label}`,
            sections: [{
              title: `🔥 KOMIKU (${label})`,
              rows: rows
            }]
          })
        }];
        const bodyText = `–  *K O M I K U  ${label}*

Berikut daftar komik pilihan pada kategori ${label}.
Klik tombol di bawah untuk melihat detail informasi & daftar chapter.`;
        const topThumb = list[0]?.thumb || null;
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
        return ctx.reply(`❌ Masukkan judul komik yang ingin dicari!\nContoh: \`${prefix}bacakomik one piece\``);
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
      const searchList = Array.isArray(data) ? data : data?.data || [];
      if (!searchList.length) {
        if (typeof ctx.react === "function") await ctx.react("❌");
        return ctx.reply(`❌ Komik dengan judul "${querySearch}" tidak ditemukan.`);
      }
      const rows = searchList.slice(0, CONFIG.ITEMS_PER_PAGE).map((item, idx) => ({
        title: `[#${idx + 1}] ${item.title.slice(0, 24)}`,
        id: `${prefix}bacakomik -d ${item.link}`,
        description: `Tipe: ${item.type || "Manga"} | ${item.latest_chapter ? `Up: ${item.latest_chapter}` : ""}`
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
      console.error("[Komiku Error]:", error?.message || error);
      if (typeof ctx.react === "function") await ctx.react("❌");
      let errMsg = error.message;
      if (error.response?.data) {
        try {
          const parsed = typeof error.response.data === "string" ? JSON.parse(error.response.data) : error.response.data;
          errMsg = parsed.error || parsed.message || errMsg;
        } catch {}
      }
      ctx.reply(`❌ Terjadi kesalahan pada Komiku: ${errMsg}`);
    }
  }
};