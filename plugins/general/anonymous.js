import {
  simpleQuoted
} from "../../lib/quoted.js";
import {
  copyNForward
} from "../../core/serialize.js";
import db from "../../data/db.js";

function initDB() {
  if (!global.db) global.db = {};
  if (!global.db.anonymous) {
    global.db.anonymous = {
      queue: [],
      rooms: {}
    };
  }
  if (!Array.isArray(global.db.anonymous.queue)) {
    global.db.anonymous.queue = [];
  }
  if (typeof global.db.anonymous.rooms !== "object" || global.db.anonymous.rooms === null) {
    global.db.anonymous.rooms = {};
  }
}

function saveDB() {
  if (typeof db?.write === "function" && global.db) {
    db.write(global.db).catch(() => {});
  }
}

function maskNumber(jid = "") {
  const num = jid.split("@")[0].replace(/\D/g, "");
  if (!num) return "Secret User";
  if (num.length <= 6) return `+${num.slice(0, 2)}****`;
  return `+${num.slice(0, 4)}-****-${num.slice(-3)}`;
}
async function sendAnonCta(sock, ctx, targetJid, bodyText, footerText, buttons, quoted = null) {
  const botName = global.bot?.name || "WudysoftBot";
  const extractedMentions = (bodyText.match(/@(\d+)/g) || []).map(v => `${v.replace("@", "")}@s.whatsapp.net`);
  const mentions = Array.from(new Set([targetJid, ...extractedMentions]));
  const options = {
    params: {
      bottom_sheet: {
        in_thread_buttons_limit: 2,
        divider_indices: [1],
        list_title: `${botName} • Anonymous Chat`,
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
  } catch (_) {}
  return await sock.sendMessage(targetJid, {
    text: `${bodyText}\n\n_${footerText}_`,
    mentions: mentions
  }, {
    quoted: quoted
  });
}
export default {
  name: "anonymous",
  aliases: ["anon", "anonym", "chat", "randomchat", "menfess"],
  description: "Cari teman obrolan rahasia secara anonim (Cari / Stop / Next / Skip)",
  category: "Fun",
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
      const partnerJid = global.db.anonymous.rooms[senderJid];
      if (!partnerJid) return;
      const userText = (ctx?.text || ctx?.query || msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "").trim();
      const p = ctx?.prefix || ".";
      const cmdList = [p, "/", "!", "#"];
      if (cmdList.some(prefix => userText.startsWith(prefix))) return;
      let sent = false;
      try {
        if (typeof ctx?.copyNForward === "function") {
          await ctx.copyNForward(partnerJid, msg, false);
          sent = true;
        } else if (typeof copyNForward === "function") {
          await copyNForward(sock, partnerJid, msg, false);
          sent = true;
        } else if (typeof sock?.copyNForward === "function") {
          await sock.copyNForward(partnerJid, msg, false);
          sent = true;
        }
      } catch (err) {
        console.error("[copyNForward Error]:", err.message);
      }
      if (!sent && userText) {
        await sock.sendMessage(partnerJid, {
          text: userText
        });
      }
      ctx?.react?.("📨");
      return true;
    } catch (err) {
      console.error("[ANONYMOUS CHAT RELAY ERROR]:", err);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      const isGroup = Boolean(ctx?.isGroup || ctx?.id?.endsWith("@g.us"));
      const userJid = ctx?.sender || msg?.key?.participant || msg?.key?.remoteJid;
      const userNum = (userJid || "").split("@")[0].replace(/\D/g, "");
      if (isGroup) {
        ctx?.react?.("❌");
        return ctx.reply(`–  *A N O N Y M O U S*

┌  ◦  *User* : @${userNum}
└  ◦  *Keterangan* : Fitur ini hanya dapat digunakan di Private Chat (PC).`, {
          mentions: [userJid]
        });
      }
      ctx?.react?.("⏳");
      initDB();
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • Anonymous Service`;
      const p = ctx?.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const subCommand = (ctx?.args?.[0] || ctx?.query || "").trim().toLowerCase();
      const buttonsDefault = [{
        name: "quick_reply",
        display_text: "🔍 Cari Partner",
        id: `${p}anon start`
      }, {
        name: "quick_reply",
        display_text: "⏭️ Next / Skip",
        id: `${p}anon next`
      }, {
        name: "quick_reply",
        display_text: "🛑 Stop Chat",
        id: `${p}anon stop`
      }];
      if (["stop", "keluar", "end", "leave"].includes(subCommand)) {
        const queueIdx = global.db.anonymous.queue.indexOf(userJid);
        if (queueIdx !== -1) {
          global.db.anonymous.queue.splice(queueIdx, 1);
          saveDB();
          ctx?.react?.("🛑");
          const cancelMsg = `–  *A N O N Y M O U S*

┌  ◦  *User* : @${userNum}
└  ◦  *Status* : Pencarian Dibatalkan

Anda telah berhasil keluar dari antrean pencarian partner.`;
          return await sendAnonCta(sock, ctx, userJid, cancelMsg, botFooter, buttonsDefault, quotedMsg);
        }
        const partnerJid = global.db.anonymous.rooms[userJid];
        if (partnerJid) {
          delete global.db.anonymous.rooms[userJid];
          delete global.db.anonymous.rooms[partnerJid];
          saveDB();
          ctx?.react?.("🛑");
          const userStopMsg = `–  *A N O N Y M O U S*

┌  ◦  *User* : @${userNum}
└  ◦  *Status* : Obrolan Terputus

Sesi obrolan selesai. Anda telah memutuskan sambungan dengan partner.`;
          await sendAnonCta(sock, ctx, userJid, userStopMsg, botFooter, buttonsDefault, quotedMsg);
          const partnerBtns = [{
            name: "quick_reply",
            display_text: "🔍 Cari Partner Baru",
            id: `${p}anon start`
          }, {
            name: "quick_reply",
            display_text: "🏠 Menu Utama",
            id: `${p}menu`
          }];
          const partnerStopMsg = `–  *A N O N Y M O U S*

┌  ◦  *Status* : Obrolan Terputus
└  ◦  *Keterangan* : Partner telah memutuskan sesi obrolan.

Gunakan tombol di bawah untuk mencari teman mengobrol yang baru.`;
          return await sendAnonCta(sock, ctx, partnerJid, partnerStopMsg, botFooter, partnerBtns, null);
        }
        ctx?.react?.("❓");
        return ctx.reply(`–  *A N O N Y M O U S*

┌  ◦  *User* : @${userNum}
└  ◦  *Status* : Tidak Sedang Mengobrol

Gunakan perintah \`${p}anon start\` untuk mencari teman obrolan baru.`, {
          mentions: [userJid]
        });
      }
      if (["next", "skip", "lewati"].includes(subCommand)) {
        const partnerJid = global.db.anonymous.rooms[userJid];
        if (partnerJid) {
          delete global.db.anonymous.rooms[userJid];
          delete global.db.anonymous.rooms[partnerJid];
          saveDB();
          const partnerSkipMsg = `–  *A N O N Y M O U S*

┌  ◦  *Status* : Obrolan Dilewati
└  ◦  *Keterangan* : Partner telah melewati obrolan untuk mencari orang lain.`;
          await sendAnonCta(sock, ctx, partnerJid, partnerSkipMsg, botFooter, [{
            name: "quick_reply",
            display_text: "🔍 Cari Partner Baru",
            id: `${p}anon start`
          }], null);
        }
        const qIndex = global.db.anonymous.queue.indexOf(userJid);
        if (qIndex !== -1) {
          global.db.anonymous.queue.splice(qIndex, 1);
          saveDB();
        }
      }
      if (["start", "cari", "next", "skip", "lewati", "find"].includes(subCommand)) {
        if (global.db.anonymous.rooms[userJid]) {
          ctx?.react?.("❓");
          return ctx.reply(`–  *A N O N Y M O U S*

┌  ◦  *User* : @${userNum}
└  ◦  *Status* : Masih Dalam Obrolan

Gunakan \`${p}anon next\` untuk berganti partner atau \`${p}anon stop\` untuk keluar.`, {
            mentions: [userJid]
          });
        }
        if (global.db.anonymous.queue.includes(userJid)) {
          ctx?.react?.("⏳");
          return ctx.reply(`–  *A N O N Y M O U S*

┌  ◦  *User* : @${userNum}
└  ◦  *Status* : Menunggu Antrean

Sistem sedang mencari partner online, mohon bersabar sejenak...`, {
            mentions: [userJid]
          });
        }
        if (global.db.anonymous.queue.length > 0) {
          const partnerJid = global.db.anonymous.queue.shift();
          global.db.anonymous.rooms[userJid] = partnerJid;
          global.db.anonymous.rooms[partnerJid] = userJid;
          saveDB();
          const connectedButtons = [{
            name: "quick_reply",
            display_text: "⏭️ Next Partner",
            id: `${p}anon next`
          }, {
            name: "quick_reply",
            display_text: "🛑 Stop Chat",
            id: `${p}anon stop`
          }];
          const userTextNotif = `–  *C O N N E C T E D*

┌  ◦  *User* : @${userNum}
│  ◦  *Partner* : ${maskNumber(partnerJid)}
│  ◦  *Tipe* : Private Anonymous
└  ◦  *Status* : Berhasil Terhubung

Silakan kirim pesan (teks, media, vn, stiker) untuk mulai mengobrol.`;
          const partnerNum = (partnerJid || "").split("@")[0].replace(/\D/g, "");
          const partnerTextNotif = `–  *C O N N E C T E D*

┌  ◦  *User* : @${partnerNum}
│  ◦  *Partner* : ${maskNumber(userJid)}
│  ◦  *Tipe* : Private Anonymous
└  ◦  *Status* : Berhasil Terhubung

Silakan kirim pesan (teks, media, vn, stiker) untuk mulai mengobrol.`;
          ctx?.react?.("✅");
          await sendAnonCta(sock, ctx, userJid, userTextNotif, botFooter, connectedButtons, quotedMsg);
          return await sendAnonCta(sock, ctx, partnerJid, partnerTextNotif, botFooter, connectedButtons, null);
        }
        global.db.anonymous.queue.push(userJid);
        saveDB();
        ctx?.react?.("🔍");
        const waitingButtons = [{
          name: "quick_reply",
          display_text: "🛑 Batal Cari",
          id: `${p}anon stop`
        }];
        const waitingMsg = `–  *S E A R C H I N G*

┌  ◦  *User* : @${userNum}
│  ◦  *Status* : Mencari Partner...
└  ◦  *Antrean* : ${global.db.anonymous.queue.length} Menunggu

Mohon tunggu sebentar, sistem sedang menghubungkanmu dengan pengguna lain.`;
        return await sendAnonCta(sock, ctx, userJid, waitingMsg, botFooter, waitingButtons, quotedMsg);
      }
      const isChatting = Boolean(global.db.anonymous.rooms[userJid]);
      const isQueued = global.db.anonymous.queue.includes(userJid);
      const statusText = isChatting ? "Connected" : isQueued ? "Waiting in Queue" : "Idle";
      const totalRooms = Math.floor(Object.keys(global.db.anonymous.rooms).length / 2);
      const statusMsg = `–  *A N O N Y M O U S  C H A T*

Format penggunaan:
┌  ◦  *Cari Partner* : \`${p}anon start\`
│  ◦  *Ganti Partner* : \`${p}anon next\`
└  ◦  *Berhenti Chat* : \`${p}anon stop\`

–  *S T A T U S*

┌  ◦  *User* : @${userNum}
│  ◦  *Status* : ${statusText}
│  ◦  *Antrean* : ${global.db.anonymous.queue.length} Menunggu
└  ◦  *Sesi Aktif* : ${totalRooms} Room

Layanan obrolan rahasia secara anonim tanpa menampilkan nomor asli.`;
      ctx?.react?.("✅");
      await sendAnonCta(sock, ctx, userJid, statusMsg, botFooter, buttonsDefault, quotedMsg);
    } catch (e) {
      console.error("[ANONYMOUS ERROR]:", e);
      ctx?.react?.("❌");
      ctx.reply(`❌ Gagal memproses anonymous chat: ${e.message}`);
    }
  }
};