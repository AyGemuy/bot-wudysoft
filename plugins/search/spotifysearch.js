import axios from "axios";
import {
  Buffer
} from "buffer";
import {
  simpleQuoted
} from "../../lib/quoted.js";

function convertMs(ms) {
  const m = Math.floor(ms / 6e4);
  const s = (ms % 6e4 / 1e3).toFixed(0);
  return m + ":" + (Number(s) < 10 ? "0" : "") + s;
}
async function spotifyTokenGen(client) {
  return axios.post("https://accounts.spotify.com/api/token", "grant_type=client_credentials", {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + Buffer.from(client).toString("base64")
    },
    timeout: 3e4
  }).then(r => ({
    status: true,
    token: r.data.access_token
  })).catch(() => ({
    status: false
  }));
}
async function getSpotifyToken() {
  let t1 = await spotifyTokenGen("7bbae52593da45c69a27c853cc22edff:88ae1f7587384f3f83f62a279e7f87af");
  if (t1.status) return t1.token;
  let t2 = await spotifyTokenGen("f97b33bf590840f7ab31e7d372b1a1bf:d700cceafc7c4de483b2ec3850f97a6a");
  if (t2.status) return t2.token;
  return null;
}
export default {
  name: "spotifysearch",
  aliases: ["spotify-search", "spsearch", "spotify"],
  description: "Mencari lagu di Spotify dengan tampilan Swipe Carousel",
  category: "Search",
  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "WudysoftBot";
    const footer = global.footer || global.bot?.footer || `_${botName}_`;
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
    try {
      const query = (ctx.query || ctx.args?.join(" ") || "").trim();
      if (!query) {
        const helpText = `– *S P O T I F Y*\n\n` + `┌ ◦ *Usage* : ${prefix}spotify <judul_lagu>\n` + `└ ◦ *Example* : ${prefix}spotify grayscale\n\n` + `${footer}`;
        return ctx.reply(helpText);
      }
      await ctx.react("⏳");
      const token = await getSpotifyToken();
      if (!token) {
        await ctx.react("❌");
        return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Autentikasi Gagal\n` + `└ ◦ *Info* : Gagal menghubungkan ke Spotify API Server.\n\n` + `${footer}`);
      }
      const res = await axios.get("https://api.spotify.com/v1/search", {
        headers: {
          Authorization: `Bearer ${token}`
        },
        params: {
          q: query,
          type: "track",
          limit: 7,
          market: "US"
        },
        timeout: 3e4
      });
      const items = res.data?.tracks?.items || [];
      if (!items.length) {
        await ctx.react("❌");
        return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Lagu tidak ditemukan\n` + `└ ◦ *Query* : "${query}"\n\n` + `${footer}`);
      }
      const carousel = ctx.carousel();
      carousel.setBody(`– *S P O T I F Y  -  S E A R C H*\n\nQuery: "${query}"`);
      carousel.setFooter(footer);
      for (let i = 0; i < items.length; i++) {
        const v = items[i];
        const artists = v.artists?.map(a => a.name).join(", ") || "Unknown";
        const duration = convertMs(v.duration_ms);
        const coverUrl = v.album?.images?.[0]?.url || "";
        const trackUrl = v.external_urls?.spotify || "";
        const card = carousel.createCard();
        card.setTitle("SPOTIFY");
        const cardBody = `– *S P O T I F Y*\n\n` + `┌ ◦ *Title* : ${v.name}\n` + `│ ◦ *Artist* : ${artists}\n` + `│ ◦ *Album* : ${v.album?.name || "-"}\n` + `│ ◦ *Duration* : ${duration}\n` + `└ ◦ *Release* : ${v.album?.release_date || "-"}\n\n` + `${footer}`;
        card.setBody(cardBody);
        card.setFooter(`Track #${i + 1} of ${items.length}`);
        if (coverUrl) {
          const dl = await axios.get(coverUrl, {
            responseType: "arraybuffer",
            timeout: 2e4
          });
          card.setImage(Buffer.from(dl.data));
        }
        card.addReply("Download Musik", `${prefix}spotifydl ${trackUrl}`);
        card.addCopy("Salin Tautan", trackUrl);
        card.addUrl("Buka di Spotify", trackUrl);
        card.addSelection("Opsi Pemutaran");
        card.makeSections(v.name, duration);
        card.makeRow("Audio", "Download Lagu", `Unduh audio MP3 dari ${v.name}`, `${prefix}spotifydl ${trackUrl}`);
        card.makeRow("Pencarian", "Cari Lagu Artis Ini", `Cari lagu lain dari ${artists}`, `${prefix}spotify ${artists}`);
      }
      await carousel.run(ctx.id, sock, quotedMsg);
      await ctx.react("✅");
    } catch (error) {
      console.error("[Spotify Search Error]:", error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.error?.message || error.message;
      ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : ${errMsg}\n` + `└ ◦ *Command* : ${ctx.command || "spotify"}\n\n` + `${footer}`);
    }
  }
};