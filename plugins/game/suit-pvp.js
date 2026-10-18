import db from "../../data/db.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const SUIT_CHOICES = {
  batu: {
    name: "✊ Batu",
    beats: "gunting"
  },
  gunting: {
    name: "✌️ Gunting",
    beats: "kertas"
  },
  kertas: {
    name: "🖐️ Kertas",
    beats: "batu"
  }
};

function initDB(jid = null, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.suit) global.db.suit = {};
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
async function sendSuitCta(sock, ctx, targetJid, bodyText, footerText, buttons, quoted = null, mentions = []) {
  const botName = global.bot?.name || "WudysoftBot";
  const options = {
    params: {
      bottom_sheet: {
        in_thread_buttons_limit: 3,
        divider_indices: [2],
        list_title: `${botName} • Suit PvP Arena`,
        button_title: "Menu Interaksi"
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
    return await ctx.sendCta(bodyText, footerText, buttons, options);
  }
  try {
    if (typeof ctx?.sendCta === "function") {
      const prevId = ctx.id;
      ctx.id = targetJid;
      const res = await ctx.sendCta(bodyText, footerText, buttons, options);
      ctx.id = prevId;
      return res;
    }
  } catch (err) {}
  return await sock.sendMessage(targetJid, {
    text: `${bodyText}\n\n_${footerText}_`,
    mentions: mentions
  }, {
    quoted: quoted
  });
}
export default {
  name: "suit",
  aliases: ["suitpvp", "rps", "jankenpon"],
  description: "Tantang pemain lain bermain Suit (Batu Gunting Kertas) dengan taruhan/reward (Full DB)",
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
      if (isGroup) return;
      const senderJid = ctx?.sender || msg?.key?.participant || msg?.key?.remoteJid;
      if (!senderJid) return;
      initDB();
      const activeEntry = Object.entries(global.db.suit).find(([_, g]) => g.status === "PLAYING" && (g.player1?.jid === senderJid || g.player2?.jid === senderJid));
      if (!activeEntry) return;
      const [groupId, activeGame] = activeEntry;
      if (Date.now() > activeGame.expireTime) {
        delete global.db.suit[groupId];
        saveDB();
        return ctx.reply("⏰ Waktu memilih suit telah habis.");
      }
      const rawText = (ctx?.text || ctx?.query || msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "").trim().toLowerCase();
      let choice = null;
      if (rawText.includes("batu")) choice = "batu";
      else if (rawText.includes("gunting")) choice = "gunting";
      else if (rawText.includes("kertas")) choice = "kertas";
      if (!choice) return;
      const isPlayer1 = activeGame.player1.jid === senderJid;
      const currentPlayer = isPlayer1 ? activeGame.player1 : activeGame.player2;
      if (currentPlayer.choice) {
        return ctx.reply("⚠️ Kamu sudah menentukan pilihan! Harap tunggu lawanmu memilih.");
      }
      currentPlayer.choice = choice;
      saveDB();
      if (typeof ctx?.react === "function") await ctx.react("✅");
      await ctx.reply(`✅ *PILIHAN TERSIMPAN!*\n\n` + `Kamu memilih: *${SUIT_CHOICES[choice].name}*\n` + `Pilihanmu aman dan dirahasiakan. Hasil pertandingan beserta reward akan diumumkan di grup!`);
      await updateGroupStatus(sock, ctx, groupId);
      return true;
    } catch (err) {
      console.error("[SUIT BEFORE ERROR]:", err);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      const isGroup = Boolean(ctx?.isGroup || ctx?.id?.endsWith("@g.us"));
      const botName = global.bot?.name || "WudysoftBot";
      const prefix = ctx?.prefix || ".";
      const senderJid = ctx?.sender || msg?.key?.participant;
      const senderName = ctx?.pushName || "Pemain 1";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const args = ctx?.args || [];
      const subCommand = (args[0] || "").trim().toLowerCase();
      initDB(senderJid, senderName);
      if (!isGroup) {
        if (subCommand === "pilih") {
          const choiceArg = (args[1] || "").toLowerCase();
          if (!SUIT_CHOICES[choiceArg]) return ctx.reply("⚠️ Pilihan suit tidak valid.");
          const activeEntry = Object.entries(global.db.suit).find(([_, g]) => g.status === "PLAYING" && (g.player1?.jid === senderJid || g.player2?.jid === senderJid));
          if (!activeEntry) return ctx.reply("⚠️ Tidak ada sesi suit yang sedang menunggumu.");
          const [groupId, activeGame] = activeEntry;
          const currentPlayer = activeGame.player1.jid === senderJid ? activeGame.player1 : activeGame.player2;
          if (currentPlayer.choice) {
            return ctx.reply("⚠️ Kamu sudah menentukan pilihan sebelumnya!");
          }
          currentPlayer.choice = choiceArg;
          saveDB();
          await ctx.react("✅");
          await ctx.reply(`✅ *PILIHAN TERSIMPAN!*\nKamu memilih: *${SUIT_CHOICES[choiceArg].name}*`);
          await updateGroupStatus(sock, ctx, groupId);
          return;
        }
        return ctx.reply("❌ *Game Suit PvP ini hanya dapat dimainkan di dalam Grup!*");
      }
      const groupId = ctx.id;
      const userData = global.db.user[senderJid];
      if (["join", "terima", "accept", "gas"].includes(subCommand)) {
        if (!global.db.suit[groupId]) {
          return ctx.reply(`⚠️ Tidak ada tantangan suit yang aktif di grup ini.\nKetik \`${prefix}suit\` untuk membuat tantangan baru.`);
        }
        const game = global.db.suit[groupId];
        if (game.status !== "WAITING") {
          return ctx.reply("⚠️ Game suit di grup ini sudah berjalan.");
        }
        if (game.player1.jid === senderJid) {
          return ctx.reply("❌ Kamu tidak bisa bermain melawan dirimu sendiri!");
        }
        if (game.targetJid && game.targetJid !== senderJid) {
          return ctx.reply(`❌ Tantangan ini khusus ditujukan untuk @${game.targetJid.split("@")[0]}!`, {
            mentions: [game.targetJid]
          });
        }
        if (game.bet > 0) {
          const p2Money = Number(userData.money) || 0;
          if (p2Money < game.bet) {
            return ctx.reply(`❌ Uang kamu tidak cukup untuk mengikuti taruhan sebesar *Rp ${game.bet.toLocaleString()}*! (Uangmu: Rp ${p2Money.toLocaleString()})`);
          }
        }
        game.player2 = {
          jid: senderJid,
          name: senderName,
          choice: null
        };
        game.status = "PLAYING";
        game.expireTime = Date.now() + 90 * 1e3;
        saveDB();
        setTimeout(async () => {
          initDB();
          if (global.db.suit[groupId]?.status === "PLAYING" && Date.now() >= global.db.suit[groupId].expireTime) {
            const current = global.db.suit[groupId];
            delete global.db.suit[groupId];
            saveDB();
            await sock.sendMessage(groupId, {
              text: `⏰ *WAKTU MEMILIH HABIS!*\nGame suit antara @${current.player1.jid.split("@")[0]} dan @${current.player2.jid.split("@")[0]} dibatalkan karena tidak memilih tepat waktu.`,
              mentions: [current.player1.jid, current.player2.jid]
            });
          }
        }, 90 * 1e3);
        const pcButtons = [{
          name: "quick_reply",
          display_text: "✊ Batu",
          id: `${prefix}suit pilih batu`
        }, {
          name: "quick_reply",
          display_text: "✌️ Gunting",
          id: `${prefix}suit pilih gunting`
        }, {
          name: "quick_reply",
          display_text: "🖐️ Kertas",
          id: `${prefix}suit pilih kertas`
        }];
        const pcText = `🎮 *SESI PEMILIHAN SUIT RAHASIA*\n\n` + `Tantangan suit di grup telah dimulai!\n` + (game.bet > 0 ? `💰 *Taruhan:* Rp ${game.bet.toLocaleString()}\n` : "") + `\nSilakan pilih jagoanmu dengan menekan salah satu tombol di bawah:\n` + `• ✊ *Batu* (Mengalahkan Gunting)\n` + `• ✌️ *Gunting* (Mengalahkan Kertas)\n` + `• 🖐️ *Kertas* (Mengalahkan Batu)\n\n` + `_Pilihanmu dirahasiakan dari lawan di grup!_`;
        await sendSuitCta(sock, ctx, game.player1.jid, pcText, `${botName} • Rahasia`, pcButtons);
        await sendSuitCta(sock, ctx, game.player2.jid, pcText, `${botName} • Rahasia`, pcButtons);
        const groupStartText = `⚔️ *GAME SUIT PvP DIMULAI!* ⚔️\n\n` + `👤 *Pemain 1:* @${game.player1.jid.split("@")[0]} [Menunggu Memilih ⏳]\n` + `👤 *Pemain 2:* @${game.player2.jid.split("@")[0]} [Menunggu Memilih ⏳]\n` + (game.bet > 0 ? `💰 *Total Hadiah Taruhan:* Rp ${(game.bet * 2).toLocaleString()}\n` : "") + `\n📩 *Buka Private Chat (PC) bot sekarang untuk memilih jagoanmu secara rahasia!*`;
        return await sock.sendMessage(groupId, {
          text: groupStartText,
          mentions: [game.player1.jid, game.player2.jid]
        }, {
          quoted: quotedMsg
        });
      }
      if (["tolak", "cancel", "batal"].includes(subCommand)) {
        if (!global.db.suit[groupId]) {
          return ctx.reply("⚠️ Tidak ada sesi suit yang sedang aktif di grup ini.");
        }
        const game = global.db.suit[groupId];
        if (game.player1.jid !== senderJid && game.targetJid !== senderJid) {
          return ctx.reply("❌ Kamu tidak berhak membatalkan tantangan ini.");
        }
        delete global.db.suit[groupId];
        saveDB();
        return ctx.reply("🛑 Tantangan suit berhasil dibatalkan.");
      }
      if (global.db.suit[groupId]) {
        return ctx.reply(`⚠️ Masih ada sesi suit yang sedang berlangsung di grup ini!\n` + `Gunakan \`${prefix}suit tolak\` jika ingin membatalkannya.`);
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
          return ctx.reply(`❌ Uangmu tidak cukup untuk bertaruh sebesar *Rp ${betAmount.toLocaleString()}*! (Uang saat ini: Rp ${p1Money.toLocaleString()})`);
        }
      }
      await ctx.react("🎮");
      global.db.suit[groupId] = {
        groupId: groupId,
        status: "WAITING",
        targetJid: targetJid,
        bet: betAmount,
        expireTime: Date.now() + 60 * 1e3,
        player1: {
          jid: senderJid,
          name: senderName,
          choice: null
        },
        player2: null
      };
      saveDB();
      setTimeout(async () => {
        initDB();
        if (global.db.suit[groupId]?.status === "WAITING" && Date.now() >= global.db.suit[groupId].expireTime) {
          delete global.db.suit[groupId];
          saveDB();
          await sock.sendMessage(groupId, {
            text: `⌛ *WAKTU MENUNGGU HABIS!*\nTantangan suit dari @${senderJid.split("@")[0]} telah kedaluwarsa.`,
            mentions: [senderJid]
          });
        }
      }, 60 * 1e3);
      const buttons = [{
        name: "quick_reply",
        display_text: "⚔️ Join / Terima",
        id: `${prefix}suit join`
      }, {
        name: "quick_reply",
        display_text: "❌ Tolak",
        id: `${prefix}suit tolak`
      }];
      let challengeText = `🎮 *TANTANGAN SUIT PvP DIBUKA!* 🎮\n\n`;
      challengeText += `👤 *Penantang:* @${senderJid.split("@")[0]}\n`;
      challengeText += `🎯 *Lawan:* ${targetJid ? `@${targetJid.split("@")[0]}` : "Siapa saja di grup ini!"}\n`;
      if (betAmount > 0) {
        challengeText += `💰 *Taruhan:* Rp ${betAmount.toLocaleString()}\n`;
      } else {
        challengeText += `🎁 *Hadiah Menang:* +Rp 5.000 & +35 EXP (Gratis dari Bot)\n`;
      }
      challengeText += `⏳ *Batas Waktu:* 60 Detik\n\n`;
      challengeText += `_Klik tombol *Join / Terima* di bawah untuk menerima tantangan!_`;
      const mentions = targetJid ? [senderJid, targetJid] : [senderJid];
      await sendSuitCta(sock, ctx, groupId, challengeText, `${botName} • Rock Paper Scissors`, buttons, quotedMsg, mentions);
    } catch (e) {
      console.error("[SUIT COMMAND ERROR]:", e);
      await ctx.react("❌");
      ctx.reply(`❌ Error: ${e.message}`);
    }
  }
};
async function updateGroupStatus(sock, ctx, groupId) {
  initDB();
  const game = global.db.suit[groupId];
  if (!game) return;
  const p1 = game.player1;
  const p2 = game.player2;
  const prefix = ctx?.prefix || ".";
  const p1Status = p1.choice ? "Sudah Memilih ✅" : "Menunggu Memilih ⏳";
  const p2Status = p2.choice ? "Sudah Memilih ✅" : "Menunggu Memilih ⏳";
  if (!p1.choice || !p2.choice) {
    const progressText = `📊 *STATUS PEMILIHAN SUIT*\n\n` + `👤 @${p1.jid.split("@")[0]} : [${p1Status}]\n` + `👤 @${p2.jid.split("@")[0]} : [${p2Status}]\n\n` + `_Pemain yang belum memilih silakan buka chat pribadi (PC) dengan bot!_`;
    return await sock.sendMessage(groupId, {
      text: progressText,
      mentions: [p1.jid, p2.jid]
    });
  }
  delete global.db.suit[groupId];
  saveDB();
  const c1 = p1.choice;
  const c2 = p2.choice;
  const bet = game.bet || 0;
  initDB(p1.jid, p1.name);
  initDB(p2.jid, p2.name);
  const u1 = global.db.user[p1.jid];
  const u2 = global.db.user[p2.jid];
  let resultTitle = "";
  let winnerText = "";
  let rewardText = "";
  if (c1 === c2) {
    resultTitle = "🤝 *HASIL PERTANDINGAN: SERI (DRAW)!* 🤝";
    winnerText = "Keduanya memilih opsi yang sama!";
    if (u1 && u2) {
      u1.exp = (Number(u1.exp) || 0) + 15;
      u2.exp = (Number(u2.exp) || 0) + 15;
    }
    rewardText = "Masing-masing pemain mendapatkan +15 EXP.";
  } else if (SUIT_CHOICES[c1].beats === c2) {
    resultTitle = `🏆 *PEMENANG: @${p1.jid.split("@")[0]}!* 🏆`;
    winnerText = `@${p1.jid.split("@")[0]} berhasil mengalahkan @${p2.jid.split("@")[0]}!`;
    if (bet > 0) {
      if (u1 && u2) {
        u1.money = (Number(u1.money) || 0) + bet;
        u2.money = Math.max(0, (Number(u2.money) || 0) - bet);
        u1.exp = (Number(u1.exp) || 0) + 50;
      }
      rewardText = `💰 @${p1.jid.split("@")[0]} memenangkan taruhan *Rp ${bet.toLocaleString()}* dan +50 EXP!`;
    } else {
      if (u1) {
        u1.money = (Number(u1.money) || 0) + 5e3;
        u1.exp = (Number(u1.exp) || 0) + 35;
      }
      rewardText = `🎁 Hadiah Pemenang: *+Rp 5.000* & *+35 EXP*!`;
    }
  } else {
    resultTitle = `🏆 *PEMENANG: @${p2.jid.split("@")[0]}!* 🏆`;
    winnerText = `@${p2.jid.split("@")[0]} berhasil mengalahkan @${p1.jid.split("@")[0]}!`;
    if (bet > 0) {
      if (u1 && u2) {
        u2.money = (Number(u2.money) || 0) + bet;
        u1.money = Math.max(0, (Number(u1.money) || 0) - bet);
        u2.exp = (Number(u2.exp) || 0) + 50;
      }
      rewardText = `💰 @${p2.jid.split("@")[0]} memenangkan taruhan *Rp ${bet.toLocaleString()}* dan +50 EXP!`;
    } else {
      if (u2) {
        u2.money = (Number(u2.money) || 0) + 5e3;
        u2.exp = (Number(u2.exp) || 0) + 35;
      }
      rewardText = `🎁 Hadiah Pemenang: *+Rp 5.000* & *+35 EXP*!`;
    }
  }
  saveDB();
  const finalAnnouncement = `${resultTitle}\n\n` + `👤 @${p1.jid.split("@")[0]} : ${SUIT_CHOICES[c1].name}\n` + `👤 @${p2.jid.split("@")[0]} : ${SUIT_CHOICES[c2].name}\n\n` + `${winnerText}\n` + `✨ *Reward:* ${rewardText}\n\n` + `_Ketik \`${prefix}suit\` untuk bermain kembali!_`;
  const playAgainButtons = [{
    name: "quick_reply",
    display_text: "🎮 Main Lagi",
    id: `${prefix}suit`
  }];
  await sendSuitCta(sock, ctx, groupId, finalAnnouncement, `WudysoftBot • Suit PvP Results`, playAgainButtons, null, [p1.jid, p2.jid]);
}