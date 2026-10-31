import axios from "axios";
import db from "../../data/db.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const ROWS = 6;
const COLS = 7;
const P1_COLOR = "#ef4444";
const P2_COLOR = "#f59e0b";
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

function buildConnect4CanvasHtml(game, statusText = "PLAYING", winCoords = []) {
  const botName = global.bot?.name || "WudysoftBot";
  const board = game.board;
  let gridCells = "";
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cellVal = board[r][c];
      const isWinningCoin = winCoords.some(([wr, wc]) => wr === r && wc === c);
      let coinHtml = "";
      if (cellVal === 1) {
        coinHtml = `<div class="coin p1 ${isWinningCoin ? "win-pulse" : ""}"></div>`;
      } else if (cellVal === 2) {
        coinHtml = `<div class="coin p2 ${isWinningCoin ? "win-pulse" : ""}"></div>`;
      }
      gridCells += `<div class="cell">${coinHtml}</div>`;
    }
  }
  const p1Active = game.turn === 1;
  const p2Active = game.turn === 2;
  const p1Name = game.player1?.name || "Player 1";
  const p2Name = game.isBot ? `🤖 ${botName} AI` : game.player2?.name || "Player 2";
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
        height: 520px;
        background: #080a10;
        font-family: 'Plus Jakarta Sans', sans-serif;
        display: flex;
        justify-content: center;
        align-items: center;
        overflow: hidden;
      }
      .board-stage {
        width: 710px;
        height: 480px;
        background: radial-gradient(circle at 50% 20%, rgba(30, 58, 138, 0.25) 0%, rgba(9, 12, 19, 0.98) 85%);
        border: 2px solid #1e283d;
        border-radius: 20px;
        box-shadow: 0 25px 60px rgba(0,0,0,0.85);
        padding: 20px 24px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }
      .top-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .brand-icon {
        background: #2563eb;
        color: #fff;
        width: 32px;
        height: 32px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 900;
        font-size: 16px;
      }
      .brand-title {
        color: #f8fafc;
        font-size: 18px;
        font-weight: 900;
        letter-spacing: 0.5px;
      }
      .status-pill {
        border: 1px solid #3b82f6;
        color: #60a5fa;
        background: rgba(15, 23, 42, 0.8);
        padding: 4px 14px;
        border-radius: 20px;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 1.5px;
        text-transform: uppercase;
      }
      .main-arena {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 20px;
      }
      .player-badge {
        width: 140px;
        background: #101420;
        border: 2px solid #202738;
        border-radius: 12px;
        padding: 12px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
      }
      .player-badge.active {
        border-color: #3b82f6;
        background: rgba(59, 130, 246, 0.1);
        box-shadow: 0 0 15px rgba(59, 130, 246, 0.3);
      }
      .avatar-coin {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        box-shadow: 0 4px 10px rgba(0,0,0,0.5);
      }
      .avatar-coin.p1 { background: ${P1_COLOR}; }
      .avatar-coin.p2 { background: ${P2_COLOR}; }
      .p-name {
        font-size: 13px;
        font-weight: 800;
        color: #f8fafc;
        text-align: center;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 100%;
      }
      .p-turn {
        font-size: 10px;
        font-weight: 800;
        color: #60a5fa;
        letter-spacing: 1px;
      }
      .c4-grid-container {
        flex: 1;
        background: #1d4ed8;
        border: 4px solid #1e40af;
        border-radius: 14px;
        padding: 10px;
        box-shadow: inset 0 0 15px rgba(0,0,0,0.6), 0 10px 25px rgba(0,0,0,0.7);
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 8px;
      }
      .cell {
        aspect-ratio: 1;
        background: #090c15;
        border-radius: 50%;
        box-shadow: inset 0 4px 8px rgba(0,0,0,0.9);
        display: flex;
        justify-content: center;
        align-items: center;
        position: relative;
      }
      .coin {
        width: 86%;
        height: 86%;
        border-radius: 50%;
        box-shadow: inset 0 -3px 4px rgba(0,0,0,0.4), inset 0 3px 4px rgba(255,255,255,0.4);
      }
      .coin.p1 {
        background: radial-gradient(circle at 35% 35%, #f87171 0%, #dc2626 70%, #991b1b 100%);
      }
      .coin.p2 {
        background: radial-gradient(circle at 35% 35%, #fde047 0%, #eab308 70%, #a16207 100%);
      }
      .coin.win-pulse {
        box-shadow: 0 0 15px #ffffff, inset 0 0 10px #ffffff;
      }
      .footer-meta {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-top: 1px solid #192133;
        padding-top: 10px;
        color: #94a3b8;
        font-size: 12px;
        font-weight: 700;
      }
      .footer-meta b {
        color: #3b82f6;
      }
    </style>
  </head>
  <body>
    <div class="board-stage">
      <div class="top-row">
        <div class="brand">
          <div class="brand-icon">4</div>
          <div class="brand-text">CONNECT <span>FOUR</span></div>
        </div>
        <div class="status-pill">${statusText}</div>
      </div>
      <div class="main-arena">
        <div class="player-badge ${p1Active ? "active" : ""}">
          <div class="avatar-coin p1"></div>
          <div class="p-name">${p1Name}</div>
          <div class="p-turn">${p1Active ? "● GILIRAN" : "MENUNGGU"}</div>
        </div>
        <div class="c4-grid-container">
          ${gridCells}
        </div>
        <div class="player-badge ${p2Active ? "active" : ""}">
          <div class="avatar-coin p2"></div>
          <div class="p-name">${p2Name}</div>
          <div class="p-turn">${p2Active ? "● GILIRAN" : "MENUNGGU"}</div>
        </div>
      </div>
      <div class="footer-meta">
        <div>RULE : <b>SUSUN 4 KOIN BERJAJAR (HORIZONTAL/VERTIKAL/DIAGONAL)</b></div>
        <div>TARUHAN : <b style="color: #22c55e;">Rp ${(game.bet ? game.bet * 2 : 0).toLocaleString()}</b></div>
        <div>BOT : <b>${botName}</b></div>
      </div>
    </div>
  </body>
  </html>
  `;
}

function initDB(jid = null, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.connect4) global.db.connect4 = {};
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

function dropCoin(board, col, player) {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r][col] === 0) {
      board[r][col] = player;
      return r;
    }
  }
  return -1;
}

function checkWin(board, player) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      if (board[r][c] === player && board[r][c + 1] === player && board[r][c + 2] === player && board[r][c + 3] === player) {
        return [
          [r, c],
          [r, c + 1],
          [r, c + 2],
          [r, c + 3]
        ];
      }
    }
  }
  for (let r = 0; r <= ROWS - 4; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c] === player && board[r + 1][c] === player && board[r + 2][c] === player && board[r + 3][c] === player) {
        return [
          [r, c],
          [r + 1, c],
          [r + 2, c],
          [r + 3, c]
        ];
      }
    }
  }
  for (let r = 0; r <= ROWS - 4; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      if (board[r][c] === player && board[r + 1][c + 1] === player && board[r + 2][c + 2] === player && board[r + 3][c + 3] === player) {
        return [
          [r, c],
          [r + 1, c + 1],
          [r + 2, c + 2],
          [r + 3, c + 3]
        ];
      }
    }
  }
  for (let r = 3; r < ROWS; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      if (board[r][c] === player && board[r - 1][c + 1] === player && board[r - 2][c + 2] === player && board[r - 3][c + 3] === player) {
        return [
          [r, c],
          [r - 1, c + 1],
          [r - 2, c + 2],
          [r - 3, c + 3]
        ];
      }
    }
  }
  return null;
}

function isBoardFull(board) {
  return board[0].every(cell => cell !== 0);
}

function getBestAiMove(board) {
  const validCols = [];
  for (let c = 0; c < COLS; c++) {
    if (board[0][c] === 0) validCols.push(c);
  }
  if (!validCols.length) return 0;
  for (const c of validCols) {
    const tempBoard = board.map(row => [...row]);
    dropCoin(tempBoard, c, 2);
    if (checkWin(tempBoard, 2)) return c;
  }
  for (const c of validCols) {
    const tempBoard = board.map(row => [...row]);
    dropCoin(tempBoard, c, 1);
    if (checkWin(tempBoard, 1)) return c;
  }
  const preferred = [3, 2, 4, 1, 5, 0, 6];
  for (const p of preferred) {
    if (validCols.includes(p)) return p;
  }
  return validCols[Math.floor(Math.random() * validCols.length)];
}
async function sendNeoxrConnect4(sock, ctx, targetJid, bodyText, footerText, buttons, quoted = null, mentions = [], imageBuffer = null, imageUrl = null) {
  const botName = global.bot?.name || "WudysoftBot";
  const defaultBanner = global.bot?.media?.banner1 || global.bot?.media?.banner2 || "https://files.catbox.moe/g2e6i5.jpg";
  const mediaSource = imageBuffer || (imageUrl ? {
    url: imageUrl
  } : defaultBanner);
  const options = {
    image: mediaSource,
    title: `✦ ${botName} • Connect 4 Arena ✦`,
    params: {
      bottom_sheet: {
        in_thread_buttons_limit: 4,
        divider_indices: [3],
        list_title: `${botName} • Jatuhkan Koin`,
        button_title: "🎮 Jatuhkan Koin"
      }
    },
    contextInfo: {
      mentionedJid: mentions.length ? mentions : [ctx?.sender].filter(Boolean),
      forwardingScore: 999,
      isForwarded: true
    },
    quoted: quoted || undefined
  };
  if (typeof ctx?.sendCta === "function" && targetJid === ctx.id) {
    try {
      return await ctx.sendCta(bodyText, footerText, buttons, options);
    } catch (e) {
      console.error("[Connect4 ctx.sendCta Error]:", e.message);
    }
  }
  try {
    const nativeButtons = buttons.map(b => ({
      name: b.name || "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: b.display_text,
        id: b.id || b.copy_code || ""
      })
    }));
    const mediaPayload = imageBuffer ? {
      image: imageBuffer
    } : imageUrl ? {
      image: {
        url: imageUrl
      }
    } : {};
    return await sock.sendMessage(targetJid, {
      ...mediaPayload,
      caption: bodyText,
      footer: footerText,
      viewOnceMessage: {
        message: {
          interactiveMessage: {
            body: {
              text: bodyText
            },
            footer: {
              text: footerText
            },
            nativeFlowMessage: {
              buttons: nativeButtons
            },
            contextInfo: options.contextInfo
          }
        }
      }
    }, {
      quoted: quoted
    });
  } catch (e) {}
  if (imageBuffer || imageUrl) {
    return await sock.sendMessage(targetJid, {
      image: imageBuffer || {
        url: imageUrl
      },
      caption: `${bodyText}\n\n_${footerText}_`,
      mentions: mentions
    }, {
      quoted: quoted
    });
  }
  return await sock.sendMessage(targetJid, {
    text: `${bodyText}\n\n_${footerText}_`,
    mentions: mentions
  }, {
    quoted: quoted
  });
}
export default {
  name: "connect4",
  aliases: ["c4", "fourinrow", "empatsebaris", "connectfour"],
  description: "Game taktis Connect 4 (Susun 4 Koin) PvP antar user atau lawan AI Bot dengan canvas realistis bertema Neoxr",
  category: "Game",
  limit: false,
  example: "connect4 bot (lawan AI) atau connect4 @user 10000 (tantang user)",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      const isGroup = Boolean(ctx?.isGroup || ctx?.id?.endsWith("@g.us") || msg?.key?.remoteJid?.endsWith("@g.us"));
      const senderJid = ctx?.sender || msg?.key?.participant || msg?.key?.remoteJid;
      if (!senderJid) return;
      initDB();
      const userText = (ctx?.text || ctx?.query || msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "").trim().toLowerCase();
      const prefix = ctx?.prefix || ".";
      if (userText.startsWith(prefix) && !userText.startsWith(`${prefix}c4`) && !userText.startsWith(`${prefix}connect4`)) return;
      const cleanText = userText.replace(`${prefix}c4`, "").replace(`${prefix}connect4`, "").trim();
      const colNumber = parseInt(cleanText);
      if (isNaN(colNumber) || colNumber < 1 || colNumber > 7) return;
      const chatId = ctx.id;
      const game = global.db.connect4[chatId];
      if (!game || game.status !== "PLAYING") return;
      const currentTurnJid = game.turn === 1 ? game.player1.jid : game.isBot ? "BOT" : game.player2.jid;
      if (senderJid !== currentTurnJid) return;
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      await handleMakeMove(sock, ctx, chatId, colNumber - 1, senderJid, quotedMsg);
      return true;
    } catch (err) {
      console.error("[CONNECT4 BEFORE ERROR]:", err);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      const botName = global.bot?.name || "WudysoftBot";
      const footerText = `${global.bot?.footer || botName}`;
      const prefix = ctx.prefix || ".";
      const senderJid = ctx.sender || msg?.key?.participant;
      const senderName = ctx.pushName || ctx.pushname || senderJid.split("@")[0];
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const chatId = ctx.id;
      const args = ctx.args || [];
      const subCommand = (args[0] || "").trim().toLowerCase();
      initDB(senderJid, senderName);
      const userData = global.db.user[senderJid];
      if (["surrender", "nyerah", "batal", "cancel"].includes(subCommand)) {
        if (!global.db.connect4[chatId]) {
          return ctx.reply("⚠️ Tidak ada sesi game Connect 4 yang sedang berjalan di chat ini.");
        }
        const game = global.db.connect4[chatId];
        if (game.player1.jid !== senderJid && (!game.player2 || game.player2.jid !== senderJid)) {
          return ctx.reply("❌ Kamu bukan peserta dalam pertandingan ini!");
        }
        delete global.db.connect4[chatId];
        saveDB();
        const surrenderText = `Hi ${senderName}!
Permainan Connect 4 telah dihentikan.

–  *S U R R E N D E R*

_Gunakan perintah \`${prefix}connect4\` untuk memulai duel baru._`;
        return await sock.sendMessage(chatId, {
          text: surrenderText
        }, {
          quoted: quotedMsg
        });
      }
      if (["join", "terima", "accept", "gas"].includes(subCommand)) {
        if (!global.db.connect4[chatId]) {
          return ctx.reply(`⚠️ Tidak ada tantangan Connect 4 aktif. Ketik \`${prefix}connect4\` untuk membuat room!`);
        }
        const game = global.db.connect4[chatId];
        if (game.status !== "WAITING") {
          return ctx.reply("⚠️ Game di chat ini sudah dimulai.");
        }
        if (game.player1.jid === senderJid) {
          return ctx.reply("❌ Kamu tidak bisa bertanding melawan dirimu sendiri!");
        }
        if (game.targetJid && game.targetJid !== senderJid) {
          return ctx.reply(`❌ Tantangan ini khusus untuk @${game.targetJid.split("@")[0]}!`, {
            mentions: [game.targetJid]
          });
        }
        if (game.bet > 0) {
          const p2Money = Number(userData.money) || 0;
          if (p2Money < game.bet) {
            return ctx.reply(`❌ Saldo tidak mencukupi untuk taruhan sebesar *Rp ${game.bet.toLocaleString()}* (Saldo: Rp ${p2Money.toLocaleString()}).`);
          }
        }
        game.player2 = {
          jid: senderJid,
          name: senderName
        };
        game.status = "PLAYING";
        game.turn = 1;
        game.expireTime = Date.now() + 60 * 1e3;
        saveDB();
        await ctx.react("🔴");
        return await sendCurrentBoard(sock, ctx, chatId, game, `Duel dimulai! @${game.player1.jid.split("@")[0]} mendapat giliran pertama.`, quotedMsg);
      }
      if (global.db.connect4[chatId]) {
        return ctx.reply(`⚠️ Masih ada sesi Connect 4 yang sedang berlangsung di chat ini!\nKetik \`${prefix}connect4 cancel\` untuk menghentikannya.`);
      }
      if (subCommand === "bot" || subCommand === "ai") {
        await ctx.react("🤖");
        const emptyBoard = Array.from({
          length: ROWS
        }, () => Array(COLS).fill(0));
        global.db.connect4[chatId] = {
          chatId: chatId,
          isBot: true,
          status: "PLAYING",
          board: emptyBoard,
          turn: 1,
          bet: 0,
          expireTime: Date.now() + 60 * 1e3,
          player1: {
            jid: senderJid,
            name: senderName
          },
          player2: {
            jid: "BOT",
            name: `${botName} AI`
          }
        };
        saveDB();
        return await sendCurrentBoard(sock, ctx, chatId, global.db.connect4[chatId], `Mode Solo vs AI Bot aktif! Silakan jatuhkan koin merah pertamamu.`, quotedMsg);
      }
      const mentioned = ctx?.mentionedJid || [];
      const targetJid = mentioned[0] || null;
      if (targetJid && targetJid === senderJid) {
        return ctx.reply("❌ Kamu tidak bisa menantang diri sendiri! Lawan bot dengan `.connect4 bot`");
      }
      let betAmount = 0;
      for (const arg of args) {
        const cleanNum = parseInt(arg.replace(/[^0-9]/g, ""));
        if (!isNaN(cleanNum) && cleanNum > 0 && !arg.startsWith("@")) {
          betAmount = cleanNum;
          break;
        }
      }
      if (betAmount > 0) {
        const p1Money = Number(userData.money) || 0;
        if (p1Money < betAmount) {
          return ctx.reply(`❌ Saldo uang tidak cukup untuk taruhan *Rp ${betAmount.toLocaleString()}* (Saldo: Rp ${p1Money.toLocaleString()}).`);
        }
      }
      await ctx.react("🎮");
      const emptyBoard = Array.from({
        length: ROWS
      }, () => Array(COLS).fill(0));
      global.db.connect4[chatId] = {
        chatId: chatId,
        isBot: false,
        status: "WAITING",
        board: emptyBoard,
        turn: 1,
        bet: betAmount,
        targetJid: targetJid,
        expireTime: Date.now() + 60 * 1e3,
        player1: {
          jid: senderJid,
          name: senderName
        },
        player2: null
      };
      saveDB();
      setTimeout(async () => {
        initDB();
        if (global.db.connect4[chatId]?.status === "WAITING") {
          delete global.db.connect4[chatId];
          saveDB();
          await sock.sendMessage(chatId, {
            text: `⌛ Waktu tantangan Connect 4 habis! Tidak ada yang menerima tantangan dari @${senderJid.split("@")[0]}.`,
            mentions: [senderJid]
          });
        }
      }, 60 * 1e3);
      const buttons = [{
        name: "quick_reply",
        display_text: "⚔️ Terima Tantangan",
        id: `${prefix}connect4 join`
      }, {
        name: "quick_reply",
        display_text: "❌ Batal",
        id: `${prefix}connect4 cancel`
      }];
      const inviteText = `Hi Survivors!
Tantangan taktik Connect 4 (Four in a Row) telah dibuka!

–  *C H A L L E N G E*

┌  ◦  *Penantang* : @${senderJid.split("@")[0]}
│  ◦  *Target* : ${targetJid ? `@${targetJid.split("@")[0]}` : "Siapa saja yang berani!"}
│  ◦  *Taruhan Meja* : Rp ${betAmount.toLocaleString()}
└  ◦  *Timeout* : 60 Detik

_Klik tombol di bawah atau ketik \`${prefix}connect4 join\` untuk bertanding!_`;
      const canvasHtml = buildConnect4CanvasHtml(global.db.connect4[chatId], "WAITING OPPONENT");
      const {
        buffer,
        url
      } = await renderHtmlToImage(canvasHtml);
      const mentions = targetJid ? [senderJid, targetJid] : [senderJid];
      await sendNeoxrConnect4(sock, ctx, chatId, inviteText, footerText, buttons, quotedMsg, mentions, buffer, url);
    } catch (e) {
      console.error("[CONNECT4 ERROR]:", e);
      await ctx.react("❌");
      ctx.reply(`❌ Terjadi kesalahan: ${e.message}`);
    }
  }
};
async function handleMakeMove(sock, ctx, chatId, colIndex, senderJid, quotedMsg) {
  initDB();
  const game = global.db.connect4[chatId];
  if (!game || game.status !== "PLAYING") return;
  const currentPlayerNum = game.turn;
  const currentPlayerObj = currentPlayerNum === 1 ? game.player1 : game.player2;
  const rowDropped = dropCoin(game.board, colIndex, currentPlayerNum);
  if (rowDropped === -1) {
    return ctx.reply(`⚠️ Kolom nomor ${colIndex + 1} sudah penuh! Pilih kolom lain yang masih memiliki ruang.`);
  }
  const winLine = checkWin(game.board, currentPlayerNum);
  if (winLine) {
    delete global.db.connect4[chatId];
    saveDB();
    const winnerName = currentPlayerObj.name;
    const winnerJid = currentPlayerObj.jid;
    const isBotWin = winnerJid === "BOT";
    let rewardText = "";
    if (!isBotWin && game.bet > 0) {
      initDB(winnerJid, winnerName);
      global.db.user[winnerJid].money = (Number(global.db.user[winnerJid].money) || 0) + game.bet * 2;
      global.db.user[winnerJid].exp = (Number(global.db.user[winnerJid].exp) || 0) + 80;
      rewardText = `+Rp ${(game.bet * 2).toLocaleString()} & +80 EXP`;
    } else if (!isBotWin) {
      initDB(winnerJid, winnerName);
      global.db.user[winnerJid].money = (Number(global.db.user[winnerJid].money) || 0) + 4e3;
      global.db.user[winnerJid].exp = (Number(global.db.user[winnerJid].exp) || 0) + 50;
      rewardText = `+Rp 4.000 & +50 EXP`;
    }
    saveDB();
    const canvasHtml = buildConnect4CanvasHtml(game, `${winnerName.toUpperCase()} WINS!`, winLine);
    const {
      buffer,
      url
    } = await renderHtmlToImage(canvasHtml);
    const winText = `Hi Survivors!
Permainan Connect 4 selesai dengan kemenangan gemilang! 🎉

–  *C O N N E C T  4  W I N N E R*

┌  ◦  *Juara* : ${winnerJid !== "BOT" ? `@${winnerJid.split("@")[0]}` : winnerName}
│  ◦  *Koin* : ${currentPlayerNum === 1 ? "🔴 Merah" : "🟡 Kuning"}
└  ◦  *Reward* : ${rewardText || "Kehormatan Taktik"}

_Gunakan perintah \`.connect4\` untuk bermain lagi!_`;
    const playAgainBtn = [{
      name: "quick_reply",
      display_text: "🎮 Main Lagi",
      id: `${ctx?.prefix || "."}connect4`
    }];
    return await sendNeoxrConnect4(sock, ctx, chatId, winText, "Connect 4 Game Over", playAgainBtn, quotedMsg, winnerJid !== "BOT" ? [winnerJid] : [], buffer, url);
  }
  if (isBoardFull(game.board)) {
    delete global.db.connect4[chatId];
    saveDB();
    const canvasHtml = buildConnect4CanvasHtml(game, "BOARD FULL • DRAW MATCH");
    const {
      buffer,
      url
    } = await renderHtmlToImage(canvasHtml);
    const drawText = `Hi Survivors!
Papan sudah penuh dan tidak ada yang berhasil menyusun 4 koin berjajar!

–  *D R A W  M A T C H*

_Permainan berakhir imbang tanpa pemenang._`;
    return await sendNeoxrConnect4(sock, ctx, chatId, drawText, "Connect 4 Draw", [{
      name: "quick_reply",
      display_text: "🎮 Main Lagi",
      id: `${ctx?.prefix || "."}connect4`
    }], quotedMsg, [], buffer, url);
  }
  game.turn = game.turn === 1 ? 2 : 1;
  game.expireTime = Date.now() + 60 * 1e3;
  saveDB();
  if (game.isBot && game.turn === 2) {
    const aiCol = getBestAiMove(game.board);
    dropCoin(game.board, aiCol, 2);
    const botWinLine = checkWin(game.board, 2);
    if (botWinLine) {
      delete global.db.connect4[chatId];
      saveDB();
      const canvasHtml = buildConnect4CanvasHtml(game, "AI BOT WINS!", botWinLine);
      const {
        buffer,
        url
      } = await renderHtmlToImage(canvasHtml);
      const botWinText = `Hi Survivors!
🤖 Bot AI berhasil menyusun 4 koin berjajar dan mengalahkanmu!

–  *B O T  V I C T O R Y*

┌  ◦  *Pemenang* : 🤖 AI Bot
└  ◦  *Koin* : 🟡 Kuning (Kolom ${aiCol + 1})

_Jangan menyerah! Coba lagi dengan mengetik \`.connect4 bot\`_`;
      return await sendNeoxrConnect4(sock, ctx, chatId, botWinText, "Connect 4 Defeat", [{
        name: "quick_reply",
        display_text: "🔁 Balas Dendam",
        id: `${ctx?.prefix || "."}connect4 bot`
      }], quotedMsg, [], buffer, url);
    }
    game.turn = 1;
    game.expireTime = Date.now() + 60 * 1e3;
    saveDB();
    return await sendCurrentBoard(sock, ctx, chatId, game, `🤖 Bot menjatuhkan koin kuning di kolom ${aiCol + 1}. Sekarang giliranmu!`, quotedMsg);
  }
  const nextJid = game.turn === 1 ? game.player1.jid : game.player2.jid;
  return await sendCurrentBoard(sock, ctx, chatId, game, `Koin berhasil dijatuhkan di kolom ${colIndex + 1}. Sekarang giliran @${nextJid.split("@")[0]}!`, quotedMsg);
}
async function sendCurrentBoard(sock, ctx, chatId, game, noticeText, quotedMsg) {
  const prefix = ctx?.prefix || ".";
  const botName = global.bot?.name || "WudysoftBot";
  const footerText = `${global.bot?.footer || botName}`;
  const currentTurnJid = game.turn === 1 ? game.player1.jid : game.isBot ? "BOT" : game.player2.jid;
  const currentCoinColor = game.turn === 1 ? "🔴 Koin Merah" : "🟡 Koin Kuning";
  const buttons = [1, 2, 3, 4, 5, 6, 7].map(num => ({
    name: "quick_reply",
    display_text: `Col ${num}`,
    id: `${prefix}connect4 ${num}`
  }));
  const boardStatusText = `Hi Survivors!
${noticeText}

–  *C O N N E C T  4  S T A T U S*

┌  ◦  *Giliran Aktif* : ${currentTurnJid !== "BOT" ? `@${currentTurnJid.split("@")[0]}` : "🤖 AI Bot"}
│  ◦  *Warna Koin* : ${currentCoinColor}
└  ◦  *Sisa Waktu* : 60 Detik

_Klik tombol kolom (Col 1 - 7) di bawah atau balas chat dengan nomor 1-7 untuk menjatuhkan koin!_`;
  const canvasHtml = buildConnect4CanvasHtml(game, "GAME IN PROGRESS");
  const {
    buffer,
    url
  } = await renderHtmlToImage(canvasHtml);
  const mentions = currentTurnJid !== "BOT" ? [currentTurnJid] : [];
  return await sendNeoxrConnect4(sock, ctx, chatId, boardStatusText, footerText, buttons, quotedMsg, mentions, buffer, url);
}