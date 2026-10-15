import axios from "axios";
import db from "../../data/db.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/fun/kahoot`;

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
  const prefix = ctx.prefix || ".";
  const botName = global.bot?.name || "WudysoftBot";
  const botFooter = global.bot?.footer || `${botName} • Mini Games`;
  const q = session.questions[session.currentIndex];
  const qIndex = session.currentIndex + 1;
  const totalQ = session.questions.length;
  const timeoutSec = Math.max(Math.round((q.time || 3e4) / 1e3), 20);
  const questionTitle = cleanHtml(q.question || q.title || "Pertanyaan Kuis");
  const choices = (q.choices || []).map(c => ({
    answer: cleanHtml(c.answer),
    correct: Boolean(c.correct)
  }));
  const letters = ["A", "B", "C", "D", "E", "F"];
  const choiceRows = [];
  const choiceText = choices.map((c, idx) => {
    const isLast = idx === choices.length - 1;
    const branch = isLast ? "└" : "│";
    const label = letters[idx] || `${idx + 1}`;
    choiceRows.push({
      title: `[ ${label} ] ${c.answer.slice(0, 24)}`,
      id: `${prefix}kahootgame ${label}`,
      description: `Pilih opsi [${label}]: ${c.answer.slice(0, 60)}`
    });
    return `${branch}  ◦  *${label}.* ${c.answer}`;
  }).join("\n");
  const bodyText = `–  *K A H O O T  Q U I Z*

┌  ◦  *Quiz* : ${session.quizTitle}
│  ◦  *Progress* : Soal ${qIndex} / ${totalQ}
│  ◦  *Score* : ${session.score} Poin
└  ◦  *Timeout* : ${timeoutSec}s

–  *Q U E S T I O N*

${questionTitle}

–  *O P T I O N S*

${choiceText}

Pilih opsi dari menu di bawah atau ketik langsung huruf (A/B/C/D).`;
  const footerText = `${botFooter}`;
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
  const mediaUrl = q.image || q.media?.[0]?.url || session.coverUrl || null;
  session.expireTime = Date.now() + timeoutSec * 1e3;
  saveDB();
  setTimeout(async () => {
    initDB();
    const activeSession = global.db.kahoot[chatId];
    if (activeSession && Date.now() >= activeSession.expireTime) {
      const currentQ = activeSession.questions[activeSession.currentIndex];
      const correctChoice = currentQ?.choices?.find(c => c.correct === true);
      const correctAnsText = correctChoice ? cleanHtml(correctChoice.answer) : "-";
      const timeoutMsg = `–  *T I M E  O U T*

Waktu menjawab untuk Soal #${qIndex} telah habis.

┌  ◦  *Question* : Soal #${qIndex}
└  ◦  *Answer* : ${correctAnsText}`;
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
        const gameOverMsg = `–  *G A M E  O V E R*

Permainan kuis Kahoot telah selesai!

┌  ◦  *Final Score* : ${finalScore} / ${totalMax} Poin
└  ◦  *Accuracy* : ${Math.round(finalScore / totalMax * 100)}%`;
        await sock.sendMessage(chatId, {
          text: gameOverMsg
        });
      }
    }
  }, timeoutSec * 1e3);
  const options = {
    title: `✦ Kahoot Quiz • Soal #${qIndex}/${totalQ} ✦`,
    subtitle: `Score: ${session.score} Poin`,
    media: mediaUrl,
    quoted: quotedMsg
  };
  if (typeof ctx.sendCta === "function") {
    await ctx.sendCta(bodyText, footerText, buttons, options);
  } else if (mediaUrl) {
    await sock.sendMessage(chatId, {
      image: {
        url: mediaUrl
      },
      caption: bodyText
    }, {
      quoted: quotedMsg
    });
  } else {
    await sock.sendMessage(chatId, {
      text: bodyText
    }, {
      quoted: quotedMsg
    });
  }
}
export default {
  name: "kahootgame",
  aliases: ["kgame", "kahoot-game", "kuiskahoot", "kahootplay"],
  description: "Bermain kuis interaktif Kahoot Full Button / Dropdown tanpa banyak mengetik (Full DB)",
  category: "Game",
  limit: true,
  example: "kahootgame Phonics atau kahootgame Anime",
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
      const senderName = ctx?.pushname || "Pemain";
      if (isCorrect) {
        session.score += 100;
        if (senderJid) {
          initDB(senderJid, senderName);
          global.db.user[senderJid].exp = (global.db.user[senderJid].exp || 0) + 150;
        }
        if (typeof ctx?.react === "function") await ctx.react("🎉");
        const correctMsg = `–  *C O R R E C T*

Jawaban Anda benar! (+150 EXP)

┌  ◦  *Answer* : ${cleanHtml(chosenChoice.answer)}
└  ◦  *Score* : ${session.score} Poin`;
        await sock.sendMessage(chatId, {
          text: correctMsg
        }, {
          quoted: msg
        });
      } else {
        if (typeof ctx?.react === "function") await ctx.react("❌");
        const wrongMsg = `–  *W R O N G*

Pilihan Anda tidak tepat.

┌  ◦  *Your Answer* : ${cleanHtml(chosenChoice.answer)}
└  ◦  *Key* : ${correctAnsText}`;
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
        const finishMsg = `–  *G A M E  O V E R*

Permainan kuis Kahoot telah selesai!

┌  ◦  *Player* : ${senderName}
│  ◦  *Final Score* : ${finalScore} / ${totalMax} Poin
└  ◦  *Accuracy* : ${Math.round(finalScore / totalMax * 100)}%`;
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
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const chatId = ctx.id;
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • Mini Games`;
      initDB();
      if (global.db.kahoot[chatId]) {
        const session = global.db.kahoot[chatId];
        if (rawText.includes("--nyerah") || rawText.includes("nyerah")) {
          const score = session.score;
          delete global.db.kahoot[chatId];
          saveDB();
          const surrenderMsg = `–  *S U R R E N D E R*

Permainan kuis Kahoot telah dihentikan.
Skor akhir: ${score} Poin.`;
          return ctx.reply(surrenderMsg);
        }
        if (rawText.includes("--skip") || rawText.includes("skip")) {
          session.currentIndex++;
          if (session.currentIndex < session.questions.length) {
            saveDB();
            await ctx.reply(`–  *S K I P P E D*

Soal dilewati, memuat soal berikutnya...`);
            await sendKahootQuestion(sock, ctx, chatId, session, quotedMsg);
          } else {
            const finalScore = session.score;
            delete global.db.kahoot[chatId];
            saveDB();
            return ctx.reply(`–  *G A M E  O V E R*

Permainan selesai. Skor akhir: ${finalScore} Poin.`);
          }
          return;
        }
      }
      if (!rawText) {
        return ctx.reply(`–  *K A H O O T  G A M E*

Silakan tentukan topik kuis Kahoot yang ingin dimainkan.

┌  ◦  *Format* : ${prefix}kahootgame <topik>
│  ◦  *Example* : ${prefix}kahootgame Anime
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
        const selectBodyText = `–  *S E A R C H  R E S U L T*

┌  ◦  *Query* : ${rawText}
└  ◦  *Found* : ${entities.length} Kuis

Pilih salah satu kuis Kahoot melalui menu di bawah untuk mulai bermain.`;
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
        return await ctx.sendCta(selectBodyText, botFooter, selectButtons, {
          title: `✦ Kahoot Search • ${rawText} ✦`,
          subtitle: `Ditemukan: ${entities.length} Kuis`,
          media: coverMedia,
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
        return ctx.reply("❌ Gagal memuat soal kuis dari server. Coba pilih kuis lainnya.");
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