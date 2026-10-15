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
  return `–  *T R I V I A  Q U I Z*

┌  ◦  *Topic* : ${(session.topic || "General").toUpperCase()}
│  ◦  *Progress* : ${qNum} / ${totalQ}
│  ◦  *Timeout* : ${QUESTION_TIMEOUT}s
└  ◦  *Reward* : +Rp 2.500 | +100 EXP

–  *Q U E S T I O N*

${q.question}

–  *O P T I O N S*

┌  ◦  *A.* ${q.optionA}
│  ◦  *B.* ${q.optionB}
│  ◦  *C.* ${q.optionC}
└  ◦  *D.* ${q.optionD}

Pilih opsi dari menu di bawah atau ketik langsung huruf jawabanmu (A/B/C/D).`;
}
async function sendTopicSelectionMenu(sock, ctx, chatId, quotedMsg, prefix = ".") {
  const botName = global.bot?.name || "WudysoftBot";
  const botFooter = global.bot?.footer || `${botName} • Trivia Maker`;
  const bannerImage = global.bot?.media?.banner1 || global.bot?.media?.banner2 || "https://files.catbox.moe/g2e6i5.jpg";
  const senderNum = (ctx.sender || "").split("@")[0];
  const topicRows = PRESET_TOPICS.map(t => ({
    title: t.name,
    id: `${prefix}trivia ${t.id}`,
    description: t.desc
  }));
  const bodyText = `Hi @${senderNum}!
Silakan tentukan topik kuis trivia yang ingin kamu mainkan bersama anggota grup.

–  *T O P I C*

┌  ◦  *Format* : ${prefix}trivia <topik>
└  ◦  *Example* : ${prefix}trivia Marvel

Pilih salah satu topik populer melalui menu di bawah atau ketik manual topik kustommu.`;
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
    params: {
      bottom_sheet: {
        in_thread_buttons_limit: 1,
        divider_indices: [1],
        list_title: `${botName} • Pilihan Topik`,
        button_title: "Pilih Topik"
      }
    },
    contextInfo: {
      mentionedJid: [ctx.sender],
      forwardingScore: 0,
      isForwarded: false
    },
    quoted: quotedMsg || undefined
  };
  if (typeof ctx?.sendCta === "function" && chatId === ctx.id) {
    return await ctx.sendCta(bodyText, botFooter, buttons, options);
  }
  let listFallback = `${bodyText}\n\n–  *A V A I L A B L E  T O P I C S*\n\n`;
  PRESET_TOPICS.forEach((t, i) => {
    const isLast = i === PRESET_TOPICS.length - 1;
    const branch = isLast ? "└" : "│";
    listFallback += `${branch}  ◦  *${t.name}* (${prefix}trivia ${t.id})\n`;
  });
  return await sock.sendMessage(chatId, {
    text: listFallback.trim(),
    mentions: [ctx.sender]
  }, {
    quoted: quotedMsg
  });
}
async function sendTriviaCtaMessage(sock, ctx, chatId, session, quotedMsg, prefix = ".") {
  const botName = global.bot?.name || "WudysoftBot";
  const botFooter = global.bot?.footer || `${botName} • Mini Games`;
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
  const bannerImage = global.bot?.media?.banner1 || global.bot?.media?.banner2 || "https://files.catbox.moe/g2e6i5.jpg";
  const options = {
    image: bannerImage,
    params: {
      bottom_sheet: {
        in_thread_buttons_limit: 1,
        divider_indices: [1],
        list_title: `${botName} • Trivia Quiz`,
        button_title: "Jawab Kuis"
      },
      limited_time_offer: {
        text: `⏳ Sisa Waktu: ${QUESTION_TIMEOUT} Detik`,
        url: "",
        copy_code: "",
        expiration_time: Date.now() + QUESTION_TIMEOUT * 1e3
      }
    },
    contextInfo: {
      forwardingScore: 0,
      isForwarded: false
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
      sentMsg = await sock.sendMessage(chatId, {
        viewOnceMessage: {
          message: {
            interactiveMessage: {
              header: {
                hasMediaAttachment: true,
                imageMessage: {
                  url: bannerImage
                }
              },
              body: {
                text: bodyText
              },
              footer: {
                text: botFooter
              },
              nativeFlowMessage: {
                buttons: buttons.map(b => ({
                  name: b.name,
                  buttonParamsJson: b.buttonParamsJson
                }))
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
      image: {
        url: bannerImage
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
    const scoreboard = `–  *S C O R E B O A R D*

Permainan kuis trivia telah selesai.

${scoreRows}
Terima kasih telah berpartisipasi. Ketik *${prefix}trivia <topik>* untuk bermain lagi.`;
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
      const timeoutMsg = `–  *T I M E  O U T*

Waktu menjawab kuis telah habis.

┌  ◦  *Question* : Soal #${activeSession.currentIndex + 1}
└  ◦  *Answer* : [${correctLtr}] ${currentQ.correctAnswer}

Melanjutkan ke soal berikutnya...`;
      await sock.sendMessage(chatId, {
        text: timeoutMsg
      });
      await nextTriviaQuestion(sock, ctx, chatId, activeSession, prefix);
    }
  }, QUESTION_TIMEOUT * 1e3);
  await sendTriviaCtaMessage(sock, ctx, chatId, session, null, prefix);
}
export default {
  name: "trivia",
  aliases: ["triviakuis", "kuistrivia", "triviamaker", "quiz"],
  description: "Game kuis trivia pilihan ganda interaktif dengan CTA List UI & seleksi topik (Full DB)",
  category: "Game",
  limit: true,
  example: "trivia tech\ntrivia anime\ntrivia history\ntrivia science",
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
      if (Date.now() > session.expireTime) {
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
      const currentQ = session.questions[session.currentIndex];
      const correctLetter = getCorrectLetter(currentQ);
      const correctText = normalizeText(currentQ.correctAnswer);
      const isCorrect = cleanInput === correctLetter.toLowerCase() || cleanInput === correctText || cleanInput.length >= 4 && correctText.includes(cleanInput);
      const senderName = ctx?.pushName || ctx?.pushname || "Pemain";
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
        const winNotif = `–  *C O R R E C T*

Jawaban *[ ${correctLetter} ] ${currentQ.correctAnswer}* benar!
Dijawab oleh @${senderJid.split("@")[0]} (+Rp 2.500 | +100 EXP)`;
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
        const wrongNotif = `–  *W R O N G*

Jawaban *"${userText}"* salah. Silakan coba pilih opsi lain.`;
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
          const surrenderMsg = `–  *S U R R E N D E R*

Kuis trivia telah dihentikan.

┌  ◦  *Question* : Soal #${session.currentIndex + 1}
│  ◦  *Answer* : [${correctLtr}] ${currentQ.correctAnswer}
└  ◦  *Status* : Permainan berakhir`;
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
        return await sendTriviaCtaMessage(sock, ctx, chatId, session, quotedMsg, prefix);
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
        return ctx.reply(`❌ Gagal memuat kuis trivia untuk topik "${topic}".\nKetik *${prefix}trivia* untuk melihat daftar topik yang tersedia.`);
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
          const timeoutMsg = `–  *T I M E  O U T*

Waktu menjawab kuis telah habis.

┌  ◦  *Question* : Soal #${activeSession.currentIndex + 1}
└  ◦  *Answer* : [${correctLtr}] ${currentQ.correctAnswer}

Melanjutkan ke soal berikutnya...`;
          await sock.sendMessage(chatId, {
            text: timeoutMsg
          });
          await nextTriviaQuestion(sock, ctx, chatId, activeSession, prefix);
        }
      }, QUESTION_TIMEOUT * 1e3);
      await sendTriviaCtaMessage(sock, ctx, chatId, global.db.trivia[chatId], quotedMsg, prefix);
      await ctx.react("🧠");
    } catch (error) {
      console.error("[Trivia Execute Error]:", error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Trivia Game Error: ${errMsg}`);
    }
  }
};