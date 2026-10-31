import axios from "axios";
import db from "../../data/db.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/game/family100`;
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

function buildFamily100CanvasHtml(session, statusText = "PLAYING") {
  const botName = global.bot?.name || "WudysoftBot";
  const totalAnswers = session.jawaban.length;
  const totalFound = session.terjawab.filter(Boolean).length;
  const isAllSolved = totalFound === totalAnswers;
  const isTimeout = statusText === "TIMEOUT" || statusText === "REVEALED";
  const boardSlots = session.jawaban.map((ans, idx) => {
    const found = session.terjawab[idx];
    if (found) {
      return `
        <div class="slot-card solved">
          <div class="slot-idx">${idx + 1}</div>
          <div class="slot-text">${ans.toUpperCase()}</div>
          <div class="slot-user">${found.name ? found.name.slice(0, 10) : "USER"}</div>
        </div>
      `;
    }
    if (isTimeout) {
      return `
        <div class="slot-card missed">
          <div class="slot-idx">${idx + 1}</div>
          <div class="slot-text">${ans.toUpperCase()}</div>
          <div class="slot-user">MISSED</div>
        </div>
      `;
    }
    return `
      <div class="slot-card locked">
        <div class="slot-idx">${idx + 1}</div>
        <div class="slot-text">● ● ● ● ●</div>
        <div class="slot-user">LOCKED</div>
      </div>
    `;
  }).join("");
  const statusColor = isAllSolved ? "#22c55e" : isTimeout ? "#ef4444" : "#f59e0b";
  const statusBadge = isAllSolved ? "SELESAI (100%)" : isTimeout ? "TERBONGKAR" : "SURVEY BERJALAN";
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@700;800;900&family=Rajdhani:wght@700&display=swap');
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        width: 760px;
        height: 520px;
        background: #080a0f;
        font-family: 'Plus Jakarta Sans', sans-serif;
        display: flex;
        justify-content: center;
        align-items: center;
        overflow: hidden;
      }
      .stage-board {
        width: 720px;
        height: 480px;
        background: radial-gradient(circle at 50% 10%, rgba(245, 158, 11, 0.18) 0%, rgba(10, 13, 20, 0.98) 75%);
        border: 2px solid #283347;
        border-radius: 20px;
        box-shadow: 0 25px 60px rgba(0,0,0,0.85);
        padding: 24px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }
      .top-meta {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .brand-icon {
        background: #f59e0b;
        color: #000;
        width: 34px;
        height: 34px;
        border-radius: 8px;
        display: flex;
        justify-content: center;
        align-items: center;
        font-weight: 900;
        font-size: 16px;
      }
      .brand-title {
        color: #f8fafc;
        font-size: 19px;
        font-weight: 900;
        letter-spacing: 1px;
      }
      .status-pill {
        border: 1px solid ${statusColor};
        color: ${statusColor};
        background: rgba(15, 23, 42, 0.8);
        padding: 5px 14px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 2px;
      }
      .question-box {
        background: #111624;
        border: 1px solid #29344c;
        border-radius: 12px;
        padding: 16px 20px;
        text-align: center;
        box-shadow: inset 0 0 15px rgba(0,0,0,0.6);
      }
      .question-box small {
        display: block;
        color: #f59e0b;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 2px;
        margin-bottom: 4px;
      }
      .question-box h2 {
        color: #f1f5f9;
        font-size: 20px;
        font-weight: 800;
        line-height: 1.35;
      }
      .slots-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px 14px;
        padding: 4px 0;
      }
      .slot-card {
        height: 48px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        padding: 0 12px;
        gap: 10px;
        box-shadow: 0 4px 10px rgba(0,0,0,0.3);
      }
      .slot-card.locked {
        background: #10141f;
        border: 1px solid #202738;
      }
      .slot-card.solved {
        background: linear-gradient(90deg, #16241a 0%, #112d1b 100%);
        border: 1px solid #22c55e;
      }
      .slot-card.missed {
        background: linear-gradient(90deg, #2b1414 0%, #1f0f0f 100%);
        border: 1px solid #ef4444;
      }
      .slot-idx {
        width: 28px;
        height: 28px;
        background: #1e2638;
        color: #94a3b8;
        border-radius: 6px;
        display: flex;
        justify-content: center;
        align-items: center;
        font-weight: 800;
        font-size: 13px;
      }
      .slot-card.solved .slot-idx {
        background: #22c55e;
        color: #051a0c;
      }
      .slot-card.missed .slot-idx {
        background: #ef4444;
        color: #fff;
      }
      .slot-text {
        flex: 1;
        font-size: 14px;
        font-weight: 800;
        letter-spacing: 0.5px;
        color: #64748b;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .slot-card.solved .slot-text {
        color: #f0fdf4;
      }
      .slot-card.missed .slot-text {
        color: #fca5a5;
      }
      .slot-user {
        font-size: 11px;
        font-weight: 800;
        padding: 3px 8px;
        border-radius: 4px;
        background: rgba(0,0,0,0.4);
        color: #64748b;
        letter-spacing: 1px;
      }
      .slot-card.solved .slot-user {
        color: #4ade80;
        background: rgba(34, 197, 94, 0.2);
      }
      .slot-card.missed .slot-user {
        color: #f87171;
      }
      .bottom-meta {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-top: 1px solid #1c2434;
        padding-top: 12px;
        color: #94a3b8;
        font-size: 13px;
        font-weight: 700;
      }
      .bottom-meta b {
        color: #f59e0b;
      }
    </style>
  </head>
  <body>
    <div class="stage-board">
      <div class="top-meta">
        <div class="brand">
          <div class="brand-icon">100</div>
          <div class="brand-title">FAMILY <span>100</span></div>
        </div>
        <div class="status-pill">${statusBadge}</div>
      </div>
      <div class="question-box">
        <small>SURVEY QUESTION</small>
        <h2>${session.soal}</h2>
      </div>
      <div class="slots-grid">
        ${boardSlots}
      </div>
      <div class="bottom-meta">
        <div>PROGRESS : <b>${totalFound} / ${totalAnswers} TERJAWAB</b></div>
        <div>REWARD / ANSWER : <b>+Rp 3.000 | +150 EXP</b></div>
        <div>SYSTEM : <b>${botName}</b></div>
      </div>
    </div>
  </body>
  </html>
  `;
}

function initDB(jid = null, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.family100) global.db.family100 = {};
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

function formatFamily100Board(session) {
  const totalFound = session.terjawab.filter(Boolean).length;
  const totalAnswers = session.jawaban.length;
  let text = `Hi Survivors!
Berikut adalah papan skor survei Family 100 terbaru.

–  *F A M I L Y  1 0 0*

┌  ◦  *Pertanyaan* : ${session.soal}
│  ◦  *Progress* : ${totalFound} / ${totalAnswers} Terjawab
└  ◦  *Reward* : +Rp 3.000 | +150 EXP / Jawaban

–  *B O A R D*\n\n`;
  session.jawaban.forEach((ans, idx) => {
    const isLast = idx === totalAnswers - 1;
    const branch = isLast ? "└" : "│";
    const found = session.terjawab[idx];
    if (found) {
      const username = found.jid ? `@${found.jid.split("@")[0]}` : found.name;
      text += `${branch}  ◦  (${idx + 1}) *${ans.toUpperCase()}* ➔ ${username} ✅\n`;
    } else {
      const hidden = ans.replace(/[a-zA-Z0-9]/g, "- ");
      text += `${branch}  ◦  (${idx + 1}) [ ${hidden.trim()} ]\n`;
    }
  });
  text += `\n_Balas (reply) pesan ini langsung dengan tebakanmu untuk menjawab!_`;
  return text;
}
async function sendNeoxrFamily100(sock, ctx, chatId, session, textContent, quotedMsg, prefix = ".", imageBuffer = null, imageUrl = null) {
  const botName = global.bot?.name || "WudysoftBot";
  const footerText = `${global.bot?.footer || botName}`;
  const mentions = [...new Set((session.terjawab || []).filter(Boolean).map(t => t.jid).filter(Boolean))];
  const defaultBanner = global.bot?.media?.banner1 || global.bot?.media?.banner2 || "https://files.catbox.moe/g2e6i5.jpg";
  const mediaSource = imageBuffer || (imageUrl ? {
    url: imageUrl
  } : defaultBanner);
  const buttons = [{
    name: "quick_reply",
    buttonParamsJson: JSON.stringify({
      display_text: "📋 Cek Papan Survei",
      id: `${prefix}family100 --papan`
    })
  }, {
    name: "quick_reply",
    buttonParamsJson: JSON.stringify({
      display_text: "🏳️ Menyerah",
      id: `${prefix}family100 --nyerah`
    })
  }];
  const options = {
    image: mediaSource,
    title: `✦ ${botName} • Family 100 Arena ✦`,
    params: {
      bottom_sheet: {
        in_thread_buttons_limit: 2,
        divider_indices: [1],
        list_title: `${botName} • Menu Family 100`,
        button_title: "📋 Opsi Kuis"
      }
    },
    contextInfo: {
      mentionedJid: mentions.length ? mentions : [ctx?.sender].filter(Boolean),
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
      console.error("[Family 100 ctx.sendCta Error]:", e.message);
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
        caption: `${textContent}\n\n_${footerText}_`,
        mentions: mentions
      }, {
        quoted: quotedMsg
      });
    } else {
      sentMsg = await sock.sendMessage(chatId, {
        text: `${textContent}\n\n_${footerText}_`,
        mentions: mentions
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
  name: "family100",
  aliases: ["f100", "fam100", "survey100"],
  description: "Game survei Family 100 dengan visual papan skor realistis bertema Neoxr",
  category: "Game",
  limit: true,
  example: "family100",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const chatId = ctx?.id || msg?.key?.remoteJid;
      if (!chatId) return;
      initDB();
      if (!global.db.family100[chatId]) return;
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      const session = global.db.family100[chatId];
      if (Date.now() > session.expireTime) {
        delete global.db.family100[chatId];
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
      if (!cleanUser) return;
      const alreadyAnswered = session.jawaban.findIndex((ans, idx) => {
        return session.terjawab[idx] && normalizeText(ans) === cleanUser;
      });
      if (alreadyAnswered !== -1) {
        const answerer = session.terjawab[alreadyAnswered];
        if (typeof ctx?.react === "function") await ctx.react("⚠️");
        const alreadyText = `Hi ${ctx?.pushName || "Pemain"}!
Jawaban *"${session.jawaban[alreadyAnswered].toUpperCase()}"* sudah pernah dijawab oleh @${answerer.jid.split("@")[0]}.

–  *A L R E A D Y  A N S W E R E D*

Silakan cari dan tebak jawaban survei lainnya!`;
        await sock.sendMessage(chatId, {
          text: alreadyText,
          mentions: [answerer.jid]
        }, {
          quoted: msg
        });
        return true;
      }
      const answerIndex = session.jawaban.findIndex((ans, idx) => {
        if (session.terjawab[idx]) return false;
        const cleanAns = normalizeText(ans);
        return cleanAns === cleanUser || cleanAns.includes(cleanUser) && cleanUser.length >= 3;
      });
      if (answerIndex !== -1) {
        const matchedAnswer = session.jawaban[answerIndex];
        const senderName = ctx?.pushName || ctx?.pushname || "Pemain";
        const senderJid = ctx?.sender || msg?.key?.participant;
        session.terjawab[answerIndex] = {
          jawaban: matchedAnswer,
          jid: senderJid,
          name: senderName
        };
        if (senderJid) {
          initDB(senderJid, senderName);
          global.db.user[senderJid].exp = (Number(global.db.user[senderJid].exp) || 0) + 150;
          global.db.user[senderJid].money = (Number(global.db.user[senderJid].money) || 0) + 3e3;
        }
        saveDB();
        const totalFound = session.terjawab.filter(Boolean).length;
        const isAllFound = totalFound === session.jawaban.length;
        if (isAllFound) {
          const finalBoard = formatFamily100Board(session);
          const allWinners = session.terjawab.filter(Boolean).map(t => t.jid);
          delete global.db.family100[chatId];
          saveDB();
          const winCanvasHtml = buildFamily100CanvasHtml(session, "SOLVED");
          const {
            buffer,
            url
          } = await renderHtmlToImage(winCanvasHtml);
          const winText = `Hi Survivors!
Luar biasa! Seluruh jawaban survei berhasil dibuka 100%!

–  *C O N G R A T U L A T I O N S*

${finalBoard}

_Permainan selesai. Selamat kepada seluruh pemenang!_`;
          if (typeof ctx?.react === "function") await ctx.react("🎉");
          if (buffer || url) {
            await sock.sendMessage(chatId, {
              image: buffer || {
                url: url
              },
              caption: winText,
              mentions: allWinners
            }, {
              quoted: msg
            });
          } else {
            await sock.sendMessage(chatId, {
              text: winText,
              mentions: allWinners
            }, {
              quoted: msg
            });
          }
          return true;
        }
        const updatedBoard = formatFamily100Board(session);
        const correctInfo = `Hi ${senderName}!
Tebakanmu ada dalam survei! (+Rp 3.000 | +150 EXP)

–  *C O R R E C T  A N S W E R*

┌  ◦  *Penebak* : @${senderJid.split("@")[0]}
└  ◦  *Jawaban* : [ ${matchedAnswer.toUpperCase()} ]

${updatedBoard}`;
        const boardCanvasHtml = buildFamily100CanvasHtml(session, "PLAYING");
        const {
          buffer,
          url
        } = await renderHtmlToImage(boardCanvasHtml);
        if (typeof ctx?.react === "function") await ctx.react("✅");
        await sendNeoxrFamily100(sock, ctx, chatId, session, correctInfo, msg, ctx?.prefix || ".", buffer, url);
        return true;
      } else {
        if (typeof ctx?.react === "function") await ctx.react("❌");
        const wrongText = `Hi ${ctx?.pushName || "Pemain"}!
Jawaban "${userText}" salah atau tidak ada dalam survei ini. Coba tebakan lain!`;
        await sock.sendMessage(chatId, {
          text: wrongText
        }, {
          quoted: msg
        });
        return true;
      }
    } catch (e) {
      console.error("[FAMILY 100 BEFORE ERROR]:", e.message);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      const isGroup = Boolean(ctx?.isGroup || ctx?.id?.endsWith("@g.us"));
      if (!isGroup) {
        return ctx.reply("❌ Fitur Family 100 hanya dapat dimainkan di dalam Grup.");
      }
      const rawText = (ctx.query || ctx.text || "").trim().toLowerCase();
      const prefix = ctx.prefix || ".";
      const userName = ctx.pushName || ctx.pushname || ctx.sender.split("@")[0];
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const chatId = ctx.id;
      initDB();
      if (rawText.includes("nyerah") || rawText.includes("surrender") || rawText.includes("end") || rawText.includes("batal")) {
        if (global.db.family100[chatId]) {
          const session = global.db.family100[chatId];
          delete global.db.family100[chatId];
          saveDB();
          const revealCanvasHtml = buildFamily100CanvasHtml(session, "REVEALED");
          const {
            buffer,
            url
          } = await renderHtmlToImage(revealCanvasHtml);
          const totalAnswers = session.jawaban.length;
          let revealText = `Hi ${userName}!
Sesi Family 100 telah dihentikan.

–  *S U R R E N D E R*

┌  ◦  *Pertanyaan* : ${session.soal}
└  ◦  *Total Jawaban* : ${totalAnswers}

–  *A N S W E R S*\n\n`;
          const mentions = [];
          session.jawaban.forEach((ans, idx) => {
            const isLast = idx === totalAnswers - 1;
            const branch = isLast ? "└" : "│";
            const found = session.terjawab[idx];
            if (found) {
              mentions.push(found.jid);
              revealText += `${branch}  ◦  (${idx + 1}) *${ans.toUpperCase()}* ➔ @${found.jid.split("@")[0]}\n`;
            } else {
              revealText += `${branch}  ◦  (${idx + 1}) *${ans.toUpperCase()}* ❌\n`;
            }
          });
          revealText += `\n_Ketik \`${prefix}family100\` untuk memulai ronde baru._`;
          if (buffer || url) {
            return await sock.sendMessage(chatId, {
              image: buffer || {
                url: url
              },
              caption: revealText.trim(),
              mentions: mentions
            }, {
              quoted: quotedMsg
            });
          }
          return await sock.sendMessage(chatId, {
            text: revealText.trim(),
            mentions: mentions
          }, {
            quoted: quotedMsg
          });
        }
        return ctx.reply("❌ Tidak ada sesi Family 100 yang sedang aktif di grup ini.");
      }
      if (rawText.includes("papan") || rawText.includes("board")) {
        if (!global.db.family100[chatId]) {
          return ctx.reply(`❌ Tidak ada game aktif. Mulai game baru dengan mengetik *${prefix}family100*`);
        }
        const session = global.db.family100[chatId];
        const boardCanvasHtml = buildFamily100CanvasHtml(session, "PLAYING");
        const {
          buffer,
          url
        } = await renderHtmlToImage(boardCanvasHtml);
        const boardText = formatFamily100Board(session);
        return await sendNeoxrFamily100(sock, ctx, chatId, session, boardText, quotedMsg, prefix, buffer, url);
      }
      if (global.db.family100[chatId]) {
        const session = global.db.family100[chatId];
        const boardCanvasHtml = buildFamily100CanvasHtml(session, "PLAYING");
        const {
          buffer,
          url
        } = await renderHtmlToImage(boardCanvasHtml);
        const boardText = formatFamily100Board(session);
        return await sendNeoxrFamily100(sock, ctx, chatId, session, boardText, quotedMsg, prefix, buffer, url);
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
      if (!data || !data.soal || !Array.isArray(data.jawaban) || data.jawaban.length === 0) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal memuat kuis Family 100 dari server. Silakan coba sesaat lagi.");
      }
      const TIMEOUT_SECONDS = 180;
      global.db.family100[chatId] = {
        soal: data.soal,
        jawaban: data.jawaban.map(j => String(j).trim()),
        terjawab: new Array(data.jawaban.length).fill(null),
        msgIds: [],
        questionMsgId: null,
        startTime: Date.now(),
        expireTime: Date.now() + TIMEOUT_SECONDS * 1e3
      };
      saveDB();
      setTimeout(async () => {
        initDB();
        if (global.db.family100[chatId] && Date.now() >= global.db.family100[chatId].expireTime) {
          const activeSession = global.db.family100[chatId];
          delete global.db.family100[chatId];
          saveDB();
          const timeoutCanvasHtml = buildFamily100CanvasHtml(activeSession, "TIMEOUT");
          const {
            buffer,
            url
          } = await renderHtmlToImage(timeoutCanvasHtml);
          const totalAnswers = activeSession.jawaban.length;
          let timeoutText = `Hi All!
Waktu survei Family 100 telah habis! ⌛

–  *T I M E  O U T*

┌  ◦  *Pertanyaan* : ${activeSession.soal}
└  ◦  *Total Jawaban* : ${totalAnswers}

–  *A N S W E R S*\n\n`;
          const mentions = [];
          activeSession.jawaban.forEach((ans, idx) => {
            const isLast = idx === totalAnswers - 1;
            const branch = isLast ? "└" : "│";
            const found = activeSession.terjawab[idx];
            if (found) {
              mentions.push(found.jid);
              timeoutText += `${branch}  ◦  (${idx + 1}) *${ans.toUpperCase()}* ➔ @${found.jid.split("@")[0]}\n`;
            } else {
              timeoutText += `${branch}  ◦  (${idx + 1}) *${ans.toUpperCase()}* ❌\n`;
            }
          });
          timeoutText += `\n_Ketik \`${prefix}family100\` untuk bermain lagi!_`;
          if (buffer || url) {
            await sock.sendMessage(chatId, {
              image: buffer || {
                url: url
              },
              caption: timeoutText.trim(),
              mentions: mentions
            });
          } else {
            await sock.sendMessage(chatId, {
              text: timeoutText.trim(),
              mentions: mentions
            });
          }
        }
      }, TIMEOUT_SECONDS * 1e3);
      const initialBoard = formatFamily100Board(global.db.family100[chatId]);
      const initialCanvasHtml = buildFamily100CanvasHtml(global.db.family100[chatId], "PLAYING");
      const {
        buffer: cardBuffer,
        url: cardUrl
      } = await renderHtmlToImage(initialCanvasHtml);
      await sendNeoxrFamily100(sock, ctx, chatId, global.db.family100[chatId], initialBoard, quotedMsg, prefix, cardBuffer, cardUrl);
      await ctx.react("👨‍👩‍👧‍👦");
    } catch (error) {
      console.error("[Family 100 Execute Error]:", error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Family 100 Error: ${errMsg}`);
    }
  }
};