import axios from "axios";
import db from "../../data/db.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/game/cak-lontong`;
async function renderHtmlToImage(htmlContent) {
  const rawApi = global.bot?.api?.wudysoft || "";
  const cleanApi = rawApi.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  const baseUrl = `https://${cleanApi}/api/tools/html2img/`;
  const headers = {
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
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

function buildCaklontongCanvasHtml(soal, displayClueOrAnswer, status = "QUESTION", deskripsi = "") {
  const botName = global.bot?.name || "WudysoftBot";
  const isSolved = status === "CORRECT";
  const isTimeout = status === "TIMEOUT" || status === "REVEALED";
  const statusColor = isSolved ? "#22c55e" : isTimeout ? "#ef4444" : "#f59e0b";
  const statusLabel = isSolved ? "LOGIKA TEPAT" : isTimeout ? "TERBONGKAR" : "TEKA-TEKI LOGIKA";
  const chars = displayClueOrAnswer.split("");
  const boxesHtml = chars.map(char => {
    if (char === " ") return `<div class="space-box"></div>`;
    return `<div class="letter-box ${char !== "•" ? "active" : ""}">${char}</div>`;
  }).join("");
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@700;800;900&family=Rajdhani:wght@700&display=swap');
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        width: 750px;
        height: 480px;
        background: #090b10;
        font-family: 'Plus Jakarta Sans', sans-serif;
        display: flex;
        justify-content: center;
        align-items: center;
        overflow: hidden;
      }
      .stage-card {
        position: relative;
        width: 710px;
        height: 440px;
        background: radial-gradient(circle at 50% 0%, rgba(245, 158, 11, 0.22) 0%, rgba(12, 15, 23, 0.98) 75%);
        border: 2px solid #232b3e;
        border-radius: 20px;
        box-shadow: 0 25px 60px rgba(0,0,0,0.85);
        padding: 24px 28px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }
      .top-nav {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .brand-title {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .badge-icon {
        width: 32px;
        height: 32px;
        background: #f59e0b;
        color: #000;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 900;
        font-size: 18px;
      }
      .brand-text {
        color: #f8fafc;
        font-size: 18px;
        font-weight: 900;
        letter-spacing: 1px;
      }
      .status-pill {
        background: rgba(245, 158, 11, 0.15);
        border: 1px solid ${statusColor};
        color: ${statusColor};
        padding: 6px 14px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 2px;
        text-transform: uppercase;
      }
      .question-board {
        background: #111522;
        border: 1px solid #283248;
        border-radius: 14px;
        padding: 22px 24px;
        box-shadow: inset 0 0 20px rgba(0,0,0,0.6);
        position: relative;
      }
      .quote-mark {
        position: absolute;
        top: -12px;
        left: 20px;
        background: #f59e0b;
        color: #0b0f19;
        font-size: 11px;
        font-weight: 900;
        padding: 2px 10px;
        border-radius: 4px;
        letter-spacing: 1.5px;
      }
      .question-text {
        font-size: 22px;
        font-weight: 800;
        color: #f1f5f9;
        line-height: 1.45;
        text-align: center;
      }
      .reason-box {
        margin-top: 10px;
        font-size: 14px;
        color: #38bdf8;
        text-align: center;
        font-weight: 700;
        font-style: italic;
      }
      .letters-bay {
        display: flex;
        justify-content: center;
        flex-wrap: wrap;
        gap: 8px;
        padding: 10px 0;
      }
      .letter-box {
        width: 36px;
        height: 44px;
        background: #161b2a;
        border: 2px solid #2f3b54;
        border-radius: 8px;
        display: flex;
        justify-content: center;
        align-items: center;
        font-family: 'Rajdhani', sans-serif;
        font-size: 24px;
        font-weight: 700;
        color: #64748b;
        box-shadow: 0 4px 10px rgba(0,0,0,0.4);
      }
      .letter-box.active {
        background: #f59e0b;
        border-color: #fbbf24;
        color: #090d16;
        text-shadow: none;
      }
      .space-box {
        width: 16px;
      }
      .meta-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-top: 1px solid #1f2738;
        padding-top: 12px;
        color: #94a3b8;
        font-size: 13px;
        font-weight: 700;
      }
      .meta-footer b {
        color: #f59e0b;
      }
    </style>
  </head>
  <body>
    <div class="stage-card">
      <div class="top-nav">
        <div class="brand-title">
          <div class="badge-icon">?</div>
          <div class="brand-text">CAK LONTONG <span>ARENA</span></div>
        </div>
        <div class="status-pill">${statusLabel}</div>
      </div>
      <div class="question-board">
        <div class="quote-mark">PERTANYAAN</div>
        <div class="question-text">${soal}</div>
        ${deskripsi ? `<div class="reason-box">"${deskripsi}"</div>` : ""}
      </div>
      <div class="letters-bay">
        ${boxesHtml}
      </div>
      <div class="meta-footer">
        <div>REWARD : <b>+Rp 4.000 | +120 EXP</b></div>
        <div>TIMEOUT : <b>120s</b></div>
        <div>BOT : <b>${botName}</b></div>
      </div>
    </div>
  </body>
  </html>
  `;
}

function initDB(jid = null, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.caklontong) global.db.caklontong = {};
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

function normalizeText(str) {
  return (str || "").toLowerCase().replace(/[^\w\s]/gi, "").replace(/\s+/g, " ").trim();
}

function generateClue(answer) {
  const chars = answer.trim().split("");
  return chars.map((c, i) => {
    if (c === " ") return "   ";
    if (i === 0 || i === chars.length - 1) return `*${c.toUpperCase()}*`;
    return "•";
  }).join(" ");
}

function getRawDisplayClue(answer) {
  const chars = answer.trim().split("");
  return chars.map((c, i) => {
    if (c === " ") return " ";
    if (i === 0 || i === chars.length - 1) return c.toUpperCase();
    return "•";
  }).join("");
}
async function sendNeoxrCaklontong(sock, ctx, chatId, session, textContent, quotedMsg, prefix = ".", imageBuffer = null, imageUrl = null) {
  const botName = global.bot?.name || "WudysoftBot";
  const footerText = `${global.bot?.footer || botName}`;
  const defaultBanner = global.bot?.media?.banner1 || global.bot?.media?.banner2 || "https://files.catbox.moe/g2e6i5.jpg";
  const mediaSource = imageBuffer || (imageUrl ? {
    url: imageUrl
  } : defaultBanner);
  const buttons = [{
    name: "quick_reply",
    buttonParamsJson: JSON.stringify({
      display_text: "💡 Bantuan Clue",
      id: `${prefix}caklontong --clue`
    })
  }, {
    name: "quick_reply",
    buttonParamsJson: JSON.stringify({
      display_text: "🏳️ Menyerah",
      id: `${prefix}caklontong --nyerah`
    })
  }];
  const options = {
    image: mediaSource,
    title: `✦ ${botName} • Kuis Cak Lontong ✦`,
    params: {
      bottom_sheet: {
        in_thread_buttons_limit: 2,
        divider_indices: [1],
        list_title: `${botName} • Bantuan Game`,
        button_title: "💡 Menu Bantuan"
      }
    },
    contextInfo: {
      mentionedJid: [ctx?.sender].filter(Boolean),
      forwardingScore: 999,
      isForwarded: true
    },
    quoted: quotedMsg || undefined
  };
  let sentMsg = null;
  if (typeof ctx?.sendCta === "function" && chatId === ctx.id) {
    try {
      sentMsg = await ctx.sendCta(textContent, footerText, buttons, options);
    } catch (e) {
      console.error("[Cak Lontong ctx.sendCta Error]:", e.message);
    }
  }
  if (!sentMsg) {
    try {
      const mediaPayload = imageBuffer ? {
        image: imageBuffer
      } : imageUrl ? {
        image: {
          url: imageUrl
        }
      } : {};
      sentMsg = await sock.sendMessage(chatId, {
        ...mediaPayload,
        caption: textContent,
        footer: footerText,
        viewOnceMessage: {
          message: {
            interactiveMessage: {
              body: {
                text: textContent
              },
              footer: {
                text: footerText
              },
              nativeFlowMessage: {
                buttons: buttons
              },
              contextInfo: options.contextInfo
            }
          }
        }
      }, {
        quoted: quotedMsg
      });
    } catch (e) {}
  }
  if (!sentMsg) {
    if (imageBuffer || imageUrl) {
      sentMsg = await sock.sendMessage(chatId, {
        image: imageBuffer || {
          url: imageUrl
        },
        caption: `${textContent}\n\n_${footerText}_`
      }, {
        quoted: quotedMsg
      });
    } else {
      sentMsg = await sock.sendMessage(chatId, {
        text: `${textContent}\n\n_${footerText}_`
      }, {
        quoted: quotedMsg
      });
    }
  }
  if (sentMsg?.key?.id && session) {
    if (!Array.isArray(session.msgIds)) session.msgIds = [];
    if (!session.msgIds.includes(sentMsg.key.id)) {
      session.msgIds.push(sentMsg.key.id);
    }
    session.questionMsgId = sentMsg.key.id;
    saveDB();
  }
  return sentMsg;
}
export default {
  name: "caklontong",
  aliases: ["caklon", "lontong"],
  description: "Game teka-teki logika nyeleneh ala Cak Lontong dengan canvas realistis bertema Neoxr",
  category: "Game",
  limit: true,
  example: "caklontong",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const chatId = ctx?.id || msg?.key?.remoteJid;
      if (!chatId) return;
      initDB();
      if (!global.db.caklontong[chatId]) return;
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      const session = global.db.caklontong[chatId];
      if (Date.now() > session.expireTime) {
        delete global.db.caklontong[chatId];
        saveDB();
        return;
      }
      const quotedStanzaId = ctx?.quoted?.id || msg?.message?.extendedTextMessage?.contextInfo?.stanzaId;
      const isQuotingGame = quotedStanzaId && (quotedStanzaId === session.questionMsgId || Array.isArray(session.msgIds) && session.msgIds.includes(quotedStanzaId));
      if (!isQuotingGame) return;
      const userText = (ctx?.text || ctx?.query || msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "").trim();
      const prefixList = [".", "#", "!", "/", ctx?.prefix].filter(Boolean);
      if (prefixList.some(p => userText.startsWith(p))) return;
      const cleanUser = normalizeText(userText);
      const cleanAnswer = normalizeText(session.jawaban);
      if (!cleanUser) return;
      if (cleanUser === cleanAnswer) {
        delete global.db.caklontong[chatId];
        const senderJid = ctx?.sender || msg?.key?.participant;
        const senderName = ctx?.pushName || ctx?.pushname || "Pemain Cerdas";
        if (senderJid) {
          initDB(senderJid, senderName);
          global.db.user[senderJid].money = (Number(global.db.user[senderJid].money) || 0) + 4e3;
          global.db.user[senderJid].exp = (Number(global.db.user[senderJid].exp) || 0) + 120;
        }
        saveDB();
        if (typeof ctx?.react === "function") await ctx.react("🎉");
        const winCanvasHtml = buildCaklontongCanvasHtml(session.soal, session.jawaban.toUpperCase(), "CORRECT", session.deskripsi);
        const {
          buffer,
          url
        } = await renderHtmlToImage(winCanvasHtml);
        const winText = `Hi ${senderName}!
Tebakan logika nyeleneh kamu benar sekali!

–  *C O N G R A T U L A T I O N S*

┌  ◦  *Player* : @${senderJid.split("@")[0]}
│  ◦  *Pertanyaan* : ${session.soal}
│  ◦  *Jawaban* : ${session.jawaban.toUpperCase()}
└  ◦  *Hadiah* : +Rp 4.000 | +120 EXP

–  *A L A S A N*

"${session.deskripsi}"

_Ketik \`${ctx?.prefix || "."}caklontong\` untuk bermain lagi._`;
        if (buffer || url) {
          await sock.sendMessage(chatId, {
            image: buffer || {
              url: url
            },
            caption: winText,
            mentions: [senderJid]
          }, {
            quoted: msg
          });
        } else {
          await sock.sendMessage(chatId, {
            text: winText,
            mentions: [senderJid]
          }, {
            quoted: msg
          });
        }
        return true;
      } else {
        if (typeof ctx?.react === "function") await ctx.react("❌");
        const wrongText = `Hi ${ctx?.pushName || "Pemain"}!
Jawaban "${userText}" masih belum tepat.

–  *W R O N G  A N S W E R*

Gunakan sudut pandang dan logika nyeleneh khas Cak Lontong!`;
        await sock.sendMessage(chatId, {
          text: wrongText
        }, {
          quoted: msg
        });
        return true;
      }
    } catch (e) {
      console.error("[CAK LONTONG BEFORE ERROR]:", e.message);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      const isGroup = Boolean(ctx?.isGroup || ctx?.id?.endsWith("@g.us"));
      if (!isGroup) {
        return ctx.reply("❌ Fitur Kuis Cak Lontong hanya dapat dimainkan di dalam Grup.");
      }
      const rawText = (ctx.query || ctx.text || "").trim().toLowerCase();
      const prefix = ctx.prefix || ".";
      const userName = ctx.pushName || ctx.pushname || ctx.sender.split("@")[0];
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const chatId = ctx.id;
      initDB();
      if (rawText.includes("nyerah") || rawText.includes("surrender") || rawText.includes("end") || rawText.includes("batal")) {
        if (global.db.caklontong[chatId]) {
          const session = global.db.caklontong[chatId];
          delete global.db.caklontong[chatId];
          saveDB();
          const surrenderCanvasHtml = buildCaklontongCanvasHtml(session.soal, session.jawaban.toUpperCase(), "REVEALED", session.deskripsi);
          const {
            buffer,
            url
          } = await renderHtmlToImage(surrenderCanvasHtml);
          const surrenderText = `Hi ${userName}!
Kamu telah menyerah pada teka-teki ini.

–  *S U R R E N D E R*

┌  ◦  *Pertanyaan* : ${session.soal}
└  ◦  *Jawaban Asli* : ${session.jawaban.toUpperCase()}

–  *A L A S A N*

"${session.deskripsi}"

_Gunakan perintah \`${prefix}caklontong\` untuk memulai soal baru._`;
          if (buffer || url) {
            return await sock.sendMessage(chatId, {
              image: buffer || {
                url: url
              },
              caption: surrenderText
            }, {
              quoted: quotedMsg
            });
          }
          return await sock.sendMessage(chatId, {
            text: surrenderText
          }, {
            quoted: quotedMsg
          });
        }
        return ctx.reply("❌ Tidak ada sesi kuis Cak Lontong yang sedang aktif.");
      }
      if (rawText.includes("clue") || rawText.includes("bantuan") || rawText.includes("hint")) {
        if (!global.db.caklontong[chatId]) {
          return ctx.reply(`❌ Tidak ada game aktif. Mulai game baru dengan mengetik *${prefix}caklontong*`);
        }
        const session = global.db.caklontong[chatId];
        const clueText = generateClue(session.jawaban);
        const clueMsg = `Hi ${userName}!
Berikut adalah petunjuk huruf untuk teka-teki saat ini.

–  *H I N T  C L U E*

┌  ◦  *Pertanyaan* : ${session.soal}
└  ◦  *Clue* : [ ${clueText} ] (${session.jawaban.length} Karakter)

_Balas (reply) langsung pesan ini dengan jawaban logikamu!_`;
        return await sendNeoxrCaklontong(sock, ctx, chatId, session, clueMsg, quotedMsg, prefix);
      }
      if (global.db.caklontong[chatId]) {
        const session = global.db.caklontong[chatId];
        const clueText = generateClue(session.jawaban);
        const activeMsg = `Hi ${userName}!
Masih ada kuis Cak Lontong yang belum terpecahkan.

–  *A C T I V E  G A M E*

┌  ◦  *Pertanyaan* : ${session.soal}
└  ◦  *Clue* : [ ${clueText} ] (${session.jawaban.length} Karakter)

_Balas pesan kuis sebelumnya langsung untuk menebak._`;
        return await sendNeoxrCaklontong(sock, ctx, chatId, session, activeMsg, quotedMsg, prefix);
      }
      await ctx.react("⏳");
      const {
        data
      } = await axios.get(API_URL, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 3e4
      });
      if (!data || !data.soal || !data.jawaban) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal memuat kuis Cak Lontong dari server. Silakan coba lagi.");
      }
      const TIMEOUT_SECONDS = 120;
      global.db.caklontong[chatId] = {
        index: data.index,
        soal: data.soal,
        jawaban: String(data.jawaban).trim(),
        deskripsi: data.deskripsi || "Tidak ada alasan.",
        msgIds: [],
        questionMsgId: null,
        startTime: Date.now(),
        expireTime: Date.now() + TIMEOUT_SECONDS * 1e3
      };
      saveDB();
      setTimeout(async () => {
        initDB();
        if (global.db.caklontong[chatId] && Date.now() >= global.db.caklontong[chatId].expireTime) {
          const activeSession = global.db.caklontong[chatId];
          delete global.db.caklontong[chatId];
          saveDB();
          const timeoutCanvasHtml = buildCaklontongCanvasHtml(activeSession.soal, activeSession.jawaban.toUpperCase(), "TIMEOUT", activeSession.deskripsi);
          const {
            buffer,
            url
          } = await renderHtmlToImage(timeoutCanvasHtml);
          const timeoutText = `Hi All!
Waktu menjawab kuis Cak Lontong telah habis! ⌛

–  *T I M E  O U T*

┌  ◦  *Pertanyaan* : ${activeSession.soal}
└  ◦  *Jawaban Asli* : ${activeSession.jawaban.toUpperCase()}

–  *A L A S A N*

"${activeSession.deskripsi}"

_Ketik \`${prefix}caklontong\` untuk bermain lagi!_`;
          if (buffer || url) {
            await sock.sendMessage(chatId, {
              image: buffer || {
                url: url
              },
              caption: timeoutText
            });
          } else {
            await sock.sendMessage(chatId, {
              text: timeoutText
            });
          }
        }
      }, TIMEOUT_SECONDS * 1e3);
      const clueText = generateClue(global.db.caklontong[chatId].jawaban);
      const displayClueLetters = getRawDisplayClue(global.db.caklontong[chatId].jawaban);
      const canvasHtml = buildCaklontongCanvasHtml(global.db.caklontong[chatId].soal, displayClueLetters, "QUESTION");
      const {
        buffer: cardBuffer,
        url: cardUrl
      } = await renderHtmlToImage(canvasHtml);
      const questionMsg = `Hi Survivors!
Pecahkan teka-teki logika nyeleneh dari Cak Lontong berikut.

–  *Q U E S T I O N*

"${global.db.caklontong[chatId].soal}"

–  *G A M E  I N F O*

┌  ◦  *Clue* : [ ${clueText} ] (${global.db.caklontong[chatId].jawaban.length} Karakter)
│  ◦  *Timeout* : ${TIMEOUT_SECONDS} Detik
└  ◦  *Reward* : +Rp 4.000 | +120 EXP

_Balas (reply) pesan ini langsung dengan jawaban logikamu!_`;
      await sendNeoxrCaklontong(sock, ctx, chatId, global.db.caklontong[chatId], questionMsg, quotedMsg, prefix, cardBuffer, cardUrl);
      await ctx.react("🤔");
    } catch (error) {
      console.error("[Cak Lontong Error]:", error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Cak Lontong Error: ${errMsg}`);
    }
  }
};