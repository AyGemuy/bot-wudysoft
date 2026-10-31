import axios from "axios";
import db from "../../data/db.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const GRID_SIZE = 5;
const LETTERS = ["A", "B", "C", "D", "E"];
const SHIP_SIZES = [3, 2, 1];
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

function buildBattleshipCanvasHtml(game, statusText = "RADAR SCANNING") {
  const botName = global.bot?.name || "WudysoftBot";
  const p1 = game.player1;
  const p2 = game.player2;
  const renderGridCells = (targetGrid, shots) => {
    let cells = "";
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const shotState = shots[r][c];
        let content = "";
        let cellClass = "sea";
        if (shotState === "HIT") {
          content = "💥";
          cellClass = "hit";
        } else if (shotState === "MISS") {
          content = "💧";
          cellClass = "miss";
        }
        cells += `<div class="grid-cell ${cellClass}">${content}</div>`;
      }
    }
    return cells;
  };
  const p1TargetCells = renderGridCells(p2.ships, p1.shots);
  const p2TargetCells = renderGridCells(p1.ships, p2.shots);
  const p1Hp = p2.ships.flat().filter(Boolean).length - p1.shots.flat().filter(s => s === "HIT").length;
  const p2Hp = p1.ships.flat().filter(Boolean).length - p2.shots.flat().filter(s => s === "HIT").length;
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Plus+Jakarta+Sans:wght@700;800;900&display=swap');
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        width: 750px;
        height: 500px;
        background: #03080e;
        font-family: 'Share Tech Mono', monospace;
        display: flex;
        justify-content: center;
        align-items: center;
        overflow: hidden;
      }
      .radar-screen {
        width: 710px;
        height: 460px;
        background: radial-gradient(circle at 50% 50%, rgba(13, 148, 136, 0.2) 0%, rgba(4, 13, 20, 0.98) 85%);
        border: 2px solid #0f766e;
        border-radius: 20px;
        box-shadow: 0 0 40px rgba(13, 148, 136, 0.3), inset 0 0 20px rgba(0,0,0,0.9);
        padding: 22px 26px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        position: relative;
      }
      .top-hud {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #134e4a;
        padding-bottom: 8px;
      }
      .brand-title {
        color: #2dd4bf;
        font-size: 18px;
        font-weight: 900;
        letter-spacing: 2px;
      }
      .status-badge {
        color: #14b8a6;
        border: 1px solid #14b8a6;
        padding: 4px 12px;
        border-radius: 4px;
        font-size: 11px;
        letter-spacing: 1.5px;
        background: rgba(20, 184, 166, 0.1);
      }
      .sector-display {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 20px;
        margin: 10px 0;
      }
      .radar-sector {
        flex: 1;
        background: rgba(10, 25, 34, 0.9);
        border: 1px solid #115e59;
        border-radius: 12px;
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.5);
      }
      .radar-sector.active {
        border-color: #2dd4bf;
        box-shadow: 0 0 15px rgba(45, 212, 191, 0.25);
      }
      .sector-header {
        display: flex;
        justify-content: space-between;
        font-size: 12px;
        color: #5eead4;
        font-weight: 700;
      }
      .grid-box {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 4px;
        aspect-ratio: 1;
        background: #031219;
        padding: 6px;
        border-radius: 8px;
        border: 1px solid #0d9488;
      }
      .grid-cell {
        aspect-ratio: 1;
        background: rgba(15, 40, 50, 0.6);
        border: 1px solid rgba(45, 212, 191, 0.15);
        border-radius: 4px;
        display: flex;
        justify-content: center;
        align-items: center;
        font-size: 16px;
      }
      .grid-cell.hit {
        background: rgba(239, 68, 68, 0.35);
        border-color: #ef4444;
      }
      .grid-cell.miss {
        background: rgba(56, 189, 248, 0.2);
        border-color: #38bdf8;
      }
      .footer-hud {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-top: 1px solid #134e4a;
        padding-top: 8px;
        color: #5eead4;
        font-size: 12px;
      }
      .footer-hud b {
        color: #f59e0b;
      }
    </style>
  </head>
  <body>
    <div class="radar-screen">
      <div class="top-hud">
        <div class="brand-title">⚓ TACTICAL BATTLESHIP SONAR</div>
        <div class="status-badge">${statusText}</div>
      </div>
      <div class="sector-display">
        <div class="radar-sector ${game.turn === 1 ? "active" : ""}">
          <div class="sector-header">
            <div>ADMIRAL: ${p1.name.slice(0, 10)}</div>
            <div>SISA FLEET: ${p2Hp}</div>
          </div>
          <div class="grid-box">
            ${p1TargetCells}
          </div>
        </div>
        <div class="radar-sector ${game.turn === 2 ? "active" : ""}">
          <div class="sector-header">
            <div>ADMIRAL: ${p2.name.slice(0, 10)}</div>
            <div>SISA FLEET: ${p1Hp}</div>
          </div>
          <div class="grid-box">
            ${p2TargetCells}
          </div>
        </div>
      </div>
      <div class="footer-hud">
        <div>RADAR COORDINATES : <b>A1 - E5 (25 SECTORS)</b></div>
        <div>POT TARUHAN : <b style="color: #22c55e;">Rp ${(game.bet ? game.bet * 2 : 0).toLocaleString()}</b></div>
        <div>SYSTEM : <b>${botName}</b></div>
      </div>
    </div>
  </body>
  </html>
  `;
}

function initDB(jid = null, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.battleship) global.db.battleship = {};
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

function deployRandomShips() {
  const grid = Array.from({
    length: GRID_SIZE
  }, () => Array(GRID_SIZE).fill(false));
  for (const size of SHIP_SIZES) {
    let placed = false;
    let attempts = 0;
    while (!placed && attempts < 100) {
      attempts++;
      const isHorizontal = Math.random() > .5;
      const r = Math.floor(Math.random() * (isHorizontal ? GRID_SIZE : GRID_SIZE - size + 1));
      const c = Math.floor(Math.random() * (isHorizontal ? GRID_SIZE - size + 1 : GRID_SIZE));
      let canPlace = true;
      for (let i = 0; i < size; i++) {
        const checkR = isHorizontal ? r : r + i;
        const checkC = isHorizontal ? c + i : c;
        if (grid[checkR][checkC]) {
          canPlace = false;
          break;
        }
      }
      if (canPlace) {
        for (let i = 0; i < size; i++) {
          const placeR = isHorizontal ? r : r + i;
          const placeC = isHorizontal ? c + i : c;
          grid[placeR][placeC] = true;
        }
        placed = true;
      }
    }
  }
  return grid;
}

function getAiTorpedoTarget(shots) {
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (shots[r][c] === "HIT") {
        const neighbors = [
          [r - 1, c],
          [r + 1, c],
          [r, c - 1],
          [r, c + 1]
        ];
        for (const [nr, nc] of neighbors) {
          if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE && shots[nr][nc] === null) {
            return [nr, nc];
          }
        }
      }
    }
  }
  const unshot = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (shots[r][c] === null) unshot.push([r, c]);
    }
  }
  if (unshot.length) {
    return unshot[Math.floor(Math.random() * unshot.length)];
  }
  return [0, 0];
}
async function sendNeoxrBattleship(sock, ctx, targetJid, bodyText, footerText, buttons, quoted = null, mentions = [], imageBuffer = null, imageUrl = null) {
  const botName = global.bot?.name || "WudysoftBot";
  const defaultBanner = global.bot?.media?.banner1 || global.bot?.media?.banner2 || "https://files.catbox.moe/g2e6i5.jpg";
  const mediaSource = imageBuffer || (imageUrl ? {
    url: imageUrl
  } : defaultBanner);
  const options = {
    image: mediaSource,
    title: `✦ ${botName} • Battleship Sonar ✦`,
    params: {
      bottom_sheet: {
        in_thread_buttons_limit: 3,
        divider_indices: [2],
        list_title: `${botName} • Torpedo Control`,
        button_title: "🎯 Tembak Torpedo"
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
      console.error("[Battleship ctx.sendCta Error]:", e.message);
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
  name: "battleship",
  aliases: ["bship", "perangkapal", "kapalperang", "sonar"],
  description: "Game perang kapal laut dan torpedo taktis 5x5 PvP antar user atau lawan AI Bot bertema Neoxr",
  category: "Game",
  limit: false,
  example: "battleship bot (lawan AI) atau battleship @user 10000 (tantang user)",
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
      const userText = (ctx?.text || ctx?.query || msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "").trim().toUpperCase();
      const prefix = ctx?.prefix || ".";
      if (userText.startsWith(prefix) && !userText.startsWith(`${prefix}BSHIP`) && !userText.startsWith(`${prefix}BATTLESHIP`)) return;
      const cleanInput = userText.replace(`${prefix}BSHIP`, "").replace(`${prefix}BATTLESHIP`, "").trim();
      const coordMatch = cleanInput.match(/^([A-E])([1-5])$/i);
      if (!coordMatch) return;
      const rowLetter = coordMatch[1].toUpperCase();
      const colNum = parseInt(coordMatch[2]);
      const rowIndex = LETTERS.indexOf(rowLetter);
      const colIndex = colNum - 1;
      const chatId = ctx.id;
      const game = global.db.battleship[chatId];
      if (!game || game.status !== "PLAYING") return;
      const currentTurnJid = game.turn === 1 ? game.player1.jid : game.isBot ? "BOT" : game.player2.jid;
      if (senderJid !== currentTurnJid) return;
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      await handleFireTorpedo(sock, ctx, chatId, rowIndex, colIndex, senderJid, quotedMsg);
      return true;
    } catch (err) {
      console.error("[BATTLESHIP BEFORE ERROR]:", err);
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
        if (!global.db.battleship[chatId]) {
          return ctx.reply("⚠️ Tidak ada perang armada kapal yang aktif di chat ini.");
        }
        const game = global.db.battleship[chatId];
        if (game.player1.jid !== senderJid && (!game.player2 || game.player2.jid !== senderJid)) {
          return ctx.reply("❌ Kamu bukan admiral dalam peperangan ini!");
        }
        delete global.db.battleship[chatId];
        saveDB();
        const surrenderText = `Hi ${senderName}!
