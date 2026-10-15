import {
  simpleQuoted
} from "../../lib/quoted.js";
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
      isForwarded: false
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
    text: `${bodyText}\n\n_${footerText}_`
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
      const prefix = ctx?.prefix || ".";
      const cmdList = [prefix, "/", "!", "#"];
      if (cmdList.some(p => userText.startsWith(p))) return;
      const senderName = ctx?.pushName || msg?.pushName || "Partner";
      const maskedPhone = maskNumber(senderJid);
      const headerText = `–  *A N O N Y M O U S*\n\n[ ${senderName} • ${maskedPhone} ]`;
      const isMedia = Boolean(ctx?.isMedia || ctx?.quoted?.isMedia || msg?.message?.imageMessage || msg?.message?.videoMessage || msg?.message?.audioMessage || msg?.message?.stickerMessage || msg?.message?.documentMessage);
      if (isMedia) {
        const downloadFn = typeof ctx?.download === "function" ? ctx.download : ctx?.quoted?.download;
        let mediaBuffer = null;
        if (typeof downloadFn === "function") {
          mediaBuffer = await downloadFn().catch(() => null);
        }
        if (mediaBuffer && Buffer.isBuffer(mediaBuffer)) {
          const m = msg.message;
          const captionText = userText ? `${headerText}\n\n${userText}` : headerText;
          if (m?.imageMessage) {
            await sock.sendMessage(partnerJid, {
              image: mediaBuffer,
              caption: captionText
            });
          } else if (m?.videoMessage) {
            await sock.sendMessage(partnerJid, {
              video: mediaBuffer,
              caption: captionText
            });
          } else if (m?.audioMessage) {
            await sock.sendMessage(partnerJid, {
              text: `${headerText}\n_Mengirimkan pesan suara:_`
            });
            await sock.sendMessage(partnerJid, {
              audio: mediaBuffer,
              mimetype: "audio/mp4",
              ptt: Boolean(m.audioMessage.ptt)
            });
          } else if (m?.stickerMessage) {
            await sock.sendMessage(partnerJid, {
              text: `${headerText}\n_Mengirimkan stiker:_`
            });
            await sock.sendMessage(partnerJid, {
              sticker: mediaBuffer
            });
          } else if (m?.documentMessage) {
            await sock.sendMessage(partnerJid, {
              document: mediaBuffer,
              mimetype: m.documentMessage.mimetype || "application/octet-stream",
              fileName: m.documentMessage.fileName || "file",
              caption: captionText
            });
          }
          if (typeof ctx?.react === "function") await ctx.react("📨");
          return true;
        }
      }
      if (userText) {
        await sock.sendMessage(partnerJid, {
          text: `${headerText}\n\n${userText}`
        });
        if (typeof ctx?.react === "function") await ctx.react("📨");
        return true;
      }
    } catch (err) {
      console.error("[ANONYMOUS CHAT RELAY ERROR]:", err);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      const isGroup = Boolean(ctx?.isGroup || ctx?.id?.endsWith("@g.us"));
      if (isGroup) {
        return ctx.reply("❌ Fitur Anonymous Chat hanya dapat digunakan di Private Chat (PC).");
      }
      await ctx.react("⏳");
      initDB();
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • Anonymous Service`;
      const prefix = ctx?.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const subCommand = (ctx?.args?.[0] || ctx?.query || "").trim().toLowerCase();
      const userJid = ctx?.sender || msg?.key?.participant || msg?.key?.remoteJid;
      const userNum = userJid.split("@")[0];
      const buttonsDefault = [{
        name: "quick_reply",
        display_text: "🔍 Cari Partner",
        id: `${prefix}anon start`
      }, {
        name: "quick_reply",
        display_text: "⏭️ Next / Skip",
        id: `${prefix}anon next`
      }, {
        name: "quick_reply",
        display_text: "🛑 Stop Chat",
        id: `${prefix}anon stop`
      }];
      if (["stop", "keluar", "end", "leave"].includes(subCommand)) {
        const queueIdx = global.db.anonymous.queue.indexOf(userJid);
        if (queueIdx !== -1) {
          global.db.anonymous.queue.splice(queueIdx, 1);
          saveDB();
          await ctx.react("🛑");
          const cancelMsg = `–  *A N O N Y M O U S*

Pencarian dibatalkan. Anda telah keluar dari antrean pencarian partner.`;
          return await sendAnonCta(sock, ctx, userJid, cancelMsg, botFooter, buttonsDefault, quotedMsg);
        }
        const partnerJid = global.db.anonymous.rooms[userJid];
        if (partnerJid) {
          delete global.db.anonymous.rooms[userJid];
          delete global.db.anonymous.rooms[partnerJid];
          saveDB();
          await ctx.react("🛑");
          const userStopMsg = `–  *A N O N Y M O U S*

Obrolan dihentikan. Anda telah memutuskan koneksi dengan partner bicara.`;
          await sendAnonCta(sock, ctx, userJid, userStopMsg, botFooter, buttonsDefault, quotedMsg);
          const partnerBtns = [{
            name: "quick_reply",
            display_text: "🔍 Cari Partner Baru",
            id: `${prefix}anon start`
          }, {
            name: "quick_reply",
            display_text: "🏠 Menu Utama",
            id: `${prefix}menu`
          }];
          const partnerStopMsg = `–  *A N O N Y M O U S*

Partner telah memutuskan obrolan dan keluar dari sesi ini.`;
          return await sendAnonCta(sock, ctx, partnerJid, partnerStopMsg, botFooter, partnerBtns, null);
        }
        return ctx.reply(`⚠️ Anda sedang tidak berada di dalam sesi obrolan aktif.\nKetik *${prefix}anon start* untuk mencari teman.`);
      }
      if (["next", "skip", "lewati"].includes(subCommand)) {
        const partnerJid = global.db.anonymous.rooms[userJid];
        if (partnerJid) {
          delete global.db.anonymous.rooms[userJid];
          delete global.db.anonymous.rooms[partnerJid];
          saveDB();
          const partnerSkipMsg = `–  *A N O N Y M O U S*

Partner telah melewati obrolan untuk mencari orang lain.`;
          await sendAnonCta(sock, ctx, partnerJid, partnerSkipMsg, botFooter, [{
            name: "quick_reply",
            display_text: "🔍 Cari Partner Baru",
            id: `${prefix}anon start`
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
          return ctx.reply(`⚠️ Anda masih terhubung dengan partner!\nGunakan opsi *Next* untuk berganti partner atau *Stop* untuk keluar.`);
        }
        if (global.db.anonymous.queue.includes(userJid)) {
          return ctx.reply("⏳ Anda sudah berada di antrean. Mohon tunggu sistem menemukan partner untukmu...");
        }
        if (global.db.anonymous.queue.length > 0) {
          const partnerJid = global.db.anonymous.queue.shift();
          global.db.anonymous.rooms[userJid] = partnerJid;
          global.db.anonymous.rooms[partnerJid] = userJid;
          saveDB();
          const connectedButtons = [{
            name: "quick_reply",
            display_text: "⏭️ Next Partner",
            id: `${prefix}anon next`
          }, {
            name: "quick_reply",
            display_text: "🛑 Stop Chat",
            id: `${prefix}anon stop`
          }];
          const userTextNotif = `–  *C O N N E C T E D*

┌  ◦  *Partner* : ${maskNumber(partnerJid)}
└  ◦  *Status* : Terhubung

Silakan ketik pesan (teks, media, vn, stiker) untuk mulai mengobrol secara rahasia.`;
          const partnerTextNotif = `–  *C O N N E C T E D*

┌  ◦  *Partner* : ${maskNumber(userJid)}
└  ◦  *Status* : Terhubung

Silakan ketik pesan (teks, media, vn, stiker) untuk mulai mengobrol secara rahasia.`;
          await ctx.react("✨");
          await sendAnonCta(sock, ctx, userJid, userTextNotif, botFooter, connectedButtons, quotedMsg);
          return await sendAnonCta(sock, ctx, partnerJid, partnerTextNotif, botFooter, connectedButtons, null);
        }
        global.db.anonymous.queue.push(userJid);
        saveDB();
        await ctx.react("🔍");
        const waitingButtons = [{
          name: "quick_reply",
          display_text: "🛑 Batal Cari",
          id: `${prefix}anon stop`
        }];
        const waitingMsg = `–  *S E A R C H I N G*

┌  ◦  *Queue* : ${global.db.anonymous.queue.length} Menunggu
└  ◦  *Status* : Mencari partner...

Mohon tunggu sebentar, sistem sedang menghubungkanmu dengan pengguna lain yang online.`;
        return await sendAnonCta(sock, ctx, userJid, waitingMsg, botFooter, waitingButtons, quotedMsg);
      }
      const isChatting = Boolean(global.db.anonymous.rooms[userJid]);
      const isQueued = global.db.anonymous.queue.includes(userJid);
      const statusText = isChatting ? "Connected" : isQueued ? "Waiting in Queue" : "Idle";
      const totalRooms = Math.floor(Object.keys(global.db.anonymous.rooms).length / 2);
      const statusMsg = `Hi @${userNum}!
Layanan obrolan acak rahasia secara anonim tanpa menampilkan nomor asli.

–  *S T A T U S*

┌  ◦  *Status* : ${statusText}
│  ◦  *Queued* : ${global.db.anonymous.queue.length} Users
└  ◦  *Active Rooms* : ${totalRooms} Rooms

–  *C O M M A N D S*

┌  ◦  *${prefix}anon start* : Cari teman mengobrol
│  ◦  *${prefix}anon next* : Lewati & cari partner baru
└  ◦  *${prefix}anon stop* : Hentikan sesi obrolan saat ini

Gunakan tombol di bawah untuk interaksi cepat.`;
      await sendAnonCta(sock, ctx, userJid, statusMsg, botFooter, buttonsDefault, quotedMsg);
      await ctx.react("✅");
    } catch (e) {
      console.error("[ANONYMOUS ERROR]:", e);
      await ctx.react("❌");
      ctx.reply(`❌ Terjadi kesalahan: ${e.message}`);
    }
  }
};