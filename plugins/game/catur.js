import axios from "axios";
import db from "../../data/db.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/game/chess`;
const MOVE_REGEX = /^([a-h][1-8])[\s\-_/>to]*([a-h][1-8])(?:\s*([qrbn]))?$/i;

function initDB(jid = null, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.chess) global.db.chess = {};
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
async function sendChessBoard(sock, ctx, chatId, session, textCaption, quotedMsg) {
  const isWhite = session.turn === "white";
  const currentTurnPlayer = isWhite ? session.white : session.black;
  const turnEmoji = isWhite ? "⚪ Putih" : "⚫ Hitam";
  const prefix = ctx?.prefix || ".";
  const botName = global.bot?.name || "WudysoftBot";
  const buttons = [];
  if (session.status === "waiting") {
    buttons.push({
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: "♟️ Gabung Lawan",
        id: `${prefix}catur join`
      })
    }, {
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: "🚪 Batalkan",
        id: `${prefix}catur batal`
      })
    });
  } else {
    buttons.push({
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: "🔄 Perbarui Papan",
        id: `${prefix}catur papan`
      })
    }, {
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: "🏳️ Menyerah",
        id: `${prefix}catur menyerah`
      })
    });
  }
  const footerText = `${global.bot?.footer || botName} • Turn: ${turnEmoji} (${currentTurnPlayer?.name || "Menunggu Lawan"})`;
  if (typeof ctx?.sendCta === "function") {
    await ctx.sendCta(textCaption, footerText, buttons, {
      title: `✦ Chess Arena • 2 Players ✦`,
      subtitle: `Giliran: ${turnEmoji}`,
      media: session.boardImageUrl,
      quoted: quotedMsg
    });
  } else {
    if (session.boardImageUrl && session.boardImageUrl.startsWith("http")) {
      await sock.sendMessage(chatId, {
        image: {
          url: session.boardImageUrl
        },
        caption: `${textCaption}\n\n_${footerText}_`
      }, {
        quoted: quotedMsg
      });
    } else {
      await sock.sendMessage(chatId, {
        text: `${textCaption}\n\n_${footerText}_`
      }, {
        quoted: quotedMsg
      });
    }
  }
}
async function executeMove(gameId, from, to) {
  try {
    const res = await axios.post(API_URL, {
      action: "move",
      id: gameId,
      from: from.toLowerCase(),
      to: to.toLowerCase()
    }, {
      headers: {
        "Content-Type": "application/json"
      },
      timeout: 3e4,
      validateStatus: status => status < 500
    });
    return res.data;
  } catch (err) {
    return {
      message: err.message || "Network Error"
    };
  }
}
export default {
  name: "catur",
  aliases: ["chess", "maincatur", "skak"],
  description: "Game catur 2 pemain (Putih vs Hitam) dengan visual papan resmi (Full DB)",
  category: "Game",
  limit: true,
  example: "catur (buat room) atau catur e2 e4 (melangkah)",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const chatId = ctx?.id || msg?.key?.remoteJid;
      if (!chatId) return;
      initDB();
      if (!global.db.chess[chatId]) return;
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      const session = global.db.chess[chatId];
      const senderJid = ctx?.sender;
      const text = (ctx?.text || ctx?.query || msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "").trim().toLowerCase();
      if (!text || text.startsWith(`${ctx?.prefix || "."}catur`)) return;
      if (session.status === "waiting" && ["join", "ikut", "terima", "gas"].includes(text)) {
        if (session.white.jid === senderJid) {
          await ctx.reply("⚠️ Kamu adalah pembuat tantangan (Pion Putih). Tunggu lawan bergabung!");
          return true;
        }
        session.black = {
          jid: senderJid,
          name: ctx?.pushname || "Pemain Hitam"
        };
        session.status = "playing";
        session.turn = "white";
        saveDB();
        const startCaption = `–  *C H E S S  S T A R T*

Tantangan catur diterima, permainan dimulai!

–  *P L A Y E R S*

┌  ◦  *White* : ${session.white.name}
└  ◦  *Black* : ${session.black.name}

–  *T U R N*

┌  ◦  *Player* : ⚪ ${session.white.name} (Putih)
└  ◦  *Action* : Ketik langkah di chat (contoh: e2 e4)`;
        await sendChessBoard(sock, ctx, chatId, session, startCaption, msg);
        return true;
      }
      const moveMatch = text.match(MOVE_REGEX);
      if (session.status === "playing" && moveMatch) {
        const from = moveMatch[1].toLowerCase();
        const to = moveMatch[2].toLowerCase();
        const isWhiteTurn = session.turn === "white";
        const currentTurnJid = isWhiteTurn ? session.white.jid : session.black.jid;
        if (senderJid !== currentTurnJid) {
          const currentName = isWhiteTurn ? session.white.name : session.black.name;
          const turnColor = isWhiteTurn ? "⚪ Putih" : "⚫ Hitam";
          await ctx.reply(`⚠️ Sekarang giliran ${turnColor} (*${currentName}*) untuk melangkah.`);
          return true;
        }
        const data = await executeMove(session.id, from, to);
        if (!data || data.message === "Invalid move" || !data.boardImageUrl) {
          const invalidMsg = `–  *I N V A L I D  M O V E*

Langkah *${from.toUpperCase()} ➔ ${to.toUpperCase()}* tidak sah sesuai aturan catur.`;
          await ctx.reply(invalidMsg);
          return true;
        }
        session.boardImageUrl = data.boardImageUrl;
        session.turn = data.currentTurn;
        saveDB();
        const moverName = isWhiteTurn ? session.white.name : session.black.name;
        const nextPlayer = session.turn === "white" ? session.white : session.black;
        const nextColor = session.turn === "white" ? "⚪ Putih" : "⚫ Hitam";
        if (data.isCheckmate) {
          delete global.db.chess[chatId];
          saveDB();
          await axios.post(API_URL, {
            action: "delete",
            id: session.id
          }).catch(() => {});
          if (senderJid) {
            initDB(senderJid, moverName);
            global.db.user[senderJid].exp = (global.db.user[senderJid].exp || 0) + 500;
            saveDB();
          }
          const checkmateMsg = `–  *C H E C K M A T E*

Selamat! *${moverName}* berhasil memenangkan pertandingan catur! (+500 EXP) 🏆`;
          const winButtons = [{
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "🎮 Main Lagi",
              id: `${ctx?.prefix || "."}catur`
            })
          }];
          if (typeof ctx?.sendCta === "function") {
            await ctx.sendCta(checkmateMsg, "Permainan Selesai", winButtons, {
              media: data.boardImageUrl,
              quoted: msg
            });
          } else {
            await sock.sendMessage(chatId, {
              image: {
                url: data.boardImageUrl
              },
              caption: checkmateMsg
            }, {
              quoted: msg
            });
          }
          return true;
        }
        if (data.isDraw || data.isStalemate) {
          delete global.db.chess[chatId];
          saveDB();
          await axios.post(API_URL, {
            action: "delete",
            id: session.id
          }).catch(() => {});
          const drawMsg = `–  *D R A W*

Pertandingan catur berakhir seri (Stalemate / Remis).`;
          const drawButtons = [{
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "🎮 Main Lagi",
              id: `${ctx?.prefix || "."}catur`
            })
          }];
          if (typeof ctx?.sendCta === "function") {
            await ctx.sendCta(drawMsg, "Permainan Selesai", drawButtons, {
              media: data.boardImageUrl,
              quoted: msg
            });
          } else {
            await sock.sendMessage(chatId, {
              image: {
                url: data.boardImageUrl
              },
              caption: drawMsg
            }, {
              quoted: msg
            });
          }
          return true;
        }
        const moveInfo = `–  *C H E S S  M O V E*

┌  ◦  *Player* : ${moverName}
│  ◦  *Move* : ${from.toUpperCase()} ➔ ${to.toUpperCase()}
${data.inCheck ? `│  ◦  *Status* : ⚠️ SKAK (Check)!\n` : ""}└  ◦  *Next Turn* : ${nextColor} (${nextPlayer.name})`;
        await sendChessBoard(sock, ctx, chatId, session, moveInfo, msg);
        return true;
      }
    } catch (e) {
      console.error("[CHESS BEFORE ERROR]:", e.message);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      const rawText = (ctx.query || ctx.text || "").trim().toLowerCase();
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const chatId = ctx.id;
      const senderJid = ctx.sender;
      initDB(senderJid, ctx.pushname || "Pemain");
      if (rawText.includes("menyerah") || rawText.includes("resign")) {
        if (!global.db.chess[chatId]) return ctx.reply("❌ Tidak ada game catur aktif.");
        const session = global.db.chess[chatId];
        const isWhite = session.white.jid === senderJid;
        const isBlack = session.black?.jid === senderJid;
        if (!isWhite && !isBlack) return ctx.reply("❌ Kamu bukan pemain di game ini.");
        const winner = isWhite ? session.black : session.white;
        const loserName = isWhite ? session.white.name : session.black.name;
        delete global.db.chess[chatId];
        saveDB();
        await axios.post(API_URL, {
          action: "delete",
          id: session.id
        }).catch(() => {});
        const surrenderMsg = `–  *S U R R E N D E R*

${loserName} telah menyerah.
Pemenang: *${winner?.name || "Lawan"}*`;
        return ctx.reply(surrenderMsg);
      }
      if (rawText.includes("batal") || rawText.includes("cancel")) {
        if (!global.db.chess[chatId]) return ctx.reply("❌ Tidak ada sesi catur aktif.");
        const session = global.db.chess[chatId];
        delete global.db.chess[chatId];
        saveDB();
        await axios.post(API_URL, {
          action: "delete",
          id: session.id
        }).catch(() => {});
        return ctx.reply(`–  *C A N C E L L E D*

Pertandingan catur berhasil dibatalkan.`);
      }
      if (rawText.includes("papan") || rawText.includes("board")) {
        if (!global.db.chess[chatId]) return ctx.reply("❌ Tidak ada game aktif.");
        const session = global.db.chess[chatId];
        const currentName = session.turn === "white" ? session.white.name : session.black?.name || "Menunggu Lawan";
        const turnColor = session.turn === "white" ? "⚪ Putih" : "⚫ Hitam";
        const boardMsg = `–  *C H E S S  B O A R D*

┌  ◦  *Turn* : ${turnColor} (${currentName})
└  ◦  *Action* : Ketik langkah di chat (contoh: e2 e4)`;
        return await sendChessBoard(sock, ctx, chatId, session, boardMsg, quotedMsg);
      }
      if (rawText.includes("join") || rawText.includes("terima")) {
        if (!global.db.chess[chatId]) return ctx.reply(`❌ Belum ada room. Buat dengan *${prefix}catur*`);
        const session = global.db.chess[chatId];
        if (session.status !== "waiting") return ctx.reply("⚠️ Game catur sudah dimulai!");
        if (session.white.jid === senderJid) return ctx.reply("⚠️ Kamu adalah pemain putih!");
        session.black = {
          jid: senderJid,
          name: ctx.pushname || "Pemain Hitam"
        };
        session.status = "playing";
        session.turn = "white";
        saveDB();
        const startCaption = `–  *C H E S S  S T A R T*

Tantangan catur diterima, permainan dimulai!

–  *P L A Y E R S*

┌  ◦  *White* : ${session.white.name}
└  ◦  *Black* : ${session.black.name}

–  *T U R N*

┌  ◦  *Player* : ⚪ ${session.white.name} (Putih)
└  ◦  *Action* : Ketik langkah di chat (contoh: e2 e4)`;
        return await sendChessBoard(sock, ctx, chatId, session, startCaption, quotedMsg);
      }
      const moveMatch = rawText.match(MOVE_REGEX);
      if (global.db.chess[chatId] && moveMatch) {
        const session = global.db.chess[chatId];
        if (session.status !== "playing") return ctx.reply("⚠️ Menunggu lawan bergabung!");
        const from = moveMatch[1].toLowerCase();
        const to = moveMatch[2].toLowerCase();
        const isWhiteTurn = session.turn === "white";
        const currentTurnJid = isWhiteTurn ? session.white.jid : session.black.jid;
        if (senderJid !== currentTurnJid) {
          return ctx.reply(`⚠️ Sekarang giliran ${isWhiteTurn ? "⚪ Putih" : "⚫ Hitam"}!`);
        }
        await ctx.react("⏳");
        const data = await executeMove(session.id, from, to);
        if (!data || data.message === "Invalid move" || !data.boardImageUrl) {
          await ctx.react("❌");
          return ctx.reply(`–  *I N V A L I D  M O V E*

Langkah *${from.toUpperCase()} ➔ ${to.toUpperCase()}* tidak sah sesuai aturan catur.`);
        }
        session.boardImageUrl = data.boardImageUrl;
        session.turn = data.currentTurn;
        saveDB();
        const moverName = isWhiteTurn ? session.white.name : session.black.name;
        const nextPlayer = session.turn === "white" ? session.white : session.black;
        const nextColor = session.turn === "white" ? "⚪ Putih" : "⚫ Hitam";
        const moveInfo = `–  *C H E S S  M O V E*

┌  ◦  *Player* : ${moverName}
│  ◦  *Move* : ${from.toUpperCase()} ➔ ${to.toUpperCase()}
${data.inCheck ? `│  ◦  *Status* : ⚠️ SKAK (Check)!\n` : ""}└  ◦  *Next Turn* : ${nextColor} (${nextPlayer.name})`;
        await ctx.react("✅");
        return await sendChessBoard(sock, ctx, chatId, session, moveInfo, quotedMsg);
      }
      if (global.db.chess[chatId]) {
        return ctx.reply(`⚠️ Masih ada game catur aktif di grup ini!\nKetik *${prefix}catur batal* untuk mereset.`);
      }
      await ctx.react("⏳");
      const {
        data
      } = await axios.post(API_URL, {
        action: "create"
      }, {
        headers: {
          "Content-Type": "application/json"
        },
        timeout: 3e4
      });
      if (!data?.gameId || !data?.boardImageUrl) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal membuat papan catur dari server.");
      }
      global.db.chess[chatId] = {
        id: data.gameId,
        white: {
          jid: senderJid,
          name: ctx.pushname || "Pemain Putih"
        },
        black: null,
        status: "waiting",
        turn: "white",
        boardImageUrl: data.boardImageUrl
      };
      saveDB();
      const lobbyCaption = `–  *C H E S S  G A M E*

Tantangan catur 2 pemain telah dibuka.

┌  ◦  *White* : ${global.db.chess[chatId].white.name}
│  ◦  *Black* : Menunggu lawan...
└  ◦  *Game ID* : \`${data.gameId.slice(0, 8)}\`

Gunakan tombol di bawah untuk bergabung sebagai pion hitam.`;
      await sendChessBoard(sock, ctx, chatId, global.db.chess[chatId], lobbyCaption, quotedMsg);
      await ctx.react("♟️");
    } catch (error) {
      await ctx.react("❌");
      ctx.reply(`❌ Catur Error: ${error.message}`);
    }
  }
};