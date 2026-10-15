import {
  simpleQuoted
} from "../../lib/quoted.js";
const INVISIBLE_PAYLOAD = "‎".repeat(10) + "​" + "⠀".repeat(5);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
export default {
  name: "fixbug",
  aliases: ["antibug", "fixfc", "clearchatbug", "fixcrash"],
  description: "Mengatasi force close / lag di grup WhatsApp dengan penghapusan pesan msgStore & penimbunan pesan kosong",
  category: "Group",
  example: ".fixbug (atau .fixbug --to=xxx@g.us --count=10)",
  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "WudysoftBot";
    const footer = global.footer || global.bot?.footer || `_${botName}_`;
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
    try {
      const rawQuery = (ctx.query || ctx.args?.join(" ") || "").trim();
      const targetMatch = rawQuery.match(/--to=([0-9\-_]+@g\.us)/i);
      const countMatch = rawQuery.match(/--count=(\d+)/i);
      const targetJid = targetMatch ? targetMatch[1] : null;
      const count = countMatch ? parseInt(countMatch[1]) : null;
      const bannerMedia = global.bot?.media?.banner1 || global.bot?.media?.banner2 || "https://files.catbox.moe/g2e6i5.jpg";
      if (!targetJid) {
        await ctx.react("⏳");
        let allGroups = {};
        try {
          if (typeof sock.groupFetchAllParticipating === "function") {
            allGroups = await sock.groupFetchAllParticipating();
          }
        } catch (err) {
          console.error("[FIXBUG] Gagal memuat daftar grup:", err);
        }
        const seenGroupJids = new Set();
        const groupRows = [];
        const isCurrentGroup = ctx.isGroup || ctx.id?.endsWith("@g.us");
        const groupEntries = allGroups instanceof Map ? Array.from(allGroups.entries()) : Object.entries(allGroups || {});
        let currentGroupMeta = null;
        if (isCurrentGroup) {
          if (allGroups instanceof Map) {
            currentGroupMeta = allGroups.get(ctx.id);
          } else {
            currentGroupMeta = allGroups[ctx.id];
          }
          seenGroupJids.add(ctx.id);
          const currentName = currentGroupMeta?.subject || "Grup Saat Ini";
          groupRows.push({
            title: `📍 ${currentName.slice(0, 40)}`,
            description: "Bersihkan pesan bug di grup ini",
            id: `${prefix}fixbug --to=${ctx.id}`
          });
        }
        for (const [jid, meta] of groupEntries) {
          if (!jid.endsWith("@g.us") || seenGroupJids.has(jid)) continue;
          seenGroupJids.add(jid);
          groupRows.push({
            title: `👥 ${(meta?.subject || "WhatsApp Group").slice(0, 40)}`,
            description: `Anggota: ${meta?.participants?.length || meta?.size || 0} Member`,
            id: `${prefix}fixbug --to=${jid}`
          });
        }
        if (groupRows.length === 0) {
          await ctx.react("❌");
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Bot tidak terdaftar di grup\n` + `└ ◦ *Info* : Masukkan bot ke dalam grup terlebih dahulu.\n\n` + `${footer}`);
        }
        const limitedRows = groupRows.slice(0, 20);
        const bodyText = `– *F I X  B U G*\n\n` + `┌ ◦ *Mode* : Anti Bug & Force Close\n` + `│ ◦ *Action* : Hapus msgStore & timbun pesan kosong\n` + `└ ◦ *Target* : Pilih grup tujuan pada menu di bawah\n\n` + `${footer}`;
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "PILIH TARGET GRUP",
            sections: [{
              title: `${botName} • Daftar Grup`,
              rows: limitedRows
            }]
          })
        }];
        const options = {
          image: bannerMedia,
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 1,
              divider_indices: [1],
              list_title: `${botName} • Target Grup`,
              button_title: "Pilih Grup Tujuan"
            }
          },
          contextInfo: {
            forwardingScore: 999,
            isForwarded: true,
            forwardedAiBotMessageInfo: {
              botJid: "0@bot"
            }
          },
          quoted: quotedMsg
        };
        if (typeof ctx.sendCta === "function") {
          await ctx.sendCta(bodyText, `${botName} • Fix FC`, buttons, options);
        } else {
          await ctx.reply(bodyText, {
            quoted: quotedMsg
          });
        }
        return await ctx.react("✅");
      }
      let isBotAdmin = false;
      let groupMeta = null;
      try {
        groupMeta = await sock.groupMetadata(targetJid);
      } catch {
        groupMeta = {
          subject: "Grup Target",
          participants: []
        };
      }
      if (ctx.id === targetJid) {
        isBotAdmin = Boolean(ctx.isBotAdmin);
      } else {
        const botNumber = (sock.user?.id || "").split(":")[0] + "@s.whatsapp.net";
        const botData = groupMeta?.participants?.find(p => p.id === botNumber || p.jid === botNumber);
        isBotAdmin = botData?.admin === "admin" || botData?.admin === "superadmin";
      }
      const store = global.msgStore || sock.msgStore || ctx.msgStore;
      const groupSavedMessages = [];
      if (store) {
        const allStoredMsgs = store instanceof Map ? Array.from(store.values()) : Object.values(store);
        for (const item of allStoredMsgs) {
          const chatJid = item.chat || item.from || item.id || item.key?.remoteJid;
          if (chatJid === targetJid && item.key) {
            groupSavedMessages.push(item.key);
          }
        }
      }
      if (!count || isNaN(count) || count <= 0) {
        const groupName = groupMeta?.subject || "WhatsApp Group";
        const memberCount = groupMeta?.participants ? groupMeta.participants.length : groupMeta?.size || 0;
        const totalStoreMsgs = groupSavedMessages.length;
        const bodyText = `– *F I X  B U G*\n\n` + `┌ ◦ *Group* : ${groupName}\n` + `│ ◦ *ID* : ${targetJid}\n` + `│ ◦ *Members* : ${memberCount} Anggota\n` + `│ ◦ *Bot Status* : ${isBotAdmin ? "Admin (Hapus & Timbun)" : "Member (Hanya Timbun)"}\n` + `│ ◦ *Stored Messages* : ${totalStoreMsgs} Pesan\n` + `└ ◦ *Action* : Pilih dosis pembersihan pada tombol di bawah\n\n` + `${footer}`;
        const counts = [5, 10, 15, 20, 30, 50];
        const doseRows = counts.map(num => ({
          title: `Dosis ${num} Pesan`,
          description: isBotAdmin ? `Hapus ${Math.min(num, totalStoreMsgs)} pesan store & kirim ${num} blank` : `Kirim ${num} pesan kosong penimbun`,
          id: `${prefix}fixbug --to=${targetJid} --count=${num}`
        }));
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "PILIH DOSIS PEMBERSIHAN",
            sections: [{
              title: `${botName} • Dosis Fix FC`,
              rows: doseRows
            }]
          })
        }];
        const options = {
          image: bannerMedia,
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 1,
              divider_indices: [1],
              list_title: `${botName} • Pilih Dosis`,
              button_title: "Pilih Dosis Pesan"
            }
          },
          contextInfo: {
            forwardingScore: 999,
            isForwarded: true,
            forwardedAiBotMessageInfo: {
              botJid: "0@bot"
            }
          },
          quoted: quotedMsg
        };
        if (typeof ctx.sendCta === "function") {
          await ctx.sendCta(bodyText, `${botName} • Fix FC`, buttons, options);
        } else {
          await ctx.reply(`${bodyText}\n\nKetik: \`${prefix}fixbug --to=${targetJid} --count=10\``, {
            quoted: quotedMsg
          });
        }
        return await ctx.react("✅");
      }
      await ctx.react("🚀");
      await ctx.reply(`– *P R O C E S S*\n\n` + `┌ ◦ *Target* : ${groupMeta?.subject || targetJid}\n` + `│ ◦ *Role* : ${isBotAdmin ? "Admin (Hapus Aktif)" : "Member (Timbun Saja)"}\n` + `└ ◦ *Dose* : ${count} Pesan\n\n` + `${footer}`);
      let deletedCount = 0;
      if (isBotAdmin && groupSavedMessages.length > 0) {
        const targetKeysToDelete = groupSavedMessages.slice(-count);
        for (const key of targetKeysToDelete) {
          try {
            await sock.sendMessage(targetJid, {
              delete: key
            });
            deletedCount++;
            await sleep(250);
          } catch (err) {
            console.error("[FIXBUG Delete Error]:", err.message);
          }
        }
      }
      let sentCount = 0;
      for (let i = 1; i <= count; i++) {
        try {
          await sock.sendMessage(targetJid, {
            text: INVISIBLE_PAYLOAD
          });
          sentCount++;
          await sleep(300);
        } catch (e) {
          console.error(`[FIXBUG Payload Error ke-${i}]:`, e.message);
        }
      }
      await ctx.react("✅");
      const resultReport = `– *F I X  B U G*\n\n` + `┌ ◦ *Target* : ${groupMeta?.subject || targetJid}\n` + `│ ◦ *Bot Role* : ${isBotAdmin ? "Admin Grup" : "Bukan Admin"}\n` + `│ ◦ *Deleted* : ${deletedCount} / ${count} Pesan\n` + `└ ◦ *Sent* : ${sentCount} / ${count} Pesan Penimbun\n\n` + `_Pesan bug telah dibersihkan. Ruang obrolan grup kini aman._\n\n` + `${footer}`;
      return ctx.reply(resultReport, {
        quoted: quotedMsg
      });
    } catch (error) {
      console.error("[FIXBUG Error]:", error);
      await ctx.react("❌");
      ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : ${error?.message || error}\n` + `└ ◦ *Command* : ${ctx.command || "fixbug"}\n\n` + `${footer}`);
    }
  }
};