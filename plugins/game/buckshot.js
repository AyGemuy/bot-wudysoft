import axios from "axios";
import db from "../../data/db.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const MAX_HP = 4;
const ITEMS_POOL = [{
  id: "magnifier",
  name: "🔍 Kaca Pembesar",
  desc: "Intip peluru yang ada di bilik saat ini"
}, {
  id: "cigarette",
  name: "🚬 Rokok",
  desc: "Pulihkan +1 HP kesehatan"
}, {
  id: "beer",
  name: "🍺 Bir",
  desc: "Keluarkan peluru saat ini tanpa meletuskannya"
}, {
  id: "saw",
  name: "🪚 Gergaji",
  desc: "Potong laras shotgun (Damage berikutnya x2)"
}, {
  id: "handcuffs",
  name: "⛓️ Borgol",
  desc: "Borgol lawan sehingga gilirannya terlewati"
}];
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

function buildBuckshotCanvasHtml(game, statusText = "ROULETTE ACTIVE") {
  const botName = global.bot?.name || "WudysoftBot";
  const missingPlayer = label => ({
    name: label,
    hp: 0,
    items: [],
    missing: true
  });
  const p1 = game.player1 || missingPlayer("Player 1");
  const p2 = game.player2 || missingPlayer(game.isBot ? "The Dealer 🤖" : "⏳ Menunggu Lawan...");
  const magazine = Array.isArray(game.magazine) ? game.magazine : [];
  const liveCount = magazine.filter(s => s === "LIVE").length;
  const blankCount = magazine.filter(s => s === "BLANK").length;
  const renderHp = player => {
    return Array.from({
      length: MAX_HP
    }, (_, i) => {
      const alive = !player.missing && i < player.hp;
      return `<div class="hp-pip ${alive ? "alive" : "lost"}">${player.missing ? "?" : "⚡"}</div>`;
    }).join("");
  };
  const renderItems = items => {
    if (!items || !items.length) return `<div class="empty-item">KOSONG</div>`;
    return items.map(it => `<div class="item-badge">${it.name.split(" ")[0]}</div>`).join("");
  };
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
        height: 520px;
        background: #040507;
        font-family: 'Share Tech Mono', monospace;
        display: flex;
        justify-content: center;
        align-items: center;
        overflow: hidden;
      }
      .bunker-screen {
        width: 710px;
        height: 480px;
        background: radial-gradient(circle at 50% 30%, rgba(220, 38, 38, 0.22) 0%, rgba(8, 8, 12, 0.98) 85%);
        border: 3px solid #331515;
        border-radius: 20px;
        box-shadow: 0 0 50px rgba(220, 38, 38, 0.25), inset 0 0 30px rgba(0,0,0,0.9);
        padding: 22px 26px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }
      .top-hud {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 2px solid #451a1a;
        padding-bottom: 8px;
      }
      .game-title {
        color: #ef4444;
        font-size: 19px;
        font-weight: 900;
        letter-spacing: 2px;
      }
      .status-pill {
        border: 1px solid #ef4444;
        color: #f87171;
        background: rgba(239, 68, 68, 0.15);
        padding: 4px 14px;
        border-radius: 4px;
        font-size: 11px;
        letter-spacing: 1.5px;
      }
      .center-stage {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 20px;
      }
      .crt-terminal {
        width: 170px;
        background: #0a0a10;
        border: 2px solid #291a1a;
        border-radius: 12px;
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        box-shadow: inset 0 0 15px rgba(0,0,0,0.8);
      }
      .crt-terminal.turn-active {
        border-color: #ef4444;
        box-shadow: 0 0 18px rgba(239, 68, 68, 0.35);
      }
      .player-label {
        font-size: 13px;
        font-weight: 800;
        color: #fca5a5;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .hp-container {
        display: flex;
        gap: 6px;
      }
      .hp-pip {
        width: 26px;
        height: 26px;
        border-radius: 4px;
        display: flex;
        justify-content: center;
        align-items: center;
        font-size: 13px;
      }
      .hp-pip.alive {
        background: #ef4444;
        color: #fff;
        box-shadow: 0 0 8px #ef4444;
      }
      .hp-pip.lost {
        background: #231212;
        color: #451a1a;
      }
      .inventory-box {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        min-height: 28px;
        align-items: center;
      }
      .item-badge {
        font-size: 14px;
        background: #1c1515;
        padding: 3px 6px;
        border-radius: 4px;
        border: 1px solid #3d1c1c;
      }
      .empty-item {
        font-size: 10px;
        color: #553333;
      }
      .shotgun-table {
        flex: 1;
        background: #0d0a0d;
        border: 2px solid #361717;
        border-radius: 14px;
        padding: 14px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
      }
      .shotgun-barrel {
        width: 100%;
        height: 50px;
        background: linear-gradient(90deg, #1f1b1b 0%, #3d3434 40%, #171313 100%);
        border-radius: 8px;
        border: 2px solid #574444;
        display: flex;
        justify-content: center;
        align-items: center;
        position: relative;
        box-shadow: inset 0 0 10px #000;
      }
      .barrel-label {
        color: #a89696;
        font-size: 11px;
        letter-spacing: 2px;
      }
      .saw-alert {
        position: absolute;
        top: -10px;
        background: #ef4444;
        color: #fff;
        font-size: 9px;
        font-weight: 900;
        padding: 2px 8px;
        border-radius: 4px;
        letter-spacing: 1px;
      }
      .chamber-info {
        display: flex;
        gap: 16px;
      }
      .shell-badge {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        font-weight: 800;
        padding: 4px 12px;
        border-radius: 6px;
      }
      .shell-badge.live {
        background: rgba(239, 68, 68, 0.2);
        border: 1px solid #ef4444;
        color: #f87171;
      }
      .shell-badge.blank {
        background: rgba(59, 130, 246, 0.2);
        border: 1px solid #3b82f6;
        color: #60a5fa;
      }
      .footer-hud {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-top: 1px solid #3b1717;
        padding-top: 8px;
        color: #995555;
        font-size: 11px;
      }
      .footer-hud b {
        color: #ef4444;
      }
    </style>
  </head>
  <body>
    <div class="bunker-screen">
      <div class="top-hud">
        <div class="game-title">⚡ 12-GAUGE BUCKSHOT ROULETTE</div>
        <div class="status-pill">${statusText}</div>
      </div>
      <div class="center-stage">
        <div class="crt-terminal ${game.turn === 1 ? "turn-active" : ""}">
          <div class="player-label">${p1.name}</div>
          <div class="hp-container">${renderHp(p1)}</div>
          <small style="color: #664444; font-size: 10px;">ITEMS:</small>
          <div class="inventory-box">${renderItems(p1.items)}</div>
        </div>
        <div class="shotgun-table">
          <div class="shotgun-barrel">
            ${game.isSawed ? '<div class="saw-alert">SAWED OFF (2X DAMAGE)</div>' : ""}
            <div class="barrel-label">PUMP-ACTION 12-GAUGE SHOTGUN</div>
          </div>
          <div class="chamber-info">
            <div class="shell-badge live">🔴 ${liveCount} LIVE SHELLS</div>
            <div class="shell-badge blank">🔵 ${blankCount} BLANKS</div>
          </div>
        </div>
        <div class="crt-terminal ${game.turn === 2 ? "turn-active" : ""}">
          <div class="player-label">${p2.name}</div>
          <div class="hp-container">${renderHp(p2)}</div>
          <small style="color: #664444; font-size: 10px;">ITEMS:</small>
          <div class="inventory-box">${renderItems(p2.items)}</div>
        </div>
      </div>
      <div class="footer-hud">
        <div>CHAMBER CARTRIDGES : <b>${magazine.length} SHELLS SISA</b></div>
        <div>TARUHAN MEJA : <b style="color: #22c55e;">Rp ${(game.bet ? game.bet * 2 : 0).toLocaleString()}</b></div>
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
  if (!global.db.buckshot) global.db.buckshot = {};
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

function loadNewShotgunMagazine() {
  const totalShells = Math.floor(Math.random() * 3) + 4;
  const liveCount = Math.floor(totalShells / 2);
  const blankCount = totalShells - liveCount;
  const mag = [];
  for (let i = 0; i < liveCount; i++) mag.push("LIVE");
  for (let i = 0; i < blankCount; i++) mag.push("BLANK");
  return mag.sort(() => Math.random() - .5);
}

function giveRandomItems(count = 2) {
  const items = [];
  for (let i = 0; i < count; i++) {
    const randomPick = ITEMS_POOL[Math.floor(Math.random() * ITEMS_POOL.length)];
    items.push({
      ...randomPick
    });
  }
  return items;
}

function getDealerDecision(game) {
  const dealer = game.player2;
  const currentShell = game.knownShell || null;
  const cigIndex = dealer.items.findIndex(it => it.id === "cigarette");
  if (cigIndex !== -1 && dealer.hp < MAX_HP) {
    return {
      type: "item",
      index: cigIndex,
      item: dealer.items[cigIndex]
    };
  }
  const magIndex = dealer.items.findIndex(it => it.id === "magnifier");
  if (magIndex !== -1 && !currentShell) {
    return {
      type: "item",
      index: magIndex,
      item: dealer.items[magIndex]
    };
  }
  if (currentShell === "LIVE") {
    const sawIndex = dealer.items.findIndex(it => it.id === "saw");
    if (sawIndex !== -1 && !game.isSawed) {
      return {
        type: "item",
        index: sawIndex,
        item: dealer.items[sawIndex]
      };
    }
    return {
      type: "shoot_opponent"
    };
  }
  if (currentShell === "BLANK") {
    return {
      type: "shoot_self"
    };
  }
  const liveRemaining = game.magazine.filter(s => s === "LIVE").length;
  const blankRemaining = game.magazine.filter(s => s === "BLANK").length;
  if (blankRemaining > liveRemaining) {
    return {
      type: "shoot_self"
    };
  } else {
    return {
      type: "shoot_opponent"
    };
  }
}
async function sendNeoxrBuckshot(sock, ctx, targetJid, bodyText, footerText, buttons, quoted = null, mentions = [], imageBuffer = null, imageUrl = null) {
  const botName = global.bot?.name || "WudysoftBot";
  const defaultBanner = global.bot?.media?.banner1 || global.bot?.media?.banner2 || "https://files.catbox.moe/g2e6i5.jpg";
  const mediaSource = imageBuffer || (imageUrl ? {
    url: imageUrl
  } : defaultBanner);
  const options = {
    image: mediaSource,
    title: `✦ ${botName} • Buckshot Roulette ✦`,
    params: {
      bottom_sheet: {
        in_thread_buttons_limit: 3,
        divider_indices: [2],
        list_title: `${botName} • Aksi Shotgun`,
        button_title: "⚡ Aksi Tembakan"
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
      console.error("[Buckshot ctx.sendCta Error]:", e.message);
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
  name: "buckshot",
  aliases: ["buckshotroulette", "shotgun", "dealer"],
  description: "Game viral Buckshot Roulette 12-gauge PvP antar user atau lawan The Dealer AI dengan canvas realistis bertema Neoxr",
  category: "Game",
  limit: false,
  example: "buckshot bot (lawan Dealer AI) atau buckshot @user 10000 (tantang user)",
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
      if (userText.startsWith(prefix) && !userText.startsWith(`${prefix}shotgun`) && !userText.startsWith(`${prefix}buckshot`)) return;
      const cleanText = userText.replace(`${prefix}shotgun`, "").replace(`${prefix}buckshot`, "").trim();
      const chatId = ctx.id;
      const game = global.db.buckshot[chatId];
      if (!game || game.status !== "PLAYING") return;
      const currentTurnJid = game.turn === 1 ? game.player1.jid : game.isBot ? "BOT" : game.player2?.jid;
      if (senderJid !== currentTurnJid) return;
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (["tembak", "shoot", "lawan", "dealer"].includes(cleanText)) {
        await handleShootAction(sock, ctx, chatId, "OPPONENT", senderJid, quotedMsg);
        return true;
      }
      if (["diri", "self", "tembakdiri"].includes(cleanText)) {
        await handleShootAction(sock, ctx, chatId, "SELF", senderJid, quotedMsg);
        return true;
      }
      if (cleanText.startsWith("item") || cleanText.startsWith("pakai")) {
        const itemArg = cleanText.replace("item", "").replace("pakai", "").trim();
        await handleUseItemAction(sock, ctx, chatId, itemArg, senderJid, quotedMsg);
        return true;
      }
    } catch (err) {
      console.error("[BUCKSHOT BEFORE ERROR]:", err);
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
        if (!global.db.buckshot[chatId]) {
          return ctx.reply("⚠️ Tidak ada duel Buckshot Roulette yang sedang aktif di chat ini.");
        }
        const game = global.db.buckshot[chatId];
        if (game.player1.jid !== senderJid && (!game.player2 || game.player2.jid !== senderJid)) {
          return ctx.reply("❌ Kamu bukan peserta di meja bunker ini!");
        }
        delete global.db.buckshot[chatId];
        saveDB();
        const surrenderText = `Hi ${senderName}!
Pertarungan shotgun telah dihentikan.

–  *S U R R E N D E R*

_Gunakan perintah \`${prefix}buckshot\` untuk memulai permainan baru._`;
        return await sock.sendMessage(chatId, {
          text: surrenderText
        }, {
          quoted: quotedMsg
        });
      }
      if (["join", "terima", "accept", "gas"].includes(subCommand)) {
        if (!global.db.buckshot[chatId]) {
          return ctx.reply(`⚠️ Tidak ada tantangan Buckshot aktif. Ketik \`${prefix}buckshot\` untuk menantang lawan!`);
        }
        const game = global.db.buckshot[chatId];
        if (game.status !== "WAITING") {
          return ctx.reply("⚠️ Pertarungan di meja ini sudah dimulai.");
        }
        if (game.player1.jid === senderJid) {
          return ctx.reply("❌ Kamu tidak bisa bertanding melawan dirimu sendiri!");
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
          hp: MAX_HP,
          items: giveRandomItems(2)
        };
        game.status = "PLAYING";
        game.turn = 1;
        game.magazine = loadNewShotgunMagazine();
        game.isSawed = false;
        game.isHandcuffed = false;
        game.knownShell = null;
        game.expireTime = Date.now() + 60 * 1e3;
        saveDB();
        await ctx.react("⚡");
        return await sendBunkerBoard(sock, ctx, chatId, game, `Bunker dibuka! @${game.player1.jid.split("@")[0]} mendapat giliran pertama.`, quotedMsg);
      }
      if (global.db.buckshot[chatId]) {
        return ctx.reply(`⚠️ Masih ada duel Buckshot yang sedang berlangsung di chat ini!\nKetik \`${prefix}buckshot cancel\` untuk membatalkannya.`);
      }
      if (subCommand === "bot" || subCommand === "ai" || subCommand === "dealer") {
        await ctx.react("⚡");
        global.db.buckshot[chatId] = {
          chatId: chatId,
          isBot: true,
          status: "PLAYING",
          turn: 1,
          bet: 0,
          magazine: loadNewShotgunMagazine(),
          isSawed: false,
          isHandcuffed: false,
          knownShell: null,
          expireTime: Date.now() + 60 * 1e3,
          player1: {
            jid: senderJid,
            name: senderName,
            hp: MAX_HP,
            items: giveRandomItems(2)
          },
          player2: {
            jid: "BOT",
            name: "The Dealer 🤖",
            hp: MAX_HP,
            items: giveRandomItems(2)
          }
        };
        saveDB();
        return await sendBunkerBoard(sock, ctx, chatId, global.db.buckshot[chatId], `Masuk ke ruang bunker bawah tanah! Hadapi The Dealer dan tentukan tembakanmu.`, quotedMsg);
      }
      const mentioned = ctx?.mentionedJid || [];
      const targetJid = mentioned[0] || null;
      if (targetJid && targetJid === senderJid) {
        return ctx.reply("❌ Kamu tidak bisa menantang diri sendiri! Lawan bot dengan `.buckshot bot`");
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
      await ctx.react("🔫");
      global.db.buckshot[chatId] = {
        chatId: chatId,
        isBot: false,
        status: "WAITING",
        turn: 1,
        bet: betAmount,
        targetJid: targetJid,
        magazine: loadNewShotgunMagazine(),
        isSawed: false,
        isHandcuffed: false,
        knownShell: null,
        expireTime: Date.now() + 60 * 1e3,
        player1: {
          jid: senderJid,
          name: senderName,
          hp: MAX_HP,
          items: giveRandomItems(2)
        },
        player2: null
      };
      saveDB();
      setTimeout(async () => {
        initDB();
        if (global.db.buckshot[chatId]?.status === "WAITING") {
          delete global.db.buckshot[chatId];
          saveDB();
          await sock.sendMessage(chatId, {
            text: `⌛ Waktu tantangan Buckshot Roulette habis! Tidak ada yang berani bertaruh nyawa dengan @${senderJid.split("@")[0]}.`,
            mentions: [senderJid]
          });
        }
      }, 60 * 1e3);
      const buttons = [{
        name: "quick_reply",
        display_text: "⚔️ Terima Tantangan",
        id: `${prefix}buckshot join`
      }, {
        name: "quick_reply",
        display_text: "❌ Batal",
        id: `${prefix}buckshot cancel`
      }];
      const inviteText = `Hi Survivors!
Tantangan maut 12-Gauge Buckshot Roulette telah dibuka!

–  *C H A L L E N G E*

┌  ◦  *Penantang* : @${senderJid.split("@")[0]}
│  ◦  *Target* : ${targetJid ? `@${targetJid.split("@")[0]}` : "Siapa saja yang bernyali!"}
│  ◦  *Taruhan Meja* : Rp ${betAmount.toLocaleString()}
└  ◦  *Timeout* : 60 Detik

_Klik tombol di bawah atau ketik \`${prefix}buckshot join\` untuk bertaruh!_`;
      const canvasHtml = buildBuckshotCanvasHtml(global.db.buckshot[chatId], "WAITING OPPONENT");
      const {
        buffer,
        url
      } = await renderHtmlToImage(canvasHtml);
      const mentions = targetJid ? [senderJid, targetJid] : [senderJid];
      await sendNeoxrBuckshot(sock, ctx, chatId, inviteText, footerText, buttons, quotedMsg, mentions, buffer, url);
    } catch (e) {
      console.error("[BUCKSHOT ERROR]:", e);
      await ctx.react("❌");
      ctx.reply(`❌ Terjadi kesalahan: ${e.message}`);
    }
  }
};
async function handleShootAction(sock, ctx, chatId, targetType, senderJid, quotedMsg) {
  initDB();
  const game = global.db.buckshot[chatId];
  if (!game || game.status !== "PLAYING") return;
  const shooter = game.turn === 1 ? game.player1 : game.player2;
  const opponent = game.turn === 1 ? game.player2 : game.player1;
  if (!shooter || !opponent) return;
  if (game.magazine.length === 0) {
    game.magazine = loadNewShotgunMagazine();
    game.isSawed = false;
    game.knownShell = null;
  }
  const currentShell = game.magazine.shift();
  game.knownShell = null;
  const damage = game.isSawed ? 2 : 1;
  game.isSawed = false;
  let actionLog = "";
  let switchTurn = true;
  if (targetType === "OPPONENT") {
    if (currentShell === "LIVE") {
      opponent.hp = Math.max(0, opponent.hp - damage);
      actionLog = `💥 *BOOOOM! PELURU TAJAM (LIVE SHELL)!*\n${shooter.name} menembak ${opponent.name} dan memberikan -${damage} HP damage!`;
    } else {
      actionLog = `💨 *KLIK! PELURU KOSONG (BLANK)!*\n${shooter.name} menembak ${opponent.name}, tetapi hanya bunyi hampa!`;
    }
    switchTurn = true;
  } else {
    if (currentShell === "LIVE") {
      shooter.hp = Math.max(0, shooter.hp - damage);
      actionLog = `💥 *DUAAARRR! PELURU TAJAM (LIVE SHELL)!*\n${shooter.name} menembak dirinya sendiri dan kehilangan -${damage} HP!`;
      switchTurn = true;
    } else {
      actionLog = `😮‍💨 *KLIK! PELURU KOSONG (BLANK)!*\n${shooter.name} menembak dirinya sendiri dan selamat! KARENA BLANK, GILIRAN TETAP MILIKNYA!`;
      switchTurn = false;
    }
  }
  if (shooter.hp <= 0 || opponent.hp <= 0) {
    const winner = shooter.hp > 0 ? shooter : opponent;
    const loser = shooter.hp > 0 ? opponent : shooter;
    delete global.db.buckshot[chatId];
    saveDB();
    const isBotWin = winner.jid === "BOT";
    let rewardText = "";
    if (!isBotWin && game.bet > 0) {
      initDB(winner.jid, winner.name);
      global.db.user[winner.jid].money = (Number(global.db.user[winner.jid].money) || 0) + game.bet * 2;
      global.db.user[winner.jid].exp = (Number(global.db.user[winner.jid].exp) || 0) + 120;
      rewardText = `+Rp ${(game.bet * 2).toLocaleString()} & +120 EXP`;
    } else if (!isBotWin) {
      initDB(winner.jid, winner.name);
      global.db.user[winner.jid].money = (Number(global.db.user[winner.jid].money) || 0) + 6e3;
      global.db.user[winner.jid].exp = (Number(global.db.user[winner.jid].exp) || 0) + 75;
      rewardText = `+Rp 6.000 & +75 EXP`;
    }
    saveDB();
    const canvasHtml = buildBuckshotCanvasHtml(game, `${winner.name.toUpperCase()} SURVIVED!`);
    const {
      buffer,
      url
    } = await renderHtmlToImage(canvasHtml);
    const winMsg = `${actionLog}\n\n–  *D E F I B R I L L A T O R  F A I L U R E*\n\n` + `💀 ${loser.name} telah tewas di meja bunker!\n` + `🏆 Pemenang Duel: *${winner.name}*!\n` + `🎁 Reward: *${rewardText || "Keluar Hidup-Hidup"}*\n\n` + `_Ketik \`.buckshot\` untuk duel kembali!_`;
    return await sendNeoxrBuckshot(sock, ctx, chatId, winMsg, "Buckshot GameOver", [{
      name: "quick_reply",
      display_text: "⚡ Duel Lagi",
      id: `${ctx?.prefix || "."}buckshot`
    }], quotedMsg, winner.jid !== "BOT" ? [winner.jid] : [], buffer, url);
  }
  if (game.magazine.length === 0) {
    game.magazine = loadNewShotgunMagazine();
    game.player1.items.push(...giveRandomItems(1));
    if (game.player2) game.player2.items.push(...giveRandomItems(1));
    actionLog += `\n\n🔄 *Peluru habis! Shotgun diisi ulang dengan amunisi baru & pasokan item masuk!*`;
  }
  if (switchTurn) {
    if (game.isHandcuffed) {
      actionLog += `\n⛓️ *Efek Borgol! Giliran lawan terlewati!*`;
      game.isHandcuffed = false;
    } else {
      game.turn = game.turn === 1 ? 2 : 1;
    }
  }
  game.expireTime = Date.now() + 60 * 1e3;
  saveDB();
  if (game.isBot && game.turn === 2) {
    return await executeDealerTurn(sock, ctx, chatId, game, actionLog, quotedMsg);
  }
  const nextJid = game.turn === 1 ? game.player1.jid : game.player2.jid;
  return await sendBunkerBoard(sock, ctx, chatId, game, `${actionLog}\n\nSekarang giliran @${nextJid.split("@")[0]} memegang shotgun!`, quotedMsg);
}
async function handleUseItemAction(sock, ctx, chatId, itemArg, senderJid, quotedMsg) {
  initDB();
  const game = global.db.buckshot[chatId];
  if (!game || game.status !== "PLAYING") return;
  const currentPlayer = game.turn === 1 ? game.player1 : game.player2;
  if (!currentPlayer) return;
  const items = currentPlayer.items;
  let itemIdx = parseInt(itemArg) - 1;
  if (isNaN(itemIdx) || itemIdx < 0 || itemIdx >= items.length) {
    itemIdx = items.findIndex(it => it.id.includes(itemArg) || it.name.toLowerCase().includes(itemArg));
  }
  if (itemIdx === -1) {
    return ctx.reply("⚠️ Item tidak ditemukan di inventarismu! Ketik `.buckshot` untuk cek daftar item.");
  }
  const usedItem = items.splice(itemIdx, 1)[0];
  let itemEffectNotice = "";
  if (usedItem.id === "cigarette") {
    currentPlayer.hp = Math.min(MAX_HP, currentPlayer.hp + 1);
    itemEffectNotice = `🚬 *${currentPlayer.name} menyalakan rokok!* (+1 HP kesehatan dipulihkan).`;
  } else if (usedItem.id === "beer") {
    if (game.magazine.length === 0) game.magazine = loadNewShotgunMagazine();
    if (game.magazine.length > 0) {
      const ejected = game.magazine.shift();
      itemEffectNotice = `🍺 *${currentPlayer.name} meneguk bir dan memompa shotgun!* Peluru yang keluar adalah *${ejected === "LIVE" ? "🔴 PELURU TAJAM" : "🔵 PELURU KOSONG"}*!`;
    }
  } else if (usedItem.id === "saw") {
    game.isSawed = true;
    itemEffectNotice = `🪚 *${currentPlayer.name} memotong laras shotgun!* Tembakan berikutnya akan menghasilkan 2x DAMAGE!`;
  } else if (usedItem.id === "magnifier") {
    const nextShell = game.magazine[0] || "BLANK";
    game.knownShell = nextShell;
    await ctx.reply(`🔍 *HASIL INTIPAN KACA PEMBESAR:*\nPeluru yang berada di bilik saat ini adalah *${nextShell === "LIVE" ? "🔴 PELURU TAJAM (LIVE)" : "🔵 PELURU KOSONG (BLANK)"}*!`);
    itemEffectNotice = `🔍 *${currentPlayer.name} menggunakan Kaca Pembesar untuk mengintip bilik peluru!*`;
  } else if (usedItem.id === "handcuffs") {
    game.isHandcuffed = true;
    itemEffectNotice = `⛓️ *${currentPlayer.name} memborgol lawan!* Giliran lawan berikutnya akan terlewati.`;
  }
  saveDB();
  return await sendBunkerBoard(sock, ctx, chatId, game, itemEffectNotice, quotedMsg);
}
async function executeDealerTurn(sock, ctx, chatId, game, previousNotice, quotedMsg) {
  const decision = getDealerDecision(game);
  if (decision.type === "item") {
    const used = game.player2.items.splice(decision.index, 1)[0];
    if (!used) {
      return await handleShootAction(sock, ctx, chatId, "OPPONENT", "BOT", quotedMsg);
    }
    let aiItemLog = "";
    if (used.id === "cigarette") {
      game.player2.hp = Math.min(MAX_HP, game.player2.hp + 1);
      aiItemLog = `🤖 *The Dealer menyalakan Rokok!* (+1 HP)`;
    } else if (used.id === "beer") {
      if (game.magazine.length === 0) game.magazine = loadNewShotgunMagazine();
      const ejected = game.magazine.shift();
      aiItemLog = `🤖 *The Dealer meneguk Bir!* Peluru yang keluar: *${ejected === "LIVE" ? "LIVE" : "BLANK"}*`;
    } else if (used.id === "saw") {
      game.isSawed = true;
      aiItemLog = `🤖 *The Dealer menggergaji laras shotgun!* (2x DAMAGE)`;
    } else if (used.id === "magnifier") {
      game.knownShell = game.magazine[0] || null;
      aiItemLog = `🤖 *The Dealer mengintip bilik dengan Kaca Pembesar!*`;
    }
    saveDB();
    return await executeDealerTurn(sock, ctx, chatId, game, `${previousNotice}\n${aiItemLog}`, quotedMsg);
  }
  const targetType = decision.type === "shoot_opponent" ? "OPPONENT" : "SELF";
  return await handleShootAction(sock, ctx, chatId, targetType, "BOT", quotedMsg);
}
async function sendBunkerBoard(sock, ctx, chatId, game, noticeText, quotedMsg) {
  const prefix = ctx?.prefix || ".";
  const botName = global.bot?.name || "WudysoftBot";
  const footerText = `${global.bot?.footer || botName}`;
  const currentTurnJid = game.turn === 1 ? game.player1.jid : game.isBot ? "BOT" : game.player2?.jid;
  const currentTurnName = game.turn === 1 ? game.player1.name : game.isBot ? "The Dealer 🤖" : game.player2?.name || "Lawan";
  const buttons = [{
    name: "quick_reply",
    display_text: "💥 Tembak Lawan",
    id: `${prefix}buckshot lawan`
  }, {
    name: "quick_reply",
    display_text: "🎯 Tembak Diri Sendiri",
    id: `${prefix}buckshot diri`
  }, {
    name: "quick_reply",
    display_text: "📦 Pakai Item 1",
    id: `${prefix}buckshot item 1`
  }];
  const boardStatusText = `Hi Survivors!
${noticeText}

–  *B U N K E R  S T A T U S*

┌  ◦  *Giliran Aktif* : ${currentTurnName}
│  ◦  *Shotgun* : 12-Gauge (${game.isSawed ? "Gergaji 2x DMG 🔥" : "Laras Standar"})
│  ◦  *Amunisi Sisa* : ${game.magazine.length} Peluru
└  ◦  *Timeout* : 60 Detik

_Pilih tombol aksi di bawah atau balas chat dengan *lawan*, *diri*, atau *item 1*!_`;
  const canvasHtml = buildBuckshotCanvasHtml(game, "TURN ACTIVE");
  const {
    buffer,
    url
  } = await renderHtmlToImage(canvasHtml);
  const mentions = currentTurnJid && currentTurnJid !== "BOT" ? [currentTurnJid] : [];
  return await sendNeoxrBuckshot(sock, ctx, chatId, boardStatusText, footerText, buttons, quotedMsg, mentions, buffer, url);
}