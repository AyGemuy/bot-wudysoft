import axios from "axios";
import db from "../../data/db.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const getApiUrl = () => {
  const rawApi = global.bot?.api?.wudysoft || "https://api.wudysoft.com";
  const cleanApi = rawApi.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  return `https://${cleanApi}/api/game/chess`;
};
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
        display_text: "🤖 Lawan Bot",
        id: `${prefix}catur bot`
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
    try {
      return await ctx.sendCta(textCaption, footerText, buttons, {
        title: `✦ Chess Arena • ${session.isBot ? "Vs Bot" : "2 Players"} ✦`,
        subtitle: `Giliran: ${turnEmoji}`,
        media: session.boardImageUrl,
        quoted: quotedMsg
      });
    } catch {}
  }
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
async function executeMove(gameId, from, to, promotion = "") {
  try {
    const payload = {
      action: "move",
      id: gameId,
      from: from.toLowerCase(),
      to: to.toLowerCase()
    };
    if (promotion) payload.promotion = promotion.toLowerCase();
    const res = await axios.post(getApiUrl(), payload, {
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
async function executeBotMove(session, lastData) {
  try {
    const res = await axios.post(getApiUrl(), {
      action: "bot",
      id: session.id
    }, {
      headers: {
        "Content-Type": "application/json"
      },
      timeout: 8e3,
      validateStatus: status => status < 500
    });
    if (res.data?.boardImageUrl && !res.data.error && res.data.message !== "Invalid action") {
      return res.data;
    }
  } catch {}
  const fen = lastData?.fen || session?.fen;
  let botMove = null;
  if (fen) {
    try {
      const resAi = await axios.post("https://chess-api.com/v1", {
        fen: fen,
        depth: 10
      }, {
        timeout: 8e3
      });
      if (resAi.data?.from && resAi.data?.to) {
        botMove = {
          from: resAi.data.from,
          to: resAi.data.to,
          promotion: resAi.data.promotion || ""
        };
      }
    } catch {}
    if (!botMove) {
      try {
        const sfRes = await axios.get(`https://stockfish.online/api/s/v2.php?fen=${encodeURIComponent(fen)}&depth=8`, {
          timeout: 8e3
        });
        if (sfRes.data?.success && sfRes.data?.bestmove) {
          const match = sfRes.data.bestmove.match(/^bestmove\s+([a-h][1-8])([a-h][1-8])([qrbn])?/i);
          if (match) {
            botMove = {
              from: match[1],
              to: match[2],
              promotion: match[3] || ""
            };
          }
        }
      } catch {}
    }
  }
  if (!botMove && Array.isArray(lastData?.moves) && lastData.moves.length > 0) {
    const randomMove = lastData.moves[Math.floor(Math.random() * lastData.moves.length)];
    if (typeof randomMove === "string") {
      const m = randomMove.match(/([a-h][1-8])([a-h][1-8])([qrbn])?/i);
      if (m) botMove = {
        from: m[1],
        to: m[2],
        promotion: m[3] || ""
      };
    } else if (randomMove.from && randomMove.to) {
      botMove = {
        from: randomMove.from,
        to: randomMove.to,
        promotion: randomMove.promotion || ""
      };
    }
  }
  if (botMove) {
    const moveRes = await executeMove(session.id, botMove.from, botMove.to, botMove.promotion);
    if (moveRes && moveRes.boardImageUrl) {
      moveRes.botMoveStr = `${botMove.from.toUpperCase()} ➔ ${botMove.to.toUpperCase()}`;
      return moveRes;
    }
  }
  return null;
}
async function processPlayerMove(sock, ctx, chatId, session, senderJid, from, to, promotion = "", msg = null) {
  const isWhiteTurn = session.turn === "white";
  const currentTurnJid = isWhiteTurn ? session.white?.jid : session.black?.jid;
  if (senderJid !== currentTurnJid) {
    const currentName = isWhiteTurn ? session.white?.name : session.black?.name;
    const turnColor = isWhiteTurn ? "⚪ Putih" : "⚫ Hitam";
    await ctx.reply(`⚠️ Sekarang giliran ${turnColor} (*${currentName}*) untuk melangkah.`);
    return true;
  }
  if (typeof ctx?.react === "function") await ctx.react("⏳");
  const data = await executeMove(session.id, from, to, promotion);
  if (!data || data.message === "Invalid move" || !data.boardImageUrl) {
    if (typeof ctx?.react === "function") await ctx.react("❌");
    await ctx.reply(`–  *I N V A L I D  M O V E*\n\nLangkah *${from.toUpperCase()} ➔ ${to.toUpperCase()}* tidak sah sesuai aturan catur.`);
    return true;
  }
  session.boardImageUrl = data.boardImageUrl;
  session.turn = data.currentTurn;
  if (data.fen) session.fen = data.fen;
  saveDB();
  const moverName = isWhiteTurn ? session.white.name : session.black.name;
  if (data.isCheckmate) {
    delete global.db.chess[chatId];
    saveDB();
    await axios.post(getApiUrl(), {
      action: "delete",
      id: session.id
    }).catch(() => {});
    if (senderJid) {
      initDB(senderJid, moverName);
      global.db.user[senderJid].exp = (global.db.user[senderJid].exp || 0) + 500;
      saveDB();
    }
    const checkmateMsg = `–  *C H E C K M A T E*\n\nSelamat! *${moverName}* berhasil memenangkan pertandingan catur! (+500 EXP) 🏆`;
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
    await axios.post(getApiUrl(), {
      action: "delete",
      id: session.id
    }).catch(() => {});
    const drawMsg = `–  *D R A W*\n\nPertandingan catur berakhir seri (Stalemate / Remis).`;
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
  if (session.isBot && session.turn === "black") {
    if (typeof ctx?.react === "function") await ctx.react("🤔");
    const botData = await executeBotMove(session, data);
    if (botData && botData.boardImageUrl) {
      session.boardImageUrl = botData.boardImageUrl;
      session.turn = botData.currentTurn;
      if (botData.fen) session.fen = botData.fen;
      saveDB();
      if (botData.isCheckmate) {
        delete global.db.chess[chatId];
        saveDB();
        await axios.post(getApiUrl(), {
          action: "delete",
          id: session.id
        }).catch(() => {});
        const botWinMsg = `–  *C H E C K M A T E*\n\n🤖 *${session.black.name}* berhasil mengalahkanmu! Tetap semangat dan coba lagi.`;
        await sendChessBoard(sock, ctx, chatId, {
          ...session,
          boardImageUrl: botData.boardImageUrl
        }, botWinMsg, msg);
        return true;
      }
      if (botData.isDraw || botData.isStalemate) {
        delete global.db.chess[chatId];
        saveDB();
        await axios.post(getApiUrl(), {
          action: "delete",
          id: session.id
        }).catch(() => {});
        const drawMsg = `–  *D R A W*\n\nPertandingan catur berakhir seri (Remis).`;
        await sendChessBoard(sock, ctx, chatId, {
          ...session,
          boardImageUrl: botData.boardImageUrl
        }, drawMsg, msg);
        return true;
      }
      const botMoveCaption = `–  *C H E S S  M O V E*

┌  ◦  *Player* : ⚪ ${moverName} (${from.toUpperCase()} ➔ ${to.toUpperCase()})
├  ◦  *Bot Move* : ⚫ ${session.black.name} (${botData.botMoveStr || "Membalas langkah"})
${botData.inCheck ? `├  ◦  *Status* : ⚠️ SKAK (Check)!\n` : ""}└  ◦  *Next Turn* : ⚪ Putih (${session.white.name})`;
      if (typeof ctx?.react === "function") await ctx.react("♟️");
      await sendChessBoard(sock, ctx, chatId, session, botMoveCaption, msg);
      return true;
    }
  }
  const nextPlayer = session.turn === "white" ? session.white : session.black;
  const nextColor = session.turn === "white" ? "⚪ Putih" : "⚫ Hitam";
  const moveInfo = `–  *C H E S S  M O V E*

┌  ◦  *Player* : ${moverName}
│  ◦  *Move* : ${from.toUpperCase()} ➔ ${to.toUpperCase()}
${data.inCheck ? `│  ◦  *Status* : ⚠️ SKAK (Check)!\n` : ""}└  ◦  *Next Turn* : ${nextColor} (${nextPlayer.name})`;
  if (typeof ctx?.react === "function") await ctx.react("✅");
  await sendChessBoard(sock, ctx, chatId, session, moveInfo, msg);
  return true;
}
export default {
  name: "catur",
  aliases: ["chess", "maincatur", "skak"],
  description: "Game catur visual resmi: Lawan Bot atau Lawan Member (Putih vs Hitam)",
  category: "Game",
  limit: true,
  example: "catur (buat room), catur bot (lawan bot), atau catur e2 e4 (melangkah)",
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
        if (session.targetJid && session.targetJid !== senderJid) {
          await ctx.reply(`❌ Tantangan ini ditujukan khusus untuk @${session.targetJid.split("@")[0]}!`, {
            mentions: [session.targetJid]
          });
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
        return await processPlayerMove(sock, ctx, chatId, session, senderJid, moveMatch[1], moveMatch[2], moveMatch[3] || "", msg);
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
      const senderName = ctx.pushname || "Pemain";
      const botName = global.bot?.name || "WudysoftBot";
      const rawBotJid = sock?.user?.id || sock?.user?.jid || "";
      const botJid = rawBotJid.includes(":") ? `${rawBotJid.split(":")[0]}@s.whatsapp.net` : rawBotJid;
      initDB(senderJid, senderName);
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
        await axios.post(getApiUrl(), {
          action: "delete",
          id: session.id
        }).catch(() => {});
        return ctx.reply(`–  *S U R R E N D E R*\n\n${loserName} telah menyerah.\nPemenang: *${winner?.name || "Lawan"}* 🏆`);
      }
      if (rawText.includes("batal") || rawText.includes("cancel")) {
        if (!global.db.chess[chatId]) return ctx.reply("❌ Tidak ada sesi catur aktif.");
        const session = global.db.chess[chatId];
        if (session.white.jid !== senderJid && session.black?.jid !== senderJid) {
          return ctx.reply("❌ Hanya pemain yang dapat membatalkan permainan.");
        }
        delete global.db.chess[chatId];
        saveDB();
        await axios.post(getApiUrl(), {
          action: "delete",
          id: session.id
        }).catch(() => {});
        return ctx.reply(`–  *C A N C E L L E D*\n\nPertandingan catur berhasil dibatalkan.`);
      }
      if (rawText.includes("papan") || rawText.includes("board")) {
        if (!global.db.chess[chatId]) return ctx.reply("❌ Tidak ada game catur aktif.");
        const session = global.db.chess[chatId];
        const currentName = session.turn === "white" ? session.white.name : session.black?.name || "Menunggu Lawan";
        const turnColor = session.turn === "white" ? "⚪ Putih" : "⚫ Hitam";
        const boardMsg = `–  *C H E S S  B O A R D*

┌  ◦  *Turn* : ${turnColor} (${currentName})
└  ◦  *Action* : Ketik langkah di chat (contoh: e2 e4)`;
        return await sendChessBoard(sock, ctx, chatId, session, boardMsg, quotedMsg);
      }
      if (rawText.includes("bot") || rawText.includes("ai")) {
        if (global.db.chess[chatId]) {
          return ctx.reply(`⚠️ Masih ada game catur aktif di chat ini!\nKetik *${prefix}catur batal* untuk mereset.`);
        }
        if (typeof ctx?.react === "function") await ctx.react("⏳");
        const {
          data
        } = await axios.post(getApiUrl(), {
          action: "create"
        }, {
          headers: {
            "Content-Type": "application/json"
          },
          timeout: 3e4
        });
        if (!data?.gameId || !data?.boardImageUrl) {
          if (typeof ctx?.react === "function") await ctx.react("❌");
          return ctx.reply("❌ Gagal membuat papan catur dari server.");
        }
        global.db.chess[chatId] = {
          id: data.gameId,
          isBot: true,
          white: {
            jid: senderJid,
            name: senderName
          },
          black: {
            jid: botJid,
            name: botName,
            isBot: true
          },
          status: "playing",
          turn: "white",
          boardImageUrl: data.boardImageUrl,
          fen: data.fen || null
        };
        saveDB();
        const botStartCaption = `–  *C H E S S  V S  B O T*

Permainan catur melawan Bot telah dimulai!

–  *P L A Y E R S*

┌  ◦  *White* : ⚪ ${senderName} (Kamu)
└  ◦  *Black* : ⚫ ${botName} (Bot)

–  *T U R N*

┌  ◦  *Player* : ⚪ ${senderName}
└  ◦  *Action* : Ketik langkah di chat (contoh: e2 e4)`;
        if (typeof ctx?.react === "function") await ctx.react("♟️");
        return await sendChessBoard(sock, ctx, chatId, global.db.chess[chatId], botStartCaption, quotedMsg);
      }
      if (rawText.includes("join") || rawText.includes("terima")) {
        if (!global.db.chess[chatId]) return ctx.reply(`❌ Belum ada room. Buat dengan *${prefix}catur*`);
        const session = global.db.chess[chatId];
        if (session.status !== "waiting") return ctx.reply("⚠️ Game catur sudah dimulai!");
        if (session.white.jid === senderJid) return ctx.reply("⚠️ Kamu adalah pemain putih!");
        if (session.targetJid && session.targetJid !== senderJid) {
          return ctx.reply(`❌ Tantangan ini ditujukan khusus untuk @${session.targetJid.split("@")[0]}!`, {
            mentions: [session.targetJid]
          });
        }
        session.black = {
          jid: senderJid,
          name: senderName
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
        return await processPlayerMove(sock, ctx, chatId, session, senderJid, moveMatch[1], moveMatch[2], moveMatch[3] || "", quotedMsg);
      }
      if (global.db.chess[chatId]) {
        return ctx.reply(`⚠️ Masih ada game catur aktif di grup ini!\nKetik *${prefix}catur batal* untuk mereset.`);
      }
      const mentioned = ctx?.mentionedJid || [];
      const targetJid = mentioned[0] || null;
      if (targetJid && targetJid === botJid) {
        ctx.query = "bot";
        return this.execute(sock, ctx, msg);
      }
      if (targetJid && targetJid === senderJid) {
        return ctx.reply("❌ Kamu tidak bisa menantang diri sendiri!");
      }
      if (typeof ctx?.react === "function") await ctx.react("⏳");
      const {
        data
      } = await axios.post(getApiUrl(), {
        action: "create"
      }, {
        headers: {
          "Content-Type": "application/json"
        },
        timeout: 3e4
      });
      if (!data?.gameId || !data?.boardImageUrl) {
        if (typeof ctx?.react === "function") await ctx.react("❌");
        return ctx.reply("❌ Gagal membuat papan catur dari server.");
      }
      global.db.chess[chatId] = {
        id: data.gameId,
        isBot: false,
        targetJid: targetJid,
        white: {
          jid: senderJid,
          name: senderName
        },
        black: null,
        status: "waiting",
        turn: "white",
        boardImageUrl: data.boardImageUrl,
        fen: data.fen || null
      };
      saveDB();
      const lobbyCaption = `–  *C H E S S  G A M E*

Tantangan catur 2 pemain telah dibuka.

┌  ◦  *White* : ${global.db.chess[chatId].white.name}
│  ◦  *Black* : ${targetJid ? `@${targetJid.split("@")[0]}` : "Menunggu lawan..."}
└  ◦  *Mode* : ${targetJid ? "PvP Spesifik" : "PvP Terbuka / Bisa Lawan Bot"}

_Gunakan tombol di bawah untuk bergabung sebagai pion hitam atau bermain melawan Bot._`;
      await sendChessBoard(sock, ctx, chatId, global.db.chess[chatId], lobbyCaption, quotedMsg);
      if (typeof ctx?.react === "function") await ctx.react("♟️");
    } catch (error) {
      if (typeof ctx?.react === "function") await ctx.react("❌");
      ctx.reply(`❌ Catur Error: ${error.message}`);
    }
  }
};