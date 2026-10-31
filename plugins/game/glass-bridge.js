import axios from "axios";
import db from "../../data/db.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const TOTAL_STEPS = 8;
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

function buildGlassBridgeCanvasHtml(game, statusText = "GAME IN PROGRESS") {
  const botName = global.bot?.name || "WudysoftBot";
  const currentStep = game.currentStep;
  const revealedSteps = game.revealedSteps || [];
  let bridgeRows = "";
  for (let i = 0; i < TOTAL_STEPS; i++) {
    const isCurrent = i === currentStep && currentStep < TOTAL_STEPS;
    const stepData = revealedSteps[i] || null;
    let leftClass = "intact",
      rightClass = "intact";
    let leftContent = "KIRI",
      rightContent = "KANAN";
    if (stepData && stepData.safeSide) {
      if (stepData.safeSide === "LEFT") {
        leftClass = "safe";
        leftContent = "🛡️ AMAN";
        if (stepData.shatteredSide === "RIGHT") {
          rightClass = "shattered";
          rightContent = "💥 PECAH";
        }
      } else {
        rightClass = "safe";
        rightContent = "🛡️ AMAN";
        if (stepData.shatteredSide === "LEFT") {
          leftClass = "shattered";
          leftContent = "💥 PECAH";
        }
      }
    } else if (stepData && stepData.chosen) {
      if (stepData.chosen === "LEFT") {
        if (stepData.safe) {
          leftClass = "safe";
          leftContent = "🛡️ AMAN";
        } else {
          leftClass = "shattered";
          leftContent = "💥 PECAH";
          rightClass = "safe";
          rightContent = "🛡️";
        }
      } else {
        if (stepData.safe) {
          rightClass = "safe";
          rightContent = "🛡️ AMAN";
        } else {
          rightClass = "shattered";
          rightContent = "💥 PECAH";
          leftClass = "safe";
          leftContent = "🛡️";
        }
      }
    }
    bridgeRows += `
      <div class="bridge-row ${isCurrent ? "active-step" : ""}">
        <div class="step-num">#${i + 1}</div>
        <div class="glass-panel left ${leftClass}">${leftContent}</div>
        <div class="bridge-divider"></div>
        <div class="glass-panel right ${rightClass}">${rightContent}</div>
      </div>
    `;
  }
  const activePlayer = game.players?.[game.activePlayerIndex] || {
    name: "Unknown",
    jid: "UNKNOWN"
  };
  const aliveCount = (game.players || []).filter(p => p.isAlive).length;
  const totalPlayers = (game.players || []).length;
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Plus+Jakarta+Sans:wght@700;800;900&display=swap');
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { width: 750px; height: 520px; background: #050508; font-family: 'Share Tech Mono', monospace; display: flex; justify-content: center; align-items: center; overflow: hidden; }
      .arena-box { width: 710px; height: 480px; background: radial-gradient(circle at 50% 20%, rgba(236, 72, 153, 0.25) 0%, rgba(10, 5, 12, 0.98) 85%); border: 2px solid #3d1428; border-radius: 20px; box-shadow: 0 0 45px rgba(236, 72, 153, 0.2), inset 0 0 30px rgba(0,0,0,0.9); padding: 20px 24px; display: flex; flex-direction: column; justify-content: space-between; }
      .header-row { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #4a1530; padding-bottom: 8px; }
      .game-logo { color: #ec4899; font-size: 19px; font-weight: 900; letter-spacing: 2px; }
      .status-pill { border: 1px solid #ec4899; color: #f472b6; background: rgba(236, 72, 153, 0.15); padding: 4px 14px; border-radius: 4px; font-size: 11px; letter-spacing: 1.5px; }
      .bridge-container { display: flex; flex-direction: column; gap: 6px; padding: 6px 0; overflow: hidden; }
      .bridge-row { display: flex; align-items: center; gap: 12px; background: #0f0710; border: 1px solid #290d1c; border-radius: 8px; padding: 4px 14px; }
      .bridge-row.active-step { border-color: #ec4899; background: rgba(236, 72, 153, 0.12); box-shadow: 0 0 12px rgba(236, 72, 153, 0.3); }
      .step-num { width: 32px; color: #94a3b8; font-size: 12px; font-weight: 800; }
      .glass-panel { flex: 1; height: 32px; border-radius: 6px; display: flex; justify-content: center; align-items: center; font-size: 11px; font-weight: 800; letter-spacing: 1px; }
      .glass-panel.intact { background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.35); color: #7dd3fc; }
      .glass-panel.safe { background: rgba(34, 197, 94, 0.25); border: 1px solid #22c55e; color: #4ade80; box-shadow: 0 0 10px rgba(34, 197, 94, 0.4); }
      .glass-panel.shattered { background: rgba(239, 68, 68, 0.3); border: 1px dashed #ef4444; color: #f87171; }
      .bridge-divider { width: 14px; height: 2px; background: #3b1626; }
      .footer-hud { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #3d1428; padding-top: 8px; color: #9d4d73; font-size: 11px; }
      .footer-hud b { color: #ec4899; }
    </style>
  </head>
  <body>
    <div class="arena-box">
      <div class="header-row">
        <div class="game-logo">🦑 SQUID GAME: GLASS BRIDGE</div>
        <div class="status-pill">${statusText}</div>
      </div>
      <div class="bridge-container">${bridgeRows}</div>
      <div class="footer-hud">
        <div>PELARI AKTIF : <b>${activePlayer.name} (#${game.activePlayerIndex + 1})</b></div>
        <div>PESERTA HIDUP : <b>${aliveCount} / ${totalPlayers}</b></div>
        <div>POT HADIAH : <b style="color: #22c55e;">Rp ${(game.bet ? game.bet * totalPlayers : 5e4).toLocaleString()}</b></div>
      </div>
    </div>
  </body>
  </html>`;
}

function initDB(jid = null, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.glassbridge) global.db.glassbridge = {};
  if (jid && !global.db.user[jid]) {
    global.db.user[jid] = {
      name: name || "",
      money: 1e4,
      exp: 0
    };
  }
}

function saveDB() {
  if (typeof db?.write === "function" && global.db) db.write(global.db);
}

function generateBridgeSafePaths() {
  const paths = [];
  for (let i = 0; i < TOTAL_STEPS; i++) {
    paths.push(Math.random() > .5 ? "LEFT" : "RIGHT");
  }
  return paths;
}
async function sendNeoxrGlassBridge(sock, ctx, targetJid, bodyText, footerText, buttons, quoted = null, mentions = [], imageBuffer = null, imageUrl = null) {
  const botName = global.bot?.name || "WudysoftBot";
  const defaultBanner = global.bot?.media?.banner1 || global.bot?.media?.banner2 || "https://files.catbox.moe/g2e6i5.jpg";
  const mediaSource = imageBuffer || (imageUrl ? {
    url: imageUrl
  } : defaultBanner);
  const options = {
    image: mediaSource,
    title: `✦ ${botName} • Glass Bridge Survival ✦`,
    params: {
      bottom_sheet: {
        in_thread_buttons_limit: 2,
        divider_indices: [1],
        list_title: `${botName} • Arah Lompatan`,
        button_title: "🦑 Lompat Kaca"
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
      console.error("[GlassBridge ctx.sendCta Error]:", e.message);
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

function doOneJump(game, choice) {
  const currentStep = game.currentStep;
  const safePath = game.safePaths[currentStep];
  const isSafe = choice === safePath;
  const activePlayer = game.players[game.activePlayerIndex];
  if (!game.revealedSteps[currentStep]) {
    game.revealedSteps[currentStep] = {
      safeSide: safePath,
      shatteredSide: isSafe ? null : choice,
      lastChoice: choice
    };
  } else {
    game.revealedSteps[currentStep].lastChoice = choice;
    if (!isSafe && !game.revealedSteps[currentStep].shatteredSide) {
      game.revealedSteps[currentStep].shatteredSide = choice;
    }
  }
  if (isSafe) {
    game.currentStep++;
    return {
      isSafe: true,
      finished: game.currentStep >= TOTAL_STEPS,
      player: activePlayer
    };
  }
  activePlayer.isAlive = false;
  const remaining = game.players.filter(p => p.isAlive);
  if (remaining.length === 0) {
    return {
      isSafe: false,
      allDead: true,
      player: activePlayer
    };
  }
  let nextIdx = game.activePlayerIndex;
  let guard = 0;
  do {
    nextIdx = (nextIdx + 1) % game.players.length;
    guard++;
  } while (!game.players[nextIdx].isAlive && guard <= game.players.length);
  game.activePlayerIndex = nextIdx;
  game.expireTime = Date.now() + 60 * 1e3;
  return {
    isSafe: false,
    allDead: false,
    player: activePlayer,
    nextPlayer: game.players[nextIdx]
  };
}
async function handleVictory(sock, ctx, chatId, game, winner, quotedMsg, extraLog = "") {
  if (global.db.glassbridge[chatId]) {
    delete global.db.glassbridge[chatId];
    saveDB();
  }
  const isBotWin = winner.jid === "BOT";
  let rewardText = "";
  if (!isBotWin && game.bet > 0) {
    const totalPrize = game.bet * game.players.length;
    initDB(winner.jid, winner.name);
    global.db.user[winner.jid].money = (Number(global.db.user[winner.jid].money) || 0) + totalPrize;
    global.db.user[winner.jid].exp = (Number(global.db.user[winner.jid].exp) || 0) + 150;
    rewardText = `+Rp ${totalPrize.toLocaleString()} & +150 EXP`;
  } else if (!isBotWin) {
    initDB(winner.jid, winner.name);
    global.db.user[winner.jid].money = (Number(global.db.user[winner.jid].money) || 0) + 25e3;
    global.db.user[winner.jid].exp = (Number(global.db.user[winner.jid].exp) || 0) + 100;
    rewardText = `+Rp 25.000 & +100 EXP`;
  }
  saveDB();
  const canvasHtml = buildGlassBridgeCanvasHtml(game, "BRIDGE CLEARED! VICTORY!");
  const {
    buffer,
    url
  } = await renderHtmlToImage(canvasHtml);
  const victoryText = `Hi Survivors!
${extraLog ? extraLog + "\n\n" : ""}Langkah ke-8 berhasil dilalui! Jembatan kaca telah tuntas diseberangi! 🎉🏆

–  *V I C T O R Y  S U R V I V O R*

┌  ◦  *Juara Bertahan* : ${winner.jid !== "BOT" ? `@${winner.jid.split("@")[0]}` : winner.name}
└  ◦  *Hadiah Celengan Babi* : ${rewardText || "Keluar Hidup-Hidup"}

_Ketik \`.glassbridge\` untuk memulai tantangan berikutnya!_`;
  return await sendNeoxrGlassBridge(sock, ctx, chatId, victoryText, "Squid Game Cleared", [{
    name: "quick_reply",
    display_text: "🦑 Main Lagi",
    id: `${ctx?.prefix || "."}glassbridge`
  }], quotedMsg, winner.jid !== "BOT" ? [winner.jid] : [], buffer, url);
}
async function handleDefeat(sock, ctx, chatId, game, lastPlayer, quotedMsg, extraLog = "") {
  if (global.db.glassbridge[chatId]) {
    delete global.db.glassbridge[chatId];
    saveDB();
  }
  const canvasHtml = buildGlassBridgeCanvasHtml(game, "ALL PLAYERS ELIMINATED");
  const {
    buffer,
    url
  } = await renderHtmlToImage(canvasHtml);
  const defeatText = `Hi Survivors!
${extraLog ? extraLog + "\n\n" : ""}KRAAAKKK! Kaca tipis pecah berkeping-keping! 💥💀
Peserta terakhir ${lastPlayer.name} jatuh ke dasar jurang!

–  *A L L  E L I M I N A T E D*

Tidak ada seorang pun peserta yang berhasil menyeberangi jembatan kaca!

_Ketik \`.glassbridge\` untuk mencoba keberuntungan kembali._`;
  return await sendNeoxrGlassBridge(sock, ctx, chatId, defeatText, "Game Over", [{
    name: "quick_reply",
    display_text: "🔁 Balas Dendam",
    id: `${ctx?.prefix || "."}glassbridge`
  }], quotedMsg, [], buffer, url);
}
async function sendBridgeStatus(sock, ctx, chatId, game, noticeText, quotedMsg) {
  const prefix = ctx?.prefix || ".";
  const botName = global.bot?.name || "WudysoftBot";
  const footerText = `${global.bot?.footer || botName}`;
  const activePlayer = game.players[game.activePlayerIndex] || {
    name: "Unknown",
    jid: "UNKNOWN"
  };
  const buttons = [{
    name: "quick_reply",
    display_text: "⬅️ Lompat Kiri",
    id: `${prefix}glassbridge kiri`
  }, {
    name: "quick_reply",
    display_text: "➡️ Lompat Kanan",
    id: `${prefix}glassbridge kanan`
  }];
  const boardStatusText = `Hi Survivors!
${noticeText}

–  *B R I D G E  S T A T U S*

┌  ◦  *Pelari Aktif* : ${activePlayer.jid !== "BOT" ? `@${activePlayer.jid.split("@")[0]}` : "Frontman AI 🤖"} (#${game.activePlayerIndex + 1})
│  ◦  *Deret Kaca Saat Ini* : Langkah #${Math.min(game.currentStep + 1, TOTAL_STEPS)} / ${TOTAL_STEPS}
└  ◦  *Timeout Giliran* : 60 Detik

_Ketuk tombol di bawah atau balas chat dengan *kiri* atau *kanan* untuk melompat!_`;
  const canvasHtml = buildGlassBridgeCanvasHtml(game, `STEP #${Math.min(game.currentStep + 1, TOTAL_STEPS)}`);
  const {
    buffer,
    url
  } = await renderHtmlToImage(canvasHtml);
  const mentions = activePlayer.jid !== "BOT" ? [activePlayer.jid] : [];
  return await sendNeoxrGlassBridge(sock, ctx, chatId, boardStatusText, footerText, buttons, quotedMsg, mentions, buffer, url);
}
async function runBotTurn(sock, ctx, chatId, game, previousNotice, quotedMsg) {
  let log = previousNotice || "";
  let safety = 0;
  const botPlayer = game.players[game.activePlayerIndex];
  while (safety++ < TOTAL_STEPS + 1 && game.status === "PLAYING" && game.players[game.activePlayerIndex]?.jid === "BOT") {
    const currentStep = game.currentStep;
    const revealed = game.revealedSteps[currentStep];
    const aiChoice = revealed?.safeSide || (Math.random() > .5 ? "LEFT" : "RIGHT");
    const result = doOneJump(game, aiChoice);
    if (result.isSafe) {
      log += `\n🤖 Frontman pilih ${aiChoice === "LEFT" ? "⬅️ KIRI" : "➡️ KANAN"} → 🛡️ AMAN.`;
      if (result.finished) {
        saveDB();
        return await handleVictory(sock, ctx, chatId, game, botPlayer, quotedMsg, log);
      }
    } else if (result.allDead) {
      saveDB();
      return await handleDefeat(sock, ctx, chatId, game, botPlayer, quotedMsg, log);
    } else {
      log += `\n🤖 Frontman pilih ${aiChoice === "LEFT" ? "⬅️ KIRI" : "➡️ KANAN"} → 💥 PECAH! Frontman gugur.`;
      if (result.nextPlayer.jid !== "BOT") {
        log += `\nSekarang giliran @${result.nextPlayer.jid.split("@")[0]}.`;
        break;
      }
    }
  }
  saveDB();
  return await sendBridgeStatus(sock, ctx, chatId, game, log, quotedMsg);
}
async function handleStepJump(sock, ctx, chatId, choice, senderJid, quotedMsg) {
  initDB();
  const game = global.db.glassbridge[chatId];
  if (!game || game.status !== "PLAYING") return;
  const activePlayer = game.players[game.activePlayerIndex];
  if (!activePlayer) return;
  const result = doOneJump(game, choice);
  if (result.isSafe && !result.finished) {
    saveDB();
    return await sendBridgeStatus(sock, ctx, chatId, game, `🛡️ *KLIK! KACA TEMPERED AMAN!*\n${activePlayer.name} berhasil melompat ke deret #${game.currentStep + 1} (${choice === "LEFT" ? "KIRI" : "KANAN"})!`, quotedMsg);
  }
  if (result.isSafe && result.finished) {
    return await handleVictory(sock, ctx, chatId, game, activePlayer, quotedMsg);
  }
  if (result.allDead) {
    return await handleDefeat(sock, ctx, chatId, game, activePlayer, quotedMsg, `💥 *KRAAAKKK! KACA PECAH!*\n${activePlayer.name} menginjak kaca tipis (${choice === "LEFT" ? "KIRI" : "KANAN"}) dan gugur jatuh ke jurang!`);
  }
  saveDB();
  const nextPlayer = result.nextPlayer;
  const deathNotice = `💥 *KRAAAKKK! KACA PECAH!*\n${activePlayer.name} menginjak kaca tipis (${choice === "LEFT" ? "KIRI" : "KANAN"}) dan gugur jatuh ke jurang!\n\nJalur aman deret #${game.currentStep + 1} kini terbuka bagi peserta berikutnya: *${nextPlayer.name}*!`;
  if (game.isBot && nextPlayer.jid === "BOT") {
    return await runBotTurn(sock, ctx, chatId, game, deathNotice, quotedMsg);
  }
  return await sendBridgeStatus(sock, ctx, chatId, game, deathNotice, quotedMsg);
}
export default {
  name: "glassbridge",
  aliases: ["jembatankaca", "squidgame", "kaca", "glasswalk"],
  description: "Game survival menegangkan jembatan kaca maut Squid Game PvP antar user atau lawan Frontman Bot bertema Neoxr",
  category: "Game",
  limit: false,
  example: "glassbridge bot (lawan Bot) | glassbridge join (gabung room) | glassbridge start (mulai)",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      if (msg?.key?.fromMe || ctx?.isFromMe) return;
      const senderJid = ctx?.sender || msg?.key?.participant || msg?.key?.remoteJid;
      if (!senderJid) return;
      initDB();
      const userText = (ctx?.text || ctx?.query || msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "").trim().toLowerCase();
      const prefix = ctx?.prefix || ".";
      if (userText.startsWith(prefix) && !userText.startsWith(`${prefix}kaca`) && !userText.startsWith(`${prefix}glassbridge`)) return;
      const cleanText = userText.replace(`${prefix}kaca`, "").replace(`${prefix}glassbridge`, "").trim();
      const chatId = ctx.id;
      const game = global.db.glassbridge[chatId];
      if (!game || game.status !== "PLAYING") return;
      const activePlayer = game.players[game.activePlayerIndex];
      if (!activePlayer || activePlayer.jid !== senderJid) return;
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (["kiri", "left", "l", "1"].includes(cleanText)) {
        await handleStepJump(sock, ctx, chatId, "LEFT", senderJid, quotedMsg);
        return true;
      }
      if (["kanan", "right", "r", "2"].includes(cleanText)) {
        await handleStepJump(sock, ctx, chatId, "RIGHT", senderJid, quotedMsg);
        return true;
      }
    } catch (err) {
      console.error("[GLASS BRIDGE BEFORE ERROR]:", err);
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
        if (!global.db.glassbridge[chatId]) {
          return ctx.reply("⚠️ Tidak ada permainan Jembatan Kaca yang sedang aktif di chat ini.");
        }
        delete global.db.glassbridge[chatId];
        saveDB();
        return await sock.sendMessage(chatId, {
          text: `Hi ${senderName}!\nPermainan Squid Game: Glass Bridge telah dihentikan oleh VIP.\n\n–  *S U R R E N D E R*\n\n_Ketik \`${prefix}glassbridge\` untuk membuka sesi baru._`
        }, {
          quoted: quotedMsg
        });
      }
      if (["join", "gabung", "ikut"].includes(subCommand)) {
        if (!global.db.glassbridge[chatId]) {
          return ctx.reply(`⚠️ Belum ada lobby jembatan kaca yang dibuka. Ketik \`${prefix}glassbridge\` untuk membuat room!`);
        }
        const game = global.db.glassbridge[chatId];
        if (game.status !== "WAITING") return ctx.reply("⚠️ Permainan jembatan kaca sudah dimulai!");
        if (game.players.some(p => p.jid === senderJid)) return ctx.reply("⚠️ Kamu sudah terdaftar dalam antrean peserta!");
        if (game.players.length >= 8) return ctx.reply("⚠️ Batas maksimal peserta (8 orang) telah penuh!");
        if (game.bet > 0) {
          const pMoney = Number(userData.money) || 0;
          if (pMoney < game.bet) {
            return ctx.reply(`❌ Uang tidak cukup untuk taruhan *Rp ${game.bet.toLocaleString()}* (Saldo: Rp ${pMoney.toLocaleString()}).`);
          }
        }
        game.players.push({
          jid: senderJid,
          name: senderName,
          isAlive: true
        });
        saveDB();
        await ctx.react("🦑");
        return await sock.sendMessage(chatId, {
          text: `Hi ${senderName}!\nKamu berhasil mengambil nomor antrean jembatan kaca!\n\n–  *Q U E U E  U P D A T E*\n\n┌  ◦  *Peserta Baru* : @${senderJid.split("@")[0]} (#${game.players.length})\n└  ◦  *Total Peserta* : ${game.players.length} / 8 Orang\n\n_Ketik \`${prefix}glassbridge start\` jika peserta sudah siap melangkah!_`,
          mentions: [senderJid]
        }, {
          quoted: quotedMsg
        });
      }
      if (["start", "mulai"].includes(subCommand)) {
        if (!global.db.glassbridge[chatId]) return ctx.reply(`⚠️ Buat room terlebih dahulu dengan \`${prefix}glassbridge\``);
        const game = global.db.glassbridge[chatId];
        if (game.status !== "WAITING") return ctx.reply("⚠️ Permainan sudah dimulai!");
        game.status = "PLAYING";
        game.currentStep = 0;
        game.activePlayerIndex = 0;
        game.expireTime = Date.now() + 60 * 1e3;
        saveDB();
        await ctx.react("🚶");
        return await sendBridgeStatus(sock, ctx, chatId, game, `Permainan dimulai! Peserta #1 @${game.players[0].jid.split("@")[0]} melangkah ke deret kaca pertama.`, quotedMsg);
      }
      if (global.db.glassbridge[chatId]) {
        return ctx.reply(`⚠️ Masih ada permainan Jembatan Kaca yang aktif!\nKetik \`${prefix}glassbridge cancel\` untuk membatalkannya.`);
      }
      if (subCommand === "bot" || subCommand === "ai" || subCommand === "solo") {
        await ctx.react("🦑");
        global.db.glassbridge[chatId] = {
          chatId: chatId,
          isBot: true,
          status: "PLAYING",
          bet: 0,
          currentStep: 0,
          activePlayerIndex: 0,
          safePaths: generateBridgeSafePaths(),
          revealedSteps: [],
          expireTime: Date.now() + 60 * 1e3,
          players: [{
            jid: senderJid,
            name: senderName,
            isAlive: true
          }, {
            jid: "BOT",
            name: "Frontman AI 🤖",
            isAlive: true
          }]
        };
        saveDB();
        return await sendBridgeStatus(sock, ctx, chatId, global.db.glassbridge[chatId], `Mode Solo Squid Game aktif! Kamu adalah pelari pertama. Pilih kaca KIRI atau KANAN!`, quotedMsg);
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
      await ctx.react("🦑");
      global.db.glassbridge[chatId] = {
        chatId: chatId,
        isBot: false,
        status: "WAITING",
        bet: betAmount,
        currentStep: 0,
        activePlayerIndex: 0,
        safePaths: generateBridgeSafePaths(),
        revealedSteps: [],
        expireTime: Date.now() + 60 * 1e3,
        players: [{
          jid: senderJid,
          name: senderName,
          isAlive: true
        }]
      };
      saveDB();
      setTimeout(async () => {
        initDB();
        if (global.db.glassbridge[chatId]?.status === "WAITING") {
          delete global.db.glassbridge[chatId];
          saveDB();
          await sock.sendMessage(chatId, {
            text: `⌛ Waktu persiapan Jembatan Kaca habis! Sesi dibatalkan.`,
            mentions: [senderJid]
          });
        }
      }, 60 * 1e3);
      const buttons = [{
        name: "quick_reply",
        display_text: "🦑 Ambil Antrean",
        id: `${prefix}glassbridge join`
      }, {
        name: "quick_reply",
        display_text: "🚀 Mulai Lari",
        id: `${prefix}glassbridge start`
      }, {
        name: "quick_reply",
        display_text: "❌ Batal",
        id: `${prefix}glassbridge cancel`
      }];
      const inviteText = `Hi Survivors!
Pintu arena Jembatan Kaca Maut Squid Game telah dibuka!

–  *A R E N A  G L A S S  B R I D G E*

┌  ◦  *Total Deret Kaca* : 8 Langkah Menuju Garis Akhir
│  ◦  *Kapasitas Antrean* : 1 - 8 Peserta
│  ◦  *Taruhan Meja* : Rp ${betAmount.toLocaleString()}
└  ◦  *Timeout Sesi* : 60 Detik

_Klik tombol di bawah atau ketik \`${prefix}glassbridge join\` untuk mengambil rompi nomor antrean!_`;
      const canvasHtml = buildGlassBridgeCanvasHtml(global.db.glassbridge[chatId], "WAITING PLAYERS");
      const {
        buffer,
        url
      } = await renderHtmlToImage(canvasHtml);
      await sendNeoxrGlassBridge(sock, ctx, chatId, inviteText, footerText, buttons, quotedMsg, [senderJid], buffer, url);
    } catch (e) {
      console.error("[GLASS BRIDGE ERROR]:", e);
      await ctx.react("❌");
      ctx.reply(`❌ Terjadi kesalahan: ${e.message}`);
    }
  }
};