import {
  simpleQuoted,
  metaQuoted
} from "../../lib/quoted.js";
import {
  resolveLidToJid,
  resolveLidProactively,
  decodeJid,
  extractNum
} from "../../core/serialize.js";
import db from "../../data/db.js";

function ensureUserDb(jid, name = "Member") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  try {
    db?.ensureUser?.(jid);
  } catch (_) {}
  if (!global.db.user[jid]) {
    global.db.user[jid] = {
      id: jid,
      name: name,
      lastSeen: 0,
      presence: "offline"
    };
  }
  return global.db.user[jid];
}
export default {
  name: "listonline",
  aliases: ["onlinelist", "whosonline", "online", "here"],
  description: "Melihat daftar member grup yang sedang online via real-time presence & activity log",
  category: "Group",
  group: true,
  admin: false,
  example: ".listonline",
  execute: async (sock, ctx, msg) => {
    try {
      if (!ctx.isGroup && !ctx.id?.endsWith("@g.us")) {
        return ctx.reply("❌ Fitur ini khusus hanya dapat digunakan di dalam grup.");
      }
      ctx.react?.("⏳");
      const groupId = ctx.id;
      const quotedMsg = typeof metaQuoted === "function" ? metaQuoted(ctx) : typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const botContext = global.bot?.utils?.contextInfo || {};
      const senderJid = (ctx.sender || ctx.from || "").split(":")[0].replace(/[^0-9]/g, "") + "@s.whatsapp.net";
      const selfUser = ensureUserDb(senderJid, ctx.name);
      selfUser.lastSeen = Date.now();
      selfUser.presence = "available";
      if (!global._presenceListenerAttached && sock.ev) {
        global._presenceListenerAttached = true;
        sock.ev.on("presence.update", async ({
          id,
          presences
        }) => {
          if (!presences) return;
          for (const [jid, data] of Object.entries(presences)) {
            let cleanJid = decodeJid(jid);
            if (cleanJid.endsWith("@lid")) {
              let resolved = await resolveLidToJid(cleanJid, sock, null, []);
              if (resolved.endsWith("@lid") && typeof resolveLidProactively === "function") {
                const pro = await resolveLidProactively(sock, resolved);
                if (pro.jid) resolved = pro.jid;
              }
              cleanJid = resolved;
            }
            const cleanNum = extractNum(cleanJid);
            const userJid = cleanNum ? `${cleanNum}@s.whatsapp.net` : cleanJid;
            const realStatus = data?.lastKnownPresence || data?.presence || "unavailable";
            global._presenceMap?.set(jid, {
              ...data,
              presence: realStatus,
              timestamp: Date.now()
            });
            if (cleanNum) {
              global._presenceMap?.set(cleanNum, {
                ...data,
                presence: realStatus,
                timestamp: Date.now()
              });
            }
            const u = ensureUserDb(userJid);
            if (["available", "composing", "recording"].includes(realStatus)) {
              u.lastSeen = Date.now();
              u.presence = realStatus;
            } else {
              u.presence = "offline";
            }
          }
          db?.write?.(global.db);
        });
      }
      const groupMeta = await sock.groupMetadata(groupId).catch(() => null);
      if (!groupMeta || !groupMeta.participants?.length) {
        ctx.react?.("❌");
        return ctx.reply("❌ Gagal memuat metadata anggota grup.");
      }
      const participants = groupMeta.participants;
      const memberList = [];
      for (const p of participants) {
        const rawJid = decodeJid(p.id || p.jid || p.phoneNumber || "");
        if (!rawJid) continue;
        let userJid = rawJid;
        const isLid = rawJid.endsWith("@lid");
        if (isLid) {
          if (p.phoneNumber) {
            const clean = String(p.phoneNumber).replace(/\D/g, "");
            if (clean.length >= 6) userJid = `${clean}@s.whatsapp.net`;
          }
          if (userJid.endsWith("@lid")) {
            userJid = await resolveLidToJid(rawJid, sock, null, participants);
          }
          if (userJid.endsWith("@lid") && typeof resolveLidProactively === "function") {
            const pro = await resolveLidProactively(sock, userJid);
            if (pro.jid) userJid = pro.jid;
          }
          if (userJid.endsWith("@lid")) {
            const num = extractNum(userJid);
            if (num) userJid = `${num}@s.whatsapp.net`;
          }
          if (!userJid.endsWith("@lid")) {
            global.lidPhoneCache?.set(rawJid, userJid);
          }
        }
        memberList.push({
          rawJid: rawJid,
          userJid: userJid,
          isLid: isLid
        });
      }
      for (const m of memberList) {
        try {
          await sock.presenceSubscribe(m.rawJid);
          if (m.userJid && m.userJid !== m.rawJid) {
            await sock.presenceSubscribe(m.userJid);
          }
        } catch (_) {}
      }
      await new Promise(resolve => setTimeout(resolve, 2500));
      const onlineList = [];
      const now = Date.now();
      const usersDb = global.db?.user || db?.user || {};
      const presenceMap = global._presenceMap || new Map();
      for (const m of memberList) {
        const cleanNumber = extractNum(m.userJid);
        const userData = usersDb[m.userJid] || (cleanNumber ? usersDb[`${cleanNumber}@s.whatsapp.net`] : null) || usersDb[m.rawJid];
        const realPresence = presenceMap.get(m.rawJid) || presenceMap.get(m.userJid) || (cleanNumber ? presenceMap.get(cleanNumber) : null);
        let isOnline = false;
        let lastStatus = "available";
        if (realPresence) {
          const presType = realPresence.lastKnownPresence || realPresence.presence;
          const isFresh = now - (realPresence.timestamp || 0) < 15e4;
          if (["available", "composing", "recording"].includes(presType) && isFresh) {
            isOnline = true;
            lastStatus = presType;
          }
        }
        if (!isOnline && userData) {
          const lastActive = userData.lastSeen || 0;
          const status = userData.presence;
          const diffMinutes = (now - lastActive) / 1e3 / 60;
          if (diffMinutes <= 3 && ["available", "composing", "recording"].includes(status)) {
            isOnline = true;
            lastStatus = status;
          }
        }
        if (isOnline) {
          const validDisplayJid = !m.userJid.endsWith("@lid") ? m.userJid : m.rawJid;
          if (!onlineList.includes(validDisplayJid)) {
            onlineList.push(validDisplayJid);
          }
        }
      }
      ctx.react?.("✅");
      let responseText = `–  *L I S T  O N L I N E*\n\n`;
      responseText += `┌  ◦  *Grup* : ${groupMeta.subject}\n`;
      responseText += `│  ◦  *Total Member* : ${participants.length}\n`;
      responseText += `└  ◦  *Online* : ${onlineList.length} Member\n\n`;
      if (onlineList.length > 0) {
        responseText += `*Daftar Member Aktif / Online :*\n`;
        onlineList.forEach((jid, index) => {
          const num = extractNum(jid);
          const uData = usersDb[jid] || (num ? usersDb[`${num}@s.whatsapp.net`] : null);
          const pMap = presenceMap.get(jid) || (num ? presenceMap.get(num) : null);
          const rawStatus = pMap?.lastKnownPresence || pMap?.presence || uData?.presence;
          const statusTag = rawStatus === "composing" ? "mengetik..." : rawStatus === "recording" ? "merekam suara..." : "online";
          responseText += `┌  ◦  *${index + 1}.* @${num || jid.split("@")[0]} _(${statusTag})_\n`;
        });
        responseText += `└  ◦  _Data terverifikasi via presence & activity log_\n`;
      } else {
        responseText += `_Tidak ada anggota yang terdeteksi aktif/online saat ini._\n> WhatsApp hanya menyiarkan status presence untuk kontak tersimpan atau yang sedang aktif bertukar pesan.`;
      }
      return await sock.sendMessage(ctx.id, {
        text: responseText,
        mentions: onlineList,
        contextInfo: {
          ...botContext,
          mentionedJid: onlineList
        }
      }, {
        quoted: quotedMsg
      });
    } catch (error) {
      console.error("[ListOnline DB Error]:", error);
      ctx.react?.("❌");
      ctx.reply(`❌ Gagal mengambil daftar online: ${error?.message || error}`);
    }
  }
};