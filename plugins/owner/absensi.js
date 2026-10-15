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

function formatWIB(timestamp) {
  return new Date(timestamp).toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    dateStyle: "full",
    timeStyle: "short"
  }) + " WIB";
}

function renderAbsenBoard(absenData, groupName) {
  const hadirList = absenData.list.filter(x => x.status === "hadir");
  const izinList = absenData.list.filter(x => x.status === "izin");
  const sakitList = absenData.list.filter(x => x.status === "sakit");
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
    const note = item.reason ? ` (${item.reason})` : "";
    return `${branch}  ◦  *${index + 1}.* @${item.jid.split("@")[0]} - ${item.name}${note}`;
  }).join("\n") : "└  ◦  Belum ada anggota yang hadir";
  const izinLines = izinList.length ? izinList.map((item, index) => {
    const isLast = index === izinList.length - 1;
    const branch = isLast ? "└" : "│";
    const reason = item.reason ? ` [Alasan: ${item.reason}]` : "";
    return `${branch}  ◦  *${index + 1}.* @${item.jid.split("@")[0]} - ${item.name}${reason}`;
  }).join("\n") : "";
  const sakitLines = sakitList.length ? sakitList.map((item, index) => {
    const isLast = index === sakitList.length - 1;
    const branch = isLast ? "└" : "│";
    const reason = item.reason ? ` [Ket: ${item.reason}]` : "";
    return `${branch}  ◦  *${index + 1}.* @${item.jid.split("@")[0]} - ${item.name}${reason}`;
  }).join("\n") : "";
  let text = `–  *A B S E N S I*

┌  ◦  *Group* : ${groupName}
│  ◦  *Agenda* : ${absenData.title}
│  ◦  *Started* : ${formatWIB(absenData.createdAt)}
${remainingText}└  ◦  *Total* : ${absenData.list.length} Anggota Terdata

–  *S U M M A R Y*

┌  ◦  *Hadir* : ${hadirList.length} Orang
│  ◦  *Izin* : ${izinList.length} Orang
└  ◦  *Sakit* : ${sakitList.length} Orang

–  *H A D I R*

${hadirLines}\n\n`;
  if (izinList.length > 0) {
    text += `–  *I Z I N*

${izinLines}\n\n`;
  }
  if (sakitList.length > 0) {
    text += `–  *S A K I T*

${sakitLines}\n\n`;
  }
  return text.trim();
}
async function sendAbsenListMessage(sock, ctx, chatId, textContent, sections = [], buttonTitle = "Pilih Kehadiran", quotedMsg = null, mentions = []) {
  const botName = global.bot?.name || "Wudysoft";
  const footerText = global.bot?.footer || `${botName} • Attendance System`;
  const allMentions = Array.from(new Set([...mentions, ctx?.sender].filter(j => j && typeof j === "string" && j.endsWith("@s.whatsapp.net"))));
  const singleSelectButton = [{
    name: "single_select",
    buttonParamsJson: JSON.stringify({
      title: buttonTitle,
      sections: sections
    })
  }];
  const options = {
    jid: chatId,
    to: chatId,
    params: {
      bottom_sheet: {
        in_thread_buttons_limit: 1,
        divider_indices: [1],
        list_title: `${botName} • Presensi Grup`,
        button_title: buttonTitle
      }
    },
    contextInfo: {
      mentionedJid: allMentions,
      forwardingScore: 0,
      isForwarded: false
    },
    quoted: quotedMsg || undefined
  };
  let sentMsg = null;
  if (typeof ctx?.sendCta === "function" && chatId === ctx.id) {
    try {
      sentMsg = await ctx.sendCta(textContent, footerText, singleSelectButton, options);
    } catch (e) {
      console.error("[Absen sendCta Error]:", e.message);
    }
  }
  if (!sentMsg) {
    try {
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
                buttons: singleSelectButton
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
      mentions: allMentions
    }, {
      quoted: quotedMsg
    });
  }
  return sentMsg;
}

