import axios from "axios";
import { simpleQuoted } from "../../lib/quoted.js";

const CONFIG = {
  API_URL: `${global.bot?.api?.wudysoft}/api/anime/shinigami`,
  PDF_API_URL: `${global.bot?.api?.wudysoft}/api/tools/img2pdf/v2`,
  TIMEOUT: 45e3,
  PDF_TIMEOUT: 120e3,
  CHAPTERS_PER_PAGE: 15,
  ITEMS_PER_PAGE: 10
};

const shiniCache = new Map();

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /(?:--|-)([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;

  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1].toLowerCase();
    let rawVal = match[2];
    let val = true;

    if (["detail", "d", "manga", "komik", "id"].includes(key)) key = "detail";
    if (["read", "baca", "chapter", "ch", "r"].includes(key)) key = "read";
    if (["pdf", "download", "dl"].includes(key)) key = "pdf";
    if (["chapters", "listchapter", "ep"].includes(key)) key = "chapters";
    if (["search", "s", "query", "q"].includes(key)) key = "search";
    if (["top", "popular", "pop", "t"].includes(key)) key = "top";
    if (["latest", "baru", "l", "new"].includes(key)) key = "latest";
    if (["page", "p", "pg"].includes(key)) key = "page";
    if (["filter", "f"].includes(key)) key = "filter";

    if (rawVal !== undefined) {
      if ((rawVal.startsWith('"') && rawVal.endsWith('"')) || (rawVal.startsWith("'") && rawVal.endsWith("'"))) {
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

  // Deteksi otomatis URL atau UUID Shinigami
  if (!flags.detail && !flags.read && !flags.pdf) {
    const chUrlMatch = cleanPrompt.match(/https?:\/\/[^\s]*shinigami[^\s]*\/chapter\/([a-zA-Z0-9-]+)/i);
    const mangaUrlMatch = cleanPrompt.match(/https?:\/\/[^\s]*shinigami[^\s]*\/series\/([a-zA-Z0-9-]+)/i);
    const uuidMatch = cleanPrompt.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

    if (chUrlMatch) {
      flags.read = chUrlMatch[1];
    } else if (mangaUrlMatch) {
      flags.detail = mangaUrlMatch[1];
    } else if (uuidMatch) {
      flags.detail = uuidMatch[0];
    }
  }

  return {
    flags,
    cleanPrompt
  };
}

export default {
  name: "shinigami",
  aliases: ["shngm", "shini"],
  description: "Cari manhwa/manga, baca chapter & download PDF komik di Shinigami",
  category: "Anime",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["shinigami", "shngm", "shini"].some((alias) => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }

      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • Shinigami ID`;
      const userName = ctx.pushname || (ctx.sender ? ctx.sender.split("@")[0] : "User");
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;

      const { flags, cleanPrompt } = parseFlags(rawText);

      // ==========================================
      // MENU BANTUAN
      // ==========================================
      if (!rawText && !cleanPrompt && Object.keys(flags).length === 0) {
        return ctx.reply(`–  *S H I N I G A M I  M A N G A*

Portal baca Manhwa, Manga, dan Manhua Bahasa Indonesia terlengkap.

┌  ◦  *Pencarian* : \`${prefix}shinigami <judul komik>\`
│  ◦  *Detail*    : \`${prefix}shinigami -d <manga_id/url>\`
│  ◦  *Baca Ch*   : \`${prefix}shinigami -r <chapter_id>\`
│  ◦  *Unduh PDF* : \`${prefix}shinigami --pdf <chapter_id>\`
│  ◦  *Populer*   : \`${prefix}shinigami --top\`
└  ◦  *Terbaru*   : \`${prefix}shinigami --latest\`

–  *F L A G S*

┌  ◦  \`--search, -s\`  : Cari judul komik tertentu
├  ◦  \`--detail, -d\`  : Info sinopsis & daftar chapter
├  ◦  \`--read, -r\`    : Buka reader chapter
├  ◦  \`--pdf, -dl\`    : Konversi & download chapter ke format PDF
├  ◦  \`--top, -t\`     : Komik peringkat teratas (daily/weekly)
├  ◦  \`--latest, -l\`  : Daftar rilis chapter terbaru
└  ◦  \`--page, -p\`    : Nomor halaman`);
      }

      if (typeof ctx.react === "function") await ctx.react("⏳");

      // ==========================================
      // ACTION: DOWNLOAD PDF (--pdf) (POST BODY)
      // ==========================================
      if (flags.pdf || (flags.read && flags.pdf)) {
        let chapterId = typeof flags.pdf === "string" ? flags.pdf.trim() : flags.read ? String(flags.read).trim() : cleanPrompt;

        const urlMatch = chapterId.match(/chapter\/([a-zA-Z0-9-]+)/i);
        if (urlMatch) chapterId = urlMatch[1];

        if (!chapterId) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply(`❌ Masukkan Chapter ID atau link chapter yang ingin diunduh ke PDF!\nContoh: \`${prefix}shinigami --pdf <chapter_id>\``);
        }

        await ctx.reply("📄 *Sedang memproses gambar & mengonversi chapter ke PDF...*\nProses ini membutuhkan waktu beberapa saat tergantung jumlah halaman.");

        // 1. Ambil daftar gambar chapter via POST
        const { data: readData } = await axios.post(
          CONFIG.API_URL,
          {
            action: "read",
            chapter_id: chapterId
          },
          {
            timeout: CONFIG.TIMEOUT,
            headers: { "Content-Type": "application/json" }
          }
        );

        const res = readData?.result?.data || readData?.result;
        const images = Array.isArray(res?.images) ? res.images : [];

        if (!readData?.status || images.length === 0) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply("❌ Gagal memuat gambar chapter untuk dikonversi.");
        }

        const chapterData = res.chapter || {};
        const mangaTitle = res.title || chapterData.title || "Manga";
        const chapterNumber = chapterData.chapter_number || chapterData.number || "0";

        // 2. Request konversi ke img2pdf/v2 via POST
        const pdfResponse = await axios.post(
          CONFIG.PDF_API_URL,
          {
            images: images
          },
          {
            responseType: "arraybuffer",
            timeout: CONFIG.PDF_TIMEOUT,
            headers: {
              "Content-Type": "application/json"
            }
          }
        );

        if (!pdfResponse?.data) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply("❌ Gagal membuat berkas PDF dari server converter.");
        }

        const cleanTitle = mangaTitle.replace(/[^a-zA-Z0-9_\-\s]/g, "").trim().replace(/\s+/g, "_");
        const fileName = `${cleanTitle}_Ch_${chapterNumber}.pdf`;

        // 3. Kirim berkas PDF sebagai Document
        await sock.sendMessage(
          ctx.id,
          {
            document: Buffer.from(pdfResponse.data),
            mimetype: "application/pdf",
            fileName: fileName,
            caption: `–  *S H I N I G A M I  P D F*

┌  ◦  *Komik* : ${mangaTitle}
│  ◦  *Chapter* : ${chapterNumber}
│  ◦  *Total Halaman* : ${images.length} Halaman
└  ◦  *File* : \`${fileName}\`

_Chapter berhasil dikonversi ke format PDF._`
          },
          { quoted: quotedMsg }
        );

        if (typeof ctx.react === "function") await ctx.react("✅");
        return;
      }

      // ==========================================
      // ACTION: READ CHAPTER (-r / --read) (POST BODY)
      // ==========================================
      if (flags.read) {
        const chapterId = String(flags.read).trim();
        const { data } = await axios.post(
          CONFIG.API_URL,
          {
            action: "read",
            chapter_id: chapterId
          },
          {
            timeout: CONFIG.TIMEOUT,
            headers: { "Content-Type": "application/json" }
          }
        );

        const res = data?.result?.data || data?.result;
        if (!data?.status || !res || typeof res === "string") {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply("❌ Gagal memuat chapter komik. Chapter ID tidak ditemukan atau invalid.");
        }

        const chapterData = res.chapter || {};
        const mangaId = res.manga_id || chapterData.manga_id || "";
        const images = Array.isArray(res.images) ? res.images : [];
        const totalImages = res.total_images || images.length || 0;
        const webReaderUrl = `https://11.shinigami.asia/chapter/${chapterId}`;

        const buttons = [];

        // Tombol CTA Web Reader
        buttons.push({
          name: "cta_url",
          buttonParamsJson: JSON.stringify({
            display_text: "📖 Buka di Web Reader",
            url: webReaderUrl,
            merchant_url: webReaderUrl
          })
        });

        // Tombol Quick Reply: DOWNLOAD PDF
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "📥 Download PDF Chapter",
            id: `${prefix}shinigami --pdf ${chapterId}`
          })
        });

        // Tombol kembali ke daftar chapter
        if (mangaId) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "📋 Daftar Semua Chapter",
              id: `${prefix}shinigami -d ${mangaId}`
            })
          });
        }

        const bodyText = `–  *S H I N I G A M I  R E A D E R*

┌  ◦  *Komik* : ${res.title || chapterData.title || "-"}
│  ◦  *Chapter* : ${chapterData.chapter_number || chapterData.number || "-"}
│  ◦  *Total Gambar* : ${totalImages} Halaman
└  ◦  *Rilis* : ${chapterData.created_at || chapterData.release_date || "-"}

Klik *Buka di Web Reader* untuk membaca online, atau klik *Download PDF Chapter* untuk mengunduh semua halaman menjadi satu dokumen PDF!`;

        const coverImage = images[0] || null;
        if (typeof ctx.sendCta === "function") {
          await ctx.sendCta(bodyText, botFooter, buttons, {
            image: coverImage,
            quoted: quotedMsg
          });
        } else {
          await sock.sendMessage(
            ctx.id,
            {
              image: coverImage ? { url: coverImage } : undefined,
              caption: bodyText
            },
            { quoted: quotedMsg }
          );
        }

        if (typeof ctx.react === "function") await ctx.react("✅");
        return;
      }

      // ==========================================
      // ACTION: DETAIL & CHAPTERS (-d / --detail) (POST BODY)
      // ==========================================
      if (flags.detail) {
        const mangaId = String(flags.detail).trim();
        let mangaDetail = null;

        const cached = shiniCache.get(mangaId);
        if (cached) {
          mangaDetail = cached;
        } else {
          const { data } = await axios.post(
            CONFIG.API_URL,
            {
              action: "detail",
              manga_id: mangaId
            },
            {
              timeout: CONFIG.TIMEOUT,
              headers: { "Content-Type": "application/json" }
            }
          );

          if (!data?.status || !data?.result) {
            if (typeof ctx.react === "function") await ctx.react("❌");
            return ctx.reply("❌ Rincian komik tidak ditemukan.");
          }
          mangaDetail = data.result?.data || data.result;
          shiniCache.set(mangaId, mangaDetail);
        }

        const page = Number(flags.page) || 1;
        const { data: chData } = await axios.post(
          CONFIG.API_URL,
          {
            action: "chapters",
            manga_id: mangaId,
            page: page,
            page_size: CONFIG.CHAPTERS_PER_PAGE,
            sort_order: "desc"
          },
          {
            timeout: CONFIG.TIMEOUT,
            headers: { "Content-Type": "application/json" }
          }
        );

        const chapterList = Array.isArray(chData?.result?.data) ? chData.result.data : Array.isArray(chData?.result) ? chData.result : [];
        const totalChapters = chData?.result?.meta?.total || mangaDetail.total_chapters || chapterList.length;
        const totalPages = Math.ceil(totalChapters / CONFIG.CHAPTERS_PER_PAGE) || 1;

        const buttons = [];

        if (chapterList.length > 0) {
          const rows = chapterList.map((ch) => {
            const chNum = ch.chapter_number || ch.number || "-";
            const chId = ch.chapter_id || ch.id;
            return {
              title: `📖 Chapter ${chNum}`,
              id: `${prefix}shinigami -r ${chId}`,
              description: `Rilis: ${ch.created_at || ch.release_date || "-"} | ${ch.title ? ch.title.slice(0, 20) : "Tanpa Judul"}`
            };
          });

          buttons.push({
            name: "single_select",
            buttonParamsJson: JSON.stringify({
              title: "📖 PILIH CHAPTER UNTUK DIBACA",
              sections: [
                {
                  title: `DAFTAR CHAPTER (Hal ${page}/${totalPages})`,
                  rows: rows
                }
              ]
            })
          });
        }

        if (chapterList[0]) {
          const latestChId = chapterList[0].chapter_id || chapterList[0].id;
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: `⚡ Chapter Terbaru (${chapterList[0].chapter_number || "New"})`,
              id: `${prefix}shinigami -r ${latestChId}`
            })
          });
        }

        if (page > 1) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: `⬅️ Hal ${page - 1}`,
              id: `${prefix}shinigami -d ${mangaId} -p ${page - 1}`
            })
          });
        }
        if (page < totalPages) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: `➡️ Hal ${page + 1}`,
              id: `${prefix}shinigami -d ${mangaId} -p ${page + 1}`
            })
          });
        }

        const genres = Array.isArray(mangaDetail.genres)
          ? mangaDetail.genres.map((g) => (typeof g === "object" ? g.name || g.title : g)).join(", ")
          : "-";

        const synopsis = mangaDetail.synopsis || mangaDetail.description || "Tidak ada deskripsi cerita.";
        const cleanSynopsis = synopsis.length > 350 ? synopsis.slice(0, 350) + "..." : synopsis;

        const bodyText = `–  *S H I N I G A M I  D E T A I L*

┌  ◦  *Judul* : ${mangaDetail.title || "-"}
│  ◦  *Alternatif* : ${mangaDetail.alternative_title || "-"}
│  ◦  *Tipe* : ${mangaDetail.type || "Manhwa"}
│  ◦  *Status* : ${mangaDetail.status || "-"}
│  ◦  *Skor* : ⭐ ${mangaDetail.rating || mangaDetail.score || "-"}
│  ◦  *Author* : ${mangaDetail.author || "-"}
│  ◦  *Total Ch* : ${totalChapters} Chapter
└  ◦  *Genre* : ${genres}

–  *S I N O P S I S*
${cleanSynopsis}

Pilih menu *PILIH CHAPTER UNTUK DIBACA* di bawah untuk mulai membaca atau mengunduh PDF!`;

        const posterImage = mangaDetail.cover || mangaDetail.cover_image || mangaDetail.poster || null;
        if (typeof ctx.sendCta === "function") {
          await ctx.sendCta(bodyText, botFooter, buttons, {
            image: posterImage,
            quoted: quotedMsg
          });
        } else {
          await sock.sendMessage(
            ctx.id,
            {
              image: posterImage ? { url: posterImage } : undefined,
              caption: bodyText
            },
            { quoted: quotedMsg }
          );
        }

        if (typeof ctx.react === "function") await ctx.react("✅");
        return;
      }

      // ==========================================
      // ACTION: TOP / POPULAR (--top / -t) (POST BODY)
      // ==========================================
      if (flags.top) {
        const filter = flags.filter || "daily";
        const page = Number(flags.page) || 1;

        const { data } = await axios.post(
          CONFIG.API_URL,
          {
            action: "top",
            filter: filter,
            page: page,
            page_size: CONFIG.ITEMS_PER_PAGE
          },
          {
            timeout: CONFIG.TIMEOUT,
            headers: { "Content-Type": "application/json" }
          }
        );

        const list = Array.isArray(data?.result?.data) ? data.result.data : Array.isArray(data?.result) ? data.result : [];
        if (!data?.status || list.length === 0) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply("❌ Tidak ada data komik populer saat ini.");
        }

        const rows = list.slice(0, CONFIG.ITEMS_PER_PAGE).map((item, idx) => ({
          title: `[#${idx + 1}] ${item.title.slice(0, 24)}`,
          id: `${prefix}shinigami -d ${item.manga_id || item.id}`,
          description: `⭐ ${item.rating || item.score || "-"} | ${item.type || "Manhwa"} | Ch: ${item.latest_chapter || "-"}`
        }));

        const buttons = [
          {
            name: "single_select",
            buttonParamsJson: JSON.stringify({
              title: "🔥 PILIH KOMIK POPULER",
              sections: [
                {
                  title: `PERINGKAT TOP (${filter.toUpperCase()} • Hal ${page})`,
                  rows: rows
                }
              ]
            })
          }
        ];

        if (page > 1) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: `⬅️ Hal ${page - 1}`,
              id: `${prefix}shinigami --top -f ${filter} -p ${page - 1}`
            })
          });
        }
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `➡️ Hal ${page + 1}`,
            id: `${prefix}shinigami --top -f ${filter} -p ${page + 1}`
          })
        });

        const bodyText = `–  *K O M I K  P O P U L E R*

Daftar komik paling banyak dibaca kategori *${filter.toUpperCase()}* (Halaman ${page}).
Klik tombol di bawah untuk melihat rincian serta daftar chapter.`;

        const topImage = list[0]?.cover || list[0]?.cover_image || null;
        if (typeof ctx.sendCta === "function") {
          await ctx.sendCta(bodyText, botFooter, buttons, {
            image: topImage,
            quoted: quotedMsg
          });
        } else {
          await sock.sendMessage(
            ctx.id,
            {
              image: topImage ? { url: topImage } : undefined,
              caption: bodyText
            },
            { quoted: quotedMsg }
          );
        }

        if (typeof ctx.react === "function") await ctx.react("✅");
        return;
      }

      // ==========================================
      // ACTION: LATEST UPDATE (--latest / -l) (POST BODY)
      // ==========================================
      if (flags.latest) {
        const page = Number(flags.page) || 1;
        const { data } = await axios.post(
          CONFIG.API_URL,
          {
            action: "list",
            sort: "latest",
            sort_order: "desc",
            page: page,
            page_size: CONFIG.ITEMS_PER_PAGE
          },
          {
            timeout: CONFIG.TIMEOUT,
            headers: { "Content-Type": "application/json" }
          }
        );

        const list = Array.isArray(data?.result?.data) ? data.result.data : Array.isArray(data?.result) ? data.result : [];
        if (!data?.status || list.length === 0) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply("❌ Tidak ada update komik terbaru.");
        }

        const rows = list.slice(0, CONFIG.ITEMS_PER_PAGE).map((item, idx) => ({
          title: `[#${idx + 1}] ${item.title.slice(0, 24)}`,
          id: `${prefix}shinigami -d ${item.manga_id || item.id}`,
          description: `Ch: ${item.latest_chapter || "-"} | ${item.type || "Manhwa"}`
        }));

        const buttons = [
          {
            name: "single_select",
            buttonParamsJson: JSON.stringify({
              title: "🆕 PILIH KOMIK TERBARU",
              sections: [
                {
                  title: `RILIS TERBARU (Halaman ${page})`,
                  rows: rows
                }
              ]
            })
          }
        ];

        if (page > 1) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: `⬅️ Hal ${page - 1}`,
              id: `${prefix}shinigami --latest -p ${page - 1}`
            })
          });
        }
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `➡️ Hal ${page + 1}`,
            id: `${prefix}shinigami --latest -p ${page + 1}`
          })
        });

        const bodyText = `–  *U P D A T E  K O M I K  T E R B A R U*

Berikut komik dengan chapter yang baru saja diperbarui di Shinigami.`;

        const topImage = list[0]?.cover || list[0]?.cover_image || null;
        if (typeof ctx.sendCta === "function") {
          await ctx.sendCta(bodyText, botFooter, buttons, {
            image: topImage,
            quoted: quotedMsg
          });
        } else {
          await sock.sendMessage(
            ctx.id,
            {
              image: topImage ? { url: topImage } : undefined,
              caption: bodyText
            },
            { quoted: quotedMsg }
          );
        }

        if (typeof ctx.react === "function") await ctx.react("✅");
        return;
      }

      // ==========================================
      // ACTION: SEARCH (DEFAULT QUERY) (POST BODY)
      // ==========================================
      const querySearch = flags.search ? String(flags.search).trim() : cleanPrompt;
      if (!querySearch) {
        if (typeof ctx.react === "function") await ctx.react("❌");
        return ctx.reply(`❌ Masukkan judul komik yang ingin dicari!\nContoh: \`${prefix}shinigami solo leveling\``);
      }

      const page = Number(flags.page) || 1;
      const { data } = await axios.post(
        CONFIG.API_URL,
        {
          action: "search",
          q: querySearch,
          page: page,
          page_size: CONFIG.ITEMS_PER_PAGE
        },
        {
          timeout: CONFIG.TIMEOUT,
          headers: { "Content-Type": "application/json" }
        }
      );

      const searchList = Array.isArray(data?.result?.data) ? data.result.data : Array.isArray(data?.result) ? data.result : [];

      if (!data?.status || searchList.length === 0) {
        if (typeof ctx.react === "function") await ctx.react("❌");
        return ctx.reply(`❌ Komik dengan judul "${querySearch}" tidak ditemukan.`);
      }

      const rows = searchList.slice(0, CONFIG.ITEMS_PER_PAGE).map((item, idx) => ({
        title: `[#${idx + 1}] ${item.title.slice(0, 24)}`,
        id: `${prefix}shinigami -d ${item.manga_id || item.id}`,
        description: `⭐ ${item.rating || item.score || "-"} | ${item.type || "Manhwa"} | Ch: ${item.latest_chapter || "-"}`
      }));

      const buttons = [
        {
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "📂 PILIH HASIL PENCARIAN",
            sections: [
              {
                title: `🔎 Hasil: "${querySearch}" (Halaman ${page})`,
                rows: rows
              }
            ]
          })
        }
      ];

      if (page > 1) {
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `⬅️ Hal ${page - 1}`,
            id: `${prefix}shinigami "${querySearch}" -p ${page - 1}`
          })
        });
      }
      if (searchList.length >= CONFIG.ITEMS_PER_PAGE) {
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `➡️ Hal ${page + 1}`,
            id: `${prefix}shinigami "${querySearch}" -p ${page + 1}`
          })
        });
      }

      const bodyText = `Hi ${userName}!
Ditemukan *${searchList.length}* judul komik untuk kata kunci: \`${querySearch}\`.

–  *H A S I L  P E N C A R I A N*

Silakan klik tombol *PILIH HASIL PENCARIAN* di bawah untuk melihat rincian & daftar chapter.`;

      const topImage = searchList[0]?.cover || searchList[0]?.cover_image || null;
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, botFooter, buttons, {
          image: topImage,
          quoted: quotedMsg
        });
      } else {
        await sock.sendMessage(
          ctx.id,
          {
            image: topImage ? { url: topImage } : undefined,
            caption: bodyText
          },
          { quoted: quotedMsg }
        );
      }

      if (typeof ctx.react === "function") await ctx.react("✅");
    } catch (error) {
      console.error("[Shinigami Error]:", error?.message || error);
      if (typeof ctx.react === "function") await ctx.react("❌");

      let errMsg = error.message;
      if (error.response?.data) {
        try {
          const parsed = typeof error.response.data === "string" ? JSON.parse(error.response.data) : error.response.data;
          errMsg = parsed.message || parsed.error || errMsg;
        } catch {}
      }

      ctx.reply(`❌ Terjadi kesalahan pada Shinigami: ${errMsg}`);
    }
  }
};