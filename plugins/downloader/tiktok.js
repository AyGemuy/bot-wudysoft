import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
async function albumMessage(sock, jid, medias, m, options = {}) {
  try {
    if (typeof jid !== "string") {
      throw new TypeError(`jid harus string, diterima: ${typeof jid}`);
    }
    if (!Array.isArray(medias) || medias.length < 2) {
      throw new RangeError(`Minimal 2 media diperlukan untuk album. Diterima: ${medias?.length || 0}`);
    }
    const {
      caption = "",
        mentions = [],
        quoted,
        ephemeralExpiration
    } = options;
    const albumContent = [];
    for (const media of medias) {
      if (media.type === "image") {
        albumContent.push({
          image: media.data
        });
      } else if (media.type === "video") {
        albumContent.push({
          video: media.data
        });
      }
    }
    if (albumContent.length < 2) {
      throw new RangeError(`Tidak cukup media yang valid untuk membentuk album. Item valid: ${albumContent.length}`);
    }
    const messageContent = {
      text: caption,
      mentions: mentions,
      album: albumContent
    };
    const sendOptions = {
      quoted: m || quoted || null,
      ephemeralExpiration: ephemeralExpiration || null
    };
    return await sock.sendMessage(jid, messageContent, sendOptions);
  } catch (error) {
    throw error;
  }
}
const formatNumber = num => {
  return typeof num === "number" ? num.toLocaleString("id-ID") : num || "0";
};
const formatDate = timestamp => {
  if (!timestamp) return "-";
  return new Date(Number(timestamp) * 1e3).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
};
export default {
  name: "tiktok",
  aliases: ["tt", "ttdl", "tiktokdl"],
  description: "Download video atau foto slide TikTok tanpa watermark",
  category: "Downloader",
  execute: async (sock, ctx, msg) => {
    const url = (ctx.args[0] || ctx.query || "").trim();
    const prefix = ctx.prefix || ".";
    if (!url) {
      return ctx.reply(`–  *T I K T O K*

Silakan masukkan tautan video atau foto slide TikTok yang ingin diunduh.

┌  ◦  *Format* : ${prefix}tt <link>
└  ◦  *Example* : ${prefix}tt https://vt.tiktok.com/ZSqhXE9n4/`);
    }
    if (!/(tiktok\.com|vt\.tiktok\.com)/i.test(url)) {
      return ctx.reply("❌ Tautan TikTok tidak valid. Pastikan link diawali dengan tiktok.com");
    }
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
    const targetChat = ctx.id || ctx.chat;
    try {
      await ctx.react("⏳");
      const res = await axios.get(`${global.bot?.api?.wudysoft}/api/download/tiktok/v21`, {
        params: {
          url: url
        },
        timeout: 3e4
      });
      const data = res.data?.data;
      if (!data) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal memuat data TikTok dari server atau link bersifat privat.");
      }
      const authorName = data.author?.nickname || "-";
      const authorUsername = data.author?.unique_id ? `@${data.author.unique_id}` : "-";
      const desc = data.title ? data.title.trim() : "-";
      const musicTitle = data.music_info?.title || "Audio TikTok";
      const musicAuthor = data.music_info?.author || "-";
      const duration = data.duration ? `${data.duration}s` : "-";
      const uploadDate = formatDate(data.create_time);
      const views = formatNumber(data.play_count);
      const likes = formatNumber(data.digg_count);
      const comments = formatNumber(data.comment_count);
      const shares = formatNumber(data.share_count);
      const saves = formatNumber(data.collect_count);
      const fullCaption = `–  *T I K T O K*

┌  ◦  *Author* : ${authorName} (${authorUsername})
│  ◦  *Views* : ${views}
│  ◦  *Likes* : ${likes}
│  ◦  *Comments* : ${comments}
│  ◦  *Shares* : ${shares}
│  ◦  *Saves* : ${saves}
│  ◦  *Duration* : ${duration}
│  ◦  *Uploaded* : ${uploadDate}
└  ◦  *Audio* : ${musicTitle} (${musicAuthor})

–  *D E S C R I P T I O N*

${desc}`;
      if (data.images && Array.isArray(data.images) && data.images.length > 0) {
        const medias = data.images.map(imgUrl => ({
          type: "image",
          data: {
            url: imgUrl
          }
        }));
        if (medias.length === 1) {
          await sock.sendMessage(targetChat, {
            image: medias[0].data,
            caption: fullCaption
          }, {
            quoted: quotedMsg
          });
        } else {
          await albumMessage(sock, targetChat, medias, quotedMsg, {
            caption: fullCaption
          });
        }
      } else {
        const videoUrl = data.hdplay || data.play || data.wmplay;
        if (!videoUrl) {
          await ctx.react("❌");
          return ctx.reply("❌ Tautan video tanpa watermark tidak ditemukan.");
        }
        await sock.sendMessage(targetChat, {
          video: {
            url: videoUrl
          },
          caption: fullCaption
        }, {
          quoted: quotedMsg
        });
      }
      const audioUrl = data.music || data.music_info?.play;
      if (audioUrl) {
        try {
          await sock.sendMessage(targetChat, {
            audio: {
              url: audioUrl
            },
            mimetype: "audio/mpeg",
            fileName: `${musicTitle}.mp3`
          }, {
            quoted: quotedMsg
          });
        } catch (_) {}
      }
      await ctx.react("✅");
    } catch (e) {
      console.error("[TIKTOK DOWNLOADER ERROR]:", e);
      await ctx.react("❌");
      ctx.reply(`❌ Terjadi kesalahan: ${e.message}`);
    }
  }
};