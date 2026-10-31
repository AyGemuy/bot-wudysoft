import axios from "axios";
import db from "../../data/db.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const GAME_TYPES = {
  gambar: {
    name: "Tebak Gambar",
    url: `${global.bot?.api?.wudysoft}/api/game/tebak-gambar`,
    emoji: "🖼️"
  },
  hewan: {
    name: "Tebak Hewan",
    url: `${global.bot?.api?.wudysoft}/api/game/tebak-hewan`,
    emoji: "🦁"
  },
  kabupaten: {
    name: "Tebak Kabupaten",
    url: `${global.bot?.api?.wudysoft}/api/game/tebak-kabupaten`,
    emoji: "🏛️"
  },
  logo: {
    name: "Tebak Logo",
    url: `${global.bot?.api?.wudysoft}/api/game/tebak-logo`,
    emoji: "📱"
  },
  heroml: {
    name: "Tebak Hero MLBB",
    url: `${global.bot?.api?.wudysoft}/api/game/tebak-hero-ml`,
    emoji: "⚔️"
  },
  genshin: {
    name: "Tebak Genshin",
    url: `${global.bot?.api?.wudysoft}/api/game/tebak-hero-genshin`,
    emoji: "✨"
  }
};
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

function buildTebakShowcaseCanvasHtml(gameName, rawImage, clue, question, status = "QUESTION", answer = "") {
  const botName = global.bot?.name || "WudysoftBot";
  const isCorrect = status === "CORRECT";
  const isTimeout = status === "TIMEOUT" || status === "REVEALED";
  const statusColor = isCorrect ? "#10b981" : isTimeout ? "#ef4444" : "#38bdf8";
  const statusLabel = isCorrect ? "TEPAT SEKALI" : isTimeout ? "TERBONGKAR" : "TEBAK VISUAL";
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
        background: #06080d;
        font-family: 'Plus Jakarta Sans', sans-serif;
        display: flex;
        justify-content: center;
        align-items: center;
        overflow: hidden;
      }
      .showcase-card {
        width: 710px;
        height: 440px;
        background: radial-gradient(circle at 70% 30%, rgba(56, 189, 248, 0.15) 0%, rgba(8, 11, 18, 0.98) 80%);
        border: 2px solid #20293a;
        border-radius: 20px;
        box-shadow: 0 25px 60px rgba(0,0,0,0.85);
        padding: 22px 26px;
        display: flex;
        gap: 24px;
      }
      .visual-box {
        width: 310px;
        height: 100%;
        background: #0f1420;
        border: 2px solid #2a374e;
        border-radius: 14px;
        box-shadow: inset 0 0 20px rgba(0,0,0,0.8), 0 10px 25px rgba(0,0,0,0.5);
        overflow: hidden;
        display: flex;
        justify-content: center;
        align-items: center;
        position: relative;
      }
      .visual-box img {
        width: 100%;
        height: 100%;
        object-fit: contain;
        background: #0a0d14;
      }
      .media-tag {
        position: absolute;
        top: 10px;
        left: 10px;
        background: rgba(15, 23, 42, 0.85);
        border: 1px solid #38bdf8;
        color: #38bdf8;
        font-size: 11px;
        font-weight: 800;
        padding: 3px 10px;
        border-radius: 6px;
        letter-spacing: 1px;
        backdrop-filter: blur(4px);
      }
      .content-box {
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }
      .top-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .game-title {
        font-size: 20px;
        font-weight: 900;
        color: #f8fafc;
        letter-spacing: 0.5px;
      }
      .status-pill {
        border: 1px solid ${statusColor};
        color: ${statusColor};
        background: rgba(15, 23, 42, 0.8);
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 1.5px;
        text-transform: uppercase;
      }
      .question-info {
        background: #0e131d;
        border: 1px solid #1c2638;
        border-radius: 12px;
        padding: 14px 16px;
        margin: 10px 0;
      }
      .q-heading {
        font-size: 11px;
        color: #38bdf8;
        font-weight: 800;
        letter-spacing: 1.5px;
        text-transform: uppercase;
      }
      .q-body {
        font-size: 15px;
        font-weight: 800;
        color: #e2e8f0;
        line-height: 1.4;
        margin-top: 4px;
      }
      .clue-box {
        background: #090d14;
        border: 1px solid #1b2434;
        border-radius: 10px;
        padding: 12px 14px;
      }
      .clue-label {
        font-size: 11px;
        font-weight: 800;
        color: #94a3b8;
        letter-spacing: 1.5px;
      }
      .clue-letters {
        font-size: 18px;
        font-weight: 800;
        color: ${isCorrect ? "#34d399" : isTimeout ? "#f87171" : "#f8fafc"};
        letter-spacing: 2px;
        margin-top: 4px;
      }
      .footer-meta {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-top: 1px solid #1a2232;
        padding-top: 10px;
        color: #94a3b8;
        font-size: 13px;
        font-weight: 700;
      }
      .footer-meta b {
        color: #38bdf8;
      }
    </style>
  </head>
  <body>
    <div class="showcase-card">
      <div class="visual-box">
        <div class="media-tag">VISUAL CLUE</div>
        <img src="${rawImage || "https://files.catbox.moe/g2e6i5.jpg"}" alt="Clue Image">
      </div>
      <div class="content-box">
        <div class="top-row">
          <div class="game-title">${gameName}</div>
          <div class="status-pill">${statusLabel}</div>
        </div>
        <div class="question-info">
          <div class="q-heading">PERTANYAAN</div>
          <div class="q-body">${question || "Perhatikan visual dan tebak dengan benar!"}</div>
        </div>
        <div class="clue-box">
          <div class="clue-label">${isCorrect ? "JAWABAN TEPAT" : isTimeout ? "JAWABAN ASLI" : "PETUNJUK HURUF"}</div>
          <div class="clue-letters">${answer ? answer.toUpperCase() : clue}</div>
        </div>
        <div class="footer-meta">
          <div>REWARD : <b>+250 EXP</b></div>
          <div>BOT : <b>${botName}</b></div>
        </div>
      </div>
    </div>
  </body>
  </html>
  `;
}

function initDB(jid = null, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.tebak) global.db.tebak = {};
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
async function fetchMediaBuffer(url) {
  if (!url || typeof url !== "string" || !/^https?:\/\//i.test(url)) return null;
  try {
    const res = await axios.get(url, {
      responseType: "arraybuffer",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      },
      timeout: 15e3
    });
    if (res.data) return Buffer.from(res.data);
  } catch (err) {
    console.error("[Fetch Media Buffer Error]:", err.message);
  }
  return null;
}
async function sendNeoxrTebak(sock, ctx, chatId, textContent, buttons, quotedMsg, prefix = ".", imageBuffer = null, imageUrl = null) {
  const botName = global.bot?.name || "WudysoftBot";
  const footerText = `${global.bot?.footer || botName}`;
  const defaultBanner = global.bot?.media?.banner1 || global.bot?.media?.banner2 || "https://files.catbox.moe/g2e6i5.jpg";
  const mediaSource = imageBuffer || (imageUrl ? {
    url: imageUrl
  } : defaultBanner);
  const options = {
    image: mediaSource,
    title: `✦ ${botName} • Mini Games ✦`,
    params: {
      bottom_sheet: {
        in_thread_buttons_limit: 2,
        divider_indices: [1],
        list_title: `${botName} • Menu Kuis`,
        button_title: "🎯 Menu Kuis"
      }
    },
    contextInfo: {
      mentionedJid: [ctx?.sender].filter(Boolean),
      forwardingScore: 999,
      isForwarded: true
    },
    quoted: quotedMsg || undefined
  };
  if (typeof ctx?.sendCta === "function" && chatId === ctx.id) {
    try {
      return await ctx.sendCta(textContent, footerText, buttons, options);
    } catch (e) {
      console.error("[Tebak ctx.sendCta Error]:", e.message);
    }
  }
  try {
    const nativeButtons = buttons.map(b => ({
      name: b.name || "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: b.display_text,
        id: b.id || b.copy_code || ""
      })
    }));
    const mediaPayload = imageBuffer ? {
      image: imageBuffer
    } : imageUrl ? {
      image: {
        url: imageUrl
      }
    } : {};
    return await sock.sendMessage(chatId, {
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
              buttons: nativeButtons
            },
            contextInfo: options.contextInfo
          }
        }
      }
    }, {
      quoted: quotedMsg
    });
  } catch (e) {}
  if (imageBuffer || imageUrl) {
    return await sock.sendMessage(chatId, {
      image: imageBuffer || {
        url: imageUrl
      },
      caption: `${textContent}\n\n_${footerText}_`
    }, {
      quoted: quotedMsg
    });
  }
  return await sock.sendMessage(chatId, {
    text: `${textContent}\n\n_${footerText}_`
  }, {
    quoted: quotedMsg
  });
}
export default {
  name: "tebak",
  aliases: ["tebak-game", "kuis", "game-tebak"],
  description: "Game kuis tebak visual serbaguna (Gambar, Hewan, Kabupaten, Logo, Hero MLBB, Genshin) dengan canvas realistis bertema Neoxr",
  category: "Game",
  limit: true,
  example: "tebak --gambar atau tebak --hewan atau tebak --heroml",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const chatId = ctx?.id || msg?.key?.remoteJid;
      if (!chatId) return;
      initDB();
      if (!global.db.tebak[chatId]) return;
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      const session = global.db.tebak[chatId];
      if (Date.now() > session.expireTime) {
        delete global.db.tebak[chatId];
        saveDB();
        return;
      }
      const quotedStanzaId = ctx?.quoted?.id || msg?.message?.extendedTextMessage?.contextInfo?.stanzaId;
      if (!quotedStanzaId || quotedStanzaId !== session.questionMsgId) {
        return;
      }
      const userText = (ctx?.text || ctx?.query || msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "").trim();
      const prefixList = [".", "#", "!", "/", ctx?.prefix].filter(Boolean);
      if (prefixList.some(p => userText.startsWith(p))) return;
      const cleanUser = normalizeText(userText);
      const cleanAns = normalizeText(session.answer);
      const isCorrect = cleanUser === cleanAns || cleanUser.includes(cleanAns) || cleanAns.includes(cleanUser) && cleanUser.length >= 4;
      if (isCorrect) {
        const duration = ((Date.now() - session.startTime) / 1e3).toFixed(1);
        const senderName = ctx?.pushname || ctx?.pushName || "Pemain Cerdas";
        const senderJid = ctx?.sender;
        delete global.db.tebak[chatId];
        if (senderJid) {
          initDB(senderJid, senderName);
          global.db.user[senderJid].exp = (global.db.user[senderJid].exp || 0) + 250;
        }
        saveDB();
        if (typeof ctx?.react === "function") await ctx.react("🎉");
        const winCanvasHtml = buildTebakShowcaseCanvasHtml(session.gameName, session.rawImageUrl, session.clue, session.question, "CORRECT", session.answer);
        const {
          buffer,
          url
        } = await renderHtmlToImage(winCanvasHtml);
        const winMessage = `Hi ${senderName}!
