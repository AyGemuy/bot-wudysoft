import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const VALID_FMT = ["mp4", "mp3", "m4a", "webm"];
const VALID_VID_Q = ["1080", "720", "480", "360", "240", "144"];
export default {
  name: "ytdl",
  aliases: ["ytmp4", "ytmp3", "yt", "youtube"],
  description: "Download YouTube dengan format & kualitas spesifik via CTA",
  category: "Downloader",
  execute: async (sock, ctx, msg) => {
    const rawArgs = ctx.args || [];
    const url = rawArgs.find(arg => /https?:\/\/(www\.)?(youtube\.com|youtu\.be)/i.test(arg)) || "";
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "WudysoftBot";
    const botFooter = global.bot?.footer || `${botName} • YouTube Downloader`;
    if (!url) {
      return ctx.reply(`–  *Y O U T U B E*

Silakan masukkan tautan video YouTube yang valid.

┌  ◦  *Format* : ${prefix}ytdl <link> [mp3/mp4] [resolusi]
│  ◦  *Example Video* : ${prefix}ytmp4 https://youtu.be/xxx 720
└  ◦  *Example Audio* : ${prefix}ytmp3 https://youtu.be/xxx`);
    }
    const remainingArgs = rawArgs.filter(arg => arg !== url).map(a => a.toLowerCase().replace(/p$/i, ""));
    let reqFormat = ctx.command === "ytmp3" ? "mp3" : ctx.command === "ytmp4" ? "mp4" : null;
    let reqQuality = null;
    for (const arg of remainingArgs) {
      if (VALID_FMT.includes(arg)) reqFormat = arg;
      else if (VALID_VID_Q.includes(arg)) reqQuality = arg;
    }
    try {
      await ctx.react("⏳");
      const res = await axios.post(`${global.bot?.api?.wudysoft}/api/download/youtube/v78`, {
        url: url,
        format: reqFormat || null,
        quality: reqQuality || null
      });
      const data = res.data?.data;
      if (!data) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal memproses video YouTube dari server.");
      }
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (reqFormat || reqQuality) {
        const isAudio = reqFormat === "mp3" || reqFormat === "m4a";
        if (isAudio) {
          const audioUrl = data.selected?.downloadUrl || data.availableAudios?.[0]?.downloadUrl;
          await sock.sendMessage(ctx.id, {
            audio: {
              url: audioUrl
            },
            mimetype: "audio/mp4",
            fileName: `${data.title}.mp3`
          }, {
            quoted: quotedMsg
          });
        } else {
          const videoUrl = data.selected?.downloadUrl || data.availableVideos?.[0]?.downloadUrl;
          const directCaption = `–  *Y O U T U B E*

┌  ◦  *Title* : ${data.title}
└  ◦  *Quality* : ${data.selected?.quality || reqQuality || "Default"}`;
          await sock.sendMessage(ctx.id, {
            video: {
              url: videoUrl
            },
            caption: directCaption
          }, {
            quoted: quotedMsg
          });
        }
        await ctx.react("✅");
        return;
      }
      const videoRows = (data.availableVideos || []).slice(0, 6).map(v => ({
        title: `[ Video ${v.quality} ]`,
        id: `${prefix}ytdl ${url} mp4 ${v.quality.replace(/p$/i, "")}`,
        description: `Size: ${v.size || "-"} | Audio: ${v.hasAudio ? "ON" : "OFF"}`
      }));
      const audioRows = [{
        title: "[ Audio MP3 ]",
        id: `${prefix}ytdl ${url} mp3`,
        description: "Format audio MP3 128-320kbps"
      }, {
        title: "[ Audio M4A ]",
        id: `${prefix}ytdl ${url} m4a`,
        description: "Format audio M4A original"
      }];
      const defaultDownloadUrl = data.selected?.downloadUrl || data.availableVideos?.[0]?.downloadUrl;
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: "📥 PILIH RESOLUSI / FORMAT",
          sections: [{
            title: `${botName} • Pilihan Video`,
            rows: videoRows
          }, {
            title: `${botName} • Pilihan Audio`,
            rows: audioRows
          }]
        })
      }, {
        name: "cta_url",
        buttonParamsJson: JSON.stringify({
          display_text: "🎬 Tonton di YouTube",
          url: url,
          merchant_url: url
        })
      }];
      if (defaultDownloadUrl) {
        buttons.push({
          name: "cta_url",
          buttonParamsJson: JSON.stringify({
            display_text: "📥 Direct Download Link",
            url: defaultDownloadUrl,
            merchant_url: defaultDownloadUrl
          })
        }, {
          name: "cta_copy",
          buttonParamsJson: JSON.stringify({
            display_text: "📋 Salin Link Unduhan",
            copy_code: defaultDownloadUrl
          })
        });
      }
      const bodyText = `–  *Y O U T U B E*

┌  ◦  *Title* : ${data.title}
│  ◦  *Duration* : ${data.duration || "-"}
│  ◦  *Quality* : ${data.selected?.quality || "360p"}
└  ◦  *Size* : ${data.selected?.filesize || "-"}

Berkas sedang dikirimkan ke chat. Anda juga dapat memilih format lain melalui menu di bawah.`;
      await ctx.sendCta(bodyText, botFooter, buttons, {
        title: `✦ YouTube Downloader • ${data.title} ✦`,
        subtitle: `Duration: ${data.duration || "-"}`,
        media: data.thumbnail || null,
        quoted: quotedMsg
      });
      const playableVideo = data.selected?.hasAudio ? data.selected : data.availableVideos?.find(v => v.hasAudio) || data.selected;
      if (playableVideo?.downloadUrl) {
        const defaultCaption = `–  *Y O U T U B E*

┌  ◦  *Title* : ${data.title}
└  ◦  *Quality* : ${playableVideo.quality || "360p"}`;
        await sock.sendMessage(ctx.id, {
          video: {
            url: playableVideo.downloadUrl
          },
          caption: defaultCaption
        }, {
          quoted: quotedMsg
        });
      }
      await ctx.react("✅");
    } catch (e) {
      console.error("[YTDL ERROR]:", e);
      await ctx.react("❌");
      ctx.reply(`❌ Error: ${e.message}`);
    }
  }
};