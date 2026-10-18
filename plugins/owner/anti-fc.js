import {
  simpleQuoted
} from "../../lib/quoted.js";
const INVISIBLE_PAYLOAD = "‎".repeat(10) + "​" + "⠀".repeat(5);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function getParticipatingGroups(sock) {
  const groupsMap = new Map();
  if (sock && typeof sock.groupFetchAllParticipating === "function") {
    try {
      const participating = await sock.groupFetchAllParticipating();
      if (participating && typeof participating === "object") {
        for (const [jid, meta] of Object.entries(participating)) {
          if (jid.endsWith("@g.us")) {
            groupsMap.set(jid, meta);
          }
        }
        return groupsMap;
      }
    } catch (_) {}
  }
  if (global.groupCache) {
    for (const [jid, cacheObj] of global.groupCache.entries()) {
      if (jid.endsWith("@g.us") && cacheObj?.data?.subject) {
        groupsMap.set(jid, cacheObj.data);
      }
    }
  }
  const dbGroups = global.db?.group || {};
  for (const [jid, data] of Object.entries(dbGroups)) {
    if (jid.endsWith("@g.us") && !groupsMap.has(jid) && data?.bans !== true) {
      if (data?.subject || data?.name) {
        groupsMap.set(jid, {
          subject: data?.subject || data?.name,
          participants: data?.participants || []
        });
      }
    }
  }
  return groupsMap;
}
export default {
  name: "fixbug",
  aliases: ["antibug", "fixfc", "clearchatbug", "fixcrash"],
  description: "Mengatasi lag/pesan tertimbun di grup WhatsApp dengan penimbunan pesan dan pembersihan store",
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
        if (typeof ctx.react === "function") await ctx.react("⏳");
        const participatingGroups = await getParticipatingGroups(sock);
        const seenGroupJids = new Set();
        const groupRows = [];
        const isCurrentGroup = ctx.isGroup || ctx.id?.endsWith("@g.us");
        if (isCurrentGroup && ctx.id) {
          seenGroupJids.add(ctx.id);
          const currentMeta = participatingGroups.get(ctx.id) || global.groupCache?.get(ctx.id)?.data;
          const currentName = currentMeta?.subject || "Grup Saat Ini";
          groupRows.push({
            title: `📍 ${currentName.slice(0, 40)}`,
            description: "Bersihkan obrolan di grup ini",
            id: `${prefix}fixbug --to=${ctx.id}`
          });
        }
        for (const [jid, meta] of participatingGroups.entries()) {
          if (seenGroupJids.has(jid)) continue;
          seenGroupJids.add(jid);
          const name = meta?.subject || "WhatsApp Group";
          const memberCount = meta?.participants?.length || meta?.size || 0;
          groupRows.push({
            title: `👥 ${name.slice(0, 40)}`,
            description: `Anggota: ${memberCount ? `${memberCount} Member` : "Terdaftar"}`,
            id: `${prefix}fixbug --to=${jid}`
          });
        }
        if (groupRows.length === 0) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply(`– *E R R O R*\n\n┌ ◦ *Status* : Bot tidak terdaftar di grup aktif manapun\n└ ◦ *Info* : Pastikan bot telah bergabung ke grup.\n\n${footer}`);
        }
        const limitedRows = groupRows.slice(0, 25);
        const bodyText = `– *F I X  B U G*\n\n┌ ◦ *Mode* : Anti Lag & Clearchat\n│ ◦ *Action* : Timbun obrolan & hapus store\n└ ◦ *Target* : Pilih salah satu dari ${groupRows.length} grup di bawah\n\n${footer}`;
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: `PILIH TARGET GRUP (${limitedRows.length})`,
            sections: [{
              title: `${botName} • Daftar Grup Aktif`,
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
            isForwarded: true
          },
          quoted: quotedMsg
        };
        if (typeof ctx.sendCta === "function") {
          await ctx.sendCta(bodyText, `${botName} • Fix Chat`, buttons, options);
        } else {
          await ctx.reply(bodyText, {
            quoted: quotedMsg
          });
        }
        return typeof ctx.react === "function" ? await ctx.react("✅") : null;
      }
      let isBotAdmin = false;
      let groupMeta = global.groupCache?.get(targetJid)?.data || null;
      if (!groupMeta && typeof sock.groupMetadata === "function") {
        groupMeta = await sock.groupMetadata(targetJid).catch(() => ({
          subject: "Grup Target",
          participants: []
        }));
      }
      if (ctx.id === targetJid) {
        isBotAdmin = Boolean(ctx.isBotAdmin);
      } else {
        const botNumber = (sock.user?.id || sock.user?.jid || "").split(":")[0].replace(/\D/g, "") + "@s.whatsapp.net";
        const botData = groupMeta?.participants?.find(p => (p.id || p.jid || "").includes(botNumber.split("@")[0]));
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
        const bodyText = `– *F I X  B U G*\n\n┌ ◦ *Group* : ${groupName}\n│ ◦ *ID* : ${targetJid}\n│ ◦ *Members* : ${memberCount} Anggota\n│ ◦ *Bot Status* : ${isBotAdmin ? "Admin (Hapus & Timbun)" : "Member (Hanya Timbun)"}\n│ ◦ *Stored Messages* : ${totalStoreMsgs} Pesan\n└ ◦ *Action* : Pilih dosis pembersihan pada tombol di bawah\n\n${footer}`;
        const counts = [5, 10, 15, 20, 30];
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
            isForwarded: true
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
        return typeof ctx.react === "function" ? await ctx.react("✅") : null;
      }
      if (typeof ctx.react === "function") await ctx.react("🚀");
      await ctx.reply(`– *P R O C E S S*\n\n┌ ◦ *Target* : ${groupMeta?.subject || targetJid}\n│ ◦ *Role* : ${isBotAdmin ? "Admin (Hapus Aktif)" : "Member (Timbun Saja)"}\n└ ◦ *Dose* : ${count} Pesan\n\n${footer}`);
      let deletedCount = 0;
      if (isBotAdmin && groupSavedMessages.length > 0) {
        const targetKeysToDelete = groupSavedMessages.slice(-count);
        for (const key of targetKeysToDelete) {
          try {
            await sock.sendMessage(targetJid, {
              delete: key
            });
            deletedCount++;
            await sleep(350);
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
          await sleep(400);
        } catch (e) {
          console.error(`[FIXBUG Payload Error ke-${i}]:`, e.message);
        }
      }
      if (typeof ctx.react === "function") await ctx.react("✅");
      const resultReport = `– *F I X  B U G*\n\n┌ ◦ *Target* : ${groupMeta?.subject || targetJid}\n│ ◦ *Bot Role* : ${isBotAdmin ? "Admin Grup" : "Bukan Admin"}\n│ ◦ *Deleted* : ${deletedCount} / ${count} Pesan\n└ ◦ *Sent* : ${sentCount} / ${count} Pesan Penimbun\n\n_Pesan obrolan telah dibersihkan & ditimbun. Obrolan grup kembali lancar._\n\n${footer}`;
      return ctx.reply(resultReport, {
        quoted: quotedMsg
      });
    } catch (error) {
      console.error("[FIXBUG Error]:", error);
      if (typeof ctx.react === "function") await ctx.react("❌");
      ctx.reply(`– *E R R O R*\n\n┌ ◦ *Info* : ${error?.message || error}\n└ ◦ *Command* : ${ctx.command || "fixbug"}\n\n${footer}`);
    }
  }
};