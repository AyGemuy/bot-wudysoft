import db from "../../data/db.js";
import {
  simpleQuoted,
  metaQuoted
} from "../../lib/quoted.js";

function initDB(chatId = null) {
  if (!global.db) global.db = {};
  if (!global.db.group) global.db.group = {};
  if (chatId) {
    if (typeof db?.ensureGroup === "function") {
      db.ensureGroup(chatId);
    }
    if (!global.db.group[chatId]) {
      global.db.group[chatId] = {
        announce: false,
        timer: null
      };
    }
  }
}

function saveDB() {
  if (typeof db?.write === "function" && global.db) {
    db.write(global.db);
  }
}

function parseDuration(str) {
  if (!str) return 0;
  const match = String(str).trim().match(/^(\d+(?:\.\d+)?)\s*(s|m|h|d|detik|menit|jam|hari)?$/i);
  if (!match) return 0;
  const val = parseFloat(match[1]);
  const unit = (match[2] || "m").toLowerCase();
  switch (unit) {
    case "s":
    case "detik":
      return Math.round(val * 1e3);
    case "m":
    case "menit":
      return Math.round(val * 60 * 1e3);
    case "h":
    case "jam":
      return Math.round(val * 60 * 60 * 1e3);
    case "d":
    case "hari":
      return Math.round(val * 24 * 60 * 60 * 1e3);
    default:
      return Math.round(val * 60 * 1e3);
  }
}

