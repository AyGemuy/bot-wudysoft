import axios from "axios";
import db from "../../data/db.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/game/lengkapi-kalimat`;

function initDB(jid = null, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.lengkapiKalimat) global.db.lengkapiKalimat = {};
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

function generateClue(answer) {
  const chars = answer.trim().split("");
  return chars.map((c, i) => {
    if (c === " ") return "   ";
    if (i === 0 || i === chars.length - 1) return `*${c.toUpperCase()}*`;
    return "•";
  }).join(" ");
}
async function sendLengkapiKalimatMessage(sock, ctx, chatId, session, textContent, quotedMsg, prefix = ".") {
  const botName = global.bot?.name || "WudysoftBot";
  const footerText = `${global.bot?.footer || botName}`;
  const buttons = [{
    name: "quick_reply",
    buttonParamsJson: JSON.stringify({
      display_text: "💡 Bantuan Clue",
      id: `${prefix}lengkapi --clue`
    })
  }, {
    name: "quick_reply",
    buttonParamsJson: JSON.stringify({
      display_text: "🏳️ Menyerah",
      id: `${prefix}lengkapi --nyerah`
    })
  }];
  const options = {
    jid: chatId,
    to: chatId,
    params: {
      bottom_sheet: {
        in_thread_buttons_limit: 2,
        divider_indices: [1],
        list_title: `${botName} • Lengkapi Kalimat`,
        button_title: "Menu Bantuan"
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
      sentMsg = await ctx.sendCta(textContent, footerText, buttons, options);
    } catch (e) {
      console.error("[Lengkapi Kalimat sendCta Error]:", e.message);
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
      text: `${textContent}\n\n_${footerText}_`
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
  name: "lengkapikalimat",
  aliases: ["lengkapi", "lengkap", "tebakkalimat", "peribahasa"],
  description: "Game melengkapi kalimat rumpang dan peribahasa Indonesia dengan hadiah DB (Full DB)",
  category: "Game",
  limit: true,
  example: "lengkapikalimat",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const chatId = ctx?.id || msg?.key?.remoteJid;
      if (!chatId) return;
      initDB();
      if (!global.db.lengkapiKalimat[chatId]) return;
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      const session = global.db.lengkapiKalimat[chatId];
      if (Date.now() > session.expireTime) {
        delete global.db.lengkapiKalimat[chatId];
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
      const cleanAnswer = normalizeText(session.jawaban);
      if (!cleanUser) return;
      if (cleanUser === cleanAnswer) {
        delete global.db.lengkapiKalimat[chatId];
        const senderJid = ctx?.sender || msg?.key?.participant;
        const senderName = ctx?.pushName || ctx?.pushname || "Pemain";
        if (senderJid) {
          initDB(senderJid, senderName);
          global.db.user[senderJid].money = (Number(global.db.user[senderJid].money) || 0) + 3500;
          global.db.user[senderJid].exp = (Number(global.db.user[senderJid].exp) || 0) + 100;
        }
        saveDB();
        const completedSentence = session.pertanyaan.replace(/_{2,}/g, `*${session.jawaban.toUpperCase()}*`);
        const winText = `–  *C O N G R A T U L A T I O N S*

Tebakan kata Anda benar!

┌  ◦  *Player* : @${senderJid.split("@")[0]}
│  ◦  *Answer* : ${session.jawaban.toUpperCase()}
└  ◦  *Reward* : +Rp 3.500 | +100 EXP

–  *S E N T E N C E*

"${completedSentence}"`;
        if (typeof ctx?.react === "function") await ctx.react("🎉");
        await sock.sendMessage(chatId, {
          text: winText,
          mentions: [senderJid]
        }, {
          quoted: msg
        });
        return true;
      } else {
        if (typeof ctx?.react === "function") await ctx.react("❌");
        const wrongText = `–  *W R O N G*

Kata *"${userText}"* tidak tepat untuk melengkapi kalimat tersebut. Silakan coba lagi.`;
        await sock.sendMessage(chatId, {
          text: wrongText
        }, {
          quoted: msg
        });
        return true;
      }
    } catch (e) {
      console.error("[LENGKAPI KALIMAT BEFORE ERROR]:", e.message);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      const isGroup = Boolean(ctx?.isGroup || ctx?.id?.endsWith("@g.us"));
      if (!isGroup) {
        return ctx.reply("❌ Fitur Lengkapi Kalimat hanya dapat dimainkan di dalam Grup.");
      }
      const rawText = (ctx.query || ctx.text || "").trim().toLowerCase();
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const chatId = ctx.id;
      initDB();
      if (rawText.includes("nyerah") || rawText.includes("surrender") || rawText.includes("end") || rawText.includes("batal")) {
        if (global.db.lengkapiKalimat[chatId]) {
          const session = global.db.lengkapiKalimat[chatId];
          const completedSentence = session.pertanyaan.replace(/_{2,}/g, `*${session.jawaban.toUpperCase()}*`);
          delete global.db.lengkapiKalimat[chatId];
          saveDB();
          const surrenderText = `–  *S U R R E N D E R*

Permainan telah dihentikan.

┌  ◦  *Answer* : ${session.jawaban.toUpperCase()}
└  ◦  *Sentence* : "${completedSentence}"`;
          return await sock.sendMessage(chatId, {
            text: surrenderText
          }, {
            quoted: quotedMsg
          });
        }
        return ctx.reply("❌ Tidak ada sesi Lengkapi Kalimat yang sedang aktif di grup ini.");
      }
      if (rawText.includes("clue") || rawText.includes("bantuan") || rawText.includes("hint")) {
        if (!global.db.lengkapiKalimat[chatId]) {
          return ctx.reply(`❌ Tidak ada game aktif. Mulai game baru dengan mengetik *${prefix}lengkapikalimat*`);
        }
        const session = global.db.lengkapiKalimat[chatId];
        const clueText = generateClue(session.jawaban);
        const clueMsg = `–  *H I N T*

┌  ◦  *Question* : "${session.pertanyaan}"
└  ◦  *Clue* : [ ${clueText} ] (${session.jawaban.length} Karakter)

Balas (reply) pesan ini langsung untuk melengkapi kata.`;
        return await sendLengkapiKalimatMessage(sock, ctx, chatId, session, clueMsg, quotedMsg, prefix);
      }
      if (global.db.lengkapiKalimat[chatId]) {
        const session = global.db.lengkapiKalimat[chatId];
        const clueText = generateClue(session.jawaban);
        const activeMsg = `–  *A C T I V E  G A M E*

Masih ada permainan Lengkapi Kalimat yang sedang berlangsung.

┌  ◦  *Question* : "${session.pertanyaan}"
└  ◦  *Clue* : [ ${clueText} ] (${session.jawaban.length} Karakter)

Balas (reply) pesan ini langsung untuk melengkapi kata.`;
        return await sendLengkapiKalimatMessage(sock, ctx, chatId, session, activeMsg, quotedMsg, prefix);
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
      if (!data || !data.pertanyaan || !data.jawaban) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal memuat kuis Lengkapi Kalimat dari server. Silakan coba lagi.");
      }
      const TIMEOUT_SECONDS = 120;
      global.db.lengkapiKalimat[chatId] = {
        pertanyaan: String(data.pertanyaan).trim(),
        jawaban: String(data.jawaban).trim(),
        msgIds: [],
        questionMsgId: null,
        startTime: Date.now(),
        expireTime: Date.now() + TIMEOUT_SECONDS * 1e3
      };
      saveDB();
      setTimeout(async () => {
        initDB();
        if (global.db.lengkapiKalimat[chatId] && Date.now() >= global.db.lengkapiKalimat[chatId].expireTime) {
          const activeSession = global.db.lengkapiKalimat[chatId];
          const completed = activeSession.pertanyaan.replace(/_{2,}/g, `*${activeSession.jawaban.toUpperCase()}*`);
          delete global.db.lengkapiKalimat[chatId];
          saveDB();
          const timeoutText = `–  *T I M E  O U T*

Waktu menjawab kuis telah habis.

┌  ◦  *Answer* : ${activeSession.jawaban.toUpperCase()}
└  ◦  *Sentence* : "${completed}"`;
          await sock.sendMessage(chatId, {
            text: timeoutText
          });
        }
      }, TIMEOUT_SECONDS * 1e3);
      const clueText = generateClue(global.db.lengkapiKalimat[chatId].jawaban);
      const questionMsg = `–  *L E N G K A P I  K A L I M A T*

Lengkapilah bagian rumpang pada kalimat atau peribahasa berikut.

–  *Q U E S T I O N*

"${global.db.lengkapiKalimat[chatId].pertanyaan}"

–  *I N F O*

┌  ◦  *Clue* : [ ${clueText} ] (${global.db.lengkapiKalimat[chatId].jawaban.length} Karakter)
│  ◦  *Timeout* : ${TIMEOUT_SECONDS}s
└  ◦  *Reward* : +Rp 3.500 | +100 EXP

Balas (reply) pesan ini langsung dengan kata yang tepat.`;
      await sendLengkapiKalimatMessage(sock, ctx, chatId, global.db.lengkapiKalimat[chatId], questionMsg, quotedMsg, prefix);
      await ctx.react("🤔");
    } catch (error) {
      console.error("[Lengkapi Kalimat Error]:", error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Lengkapi Kalimat Error: ${errMsg}`);
    }
  }
};