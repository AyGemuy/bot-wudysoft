import axios from "axios";
import db from "../../data/db.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/game/deck`;
const SUIT_SYMBOLS = {
  SPADES: {
    symbol: "♠",
    color: "black"
  },
  HEARTS: {
    symbol: "♥",
    color: "red"
  },
  DIAMONDS: {
    symbol: "♦",
    color: "red"
  },
  CLUBS: {
    symbol: "♣",
    color: "black"
  }
};

function initDB(jid = null, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.deck) global.db.deck = {};
  if (jid && !jid.includes("BOT") && !global.db.user[jid]) {
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

function clearSession(sessionKey) {
  if (global.db?.deck?.[sessionKey]) {
    delete global.db.deck[sessionKey];
    saveDB();
  }
}

function rewardPlayer(jid, name = "", prizeMoney = 1e4, prizeExp = 300) {
  if (!jid || jid.includes("BOT")) return;
  initDB(jid, name);
  global.db.user[jid].money = (Number(global.db.user[jid].money) || 0) + prizeMoney;
  global.db.user[jid].exp = (Number(global.db.user[jid].exp) || 0) + prizeExp;
  saveDB();
}
async function requestDeck(payload) {
  try {
    const res = await axios.post(API_URL, payload, {
      headers: {
        "Content-Type": "application/json"
      },
      timeout: 3e4,
      validateStatus: status => status < 500
    });
    return res.data;
  } catch (err) {
    return {
      error: err.message || "Network Error"
    };
  }
}

function cleanExpiredSessions() {
  if (!global.db?.deck) return;
  const now = Date.now();
  let changed = false;
  for (const [key, session] of Object.entries(global.db.deck)) {
    const isExpired = session?.expireTime && now > session.expireTime;
    if (isExpired) {
      requestDeck({
        action: "delete",
        gameId: session.gameId
      }).catch(() => {});
      delete global.db.deck[key];
      changed = true;
    }
  }
  if (changed) saveDB();
}
async function sendCTA(sock, ctx, targetId, {
  text,
  footer,
  buttons = [],
  image = null,
  quoted = null,
  mentions = []
}) {
  const botName = global.bot?.name || "WudysoftBot";
  const finalFooter = footer || `${botName} • Blackjack 21 Casino`;
  const formattedButtons = buttons.map(b => {
    if (b.buttonParamsJson) return b;
    if (b.name === "cta_url") {
      return {
        name: "cta_url",
        buttonParamsJson: JSON.stringify({
          display_text: b.display_text || b.text || "Buka Tautan",
          url: b.url || ""
        })
      };
    }
    return {
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: b.display_text || b.text || "Klik",
        id: b.id || b.command || ""
      })
    };
  });
  const destJid = targetId || ctx?.id;
  const options = {
    jid: destJid,
    to: destJid,
    image: image || undefined,
    params: {
      bottom_sheet: {
        in_thread_buttons_limit: 1,
        divider_indices: [1],
        list_title: `${botName} • Blackjack 21`,
        button_title: "Menu Aksi"
      }
    },
    contextInfo: {
      forwardingScore: 999,
      isForwarded: true,
      mentionedJid: mentions || []
    },
    quoted: quoted || undefined
  };
  return await ctx.sendCta(text, finalFooter, formattedButtons, options);
}
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

function parseCard(apiCard) {
  if (!apiCard) return {
    val: "?",
    suit: "♠",
    color: "black",
    isHidden: true
  };
  const rawSuit = String(apiCard.suit || "").toUpperCase();
  const suitInfo = SUIT_SYMBOLS[rawSuit] || {
    symbol: "♠",
    color: "black"
  };
  const val = apiCard.value || "?";
  return {
    val: val,
    suit: suitInfo.symbol,
    color: suitInfo.color,
    isHidden: false
  };
}

function renderCardHTML(cardData, isHidden = false) {
  if (isHidden) {
    return `
      <div class="playing-card face-down">
        <div class="card-back-pattern"></div>
      </div>
    `;
  }
  return `
    <div class="playing-card ${cardData.color}">
      <div class="corner top-left">
        <span class="c-val">${cardData.val}</span>
        <span class="c-suit">${cardData.suit}</span>
      </div>
      <div class="center-suit">${cardData.suit}</div>
      <div class="corner bottom-right">
        <span class="c-val">${cardData.val}</span>
        <span class="c-suit">${cardData.suit}</span>
      </div>
    </div>
  `;
}