Armada kapal telah menarik diri dari medan pertempuran.

–  *S U R R E N D E R*

_Gunakan perintah \`${prefix}battleship\` untuk memulai pertempuran baru._`;
        return await sock.sendMessage(chatId, {
          text: surrenderText
        }, {
          quoted: quotedMsg
        });
      }
      if (["join", "terima", "accept", "gas"].includes(subCommand)) {
        if (!global.db.battleship[chatId]) {
          return ctx.reply(`⚠️ Tidak ada tantangan perang laut aktif. Ketik \`${prefix}battleship\` untuk menantang lawan!`);
        }
        const game = global.db.battleship[chatId];
        if (game.status !== "WAITING") {
          return ctx.reply("⚠️ Pertempuran armada kapal di chat ini sudah dimulai.");
        }
        if (game.player1.jid === senderJid) {
          return ctx.reply("❌ Kamu tidak bisa berperang melawan armadamu sendiri!");
        }
        if (game.targetJid && game.targetJid !== senderJid) {
          return ctx.reply(`❌ Tantangan ini ditujukan khusus untuk @${game.targetJid.split("@")[0]}!`, {
            mentions: [game.targetJid]
          });
        }
        if (game.bet > 0) {
          const p2Money = Number(userData.money) || 0;
          if (p2Money < game.bet) {
            return ctx.reply(`❌ Saldo tidak cukup untuk taruhan *Rp ${game.bet.toLocaleString()}* (Saldo: Rp ${p2Money.toLocaleString()}).`);
          }
        }
        game.player2 = {
          jid: senderJid,
          name: senderName,
          ships: deployRandomShips(),
          shots: Array.from({
            length: GRID_SIZE
          }, () => Array(GRID_SIZE).fill(null))
        };
        game.status = "PLAYING";
        game.turn = 1;
        game.expireTime = Date.now() + 60 * 1e3;
        saveDB();
        await ctx.react("⚓");
        return await sendRadarBoard(sock, ctx, chatId, game, `Pertempuran laut dimulai! @${game.player1.jid.split("@")[0]} meluncurkan torpedo pertama.`, quotedMsg);
      }
      if (global.db.battleship[chatId]) {
        return ctx.reply(`⚠️ Masih ada peperangan kapal yang sedang aktif di chat ini!\nKetik \`${prefix}battleship cancel\` untuk membatalkannya.`);
      }
      if (subCommand === "bot" || subCommand === "ai") {
        await ctx.react("🤖");
        global.db.battleship[chatId] = {
          chatId: chatId,
          isBot: true,
          status: "PLAYING",
          turn: 1,
          bet: 0,
          expireTime: Date.now() + 60 * 1e3,
          player1: {
            jid: senderJid,
            name: senderName,
            ships: deployRandomShips(),
            shots: Array.from({
              length: GRID_SIZE
            }, () => Array(GRID_SIZE).fill(null))
          },
          player2: {
            jid: "BOT",
            name: `${botName} AI`,
            ships: deployRandomShips(),
            shots: Array.from({
              length: GRID_SIZE
            }, () => Array(GRID_SIZE).fill(null))
          }
        };
        saveDB();
        return await sendRadarBoard(sock, ctx, chatId, global.db.battleship[chatId], `Mode Sonar Solo vs AI Bot aktif! Tembakkan torpedo pertamamu (misal: A1).`, quotedMsg);
      }
      const mentioned = ctx?.mentionedJid || [];
      const targetJid = mentioned[0] || null;
      if (targetJid && targetJid === senderJid) {
        return ctx.reply("❌ Kamu tidak bisa menantang diri sendiri! Main lawan AI dengan `.battleship bot`");
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
      await ctx.react("⚓");
      global.db.battleship[chatId] = {
        chatId: chatId,
        isBot: false,
        status: "WAITING",
        turn: 1,
        bet: betAmount,
        targetJid: targetJid,
        expireTime: Date.now() + 60 * 1e3,
        player1: {
          jid: senderJid,
          name: senderName,
          ships: deployRandomShips(),
          shots: Array.from({
            length: GRID_SIZE
          }, () => Array(GRID_SIZE).fill(null))
        },
        player2: null
      };
      saveDB();
      setTimeout(async () => {
        initDB();
        if (global.db.battleship[chatId]?.status === "WAITING") {
          delete global.db.battleship[chatId];
          saveDB();
          await sock.sendMessage(chatId, {
            text: `⌛ Waktu tantangan perang laut habis! Tidak ada yang menerima tantangan dari @${senderJid.split("@")[0]}.`,
            mentions: [senderJid]
          });
        }
      }, 60 * 1e3);
      const buttons = [{
        name: "quick_reply",
        display_text: "⚔️ Terima Tantangan",
        id: `${prefix}battleship join`
      }, {
        name: "quick_reply",
        display_text: "❌ Batal",
        id: `${prefix}battleship cancel`
      }];
      const inviteText = `Hi Survivors!
Tantangan tempur armada laut Battleship Sonar telah dibuka!

–  *C H A L L E N G E*

┌  ◦  *Admiral Penantang* : @${senderJid.split("@")[0]}
│  ◦  *Target* : ${targetJid ? `@${targetJid.split("@")[0]}` : "Siapa saja yang berani!"}
│  ◦  *Taruhan Meja* : Rp ${betAmount.toLocaleString()}
└  ◦  *Timeout* : 60 Detik

_Klik tombol di bawah atau ketik \`${prefix}battleship join\` untuk bertempur!_`;
      const canvasHtml = buildBattleshipCanvasHtml(global.db.battleship[chatId], "WAITING OPPONENT");
      const {
        buffer,
        url
      } = await renderHtmlToImage(canvasHtml);
      const mentions = targetJid ? [senderJid, targetJid] : [senderJid];
      await sendNeoxrBattleship(sock, ctx, chatId, inviteText, footerText, buttons, quotedMsg, mentions, buffer, url);
    } catch (e) {
      console.error("[BATTLESHIP ERROR]:", e);
      await ctx.react("❌");
      ctx.reply(`❌ Terjadi kesalahan: ${e.message}`);
    }
  }
};
async function handleFireTorpedo(sock, ctx, chatId, r, c, senderJid, quotedMsg) {
  initDB();
  const game = global.db.battleship[chatId];
  if (!game || game.status !== "PLAYING") return;
  const shooterNum = game.turn;
  const shooter = shooterNum === 1 ? game.player1 : game.player2;
  const target = shooterNum === 1 ? game.player2 : game.player1;
  if (shooter.shots[r][c] !== null) {
    return ctx.reply(`⚠️ Sektor ${LETTERS[r]}${c + 1} sudah pernah ditembak! Arahkan torpedo ke koordinat lain.`);
  }
  const isHit = target.ships[r][c] === true;
  shooter.shots[r][c] = isHit ? "HIT" : "MISS";
  const totalEnemyShipCells = target.ships.flat().filter(Boolean).length;
  const totalHits = shooter.shots.flat().filter(s => s === "HIT").length;
  if (totalHits >= totalEnemyShipCells) {
    delete global.db.battleship[chatId];
    saveDB();
    const winnerName = shooter.name;
    const winnerJid = shooter.jid;
    const isBotWin = winnerJid === "BOT";
    let rewardText = "";
    if (!isBotWin && game.bet > 0) {
      initDB(winnerJid, winnerName);
      global.db.user[winnerJid].money = (Number(global.db.user[winnerJid].money) || 0) + game.bet * 2;
      global.db.user[winnerJid].exp = (Number(global.db.user[winnerJid].exp) || 0) + 90;
      rewardText = `+Rp ${(game.bet * 2).toLocaleString()} & +90 EXP`;
    } else if (!isBotWin) {
      initDB(winnerJid, winnerName);
      global.db.user[winnerJid].money = (Number(global.db.user[winnerJid].money) || 0) + 4500;
      global.db.user[winnerJid].exp = (Number(global.db.user[winnerJid].exp) || 0) + 60;
      rewardText = `+Rp 4.500 & +60 EXP`;
    }
    saveDB();
    const canvasHtml = buildBattleshipCanvasHtml(game, `FLEET DESTROYED! ${winnerName.toUpperCase()} WINS!`);
    const {
      buffer,
      url
    } = await renderHtmlToImage(canvasHtml);
    const winText = `Hi Survivors!
Seluruh armada kapal lawan telah ditenggelamkan ke dasar laut! 💥🚢

–  *V I C T O R Y*

┌  ◦  *Admiral Pemenang* : ${winnerJid !== "BOT" ? `@${winnerJid.split("@")[0]}` : winnerName}
└  ◦  *Reward* : ${rewardText || "Kejayaan Lautan"}

_Gunakan perintah \`.battleship\` untuk memulai pertempuran baru!_`;
    return await sendNeoxrBattleship(sock, ctx, chatId, winText, "Battleship Victory", [{
      name: "quick_reply",
      display_text: "⚓ Perang Lagi",
      id: `${ctx?.prefix || "."}battleship`
    }], quotedMsg, winnerJid !== "BOT" ? [winnerJid] : [], buffer, url);
  }
  game.turn = game.turn === 1 ? 2 : 1;
  game.expireTime = Date.now() + 60 * 1e3;
  saveDB();
  const shotNotice = isHit ? `💥 *BOOOM!* Torpedo tepat mengenai kapal di sektor *${LETTERS[r]}${c + 1}*!` : `💧 *SPLASH!* Torpedo meleset ke laut kosong di sektor *${LETTERS[r]}${c + 1}*.`;
  if (game.isBot && game.turn === 2) {
    const [aiR, aiC] = getAiTorpedoTarget(game.player2.shots);
    const aiHit = game.player1.ships[aiR][aiC] === true;
    game.player2.shots[aiR][aiC] = aiHit ? "HIT" : "MISS";
    const p1ShipCells = game.player1.ships.flat().filter(Boolean).length;
    const aiHits = game.player2.shots.flat().filter(s => s === "HIT").length;
    if (aiHits >= p1ShipCells) {
      delete global.db.battleship[chatId];
      saveDB();
      const canvasHtml = buildBattleshipCanvasHtml(game, "BOT DESTROYED YOUR FLEET!");
      const {
        buffer,
        url
      } = await renderHtmlToImage(canvasHtml);
      const botWinText = `Hi Survivors!
Armada kapalmu telah habis dihancurkan oleh AI Bot! 💀🚢

–  *D E F E A T*

┌  ◦  *Pemenang* : 🤖 AI Sonar Bot
└  ◦  *Tembakan Terakhir* : Sektor ${LETTERS[aiR]}${aiC + 1} (HIT)

_Coba atur strategi baru dengan mengetik \`.battleship bot\`_`;
      return await sendNeoxrBattleship(sock, ctx, chatId, botWinText, "Battleship Defeat", [{
        name: "quick_reply",
        display_text: "🔁 Balas Dendam",
        id: `${ctx?.prefix || "."}battleship bot`
      }], quotedMsg, [], buffer, url);
    }
    game.turn = 1;
    game.expireTime = Date.now() + 60 * 1e3;
    saveDB();
    const aiNotice = aiHit ? `🤖 AI menembak sektor *${LETTERS[aiR]}${aiC + 1}* dan MENGENAI kapalmu! 💥` : `🤖 AI menembak sektor *${LETTERS[aiR]}${aiC + 1}* dan MELESET! 💧`;
    return await sendRadarBoard(sock, ctx, chatId, game, `${shotNotice}\n${aiNotice}\n\nSekarang giliranmu membalas!`, quotedMsg);
  }
  const nextJid = game.turn === 1 ? game.player1.jid : game.player2.jid;
  return await sendRadarBoard(sock, ctx, chatId, game, `${shotNotice}\n\nSekarang giliran @${nextJid.split("@")[0]} meluncurkan torpedo!`, quotedMsg);
}
async function sendRadarBoard(sock, ctx, chatId, game, noticeText, quotedMsg) {
  const prefix = ctx?.prefix || ".";
  const botName = global.bot?.name || "WudysoftBot";
  const footerText = `${global.bot?.footer || botName}`;
  const currentTurnJid = game.turn === 1 ? game.player1.jid : game.isBot ? "BOT" : game.player2.jid;
  const buttons = [{
    name: "quick_reply",
    display_text: "🎯 Sektor A1",
    id: `${prefix}battleship A1`
  }, {
    name: "quick_reply",
    display_text: "🎯 Sektor C3",
    id: `${prefix}battleship C3`
  }, {
    name: "quick_reply",
    display_text: "🎯 Sektor E5",
    id: `${prefix}battleship E5`
  }];
  const boardStatusText = `Hi Survivors!
${noticeText}

–  *S O N A R  S T A T U S*

┌  ◦  *Giliran Menembak* : ${currentTurnJid !== "BOT" ? `@${currentTurnJid.split("@")[0]}` : "🤖 AI Bot"}
│  ◦  *Peta Radar* : 5x5 Grid (A1 - E5)
└  ◦  *Timeout* : 60 Detik

_Ketik koordinat target langsung di chat (Contoh: *B2*, *D4*, *A5*)!_`;
  const canvasHtml = buildBattleshipCanvasHtml(game, "SONAR COMBAT ACTIVE");
  const {
    buffer,
    url
  } = await renderHtmlToImage(canvasHtml);
  const mentions = currentTurnJid !== "BOT" ? [currentTurnJid] : [];
  return await sendNeoxrBattleship(sock, ctx, chatId, boardStatusText, footerText, buttons, quotedMsg, mentions, buffer, url);
}