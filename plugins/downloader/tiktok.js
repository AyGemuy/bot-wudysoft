import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
async function sendSmartAlbum(sock, jid, items = [], options = {}) {
  if (!Array.isArray(items) || items.length === 0) return null;
  const {
    caption = "",
      quoted,
      albumDelay = 1500
  } = options;
  const formattedList = items.map((item, idx) => {
    const itemCaption = idx === 0 ? caption : item.caption || "";
    const mediaTarget = typeof item.url === "string" ? {
      url: item.url
    } : item.url || item.data;
    if (item.type === "video") {
      return {
        video: mediaTarget,
        caption: itemCaption
      };
    }
    return {
      image: mediaTarget,
      caption: itemCaption
    };
  });
  if (typeof sock?.album === "function") {
    try {
      const builder = sock.album();
      for (const item of formattedList) {
        const mediaUrl = item.image?.url || item.video?.url || item.image || item.video;
        const cap = item.caption || "";
        if (item.video && typeof builder.video === "function") {
          builder.video(mediaUrl, cap);
        } else if (typeof builder.image === "function") {
          builder.image(mediaUrl, cap);
        }
      }
      if (typeof builder.setQuoted === "function" && quoted) {
        builder.setQuoted(quoted);
      }
      if (typeof builder.send === "function") {
        return await builder.send(jid, {
          quoted: quoted,
          ...options
        });
      }
    } catch (_) {}
  }
  if (typeof sock?.sendAlbumMessage === "function") {
    try {
      return await sock.sendAlbumMessage(jid, formattedList, quoted);
    } catch (_) {}
  }
  try {
    return await sock.sendMessage(jid, {
      albumMessage: formattedList
    }, {
      albumDelay: albumDelay,
      quoted: quoted
    });
  } catch (_) {}
  for (let i = 0; i < formattedList.length; i++) {
    const msgPayload = formattedList[i];
    await sock.sendMessage(jid, msgPayload, {
      quoted: i === 0 ? quoted : undefined
    });
    if (i < formattedList.length - 1) {
      await new Promise(r => setTimeout(r, 600));
    }
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
          url: imgUrl
        }));
        if (medias.length === 1) {
          await sock.sendMessage(targetChat, {
            image: {
              url: medias[0].url
            },
            caption: fullCaption
          }, {
            quoted: quotedMsg
          });
        } else {
          await sendSmartAlbum(sock, targetChat, medias, {
            caption: fullCaption,
            quoted: quotedMsg,
            albumDelay: 1500
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