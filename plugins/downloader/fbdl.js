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
export default {
  name: "facebook",
  aliases: ["fb", "fbdl", "facebookdl"],
  description: "Download video atau foto postingan Facebook",
  category: "Downloader",
  execute: async (sock, ctx, msg) => {
    const url = (ctx.args[0] || ctx.query || "").trim();
    const prefix = ctx.prefix || ".";
    if (!url) {
      return ctx.reply(`–  *F A C E B O O K*

Silakan masukkan tautan postingan Facebook yang ingin diunduh.

┌  ◦  *Format* : ${prefix}fb <link>
└  ◦  *Example* : ${prefix}fb https://www.facebook.com/share/p/1JMGYsqpSu/`);
    }
    if (!/(facebook\.com|fb\.watch|fb\.com)/i.test(url)) {
      return ctx.reply("❌ Tautan Facebook tidak valid. Pastikan link berasal dari Facebook.");
    }
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
    const targetChat = ctx.id || ctx.chat;
    try {
      await ctx.react("⏳");
      const res = await axios.get(`${global.bot?.api?.wudysoft}/api/download/facebook/v4`, {
        params: {
          url: url
        },
        timeout: 45e3
      });
      const data = res.data?.data || res.data?.result || res.data;
      if (!data || !data.downloads && !data.image) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal mengambil data media Facebook. Pastikan postingan bersifat publik.");
      }
      const desc = data.text && data.text.trim() !== "..." ? data.text.trim() : "-";
      const downloads = Array.isArray(data.downloads) ? data.downloads : [];
      const isVideo = downloads.some(item => /(video|hd|sd|mp4|\d+p)/i.test(item.downloadText || item.quality || ""));
      if (isVideo) {
        const bestVideo = downloads.find(item => /hd/i.test(item.quality || item.downloadText || "")) || downloads.find(item => /sd/i.test(item.quality || item.downloadText || "")) || downloads[0];
        const videoUrl = bestVideo?.link;
        if (!videoUrl) {
          await ctx.react("❌");
          return ctx.reply("❌ Tautan video tidak ditemukan pada postingan ini.");
        }
        const quality = bestVideo.quality || bestVideo.downloadText || "Default";
        const caption = `–  *F A C E B O O K  V I D E O*

┌  ◦  *Quality* : ${quality}
└  ◦  *Source* : Facebook

–  *D E S C R I P T I O N*

${desc}`;
        await sock.sendMessage(targetChat, {
          video: {
            url: videoUrl
          },
          caption: caption
        }, {
          quoted: quotedMsg
        });
      } else {
        const photoLinks = downloads.filter(item => item.link).map(item => item.link);
        if (photoLinks.length === 0 && data.image) {
          photoLinks.push(data.image);
        }
        if (photoLinks.length === 0) {
          await ctx.react("❌");
          return ctx.reply("❌ Tautan gambar tidak ditemukan.");
        }
        const caption = `–  *F A C E B O O K  P H O T O*

┌  ◦  *Total Media* : ${photoLinks.length}
└  ◦  *Source* : Facebook

–  *D E S C R I P T I O N*

${desc}`;
        if (photoLinks.length === 1) {
          await sock.sendMessage(targetChat, {
            image: {
              url: photoLinks[0]
            },
            caption: caption
          }, {
            quoted: quotedMsg
          });
        } else {
          const medias = photoLinks.map(imgUrl => ({
            type: "image",
            url: imgUrl
          }));
          await sendSmartAlbum(sock, targetChat, medias, {
            caption: caption,
            quoted: quotedMsg,
            albumDelay: 1500
          });
        }
      }
      await ctx.react("✅");
    } catch (e) {
      console.error("[FACEBOOK DOWNLOADER ERROR]:", e);
      await ctx.react("❌");
      ctx.reply(`❌ Terjadi kesalahan: ${e.message}`);
    }
  }
};