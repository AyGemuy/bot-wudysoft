import axios from "axios";
import db from "../../data/db.js";
import { simpleQuoted } from "../../lib/quoted.js";

const API_URL = `${global.bot?.api?.wudysoft}/api/search/lyrics/v13`;
const SESSION_TIMEOUT = 25 * 60 * 1e3; // 25 Menit
const CONFIG = {
  TIMEOUT: 45e3,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  ITEMS_PER_PAGE: 8
};

function initDB(jid = null, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.geniusLyrics) global.db.geniusLyrics = {};
  if (jid && !global.db.user[jid]) {
    global.db.user[jid] = {
      name: name || "",
      money: 1e4,
      exp: 0
    };
  }
}

function saveDB() {
  if (typeof db?.write === "function" && global.db) {
    db.write(global.db);
  }
}

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /--([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1].toLowerCase();
    let rawVal = match[2];
    let val = true;

    if (["q", "query"].includes(key)) key = "query";
    if (["song", "id", "songid"].includes(key)) key = "id";

    if (rawVal !== undefined) {
      if ((rawVal.startsWith('"') && rawVal.endsWith('"')) || (rawVal.startsWith("'") && rawVal.endsWith("'"))) {
        rawVal = rawVal.slice(1, -1);
      }
      if (rawVal === "true") val = true;
      else if (rawVal === "false") val = false;
      else if (!isNaN(rawVal) && rawVal.trim() !== "") val = Number(rawVal);
      else val = rawVal;
    }
    flags[key] = val;
  }
  const cleanPrompt = input.replace(flagRegex, "").trim();
  return {
    flags,
    cleanPrompt
  };
}

// Rekursif parser DOM Genius untuk mengekstrak lirik teks asli
function extractLyricsDom(node) {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(extractLyricsDom).join("");
  
  if (node.tag === "br") return "\n";
  if (node.tag === "dfp-unit" || node.tag === "dfp-kv") return ""; // Skip ads

  if (Array.isArray(node.children)) {
    return node.children.map(extractLyricsDom).join("");
  }
  return "";
}

// Render HTML Canvas Lirik ke Gambar (Menggunakan multi-versi html2img Wudysoft)
async function renderHtmlToImage(htmlContent) {
  const rawApi = global.bot?.api?.wudysoft || "";
  const cleanApi = rawApi.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  const baseUrl = `https://${cleanApi}/api/tools/html2img/`;
  const headers = {
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
  };
  const payload = {
    html: htmlContent,
    fullPage: true,
    quality: 100
  };
  const versions = ["v5", "v1", "v2", "v3", "v4", "v6", "v7", "v8", "v9", "v10"];
  for (const ver of versions) {
    try {
      const res = await axios.post(`${baseUrl}${ver}`, payload, {
        headers: headers,
        timeout: 15e3
      });
      const imgUrl = res.data?.url || res.data?.result || (typeof res.data === "string" ? res.data : null);
      if (imgUrl && /^https?:\/\//i.test(imgUrl)) {
        let buffer = null;
        try {
          const imgRes = await axios.get(imgUrl, {
            responseType: "arraybuffer",
            timeout: 12e3
          });
          if (imgRes.data) buffer = Buffer.from(imgRes.data);
        } catch {}
        return {
          url: imgUrl,
          buffer: buffer
        };
      }
    } catch {
      continue;
    }
  }
  return {
    url: null,
    buffer: null
  };
}

