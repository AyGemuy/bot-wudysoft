import db from "../../data/db.js";
import {
  metaQuoted,
  simpleQuoted
} from "../../lib/quoted.js";
import {
  decodeJid
} from "../../core/serialize.js";

function initDB(communityId = null) {
  if (!global.db) global.db = {};
  if (!global.db.community) global.db.community = {};
  if (communityId && !global.db.community[communityId]) {
    global.db.community[communityId] = {
      subject: "",
      linkedGroups: [],
      createdAt: Date.now()
    };
  }
}

function saveDB() {
  if (typeof db?.write === "function" && global.db) {
    db.write(global.db);
  }
}
export default {
  name: "community",
  aliases: ["komunitas", "comm"],
  description: "Manajemen Komunitas WhatsApp Lengkap (Create, Link, Unlink, Info, Invite)",
  category: "Community",
  example: ".comm create Nama Komunitas | Deskripsi\n.comm link <GroupJID>\n.comm unlink <GroupJID>\n.comm list\n.comm info",
  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    const quotedMsg = typeof metaQuoted === "function" ? metaQuoted(ctx) : msg;
    const botName = global.bot?.name || "Wudysoft";
    const footer = global.bot?.footer || `${botName} • Community Manager`;
    const args = ctx.args || [];
    const action = (args[0] || "").toLowerCase();
    if (action === "create" || action === "buat") {
      if (!ctx.isOwner && !ctx.isROwner) {
        return ctx.reply("❌ Perintah membuat komunitas hanya diizinkan untuk *Owner Bot*.");
      }
      const input = args.slice(1).join(" ");
      const [subject, description] = input.split("|").map(s => s?.trim());
      if (!subject) {
        return ctx.reply(`– *C R E A T E  C O M M U N I T Y*\n\nFormat: \`${prefix}comm create Nama Komunitas | Deskripsi Singkat\``);
      }
      await ctx.react("⏳").catch(() => {});
      try {
        const result = await sock.communityCreate(subject, description || "");
        initDB(result.id);
        global.db.community[result.id].subject = subject;
        saveDB();
        let inviteCode = "";
        try {
          inviteCode = await sock.communityInviteCode(result.id);
        } catch {}
        const text = `–  *C O M M U N I T Y  C R E A T E D*

Komunitas WhatsApp berhasil dibuat!

┌  ◦  *Nama* : ${subject}
│  ◦  *ID* : \`${result.id}\`
│  ◦  *Deskripsi* : ${description || "-"}
└  ◦  *Invite Link* : ${inviteCode ? `https://chat.whatsapp.com/${inviteCode}` : "Privat"}

Gunakan \`${prefix}comm link <GroupJID>\` untuk menautkan grup ke komunitas ini.`;
        await ctx.react("✅").catch(() => {});
        return await ctx.reply(text, {
          quoted: quotedMsg
        });
      } catch (err) {
        await ctx.react("❌").catch(() => {});
        return ctx.reply(`❌ Gagal membuat komunitas: ${err?.message || err}`);
      }
    }
    if (action === "info" || action === "detail") {
      const targetId = args[1] || ctx.chat;
      await ctx.react("⏳").catch(() => {});
      try {
        const meta = await sock.communityMetadata(targetId);
        const linked = await sock.communityFetchLinkedGroups(targetId).catch(() => []);
        let inviteCode = "";
        try {
          inviteCode = await sock.communityInviteCode(targetId);
        } catch {}
        const text = `–  *C O M M U N I T Y  I N F O*

┌  ◦  *Nama* : ${meta.subject}
│  ◦  *ID* : \`${meta.id}\`
│  ◦  *Total Anggota* : ${meta.participants?.length || 0}
│  ◦  *Grup Tertaut* : ${linked?.length || 0} Grup
│  ◦  *Owner* : @${meta.owner ? meta.owner.split("@")[0] : "-"}
└  ◦  *Invite Link* : ${inviteCode ? `https://chat.whatsapp.com/${inviteCode}` : "-"}

${meta.desc ? `–  *D E S C R I P T I O N*\n${meta.desc}` : ""}`;
        await ctx.react("✅").catch(() => {});
        return await ctx.reply(text, {
          mentions: meta.owner ? [meta.owner] : [],
          quoted: quotedMsg
        });
      } catch (err) {
        await ctx.react("❌").catch(() => {});
        return ctx.reply(`❌ Gagal mengambil info komunitas: ${err?.message || err}`);
      }
    }
    if (action === "link" || action === "addgroup") {
      if (!ctx.isOwner && !ctx.isAdmin) {
        return ctx.reply("❌ Perintah ini khusus untuk *Admin Komunitas* atau *Owner Bot*.");
      }
      const groupJid = args[1] || (ctx.isGroup ? ctx.chat : null);
      const communityJid = args[2] || (ctx.chat.endsWith("@g.us") ? null : args[1]);
      if (!groupJid) {
        return ctx.reply(`Format: \`${prefix}comm link <GroupJID> [CommunityJID]\``);
      }
      await ctx.react("⏳").catch(() => {});
      try {
        await sock.communityLinkGroup(groupJid, communityJid || ctx.chat);
        await ctx.react("✅").catch(() => {});
        return ctx.reply(`✅ Grup \`${groupJid}\` berhasil ditautkan ke komunitas.`);
      } catch (err) {
        await ctx.react("❌").catch(() => {});
        return ctx.reply(`❌ Gagal menautkan grup: ${err?.message || err}`);
      }
    }
    if (action === "unlink" || action === "removegroup") {
      if (!ctx.isOwner && !ctx.isAdmin) {
        return ctx.reply("❌ Perintah ini khusus untuk *Admin Komunitas* atau *Owner Bot*.");
      }
      const groupJid = args[1];
      if (!groupJid) {
        return ctx.reply(`Format: \`${prefix}comm unlink <GroupJID>\``);
      }
      await ctx.react("⏳").catch(() => {});
      try {
        await sock.communityUnlinkGroup(groupJid, ctx.chat);
        await ctx.react("✅").catch(() => {});
        return ctx.reply(`✅ Grup \`${groupJid}\` berhasil dilepas dari komunitas.`);
      } catch (err) {
        await ctx.react("❌").catch(() => {});
        return ctx.reply(`❌ Gagal melepas tautan grup: ${err?.message || err}`);
      }
    }
    const helpMenu = `–  *C O M M U N I T Y  M E N U*

Kelola komunitas WhatsApp langsung menggunakan engine Baileys.

┌  ◦  *Buat Komunitas* : \`${prefix}comm create Nama | Desk\`
│  ◦  *Detail Komunitas* : \`${prefix}comm info [ID]\`
│  ◦  *Tautkan Grup* : \`${prefix}comm link <GroupJID>\`
│  ◦  *Lepas Tautan* : \`${prefix}comm unlink <GroupJID>\`
│  ◦  *Tautan Undangan* : \`${prefix}comm invite\`
└  ◦  *Keluar Komunitas* : \`${prefix}comm leave\`

_${footer}_`;
    return ctx.reply(helpMenu);
  }
};