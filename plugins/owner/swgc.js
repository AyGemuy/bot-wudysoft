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
  const mediaKeys = ["image", "video", "audio", "sticker", "document"];
  for (const key of mediaKeys) {
    if (Buffer.isBuffer(clone[key])) {
      clone[key] = {
        _isBuffer: true,
        data: clone[key].toString("base64")
      };
    }
  }
  return clone;
}

function deserializePayloadFromDb(storedPayload) {
  if (!storedPayload) return null;
  const result = {
    ...storedPayload
  };
  const mediaKeys = ["image", "video", "audio", "sticker", "document"];
  for (const key of mediaKeys) {
    if (result[key] && typeof result[key] === "object" && result[key]._isBuffer) {
      result[key] = Buffer.from(result[key].data, "base64");
    } else if (typeof result[key] === "string" && /^[A-Za-z0-9+/=]+$/.test(result[key]) && result[key].length > 100) {
      result[key] = Buffer.from(result[key].data, "base64");
    }
  }
  return result;
}

function isCtaOrBotMenu(target) {
  if (!target) return false;
  const rawMsg = target.message || target.msg || target;
  if (rawMsg?.interactiveMessage || rawMsg?.buttonsMessage || rawMsg?.templateMessage || rawMsg?.listMessage) {
    return true;
  }
  const text = target.text || target.caption || target.body || "";
  if (/S\s*W\s*G\s*R\s*O\s*U\s*P|PILIH TARGET GRUP|Group Story Dispatcher/i.test(text)) {
    return true;
  }
  return false;
}

