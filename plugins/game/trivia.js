import axios from "axios";
import db from "../../data/db.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/game/trivia-maker`;
const QUESTION_TIMEOUT = 45;
const PRESET_TOPICS = [{
  id: "tech",
  name: "💻 Teknologi & Komputer",
  desc: "Software, hardware, internet, & AI"
}, {
  id: "anime",
  name: "🎌 Anime & Manga",
  desc: "Kuis anime, manga, & karakter populer"
}, {
  id: "science",
  name: "🔬 Sains & Pengetahuan Alam",
  desc: "Fisika, kimia, biologi, & antariksa"
}, {
  id: "gaming",
  name: "🎮 Video Games",
  desc: "Konsol, PC, mobile, esports, & sejarah"
}, {
  id: "history",
  name: "📜 Sejarah Dunia & Indonesia",
  desc: "Peristiwa bersejarah, tokoh, & perang"
}, {
  id: "geography",
  name: "🌍 Geografi & Negara",
  desc: "Ibukota, bendera, landmark, & peta dunia"
}, {
  id: "movies",
  name: "🎬 Film & Sinema",
  desc: "Hollywood, Marvel, DC, & box office"
}, {
  id: "music",
  name: "🎵 Musik & Musisi",
  desc: "Genre musik, band legendaris, & lagu hits"
}, {
  id: "sports",
  name: "⚽ Olahraga & Atlet",
  desc: "Sepak bola, basket, bulu tangkis, & F1"
}, {
  id: "general",
  name: "🌐 Pengetahuan Umum",
  desc: "Fakta unik & wawasan umum dunia"
}];
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

