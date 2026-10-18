import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";

function formatDuration(ms = 0) {
  const totalSeconds = Math.floor(ms / 1e3);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
}
export default {
  name: "recognize",
  aliases: ["whatmusic", "shazam", "liriklagu", "kenalilagu", "findmusic"],
  description: "Mendeteksi judul lagu & artis dari pesan audio/vn/video dan menggunakan YouTube HD Thumbnail",
  category: "Tools",
  limit: true,
  example: "Reply audio/voice note dengan perintah .recognize atau ketik .recognize <url_audio>",
  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "WudysoftBot";
    const footer = global.footer || global.bot?.footer || `_${botName}_`;
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
    try {
      const targetQuoted = ctx.quoted || ctx;
      const isAudioOrVideo = targetQuoted?.isMedia && /audio|video|document/i.test(targetQuoted?.mimetype || targetQuoted?.mediaType || "");
      let audioUrl = ctx.args?.[0]?.trim() || "";
      if (!isAudioOrVideo && !/^https?:\/\//i.test(audioUrl)) {
        const helpText = `– *R E C O G N I Z E*\n\n` + `┌ ◦ *Usage* : ${prefix}recognize <url>\n` + `│ ◦ *Quoted* : Balas audio/VN/video pendek dengan ${prefix}recognize\n` + `└ ◦ *Function* : Mengidentifikasi judul lagu & penyanyi dari rekaman suara\n\n` + `${footer}`;
        return ctx.reply(helpText);
      }
      await ctx.react("⏳");
      if (isAudioOrVideo) {
        const buffer = await ctx.download();
        if (!buffer || !Buffer.isBuffer(buffer)) {
          await ctx.react("❌");
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Gagal mengunduh audio\n` + `└ ◦ *Info* : Berkas media tidak dapat diproses dari WhatsApp.\n\n` + `${footer}`);
        }
        const uploadRes = await upload(buffer);
        if (!uploadRes?.status || !uploadRes?.url) {
          await ctx.react("❌");
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Gagal mengunggah audio\n` + `└ ◦ *Info* : ${uploadRes?.message || "Server upload error"}\n\n` + `${footer}`);
        }
        audioUrl = uploadRes.url;
      }
      const {
        data
      } = await axios.post(`${global.bot?.api?.wudysoft}/api/tools/recognize-audio/v2`, {
        audio: audioUrl
      }, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 6e4
      });
      if (!data || data.status !== true || !data.result?.music) {
        await ctx.react("❌");
        return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Musik tidak dikenali\n` + `└ ◦ *Info* : Pastikan rekaman audio terdengar jelas dan tidak bising.\n\n` + `${footer}`);
      }
      const music = data.result.music;
      const title = music.title || "Unknown Title";
      const artist = music.artist || "Unknown Artist";
      const album = music.album || "-";
      const releaseDate = music.release_date || "-";
      const label = music.label || "-";
      const genres = Array.isArray(music.genres) ? music.genres.join(", ") : "-";
      const duration = formatDuration(music.duration_ms);
      const score = music.score || 100;
      const ext = music.external_metadata || {};
      const spotifyTrackId = ext.spotify?.track?.id || "";
      const spotifyUrl = spotifyTrackId ? `https://open.spotify.com/track/${spotifyTrackId}` : "";
      const ytVid = ext.youtube?.vid || "";
      const youtubeUrl = ytVid ? `https://youtu.be/${ytVid}` : "";
      let bannerMedia = global.bot?.media?.banner1 || global.bot?.media?.banner2 || "https://files.catbox.moe/g2e6i5.jpg";
      if (ytVid) {
        bannerMedia = `https://i.ytimg.com/vi/${ytVid}/hqdefault.jpg`;
      }
      const bodyText = `– *R E C O G N I Z E*\n\n` + `┌ ◦ *Title* : ${title}\n` + `│ ◦ *Artist* : ${artist}\n` + `│ ◦ *Album* : ${album}\n` + `│ ◦ *Release* : ${releaseDate}\n` + `│ ◦ *Label* : ${label}\n` + `│ ◦ *Duration* : ${duration}\n` + `│ ◦ *Genre* : ${genres}\n` + `└ ◦ *Score* : ${score}%\n\n` + `${footer}`;
      const downloadRows = [];
      if (spotifyUrl) {
        downloadRows.push({
          title: "Download Spotify (MP3)",
          description: "Download lagu via Spotify URL",
          id: `${prefix}spotify ${spotifyUrl}`
        });
      }
      if (youtubeUrl) {
        downloadRows.push({
          title: "Download YouTube Audio",
          description: "Unduh audio berkualitas tinggi dari YouTube",
          id: `${prefix}ytmp3 ${youtubeUrl}`
        }, {
          title: "Download YouTube Video",
          description: "Unduh video musik resmi dari YouTube",
          id: `${prefix}ytmp4 ${youtubeUrl}`
        });
      }
      downloadRows.push({
        title: "Cari Musik Otomatis",
        description: `Pencarian otomatis: ${title} - ${artist}`,
        id: `${prefix}play ${title} ${artist}`
      });
      const buttons = [];
      buttons.push({
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: "PILIH FORMAT DOWNLOAD",
          sections: [{
            title: `${title} - ${artist}`,
            rows: downloadRows
          }]
        })
      });
      if (spotifyUrl) {
        buttons.push({
          name: "cta_url",
          buttonParamsJson: JSON.stringify({
            display_text: "Buka di Spotify",
            url: spotifyUrl
          })
        });
      }
      if (youtubeUrl) {
        buttons.push({
          name: "cta_url",
          buttonParamsJson: JSON.stringify({
            display_text: "Tonton di YouTube",
            url: youtubeUrl
          })
        });
      }
      buttons.push({
        name: "cta_copy",
        buttonParamsJson: JSON.stringify({
          display_text: "Salin Info Lagu",
          copy_code: `${title} - ${artist}`
        })
      });
      const options = {
        image: bannerMedia,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 2,
            divider_indices: [1, 2, 999],
            list_title: `${title} • Unduh Lagu`,
            button_title: "Unduh Musik"
          },
          limited_time_offer: {
            text: `${title} - ${artist}`,
            url: spotifyUrl || youtubeUrl || `${global.bot?.api?.wudysoft}`,
            copy_code: `${title} - ${artist}`,
            expiration_time: Date.now() + 3600 * 1e3
          }
        },
        contextInfo: {
          mentionedJid: [ctx.sender],
          forwardingScore: 999,
          isForwarded: true
        },
        quoted: quotedMsg
      };
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, `${botName} • Music Identifier`, buttons, options);
      } else {
        await ctx.reply(bodyText);
      }
      await ctx.react("✅");
    } catch (error) {
      console.error("[RECOGNIZE AUDIO ERROR]", error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || error.message;
      ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : ${errMsg}\n` + `└ ◦ *Command* : ${ctx.command || "recognize"}\n\n` + `${footer}`);
    }
  }
};