function getSafeUserDb(jid, name = "Owner") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  try {
    if (typeof db?.ensureUser === "function") {
      db.ensureUser(jid);
    }
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
  let list = [];
  const dbKeys = Object.keys(dbGroups).filter(jid => jid.endsWith("@g.us"));
  if (dbKeys.length > 0) {
    for (const jid of dbKeys) {
      const data = dbGroups[jid];
      if (data?.bans === true) continue;
      list.push({
        jid: jid,
        subject: data?.subject || data?.name || null
      });
    }
    const missingSubjects = list.filter(g => !g.subject);
    if (missingSubjects.length > 0 && typeof sock.groupFetchAllParticipating === "function") {
      try {
        const fetched = await sock.groupFetchAllParticipating();
        let updated = false;
        for (const item of list) {
          if (!item.subject && fetched[item.jid]?.subject) {
            item.subject = fetched[item.jid].subject;
            if (dbGroups[item.jid]) {
              dbGroups[item.jid].subject = item.subject;
              updated = true;
            }
          }
        }
        if (updated && typeof db?.write === "function") {
          db.write(global.db);
        }
      } catch (_) {}
    }
  }
  if (list.length === 0 && typeof sock.groupFetchAllParticipating === "function") {
    try {
      const fetched = await sock.groupFetchAllParticipating();
      for (const [jid, meta] of Object.entries(fetched || {})) {
        if (!jid.endsWith("@g.us")) continue;
        if (dbGroups[jid]?.bans === true) continue;
        list.push({
          jid: jid,
          subject: meta?.subject || "WhatsApp Group"
        });
        if (global.db?.group && !global.db.group[jid]) {
          global.db.group[jid] = {
            from: jid,
            subject: meta?.subject || "WhatsApp Group",
            bans: false
          };
        }
      }
      if (typeof db?.write === "function") {
        db.write(global.db);
      }
    } catch (_) {}
  }
  return list.map(g => ({
    jid: g.jid,
    subject: g.subject || `Group (${g.jid.split("@")[0].slice(-5)})`
  }));
}
async function extractPayload(ctx) {
  const inputCaption = (ctx.query || ctx.args?.join(" ") || "").replace(/--id=\S+/gi, "").replace(/--to=\S+/gi, "").trim();
  let target = ctx;
  const ctxRaw = ctx.message || ctx.msg || ctx;
  const {
    mtype: ctxMtype
  } = getMessagePayload(ctxRaw);
  const cleanCtxType = String(ctxMtype || "").replace(/Message$/i, "").toLowerCase();
  const ctxHasMedia = ["image", "video", "audio", "sticker", "document", "ptv"].includes(cleanCtxType) || ctx.isMedia;
  if (!ctxHasMedia && ctx.quoted && !isCtaOrBotMenu(ctx.quoted)) {
    target = ctx.quoted;
  }
  const rawMsgObj = target.message || target.msg || target;
  const {
    mtype,
    msg: innerMsg
  } = getMessagePayload(rawMsgObj);
  const cleanType = String(mtype || "").replace(/Message$/i, "").toLowerCase();
  const mediaTypes = ["image", "video", "audio", "sticker", "document", "ptv"];
  const isMedia = mediaTypes.includes(cleanType) || target.isMedia || /image|video|audio|ogg|webp/i.test(target.mimetype || "");
  let payload = null;
  if (isMedia && typeof target.download === "function") {
    const buffer = await target.download().catch(() => null);
    if (buffer && Buffer.isBuffer(buffer)) {
      const mediaKey = mediaTypes.includes(cleanType) ? cleanType === "ptv" ? "video" : cleanType : "image";
      payload = {
        [mediaKey]: buffer
      };
      const customCaption = inputCaption || (target !== ctx ? target.text || innerMsg?.caption || "" : "");
      if (["image", "video", "document"].includes(mediaKey) && customCaption) {
        payload.caption = customCaption;
      }
      if (mediaKey === "audio") {
        payload.mimetype = target.mimetype || innerMsg?.mimetype || "audio/mp4";
        payload.ptt = Boolean(innerMsg?.ptt ?? target.ptt ?? true);
      }
      if (mediaKey === "document") {
        payload.mimetype = target.mimetype || innerMsg?.mimetype || "application/octet-stream";
        payload.fileName = target.fileName || innerMsg?.fileName || "file";
      }
    }
  }
  if (!payload) {
    const textContent = inputCaption || (target !== ctx ? target.text || innerMsg?.conversation || innerMsg?.text || "" : "");
    if (textContent) {
      payload = {
        text: textContent,
        backgroundColor: "#000000",
        font: 1
      };
    }
  }
  return payload;
}
export default {
  name: "swgc",
  aliases: ["statusgc", "swgroup", "upstatusgc", "storygc"],
  description: "Upload status grup WhatsApp dengan pemilihan interaktif daftar grup (Owner Only)",
  category: "Owner",
  owner: true,
  example: ".swgc Halo semua (atau reply media / teks dengan .swgc)",
  execute: async (sock, ctx, msg) => {
    try {
      if (!ctx.isOwner) {
        return ctx.reply("❌ Fitur ini khusus hanya dapat digunakan oleh *Owner Bot*.");
      }
      const rawSender = ctx.sender || ctx.from || ctx.id || "";
      const senderJid = rawSender.includes("@") ? rawSender.split(":")[0].replace(/[^0-9]/g, "") + "@s.whatsapp.net" : rawSender;
      const userDb = getSafeUserDb(senderJid, ctx.name);
      const now = Date.now();
      for (const [id, item] of Object.entries(userDb.swgc)) {
        if (!item?.time || now - item.time > 5 * 60 * 1e3) {
          delete userDb.swgc[id];
        }
      }
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "Paimon-bot";
      const botFooter = global.bot?.footer || `${botName} • Group Story Dispatcher`;
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const rawQuery = (ctx.query || ctx.args?.join(" ") || "").trim();
      const idMatch = rawQuery.match(/--id=([a-zA-Z0-9_-]+)/i);
      const targetMatch = rawQuery.match(/--to=([0-9\-_]+@g\.us)/i);
      const contentId = idMatch ? idMatch[1] : null;
      const targetJid = targetMatch ? targetMatch[1] : null;
      if (targetJid) {
        if (typeof ctx.react === "function") await ctx.react("⏳");
        if (!contentId || !userDb.swgc?.[contentId]) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply("❌ Draft konten status tidak ditemukan atau telah kedaluwarsa. Silakan reply/kirim ulang media dengan `.swgc`.");
        }
        const draft = userDb.swgc[contentId];
        const payload = deserializePayloadFromDb(draft.payload);
        if (!payload) {
          delete userDb.swgc[contentId];
          if (typeof db?.write === "function") db.write(global.db);
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply("❌ Gagal memuat berkas media dari database. Silakan kirim ulang.");
        }
        let sentStatusResult = null;
        if (typeof sock.swgc === "function") {
          sentStatusResult = await sock.swgc(targetJid, payload);
        } else if (typeof sock.sendMessage === "function") {
          sentStatusResult = await sock.sendMessage(targetJid, payload, {
            backgroundColor: "#000000",
            font: 1,
            statusJidList: [targetJid]
          });
        } else {
          throw new Error("Fungsi `sock.swgc` atau `sock.sendMessage` tidak tersedia.");
        }
        delete userDb.swgc[contentId];
        if (typeof db?.write === "function") {
          db.write(global.db);
        }
        if (typeof ctx.react === "function") await ctx.react("✅");
        const successText = `–  *S W  G R O U P*

┌  ◦  *Status* : Sukses Terunggah
│  ◦  *ID Konten* : \`${contentId}\`
└  ◦  *Target Grup* : \`${targetJid}\`

Status grup telah berhasil diupload dan draft sementara otomatis dihapus.`;
        const statusQuoted = sentStatusResult && typeof sentStatusResult === "object" && sentStatusResult.key ? sentStatusResult : quotedMsg;
        return await sock.sendMessage(ctx.id, {
          text: successText
        }, {
          quoted: statusQuoted
        });
      }
      if (typeof ctx.react === "function") await ctx.react("⏳");
      const payload = await extractPayload(ctx);
      if (!payload) {
        if (typeof ctx.react === "function") await ctx.react("❓");
        return ctx.reply(`–  *S W  G R O U P*

Silakan masukkan teks atau reply berkas media yang ingin dijadikan status grup.

┌  ◦  *Teks* : \`${prefix}swgc Pesan status kamu\`
│  ◦  *Reply Teks* : Balas pesan dengan \`${prefix}swgc\`
└  ◦  *Reply Media* : Balas Foto / Video / Audio / Stiker

Setelah itu, pilih grup tujuan melalui menu tombol list.`);
      }
      const generatedId = "sw_" + Math.random().toString(36).substring(2, 7);
      userDb.swgc[generatedId] = {
        payload: serializePayloadForDb(payload),
        time: Date.now()
      };
      if (typeof db?.write === "function") {
        db.write(global.db);
      }
      const groups = await getFilteredGroupList(sock);
      if (!groups || groups.length === 0) {
        delete userDb.swgc[generatedId];
        if (typeof ctx.react === "function") await ctx.react("❌");
        return ctx.reply("❌ Tidak ada grup aktif yang tersedia di database atau bot belum masuk grup.");
      }
      const seenGroupJids = new Set();
      const groupRows = [];
      const isCurrentGroup = ctx.isGroup || ctx.id?.endsWith("@g.us");
      if (isCurrentGroup && ctx.id) {
        seenGroupJids.add(ctx.id);
        const currentGroupData = groups.find(g => g.jid === ctx.id);
        const currentName = currentGroupData?.subject || "Grup Saat Ini";
        groupRows.push({
          title: `📍 ${currentName.slice(0, 32)}`,
          description: "Kirim status khusus ke grup ini",
          id: `${prefix}swgc --id=${generatedId} --to=${ctx.id}`
        });
      }
      for (const grp of groups) {
        if (seenGroupJids.has(grp.jid)) continue;
        seenGroupJids.add(grp.jid);
        groupRows.push({
          title: `👥 ${grp.subject.slice(0, 32)}`,
          description: `JID: ${grp.jid.split("@")[0]}`,
          id: `${prefix}swgc --id=${generatedId} --to=${grp.jid}`
        });
      }
      const limitedRows = groupRows.slice(0, 20);
      const bodyText = `–  *S W  G R O U P*

Konten status Anda telah tersimpan sementara.

┌  ◦  *ID Konten* : \`${generatedId}\`
│  ◦  *Pengirim* : @${senderJid.split("@")[0]}
│  ◦  *Total Grup Aktif* : ${groupRows.length} Grup
└  ◦  *Masa Aktif* : 5 Menit

Silakan pilih grup tujuan pada menu tombol di bawah:`;
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: `🎯 PILIH TARGET GRUP (${limitedRows.length})`,
          sections: [{
            title: `${botName} • DAFTAR GRUP AKTIF`,
            rows: limitedRows
          }]
        })
      }];
      const bannerMedia = global.bot?.media?.banner1 || global.bot?.media?.banner2 || null;
      const options = {
        image: bannerMedia,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `${botName} • Pilih Target Grup`,
            button_title: "Pilih Grup Tujuan"
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
      if (typeof ctx.react === "function") await ctx.react("✅");
    } catch (error) {
      console.error("[SWGC Error]:", error);
      if (typeof ctx.react === "function") await ctx.react("❌");
      ctx.reply(`❌ Gagal memproses status grup: ${error?.message || error}`);
    }
  }
};