import {
  simpleQuoted,
  metaQuoted
} from "../../lib/quoted.js";
import {
  decodeJid,
  extractNum,
  resolveLidToJid,
  cleanQuotedForTarget
} from "../../core/serialize.js";
import db from "../../data/db.js";

function sanitizeMentions(list = []) {
  if (!Array.isArray(list)) return [];
  return list.filter(Boolean).map(j => decodeJid(String(j).trim())).filter(j => j.endsWith("@s.whatsapp.net") && !j.endsWith("@lid"));
}
export default {
  name: "totalchat",
  aliases: ["memberchat", "topchat", "chatcount", "rankchat"],
  description: "Melihat peringkat dan total pesan yang dikirim oleh setiap member di dalam grup (Full DB)",
  category: "Group",
  group: true,
  admin: false,
  example: ".totalchat",
  execute: async (sock, ctx, msg) => {
    try {
      if (!ctx.isGroup && !ctx.id?.endsWith("@g.us")) {
        return ctx.reply("❌ Fitur ini khusus hanya dapat digunakan di dalam grup.");
      }
      ctx.react?.("⏳");
      const rawGroupId = decodeJid(ctx.id || ctx.chat || msg.key?.remoteJid || "");
      const groupId = rawGroupId.endsWith("@g.us") ? rawGroupId : `${rawGroupId.split("@")[0]}@g.us`;
      const groupNumId = groupId.split("@")[0].replace(/\D/g, "");
      const rawQuoted = typeof metaQuoted === "function" ? metaQuoted(ctx) : typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg?.key ? msg : undefined;
      const quotedMsg = cleanQuotedForTarget(rawQuoted, groupId);
      const botContext = global.bot?.utils?.contextInfo || {};
      const cachedMeta = global.groupCache?.get(groupId)?.data;
      const groupData = global.db?.group?.[groupId];
      const groupSubject = cachedMeta?.subject || groupData?.subject || ctx.groupMetadata?.subject || "Grup WhatsApp";
      const totalMemberInCache = cachedMeta?.participants?.length || groupData?.memberCount || null;
      const botId = decodeJid(sock.user?.id || sock.user?.jid || "");
      const botLid = sock.user?.lid ? decodeJid(sock.user.lid) : null;
      const botNumber = extractNum(botId);
      const rawOwners = [...Array.isArray(global.bot?.owner) ? global.bot.owner.flat(Infinity) : [global.bot?.owner], global.bot?.author?.number].filter(Boolean);
      const ownerNumbers = new Set(rawOwners.map(o => String(o).replace(/\D/g, "")).filter(n => n.length >= 6));
      const usersDb = global.db?.user || db?.user || {};
      const userMap = new Map();
      let groupTotalMessages = 0;
      for (const [rawJid, uData] of Object.entries(usersDb)) {
        if (!uData || typeof uData !== "object") continue;
        let count = uData.chatCount?.[groupId] || 0;
        if (!count && uData.chatCount) {
          for (const [gid, c] of Object.entries(uData.chatCount)) {
            if (gid.includes(groupNumId)) {
              count = Number(c) || 0;
              break;
            }
          }
        }
        if (!count || count <= 0) continue;
        let cleanJid = decodeJid(rawJid);
        if (cleanJid.endsWith("@lid")) {
          const lidNum = cleanJid.split("@")[0].split(":")[0];
          const cachedPhone = global.lidPhoneCache?.get(lidNum);
          if (cachedPhone) {
            cleanJid = `${cachedPhone}@s.whatsapp.net`;
          }
        }
        const cleanNumber = extractNum(cleanJid);
        const isOwnerAccount = ownerNumbers.has(cleanNumber);
        const isOfficialBot = Boolean(cleanJid === botId || botLid && cleanJid === botLid || cleanNumber && botNumber && cleanNumber === botNumber || uData.isOfficialBot === true);
        const isExternalBot = Boolean(!isOwnerAccount && !isOfficialBot && (uData.isBot === true || global.botJidPool?.has(cleanJid)));
        groupTotalMessages += count;
        const currentData = userMap.get(cleanJid) || {
          jid: cleanJid,
          name: uData.name || cleanNumber,
          isOwner: isOwnerAccount,
          isOfficialBot: isOfficialBot,
          isBot: isExternalBot,
          count: 0
        };
        currentData.count += count;
        if (isOwnerAccount) currentData.isOwner = true;
        if (isOfficialBot) currentData.isOfficialBot = true;
        if (isExternalBot) currentData.isBot = true;
        userMap.set(cleanJid, currentData);
      }
      const chatStats = Array.from(userMap.values());
      chatStats.sort((a, b) => b.count - a.count);
      ctx.react?.("✅");
      let responseText = `–  *T O T A L  C H A T  M E M B E R*\n\n`;
      responseText += `┌  ◦  *Grup* : ${groupSubject}\n`;
      if (totalMemberInCache) {
        responseText += `│  ◦  *Total Member* : ${totalMemberInCache}\n`;
      }
      responseText += `└  ◦  *Total Chat Terekam* : ${groupTotalMessages} pesan\n\n`;
      const mentionedJids = [];
      if (chatStats.length > 0) {
        responseText += `*Peringkat Member Teraktif :*\n`;
        chatStats.slice(0, 50).forEach((item, index) => {
          const num = extractNum(item.jid);
          if (item.jid.endsWith("@s.whatsapp.net")) {
            mentionedJids.push(item.jid);
          }
          let badge = "";
          if (item.isOfficialBot) {
            badge = " ⚡ *(Bot)*";
          } else if (item.isOwner) {
            badge = " 👑 *(Owner)*";
          } else if (item.isBot) {
            badge = " 🤖 *(Bot)*";
          }
          responseText += `┌  ◦  *${index + 1}.* @${num || item.jid.split("@")[0]}${badge}\n`;
          responseText += `└  ◦  *Pesan* : ${item.count} chat\n`;
        });
      } else {
        responseText += `_Belum ada riwayat akumulasi chat yang terdaftar untuk grup ini._`;
      }
      const safeMentions = sanitizeMentions(mentionedJids);
      return await sock.sendMessage(ctx.id, {
        text: responseText,
        mentions: safeMentions,
        contextInfo: {
          ...botContext,
          mentionedJid: safeMentions
        }
      }, {
        quoted: quotedMsg
      });
    } catch (error) {
      console.error("[TotalChat Error]:", error);
      ctx.react?.("❌");
      ctx.reply(`❌ Gagal menampilkan total chat: ${error?.message || error}`);
    }
  }
};