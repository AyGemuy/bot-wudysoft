import {
  simpleQuoted
} from "../../lib/quoted.js";
import db from "../../data/db.js";
export default {
  name: "grouplist",
  aliases: ["listgroup", "listgrup", "listgc", "gclist"],
  description: "Menampilkan daftar seluruh grup yang diikuti bot dengan menu CTA selector ke groupinfo (Aktif & Banned terpisah)",
  category: "Group",
  example: ".grouplist",
  execute: async (sock, ctx, msg) => {
    try {
      if (typeof ctx.react === "function") await ctx.react("⏳");
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "Paimon-bot";
      const botFooter = global.bot?.footer || `${botName} • Group Directory`;
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      let groupList = [];
      const rawDbGroups = ctx.db?.group || global.db?.group || db?.group || {};
      const validDbEntries = Object.entries(rawDbGroups).filter(([jid]) => jid.endsWith("@g.us"));
      if (validDbEntries.length > 0) {
        groupList = validDbEntries.map(([jid, data]) => ({
          jid: jid,
          subject: data?.subject || data?.name || null,
          memberCount: data?.participants?.length || data?.memberCount || null,
          isBanned: Boolean(data?.bans === true)
        }));
        const missingSubjects = groupList.filter(g => !g.subject);
        if (missingSubjects.length > 0 && typeof sock.groupFetchAllParticipating === "function") {
          try {
            const fetched = await sock.groupFetchAllParticipating();
            let updated = false;
            for (const item of groupList) {
              const meta = fetched?.[item.jid];
              if (meta) {
                if (!item.subject && meta.subject) {
                  item.subject = meta.subject;
                  if (rawDbGroups[item.jid]) {
                    rawDbGroups[item.jid].subject = meta.subject;
                    updated = true;
                  }
                }
                if (!item.memberCount && meta.participants?.length) {
                  item.memberCount = meta.participants.length;
                }
              }
            }
            if (updated && typeof db?.write === "function") {
              db.write(global.db);
            }
          } catch (_) {}
        }
      }
      if (groupList.length === 0 && typeof sock.groupFetchAllParticipating === "function") {
        try {
          const fetched = await sock.groupFetchAllParticipating().catch(() => ({}));
          const entries = fetched instanceof Map ? Array.from(fetched.entries()) : Object.entries(fetched || {});
          for (const [jid, meta] of entries) {
            if (!jid.endsWith("@g.us")) continue;
            const isBanned = Boolean(rawDbGroups[jid]?.bans === true);
            const memberCount = meta?.participants?.length || meta?.size || 0;
            const subject = meta?.subject || "Grup WhatsApp";
            groupList.push({
              jid: jid,
              subject: subject,
              memberCount: memberCount,
              isBanned: isBanned
            });
            if (global.db?.group && !global.db.group[jid]) {
              global.db.group[jid] = {
                from: jid,
                subject: subject,
                bans: isBanned
              };
            }
          }
          if (typeof db?.write === "function") {
            db.write(global.db);
          }
        } catch (_) {}
      }
      if (groupList.length === 0) {
        if (typeof ctx.react === "function") await ctx.react("❌");
        return ctx.reply("❌ Bot saat ini belum terdaftar di grup manapun.");
      }
      const seenGroupJids = new Set();
      const activeRows = [];
      const bannedRows = [];
      const currentChatId = ctx.id || ctx.chat;
      const isCurrentGroup = ctx.isGroup || currentChatId?.endsWith("@g.us");
      if (isCurrentGroup && currentChatId) {
        seenGroupJids.add(currentChatId);
        const currentGroupData = groupList.find(g => g.jid === currentChatId);
        const currentName = currentGroupData?.subject || ctx.groupData?.subject || "Grup Saat Ini";
        const currentMembers = ctx.participants?.length || currentGroupData?.memberCount || "Aktif";
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
            description: `Grup Ini • ${currentMembers} Member`,
            id: `${prefix}groupinfo ${currentChatId}`
          });
        }
      }
      for (const group of groupList) {
        if (seenGroupJids.has(group.jid)) continue;
        seenGroupJids.add(group.jid);
        const groupTitle = group.subject || `Group (${group.jid.split("@")[0].slice(-5)})`;
        const memberText = group.memberCount ? `${group.memberCount} Member` : "Terdaftar";
        const shortJid = group.jid.split("@")[0];
        if (group.isBanned) {
          bannedRows.push({
            title: `🚫 ${groupTitle.slice(0, 30)}`,
            description: `STATUS: BANNED ❌ | 🆔 ${shortJid}`,
            id: `${prefix}groupinfo ${group.jid}`
          });
        } else {
          activeRows.push({
            title: `👥 ${groupTitle.slice(0, 30)}`,
            description: `${memberText} • 🆔 ${shortJid}`,
            id: `${prefix}groupinfo ${group.jid}`
          });
        }
      }
      const sections = [];
      if (activeRows.length > 0) {
        sections.push({
          title: `🟢 DAFTAR GRUP AKTIF (${activeRows.length})`,
          rows: activeRows.slice(0, 20)
        });
      }
      if (bannedRows.length > 0) {
        sections.push({
          title: `🔴 DAFTAR GRUP TER-BAN (${bannedRows.length})`,
          rows: bannedRows.slice(0, 10)
        });
      }
      const totalGroupCount = groupList.length;
      const totalDisplayed = (sections[0]?.rows?.length || 0) + (sections[1]?.rows?.length || 0);
      const bodyText = `–  *G R O U P  L I S T*

Berikut adalah daftar seluruh grup WhatsApp yang diikuti oleh bot.

┌  ◦  *Bot Name* : ${botName}
│  ◦  *Total Grup* : ${totalGroupCount} Grup
│  ◦  *Grup Aktif* : ${activeRows.length} Grup
└  ◦  *Grup Ter-ban* : ${bannedRows.length} Grup

Silakan pilih grup pada tombol di bawah untuk melihat rincian informasi:`;
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
        contextInfo: {
          mentionedJid: [ctx.sender],
          forwardingScore: 999,
          isForwarded: true
        },
        quoted: quotedMsg
      };
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, botFooter, buttons, options);
      } else {
        let fallbackText = `${bodyText}\n\n`;
        if (activeRows.length > 0) {
          fallbackText += `–  *G R U P  A K T I F* (${activeRows.length})\n\n`;
          activeRows.slice(0, 15).forEach((g, idx) => {
            fallbackText += `┌  ◦  *${idx + 1}.* ${g.title}\n└  ◦  *Perintah* : \`${g.id}\`\n\n`;
          });
        }
        if (bannedRows.length > 0) {
          fallbackText += `–  *G R U P  T E R B A N* (${bannedRows.length})\n\n`;
          bannedRows.slice(0, 10).forEach((g, idx) => {
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