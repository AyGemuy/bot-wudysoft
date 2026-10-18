import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const CONFIG = {
  API_URL: `${global.bot?.api?.wudysoft}/api/anime/ruangkomiku`,
  TIMEOUT: 45e3,
  CHAPTERS_PER_PAGE: 15
};
const comicCache = new Map();

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /(?:--|-)([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1].toLowerCase();
    let rawVal = match[2];
    let val = true;
    if (["detail", "d", "slug", "comic"].includes(key)) key = "detail";
    if (["chapter", "c", "baca", "read"].includes(key)) key = "chapter";
    if (["search", "s", "query", "q"].includes(key)) key = "search";
    if (["page", "p", "pg"].includes(key)) key = "page";
    if (["home", "h"].includes(key)) key = "home";
    if (["trending", "trend", "t"].includes(key)) key = "trending";
    if (["latest", "updates", "l"].includes(key)) key = "latest";
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
export default {
  name: "ruangkomiku",
  aliases: ["rkomik", "komiku", "bacakomik", "manga"],
  description: "Cari, lihat detail info, dan baca manga/manhwa dari Ruangkomiku",
  category: "Anime",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["ruangkomiku", "rkomik", "komiku", "bacakomik", "manga"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • Ruangkomiku`;
      const userName = ctx.pushname || (ctx.sender ? ctx.sender.split("@")[0] : "User");
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const senderId = ctx.sender || ctx.author || msg.key?.participant || msg.key?.remoteJid || ctx.id;
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      if (!rawText && !cleanPrompt && Object.keys(flags).length === 0) {
        return ctx.reply(`–  *R U A N G K O M I K U*

Layanan streaming & baca komik Manga/Manhwa/Manhua berbahasa Indonesia.

┌  ◦  *Pencarian* : \`${prefix}ruangkomiku <judul komik>\`
│  ◦  *Trending*  : \`${prefix}ruangkomiku --trending\`
│  ◦  *Detail*    : \`${prefix}ruangkomiku -d <slug-komik>\`
└  ◦  *Baca*      : \`${prefix}ruangkomiku -c <slug-chapter>\`

–  *F L A G S*

┌  ◦  \`--search, -s\`   : Cari judul komik spesifik
├  ◦  \`--detail, -d\`   : Buka rincian & daftar chapter
├  ◦  \`--chapter, -c\`  : Baca halaman chapter komik
├  ◦  \`--page, -p\`     : Paginasi daftar chapter
├  ◦  \`--trending, -t\` : Daftar komik sedang hangat
└  ◦  \`--latest, -l\`   : Pembaruan komik terkini`);
      }
      if (typeof ctx.react === "function") await ctx.react("⏳");
      if (flags.chapter) {
        const chapterSlug = String(flags.chapter).trim();
        const {
          data
        } = await axios.get(CONFIG.API_URL, {
          params: {
            action: "chapter",
            slug: chapterSlug
          },
          timeout: CONFIG.TIMEOUT
        });
        if (!data?.status || !data?.result) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply(`❌ Gagal: ${data?.result || "Chapter tidak ditemukan atau belum rilis."}`);
        }
        const res = data.result;
        const totalImages = res.total_images || res.images?.length || 0;
        const prevSlug = res.navigation?.prev_chapter ? res.navigation.prev_chapter.split("/baca/")[1] : null;
        const nextSlug = res.navigation?.next_chapter ? res.navigation.next_chapter.split("/baca/")[1] : null;
        const bodyText = `–  *B A C A  K O M I K*

┌  ◦  *Judul* : ${res.comic_title || "-"}
│  ◦  *Chapter* : ${res.chapter_title || "-"}
│  ◦  *Total Gambar* : ${totalImages} Halaman
└  ◦  *Slug* : \`${res.current_slug}\`

Gunakan tombol di bawah untuk berpindah chapter atau melihat chapter lainnya.`;
        const buttons = [];
        if (prevSlug) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "⬅️ Bab Sebelumnya",
              id: `${prefix}ruangkomiku -c ${prevSlug}`
            })
          });
        }
        if (nextSlug) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "➡️ Bab Selanjutnya",
              id: `${prefix}ruangkomiku -c ${nextSlug}`
            })
          });
        }
        if (res.comic_slug) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "📋 Daftar Chapter",
              id: `${prefix}ruangkomiku -d ${res.comic_slug}`
            })
          });
        }
        buttons.push({
          name: "cta_url",
          buttonParamsJson: JSON.stringify({
            display_text: "🌐 Baca di Browser",
            url: `https://www.ruangkomiku.com/baca/${res.current_slug}`,
            merchant_url: `https://www.ruangkomiku.com/baca/${res.current_slug}`
          })
        });
        const previewImage = res.images?.[0]?.image_url || null;
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
        const comicSlug = String(flags.detail).trim();
        let comic = null;
        const cached = comicCache.get(comicSlug);
        if (cached) {
          comic = cached;
        } else {
          const {
            data
          } = await axios.get(CONFIG.API_URL, {
            params: {
              action: "detail",
              slug: comicSlug
            },
            timeout: CONFIG.TIMEOUT
          });
          if (!data?.status || !data?.result) {
            if (typeof ctx.react === "function") await ctx.react("❌");
            return ctx.reply(`❌ Gagal: ${data?.result || "Detail komik tidak ditemukan."}`);
          }
          comic = data.result;
          comicCache.set(comicSlug, comic);
        }
        const allChapters = comic.chapters || [];
        const totalChapters = allChapters.length;
        const itemsPerPage = CONFIG.CHAPTERS_PER_PAGE;
        const totalPages = Math.ceil(totalChapters / itemsPerPage) || 1;
        let page = Number(flags.page) || 1;
        if (page < 1) page = 1;
        if (page > totalPages) page = totalPages;
        const startIndex = (page - 1) * itemsPerPage;
        const pagedChapters = allChapters.slice(startIndex, startIndex + itemsPerPage);
        const chapterRows = pagedChapters.map(ch => ({
          title: `📖 ${ch.title ? ch.title.slice(0, 24) : `Chapter ${ch.chapter_number}`}`,
          id: `${prefix}ruangkomiku -c ${ch.slug}`,
          description: `Rilis: ${ch.release_date || "-"} | Nomor: ${ch.chapter_number || "-"}`
        }));
        const listSections = [{
          title: `📑 CHAPTERS (Hal ${page}/${totalPages} • Total: ${totalChapters})`,
          rows: chapterRows
        }];
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "📖 PILIH CHAPTER UNTUK BACA",
            sections: listSections
          })
        }];
        if (page > 1) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: `⬅️ Hal ${page - 1}`,
              id: `${prefix}ruangkomiku -d ${comic.slug} -p ${page - 1}`
            })
          });
        }
        if (page < totalPages) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: `➡️ Hal ${page + 1}`,
              id: `${prefix}ruangkomiku -d ${comic.slug} -p ${page + 1}`
            })
          });
        }
        if (allChapters[0]?.slug) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "⚡ Baca Chapter Terbaru",
              id: `${prefix}ruangkomiku -c ${allChapters[0].slug}`
            })
          });
        }
        const genresText = comic.genres?.length ? comic.genres.join(", ") : "-";
        const bodyText = `–  *R U A N G K O M I K U  D E T A I L*

┌  ◦  *Judul* : ${comic.title}
│  ◦  *Tipe* : ${comic.type || "Manga"}
│  ◦  *Status* : ${comic.status || "-"}
│  ◦  *Rating* : ⭐ ${comic.rating || "-"}
│  ◦  *Author* : ${comic.author || "-"}
│  ◦  *Total Chapter* : ${totalChapters}
│  ◦  *Genre* : ${genresText}
└  ◦  *Slug* : \`${comic.slug}\`

–  *S I N O P S I S*
${comic.synopsis ? comic.synopsis.length > 350 ? comic.synopsis.slice(0, 350) + "..." : comic.synopsis : "Tidak ada sinopsis."}

Klik *PILIH CHAPTER UNTUK BACA* di bawah untuk membaca!`;
        if (typeof ctx.sendCta === "function") {
          await ctx.sendCta(bodyText, botFooter, buttons, {
            image: comic.cover_url,
            quoted: quotedMsg
          });
        } else {
          await sock.sendMessage(ctx.id, {
            image: comic.cover_url ? {
              url: comic.cover_url
            } : undefined,
            caption: bodyText
          }, {
            quoted: quotedMsg
          });
        }
        if (typeof ctx.react === "function") await ctx.react("✅");
        return;
      }
      if (flags.trending || flags.latest) {
        const actionType = flags.trending ? "trending" : "latestUpdates";
        const label = flags.trending ? "SEDANG TREN" : "PEMBARUAN TERKINI";
        const {
          data
        } = await axios.get(CONFIG.API_URL, {
          params: {
            action: actionType
          },
          timeout: CONFIG.TIMEOUT
        });
        const list = Array.isArray(data?.result) ? data.result : [];
        if (!data?.status || list.length === 0) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply("❌ Tidak ada data komik yang ditemukan.");
        }
        const rows = list.slice(0, 15).map((item, idx) => ({
          title: `[#${idx + 1}] ${item.title.slice(0, 24)}`,
          id: `${prefix}ruangkomiku -d ${item.slug}`,
          description: `Tipe: ${item.type || "-"} | Rating: ⭐ ${item.rating || "-"} | ${item.latest_chapter || ""}`
        }));
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: `📂 DAFTAR KOMIK ${label}`,
            sections: [{
              title: `🔥 RUANGKOMIKU (${label})`,
              rows: rows
            }]
          })
        }];
        const bodyText = `–  *R U A N G K O M I K U  ${label}*

Berikut daftar ${list.length} komik pilihan terpopuler saat ini.
Silakan klik tombol di bawah untuk melihat detail informasi & membaca chapternya.`;
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
        return ctx.reply(`❌ Masukkan judul komik yang ingin dicari!\nContoh: \`${prefix}ruangkomiku solo leveling\``);
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
      const searchList = data?.result?.data || [];
      if (!data?.status || searchList.length === 0) {
        if (typeof ctx.react === "function") await ctx.react("❌");
        return ctx.reply(`❌ Komik dengan kata kunci "${querySearch}" tidak ditemukan.`);
      }
      const rows = searchList.slice(0, 15).map((item, idx) => ({
        title: `[#${idx + 1}] ${item.title.slice(0, 24)}`,
        id: `${prefix}ruangkomiku -d ${item.slug}`,
        description: `Tipe: ${item.type || "-"} | Rating: ⭐ ${item.rating || "-"} | ${item.latest_chapter || ""}`
      }));
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: "📂 PILIH HASIL PENCARIAN",
          sections: [{
            title: `🔎 Hasil Pencarian: "${querySearch}" (${searchList.length} ditemukan)`,
            rows: rows
          }]
        })
      }];
      const bodyText = `Hi ${userName}!
Ditemukan *${searchList.length}* hasil komik untuk kata kunci: \`${querySearch}\`.

–  *H A S I L  P E N C A R I A N*

Silakan klik tombol *PILIH HASIL PENCARIAN* di bawah untuk melihat detail & chapter komik.`;
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
      console.error("[Ruangkomiku Error]:", error?.message || error);
      if (typeof ctx.react === "function") await ctx.react("❌");
      let errMsg = error.message;
      if (error.response?.data) {
        try {
          const parsed = typeof error.response.data === "string" ? JSON.parse(error.response.data) : error.response.data;
          errMsg = parsed.message || parsed.error || errMsg;
        } catch {}
      }
      ctx.reply(`❌ Terjadi kesalahan pada Ruangkomiku: ${errMsg}`);
    }
  }
};