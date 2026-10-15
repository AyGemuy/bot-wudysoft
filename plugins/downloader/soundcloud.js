import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";

function formatDuration(duration) {
  if (!duration || isNaN(duration)) return "-";
  let seconds = Number(duration);
  if (seconds > 1e4) seconds = Math.floor(seconds / 1e3);
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

function formatSize(bytes) {
  if (!bytes || isNaN(bytes)) return "-";
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

function extractSoundcloudUrl(text = "") {
  const match = text.match(/https?:\/\/(?:on\.)?soundcloud\.com\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+[^\s]*/i);
  return match ? match[0] : null;
}
export default {
  name: "soundcloud",
  aliases: ["scdl", "soundclouddl"],
  description: "Download lagu dan audio dari link SoundCloud",
  category: "Downloader",
  limit: false,
  example: "soundcloud https://soundcloud.com/artist/track-name",
  execute: async (sock, ctx, msg) => {
    try {
      const rawText = ctx.args?.join(" ")?.trim() || ctx.text?.trim() || "";
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • SoundCloud Downloader`;
      const scUrl = extractSoundcloudUrl(rawText);
      if (!scUrl) {
        return ctx.reply(`–  *S O U N D C L O U D*

Silakan masukkan tautan lagu SoundCloud yang valid.

┌  ◦  *Format* : ${prefix}soundcloud <link>
└  ◦  *Example* : ${prefix}soundcloud https://soundcloud.com/b-kasmusic/off-my-mind`);
      }
      await ctx.react("⏳");
      let audioData = null;
      try {
        const v23Url = `${global.bot?.api?.wudysoft}/api/download/soundcloud/v23?url=${encodeURIComponent(scUrl)}`;
        const {
          data: res23
        } = await axios.get(v23Url, {
          timeout: 15e3
        });
        if (res23 && (res23.status === "Completed" || res23.track_model?.length)) {
          const track = res23.track_model?.[0];
          if (track && track.url_download) {
            audioData = {
              title: track.title || "SoundCloud Track",
              author: "SoundCloud Artist",
              downloadUrl: track.url_download,
              thumbnail: track.avt_full_size || track.artwork_url || null,
              duration: formatDuration(track.full_duration || track.duration),
              size: "-",
              source: "v23"
            };
          }
        }
      } catch {}
      if (!audioData) {
        try {
          const v21Url = `${global.bot?.api?.wudysoft}/api/download/soundcloud/v21?url=${encodeURIComponent(scUrl)}`;
          const {
            data: res21
          } = await axios.get(v21Url, {
            timeout: 15e3
          });
          if (res21 && (res21.status === "success" || res21.file_url)) {
            audioData = {
              title: res21.title || res21.filename || "SoundCloud Track",
              author: res21.author || "SoundCloud Artist",
              downloadUrl: res21.file_url,
              thumbnail: res21.thumbnail || null,
              duration: formatDuration(res21.duration),
              size: formatSize(res21.size),
              genre: res21.genre || "-",
              source: "v21"
            };
          }
        } catch {}
      }
      if (!audioData || !audioData.downloadUrl) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal mengunduh audio. Tautan tidak valid, lagu diproteksi, atau server sedang sibuk.");
      }
      const infoText = `–  *S O U N D C L O U D*

┌  ◦  *Title* : ${audioData.title}
│  ◦  *Artist* : ${audioData.author}
│  ◦  *Duration* : ${audioData.duration}
${audioData.genre && audioData.genre !== "-" ? `│  ◦  *Genre* : ${audioData.genre}\n` : ""}${audioData.size !== "-" ? `│  ◦  *Size* : ${audioData.size}\n` : ""}└  ◦  *Source* : SoundCloud

Audio sedang dikirimkan ke chat.`;
      const buttons = [{
        name: "cta_url",
        buttonParamsJson: JSON.stringify({
          display_text: "☁️ Buka di SoundCloud",
          url: scUrl,
          merchant_url: scUrl
        })
      }, {
        name: "cta_copy",
        buttonParamsJson: JSON.stringify({
          display_text: "📋 Salin Link Lagu",
          copy_code: scUrl
        })
      }];
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(infoText, botFooter, buttons, {
          title: `✦ SoundCloud Music • ${audioData.title} ✦`,
          media: audioData.thumbnail || null,
          quoted: quotedMsg
        });
      } else if (audioData.thumbnail) {
        await sock.sendMessage(ctx.from, {
          image: {
            url: audioData.thumbnail
          },
          caption: infoText
        }, {
          quoted: quotedMsg
        });
      } else {
        await ctx.reply(infoText, {
          quoted: quotedMsg
        });
      }
      await sock.sendMessage(ctx.from, {
        audio: {
          url: audioData.downloadUrl
        },
        mimetype: "audio/mpeg",
        fileName: `${audioData.title.replace(/[\\/:*?"<>|]/g, "_")}.mp3`,
        ptt: false
      }, {
        quoted: quotedMsg
      });
      return await ctx.react("✅");
    } catch (error) {
      await ctx.react("❌");
      return ctx.reply(`❌ Terjadi kesalahan pada fitur SoundCloud: ${error?.message || error}`);
    }
  }
};