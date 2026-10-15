import axios from "axios";
import db from "../../data/db.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/game/anime-quiz`;
const DEFAULT_TIMEOUT = 30;

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
  return `–  *A N I M E  Q U I Z*

Tebak nama karakter anime pada gambar di atas.

–  *I N F O*

┌  ◦  *Question* : #${qNum} (Level ${stats.level || 1})
│  ◦  *Lives* : ${hearts} (${livesCount}/3)
│  ◦  *Score* : ${stats.score || "00000"} Poin
│  ◦  *Timeout* : ${session.data.time_limit || DEFAULT_TIMEOUT}s
└  ◦  *Reward* : +Rp 3.000 | +150 EXP

–  *O P T I O N S*

${choiceText}

Pilih opsi dari menu di bawah atau balas chat dengan huruf A/B/C/D.`;
}
async function sendAnimeQuizMessage(sock, ctx, chatId, session, quotedMsg, prefix = ".") {
  const botName = global.bot?.name || "WudysoftBot";
  const botFooter = global.bot?.footer || `${botName} • Mini Games`;
  const choices = session.data.quiz?.choices || [];
  const qNum = session.data.question_number || 1;
  const imageUrl = session.data.quiz?.image || "https://files.catbox.moe/g2e6i5.jpg";
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
  const options = {
    image: imageUrl,
    params: {
      bottom_sheet: {
        in_thread_buttons_limit: 1,
        divider_indices: [1],
        list_title: `${botName} • Anime Quiz`,
        button_title: "Pilih Karakter"
      },
      limited_time_offer: {
        text: `⏳ Sisa Waktu: ${session.data.time_limit || DEFAULT_TIMEOUT} Detik`,
        url: "",
        copy_code: "",
        expiration_time: Date.now() + (session.data.time_limit || DEFAULT_TIMEOUT) * 1e3
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
      console.error("[AnimeQuiz sendCta Error]:", e.message);
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
                  url: imageUrl
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
        url: imageUrl
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
  description: "Game tebak gambar karakter & anime interaktif dengan sistem nyawa dan level (Full DB)",
  category: "Game",
  limit: true,
  example: "animequiz\nanimequiz --nyerah",
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
      const senderName = ctx?.pushName || ctx?.pushname || "Pemain";
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
        const winNotif = `–  *C O R R E C T*

Tebakan Anda benar! (+Rp 3.000 | +150 EXP)

┌  ◦  *Character* : ${chosenItem.name}
│  ◦  *Anime* : ${chosenItem.anime}
│  ◦  *Player* : @${senderJid.split("@")[0]}
└  ◦  *Score* : +${resultData.stats?.added_score || 100} Poin

Memuat soal berikutnya...`;
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
            const timeoutText = `–  *T I M E  O U T*

Waktu menjawab Anime Quiz telah habis karena tidak ada jawaban.`;
            await sock.sendMessage(chatId, {
              text: timeoutText
            });
          }
        }, timeLimit * 1e3);
        await sendAnimeQuizMessage(sock, ctx, chatId, session, msg, ctx?.prefix || ".");
        return true;
      }
      if (resultData?.is_correct === false || resultData?.stats?.lives === 0) {
        if (typeof ctx?.react === "function") await ctx.react("❌");
        const remainingLives = resultData?.stats?.lives ?? 0;
        if (remainingLives <= 0) {
          delete global.db.animeQuiz[chatId];
          saveDB();
          const gameOverText = `–  *G A M E  O V E R*

Nyawa Anda telah habis!

┌  ◦  *Final Score* : ${resultData?.stats?.score || session.data.stats?.score || "0"} Poin
└  ◦  *Final Level* : Level ${resultData?.stats?.level || session.data.stats?.level || 1}

Ketik *${ctx?.prefix || "."}animequiz* untuk memulai game baru.`;
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
        const wrongText = `–  *W R O N G*

Tebakan *"${chosenItem.name}"* kurang tepat.
Sisa Nyawa: ❤️ *${remainingLives}/3*

Silakan coba tebak pilihan lainnya.`;
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
            const timeoutText = `–  *T I M E  O U T*

Waktu menjawab Anime Quiz telah habis.`;
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
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const chatId = ctx.id;
      initDB();
      if (rawText.includes("nyerah") || rawText.includes("surrender") || rawText.includes("end") || rawText.includes("stop")) {
        if (global.db.animeQuiz[chatId]) {
          delete global.db.animeQuiz[chatId];
          saveDB();
          const surrenderMsg = `–  *S U R R E N D E R*

Permainan Anime Quiz telah dihentikan.`;
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
        return await sendAnimeQuizMessage(sock, ctx, chatId, session, quotedMsg, prefix);
      }
      await ctx.react("⏳");
      const initialData = await callAnimeQuizApi();
      if (!initialData?.quiz?.choices || !initialData.quiz?.image) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal memuat data Anime Quiz dari server. Silakan coba beberapa saat lagi.");
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
          const timeoutText = `–  *T I M E  O U T*

Waktu menjawab Anime Quiz telah habis karena tidak ada jawaban.`;
          await sock.sendMessage(chatId, {
            text: timeoutText
          });
        }
      }, timeLimit * 1e3);
      await sendAnimeQuizMessage(sock, ctx, chatId, global.db.animeQuiz[chatId], quotedMsg, prefix);
      await ctx.react("🎌");
    } catch (error) {
      console.error("[Anime Quiz Execute Error]:", error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Anime Quiz Error: ${errMsg}`);
    }
  }
};