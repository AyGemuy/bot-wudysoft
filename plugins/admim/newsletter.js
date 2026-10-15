import db from "../../data/db.js";
import {
  metaQuoted
} from "../../lib/quoted.js";
export default {
  name: "newsletter",
  aliases: ["saluran", "channel", "ch"],
  description: "Manajemen Saluran / Newsletter WhatsApp (Info, Follow, Create, Edit, React)",
  category: "Newsletter",
  example: ".ch info https://whatsapp.com/channel/xxx\n.ch create Nama Saluran | Deskripsi\n.ch follow <JID>\n.ch react <Emoji> <MsgID>",
  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    const quotedMsg = typeof metaQuoted === "function" ? metaQuoted(ctx) : msg;
    const botName = global.bot?.name || "Wudysoft";
    const footer = global.bot?.footer || `${botName} • Channel Manager`;
    const args = ctx.args || [];
    const action = (args[0] || "").toLowerCase();
    if (action === "info" || action === "detail" || action === "cek") {
      const target = args[1] || ctx.query?.replace(/^(info|detail|cek)\s*/i, "").trim();
      if (!target) {
        return ctx.reply(`Format: \`${prefix}ch info <Link Saluran / JID @newsletter>\``);
      }
      await ctx.react("⏳").catch(() => {});
      try {
        let meta = null;
        if (target.includes("whatsapp.com/channel/")) {
          const code = target.split("/channel/")[1]?.split(/[\/?#]/)[0];
          meta = await sock.newsletterMetadata("invite", code);
        } else if (target.endsWith("@newsletter")) {
          meta = await sock.newsletterMetadata("jid", target);
        } else if (typeof sock.cekIDSaluran === "function") {
          meta = await sock.cekIDSaluran(target);
        }
        if (!meta) throw new Error("Metadata saluran tidak ditemukan.");
        const role = meta.viewer_metadata?.role || "GUEST";
        const isMuted = meta.viewer_metadata?.mute === "YES";
        const text = `–  *N E W S L E T T E R  I N F O*

┌  ◦  *Nama* : ${meta.name}
│  ◦  *JID* : \`${meta.id}\`
│  ◦  *Pengikut* : ${Number(meta.subscribers || 0).toLocaleString("id-ID")} Orang
│  ◦  *Status Verifikasi* : ${meta.verification === "VERIFIED" ? "Terverifikasi Centang Hijau ✅" : "Standar"}
│  ◦  *Peran Bot* : ${role}
│  ◦  *Mute Notif* : ${isMuted ? "Muted 🔕" : "Aktif 🔔"}
└  ◦  *Dibuat Pada* : ${new Date(Number(meta.creation_time) * 1e3).toLocaleDateString("id-ID")}

${meta.description ? `–  *D E S C R I P T I O N*\n${meta.description}` : ""}`;
        await ctx.react("✅").catch(() => {});
        return await ctx.reply(text, {
          quoted: quotedMsg
        });
      } catch (err) {
        await ctx.react("❌").catch(() => {});
        return ctx.reply(`❌ Gagal mengambil informasi saluran: ${err?.message || err}`);
      }
    }
    if (action === "create" || action === "buat") {
      if (!ctx.isOwner && !ctx.isROwner) {
        return ctx.reply("❌ Perintah ini khusus untuk *Owner Bot*.");
      }
      const input = args.slice(1).join(" ");
      const [name, description] = input.split("|").map(s => s?.trim());
      if (!name) {
        return ctx.reply(`Format: \`${prefix}ch create Nama Saluran | Deskripsi Saluran\``);
      }
      await ctx.react("⏳").catch(() => {});
      try {
        const res = await sock.newsletterCreate(name, description || "");
        await ctx.react("✅").catch(() => {});
        return ctx.reply(`–  *C H A N N E L  C R E A T E D*

Saluran WhatsApp resmi berhasil dibuat!

┌  ◦  *Nama* : ${res.name}
│  ◦  *JID* : \`${res.id}\`
└  ◦  *Link* : https://whatsapp.com/channel/${res.invite || "-"}`);
      } catch (err) {
        await ctx.react("❌").catch(() => {});
        return ctx.reply(`❌ Gagal membuat saluran: ${err?.message || err}`);
      }
    }
    if (action === "follow" || action === "unfollow") {
      if (!ctx.isOwner) return ctx.reply("❌ Khusus Owner Bot.");
      const jid = args[1];
      if (!jid || !jid.endsWith("@newsletter")) {
        return ctx.reply(`Format: \`${prefix}ch ${action} <JID_SALURAN@newsletter>\``);
      }
      try {
        if (action === "follow") {
          await sock.newsletterFollow(jid);
          return ctx.reply(`✅ Berhasil mengikuti saluran \`${jid}\`.`);
        } else {
          await sock.newsletterUnfollow(jid);
          return ctx.reply(`✅ Berhasil berhenti mengikuti saluran \`${jid}\`.`);
        }
      } catch (err) {
        return ctx.reply(`❌ Gagal memproses: ${err?.message || err}`);
      }
    }
    if (action === "react") {
      const emoji = args[1];
      const targetJid = args[2] || (ctx.chat.endsWith("@newsletter") ? ctx.chat : null);
      const serverMsgId = args[3] || ctx.quoted?.id;
      if (!emoji || !targetJid) {
        return ctx.reply(`Format: \`${prefix}ch react <Emoji> <ChannelJID> [ServerMsgID]\``);
      }
      try {
        await sock.newsletterReactMessage(targetJid, serverMsgId, emoji);
        return ctx.reply(`✅ Reaksi ${emoji} terkirim.`);
      } catch (err) {
        return ctx.reply(`❌ Gagal react saluran: ${err?.message || err}`);
      }
    }
    const helpMenu = `–  *N E W S L E T T E R  M E N U*

Kelola Saluran WhatsApp langsung melalui bot.

┌  ◦  *Cek Saluran* : \`${prefix}ch info <Link / JID>\`
│  ◦  *Buat Saluran* : \`${prefix}ch create Nama | Desk\`
│  ◦  *Follow Saluran* : \`${prefix}ch follow <JID>\`
│  ◦  *Unfollow Saluran* : \`${prefix}ch unfollow <JID>\`
│  ◦  *Mute Saluran* : \`${prefix}ch mute <JID>\`
│  ◦  *Unmute Saluran* : \`${prefix}ch unmute <JID>\`
└  ◦  *React Saluran* : \`${prefix}ch react <Emoji> <JID> <MsgID>\`

_${footer}_`;
    return ctx.reply(helpMenu);
  }
};