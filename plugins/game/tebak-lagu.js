import axios from "axios";
import db from "../../data/db.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/game/tebak-lagu/v2`;
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

function buildTebakLaguCanvasHtml(options = {}, clue = "", status = "NOW PLAYING", answerTitle = "") {
  const botName = global.bot?.name || "WudysoftBot";
  const isCorrect = status === "CORRECT";
  const isTimeout = status === "TIMEOUT" || status === "REVEALED";
  const statusColor = isCorrect ? "#10b981" : isTimeout ? "#ef4444" : "#ec4899";
  const statusLabel = isCorrect ? "TEBAKAN TEPAT" : isTimeout ? "TERBONGKAR" : "TEBAK JUDUL LAGU";
  const optKeys = ["A", "B", "C", "D"];
  const optionsHtml = optKeys.map(k => {
    const text = options[k] || "-";
    const isAns = answerTitle && text.toLowerCase().includes(answerTitle.toLowerCase());
    return `
      <div class="opt-tile ${isAns ? "solved-tile" : ""}">
        <div class="opt-badge">${k}</div>
        <div class="opt-name">${text}</div>
      </div>
    `;
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
        background: #06070d;
        font-family: 'Plus Jakarta Sans', sans-serif;
        display: flex;
        justify-content: center;
        align-items: center;
        overflow: hidden;
      }
      .music-card {
        width: 710px;
        height: 440px;
        background: radial-gradient(circle at 25% 40%, rgba(236, 72, 153, 0.2) 0%, rgba(10, 11, 20, 0.98) 85%);
        border: 2px solid #232238;
        border-radius: 20px;
        box-shadow: 0 25px 60px rgba(0,0,0,0.85);
        padding: 22px 26px;
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
        background: #ec4899;
        color: #fff;
        width: 32px;
        height: 32px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
      }
      .brand-title {
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
      .stage-body {
        display: flex;
        gap: 26px;
        align-items: center;
        padding: 6px 0;
      }
      .vinyl-bay {
        width: 220px;
        height: 220px;
        position: relative;
        display: flex;
        justify-content: center;
        align-items: center;
      }
      .vinyl-disc {
        width: 200px;
        height: 200px;
        background: radial-gradient(circle, #2d3139 0%, #111317 70%, #000 100%);
        border-radius: 50%;
        border: 4px solid #3c424f;
        box-shadow: 0 10px 30px rgba(0,0,0,0.8), inset 0 0 20px rgba(0,0,0,0.9);
        display: flex;
        justify-content: center;
        align-items: center;
        position: relative;
      }
      .vinyl-disc::before {
        content: "";
        position: absolute;
        width: 140px;
        height: 140px;
        border: 1px dashed rgba(255,255,255,0.15);
        border-radius: 50%;
      }
      .disc-center {
        width: 70px;
        height: 70px;
        background: #ec4899;
        border-radius: 50%;
        border: 3px solid #fff;
        display: flex;
        justify-content: center;
        align-items: center;
        font-size: 26px;
        box-shadow: 0 0 15px rgba(236, 72, 153, 0.6);
      }
      .track-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .clue-panel {
        background: #10121d;
        border: 1px solid #202438;
        border-radius: 12px;
        padding: 12px 16px;
      }
      .clue-tag {
        font-size: 11px;
        color: #ec4899;
        font-weight: 800;
        letter-spacing: 1.5px;
      }
      .clue-text {
        font-size: 15px;
        font-weight: 800;
        color: #f1f5f9;
        letter-spacing: 1px;
        margin-top: 4px;
      }
      .options-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px 12px;
      }
      .opt-tile {
        height: 48px;
        background: #111320;
        border: 1px solid #22263d;
        border-radius: 10px;
        padding: 0 12px;
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .opt-tile.solved-tile {
        border-color: #10b981;
        background: rgba(16, 185, 129, 0.15);
      }
      .opt-badge {
        width: 26px;
        height: 26px;
        background: #232842;
        color: #ec4899;
        border-radius: 6px;
        display: flex;
        justify-content: center;
        align-items: center;
        font-weight: 900;
        font-size: 13px;
      }
      .opt-tile.solved-tile .opt-badge {
        background: #10b981;
        color: #042214;
      }
      .opt-name {
        flex: 1;
        color: #e2e8f0;
        font-size: 13px;
        font-weight: 800;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .footer-meta {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-top: 1px solid #1a1c2e;
        padding-top: 12px;
        color: #94a3b8;
        font-size: 13px;
        font-weight: 700;
      }
      .footer-meta b {
        color: #ec4899;
      }
    </style>
  </head>
  <body>
    <div class="music-card">
      <div class="top-nav">
        <div class="brand">
          <div class="brand-icon">🎵</div>
          <div class="brand-text">TEBAK <span>LAGU</span></div>
        </div>
        <div class="status-pill">${statusLabel}</div>
      </div>
      <div class="stage-body">
        <div class="vinyl-bay">
          <div class="vinyl-disc">
            <div class="disc-center">🎧</div>
          </div>
        </div>
        <div class="track-content">
          <div class="clue-panel">
            <div class="clue-tag">PETUNJUK HURUF</div>
            <div class="clue-text">${clue || "Dengarkan audio terlampir"}</div>
          </div>
          <div class="options-grid">
            ${optionsHtml}
          </div>
        </div>
      </div>
      <div class="footer-meta">
        <div>REWARD : <b>+300 EXP</b></div>
        <div>AUDIO : <b>VOICE NOTE (PTT)</b></div>
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
  if (!global.db.tebakLagu) global.db.tebakLagu = {};
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
async function fetchAudioBuffer(url) {
  if (!url || typeof url !== "string" || !/^https?:\/\//i.test(url)) return null;
  try {
    const res = await axios.get(url, {
      responseType: "arraybuffer",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      },
      timeout: 2e4
    });
    if (res.data) return Buffer.from(res.data);
  } catch (err) {
    console.error("[Fetch Audio Error]:", err.message);
  }
  return null;
}
export default {
  name: "tebaklagu",
  aliases: ["tebak-lagu", "kuislagu", "guessthesong"],
  description: "Game kuis tebak judul lagu dari potongan audio dengan visual canvas realistis bertema Neoxr",
  category: "Game",
  limit: true,
  example: "tebaklagu",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const chatId = ctx?.id || msg?.key?.remoteJid;
      if (!chatId) return;
      initDB();
      if (!global.db.tebakLagu[chatId]) return;
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      const session = global.db.tebakLagu[chatId];
      if (Date.now() > session.expireTime) {
        delete global.db.tebakLagu[chatId];
        saveDB();
        return;
      }
      const quotedStanzaId = ctx?.quoted?.id || msg?.message?.extendedTextMessage?.contextInfo?.stanzaId;
      const isReplyingToQuiz = quotedStanzaId && (quotedStanzaId === session.questionMsgId || quotedStanzaId === session.audioMsgId);
      if (!isReplyingToQuiz) return;
      const userText = (ctx?.text || ctx?.query || msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "").trim();
      const prefixList = [".", "#", "!", "/", ctx?.prefix].filter(Boolean);
      if (prefixList.some(p => userText.startsWith(p))) return;
      const cleanUser = normalizeText(userText);
      const correctKey = normalizeText(session.key);
      const correctAnswer = normalizeText(session.answer);
      const isCorrect = cleanUser === correctKey || cleanUser === `opsi ${correctKey}` || cleanUser === `pilihan ${correctKey}` || cleanUser === correctAnswer || cleanUser.includes(correctAnswer) || correctAnswer.includes(cleanUser) && cleanUser.length >= 4;
      if (isCorrect) {
        const duration = ((Date.now() - session.startTime) / 1e3).toFixed(1);
        const senderName = ctx?.pushname || ctx?.pushName || "Pemain Cerdas";
        const senderJid = ctx?.sender;
        delete global.db.tebakLagu[chatId];
        if (senderJid) {
          initDB(senderJid, senderName);
          global.db.user[senderJid].exp = (global.db.user[senderJid].exp || 0) + 300;
        }
        saveDB();
        if (typeof ctx?.react === "function") await ctx.react("🎉");
        const winCanvasHtml = buildTebakLaguCanvasHtml(session.options, session.answer, "CORRECT", session.answer);
        const {
          buffer,
          url
        } = await renderHtmlToImage(winCanvasHtml);
        const winMessage = `Hi ${senderName}!
Tebakan judul lagumu tepat sekali!

–  *C O N G R A T U L A T I O N S*

┌  ◦  *Player* : ${senderName}
│  ◦  *Judul Lagu* : ${session.answer} (Opsi ${session.key})
│  ◦  *Durasi Menjawab* : ${duration}s
└  ◦  *Reward* : +300 EXP

_Ketik \`${ctx?.prefix || "."}tebaklagu\` untuk memainkan musik lainnya!_`;
        if (buffer || url) {
          await sock.sendMessage(chatId, {
            image: buffer || {
              url: url
            },
            caption: winMessage,
            mentions: senderJid ? [senderJid] : []
          }, {
            quoted: msg
          });
        } else {
          await sock.sendMessage(chatId, {
            text: winMessage,
            mentions: senderJid ? [senderJid] : []
          }, {
            quoted: msg
          });
        }
        return true;
      } else {
        if (typeof ctx?.react === "function") await ctx.react("❌");
        const wrongMessage = `Hi ${ctx?.pushname || "Pemain"}!
Pilihan "${userText}" kurang tepat. Dengarkan kembali audio voice note dan coba lagi!`;
        await sock.sendMessage(chatId, {
          text: wrongMessage
        }, {
          quoted: msg
        });
        return true;
      }
    } catch (e) {
      console.error("[TEBAK LAGU BEFORE HANDLER ERROR]:", e.message);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      const rawText = (ctx.query || ctx.text || "").trim().toLowerCase();
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const chatId = ctx.id;
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = `${global.bot?.footer || botName}`;
      const userName = ctx.pushname || ctx.pushName || ctx.sender.split("@")[0];
      initDB();
      if (global.db.tebakLagu[chatId]) {
        const session = global.db.tebakLagu[chatId];
        if (rawText.includes("--clue") || rawText.includes("--hint") || rawText.includes("hint")) {
          const hintButtons = [{
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "🏳️ Menyerah",
              id: `${prefix}tebaklagu --nyerah`
            })
          }];
          const hintBody = `Hi ${userName}!
Berikut petunjuk untuk lagu yang sedang diputar.

–  *H I N T  C L U E*

┌  ◦  *Petunjuk Huruf* : ${session.clue}
└  ◦  *Tips* : Dengarkan potongan vokal atau melodi pada audio terlampir

_Balas pesan soal/audio ini langsung dengan pilihan opsi (A / B / C / D)!_`;
          return await ctx.sendCta(hintBody, botFooter, hintButtons, {
            title: `✦ ${botName} • Hint Tebak Lagu ✦`,
            quoted: quotedMsg
          });
        }
        if (rawText.includes("--nyerah") || rawText.includes("--surrender") || rawText.includes("nyerah")) {
          const answer = session.answer;
          const key = session.key;
          delete global.db.tebakLagu[chatId];
          saveDB();
          const revealCanvasHtml = buildTebakLaguCanvasHtml(session.options, answer, "REVEALED", answer);
          const {
            buffer,
            url
          } = await renderHtmlToImage(revealCanvasHtml);
          const surrenderText = `Hi ${userName}!
Permainan Tebak Lagu telah dihentikan.

–  *S U R R E N D E R*

┌  ◦  *Judul Lagu Asli* : ${answer}
└  ◦  *Opsi Tepat* : Opsi [ ${key} ]

_Gunakan perintah \`${prefix}tebaklagu\` untuk mencoba lagu baru._`;
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
        const activeWarningBody = `Hi ${userName}!
Masih ada kuis Tebak Lagu yang sedang berjalan di chat ini.

–  *A C T I V E  G A M E*

┌  ◦  *Clue* : ${session.clue}
└  ◦  *Cara Jawab* : Balas pesan soal/audio dengan huruf A / B / C / D

_Gunakan tombol di bawah jika kamu memerlukan bantuan petunjuk atau ingin menyerah._`;
        const activeButtons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "💡 Minta Petunjuk",
            id: `${prefix}tebaklagu --hint`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🏳️ Menyerah",
            id: `${prefix}tebaklagu --nyerah`
          })
        }];
        return await ctx.sendCta(activeWarningBody, botFooter, activeButtons, {
          title: `✦ ${botName} • Tebak Lagu ✦`,
          quoted: quotedMsg
        });
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
      if (!data || data.status !== 200 || !data.audio) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal memuat kuis tebak lagu dari server. Silakan coba lagi.");
      }
      const answer = data.answer || "";
      const rawAudioUrl = data.audio || "";
      const underlineClue = data.hint?.underline || answer.replace(/[a-zA-Z0-9]/g, "_ ");
      const correctKey = data.details?.key || "A";
      const options = data.details?.options || {};
      const TIMEOUT_SECONDS = 120;
      const optionRows = Object.keys(options).map(optKey => ({
        title: `[${optKey}] ${options[optKey]}`.slice(0, 24),
        id: `${optKey}`,
        description: `Pilih opsi [${optKey}] ${options[optKey]}`.slice(0, 60)
      }));
      const canvasHtml = buildTebakLaguCanvasHtml(options, underlineClue, "NOW PLAYING");
      const {
        buffer: cardBuffer,
        url: cardUrl
      } = await renderHtmlToImage(canvasHtml);
      const bodyText = `Hi Survivors!
Dengarkan cuplikan audio musik yang dikirim dan tebak judulnya!

–  *T E B A K  L A G U*

┌  ◦  *Timeout* : ${TIMEOUT_SECONDS} Detik
│  ◦  *Petunjuk Huruf* : ${underlineClue}
└  ◦  *Reward* : +300 EXP

–  *P I L I H A N  J A W A B A N*

┌  ◦  *A.* ${options.A || "-"}
│  ◦  *B.* ${options.B || "-"}
│  ◦  *C.* ${options.C || "-"}
└  ◦  *D.* ${options.D || "-"}

_Balas (reply) pesan soal atau audio VN ini dengan huruf A, B, C, atau D!_`;
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: "🎯 PILIH JAWABAN",
          sections: [{
            title: `${botName} • PILIHAN JUDUL LAGU`,
            rows: optionRows
          }]
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "💡 Minta Petunjuk",
          id: `${prefix}tebaklagu --hint`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🏳️ Menyerah",
          id: `${prefix}tebaklagu --nyerah`
        })
      }];
      const ctaOptions = {
        image: cardBuffer || (cardUrl ? {
          url: cardUrl
        } : null),
        title: `✦ ${botName} • Tebak Lagu ✦`,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 3,
            divider_indices: [1],
            list_title: `${botName} • Opsi Lagu`,
            button_title: "🎯 Pilih Judul Lagu"
          }
        },
        contextInfo: {
          mentionedJid: [ctx?.sender].filter(Boolean),
          forwardingScore: 999,
          isForwarded: true
        },
        quoted: quotedMsg
      };
      let sentMsg = null;
      if (typeof ctx.sendCta === "function") {
        sentMsg = await ctx.sendCta(bodyText, botFooter, buttons, ctaOptions);
      } else if (cardBuffer || cardUrl) {
        sentMsg = await sock.sendMessage(chatId, {
          image: cardBuffer || {
            url: cardUrl
          },
          caption: `${bodyText}\n\n_${botFooter}_`
        }, {
          quoted: quotedMsg
        });
      } else {
        sentMsg = await ctx.reply(bodyText, {
          quoted: quotedMsg
        });
      }
      const questionMsgId = sentMsg?.key?.id;
      const audioBuffer = await fetchAudioBuffer(rawAudioUrl);
      let sentAudioMsg = null;
      if (audioBuffer) {
        sentAudioMsg = await sock.sendMessage(chatId, {
          audio: audioBuffer,
          mimetype: "audio/mp4",
          ptt: true
        }, {
          quoted: sentMsg || quotedMsg
        });
      }
      global.db.tebakLagu[chatId] = {
        questionMsgId: questionMsgId,
        audioMsgId: sentAudioMsg?.key?.id || null,
        answer: answer.trim(),
        key: correctKey.trim(),
        clue: underlineClue,
        options: options,
        startTime: Date.now(),
        expireTime: Date.now() + TIMEOUT_SECONDS * 1e3
      };
      saveDB();
      setTimeout(async () => {
        initDB();
        if (global.db.tebakLagu[chatId] && Date.now() >= global.db.tebakLagu[chatId].expireTime) {
          const current = global.db.tebakLagu[chatId];
          delete global.db.tebakLagu[chatId];
          saveDB();
          const timeoutCanvasHtml = buildTebakLaguCanvasHtml(current.options, current.answer, "TIMEOUT", current.answer);
          const {
            buffer,
            url
          } = await renderHtmlToImage(timeoutCanvasHtml);
          const timeoutMsg = `Hi All!
Waktu menjawab kuis Tebak Lagu telah habis! ⌛

–  *T I M E  O U T*

┌  ◦  *Judul Lagu Asli* : ${current.answer}
└  ◦  *Opsi Tepat* : Opsi [ ${current.key} ]

_Gunakan perintah \`${prefix}tebaklagu\` untuk memainkan musik lainnya!_`;
          if (buffer || url) {
            await sock.sendMessage(chatId, {
              image: buffer || {
                url: url
              },
              caption: timeoutMsg
            });
          } else {
            await sock.sendMessage(chatId, {
              text: timeoutMsg
            });
          }
        }
      }, TIMEOUT_SECONDS * 1e3);
      await ctx.react("🎵");
    } catch (error) {
      console.error("[Tebak Lagu Error]:", error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Tebak Lagu Error: ${errMsg}`);
    }
  }
};