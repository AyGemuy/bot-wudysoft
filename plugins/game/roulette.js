import db from "../../data/db.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";

function initDB(jid = null, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.roulette) global.db.roulette = {};
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
async function sendRouletteCta(sock, ctx, targetJid, bodyText, footerText, buttons, quoted = null, mentions = []) {
  const botName = global.bot?.name || "WudysoftBot";
  const options = {
    jid: targetJid,
    to: targetJid,
    chat: targetJid,
    params: {
      bottom_sheet: {
        in_thread_buttons_limit: 3,
        divider_indices: [2],
        list_title: `${botName} • Russian Roulette Duel`,
        button_title: "Aksi Duel"
      }
    },
    contextInfo: {
      forwardingScore: 0,
      isForwarded: false,
      mentionedJid: mentions
    },
    quoted: quoted || undefined
  };
  if (typeof ctx?.sendCta === "function" && targetJid === ctx.id) {
    try {
      return await ctx.sendCta(bodyText, footerText, buttons, options);
    } catch (e) {
      console.error("[sendRouletteCta error]:", e.message);
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
    return await sock.sendMessage(targetJid, {
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
  return await sock.sendMessage(targetJid, {
    text: `${bodyText}\n\n_${footerText}_`,
    mentions: mentions
  }, {
    quoted: quoted
  });
}
export default {
  name: "roulette",
  aliases: ["russianroulette", "rr", "revolver", "duel"],
  description: "Duel maut Russian Roulette bergantian menarik pelatuk revolver bersama teman (Full DB)",
  category: "Game",
  limit: false,
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      const isGroup = Boolean(ctx?.isGroup || ctx?.id?.endsWith("@g.us") || msg?.key?.remoteJid?.endsWith("@g.us"));
      if (!isGroup) return;
      const groupId = ctx.id;
      initDB();
      const game = global.db.roulette[groupId];
      if (!game || game.status !== "PLAYING") return;
      const senderJid = ctx?.sender || msg?.key?.participant;
      if (!senderJid) return;
      if (Date.now() > game.expireTime) {
        const loser = game.player1.jid === game.turnJid ? game.player1 : game.player2;
        const winner = game.player1.jid === game.turnJid ? game.player2 : game.player1;
        delete global.db.roulette[groupId];
        saveDB();
        const timeoutText = `⌛ *WAKTU GILIRAN HABIS!* 🐔\n\n` + `@${loser.jid.split("@")[0]} terlalu takut dan kabur dari duel!\n` + `🏆 @${winner.jid.split("@")[0]} dinyatakan sebagai pemenang duel!`;
        return await handleGameOver(sock, ctx, groupId, game, winner, loser, "timeout", timeoutText);
      }
      const userText = (ctx?.text || ctx?.query || msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "").trim().toLowerCase();
      const prefix = ctx?.prefix || ".";
      if (userText.startsWith(prefix)) return;
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (["tembak", "tarik", "shoot", "fire", "dor"].includes(userText)) {
        return await handlePullTrigger(sock, ctx, groupId, senderJid, quotedMsg);
      }
      if (["putar", "spin", "kocok"].includes(userText)) {
        return await handleSpinCylinder(sock, ctx, groupId, senderJid, quotedMsg);
      }
    } catch (err) {
      console.error("[ROULETTE BEFORE ERROR]:", err);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      const isGroup = Boolean(ctx?.isGroup || ctx?.id?.endsWith("@g.us"));
      if (!isGroup) {
        return ctx.reply("❌ *Game Duel Russian Roulette hanya bisa dimainkan di dalam Grup!*");
      }
      const groupId = ctx.id;
      const botName = global.bot?.name || "WudysoftBot";
      const prefix = ctx?.prefix || ".";
      const senderJid = ctx?.sender || msg?.key?.participant;
      const senderName = ctx?.pushName || "Koboi";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      initDB(senderJid, senderName);
      const userData = global.db.user[senderJid];
      const args = ctx?.args || [];
      const subCommand = (args[0] || "").trim().toLowerCase();
      if (["join", "terima", "accept", "gas"].includes(subCommand)) {
        if (!global.db.roulette[groupId]) {
          return ctx.reply(`⚠️ Tidak ada tantangan duel aktif. Ketik \`${prefix}roulette\` untuk menantang seseorang!`);
        }
        const game = global.db.roulette[groupId];
        if (game.status !== "WAITING") {
          return ctx.reply("⚠️ Duel di grup ini sudah berjalan!");
        }
        if (game.player1.jid === senderJid) {
          return ctx.reply("❌ Kamu tidak bisa duel melawan dirimu sendiri!");
        }
        if (game.targetJid && game.targetJid !== senderJid) {
          return ctx.reply(`❌ Tantangan ini khusus untuk @${game.targetJid.split("@")[0]}!`, {
            mentions: [game.targetJid]
          });
        }
        if (game.bet > 0) {
          const p2Money = Number(userData.money) || 0;
          if (p2Money < game.bet) {
            return ctx.reply(`❌ Uangmu tidak cukup untuk taruhan sebesar *Rp ${game.bet.toLocaleString()}*! (Saldo: Rp ${p2Money.toLocaleString()})`);
          }
        }
        game.player2 = {
          jid: senderJid,
          name: senderName,
          hasSpun: false
        };
        game.status = "PLAYING";
        game.turnJid = game.player1.jid;
        game.expireTime = Date.now() + 45 * 1e3;
        saveDB();
        startTurnTimer(sock, ctx, groupId);
        await ctx.react("🔫");
        const buttons = [{
          name: "quick_reply",
          display_text: "💥 Tarik Pelatuk",
          id: `${prefix}roulette shoot`
        }, {
          name: "quick_reply",
          display_text: "🔄 Putar Silinder (1x)",
          id: `${prefix}roulette spin`
        }];
        let startDuelText = `🤠 *DUEL REVOLVER DIMULAI!* 🤠\n\n`;
        startDuelText += `👤 @${game.player1.jid.split("@")[0]} ⚔️ @${game.player2.jid.split("@")[0]}\n`;
        if (game.bet > 0) startDuelText += `💰 *Total Taruhan Meja:* Rp ${(game.bet * 2).toLocaleString()}\n`;
        startDuelText += `🔫 *Kondisi Pistol:* 6 Ruang Silinder (1 Peluru Tajam)\n\n`;
        startDuelText += `👉 *Giliran Pertama:* @${game.turnJid.split("@")[0]}\n`;
        startDuelText += `Pegang revolver, arahkan ke kepalamu, dan tarik pelatuknya!\n\n`;
        startDuelText += `_Ketuk tombol di bawah atau ketik langsung *tembak* di chat!_`;
        return await sendRouletteCta(sock, ctx, groupId, startDuelText, `${botName} • Peluang Meledak: 1/6 (16.6%)`, buttons, quotedMsg, [game.player1.jid, game.player2.jid, game.turnJid]);
      }
      if (["shoot", "tembak", "dor"].includes(subCommand)) {
        if (!global.db.roulette[groupId] || global.db.roulette[groupId].status !== "PLAYING") {
          return ctx.reply("⚠️ Tidak ada duel aktif saat ini.");
        }
        return await handlePullTrigger(sock, ctx, groupId, senderJid, quotedMsg);
      }
      if (["spin", "putar"].includes(subCommand)) {
        if (!global.db.roulette[groupId] || global.db.roulette[groupId].status !== "PLAYING") {
          return ctx.reply("⚠️ Tidak ada duel aktif saat ini.");
        }
        return await handleSpinCylinder(sock, ctx, groupId, senderJid, quotedMsg);
      }
      if (["batal", "cancel", "surrender", "nyerah"].includes(subCommand)) {
        if (!global.db.roulette[groupId]) {
          return ctx.reply("⚠️ Tidak ada sesi roulette yang sedang berlangsung.");
        }
        const game = global.db.roulette[groupId];
        if (game.status === "WAITING") {
          if (game.player1.jid !== senderJid) return ctx.reply("❌ Hanya penantang yang bisa membatalkan.");
          delete global.db.roulette[groupId];
          saveDB();
          return ctx.reply("🛑 Tantangan duel roulette dibatalkan.");
        }
        if (game.status === "PLAYING") {
          if (game.player1.jid !== senderJid && game.player2?.jid !== senderJid) {
            return ctx.reply("❌ Kamu bukan peserta dalam duel ini!");
          }
          const winner = game.player1.jid === senderJid ? game.player2 : game.player1;
          const loser = game.player1.jid === senderJid ? game.player1 : game.player2;
          delete global.db.roulette[groupId];
          saveDB();
          await handleGameOver(sock, ctx, groupId, game, winner, loser, "surrender");
          return;
        }
      }
      if (global.db.roulette[groupId]) {
        return ctx.reply(`⚠️ Masih ada duel yang sedang berlangsung di grup ini!`);
      }
      const mentioned = ctx?.mentionedJid || [];
      const targetJid = mentioned[0] || null;
      if (targetJid && targetJid === senderJid) {
        return ctx.reply("❌ Kamu tidak bisa menantang diri sendiri!");
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
          return ctx.reply(`❌ Uangmu tidak cukup untuk taruhan *Rp ${betAmount.toLocaleString()}*! (Uangmu: Rp ${p1Money.toLocaleString()})`);
        }
      }
      await ctx.react("🤠");
      const chambers = [false, false, false, false, false, false];
      const bulletIndex = Math.floor(Math.random() * 6);
      chambers[bulletIndex] = true;
      global.db.roulette[groupId] = {
        groupId: groupId,
        status: "WAITING",
        bet: betAmount,
        chambers: chambers,
        currentChamber: 0,
        targetJid: targetJid,
        expireTime: Date.now() + 60 * 1e3,
        player1: {
          jid: senderJid,
          name: senderName,
          hasSpun: false
        },
        player2: null,
        turnJid: null
      };
      saveDB();
      setTimeout(async () => {
        if (global.db.roulette[groupId]?.status === "WAITING") {
          delete global.db.roulette[groupId];
          saveDB();
          await sock.sendMessage(groupId, {
            text: `⌛ *TANTANGAN DUEL KEDALUWARSA!*\nTidak ada yang berani menerima tantangan duel dari @${senderJid.split("@")[0]}.`,
            mentions: [senderJid]
          });
        }
      }, 60 * 1e3);
      const buttons = [{
        name: "quick_reply",
        display_text: "⚔️ Terima Tantangan",
        id: `${prefix}roulette join`
      }, {
        name: "quick_reply",
        display_text: "❌ Batal",
        id: `${prefix}roulette batal`
      }];
      let inviteText = `🤠 *TANTANGAN RUSSIAN ROULETTE!* 🤠\n\n`;
      inviteText += `👤 *Penantang:* @${senderJid.split("@")[0]}\n`;
      inviteText += `🎯 *Target Lawan:* ${targetJid ? `@${targetJid.split("@")[0]}` : "Siapa saja yang berani!"}\n`;
      if (betAmount > 0) {
        inviteText += `💰 *Taruhan:* Rp ${betAmount.toLocaleString()}\n`;
      } else {
        inviteText += `🎁 *Hadiah Menang:* +Rp 5.000 & +40 EXP (Gratis dari Bot)\n`;
      }
      inviteText += `⏳ *Batas Waktu:* 60 Detik\n\n`;
      inviteText += `_Ketuk tombol di bawah atau ketik \`${prefix}roulette join\` untuk bertaruh nyawa!_`;
      const mentions = targetJid ? [senderJid, targetJid] : [senderJid];
      await sendRouletteCta(sock, ctx, groupId, inviteText, `${botName} • High Stakes Duel`, buttons, quotedMsg, mentions);
    } catch (e) {
      console.error("[ROULETTE ERROR]:", e);
      await ctx.react("❌");
      ctx.reply(`❌ Terjadi kesalahan: ${e.message}`);
    }
  }
};
async function handlePullTrigger(sock, ctx, groupId, senderJid, quotedMsg) {
  initDB();
  const game = global.db.roulette[groupId];
  if (!game) return;
  const botName = global.bot?.name || "WudysoftBot";
  const prefix = ctx?.prefix || ".";
  if (game.turnJid !== senderJid) {
    return ctx.reply(`⚠️ Bukan giliranmu! Saat ini giliran @${game.turnJid.split("@")[0]} memegang pistol.`, {
      mentions: [game.turnJid]
    });
  }
  const isBullet = game.chambers[game.currentChamber];
  const currentPlayer = game.player1.jid === senderJid ? game.player1 : game.player2;
  const opponent = game.player1.jid === senderJid ? game.player2 : game.player1;
  if (isBullet) {
    delete global.db.roulette[groupId];
    saveDB();
    await ctx.react("💥");
    let boomText = `💥💥 *DUAAAAAARRRRRRRRRR!!!* 💥💥\n\n`;
    boomText += `💀 *PELURU TAJAM MELETUS!* 💀\n`;
    boomText += `@${currentPlayer.jid.split("@")[0]} menarik pelatuk dan kepalanya tertembus peluru revolver!\n\n`;
    boomText += `🏆 *PEMENANG DUEL:* @${opponent.jid.split("@")[0]}!\n`;
    return await handleGameOver(sock, ctx, groupId, game, opponent, currentPlayer, "shot", boomText);
  }
  game.currentChamber += 1;
  const remainingSlots = 6 - game.currentChamber;
  const nextChance = (1 / remainingSlots * 100).toFixed(1);
  game.turnJid = opponent.jid;
  game.expireTime = Date.now() + 45 * 1e3;
  saveDB();
  startTurnTimer(sock, ctx, groupId);
  await ctx.react("😅");
  const buttons = [{
    name: "quick_reply",
    display_text: "💥 Tarik Pelatuk",
    id: `${prefix}roulette shoot`
  }];
  if (!opponent.hasSpun) {
    buttons.push({
      name: "quick_reply",
      display_text: "🔄 Putar Silinder (1x)",
      id: `${prefix}roulette spin`
    });
  }
  let safeText = `*KLIK...!* 😮‍💨\n\n`;
  safeText += `Ruang silinder nomor [${game.currentChamber}] ternyata *KOSONG*!\n`;
  safeText += `@${currentPlayer.jid.split("@")[0]} selamat dari maut!\n\n`;
  safeText += `👉 *Pistol diserahkan ke:* @${opponent.jid.split("@")[0]}\n`;
  safeText += `⚠️ *Sisa Ruang Silinder:* ${remainingSlots} slot\n`;
  safeText += `🩸 *Peluang Meledak di Tembakan Berikutnya:* 1/${remainingSlots} (${nextChance}%)\n\n`;
  safeText += `_Ketuk tombol di bawah atau ketik *tembak* di chat!_`;
  return await sendRouletteCta(sock, ctx, groupId, safeText, `${botName} • Sisa Waktu Giliran: 45s`, buttons, quotedMsg, [currentPlayer.jid, opponent.jid]);
}
async function handleSpinCylinder(sock, ctx, groupId, senderJid, quotedMsg) {
  initDB();
  const game = global.db.roulette[groupId];
  if (!game) return;
  const botName = global.bot?.name || "WudysoftBot";
  const prefix = ctx?.prefix || ".";
  if (game.turnJid !== senderJid) {
    return ctx.reply(`⚠️ Bukan giliranmu untuk memutar silinder!`);
  }
  const currentPlayer = game.player1.jid === senderJid ? game.player1 : game.player2;
  if (currentPlayer.hasSpun) {
    return ctx.reply("❌ Kamu sudah pernah menggunakan kesempatan memutar silinder!");
  }
  currentPlayer.hasSpun = true;
  const remaining = 6 - game.currentChamber;
  const newChambers = new Array(remaining).fill(false);
  const newBulletIdx = Math.floor(Math.random() * remaining);
  newChambers[newBulletIdx] = true;
  for (let i = 0; i < remaining; i++) {
    game.chambers[game.currentChamber + i] = newChambers[i];
  }
  saveDB();
  await ctx.react("🔄");
  const buttons = [{
    name: "quick_reply",
    display_text: "💥 Tarik Pelatuk Sekarang",
    id: `${prefix}roulette shoot`
  }];
  let spinnerText = `🔄 *SREEEKKK...! SILINDER DIPUTAR!* 🔄\n\n`;
  spinnerText += `@${currentPlayer.jid.split("@")[0]} memutar silinder pistol untuk mengacak ulang posisi peluru!\n\n`;
  spinnerText += `Sekarang silinder telah berhenti berputar. Pelatuk tetap harus ditarik!\n`;
  spinnerText += `_Ketuk tombol di bawah atau ketik *tembak*!_`;
  return await sendRouletteCta(sock, ctx, groupId, spinnerText, `${botName} • Silinder Diacak`, buttons, quotedMsg, [currentPlayer.jid]);
}

function startTurnTimer(sock, ctx, groupId) {
  setTimeout(async () => {
    initDB();
    const g = global.db.roulette[groupId];
    if (g && g.status === "PLAYING" && Date.now() >= g.expireTime) {
      delete global.db.roulette[groupId];
      saveDB();
      const loser = g.player1.jid === g.turnJid ? g.player1 : g.player2;
      const winner = g.player1.jid === g.turnJid ? g.player2 : g.player1;
      const timeoutText = `⌛ *WAKTU GILIRAN HABIS!* 🐔\n\n` + `@${loser.jid.split("@")[0]} terlalu takut dan kabur dari duel!\n` + `🏆 @${winner.jid.split("@")[0]} dinyatakan sebagai pemenang duel!`;
      await handleGameOver(sock, ctx, groupId, g, winner, loser, "timeout", timeoutText);
    }
  }, 45 * 1e3);
}
async function handleGameOver(sock, ctx, groupId, game, winner, loser, reason, customHeader = "") {
  const botName = global.bot?.name || "WudysoftBot";
  const prefix = ctx?.prefix || ".";
  initDB(winner.jid, winner.name);
  initDB(loser.jid, loser.name);
  const wUser = global.db.user[winner.jid];
  const lUser = global.db.user[loser.jid];
  let rewardMsg = "";
  if (game.bet > 0) {
    if (wUser && lUser) {
      wUser.money = (Number(wUser.money) || 0) + game.bet;
      lUser.money = Math.max(0, (Number(lUser.money) || 0) - game.bet);
      wUser.exp = (Number(wUser.exp) || 0) + 60;
    }
    rewardMsg = `💰 Pemenang membawa pulang taruhan *Rp ${(game.bet * 2).toLocaleString()}* & *+60 EXP*!`;
  } else {
    if (wUser) {
      wUser.money = (Number(wUser.money) || 0) + 5e3;
      wUser.exp = (Number(wUser.exp) || 0) + 40;
    }
    rewardMsg = `🎁 Hadiah Pemenang: *+Rp 5.000* & *+40 EXP*!`;
  }
  saveDB();
  let finalContent = customHeader ? `${customHeader}\n\n` : "";
  finalContent += `✨ *Hasil Pertandingan:*\n${rewardMsg}\n\n`;
  finalContent += `_Ketik \`${prefix}roulette\` untuk menantang orang lain kembali!_`;
  const buttons = [{
    name: "quick_reply",
    display_text: "🔁 Main Lagi",
    id: `${prefix}roulette`
  }];
  return await sendRouletteCta(sock, ctx, groupId, finalContent, `${botName} • Duel Selesai`, buttons, null, [winner.jid, loser.jid]);
}