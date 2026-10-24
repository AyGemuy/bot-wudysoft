import {
  getMessagePayload
} from "../../core/serialize.js";
global.swMentionDrafts = global.swMentionDrafts || new Map();

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
async function sendGroupStoryWithMention(sock, targetJid, mediaType, buffer, caption, memberJids = []) {
  const content = {};
  if (mediaType === "image") content.image = buffer;
  else if (mediaType === "video") content.video = buffer;
  else if (mediaType === "audio") {
    content.audio = buffer;
    content.ptt = false;
  } else content.text = caption || "";
  if (caption && mediaType !== "audio") content.caption = caption;
  if (typeof sock.sendStatusMentions === "function") {
    try {
      return await sock.sendStatusMentions(content, [targetJid, ...memberJids]);
    } catch (_) {}
  }
  const contextInfo = {
    isGroupStatus: true,
    statusAttributions: [{
      type: 10
    }],
    statusAudienceMetadata: {
      audienceType: "CLOSE_FRIENDS"
    },
    mentionedJid: memberJids,
    statusSourceType: (mediaType || "text").toUpperCase()
  };
  return await sock.sendMessage(targetJid, {
    ...content,
    contextInfo: contextInfo
  }, {
    statusJidList: memberJids
  });
}
async function getGroups(sock) {
  const list = new Map();
  if (global.groupCache) {
    for (const [jid, val] of global.groupCache.entries()) {
      if (jid.endsWith("@g.us")) {
        list.set(jid, {
          subject: val?.data?.subject || "Grup WhatsApp",
          members: val?.data?.participants?.length || 0
        });
      }
    }
  }
  const dbGroups = global.db?.group || {};
  for (const [jid, val] of Object.entries(dbGroups)) {
    if (jid.endsWith("@g.us") && !val?.bans && !list.has(jid)) {
      list.set(jid, {
        subject: val?.subject || val?.name || "Grup WhatsApp",
        members: val?.memberCount || 0
      });
    }
  }
  if (!list.size && typeof sock.groupFetchAllParticipating === "function") {
    try {
      const res = await sock.groupFetchAllParticipating();
      for (const [jid, val] of Object.entries(res)) {
        if (jid.endsWith("@g.us")) {
          list.set(jid, {
            subject: val.subject || "Grup WhatsApp",
            members: val.participants?.length || 0
          });
        }
      }
    } catch (_) {}
  }
  return Array.from(list.entries()).map(([jid, data]) => ({
    jid: jid,
    ...data
  }));
}
export default {
  name: "swmention",
  aliases: ["swtag", "statustag", "statusmention"],
  description: "Upload status grup dengan mention seluruh member",
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
        const targetJid = matchTo[1];
        const draft = global.swMentionDrafts.get(matchId[1]);
        if (!draft) return ctx.reply("❌ Draft kedaluwarsa atau sudah terkirim.");
        let memberJids = [];
        try {
          const cached = global.groupCache?.get(targetJid)?.data;
          if (cached?.participants?.length) {
            memberJids = cached.participants.map(p => p.jid || p.id).filter(Boolean);
          } else if (typeof sock.groupMetadata === "function") {
            const meta = await sock.groupMetadata(targetJid).catch(() => null);
            if (meta?.participants?.length) {
              memberJids = meta.participants.map(p => p.jid || p.id).filter(Boolean);
            }
          }
        } catch (_) {}
        memberJids = [...new Set(memberJids.map(j => j.split(":")[0].replace(/\D/g, "") + "@s.whatsapp.net"))];
        await sendGroupStoryWithMention(sock, targetJid, draft.mediaType, draft.buffer, draft.caption, memberJids);
        global.swMentionDrafts.delete(matchId[1]);
        ctx.react?.("✅");
        return ctx.reply(`–  *S W  M E N T I O N*\n\n` + `┌  ◦  *Status* : Berhasil Terunggah ✅\n` + `│  ◦  *Target Grup* : \`${targetJid}\`\n` + `│  ◦  *Total Mention* : ${memberJids.length} Member\n` + `└  ◦  *Tipe* : ${(draft.mediaType || "TEXT").toUpperCase()}`);
      }
      const userQuery = rawText.replace(/^[\\/\\.!#$]?(swmention|swtag|statustag|statusmention)\s*/i, "").replace(/--(id|to)=\S+/gi, "").trim();
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
        return ctx.reply("❌ Balas media/pesan atau ketik teks untuk dijadikan status mention.");
      }
      ctx.react?.("⏳");
      const groups = await getGroups(sock);
      if (!groups.length) return ctx.reply("❌ Tidak ada grup yang tersedia.");
      const draftId = "swm_" + Math.random().toString(36).slice(2, 7);
      global.swMentionDrafts.set(draftId, {
        mediaType: mediaType,
        buffer: buffer,
        caption: fullCaption
      });
      setTimeout(() => global.swMentionDrafts.delete(draftId), 3e5);
      const rows = [];
      if (ctx.isGroup || ctx.id?.endsWith("@g.us")) {
        rows.push({
          title: "📍 Grup Saat Ini",
          description: "Tag seluruh member di grup ini",
          id: `${prefix}swmention --id=${draftId} --to=${ctx.id}`
        });
      }
      for (const g of groups) {
        if (g.jid === ctx.id) continue;
        const members = g.members ? `${g.members} Member` : "Member Aktif";
        rows.push({
          title: g.subject.slice(0, 30),
          description: `${members} • ID: ${g.jid.split("@")[0].slice(-8)}`,
          id: `${prefix}swmention --id=${draftId} --to=${g.jid}`
        });
      }
      const previewText = fullCaption ? fullCaption.length > 50 ? fullCaption.slice(0, 50) + "..." : fullCaption : "(Tanpa Teks / Polos)";
      const bodyText = `–  *S W  M E N T I O N*\n\n` + `┌  ◦  *Tipe* : ${(mediaType || "TEXT").toUpperCase()}\n` + `│  ◦  *Teks Salinan* : ${previewText}\n` + `└  ◦  *Total Grup* : ${rows.length} Grup\n\n` + `Pilih grup target tag mention melalui menu di bawah:`;
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: `🎯 PILIH TARGET TAG MENTION`,
          sections: [{
            title: "DAFTAR GRUP TERSEDIA",
            rows: rows.slice(0, 25)
          }]
        })
      }];
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, "Mention Story Dispatcher", buttons, {
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
      ctx.reply(`❌ Gagal: ${e.message || e}`);
    }
  }
};