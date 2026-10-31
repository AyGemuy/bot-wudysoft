import axios from "axios";
import db from "../../data/db.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/fun/kahoot`;
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

function buildKahootCanvasHtml(questionTitle, choices = [], qIndex = 1, totalQ = 10, timeoutSec = 30, imageUrl = null) {
  const kahootColors = [{
    bg: "#e21b3c",
    shape: "▲",
    label: "A"
  }, {
    bg: "#1368ce",
    shape: "◆",
    label: "B"
  }, {
    bg: "#d89e00",
    shape: "●",
    label: "C"
  }, {
    bg: "#26890c",
    shape: "■",
    label: "D"
  }, {
    bg: "#8a2be2",
    shape: "★",
    label: "E"
  }, {
    bg: "#ff69b4",
    shape: "✦",
    label: "F"
  }];
  const choicesHtml = choices.map((c, i) => {
    const theme = kahootColors[i] || kahootColors[0];
    return `
      <div class="kahoot-tile" style="background: ${theme.bg};">
        <div class="tile-shape">${theme.shape}</div>
        <div class="tile-text">${c.answer || ""}</div>
      </div>
    `;
  }).join("");
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800;900&family=Rajdhani:wght@700&display=swap');
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        width: 760px;
        height: 520px;
        background: #1e0b47;
        font-family: 'Montserrat', sans-serif;
        display: flex;
        justify-content: center;
        align-items: center;
        overflow: hidden;
      }
      .board {
        position: relative;
        width: 720px;
        height: 480px;
        background: radial-gradient(circle at 50% 20%, #46178f 0%, #170733 90%);
        border: 2px solid #5d25b5;
        border-radius: 20px;
        box-shadow: 0 25px 60px rgba(0,0,0,0.85);
        padding: 22px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }
      .top-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .kahoot-logo {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .logo-pill {
        background: #ffffff;
        color: #46178f;
        padding: 4px 14px;
        border-radius: 8px;
        font-weight: 900;
        font-size: 20px;
        letter-spacing: -0.5px;
      }
      .round-badge {
        color: #e0d4fc;
        font-size: 13px;
        font-weight: 800;
        letter-spacing: 1.5px;
        text-transform: uppercase;
      }
      .timer-circle {
        width: 44px;
        height: 44px;
        background: #eb008b;
        color: #fff;
        border-radius: 50%;
        display: flex;
        justify-content: center;
        align-items: center;
        font-weight: 900;
        font-size: 18px;
        border: 3px solid #ff4dc4;
        box-shadow: 0 4px 12px rgba(235, 0, 139, 0.4);
      }
      .middle-stage {
        display: flex;
        gap: 16px;
        align-items: center;
        margin: 10px 0;
      }
      ${imageUrl ? `
        .media-frame {
          width: 180px;
          height: 120px;
          border-radius: 12px;
          overflow: hidden;
          border: 2px solid #6b32c9;
          box-shadow: 0 8px 18px rgba(0,0,0,0.5);
          flex-shrink: 0;
        }
        .media-frame img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
      ` : ""}
      .question-card {
        flex: 1;
        background: #ffffff;
        color: #25282a;
        padding: 16px 20px;
        border-radius: 14px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100px;
        text-align: center;
      }
      .question-card h2 {
        font-size: 18px;
        font-weight: 800;
        line-height: 1.35;
      }
      .tiles-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }
      .kahoot-tile {
        height: 60px;
        border-radius: 10px;
        padding: 0 16px;
        display: flex;
        align-items: center;
        gap: 14px;
        box-shadow: 0 6px 14px rgba(0,0,0,0.4);
        transition: transform 0.1s;
      }
      .tile-shape {
        font-size: 26px;
        color: #ffffff;
        text-shadow: 0 2px 4px rgba(0,0,0,0.4);
        width: 30px;
        display: flex;
        justify-content: center;
      }
      .tile-text {
        color: #ffffff;
        font-size: 15px;
        font-weight: 800;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        letter-spacing: 0.3px;
      }
    </style>
  </head>
  <body>
    <div class="board">
      <div class="top-bar">
        <div class="kahoot-logo">
          <div class="logo-pill">Kahoot!</div>
          <div class="round-badge">QUESTION ${qIndex} / ${totalQ}</div>
        </div>
        <div class="timer-circle">${timeoutSec}s</div>
      </div>
      <div class="middle-stage">
        ${imageUrl ? `
          <div class="media-frame">
            <img src="${imageUrl}" alt="Media">
          </div>
        ` : ""}
        <div class="question-card">
          <h2>${questionTitle}</h2>
        </div>
      </div>
      <div class="tiles-grid">
        ${choicesHtml}
      </div>
    </div>
  </body>
  </html>
  `;
}

function initDB(jid = null, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.kahoot) global.db.kahoot = {};
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

function cleanHtml(str = "") {
  return String(str).replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}

function normalizeText(str = "") {
  return String(str).toLowerCase().replace(/[^\w\s]/gi, "").replace(/\s+/g, " ").trim();
}
async function sendKahootQuestion(sock, ctx, chatId, session, quotedMsg) {
  const prefix = ctx?.prefix || ".";
  const botName = global.bot?.name || "WudysoftBot";
  const botFooter = `${global.bot?.footer || botName}`;
  const q = session.questions[session.currentIndex];
  const qIndex = session.currentIndex + 1;
  const totalQ = session.questions.length;
  const timeoutSec = Math.max(Math.round((q.time || 3e4) / 1e3), 25);
  const questionTitle = cleanHtml(q.question || q.title || "Pertanyaan Kuis");
  const choices = (q.choices || []).map(c => ({
    answer: cleanHtml(c.answer),
    correct: Boolean(c.correct)
  }));
  const shapes = ["▲", "◆", "●", "■", "★", "✦"];
  const letters = ["A", "B", "C", "D", "E", "F"];
  const choiceRows = [];
  const choiceText = choices.map((c, idx) => {
    const isLast = idx === choices.length - 1;
    const branch = isLast ? "└" : "│";
    const label = letters[idx] || `${idx + 1}`;
    const shape = shapes[idx] || "•";
    choiceRows.push({
      title: `[ ${label} ] ${shape} ${c.answer.slice(0, 22)}`,
      id: `${prefix}kahootgame ${label}`,
      description: `Pilih opsi [${label}]: ${c.answer.slice(0, 60)}`
    });
    return `${branch}  ◦  *${label}.* ${shape} ${c.answer}`;
  }).join("\n");
  const bodyText = `Hi Survivors!
Jawab soal kuis Kahoot interaktif berikut.

–  *K A H O O T  Q U I Z*

┌  ◦  *Quiz* : ${session.quizTitle}
│  ◦  *Progress* : Soal ${qIndex} / ${totalQ}
│  ◦  *Score Saat Ini* : ${session.score} Poin
└  ◦  *Timeout* : ${timeoutSec}s

–  *Q U E S T I O N*

"${questionTitle}"

–  *O P T I O N S*

${choiceText}

_Pilih tombol di bawah atau ketik langsung huruf (A / B / C / D)!_`;
  const buttons = [{
    name: "single_select",
    buttonParamsJson: JSON.stringify({
      title: "🎯 PILIH JAWABAN",
      sections: [{
        title: `Soal #${qIndex}: Pilih Opsi Jawaban`,
        rows: choiceRows
      }]
    })
  }, {
    name: "quick_reply",
    buttonParamsJson: JSON.stringify({
      display_text: "⏭️ Lewati Soal",
      id: `${prefix}kahootgame --skip`
    })
  }, {
    name: "quick_reply",
    buttonParamsJson: JSON.stringify({
      display_text: "🏳️ Menyerah",
      id: `${prefix}kahootgame --nyerah`
    })
  }];
  const rawImage = q.image || q.media?.[0]?.url || session.coverUrl || null;
  const canvasHtml = buildKahootCanvasHtml(questionTitle, choices, qIndex, totalQ, timeoutSec, rawImage);
  const {
    buffer: cardBuffer,
    url: cardUrl
  } = await renderHtmlToImage(canvasHtml);
  const mediaSource = cardBuffer || (cardUrl ? {
    url: cardUrl
  } : rawImage ? {
    url: rawImage
  } : null);
  session.expireTime = Date.now() + timeoutSec * 1e3;
  saveDB();
  setTimeout(async () => {
    initDB();
    const activeSession = global.db.kahoot[chatId];
    if (activeSession && Date.now() >= activeSession.expireTime && activeSession.currentIndex === qIndex - 1) {
      const currentQ = activeSession.questions[activeSession.currentIndex];
      const correctChoice = currentQ?.choices?.find(c => c.correct === true);
      const correctAnsText = correctChoice ? cleanHtml(correctChoice.answer) : "-";
      const timeoutMsg = `Hi All!
Waktu menjawab Soal #${qIndex} telah habis! ⌛

–  *T I M E  O U T*

┌  ◦  *Soal* : #${qIndex}
└  ◦  *Kunci Jawaban* : ${correctAnsText}`;
      await sock.sendMessage(chatId, {
        text: timeoutMsg
      });
      activeSession.currentIndex++;
      if (activeSession.currentIndex < activeSession.questions.length) {
        saveDB();
        await sendKahootQuestion(sock, ctx, chatId, activeSession, quotedMsg);
      } else {
        const finalScore = activeSession.score;
        const totalMax = activeSession.questions.length * 100;
        delete global.db.kahoot[chatId];
        saveDB();
        const gameOverMsg = `Hi All!
Seluruh rangkaian kuis Kahoot telah selesai! 🏆

–  *G A M E  O V E R*

┌  ◦  *Quiz* : ${activeSession.quizTitle}
│  ◦  *Skor Akhir* : ${finalScore} / ${totalMax} Poin
└  ◦  *Akurasi* : ${Math.round(finalScore / totalMax * 100)}%

_Ketik \`${prefix}kahootgame <topik>\` untuk bermain kuis lainnya!_`;
        await sock.sendMessage(chatId, {
          text: gameOverMsg
        });
      }
    }
  }, timeoutSec * 1e3);
  const options = {
    image: mediaSource,
    title: `✦ ${botName} • Kahoot Quiz #${qIndex}/${totalQ} ✦`,
    params: {
      bottom_sheet: {
        in_thread_buttons_limit: 3,
        divider_indices: [1],
        list_title: `${botName} • Kahoot Options`,
        button_title: "🎯 Pilih Jawaban"
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
      return await ctx.sendCta(bodyText, botFooter, buttons, options);
    } catch (e) {
      console.error("[Kahoot ctx.sendCta Error]:", e.message);
    }
  }
  if (mediaSource) {
    return await sock.sendMessage(chatId, {
      image: cardBuffer || {
        url: cardUrl || rawImage
      },
      caption: `${bodyText}\n\n_${botFooter}_`
    }, {
      quoted: quotedMsg
    });
  }
  return await sock.sendMessage(chatId, {
    text: `${bodyText}\n\n_${botFooter}_`
  }, {
    quoted: quotedMsg
  });
}
export default {
  name: "kahootgame",
  aliases: ["kgame", "kahoot-game", "kuiskahoot", "kahootplay"],
  description: "Bermain kuis interaktif Kahoot dengan visual canvas realistis bertema Neoxr",
  category: "Game",
  limit: true,
  example: "kahootgame Anime atau kahootgame --uuid <uuid>",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const chatId = ctx?.id || msg?.key?.remoteJid;
      if (!chatId) return;
      initDB();
      if (!global.db.kahoot[chatId]) return;
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      const session = global.db.kahoot[chatId];
      let userText = (ctx?.text || ctx?.query || msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "").trim();
      const prefix = ctx?.prefix || ".";
      if (userText.startsWith(`${prefix}kahootgame `)) {
        userText = userText.slice(`${prefix}kahootgame `.length).trim();
      }
      if (userText.startsWith("--") || userText === `${prefix}kahootgame`) return;
      const q = session.questions[session.currentIndex];
      const choices = q.choices || [];
      const letters = ["a", "b", "c", "d", "e", "f"];
      const lowerInput = userText.toLowerCase().trim();
      let selectedIndex = -1;
      if (letters.includes(lowerInput)) {
        selectedIndex = letters.indexOf(lowerInput);
      } else if (!isNaN(lowerInput) && parseInt(lowerInput) >= 1 && parseInt(lowerInput) <= choices.length) {
        selectedIndex = parseInt(lowerInput) - 1;
      } else {
        const cleanUser = normalizeText(userText);
        selectedIndex = choices.findIndex(c => {
          const cleanAns = normalizeText(cleanHtml(c.answer));
          return cleanAns === cleanUser || cleanAns.includes(cleanUser) || cleanUser.includes(cleanAns);
        });
      }
      if (selectedIndex === -1 || !choices[selectedIndex]) return;
      const chosenChoice = choices[selectedIndex];
      const isCorrect = Boolean(chosenChoice.correct);
      const correctChoice = choices.find(c => c.correct === true);
      const correctAnsText = correctChoice ? cleanHtml(correctChoice.answer) : "-";
      const senderJid = ctx?.sender;
      const senderName = ctx?.pushname || ctx?.pushName || "Pemain";
      if (isCorrect) {
        session.score += 100;
        if (senderJid) {
          initDB(senderJid, senderName);
          global.db.user[senderJid].exp = (global.db.user[senderJid].exp || 0) + 150;
        }
        if (typeof ctx?.react === "function") await ctx.react("🎉");
        const correctMsg = `Hi ${senderName}!
Jawaban kamu tepat sekali! (+150 EXP)

–  *C O R R E C T  A N S W E R*

┌  ◦  *Pilihan* : ${cleanHtml(chosenChoice.answer)}
└  ◦  *Skor Tim* : ${session.score} Poin`;
        await sock.sendMessage(chatId, {
          text: correctMsg
        }, {
          quoted: msg
        });
      } else {
        if (typeof ctx?.react === "function") await ctx.react("❌");
        const wrongMsg = `Hi ${senderName}!
Jawabanmu kurang tepat.

–  *W R O N G  A N S W E R*

┌  ◦  *Pilihanmu* : ${cleanHtml(chosenChoice.answer)}
└  ◦  *Kunci Jawaban* : ${correctAnsText}`;
        await sock.sendMessage(chatId, {
          text: wrongMsg
        }, {
          quoted: msg
        });
      }
      session.currentIndex++;
      if (session.currentIndex < session.questions.length) {
        saveDB();
        await sendKahootQuestion(sock, ctx, chatId, session, msg);
      } else {
        const finalScore = session.score;
        const totalMax = session.questions.length * 100;
        delete global.db.kahoot[chatId];
        saveDB();
        const finishMsg = `Hi Survivors!
Kuis Kahoot telah rampung seluruhnya! 🏆

–  *G A M E  O V E R*

┌  ◦  *Player Terakhir* : ${senderName}
│  ◦  *Total Skor* : ${finalScore} / ${totalMax} Poin
└  ◦  *Akurasi* : ${Math.round(finalScore / totalMax * 100)}%

_Ketik \`${prefix}kahootgame <topik>\` untuk tantangan kuis lainnya!_`;
        await sock.sendMessage(chatId, {
          text: finishMsg
        }, {
          quoted: msg
        });
      }
      return true;
    } catch (e) {
      console.error("[KAHOOT BEFORE ERROR]:", e.message);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      const rawText = (ctx.query || ctx.text || "").trim();
      const prefix = ctx.prefix || ".";
      const userName = ctx.pushname || ctx.pushName || ctx.sender.split("@")[0];
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const chatId = ctx.id;
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = `${global.bot?.footer || botName}`;
      initDB();
      if (global.db.kahoot[chatId]) {
        const session = global.db.kahoot[chatId];
        if (rawText.includes("--nyerah") || rawText.includes("nyerah")) {
          const score = session.score;
          delete global.db.kahoot[chatId];
          saveDB();
          const surrenderMsg = `Hi ${userName}!
Sesi kuis Kahoot telah dihentikan.

–  *S U R R E N D E R*

┌  ◦  *Quiz* : ${session.quizTitle}
└  ◦  *Skor Akhir* : ${score} Poin`;
          return ctx.reply(surrenderMsg);
        }
        if (rawText.includes("--skip") || rawText.includes("skip")) {
          session.currentIndex++;
          if (session.currentIndex < session.questions.length) {
            saveDB();
            await ctx.reply(`Hi ${userName}!\nSoal dilewati, memuat pertanyaan berikutnya...`);
            await sendKahootQuestion(sock, ctx, chatId, session, quotedMsg);
          } else {
            const finalScore = session.score;
            delete global.db.kahoot[chatId];
            saveDB();
            return ctx.reply(`Hi ${userName}!\nPermainan selesai. Skor akhir: ${finalScore} Poin.`);
          }
          return;
        }
      }
      if (!rawText) {
        return ctx.reply(`Hi ${userName}!
Silakan tentukan topik kuis Kahoot yang ingin dimainkan.

–  *K A H O O T  G A M E*

┌  ◦  *Format* : ${prefix}kahootgame <topik>
│  ◦  *Contoh* : ${prefix}kahootgame Anime
└  ◦  *Via UUID* : ${prefix}kahootgame --uuid <uuid_kuis>`);
      }
      await ctx.react("⏳");
      let targetUuid = "";
      if (/--uuid\s+([^\s]+)/i.test(rawText)) {
        const match = rawText.match(/--uuid\s+([^\s]+)/i);
        if (match) targetUuid = match[1];
      }
      if (!targetUuid) {
        const {
          data: searchData
        } = await axios.post(API_URL, {
          action: "search",
          query: rawText
        }, {
          headers: {
            "Content-Type": "application/json"
          },
          timeout: 6e4
        });
        const entities = searchData?.entities || [];
        if (!searchData || entities.length === 0) {
          await ctx.react("❌");
          return ctx.reply(`❌ Kuis Kahoot dengan topik "*${rawText}*" tidak ditemukan.`);
        }
        const quizRows = entities.slice(0, 10).map((item, idx) => {
          const c = item.card || {};
          return {
            title: `[#${idx + 1}] ${cleanHtml(c.title).slice(0, 24)}`,
            id: `${prefix}kahootgame --uuid ${c.uuid}`,
            description: `❓ ${c.number_of_questions || 0} Soal • 👤 ${c.creator_username || "Unknown"}`
          };
        });
        const firstCard = entities[0]?.card || {};
        const coverMedia = firstCard.cover || global.bot?.media?.banner1 || "https://files.catbox.moe/g2e6i5.jpg";
        const selectBodyText = `Hi ${userName}!
Berikut hasil pencarian kuis Kahoot yang dapat kamu mainkan.

–  *S E A R C H  R E S U L T*

┌  ◦  *Topik* : ${rawText}
└  ◦  *Ditemukan* : ${entities.length} Kuis

_Pilih salah satu kuis melalui tombol menu di bawah ini!_`;
        const selectButtons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "🎮 PILIH KUIS KAHOOT",
            sections: [{
              title: `Hasil Pencarian: ${rawText}`,
              rows: quizRows
            }]
          })
        }];
        const searchOptions = {
          image: coverMedia,
          title: `✦ ${botName} • Kahoot Search ✦`,
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 1,
              divider_indices: [1],
              list_title: `${botName} • Pilih Kuis`,
              button_title: "🎮 Daftar Kuis"
            }
          },
          contextInfo: {
            mentionedJid: [ctx.sender],
            forwardingScore: 999,
            isForwarded: true
          },
          quoted: quotedMsg
        };
        if (typeof ctx.sendCta === "function") {
          return await ctx.sendCta(selectBodyText, botFooter, selectButtons, searchOptions);
        }
        return await sock.sendMessage(chatId, {
          image: {
            url: coverMedia
          },
          caption: `${selectBodyText}\n\n_${botFooter}_`
        }, {
          quoted: quotedMsg
        });
      }
      const {
        data: detailData
      } = await axios.post(API_URL, {
        action: "detail",
        uuid: targetUuid
      }, {
        headers: {
          "Content-Type": "application/json"
        },
        timeout: 6e4
      });
      const kahoot = detailData?.kahoot || {};
      const card = detailData?.card || {};
      const questions = (kahoot.questions || []).filter(q => q.choices && q.choices.length > 0);
      if (!detailData || questions.length === 0) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal memuat butir soal kuis dari server. Coba pilih kuis lainnya.");
      }
      global.db.kahoot[chatId] = {
        quizTitle: cleanHtml(card.title || kahoot.title || "Kahoot Game"),
        coverUrl: card.cover || kahoot.cover || null,
        questions: questions.slice(0, 10),
        currentIndex: 0,
        score: 0,
        startTime: Date.now(),
        expireTime: Date.now() + 3e4
      };
      saveDB();
      await sendKahootQuestion(sock, ctx, chatId, global.db.kahoot[chatId], quotedMsg);
      await ctx.react("🎮");
    } catch (error) {
      console.error("[KAHOOT GAME ERROR]:", error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Kahoot Game Error: ${errMsg}`);
    }
  }
};