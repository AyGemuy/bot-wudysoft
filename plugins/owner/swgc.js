import axios from "axios";
import {
  getMessagePayload
} from "../../core/serialize.js";
import {
  simpleQuoted,
  metaQuoted
} from "../../lib/quoted.js";
import db from "../../data/db.js";
const sleep = ms => new Promise(r => setTimeout(r, ms));

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
      swgc: {}
    };
  }
  if (!global.db.user[jid].swgc || typeof global.db.user[jid].swgc !== "object" || global.db.user[jid].swgc.payload) {
    global.db.user[jid].swgc = {};
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
          listMap.set(jid, {
            jid: jid,
            subject: subject
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
          subject: meta.subject
        });
      }
    }
  }
  for (const [jid, data] of Object.entries(dbGroups)) {
    if (!jid.endsWith("@g.us") || data?.bans === true || listMap.has(jid)) continue;
    if (!data?.subject && !data?.name) continue;
    const subject = data?.subject || data?.name;
    listMap.set(jid, {
      jid: jid,
      subject: subject
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
async function sendStatusToGroup(client, jid, mediaType, buffer, caption) {
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
  if (typeof client.sendGroupStatusMessage === "function") {
    try {
      return await client.sendGroupStatusMessage(jid, payloadData);
    } catch (e) {
      console.warn("[SWGC] sendGroupStatusMessage gagal, mencoba Tier 2...", e?.message);
    }
  }
  try {
    return await client.sendMessage(jid, {
      groupStatus: payloadData
    });
  } catch (e) {
    console.warn("[SWGC] groupStatus wrapper gagal, mencoba Tier 3...", e?.message);
  }
  const baseContext = {
    isGroupStatus: true,
    statusAttributions: [{
      type: 10
    }],
    statusAudienceMetadata: {
      audienceType: "CLOSE_FRIENDS"
    }
  };
  if (mediaType === "image") {
    return await client.sendMessage(jid, {
      image: buffer,
      caption: caption || "",
      contextInfo: {
        ...baseContext,
        statusSourceType: "IMAGE"
      }
    });
  } else if (mediaType === "video") {
    return await client.sendMessage(jid, {
      video: buffer,
      caption: caption || "",
      contextInfo: {
        ...baseContext,
        statusSourceType: "VIDEO"
      }
    });
  } else if (mediaType === "audio") {
    return await client.sendMessage(jid, {
      audio: buffer,
      mimetype: "audio/mp4",
      contextInfo: {
        ...baseContext,
        statusSourceType: "AUDIO"
      }
    });
  } else {
    return await client.sendMessage(jid, {
      text: caption || "",
      contextInfo: {
        ...baseContext,
        statusSourceType: "TEXT"
      }
    });
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
  name: "swgc",
  aliases: ["statusgc", "swgroup", "upstatusgc", "storygc"],
  description: "Upload status grup WhatsApp (Support: .swgc all / ini / select)",
  category: "Owner",
  owner: true,
  example: ".swgc all Halo | .swgc ini Halo | .swgc",
  execute: async (sock, ctx, msg) => {
    try {
      if (!ctx.isOwner) return ctx.reply("❌ Fitur ini khusus hanya dapat digunakan oleh *Owner Bot*.");
      const args = ctx.args || [];
      const subCommand = (args[0] || "").toLowerCase();
      const fullInput = ctx.query || args.join(" ") || ctx.text || ctx.body || "";
      const matchId = fullInput.match(/--id=([a-zA-Z0-9_-]+)/i);
      const matchTo = fullInput.match(/--to=([0-9\-_]+@g\.us)/i);
      const matchCancel = fullInput.match(/--cancel=([a-zA-Z0-9_-]+)/i);
      const contentId = matchId ? matchId[1] : null;
      const targetJid = matchTo ? matchTo[1] : null;
      const cancelId = matchCancel ? matchCancel[1] : null;
      const rawSender = ctx.sender || ctx.from || ctx.id || "";
      const senderJid = rawSender.includes("@") ? rawSender.split(":")[0].replace(/[^0-9]/g, "") + "@s.whatsapp.net" : rawSender;
      const userNumber = senderJid.split("@")[0].replace(/\D/g, "");
      const userDb = getSafeUserDb(senderJid, ctx.name);
      const prefix = typeof ctx.prefix === "string" ? ctx.prefix : ".";
      const botName = global.bot?.name || "Wudysoft";
      const botFooter = global.bot?.footer || `${botName} • Group Story Dispatcher`;
      const quotedMsg = typeof metaQuoted === "function" ? metaQuoted(ctx) : typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (cancelId) {
        if (userDb.swgc?.[cancelId]) {
          delete userDb.swgc[cancelId];
          db?.write?.(global.db);
          ctx.react?.("🗑️");
          return ctx.reply(`✅ Draft status grup dengan ID \`${cancelId}\` berhasil dibatalkan.`);
        }
        return ctx.reply("❌ Draft tidak ditemukan atau sudah kedaluwarsa.");
      }
      if (subCommand === "all" || subCommand === "semua") {
        const queryWithoutSub = args.slice(1).join(" ").trim();
        const payload = await extractPayload(ctx, queryWithoutSub);
        if (!payload) return ctx.reply("❌ Masukkan teks atau balas media yang ingin disiarkan ke semua grup.");
        const groups = await getFilteredGroupList(sock);
        if (!groups.length) return ctx.reply("❌ Tidak ada grup aktif yang terdeteksi.");
        ctx.react?.("⏳");
        await ctx.reply(`🔄 *Memproses pengiriman status ke ${groups.length} grup...*`);
        let successCount = 0;
        let failCount = 0;
        for (const g of groups) {
          try {
            await sendStatusToGroup(sock, g.jid, payload.mediaType, payload.buffer, payload.caption);
            successCount++;
            await sleep(400);
          } catch (_) {
            failCount++;
          }
        }
        ctx.react?.("✅");
        return ctx.reply(`–  *S W  A L L  G R O U P S*\n\n` + `┌  ◦  *Total Grup* : ${groups.length}\n` + `│  ◦  *Sukses* : ${successCount}\n` + `└  ◦  *Gagal* : ${failCount}\n\n` + `_Status grup berhasil disiarkan ke seluruh grup aktif._`);
      }
      if (["ini", "here", "gc", "current"].includes(subCommand)) {
        if (!ctx.isGroup && !ctx.id?.endsWith("@g.us")) {
          return ctx.reply("❌ Perintah ini khusus untuk dijalankan di dalam grup.");
        }
        const queryWithoutSub = args.slice(1).join(" ").trim();
        const payload = await extractPayload(ctx, queryWithoutSub);
        if (!payload) return ctx.reply("❌ Masukkan teks atau balas media yang ingin dikirim.");
        ctx.react?.("⏳");
        try {
          await sendStatusToGroup(sock, ctx.id, payload.mediaType, payload.buffer, payload.caption);
          ctx.react?.("✅");
          return ctx.reply("✅ Status grup berhasil diunggah ke grup ini.");
        } catch (e) {
          ctx.react?.("❌");
          return ctx.reply(`❌ Gagal mengirim status: ${e?.message || e}`);
        }
      }
      if (targetJid && contentId) {
        ctx.react?.("⏳");
        const draft = userDb.swgc?.[contentId];
        if (!draft) {
          ctx.react?.("❌");
          return ctx.reply("❌ Draft konten status tidak ditemukan atau kedaluwarsa. Silakan reply/kirim ulang media dengan `.swgc`.");
        }
        const payload = deserializePayloadFromDb(draft.payload);
        if (!payload) {
          delete userDb.swgc[contentId];
          db?.write?.(global.db);
          ctx.react?.("❌");
          return ctx.reply("❌ Gagal memuat data payload media. Silakan buat ulang.");
        }
        const sentResult = await sendStatusToGroup(sock, targetJid, payload.mediaType, payload.buffer, payload.caption);
        delete userDb.swgc[contentId];
        db?.write?.(global.db);
        ctx.react?.("✅");
        const successText = `–  *S W  G R O U P*\n\n` + `┌  ◦  *Status* : Berhasil Terunggah ✅\n` + `│  ◦  *Target Grup* : \`${targetJid}\`\n` + `│  ◦  *Tipe Konten* : ${payload.mediaType?.toUpperCase() || "TEXT"}\n` + `└  ◦  *ID Konten* : \`${contentId}\`\n\n` + `Status grup telah berhasil diunggah sesuai spesifikasi WhatsApp Story.`;
        return await sock.sendMessage(ctx.id, {
          text: successText
        }, {
          quoted: sentResult?.key ? sentResult : msg
        });
      }
      const cleanText = fullInput.replace(/--(id|to|cancel)=\S+/gi, "").trim();
      const now = Date.now();
      for (const [id, item] of Object.entries(userDb.swgc || {})) {
        if (!item?.time || now - item.time > 3e5) delete userDb.swgc[id];
      }
      ctx.react?.("⏳");
      const payload = await extractPayload(ctx, cleanText);
      if (!payload) {
        ctx.react?.("❓");
        return ctx.reply(`–  *S W  G R O U P*\n\n` + `Gunakan opsi perintah berikut:\n\n` + `┌  ◦  \`${prefix}swgc all <teks>\` (Kirim ke semua grup)\n` + `│  ◦  \`${prefix}swgc ini <teks>\` (Kirim ke grup ini)\n` + `└  ◦  \`${prefix}swgc <teks>\` (Pilih grup via menu interaktif)\n\n` + `Atau balas media (Foto/Video/Audio) dengan perintah di atas.`);
      }
      const generatedId = "sw_" + Math.random().toString(36).substring(2, 7);
      userDb.swgc[generatedId] = {
        payload: serializePayloadForDb(payload),
        time: Date.now()
      };
      db?.write?.(global.db);
      const groups = await getFilteredGroupList(sock);
      if (!groups.length) {
        delete userDb.swgc[generatedId];
        ctx.react?.("❌");
        return ctx.reply("❌ Tidak ada grup aktif yang tersedia di cache/database.");
      }
      const hours = new Date().getHours();
      const greeting = hours < 4 ? "Selamat Malam" : hours < 11 ? "Selamat Pagi" : hours < 15 ? "Selamat Siang" : hours < 18 ? "Selamat Sore" : "Selamat Malam";
      let mediaOutput = global.bot?.media?.banner1 || global.bot?.media?.thumb || global.bot?.media?.banner2 || null;
      const baseContextInfo = {
        mentionedJid: [senderJid],
        ...global.bot?.utils?.contextInfo || {
          forwardingScore: 999,
          isForwarded: true
        }
      };
      const seen = new Set();
      const rows = [];
      if (ctx.isGroup || ctx.id?.endsWith("@g.us")) {
        seen.add(ctx.id);
        const currentGroupData = groups.find(g => g.jid === ctx.id);
        const currentName = currentGroupData?.subject || "Grup Saat Ini";
        rows.push({
          title: `📍 ${currentName.slice(0, 30)}`,
          description: "Kirim status khusus ke grup saat ini",
          id: `${prefix}swgc --id=${generatedId} --to=${ctx.id}`
        });
      }
      for (const g of groups) {
        if (seen.has(g.jid)) continue;
        seen.add(g.jid);
        rows.push({
          title: `👥 ${g.subject.slice(0, 30)}`,
          description: `ID: ${g.jid.split("@")[0].slice(-8)}`,
          id: `${prefix}swgc --id=${generatedId} --to=${g.jid}`
        });
      }
      const limitedRows = rows.slice(0, 25);
      const bodyText = `“Hi @${userNumber}, ${greeting}!\n` + `Konten status grup Anda telah siap dan tersimpan sementara di server.”\n\n` + `–  *D R A F T  I N F O*\n\n` + `┌  ◦  *ID Konten* : \`${generatedId}\`\n` + `│  ◦  *Pengirim* : @${userNumber}\n` + `│  ◦  *Tipe Konten* : ${payload.mediaType?.toUpperCase() || "TEXT"}\n` + `│  ◦  *Total Grup* : ${rows.length} Grup Terdeteksi\n` + `└  ◦  *Masa Aktif* : 5 Menit (Auto-Purge)\n\n` + `–  *P E N T I N G*\n\n` + `┌  ◦  Status hanya terlihat oleh anggota grup tujuan.\n` + `└  ◦  Pilih target grup melalui tombol menu di bawah ini.`;
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: `🎯 PILIH TARGET GRUP (${limitedRows.length})`,
          sections: [{
            title: `${botName} • DAFTAR GRUP TERSEDIA`,
            rows: limitedRows
          }]
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "❌ Batalkan Draft",
          id: `${prefix}swgc --cancel=${generatedId}`
        })
      }];
      const options = {
        image: mediaOutput,
        title: `✦ ${botName} • Group Story Dispatcher ✦`,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `${botName} • Pilih Target Story`,
            button_title: "Pilih Grup Tujuan"
          }
        },
        contextInfo: baseContextInfo,
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
    } catch (error) {
      console.error("[SWGC Error]:", error);
      ctx.react?.("❌");
      ctx.reply(`❌ Gagal memproses status grup: ${error?.message || error}`);
    }
  }
};