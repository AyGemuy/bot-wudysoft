import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/anime/animein`;
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
      id: ["movie", "animeid", "i"],
      stream: ["ep", "episode", "eps"],
      popular: ["pop", "home"],
      explore: ["exp", "genre"],
      fyp: ["clip", "cuplikan"]
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
  name: "animein",
  aliases: ["anime", "ani", "anistream", "animedl"],
  description: "Cari anime, info rincian, daftar episode, streaming, & klip FYP via Animein",
  category: "Anime",
  limit: true,
  example: "• Cari: .anime One Piece\n• Detail & Episode: .anime --id 426\n• Stream Episode: .anime --stream 312514\n• Populer: .anime --popular\n• Cuplikan FYP: .anime --fyp",
  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "WudysoftBot";
    const botFooter = global.bot?.footer || `${botName} • Animein Stream Engine`;
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
    const targetChat = ctx.chat || ctx.id;
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["animein", "anime", "ani", "anistream", "animedl"].some(a => firstWord.endsWith(a))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      const query = flags.search || cleanPrompt;
      if (flags.stream) {
        const epId = String(flags.stream).trim();
        await ctx.react?.("⏳");
        const {
          data
        } = await axios.get(API_URL, {
          params: {
            action: "streams",
            id: epId
          },
          headers: {
            "User-Agent": CONFIG.USER_AGENT
          },
          timeout: CONFIG.TIMEOUT
        });
        const res = data?.result;
        const episode = res?.episode;
        const servers = res?.server || [];
        if (!episode || !servers.length) {
          await ctx.react?.("❌");
          return ctx.reply(`❌ Link streaming untuk episode ID *#${epId}* tidak ditemukan.`);
        }
        const serverRows = servers.map(srv => ({
          title: `▶️ Kualitas ${srv.quality || "Default"}`,
          id: `${prefix}anime --stream ${epId}`,
          description: `Server: ${srv.name || "Direct"} • Tipe: ${srv.type || "MP4"}`
        }));
        const bodyText = `–  *A N I M E I N  S T R E A M*

┌  ◦  *Judul* : ${episode.title || `Episode ${episode.index}`}
│  ◦  *Views* : ${Number(episode.views || 0).toLocaleString("id-ID")}x
└  ◦  *Rilis* : ${episode.key_time || "-"}

Pilih kualitas pemutaran video di bawah ini:`;
        const buttons = [];
        const bestServer = servers[servers.length - 1];
        if (bestServer?.link) {
          buttons.push({
            name: "cta_url",
            buttonParamsJson: JSON.stringify({
              display_text: `🎬 Tonton (${bestServer.quality})`,
              url: bestServer.link,
              merchant_url: bestServer.link
            })
          });
        }
        buttons.push({
          name: "cta_copy",
          buttonParamsJson: JSON.stringify({
            display_text: "📋 Salin Link Video",
            copy_code: bestServer?.link || servers[0]?.link
          })
        });
        if (res.episode_next?.id) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "⏭️ Episode Selanjutnya",
              id: `${prefix}anime --stream ${res.episode_next.id}`
            })
          });
        }
        const options = {
          image: episode.image || "https://files.catbox.moe/g2e6i5.jpg",
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
              url: episode.image
            },
            caption: `${bodyText}\n\n🔗 *Link Video:* ${bestServer?.link || servers[0]?.link}`
          }, {
            quoted: quotedMsg
          });
        }
      }
      if (flags.id) {
        const movieId = String(flags.id).trim();
        await ctx.react?.("⏳");
        const {
          data
        } = await axios.get(API_URL, {
          params: {
            action: "info",
            input: movieId
          },
          headers: {
            "User-Agent": CONFIG.USER_AGENT
          },
          timeout: CONFIG.TIMEOUT
        });
        const movie = data?.result?.movie;
        const episodes = data?.result?.episodes || [];
        if (!movie) {
          await ctx.react?.("❌");
          return ctx.reply(`❌ Anime dengan ID *#${movieId}* tidak ditemukan.`);
        }
        const cleanSynopsis = (movie.synopsis || "Tidak ada sinopsis.").replace(/\r\n/g, "\n").trim();
        const shortSynopsis = cleanSynopsis.length > 350 ? `${cleanSynopsis.slice(0, 350)}...` : cleanSynopsis;
        const episodeRows = episodes.slice(0, 15).map(ep => ({
          title: `${ep.title || `Episode ${ep.index}`}`,
          id: `${prefix}anime --stream ${ep.id}`,
          description: `Tanggal: ${ep.key_time || "-"} • Views: ${Number(ep.views || 0).toLocaleString("id-ID")}`
        }));
        const bodyText = `–  *A N I M E I N  I N F O*

┌  ◦  *Judul* : ${movie.title}
│  ◦  *Status* : ${movie.status || "-"} (${movie.year || "-"})
│  ◦  *Tipe* : ${movie.type || "Series"}
│  ◦  *Studio* : ${movie.studio || "-"}
│  ◦  *Genre* : ${movie.genre || "-"}
│  ◦  *Favorit* : ${Number(movie.favorites || 0).toLocaleString("id-ID")}
└  ◦  *Views* : ${Number(movie.views || 0).toLocaleString("id-ID")}x

–  *S I N O P S I S*

“${shortSynopsis}”

Pilih episode di bawah untuk mulai memutar video.`;
        const listSections = [{
          title: `DAFTAR EPISODE (${episodes.length} Total)`,
          rows: episodeRows
        }];
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "📺 PILIH EPISODE",
            sections: listSections
          })
        }];
        if (episodes[0]?.id) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "▶️ Putar Episode Terbaru",
              id: `${prefix}anime --stream ${episodes[0].id}`
            })
          });
        }
        const options = {
          image: movie.image_cover || movie.image_poster,
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 1,
              divider_indices: [1],
              list_title: `${botName} • Animein`,
              button_title: "Lihat Episode"
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
              url: movie.image_poster || movie.image_cover
            },
            caption: bodyText
          }, {
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
            action: "home",
            include: "popular",
            limit: 10
          },
          headers: {
            "User-Agent": CONFIG.USER_AGENT
          },
          timeout: CONFIG.TIMEOUT
        });
        const popularList = data?.result?.movie || [];
        if (!popularList.length) {
          await ctx.react?.("❌");
          return ctx.reply("❌ Gagal memuat daftar anime populer.");
        }
        const popularRows = popularList.map((m, i) => ({
          title: `[#${i + 1}] ${m.title}`.slice(0, 24),
          id: `${prefix}anime --id ${m.id}`,
          description: `Genre: ${m.genre?.slice(0, 30) || "-"} • ⭐ ${m.favorites || 0}`
        }));
        const bodyText = `–  *A N I M E  P O P U L E R*

Berikut adalah anime terpopuler yang sedang banyak ditonton di Animein:

┌  ◦  *Total* : ${popularList.length} Anime
└  ◦  *Pilihan* : Buka menu di bawah untuk rincian & episode`;
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "🔥 PILIH ANIME POPULER",
            sections: [{
              title: "Anime Trending",
              rows: popularRows
            }]
          })
        }];
        const options = {
          image: popularList[0]?.image_cover || popularList[0]?.image_poster,
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
      if (flags.fyp) {
        await ctx.react?.("⏳");
        const {
          data
        } = await axios.get(API_URL, {
          params: {
            action: "getFyp"
          },
          headers: {
            "User-Agent": CONFIG.USER_AGENT
          },
          timeout: CONFIG.TIMEOUT
        });
        const fypList = data?.result?.fyp || [];
        if (!fypList.length) {
          await ctx.react?.("❌");
          return ctx.reply("❌ Gagal memuat cuplikan klip FYP.");
        }
        const topFyp = fypList[0];
        const fypRows = fypList.slice(0, 10).map((clip, idx) => ({
          title: `[#${idx + 1}] ${clip.anime}`.slice(0, 24),
          id: `${prefix}anime --stream ${clip.id_episode}`,
          description: `${clip.episode} • Caption: "${clip.caption?.slice(0, 25) || "-"}"`
        }));
        const bodyText = `–  *A N I M E  F Y P  C L I P S*

Cuplikan momen anime favorit dari komunitas:

┌  ◦  *Anime* : ${topFyp.anime}
│  ◦  *Episode* : ${topFyp.episode}
│  ◦  *Caption* : “${topFyp.caption || "-"}”
└  ◦  *Diupload Oleh* : @${topFyp.username || "User"}`;
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "🎬 DAFTAR KLIP FYP",
            sections: [{
              title: "Cuplikan Komunitas",
              rows: fypRows
            }]
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "▶️ Nonton Full Episode",
            id: `${prefix}anime --stream ${topFyp.id_episode}`
          })
        }];
        const options = {
          image: topFyp.url_thumbnail || topFyp.poster,
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
        return ctx.reply(`–  *A N I M E I N  E N G I N E*

Akses streaming & database anime terlengkap Subtitle Indonesia.

┌  ◦  *Pencarian* : \`${prefix}anime <judul>\`
│  ◦  *Rincian & Eps* : \`${prefix}anime --id <anime_id>\`
│  ◦  *Stream Video* : \`${prefix}anime --stream <episode_id>\`
│  ◦  *Daftar Populer* : \`${prefix}anime --popular\`
│  ◦  *Klip FYP* : \`${prefix}anime --fyp\`
└  ◦  *Example* : \`${prefix}anime One Piece\`

–  *D A F T A R  F L A G S*

┌  ◦  *--id <id>* : Buka detail anime dan daftar episode
│  ◦  *--stream <id>* : Putar video / link streaming episode
│  ◦  *--popular* : Menampilkan 10 anime paling populer
└  ◦  *--fyp* : Jelajahi klip cuplikan momen anime`);
      }
      await ctx.react?.("⏳");
      const {
        data
      } = await axios.get(API_URL, {
        params: {
          action: "search",
          keyword: query
        },
        headers: {
          "User-Agent": CONFIG.USER_AGENT
        },
        timeout: CONFIG.TIMEOUT
      });
      const movies = data?.result?.movie || [];
      if (!movies.length) {
        await ctx.react?.("❌");
        return ctx.reply(`❌ Tidak ditemukan anime untuk kata kunci: *"${query}"*`);
      }
      const topAnime = movies[0];
      const searchRows = movies.slice(0, 10).map((item, idx) => ({
        title: `[#${idx + 1}] ${item.title}`.slice(0, 24),
        id: `${prefix}anime --id ${item.id}`,
        description: `Tipe: ${item.type} • Status: ${item.status} (${item.year})`
      }));
      const bodyText = `–  *A N I M E I N  S E A R C H*

Ditemukan ${movies.length} judul anime untuk kata kunci: *"${query}"*.

┌  ◦  *Judul Teratas* : ${topAnime.title}
│  ◦  *Tipe* : ${topAnime.type} (${topAnime.year})
│  ◦  *Status* : ${topAnime.status}
│  ◦  *Genre* : ${topAnime.genre?.slice(0, 35) || "-"}
└  ◦  *Views* : ${Number(topAnime.views || 0).toLocaleString("id-ID")}x

Pilih anime dari daftar di bawah untuk melihat rincian dan daftar episode.`;
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: `🎬 HASIL PENCARIAN (${movies.length})`,
          sections: [{
            title: "Pilih Anime",
            rows: searchRows
          }]
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "ℹ️ Rincian Teratas",
          id: `${prefix}anime --id ${topAnime.id}`
        })
      }];
      const options = {
        image: topAnime.image_cover || topAnime.image_poster,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `${botName} • Animein`,
            button_title: "Buka Pilihan"
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
            url: topAnime.image_poster || topAnime.image_cover
          },
          caption: bodyText
        }, {
          quoted: quotedMsg
        });
      }
    } catch (error) {
      console.error("[Animein Error]:", error);
      await ctx.react?.("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || error.message;
      ctx.reply(`❌ Terjadi kendala pada Animein Engine: ${errMsg}`);
    }
  }
};