Tebakan visual kamu benar sekali!

–  *C O N G R A T U L A T I O N S*

┌  ◦  *Player* : ${senderName}
│  ◦  *Game* : ${session.gameName}
│  ◦  *Jawaban Tepat* : ${session.answer}
│  ◦  *Waktu Jawab* : ${duration}s
└  ◦  *Reward* : +250 EXP

${session.hintMessage ? `_${session.hintMessage}_\n\n` : ""}_Ketik \`${ctx?.prefix || "."}tebak\` untuk mencoba kategori lainnya._`;
        if (buffer || url) {
          await sock.sendMessage(chatId, {
            image: buffer || {
              url: url
            },
            caption: winMessage.trim(),
            mentions: senderJid ? [senderJid] : []
          }, {
            quoted: msg
          });
        } else {
          await sock.sendMessage(chatId, {
            text: winMessage.trim(),
            mentions: senderJid ? [senderJid] : []
          }, {
            quoted: msg
          });
        }
        return true;
      } else {
        if (typeof ctx?.react === "function") await ctx.react("❌");
        const wrongMessage = `Hi ${ctx?.pushname || "Pemain"}!
Jawaban "${userText}" kurang tepat. Amati visualnya kembali dan coba lagi!`;
        await sock.sendMessage(chatId, {
          text: wrongMessage
        }, {
          quoted: msg
        });
        return true;
      }
    } catch (e) {
      console.error("[TEBAK BEFORE HANDLER ERROR]:", e.message);
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
      if (global.db.tebak[chatId]) {
        const session = global.db.tebak[chatId];
        if (rawText.includes("--clue") || rawText.includes("--hint") || rawText.includes("hint")) {
          const hintButtons = [{
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "🏳️ Menyerah",
              id: `${prefix}tebak --nyerah`
            })
          }];
          const hintBody = `Hi ${userName}!
Berikut petunjuk untuk ${session.gameName}.

–  *H I N T  C L U E*

┌  ◦  *Kategori* : ${session.gameName}
│  ◦  *Petunjuk Huruf* : ${session.clue}
└  ◦  *Info Tambahan* : ${session.hintMessage || "Perhatikan detail visual yang diberikan."}

_Balas (reply) pesan visual kuis langsung dengan tebakanmu!_`;
          return await ctx.sendCta(hintBody, botFooter, hintButtons, {
            title: `✦ ${session.gameName} • Hint ✦`,
            quoted: quotedMsg
          });
        }
        if (rawText.includes("--nyerah") || rawText.includes("--surrender") || rawText.includes("nyerah")) {
          const gameName = session.gameName;
          const answer = session.answer;
          const hintMessage = session.hintMessage;
          const rawImageUrl = session.rawImageUrl;
          delete global.db.tebak[chatId];
          saveDB();
          const revealCanvasHtml = buildTebakShowcaseCanvasHtml(gameName, rawImageUrl, session.clue, session.question, "REVEALED", answer);
          const {
            buffer,
            url
          } = await renderHtmlToImage(revealCanvasHtml);
          const surrenderText = `Hi ${userName}!
Permainan ${gameName} telah dihentikan.

–  *S U R R E N D E R*

┌  ◦  *Kategori* : ${gameName}
│  ◦  *Jawaban Asli* : ${answer}
└  ◦  *Deskripsi* : ${hintMessage || "-"}

_Gunakan perintah \`${prefix}tebak\` untuk memilih kuis baru._`;
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
Masih ada kuis ${session.gameName} yang sedang berlangsung.

–  *A C T I V E  G A M E*

┌  ◦  *Clue* : ${session.clue}
└  ◦  *Cara Jawab* : Balas (reply) pesan soal dengan jawabanmu

_Gunakan tombol di bawah jika kamu memerlukan petunjuk atau ingin menyerah._`;
        const activeButtons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "💡 Minta Petunjuk",
            id: `${prefix}tebak --hint`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🏳️ Menyerah",
            id: `${prefix}tebak --nyerah`
          })
        }];
        return await ctx.sendCta(activeWarningBody, botFooter, activeButtons, {
          title: `✦ ${session.gameName} ✦`,
          quoted: quotedMsg
        });
      }
      let selectedKey = null;
      if (rawText.includes("--gambar") || rawText.includes("gambar") || rawText.includes("--tebakgambar")) selectedKey = "gambar";
      else if (rawText.includes("--hewan") || rawText.includes("hewan")) selectedKey = "hewan";
      else if (rawText.includes("--kabupaten") || rawText.includes("kabupaten") || rawText.includes("--daerah")) selectedKey = "kabupaten";
      else if (rawText.includes("--logo") || rawText.includes("logo") || rawText.includes("--app")) selectedKey = "logo";
      else if (rawText.includes("--heroml") || rawText.includes("--ml") || rawText.includes("mlbb")) selectedKey = "heroml";
      else if (rawText.includes("--genshin") || rawText.includes("--gi") || rawText.includes("genshin")) selectedKey = "genshin";
      if (!selectedKey) {
        const categoryRows = Object.keys(GAME_TYPES).map(key => {
          const item = GAME_TYPES[key];
          return {
            title: `${item.emoji} ${item.name}`,
            id: `${prefix}tebak --${key}`,
            description: `Mulai tantangan ${item.name}`
          };
        });
        const bodyText = `Hi ${userName}!
Uji wawasan dan kecepatan analisismu dalam berbagai mode kuis visual berikut.

–  *C A T E G O R Y  L I S T*

┌  ◦  *${prefix}tebak --gambar* : Tebak Gambar (Kata Logika)
│  ◦  *${prefix}tebak --hewan* : Tebak Spesies Hewan
│  ◦  *${prefix}tebak --kabupaten* : Tebak Lambang Daerah
│  ◦  *${prefix}tebak --logo* : Tebak Logo Brand & Aplikasi
│  ◦  *${prefix}tebak --heroml* : Tebak Hero Mobile Legends
└  ◦  *${prefix}tebak --genshin* : Tebak Karakter Genshin

_Pilih kategori melalui menu dropdown di bawah untuk langsung bermain!_`;
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "🎯 PILIH KATEGORI GAME",
            sections: [{
              title: `${botName} • MINI GAMES ARENA`,
              rows: categoryRows
            }]
          })
        }];
        return await ctx.sendCta(bodyText, botFooter, buttons, {
          title: `✦ ${botName} • Mini Games ✦`,
          subtitle: "Pilihan Kategori Kuis Visual",
          quoted: quotedMsg
        });
      }
      await ctx.react("⏳");
      const gameConfig = GAME_TYPES[selectedKey];
      const {
        data
      } = await axios.get(gameConfig.url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 3e4,
        validateStatus: status => status < 500
      });
      if (!data) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal memuat soal kuis dari server. Silakan coba lagi.");
      }
      let question = "";
      let answer = "";
      let clue = "";
      let hintMessage = "";
      let rawImageUrl = "";
      let rawAudioUrl = "";
      if (selectedKey === "gambar") {
        question = `Tebak susunan kata dari gambar berikut (Level #${data.index || "Acak"})`;
        answer = data.jawaban || data.answer || "";
        clue = answer.replace(/[a-zA-Z0-9]/g, "_ ");
        hintMessage = data.deskripsi || data.description || "";
        rawImageUrl = data.img || data.image || "";
      } else if (selectedKey === "genshin") {
        const q = data.quiz || data;
        question = q.question || "Siapakah karakter Genshin Impact ini?";
        answer = q.answer || "";
        clue = q.mark_ans || "";
        hintMessage = q.quote ? `Quote: "${q.quote}"` : q.description || "";
        rawImageUrl = q.image || data.image || "";
      } else {
        question = data.question || "";
        answer = data.answer || "";
        clue = data.hint?.underline || data.clue || "";
        hintMessage = data.hint?.message || data.description || "";
        rawImageUrl = data.image || data.logo || data.portrait_images?.[0] || data.img || data.gambar || "";
        rawAudioUrl = data.quiz?.audio_url || data.hint?.audio || data.audio || "";
      }
      if (!answer) {
        throw new Error("Format jawaban kuis dari API tidak valid.");
      }
      const TIMEOUT_SECONDS = 120;
      const gameTitleNeoxr = gameConfig.name.toUpperCase().split("").join(" ");
      const canvasHtml = buildTebakShowcaseCanvasHtml(gameConfig.name, rawImageUrl, clue || answer.replace(/[a-zA-Z0-9]/g, "_ "), question, "QUESTION");
      const {
        buffer: cardBuffer,
        url: cardUrl
      } = await renderHtmlToImage(canvasHtml);
      const bodyText = `Hi Survivors!
Perhatikan visual yang ditampilkan dan tebak jawabannya!

–  *${gameTitleNeoxr}*

┌  ◦  *Pertanyaan* : ${question || "Tebak objek pada gambar terlampir"}
│  ◦  *Petunjuk Huruf* : ${clue || answer.replace(/[a-zA-Z0-9]/g, "_ ")}
│  ◦  *Timeout* : ${TIMEOUT_SECONDS} Detik
└  ◦  *Reward* : +250 EXP

_Balas (reply) pesan visual ini langsung dengan jawabanmu!_`;
      const buttons = [{
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "💡 Minta Petunjuk",
          id: `${prefix}tebak --hint`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🏳️ Menyerah",
          id: `${prefix}tebak --nyerah`
        })
      }];
      const sentMsg = await sendNeoxrTebak(sock, ctx, chatId, bodyText, buttons, quotedMsg, prefix, cardBuffer, cardUrl);
      const questionMsgId = sentMsg?.key?.id;
      global.db.tebak[chatId] = {
        questionMsgId: questionMsgId,
        gameKey: selectedKey,
        gameName: gameConfig.name,
        answer: answer.trim(),
        clue: clue || answer.replace(/[a-zA-Z0-9]/g, "_ "),
        question: question,
        hintMessage: hintMessage,
        rawImageUrl: rawImageUrl,
        startTime: Date.now(),
        expireTime: Date.now() + TIMEOUT_SECONDS * 1e3
      };
      saveDB();
      setTimeout(async () => {
        initDB();
        if (global.db.tebak[chatId] && Date.now() >= global.db.tebak[chatId].expireTime) {
          const current = global.db.tebak[chatId];
          delete global.db.tebak[chatId];
          saveDB();
          const timeoutCanvasHtml = buildTebakShowcaseCanvasHtml(current.gameName, current.rawImageUrl, current.clue, current.question, "TIMEOUT", current.answer);
          const {
            buffer,
            url
          } = await renderHtmlToImage(timeoutCanvasHtml);
          const timeoutMsg = `Hi All!
Waktu menjawab kuis telah habis! ⌛

–  *T I M E  O U T*

┌  ◦  *Game* : ${current.gameName}
│  ◦  *Jawaban Asli* : ${current.answer}
└  ◦  *Deskripsi* : ${current.hintMessage || "-"}

_Gunakan perintah \`${prefix}tebak\` untuk bermain lagi!_`;
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
      if (rawAudioUrl) {
        const audioBuffer = await fetchMediaBuffer(rawAudioUrl);
        if (audioBuffer) {
          await sock.sendMessage(chatId, {
            audio: audioBuffer,
            mimetype: "audio/mp4",
            ptt: true
          }, {
            quoted: sentMsg || quotedMsg
          });
        }
      }
      await ctx.react("🎯");
    } catch (error) {
      console.error("[Tebak Execute Error]:", error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Tebak Game Error: ${errMsg}`);
    }
  }
};