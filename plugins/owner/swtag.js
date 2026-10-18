import {
  getMessagePayload
} from "../../core/serialize.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
import db from "../../data/db.js";

function serializePayloadForDb(payload) {
  if (!payload) return null;
  const clone = {
    ...payload
  };
  if (Buffer.isBuffer(clone.buffer)) {
    clone.buffer = {
      _isBuffer: true,
      data: clone.buffer.toString("base64")
    };
  }
  return clone;
}

function deserializePayloadFromDb(stored) {
  if (!stored) return null;
  const result = {
    ...stored
  };
  if (result.buffer && typeof result.buffer === "object" && result.buffer._isBuffer) {
    result.buffer = Buffer.from(result.buffer.data, "base64");
  }
  return result;
}

function getSafeUserDb(jid, name = "Owner") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  try {
    db?.ensureUser?.(jid);
  } catch (_) {}
  if (!global.db.user[jid]) {
    global.db.user[jid] = {
      id: jid,
      name: name,
      swmention: {}
    };
  }
  if (!global.db.user[jid].swmention || typeof global.db.user[jid].swmention !== "object") {
    global.db.user[jid].swmention = {};
  }
  return global.db.user[jid];
}
async function getFilteredGroupList(sock) {
  const dbGroups = global.db?.group || db?.group || {};
  const listMap = new Map();
  if (sock && typeof sock.groupFetchAllParticipating === "function") {
    try {
      const participating = await sock.groupFetchAllParticipating();
      if (participating && typeof participating === "object") {
        for (const [jid, meta] of Object.entries(participating)) {
          if (!jid.endsWith("@g.us")) continue;
          if (dbGroups[jid]?.bans === true) continue;
          const subject = meta?.subject || dbGroups[jid]?.subject || `Grup (${jid.split("@")[0].slice(-5)})`;
          const memberCount = meta?.participants?.length || meta?.size || 0;
          listMap.set(jid, {
            jid: jid,
            subject: subject,
            memberCount: memberCount
          });
        }
        return Array.from(listMap.values());
      }
    } catch (_) {}
  }
  if (global.groupCache) {
    for (const [jid, cacheObj] of global.groupCache.entries()) {
      if (!jid.endsWith("@g.us") || dbGroups[jid]?.bans === true) continue;
      const meta = cacheObj?.data || {};
      if (meta?.subject) {
        listMap.set(jid, {
          jid: jid,
          subject: meta.subject,
          memberCount: meta.participants?.length || meta.size || 0
        });
      }
    }
  }
  for (const [jid, data] of Object.entries(dbGroups)) {
    if (!jid.endsWith("@g.us") || data?.bans === true || listMap.has(jid)) continue;
    if (!data?.subject && !data?.name) continue;
    const subject = data?.subject || data?.name;
    const memberCount = data?.participants?.length || data?.memberCount || 0;
    listMap.set(jid, {
      jid: jid,
      subject: subject,
      memberCount: memberCount
    });
  }
  return Array.from(listMap.values());
}

