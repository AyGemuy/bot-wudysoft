import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_BASE = `${global.bot?.api?.wudysoft}/api/ai/music/soniva`;
const CONFIG = {
  TIMEOUT: 45e3,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};
export default {
  name: "soniva",
  aliases: ["aimusic", "createsong", "sonivamusic", "bikinlagu"],
  description: "Buat musik & lagu AI via Soniva API.",
  category: "AI",
  limit: true,
  example: "• Generate Lagu: soniva sad lofi song in the club\n• Parameter: soniva lagu romantis --genre Pop --mood Romantic\n• Library: soniva --library <user_id>",
  execute: async (sock, ctx, msg) => {
    try {
      let text = (ctx.query || ctx.text || "").trim();
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (!text) {
        const guideText = `–  *S O N I V A  A I  M U S I C*

Layanan komposisi lagu dan musik vokal berbasis kecerdasan buatan.

┌  ◦  *Generate Musik Otomatis* :
│  └ \`${prefix}soniva sad lofi song in the club\`
│
├  ◦  *Dengan Parameter Khusus* :
│  └ \`${prefix}soniva lagu romantis --genre Pop --mood Romantic\`
│
├  ◦  *Custom Lirik Lagu* :
│  └ \`${prefix}soniva bintang malam --lyrics [verse] saat kau tersenyum\`
│
└  ◦  *Cek Library Musik* :
   └ \`${prefix}soniva --library <user_id>\``;
        return ctx.reply(guideText, {
          quoted: quotedMsg
        });
      }
      await ctx.react("⏳");
      const libraryMatch = text.match(/--library(?:\s+([^\s]+))?/i);
      if (libraryMatch) {
        const targetUserId = libraryMatch[1] || text.replace(/--library/i, "").trim();
        if (!targetUserId) {
          await ctx.react("❌");
          return ctx.reply(`❌ Masukkan User ID!\nContoh: \`${prefix}soniva --library 65c62ae3-51e9-4927-93a4-4693b547e6c0\``);
        }
        const {
          data: libRes
        } = await axios.post(API_BASE, {
          action: "library",
          user_id: targetUserId,
          page: 1,
          limit: 10
        }, {
          headers: {
            "Content-Type": "application/json",
            "User-Agent": CONFIG.USER_AGENT
          },
          timeout: 3e4
        });
        const songs = libRes?.data?.songs || [];
        if (!songs.length) {
          await ctx.react("❌");
          return ctx.reply(`📭 Tidak ada lagu ditemukan untuk user_id: \`${targetUserId}\``);
        }
        const topSong = songs[0];
        const songTitle = topSong.title || "AI Song";
        const songLyrics = (topSong.lyrics || "").trim();
        let caption = `–  *S O N I V A  L I B R A R Y*

Lagu dari perpustakaan musik pengguna berhasil dimuat.

┌  ◦  *Judul* : ${songTitle}
│  ◦  *Durasi* : ${Math.round(topSong.duration || 0)}s
└  ◦  *User ID* : \`${targetUserId}\``;
        if (topSong.share_url) {
          caption += `\n\n–  *T A U T A N*\n\n${topSong.share_url}`;
        }
        if (songLyrics && songLyrics !== "[null]") {
          const truncated = songLyrics.length > 300 ? songLyrics.substring(0, 300) + "\n\n...(lirik dipotong)" : songLyrics;
          caption += `\n\n–  *L I R I K*\n\n\`\`\`\n${truncated}\n\`\`\``;
        }
        if (topSong.image_url) {
          await sock.sendMessage(ctx.id, {
            image: {
              url: topSong.image_url
            },
            caption: caption.trim()
          }, {
            quoted: quotedMsg
          });
        } else {
          await ctx.reply(caption.trim());
        }
        if (topSong.audio_url) {
          await sock.sendMessage(ctx.id, {
            audio: {
              url: topSong.audio_url
            },
            mimetype: "audio/mp4",
            fileName: `${songTitle}.mp3`,
            ptt: false
          }, {
            quoted: quotedMsg
          });
        }
        await ctx.react("✅");
        return;
      }
      let genre = "Pop";
      let mood = "Happy,Romantic";
      let lyrics = null;
      let title = "";
      const genreMatch = text.match(/--genre\s+([^\s]+)/i);
      if (genreMatch) {
        genre = genreMatch[1];
        text = text.replace(genreMatch[0], "").trim();
      }
      const moodMatch = text.match(/--mood\s+([^\s]+)/i);
      if (moodMatch) {
        mood = moodMatch[1];
        text = text.replace(moodMatch[0], "").trim();
      }
      const lyricsMatch = text.match(/--lyrics\s+([\s\S]+)/i);
      if (lyricsMatch) {
        lyrics = lyricsMatch[1].trim();
        text = text.replace(lyricsMatch[0], "").trim();
      }
      const prompt = text || "sad lofi song in the club";
      const genPayload = {
        action: "generate",
        prompt: prompt,
        genre: genre,
        mood: mood,
        has_vocal: true,
        vocal_gender: "random",
        is_dual: true,
        ...lyrics ? {
          lyrics: lyrics
        } : {},
        ...title ? {
          title: title
        } : {}
      };
      const {
        data: genRes
      } = await axios.post(API_BASE, genPayload, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": CONFIG.USER_AGENT
        },
        timeout: CONFIG.TIMEOUT
      });
      if (!genRes || !genRes.success || !genRes.data) {
        await ctx.react("❌");
        return ctx.reply(`❌ Gagal generate musik: ${genRes?.message || "Server error"}`);
      }
      const returnedUserId = genRes.user_id || genRes.data?.user_id;
      const {
        data: libRes
      } = await axios.post(API_BASE, {
        action: "library",
        user_id: returnedUserId,
        page: 1,
        limit: 10
      }, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": CONFIG.USER_AGENT
        },
        timeout: 3e4
      });
      const songs = libRes?.data?.songs || [];
      const song = songs[0];
      if (song && song.audio_url) {
        const songTitle = song.title || "AI Generated Song";
        const songLyrics = (song.lyrics || "").trim();
        let caption = `–  *S O N I V A  M U S I C*

Komposisi audio berhasil dibuat.

┌  ◦  *Judul* : ${songTitle}
│  ◦  *Durasi* : ${Math.round(song.duration || 0)}s
│  ◦  *Genre* : ${genre}
│  ◦  *Mood* : ${mood}
└  ◦  *User ID* : \`${returnedUserId}\``;
        if (song.share_url) {
          caption += `\n\n–  *T A U T A N*\n\n${song.share_url}`;
        }
        if (songLyrics && songLyrics !== "[null]") {
          const truncatedLyrics = songLyrics.length > 300 ? songLyrics.substring(0, 300) + "\n\n...(lirik dipotong)" : songLyrics;
          caption += `\n\n–  *L I R I K*\n\n\`\`\`\n${truncatedLyrics}\n\`\`\``;
        }
        if (song.image_url) {
          await sock.sendMessage(ctx.id, {
            image: {
              url: song.image_url
            },
            caption: caption.trim()
          }, {
            quoted: quotedMsg
          });
        } else {
          await ctx.reply(caption.trim());
        }
        await sock.sendMessage(ctx.id, {
          audio: {
            url: song.audio_url
          },
          mimetype: "audio/mp4",
          fileName: `${songTitle}.mp3`,
          ptt: false
        }, {
          quoted: quotedMsg
        });
      } else {
        const info = `–  *S O N I V A  M U S I C*

Tugas pembuatan lagu berhasil didaftarkan ke sistem antrean.

┌  ◦  *Job ID* : \`${genRes.data.job_id || "-"}\`
│  ◦  *User ID* : \`${returnedUserId}\`
└  ◦  *Status* : \`${genRes.data.status || "created"}\`

Gunakan perintah di bawah ini untuk mengambil hasil musik:
\`${prefix}soniva --library ${returnedUserId}\``;
        await sock.sendMessage(ctx.id, {
          text: info.trim()
        }, {
          quoted: quotedMsg
        });
      }
      await ctx.react("✅");
    } catch (error) {
      console.error("[Soniva Error]:", error?.message || error);
      await ctx.react("❌");
      ctx.reply(`❌ Soniva Error: ${error.response?.data?.message || error.message}`);
    }
  }
};