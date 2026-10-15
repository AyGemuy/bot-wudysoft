import axios from "axios";
import db from "../../data/db.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/game/tebak-lagu/v2`;

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
  description: "Game kuis tebak judul lagu dari potongan audio dengan pilihan ganda (Full DB)",
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
      if (!isReplyingToQuiz) {
        return;
      }
      const userText = (ctx?.text || ctx?.query || msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "").trim();
      const prefixList = [".", "#", "!", "/", ctx?.prefix].filter(Boolean);
      if (prefixList.some(p => userText.startsWith(p))) return;
      const cleanUser = normalizeText(userText);
      const correctKey = normalizeText(session.key);
      const correctAnswer = normalizeText(session.answer);
      const isCorrect = cleanUser === correctKey || cleanUser === `opsi ${correctKey}` || cleanUser === `pilihan ${correctKey}` || cleanUser === correctAnswer || cleanUser.includes(correctAnswer) || correctAnswer.includes(cleanUser) && cleanUser.length >= 4;
      if (isCorrect) {
        const duration = ((Date.now() - session.startTime) / 1e3).toFixed(1);
        const senderName = ctx?.pushname || "Pemain";
        const senderJid = ctx?.sender;
        delete global.db.tebakLagu[chatId];
        if (senderJid) {
          initDB(senderJid, senderName);
          global.db.user[senderJid].exp = (global.db.user[senderJid].exp || 0) + 300;
        }
        saveDB();
        const winMessage = `–  *C O N G R A T U L A T I O N S*

Tebakan Anda tepat sekali!

┌  ◦  *Player* : ${senderName}
│  ◦  *Song* : ${session.answer} (Opsi ${session.key})
│  ◦  *Duration* : ${duration}s
└  ◦  *Reward* : +300 EXP`;
        await sock.sendMessage(chatId, {
          text: winMessage
        }, {
          quoted: msg
        });
        if (typeof ctx?.react === "function") await ctx.react("🎉");
        return true;
      } else {
        if (typeof ctx?.react === "function") await ctx.react("❌");
        const wrongMessage = `–  *W R O N G*

Jawaban *"${userText}"* salah. Silakan dengarkan kembali dan coba tebak lagi.`;
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
      const botFooter = global.bot?.footer || `${botName} • Mini Games`;
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
          const hintBody = `–  *H I N T*

┌  ◦  *Clue* : ${session.clue}
└  ◦  *Desc* : Dengarkan potongan audio yang dikirim untuk mencocokkan lirik atau nadanya.`;
          return await ctx.sendCta(hintBody, botFooter, hintButtons, {
            title: `✦ Tebak Lagu • Hint ✦`,
            quoted: quotedMsg
          });
        }
        if (rawText.includes("--nyerah") || rawText.includes("--surrender") || rawText.includes("nyerah")) {
          const answer = session.answer;
          const key = session.key;
          delete global.db.tebakLagu[chatId];
          saveDB();
          const surrenderText = `–  *S U R R E N D E R*

Permainan Tebak Lagu telah dihentikan.

┌  ◦  *Answer* : ${answer}
└  ◦  *Option* : Opsi ${key}`;
          return await sock.sendMessage(chatId, {
            text: surrenderText
          }, {
            quoted: quotedMsg
          });
        }
        const activeWarningBody = `–  *A C T I V E  G A M E*

Masih ada permainan Tebak Lagu yang sedang berlangsung.

┌  ◦  *Clue* : ${session.clue}
└  ◦  *Action* : Reply pesan soal atau audio dengan opsi A/B/C/D

Gunakan tombol di bawah jika butuh petunjuk atau ingin menyerah.`;
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
          title: `✦ Tebak Lagu ✦`,
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
      const bodyText = `–  *T E B A K  L A G U*

Dengarkan potongan audio yang dikirim dan tentukan judul lagu yang tepat.

–  *O P T I O N S*

┌  ◦  *A.* ${options.A || "-"}
│  ◦  *B.* ${options.B || "-"}
│  ◦  *C.* ${options.C || "-"}
└  ◦  *D.* ${options.D || "-"}

–  *I N F O*

┌  ◦  *Clue* : ${underlineClue}
│  ◦  *Timeout* : ${TIMEOUT_SECONDS}s
└  ◦  *Reward* : +300 EXP

Balas (reply) pesan soal atau audio ini dengan huruf A, B, C, atau D.`;
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
      const sentMsg = await ctx.sendCta(bodyText, botFooter, buttons, {
        title: `✦ ${botName} • Tebak Lagu ✦`,
        subtitle: `Timeout: ${TIMEOUT_SECONDS}s`,
        quoted: quotedMsg
      });
      const questionMsgId = sentMsg?.key?.id;
      const audioBuffer = await fetchAudioBuffer(rawAudioUrl);
      let sentAudioMsg = null;
      if (audioBuffer) {
        sentAudioMsg = await sock.sendMessage(chatId, {
          audio: audioBuffer,
          mimetype: "audio/mp4",
          ptt: true
        }, {
          quoted: sentMsg
        });
      }
      global.db.tebakLagu[chatId] = {
        questionMsgId: questionMsgId,
        audioMsgId: sentAudioMsg?.key?.id || null,
        answer: answer.trim(),
        key: correctKey.trim(),
        clue: underlineClue,
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
          const timeoutMsg = `–  *T I M E  O U T*

Waktu menjawab kuis tebak lagu telah habis.

┌  ◦  *Answer* : ${current.answer}
└  ◦  *Option* : Opsi ${current.key}`;
          await sock.sendMessage(chatId, {
            text: timeoutMsg
          });
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