function buildTriviaCanvasHtml(topic, qIndex, totalQ, q, status = "QUESTION") {
  const botName = global.bot?.name || "WudysoftBot";
  const isCorrect = status === "CORRECT";
  const isTimeout = status === "TIMEOUT" || status === "REVEALED";
  const statusColor = isCorrect ? "#10b981" : isTimeout ? "#ef4444" : "#8b5cf6";
  const statusLabel = isCorrect ? "TEPAT SEKALI" : isTimeout ? "WAKTU HABIS" : "TRIVIA ARENA";
  const cleanAns = normalizeText(q.correctAnswer);
  const isAnsA = isCorrect || isTimeout ? normalizeText(q.optionA) === cleanAns : false;
  const isAnsB = isCorrect || isTimeout ? normalizeText(q.optionB) === cleanAns : false;
  const isAnsC = isCorrect || isTimeout ? normalizeText(q.optionC) === cleanAns : false;
  const isAnsD = isCorrect || isTimeout ? normalizeText(q.optionD) === cleanAns : false;
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
        height: 500px;
        background: #080a12;
        font-family: 'Plus Jakarta Sans', sans-serif;
        display: flex;
        justify-content: center;
        align-items: center;
        overflow: hidden;
      }
      .stage {
        width: 710px;
        height: 460px;
        background: radial-gradient(circle at 50% 10%, rgba(139, 92, 246, 0.22) 0%, rgba(11, 14, 24, 0.98) 85%);
        border: 2px solid #282b42;
        border-radius: 20px;
        box-shadow: 0 25px 60px rgba(0,0,0,0.85);
        padding: 22px 26px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }
      .top-row {
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
        background: #8b5cf6;
        color: #fff;
        width: 32px;
        height: 32px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
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
      .question-box {
        background: #111526;
        border: 1px solid #272d4d;
        border-radius: 14px;
        padding: 20px 22px;
        box-shadow: inset 0 0 20px rgba(0,0,0,0.6);
        text-align: center;
      }
      .topic-badge {
        display: inline-block;
        background: rgba(139, 92, 246, 0.2);
        color: #c4b5fd;
        border: 1px solid #8b5cf6;
        font-size: 11px;
        font-weight: 800;
        padding: 3px 12px;
        border-radius: 20px;
        letter-spacing: 1.5px;
        text-transform: uppercase;
        margin-bottom: 8px;
      }
      .question-text {
        color: #f1f5f9;
        font-size: 18px;
        font-weight: 800;
        line-height: 1.4;
      }
      .options-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px 14px;
      }
      .opt-card {
        height: 48px;
        background: #121629;
        border: 1px solid #242c4c;
        border-radius: 10px;
        padding: 0 14px;
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .opt-card.correct-slot {
        background: rgba(16, 185, 129, 0.2);
        border-color: #10b981;
      }
      .opt-letter {
        width: 26px;
        height: 26px;
        background: #252d4e;
        color: #a78bfa;
        border-radius: 6px;
        display: flex;
        justify-content: center;
        align-items: center;
        font-weight: 900;
        font-size: 13px;
      }
      .opt-card.correct-slot .opt-letter {
        background: #10b981;
        color: #042416;
      }
      .opt-text {
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
        border-top: 1px solid #1f253d;
        padding-top: 12px;
        color: #94a3b8;
        font-size: 13px;
        font-weight: 700;
      }
      .footer-meta b {
        color: #8b5cf6;
      }
    </style>
  </head>
  <body>
    <div class="stage">
      <div class="top-row">
        <div class="brand">
          <div class="brand-icon">💡</div>
          <div class="brand-text">TRIVIA <span>QUIZ</span></div>
        </div>
        <div class="status-pill">${statusLabel}</div>
      </div>
      <div class="question-box">
        <div class="topic-badge">${topic || "GENERAL"} • SOAL ${qIndex} / ${totalQ}</div>
        <div class="question-text">${q.question || "Pertanyaan Kuis"}</div>
      </div>
      <div class="options-grid">
        <div class="opt-card ${isAnsA ? "correct-slot" : ""}">
          <div class="opt-letter">A</div>
          <div class="opt-text">${q.optionA || "-"}</div>
        </div>
        <div class="opt-card ${isAnsB ? "correct-slot" : ""}">
          <div class="opt-letter">B</div>
          <div class="opt-text">${q.optionB || "-"}</div>
        </div>
        <div class="opt-card ${isAnsC ? "correct-slot" : ""}">
          <div class="opt-letter">C</div>
          <div class="opt-text">${q.optionC || "-"}</div>
        </div>
        <div class="opt-card ${isAnsD ? "correct-slot" : ""}">
          <div class="opt-letter">D</div>
          <div class="opt-text">${q.optionD || "-"}</div>
        </div>
      </div>
      <div class="footer-meta">
        <div>REWARD : <b>+Rp 2.500 | +100 EXP</b></div>
        <div>TIMEOUT : <b>${QUESTION_TIMEOUT}s</b></div>
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
  if (!global.db.trivia) global.db.trivia = {};
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

function getCorrectLetter(q) {
  const cleanAns = normalizeText(q.correctAnswer);
  if (normalizeText(q.optionA) === cleanAns) return "A";
  if (normalizeText(q.optionB) === cleanAns) return "B";
  if (normalizeText(q.optionC) === cleanAns) return "C";
  if (normalizeText(q.optionD) === cleanAns) return "D";
  return "A";
}

function formatTriviaBody(session) {
  const q = session.questions[session.currentIndex];
  const qNum = session.currentIndex + 1;
  const totalQ = session.questions.length;
  return `Hi Survivors!
Jawab kuis trivia pilihan ganda berikut bersama anggota grup.

–  *T R I V I A  Q U I Z*

┌  ◦  *Topik* : ${(session.topic || "General").toUpperCase()}
│  ◦  *Progress* : Soal ${qNum} / ${totalQ}
│  ◦  *Timeout* : ${QUESTION_TIMEOUT} Detik
└  ◦  *Reward* : +Rp 2.500 | +100 EXP

–  *Q U E S T I O N*

"${q.question}"

–  *O P T I O N S*

┌  ◦  *A.* ${q.optionA}
│  ◦  *B.* ${q.optionB}
│  ◦  *C.* ${q.optionC}
└  ◦  *D.* ${q.optionD}

_Pilih opsi dari menu di bawah atau balas langsung dengan huruf (A / B / C / D)!_`;
}
async function sendTopicSelectionMenu(sock, ctx, chatId, quotedMsg, prefix = ".") {
  const botName = global.bot?.name || "WudysoftBot";
  const botFooter = `${global.bot?.footer || botName}`;
  const bannerImage = global.bot?.media?.banner1 || global.bot?.media?.banner2 || "https://files.catbox.moe/g2e6i5.jpg";
  const senderNum = (ctx.sender || "").split("@")[0];
  const topicRows = PRESET_TOPICS.map(t => ({
    title: t.name,
    id: `${prefix}trivia ${t.id}`,
    description: t.desc
  }));
  const bodyText = `Hi @${senderNum}!
Silakan tentukan topik kuis trivia yang ingin kamu mainkan bersama anggota grup.

–  *T R I V I A  T O P I C*

┌  ◦  *Format* : ${prefix}trivia <topik>
└  ◦  *Contoh* : ${prefix}trivia Marvel

_Pilih salah satu topik populer melalui menu di bawah atau ketik topik kustommu!_`;
  const buttons = [{
    name: "single_select",
    buttonParamsJson: JSON.stringify({
      title: "📚 DAFTAR TOPIK KUIS",
      sections: [{
        title: `${botName} • Kategori Trivia Populer`,
        rows: topicRows
      }]
    })
  }];
  const options = {
    image: bannerImage,
    title: `✦ ${botName} • Pilihan Topik Trivia ✦`,
    params: {
      bottom_sheet: {
        in_thread_buttons_limit: 1,
        divider_indices: [1],
        list_title: `${botName} • Pilihan Topik`,
        button_title: "📚 Pilih Topik"
      }
    },
    contextInfo: {
      mentionedJid: [ctx.sender],
      forwardingScore: 999,
      isForwarded: true
    },
    quoted: quotedMsg || undefined
  };
  if (typeof ctx?.sendCta === "function" && chatId === ctx.id) {
    return await ctx.sendCta(bodyText, botFooter, buttons, options);
  }
  return await sock.sendMessage(chatId, {
    text: bodyText,
    mentions: [ctx.sender]
  }, {
    quoted: quotedMsg
  });
}
async function sendTriviaCtaMessage(sock, ctx, chatId, session, quotedMsg, prefix = ".", imageBuffer = null, imageUrl = null) {
  const botName = global.bot?.name || "WudysoftBot";
  const botFooter = `${global.bot?.footer || botName}`;
  const q = session.questions[session.currentIndex];
  const qNum = session.currentIndex + 1;
  const bodyText = formatTriviaBody(session);
  const answerRows = [{
    title: `🅰️ Opsi A: ${q.optionA.slice(0, 30)}`,
    id: `A`,
    description: `Pilih [A] ${q.optionA.slice(0, 45)}`
  }, {
    title: `🅱️ Opsi B: ${q.optionB.slice(0, 30)}`,
    id: `B`,
    description: `Pilih [B] ${q.optionB.slice(0, 45)}`
  }, {
    title: `🅲️ Opsi C: ${q.optionC.slice(0, 30)}`,
    id: `C`,
    description: `Pilih [C] ${q.optionC.slice(0, 45)}`
  }, {
    title: `🅳️ Opsi D: ${q.optionD.slice(0, 30)}`,
    id: `D`,
    description: `Pilih [D] ${q.optionD.slice(0, 45)}`
  }, {
    title: `🏳️ Menyerah`,
    id: `${prefix}trivia --nyerah`,
    description: `Hentikan sesi kuis trivia saat ini`
  }];
  const buttons = [{
    name: "single_select",
    buttonParamsJson: JSON.stringify({
      title: `🔘 PILIH JAWABAN (${qNum}/${session.questions.length})`,
      sections: [{
        title: `${botName} • Soal #${qNum}`,
        rows: answerRows
      }]
    })
  }, {
    name: "quick_reply",
    buttonParamsJson: JSON.stringify({
      display_text: "🏳️ Menyerah",
      id: `${prefix}trivia --nyerah`
    })
  }];
  const mediaSource = imageBuffer || (imageUrl ? {
    url: imageUrl
  } : global.bot?.media?.banner1 || "https://files.catbox.moe/g2e6i5.jpg");
  const options = {
    image: mediaSource,
    title: `✦ ${botName} • Trivia Quiz #${qNum} ✦`,
    params: {
      bottom_sheet: {
        in_thread_buttons_limit: 1,
        divider_indices: [1],
        list_title: `${botName} • Trivia Quiz`,
        button_title: "🔘 Jawab Kuis"
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
      sentMsg = await ctx.sendCta(bodyText, botFooter, buttons, options);
    } catch (e) {
      console.error("[Trivia sendCta Error]:", e.message);
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
        caption: bodyText,
        footer: botFooter,
        viewOnceMessage: {
          message: {
            interactiveMessage: {
              body: {
                text: bodyText
              },
              footer: {
                text: botFooter
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
        caption: `${bodyText}\n\n_${botFooter}_`
      }, {
        quoted: quotedMsg
      });
    } else {
      sentMsg = await sock.sendMessage(chatId, {
        text: `${bodyText}\n\n_${botFooter}_`
      }, {
        quoted: quotedMsg
      });
    }
  }
  if (sentMsg?.key?.id) {
    if (!Array.isArray(session.msgIds)) session.msgIds = [];
    if (!session.msgIds.includes(sentMsg.key.id)) {
      session.msgIds.push(sentMsg.key.id);
    }
    session.questionMsgId = sentMsg.key.id;
    session.expireTime = Date.now() + QUESTION_TIMEOUT * 1e3;
    saveDB();
  }
  return sentMsg;
}
async function nextTriviaQuestion(sock, ctx, chatId, session, prefix = ".") {
  session.currentIndex++;
  if (session.currentIndex >= session.questions.length) {
    const scores = session.scores || {};
    delete global.db.trivia[chatId];
    saveDB();
    const sortedPlayers = Object.entries(scores).sort((a, b) => b[1].score - a[1].score);
    const mentions = [];
    let scoreRows = "";
    if (sortedPlayers.length) {
      sortedPlayers.forEach(([jid, data], idx) => {
        const isLast = idx === sortedPlayers.length - 1;
        const branch = isLast ? "└" : "│";
        mentions.push(jid);
        scoreRows += `${branch}  ◦  *${idx + 1}.* @${jid.split("@")[0]} (${data.correct} Benar • ${data.score} Poin)\n`;
      });
    } else {
      scoreRows = `└  ◦  _Tidak ada pemain yang berhasil menjawab._\n`;
    }
    const scoreboard = `Hi Survivors!
Kuis trivia telah selesai seluruhnya! 🏆

–  *F I N A L  S C O R E B O A R D*

${scoreRows}
_Terima kasih telah berpartisipasi! Ketik \`${prefix}trivia\` untuk memulai topik baru._`;
    return await sock.sendMessage(chatId, {
      text: scoreboard.trim(),
      mentions: mentions
    });
  }
  session.expireTime = Date.now() + QUESTION_TIMEOUT * 1e3;
  saveDB();
  setTimeout(async () => {
    initDB();
    const activeSession = global.db.trivia[chatId];
    if (activeSession && Date.now() >= activeSession.expireTime) {
      const currentQ = activeSession.questions[activeSession.currentIndex];
      const correctLtr = getCorrectLetter(currentQ);
      const timeoutCanvasHtml = buildTriviaCanvasHtml(activeSession.topic, activeSession.currentIndex + 1, activeSession.questions.length, currentQ, "TIMEOUT");
      const {
        buffer,
        url
      } = await renderHtmlToImage(timeoutCanvasHtml);
      const timeoutMsg = `Hi All!
Waktu menjawab soal #${activeSession.currentIndex + 1} telah habis! ⌛

–  *T I M E  O U T*

┌  ◦  *Soal* : #${activeSession.currentIndex + 1}
└  ◦  *Kunci Jawaban* : [${correctLtr}] ${currentQ.correctAnswer}

_Memuat pertanyaan berikutnya..._`;
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
      await nextTriviaQuestion(sock, ctx, chatId, activeSession, prefix);
    }
  }, QUESTION_TIMEOUT * 1e3);
  const currentQ = session.questions[session.currentIndex];
  const canvasHtml = buildTriviaCanvasHtml(session.topic, session.currentIndex + 1, session.questions.length, currentQ, "QUESTION");
  const {
    buffer: cardBuffer,
    url: cardUrl
  } = await renderHtmlToImage(canvasHtml);
  await sendTriviaCtaMessage(sock, ctx, chatId, session, null, prefix, cardBuffer, cardUrl);
}
export default {
  name: "trivia",
  aliases: ["triviakuis", "kuistrivia", "triviamaker", "quiz"],
  description: "Game kuis trivia pilihan ganda interaktif dengan canvas realistis bertema Neoxr",
  category: "Game",
  limit: true,
  example: "trivia tech atau trivia anime",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const chatId = ctx?.id || msg?.key?.remoteJid;
      if (!chatId) return;
      initDB();
      if (!global.db.trivia[chatId]) return;
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      const session = global.db.trivia[chatId];
      if (Date.now() > session.expireTime) return;
      const quotedStanzaId = ctx?.quoted?.id || msg?.message?.extendedTextMessage?.contextInfo?.stanzaId;
      const isQuotingGame = quotedStanzaId && (quotedStanzaId === session.questionMsgId || Array.isArray(session.msgIds) && session.msgIds.includes(quotedStanzaId));
      if (!isQuotingGame) return;
      const userText = (ctx?.text || ctx?.query || msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "").trim();
      const prefixList = [".", "#", "!", "/", ctx?.prefix].filter(Boolean);
      if (prefixList.some(p => userText.startsWith(p))) return;
      const cleanInput = normalizeText(userText);
      if (!cleanInput) return;
      const currentQ = session.questions[session.currentIndex];
      const correctLetter = getCorrectLetter(currentQ);
      const correctText = normalizeText(currentQ.correctAnswer);
      const isCorrect = cleanInput === correctLetter.toLowerCase() || cleanInput === correctText || cleanInput.length >= 4 && correctText.includes(cleanInput);
      const senderName = ctx?.pushName || ctx?.pushname || "Pemain Cerdas";
      const senderJid = ctx?.sender || msg?.key?.participant;
      if (isCorrect) {
        session.scores = session.scores || {};
        session.scores[senderJid] = session.scores[senderJid] || {
          name: senderName,
          score: 0,
          correct: 0
        };
        session.scores[senderJid].score += 100;
        session.scores[senderJid].correct += 1;
        if (senderJid) {
          initDB(senderJid, senderName);
          global.db.user[senderJid].exp = (Number(global.db.user[senderJid].exp) || 0) + 100;
          global.db.user[senderJid].money = (Number(global.db.user[senderJid].money) || 0) + 2500;
        }
        saveDB();
        if (typeof ctx?.react === "function") await ctx.react("✅");
        const winNotif = `Hi ${senderName}!
Tebakanmu tepat sekali! (+Rp 2.500 | +100 EXP)

–  *C O R R E C T  A N S W E R*

┌  ◦  *Penebak* : @${senderJid.split("@")[0]}
└  ◦  *Jawaban Tepat* : [ ${correctLetter} ] ${currentQ.correctAnswer}`;
        await sock.sendMessage(chatId, {
          text: winNotif,
          mentions: [senderJid]
        }, {
          quoted: msg
        });
        await nextTriviaQuestion(sock, ctx, chatId, session, ctx?.prefix || ".");
        return true;
      } else {
        if (typeof ctx?.react === "function") await ctx.react("❌");
        const wrongNotif = `Hi ${senderName}!
Pilihan "${userText}" tidak tepat. Coba pilih opsi lainnya!`;
        await sock.sendMessage(chatId, {
          text: wrongNotif
        }, {
          quoted: msg
        });
        return true;
      }
    } catch (e) {
      console.error("[TRIVIA BEFORE ERROR]:", e.message);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      const isGroup = Boolean(ctx?.isGroup || ctx?.id?.endsWith("@g.us"));
      if (!isGroup) {
        return ctx.reply("❌ Fitur Kuis Trivia hanya dapat dimainkan di dalam Grup.");
      }
      const rawText = (ctx.query || ctx.text || "").trim();
      const prefix = ctx.prefix || ".";
      const userName = ctx.pushName || ctx.pushname || ctx.sender.split("@")[0];
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const chatId = ctx.id;
      initDB();
      if (rawText.includes("nyerah") || rawText.includes("surrender") || rawText.includes("end") || rawText.includes("stop")) {
        if (global.db.trivia[chatId]) {
          const session = global.db.trivia[chatId];
          const currentQ = session.questions[session.currentIndex];
          const correctLtr = getCorrectLetter(currentQ);
          delete global.db.trivia[chatId];
          saveDB();
          const surrenderCanvasHtml = buildTriviaCanvasHtml(session.topic, session.currentIndex + 1, session.questions.length, currentQ, "REVEALED");
          const {
            buffer,
            url
          } = await renderHtmlToImage(surrenderCanvasHtml);
          const surrenderMsg = `Hi ${userName}!
Sesi kuis trivia telah dihentikan.

–  *S U R R E N D E R*

┌  ◦  *Soal Terakhir* : #${session.currentIndex + 1}
│  ◦  *Jawaban Asli* : [${correctLtr}] ${currentQ.correctAnswer}
└  ◦  *Status* : Permainan Diakhiri

_Ketik \`${prefix}trivia\` untuk memulai topik baru._`;
          if (buffer || url) {
            return await sock.sendMessage(chatId, {
              image: buffer || {
                url: url
              },
              caption: surrenderMsg
            }, {
              quoted: quotedMsg
            });
          }
          return await sock.sendMessage(chatId, {
            text: surrenderMsg
          }, {
            quoted: quotedMsg
          });
        }
        return ctx.reply("❌ Tidak ada sesi Kuis Trivia yang sedang aktif di grup ini.");
      }
      if (global.db.trivia[chatId]) {
        const session = global.db.trivia[chatId];
        const currentQ = session.questions[session.currentIndex];
        const canvasHtml = buildTriviaCanvasHtml(session.topic, session.currentIndex + 1, session.questions.length, currentQ, "QUESTION");
        const {
          buffer,
          url
        } = await renderHtmlToImage(canvasHtml);
        return await sendTriviaCtaMessage(sock, ctx, chatId, session, quotedMsg, prefix, buffer, url);
      }
      if (!rawText) {
        return await sendTopicSelectionMenu(sock, ctx, chatId, quotedMsg, prefix);
      }
      await ctx.react("⏳");
      const topic = rawText;
      const {
        data
      } = await axios.get(API_URL, {
        params: {
          topic: topic
        },
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 3e4
      });
      const questions = data?.questions || [];
      if (!Array.isArray(questions) || questions.length === 0) {
        await ctx.react("❌");
        return ctx.reply(`❌ Gagal memuat kuis trivia untuk topik "${topic}".\nKetik *${prefix}trivia* untuk melihat daftar topik populer.`);
      }
      global.db.trivia[chatId] = {
        topic: topic,
        questions: questions,
        currentIndex: 0,
        scores: {},
        msgIds: [],
        questionMsgId: null,
        startTime: Date.now(),
        expireTime: Date.now() + QUESTION_TIMEOUT * 1e3
      };
      saveDB();
      setTimeout(async () => {
        initDB();
        if (global.db.trivia[chatId] && Date.now() >= global.db.trivia[chatId].expireTime) {
          const activeSession = global.db.trivia[chatId];
          const currentQ = activeSession.questions[activeSession.currentIndex];
          const correctLtr = getCorrectLetter(currentQ);
          const timeoutCanvasHtml = buildTriviaCanvasHtml(activeSession.topic, activeSession.currentIndex + 1, activeSession.questions.length, currentQ, "TIMEOUT");
          const {
            buffer,
            url
          } = await renderHtmlToImage(timeoutCanvasHtml);
          const timeoutMsg = `Hi All!
Waktu menjawab soal #${activeSession.currentIndex + 1} telah habis! ⌛

–  *T I M E  O U T*

┌  ◦  *Soal* : #${activeSession.currentIndex + 1}
└  ◦  *Kunci Jawaban* : [${correctLtr}] ${currentQ.correctAnswer}

_Memuat pertanyaan berikutnya..._`;
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
          await nextTriviaQuestion(sock, ctx, chatId, activeSession, prefix);
        }
      }, QUESTION_TIMEOUT * 1e3);
      const currentQ = global.db.trivia[chatId].questions[0];
      const canvasHtml = buildTriviaCanvasHtml(topic, 1, questions.length, currentQ, "QUESTION");
      const {
        buffer: cardBuffer,
        url: cardUrl
      } = await renderHtmlToImage(canvasHtml);
      await sendTriviaCtaMessage(sock, ctx, chatId, global.db.trivia[chatId], quotedMsg, prefix, cardBuffer, cardUrl);
      await ctx.react("🧠");
    } catch (error) {
      console.error("[Trivia Execute Error]:", error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Trivia Game Error: ${errMsg}`);
    }
  }
};