function generateBlackjackTableHTML(session, gameData) {
  const isPlaying = gameData.status === "active" || session.state === "PLAYING";
  const rawName = session.playerName || session.playerJid.split("@")[0];
  const cleanName = rawName.length > 12 ? rawName.slice(0, 10) + ".." : rawName;
  let dealerCardsHTML = "";
  if (isPlaying) {
    const visible = parseCard(gameData.dealerVisibleCard);
    dealerCardsHTML += renderCardHTML(visible, false);
    dealerCardsHTML += renderCardHTML({}, true);
  } else {
    const dealerCards = gameData.dealerHand || [gameData.dealerVisibleCard];
    dealerCards.forEach(c => {
      dealerCardsHTML += renderCardHTML(parseCard(c), false);
    });
  }
  let playerCardsHTML = "";
  (gameData.playerHand || []).forEach(c => {
    playerCardsHTML += renderCardHTML(parseCard(c), false);
  });
  const dealerScoreText = isPlaying ? `${gameData.dealerVisibleCardValue || "?"} + ?` : `${gameData.dealerScore || "?"}`;
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 960px;
      height: auto;
      background: #04120a;
      font-family: 'Segoe UI', Roboto, sans-serif;
      color: #ffffff;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .table-felt {
      width: 960px;
      min-height: 600px;
      padding: 26px 30px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: center;
      background: radial-gradient(circle at 50% 50%, #0d4a2b 0%, #082d1a 65%, #03140a 100%);
      border: 14px solid #2b180a;
      border-radius: 40px;
      box-shadow: inset 0 0 60px rgba(0,0,0,0.9), 0 15px 35px rgba(0,0,0,0.8);
      position: relative;
    }

    /* Header Bar */
    .table-header {
      width: 100%;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 12px;
      border-bottom: 2px solid rgba(241, 196, 15, 0.3);
    }
    .table-title {
      font-size: 22px;
      font-weight: 900;
      color: #f1c40f;
      letter-spacing: 2px;
      text-shadow: 0 0 10px rgba(241, 196, 15, 0.5);
    }
    .payout-rule {
      font-size: 13px;
      font-weight: 800;
      color: #d1fae5;
      letter-spacing: 1px;
    }

    /* Hand Sections */
    .hand-container {
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      margin: 10px 0;
    }
    .hand-meta {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 10px;
    }
    .hand-label {
      font-size: 15px;
      font-weight: 800;
      color: #e2e8f0;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .score-badge {
      background: #0f172a;
      border: 2px solid #f1c40f;
      color: #f1c40f;
      font-size: 14px;
      font-weight: 900;
      padding: 2px 10px;
      border-radius: 8px;
      box-shadow: 0 0 10px rgba(241, 196, 15, 0.4);
    }

    /* Cards Flex Row */
    .cards-row {
      display: flex;
      gap: 14px;
      justify-content: center;
      align-items: center;
    }

    /* Real Playing Card */
    .playing-card {
      width: 90px;
      height: 132px;
      background: linear-gradient(145deg, #ffffff 0%, #f8fafc 100%);
      border-radius: 10px;
      border: 1px solid #cbd5e1;
      box-shadow: 0 8px 18px rgba(0,0,0,0.6);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 6px;
      position: relative;
    }
    .playing-card.red { color: #dc2626; }
    .playing-card.black { color: #0f172a; }

    .corner {
      display: flex;
      flex-direction: column;
      align-items: center;
      line-height: 1;
    }
    .top-left { align-self: flex-start; }
    .bottom-right { align-self: flex-end; transform: rotate(180deg); }
    .c-val { font-size: 16px; font-weight: 900; }
    .c-suit { font-size: 14px; }
    .center-suit {
      font-size: 38px;
      align-self: center;
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
    }

    /* Card Face Down Pattern */
    .face-down {
      background: #7f1d1d;
      border: 3px solid #fff;
      padding: 6px;
    }
    .card-back-pattern {
      width: 100%;
      height: 100%;
      background: repeating-linear-gradient(45deg, #991b1b, #991b1b 6px, #b91c1c 6px, #b91c1c 12px);
      border-radius: 6px;
      border: 1px dashed rgba(255,255,255,0.4);
    }

    .table-centerprint {
      font-size: 14px;
      font-weight: 900;
      color: rgba(241, 196, 15, 0.4);
      letter-spacing: 4px;
      text-transform: uppercase;
      border: 2px dashed rgba(241, 196, 15, 0.25);
      border-radius: 9999px;
      padding: 6px 36px;
      margin: 12px 0;
    }
  </style>
</head>
<body>
  <div class="table-felt">
    <!-- Header -->
    <div class="table-header">
      <div class="table-title">♠️ CASINO ROYALE BLACKJACK 21 ♥️</div>
      <div class="payout-rule">DEALER STAND ON 17 • PAYS 3:2</div>
    </div>

    <!-- Dealer Hand -->
    <div class="hand-container">
      <div class="hand-meta">
        <span class="hand-label">🤖 DEALER AI</span>
        <span class="score-badge">${dealerScoreText}</span>
      </div>
      <div class="cards-row">
        ${dealerCardsHTML}
      </div>
    </div>

    <!-- Center Felt Print -->
    <div class="table-centerprint">
      BLACKJACK PAYS 3 TO 2
    </div>

    <!-- Player Hand -->
    <div class="hand-container">
      <div class="cards-row">
        ${playerCardsHTML}
      </div>
      <div class="hand-meta" style="margin-top: 10px; margin-bottom: 0;">
        <span class="hand-label">👤 ${cleanName}</span>
        <span class="score-badge">${gameData.playerScore || 0}</span>
      </div>
    </div>
  </div>
</body>
</html>`;
}
async function announceBlackjackTable(sock, ctx, chatId, session, gameData, extraNote = "", prefix = ".") {
  const {
    buffer: imgBuffer
  } = await renderHtmlToImage(generateBlackjackTableHTML(session, gameData));
  const isGameOver = gameData.status !== "active" && session.state !== "PLAYING";
  const buttons = [];
  if (!isGameOver) {
    buttons.push({
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: "🃏 Tambah Kartu (Hit)",
        id: `${prefix}deck hit`
      })
    }, {
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: "🛑 Tahan (Stand)",
        id: `${prefix}deck stand`
      })
    }, {
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: "🚪 Nyerah (Surrender)",
        id: `${prefix}deck stop`
      })
    });
  } else {
    buttons.push({
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: "🔄 Main Lagi",
        id: `${prefix}deck`
      })
    });
  }
  let text = `♠️ *MEJA BLACKJACK 21 CASINO* ♥️\n\n`;
  if (extraNote) text += `📢 ${extraNote}\n\n`;
  text += `• 👤 *Pemain:* @${session.playerJid.split("@")[0]}\n`;
  text += `• 📊 *Skor Kamu:* *${gameData.playerScore || 0}* / 21\n`;
  text += `• 💰 *Taruhan:* Rp ${session.bet.toLocaleString("id-ID")}\n\n`;
  text += isGameOver ? `_Permainan selesai. Klik tombol di bawah untuk membuka putaran baru!_` : `_Klik tombol **Hit** untuk menambah kartu atau **Stand** untuk mengunci skor!_`;
  await sendCTA(sock, ctx, chatId, {
    text: text,
    buttons: buttons,
    image: imgBuffer,
    mentions: [session.playerJid]
  });
}
async function handleBlackjackAction(sock, ctx, msg, sender, rawText) {
  initDB(sender, ctx?.pushName || "");
  cleanExpiredSessions();
  const parts = rawText.split(/\s+/);
  const action = (parts[1] || "").toLowerCase();
  const chatId = ctx?.id || msg?.key?.remoteJid;
  let sessionKey = null;
  for (const [key, sess] of Object.entries(global.db.deck)) {
    if (sess.playerJid === sender) {
      sessionKey = key;
      break;
    }
  }
  if (!sessionKey || !global.db.deck[sessionKey]) {
    return ctx?.reply ? ctx.reply("❌ Tidak ada sesi Blackjack aktif. Mulai dengan `.deck`") : null;
  }
  const session = global.db.deck[sessionKey];
  const targetChatId = session.chatId;
  const prefix = ctx?.prefix || ".";
  if (action === "stop" || action === "nyerah" || action === "batal") {
    clearSession(sessionKey);
    await requestDeck({
      action: "delete",
      gameId: session.gameId
    });
    const restartButtons = [{
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: "♠️ Main Lagi",
        id: `${prefix}deck`
      })
    }];
    return await sendCTA(sock, ctx, targetChatId, {
      text: `🏳️ Permainan Blackjack dibatalkan atas permintaan @${sender.split("@")[0]}. Taruhan hangus!`,
      buttons: restartButtons,
      mentions: [sender]
    });
  }
  if (session.state !== "PLAYING") return;
  if (action === "hit" || action === "tarik" || action === "tambah") {
    const data = await requestDeck({
      action: "hit",
      gameId: session.gameId
    });
    if (data.error) {
      clearSession(sessionKey);
      return ctx.reply(`⚠️ Terjadi kesalahan API: ${data.error}`);
    }
    session.lastData = data;
    session.expireTime = Date.now() + 18e4;
    if (data.status === "player_bust") {
      session.state = "DEALER_WIN";
      clearSession(sessionKey);
      const note = `💥 *PLAYER BUST!* Kartu kamu melebihi 21 (*${data.playerScore}*). Dealer Menang!`;
      return await announceBlackjackTable(sock, ctx, targetChatId, session, data, note, prefix);
    }
    saveDB();
    const note = `@${sender.split("@")[0]} melakukan *HIT* ➔ Skor saat ini: *${data.playerScore}*`;
    return await announceBlackjackTable(sock, ctx, targetChatId, session, data, note, prefix);
  }
  if (action === "stand" || action === "tahan" || action === "pas") {
    const data = await requestDeck({
      action: "stand",
      gameId: session.gameId
    });
    clearSession(sessionKey);
    if (data.error) {
      return ctx.reply(`⚠️ Terjadi kesalahan API: ${data.error}`);
    }
    session.state = data.status || "GAME_OVER";
    let note = "";
    let winMultiplier = 0;
    if (data.status === "player_win" || data.status === "dealer_bust") {
      winMultiplier = 2;
      note = `🏆 *KAMU MENANG!* ${data.message || `Skor ${data.playerScore} mengalahkan Dealer (${data.dealerScore})`}`;
    } else if (data.status === "dealer_win") {
      note = `💀 *DEALER MENANG!* ${data.message || `Skor Dealer (${data.dealerScore}) mengalahkan kamu (${data.playerScore})`}`;
    } else {
      winMultiplier = 1;
      note = `🤝 *PUSH (SERI)!* Skor sama kuat (${data.playerScore} vs ${data.dealerScore}). Modal kembali.`;
    }
    if (winMultiplier > 0) {
      const prize = Math.floor(session.bet * winMultiplier);
      const expReward = winMultiplier === 2 ? 300 : 50;
      rewardPlayer(sender, session.playerName, prize, expReward);
      note += `\n🎁 *Hadiah:* +Rp ${prize.toLocaleString("id-ID")} Money & +${expReward} EXP!`;
    }
    return await announceBlackjackTable(sock, ctx, targetChatId, session, data, note, prefix);
  }
}
export default {
  name: "deck",
  aliases: ["blackjack", "bj21", "kartu21", "mainkartu"],
  description: "Game Blackjack 21 Casino Visual Meja HTML Anti-Crop Full CTA (API Sync)",
  category: "Game",
  limit: true,
  example: ".deck | .deck hit | .deck stand",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      cleanExpiredSessions();
      const sender = ctx?.sender || msg?.key?.participant || msg?.key?.remoteJid;
      const text = (ctx?.text || ctx?.query || msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "").trim();
      if (/^[.#/!]?(deck|blackjack|bj21)\s+(hit|stand|tarik|tahan|pas|stop|nyerah)/i.test(text)) {
        return await handleBlackjackAction(sock, ctx, msg, sender, text);
      }
    } catch (e) {
      console.error("[BLACKJACK BEFORE ERROR]:", e);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      const chatId = ctx.id;
      const sender = ctx.sender;
      const senderName = ctx.pushName || "Pemain";
      const rawText = (ctx.query || "").trim();
      const prefix = ctx.prefix || ".";
      initDB(sender, senderName);
      cleanExpiredSessions();
      if (/^(hit|stand|tarik|tahan|pas|stop|nyerah)/i.test(rawText)) {
        return await handleBlackjackAction(sock, ctx, msg, sender, `${prefix}deck ${rawText}`);
      }
      const sessionKey = `${chatId}_${sender}`;
      if (global.db.deck[sessionKey]) {
        return await announceBlackjackTable(sock, ctx, chatId, global.db.deck[sessionKey], global.db.deck[sessionKey].lastData, "⚠️ Selesaikan terlebih dahulu meja aktif Anda!", prefix);
      }
      await ctx.react("⏳");
      const data = await requestDeck({
        action: "create"
      });
      if (!data?.gameId) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal membuat meja kartu dari server. Silakan coba lagi.");
      }
      const newSession = {
        sessionId: Date.now(),
        gameId: data.gameId,
        chatId: chatId,
        playerJid: sender,
        playerName: senderName,
        lastData: data,
        bet: 5e3,
        state: "PLAYING",
        expireTime: Date.now() + 18e4
      };
      if (data.playerScore === 21) {
        const standData = await requestDeck({
          action: "stand",
          gameId: data.gameId
        });
        newSession.state = "PLAYER_WIN";
        const prize = Math.floor(newSession.bet * 2.5);
        rewardPlayer(sender, senderName, prize, 450);
        await ctx.react("🎉");
        return await announceBlackjackTable(sock, ctx, chatId, newSession, standData, `🔥 *NATURAL BLACKJACK (SKOR 21)!* 🔥\n🎁 Payout 3:2 (+Rp ${prize.toLocaleString("id-ID")} & +450 EXP)!`, prefix);
      }
      global.db.deck[sessionKey] = newSession;
      saveDB();
      await ctx.react("🃏");
      await announceBlackjackTable(sock, ctx, chatId, newSession, data, "🎲 Kartu dibagikan! Ambil keputusanmu via tombol di bawah.", prefix);
    } catch (err) {
      console.error("[BLACKJACK EXECUTE ERROR]:", err);
      ctx.reply(`❌ Terjadi kesalahan: ${err.message}`);
    }
  }
};