function buildAbsenSections(prefix, isAdmin = false, isActive = true) {
  const sections = [];
  if (isActive) {
    sections.push({
      title: "📌 PILIH STATUS KEHADIRAN",
      rows: [{
        title: "✅ Hadir Sekarang",
        description: "Konfirmasi kehadiran Anda pada agenda ini",
        id: `${prefix}absen hadir`
      }, {
        title: "📝 Izin Tidak Hadir",
        description: "Tidak bisa hadir karena urusan penting / izin",
        id: `${prefix}absen izin`
      }, {
        title: "🤒 Sedang Sakit",
        description: "Tidak dapat hadir dikarenakan kondisi sakit",
        id: `${prefix}absen sakit`
      }]
    });
    sections.push({
      title: "📊 INFORMASI & REKAP",
      rows: [{
        title: "📋 Cek Rekap Hadir",
        description: "Lihat rincian seluruh anggota yang telah terdata",
        id: `${prefix}absen cek`
      }]
    });
    if (isAdmin) {
      sections.push({
        title: "⚙️ PENGATURAN ADMIN",
        rows: [{
          title: "🔒 Tutup Sesi Presensi",
          description: "Akhiri sesi absensi & kirim rekapitulasi akhir",
          id: `${prefix}absen tutup`
        }, {
          title: "🗑️ Reset Data Presensi",
          description: "Bersihkan semua daftar absensi grup",
          id: `${prefix}absen reset`
        }]
      });
    }
  } else {
    if (isAdmin) {
      sections.push({
        title: "🚀 KONTROL ADMIN",
        rows: [{
          title: "📢 Buka Presensi Baru",
          description: "Buka sesi presensi rutin baru di grup ini",
          id: `${prefix}absen start Presensi Rutin`
        }]
      });
    }
  }
  return sections;
}
export default {
  name: "absen",
  aliases: ["absensi", "presensi", "hadir", "izin", "sakit"],
  description: "Sistem presensi kehadiran interaktif (List Single Select) untuk grup WhatsApp",
  category: "Group",
  example: ".absen (Klik list pilihan) / .absen Rapat Kerja / .absen tutup",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const chatId = ctx?.id || msg?.key?.remoteJid;
      if (!chatId || !chatId.endsWith("@g.us")) return;
      initDB(chatId);
      const groupDb = global.db.group[chatId];
      const absen = groupDb?.absen;
      if (absen && absen.active && absen.expiresAt && Date.now() >= absen.expiresAt) {
        absen.active = false;
        saveDB();
        const groupName = groupDb.subject || "Grup WhatsApp";
        const summaryText = `–  *T I M E  O U T*

Waktu presensi untuk agenda *"${absen.title}"* telah ditutup otomatis.

${renderAbsenBoard(absen, groupName)}`;
        const mentions = absen.list.map(x => x.jid);
        await sock.sendMessage(chatId, {
          text: summaryText,
          mentions: mentions
        });
      }
    } catch (e) {
      console.error("[ABSEN BEFORE CHECK ERROR]:", e.message);
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
      const chatId = ctx.id || ctx.chat;
      const groupName = ctx.groupData?.subject || ctx.groupMetadata?.subject || "Grup WhatsApp";
      const cmd = (ctx.cmd || ctx.command || "").toLowerCase();
      const userJid = ctx.sender;
      const userName = ctx.pushname || ctx.pushName || userJid.split("@")[0];
      initDB(chatId);
      const groupDb = global.db.group[chatId];
      let absen = groupDb.absen;
      const rawInput = (ctx.query || ctx.text || "").trim();
      const firstArg = (ctx.args?.[0] || "").toLowerCase().trim();
      const isUserAdmin = Boolean(ctx.isAdmin || ctx.isOwner || ctx.isROwner);
      let action = null;
      let reasonText = "";
      if (["hadir", "izin", "sakit"].includes(cmd)) {
        action = cmd;
        reasonText = ctx.args?.join(" ") || "";
      } else if (["start", "mulai", "buka", "create"].includes(firstArg)) {
        action = "start";
      } else if (["tutup", "close", "stop", "end", "selesai"].includes(firstArg)) {
        action = "close";
      } else if (["reset", "hapus", "clear", "delete"].includes(firstArg)) {
        action = "reset";
      } else if (["cek", "list", "status", "view", "papan"].includes(firstArg)) {
        action = "view";
      } else if (["hadir", "izin", "sakit"].includes(firstArg)) {
        action = firstArg;
        reasonText = ctx.args?.slice(1).join(" ") || "";
      }
      if (!action && !rawInput) {
        if (absen && absen.active) {
          const userStatus = absen.list.find(x => x.jid === userJid);
          let myStatusNote = userStatus ? `Status Anda: *${userStatus.status.toUpperCase()}*` : `Anda *belum mengisi presensi* hari ini.`;
          const boardText = `${renderAbsenBoard(absen, groupName)}

_${myStatusNote}_
Silakan buka menu list di bawah untuk memilih status kehadiran Anda.`;
          const sections = buildAbsenSections(prefix, isUserAdmin, true);
          const allMentions = absen.list.map(x => x.jid);
          if (typeof ctx?.react === "function") await ctx.react("📋");
          return await sendAbsenListMessage(sock, ctx, chatId, boardText, sections, "📋 PILIH STATUS KEHADIRAN", quotedMsg, allMentions);
        }
        if (isUserAdmin) {
          const emptyText = `–  *P R E S E N S I*

Belum ada sesi presensi yang sedang aktif di grup ini.

┌  ◦  *Format* : ${prefix}absen <agenda>
│  ◦  *Example 1* : ${prefix}absen Rapat Kerja
└  ◦  *Example 2* : ${prefix}absen 1h Briefing Pagi

Buka menu list di bawah untuk membuka presensi baru secara cepat.`;
          const sections = buildAbsenSections(prefix, true, false);
          if (typeof ctx?.react === "function") await ctx.react("ℹ️");
          return await sendAbsenListMessage(sock, ctx, chatId, emptyText, sections, "🚀 BUKA PRESENSI BARU", quotedMsg);
        } else {
          if (typeof ctx?.react === "function") await ctx.react("ℹ️");
          return ctx.reply("ℹ️ Belum ada sesi presensi yang dibuka oleh Admin.");
        }
      }
      if (!action && rawInput) {
        if ((!absen || !absen.active) && isUserAdmin) {
          action = "start";
        } else if (absen && absen.active) {
          action = "hadir";
          reasonText = rawInput;
        }
      }
      if (action === "start") {
        if (!isUserAdmin) {
          if (typeof ctx?.react === "function") await ctx.react("🚫");
          return ctx.reply("❌ Hanya *Admin Grup* yang dapat membuka sesi presensi.");
        }
        if (absen && absen.active) {
          if (typeof ctx?.react === "function") await ctx.react("⚠️");
          return ctx.reply(`⚠️ Masih ada sesi presensi yang sedang aktif (*${absen.title}*).\nKetik *${prefix}absen tutup* terlebih dahulu.`);
        }
        let words = ctx.args || [];
        if (words[0] && ["start", "mulai", "buka", "create"].includes(words[0].toLowerCase())) {
          words = words.slice(1);
        }
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
        groupDb.absen = {
          active: true,
          title: agendaTitle,
          createdAt: now,
          expiresAt: expiresTimestamp,
          createdBy: userJid,
          list: []
        };
        saveDB();
        let openNotice = `–  *P R E S E N S I*

Sesi presensi resmi dibuka oleh Admin.

┌  ◦  *Agenda* : ${agendaTitle}
│  ◦  *Group* : ${groupName}
│  ◦  *Creator* : @${ctx.senderNumber || userJid.split("@")[0]}\n`;
        if (durationMs > 0) {
          openNotice += `│  ◦  *Duration* : ${formatTime(durationMs)}\n`;
        }
        openNotice += `└  ◦  *Action* : Silakan ketuk tombol di bawah untuk mengisi kehadiran.`;
        const sections = buildAbsenSections(prefix, isUserAdmin, true);
        if (typeof ctx?.react === "function") await ctx.react("📢");
        return await sendAbsenListMessage(sock, ctx, chatId, openNotice, sections, "📋 ISI KEHADIRAN", quotedMsg, [userJid]);
      }
      if (["hadir", "izin", "sakit"].includes(action)) {
        if (!absen || !absen.active) {
          if (typeof ctx?.react === "function") await ctx.react("❌");
          return ctx.reply("❌ Tidak ada sesi presensi yang sedang dibuka saat ini.");
        }
        const existingIndex = absen.list.findIndex(x => x.jid === userJid);
        const note = reasonText.trim();
        if (existingIndex !== -1) {
          absen.list[existingIndex] = {
            jid: userJid,
            name: userName,
            status: action,
            reason: note,
            time: Date.now()
          };
        } else {
          absen.list.push({
            jid: userJid,
            name: userName,
            status: action,
            reason: note,
            time: Date.now()
          });
        }
        saveDB();
        if (typeof ctx?.react === "function") {
          const emoji = action === "hadir" ? "✅" : action === "izin" ? "📝" : "🤒";
          await ctx.react(emoji);
        }
        const confirmText = `–  *A T T E N D A N C E*

Presensi Anda berhasil dicatat ke sistem.

┌  ◦  *Name* : ${userName}
└  ◦  *Status* : ${action.toUpperCase()}${note ? ` (${note})` : ""}

${renderAbsenBoard(absen, groupName)}`;
        const sections = buildAbsenSections(prefix, isUserAdmin, true);
        const allMentions = absen.list.map(x => x.jid);
        return await sendAbsenListMessage(sock, ctx, chatId, confirmText, sections, "📋 UBAH / LIHAT STATUS", quotedMsg, allMentions);
      }
      if (action === "view") {
        if (!absen) {
          if (typeof ctx?.react === "function") await ctx.react("ℹ️");
          return ctx.reply("ℹ️ Belum pernah ada data presensi di grup ini.");
        }
        const boardText = renderAbsenBoard(absen, groupName);
        const sections = buildAbsenSections(prefix, isUserAdmin, absen.active);
        const allMentions = absen.list.map(x => x.jid);
        if (typeof ctx?.react === "function") await ctx.react("📋");
        return await sendAbsenListMessage(sock, ctx, chatId, boardText, sections, "📋 PILIH OPSI", quotedMsg, allMentions);
      }
      if (action === "close") {
        if (!isUserAdmin) {
          if (typeof ctx?.react === "function") await ctx.react("🚫");
          return ctx.reply("❌ Hanya *Admin Grup* yang dapat menutup sesi presensi.");
        }
        if (!absen || !absen.active) {
          if (typeof ctx?.react === "function") await ctx.react("⚠️");
          return ctx.reply("⚠️ Sesi presensi sedang tidak aktif.");
        }
        absen.active = false;
        saveDB();
        const closeText = `–  *C L O S E D*

Sesi presensi resmi ditutup oleh Admin.

┌  ◦  *Closed By* : @${ctx.senderNumber || userJid.split("@")[0]}
└  ◦  *Agenda* : ${absen.title}

Rekapitulasi akhir presensi:

${renderAbsenBoard(absen, groupName)}`;
        if (typeof ctx?.react === "function") await ctx.react("🔒");
        const allMentions = absen.list.map(x => x.jid);
        return await sendAbsenListMessage(sock, ctx, chatId, closeText, [], "Sesi Ditutup", quotedMsg, allMentions);
      }
      if (action === "reset") {
        if (!isUserAdmin) {
          if (typeof ctx?.react === "function") await ctx.react("🚫");
          return ctx.reply("❌ Hanya *Admin Grup* yang dapat mereset data presensi.");
        }
        groupDb.absen = null;
        saveDB();
        if (typeof ctx?.react === "function") await ctx.react("🗑️");
        return ctx.reply(`–  *R E S E T*

Seluruh data riwayat presensi di grup ini telah dibersihkan.`);
      }
    } catch (error) {
      console.error("[ABSEN COMMAND ERROR]:", error);
      if (typeof ctx?.react === "function") await ctx.react("❌");
      ctx.reply(`❌ Terjadi kesalahan: ${error?.message || error}`);
    }
  }
};