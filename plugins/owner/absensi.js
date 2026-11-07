import db from "../../data/db.js";
import {
  metaQuoted,
  simpleQuoted
} from "../../lib/quoted.js";

function initDB(chatId = null) {
  if (!global.db) global.db = {};
  if (!global.db.group) global.db.group = {};
  if (chatId) {
    if (typeof db?.ensureGroup === "function") {
      db.ensureGroup(chatId);
    }
    if (!global.db.group[chatId]) {
      global.db.group[chatId] = {};
    }
    if (!global.db.group[chatId].absen) {
      global.db.group[chatId].absen = null;
    }
  }
}

function saveDB() {
  if (typeof db?.write === "function" && global.db) {
    db.write(global.db);
  }
}

function cleanUserJid(rawJid) {
  if (!rawJid) return "";
  const phone = String(rawJid).replace(/[^0-9]/g, "");
  return phone ? `${phone}@s.whatsapp.net` : "";
}

function getMentionsList(absenList = []) {
  const jids = [];
  for (const item of absenList) {
    const clean = cleanUserJid(item?.jid);
    if (clean) jids.push(clean);
  }
  return [...new Set(jids)];
}
async function getUserRole(sock, chatId, userJid, ctx = {}) {
  const cleanJid = cleanUserJid(userJid);
  const phone = cleanJid.replace(/[^0-9]/g, "");
  const owners = global.owner || global.bot?.owner || [];
  const isOwner = ctx?.isOwner || ctx?.isROwner || owners.some(o => {
    const oNum = typeof o === "string" ? o.replace(/[^0-9]/g, "") : String(o?.[0] || o?.id || "").replace(/[^0-9]/g, "");
    return oNum && oNum === phone;
  });
  if (isOwner) return "Owner";
  try {
    let participants = ctx?.groupData?.participants || ctx?.groupMetadata?.participants || ctx?.participants;
    if (!participants || participants.length === 0) {
      if (typeof sock.groupMetadata === "function") {
        const meta = await sock.groupMetadata(chatId).catch(() => null);
        participants = meta?.participants || [];
      }
    }
    const member = (participants || []).find(p => cleanUserJid(p.id || p.jid) === cleanJid);
    if (member?.admin) {
      return "Admin";
    }
  } catch (e) {}
  return "Member";
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

function formatClock(timestamp) {
  return new Date(timestamp).toLocaleTimeString("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit"
  }) + " WIB";
}

function formatWIB(timestamp) {
  return new Date(timestamp).toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    dateStyle: "full",
    timeStyle: "short"
  }) + " WIB";
}