// Template HTML Spotify/Genius Style Lyrics Canvas Card
function generateLyricsCanvasHtml(song, lyricsText) {
  const coverUrl = song.song_art_image_url || song.header_image_url || "https://images.genius.com/e7de8aadc81bfe774a7bb5393c29044d.1000x1000x1.png";
  const title = (song.title || "Unknown Title").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const artist = (song.artist_names || "Unknown Artist").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const formattedLyrics = lyricsText
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .split("\n")
    .map(line => {
      if (line.startsWith("[") && line.endsWith("]")) {
        return `<div class="section-tag">${line}</div>`;
      }
      return line.trim() ? `<div class="line">${line}</div>` : `<div class="spacer"></div>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0f0f13;
      font-family: 'Plus Jakarta Sans', sans-serif;
      display: flex;
      justify-content: center;
      padding: 40px;
    }
    .canvas-card {
      width: 720px;
      background: linear-gradient(145deg, #181924, #0d0e14);
      border-radius: 28px;
      padding: 40px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: 0 30px 60px rgba(0,0,0,0.6);
      color: #ffffff;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 22px;
      border-bottom: 1px solid rgba(255,255,255,0.08);
      padding-bottom: 28px;
      margin-bottom: 30px;
    }
    .cover-art {
      width: 100px;
      height: 100px;
      border-radius: 18px;
      object-fit: cover;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
    }
    .meta { flex: 1; }
    .badge {
      display: inline-block;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1.5px;
      color: #ffde59;
      text-transform: uppercase;
      margin-bottom: 6px;
    }
    .title {
      font-size: 26px;
      font-weight: 800;
      line-height: 1.25;
      color: #ffffff;
      margin-bottom: 6px;
    }
    .artist {
      font-size: 17px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.65);
    }
    .lyrics-container {
      font-size: 18px;
      line-height: 1.65;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.88);
    }
    .line { margin-bottom: 4px; }
    .spacer { height: 16px; }
    .section-tag {
      font-size: 14px;
      font-weight: 700;
      color: #ffde59;
      margin-top: 20px;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .footer {
      margin-top: 35px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
      color: rgba(255, 255, 255, 0.35);
      border-top: 1px solid rgba(255,255,255,0.06);
      padding-top: 20px;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="canvas-card">
    <div class="header">
      <img class="cover-art" src="${coverUrl}">
      <div class="meta">
        <span class="badge">Genius Official Lyrics</span>
        <div class="title">${title}</div>
        <div class="artist">${artist}</div>
      </div>
    </div>
    <div class="lyrics-container">
      ${formattedLyrics}
    </div>
    <div class="footer">
      <span>Wudysoft Bot Engine • Genius Media Canvas</span>
      <span>Verified Music Archive</span>
    </div>
  </div>
</body>
</html>`;
}

// Request API Lyrics v13
async function requestLyrics(params = {}) {
  const { data } = await axios.get(API_URL, {
    params,
    headers: {
      "User-Agent": CONFIG.USER_AGENT
    },
    timeout: CONFIG.TIMEOUT
  });
  return data;
}

function recordSession(chatId, messageId, lastQuery, lastSongId, songTitle) {
  if (!chatId) return;
  initDB();
  if (!global.db.geniusLyrics[chatId]) {
    global.db.geniusLyrics[chatId] = {
      query: lastQuery || null,
      last_song_id: lastSongId || null,
      title: songTitle || null,
      msgIds: [],
      lastMsgId: null,
      updatedAt: Date.now(),
      expireTime: Date.now() + SESSION_TIMEOUT
    };
  }
  const s = global.db.geniusLyrics[chatId];
  if (lastQuery) s.query = lastQuery;
  if (lastSongId) s.last_song_id = lastSongId;
  if (songTitle) s.title = songTitle;
  if (messageId) {
    if (!Array.isArray(s.msgIds)) s.msgIds = [];
    if (!s.msgIds.includes(messageId)) s.msgIds.push(messageId);
    s.lastMsgId = messageId;
  }
  s.updatedAt = Date.now();
  s.expireTime = Date.now() + SESSION_TIMEOUT;
  saveDB();
}

export default {
  name: "lyrics",
  aliases: ["lirik", "genius", "lyric", "liriklagu"],
  description: "Cari lirik lagu resmi, info track & render aesthetic image canvas via Genius Lyrics v13.",
  category: "Search",
  limit: true,
  example: "lyrics Adele Hello\nlyrics --id 2332455\nBalas pesan bot untuk mencari lagu terkait.",

  before: async (msg, { sock, ctx }) => {
    try {
      const chatId = ctx?.id || msg?.key?.remoteJid;
      if (!chatId) return;
      initDB();
      if (!global.db.geniusLyrics[chatId]) return;

      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;

      const sessionData = global.db.geniusLyrics[chatId];
      if (Date.now() > sessionData.expireTime) {
        delete global.db.geniusLyrics[chatId];
        saveDB();
        return;
      }

      const quotedStanzaId = ctx?.quoted?.id || msg?.message?.extendedTextMessage?.contextInfo?.stanzaId;
      const isQuoting = quotedStanzaId && (
        quotedStanzaId === sessionData.lastMsgId ||
        (Array.isArray(sessionData.msgIds) && sessionData.msgIds.includes(quotedStanzaId))
      );

      if (!isQuoting) return;

      const userText = (ctx?.text || ctx?.query || msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "").trim();
      const prefixList = [".", "#", "!", "/", ctx?.prefix].filter(Boolean);
      if (prefixList.some(p => userText.startsWith(p))) return;
      if (!userText) return;

      // Jika user mereply dengan nomor ID lagu
      if (/^\d+$/.test(userText.trim())) {
        if (typeof ctx?.react === "function") await ctx.react("⏳");
        const songDetail = await requestLyrics({ action: "detail", id: userText.trim() });
        const song = songDetail?.result;
        if (!song) return;

        const lyricsText = extractLyricsDom(song.lyrics?.dom).trim() || "Lirik tidak tersedia.";
        
        // Render Canvas Card
        const html = generateLyricsCanvasHtml(song, lyricsText);
        const { url: canvasUrl, buffer: canvasBuffer } = await renderHtmlToImage(html);
        const thumbUrl = canvasUrl || song.song_art_image_url || song.header_image_url;

        const bodyText = `–  *G E N I U S  L Y R I C S*\n\n` +
          `┌  ◦  *Judul* : ${song.full_title || song.title}\n` +
          `├  ◦  *Artis* : ${song.artist_names || "-"}\n` +
          `├  ◦  *Album* : ${song.album?.name || "-"}\n` +
          `├  ◦  *Rilis* : ${song.release_date_for_display || "-"}\n` +
          `└  ◦  *Link* : ${song.url || "-"}\n\n` +
          `───  *L I R I K*  ───\n\n` +
          lyricsText;

        const buttons = [{
          name: "cta_copy",
          display_text: "📄 Salin Lirik",
          copy_code: lyricsText
        }];

        if (canvasUrl) {
          buttons.push({
            name: "cta_url",
            display_text: "🖼️ Download Canvas Card",
            url: canvasUrl
          });
        }

        let sentMsg;
        if (typeof ctx.sendCta === "function") {
          sentMsg = await ctx.sendCta(bodyText, `_Genius Music Canvas_`, buttons, {
            media: thumbUrl || null,
            quoted: msg
          });
        } else if (canvasBuffer) {
          sentMsg = await sock.sendMessage(ctx.id, {
            image: canvasBuffer,
            caption: bodyText
          }, { quoted: msg });
        } else if (thumbUrl) {
          sentMsg = await sock.sendMessage(ctx.id, {
            image: { url: thumbUrl },
            caption: bodyText
          }, { quoted: msg });
        } else {
          sentMsg = await sock.sendMessage(ctx.id, { text: bodyText }, { quoted: msg });
        }

        const newMsgId = sentMsg?.key?.id;
        recordSession(chatId, newMsgId, sessionData.query, song.id, song.title);
        if (typeof ctx?.react === "function") await ctx.react("✨");
        return true;
      }
    } catch (e) {
      console.error("[LYRICS BEFORE ERROR]:", e.message);
    }
  },

  execute: async (sock, ctx, msg) => {
    try {
      const chatId = ctx.id;
      const senderId = ctx.sender || ctx.author || msg.key?.participant || msg.key?.remoteJid || ctx.id;
      initDB(senderId, ctx.pushName);

      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["lyrics", "lirik", "genius", "lyric", "liriklagu"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }

      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;

      // 1. Reset Sesi
      if (rawText === "--reset" || rawText === "--clear" || rawText === "reset" || rawText === "clear") {
        if (global.db.geniusLyrics[chatId]) {
          delete global.db.geniusLyrics[chatId];
          saveDB();
          return ctx.reply("🧹 *Sesi pencarian lirik berhasil direset!*");
        }
        return ctx.reply("ℹ️ Tidak ada sesi pencarian lirik yang aktif di percakapan ini.");
      }

      const { flags, cleanPrompt } = parseFlags(rawText);

      // 2. Action: DETAIL & CANVAS LIRIK (BY ID)
      if (flags.id || flags.song_id || /^\d+$/.test(cleanPrompt)) {
        await ctx.react("⏳");
        const songId = flags.id || flags.song_id || cleanPrompt;
        const res = await requestLyrics({ action: "detail", id: songId });
        const song = res?.result;

        if (!song) {
          await ctx.react("❌");
          return ctx.reply("❌ Detail lagu dan lirik tidak ditemukan.");
        }

        const lyricsText = extractLyricsDom(song.lyrics?.dom).trim() || "Lirik teks tidak ditemukan atau lagu instrumental.";

        // Render HTML Lirik ke Canvas Gambar
        const html = generateLyricsCanvasHtml(song, lyricsText);
        const { url: canvasUrl, buffer: canvasBuffer } = await renderHtmlToImage(html);
        const thumbUrl = canvasUrl || song.song_art_image_url || song.header_image_url;

        const bodyText = `–  *G E N I U S  L Y R I C S*\n\n` +
          `┌  ◦  *Judul* : ${song.full_title || song.title}\n` +
          `├  ◦  *Artis* : ${song.artist_names || "-"}\n` +
          `├  ◦  *Album* : ${song.album?.name || "-"}\n` +
          `├  ◦  *Rilis* : ${song.release_date_for_display || "-"}\n` +
          `└  ◦  *Link* : ${song.url || "-"}\n\n` +
          `───  *L I R I K*  ───\n\n` +
          lyricsText;

        const buttons = [{
          name: "cta_copy",
          display_text: "📄 Salin Lirik",
          copy_code: lyricsText
        }];

        if (canvasUrl) {
          buttons.push({
            name: "cta_url",
            display_text: "🖼️ Download Canvas Card",
            url: canvasUrl
          });
        }

        let sentMsg;
        if (typeof ctx.sendCta === "function") {
          sentMsg = await ctx.sendCta(bodyText, `_Genius Music Canvas_`, buttons, {
            media: thumbUrl || null,
            quoted: quotedMsg
          });
        } else if (canvasBuffer) {
          sentMsg = await sock.sendMessage(ctx.id, {
            image: canvasBuffer,
            caption: bodyText
          }, { quoted: quotedMsg });
        } else if (thumbUrl) {
          sentMsg = await sock.sendMessage(ctx.id, {
            image: { url: thumbUrl },
            caption: bodyText
          }, { quoted: quotedMsg });
        } else {
          sentMsg = await sock.sendMessage(ctx.id, { text: bodyText }, { quoted: quotedMsg });
        }

        const sentMsgId = sentMsg?.key?.id;
        recordSession(chatId, sentMsgId, null, song.id, song.title);
        await ctx.react("✨");
        return;
      }

      // 3. Action: PENCARIAN LAGU (CTA LIST PAGINATION)
      const searchQuery = flags.query || cleanPrompt;
      if (!searchQuery) {
        const guideText = `–  *G E N I U S  L Y R I C S*

Pencarian database lirik lagu resmi dari Genius.com dengan aesthetic visual canvas generator.

┌  ◦  *Cari Lirik Lagu* :
│  └ \`${prefix}lyrics Adele - Hello\`
│
├  ◦  *Ambil via Song ID Langsung* :
│  └ \`${prefix}lyrics --id 2332455\`
│
├  ◦  *Fitur Tambahan* :
│  ├ 📄 Tombol CTA Salin Lirik Teks Otomatis
│  └ 🖼️ Render Canvas Lirik Card & Link Download
│
└  ◦  *Flags Tambahan* :
   ├ \`--id <song_id>\` (Lihat detail lirik)
   ├ \`--page <nomor>\` (Navigasi halaman)
   └ \`--reset\` (Hapus sesi obrolan)`;

        return ctx.reply(guideText, { quoted: quotedMsg });
      }

      await ctx.react("🔍");

      const searchRes = await requestLyrics({ action: "search", query: searchQuery });
      const rawResults = searchRes?.result || [];
      const songList = rawResults.map(item => item.result).filter(Boolean);

      if (!songList.length) {
        await ctx.react("❌");
        return ctx.reply(`❌ Tidak ditemukan lagu dengan query "${searchQuery}".`);
      }

      const page = Math.max(1, Number(flags.page) || 1);
      const totalPages = Math.ceil(songList.length / CONFIG.ITEMS_PER_PAGE) || 1;
      const pageItems = songList.slice((page - 1) * CONFIG.ITEMS_PER_PAGE, page * CONFIG.ITEMS_PER_PAGE);

      const rows = pageItems.map((song, idx) => {
        const globalIdx = (page - 1) * CONFIG.ITEMS_PER_PAGE + idx + 1;
        const title = (song.title || "Untitled").slice(0, 24);
        const artist = song.artist_names || "Unknown Artist";
        return {
          title: `${globalIdx}. ${title}`,
          id: `${prefix}lyrics --id ${song.id}`,
          description: `${artist} • ID: ${song.id}`.slice(0, 60)
        };
      });

      let baseCmd = `${prefix}lyrics ${searchQuery}`;

      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: `PILIH LAGU (${pageItems.length})`,
          sections: [{
            title: `HASIL: "${searchQuery.toUpperCase()}" (Hal ${page}/${totalPages})`,
            rows: rows
          }]
        })
      }];

      if (page > 1) {
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `⬅️ Hal ${page - 1}`,
            id: `${baseCmd} --page ${page - 1}`
          })
        });
      }
      if (page < totalPages) {
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `➡️ Hal ${page + 1}`,
            id: `${baseCmd} --page ${page + 1}`
          })
        });
      }

      const bodyText = `–  *G E N I U S  -  S E A R C H*\n\n` +
        `┌  ◦  *Query* : "${searchQuery}"\n` +
        `├  ◦  *Ditemukan* : ${songList.length} Lagu\n` +
        `└  ◦  *Halaman* : ${page} / ${totalPages}\n\n` +
        `_Pilih lagu dari menu di bawah untuk membuka lirik dan generate image canvas:_`;

      const options = {
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `Genius Search`,
            button_title: `Buka Hal ${page}`
          }
        },
        quoted: quotedMsg
      };

      let sentMsg;
      if (typeof ctx.sendCta === "function") {
        sentMsg = await ctx.sendCta(bodyText, "", buttons, options);
      } else {
        let fallback = `${bodyText}\n\n` + rows.map(r => `• *${r.title}*\n  Perintah: \`${r.id}\``).join("\n\n");
        if (totalPages > 1) {
          fallback += `\n\n_Pindah Halaman: Ketik \`${baseCmd} --page ${page < totalPages ? page + 1 : page - 1}\`_`;
        }
        sentMsg = await ctx.reply(fallback);
      }

      const sentMsgId = sentMsg?.key?.id;
      recordSession(chatId, sentMsgId, searchQuery);

      await ctx.react("✨");
    } catch (error) {
      console.error("[Lyrics Error]:", error?.message || error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.error || error.message || "Gagal memproses pencarian lirik Genius.";
      ctx.reply(`❌ Terjadi kendala: ${errMsg}`);
    }
  }
};