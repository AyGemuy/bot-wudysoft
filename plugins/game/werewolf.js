import db from "../../data/db.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";

function initDB(jid = null, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.werewolf) global.db.werewolf = {};
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
async function sendWwCta(sock, ctx, targetJid, bodyText, footerText, buttons, quoted = null, mentions = []) {
  const botName = global.bot?.name || "WudysoftBot";
  const options = {
    jid: targetJid,
    to: targetJid,
    chat: targetJid,
    params: {
      bottom_sheet: {
        in_thread_buttons_limit: 3,
        divider_indices: [2],
        list_title: `${botName} • Werewolf Village`,
        button_title: "Menu Aksi"
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
      console.error("[sendWwCta ctx.sendCta error]:", e.message);
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
  } catch (e) {
    console.error("[sendWwCta native interactive error]:", e.message);
  }
  return await sock.sendMessage(targetJid, {
    text: `${bodyText}\n\n_${footerText}_`,
    mentions: mentions
  }, {
    quoted: quoted
  });
}
export default {
  name: "werewolf",
  aliases: ["ww", "warewolf", "desaserigala"],
  description: "Bermain game Werewolf PvP bersama anggota grup dengan aksi malam di PC (Full DB)",
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
      const senderJid = ctx?.sender || msg?.key?.participant || msg?.key?.remoteJid;
      if (!senderJid) return;
      initDB();
      const userText = (ctx?.text || ctx?.query || msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "").trim().toLowerCase();
      if (!isGroup) {
        const gameEntry = Object.entries(global.db.werewolf).find(([_, g]) => g.status === "NIGHT" && g.players.some(p => p.jid === senderJid && p.isAlive));
        if (!gameEntry) return;
        const [groupId, game] = gameEntry;
        const player = game.players.find(p => p.jid === senderJid);
        if (!player || !player.isAlive) return;
        const prefix = ctx?.prefix || ".";
        if (userText.startsWith(prefix)) return;
        return await handleNightAction(sock, ctx, groupId, senderJid, userText);
      }
      if (isGroup) {
        const groupId = ctx.id;
        const game = global.db.werewolf[groupId];
        if (!game || game.status !== "DAY") return;
        const voter = game.players.find(p => p.jid === senderJid);
        if (!voter || !voter.isAlive) return;
        const prefix = ctx?.prefix || ".";
        if (userText.startsWith(prefix)) return;
        const voteTargetNum = parseInt(userText);
        if (!isNaN(voteTargetNum)) {
          return await processVote(sock, ctx, groupId, senderJid, voteTargetNum);
        }
      }
    } catch (err) {
      console.error("[WEREWOLF BEFORE ERROR]:", err);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      const isGroup = Boolean(ctx?.isGroup || ctx?.id?.endsWith("@g.us"));
      const botName = global.bot?.name || "WudysoftBot";
      const prefix = ctx?.prefix || ".";
      const senderJid = ctx?.sender || msg?.key?.participant;
      const senderName = ctx?.pushName || "Pemain";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const args = ctx?.args || [];
      const subCommand = (args[0] || "").trim().toLowerCase();
      initDB(senderJid, senderName);
      if (!isGroup) {
        if (["act", "aksi", "kill", "check", "protect"].includes(subCommand)) {
          const gameEntry = Object.entries(global.db.werewolf).find(([_, g]) => g.status === "NIGHT" && g.players.some(p => p.jid === senderJid && p.isAlive));
          if (!gameEntry) {
            return ctx.reply("⚠️ Kamu sedang tidak berada dalam sesi malam game Werewolf.");
          }
          const [groupId] = gameEntry;
          const targetInput = args[1] || "";
          return await handleNightAction(sock, ctx, groupId, senderJid, targetInput);
        }
        return ctx.reply("❌ *Game Werewolf hanya bisa dimulai di dalam Grup!*");
      }
      const groupId = ctx.id;
      if (["join", "gabung", "ikut"].includes(subCommand)) {
        if (!global.db.werewolf[groupId]) {
          return ctx.reply(`⚠️ Belum ada sesi game Werewolf yang dibuka. Ketik \`${prefix}ww create\` untuk membuka kamar!`);
        }
        const game = global.db.werewolf[groupId];
        if (game.status !== "LOBBY") {
          return ctx.reply("⚠️ Game Werewolf di grup ini sudah dimulai.");
        }
        if (game.players.some(p => p.jid === senderJid)) {
          return ctx.reply("⚠️ Kamu sudah bergabung di dalam room!");
        }
        if (game.players.length >= 10) {
          return ctx.reply("⚠️ Batas maksimal pemain (10 orang) telah tercapai!");
        }
        game.players.push({
          jid: senderJid,
          name: senderName,
          role: null,
          isAlive: true,
          votedFor: null
        });
        saveDB();
        await ctx.react("✅");
        return ctx.reply(`👤 *${senderName}* berhasil bergabung!\n` + `👥 *Total Pemain:* ${game.players.length}/10\n` + `_Ketik \`${prefix}ww start\` jika minimal 4 pemain sudah terkumpul._`);
      }
      if (["start", "mulai"].includes(subCommand)) {
        if (!global.db.werewolf[groupId]) {
          return ctx.reply(`⚠️ Buat sesi terlebih dahulu dengan mengetik \`${prefix}ww create\``);
        }
        const game = global.db.werewolf[groupId];
        if (game.status !== "LOBBY") {
          return ctx.reply("⚠️ Game sudah berjalan!");
        }
        if (game.players.length < 4) {
          return ctx.reply(`❌ Pemain belum mencukupi! Minimal *4 pemain* untuk memulai game. (Saat ini: ${game.players.length} pemain)`);
        }
        return await startGameSession(sock, ctx, groupId);
      }
      if (["vote", "pilih"].includes(subCommand)) {
        const game = global.db.werewolf[groupId];
        if (!game || game.status !== "DAY") {
          return ctx.reply("⚠️ Sesi voting eksekusi belum dibuka.");
        }
        const voter = game.players.find(p => p.jid === senderJid);
        if (!voter || !voter.isAlive) {
          return ctx.reply("❌ Kamu bukan pemain yang masih hidup di game ini.");
        }
        const targetNum = parseInt(args[1]);
        if (isNaN(targetNum)) {
          return ctx.reply(`⚠️ Masukkan nomor pemain yang ingin kamu gantung! Contoh: \`${prefix}ww vote 2\``);
        }
        return await processVote(sock, ctx, groupId, senderJid, targetNum);
      }
      if (["stop", "cancel", "batal", "delete"].includes(subCommand)) {
        if (!global.db.werewolf[groupId]) {
          return ctx.reply("⚠️ Tidak ada sesi Werewolf yang aktif di grup ini.");
        }
        const game = global.db.werewolf[groupId];
        if (game.host !== senderJid) {
          return ctx.reply("❌ Hanya pembuat game (host) yang dapat membatalkannya.");
        }
        delete global.db.werewolf[groupId];
        saveDB();
        return ctx.reply("🛑 Sesi permainan Werewolf berhasil dibatalkan.");
      }
      if (global.db.werewolf[groupId]) {
        const game = global.db.werewolf[groupId];
        if (game.status === "LOBBY") {
          return ctx.reply(`⚠️ Sudah ada lobby terbuka! Ketik \`${prefix}ww join\` untuk bergabung (${game.players.length} pemain).`);
        }
        return ctx.reply("⚠️ Masih ada game Werewolf yang sedang berlangsung di grup ini!");
      }
      await ctx.react("🐺");
      global.db.werewolf[groupId] = {
        groupId: groupId,
        host: senderJid,
        status: "LOBBY",
        dayCount: 1,
        expireTime: Date.now() + 60 * 1e3,
        players: [{
          jid: senderJid,
          name: senderName,
          role: null,
          isAlive: true,
          votedFor: null
        }],
        nightActions: {
          killTarget: null,
          protectTarget: null,
          checkTarget: null
        }
      };
      saveDB();
      const buttons = [{
        name: "quick_reply",
        display_text: "⚔️ Join Game",
        id: `${prefix}ww join`
      }, {
        name: "quick_reply",
        display_text: "🚀 Mulai Game",
        id: `${prefix}ww start`
      }, {
        name: "quick_reply",
        display_text: "🛑 Batal",
        id: `${prefix}ww stop`
      }];
      const lobbyText = `🏰 *LOBBY WEREWOLF VILLAGE DIBUKA!* 🏰\n\n` + `👤 *Pembuat Lobby:* @${senderJid.split("@")[0]}\n` + `👥 *Pemain Bergabung:* 1/10 Pemain\n` + `📋 *Daftar Pemain:*\n` + `1. @${senderJid.split("@")[0]}\n\n` + `_Minimal 4 pemain untuk memulai. Ketuk *Join Game* untuk ikut bermain!_`;
      await sendWwCta(sock, ctx, groupId, lobbyText, `${botName} • Menunggu Pemain`, buttons, quotedMsg, [senderJid]);
    } catch (e) {
      console.error("[WEREWOLF ERROR]:", e);
      await ctx.react("❌");
      ctx.reply(`❌ Terjadi kesalahan: ${e.message}`);
    }
  }
};
async function startGameSession(sock, ctx, groupId) {
  initDB();
  const game = global.db.werewolf[groupId];
  if (!game) return;
  const count = game.players.length;
  let roles = [];
  if (count === 4) {
    roles = ["werewolf", "seer", "villager", "villager"];
  } else if (count === 5) {
    roles = ["werewolf", "seer", "guardian", "villager", "villager"];
  } else if (count === 6) {
    roles = ["werewolf", "werewolf", "seer", "guardian", "villager", "villager"];
  } else {
    roles = ["werewolf", "werewolf", "seer", "guardian"];
    while (roles.length < count) roles.push("villager");
  }
  roles = roles.sort(() => Math.random() - .5);
  game.players.forEach((p, idx) => {
    p.role = roles[idx];
  });
  saveDB();
  for (const p of game.players) {
    let roleDesc = "";
    if (p.role === "werewolf") {
      roleDesc = "🐺 *WEREWOLF*\nTugasmu memangsa para warga desa di setiap malam tanpa ketahuan!";
    } else if (p.role === "seer") {
      roleDesc = "🔮 *SEER (Penerawang)*\nKamu dapat menerawang 1 identitas pemain lain setiap malam.";
    } else if (p.role === "guardian") {
      roleDesc = "🛡️ *GUARDIAN (Pelindung)*\nKamu dapat melindungi 1 orang setiap malam dari serangan serigala.";
    } else {
      roleDesc = "👨‍🌾 *VILLAGER (Warga Desa)*\nCari dan gantung seluruh serigala di siang hari lewat voting!";
    }
    const pcRoleText = `🎴 *KARTU PERAN RAHASIA KAMU* 🎴\n\n` + `Peranmu adalah: ${roleDesc}\n\n` + `_Jaga rahasia peranmu dan jangan biarkan orang lain tahu!_`;
    await sock.sendMessage(p.jid, {
      text: pcRoleText
    }).catch(() => {});
  }
  const allMentions = game.players.map(p => p.jid);
  await sock.sendMessage(game.groupId, {
    text: `🎴 *Semua peran telah dikirimkan ke Private Chat masing-masing pemain!*\n\nPermainan segera dimulai...`,
    mentions: allMentions
  });
  await enterNightPhase(sock, ctx, groupId);
}
async function enterNightPhase(sock, ctx, groupId) {
  initDB();
  const game = global.db.werewolf[groupId];
  if (!game) return;
  game.status = "NIGHT";
  game.expireTime = Date.now() + 60 * 1e3;
  game.nightActions = {
    killTarget: null,
    protectTarget: null,
    checkTarget: null
  };
  saveDB();
  const alivePlayers = game.players.filter(p => p.isAlive);
  const prefix = ctx?.prefix || ".";
  const nightText = `🌙 *MALAM HARI KE-${game.dayCount} TELAH TIBA...* 🌙\n\n` + `Seluruh warga desa tertidur lelap. Para pemilik kekuatan malam, silakan buka Private Chat (PC) dengan bot untuk menjalankan aksi kalian!\n\n` + `⏳ *Waktu malam:* 60 detik.`;
  await sock.sendMessage(game.groupId, {
    text: nightText
  });
  const targetListText = alivePlayers.map((p, idx) => `[${idx + 1}] @${p.jid.split("@")[0]}`).join("\n");
  const mentions = alivePlayers.map(p => p.jid);
  for (const p of alivePlayers) {
    if (["werewolf", "seer", "guardian"].includes(p.role)) {
      const buttons = alivePlayers.map((target, idx) => ({
        name: "quick_reply",
        display_text: `${idx + 1}. @${target.jid.split("@")[0]}`,
        id: `${prefix}ww act ${idx + 1}`
      }));
      let actionTitle = "";
      if (p.role === "werewolf") actionTitle = "🐺 *PILIH MANGSA UNTUK DIBUNUH:*";
      if (p.role === "seer") actionTitle = "🔮 *PILIH PEMAIN UNTUK DITERAWANG:*";
      if (p.role === "guardian") actionTitle = "🛡️ *PILIH PEMAIN UNTUK DILINDUNGI:*";
      const body = `${actionTitle}\n\n${targetListText}\n\n_Tekan tombol di bawah atau balas chat ini dengan angka (1 - ${alivePlayers.length})!_`;
      await sendWwCta(sock, ctx, p.jid, body, "Aksi Malam Rahasia", buttons, null, mentions);
    }
  }
  setTimeout(async () => {
    initDB();
    if (global.db.werewolf[groupId]?.status === "NIGHT" && Date.now() >= global.db.werewolf[groupId].expireTime) {
      await resolveNightPhase(sock, ctx, groupId);
    }
  }, 60 * 1e3);
}
async function handleNightAction(sock, ctx, groupId, playerJid, input) {
  initDB();
  const game = global.db.werewolf[groupId];
  if (!game) return;
  const player = game.players.find(p => p.jid === playerJid);
  const alivePlayers = game.players.filter(p => p.isAlive);
  const targetIdx = parseInt(input) - 1;
  if (isNaN(targetIdx) || targetIdx < 0 || targetIdx >= alivePlayers.length) {
    return ctx.reply(`⚠️ Nomor tidak valid! Pilih angka antara 1 sampai ${alivePlayers.length}.`);
  }
  const targetPlayer = alivePlayers[targetIdx];
  if (player.role === "werewolf") {
    game.nightActions.killTarget = targetPlayer.jid;
    saveDB();
    await ctx.reply(`🐺 Kamu memilih untuk memangsa *@${targetPlayer.jid.split("@")[0]}* malam ini.`, {
      mentions: [targetPlayer.jid]
    });
  } else if (player.role === "guardian") {
    game.nightActions.protectTarget = targetPlayer.jid;
    saveDB();
    await ctx.reply(`🛡️ Kamu memilih untuk melindungi *@${targetPlayer.jid.split("@")[0]}* malam ini.`, {
      mentions: [targetPlayer.jid]
    });
  } else if (player.role === "seer") {
    game.nightActions.checkTarget = targetPlayer.jid;
    saveDB();
    const isWolf = targetPlayer.role === "werewolf";
    await ctx.reply(`🔮 *HASIL PENERAWANGAN:*\n@${targetPlayer.jid.split("@")[0]} adalah seorang *${isWolf ? "🐺 WEREWOLF" : "👨‍🌾 WARGA DESA/BAIK"}*!`, {
      mentions: [targetPlayer.jid]
    });
  }
  const wolves = alivePlayers.filter(p => p.role === "werewolf");
  const seers = alivePlayers.filter(p => p.role === "seer");
  const guards = alivePlayers.filter(p => p.role === "guardian");
  const wolfDone = wolves.length === 0 || game.nightActions.killTarget !== null;
  const seerDone = seers.length === 0 || game.nightActions.checkTarget !== null;
  const guardDone = guards.length === 0 || game.nightActions.protectTarget !== null;
  if (wolfDone && seerDone && guardDone) {
    await resolveNightPhase(sock, ctx, groupId);
  }
}
async function resolveNightPhase(sock, ctx, groupId) {
  initDB();
  const game = global.db.werewolf[groupId];
  if (!game) return;
  let victimJid = null;
  if (game.nightActions.killTarget) {
    if (game.nightActions.protectTarget && game.nightActions.protectTarget === game.nightActions.killTarget) {
      victimJid = null;
    } else {
      victimJid = game.nightActions.killTarget;
      const vPlayer = game.players.find(p => p.jid === victimJid);
      if (vPlayer) vPlayer.isAlive = false;
    }
  }
  saveDB();
  if (await checkWinConditions(sock, ctx, groupId)) return;
  await enterDayPhase(sock, ctx, groupId, victimJid);
}
async function enterDayPhase(sock, ctx, groupId, victimJid) {
  initDB();
  const game = global.db.werewolf[groupId];
  if (!game) return;
  game.status = "DAY";
  game.expireTime = Date.now() + 60 * 1e3;
  game.players.forEach(p => p.votedFor = null);
  saveDB();
  const alivePlayers = game.players.filter(p => p.isAlive);
  const prefix = ctx?.prefix || ".";
  let morningNews = `☀️ *PAGI HARI KE-${game.dayCount} TELAH TIBA!* ☀️\n\n`;
  if (victimJid) {
    morningNews += `🩸 *KABAR DUKA:* @${victimJid.split("@")[0]} ditemukan tewas mengenaskan tadi malam terkoyak cakar serigala!\n\n`;
  } else {
    morningNews += `✨ *KABAR GEMBIRA:* Tidak ada korban tewas tadi malam! Semua warga selamat.\n\n`;
  }
  morningNews += `⚖️ *SESI DISKUSI & VOTING EKSEKUSI DIBUKA!*\n`;
  morningNews += `Daftar warga yang masih hidup:\n`;
  alivePlayers.forEach((p, idx) => {
    morningNews += `[${idx + 1}] @${p.jid.split("@")[0]}\n`;
  });
  morningNews += `\n⏳ *Waktu voting:* 60 detik.\nKetik \`${prefix}ww vote <nomor>\` atau balas pesan ini dengan angka untuk memilih siapa yang akan digantung!`;
  const buttons = alivePlayers.map((p, idx) => ({
    name: "quick_reply",
    display_text: `${idx + 1}. @${p.jid.split("@")[0]}`,
    id: `${prefix}ww vote ${idx + 1}`
  }));
  const mentions = victimJid ? [...alivePlayers.map(p => p.jid), victimJid] : alivePlayers.map(p => p.jid);
  await sendWwCta(sock, ctx, game.groupId, morningNews, "Waktu Voting: 60s", buttons, null, mentions);
  setTimeout(async () => {
    initDB();
    if (global.db.werewolf[groupId]?.status === "DAY" && Date.now() >= global.db.werewolf[groupId].expireTime) {
      await resolveDayVoting(sock, ctx, groupId);
    }
  }, 60 * 1e3);
}
async function processVote(sock, ctx, groupId, voterJid, targetNum) {
  initDB();
  const game = global.db.werewolf[groupId];
  if (!game) return;
  const voter = game.players.find(p => p.jid === voterJid);
  const alivePlayers = game.players.filter(p => p.isAlive);
  const targetIdx = targetNum - 1;
  if (targetIdx < 0 || targetIdx >= alivePlayers.length) {
    return ctx.reply(`⚠️ Nomor tidak valid! Pilih angka 1 sampai ${alivePlayers.length}.`);
  }
  const target = alivePlayers[targetIdx];
  voter.votedFor = target.jid;
  saveDB();
  const totalVoted = alivePlayers.filter(p => p.votedFor !== null).length;
  await ctx.reply(`🗳️ @${voter.jid.split("@")[0]} memilih untuk menggantung @${target.jid.split("@")[0]} (${totalVoted}/${alivePlayers.length} suara)`, {
    mentions: [voter.jid, target.jid]
  });
  if (totalVoted >= alivePlayers.length) {
    await resolveDayVoting(sock, ctx, groupId);
  }
}
async function resolveDayVoting(sock, ctx, groupId) {
  initDB();
  const game = global.db.werewolf[groupId];
  if (!game) return;
  const alivePlayers = game.players.filter(p => p.isAlive);
  const voteCounts = {};
  alivePlayers.forEach(p => {
    if (p.votedFor) {
      voteCounts[p.votedFor] = (voteCounts[p.votedFor] || 0) + 1;
    }
  });
  let maxVotes = 0;
  let lynchedJid = null;
  let isTie = false;
  for (const [jid, count] of Object.entries(voteCounts)) {
    if (count > maxVotes) {
      maxVotes = count;
      lynchedJid = jid;
      isTie = false;
    } else if (count === maxVotes) {
      isTie = true;
    }
  }
  if (!lynchedJid || isTie || maxVotes === 0) {
    await sock.sendMessage(game.groupId, {
      text: `⚖️ *VOTING IMBANG ATAU TIDAK ADA SUARA!*\nTidak ada pemain yang dieksekusi hari ini.`
    });
  } else {
    const lynchedPlayer = game.players.find(p => p.jid === lynchedJid);
    if (lynchedPlayer) {
      lynchedPlayer.isAlive = false;
      saveDB();
      const roleName = lynchedPlayer.role === "werewolf" ? "🐺 WEREWOLF" : "👨‍🌾 WARGA DESA";
      await sock.sendMessage(game.groupId, {
        text: `⚰️ *HASIL EKSEKUSI WARGA:*\n@${lynchedPlayer.jid.split("@")[0]} memperoleh suara terbanyak dan digantung di tiang gantungan desa!\nPeran aslinya adalah: *${roleName}*`,
        mentions: [lynchedPlayer.jid]
      });
    }
  }
  if (await checkWinConditions(sock, ctx, groupId)) return;
  game.dayCount++;
  saveDB();
  await enterNightPhase(sock, ctx, groupId);
}
async function checkWinConditions(sock, ctx, groupId) {
  initDB();
  const game = global.db.werewolf[groupId];
  if (!game) return false;
  const alive = game.players.filter(p => p.isAlive);
  const wolves = alive.filter(p => p.role === "werewolf");
  const villagers = alive.filter(p => p.role !== "werewolf");
  let winnerTeam = null;
  if (wolves.length === 0) {
    winnerTeam = "VILLAGERS";
  } else if (wolves.length >= villagers.length) {
    winnerTeam = "WEREWOLVES";
  }
  if (!winnerTeam) return false;
  delete global.db.werewolf[groupId];
  saveDB();
  const prefix = ctx?.prefix || ".";
  let winText = "";
  if (winnerTeam === "VILLAGERS") {
    winText = `🎉 *TIM WARGA DESA MENANG!* 🎉\n\n` + `Seluruh Werewolf telah musnah! Kedamaian desa kembali pulih.\n` + `✨ *Pemain yang menang mendapatkan +Rp 15.000 & +100 EXP!*`;
  } else {
    winText = `🐺 *TIM WEREWOLF MENANG!* 🐺\n\n` + `Kawanan Serigala berhasil menguasai desa dan menghabisi para warga!\n` + `✨ *Werewolf yang menang mendapatkan +Rp 25.000 & +150 EXP!*`;
  }
  winText += `\n\n📋 *Daftar Peran Seluruh Pemain:*\n`;
  game.players.forEach(p => {
    let rIcon = "👨‍🌾 Villager";
    if (p.role === "werewolf") rIcon = "🐺 Werewolf";
    if (p.role === "seer") rIcon = "🔮 Seer";
    if (p.role === "guardian") rIcon = "🛡️ Guardian";
    winText += `• @${p.jid.split("@")[0]} : ${rIcon} (${p.isAlive ? "Hidup" : "Mati"})\n`;
  });
  for (const p of game.players) {
    initDB(p.jid, p.name);
    const user = global.db.user[p.jid];
    if (user) {
      const isWinner = winnerTeam === "VILLAGERS" && p.role !== "werewolf" || winnerTeam === "WEREWOLVES" && p.role === "werewolf";
      if (isWinner) {
        const rewardMoney = winnerTeam === "WEREWOLVES" ? 25e3 : 15e3;
        const rewardExp = winnerTeam === "WEREWOLVES" ? 150 : 100;
        user.money = (Number(user.money) || 0) + rewardMoney;
        user.exp = (Number(user.exp) || 0) + rewardExp;
      }
    }
  }
  saveDB();
  const playAgainBtn = [{
    name: "quick_reply",
    display_text: "🐺 Buka Lobby Baru",
    id: `${prefix}ww create`
  }];
  await sendWwCta(sock, ctx, game.groupId, winText, "Game Over", playAgainBtn, null, game.players.map(p => p.jid));
  return true;
}