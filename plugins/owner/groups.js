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
async function executeTimerFromDB(sock, chatId, action) {
  try {
    initDB(chatId);
    const groupDb = global.db.group[chatId];
    const groupName = groupDb.subject || "Grup WhatsApp";
    groupDb.timer = null;
    if (action === "open") {
      await sock.groupSettingUpdate(chatId, "not_announcement");
      groupDb.announce = false;
      saveDB();
      await sock.sendMessage(chatId, {
        text: `–  *G R O U P  T I M E R*

┌  ◦  *Grup* : ${groupName}
└  ◦  *Status* : Dibuka Otomatis 🔓

Waktu hitung mundur telah habis, semua anggota sekarang dapat mengirim pesan kembali.`
      });
    } else if (action === "close") {
      await sock.groupSettingUpdate(chatId, "announcement");
      groupDb.announce = true;
      saveDB();
      await sock.sendMessage(chatId, {
        text: `–  *G R O U P  T I M E R*

┌  ◦  *Grup* : ${groupName}
└  ◦  *Status* : Ditutup Otomatis 🔒

Waktu hitung mundur telah habis, sekarang hanya admin yang dapat mengirim pesan ke grup ini.`
      });
    }
  } catch (err) {
    console.error("[Execute Group DB Timer Error]:", err);
  }
}
async function sendGroupActionMessage(sock, ctx, chatId, textContent, buttons = [], quotedMsg = null) {
  const botName = global.bot?.name || "Paimon-bot";
  const footerText = global.bot?.footer || `${botName} • Group Manager`;
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
      mentionedJid: [ctx?.sender].filter(Boolean),
      forwardingScore: 0,
      isForwarded: false
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
      mentions: options.contextInfo.mentionedJid
    }, {
      quoted: quotedMsg
    });
  }
  return sentMsg;
}
export default {
  name: "group",
  aliases: ["grup", "open", "close", "buka", "tutup"],
  description: "Membuka atau menutup grup secara instan atau dengan jadwal hitung mundur (Full Database Engine)",
  category: "Group",
  example: ".buka 3s (tunggu 3 detik lalu buka) / .tutup 10m (tunggu 10 menit lalu tutup)",
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
      if (!ctx.isGroup) {
        if (typeof ctx?.react === "function") await ctx.react("❌");
        return ctx.reply("❌ Perintah ini hanya dapat digunakan di dalam grup WhatsApp.");
      }
      if (!ctx.isAdmin && !ctx.isOwner && !ctx.isROwner) {
        if (typeof ctx?.react === "function") await ctx.react("🚫");
        return ctx.reply("❌ Perintah ini khusus untuk *Admin Grup* atau *Owner Bot*.");
      }
      if (!ctx.isBotAdmin) {
        if (typeof ctx?.react === "function") await ctx.react("⚠️");
        return ctx.reply("❌ Jadikan bot sebagai *Admin Grup* terlebih dahulu agar dapat mengubah setelan.");
      }
      const chatId = ctx.id || ctx.chat;
      const groupName = ctx.groupData?.subject || "Grup WhatsApp";
      const cmd = (ctx.cmd || ctx.command || "").toLowerCase();
      const senderNum = ctx.senderNumber || (ctx.sender ? ctx.sender.split("@")[0] : "Admin");
      initDB(chatId);
      const groupDb = global.db.group[chatId];
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
          return ctx.reply(`–  *T I M E R  C A N C E L E D*

┌  ◦  *Grup* : ${groupName}
└  ◦  *Status* : Dibatalkan

Jadwal hitung mundur buka/tutup otomatis grup telah dihapus dari sistem database.`);
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

┌  ◦  *Buka Instan* : \`${prefix}buka\`
│  ◦  *Tutup Instan* : \`${prefix}tutup\`
│  ◦  *Timer Buka* : \`${prefix}buka 30m\`
│  ◦  *Timer Tutup* : \`${prefix}tutup 10m\`
└  ◦  *Batalkan Timer* : \`${prefix}group cancel\`

Atau ubah secara langsung melalui tombol aksi cepat di bawah:`;
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
        await sock.groupSettingUpdate(chatId, "not_announcement");
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
        await sock.groupSettingUpdate(chatId, "announcement");
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
      console.error("[GROUP OPEN/CLOSE Error]:", error);
      if (typeof ctx?.react === "function") await ctx.react("❌");
      ctx.reply(`❌ Gagal mengubah setelan grup: ${error?.message || error}`);
    }
  }
};