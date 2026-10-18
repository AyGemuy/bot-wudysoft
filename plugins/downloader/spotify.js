import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";

function formatDuration(ms) {
  if (!ms) return "-";
  const min = Math.floor(ms / 6e4);
  const sec = Math.floor(ms % 6e4 / 1e3);
  return `${min}:${sec < 10 ? "0" : ""}${sec}`;
}
export default {
  name: "spotifydl",
  aliases: ["spotify", "spotdl", "spdl"],
  description: "Download lagu Spotify dengan CTA Card & Audio murni",
  category: "Downloader",
  execute: async (sock, ctx, msg) => {
    const url = (ctx.args[0] || ctx.query || "").trim();
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "WudysoftBot";
    const botFooter = global.bot?.footer || `${botName} • Spotify Downloader`;
    if (!url) {
      return ctx.reply(`–  *S P O T I F Y*

Silakan masukkan tautan lagu Spotify yang valid.

┌  ◦  *Format* : ${prefix}spotify <link>
└  ◦  *Example* : ${prefix}spotify https://open.spotify.com/track/3GdN5n6p34yFMd12WKq8jL`);
    }
    try {
      await ctx.react("⏳");
      const res = await axios.post(`${global.bot?.api?.wudysoft}/api/download/spotify/v7`, {
        url: url
      });
      const data = res.data;
      if (!data.status || !data.download?.audio) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal mengunduh audio Spotify atau tautan tidak valid.");
      }
      const audioUrl = data.download.audio;
      const spotifyUrl = data.metadata?.external_urls?.spotify || url;
      const duration = formatDuration(data.duration_ms || data.metadata?.duration_ms);
      const artists = (data.metadata?.artists || []).map(a => a.name).join(", ") || data.artist || "-";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const bodyText = `–  *S P O T I F Y*

┌  ◦  *Title* : ${data.title}
│  ◦  *Artist* : ${artists}
│  ◦  *Duration* : ${duration}
└  ◦  *Explicit* : ${data.metadata?.explicit ? "Yes (18+)" : "No"}

Audio sedang dikirimkan ke chat. Anda juga dapat mendengarkan langsung melalui tombol di bawah.`;
      const buttons = [{
        name: "cta_url",
        buttonParamsJson: JSON.stringify({
          display_text: "🟢 Buka di Spotify",
          url: spotifyUrl,
          merchant_url: spotifyUrl
        })
      }, {
        name: "cta_url",
        buttonParamsJson: JSON.stringify({
          display_text: "📥 Direct Download MP3",
          url: audioUrl,
          merchant_url: audioUrl
        })
      }, {
        name: "cta_copy",
        buttonParamsJson: JSON.stringify({
          display_text: "📋 Salin Link Lagu",
          copy_code: spotifyUrl
        })
      }];
      const mediaUrl = data.thumbnail || data.metadata?.album?.images?.[0]?.url || null;
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, botFooter, buttons, {
          title: `✦ Spotify Music • ${data.title} ✦`,
          media: mediaUrl,
          quoted: quotedMsg
        });
      } else {
        await ctx.reply(bodyText, {
          quoted: quotedMsg
        });
      }
      await sock.sendMessage(ctx.id, {
        audio: {
          url: audioUrl
        },
        mimetype: "audio/mpeg",
        fileName: `${data.title} - ${artists}.mp3`
      }, {
        quoted: quotedMsg
      });
      await ctx.react("✅");
    } catch (e) {
      await ctx.react("❌");
      ctx.reply(`❌ Error: ${e.message}`);
    }
  }
};