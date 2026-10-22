import axios from "axios";
import db from "../../data/db.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/search/chord/v4`;
const SESSION_TIMEOUT = 25 * 60 * 1e3;
const CONFIG = {
  TIMEOUT: 45e3,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  ITEMS_PER_PAGE: 8
};

function initDB(jid = null, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.chordGuitar) global.db.chordGuitar = {};
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
    if (["q", "query", "cari"].includes(key)) key = "query";
    if (["id", "chordid", "detail"].includes(key)) key = "id";
    if (["singer", "artist", "penyanyi"].includes(key)) key = "singer_id";
    if (["populer", "pop"].includes(key)) key = "popular";
    if (["terbaru", "new"].includes(key)) key = "latest";
    if (["rek", "rekomendasi"].includes(key)) key = "chord_rec";
    if (rawVal !== undefined) {
      if (rawVal.startsWith('"') && rawVal.endsWith('"') || rawVal.startsWith("'") && rawVal.endsWith("'")) {
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
    flags: flags,
    cleanPrompt: cleanPrompt
  };
}
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

function generateChordCanvasHtml(title, singer, chordText) {
  const cleanChord = chordText.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=JetBrains+Mono:wght@500;700;800&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0b0c10;
      font-family: 'Plus Jakarta Sans', sans-serif;
      display: flex;
      justify-content: center;
      padding: 40px;
    }
    .chord-card {
      width: 760px;
      background: linear-gradient(145deg, #14171f, #0d0f14);
      border-radius: 28px;
      padding: 40px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: 0 30px 60px rgba(0,0,0,0.6);
      color: #ffffff;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      padding-bottom: 24px;
      margin-bottom: 30px;
    }
    .tag {
      font-size: 11px;
      font-weight: 700;
      color: #f59e0b;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-bottom: 6px;
    }
    .title {
      font-size: 26px;
      font-weight: 800;
      color: #ffffff;
      line-height: 1.25;
    }
    .singer {
      font-size: 16px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.6);
      margin-top: 4px;
    }
    .badge {
      background: rgba(245, 158, 11, 0.12);
      border: 1px solid rgba(245, 158, 11, 0.3);
      color: #f59e0b;
      padding: 8px 16px;
      border-radius: 99px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    .chord-area {
      font-family: 'JetBrains Mono', monospace;
      font-size: 15px;
      line-height: 1.6;
      white-space: pre-wrap;
      color: rgba(255, 255, 255, 0.88);
      background: rgba(0, 0, 0, 0.25);
      border: 1px solid rgba(255, 255, 255, 0.04);
      border-radius: 18px;
      padding: 28px;
    }
    .footer {
      margin-top: 30px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
      padding-top: 20px;
      font-size: 12px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.35);
    }
  </style>
</head>
<body>
  <div class="chord-card">
    <div class="header">
      <div>
        <div class="tag">Guitar Chords & Lyrics</div>
        <div class="title">${title}</div>
        <div class="singer">Artis / Penyanyi: ${singer || "-"}</div>
      </div>
      <div class="badge">Official Chord</div>
    </div>

    <div class="chord-area">${cleanChord}</div>

    <div class="footer">
      <span>Wudysoft Chord Canvas Engine</span>
      <span>Music Archive & Sheet</span>
    </div>
  </div>
