import {
  simpleQuoted
} from "../../lib/quoted.js";
import db from "../../data/db.js";
async function getFilteredGroupList(sock) {
  const dbGroups = global.db?.group || db?.group || {};
  const listMap = new Map();
  try {
    const participating = await sock.groupFetchAllParticipating();
    if (participating && typeof participating === "object") {
      for (const [jid, meta] of Object.entries(participating)) {
        if (!jid.endsWith("@g.us")) continue;
        const dbData = dbGroups[jid] || {};
        const isBanned = Boolean(dbData.bans === true);
        const subject = meta?.subject || dbData?.subject || `Grup (${jid.split("@")[0].slice(-5)})`;
        const memberCount = meta?.participants?.length || meta?.size || 0;
        listMap.set(jid, {
          jid: jid,
          subject: subject,
          memberCount: memberCount,
          isBanned: isBanned
        });
      }
    }
  } catch (err) {
    console.error("[GROUPLIST] Gagal fetch participating:", err?.message || err);
  }
  if (listMap.size === 0) {
    for (const [jid, data] of Object.entries(dbGroups)) {
      if (!jid.endsWith("@g.us")) continue;
      if (!data?.subject && !data?.name) continue;
      const isBanned = Boolean(data?.bans === true);
      const subject = data?.subject || data?.name;
      const memberCount = data?.participants?.length || data?.memberCount || 0;
      listMap.set(jid, {
        jid: jid,
        subject: subject,
        memberCount: memberCount,
        isBanned: isBanned
      });
    }
  }
  return Array.from(listMap.values());
}
export default {
  name: "grouplist",
  aliases: ["listgroup", "listgrup", "listgc", "gclist"],
  description: "Menampilkan daftar seluruh grup yang diikuti bot (Real-time Baileys)",
  category: "Group",
  example: ".grouplist",
  execute: async (sock, ctx, msg) => {
    try {
      if (typeof ctx.react === "function") await ctx.react("⏳");
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "Paimon-bot";
      const botFooter = global.bot?.footer || `${botName} • Group Directory`;
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const groupList = await getFilteredGroupList(sock);
      if (groupList.length === 0) {
        if (typeof ctx.react === "function") await ctx.react("❌");
        return ctx.reply("❌ Bot saat ini tidak terdeteksi di grup manapun.");
      }
      const seenGroupJids = new Set();
      const activeRows = [];
      const bannedRows = [];
      const currentChatId = ctx.id || ctx.chat;
      const isCurrentGroup = ctx.isGroup || currentChatId?.endsWith("@g.us");
      if (isCurrentGroup && currentChatId) {
        seenGroupJids.add(currentChatId);
        const currentGroupData = groupList.find(g => g.jid === currentChatId);
        const currentName = currentGroupData?.subject || "Grup Saat Ini";
        const currentMembers = currentGroupData?.memberCount ? `${currentGroupData.memberCount} Member` : "Aktif";
        const isCurBanned = Boolean(currentGroupData?.isBanned);
        if (isCurBanned) {
          bannedRows.push({
            title: `🚫 📍 ${currentName.slice(0, 28)}`,
            description: `Grup Ini • STATUS: BANNED ❌`,
            id: `${prefix}groupinfo ${currentChatId}`
          });
        } else {
          activeRows.push({
            title: `📍 ${currentName.slice(0, 30)}`,
            description: `Grup Ini • ${currentMembers}`,
            id: `${prefix}groupinfo ${currentChatId}`
          });
        }
      }
      for (const group of groupList) {
        if (seenGroupJids.has(group.jid)) continue;
        seenGroupJids.add(group.jid);
        const groupTitle = group.subject || `Group (${group.jid.split("@")[0].slice(-5)})`;
        const memberText = group.memberCount ? `${group.memberCount} Member` : "Terdaftar";
        const shortJid = group.jid.split("@")[0].slice(-8);
        if (group.isBanned) {
          bannedRows.push({
            title: `🚫 ${groupTitle.slice(0, 30)}`,
            description: `STATUS: BANNED ❌ | ID: ${shortJid}`,
            id: `${prefix}groupinfo ${group.jid}`
          });
        } else {
          activeRows.push({
            title: `👥 ${groupTitle.slice(0, 30)}`,
            description: `${memberText} • ID: ${shortJid}`,
            id: `${prefix}groupinfo ${group.jid}`
          });
        }
      }
      const activeGroupList = activeRows;
      const bannedGroupList = bannedRows;
      const sections = [];
      if (activeGroupList.length > 0) {
        sections.push({
          title: `🟢 DAFTAR GRUP AKTIF (${activeGroupList.length})`,
          rows: activeGroupList.slice(0, 25)
        });
      }
      if (bannedGroupList.length > 0) {
        sections.push({
          title: `🔴 DAFTAR GRUP TER-BAN (${bannedGroupList.length})`,
          rows: bannedGroupList.slice(0, 10)
        });
      }
      const totalGroupCount = groupList.length;
      const totalDisplayed = (sections[0]?.rows?.length || 0) + (sections[1]?.rows?.length || 0);
      const bodyText = `–  *G R O U P  L I S T*\n\n` + `Berikut adalah daftar seluruh grup WhatsApp yang diikuti oleh bot.\n\n` + `┌  ◦  *Bot Name* : ${botName}\n` + `│  ◦  *Total Grup* : ${totalGroupCount} Grup\n` + `│  ◦  *Grup Aktif* : ${activeGroupList.length} Grup\n` + `└  ◦  *Grup Ter-ban* : ${bannedGroupList.length} Grup\n\n` + `Silakan pilih grup pada tombol di bawah untuk melihat rincian informasi:`;
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: `📋 PILIH DAFTAR GRUP (${totalDisplayed})`,
          sections: sections
        })
      }];
      const bannerMedia = global.bot?.media?.banner1 || global.bot?.media?.banner2 || null;
      const options = {
        image: bannerMedia,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `${botName} • Group Directory`,
            button_title: "Lihat Daftar Grup"
          }
        },
        quoted: quotedMsg
      };
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, botFooter, buttons, options);
      } else {
        let fallbackText = `${bodyText}\n\n`;
        if (activeGroupList.length > 0) {
          fallbackText += `–  *G R U P  A K T I F* (${activeGroupList.length})\n\n`;
          activeGroupList.slice(0, 15).forEach((g, idx) => {
            fallbackText += `┌  ◦  *${idx + 1}.* ${g.title}\n└  ◦  *Perintah* : \`${g.id}\`\n\n`;
          });
        }
        await ctx.reply(fallbackText.trimEnd(), {
          quoted: quotedMsg
        });
      }
      if (typeof ctx.react === "function") await ctx.react("✅");
    } catch (error) {
      console.error("[GROUPLIST Error]:", error);
      if (typeof ctx.react === "function") await ctx.react("❌");
      ctx.reply(`❌ Gagal memuat daftar grup: ${error?.message || error}`);
    }
  }
};