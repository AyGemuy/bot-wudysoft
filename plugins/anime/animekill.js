import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/anime/animekill`;
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
      id: ["anime_id", "i", "slug"],
      episode: ["ep", "e", "eps", "ep_num"],
      popular: ["home", "top", "pop"],
      movie: ["mov"],
      short: ["drama", "shortdrama"],
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
  return {
    flags: flags,
    cleanPrompt: cleanPrompt
  };
}
export default {
  name: "animekill",
  aliases: ["donghua", "akill", "donghuastream", "chinanime"],
  description: "Streaming, detail, dan pencarian Donghua / Anime Asia via Animekill",
  category: "Anime",
  limit: true,
  example: "• Cari: .donghua Battle Through The Heavens\n• Detail: .donghua --id walking-the-way-all-alone\n• Streaming: .donghua --id walking-the-way-all-alone -e 1\n• Beranda Populer: .donghua --popular",
  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "WudysoftBot";
    const botFooter = global.bot?.footer || `${botName} • Donghua Stream Engine`;
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
    const targetChat = ctx.chat || ctx.id;
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["animekill", "donghua", "akill", "donghuastream", "chinanime"].some(a => firstWord.endsWith(a))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      const query = flags.search || cleanPrompt;
      if (flags.id && flags.episode !== undefined) {
        const animeId = String(flags.id).trim();
        const epNum = Number(flags.episode) || 1;
        await ctx.react?.("⏳");
        const {
          data
        } = await axios.get(API_URL, {
          params: {
            action: "stream",
            anime_id: animeId,
            ep_num: epNum
          },
          headers: {
            "User-Agent": CONFIG.USER_AGENT
          },
          timeout: CONFIG.TIMEOUT
        });
        const servers = Array.isArray(data?.data) ? data.data : [];
        if (!data?.status || !servers.length) {
          await ctx.react?.("❌");
          return ctx.reply(`❌ Server streaming untuk *${animeId}* Episode ${epNum} tidak ditemukan atau belum rilis.`);
        }
        const aliveServers = servers.filter(s => s.isAlive !== false);
        const indoServer = aliveServers.find(s => s.languageIso?.includes("id") || /indonesia/i.test(s.title)) || aliveServers[0] || servers[0];
        const targetTitle = indoServer.targetEpisode?.title || `${animeId.toUpperCase()} - Episode ${epNum}`;
        const serverRows = aliveServers.slice(0, 10).map((srv, idx) => ({
          title: `[#${idx + 1}] ${srv.title}`.slice(0, 24),
          id: `${prefix}donghua --id ${animeId} -e ${epNum}`,
          description: `Subtitle: ${srv.languageIso?.slice(0, 5).join(", ") || "Multi Sub"}`
        }));
        const bodyText = `–  *D O N G H U A  S T R E A M*

┌  ◦  *Judul* : ${targetTitle}
│  ◦  *Episode* : Episode ${epNum}
│  ◦  *Server Rekomendasi* : ${indoServer.title}
└  ◦  *Server Aktif* : ${aliveServers.length} Server

Pilih opsi tombol di bawah untuk memutar video atau menyalin link:`;
        const buttons = [];
        if (indoServer?.decodeUrl) {
          buttons.push({
            name: "cta_url",
            buttonParamsJson: JSON.stringify({
              display_text: "🎬 Tonton Video",
              url: indoServer.decodeUrl,
              merchant_url: indoServer.decodeUrl
            })
          });
          buttons.push({
            name: "cta_copy",
            buttonParamsJson: JSON.stringify({
              display_text: "📋 Salin Link Stream",
              copy_code: indoServer.decodeUrl
            })
          });
        }
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `⏭️ Episode ${epNum + 1}`,
            id: `${prefix}donghua --id ${animeId} -e ${epNum + 1}`
          })
        });
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
          return await ctx.reply(`${bodyText}\n\n🔗 *Link Video:* ${indoServer?.decodeUrl || "Direct Link"}`, {
            quoted: quotedMsg
          });
        }
      }
      if (flags.id) {
        const animeId = String(flags.id).trim();
        await ctx.react?.("⏳");
        const [detailRes, epRes] = await Promise.all([axios.get(API_URL, {
          params: {
            action: "detail",
            anime_id: animeId
          },
          headers: {
            "User-Agent": CONFIG.USER_AGENT
          },
          timeout: CONFIG.TIMEOUT
        }).catch(() => null), axios.get(API_URL, {
          params: {
            action: "episodes",
            anime_id: animeId
          },
          headers: {
            "User-Agent": CONFIG.USER_AGENT
          },
          timeout: CONFIG.TIMEOUT
        }).catch(() => null)]);
        const anime = detailRes?.data?.data?.animeDetails;
        if (!anime) {
          await ctx.react?.("❌");
          return ctx.reply(`❌ Donghua dengan ID *"${animeId}"* tidak ditemukan.`);
        }
        const episodes = epRes?.data?.data?.animeVideos || [];
        const cleanDesc = (anime.description || "Tidak ada deskripsi.").slice(0, 300);
        const uniqueEpNums = Array.from(new Set(episodes.map(e => e.episodeNumber).filter(Boolean)));
        const episodeRows = uniqueEpNums.slice(0, 20).map(num => ({
          title: `▶️ Episode ${num}`,
          id: `${prefix}donghua --id ${animeId} -e ${num}`,
          description: `Putar streaming Episode ${num}`
        }));
        const bodyText = `–  *D O N G H U A  I N F O*

┌  ◦  *Nama* : ${anime.name}
│  ◦  *Origin* : ${(anime.anime_origin || "Chinese").toUpperCase()} (${anime.anime_type || "3D"})
│  ◦  *Skor* : ⭐ ${anime.score || "N/A"}
│  ◦  *Genre* : ${anime.genre || "-"}
│  ◦  *Ditonton* : ${Number(anime.total_watch || 0).toLocaleString("id-ID")}x
└  ◦  *Total Episode* : ${uniqueEpNums.length || anime.total_episodes || "-"} Episode

–  *S I N O P S I S*

“${cleanDesc}...”

Pilih episode pada menu di bawah untuk menonton.`;
        const listSections = [{
          title: `DAFTAR EPISODE (${uniqueEpNums.length} Rilis)`,
          rows: episodeRows.length ? episodeRows : [{
            title: "▶️ Episode 1",
            id: `${prefix}donghua --id ${animeId} -e 1`,
            description: "Mulai tonton dari episode pertama"
          }]
        }];
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "📺 PILIH EPISODE",
            sections: listSections
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "▶️ Putar Episode 1",
            id: `${prefix}donghua --id ${animeId} -e 1`
          })
        }];
        const banner = anime.large_poster && anime.large_poster !== "na" ? anime.large_poster : anime.small_poster || "https://files.catbox.moe/g2e6i5.jpg";
        const options = {
          image: banner,
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 1,
              divider_indices: [1],
              list_title: `${botName} • Animekill`,
              button_title: "Daftar Episode"
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
              url: banner
            },
            caption: bodyText
          }, {
            quoted: quotedMsg
          });
        }
      }
      if (flags.popular || flags.movie || flags.short) {
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
        const homeData = data?.data || {};
        let selectedList = [];
        let sectionTitle = "Donghua Populer";
        if (flags.movie) {
          selectedList = homeData.popularMovies || [];
          sectionTitle = "Film Layar Lebar (Movie)";
        } else if (flags.short) {
          selectedList = homeData.shortDramaAnime || [];
          sectionTitle = "Short Drama Anime";
        } else {
          selectedList = homeData.topPickChinese || homeData.topBannerAnime || [];
        }
        if (!selectedList.length) {
          await ctx.react?.("❌");
          return ctx.reply("❌ Gagal memuat daftar Donghua beranda.");
        }
        const rows = selectedList.slice(0, 15).map((item, idx) => ({
          title: `[#${idx + 1}] ${item.name}`.slice(0, 24),
          id: `${prefix}donghua --id ${item.anime_id}`,
          description: `Skor: ⭐${item.score || "-"} • Type: ${item.anime_type || "3D"}`
        }));
        const bodyText = `–  *D O N G H U A  P O P U L E R*

Rekomendasi Donghua & Anime Asia teratas di Animekill:

┌  ◦  *Kategori* : ${sectionTitle}
│  ◦  *Total Judul* : ${selectedList.length} Judul
└  ◦  *Pilihan* : Buka menu interaktif di bawah untuk memilih judul`;
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "🔥 PILIH DONGHUA",
            sections: [{
              title: sectionTitle,
              rows: rows
            }]
          })
        }];
        const topBanner = selectedList[0]?.large_poster && selectedList[0]?.large_poster !== "na" ? selectedList[0]?.large_poster : selectedList[0]?.small_poster || "https://files.catbox.moe/g2e6i5.jpg";
        const options = {
          image: topBanner,
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
        return ctx.reply(`–  *A N I M E K I L L  D O N G H U A*

Pusat streaming dan database Donghua (3D/2D Chinese Animation) terlengkap.

┌  ◦  *Pencarian* : \`${prefix}donghua <judul>\`
│  ◦  *Detail Info* : \`${prefix}donghua --id <anime_id>\`
│  ◦  *Putar Episode* : \`${prefix}donghua --id <anime_id> -e <nomor_eps>\`
│  ◦  *Beranda Populer* : \`${prefix}donghua --popular\`
│  ◦  *Movie / Bioskop* : \`${prefix}donghua --movie\`
│  ◦  *Short Drama* : \`${prefix}donghua --short\`
└  ◦  *Example* : \`${prefix}donghua Slay The Gods\`

–  *D A F T A R  F L A G S*

┌  ◦  *-s, --search* : Kata kunci judul Donghua
│  ◦  *--id* : Slug ID serial Donghua
│  ◦  *-e, --ep* : Nomor episode untuk diputar
│  ◦  *--popular* : Menampilkan donghua trending
└  ◦  *--movie* : Menampilkan movie donghua`);
      }
      await ctx.react?.("⏳");
      const {
        data
      } = await axios.get(API_URL, {
        params: {
          action: "search",
          query: query
        },
        headers: {
          "User-Agent": CONFIG.USER_AGENT
        },
        timeout: CONFIG.TIMEOUT
      });
      const animeList = data?.data?.animelist || [];
      if (!data?.status || !animeList.length) {
        await ctx.react?.("❌");
        return ctx.reply(`❌ Tidak ditemukan Donghua untuk kata kunci: *"${query}"*`);
      }
      const topResult = animeList[0];
      const searchRows = animeList.slice(0, 15).map((item, idx) => ({
        title: `[#${idx + 1}] ${item.name}`.slice(0, 24),
        id: `${prefix}donghua --id ${item.anime_id}`,
        description: `Tipe: ${item.anime_type || "3D"} • Genre: ${item.genre?.slice(0, 25) || "-"}`
      }));
      const bodyText = `–  *D O N G H U A  S E A R C H*

Ditemukan ${animeList.length} serial untuk kata kunci: *"${query}"*.

┌  ◦  *Judul Teratas* : ${topResult.name}
│  ◦  *Origin* : ${(topResult.anime_origin || "Chinese").toUpperCase()}
│  ◦  *Format* : ${topResult.anime_type || "3D Animation"}
│  ◦  *Genre* : ${topResult.genre || "-"}
└  ◦  *Total Watch* : ${Number(topResult.total_watch || 0).toLocaleString("id-ID")}x

Pilih Donghua dari menu di bawah untuk membuka sinopsis dan daftar episode.`;
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: `🎬 HASIL PENCARIAN (${animeList.length})`,
          sections: [{
            title: "Pilih Judul Donghua",
            rows: searchRows
          }]
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "ℹ️ Rincian Teratas",
          id: `${prefix}donghua --id ${topResult.anime_id}`
        })
      }];
      const banner = topResult.large_poster && topResult.large_poster !== "na" ? topResult.large_poster : topResult.small_poster || "https://files.catbox.moe/g2e6i5.jpg";
      const options = {
        image: banner,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `${botName} • Donghua`,
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
            url: banner
          },
          caption: bodyText
        }, {
          quoted: quotedMsg
        });
      }
    } catch (error) {
      console.error("[Animekill Error]:", error);
      await ctx.react?.("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || error.message;
      ctx.reply(`❌ Terjadi kendala pada Donghua Engine: ${errMsg}`);
    }
  }
};