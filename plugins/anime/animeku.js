import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/anime/animekuindo`;
const CONFIG = {
  TIMEOUT: 3e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /(?:--|-)([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1].toLowerCase();
    let rawVal = match[2];
    let val = true;
    const aliasMap = {
      search: ["s", "q", "query"],
      url: ["u", "detail", "info"],
      download: ["d", "stream", "dl", "ep"],
      popular: ["home", "pop"],
      ongoing: ["on"],
      top: ["toprating", "rating"],
      movie: ["mov"],
      schedule: ["jadwal", "sch"],
      page: ["p", "pg"]
    };
    for (const [realKey, aliases] of Object.entries(aliasMap)) {
      if (aliases.includes(key)) key = realKey;
    }
    if (rawVal !== undefined) {
      if (rawVal.startsWith('"') && rawVal.endsWith('"') || rawVal.startsWith("'") && rawVal.endsWith("'")) {
        rawVal = rawVal.slice(1, -1);
      }
      val = rawVal;
    }
    flags[key] = val;
  }
  const cleanPrompt = input.replace(flagRegex, "").trim();
  if (!flags.url && !flags.download && /^https?:\/\/animekuindo\.live\/.+/i.test(cleanPrompt)) {
    if (/\/episode\//i.test(cleanPrompt)) {
      flags.download = cleanPrompt;
    } else {
      flags.url = cleanPrompt;
    }
  }
  return {
    flags: flags,
    cleanPrompt: cleanPrompt
  };
}
export default {
  name: "animeku",
  aliases: ["animekuindo", "aku", "akindo", "animu"],
  description: "Streaming, unduh, dan cari anime subtitle Indonesia dari AnimeKuIndo",
  category: "Anime",
  limit: true,
  example: "• Cari: .animeku Solo Leveling\n• Detail & Episode: .animeku -u <url_anime>\n• Stream/Download: .animeku -d <url_episode>\n• Jadwal Rilis: .animeku --schedule\n• Sedang Tayang: .animeku --ongoing",
  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "WudysoftBot";
    const botFooter = global.bot?.footer || `${botName} • AnimeKuIndo Engine`;
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
    const targetChat = ctx.chat || ctx.id;
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["animeku", "animekuindo", "aku", "akindo", "animu"].some(a => firstWord.endsWith(a))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      const query = flags.search || cleanPrompt;
      const page = Number(flags.page) || 1;
      if (flags.download) {
        const epUrl = String(flags.download).trim();
        await ctx.react?.("⏳");
        const {
          data
        } = await axios.get(API_URL, {
          params: {
            action: "download",
            url: epUrl
          },
          headers: {
            "User-Agent": CONFIG.USER_AGENT
          },
          timeout: CONFIG.TIMEOUT
        });
        const res = data?.data;
        if (!data?.status || !res) {
          await ctx.react?.("❌");
          return ctx.reply("❌ Gagal memuat link video atau episode tidak ditemukan.");
        }
        const streams = res.video_streams || [];
        const dlLinks = res.download_links || [];
        const streamListText = streams.length ? streams.map((s, i) => `├  ◦  *Stream #${i + 1}* : ${s.quality}`).join("\n") : "├  ◦  *Stream* : Direct player only";
        const dlListText = dlLinks.length ? dlLinks.slice(0, 5).map(dl => `├  ◦  *Download* : ${dl.quality || "Mirror"}`).join("\n") : "└  ◦  *Download* : Tidak tersedia";
        const bodyText = `–  *A N I M E K U  S T R E A M*

┌  ◦  *Judul* : ${res.title}
${streamListText}
${dlListText}
└  ◦  *Pilihan* : Gunakan tombol di bawah untuk menonton / mengunduh`;
        const buttons = [];
        if (streams[0]?.url) {
          buttons.push({
            name: "cta_url",
            buttonParamsJson: JSON.stringify({
              display_text: `🎬 Tonton (${streams[0].quality})`,
              url: streams[0].url,
              merchant_url: streams[0].url
            })
          });
          buttons.push({
            name: "cta_copy",
            buttonParamsJson: JSON.stringify({
              display_text: "📋 Salin Link Video",
              copy_code: streams[0].url
            })
          });
        } else if (dlLinks[0]?.link) {
          buttons.push({
            name: "cta_url",
            buttonParamsJson: JSON.stringify({
              display_text: "📥 Link Download",
              url: dlLinks[0].link,
              merchant_url: dlLinks[0].link
            })
          });
        }
        if (res.navigation?.next) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "⏭️ Episode Selanjutnya",
              id: `${prefix}animeku -d ${res.navigation.next}`
            })
          });
        }
        const options = {
          contextInfo: {
            mentionedJid: [ctx.sender],
            forwardingScore: 999,
            isForwarded: true
          },
          quoted: quotedMsg
        };
        await ctx.react?.("✅");
        if (typeof ctx.sendCta === "function") {
          return await ctx.sendCta(bodyText, botFooter, buttons, options);
        } else {
          return await ctx.reply(`${bodyText}\n\n🔗 *URL:* ${streams[0]?.url || dlLinks[0]?.link || epUrl}`, {
            quoted: quotedMsg
          });
        }
      }
      if (flags.url) {
        const animeUrl = String(flags.url).trim();
        await ctx.react?.("⏳");
        const {
          data
        } = await axios.get(API_URL, {
          params: {
            action: "detail",
            url: animeUrl
          },
          headers: {
            "User-Agent": CONFIG.USER_AGENT
          },
          timeout: CONFIG.TIMEOUT
        });
        const res = data?.data;
        if (!data?.status || !res) {
          await ctx.react?.("❌");
          return ctx.reply("❌ Gagal mengambil rincian anime dari URL tersebut.");
        }
        const cleanSynopsis = (res.synopsis || "Tidak ada deskripsi.").slice(0, 300);
        const epList = res.episode_list || [];
        const episodeRows = epList.slice(0, 20).map(ep => ({
          title: `${ep.title || `Episode ${ep.episode}`}`.slice(0, 24),
          id: `${prefix}animeku -d ${ep.url}`,
          description: `Tanggal: ${ep.date || "-"} • Klik untuk menonton`
        }));
        const bodyText = `–  *A N I M E K U  I N F O*

┌  ◦  *Judul* : ${res.title}
│  ◦  *Rating* : ⭐ ${res.rating || "N/A"}
│  ◦  *Season* : ${res.season || "-"}
│  ◦  *Genre* : ${res.genres?.join(", ") || "-"}
└  ◦  *Total Episode* : ${epList.length} Episode

–  *S I N O P S I S*

“${cleanSynopsis}...”

Pilih episode pada menu di bawah untuk menonton video.`;
        const listSections = [{
          title: `DAFTAR EPISODE (${epList.length} Rilis)`,
          rows: episodeRows
        }];
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "📺 PILIH EPISODE",
            sections: listSections
          })
        }];
        if (epList[0]?.url) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "▶️ Episode Terbaru",
              id: `${prefix}animeku -d ${epList[0].url}`
            })
          });
        }
        const options = {
          image: res.thumbnail || "https://files.catbox.moe/g2e6i5.jpg",
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 1,
              divider_indices: [1],
              list_title: `${botName} • AnimeKuIndo`,
              button_title: "Buka Episode"
            }
          },
          contextInfo: {
            mentionedJid: [ctx.sender],
            forwardingScore: 999,
            isForwarded: true
          },
          quoted: quotedMsg
        };
        await ctx.react?.("✅");
        if (typeof ctx.sendCta === "function") {
          return await ctx.sendCta(bodyText, botFooter, buttons, options);
        } else {
          return await sock.sendMessage(targetChat, {
            image: {
              url: res.thumbnail
            },
            caption: bodyText
          }, {
            quoted: quotedMsg
          });
        }
      }
      if (flags.schedule) {
        await ctx.react?.("⏳");
        const {
          data
        } = await axios.get(API_URL, {
          params: {
            action: "schedule"
          },
          headers: {
            "User-Agent": CONFIG.USER_AGENT
          },
          timeout: CONFIG.TIMEOUT
        });
        const schedules = data?.data || [];
        if (!data?.status || !schedules.length) {
          await ctx.react?.("❌");
          return ctx.reply("❌ Gagal memuat jadwal tayang anime.");
        }
        const sections = schedules.map(dayObj => ({
          title: `HARI ${dayObj.day.toUpperCase()} (${dayObj.anime?.length || 0})`,
          rows: (dayObj.anime || []).slice(0, 10).map(a => ({
            title: a.title.slice(0, 24),
            id: `${prefix}animeku -u ${a.url}`,
            description: `Jam: ${a.time_release || "-"} • ${a.episode || "Baru"}`
          }))
        }));
        const bodyText = `–  *J A D W A L  R I L I S  A N I M E*

Jadwal pembaruan episode anime mingguan di AnimeKuIndo:

┌  ◦  *Total Hari* : 7 Hari
└  ◦  *Pilihan* : Buka menu interaktif di bawah untuk melihat judul anime per hari`;
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "📅 JADWAL TAYANG",
            sections: sections
          })
        }];
        const options = {
          contextInfo: {
            mentionedJid: [ctx.sender],
            forwardingScore: 999,
            isForwarded: true
          },
          quoted: quotedMsg
        };
        await ctx.react?.("✅");
        if (typeof ctx.sendCta === "function") {
          return await ctx.sendCta(bodyText, botFooter, buttons, options);
        } else {
          return await ctx.reply(bodyText, {
            quoted: quotedMsg
          });
        }
      }
      if (flags.ongoing || flags.top || flags.movie) {
        const actionType = flags.ongoing ? "ongoing" : flags.top ? "top_rating" : "movie";
        const label = flags.ongoing ? "ONGOING" : flags.top ? "TOP RATING" : "MOVIE";
        await ctx.react?.("⏳");
        const {
          data
        } = await axios.get(API_URL, {
          params: {
            action: actionType,
            page: page
          },
          headers: {
            "User-Agent": CONFIG.USER_AGENT
          },
          timeout: CONFIG.TIMEOUT
        });
        const items = data?.data || [];
        if (!data?.status || !items.length) {
          await ctx.react?.("❌");
          return ctx.reply(`❌ Tidak ada daftar anime untuk kategori ${label}.`);
        }
        const rows = items.slice(0, 15).map((item, i) => ({
          title: `[#${i + 1}] ${item.title}`.slice(0, 24),
          id: `${prefix}animeku -u ${item.url}`,
          description: `Episode: ${item.episode || "-"} • Status: ${item.status || "Aktif"}`
        }));
        const bodyText = `–  *A N I M E K U  ${label}*

Daftar anime kategori ${label} (Halaman ${page}):

┌  ◦  *Total Ditemukan* : ${items.length} Anime
└  ◦  *Pilihan* : Pilih judul pada menu di bawah untuk rincian`;
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: `📺 DAFTAR ${label}`,
            sections: [{
              title: `Koleksi ${label}`,
              rows: rows
            }]
          })
        }];
        if (page > 1) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: `⬅️ Halaman ${page - 1}`,
              id: `${prefix}animeku --${actionType} -p ${page - 1}`
            })
          });
        }
        if (data.has_next) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: `➡️ Halaman ${page + 1}`,
              id: `${prefix}animeku --${actionType} -p ${page + 1}`
            })
          });
        }
        const options = {
          image: items[0]?.thumb || "https://files.catbox.moe/g2e6i5.jpg",
          contextInfo: {
            mentionedJid: [ctx.sender],
            forwardingScore: 999,
            isForwarded: true
          },
          quoted: quotedMsg
        };
        await ctx.react?.("✅");
        if (typeof ctx.sendCta === "function") {
          return await ctx.sendCta(bodyText, botFooter, buttons, options);
        } else {
          return await ctx.reply(bodyText, {
            quoted: quotedMsg
          });
        }
      }
      if (flags.popular) {
        await ctx.react?.("⏳");
        const {
          data
        } = await axios.get(API_URL, {
          params: {
            action: "home"
          },
          headers: {
            "User-Agent": CONFIG.USER_AGENT
          },
          timeout: CONFIG.TIMEOUT
        });
        const res = data?.data;
        const popList = res?.popular || [];
        const latestList = res?.latest || [];
        if (!data?.status || !popList.length && !latestList.length) {
          await ctx.react?.("❌");
          return ctx.reply("❌ Gagal memuat data beranda anime.");
        }
        const popRows = popList.slice(0, 10).map((a, i) => ({
          title: `🔥 [#${i + 1}] ${a.title}`.slice(0, 24),
          id: `${prefix}animeku -u ${a.url}`,
          description: `Eps: ${a.episode || "-"} • Tipe: ${a.type || "TV"}`
        }));
        const latestRows = latestList.slice(0, 10).map((a, i) => ({
          title: `🆕 [#${i + 1}] ${a.title}`.slice(0, 24),
          id: `${prefix}animeku -u ${a.url}`,
          description: `Episode: ${a.episode || "-"} • Rilis Baru`
        }));
        const bodyText = `–  *A N I M E K U  B E R A N D A*

Update anime terbaru dan paling populer saat ini di AnimeKuIndo:

┌  ◦  *Populer* : ${popList.length} Judul
└  ◦  *Terbaru* : ${latestList.length} Episode Baru`;
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "🔥 PILIH DARI BERANDA",
            sections: [{
              title: "Anime Terpopuler",
              rows: popRows
            }, {
              title: "Episode Baru Rilis",
              rows: latestRows
            }]
          })
        }];
        const options = {
          image: popList[0]?.thumb || latestList[0]?.thumb,
          contextInfo: {
            mentionedJid: [ctx.sender],
            forwardingScore: 999,
            isForwarded: true
          },
          quoted: quotedMsg
        };
        await ctx.react?.("✅");
        if (typeof ctx.sendCta === "function") {
          return await ctx.sendCta(bodyText, botFooter, buttons, options);
        } else {
          return await ctx.reply(bodyText, {
            quoted: quotedMsg
          });
        }
      }
      if (!query) {
        return ctx.reply(`–  *A N I M E K U  I N D O*

Pusat streaming dan unduh anime Subtitle Indonesia terlengkap.

┌  ◦  *Pencarian* : \`${prefix}animeku <judul>\`
│  ◦  *Rincian & Eps* : \`${prefix}animeku -u <link_anime>\`
│  ◦  *Stream/Download* : \`${prefix}animeku -d <link_episode>\`
│  ◦  *Beranda / Populer* : \`${prefix}animeku --popular\`
│  ◦  *Jadwal Rilis* : \`${prefix}animeku --schedule\`
│  ◦  *Sedang Tayang* : \`${prefix}animeku --ongoing\`
└  ◦  *Example* : \`${prefix}animeku One Piece\`

–  *D A F T A R  F L A G S*

┌  ◦  *-s, --search* : Cari anime berdasarkan judul
│  ◦  *-u, --url* : Buka sinopsis dan list episode
│  ◦  *-d, --download* : Putar video / link download episode
│  ◦  *--schedule* : Jadwal rilis anime mingguan
│  ◦  *--ongoing* : Anime yang sedang tayang
└  ◦  *--movie* : Anime format film layar lebar`);
      }
      await ctx.react?.("⏳");
      const {
        data
      } = await axios.get(API_URL, {
        params: {
          action: "search",
          query: query,
          limit: 15
        },
        headers: {
          "User-Agent": CONFIG.USER_AGENT
        },
        timeout: CONFIG.TIMEOUT
      });
      const results = data?.data || [];
      if (!data?.status || !results.length) {
        await ctx.react?.("❌");
        return ctx.reply(`❌ Tidak ditemukan anime untuk kata kunci: *"${query}"*`);
      }
      const topResult = results[0];
      const searchRows = results.map((item, idx) => ({
        title: `[#${idx + 1}] ${item.title}`.slice(0, 24),
        id: `${prefix}animeku -u ${item.url}`,
        description: `Tipe: ${item.type || "TV"} • Eps: ${item.episode || "-"} • ${item.status || "Selesai"}`
      }));
      const bodyText = `–  *A N I M E K U  S E A R C H*

Ditemukan ${results.length} anime untuk kata kunci: *"${query}"*.

┌  ◦  *Judul Teratas* : ${topResult.title}
│  ◦  *Status* : ${topResult.status || "Ongoing"}
│  ◦  *Episode* : ${topResult.episode || "-"}
└  ◦  *Tipe* : ${topResult.type || "Series"}

Pilih anime di bawah untuk melihat daftar episode dan sinopsis.`;
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: `🎬 HASIL PENCARIAN (${results.length})`,
          sections: [{
            title: "Daftar Judul",
            rows: searchRows
          }]
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "ℹ️ Rincian Teratas",
          id: `${prefix}animeku -u ${topResult.url}`
        })
      }];
      const options = {
        image: topResult.thumb || "https://files.catbox.moe/g2e6i5.jpg",
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `${botName} • AnimeKuIndo`,
            button_title: "Lihat Hasil"
          }
        },
        contextInfo: {
          mentionedJid: [ctx.sender],
          forwardingScore: 999,
          isForwarded: true
        },
        quoted: quotedMsg
      };
      await ctx.react?.("✅");
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, botFooter, buttons, options);
      } else {
        await sock.sendMessage(targetChat, {
          image: {
            url: topResult.thumb
          },
          caption: bodyText
        }, {
          quoted: quotedMsg
        });
      }
    } catch (error) {
      console.error("[AnimeKuIndo Error]:", error);
      await ctx.react?.("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || error.message;
      ctx.reply(`❌ Terjadi kesalahan pada AnimeKuIndo: ${errMsg}`);
    }
  }
};