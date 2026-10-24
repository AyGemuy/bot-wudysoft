import {
  getMessagePayload
} from "../../core/serialize.js";
global.swgcDrafts = global.swgcDrafts || new Map();

function getFullText(m) {
  if (!m) return "";
  const raw = m.message || m.msg || m;
  return (m.text || m.caption || m.body || raw?.conversation || raw?.extendedTextMessage?.text || raw?.imageMessage?.caption || raw?.videoMessage?.caption || raw?.ephemeralMessage?.message?.extendedTextMessage?.text || raw?.ephemeralMessage?.message?.conversation || "").trim();
}

function detectMedia(mtype = "", mime = "") {
  mtype = mtype.toLowerCase();
  mime = mime.toLowerCase();
  if (mtype.includes("image") || mime.startsWith("image/")) return "image";
  if (mtype.includes("video") || mime.startsWith("video/")) return "video";
  if (mtype.includes("audio") || mime.startsWith("audio/")) return "audio";
  return null;
}
async function sendGroupStory(sock, jid, mediaType, buffer, caption) {
  const content = {};
  if (mediaType === "image") content.image = buffer;
  else if (mediaType === "video") content.video = buffer;
  else if (mediaType === "audio") {
    content.audio = buffer;
    content.ptt = false;
  } else content.text = caption || "";
  if (caption && mediaType !== "audio") content.caption = caption;
  if (typeof sock.sendGroupStatusMessage === "function") {
    try {
      return await sock.sendGroupStatusMessage(jid, content);
    } catch (_) {}
  }
  return await sock.sendMessage(jid, {
    ...content,
    contextInfo: {
      isGroupStatus: true,
      statusAttributions: [{
        type: 10
      }],
      statusAudienceMetadata: {
        audienceType: "CLOSE_FRIENDS"
      },
      statusSourceType: (mediaType || "text").toUpperCase()
    }
  });
}
async function getGroups(sock) {
  const list = new Map();
  if (global.groupCache) {
    for (const [jid, val] of global.groupCache.entries()) {
      if (jid.endsWith("@g.us")) list.set(jid, val?.data?.subject || "Grup WhatsApp");
    }
  }
  const dbGroups = global.db?.group || {};
  for (const [jid, val] of Object.entries(dbGroups)) {
    if (jid.endsWith("@g.us") && !val?.bans && !list.has(jid)) {
      list.set(jid, val?.subject || val?.name || "Grup WhatsApp");
    }
  }
  if (!list.size && typeof sock.groupFetchAllParticipating === "function") {
    try {
      const res = await sock.groupFetchAllParticipating();
      for (const [jid, val] of Object.entries(res)) {
        if (jid.endsWith("@g.us")) list.set(jid, val.subject || "Grup WhatsApp");
      }
    } catch (_) {}
  }
  return Array.from(list.entries()).map(([jid, subject]) => ({
    jid: jid,
    subject: subject
  }));
}
export default {
  name: "swgc",
  aliases: ["statusgc", "swgroup"],
  description: "Upload status grup WhatsApp (CTA Select / All / Ini)",
  category: "Owner",
  owner: true,
  execute: async (sock, ctx, msg) => {
    try {
      if (!ctx.isOwner) return ctx.reply("❌ Khusus Owner Bot.");
      const prefix = typeof ctx.prefix === "string" ? ctx.prefix : ".";
      const rawText = (ctx.text || ctx.body || "").trim();
      const matchTo = rawText.match(/--to=([0-9\-_]+@g\.us)/i);
      const matchId = rawText.match(/--id=([a-zA-Z0-9_-]+)/i);
      if (matchTo && matchId) {
        ctx.react?.("⏳");
        const draft = global.swgcDrafts.get(matchId[1]);
        if (!draft) return ctx.reply("❌ Draft sudah kedaluwarsa, silakan buat ulang.");
        await sendGroupStory(sock, matchTo[1], draft.mediaType, draft.buffer, draft.caption);
        global.swgcDrafts.delete(matchId[1]);
        ctx.react?.("✅");
        return ctx.reply(`✅ Status grup berhasil diunggah ke \`${matchTo[1]}\``);
      }
      const isAll = /^[\\/\\.!#$]?swgc\s+all\b/i.test(rawText);
      const isHere = /^[\\/\\.!#$]?swgc\s+(ini|here|gc)\b/i.test(rawText);
      const userQuery = rawText.replace(/^[\\/\\.!#$]?swgc\s*(all|ini|here|gc)?\s*/i, "").replace(/--(id|to)=\S+/gi, "").trim();
      const target = ctx.quoted || ctx;
      const targetMsg = target.message || target.msg || target;
      const meta = getMessagePayload(targetMsg) || {};
      const mediaType = detectMedia(meta?.mtype || target.mtype || "", target.mimetype || meta?.msg?.mimetype);
      const fullCaption = userQuery || (ctx.quoted ? getFullText(ctx.quoted) : getFullText(ctx));
      let buffer = null;
      if (mediaType && typeof target.download === "function") {
        ctx.react?.("⏳");
        buffer = await target.download().catch(() => null);
      }
      if (!buffer && !fullCaption) {
        return ctx.reply("❌ Balas media/pesan atau ketik teks untuk dijadikan status grup.");
      }
      if (isAll) {
        const groups = await getGroups(sock);
        if (!groups.length) return ctx.reply("❌ Tidak ada grup terdeteksi.");
        ctx.react?.("⏳");
        let success = 0;
        const BATCH = 5;
        for (let i = 0; i < groups.length; i += BATCH) {
          await Promise.allSettled(groups.slice(i, i + BATCH).map(async g => {
            await sendGroupStory(sock, g.jid, mediaType, buffer, fullCaption);
            success++;
          }));
        }
        ctx.react?.("✅");
        return ctx.reply(`✅ Berhasil menyiarkan status ke *${success}/${groups.length}* grup.`);
      }
      if (isHere) {
        if (!ctx.isGroup && !ctx.id?.endsWith("@g.us")) return ctx.reply("❌ Gunakan di grup.");
        await sendGroupStory(sock, ctx.id, mediaType, buffer, fullCaption);
        ctx.react?.("✅");
        return ctx.reply("✅ Status grup berhasil diunggah ke grup ini.");
      }
      ctx.react?.("⏳");
      const groups = await getGroups(sock);
      if (!groups.length) return ctx.reply("❌ Tidak ada daftar grup yang tersedia.");
      const draftId = "sw_" + Math.random().toString(36).slice(2, 7);
      global.swgcDrafts.set(draftId, {
        mediaType: mediaType,
        buffer: buffer,
        caption: fullCaption
      });
      setTimeout(() => global.swgcDrafts.delete(draftId), 3e5);
      const rows = [];
      if (ctx.isGroup || ctx.id?.endsWith("@g.us")) {
        rows.push({
          title: "📍 Grup Saat Ini",
          description: "Kirim langsung ke grup ini",
          id: `${prefix}swgc --id=${draftId} --to=${ctx.id}`
        });
      }
      for (const g of groups) {
        if (g.jid === ctx.id) continue;
        rows.push({
          title: g.subject.slice(0, 30),
          description: `ID: ${g.jid.split("@")[0].slice(-8)}`,
          id: `${prefix}swgc --id=${draftId} --to=${g.jid}`
        });
      }
      const previewText = fullCaption ? fullCaption.length > 50 ? fullCaption.slice(0, 50) + "..." : fullCaption : "(Tanpa Teks / Polos)";
      const bodyText = `–  *S W  G R O U P*\n\n` + `┌  ◦  *Tipe* : ${(mediaType || "TEXT").toUpperCase()}\n` + `│  ◦  *Teks Salinan* : ${previewText}\n` + `└  ◦  *Total Grup* : ${rows.length} Grup\n\n` + `Pilih grup target pada tombol di bawah:`;
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: `🎯 PILIH TARGET GRUP`,
          sections: [{
            title: "DAFTAR GRUP TERSEDIA",
            rows: rows.slice(0, 25)
          }]
        })
      }];
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, "Group Story Dispatcher", buttons, {
          quoted: msg
        });
      } else {
        await ctx.reply(bodyText, {
          quoted: msg
        });
      }
      ctx.react?.("✅");
    } catch (e) {
      console.error(e);
      ctx.react?.("❌");
      ctx.reply(`❌ Error: ${e.message || e}`);
    }
  }
};