function renderAbsenBoard(absenData, groupName) {
  const hadirList = (absenData.list || []).filter(x => x.status === "hadir");
  const tidakHadirList = (absenData.list || []).filter(x => x.status === "tidak_hadir");
  const izinList = (absenData.list || []).filter(x => x.status === "izin");
  const sakitList = (absenData.list || []).filter(x => x.status === "sakit");
  let remainingText = "";
  if (absenData.expiresAt) {
    const remaining = Math.max(0, absenData.expiresAt - Date.now());
    if (remaining > 0 && absenData.active) {
      remainingText = `│  ◦  *Remaining* : ${formatTime(remaining)}\n`;
    } else {
      remainingText = `│  ◦  *Status* : Sesi Berakhir\n`;
    }
  }
  const hadirLines = hadirList.length ? hadirList.map((item, index) => {
    const isLast = index === hadirList.length - 1;
    const branch = isLast ? "└" : "│";
    const tagNumber = item.jid.replace(/[^0-9]/g, "");
    const role = item.role ? ` [${item.role}]` : "";
    const jam = item.jam ? ` — ${item.jam}` : "";
    return `${branch}  ◦  *${index + 1}.* @${tagNumber} - ${item.name}${role}${jam}`;
  }).join("\n") : "└  ◦  Belum ada anggota yang hadir";
  const tidakHadirLines = tidakHadirList.length ? tidakHadirList.map((item, index) => {
    const isLast = index === tidakHadirList.length - 1;
    const branch = isLast ? "└" : "│";
    const tagNumber = item.jid.replace(/[^0-9]/g, "");
    const role = item.role ? ` [${item.role}]` : "";
    const jam = item.jam ? ` — ${item.jam}` : "";
    return `${branch}  ◦  *${index + 1}.* @${tagNumber} - ${item.name}${role}${jam}`;
  }).join("\n") : "";
  const izinLines = izinList.length ? izinList.map((item, index) => {
    const isLast = index === izinList.length - 1;
    const branch = isLast ? "└" : "│";
    const tagNumber = item.jid.replace(/[^0-9]/g, "");
    const role = item.role ? ` [${item.role}]` : "";
    const jam = item.jam ? ` — ${item.jam}` : "";
    return `${branch}  ◦  *${index + 1}.* @${tagNumber} - ${item.name}${role}${jam}`;
  }).join("\n") : "";
  const sakitLines = sakitList.length ? sakitList.map((item, index) => {
    const isLast = index === sakitList.length - 1;
    const branch = isLast ? "└" : "│";
    const tagNumber = item.jid.replace(/[^0-9]/g, "");
    const role = item.role ? ` [${item.role}]` : "";
    const jam = item.jam ? ` — ${item.jam}` : "";
    return `${branch}  ◦  *${index + 1}.* @${tagNumber} - ${item.name}${role}${jam}`;
  }).join("\n") : "";
  let text = `–  *A B S E N S I*\n\n` + `┌  ◦  *Group* : ${groupName}\n` + `│  ◦  *Agenda* : ${absenData.title}\n` + `│  ◦  *Started* : ${formatWIB(absenData.createdAt)}\n` + `${remainingText}` + `└  ◦  *Total* : ${absenData.list.length} Anggota Terdata\n\n` + `–  *S U M M A R Y*\n\n` + `┌  ◦  *Hadir* : ${hadirList.length} Orang\n` + `│  ◦  *Tidak Hadir* : ${tidakHadirList.length} Orang\n` + `│  ◦  *Izin* : ${izinList.length} Orang\n` + `└  ◦  *Sakit* : ${sakitList.length} Orang\n\n` + `–  *H A D I R*\n\n${hadirLines}\n\n`;
  if (tidakHadirList.length > 0) {
    text += `–  *T I D A K  H A D I R*\n\n${tidakHadirLines}\n\n`;
  }
  if (izinList.length > 0) {
    text += `–  *I Z I N*\n\n${izinLines}\n\n`;
  }
  if (sakitList.length > 0) {
    text += `–  *S A K I T*\n\n${sakitLines}\n\n`;
  }
  return text.trim();
}
async function sendAbsenCtaHelper(sock, ctx, chatId, textContent, sections = [], buttonTitle = "Menu Presensi", quotedMsg = null) {
  const botName = global.bot?.name || "Paimon-bot";
  const footerText = global.bot?.footer || `${botName} • Attendance System`;
  const buttons = [{
    name: "single_select",
    buttonParamsJson: JSON.stringify({
      title: buttonTitle,
      sections: sections
    })
  }];
  if (typeof ctx?.sendCta === "function") {
    try {
      return await ctx.sendCta(textContent, footerText, buttons, {
        quoted: quotedMsg,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `${botName} • Presensi Menu`,
            button_title: buttonTitle
          }
        }
      });
    } catch (e) {}
  }
  try {
    return await sock.sendMessage(chatId, {
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
              buttons: buttons
            }
          }
        }
      }
    }, {
      quoted: quotedMsg
    });
  } catch (e) {
    return await sock.sendMessage(chatId, {
      text: textContent
    }, {
      quoted: quotedMsg
    });
  }
}
async function handleVoteUpdate(sock, chatId, userJid, userName, voteType, groupName, ctx = {}) {
  initDB(chatId);
  const groupDb = global.db.group[chatId];
  const absen = groupDb?.absen;
  if (!absen || !absen.active) return;
  const validJid = cleanUserJid(userJid);
  if (!validJid) return;
  let validStatus = "hadir";
  if (voteType.includes("tidak")) validStatus = "tidak_hadir";
  else if (voteType.includes("izin")) validStatus = "izin";
  else if (voteType.includes("sakit")) validStatus = "sakit";
  const now = Date.now();
  const role = await getUserRole(sock, chatId, validJid, ctx);
  const existingIndex = absen.list.findIndex(x => cleanUserJid(x.jid) === validJid);
  const voteData = {
    jid: validJid,
    name: userName,
    role: role,
    status: validStatus,
    timestamp: now,
    jam: formatClock(now)
  };
  if (existingIndex !== -1) {
    absen.list[existingIndex] = voteData;
  } else {
    absen.list.push(voteData);
  }
  saveDB();
  const boardText = renderAbsenBoard(absen, groupName);
  const mentions = getMentionsList(absen.list);
  const messagePayload = {
    text: boardText,
    mentions: mentions,
    contextInfo: {
      mentionedJid: mentions
    }
  };
  const pollQuotedMsg = absen.pollKey ? {
    key: absen.pollKey
  } : undefined;
  if (absen.boardKey) {
    try {
      await sock.sendMessage(chatId, {
        ...messagePayload,
        edit: absen.boardKey
      });
      return;
    } catch (e) {}
  }
  try {
    const sentBoard = await sock.sendMessage(chatId, messagePayload, {
      quoted: pollQuotedMsg
    });
    if (sentBoard?.key) {
      absen.boardKey = sentBoard.key;
      saveDB();
    }
  } catch (err) {
    console.error("[ABSEN SEND BOARD ERROR]:", err?.message || err);
  }
}
export default {
  name: "absen",
  aliases: ["absensi", "presensi"],
  description: "Presensi grup berbasis polling WhatsApp (Single Select) lengkap dengan Tidak Hadir, Izin, dan Sakit",
  category: "Group",
  example: ".absen (helper) / .absen --start Rapat / .absen --stop",
  before: async (m, {
    sock,
    ctx
  }) => {
    try {
      const chatId = ctx?.chat || ctx?.id || m?.key?.remoteJid;
      if (chatId && chatId.endsWith("@g.us")) {
        initDB(chatId);
        const groupDb = global.db.group[chatId];
        const absen = groupDb?.absen;
        if (absen && absen.active && absen.expiresAt && Date.now() >= absen.expiresAt) {
          absen.active = false;
          saveDB();
          const groupName = groupDb.subject || "Grup WhatsApp";
          const summaryText = `–  *T I M E  O U T*\n\nWaktu presensi untuk agenda *"${absen.title}"* telah ditutup otomatis.\n\n${renderAbsenBoard(absen, groupName)}`;
          const mentions = getMentionsList(absen.list);
          await sock.sendMessage(chatId, {
            text: summaryText,
            mentions: mentions,
            contextInfo: {
              mentionedJid: mentions
            }
          });
        }
      }
      if (!ctx?.isPollVote) return;
      if (!chatId || !chatId.endsWith("@g.us")) return;
      const rawUser = ctx.sender || ctx.senderNumber || m.key?.participant || m.participant;
      const userJid = cleanUserJid(rawUser);
      const tagNumber = userJid.replace(/[^0-9]/g, "");
      const userName = ctx.pushName || ctx.pushname || m.pushName || tagNumber || "Anggota";
      const text = (ctx.text || ctx.body || "").toLowerCase();
      if (text.includes("absen --vote") || text.includes("absen vote")) {
        const groupName = ctx.groupData?.subject || ctx.groupMetadata?.subject || "Grup WhatsApp";
        let voteType = "hadir";
        if (text.includes("tidak")) voteType = "tidak_hadir";
        else if (text.includes("izin")) voteType = "izin";
        else if (text.includes("sakit")) voteType = "sakit";
        await handleVoteUpdate(sock, chatId, userJid, userName, voteType, groupName, ctx);
        if (typeof ctx.react === "function") {
          const emoji = voteType === "hadir" ? "✅" : voteType === "tidak_hadir" ? "❌" : voteType === "izin" ? "📝" : "🤒";
          await ctx.react(emoji);
        }
      }
    } catch (e) {
      console.error("[ABSEN BEFORE ERROR]:", e);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof metaQuoted === "function" ? metaQuoted(ctx) : typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (!ctx.isGroup) {
        if (typeof ctx?.react === "function") await ctx.react("❌");
        return ctx.reply("❌ Fitur absensi ini hanya dapat digunakan di dalam grup.");
      }
      const chatId = ctx.chat || ctx.id;
      const groupName = ctx.groupData?.subject || ctx.groupMetadata?.subject || "Grup WhatsApp";
      const rawUser = ctx.sender || ctx.senderNumber || msg.key?.participant || msg.participant;
      const userJid = cleanUserJid(rawUser);
      const tagNumber = userJid.replace(/[^0-9]/g, "");
      const userName = ctx.pushName || ctx.pushname || tagNumber || "Anggota";
      const isUserAdmin = Boolean(ctx.isAdmin || ctx.isOwner || ctx.isROwner);
      initDB(chatId);
      const groupDb = global.db.group[chatId];
      let absen = groupDb.absen;
      const args = Array.isArray(ctx.args) ? ctx.args : [];
      const firstArg = (args[0] || "").toLowerCase().trim();
      const action = firstArg.replace(/^--/, "");
      if (!firstArg || args.length === 0) {
        const helpText = `–  *A B S E N S I*\n\n` + `Kelola presensi grup via Polling WhatsApp.\n\n` + `┌  ◦  *Mulai* : \`${prefix}absen --start [agenda]\`\n` + `│  ◦  *Rekap* : \`${prefix}absen --cek\`\n` + `└  ◦  *Tutup* : \`${prefix}absen --stop\`\n\n` + `Atau tekan tombol di bawah untuk langsung membuka sesi:`;
        const sections = [{
          title: "PILIHAN AKSI",
          rows: [{
            title: "🚀 Mulai Presensi Sekarang",
            description: "Buka polling presensi kehadiran rutin",
            id: `${prefix}absen --start Presensi Kehadiran`
          }, ...absen && absen.active ? [{
            title: "📋 Cek Status Rekap",
            description: "Tampilkan rekap presensi saat ini",
            id: `${prefix}absen --cek`
          }, ...isUserAdmin ? [{
            title: "🔒 Tutup Sesi Presensi",
            description: "Akhiri absensi grup",
            id: `${prefix}absen --stop`
          }] : []] : []]
        }];
        if (typeof ctx?.react === "function") await ctx.react("📋");
        return await sendAbsenCtaHelper(sock, ctx, chatId, helpText, sections, "🚀 MULAI PRESENSI", quotedMsg);
      }
      if (action === "vote") {
        const voteType = (args[1] || "").toLowerCase();
        await handleVoteUpdate(sock, chatId, userJid, userName, voteType, groupName, ctx);
        return;
      }
      if (["stop", "tutup", "close", "end"].includes(action)) {
        if (!isUserAdmin) {
          if (typeof ctx?.react === "function") await ctx.react("🚫");
          return ctx.reply("❌ Hanya *Admin Grup* yang dapat menutup sesi absensi.");
        }
        if (!absen || !absen.active) {
          if (typeof ctx?.react === "function") await ctx.react("⚠️");
          return ctx.reply("⚠️ Sedang tidak ada sesi absensi yang aktif.");
        }
        absen.active = false;
        if (absen.pollId && global.pollMappings?.[absen.pollId]) {
          delete global.pollMappings[absen.pollId];
        }
        saveDB();
        const allMentions = getMentionsList(absen.list);
        if (userJid && !allMentions.includes(userJid)) allMentions.push(userJid);
        const finalBoard = `–  *A B S E N S I  D I T U T U P*\n\n` + `Sesi presensi resmi ditutup oleh Admin (@${tagNumber}).\n\n` + renderAbsenBoard(absen, groupName);
        if (absen.boardKey) {
          await sock.sendMessage(chatId, {
            text: renderAbsenBoard(absen, groupName),
            edit: absen.boardKey,
            mentions: allMentions,
            contextInfo: {
              mentionedJid: allMentions
            }
          }).catch(() => null);
        }
        const pollQuotedMsg = absen.pollKey ? {
          key: absen.pollKey
        } : quotedMsg;
        if (typeof ctx?.react === "function") await ctx.react("🔒");
        return sock.sendMessage(chatId, {
          text: finalBoard,
          mentions: allMentions,
          contextInfo: {
            mentionedJid: allMentions
          }
        }, {
          quoted: pollQuotedMsg
        });
      }
      if (["reset", "clear", "hapus"].includes(action)) {
        if (!isUserAdmin) {
          if (typeof ctx?.react === "function") await ctx.react("🚫");
          return ctx.reply("❌ Hanya *Admin Grup* yang dapat mereset data absensi.");
        }
        if (absen?.pollId && global.pollMappings?.[absen.pollId]) {
          delete global.pollMappings[absen.pollId];
        }
        groupDb.absen = null;
        saveDB();
        if (typeof ctx?.react === "function") await ctx.react("🗑️");
        return ctx.reply(`–  *R E S E T*\n\nSeluruh data presensi grup telah dibersihkan.`);
      }
      if (["cek", "status", "list"].includes(action)) {
        if (!absen) {
          if (typeof ctx?.react === "function") await ctx.react("ℹ️");
          return ctx.reply("ℹ️ Belum pernah ada sesi presensi di grup ini.");
        }
        const boardText = renderAbsenBoard(absen, groupName);
        const mentions = getMentionsList(absen.list);
        const pollQuotedMsg = absen.pollKey ? {
          key: absen.pollKey
        } : quotedMsg;
        if (typeof ctx?.react === "function") await ctx.react("📋");
        return sock.sendMessage(chatId, {
          text: boardText,
          mentions: mentions,
          contextInfo: {
            mentionedJid: mentions
          }
        }, {
          quoted: pollQuotedMsg
        });
      }
      if (["start", "mulai", "buka"].includes(action)) {
        if (!isUserAdmin) {
          if (typeof ctx?.react === "function") await ctx.react("🚫");
          return ctx.reply("❌ Hanya *Admin Grup* yang dapat memulai polling absensi.");
        }
        if (absen && absen.active) {
          if (typeof ctx?.react === "function") await ctx.react("⚠️");
          return ctx.reply(`⚠️ Masih ada sesi absensi yang aktif (*${absen.title}*).\nKetik *${prefix}absen --stop* terlebih dahulu.`);
        }
        let words = args.slice(1);
        let durationMs = parseDuration(words[0]);
        let agendaTitle = "";
        if (durationMs > 0) {
          agendaTitle = words.slice(1).join(" ") || "Presensi Rutin";
        } else {
          durationMs = 0;
          agendaTitle = words.join(" ") || "Presensi Rutin";
        }
        const now = Date.now();
        const expiresTimestamp = durationMs > 0 ? now + durationMs : null;
        const pollQuestion = `📋 ABSENSI: ${agendaTitle}`;
        const pollOptions = ["Hadir", "Tidak Hadir", "Izin", "Sakit", "Tutup Presensi"];
        ctx.react?.("⏳");
        let sentPoll = null;
        if (typeof sock.poll === "function") {
          try {
            let builder = sock.poll().name(pollQuestion).options(pollOptions);
            if (typeof builder.singleSelect === "function") {
              builder = builder.singleSelect();
            } else if (typeof builder.multiSelect === "function") {
              builder = builder.multiSelect(false);
            }
            sentPoll = await builder.send(chatId);
          } catch (e) {
            console.error("[SOCK.POLL ERROR]:", e?.message || e);
          }
        }
        if (!sentPoll || !sentPoll.key?.id) {
          sentPoll = await sock.sendMessage(chatId, {
            poll: {
              name: pollQuestion,
              values: pollOptions,
              selectableCount: 1,
              selectableOptionsCount: 1,
              toAnnouncementGroup: false
            }
          }, {
            quoted: quotedMsg
          });
        }
        const pollId = sentPoll?.key?.id || sentPoll?.id;
        global.pollMappings = global.pollMappings || {};
        global.pollMappings[pollId] = {
          chatId: chatId,
          options: [{
            name: "Hadir",
            cmd: `${prefix}absen --vote hadir`
          }, {
            name: "Tidak Hadir",
            cmd: `${prefix}absen --vote tidak_hadir`
          }, {
            name: "Izin",
            cmd: `${prefix}absen --vote izin`
          }, {
            name: "Sakit",
            cmd: `${prefix}absen --vote sakit`
          }, {
            name: "Tutup Presensi",
            cmd: `${prefix}absen --stop`
          }]
        };
        groupDb.absen = {
          active: true,
          title: agendaTitle,
          createdAt: now,
          expiresAt: expiresTimestamp,
          createdBy: userJid,
          pollId: pollId,
          pollKey: sentPoll.key,
          boardKey: null,
          list: []
        };
        saveDB();
        ctx.react?.("✅");
        return;
      }
      return ctx.reply(`⚠️ Flag tidak dikenali. Ketik *${prefix}absen* untuk melihat panduan.`);
    } catch (error) {
      console.error("[ABSEN COMMAND ERROR]:", error);
      ctx.react?.("❌");
      ctx.reply(`❌ Terjadi kesalahan: ${error?.message || error}`);
    }
  }
};