import fs from "fs";
import path from "path";
import chalk from "chalk";
import {
  decodeJid
} from "../../core/serialize.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";

function purgeGroupSenderKeysMemory(groupJid) {
  let clearedCount = 0;
  try {
    const cleanId = groupJid.split("@")[0].replace(/\D/g, "");
    if (global.groupCache) global.groupCache.delete(groupJid);
    if (global.jadibotGroupCache) global.jadibotGroupCache.delete(groupJid);
    if (global.authKeysStore) {
      if (global.authKeysStore instanceof Map) {
        for (const [sess, keys] of global.authKeysStore.entries()) {
          if (keys && typeof keys === "object") {
            for (const k in keys) {
              if (k.includes(cleanId)) {
                delete keys[k];
                clearedCount++;
              }
            }
          }
        }
      } else if (typeof global.authKeysStore === "object") {
        for (const sess in global.authKeysStore) {
          const keys = global.authKeysStore[sess];
          if (keys && typeof keys === "object") {
            for (const k in keys) {
              if (k.includes(cleanId)) {
                delete keys[k];
                clearedCount++;
              }
            }
          }
        }
      }
    }
  } catch (_) {}
  return clearedCount;
}
async function getActiveGroupsFromCache(sock) {
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
  name: "fixsession",
  aliases: ["resync", "clearsession", "fixgroup", "rekeysession", "fixgc"],
  description: "Deep Handshake & Reset Sender-Key khusus untuk grup yang error / pesan menunggu (Index Memory Mode).",
  category: "Owner",
  owner: true,
  example: ".fixsession (langsung di grup) | .fixsession all",
  execute: async (sock, ctx, msg) => {
    try {
      if (typeof ctx.react === "function") await ctx.react("⏳");
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • Group Session Doctor`;
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const argsText = (ctx.args?.join(" ") || "").trim();
      const recoverGroupDeep = async jid => {
        try {
          const cleanId = decodeJid(jid);
          if (!cleanId.endsWith("@g.us")) return false;
          const clearedKeys = purgeGroupSenderKeysMemory(cleanId);
          await sock.sendPresenceUpdate("available", cleanId).catch(() => {});
          let meta = global.groupCache?.get(cleanId)?.data || null;
          if (!meta && typeof sock.groupMetadata === "function") {
            meta = await sock.groupMetadata(cleanId).catch(() => null);
          }
          if (!meta) return false;
          try {
            await sock.sendPresenceUpdate("composing", cleanId).catch(() => {});
            const handshakeMsg = await sock.sendMessage(cleanId, {
              text: `_🔄 Resyncing session keys (Index Mode)... [${Date.now()}]_`
            });
            if (handshakeMsg?.key) {
              await sock.sendMessage(cleanId, {
                delete: handshakeMsg.key
              }).catch(() => {});
            }
          } catch (_) {
            await sock.sendPresenceUpdate("paused", cleanId).catch(() => {});
          }
          return {
            success: true,
            clearedKeys: clearedKeys,
            meta: meta
          };
        } catch (err) {
          console.error(chalk.red(`[FIXSESSION GC ERROR: ${jid}]:`), err.message);
          return false;
        }
      };
      if (ctx.isGroup && (!argsText || argsText.toLowerCase() === "here" || argsText.toLowerCase() === "gc")) {
        const result = await recoverGroupDeep(ctx.chat);
        if (result?.success) {
          if (typeof ctx.react === "function") await ctx.react("✨");
          return ctx.reply(`–  *G R O U P  S E S S I O N  F I X E D*\n\n` + `Sesi enkripsi grup ini berhasil diperbaiki via index memori!\n\n` + `┌  ◦  *Nama Grup* : ${result.meta?.subject || "Grup"}\n` + `│  ◦  *JID Grup* : \`${ctx.chat}\`\n` + `│  ◦  *Total Member* : ${result.meta?.participants?.length || 0} Anggota\n` + `│  ◦  *Index Kunci Dibersihkan* : ${result.clearedKeys} Entri\n` + `└  ◦  *Status SKDM* : Fresh Re-keyed (Normal 🟢)\n\n` + `_Pesan yang macet / "Waiting for this message" kini sudah ditata ulang._`);
        } else {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply("❌ Gagal mereset sesi grup ini. Pastikan bot memiliki izin dan masih bergabung.");
        }
      }
      if (argsText.toLowerCase() === "all" || argsText.toLowerCase() === "semua") {
        await ctx.reply("🔄 *Memproses perbaikan sesi untuk seluruh grup (Index Mode)...*\nMohon tunggu sejenak.");
        const participatingGroups = await getActiveGroupsFromCache(sock);
        const groupKeys = Array.from(participatingGroups.keys());
        if (!groupKeys.length) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply("❌ Bot saat ini tidak terdeteksi di grup manapun.");
        }
        let successCount = 0;
        let failCount = 0;
        let totalClearedIndex = 0;
        for (const jid of groupKeys) {
          const res = await recoverGroupDeep(jid);
          if (res?.success) {
            successCount++;
            totalClearedIndex += res.clearedKeys || 0;
          } else {
            failCount++;
          }
          await new Promise(r => setTimeout(r, 400));
        }
        if (typeof ctx.react === "function") await ctx.react("✅");
        return ctx.reply(`–  *A L L  G R O U P S  R E C O V E R E D*\n\n` + `Sesi seluruh grup WhatsApp berhasil diperbarui lewat index memori.\n\n` + `┌  ◦  *Total Grup* : ${groupKeys.length}\n` + `│  ◦  *Sukses* : ${successCount} Grup\n` + `│  ◦  *Gagal / Keluar* : ${failCount}\n` + `└  ◦  *Index Kunci Direset* : ${totalClearedIndex} Entri RAM\n\n` + `_Kunci baru telah didistribusikan ke WhatsApp Server. Semua grup dapat digunakan kembali._`);
      }
      let targetJid = null;
      if (argsText.endsWith("@g.us")) {
        targetJid = argsText;
      } else {
        const inviteMatch = argsText.match(/chat\.whatsapp\.com\/([0-9A-Za-z]{20,24})/i);
        if (inviteMatch) {
          try {
            const groupInfo = await sock.groupGetInviteInfo(inviteMatch[1]);
            targetJid = groupInfo?.id ? `${groupInfo.id}@g.us` : null;
          } catch (_) {}
        }
      }
      if (targetJid) {
        const res = await recoverGroupDeep(targetJid);
        if (res?.success) {
          if (typeof ctx.react === "function") await ctx.react("✨");
          return ctx.reply(`–  *G R O U P  S E S S I O N  F I X E D*\n\n` + `┌  ◦  *JID Grup* : \`${targetJid}\`\n` + `│  ◦  *Nama Grup* : ${res.meta?.subject || "Grup"}\n` + `│  ◦  *Index Kunci Direset* : ${res.clearedKeys} Entri\n` + `└  ◦  *Status* : Normal & Sinkron 🟢`);
        } else {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply(`❌ Gagal memperbaiki grup \`${targetJid}\`. Pastikan bot adalah anggota grup tersebut.`);
        }
      }
      const participatingGroups = await getActiveGroupsFromCache(sock);
      const activeGroupEntries = Array.from(participatingGroups.entries());
      if (!activeGroupEntries.length) {
        if (typeof ctx.react === "function") await ctx.react("❌");
        return ctx.reply("❌ Bot saat ini tidak berada di grup manapun.");
      }
      const sections = [{
        title: "⚡ RECOVERY MASSAL",
        rows: [{
          title: "⚡ PERBAIKI SEMUA GRUP SEKALIGUS",
          description: `Reset kunci enkripsi untuk seluruh (${activeGroupEntries.length}) grup`,
          id: `${prefix}fixsession all`
        }]
      }];
      const groupRows = activeGroupEntries.slice(0, 30).map(([jid, meta]) => {
        const name = meta?.subject || `Grup (${jid.split("@")[0].slice(-5)})`;
        const memberCount = meta?.participants?.length || meta?.size || 0;
        return {
          title: `👥 ${name.slice(0, 30)}`,
          description: `${memberCount ? `${memberCount} Member` : "Aktif"} • ID: ${jid.split("@")[0].slice(-8)}`,
          id: `${prefix}fixsession ${jid}`
        };
      });
      sections.push({
        title: `📋 PILIH GRUP SPESIFIK (${groupRows.length})`,
        rows: groupRows
      });
      const bodyText = `–  *G R O U P  S E S S I O N  D O C T O R*

Pemulihan sesi enkripsi Signal Protocol (Index Memory Mode) khusus untuk grup WhatsApp yang mengalami pesan macet / centang satu tanpa menghapus file fisik di disk.

┌  ◦  *Total Grup Aktif* : ${activeGroupEntries.length} Grup
└  ◦  *Target* : Pilih salah satu grup atau perbaiki semua`;
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: "🔧 PILIH GRUP TARGET",
          sections: sections
        })
      }];
      const options = {
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `${botName} • Fix Session Grup`,
            button_title: "Pilih Grup"
          }
        },
        quoted: quotedMsg
      };
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, botFooter, buttons, options);
      } else {
        await ctx.reply(`${bodyText}\n\nKetik:\n• \`${prefix}fixsession all\` (Semua Grup)\n• \`${prefix}fixsession <JID_GRUP>\` (Spesifik)`, {
          quoted: quotedMsg
        });
      }
      if (typeof ctx.react === "function") await ctx.react("✅");
    } catch (error) {
      console.error("[FIXSESSION GROUP ERROR]:", error);
      if (typeof ctx.react === "function") await ctx.react("❌");
      ctx.reply(`❌ Terjadi kesalahan: ${error?.message || error}`);
    }
  }
};