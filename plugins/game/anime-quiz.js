import axios from "axios";
import db from "../../data/db.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/game/anime-quiz`;
const DEFAULT_TIMEOUT = 30;
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

function buildAnimeQuizCanvasHtml(session, statusText = "GUESS THE CHARACTER") {
  const botName = global.bot?.name || "WudysoftBot";
  const stats = session?.data?.stats || {};
  const quiz = session?.data?.quiz || {};
  const choices = quiz?.choices || [];
  const qNum = session?.data?.question_number || 1;
  const livesCount = Math.max(0, stats.lives ?? 3);
  const imageUrl = quiz?.image || "https://files.catbox.moe/g2e6i5.jpg";
  const letters = ["A", "B", "C", "D"];
  const choicesHtml = choices.map((c, i) => `
    <div class="opt-card">
      <div class="opt-key">${letters[i]}</div>
      <div class="opt-meta">
        <div class="char-title">${c.name}</div>
        <div class="anime-title">${c.anime}</div>
      </div>
    </div>
  `).join("");
  const heartsHtml = Array.from({
    length: 3
  }, (_, i) => `<span class="heart-icon ${i < livesCount ? "active" : "lost"}">❤</span>`).join("");
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
        background: #090812;
        font-family: 'Plus Jakarta Sans', sans-serif;
        display: flex;
        justify-content: center;
        align-items: center;
        overflow: hidden;
      }
      .quiz-card {
        width: 710px;
        height: 460px;
        background: radial-gradient(circle at 75% 25%, rgba(236, 72, 153, 0.22) 0%, rgba(11, 10, 22, 0.98) 80%);
        border: 2px solid #28243d;
        border-radius: 20px;
        box-shadow: 0 25px 60px rgba(0,0,0,0.85);
        padding: 22px 24px;
        display: flex;
        gap: 22px;
      }
      .visual-frame {
        width: 290px;
        height: 100%;
        background: #110f1e;
        border: 2px solid #362e54;
        border-radius: 14px;
        overflow: hidden;
        box-shadow: inset 0 0 20px rgba(0,0,0,0.8), 0 10px 25px rgba(0,0,0,0.5);
        position: relative;
        display: flex;
        justify-content: center;
        align-items: center;
      }
      .visual-frame img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .corner-badge {
        position: absolute;
        top: 10px;
        left: 10px;
        background: rgba(15, 12, 28, 0.85);
        border: 1px solid #ec4899;
        color: #f472b6;
        font-size: 11px;
        font-weight: 800;
        padding: 3px 10px;
        border-radius: 6px;
        letter-spacing: 1px;
        backdrop-filter: blur(4px);
      }
      .panel-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }
      .top-meta {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .brand-title {
        font-size: 18px;
        font-weight: 900;
        color: #f8fafc;
        letter-spacing: 0.5px;
      }
      .lives-box {
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .heart-icon {
        font-size: 18px;
      }
      .heart-icon.active {
        color: #ec4899;
        filter: drop-shadow(0 0 6px rgba(236, 72, 153, 0.8));
      }
      .heart-icon.lost {
        color: #3f3c4d;
      }
      .sub-heading {
        background: #110e1d;
        border: 1px solid #231d38;
        border-radius: 10px;
        padding: 10px 14px;
        margin: 6px 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .sub-heading small {
        color: #a855f7;
        font-weight: 800;
        font-size: 11px;
        letter-spacing: 1px;
      }
      .sub-heading b {
        color: #38bdf8;
        font-size: 13px;
      }
      .options-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .opt-card {
        height: 48px;
        background: #131022;
        border: 1px solid #241d3d;
        border-radius: 10px;
        padding: 0 12px;
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .opt-key {
        width: 26px;
        height: 26px;
        background: #231b3e;
        color: #ec4899;
        border-radius: 6px;
        display: flex;
        justify-content: center;
        align-items: center;
        font-weight: 900;
        font-size: 13px;
      }
      .opt-meta {
        flex: 1;
        overflow: hidden;
      }
      .char-title {
        font-size: 13px;
        font-weight: 800;
        color: #f1f5f9;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .anime-title {
        font-size: 11px;
        color: #94a3b8;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .bottom-meta {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-top: 1px solid #1c1830;
        padding-top: 10px;
        color: #94a3b8;
        font-size: 12px;
        font-weight: 700;
      }
      .bottom-meta b {
        color: #ec4899;
      }
    </style>
  </head>
  <body>
    <div class="quiz-card">
      <div class="visual-frame">
        <div class="corner-badge">QUESTION #${qNum}</div>
        <img src="${imageUrl}" alt="Anime Character">
      </div>
      <div class="panel-content">
        <div class="top-meta">
          <div class="brand-title">ANIME <span>QUIZ</span></div>
          <div class="lives-box">${heartsHtml}</div>
        </div>
        <div class="sub-heading">
          <small>SCORE : <b>${stats.score || "0"}</b></small>
          <small>LEVEL : <b>${stats.level || "1"}</b></small>
        </div>
        <div class="options-list">
          ${choicesHtml}
        </div>
        <div class="bottom-meta">
          <div>REWARD : <b>+Rp 3.000 | +150 EXP</b></div>
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
  if (!global.db.animeQuiz) global.db.animeQuiz = {};
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
async function callAnimeQuizApi(params = {}) {
  const res = await axios.get(API_URL, {
    params: params,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
    },
    timeout: 3e4
  });
  return res?.data;
}

function formatAnimeQuizBody(session) {
  const stats = session.data.stats || {};
  const choices = session.data.quiz?.choices || [];
  const qNum = session.data.question_number || 1;
  const livesCount = Math.max(0, stats.lives ?? 3);
  const hearts = "❤️".repeat(livesCount) + "🖤".repeat(Math.max(0, 3 - livesCount));
  const letters = ["A", "B", "C", "D"];
  const choiceText = choices.map((c, idx) => {
    const isLast = idx === choices.length - 1;
    const branch = isLast ? "└" : "│";
    return `${branch}  ◦  *${letters[idx] || idx + 1}.* ${c.name} (${c.anime})`;
  }).join("\n");
  return `Hi Survivors!
Tebak nama karakter anime pada gambar kuis di atas.

–  *A N I M E  Q U I Z*

┌  ◦  *Question* : #${qNum} (Level ${stats.level || 1})
│  ◦  *Nyawa Tersisa* : ${hearts} (${livesCount}/3)
│  ◦  *Skor Saat Ini* : ${stats.score || "0"} Poin
│  ◦  *Timeout* : ${session.data.time_limit || DEFAULT_TIMEOUT} Detik
└  ◦  *Reward* : +Rp 3.000 | +150 EXP

–  *C H A R A C T E R  O P T I O N S*

${choiceText}

_Pilih opsi dari tombol menu di bawah atau balas chat dengan huruf (A / B / C / D)!_`;
}
async function sendAnimeQuizMessage(sock, ctx, chatId, session, quotedMsg, prefix = ".", imageBuffer = null, imageUrl = null) {
  const botName = global.bot?.name || "WudysoftBot";
  const botFooter = `${global.bot?.footer || botName}`;
  const choices = session.data.quiz?.choices || [];
  const qNum = session.data.question_number || 1;
  const rawImageUrl = session.data.quiz?.image || "https://files.catbox.moe/g2e6i5.jpg";
  const bodyText = formatAnimeQuizBody(session);
  const letters = ["A", "B", "C", "D"];
  const choiceRows = choices.map((c, i) => ({
    title: `[ ${letters[i]} ] ${c.name.slice(0, 24)}`,
    id: letters[i],
    description: `📺 ${c.anime.slice(0, 60)}`
  }));
  choiceRows.push({
    title: "🏳️ Menyerah",
    id: `${prefix}animequiz --nyerah`,
    description: "Hentikan sesi kuis anime"
  });
  const buttons = [{
    name: "single_select",
    buttonParamsJson: JSON.stringify({
      title: `🔘 PILIH KARAKTER (Soal #${qNum})`,
      sections: [{
        title: `${botName} • Opsi Karakter`,
        rows: choiceRows
      }]
    })
  }, {
    name: "quick_reply",
    buttonParamsJson: JSON.stringify({
      display_text: "🏳️ Menyerah",
      id: `${prefix}animequiz --nyerah`
    })
  }];
  const mediaSource = imageBuffer || (imageUrl ? {
    url: imageUrl
  } : {
    url: rawImageUrl
  });
  const options = {
    image: mediaSource,
    title: `✦ ${botName} • Anime Quiz #${qNum} ✦`,
    params: {
      bottom_sheet: {
        in_thread_buttons_limit: 1,
        divider_indices: [1],
        list_title: `${botName} • Anime Quiz`,
        button_title: "🔘 Pilih Karakter"
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
      console.error("[AnimeQuiz sendCta Error]:", e.message);
    }
  }
  if (!sentMsg) {
    try {
      const mediaPayload = imageBuffer ? {
        image: imageBuffer
      } : {
        image: {
          url: imageUrl || rawImageUrl
        }
      };
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
    sentMsg = await sock.sendMessage(chatId, {
      image: imageBuffer || {
        url: imageUrl || rawImageUrl
      },
      caption: `${bodyText}\n\n_${botFooter}_`
    }, {
      quoted: quotedMsg
    });
  }
  if (sentMsg?.key?.id) {
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
  name: "animequiz",
  aliases: ["tebakanime", "tebakkarakter", "animeguess", "aquiz"],
  description: "Game tebak gambar karakter & anime interaktif dengan canvas realistis bertema Neoxr",
  category: "Game",
  limit: true,
  example: "animequiz atau animequiz --nyerah",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const chatId = ctx?.id || msg?.key?.remoteJid;
      if (!chatId) return;
      initDB();
      if (!global.db.animeQuiz[chatId]) return;
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      const session = global.db.animeQuiz[chatId];
      if (Date.now() > session.expireTime) {
        delete global.db.animeQuiz[chatId];
        saveDB();
        return;
      }
      const quotedStanzaId = ctx?.quoted?.id || msg?.message?.extendedTextMessage?.contextInfo?.stanzaId;
      const isQuotingGame = quotedStanzaId && (quotedStanzaId === session.questionMsgId || Array.isArray(session.msgIds) && session.msgIds.includes(quotedStanzaId));
      if (!isQuotingGame) return;
      const userText = (ctx?.text || ctx?.query || msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "").trim();
      const prefixList = [".", "#", "!", "/", ctx?.prefix].filter(Boolean);
      if (prefixList.some(p => userText.startsWith(p))) return;
      const cleanInput = normalizeText(userText);
      if (!cleanInput) return;
      const choices = session.data.quiz?.choices || [];
      const letters = ["a", "b", "c", "d"];
      let chosenItem = null;
      if (letters.includes(cleanInput)) {
        const idx = letters.indexOf(cleanInput);
        chosenItem = choices[idx];
      } else if (/^[1-4]$/.test(cleanInput)) {
        const idx = Number(cleanInput) - 1;
        chosenItem = choices[idx];
      } else {
        chosenItem = choices.find(c => normalizeText(c.name) === cleanInput || normalizeText(c.anime) === cleanInput || cleanInput.length >= 4 && normalizeText(c.name).includes(cleanInput));
      }
      if (!chosenItem) return;
      const senderName = ctx?.pushName || ctx?.pushname || "Pemain Cerdas";
      const senderJid = ctx?.sender || msg?.key?.participant;
      const resultData = await callAnimeQuizApi({
        session: session.apiSession,
        answer: chosenItem.id
      });
      if (resultData?.is_correct === true) {
        if (typeof ctx?.react === "function") await ctx.react("✅");
        if (senderJid) {
          initDB(senderJid, senderName);
          global.db.user[senderJid].exp = (Number(global.db.user[senderJid].exp) || 0) + 150;
          global.db.user[senderJid].money = (Number(global.db.user[senderJid].money) || 0) + 3e3;
          saveDB();
        }
        const winNotif = `Hi ${senderName}!
Tebakan karakter animemu tepat sekali! (+Rp 3.000 | +150 EXP)

–  *C O R R E C T  A N S W E R*

┌  ◦  *Karakter* : ${chosenItem.name}
│  ◦  *Anime* : ${chosenItem.anime}
│  ◦  *Penebak* : @${senderJid.split("@")[0]}
└  ◦  *Tambahan Skor* : +${resultData.stats?.added_score || 100} Poin

_Memuat pertanyaan level berikutnya..._`;
        await sock.sendMessage(chatId, {
          text: winNotif,
          mentions: [senderJid]
        }, {
          quoted: msg
        });
        const timeLimit = resultData.time_limit || DEFAULT_TIMEOUT;
        session.data = resultData;
        session.apiSession = resultData.session || session.apiSession;
        session.expireTime = Date.now() + timeLimit * 1e3;
        saveDB();
        setTimeout(async () => {
          initDB();
          if (global.db.animeQuiz[chatId] && Date.now() >= global.db.animeQuiz[chatId].expireTime) {
            delete global.db.animeQuiz[chatId];
            saveDB();
            const timeoutText = `Hi All! Waktu menjawab kuis anime telah habis! ⌛`;
            await sock.sendMessage(chatId, {
              text: timeoutText
            });
          }
        }, timeLimit * 1e3);
        const nextCanvasHtml = buildAnimeQuizCanvasHtml(session, "NEXT QUESTION");
        const {
          buffer,
          url
        } = await renderHtmlToImage(nextCanvasHtml);
        await sendAnimeQuizMessage(sock, ctx, chatId, session, msg, ctx?.prefix || ".", buffer, url);
        return true;
      }
      if (resultData?.is_correct === false || resultData?.stats?.lives === 0) {
        if (typeof ctx?.react === "function") await ctx.react("❌");
        const remainingLives = resultData?.stats?.lives ?? 0;
        if (remainingLives <= 0) {
          delete global.db.animeQuiz[chatId];
          saveDB();
          const gameOverText = `Hi Survivors!
Seluruh nyawa kuis telah habis! 💀

–  *G A M E  O V E R*

┌  ◦  *Skor Akhir* : ${resultData?.stats?.score || session.data.stats?.score || "0"} Poin
└  ◦  *Level Terakhir* : Level ${resultData?.stats?.level || session.data.stats?.level || 1}

_Ketik \`${ctx?.prefix || "."}animequiz\` untuk mencoba tantangan baru._`;
          await sock.sendMessage(chatId, {
            text: gameOverText
          }, {
            quoted: msg
          });
          return true;
        }
        const timeLimit = resultData.time_limit || DEFAULT_TIMEOUT;
        session.data = resultData;
        session.apiSession = resultData.session || session.apiSession;
        session.expireTime = Date.now() + timeLimit * 1e3;
        saveDB();
        const wrongText = `Hi ${senderName}!
Tebakan "${chosenItem.name}" tidak tepat.

–  *W R O N G  A N S W E R*

┌  ◦  *Sisa Nyawa* : ❤️ ${remainingLives}/3
└  ◦  *Aksi* : Silakan tebak pilihan karakter lainnya!`;
        await sock.sendMessage(chatId, {
          text: wrongText
        }, {
          quoted: msg
        });
        setTimeout(async () => {
          initDB();
          if (global.db.animeQuiz[chatId] && Date.now() >= global.db.animeQuiz[chatId].expireTime) {
            delete global.db.animeQuiz[chatId];
            saveDB();
            const timeoutText = `Hi All! Waktu menjawab kuis anime telah habis! ⌛`;
            await sock.sendMessage(chatId, {
              text: timeoutText
            });
          }
        }, timeLimit * 1e3);
        return true;
      }
    } catch (e) {
      console.error("[ANIME QUIZ BEFORE ERROR]:", e.message);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      const isGroup = Boolean(ctx?.isGroup || ctx?.id?.endsWith("@g.us"));
      if (!isGroup) {
        return ctx.reply("❌ Fitur Anime Quiz hanya dapat dimainkan di dalam Grup.");
      }
      const rawText = (ctx.query || ctx.text || "").trim().toLowerCase();
      const prefix = ctx.prefix || ".";
      const userName = ctx.pushName || ctx.pushname || ctx.sender.split("@")[0];
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const chatId = ctx.id;
      initDB();
      if (rawText.includes("nyerah") || rawText.includes("surrender") || rawText.includes("end") || rawText.includes("stop")) {
        if (global.db.animeQuiz[chatId]) {
          delete global.db.animeQuiz[chatId];
          saveDB();
          const surrenderMsg = `Hi ${userName}!
Sesi Anime Quiz telah dihentikan oleh pemain.

–  *S U R R E N D E R*

_Ketik \`${prefix}animequiz\` untuk memulai kuis baru._`;
          return await sock.sendMessage(chatId, {
            text: surrenderMsg
          }, {
            quoted: quotedMsg
          });
        }
        return ctx.reply("❌ Tidak ada sesi Anime Quiz yang sedang aktif di grup ini.");
      }
      if (global.db.animeQuiz[chatId]) {
        const session = global.db.animeQuiz[chatId];
        const canvasHtml = buildAnimeQuizCanvasHtml(session, "CURRENT QUIZ");
        const {
          buffer,
          url
        } = await renderHtmlToImage(canvasHtml);
        return await sendAnimeQuizMessage(sock, ctx, chatId, session, quotedMsg, prefix, buffer, url);
      }
      await ctx.react("⏳");
      const initialData = await callAnimeQuizApi();
      if (!initialData?.quiz?.choices || !initialData.quiz?.image) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal memuat data Anime Quiz dari server. Silakan coba sesaat lagi.");
      }
      const timeLimit = initialData.time_limit || DEFAULT_TIMEOUT;
      global.db.animeQuiz[chatId] = {
        apiSession: initialData.session,
        data: initialData,
        msgIds: [],
        questionMsgId: null,
        expireTime: Date.now() + timeLimit * 1e3,
        startTime: Date.now()
      };
      saveDB();
      setTimeout(async () => {
        initDB();
        if (global.db.animeQuiz[chatId] && Date.now() >= global.db.animeQuiz[chatId].expireTime) {
          delete global.db.animeQuiz[chatId];
          saveDB();
          const timeoutText = `Hi All! Waktu menjawab kuis anime telah habis! ⌛`;
          await sock.sendMessage(chatId, {
            text: timeoutText
          });
        }
      }, timeLimit * 1e3);
      const canvasHtml = buildAnimeQuizCanvasHtml(global.db.animeQuiz[chatId], "GUESS THE CHARACTER");
      const {
        buffer: cardBuffer,
        url: cardUrl
      } = await renderHtmlToImage(canvasHtml);
      await sendAnimeQuizMessage(sock, ctx, chatId, global.db.animeQuiz[chatId], quotedMsg, prefix, cardBuffer, cardUrl);
      await ctx.react("🎌");
    } catch (error) {
      console.error("[Anime Quiz Execute Error]:", error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Anime Quiz Error: ${errMsg}`);
    }
  }
};