import axios from "axios";
import db from "../../data/db.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/game/ludo`;
const PLAYER_COLORS = [{
  name: "Merah",
  emoji: "🔴",
  code: "p1"
}, {
  name: "Hijau",
  emoji: "🟢",
  code: "p2"
}, {
  name: "Kuning",
  emoji: "🟡",
  code: "p3"
}, {
  name: "Biru",
  emoji: "🔵",
  code: "p4"
}];
const DICE_EMOJIS = ["", "⚀ (1)", "⚁ (2)", "⚂ (3)", "⚃ (4)", "⚄ (5)", "⚅ (6)"];

function initDB(jid = null, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.ludo) global.db.ludo = {};
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
async function callLudoApi(payload) {
  try {
    const res = await axios.post(API_URL, payload, {
      headers: {
        "Content-Type": "application/json"
      },
      timeout: 6e4,
      validateStatus: status => status < 500
    });
    return res.data;
  } catch (err) {
    return {
      success: false,
      message: err.message || "Network Error"
    };
  }
}

function getMovablePieces(playerState, dice) {
  const movable = [];
  if (!playerState) return movable;
  for (const piece of ["a", "b", "c", "d"]) {
    const pos = playerState[piece] || 0;
    if (pos === 0 && dice === 6) {
      movable.push(piece);
    } else if (pos > 0 && pos + dice <= 57) {
      movable.push(piece);
    }
  }
  return movable;
}

