import axios from "axios";
import db from "../../data/db.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/game/lengkapi-kalimat`;
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

function buildLengkapiKalimatCanvasHtml(pertanyaan, displayClueOrWord, status = "QUESTION") {
  const botName = global.bot?.name || "WudysoftBot";
  const isCorrect = status === "CORRECT";
  const isTimeout = status === "TIMEOUT" || status === "REVEALED";
  const statusColor = isCorrect ? "#10b981" : isTimeout ? "#ef4444" : "#06b6d4";
  const statusLabel = isCorrect ? "TERLENGKAPI" : isTimeout ? "TERBONGKAR" : "KATA RUMPANG";
  let sentenceDisplay = pertanyaan;
  if (isCorrect || isTimeout) {
    sentenceDisplay = pertanyaan.replace(/_{2,}/g, `<span class="highlight-slot solved">${displayClueOrWord.toUpperCase()}</span>`);
  } else {
    sentenceDisplay = pertanyaan.replace(/_{2,}/g, `<span class="highlight-slot pending">? ? ?</span>`);
  }
  const chars = displayClueOrWord.split("");
  const tilesHtml = chars.map(char => {
    if (char === " ") return `<div class="space-box"></div>`;
    const isLetter = char !== "•";
    return `<div class="tile-box ${isLetter ? "active" : ""}">${char}</div>`;
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
        background: #06090e;
        font-family: 'Plus Jakarta Sans', sans-serif;
        display: flex;
        justify-content: center;
        align-items: center;
        overflow: hidden;
      }
      .stage-card {
        width: 710px;
        height: 440px;
        background: radial-gradient(circle at 50% 0%, rgba(6, 182, 212, 0.22) 0%, rgba(9, 14, 22, 0.98) 75%);
        border: 2px solid #1f2c3f;
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
      .brand {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .brand-icon {
        background: #06b6d4;
        color: #03151e;
        width: 32px;
        height: 32px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 900;
        font-size: 16px;
      }
      .brand-text {
        color: #f8fafc;
        font-size: 18px;
        font-weight: 900;
        letter-spacing: 0.5px;
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
        text-transform: uppercase;
      }
      .sentence-board {
        background: #0f1724;
        border: 1px solid #1e2d42;
        border-radius: 14px;
        padding: 24px 26px;
        box-shadow: inset 0 0 20px rgba(0,0,0,0.6);
        position: relative;
        text-align: center;
      }
      .board-tag {
        position: absolute;
        top: -12px;
        left: 20px;
        background: #06b6d4;
        color: #051a24;
        font-size: 11px;
        font-weight: 900;
        padding: 2px 10px;
        border-radius: 4px;
        letter-spacing: 1.5px;
      }
      .sentence-text {
        font-size: 22px;
        font-weight: 800;
        color: #f1f5f9;
        line-height: 1.5;
      }
      .highlight-slot {
        display: inline-block;
        padding: 2px 12px;
        border-radius: 6px;
        font-weight: 900;
      }
      .highlight-slot.pending {
        background: rgba(6, 182, 212, 0.15);
        color: #38bdf8;
        border: 1px dashed #0ea5e9;
      }
      .highlight-slot.solved {
        background: rgba(16, 185, 129, 0.2);
        color: #34d399;
        border: 1px solid #10b981;
      }
      .tiles-bay {
        display: flex;
        justify-content: center;
        flex-wrap: wrap;
        gap: 8px;
        padding: 8px 0;
      }
      .tile-box {
        width: 38px;
        height: 44px;
        background: #121d2d;
        border: 2px solid #22354e;
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
      .tile-box.active {
        background: #06b6d4;
        border-color: #38bdf8;
        color: #041620;
      }
      .space-box {
        width: 14px;
      }
      .meta-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-top: 1px solid #1a273a;
        padding-top: 12px;
        color: #94a3b8;
        font-size: 13px;
        font-weight: 700;
      }
      .meta-footer b {
        color: #06b6d4;
      }
    </style>
  </head>
  <body>
    <div class="stage-card">
      <div class="top-nav">
        <div class="brand">
          <div class="brand-icon">✏️</div>
          <div class="brand-text">LENGKAPI <span>KALIMAT</span></div>
        </div>
        <div class="status-pill">${statusLabel}</div>
      </div>
      <div class="sentence-board">
        <div class="board-tag">PERIBAHASA / KALIMAT</div>
        <div class="sentence-text">"${sentenceDisplay}"</div>
      </div>
      <div class="tiles-bay">
        ${tilesHtml}
      </div>
      <div class="meta-footer">
        <div>REWARD : <b>+Rp 3.500 | +100 EXP</b></div>
        <div>TIMEOUT : <b>120s</b></div>
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
  if (!global.db.lengkapiKalimat) global.db.lengkapiKalimat = {};
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
async function sendNeoxrLengkapi(sock, ctx, chatId, session, textContent, quotedMsg, prefix = ".", imageBuffer = null, imageUrl = null) {
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
      id: `${prefix}lengkapi --clue`
    })
  }, {
    name: "quick_reply",
    buttonParamsJson: JSON.stringify({
      display_text: "🏳️ Menyerah",
      id: `${prefix}lengkapi --nyerah`
    })
  }];
  const options = {
    image: mediaSource,
    title: `✦ ${botName} • Lengkapi Kalimat ✦`,
    params: {
      bottom_sheet: {
        in_thread_buttons_limit: 2,
        divider_indices: [1],
        list_title: `${botName} • Bantuan Kuis`,
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
      console.error("[Lengkapi ctx.sendCta Error]:", e.message);
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
  name: "lengkapikalimat",
  aliases: ["lengkapi", "lengkap", "tebakkalimat", "peribahasa"],
  description: "Game melengkapi kalimat rumpang dan peribahasa dengan visual canvas realistis bertema Neoxr",
  category: "Game",
  limit: true,
  example: "lengkapikalimat",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const chatId = ctx?.id || msg?.key?.remoteJid;
      if (!chatId) return;
      initDB();
      if (!global.db.lengkapiKalimat[chatId]) return;
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      const session = global.db.lengkapiKalimat[chatId];
      if (Date.now() > session.expireTime) {
        delete global.db.lengkapiKalimat[chatId];
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
        delete global.db.lengkapiKalimat[chatId];
        const senderJid = ctx?.sender || msg?.key?.participant;
        const senderName = ctx?.pushName || ctx?.pushname || "Pemain Cerdas";
        if (senderJid) {
          initDB(senderJid, senderName);
          global.db.user[senderJid].money = (Number(global.db.user[senderJid].money) || 0) + 3500;
          global.db.user[senderJid].exp = (Number(global.db.user[senderJid].exp) || 0) + 100;
        }
        saveDB();
        const completedSentence = session.pertanyaan.replace(/_{2,}/g, `*${session.jawaban.toUpperCase()}*`);
        const winCanvasHtml = buildLengkapiKalimatCanvasHtml(session.pertanyaan, session.jawaban.toUpperCase(), "CORRECT");
        const {
          buffer,
          url
        } = await renderHtmlToImage(winCanvasHtml);
        if (typeof ctx?.react === "function") await ctx.react("🎉");
        const winText = `Hi ${senderName}!
Tebakan kata kamu tepat sekali! Kalimat berhasil dilengkapi.

–  *C O N G R A T U L A T I O N S*

┌  ◦  *Player* : @${senderJid.split("@")[0]}
│  ◦  *Kata Tepat* : ${session.jawaban.toUpperCase()}
└  ◦  *Reward* : +Rp 3.500 | +100 EXP

–  *S E N T E N C E*

"${completedSentence}"

_Ketik \`${ctx?.prefix || "."}lengkapikalimat\` untuk bermain lagi._`;
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
Kata "${userText}" belum tepat untuk melengkapi kalimat tersebut. Coba tebakan lain!`;
        await sock.sendMessage(chatId, {
          text: wrongText
        }, {
          quoted: msg
        });
        return true;
      }
    } catch (e) {
      console.error("[LENGKAPI KALIMAT BEFORE ERROR]:", e.message);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      const isGroup = Boolean(ctx?.isGroup || ctx?.id?.endsWith("@g.us"));
      if (!isGroup) {
        return ctx.reply("❌ Fitur Lengkapi Kalimat hanya dapat dimainkan di dalam Grup.");
      }
      const rawText = (ctx.query || ctx.text || "").trim().toLowerCase();
      const prefix = ctx.prefix || ".";
      const userName = ctx.pushName || ctx.pushname || ctx.sender.split("@")[0];
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const chatId = ctx.id;
      initDB();
      if (rawText.includes("nyerah") || rawText.includes("surrender") || rawText.includes("end") || rawText.includes("batal")) {
        if (global.db.lengkapiKalimat[chatId]) {
          const session = global.db.lengkapiKalimat[chatId];
          const completedSentence = session.pertanyaan.replace(/_{2,}/g, `*${session.jawaban.toUpperCase()}*`);
          delete global.db.lengkapiKalimat[chatId];
          saveDB();
          const revealCanvasHtml = buildLengkapiKalimatCanvasHtml(session.pertanyaan, session.jawaban.toUpperCase(), "REVEALED");
          const {
            buffer,
            url
          } = await renderHtmlToImage(revealCanvasHtml);
          const surrenderText = `Hi ${userName}!
Permainan telah dihentikan oleh pemain.

–  *S U R R E N D E R*

┌  ◦  *Jawaban Asli* : ${session.jawaban.toUpperCase()}
└  ◦  *Kalimat Lengkap* : "${completedSentence}"

_Gunakan perintah \`${prefix}lengkapikalimat\` untuk memulai game baru._`;
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
        return ctx.reply("❌ Tidak ada sesi Lengkapi Kalimat yang sedang aktif.");
      }
      if (rawText.includes("clue") || rawText.includes("bantuan") || rawText.includes("hint")) {
        if (!global.db.lengkapiKalimat[chatId]) {
          return ctx.reply(`❌ Tidak ada game aktif. Mulai game baru dengan mengetik *${prefix}lengkapikalimat*`);
        }
        const session = global.db.lengkapiKalimat[chatId];
        const clueText = generateClue(session.jawaban);
        const clueMsg = `Hi ${userName}!
Berikut petunjuk huruf untuk melengkapi kata rumpang.

–  *H I N T  C L U E*

┌  ◦  *Pertanyaan* : "${session.pertanyaan}"
└  ◦  *Clue* : [ ${clueText} ] (${session.jawaban.length} Karakter)

_Balas langsung pesan ini dengan kata yang tepat!_`;
        return await sendNeoxrLengkapi(sock, ctx, chatId, session, clueMsg, quotedMsg, prefix);
      }
      if (global.db.lengkapiKalimat[chatId]) {
        const session = global.db.lengkapiKalimat[chatId];
        const clueText = generateClue(session.jawaban);
        const activeMsg = `Hi ${userName}!
Masih ada kuis Lengkapi Kalimat yang sedang berjalan.

–  *A C T I V E  G A M E*

┌  ◦  *Pertanyaan* : "${session.pertanyaan}"
└  ◦  *Clue* : [ ${clueText} ] (${session.jawaban.length} Karakter)

_Balas pesan kuis sebelumnya langsung untuk menjawab._`;
        return await sendNeoxrLengkapi(sock, ctx, chatId, session, activeMsg, quotedMsg, prefix);
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
      if (!data || !data.pertanyaan || !data.jawaban) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal memuat kuis Lengkapi Kalimat dari server. Silakan coba lagi.");
      }
      const TIMEOUT_SECONDS = 120;
      global.db.lengkapiKalimat[chatId] = {
        pertanyaan: String(data.pertanyaan).trim(),
        jawaban: String(data.jawaban).trim(),
        msgIds: [],
        questionMsgId: null,
        startTime: Date.now(),
        expireTime: Date.now() + TIMEOUT_SECONDS * 1e3
      };
      saveDB();
      setTimeout(async () => {
        initDB();
        if (global.db.lengkapiKalimat[chatId] && Date.now() >= global.db.lengkapiKalimat[chatId].expireTime) {
          const activeSession = global.db.lengkapiKalimat[chatId];
          const completed = activeSession.pertanyaan.replace(/_{2,}/g, `*${activeSession.jawaban.toUpperCase()}*`);
          delete global.db.lengkapiKalimat[chatId];
          saveDB();
          const timeoutCanvasHtml = buildLengkapiKalimatCanvasHtml(activeSession.pertanyaan, activeSession.jawaban.toUpperCase(), "TIMEOUT");
          const {
            buffer,
            url
          } = await renderHtmlToImage(timeoutCanvasHtml);
          const timeoutText = `Hi All!
Waktu menjawab kuis Lengkapi Kalimat telah habis! ⌛

–  *T I M E  O U T*

┌  ◦  *Jawaban Asli* : ${activeSession.jawaban.toUpperCase()}
└  ◦  *Kalimat Lengkap* : "${completed}"

_Ketik \`${prefix}lengkapikalimat\` untuk bermain lagi!_`;
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
      const clueText = generateClue(global.db.lengkapiKalimat[chatId].jawaban);
      const displayClueLetters = getRawDisplayClue(global.db.lengkapiKalimat[chatId].jawaban);
      const canvasHtml = buildLengkapiKalimatCanvasHtml(global.db.lengkapiKalimat[chatId].pertanyaan, displayClueLetters, "QUESTION");
      const {
        buffer: cardBuffer,
        url: cardUrl
      } = await renderHtmlToImage(canvasHtml);
      const questionMsg = `Hi Survivors!
Lengkapilah kata rumpang pada kalimat/peribahasa berikut.

–  *Q U E S T I O N*

"${global.db.lengkapiKalimat[chatId].pertanyaan}"

–  *G A M E  I N F O*

┌  ◦  *Clue* : [ ${clueText} ] (${global.db.lengkapiKalimat[chatId].jawaban.length} Karakter)
│  ◦  *Timeout* : ${TIMEOUT_SECONDS} Detik
└  ◦  *Reward* : +Rp 3.500 | +100 EXP

_Balas (reply) pesan ini langsung dengan kata yang tepat!_`;
      await sendNeoxrLengkapi(sock, ctx, chatId, global.db.lengkapiKalimat[chatId], questionMsg, quotedMsg, prefix, cardBuffer, cardUrl);
      await ctx.react("🤔");
    } catch (error) {
      console.error("[Lengkapi Kalimat Error]:", error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Lengkapi Kalimat Error: ${errMsg}`);
    }
  }
};