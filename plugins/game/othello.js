import axios from "axios";
import db from "../../data/db.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const SIZE = 6;
const LETTERS = ["A", "B", "C", "D", "E", "F"];
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

function buildOthelloCanvasHtml(game, statusText = "PLAYING") {
  const botName = global.bot?.name || "WudysoftBot";
  const board = game.board || [];
  const legalMoves = getLegalMoves(board, game.turn);
  let gridCells = "";
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const val = board[r]?.[c];
      const isLegal = legalMoves.some(([lr, lc]) => lr === r && lc === c);
      let pieceHtml = "";
      if (val === 1) pieceHtml = `<div class="piece black-piece"></div>`;
      else if (val === 2) pieceHtml = `<div class="piece white-piece"></div>`;
      else if (isLegal) pieceHtml = `<div class="hint-dot"><span>${LETTERS[r]}${c + 1}</span></div>`;
      gridCells += `<div class="cell">${pieceHtml}</div>`;
    }
  }
  const p1Count = board.flat().filter(v => v === 1).length;
  const p2Count = board.flat().filter(v => v === 2).length;
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
      body { width: 750px; height: 520px; background: #06090c; font-family: 'Plus Jakarta Sans', sans-serif; display: flex; justify-content: center; align-items: center; overflow: hidden; }
      .table-stage { width: 710px; height: 480px; background: radial-gradient(circle at 50% 20%, rgba(16, 185, 129, 0.2) 0%, rgba(8, 12, 16, 0.98) 85%); border: 2px solid #1c2b26; border-radius: 20px; box-shadow: 0 25px 60px rgba(0,0,0,0.85); padding: 20px 24px; display: flex; flex-direction: column; justify-content: space-between; }
      .top-row { display: flex; justify-content: space-between; align-items: center; }
      .brand { display: flex; align-items: center; gap: 10px; }
      .brand-icon { background: #10b981; color: #032314; width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 16px; }
      .brand-text { color: #f8fafc; font-size: 18px; font-weight: 900; letter-spacing: 0.5px; }
      .status-pill { border: 1px solid #10b981; color: #34d399; background: rgba(16, 185, 129, 0.1); padding: 4px 14px; border-radius: 20px; font-size: 11px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; }
      .arena-box { display: flex; justify-content: space-between; align-items: center; gap: 20px; }
      .player-podium { width: 140px; background: #0c1411; border: 2px solid #1b2e26; border-radius: 12px; padding: 12px; display: flex; flex-direction: column; align-items: center; gap: 8px; }
      .player-podium.active { border-color: #10b981; background: rgba(16, 185, 129, 0.1); box-shadow: 0 0 15px rgba(16, 185, 129, 0.3); }
      .p-coin-sample { width: 40px; height: 40px; border-radius: 50%; box-shadow: 0 4px 10px rgba(0,0,0,0.5); }
      .p-coin-sample.black { background: radial-gradient(circle at 35% 35%, #334155 0%, #0f172a 70%, #020617 100%); border: 2px solid #475569; }
      .p-coin-sample.white { background: radial-gradient(circle at 35% 35%, #ffffff 0%, #f1f5f9 70%, #cbd5e1 100%); border: 2px solid #94a3b8; }
      .p-name { font-size: 13px; font-weight: 800; color: #f8fafc; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
      .p-count { font-size: 16px; font-weight: 900; color: #10b981; }
      .board-grid-wrapper { background: #064e3b; border: 6px solid #042f24; border-radius: 14px; padding: 8px; box-shadow: inset 0 0 20px rgba(0,0,0,0.8), 0 10px 25px rgba(0,0,0,0.6); display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; }
      .cell { width: 52px; height: 52px; background: #047857; border: 1px solid #065f46; border-radius: 6px; display: flex; justify-content: center; align-items: center; position: relative; }
      .piece { width: 40px; height: 40px; border-radius: 50%; box-shadow: 0 4px 8px rgba(0,0,0,0.5); }
      .black-piece { background: radial-gradient(circle at 35% 35%, #334155 0%, #0f172a 70%, #020617 100%); border: 1px solid #475569; }
      .white-piece { background: radial-gradient(circle at 35% 35%, #ffffff 0%, #f1f5f9 70%, #cbd5e1 100%); border: 1px solid #94a3b8; }
      .hint-dot { width: 24px; height: 24px; background: rgba(255, 255, 255, 0.2); border: 1px dashed rgba(255, 255, 255, 0.5); border-radius: 50%; display: flex; justify-content: center; align-items: center; }
      .hint-dot span { font-size: 8px; font-weight: 900; color: #ffffff; }
      .footer-meta { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #162420; padding-top: 10px; color: #94a3b8; font-size: 12px; font-weight: 700; }
      .footer-meta b { color: #10b981; }
    </style>
  </head>
  <body>
    <div class="table-stage">
      <div class="top-row">
        <div class="brand"><div class="brand-icon">⚪</div><div class="brand-text">OTHELLO <span>REVERSI</span></div></div>
        <div class="status-pill">${statusText}</div>
      </div>
      <div class="arena-box">
        <div class="player-podium ${game.turn === 1 ? "active" : ""}">
          <div class="p-coin-sample black"></div>
          <div class="p-name">${p1Name}</div>
          <div class="p-count">${p1Count} KOIN</div>
        </div>
        <div class="board-grid-wrapper">${gridCells}</div>
        <div class="player-podium ${game.turn === 2 ? "active" : ""}">
          <div class="p-coin-sample white"></div>
          <div class="p-name">${p2Name}</div>
          <div class="p-count">${p2Count} KOIN</div>
        </div>
      </div>
      <div class="footer-meta">
        <div>RULE : <b>JEPIT KOIN LAWAN UNTUK MEMBALIKKAN WARNA</b></div>
        <div>TARUHAN : <b style="color: #22c55e;">Rp ${(game.bet ? game.bet * 2 : 0).toLocaleString()}</b></div>
        <div>BOT : <b>${botName}</b></div>
      </div>
    </div>
  </body>
  </html>`;
}

function initDB(jid = null, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.othello) global.db.othello = {};
  if (jid && !global.db.user[jid]) global.db.user[jid] = {
    name: name || "",
    money: 1e4,
    exp: 0
  };
}

function saveDB() {
  if (typeof db?.write === "function" && global.db) db.write(global.db);
}

function createInitialBoard() {
  const board = Array.from({
    length: SIZE
  }, () => Array(SIZE).fill(0));
  board[2][2] = 2;
  board[2][3] = 1;
  board[3][2] = 1;
  board[3][3] = 2;
  return board;
}
const DIRECTIONS = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1]
];

function isValidMove(board, r, c, player) {
  if (board[r][c] !== 0) return false;
  const opponent = player === 1 ? 2 : 1;
  for (const [dr, dc] of DIRECTIONS) {
    let nr = r + dr,
      nc = c + dc,
      foundOpponent = false;
    while (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE) {
      if (board[nr][nc] === opponent) foundOpponent = true;
      else if (board[nr][nc] === player) {
        if (foundOpponent) return true;
        break;
      } else break;
      nr += dr;
      nc += dc;
    }
  }
  return false;
}

function getLegalMoves(board, player) {
  const moves = [];
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      if (isValidMove(board, r, c, player)) moves.push([r, c]);
  return moves;
}

function executeMove(board, r, c, player) {
  const opponent = player === 1 ? 2 : 1;
  board[r][c] = player;
  for (const [dr, dc] of DIRECTIONS) {
    let nr = r + dr,
      nc = c + dc;
    const toFlip = [];
    while (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE) {
      if (board[nr][nc] === opponent) toFlip.push([nr, nc]);
      else if (board[nr][nc] === player) {
        for (const [fr, fc] of toFlip) board[fr][fc] = player;
        break;
      } else break;
      nr += dr;
      nc += dc;
    }
  }
}

function getBestOthelloAiMove(board) {
  const moves = getLegalMoves(board, 2);
  if (!moves.length) return null;
  const corners = [
    [0, 0],
    [0, SIZE - 1],
    [SIZE - 1, 0],
    [SIZE - 1, SIZE - 1]
  ];
  for (const [cr, cc] of corners)
    if (moves.some(([mr, mc]) => mr === cr && mc === cc)) return [cr, cc];
  let bestMove = moves[0],
    maxScore = -1;
  for (const [mr, mc] of moves) {
    const tempBoard = board.map(row => [...row]);
    executeMove(tempBoard, mr, mc, 2);
    const score = tempBoard.flat().filter(v => v === 2).length;
    if (score > maxScore) {
      maxScore = score;
      bestMove = [mr, mc];
    }
  }
  return bestMove;
}
async function sendNeoxrOthello(sock, ctx, targetJid, bodyText, footerText, buttons, quoted = null, mentions = [], imageBuffer = null, imageUrl = null) {
  const botName = global.bot?.name || "WudysoftBot";
  const defaultBanner = global.bot?.media?.banner1 || global.bot?.media?.banner2 || "https://files.catbox.moe/g2e6i5.jpg";
  const mediaSource = imageBuffer || (imageUrl ? {
    url: imageUrl
  } : defaultBanner);
  const options = {
    image: mediaSource,
    title: `✦ ${botName} • Othello Arena ✦`,
    params: {
      bottom_sheet: {
        in_thread_buttons_limit: 3,
        divider_indices: [2],
        list_title: `${botName} • Letakkan Koin`,
        button_title: "⚪ Pasang Koin"
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
      console.error("[Othello ctx.sendCta Error]:", e.message);
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
async function runBotMoves(sock, ctx, chatId, game, quotedMsg, accumulatedNotice = "") {
  let log = accumulatedNotice;
  let safety = 0;
  while (safety++ < 30) {
    if (game.turn !== 2 || !game.isBot) break;
    const aiMove = getBestOthelloAiMove(game.board);
    if (!aiMove) {
      log += `\n⏭️ Bot tidak punya langkah valid dan dilewati (Pass).`;
      const userMoves = getLegalMoves(game.board, 1);
      if (userMoves.length === 0) {
        return await resolveOthelloGameOver(sock, ctx, chatId, game, quotedMsg, log);
      }
      game.turn = 1;
      game.expireTime = Date.now() + 60 * 1e3;
      saveDB();
      break;
    }
    const [aiR, aiC] = aiMove;
    executeMove(game.board, aiR, aiC, 2);
    log += `\n🤖 Bot meletakkan koin di sektor *${LETTERS[aiR]}${aiC + 1}*.`;
    const userMoves = getLegalMoves(game.board, 1);
    if (userMoves.length > 0) {
      game.turn = 1;
      game.expireTime = Date.now() + 60 * 1e3;
      saveDB();
      break;
    }
    const aiMoves = getLegalMoves(game.board, 2);
    if (aiMoves.length === 0) {
      return await resolveOthelloGameOver(sock, ctx, chatId, game, quotedMsg, log);
    }
    log += `\n⏭️ Kamu tidak punya langkah valid, giliran dilewati. Bot bermain lagi.`;
  }
  saveDB();
  return await sendOthelloBoard(sock, ctx, chatId, game, log, quotedMsg);
}
export default {
  name: "othello",
  aliases: ["reversi", "otelo", "pembalikkoin"],
  description: "Game strategi penjepit koin Othello (Reversi) 6x6 PvP antar user atau lawan AI Bot bertema Neoxr",
  category: "Game",
  limit: false,
  example: "othello bot (lawan AI) atau othello @user 10000 (tantang user)",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      if (msg?.key?.fromMe || ctx?.isFromMe) return;
      const senderJid = ctx?.sender || msg?.key?.participant || msg?.key?.remoteJid;
      if (!senderJid) return;
      initDB();
      const userText = (ctx?.text || ctx?.query || msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "").trim().toUpperCase();
      const prefix = ctx?.prefix || ".";
      const prefixUpper = prefix.toUpperCase();
      const CMD1 = `${prefixUpper}OTHELLO`;
      const CMD2 = `${prefixUpper}REVERSI`;
      if (userText.startsWith(prefixUpper) && !userText.startsWith(CMD1) && !userText.startsWith(CMD2)) return;
      const cleanInput = userText.replace(CMD1, "").replace(CMD2, "").trim();
      const coordMatch = cleanInput.match(/^([A-F])([1-6])$/i);
      if (!coordMatch) return;
      const r = LETTERS.indexOf(coordMatch[1].toUpperCase());
      const c = parseInt(coordMatch[2]) - 1;
      const chatId = ctx.id;
      const game = global.db.othello[chatId];
      if (!game || game.status !== "PLAYING") return;
      const currentTurnJid = game.turn === 1 ? game.player1.jid : game.isBot ? "BOT" : game.player2?.jid || null;
      if (!currentTurnJid || senderJid !== currentTurnJid) return;
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      await handleMakeOthelloMove(sock, ctx, chatId, r, c, senderJid, quotedMsg);
      return true;
    } catch (err) {
      console.error("[OTHELLO BEFORE ERROR]:", err);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      const botName = global.bot?.name || "WudysoftBot";
      const footerText = `${global.bot?.footer || botName}`;
      const prefix = ctx.prefix || ".";
      const senderJid = ctx.sender || msg?.key?.participant || msg?.key?.remoteJid || "";
      if (!senderJid) return ctx.reply("❌ Tidak dapat mengidentifikasi pengirim pesan.");
      const senderName = ctx.pushName || ctx.pushname || senderJid.split("@")[0];
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const chatId = ctx.id;
      const args = ctx.args || [];
      const subCommand = (args[0] || "").trim().toLowerCase();
      initDB(senderJid, senderName);
      const userData = global.db.user[senderJid];
      if (["surrender", "nyerah", "batal", "cancel"].includes(subCommand)) {
        if (!global.db.othello[chatId]) return ctx.reply("⚠️ Tidak ada papan Othello yang sedang aktif di chat ini.");
        const game = global.db.othello[chatId];
        if (game.player1.jid !== senderJid && (!game.player2 || game.player2.jid !== senderJid)) return ctx.reply("❌ Kamu bukan pemain di papan ini!");
        delete global.db.othello[chatId];
        saveDB();
        return await sock.sendMessage(chatId, {
          text: `Hi ${senderName}!\nPertandingan Othello telah dihentikan.\n\n–  *S U R R E N D E R*\n\n_Gunakan perintah \`${prefix}othello\` untuk memulai permainan baru._`
        }, {
          quoted: quotedMsg
        });
      }
      if (["join", "terima", "accept", "gas"].includes(subCommand)) {
        if (!global.db.othello[chatId]) return ctx.reply(`⚠️ Tidak ada tantangan Othello aktif. Ketik \`${prefix}othello\` untuk membuka papan!`);
        const game = global.db.othello[chatId];
        if (game.status !== "WAITING") return ctx.reply("⚠️ Pertandingan di papan ini sudah dimulai.");
        if (game.player1.jid === senderJid) return ctx.reply("❌ Kamu tidak bisa bertanding melawan dirimu sendiri!");
        if (game.targetJid && game.targetJid !== senderJid) return ctx.reply(`❌ Tantangan ini ditujukan khusus untuk @${game.targetJid.split("@")[0]}!`, {
          mentions: [game.targetJid]
        });
        if (game.bet > 0) {
          const p2Money = Number(userData.money) || 0;
          if (p2Money < game.bet) return ctx.reply(`❌ Saldo tidak cukup untuk taruhan *Rp ${game.bet.toLocaleString()}* (Saldo: Rp ${p2Money.toLocaleString()}).`);
        }
        game.player2 = {
          jid: senderJid,
          name: senderName
        };
        game.status = "PLAYING";
        game.turn = 1;
        game.expireTime = Date.now() + 60 * 1e3;
        saveDB();
        await ctx.react("⚫");
        return await sendOthelloBoard(sock, ctx, chatId, game, `Pertandingan dimulai! @${game.player1.jid.split("@")[0]} (⚫ Hitam) melangkah pertama.`, quotedMsg);
      }
      if (global.db.othello[chatId]) {
        return ctx.reply(`⚠️ Masih ada pertandingan Othello yang sedang aktif di chat ini!\nKetik \`${prefix}othello cancel\` untuk membatalkannya.`);
      }
      if (subCommand === "bot" || subCommand === "ai") {
        await ctx.react("🤖");
        global.db.othello[chatId] = {
          chatId: chatId,
          isBot: true,
          status: "PLAYING",
          board: createInitialBoard(),
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
        return await sendOthelloBoard(sock, ctx, chatId, global.db.othello[chatId], `Mode Solo vs AI Bot aktif! Kamu memegang koin ⚫ Hitam.`, quotedMsg);
      }
      const mentioned = ctx?.mentionedJid || [];
      const targetJid = mentioned[0] || null;
      if (targetJid && targetJid === senderJid) return ctx.reply("❌ Kamu tidak bisa menantang diri sendiri! Main lawan AI dengan `.othello bot`");
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
        if (p1Money < betAmount) return ctx.reply(`❌ Saldo uang tidak cukup untuk taruhan *Rp ${betAmount.toLocaleString()}* (Saldo: Rp ${p1Money.toLocaleString()}).`);
      }
      await ctx.react("⚪");
      global.db.othello[chatId] = {
        chatId: chatId,
        isBot: false,
        status: "WAITING",
        board: createInitialBoard(),
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
        if (global.db.othello[chatId]?.status === "WAITING") {
          delete global.db.othello[chatId];
          saveDB();
          await sock.sendMessage(chatId, {
            text: `⌛ Waktu tantangan Othello habis! Tidak ada yang menerima tantangan dari @${senderJid.split("@")[0]}.`,
            mentions: [senderJid]
          });
        }
      }, 60 * 1e3);
      const buttons = [{
        name: "quick_reply",
        display_text: "⚔️ Terima Tantangan",
        id: `${prefix}othello join`
      }, {
        name: "quick_reply",
        display_text: "❌ Batal",
        id: `${prefix}othello cancel`
      }];
      const inviteText = `Hi Survivors!
Tantangan papan taktik Othello (Reversi) telah dibuka!

–  *C H A L L E N G E*

┌  ◦  *Penantang* : @${senderJid.split("@")[0]} (⚫ Hitam)
│  ◦  *Target* : ${targetJid ? `@${targetJid.split("@")[0]}` : "Siapa saja yang berani!"}
│  ◦  *Taruhan Meja* : Rp ${betAmount.toLocaleString()}
└  ◦  *Timeout* : 60 Detik

_Klik tombol di bawah atau ketik \`${prefix}othello join\` untuk bertanding!_`;
      const canvasHtml = buildOthelloCanvasHtml(global.db.othello[chatId], "WAITING OPPONENT");
      const {
        buffer,
        url
      } = await renderHtmlToImage(canvasHtml);
      const mentions = targetJid ? [senderJid, targetJid] : [senderJid];
      await sendNeoxrOthello(sock, ctx, chatId, inviteText, footerText, buttons, quotedMsg, mentions, buffer, url);
    } catch (e) {
      console.error("[OTHELLO ERROR]:", e);
      await ctx.react("❌");
      ctx.reply(`❌ Terjadi kesalahan: ${e.message}`);
    }
  }
};
async function handleMakeOthelloMove(sock, ctx, chatId, r, c, senderJid, quotedMsg) {
  initDB();
  const game = global.db.othello[chatId];
  if (!game || game.status !== "PLAYING") return;
  const currentTurnPlayer = game.turn;
  if (!isValidMove(game.board, r, c, currentTurnPlayer)) {
    return ctx.reply(`⚠️ Langkah ${LETTERS[r]}${c + 1} tidak valid! Letakkan koin pada posisi yang menjepit koin lawan (lihat petunjuk lingkaran).`);
  }
  executeMove(game.board, r, c, currentTurnPlayer);
  let nextPlayer = currentTurnPlayer === 1 ? 2 : 1;
  const nextMoves = getLegalMoves(game.board, nextPlayer);
  let skipNotice = "";
  if (nextMoves.length === 0) {
    const currentMovesAgain = getLegalMoves(game.board, currentTurnPlayer);
    if (currentMovesAgain.length === 0) {
      saveDB();
      return await resolveOthelloGameOver(sock, ctx, chatId, game, quotedMsg, `Koin diletakkan di *${LETTERS[r]}${c + 1}*.`);
    }
    skipNotice = `\n⚠️ Lawan tidak punya langkah valid dan dilewati (Pass).`;
    nextPlayer = currentTurnPlayer;
  }
  game.turn = nextPlayer;
  game.expireTime = Date.now() + 60 * 1e3;
  saveDB();
  const moveNotice = `Koin diletakkan di *${LETTERS[r]}${c + 1}*.${skipNotice}`;
  if (game.isBot && game.turn === 2) {
    return await runBotMoves(sock, ctx, chatId, game, quotedMsg, moveNotice);
  }
  const nextJid = game.turn === 1 ? game.player1.jid : game.player2?.jid || "UNKNOWN";
  return await sendOthelloBoard(sock, ctx, chatId, game, `${moveNotice}\nSekarang giliran @${nextJid.split("@")[0]}!`, quotedMsg);
}
async function resolveOthelloGameOver(sock, ctx, chatId, game, quotedMsg, extraLog = "") {
  if (global.db.othello[chatId]) {
    delete global.db.othello[chatId];
    saveDB();
  }
  const p1Count = game.board.flat().filter(v => v === 1).length;
  const p2Count = game.board.flat().filter(v => v === 2).length;
  let winnerObj = null,
    isDraw = false;
  if (p1Count > p2Count) winnerObj = game.player1;
  else if (p2Count > p1Count) winnerObj = game.player2;
  else isDraw = true;
  let rewardText = "";
  if (!isDraw && winnerObj?.jid && winnerObj.jid !== "BOT") {
    if (game.bet > 0) {
      initDB(winnerObj.jid, winnerObj.name);
      global.db.user[winnerObj.jid].money = (Number(global.db.user[winnerObj.jid].money) || 0) + game.bet * 2;
      global.db.user[winnerObj.jid].exp = (Number(global.db.user[winnerObj.jid].exp) || 0) + 100;
      rewardText = `+Rp ${(game.bet * 2).toLocaleString()} & +100 EXP`;
    } else {
      initDB(winnerObj.jid, winnerObj.name);
      global.db.user[winnerObj.jid].money = (Number(global.db.user[winnerObj.jid].money) || 0) + 5e3;
      global.db.user[winnerObj.jid].exp = (Number(global.db.user[winnerObj.jid].exp) || 0) + 60;
      rewardText = `+Rp 5.000 & +60 EXP`;
    }
  }
  saveDB();
  const statusTitle = isDraw ? "MATCH DRAW!" : `${(winnerObj?.name || "WINNER").toUpperCase()} WINS!`;
  const canvasHtml = buildOthelloCanvasHtml(game, statusTitle);
  const {
    buffer,
    url
  } = await renderHtmlToImage(canvasHtml);
  const gameOverText = `Hi Survivors!
${extraLog ? extraLog + "\n\n" : ""}Pertandingan Othello selesai! Tidak ada langkah tersisa di papan. 🏆

–  *F I N A L  S C O R E*

┌  ◦  *Player 1 (⚫)* : ${p1Count} Koin
│  ◦  *Player 2 (⚪)* : ${p2Count} Koin
└  ◦  *Hasil* : ${isDraw ? "SERI (DRAW)" : `Pemenang: ${winnerObj.name}`}

${rewardText ? `🎁 *Reward:* ${rewardText}\n\n` : ""}_Ketik \`.othello\` untuk memulai duel baru!_`;
  return await sendNeoxrOthello(sock, ctx, chatId, gameOverText, "Othello Game Over", [{
    name: "quick_reply",
    display_text: "⚪ Main Lagi",
    id: `${ctx?.prefix || "."}othello`
  }], quotedMsg, !isDraw && winnerObj?.jid !== "BOT" ? [winnerObj.jid] : [], buffer, url);
}
async function sendOthelloBoard(sock, ctx, chatId, game, noticeText, quotedMsg) {
  const prefix = ctx?.prefix || ".";
  const botName = global.bot?.name || "WudysoftBot";
  const footerText = `${global.bot?.footer || botName}`;
  const currentTurnJid = game.turn === 1 ? game.player1.jid : game.isBot ? "BOT" : game.player2?.jid || "UNKNOWN";
  const currentCoin = game.turn === 1 ? "⚫ Hitam" : "⚪ Putih";
  const legalMoves = getLegalMoves(game.board, game.turn);
  const buttons = legalMoves.slice(0, 3).map(([r, c]) => ({
    name: "quick_reply",
    display_text: `Sektor ${LETTERS[r]}${c + 1}`,
    id: `${prefix}othello ${LETTERS[r]}${c + 1}`
  }));
  const boardStatusText = `Hi Survivors!
${noticeText}

–  *O T H E L L O  S T A T U S*

┌  ◦  *Giliran Aktif* : ${currentTurnJid !== "BOT" && currentTurnJid !== "UNKNOWN" ? `@${currentTurnJid.split("@")[0]}` : "🤖 AI Bot"} (${currentCoin})
│  ◦  *Pilihan Sektor Valid* : ${legalMoves.map(([ r, c ]) => `${LETTERS[r]}${c + 1}`).join(", ") || "Tidak ada"}
└  ◦  *Timeout* : 60 Detik

_Ketik koordinat sektor (Contoh: *C2*, *D5*, *B4*) atau ketuk tombol di bawah!_`;
  const canvasHtml = buildOthelloCanvasHtml(game, "TURN ACTIVE");
  const {
    buffer,
    url
  } = await renderHtmlToImage(canvasHtml);
  const mentions = currentTurnJid !== "BOT" && currentTurnJid !== "UNKNOWN" ? [currentTurnJid] : [];
  return await sendNeoxrOthello(sock, ctx, chatId, boardStatusText, footerText, buttons, quotedMsg, mentions, buffer, url);
}