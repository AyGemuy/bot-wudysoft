import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/nsfw/tik-porn`;
const formatNumber = num => typeof num === "number" ? num.toLocaleString("id-ID") : num || "0";
async function searchTikPornWeb(query) {
  try {
    const res = await axios.get(`https://tik.porn/?s=${encodeURIComponent(query)}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36",
        "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
        Referer: `https://tik.porn/?s=${encodeURIComponent(query)}`,
        "x-nextjs-data": "1"
      },
      timeout: 25e3
    });
    let pageProps = null;
    if (typeof res.data === "object" && res.data?.pageProps) {
      pageProps = res.data.pageProps;
    } else if (typeof res.data === "string") {
      const match = res.data.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
      if (match) {
        const nextData = JSON.parse(match[1]);
        pageProps = nextData?.props?.pageProps;
      }
    }
    if (pageProps) {
      const initialResults = pageProps.initialResults?.data || [];
      const collectedVideos = [];
      for (const group of initialResults) {
        const modelName = group.name || "TikPorn";
        const vids = group.videos || [];
        for (const v of vids) {
          collectedVideos.push({
            video_id: v.video_id,
            title: `${modelName} #${v.video_id}`,
            action_name: modelName,
            poster_url: v.poster_url,
            thumbnail_url: v.thumbnail_url,
            stars: modelName,
            view_count: group.videoCount ? `${group.videoCount} videos` : "-"
          });
        }
      }
      return {
        total: pageProps.searchTerm?.aggregations?.videosCount || collectedVideos.length,
        description: pageProps.searchTerm?.description || "",
        videos: collectedVideos
      };
    }
  } catch (e) {
    console.error("[TikPorn Search Web Error]", e?.message);
  }
  return null;
}

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /--([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1];
    let rawVal = match[2];
    let val = true;
    const lowerKey = key.toLowerCase();
    if (["play", "detail", "get", "id", "d", "v", "videoid"].includes(lowerKey)) key = "id";
    if (["search", "q", "find", "s", "query"].includes(lowerKey)) key = "search";
    if (["popular", "pop", "p"].includes(lowerKey)) key = "popular";
    if (["random", "rand", "r"].includes(lowerKey)) key = "random";
    if (["recent", "new", "n", "latest"].includes(lowerKey)) key = "recent";
    if (["recommend", "recom", "rec"].includes(lowerKey)) key = "recommend";
    if (["page", "pg"].includes(lowerKey)) key = "page";
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
  name: "tikporn",
  aliases: ["tp", "tikp", "tikporno"],
  description: "Cari dan tonton video TikPorn (CTA Media List & Bottom Sheet)",
  category: "NSFW",
  limit: true,
  example: "tikporn jasmine atau tikporn --random atau tikporn --id 508005",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["tikporn", "tp", "tikp", "tikporno"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      const sendVideoResult = async video => {
        const videoUrl = video.mp4_url || video.download_url;
        if (!video || !videoUrl) {
          await ctx.react("❌");
          return ctx.reply("❌ Video tidak ditemukan atau link download telah kedaluwarsa.");
        }
        const title = video.video_text?.meta_title?.default?.text || video.action_name || `TikPorn Video #${video.video_id}`;
        const pornstars = video.pornstars?.map(p => p.name).join(", ") || "-";
        const producer = video.producer_name || "Community";
        const views = formatNumber(video.view_count);
        const likes = formatNumber(video.like_count);
        const tags = video.tags?.map(t => `#${t.slug || t.name}`).slice(0, 5).join(" ") || "-";
        const duration = video.duration ? `${video.duration} detik` : "-";
        const caption = `🔞 *TIKPORN VIDEO DETAIL*\n\n` + `• *Judul:* ${title}\n` + `• *Artis:* ${pornstars}\n` + `• *Studio:* ${producer}\n` + `• *Durasi:* ${duration}\n` + `• *Dilihat:* ${views} kali\n` + `• *Disukai:* ${likes} orang\n` + `• *Tags:* ${tags}\n` + `• *Video ID:* \`${video.video_id}\`\n\n` + `🔗 *Direct Link:*\n${videoUrl}`;
        try {
          const {
            data: videoBuffer
          } = await axios.get(videoUrl, {
            responseType: "arraybuffer",
            timeout: 6e4,
            maxContentLength: 80 * 1024 * 1024
          });
          await sock.sendMessage(ctx.id, {
            video: Buffer.from(videoBuffer),
            caption: caption,
            mimetype: "video/mp4"
          }, {
            quoted: quotedMsg
          });
          await ctx.react("✅");
          return;
        } catch (mediaErr) {
          const poster = video.poster_url || video.thumbnail_url || video.medium_thumb;
          const fallbackText = caption + `\n\n⚠️ _Peringatan: Ruang penyimpanan disk server bot sedang penuh (ENOSPC). Video dapat diputar/diunduh langsung melalui tombol di bawah._`;
          if (typeof ctx.sendCta === "function") {
            await ctx.sendCta(fallbackText, `${botName} • TikPorn Stream`, [{
              name: "cta_url",
              display_text: "▶️ Tonton Video Langsung",
              url: videoUrl
            }], {
              image: poster || undefined,
              params: {
                bottom_sheet: {
                  in_thread_buttons_limit: 1,
                  divider_indices: [1],
                  list_title: `${botName} • TikPorn Player`,
                  button_title: "Putar Video"
                }
              },
              quoted: quotedMsg
            });
          } else {
            await ctx.reply(fallbackText, {
              quoted: quotedMsg
            });
          }
          await ctx.react("⚠️");
          return;
        }
      };
      const videoId = flags.id || null;
      if (videoId) {
        await ctx.react("⏳");
        const {
          data: res
        } = await axios.post(API_URL, {
          action: "video_info",
          videoid: Number(videoId) || videoId
        }, {
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
          },
          timeout: 4e4
        });
        const video = res?.data || res?.result || res;
        return await sendVideoResult(video);
      }
      if (flags.random) {
        await ctx.react("⏳");
        const {
          data: res
        } = await axios.post(API_URL, {
          action: "video_recomendation"
        }, {
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
          },
          timeout: 3e4
        });
        const list = res?.data || res?.results || [];
        if (!list.length) {
          await ctx.react("❌");
          return ctx.reply("❌ Gagal mendapatkan rekomendasi video acak.");
        }
        const randomVideo = list[Math.floor(Math.random() * list.length)];
        return await sendVideoResult(randomVideo);
      }
      if (!rawText && !flags.popular && !flags.recent && !flags.recommend) {
        return ctx.reply(`🔞 *TIKPORN NSFW PLAYER*\n\n` + `• *Cara Penggunaan:*\n` + `  👉 Cari video: \`${prefix}tikporn jasmine\`\n` + `  👉 Video acak: \`${prefix}tikporn --random\`\n` + `  👉 Tonton spesifik: \`${prefix}tikporn --id 508005\`\n\n` + `• *Menu & Filter Cepat:*\n` + `  👉 \`${prefix}tikporn --popular\` (Video populer)\n` + `  👉 \`${prefix}tikporn --recent\` (Video terbaru)\n` + `  👉 \`${prefix}tikporn --recommend\` (Rekomendasi feed)\n\n` + `• *Opsi Flags:*\n` + `  • \`--page <nomor>\` (Navigasi halaman)`);
      }
      await ctx.react("⏳");
      const searchQuery = flags.search || cleanPrompt || "";
      let videoList = [];
      let totalFound = 0;
      let filterTitle = "";
      const page = Number(flags.page) || 1;
      if (searchQuery) {
        filterTitle = `Cari: "${searchQuery}"`;
        const webSearch = await searchTikPornWeb(searchQuery);
        if (webSearch && webSearch.videos.length > 0) {
          videoList = webSearch.videos;
          totalFound = webSearch.total;
        } else {
          const {
            data: res
          } = await axios.post(API_URL, {
            action: "listing_search",
            q: searchQuery,
            page: page
          }, {
            headers: {
              "Content-Type": "application/json"
            },
            timeout: 3e4
          });
          videoList = res?.data || res?.results || [];
          totalFound = videoList.length;
        }
      } else {
        let actionType = "video_recomendation";
        if (flags.popular) actionType = "popular_videos";
        else if (flags.recent) actionType = "recent_videos";
        filterTitle = actionType.replace(/_/g, " ").toUpperCase();
        const {
          data: res
        } = await axios.post(API_URL, {
          action: actionType,
          page: page
        }, {
          headers: {
            "Content-Type": "application/json"
          },
          timeout: 3e4
        });
        videoList = res?.data || res?.results || [];
        totalFound = videoList.length;
      }
      if (!videoList.length) {
        await ctx.react("❌");
        return ctx.reply(`❌ Tidak ditemukan video untuk: *"${searchQuery || filterTitle}"*`);
      }
      const firstPoster = videoList[0]?.poster_url || videoList[0]?.thumbnail_url;
      const videoRows = videoList.slice(0, 15).map(v => {
        const title = v.title || v.video_text?.meta_title?.default?.text || v.action_name || `Video #${v.video_id}`;
        const stars = v.stars || v.pornstars?.map(p => p.name).join(", ") || "";
        return {
          title: title.slice(0, 24),
          description: `${stars ? stars + " • " : ""}ID: ${v.video_id} (Putar Video)`,
          id: `${prefix}tikporn --id ${v.video_id}`
        };
      });
      const navRows = [{
        title: "🎲 Video Acak (Random)",
        description: "Putar 1 video acak langsung",
        id: `${prefix}tikporn --random`
      }, {
        title: "🔥 Video Terpopuler",
        description: "Video dengan likes & views terbanyak",
        id: `${prefix}tikporn --popular`
      }, {
        title: "🆕 Baru Ditambahkan",
        description: "Video rilis paling baru",
        id: `${prefix}tikporn --recent`
      }];
      const sections = [{
        title: `🔞 DAFTAR VIDEO (Hal ${page})`,
        rows: videoRows
      }, {
        title: "📂 KATEGORI & AKSI CEPAT",
        rows: navRows
      }];
      const bodyText = `🔞 *TIKPORN SEARCH & EXPLORER*\n\n` + `• *Filter:* ${filterTitle}\n` + `• *Total Ditemukan:* ${formatNumber(totalFound)} Video\n` + `• *Halaman:* ${page}\n\n` + `_Pilih video di bawah untuk langsung mengunduh & memutar video!_`;
      const footerText = `${botName} • TikPorn Clips`;
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: `🔞 Pilih Video (${videoRows.length})`,
          sections: sections
        })
      }];
      let baseCmd = `${prefix}tikporn`;
      if (searchQuery) baseCmd += ` --search "${searchQuery}"`;
      else if (flags.popular) baseCmd += ` --popular`;
      else if (flags.recent) baseCmd += ` --recent`;
      if (page > 1) {
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `⬅️ Hal ${page - 1}`,
            id: `${baseCmd} --page ${page - 1}`
          })
        });
      }
      if (videoList.length >= 10) {
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `➡️ Hal ${page + 1}`,
            id: `${baseCmd} --page ${page + 1}`
          })
        });
      }
      const options = {
        image: firstPoster || undefined,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `${botName} • TikPorn Explorer`,
            button_title: "Lihat Video"
          }
        },
        quoted: quotedMsg
      };
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, footerText, buttons, options);
      } else {
        let fallback = `🔞 *DAFTAR TIKPORN*\n\n`;
        fallback += videoRows.map(r => `• *${r.title}*\n  Perintah: \`${r.id}\``).join("\n\n");
        await ctx.reply(fallback);
      }
      await ctx.react("✅");
    } catch (error) {
      await ctx.react("❌");
      let errMsg = error.message;
      if (error.response?.data) {
        errMsg = error.response.data?.message || error.response.data?.error || errMsg;
      }
      ctx.reply(`❌ TikPorn Error: ${errMsg}`);
    }
  }
};