</body>
</html>`;
}
async function requestChord(params = {}) {
  const {
    data
  } = await axios.get(API_URL, {
    params: params,
    headers: {
      "User-Agent": CONFIG.USER_AGENT
    },
    timeout: CONFIG.TIMEOUT
  });
  return data;
}

function recordSession(chatId, messageId, lastQuery, lastChordId, chordTitle) {
  if (!chatId) return;
  initDB();
  if (!global.db.chordGuitar[chatId]) {
    global.db.chordGuitar[chatId] = {
      query: lastQuery || null,
      last_chord_id: lastChordId || null,
      title: chordTitle || null,
      msgIds: [],
      lastMsgId: null,
      updatedAt: Date.now(),
      expireTime: Date.now() + SESSION_TIMEOUT
    };
  }
  const s = global.db.chordGuitar[chatId];
  if (lastQuery) s.query = lastQuery;
  if (lastChordId) s.last_chord_id = lastChordId;
  if (chordTitle) s.title = chordTitle;
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
  name: "chord",
  aliases: ["kuncigitar", "chordgitar", "kunci", "chords"],
  description: "Cari chord gitar lagu Indonesia & mancanegara lengkap dengan Canvas Card & CTA Copy.",
  category: "Search",
  limit: true,
  example: "chord Last Child\nchord --id 65fcd0dfcbaed95a8882bc98\nchord --populer atau chord --rekomendasi",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const chatId = ctx?.id || msg?.key?.remoteJid;
      if (!chatId) return;
      initDB();
      if (!global.db.chordGuitar[chatId]) return;
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      const sessionData = global.db.chordGuitar[chatId];
      if (Date.now() > sessionData.expireTime) {
        delete global.db.chordGuitar[chatId];
        saveDB();
        return;
      }
      const quotedStanzaId = ctx?.quoted?.id || msg?.message?.extendedTextMessage?.contextInfo?.stanzaId;
      const isQuoting = quotedStanzaId && (quotedStanzaId === sessionData.lastMsgId || Array.isArray(sessionData.msgIds) && sessionData.msgIds.includes(quotedStanzaId));
      if (!isQuoting) return;
      const userText = (ctx?.text || ctx?.query || msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "").trim();
      const prefixList = [".", "#", "!", "/", ctx?.prefix].filter(Boolean);
      if (prefixList.some(p => userText.startsWith(p))) return;
      if (!userText) return;
      if (/^[a-f0-9]{24}$/i.test(userText.trim())) {
        if (typeof ctx?.react === "function") await ctx.react("⏳");
        const res = await requestChord({
          action: "detail",
          id: userText.trim()
        });
        const item = res?.data;
        if (!item || !item.chord) return;
        const html = generateChordCanvasHtml(item.full_title, item.singer, item.chord);
        const {
          url: canvasUrl,
          buffer: canvasBuffer
        } = await renderHtmlToImage(html);
        const bodyText = `–  *C H O R D  G I T A R*\n\n` + `┌  ◦  *Judul* : ${item.full_title}\n` + `├  ◦  *Penyanyi* : ${item.singer || "-"}\n` + `├  ◦  *Dilihat* : 👁️ ${item.views || 0}x\n` + `└  ◦  *ID* : \`${item._id}\`\n\n` + `───  *K U N C I  G I T A R*  ───\n\n` + item.chord.trim();
        const buttons = [{
          name: "cta_copy",
          display_text: "📄 Salin Chord",
          copy_code: item.chord.trim()
        }];
        if (canvasUrl) {
          buttons.push({
            name: "cta_url",
            display_text: "🖼️ Download Chord Canvas",
            url: canvasUrl
          });
        }
        let sentMsg;
        if (typeof ctx.sendCta === "function") {
          sentMsg = await ctx.sendCta(bodyText, `_Chord Guitar Canvas_`, buttons, {
            media: canvasUrl || null,
            quoted: msg
          });
        } else if (canvasBuffer) {
          sentMsg = await sock.sendMessage(ctx.id, {
            image: canvasBuffer,
            caption: bodyText
          }, {
            quoted: msg
          });
        } else {
          sentMsg = await sock.sendMessage(ctx.id, {
            text: bodyText
          }, {
            quoted: msg
          });
        }
        const newMsgId = sentMsg?.key?.id;
        recordSession(chatId, newMsgId, sessionData.query, item._id, item.full_title);
        if (typeof ctx?.react === "function") await ctx.react("✨");
        return true;
      }
    } catch (e) {
      console.error("[CHORD BEFORE ERROR]:", e.message);
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
        if (["chord", "kuncigitar", "chordgitar", "kunci", "chords"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const footer = global.footer || global.bot?.footer || `_${botName}_`;
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (rawText === "--reset" || rawText === "--clear" || rawText === "reset" || rawText === "clear") {
        if (global.db.chordGuitar[chatId]) {
          delete global.db.chordGuitar[chatId];
          saveDB();
          return ctx.reply("🧹 *Sesi pencarian chord berhasil direset!*");
        }
        return ctx.reply("ℹ️ Tidak ada sesi pencarian chord aktif.");
      }
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      if (flags.id || /^[a-f0-9]{24}$/i.test(cleanPrompt)) {
        await ctx.react("⏳");
        const chordId = flags.id || cleanPrompt;
        const res = await requestChord({
          action: "detail",
          id: chordId
        });
        const item = res?.data;
        if (!item || !item.chord) {
          await ctx.react("❌");
          return ctx.reply(`–  *C H O R D  N O T  F O U N D*\n\n┌  ◦  ID: ${chordId}\n└  ◦  Status: Chord tidak ditemukan.\n\n${footer}`);
        }
        const html = generateChordCanvasHtml(item.full_title, item.singer, item.chord);
        const {
          url: canvasUrl,
          buffer: canvasBuffer
        } = await renderHtmlToImage(html);
        const bodyText = `–  *C H O R D  G I T A R*\n\n` + `┌  ◦  *Judul* : ${item.full_title}\n` + `├  ◦  *Penyanyi* : ${item.singer || "-"}\n` + `├  ◦  *Dilihat* : 👁️ ${item.views || 0}x\n` + `└  ◦  *ID* : \`${item._id}\`\n\n` + `───  *K U N C I  G I T A R*  ───\n\n` + item.chord.trim() + `\n\n` + `${footer}`;
        const buttons = [{
          name: "cta_copy",
          display_text: "📄 Salin Chord",
          copy_code: item.chord.trim()
        }];
        if (canvasUrl) {
          buttons.push({
            name: "cta_url",
            display_text: "🖼️ Download Chord Canvas",
            url: canvasUrl
          });
        }
        let sentMsg;
        if (typeof ctx.sendCta === "function") {
          sentMsg = await ctx.sendCta(bodyText, `_Chord Guitar Canvas_`, buttons, {
            media: canvasUrl || null,
            quoted: quotedMsg
          });
        } else if (canvasBuffer) {
          sentMsg = await sock.sendMessage(ctx.id, {
            image: canvasBuffer,
            caption: bodyText
          }, {
            quoted: quotedMsg
          });
        } else {
          sentMsg = await sock.sendMessage(ctx.id, {
            text: bodyText
          }, {
            quoted: quotedMsg
          });
        }
        const sentMsgId = sentMsg?.key?.id;
        recordSession(chatId, sentMsgId, null, item._id, item.full_title);
        await ctx.react("✨");
        return;
      }
      let actionType = "search";
      let requestParams = {};
      if (flags.popular || flags.populer) {
        actionType = "popular";
      } else if (flags.latest || flags.terbaru) {
        actionType = "latest";
      } else if (flags.chord_rec || flags.rekomendasi) {
        actionType = "chord_rec";
      } else if (flags.singer_id) {
        actionType = "by_singer";
        requestParams.id = flags.singer_id;
      }
      const searchQuery = flags.query || cleanPrompt;
      if (!searchQuery && actionType === "search") {
        const guideText = `–  *C H O R D  G I T A R*

Cari kunci gitar lagu lengkap dengan visual canvas card & tombol salin otomatis.

┌  ◦  *Cari Lagu* : \`${prefix}chord Last Child\`
│  ◦  *Chord Populer* : \`${prefix}chord --populer\`
│  ◦  *Chord Terbaru* : \`${prefix}chord --terbaru\`
│  ◦  *Rekomendasi* : \`${prefix}chord --rekomendasi\`
└  ◦  *Ambil via ID* : \`${prefix}chord --id <chord_id>\`

${footer}`;
        return ctx.reply(guideText, {
          quoted: quotedMsg
        });
      }
      await ctx.react("🔍");
      requestParams.action = actionType;
      if (actionType === "search") requestParams.query = searchQuery;
      const res = await requestChord(requestParams);
      const listData = Array.isArray(res?.data) ? res.data : [];
      if (!listData.length) {
        await ctx.react("❌");
        return ctx.reply(`–  *C H O R D  N O T  F O U N D*\n\n┌  ◦  Query: "${searchQuery}"\n└  ◦  Status: Chord lagu tidak ditemukan.\n\n${footer}`);
      }
      const page = Math.max(1, Number(flags.page) || 1);
      const totalPages = Math.ceil(listData.length / CONFIG.ITEMS_PER_PAGE) || 1;
      const pageItems = listData.slice((page - 1) * CONFIG.ITEMS_PER_PAGE, page * CONFIG.ITEMS_PER_PAGE);
      const rows = pageItems.map((item, idx) => {
        const globalIdx = (page - 1) * CONFIG.ITEMS_PER_PAGE + idx + 1;
        const title = (item.full_title || "Untitled").slice(0, 24);
        const singer = item.singer || "Unknown Artist";
        return {
          title: `${globalIdx}. ${title}`,
          id: `${prefix}chord --id ${item._id}`,
          description: `${singer} • ID: ${item._id}`.slice(0, 60)
        };
      });
      let baseCmd = `${prefix}chord`;
      if (actionType === "search") baseCmd += ` ${searchQuery}`;
      else baseCmd += ` --${actionType}`;
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: `PILIH CHORD (${pageItems.length})`,
          sections: [{
            title: `DAFTAR LAGU (Hal ${page}/${totalPages})`,
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
      const bodyText = `–  *C H O R D  -  R E S U L T*\n\n` + `┌  ◦  *Kategori* : ${actionType.toUpperCase()}\n` + (searchQuery ? `├  ◦  *Query* : "${searchQuery}"\n` : "") + `├  ◦  *Total Ditemukan* : ${listData.length} Chord\n` + `└  ◦  *Halaman* : ${page} / ${totalPages}\n\n` + `_Pilih lagu melalui tombol menu di bawah untuk membuka kunci gitar dan canvas card:_`;
      const options = {
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `Guitar Chords`,
            button_title: `Buka Hal ${page}`
          }
        },
        quoted: quotedMsg
      };
      let sentMsg;
      if (typeof ctx.sendCta === "function") {
        sentMsg = await ctx.sendCta(bodyText, footer, buttons, options);
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
      console.error("[Chord Error]:", error?.message || error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.error || error.message || "Gagal memproses pencarian chord gitar.";
      ctx.reply(`–  *E R R O R*\n\n┌  ◦  *Info* : ${errMsg}\n└  ◦  *Command* : ${ctx.command || "chord"}\n\n${footer}`);
    }
  }
};