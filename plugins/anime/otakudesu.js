import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const CONFIG = {
  API_URL: `${global.bot?.api?.wudysoft}/api/anime/otakudesu/v1`,
  TIMEOUT: 45e3,
  EPISODES_PER_PAGE: 15
};
const otakuCache = new Map();

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /(?:--|-)([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1].toLowerCase();
    let rawVal = match[2];
    let val = true;
    if (["detail", "d", "slug", "anime"].includes(key)) key = "detail";
    if (["episode", "ep", "e", "stream", "play"].includes(key)) key = "episode";
    if (["batch", "b"].includes(key)) key = "batch";
    if (["search", "s", "query", "q"].includes(key)) key = "search";
    if (["ongoing", "on", "og"].includes(key)) key = "ongoing";
    if (["complete", "tamat", "c"].includes(key)) key = "complete";
    if (["schedule", "jadwal"].includes(key)) key = "schedule";
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
  if (!flags.detail && !flags.episode && !flags.batch) {
    const epMatch = cleanPrompt.match(/https?:\/\/[^\s]*otakudesu\.[^\s]+\/episode\/[^\s]+/i);
    const batchMatch = cleanPrompt.match(/https?:\/\/[^\s]*otakudesu\.[^\s]+\/batch\/[^\s]+/i);
    const animeMatch = cleanPrompt.match(/https?:\/\/[^\s]*otakudesu\.[^\s]+\/anime\/[^\s]+/i);
    if (epMatch) {
      flags.episode = epMatch[0];
    } else if (batchMatch) {
      flags.batch = batchMatch[0];
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
  name: "otakudesu",
  aliases: ["otaku", "odesu", "otkd"],
  description: "Streaming, download episode & batch anime Sub Indo dari Otakudesu",
  category: "Anime",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["otakudesu", "otaku", "odesu", "otkd"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • Otakudesu`;
      const userName = ctx.pushname || (ctx.sender ? ctx.sender.split("@")[0] : "User");
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      if (!rawText && !cleanPrompt && Object.keys(flags).length === 0) {
        return ctx.reply(`–  *O T A K U D E S U*

Layanan streaming & unduh anime Subtitle Indonesia (Single Episode & Batch).

┌  ◦  *Pencarian* : \`${prefix}otakudesu <judul anime>\`
│  ◦  *Detail*    : \`${prefix}otakudesu -d <url/slug-anime>\`
│  ◦  *Nonton Ep* : \`${prefix}otakudesu -e <url/slug-episode>\`
│  ◦  *Batch DL*  : \`${prefix}otakudesu -b <url/slug-batch>\`
│  ◦  *Ongoing*   : \`${prefix}otakudesu --ongoing\`
└  ◦  *Jadwal*    : \`${prefix}otakudesu --schedule\`

–  *F L A G S*

┌  ◦  \`--search, -s\`   : Cari anime tertentu
├  ◦  \`--detail, -d\`   : Info anime & daftar episode
├  ◦  \`--episode, -e\`  : Stream & mirror download episode
├  ◦  \`--batch, -b\`    : Unduh batch lengkap satu season
├  ◦  \`--ongoing, -og\` : Anime yang sedang tayang
├  ◦  \`--complete, -c\` : Anime yang sudah tamat
├  ◦  \`--schedule\`     : Jadwal rilis mingguan
└  ◦  \`--page, -p\`     : Nomor halaman`);
      }
      if (typeof ctx.react === "function") await ctx.react("⏳");
      if (flags.episode) {
        const target = String(flags.episode).trim();
        const isUrl = target.startsWith("http");
        const {
          data
        } = await axios.get(CONFIG.API_URL, {
          params: isUrl ? {
            action: "episode",
            url: target
          } : {
            action: "episode",
            slug: target
          },
          timeout: CONFIG.TIMEOUT
        });
        if (!data?.success) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply("❌ Gagal memuat episode anime. Cek kembali tautan atau slug.");
        }
        const buttons = [];
        if (data.navigation?.prev?.url) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "⬅️ Episode Sebelumnya",
              id: `${prefix}otakudesu -e ${data.navigation.prev.url}`
            })
          });
        }
        if (data.navigation?.next?.url) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "➡️ Episode Selanjutnya",
              id: `${prefix}otakudesu -e ${data.navigation.next.url}`
            })
          });
        }
        if (data.navigation?.anime?.url) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "📋 Semua Episode",
              id: `${prefix}otakudesu -d ${data.navigation.anime.url}`
            })
          });
        }
        const downloadRows = [];
        (data.downloads || []).forEach(dl => {
          (dl.links || []).forEach(linkObj => {
            if (downloadRows.length < 20) {
              downloadRows.push({
                title: `📥 [${dl.quality}] ${linkObj.host.slice(0, 15)}`,
                id: `.shorturl ${linkObj.url}`,
                description: `Ukuran: ${dl.size || "-"} | Server: ${linkObj.host}`
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
        const topStream = data.streams?.[0]?.links?.[0]?.url;
        if (topStream && topStream.startsWith("http")) {
          buttons.push({
            name: "cta_url",
            buttonParamsJson: JSON.stringify({
              display_text: `▶️ Stream Video (${data.streams[0].quality})`,
              url: topStream,
              merchant_url: topStream
            })
          });
        }
        const bodyText = `–  *O T A K U D E S U  E P I S O D E*

┌  ◦  *Judul* : ${data.title || "-"}
│  ◦  *Anime* : ${data.animeTitle || "-"}
│  ◦  *Credit* : ${data.credit || "Otakudesu"}
└  ◦  *Resolusi Tersedia* : ${(data.downloads || []).map(d => d.quality).join(", ") || "-"}

Gunakan tombol di bawah untuk berpindah episode atau pilih link unduhan!`;
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
      if (flags.batch) {
        const target = String(flags.batch).trim();
        const isUrl = target.startsWith("http");
        const {
          data
        } = await axios.get(CONFIG.API_URL, {
          params: isUrl ? {
            action: "batch",
            url: target
          } : {
            action: "batch",
            slug: target
          },
          timeout: CONFIG.TIMEOUT
        });
        if (!data?.success) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply("❌ Gagal memuat batch anime. Tautan tidak valid.");
        }
        const downloadRows = [];
        (data.downloads || []).forEach(dl => {
          (dl.links || []).forEach(linkObj => {
            if (downloadRows.length < 20) {
              downloadRows.push({
                title: `📦 [${dl.quality}] ${linkObj.host.slice(0, 15)}`,
                id: `.shorturl ${linkObj.url}`,
                description: `Ukuran: ${dl.size || "-"} | Server: ${linkObj.host}`
              });
            }
          });
        });
        const buttons = [];
        if (downloadRows.length > 0) {
          buttons.push({
            name: "single_select",
            buttonParamsJson: JSON.stringify({
              title: "📥 PILIH SERVER BATCH",
              sections: [{
                title: "DOWNLOAD BATCH SATU MUSIM",
                rows: downloadRows
              }]
            })
          });
        }
        const bodyText = `–  *O T A K U D E S U  B A T C H*

┌  ◦  *Judul* : ${data.title || data.animeTitle || "-"}
│  ◦  *Total File* : ${data.total || downloadRows.length} Pilihan
└  ◦  *Credit* : ${data.credit || "Otakudesu"}

–  *S I N O P S I S*
${data.synopsis ? data.synopsis.length > 300 ? data.synopsis.slice(0, 300) + "..." : data.synopsis : "Tidak ada sinopsis."}

Klik tombol *PILIH SERVER BATCH* di bawah untuk mengunduh satu paket musim!`;
        const posterImage = data.image || null;
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
      if (flags.detail) {
        const target = String(flags.detail).trim();
        const isUrl = target.startsWith("http");
        let anime = null;
        const cached = otakuCache.get(target);
        if (cached) {
          anime = cached;
        } else {
          const {
            data
          } = await axios.get(CONFIG.API_URL, {
            params: isUrl ? {
              action: "detail",
              url: target
            } : {
              action: "detail",
              slug: target
            },
            timeout: CONFIG.TIMEOUT
          });
          if (!data?.success) {
            if (typeof ctx.react === "function") await ctx.react("❌");
            return ctx.reply("❌ Detail anime tidak ditemukan.");
          }
          anime = data;
          otakuCache.set(target, anime);
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
            id: `${prefix}otakudesu -e ${ep.url}`,
            description: `Tanggal: ${ep.date || "-"}`
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
              display_text: "⚡ Episode Terbaru",
              id: `${prefix}otakudesu -e ${allEpisodes[0].url}`
            })
          });
        }
        if (anime.batch?.[0]?.url) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "📦 Unduh Batch Season",
              id: `${prefix}otakudesu -b ${anime.batch[0].url}`
            })
          });
        }
        const bodyText = `–  *O T A K U D E S U  D E T A I L*

┌  ◦  *Judul* : ${anime.title || "-"}
│  ◦  *Jepang* : ${anime.jepang || "-"}
│  ◦  *Skor* : ⭐ ${anime.skor || "-"}
│  ◦  *Status* : ${anime.status || "-"}
│  ◦  *Total Episode* : ${anime.total_episode || totalEp}
│  ◦  *Durasi* : ${anime.durasi || "-"}
│  ◦  *Studio* : ${anime.studio || "-"}
└  ◦  *Genre* : ${anime.genre || "-"}

–  *S I N O P S I S*
${anime.synopsis ? anime.synopsis.length > 350 ? anime.synopsis.slice(0, 350) + "..." : anime.synopsis : "Tidak ada ringkasan sinopsis."}

Klik tombol *PILIH EPISODE NONTON* di bawah untuk mulai streaming & download!`;
        const posterImage = anime.image || anime.thumb || null;
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
        const schedules = data?.schedule;
        if (!data?.success || !schedules) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply("❌ Gagal memuat jadwal rilis anime.");
        }
        const sections = [];
        Object.entries(schedules).forEach(([day, items]) => {
          if (Array.isArray(items) && items.length > 0) {
            const rows = items.slice(0, 10).map(item => ({
              title: `📺 ${item.title.slice(0, 24)}`,
              id: `${prefix}otakudesu -d ${item.url}`,
              description: `Buka detail anime`
            }));
            sections.push({
              title: `🗓️ HARI ${day.toUpperCase()} (${items.length} Anime)`,
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
        const bodyText = `–  *O T A K U D E S U  J A D W A L*

Jadwal rilis episode anime mingguan di Otakudesu.
Silakan klik tombol di bawah untuk melihat judul anime berdasarkan hari tayang!`;
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
      if (flags.ongoing || flags.complete) {
        const action = flags.complete ? "complete" : "ongoing";
        const label = flags.complete ? "TAMAT (COMPLETE)" : "SEDANG TAYANG (ONGOING)";
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
        const list = data?.data || [];
        if (!data?.success || list.length === 0) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply(`❌ Tidak ada anime yang ditemukan pada kategori ${label}.`);
        }
        const rows = list.slice(0, CONFIG.ITEMS_PER_PAGE).map((item, idx) => ({
          title: `[#${idx + 1}] ${item.title.slice(0, 24)}`,
          id: `${prefix}otakudesu -d ${item.url}`,
          description: `Episode: ${item.episode || item.episodes || "-"} | ${item.day || item.rating || ""}`
        }));
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: `📂 DAFTAR ANIME ${label}`,
            sections: [{
              title: `🔥 OTAKUDESU (${label} - Hal ${page})`,
              rows: rows
            }]
          })
        }];
        const flagKey = flags.complete ? "--complete" : "--ongoing";
        if (data.pagination?.hasPrev) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: `⬅️ Hal ${page - 1}`,
              id: `${prefix}otakudesu ${flagKey} -p ${page - 1}`
            })
          });
        }
        if (data.pagination?.hasNext) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: `➡️ Hal ${page + 1}`,
              id: `${prefix}otakudesu ${flagKey} -p ${page + 1}`
            })
          });
        }
        const bodyText = `–  *O T A K U D E S U  ${label}*

┌  ◦  *Halaman* : ${page}
└  ◦  *Total Tampil* : ${list.length} Judul

Klik tombol *DAFTAR ANIME ${label}* untuk melihat detail & streaming!`;
        const topThumbnail = list[0]?.thumb || list[0]?.image || null;
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
        return ctx.reply(`❌ Masukkan judul anime yang ingin dicari!\nContoh: \`${prefix}otakudesu naruto\``);
      }
      const page = Number(flags.page) || 1;
      const {
        data
      } = await axios.get(CONFIG.API_URL, {
        params: {
          action: "search",
          q: querySearch,
          page: page
        },
        timeout: CONFIG.TIMEOUT
      });
      const searchList = data?.data || [];
      if (!data?.success || searchList.length === 0) {
        if (typeof ctx.react === "function") await ctx.react("❌");
        return ctx.reply(`❌ Anime dengan judul "${querySearch}" tidak ditemukan.`);
      }
      const rows = searchList.slice(0, CONFIG.ITEMS_PER_PAGE).map((item, idx) => ({
        title: `[#${idx + 1}] ${item.title.slice(0, 24)}`,
        id: `${prefix}otakudesu -d ${item.url}`,
        description: `Skor: ⭐ ${item.rating || "-"} | Status: ${item.status || "-"}`
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
      if (data.pagination?.hasPrev) {
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `⬅️ Hal ${page - 1}`,
            id: `${prefix}otakudesu "${querySearch}" -p ${page - 1}`
          })
        });
      }
      if (data.pagination?.hasNext) {
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `➡️ Hal ${page + 1}`,
            id: `${prefix}otakudesu "${querySearch}" -p ${page + 1}`
          })
        });
      }
      const bodyText = `Hi ${userName}!
Ditemukan *${searchList.length}* judul anime untuk kata kunci: \`${querySearch}\`.

–  *H A S I L  P E N C A R I A N*

Silakan klik tombol *PILIH HASIL PENCARIAN* di bawah untuk melihat rincian & streaming.`;
      const topThumb = searchList[0]?.image || null;
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
      console.error("[Otakudesu Error]:", error?.message || error);
      if (typeof ctx.react === "function") await ctx.react("❌");
      let errMsg = error.message;
      if (error.response?.data) {
        try {
          const parsed = typeof error.response.data === "string" ? JSON.parse(error.response.data) : error.response.data;
          errMsg = parsed.message || parsed.error || errMsg;
        } catch {}
      }
      ctx.reply(`❌ Terjadi kesalahan pada Otakudesu: ${errMsg}`);
    }
  }
};