function detectMediaType(typeStr = "", mimetype = "") {
  const clean = String(typeStr || "").toLowerCase().replace(/message$/i, "");
  const mime = String(mimetype || "").toLowerCase();
  if (clean.includes("image") || mime.startsWith("image/")) return "image";
  if (clean.includes("video") || clean === "ptv" || mime.startsWith("video/")) return "video";
  if (clean.includes("audio") || clean.includes("voice") || mime.startsWith("audio/")) return "audio";
  return null;
}
async function sendStatusToGroupWithMention(client, targetJid, mediaType, buffer, caption, memberJids = []) {
  const payloadData = {};
  if (mediaType === "image") {
    payloadData.image = buffer;
    if (caption) payloadData.caption = caption;
  } else if (mediaType === "video") {
    payloadData.video = buffer;
    if (caption) payloadData.caption = caption;
  } else if (mediaType === "audio") {
    payloadData.audio = buffer;
    payloadData.ptt = false;
  } else {
    payloadData.text = caption || "";
  }
  const mentionTargets = [...new Set([targetJid, ...memberJids])];
  if (typeof client.sendStatusMentions === "function") {
    try {
      return await client.sendStatusMentions(payloadData, mentionTargets);
    } catch (err) {
      console.warn("[SWMENTION] Tier 1 (sendStatusMentions) gagal, mencoba Tier 2...", err?.message);
    }
  }
  if (typeof client.sendGroupStatusMessage === "function") {
    try {
      return await client.sendGroupStatusMessage(targetJid, {
        ...payloadData,
        contextInfo: {
          mentionedJid: memberJids
        }
      }, {
        statusJidList: memberJids
      });
    } catch (err) {
      console.warn("[SWMENTION] Tier 2 (sendGroupStatusMessage) gagal, mencoba Tier 3...", err?.message);
    }
  }
  try {
    return await client.sendMessage(targetJid, {
      groupStatus: payloadData,
      contextInfo: {
        mentionedJid: memberJids
      }
    }, {
      statusJidList: memberJids
    });
  } catch (err) {
    console.warn("[SWMENTION] Tier 3 (groupStatus) gagal, mencoba Tier 4...", err?.message);
  }
  const baseContext = {
    isGroupStatus: true,
    statusAttributions: [{
      type: 10
    }],
    statusAudienceMetadata: {
      audienceType: "CLOSE_FRIENDS"
    },
    mentionedJid: memberJids
  };
  const messageOptions = {
    statusJidList: memberJids
  };
  if (mediaType === "image") {
    return await client.sendMessage(targetJid, {
      image: buffer,
      caption: caption || "",
      contextInfo: {
        ...baseContext,
        statusSourceType: "IMAGE"
      }
    }, messageOptions);
  } else if (mediaType === "video") {
    return await client.sendMessage(targetJid, {
      video: buffer,
      caption: caption || "",
      contextInfo: {
        ...baseContext,
        statusSourceType: "VIDEO"
      }
    }, messageOptions);
  } else if (mediaType === "audio") {
    return await client.sendMessage(targetJid, {
      audio: buffer,
      mimetype: "audio/mp4",
      contextInfo: {
        ...baseContext,
        statusSourceType: "AUDIO"
      }
    }, messageOptions);
  } else {
    return await client.sendMessage(targetJid, {
      text: caption || "",
      contextInfo: {
        ...baseContext,
        statusSourceType: "TEXT"
      }
    }, messageOptions);
  }
}
async function extractPayload(ctx, cleanQuery = "") {
  let target = ctx;
  const targetMsgInit = ctx.message || ctx.msg || ctx;
  const metaInit = getMessagePayload(targetMsgInit) || {};
  const isMedia = /image|video|audio|ptv|voice|viewonce/i.test(metaInit?.mtype || "") || ctx.isMedia;
  if (!isMedia && ctx.quoted) {
    target = ctx.quoted;
  }
  const targetMsg = target?.message || target?.msg || target || {};
  const targetMeta = getMessagePayload(targetMsg) || {};
  const rawType = String(targetMeta?.mtype || "").replace(/Message$/i, "");
  const mimetype = target?.mimetype || targetMeta?.msg?.mimetype || "";
  const mediaType = detectMediaType(rawType, mimetype);
  const isTargetMedia = Boolean(mediaType) || target?.isMedia;
  if (isTargetMedia && typeof target.download === "function") {
    const buffer = await target.download().catch(() => null);
    if (Buffer.isBuffer(buffer)) {
      const caption = cleanQuery || (target !== ctx ? target.text || targetMeta?.msg?.caption || "" : "");
      return {
        mediaType: mediaType,
        buffer: buffer,
        caption: caption
      };
    }
  }
  const text = cleanQuery || (target !== ctx ? target.text || targetMeta?.msg?.conversation || targetMeta?.msg?.text || "" : "");
  return text ? {
    mediaType: "text",
    buffer: null,
    caption: text
  } : null;
}
export default {
  name: "swmention",
  aliases: ["swtag", "statustag", "statusmention"],
  description: "Upload status grup WhatsApp dengan tag mention seluruh member",
  category: "Owner",
  owner: true,
  example: ".swmention Halo semua! (atau reply media / teks dengan .swmention)",
  execute: async (sock, ctx, msg) => {
    try {
      if (!ctx.isOwner) {
        return ctx.reply("❌ Fitur ini khusus hanya dapat digunakan oleh *Owner Bot*.");
      }
      const fullInput = ctx.query || ctx.args?.join(" ") || ctx.text || ctx.body || "";
      const matchId = fullInput.match(/--id=([a-zA-Z0-9_-]+)/i);
      const matchTo = fullInput.match(/--to=([0-9\-_]+@g\.us)/i);
      const contentId = matchId ? matchId[1] : null;
      const targetJid = matchTo ? matchTo[1] : null;
      const rawSender = ctx.sender || ctx.from || ctx.id || "";
      const senderJid = rawSender.includes("@") ? rawSender.split(":")[0].replace(/[^0-9]/g, "") + "@s.whatsapp.net" : rawSender;
      const userDb = getSafeUserDb(senderJid, ctx.name);
      if (targetJid && contentId) {
        ctx.react?.("⏳");
        const draft = userDb.swmention?.[contentId];
        if (!draft) {
          ctx.react?.("❌");
          return ctx.reply("❌ Draft konten status tidak ditemukan atau telah kedaluwarsa. Silakan reply/kirim ulang media dengan `.swmention`.");
        }
        const payload = deserializePayloadFromDb(draft.payload);
        if (!payload) {
          delete userDb.swmention[contentId];
          db?.write?.(global.db);
          ctx.react?.("❌");
          return ctx.reply("❌ Gagal memuat data payload media. Silakan buat ulang.");
        }
        let jids = [];
        try {
          const cached = global.groupCache?.get(targetJid)?.data;
          if (cached?.participants?.length) {
            jids = cached.participants.map(p => p.jid || p.phoneNumber || p.id).filter(Boolean);
          } else if (typeof sock.groupMetadata === "function") {
            const meta = await sock.groupMetadata(targetJid).catch(() => null);
            if (meta?.participants?.length) {
              jids = meta.participants.map(p => p.jid || p.phoneNumber || p.id).filter(Boolean);
            }
          }
        } catch (_) {}
        if (jids.length === 0) {
          jids = [targetJid];
        } else {
          jids = [...new Set(jids.map(j => j.split(":")[0].replace(/\D/g, "") + "@s.whatsapp.net"))];
        }
        const sentResult = await sendStatusToGroupWithMention(sock, targetJid, payload.mediaType, payload.buffer, payload.caption, jids);
        delete userDb.swmention[contentId];
        db?.write?.(global.db);
        ctx.react?.("✅");
        const successText = `–  *S W  M E N T I O N*\n\n` + `┌  ◦  *Status* : Berhasil Terunggah ✅\n` + `│  ◦  *Target Grup* : \`${targetJid}\`\n` + `│  ◦  *Total Target Tag* : ${jids.includes(targetJid) && jids.length === 1 ? "Seluruh Grup" : `${jids.length} Member`}\n` + `│  ◦  *Tipe Konten* : ${payload.mediaType?.toUpperCase() || "TEXT"}\n` + `└  ◦  *ID Konten* : \`${contentId}\`\n\n` + `Status grup telah berhasil diunggah dengan mention notifikasi.`;
        return await sock.sendMessage(ctx.id, {
          text: successText
        }, {
          quoted: sentResult?.key ? sentResult : msg
        });
      }
      const cleanText = fullInput.replace(/--(id|to)=\S+/gi, "").trim();
      const now = Date.now();
      for (const [id, item] of Object.entries(userDb.swmention || {})) {
        if (!item?.time || now - item.time > 3e5) {
          delete userDb.swmention[id];
        }
      }
      ctx.react?.("⏳");
      const payload = await extractPayload(ctx, cleanText);
      if (!payload) {
        ctx.react?.("❓");
        const prefix = ctx.prefix || ".";
        return ctx.reply(`–  *S W  M E N T I O N*\n\n` + `Silakan masukkan teks atau reply berkas media yang ingin dijadikan status tag mention.\n\n` + `┌  ◦  *Teks* : \`${prefix}swmention Pesan status kamu\`\n` + `│  ◦  *Reply Teks* : Balas pesan dengan \`${prefix}swmention\`\n` + `└  ◦  *Reply Media* : Balas Foto / Video / Audio / Voice Note\n\n` + `Setelah itu, tentukan grup tujuan pada menu tombol.`);
      }
      const generatedId = "swm_" + Math.random().toString(36).substring(2, 7);
      userDb.swmention[generatedId] = {
        payload: serializePayloadForDb(payload),
        time: Date.now()
      };
      db?.write?.(global.db);
      const groups = await getFilteredGroupList(sock);
      if (!groups || groups.length === 0) {
        delete userDb.swmention[generatedId];
        ctx.react?.("❌");
        return ctx.reply("❌ Tidak ada grup aktif yang tersedia.");
      }
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "Paimon-bot";
      const botFooter = global.bot?.footer || `${botName} • Mention Story Dispatcher`;
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const seenGroupJids = new Set();
      const groupRows = [];
      if (ctx.isGroup || ctx.id?.endsWith("@g.us")) {
        seenGroupJids.add(ctx.id);
        const currentGroupData = groups.find(g => g.jid === ctx.id);
        const currentName = currentGroupData?.subject || "Grup Saat Ini";
        const currentMembers = currentGroupData?.memberCount ? `${currentGroupData.memberCount} Member` : "Aktif";
        groupRows.push({
          title: `📍 ${currentName.slice(0, 32)}`,
          description: `Grup Ini • ${currentMembers}`,
          id: `${prefix}swmention --id=${generatedId} --to=${ctx.id}`
        });
      }
      for (const grp of groups) {
        if (seenGroupJids.has(grp.jid)) continue;
        seenGroupJids.add(grp.jid);
        const memberInfo = grp.memberCount ? `${grp.memberCount} Member` : "Terdaftar";
        groupRows.push({
          title: `👥 ${grp.subject.slice(0, 32)}`,
          description: `${memberInfo} • ID: ${grp.jid.split("@")[0].slice(-8)}`,
          id: `${prefix}swmention --id=${generatedId} --to=${grp.jid}`
        });
      }
      const limitedRows = groupRows.slice(0, 25);
      const bodyText = `–  *S W  M E N T I O N*\n\n` + `Konten status mention Anda telah tersimpan sementara di server.\n\n` + `┌  ◦  *ID Konten* : \`${generatedId}\`\n` + `│  ◦  *Pengirim* : @${senderJid.split("@")[0]}\n` + `│  ◦  *Tipe Media* : ${payload.mediaType?.toUpperCase() || "TEXT"}\n` + `│  ◦  *Total Grup Aktif* : ${groupRows.length} Grup\n` + `└  ◦  *Masa Aktif* : 5 Menit\n\n` + `Silakan klik tombol di bawah untuk memilih grup yang anggotanya ingin Anda tag di status:`;
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: `🎯 PILIH TARGET TAG (${limitedRows.length})`,
          sections: [{
            title: `${botName} • DAFTAR TARGET MEMBER GRUP`,
            rows: limitedRows
          }]
        })
      }];
      const options = {
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `${botName} • Pilih Target Mention`,
            button_title: "Pilih Grup Target Tag"
          }
        },
        contextInfo: {
          mentionedJid: [senderJid],
          forwardingScore: 999,
          isForwarded: true
        },
        quoted: quotedMsg
      };
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, botFooter, buttons, options);
      } else {
        await ctx.reply(bodyText, {
          mentions: [senderJid],
          quoted: quotedMsg
        });
      }
      ctx.react?.("✅");
    } catch (e) {
      console.error("[SWMENTION ERROR]", e);
      ctx.react?.("❌");
      ctx.reply(`❌ Gagal mengunggah status mention: ${e.message || e}`);
    }
  }
};