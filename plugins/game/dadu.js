import axios from "axios";
import db from "../../data/db.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const DICE_EMOJIS = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
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

function buildLiarsDiceCanvasHtml(game, statusText = "ROUND ACTIVE", revealAll = false) {
  const botName = global.bot?.name || "WudysoftBot";
  const p1 = game.player1 || {
    name: "Player 1",
    dice: []
  };
  const p2 = game.player2 || {
    name: game.isBot ? `${botName} AI 🤖` : "⏳ Menunggu Lawan...",
    dice: []
  };
  const renderDice = (diceArray, isHidden = true) => {
    if (!diceArray || !diceArray.length) return `<div class="dice-box hidden"><span>—</span></div>`;
    return diceArray.map(val => {
      if (isHidden && !revealAll) return `<div class="dice-box hidden"><span>🎲</span></div>`;
      return `<div class="dice-box pips-${val}"><div class="pip-label">${DICE_EMOJIS[val - 1]}</div></div>`;
    }).join("");
  };
  const currentBid = game.currentBid ? `<span style="color: #f59e0b;">${game.currentBid.count}x Dadu Angka [ ${game.currentBid.face} ]</span>` : "BELUM ADA BID (AWAL RONDE)";
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@700;800;900&family=Rajdhani:wght@700&display=swap');
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { width: 750px; height: 500px; background: #080706; font-family: 'Plus Jakarta Sans', sans-serif; display: flex; justify-content: center; align-items: center; overflow: hidden; }
      .tavern-table { width: 710px; height: 460px; background: radial-gradient(circle at 50% 30%, rgba(180, 83, 9, 0.22) 0%, rgba(18, 12, 7, 0.98) 85%); border: 2px solid #3b2413; border-radius: 20px; box-shadow: 0 25px 60px rgba(0,0,0,0.9); padding: 22px 26px; display: flex; flex-direction: column; justify-content: space-between; }
      .top-row { display: flex; justify-content: space-between; align-items: center; }
      .brand { display: flex; align-items: center; gap: 10px; }
      .brand-icon { background: #d97706; color: #000; width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 18px; }
      .brand-text { color: #f8fafc; font-size: 18px; font-weight: 900; letter-spacing: 0.5px; }
      .status-pill { border: 1px solid #d97706; color: #fbbf24; background: rgba(20, 14, 8, 0.85); padding: 5px 14px; border-radius: 20px; font-size: 11px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; }
      .stage-arena { display: flex; justify-content: space-between; align-items: center; gap: 20px; margin: 10px 0; }
      .player-podium { flex: 1; background: #140d07; border: 2px solid #2d1c10; border-radius: 14px; padding: 14px; display: flex; flex-direction: column; gap: 10px; box-shadow: 0 6px 20px rgba(0,0,0,0.6); }
      .player-podium.active { border-color: #d97706; box-shadow: 0 0 20px rgba(217, 119, 6, 0.35); }
      .p-header { display: flex; justify-content: space-between; align-items: center; }
      .p-name { font-size: 14px; font-weight: 900; color: #fef3c7; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px; }
      .dice-count-badge { font-size: 11px; font-weight: 800; color: #f59e0b; background: rgba(245, 158, 11, 0.15); padding: 2px 8px; border-radius: 4px; }
      .dice-tray { display: flex; flex-wrap: wrap; gap: 6px; min-height: 50px; align-items: center; background: #0a0604; padding: 8px; border-radius: 8px; border: 1px solid #23150b; }
      .dice-box { width: 38px; height: 38px; background: radial-gradient(circle at 35% 35%, #fffbeb 0%, #fef3c7 60%, #fde68a 100%); border: 2px solid #b45309; border-radius: 8px; display: flex; justify-content: center; align-items: center; box-shadow: 0 4px 8px rgba(0,0,0,0.5); }
      .dice-box.hidden { background: #24140a; border-color: #451a03; color: #92400e; font-size: 20px; }
      .pip-label { font-size: 26px; color: #78350f; line-height: 1; }
      .bid-banner { background: #190f07; border: 1px solid #3d2311; border-radius: 12px; padding: 12px 18px; display: flex; justify-content: space-between; align-items: center; }
      .bid-title { font-size: 12px; color: #92400e; font-weight: 800; letter-spacing: 1.5px; }
      .bid-val { font-size: 15px; font-weight: 900; color: #fef3c7; }
      .footer-meta { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #2d1a0c; padding-top: 10px; color: #92400e; font-size: 12px; font-weight: 700; }
      .footer-meta b { color: #f59e0b; }
    </style>
  </head>
  <body>
    <div class="tavern-table">
      <div class="top-row">
        <div class="brand"><div class="brand-icon">🎲</div><div class="brand-text">LIAR'S DICE <span>PERUDO</span></div></div>
        <div class="status-pill">${statusText}</div>
      </div>
      <div class="stage-arena">
        <div class="player-podium ${game.turn === 1 ? "active" : ""}">
          <div class="p-header">
            <div class="p-name">${p1.name}</div>
            <div class="dice-count-badge">${p1.dice.length} DADU</div>
          </div>
          <div class="dice-tray">${renderDice(p1.dice, true)}</div>
        </div>
        <div class="player-podium ${game.turn === 2 ? "active" : ""}">
          <div class="p-header">
            <div class="p-name">${p2.name}</div>
            <div class="dice-count-badge">${p2.dice.length} DADU</div>
          </div>
          <div class="dice-tray">${renderDice(p2.dice, true)}</div>
        </div>
      </div>
      <div class="bid-banner">
        <div class="bid-title">TAWARAN SAAT INI</div>
        <div class="bid-val">${currentBid}</div>
      </div>
      <div class="footer-meta">
        <div>RULE : <b>NAIKKAN JUMLAH / ANGKA DADU ATAU PANGGIL LIAR!</b></div>
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
  if (!global.db.liarsdice) global.db.liarsdice = {};
  if (jid && !global.db.user[jid]) global.db.user[jid] = {
    name: name || "",
    money: 1e4,
    exp: 0
  };
}

function saveDB() {
  if (typeof db?.write === "function" && global.db) db.write(global.db);
}

function rollDiceSet(count) {
  const dice = [];
  for (let i = 0; i < count; i++) dice.push(Math.floor(Math.random() * 6) + 1);
  return dice.sort((a, b) => a - b);
}

function getAiMove(game) {
  const myDice = game.player2.dice;
  const currentBid = game.currentBid;
  const totalDiceOnTable = game.player1.dice.length + myDice.length;
  if (!currentBid) {
    const faceCounts = {};
    myDice.forEach(d => {
      faceCounts[d] = (faceCounts[d] || 0) + 1;
    });
    const bestFace = Object.keys(faceCounts).reduce((a, b) => faceCounts[a] > faceCounts[b] ? a : b);
    return {
      action: "bid",
      count: faceCounts[bestFace],
      face: parseInt(bestFace)
    };
  }
  const myCount = myDice.filter(d => d === currentBid.face || d === 1).length;
  const expectedTotal = myCount + Math.round((totalDiceOnTable - myDice.length) / 3);
  if (currentBid.count > expectedTotal + 1 || currentBid.count > totalDiceOnTable) {
    return {
      action: "liar"
    };
  }
  if (currentBid.face < 6 && Math.random() > .4) {
    return {
      action: "bid",
      count: currentBid.count,
      face: currentBid.face + 1
    };
  }
  return {
    action: "bid",
    count: currentBid.count + 1,
    face: currentBid.face
  };
}
async function sendNeoxrLiarsDice(sock, ctx, targetJid, bodyText, footerText, buttons, quoted = null, mentions = [], imageBuffer = null, imageUrl = null) {
  const botName = global.bot?.name || "WudysoftBot";
  const defaultBanner = global.bot?.media?.banner1 || global.bot?.media?.banner2 || "https://files.catbox.moe/g2e6i5.jpg";
  const mediaSource = imageBuffer || (imageUrl ? {
    url: imageUrl
  } : defaultBanner);
  const options = {
    image: mediaSource,
    title: `✦ ${botName} • Liar's Dice Saloon ✦`,
    params: {
      bottom_sheet: {
        in_thread_buttons_limit: 3,
        divider_indices: [2],
        list_title: `${botName} • Aksi Dadu`,
        button_title: "🎲 Aksi Meja Dadu"
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
      console.error("[LiarsDice ctx.sendCta Error]:", e.message);
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
  name: "liarsdice",
  aliases: ["perudo", "dadubohong", "bluffdice", "dudo"],
  description: "Game gertakan dadu panjang Liar's Dice (Perudo) PvP antar user atau lawan AI Bot dengan canvas realistis bertema Neoxr",
  category: "Game",
  limit: false,
  example: "liarsdice bot (lawan AI) atau liarsdice @user 10000 (tantang user)",
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
      const prefix = (ctx?.prefix || ".").toLowerCase();
      if (userText.startsWith(prefix) && !userText.startsWith(`${prefix}perudo`) && !userText.startsWith(`${prefix}liarsdice`)) return;
      const cleanText = userText.replace(`${prefix}perudo`, "").replace(`${prefix}liarsdice`, "").trim();
      const chatId = ctx.id;
      const game = global.db.liarsdice[chatId];
      if (!game || game.status !== "PLAYING") return;
      const currentTurnJid = game.turn === 1 ? game.player1.jid : game.isBot ? "BOT" : game.player2?.jid || null;
      if (!currentTurnJid || senderJid !== currentTurnJid) return;
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (["liar", "bohong", "dudo", "bual"].includes(cleanText)) {
        await handleCallLiar(sock, ctx, chatId, senderJid, quotedMsg);
        return true;
      }
      const bidMatch = cleanText.match(/^(\d+)\s*(?:x|\s+)\s*([1-6])$/i);
      if (bidMatch) {
        const count = parseInt(bidMatch[1]);
        const face = parseInt(bidMatch[2]);
        await handlePlayerBid(sock, ctx, chatId, count, face, senderJid, quotedMsg);
        return true;
      }
    } catch (err) {
      console.error("[LIARS DICE BEFORE ERROR]:", err);
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
        if (!global.db.liarsdice[chatId]) return ctx.reply("⚠️ Tidak ada meja permainan Liar's Dice yang sedang aktif di chat ini.");
        const game = global.db.liarsdice[chatId];
        if (game.player1.jid !== senderJid && (!game.player2 || game.player2.jid !== senderJid)) return ctx.reply("❌ Kamu bukan pemain di meja dadu ini!");
        delete global.db.liarsdice[chatId];
        saveDB();
        return await sock.sendMessage(chatId, {
          text: `Hi ${senderName}!\nPermainan Liar's Dice telah dihentikan.\n\n–  *S U R R E N D E R*\n\n_Gunakan perintah \`${prefix}liarsdice\` untuk membuka meja taruhan baru._`
        }, {
          quoted: quotedMsg
        });
      }
      if (["join", "terima", "accept", "gas"].includes(subCommand)) {
        if (!global.db.liarsdice[chatId]) return ctx.reply(`⚠️ Tidak ada tantangan Liar's Dice aktif. Ketik \`${prefix}liarsdice\` untuk membuka meja!`);
        const game = global.db.liarsdice[chatId];
        if (game.status !== "WAITING") return ctx.reply("⚠️ Game di meja ini sudah dimulai.");
        if (game.player1.jid === senderJid) return ctx.reply("❌ Kamu tidak bisa bertanding melawan dirimu sendiri!");
        if (game.targetJid && game.targetJid !== senderJid) return ctx.reply(`❌ Tantangan ini khusus untuk @${game.targetJid.split("@")[0]}!`, {
          mentions: [game.targetJid]
        });
        if (game.bet > 0) {
          const p2Money = Number(userData.money) || 0;
          if (p2Money < game.bet) return ctx.reply(`❌ Saldo tidak cukup untuk taruhan *Rp ${game.bet.toLocaleString()}* (Saldo: Rp ${p2Money.toLocaleString()}).`);
        }
        game.player2 = {
          jid: senderJid,
          name: senderName,
          diceCount: 5,
          dice: rollDiceSet(5)
        };
        game.status = "PLAYING";
        game.turn = 1;
        game.currentBid = null;
        game.lastBidder = null;
        game.expireTime = Date.now() + 60 * 1e3;
        saveDB();
        await ctx.react("🎲");
        await sendSecretDiceToPlayers(sock, ctx, game);
        return await sendTableStatus(sock, ctx, chatId, game, `Ronde 1 dimulai! @${game.player1.jid.split("@")[0]} mendapat giliran pertama untuk memasang bid.`, quotedMsg);
      }
      if (global.db.liarsdice[chatId]) {
        return ctx.reply(`⚠️ Masih ada meja Liar's Dice yang sedang berlangsung di chat ini!\nKetik \`${prefix}liarsdice cancel\` untuk membatalkannya.`);
      }
      if (subCommand === "bot" || subCommand === "ai") {
        await ctx.react("🤖");
        global.db.liarsdice[chatId] = {
          chatId: chatId,
          isBot: true,
          status: "PLAYING",
          round: 1,
          turn: 1,
          bet: 0,
          currentBid: null,
          lastBidder: null,
          expireTime: Date.now() + 60 * 1e3,
          player1: {
            jid: senderJid,
            name: senderName,
            diceCount: 5,
            dice: rollDiceSet(5)
          },
          player2: {
            jid: "BOT",
            name: `${botName} AI`,
            diceCount: 5,
            dice: rollDiceSet(5)
          }
        };
        saveDB();
        await sendSecretDiceToPlayers(sock, ctx, global.db.liarsdice[chatId]);
        return await sendTableStatus(sock, ctx, chatId, global.db.liarsdice[chatId], `Mode Solo vs AI Bot aktif! Cek dadu rahasiamu di PC lalu ajukan bid pertama.`, quotedMsg);
      }
      const mentioned = ctx?.mentionedJid || [];
      const targetJid = mentioned[0] || null;
      if (targetJid && targetJid === senderJid) return ctx.reply("❌ Kamu tidak bisa menantang diri sendiri! Main lawan AI dengan `.liarsdice bot`");
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
      await ctx.react("🎲");
      global.db.liarsdice[chatId] = {
        chatId: chatId,
        isBot: false,
        status: "WAITING",
        round: 1,
        turn: 1,
        bet: betAmount,
        targetJid: targetJid,
        currentBid: null,
        lastBidder: null,
        expireTime: Date.now() + 60 * 1e3,
        player1: {
          jid: senderJid,
          name: senderName,
          diceCount: 5,
          dice: rollDiceSet(5)
        },
        player2: null
      };
      saveDB();
      setTimeout(async () => {
        initDB();
        if (global.db.liarsdice[chatId]?.status === "WAITING") {
          delete global.db.liarsdice[chatId];
          saveDB();
          await sock.sendMessage(chatId, {
            text: `⌛ Waktu tantangan Liar's Dice habis! Tidak ada yang menerima tantangan dari @${senderJid.split("@")[0]}.`,
            mentions: [senderJid]
          });
        }
      }, 60 * 1e3);
      const buttons = [{
        name: "quick_reply",
        display_text: "⚔️ Terima Tantangan",
        id: `${prefix}liarsdice join`
      }, {
        name: "quick_reply",
        display_text: "❌ Batal",
        id: `${prefix}liarsdice cancel`
      }];
      const inviteText = `Hi Survivors!
Meja taruhan Liar's Dice (Perudo) telah dibuka!

–  *C H A L L E N G E*

┌  ◦  *Penantang* : @${senderJid.split("@")[0]}
│  ◦  *Target* : ${targetJid ? `@${targetJid.split("@")[0]}` : "Siapa saja yang berani!"}
│  ◦  *Taruhan Meja* : Rp ${betAmount.toLocaleString()}
└  ◦  *Timeout* : 60 Detik

_Klik tombol di bawah atau ketik \`${prefix}liarsdice join\` untuk bertaruh!_`;
      const canvasHtml = buildLiarsDiceCanvasHtml(global.db.liarsdice[chatId], "WAITING OPPONENT");
      const {
        buffer,
        url
      } = await renderHtmlToImage(canvasHtml);
      const mentions = targetJid ? [senderJid, targetJid] : [senderJid];
      await sendNeoxrLiarsDice(sock, ctx, chatId, inviteText, footerText, buttons, quotedMsg, mentions, buffer, url);
    } catch (e) {
      console.error("[LIARS DICE ERROR]:", e);
      await ctx.react("❌");
      ctx.reply(`❌ Terjadi kesalahan: ${e.message}`);
    }
  }
};
async function sendSecretDiceToPlayers(sock, ctx, game) {
  if (!game.player1) return;
  const p1DiceText = (game.player1.dice || []).map(v => `[${v}] ${DICE_EMOJIS[v - 1]}`).join("  ");
  await sock.sendMessage(game.player1.jid, {
    text: `🤫 *DADU RAHASIA KAMU (RONDE ${game.round})*\n\nCangkirmu berisi: ${p1DiceText}\n\n_Rahasiakan dadumu dari lawan dan buat perkiraan gertakan di grup!_`
  }).catch(() => {});
  if (!game.isBot && game.player2) {
    const p2DiceText = (game.player2.dice || []).map(v => `[${v}] ${DICE_EMOJIS[v - 1]}`).join("  ");
    await sock.sendMessage(game.player2.jid, {
      text: `🤫 *DADU RAHASIA KAMU (RONDE ${game.round})*\n\nCangkirmu berisi: ${p2DiceText}\n\n_Rahasiakan dadumu dari lawan dan buat perkiraan gertakan di grup!_`
    }).catch(() => {});
  }
}
async function handlePlayerBid(sock, ctx, chatId, count, face, senderJid, quotedMsg) {
  initDB();
  const game = global.db.liarsdice[chatId];
  if (!game || game.status !== "PLAYING") return;
  if (!game.player2) return;
  const totalDiceTable = game.player1.dice.length + game.player2.dice.length;
  if (count <= 0 || face < 1 || face > 6) return ctx.reply("⚠️ Format bid tidak valid! Gunakan angka 1-6 untuk mata dadu.");
  if (count > totalDiceTable) return ctx.reply(`⚠️ Jumlah dadu yang kamu sebutkan (${count}) melebihi total seluruh dadu di meja (${totalDiceTable})!`);
  if (game.currentBid) {
    const prev = game.currentBid;
    const isValidRaise = count > prev.count || count === prev.count && face > prev.face;
    if (!isValidRaise) return ctx.reply(`⚠️ Tawaran harus lebih tinggi dari tawaran sebelumnya (${prev.count}x dadu [${prev.face}])!`);
  }
  game.currentBid = {
    count: count,
    face: face
  };
  game.lastBidder = senderJid;
  game.turn = game.turn === 1 ? 2 : 1;
  game.expireTime = Date.now() + 60 * 1e3;
  saveDB();
  const bidderName = senderJid === game.player1.jid ? game.player1.name : game.player2?.name || "Lawan";
  const nextJid = game.turn === 1 ? game.player1.jid : game.player2?.jid || null;
  if (game.isBot && game.turn === 2) {
    const aiDecision = getAiMove(game);
    if (aiDecision.action === "liar") {
      return await handleCallLiar(sock, ctx, chatId, "BOT", quotedMsg);
    }
    game.currentBid = {
      count: aiDecision.count,
      face: aiDecision.face
    };
    game.lastBidder = "BOT";
    game.turn = 1;
    game.expireTime = Date.now() + 60 * 1e3;
    saveDB();
    const aiText = `🤖 *AI BOT MENAIKKAN BID:*\nMenyatakan ada minimal *${aiDecision.count}x Dadu Angka [ ${aiDecision.face} ]* di meja!\n\nSekarang giliranmu menaikkan bid atau panggil *BOHONG!*`;
    return await sendTableStatus(sock, ctx, chatId, game, aiText, quotedMsg);
  }
  return await sendTableStatus(sock, ctx, chatId, game, `@${bidderName} mengajukan bid: *${count}x Dadu Angka [ ${face} ]*.\nSekarang giliran @${nextJid.split("@")[0]}!`, quotedMsg);
}
async function handleCallLiar(sock, ctx, chatId, callerJid, quotedMsg) {
  initDB();
  const game = global.db.liarsdice[chatId];
  if (!game || game.status !== "PLAYING" || !game.currentBid) {
    return ctx.reply("⚠️ Belum ada tawaran yang bisa dituduh berbohong!");
  }
  if (!game.player2) return ctx.reply("⚠️ Meja dadu belum memiliki 2 pemain aktif.");
  const targetFace = game.currentBid.face;
  const claimedCount = game.currentBid.count;
  const allDice = [...game.player1.dice, ...game.player2.dice];
  const actualCount = allDice.filter(d => d === targetFace || d === 1).length;
  const isLiarCaught = actualCount < claimedCount;
  const callerName = callerJid === "BOT" ? "🤖 AI Bot" : callerJid === game.player1.jid ? game.player1.name : game.player2?.name || "Lawan";
  const bidderJid = game.lastBidder;
  const bidderName = bidderJid === "BOT" ? "🤖 AI Bot" : bidderJid === game.player1.jid ? game.player1.name : game.player2?.name || "Lawan";
  let loserPlayer = isLiarCaught ? bidderJid === game.player1.jid ? game.player1 : game.player2 : callerJid === game.player1.jid ? game.player1 : game.player2;
  loserPlayer.dice.pop();
  const p1DiceStr = game.player1.dice.map(v => DICE_EMOJIS[v - 1]).join(" ") || "_(kosong)_";
  const p2DiceStr = game.player2.dice.map(v => DICE_EMOJIS[v - 1]).join(" ") || "_(kosong)_";
  const revealNotice = `Hi Survivors!
Tuduhan BOHONG (Liar!) dipanggil oleh ${callerName}! Seluruh cangkir dibuka! 🏆🎲

–  *D I C E  R E V E A L*

┌  ◦  *Dadu ${game.player1.name}* : ${p1DiceStr}
│  ◦  *Dadu ${game.player2.name}* : ${p2DiceStr}
│  ◦  *Klaim Bid* : ${claimedCount}x Dadu [ ${targetFace} ]
└  ◦  *Total Nyata di Meja* : ${actualCount}x Dadu (Termasuk Wild ⚀)

${isLiarCaught ? `❌ *TERBUKTI BOHONG!* Klaim ${claimedCount}x tidak cukup (${actualCount}x nyata). ${bidderName} kehilangan 1 dadu!` : `✅ *JUJUR & VALID!* Ada ${actualCount}x dadu di meja. Tuduhan salah, ${callerName} kehilangan 1 dadu!`}`;
  if (game.player1.dice.length === 0 || game.player2.dice.length === 0) {
    const winner = game.player1.dice.length > 0 ? game.player1 : game.player2;
    delete global.db.liarsdice[chatId];
    saveDB();
    const isBotWin = winner.jid === "BOT";
    let rewardText = "";
    if (!isBotWin && game.bet > 0) {
      initDB(winner.jid, winner.name);
      global.db.user[winner.jid].money = (Number(global.db.user[winner.jid].money) || 0) + game.bet * 2;
      global.db.user[winner.jid].exp = (Number(global.db.user[winner.jid].exp) || 0) + 100;
      rewardText = `+Rp ${(game.bet * 2).toLocaleString()} & +100 EXP`;
    } else if (!isBotWin) {
      initDB(winner.jid, winner.name);
      global.db.user[winner.jid].money = (Number(global.db.user[winner.jid].money) || 0) + 5e3;
      global.db.user[winner.jid].exp = (Number(global.db.user[winner.jid].exp) || 0) + 60;
      rewardText = `+Rp 5.000 & +60 EXP`;
    }
    saveDB();
    const canvasHtml = buildLiarsDiceCanvasHtml(game, `${winner.name.toUpperCase()} WINS!`, true);
    const {
      buffer,
      url
    } = await renderHtmlToImage(canvasHtml);
    const winMsg = `${revealNotice}\n\n–  *C H A M P I O N*\n\n` + `🏆 Pemenang Utama: *${winner.name}*!\n` + `🎁 Reward: *${rewardText || "Kejayaan Bajak Laut"}*\n\n` + `_Ketik \`.liarsdice\` untuk membuka meja taruhan baru!_`;
    return await sendNeoxrLiarsDice(sock, ctx, chatId, winMsg, "Liar's Dice Game Over", [{
      name: "quick_reply",
      display_text: "🎲 Main Lagi",
      id: `${ctx?.prefix || "."}liarsdice`
    }], quotedMsg, winner.jid !== "BOT" ? [winner.jid] : [], buffer, url);
  }
  game.round++;
  game.currentBid = null;
  game.lastBidder = null;
  game.player1.dice = rollDiceSet(game.player1.dice.length);
  game.player2.dice = rollDiceSet(game.player2.dice.length);
  game.turn = loserPlayer === game.player1 ? 1 : 2;
  game.expireTime = Date.now() + 60 * 1e3;
  let botBidNotice = "";
  if (game.isBot && game.turn === 2) {
    const aiDecision = getAiMove(game);
    let botBid;
    if (aiDecision.action === "bid") {
      botBid = {
        count: aiDecision.count,
        face: aiDecision.face
      };
    } else {
      botBid = {
        count: 1,
        face: Math.floor(Math.random() * 6) + 1
      };
    }
    game.currentBid = botBid;
    game.lastBidder = "BOT";
    game.turn = 1;
    botBidNotice = `\n\n🤖 *AI Bot langsung membuka bid:* *${botBid.count}x Dadu Angka [ ${botBid.face} ]*`;
  }
  saveDB();
  await sendSecretDiceToPlayers(sock, ctx, game);
  const canvasHtml = buildLiarsDiceCanvasHtml(game, `ROUND ${game.round}`, false);
  const {
    buffer,
    url
  } = await renderHtmlToImage(canvasHtml);
  const nextStarter = game.turn === 1 ? game.player1.name : game.player2?.name || "Lawan";
  const nextMsg = `${revealNotice}\n\n–  *N E X T  R O U N D*\n\nDadu telah dikocok ulang di cangkir masing-masing!${botBidNotice}\n\nGiliran berikutnya: *${nextStarter}*`;
  return await sendNeoxrLiarsDice(sock, ctx, chatId, nextMsg, "Ronde Baru Dimulai", [{
    name: "quick_reply",
    display_text: "🚩 Panggil BOHONG!",
    id: `${ctx?.prefix || "."}liarsdice liar`
  }], quotedMsg, [], buffer, url);
}
async function sendTableStatus(sock, ctx, chatId, game, noticeText, quotedMsg) {
  const prefix = ctx?.prefix || ".";
  const botName = global.bot?.name || "WudysoftBot";
  const footerText = `${global.bot?.footer || botName}`;
  const currentTurnJid = game.turn === 1 ? game.player1.jid : game.isBot ? "BOT" : game.player2?.jid || null;
  const currentTurnName = game.turn === 1 ? game.player1.name : game.isBot ? "🤖 AI Bot" : game.player2?.name || "Lawan";
  const buttons = [{
    name: "quick_reply",
    display_text: "🚩 Panggil BOHONG!",
    id: `${prefix}liarsdice liar`
  }];
  const totalDice = game.player1.dice.length + (game.player2?.dice.length || 0);
  const tableStatusText = `Hi Survivors!
${noticeText}

–  *T A B L E  S T A T U S*

┌  ◦  *Giliran Aktif* : ${currentTurnName}
│  ◦  *Total Dadu di Meja* : ${totalDice} Dadu
└  ◦  *Timeout* : 60 Detik

_Ketik jumlah & angka dadu (Contoh: *3 4* untuk tiga dadu angka 4) atau klik tombol BOHONG!_`;
  const canvasHtml = buildLiarsDiceCanvasHtml(game, "BIDDING PHASE");
  const {
    buffer,
    url
  } = await renderHtmlToImage(canvasHtml);
  const mentions = currentTurnJid && currentTurnJid !== "BOT" ? [currentTurnJid] : [];
  return await sendNeoxrLiarsDice(sock, ctx, chatId, tableStatusText, footerText, buttons, quotedMsg, mentions, buffer, url);
}