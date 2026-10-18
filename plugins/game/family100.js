import axios from "axios";
import db from "../../data/db.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/game/family100`;

function initDB(jid = null, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.family100) global.db.family100 = {};
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

function formatFamily100Board(session) {
  const totalFound = session.terjawab.filter(Boolean).length;
  const totalAnswers = session.jawaban.length;
  let text = `–  *F A M I L Y  1 0 0*

┌  ◦  *Question* : ${session.soal}
│  ◦  *Progress* : ${totalFound} / ${totalAnswers} Terjawab
└  ◦  *Reward* : +Rp 3.000 | +150 EXP

–  *B O A R D*\n\n`;
  session.jawaban.forEach((ans, idx) => {
    const isLast = idx === totalAnswers - 1;
    const branch = isLast ? "└" : "│";
    const found = session.terjawab[idx];
    if (found) {
      const username = found.jid ? `@${found.jid.split("@")[0]}` : found.name;
      text += `${branch}  ◦  (${idx + 1}) *${ans.toUpperCase()}* ➔ ${username} ✅\n`;
    } else {
      const hidden = ans.replace(/[a-zA-Z0-9]/g, "- ");
      text += `${branch}  ◦  (${idx + 1}) [ ${hidden.trim()} ]\n`;
    }
  });
  text += `\nBalas (reply) pesan ini dengan tebakanmu untuk menjawab.`;
  return text;
}
async function sendFamily100Message(sock, ctx, chatId, session, textContent, quotedMsg, prefix = ".") {
  const botName = global.bot?.name || "WudysoftBot";
  const footerText = `${global.bot?.footer || botName}`;
  const mentions = [...new Set((session.terjawab || []).filter(Boolean).map(t => t.jid).filter(Boolean))];
  const buttons = [{
    name: "quick_reply",
    buttonParamsJson: JSON.stringify({
      display_text: "📋 Lihat Papan",
      id: `${prefix}family100 --papan`
    })
  }, {
    name: "quick_reply",
    buttonParamsJson: JSON.stringify({
      display_text: "🏳️ Menyerah",
      id: `${prefix}family100 --nyerah`
    })
  }];
  const options = {
    jid: chatId,
    to: chatId,
    params: {
      bottom_sheet: {
        in_thread_buttons_limit: 2,
        divider_indices: [1],
        list_title: `${botName} • Family 100`,
        button_title: "Menu Kuis"
      }
    },
    contextInfo: {
      forwardingScore: 0,
      isForwarded: false,
      mentionedJid: mentions
    },
    quoted: quotedMsg || undefined
  };
  let sentMsg = null;
  if (typeof ctx?.sendCta === "function" && chatId === ctx.id) {
    try {
      sentMsg = await ctx.sendCta(textContent, footerText, buttons, options);
    } catch (e) {
      console.error("[Family 100 sendCta Error]:", e.message);
    }
  }
  if (!sentMsg) {
    try {
      sentMsg = await sock.sendMessage(chatId, {
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
    sentMsg = await sock.sendMessage(chatId, {
      text: `${textContent}\n\n_${footerText}_`,
      mentions: mentions
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
  name: "family100",
  aliases: ["f100", "fam100", "survey100"],
  description: "Game survei Family 100 dengan papan tebakan multi-jawaban via API (Full DB)",
  category: "Game",
  limit: true,
  example: "family100",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const chatId = ctx?.id || msg?.key?.remoteJid;
      if (!chatId) return;
      initDB();
      if (!global.db.family100[chatId]) return;
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      const session = global.db.family100[chatId];
      if (Date.now() > session.expireTime) {
        delete global.db.family100[chatId];
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
      if (!cleanUser) return;
      const alreadyAnswered = session.jawaban.findIndex((ans, idx) => {
        return session.terjawab[idx] && normalizeText(ans) === cleanUser;
      });
      if (alreadyAnswered !== -1) {
        const answerer = session.terjawab[alreadyAnswered];
        if (typeof ctx?.react === "function") await ctx.react("⚠️");
        const alreadyText = `–  *A L R E A D Y  A N S W E R E D*

Jawaban *"${session.jawaban[alreadyAnswered].toUpperCase()}"* sudah pernah ditebak oleh @${answerer.jid.split("@")[0]}.`;
        await sock.sendMessage(chatId, {
          text: alreadyText,
          mentions: [answerer.jid]
        }, {
          quoted: msg
        });
        return true;
      }
      const answerIndex = session.jawaban.findIndex((ans, idx) => {
        if (session.terjawab[idx]) return false;
        const cleanAns = normalizeText(ans);
        return cleanAns === cleanUser || cleanAns.includes(cleanUser) && cleanUser.length >= 3;
      });
      if (answerIndex !== -1) {
        const matchedAnswer = session.jawaban[answerIndex];
        const senderName = ctx?.pushName || ctx?.pushname || "Pemain";
        const senderJid = ctx?.sender || msg?.key?.participant;
        session.terjawab[answerIndex] = {
          jawaban: matchedAnswer,
          jid: senderJid,
          name: senderName
        };
        if (senderJid) {
          initDB(senderJid, senderName);
          global.db.user[senderJid].exp = (Number(global.db.user[senderJid].exp) || 0) + 150;
          global.db.user[senderJid].money = (Number(global.db.user[senderJid].money) || 0) + 3e3;
        }
        saveDB();
        const totalFound = session.terjawab.filter(Boolean).length;
        const isAllFound = totalFound === session.jawaban.length;
        if (isAllFound) {
          const finalBoard = formatFamily100Board(session);
          const allWinners = session.terjawab.filter(Boolean).map(t => t.jid);
          delete global.db.family100[chatId];
          saveDB();
          const winText = `–  *C O N G R A T U L A T I O N S*

Semua jawaban survei berhasil ditebak dengan benar!

${finalBoard}

Permainan selesai. Terima kasih kepada seluruh pemain yang telah berpartisipasi.`;
          if (typeof ctx?.react === "function") await ctx.react("🎉");
          await sock.sendMessage(chatId, {
            text: winText,
            mentions: allWinners
          }, {
            quoted: msg
          });
          return true;
        }
        const updatedBoard = formatFamily100Board(session);
        const correctInfo = `–  *C O R R E C T*

Jawaban *[ ${matchedAnswer.toUpperCase()} ]* berhasil ditebak oleh @${senderJid.split("@")[0]}! (+Rp 3.000, +150 EXP)

${updatedBoard}`;
        if (typeof ctx?.react === "function") await ctx.react("✅");
        await sendFamily100Message(sock, ctx, chatId, session, correctInfo, msg, ctx?.prefix || ".");
        return true;
      } else {
        if (typeof ctx?.react === "function") await ctx.react("❌");
        const wrongText = `–  *W R O N G*

Jawaban *"${userText}"* salah atau tidak ada dalam survei ini.`;
        await sock.sendMessage(chatId, {
          text: wrongText
        }, {
          quoted: msg
        });
        return true;
      }
    } catch (e) {
      console.error("[FAMILY 100 BEFORE ERROR]:", e.message);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      const isGroup = Boolean(ctx?.isGroup || ctx?.id?.endsWith("@g.us"));
      if (!isGroup) {
        return ctx.reply("❌ Fitur Family 100 hanya dapat dimainkan di dalam Grup.");
      }
      const rawText = (ctx.query || ctx.text || "").trim().toLowerCase();
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const chatId = ctx.id;
      initDB();
      if (rawText.includes("nyerah") || rawText.includes("surrender") || rawText.includes("end") || rawText.includes("batal")) {
        if (global.db.family100[chatId]) {
          const session = global.db.family100[chatId];
          delete global.db.family100[chatId];
          saveDB();
          const totalAnswers = session.jawaban.length;
          let revealText = `–  *S U R R E N D E R*

Permainan Family 100 dihentikan oleh pemain.

┌  ◦  *Question* : ${session.soal}
└  ◦  *Total Answers* : ${totalAnswers}

–  *A N S W E R S*\n\n`;
          const mentions = [];
          session.jawaban.forEach((ans, idx) => {
            const isLast = idx === totalAnswers - 1;
            const branch = isLast ? "└" : "│";
            const found = session.terjawab[idx];
            if (found) {
              mentions.push(found.jid);
              revealText += `${branch}  ◦  (${idx + 1}) *${ans.toUpperCase()}* ➔ @${found.jid.split("@")[0]}\n`;
            } else {
              revealText += `${branch}  ◦  (${idx + 1}) *${ans.toUpperCase()}* ❌\n`;
            }
          });
          return await sock.sendMessage(chatId, {
            text: revealText.trim(),
            mentions: mentions
          }, {
            quoted: quotedMsg
          });
        }
        return ctx.reply("❌ Tidak ada sesi Family 100 yang sedang aktif di grup ini.");
      }
      if (rawText.includes("papan") || rawText.includes("board")) {
        if (!global.db.family100[chatId]) {
          return ctx.reply(`❌ Tidak ada game aktif. Mulai game baru dengan mengetik *${prefix}family100*`);
        }
        const session = global.db.family100[chatId];
        const boardText = formatFamily100Board(session);
        return await sendFamily100Message(sock, ctx, chatId, session, boardText, quotedMsg, prefix);
      }
      if (global.db.family100[chatId]) {
        const session = global.db.family100[chatId];
        const boardText = formatFamily100Board(session);
        return await sendFamily100Message(sock, ctx, chatId, session, `⚠️ Masih ada permainan Family 100 yang sedang berlangsung.\n\n` + boardText, quotedMsg, prefix);
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
      if (!data || !data.soal || !Array.isArray(data.jawaban) || data.jawaban.length === 0) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal memuat kuis Family 100 dari server. Silakan coba beberapa saat lagi.");
      }
      const TIMEOUT_SECONDS = 180;
      global.db.family100[chatId] = {
        soal: data.soal,
        jawaban: data.jawaban.map(j => String(j).trim()),
        terjawab: new Array(data.jawaban.length).fill(null),
        msgIds: [],
        questionMsgId: null,
        startTime: Date.now(),
        expireTime: Date.now() + TIMEOUT_SECONDS * 1e3
      };
      saveDB();
      setTimeout(async () => {
        initDB();
        if (global.db.family100[chatId] && Date.now() >= global.db.family100[chatId].expireTime) {
          const activeSession = global.db.family100[chatId];
          delete global.db.family100[chatId];
          saveDB();
          const totalAnswers = activeSession.jawaban.length;
          let timeoutText = `–  *T I M E  O U T*

Waktu menjawab Family 100 telah habis.

┌  ◦  *Question* : ${activeSession.soal}
└  ◦  *Total Answers* : ${totalAnswers}

–  *A N S W E R S*\n\n`;
          const mentions = [];
          activeSession.jawaban.forEach((ans, idx) => {
            const isLast = idx === totalAnswers - 1;
            const branch = isLast ? "└" : "│";
            const found = activeSession.terjawab[idx];
            if (found) {
              mentions.push(found.jid);
              timeoutText += `${branch}  ◦  (${idx + 1}) *${ans.toUpperCase()}* ➔ @${found.jid.split("@")[0]}\n`;
            } else {
              timeoutText += `${branch}  ◦  (${idx + 1}) *${ans.toUpperCase()}* ❌\n`;
            }
          });
          await sock.sendMessage(chatId, {
            text: timeoutText.trim(),
            mentions: mentions
          });
        }
      }, TIMEOUT_SECONDS * 1e3);
      const initialBoard = formatFamily100Board(global.db.family100[chatId]);
      await sendFamily100Message(sock, ctx, chatId, global.db.family100[chatId], initialBoard, quotedMsg, prefix);
      await ctx.react("👨‍👩‍👧‍👦");
    } catch (error) {
      console.error("[Family 100 Execute Error]:", error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Family 100 Error: ${errMsg}`);
    }
  }
};