function formatPlayerList(players) {
  return players.map((p, idx) => {
    const isLast = idx === players.length - 1;
    const branch = isLast ? "└" : "│";
    return `${branch}  ◦  ${p.color.emoji} ${p.name} (${p.color.name})`;
  }).join("\n");
}
async function sendLudoBoard(sock, ctx, chatId, session, textCaption, quotedMsg) {
  const currentPlayer = session.players[session.turnIndex];
  const prefix = ctx?.prefix || ".";
  const buttons = [];
  if (session.status === "waiting") {
    buttons.push({
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: "🎮 Gabung (Join)",
        id: `${prefix}ludo join`
      })
    });
    if (session.players.length >= 2) {
      buttons.push({
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🚀 Mulai Sekarang",
          id: `${prefix}ludo start`
        })
      });
    }
    buttons.push({
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: "🚪 Batalkan Room",
        id: `${prefix}ludo cancel`
      })
    });
  }
  if (session.status === "playing" && session.lastDice === null) {
    buttons.push({
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: `🎲 Kocok Dadu (${currentPlayer.name})`,
        id: `${prefix}ludo roll`
      })
    });
    buttons.push({
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: "🚪 Batalkan Room",
        id: `${prefix}ludo cancel`
      })
    });
  }
  if (session.status === "playing" && session.lastDice !== null && session.movablePieces?.length > 1) {
    const pieceRows = session.movablePieces.map(p => {
      const pos = session.state[`p${currentPlayer.playerNum}`]?.[p] || 0;
      return {
        title: `Bidak [${p.toUpperCase()}]`,
        id: `${prefix}ludo move ${p}`,
        description: `Posisi: ${pos === 0 ? "Kandang" : pos} ➔ Maju +${session.lastDice} langkah`
      };
    });
    buttons.push({
      name: "single_select",
      buttonParamsJson: JSON.stringify({
        title: "♟️ PILIH BIDAK",
        sections: [{
          title: `GILIRAN: ${currentPlayer.name.toUpperCase()}`,
          rows: pieceRows
        }]
      })
    });
    buttons.push({
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: "🚪 Batalkan Room",
        id: `${prefix}ludo cancel`
      })
    });
  }
  const footerText = `${global.bot?.footer || global.bot?.name || "WudysoftBot"} • Ludo (${session.totalPlayers}P)`;
  if (typeof ctx?.sendCta === "function") {
    await ctx.sendCta(textCaption, footerText, buttons, {
      title: `✦ Ludo Arena • ${session.totalPlayers} Players ✦`,
      subtitle: `Room ID: ${session.id.slice(0, 8)}`,
      media: session.boardUrl,
      quoted: quotedMsg
    });
  } else if (session.boardUrl) {
    await sock.sendMessage(chatId, {
      image: {
        url: session.boardUrl
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

function resetTurnTimer(sock, ctx, chatId) {
  setTimeout(async () => {
    initDB();
    const session = global.db.ludo[chatId];
    if (session && session.status === "playing" && Date.now() >= session.expireTime) {
      const afkPlayer = session.players[session.turnIndex];
      session.lastDice = null;
      session.movablePieces = [];
      session.turnIndex = (session.turnIndex + 1) % session.players.length;
      session.expireTime = Date.now() + 60 * 1e3;
      saveDB();
      const nextPlayer = session.players[session.turnIndex];
      const timeoutCaption = `–  *T I M E  O U T*

Waktu giliran habis (AFK).

┌  ◦  *Player* : ${afkPlayer.color.emoji} ${afkPlayer.name}
└  ◦  *Next Turn* : ${nextPlayer.color.emoji} ${nextPlayer.name}`;
      resetTurnTimer(sock, ctx, chatId);
      await sendLudoBoard(sock, ctx, chatId, session, timeoutCaption, null);
    }
  }, 60 * 1e3);
}
export default {
  name: "ludo",
  aliases: ["ludoking", "mainludo"],
  description: "Game papan Ludo multiplayer interaktif (2, 3, atau 4 Pemain) Full CTA (Full DB)",
  category: "Game",
  group: true,
  limit: true,
  example: "ludo create 2 atau ludo create 4 atau ludo join",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const chatId = ctx?.id || msg?.key?.remoteJid;
      if (!chatId) return;
      initDB();
      if (!global.db.ludo[chatId]) return;
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      const session = global.db.ludo[chatId];
      const senderJid = ctx?.sender;
      const text = (ctx?.text || ctx?.query || msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "").trim().toLowerCase();
      if (!text || text.startsWith(`${ctx?.prefix || "."}ludo`)) return;
      if (session.status === "waiting" && ["join", "ikut", "masuk"].includes(text)) {
        if (session.players.some(p => p.jid === senderJid)) {
          await ctx.reply("⚠️ Kamu sudah bergabung di room ini!");
          return true;
        }
        const playerNum = session.players.length + 1;
        const color = PLAYER_COLORS[playerNum - 1];
        session.players.push({
          jid: senderJid,
          name: ctx?.pushname || `Pemain ${playerNum}`,
          playerNum: playerNum,
          color: color
        });
        if (session.players.length === session.totalPlayers) {
          session.status = "playing";
          session.turnIndex = 0;
          session.lastDice = null;
          session.expireTime = Date.now() + 60 * 1e3;
          saveDB();
          const firstPlayer = session.players[0];
          const startCaption = `–  *L U D O  S T A R T*

Slot pemain telah lengkap, permainan dimulai!

–  *P L A Y E R S*

${formatPlayerList(session.players)}

–  *T U R N*

┌  ◦  *Player* : ${firstPlayer.color.emoji} ${firstPlayer.name}
└  ◦  *Action* : Silakan kocok dadu untuk melangkah`;
          resetTurnTimer(sock, ctx, chatId);
          await sendLudoBoard(sock, ctx, chatId, session, startCaption, msg);
          return true;
        }
        saveDB();
        await ctx.reply(`✅ *${ctx?.pushname || "Pemain"}* bergabung (${color.emoji} ${color.name})!\n` + `Slot: *${session.players.length}/${session.totalPlayers}* pemain.`);
        return true;
      }
      if (session.status === "waiting" && ["start", "mulai", "gas"].includes(text)) {
        if (session.players[0].jid !== senderJid) {
          await ctx.reply("⚠️ Hanya pembuat room (Host) yang dapat memulai permainan.");
          return true;
        }
        if (session.players.length < 2) {
          await ctx.reply("❌ Minimal dibutuhkan 2 pemain untuk memulai Ludo.");
          return true;
        }
        session.totalPlayers = session.players.length;
        session.status = "playing";
        session.turnIndex = 0;
        session.lastDice = null;
        session.expireTime = Date.now() + 60 * 1e3;
        saveDB();
        const firstPlayer = session.players[0];
        const startCaption = `–  *L U D O  S T A R T*

Permainan Ludo telah dimulai oleh Host!

–  *P L A Y E R S*

${formatPlayerList(session.players)}

–  *T U R N*

┌  ◦  *Player* : ${firstPlayer.color.emoji} ${firstPlayer.name}
└  ◦  *Action* : Silakan kocok dadu untuk melangkah`;
        resetTurnTimer(sock, ctx, chatId);
        await sendLudoBoard(sock, ctx, chatId, session, startCaption, msg);
        return true;
      }
      if (session.status === "playing" && ["roll", "kocok", "dadu", "putar"].includes(text)) {
        const currentPlayer = session.players[session.turnIndex];
        if (currentPlayer.jid !== senderJid) return;
        if (session.lastDice !== null) {
          await ctx.reply(`⚠️ Anda sudah mengocok dadu (${DICE_EMOJIS[session.lastDice]}). Silakan tentukan bidak!`);
          return true;
        }
        const dice = Math.floor(Math.random() * 6) + 1;
        session.lastDice = dice;
        const playerKey = `p${currentPlayer.playerNum}`;
        const movable = getMovablePieces(session.state[playerKey], dice);
        session.movablePieces = movable;
        if (movable.length === 0) {
          session.lastDice = null;
          session.movablePieces = [];
          session.turnIndex = (session.turnIndex + 1) % session.players.length;
          session.expireTime = Date.now() + 60 * 1e3;
          saveDB();
          const nextPlayer = session.players[session.turnIndex];
          const noMoveCaption = `–  *R O L L  D I C E*

┌  ◦  *Player* : ${currentPlayer.color.emoji} ${currentPlayer.name}
│  ◦  *Dice* : ${DICE_EMOJIS[dice]}
└  ◦  *Result* : Tidak ada bidak yang dapat bergerak

–  *N E X T  T U R N*

┌  ◦  *Player* : ${nextPlayer.color.emoji} ${nextPlayer.name}
└  ◦  *Action* : Silakan kocok dadu`;
          resetTurnTimer(sock, ctx, chatId);
          await sendLudoBoard(sock, ctx, chatId, session, noMoveCaption, msg);
          return true;
        }
        if (movable.length === 1) {
          const piece = movable[0];
          const currentPos = session.state[playerKey][piece] || 0;
          const newPos = currentPos === 0 ? 1 : currentPos + dice;
          const data = await callLudoApi({
            action: "move",
            id: session.id,
            player: String(currentPlayer.playerNum),
            [piece]: newPos
          });
          if (data?.game?.boardUrl) {
            session.boardUrl = data.game.boardUrl;
            session.state = data.game.state;
          }
          const pState = session.state[playerKey];
          if (pState.a === 57 && pState.b === 57 && pState.c === 57 && pState.d === 57) {
            delete global.db.ludo[chatId];
            initDB(currentPlayer.jid, currentPlayer.name);
            global.db.user[currentPlayer.jid].exp = (global.db.user[currentPlayer.jid].exp || 0) + 500;
            saveDB();
            const winMsg = `–  *W I N N E R*

Selamat! ${currentPlayer.color.emoji} ${currentPlayer.name} berhasil memenangkan permainan Ludo! (+500 EXP)`;
            await ctx.reply(winMsg);
            return true;
          }
          const rolledSix = dice === 6;
          session.lastDice = null;
          session.movablePieces = [];
          if (!rolledSix) session.turnIndex = (session.turnIndex + 1) % session.players.length;
          session.expireTime = Date.now() + 60 * 1e3;
          saveDB();
          const activePlayer = session.players[session.turnIndex];
          const autoCaption = `–  *A U T O  M O V E*

┌  ◦  *Player* : ${currentPlayer.color.emoji} ${currentPlayer.name}
│  ◦  *Dice* : ${DICE_EMOJIS[dice]}
│  ◦  *Piece* : Bidak [${piece.toUpperCase()}] ➔ Posisi ${newPos}
└  ◦  *Bonus Roll* : ${rolledSix ? "Ya (Dadu 6)" : "Tidak"}

–  *T U R N*

┌  ◦  *Player* : ${activePlayer.color.emoji} ${activePlayer.name}
└  ◦  *Action* : Silakan kocok dadu`;
          resetTurnTimer(sock, ctx, chatId);
          await sendLudoBoard(sock, ctx, chatId, session, autoCaption, msg);
          return true;
        }
        session.expireTime = Date.now() + 60 * 1e3;
        saveDB();
        const rollCaption = `–  *C H O O S E  P I E C E*

┌  ◦  *Player* : ${currentPlayer.color.emoji} ${currentPlayer.name}
│  ◦  *Dice* : ${DICE_EMOJIS[dice]}
└  ◦  *Movable* : ${movable.map(m => m.toUpperCase()).join(", ")}

Pilih bidak dari tombol menu di bawah atau balas dengan huruf a/b/c/d.`;
        await sendLudoBoard(sock, ctx, chatId, session, rollCaption, msg);
        return true;
      }
      if (session.status === "playing" && ["a", "b", "c", "d"].includes(text)) {
        const currentPlayer = session.players[session.turnIndex];
        if (currentPlayer.jid !== senderJid || session.lastDice === null) return;
        const piece = text;
        if (!session.movablePieces?.includes(piece)) {
          await ctx.reply(`❌ Bidak [${piece.toUpperCase()}] tidak dapat bergerak dengan dadu ${session.lastDice}.`);
          return true;
        }
        const playerKey = `p${currentPlayer.playerNum}`;
        const currentPos = session.state[playerKey][piece] || 0;
        const newPos = currentPos === 0 ? 1 : currentPos + session.lastDice;
        const data = await callLudoApi({
          action: "move",
          id: session.id,
          player: String(currentPlayer.playerNum),
          [piece]: newPos
        });
        if (data?.game?.boardUrl) {
          session.boardUrl = data.game.boardUrl;
          session.state = data.game.state;
        }
        const pState = session.state[playerKey];
        if (pState.a === 57 && pState.b === 57 && pState.c === 57 && pState.d === 57) {
          delete global.db.ludo[chatId];
          initDB(currentPlayer.jid, currentPlayer.name);
          global.db.user[currentPlayer.jid].exp = (global.db.user[currentPlayer.jid].exp || 0) + 500;
          saveDB();
          const winMsg = `–  *W I N N E R*

Selamat! ${currentPlayer.color.emoji} ${currentPlayer.name} berhasil memenangkan permainan Ludo! (+500 EXP)`;
          await ctx.reply(winMsg);
          return true;
        }
        const rolledSix = session.lastDice === 6;
        session.lastDice = null;
        session.movablePieces = [];
        if (!rolledSix) session.turnIndex = (session.turnIndex + 1) % session.players.length;
        session.expireTime = Date.now() + 60 * 1e3;
        saveDB();
        const activePlayer = session.players[session.turnIndex];
        const moveCaption = `–  *M O V E  P I E C E*

┌  ◦  *Player* : ${currentPlayer.color.emoji} ${currentPlayer.name}
│  ◦  *Piece* : Bidak [${piece.toUpperCase()}] ➔ Posisi ${newPos}
└  ◦  *Bonus Roll* : ${rolledSix ? "Ya (Dadu 6)" : "Tidak"}

–  *T U R N*

┌  ◦  *Player* : ${activePlayer.color.emoji} ${activePlayer.name}
└  ◦  *Action* : Silakan kocok dadu`;
        resetTurnTimer(sock, ctx, chatId);
        await sendLudoBoard(sock, ctx, chatId, session, moveCaption, msg);
        return true;
      }
    } catch (e) {
      console.error("[LUDO BEFORE ERROR]:", e.message);
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
      if (rawText.includes("cancel") || rawText.includes("keluar") || rawText.includes("batal")) {
        if (global.db.ludo[chatId]) {
          const session = global.db.ludo[chatId];
          delete global.db.ludo[chatId];
          saveDB();
          await callLudoApi({
            action: "delete",
            id: session.id
          });
          return ctx.reply(`–  *C A N C E L L E D*

Room permainan Ludo di grup ini telah dibatalkan.`);
        }
        return ctx.reply("❌ Tidak ada sesi Ludo yang sedang berjalan.");
      }
      if (rawText.includes("join") || rawText.includes("masuk")) {
        if (!global.db.ludo[chatId]) {
          return ctx.reply(`❌ Belum ada room Ludo. Buat terlebih dahulu dengan *${prefix}ludo create [2|3|4]*`);
        }
        const session = global.db.ludo[chatId];
        if (session.status !== "waiting") return ctx.reply("⚠️ Permainan Ludo sudah dimulai!");
        if (session.players.some(p => p.jid === senderJid)) return ctx.reply("⚠️ Kamu sudah berada di dalam room!");
        const playerNum = session.players.length + 1;
        const color = PLAYER_COLORS[playerNum - 1];
        session.players.push({
          jid: senderJid,
          name: ctx.pushname || `Pemain ${playerNum}`,
          playerNum: playerNum,
          color: color
        });
        if (session.players.length === session.totalPlayers) {
          session.status = "playing";
          session.turnIndex = 0;
          session.lastDice = null;
          session.expireTime = Date.now() + 60 * 1e3;
          saveDB();
          const firstPlayer = session.players[0];
          const startCaption = `–  *L U D O  S T A R T*

Slot pemain telah lengkap, permainan dimulai!

–  *P L A Y E R S*

${formatPlayerList(session.players)}

–  *T U R N*

┌  ◦  *Player* : ${firstPlayer.color.emoji} ${firstPlayer.name}
└  ◦  *Action* : Silakan kocok dadu untuk melangkah`;
          resetTurnTimer(sock, ctx, chatId);
          return await sendLudoBoard(sock, ctx, chatId, session, startCaption, quotedMsg);
        }
        saveDB();
        return ctx.reply(`✅ *${ctx.pushname || "Pemain"}* berhasil bergabung (${color.emoji} ${color.name})!\n` + `Slot Pemain: *${session.players.length}/${session.totalPlayers}*`);
      }
      if (rawText.includes("start") || rawText.includes("mulai")) {
        if (!global.db.ludo[chatId]) return ctx.reply("❌ Tidak ada room aktif.");
        const session = global.db.ludo[chatId];
        if (session.players[0].jid !== senderJid) {
          return ctx.reply("⚠️ Hanya pembuat room (Host) yang dapat memulai permainan.");
        }
        if (session.players.length < 2) {
          return ctx.reply("❌ Minimal dibutuhkan 2 pemain untuk memulai Ludo.");
        }
        session.totalPlayers = session.players.length;
        session.status = "playing";
        session.turnIndex = 0;
        session.lastDice = null;
        session.expireTime = Date.now() + 60 * 1e3;
        saveDB();
        const firstPlayer = session.players[0];
        const startCaption = `–  *L U D O  S T A R T*

Permainan Ludo telah dimulai oleh Host!

–  *P L A Y E R S*

${formatPlayerList(session.players)}

–  *T U R N*

┌  ◦  *Player* : ${firstPlayer.color.emoji} ${firstPlayer.name}
└  ◦  *Action* : Silakan kocok dadu untuk melangkah`;
        resetTurnTimer(sock, ctx, chatId);
        return await sendLudoBoard(sock, ctx, chatId, session, startCaption, quotedMsg);
      }
      if (rawText.includes("roll") || rawText.includes("kocok")) {
        if (!global.db.ludo[chatId]) return ctx.reply("❌ Tidak ada game Ludo aktif.");
        const session = global.db.ludo[chatId];
        const currentPlayer = session.players[session.turnIndex];
        if (currentPlayer.jid !== senderJid) {
          return ctx.reply(`⚠️ Sekarang giliran ${currentPlayer.color.emoji} *${currentPlayer.name}*!`);
        }
        const dice = Math.floor(Math.random() * 6) + 1;
        session.lastDice = dice;
        const playerKey = `p${currentPlayer.playerNum}`;
        const movable = getMovablePieces(session.state[playerKey], dice);
        session.movablePieces = movable;
        if (movable.length === 0) {
          session.lastDice = null;
          session.movablePieces = [];
          session.turnIndex = (session.turnIndex + 1) % session.players.length;
          session.expireTime = Date.now() + 60 * 1e3;
          saveDB();
          const nextPlayer = session.players[session.turnIndex];
          const noMoveCaption = `–  *R O L L  D I C E*

┌  ◦  *Player* : ${currentPlayer.color.emoji} ${currentPlayer.name}
│  ◦  *Dice* : ${DICE_EMOJIS[dice]}
└  ◦  *Result* : Tidak ada bidak yang dapat bergerak

–  *N E X T  T U R N*

┌  ◦  *Player* : ${nextPlayer.color.emoji} ${nextPlayer.name}
└  ◦  *Action* : Silakan kocok dadu`;
          resetTurnTimer(sock, ctx, chatId);
          return await sendLudoBoard(sock, ctx, chatId, session, noMoveCaption, quotedMsg);
        }
        if (movable.length === 1) {
          const piece = movable[0];
          const currentPos = session.state[playerKey][piece] || 0;
          const newPos = currentPos === 0 ? 1 : currentPos + dice;
          const data = await callLudoApi({
            action: "move",
            id: session.id,
            player: String(currentPlayer.playerNum),
            [piece]: newPos
          });
          if (data?.game?.boardUrl) {
            session.boardUrl = data.game.boardUrl;
            session.state = data.game.state;
          }
          const pState = session.state[playerKey];
          if (pState.a === 57 && pState.b === 57 && pState.c === 57 && pState.d === 57) {
            delete global.db.ludo[chatId];
            initDB(currentPlayer.jid, currentPlayer.name);
            global.db.user[currentPlayer.jid].exp = (global.db.user[currentPlayer.jid].exp || 0) + 500;
            saveDB();
            const winMsg = `–  *W I N N E R*

Selamat! ${currentPlayer.color.emoji} ${currentPlayer.name} berhasil memenangkan permainan Ludo! (+500 EXP)`;
            return ctx.reply(winMsg);
          }
          const rolledSix = dice === 6;
          session.lastDice = null;
          session.movablePieces = [];
          if (!rolledSix) session.turnIndex = (session.turnIndex + 1) % session.players.length;
          session.expireTime = Date.now() + 60 * 1e3;
          saveDB();
          const activePlayer = session.players[session.turnIndex];
          const autoCaption = `–  *A U T O  M O V E*

┌  ◦  *Player* : ${currentPlayer.color.emoji} ${currentPlayer.name}
│  ◦  *Dice* : ${DICE_EMOJIS[dice]}
│  ◦  *Piece* : Bidak [${piece.toUpperCase()}] ➔ Posisi ${newPos}
└  ◦  *Bonus Roll* : ${rolledSix ? "Ya (Dadu 6)" : "Tidak"}

–  *T U R N*

┌  ◦  *Player* : ${activePlayer.color.emoji} ${activePlayer.name}
└  ◦  *Action* : Silakan kocok dadu`;
          resetTurnTimer(sock, ctx, chatId);
          return await sendLudoBoard(sock, ctx, chatId, session, autoCaption, quotedMsg);
        }
        session.expireTime = Date.now() + 60 * 1e3;
        saveDB();
        const rollCaption = `–  *C H O O S E  P I E C E*

┌  ◦  *Player* : ${currentPlayer.color.emoji} ${currentPlayer.name}
│  ◦  *Dice* : ${DICE_EMOJIS[dice]}
└  ◦  *Movable* : ${movable.map(m => m.toUpperCase()).join(", ")}

Pilih bidak dari tombol menu di bawah atau balas dengan huruf a/b/c/d.`;
        return await sendLudoBoard(sock, ctx, chatId, session, rollCaption, quotedMsg);
      }
      if (rawText.includes("move")) {
        if (!global.db.ludo[chatId]) return ctx.reply("❌ Tidak ada game Ludo aktif.");
        const session = global.db.ludo[chatId];
        const currentPlayer = session.players[session.turnIndex];
        if (currentPlayer.jid !== senderJid || session.lastDice === null) {
          return ctx.reply("⚠️ Bukan giliranmu atau kamu belum mengocok dadu!");
        }
        const piece = rawText.split("move")[1]?.trim()?.toLowerCase();
        if (!["a", "b", "c", "d"].includes(piece) || !session.movablePieces?.includes(piece)) {
          return ctx.reply(`❌ Bidak [${piece?.toUpperCase() || "?"}] tidak dapat bergerak.`);
        }
        const playerKey = `p${currentPlayer.playerNum}`;
        const currentPos = session.state[playerKey][piece] || 0;
        const newPos = currentPos === 0 ? 1 : currentPos + session.lastDice;
        const data = await callLudoApi({
          action: "move",
          id: session.id,
          player: String(currentPlayer.playerNum),
          [piece]: newPos
        });
        if (data?.game?.boardUrl) {
          session.boardUrl = data.game.boardUrl;
          session.state = data.game.state;
        }
        const pState = session.state[playerKey];
        if (pState.a === 57 && pState.b === 57 && pState.c === 57 && pState.d === 57) {
          delete global.db.ludo[chatId];
          initDB(currentPlayer.jid, currentPlayer.name);
          global.db.user[currentPlayer.jid].exp = (global.db.user[currentPlayer.jid].exp || 0) + 500;
          saveDB();
          const winMsg = `–  *W I N N E R*

Selamat! ${currentPlayer.color.emoji} ${currentPlayer.name} berhasil memenangkan permainan Ludo! (+500 EXP)`;
          return ctx.reply(winMsg);
        }
        const rolledSix = session.lastDice === 6;
        session.lastDice = null;
        session.movablePieces = [];
        if (!rolledSix) session.turnIndex = (session.turnIndex + 1) % session.players.length;
        session.expireTime = Date.now() + 60 * 1e3;
        saveDB();
        const activePlayer = session.players[session.turnIndex];
        const moveCaption = `–  *M O V E  P I E C E*

┌  ◦  *Player* : ${currentPlayer.color.emoji} ${currentPlayer.name}
│  ◦  *Piece* : Bidak [${piece.toUpperCase()}] ➔ Posisi ${newPos}
└  ◦  *Bonus Roll* : ${rolledSix ? "Ya (Dadu 6)" : "Tidak"}

–  *T U R N*

┌  ◦  *Player* : ${activePlayer.color.emoji} ${activePlayer.name}
└  ◦  *Action* : Silakan kocok dadu`;
        resetTurnTimer(sock, ctx, chatId);
        return await sendLudoBoard(sock, ctx, chatId, session, moveCaption, quotedMsg);
      }
      if (global.db.ludo[chatId]) {
        return ctx.reply(`⚠️ Masih ada game Ludo aktif di grup ini!\nKetik *${prefix}ludo cancel* untuk membatalkan.`);
      }
      let totalPlayers = 4;
      const countMatch = rawText.match(/\b([234])\b/);
      if (countMatch) {
        totalPlayers = parseInt(countMatch[1], 10);
      }
      await ctx.react("⏳");
      const data = await callLudoApi({
        action: "create",
        total: totalPlayers
      });
      if (!data?.success || !data?.game) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal membuat room Ludo dari server.");
      }
      const game = data.game;
      const hostColor = PLAYER_COLORS[0];
      const hostName = ctx.pushname || "Player 1";
      global.db.ludo[chatId] = {
        id: game.id,
        totalPlayers: totalPlayers,
        status: "waiting",
        boardUrl: game.boardUrl,
        state: game.state,
        turnIndex: 0,
        lastDice: null,
        movablePieces: [],
        expireTime: Date.now() + 60 * 1e3,
        players: [{
          jid: senderJid,
          name: hostName,
          playerNum: 1,
          color: hostColor
        }]
      };
      saveDB();
      const lobbyCaption = `–  *L U D O  G A M E*

Room Ludo Multiplayer telah dibuka.

┌  ◦  *Host* : ${hostName}
│  ◦  *Capacity* : ${totalPlayers} Players
│  ◦  *Room ID* : \`${game.id.slice(0, 8)}\`
└  ◦  *Joined* : 1 / ${totalPlayers} Players

–  *P L A Y E R S*

└  ◦  ${hostColor.emoji} ${hostName} (${hostColor.name})

Gunakan tombol di bawah untuk bergabung ke dalam permainan.`;
      await sendLudoBoard(sock, ctx, chatId, global.db.ludo[chatId], lobbyCaption, quotedMsg);
      await ctx.react("🎲");
    } catch (error) {
      console.error("[Ludo Execute Error]:", error);
      await ctx.react("❌");
      ctx.reply(`❌ Ludo Error: ${error.message}`);
    }
  }
};