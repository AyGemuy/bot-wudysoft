import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const CONFIG = {
  SEARCH_URL: `${global.bot?.api?.wudysoft}/api/search/spotify/v3`,
  DOWNLOAD_URL: `${global.bot?.api?.wudysoft}/api/download/spotify/v6`,
  API_TIMEOUT: 6e4,
  SPOTIFY_TRACK_REGEX: /https?:\/\/open\.spotify\.com\/(?:intl-[a-z]{2}\/)?track\/([a-zA-Z0-9]+)/i
};

function formatDuration(ms = 0) {
  const totalSeconds = Math.floor(ms / 1e3);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
export default {
  name: "spotify",
  aliases: ["spot", "sp", "spotidl", "spotifydl"],
  description: "Cari lagu atau unduh audio MP3 dari Spotify (Auto Link / Query)",
  category: "Downloader",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["spotify", "spot", "sp", "spotidl", "spotifydl"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      if (!rawText && ctx.quoted?.text) {
        rawText = ctx.quoted.text.trim();
      }
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "Bot";
      const botFooter = global.bot?.footer || `${botName} • Spotify Downloader`;
      const userName = ctx.pushname || (ctx.sender ? ctx.sender.split("@")[0] : "User");
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const targetChat = ctx.id || ctx.chat;
      if (!rawText) {
        return ctx.reply(`–  *S P O T I F Y*

Silakan masukkan judul lagu atau tautan Spotify.

┌  ◦  *Pencarian* : ${prefix}spotify <judul lagu>
│  ◦  *Download*   : ${prefix}spotify <link lagu>
└  ◦  *Contoh*     : ${prefix}spotify Adele - Hello`);
      }
      if (typeof ctx.react === "function") await ctx.react("⏳");
      const isLinkMatch = rawText.match(CONFIG.SPOTIFY_TRACK_REGEX);
      if (isLinkMatch) {
        const trackUrl = isLinkMatch[0];
        const {
          data
        } = await axios.get(CONFIG.DOWNLOAD_URL, {
          params: {
            url: trackUrl
          },
          timeout: CONFIG.API_TIMEOUT
        });
        const dlUrl = data.downloadUrl || data.data?.downloadUrl;
        const meta = data.meta || data.data?.meta || {};
        const title = data.title || meta.name || data.name || "Track";
        const artist = data.artist || (meta.artists ? meta.artists.map(a => a.name).join(", ") : "Unknown Artist");
        const coverUrl = meta.album?.images?.[0]?.url;
        const duration = formatDuration(meta.duration_ms || 0);
        if (!dlUrl) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply("❌ Gagal mendapatkan tautan unduhan audio.");
        }
        const fullCaption = `–  *S P O T I F Y*

┌  ◦  *Judul*    : ${title}
│  ◦  *Artis*    : ${artist}
│  ◦  *Durasi*   : ${duration}
└  ◦  *Format*   : MP3

_⏳ Tunggu sebentar, audio sedang dikirim..._`;
        if (coverUrl) {
          await sock.sendMessage(targetChat, {
            image: {
              url: coverUrl
            },
            caption: fullCaption
          }, {
            quoted: quotedMsg
          });
        }
        const audioRes = await axios.get(dlUrl, {
          responseType: "arraybuffer",
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
          },
          timeout: 9e4
        });
        const audioBuffer = Buffer.from(audioRes.data);
        await sock.sendMessage(targetChat, {
          audio: audioBuffer,
          mimetype: "audio/mpeg",
          fileName: `${artist} - ${title}.mp3`
        }, {
          quoted: quotedMsg
        });
        if (typeof ctx.react === "function") await ctx.react("✅");
        return;
      }
      const {
        data
      } = await axios.get(CONFIG.SEARCH_URL, {
        params: {
          action: "search",
          query: rawText
        },
        timeout: CONFIG.API_TIMEOUT
      });
      const trackItems = data?.data?.tracks?.items || [];
      if (!data.status || trackItems.length === 0) {
        if (typeof ctx.react === "function") await ctx.react("❌");
        return ctx.reply(`❌ Lagu tidak ditemukan untuk kata kunci: "${rawText}"`);
      }
      const listTracks = trackItems.slice(0, 10);
      const topTrack = listTracks[0];
      const rows = listTracks.map((item, idx) => {
        const title = item.name;
        const artists = item.artists?.map(a => a.name).join(", ") || "-";
        const trackLink = item.external_urls?.spotify;
        const duration = formatDuration(item.duration_ms || 0);
        return {
          title: `[#${idx + 1}] ${title.slice(0, 24)}`,
          id: `${prefix}spotify ${trackLink}`,
          description: `Artis: ${artists} • Durasi: ${duration}`
        };
      });
      const listSections = [{
        title: `🎵 HASIL PENCARIAN: ${rawText.toUpperCase()}`,
        rows: rows
      }];
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: "🎧 PILIH LAGU",
          sections: listSections
        })
      }];
      const bodyText = `Hi ${userName}!
Ditemukan *${trackItems.length}* lagu untuk pencarian: \`${rawText}\`

Silakan klik menu *PILIH LAGU* di bawah untuk langsung mengunduh audionya.`;
      const bannerMedia = topTrack.album?.images?.[0]?.url || global.bot?.media?.banner1 || null;
      const ctaOptions = {
        image: bannerMedia,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `${botName} • Spotify Search`,
            button_title: "Daftar Lagu"
          }
        },
        contextInfo: {
          forwardingScore: 999,
          isForwarded: true
        },
        quoted: quotedMsg
      };
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, botFooter, buttons, ctaOptions);
      } else {
        let fallbackText = `${bodyText}\n\n`;
        listTracks.forEach((t, i) => {
          const tName = t.name;
          const tArtist = t.artists?.map(a => a.name).join(", ");
          fallbackText += `*${i + 1}.* ${tName} - ${tArtist}\n↳ ${t.external_urls?.spotify}\n\n`;
        });
        fallbackText += `Ketik: \`${prefix}spotify <link>\` untuk mendownload lagu.`;
        await sock.sendMessage(targetChat, {
          image: bannerMedia ? {
            url: bannerMedia
          } : undefined,
          caption: fallbackText
        }, {
          quoted: quotedMsg
        });
      }
      if (typeof ctx.react === "function") await ctx.react("✅");
    } catch (error) {
      console.error("[Spotify Error]:", error?.message || error);
      if (typeof ctx.react === "function") await ctx.react("❌");
      let errorMessage = error.message;
      if (error.response?.data) {
        try {
          const parsed = typeof error.response.data === "string" ? JSON.parse(error.response.data) : error.response.data;
          errorMessage = parsed.message || parsed.error || errorMessage;
        } catch {}
      }
      ctx.reply(`❌ Terjadi kesalahan: ${errorMessage}`);
    }
  }
};