function formatTime(ms) {
  const seconds = Math.floor(ms / 1e3 % 60);
  const minutes = Math.floor(ms / (1e3 * 60) % 60);
  const hours = Math.floor(ms / (1e3 * 60 * 60) % 24);
  const days = Math.floor(ms / (1e3 * 60 * 60 * 24));
  const parts = [];
  if (days > 0) parts.push(`${days} Hari`);
  if (hours > 0) parts.push(`${hours} Jam`);
  if (minutes > 0) parts.push(`${minutes} Menit`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds} Detik`);
  return parts.join(" ");
}

function extractTargets(ctx) {
  let targets = [];
  if (ctx.quoted?.sender) targets.push(ctx.quoted.sender);
  if (ctx.mentionedJid && ctx.mentionedJid.length > 0) targets.push(...ctx.mentionedJid);
  if (ctx.args && ctx.args.length > 0) {
    for (const arg of ctx.args) {
      const clean = arg.replace(/[^0-9]/g, "");
      if (clean.length >= 7 && clean.length <= 16) {
        targets.push(`${clean}@s.whatsapp.net`);
      }
    }
  }
  return [...new Set(targets)];
}
async function safeGroupParticipantsUpdate(sock, chatId, jids, action) {
  try {
    return await sock.groupParticipantsUpdate(chatId, jids, action);
  } catch (err) {
    if (typeof sock.aiGroupParticipantsUpdate === "function") {
      return await sock.aiGroupParticipantsUpdate(chatId, jids, action);
    }
    throw err;
  }
}
async function safeGroupSettingUpdate(sock, chatId, setting) {
  try {
    return await sock.groupSettingUpdate(chatId, setting);
  } catch (err) {
    if (typeof sock.aiGroupSettingUpdate === "function") {
      return await sock.aiGroupSettingUpdate(chatId, setting);
    }
    throw err;
  }
}
async function safeGroupUpdateSubject(sock, chatId, subject) {
  try {
    return await sock.groupUpdateSubject(chatId, subject);
  } catch (err) {
    if (typeof sock.aiGroupUpdateSubject === "function") {
      return await sock.aiGroupUpdateSubject(chatId, subject);
    }
    throw err;
  }
}
async function safeGroupInviteCode(sock, chatId) {
  try {
    return await sock.groupInviteCode(chatId);
  } catch (err) {
    if (typeof sock.aiGroupInviteCode === "function") {
      return await sock.aiGroupInviteCode(chatId);
    }
    throw err;
  }
}
async function safeGroupRevokeInvite(sock, chatId) {
  try {
    return await sock.groupRevokeInvite(chatId);
  } catch (err) {
    if (typeof sock.aiGroupRevokeInvite === "function") {
      return await sock.aiGroupRevokeInvite(chatId);
    }
    throw err;
  }
}
async function safeGroupLeave(sock, chatId) {
  try {
    return await sock.groupLeave(chatId);
  } catch (err) {
    if (typeof sock.aiGroupLeave === "function") {
      return await sock.aiGroupLeave(chatId);
    }
    throw err;
  }
}
async function executeTimerFromDB(sock, chatId, action) {
  try {
    initDB(chatId);
    const groupDb = global.db.group[chatId];
    const groupName = groupDb.subject || "Grup WhatsApp";
    groupDb.timer = null;
    const botContext = global.bot?.utils?.contextInfo || {};
    if (action === "open") {
      await safeGroupSettingUpdate(sock, chatId, "not_announcement");
      groupDb.announce = false;
      saveDB();
      await sock.sendMessage(chatId, {
        text: `–  *G R O U P  T I M E R*

┌  ◦  *Grup* : ${groupName}
└  ◦  *Status* : Dibuka Otomatis 🔓

Waktu hitung mundur telah habis, semua anggota sekarang dapat mengirim pesan kembali.`,
        contextInfo: botContext
      });
    } else if (action === "close") {
      await safeGroupSettingUpdate(sock, chatId, "announcement");
      groupDb.announce = true;
      saveDB();
      await sock.sendMessage(chatId, {
        text: `–  *G R O U P  T I M E R*

┌  ◦  *Grup* : ${groupName}
└  ◦  *Status* : Ditutup Otomatis 🔒

Waktu hitung mundur telah habis, sekarang hanya admin yang dapat mengirim pesan ke grup ini.`,
        contextInfo: botContext
      });
    }
  } catch (err) {
    console.error("[Execute Group DB Timer Error]:", err);
  }
}
async function sendGroupActionMessage(sock, ctx, chatId, textContent, buttons = [], quotedMsg = null) {
  const botName = global.bot?.name || "Wudysoft";
  const footerText = global.bot?.footer || "– Wudysoft • Multi-Device";
  const botContext = global.bot?.utils?.contextInfo || {};
  const options = {
    jid: chatId,
    to: chatId,
    params: {
      bottom_sheet: {
        in_thread_buttons_limit: 2,
        divider_indices: [1],
        list_title: `${botName} • Pengaturan Grup`,
        button_title: "Opsi Grup"
      }
    },
    contextInfo: {
      ...botContext,
      mentionedJid: [ctx?.sender].filter(Boolean)
    },
    quoted: quotedMsg || undefined
  };
  let sentMsg = null;
  if (typeof ctx?.sendCta === "function" && chatId === ctx.id) {
    try {
      sentMsg = await ctx.sendCta(textContent, footerText, buttons, options);
    } catch (e) {
      console.error("[Group sendCta Error]:", e.message);
    }
  }
  if (!sentMsg) {
    try {
      const nativeButtons = buttons.map(b => ({
        name: b.name || "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: b.display_text || b.title,
          id: b.id
        })
      }));
      sentMsg = await sock.sendMessage(chatId, {
        viewOnceMessage: {
          message: {
            interactiveMessage: {
              body: {
                text: textContent
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
        quoted: quotedMsg
      });
    } catch (e) {}
  }
  if (!sentMsg) {
    sentMsg = await sock.sendMessage(chatId, {
      text: `${textContent}\n\n_${footerText}_`,
      mentions: options.contextInfo.mentionedJid,
      contextInfo: options.contextInfo
    }, {
      quoted: quotedMsg
    });
  }
  return sentMsg;
}
export default {
  name: "group",
  aliases: ["grup", "open", "close", "buka", "tutup", "promote", "demote", "kick", "remove", "add", "lock", "unlock", "kunci", "setname", "setsubject", "setdesc", "linkgc", "linkgroup", "revoke", "resetlink", "leavegc", "aigroup"],
  description: "Kelola grup dengan automatic AI Group fallback & Database timer",
  category: "Group",
  example: ".buka 3s | .promote @user | .kick @user | .lock | .setname Nama Baru",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const chatId = ctx?.id || msg?.key?.remoteJid;
      if (!chatId || !chatId.endsWith("@g.us")) return;
      initDB(chatId);
      const groupDb = global.db.group[chatId];
      if (groupDb?.timer?.active && Date.now() >= groupDb.timer.targetTime) {
        await executeTimerFromDB(sock, chatId, groupDb.timer.action);
      }
    } catch (e) {
      console.error("[GROUP BEFORE TIMER CHECK ERROR]:", e.message);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof metaQuoted === "function" ? metaQuoted(ctx) : typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const botMsg = global.bot?.msg || {};
      const botContext = global.bot?.utils?.contextInfo || {};
      if (!ctx.isGroup && !["aigroup"].includes(ctx.cmd || ctx.command)) {
        if (typeof ctx?.react === "function") await ctx.react("❌");
        return ctx.reply(botMsg.group || "–  *G R O U P  O N L Y*\n\nFitur ini hanya dapat digunakan di dalam *Grup*.");
      }
      if (!ctx.isAdmin && !ctx.isOwner && !ctx.isROwner && !["linkgc", "linkgroup"].includes(ctx.cmd || ctx.command)) {
        if (typeof ctx?.react === "function") await ctx.react("🚫");
        return ctx.reply(botMsg.admin || "–  *A D M I N  O N L Y*\n\nPerintah ini hanya dapat dijalankan oleh *Admin Grup*.");
      }
      const chatId = ctx.id || ctx.chat;
      const groupName = ctx.groupData?.subject || ctx.groupName || "Grup WhatsApp";
      const cmd = (ctx.cmd || ctx.command || "").toLowerCase();
      const senderNum = ctx.senderNumber || (ctx.sender ? ctx.sender.split("@")[0] : "Admin");
      initDB(chatId);
      const groupDb = global.db.group[chatId];
      if (cmd === "promote" || cmd === "demote") {
        if (!ctx.isBotAdmin) {
          if (typeof ctx?.react === "function") await ctx.react("❌");
          return ctx.reply(botMsg.botAdmin || "–  *B O T  N O T  A D M I N*\n\nJadikan bot sebagai *Admin Grup* untuk menggunakan fitur ini.");
        }
        const targets = extractTargets(ctx);
        if (!targets.length) {
          if (typeof ctx?.react === "function") await ctx.react("❌");
          return ctx.reply(`–  *${cmd.toUpperCase()}  U S E R*\n\nTag atau balas (reply) pesan pengguna yang ingin di-${cmd}.\n\n┌  ◦  *Format* : ${prefix + cmd} @user\n└  ◦  *Example* : ${prefix + cmd} @628123456789`);
        }
        await safeGroupParticipantsUpdate(sock, chatId, targets, cmd);
        if (typeof ctx?.react === "function") await ctx.react("✅");
        const mentioned = targets.map(t => `@${t.split("@")[0]}`).join(", ");
        return ctx.reply(`✅ Berhasil me-${cmd} ${mentioned} ${cmd === "promote" ? "menjadi *Admin*" : "menjadi *Member Biasa*"}.`, {
          mentions: targets,
          quoted: quotedMsg
        });
      }
      if (cmd === "kick" || cmd === "remove") {
        if (!ctx.isBotAdmin) {
          if (typeof ctx?.react === "function") await ctx.react("❌");
          return ctx.reply(botMsg.botAdmin || "–  *B O T  N O T  A D M I N*\n\nJadikan bot sebagai *Admin Grup* untuk menggunakan fitur ini.");
        }
        const targets = extractTargets(ctx);
        if (!targets.length) {
          return ctx.reply(`–  *K I C K  U S E R*\n\nTag atau balas pesan pengguna yang akan dikeluarkan.\n\n┌  ◦  *Format* : ${prefix}kick @user`);
        }
        await safeGroupParticipantsUpdate(sock, chatId, targets, "remove");
        if (typeof ctx?.react === "function") await ctx.react("✅");
        return ctx.reply("✅ Peserta berhasil dikeluarkan dari grup.", {
          quoted: quotedMsg
        });
      }
      if (cmd === "add") {
        if (!ctx.isBotAdmin) {
          if (typeof ctx?.react === "function") await ctx.react("❌");
          return ctx.reply(botMsg.botAdmin || "–  *B O T  N O T  A D M I N*\n\nJadikan bot sebagai *Admin Grup* untuk menggunakan fitur ini.");
        }
        const targets = extractTargets(ctx);
        if (!targets.length) {
          return ctx.reply(`–  *A D D  M E M B E R*\n\nMasukkan nomor yang ingin ditambahkan.\n\n┌  ◦  *Format* : ${prefix}add 6281234567890`);
        }
        await safeGroupParticipantsUpdate(sock, chatId, targets, "add");
        if (typeof ctx?.react === "function") await ctx.react("✅");
        return ctx.reply("✅ Permintaan penambahan peserta selesai dikirim.", {
          quoted: quotedMsg
        });
      }
      if (cmd === "setname" || cmd === "setsubject") {
        if (!ctx.isBotAdmin) {
          if (typeof ctx?.react === "function") await ctx.react("❌");
          return ctx.reply(botMsg.botAdmin || "–  *B O T  N O T  A D M I N*\n\nJadikan bot sebagai *Admin Grup* untuk menggunakan fitur ini.");
        }
        const newName = ctx.args?.join(" ");
        if (!newName) return ctx.reply(`Contoh: \`${prefix + cmd} Nama Grup Baru\``);
        await safeGroupUpdateSubject(sock, chatId, newName);
        if (typeof ctx?.react === "function") await ctx.react("✅");
        return ctx.reply(`✅ Nama grup berhasil diperbarui menjadi: *${newName}*`);
      }
      if (cmd === "setdesc") {
        if (!ctx.isBotAdmin) {
          if (typeof ctx?.react === "function") await ctx.react("❌");
          return ctx.reply(botMsg.botAdmin || "–  *B O T  N O T  A D M I N*\n\nJadikan bot sebagai *Admin Grup* untuk menggunakan fitur ini.");
        }
        const newDesc = ctx.args?.join(" ") || "";
        await sock.groupUpdateDescription(chatId, newDesc);
        if (typeof ctx?.react === "function") await ctx.react("✅");
        return ctx.reply("✅ Deskripsi grup berhasil diperbarui.");
      }
      if (cmd === "lock" || cmd === "kunci") {
        if (!ctx.isBotAdmin) {
          if (typeof ctx?.react === "function") await ctx.react("❌");
          return ctx.reply(botMsg.botAdmin || "–  *B O T  N O T  A D M I N*\n\nJadikan bot sebagai *Admin Grup* untuk menggunakan fitur ini.");
        }
        await safeGroupSettingUpdate(sock, chatId, "locked");
        if (typeof ctx?.react === "function") await ctx.react("✅");
        return ctx.reply("🛡️ *Grup Dikunci*: Hanya admin yang dapat mengedit info grup.");
      }
      if (cmd === "unlock") {
        if (!ctx.isBotAdmin) {
          if (typeof ctx?.react === "function") await ctx.react("❌");
          return ctx.reply(botMsg.botAdmin || "–  *B O T  N O T  A D M I N*\n\nJadikan bot sebagai *Admin Grup* untuk menggunakan fitur ini.");
        }
        await safeGroupSettingUpdate(sock, chatId, "unlocked");
        if (typeof ctx?.react === "function") await ctx.react("✅");
        return ctx.reply("🌐 *Grup Terbuka*: Semua anggota dapat mengedit info grup.");
      }
      if (cmd === "linkgc" || cmd === "linkgroup") {
        if (!ctx.isBotAdmin) {
          if (typeof ctx?.react === "function") await ctx.react("❌");
          return ctx.reply(botMsg.botAdmin || "–  *B O T  N O T  A D M I N*\n\nJadikan bot sebagai *Admin Grup* untuk menggunakan fitur ini.");
        }
        const code = await safeGroupInviteCode(sock, chatId);
        return ctx.reply(`–  *L I N K  G R U P*\n\nhttps://chat.whatsapp.com/${code}`, {
          quoted: quotedMsg
        });
      }
      if (cmd === "revoke" || cmd === "resetlink") {
        if (!ctx.isBotAdmin) {
          if (typeof ctx?.react === "function") await ctx.react("❌");
          return ctx.reply(botMsg.botAdmin || "–  *B O T  N O T  A D M I N*\n\nJadikan bot sebagai *Admin Grup* untuk menggunakan fitur ini.");
        }
        await safeGroupRevokeInvite(sock, chatId);
        const newCode = await safeGroupInviteCode(sock, chatId);
        return ctx.reply(`🔄 Tautan undangan grup berhasil diperbarui.\n\n*Link Baru*: https://chat.whatsapp.com/${newCode}`);
      }
      if (cmd === "leavegc") {
        await ctx.reply("👋 Bot pamit keluar dari grup.");
        return await safeGroupLeave(sock, chatId);
      }
      if (cmd === "aigroup") {
        const subCmd = (ctx.args?.[0] || "").toLowerCase();
        if (subCmd === "create") {
          const title = ctx.args.slice(1).join(" ") || "AI Group";
          const res = await sock.aiGroupCreate(title, [ctx.sender]);
          return ctx.reply(`🤖 Berhasil membuat WhatsApp AI Group: *${title}* (ID: \`${res.id || res.groupId}\`)`);
        } else if (subCmd === "addbot") {
          await sock.aiGroupAddBot(chatId);
          return ctx.reply("🤖 Meta AI bot berhasil ditambahkan ke dalam grup.");
        } else if (subCmd === "ephemeral") {
          const sec = parseInt(ctx.args[1]) || 86400;
          await sock.aiGroupToggleEphemeral(chatId, sec);
          return ctx.reply(`⏱️ Pesan sementara AI disetel ke: ${sec} detik.`);
        } else {
          return ctx.reply(`–  *A I  G R O U P*\n\n┌  ◦  \`${prefix}aigroup create <nama>\`\n│  ◦  \`${prefix}aigroup addbot\`\n└  ◦  \`${prefix}aigroup ephemeral <detik>\``);
        }
      }
      if (!ctx.isBotAdmin) {
        if (typeof ctx?.react === "function") await ctx.react("⚠️");
        return ctx.reply(botMsg.botAdmin || "–  *B O T  N O T  A D M I N*\n\nJadikan bot sebagai *Admin Grup* untuk menggunakan fitur ini.");
      }
      let action = null;
      let rawDuration = null;
      if (["open", "buka"].includes(cmd)) {
        action = "open";
        rawDuration = ctx.args?.[0];
      } else if (["close", "tutup"].includes(cmd)) {
        action = "close";
        rawDuration = ctx.args?.[0];
      } else {
        const firstArg = (ctx.args?.[0] || "").toLowerCase().trim();
        const secondArg = ctx.args?.[1];
        if (["open", "buka", "unlock", "0"].includes(firstArg)) {
          action = "open";
          rawDuration = secondArg;
        } else if (["close", "tutup", "lock", "1"].includes(firstArg)) {
          action = "close";
          rawDuration = secondArg;
        } else if (["cancel", "batal", "stop"].includes(firstArg)) {
          action = "cancel";
        }
      }
      const isTimerPending = Boolean(groupDb.timer && groupDb.timer.active && groupDb.timer.targetTime > Date.now());
      if (action === "cancel") {
        if (isTimerPending || groupDb.timer) {
          groupDb.timer = null;
          saveDB();
          if (typeof ctx?.react === "function") await ctx.react("✅");
          return ctx.reply(`–  *T I M E R  C A N C E L E D*\n\n┌  ◦  *Grup* : ${groupName}\n└  ◦  *Status* : Dibatalkan\n\nJadwal hitung mundur buka/tutup otomatis grup telah dihapus dari sistem database.`);
        } else {
          if (typeof ctx?.react === "function") await ctx.react("ℹ️");
          return ctx.reply("ℹ️ Tidak ada jadwal hitung mundur yang sedang aktif di grup ini.");
        }
      }
      if (!action) {
        if (typeof ctx?.react === "function") await ctx.react("❓");
        const isCurrentlyClosed = Boolean(groupDb.announce ?? ctx.groupData?.announce);
        let timerStatusLine = "";
        if (isTimerPending) {
          const remaining = Math.max(0, groupDb.timer.targetTime - Date.now());
          const pendingAction = groupDb.timer.action === "open" ? "Dibuka" : "Ditutup";
          timerStatusLine = `│  ◦  *Jadwal DB* : Akan ${pendingAction} dalam ${formatTime(remaining)}\n`;
        }
        const statusText = `–  *G R O U P  S E T T I N G S*

Berikut adalah status akses pengiriman pesan grup saat ini.

┌  ◦  *Grup* : ${groupName}
│  ◦  *Status* : ${isCurrentlyClosed ? "Tertutup (Hanya Admin) 🔒" : "Terbuka (Semua Anggota) 🔓"}
${timerStatusLine}└  ◦  *Role* : Admin Group

–  *C O N T O H  P E R I N T A H*

┌  ◦  *Member* : \`${prefix}promote\`, \`${prefix}demote\`, \`${prefix}kick\`, \`${prefix}add\`
│  ◦  *Info* : \`${prefix}setname\`, \`${prefix}setdesc\`, \`${prefix}lock\`, \`${prefix}unlock\`
│  ◦  *Link* : \`${prefix}linkgc\`, \`${prefix}revoke\`
│  ◦  *Buka / Tutup* : \`${prefix}buka\`, \`${prefix}tutup\`
└  ◦  *Timer* : \`${prefix}buka 30m\`, \`${prefix}tutup 10m\`, \`${prefix}group cancel\`

Atau ubah akses pesan langsung melalui tombol di bawah:`;
        const buttons = [{
          name: "quick_reply",
          display_text: "🔓 Buka Sekarang",
          id: `${prefix}group open`
        }, {
          name: "quick_reply",
          display_text: "🔒 Tutup Sekarang",
          id: `${prefix}group close`
        }];
        if (isTimerPending) {
          buttons.push({
            name: "quick_reply",
            display_text: "⏱️ Batalkan Jadwal",
            id: `${prefix}group cancel`
          });
        }
        return await sendGroupActionMessage(sock, ctx, chatId, statusText, buttons, quotedMsg);
      }
      if (typeof ctx?.react === "function") await ctx.react("⏳");
      const durationMs = parseDuration(rawDuration);
      if (action === "open") {
        if (durationMs > 0) {
          const targetTimestamp = Date.now() + durationMs;
          groupDb.timer = {
            action: "open",
            targetTime: targetTimestamp,
            duration: durationMs,
            active: true,
            setBy: ctx.sender,
            createdAt: Date.now()
          };
          saveDB();
          setTimeout(async () => {
            initDB(chatId);
            const currentTimer = global.db.group?.[chatId]?.timer;
            if (currentTimer?.active && currentTimer?.targetTime === targetTimestamp) {
              await executeTimerFromDB(sock, chatId, "open");
            }
          }, durationMs);
          const delayNotice = `–  *T I M E R  A C T I V A T E D*

┌  ◦  *Grup* : ${groupName}
│  ◦  *Aksi* : Akan Dibuka Otomatis 🔓
│  ◦  *Hitung Mundur* : ${formatTime(durationMs)}
└  ◦  *Eksekutor* : @${senderNum}

Jadwal buka grup otomatis telah disimpan ke sistem database.`;
          const buttons = [{
            name: "quick_reply",
            display_text: "⏱️ Batalkan Jadwal",
            id: `${prefix}group cancel`
          }];
          return await sendGroupActionMessage(sock, ctx, chatId, delayNotice, buttons, quotedMsg);
        }
        await safeGroupSettingUpdate(sock, chatId, "not_announcement");
        groupDb.announce = false;
        groupDb.timer = null;
        saveDB();
        const openNowText = `–  *G R O U P  O P E N*

┌  ◦  *Grup* : ${groupName}
│  ◦  *Status* : Terbuka (Semua Anggota) 🔓
└  ◦  *Eksekutor* : @${senderNum}

Semua anggota sekarang dapat mengirim pesan kembali ke grup ini.`;
        const buttons = [{
          name: "quick_reply",
          display_text: "🔒 Tutup Grup",
          id: `${prefix}group close`
        }];
        if (typeof ctx?.react === "function") await ctx.react("✅");
        return await sendGroupActionMessage(sock, ctx, chatId, openNowText, buttons, quotedMsg);
      } else if (action === "close") {
        if (durationMs > 0) {
          const targetTimestamp = Date.now() + durationMs;
          groupDb.timer = {
            action: "close",
            targetTime: targetTimestamp,
            duration: durationMs,
            active: true,
            setBy: ctx.sender,
            createdAt: Date.now()
          };
          saveDB();
          setTimeout(async () => {
            initDB(chatId);
            const currentTimer = global.db.group?.[chatId]?.timer;
            if (currentTimer?.active && currentTimer?.targetTime === targetTimestamp) {
              await executeTimerFromDB(sock, chatId, "close");
            }
          }, durationMs);
          const delayNotice = `–  *T I M E R  A C T I V A T E D*

┌  ◦  *Grup* : ${groupName}
│  ◦  *Aksi* : Akan Ditutup Otomatis 🔒
│  ◦  *Hitung Mundur* : ${formatTime(durationMs)}
└  ◦  *Eksekutor* : @${senderNum}

Jadwal tutup grup otomatis telah disimpan ke sistem database.`;
          const buttons = [{
            name: "quick_reply",
            display_text: "⏱️ Batalkan Jadwal",
            id: `${prefix}group cancel`
          }];
          return await sendGroupActionMessage(sock, ctx, chatId, delayNotice, buttons, quotedMsg);
        }
        await safeGroupSettingUpdate(sock, chatId, "announcement");
        groupDb.announce = true;
        groupDb.timer = null;
        saveDB();
        const closeNowText = `–  *G R O U P  C L O S E*

┌  ◦  *Grup* : ${groupName}
│  ◦  *Status* : Tertutup (Hanya Admin) 🔒
└  ◦  *Eksekutor* : @${senderNum}

Sekarang hanya admin yang dapat mengirim pesan ke grup ini.`;
        const buttons = [{
          name: "quick_reply",
          display_text: "🔓 Buka Grup",
          id: `${prefix}group open`
        }];
        if (typeof ctx?.react === "function") await ctx.react("✅");
        return await sendGroupActionMessage(sock, ctx, chatId, closeNowText, buttons, quotedMsg);
      }
    } catch (error) {
      console.error("[GROUP MANAGEMENT Error]:", error);
      if (typeof ctx?.react === "function") await ctx.react("❌");
      const errText = global.bot?.msg?.error || "–  *E R R O R*\n\nTerjadi kesalahan saat mengeksekusi permintaan.";
      ctx.reply(`${errText}\n\n*Detail*: ${error?.message || error}`);
    }
  }
};