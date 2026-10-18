import db from "../../data/db.js";
import {
  metaQuoted,
  simpleQuoted
} from "../../lib/quoted.js";

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
  description: "Manajemen Komunitas WhatsApp Lengkap (Create, Link, Unlink, Info, Invite, Leave)",
  category: "Community",
  example: ".comm create Nama Komunitas | Deskripsi\n.comm link <GroupJID>\n.comm unlink <GroupJID>\n.comm info",
  execute: async (sock, ctx, msg) => {
    try {
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof metaQuoted === "function" ? metaQuoted(ctx) : typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const botMsg = global.bot?.msg || {};
      const botContext = global.bot?.utils?.contextInfo || {};
      const footer = global.bot?.footer || "– Wudysoft • Community Manager";
      const replyWithContext = async (text, options = {}) => {
        return await sock.sendMessage(ctx.id, {
          text: text,
          contextInfo: {
            ...botContext,
            ...options.contextInfo
          },
          ...options
        }, {
          quoted: quotedMsg
        });
      };
      const args = ctx.args || [];
      const action = (args[0] || "").toLowerCase();
      if (["create", "buat"].includes(action)) {
        if (!ctx.isOwner && !ctx.isROwner) return replyWithContext(botMsg.owner || "–  *A C C E S S  D E N I E D*");
        const input = args.slice(1).join(" ");
        const [subject, description] = input.split("|").map(s => s?.trim());
        if (!subject) {
          return replyWithContext(`–  *C R E A T E  C O M M U N I T Y*\n\nFormat: \`${prefix}comm create Nama Komunitas | Deskripsi Singkat\``);
        }
        ctx.react?.("⏳");
        const result = await sock.communityCreate(subject, description || "");
        initDB(result.id);
        global.db.community[result.id].subject = subject;
        saveDB();
        let inviteCode = "";
        try {
          inviteCode = await sock.communityInviteCode(result.id);
        } catch {}
        ctx.react?.("✅");
        const text = `–  *C O M M U N I T Y  C R E A T E D*

Komunitas WhatsApp resmi berhasil dibuat!

┌  ◦  *Nama* : ${subject}
│  ◦  *ID Komunitas* : \`${result.id}\`
│  ◦  *Deskripsi* : ${description || "-"}
└  ◦  *Link Undangan* : ${inviteCode ? `https://chat.whatsapp.com/${inviteCode}` : "Privat"}

Gunakan perintah \`${prefix}comm link <GroupJID>\` untuk menautkan grup ke komunitas ini.`;
        return replyWithContext(text);
      }
      if (["info", "detail"].includes(action)) {
        const targetId = args[1] || ctx.chat;
        ctx.react?.("⏳");
        const meta = await sock.communityMetadata(targetId);
        const linked = await sock.communityFetchLinkedGroups(targetId).catch(() => []);
        let inviteCode = "";
        try {
          inviteCode = await sock.communityInviteCode(targetId);
        } catch {}
        ctx.react?.("✅");
        const text = `–  *C O M M U N I T Y  I N F O*

┌  ◦  *Nama Komunitas* : ${meta.subject}
│  ◦  *ID* : \`${meta.id}\`
│  ◦  *Total Anggota* : ${meta.participants?.length || 0}
│  ◦  *Grup Tertaut* : ${linked?.length || 0} Grup
│  ◦  *Owner* : @${meta.owner ? meta.owner.split("@")[0] : "-"}
└  ◦  *Invite Link* : ${inviteCode ? `https://chat.whatsapp.com/${inviteCode}` : "-"}

${meta.desc ? `–  *D E S C R I P T I O N*\n${meta.desc}` : ""}`;
        return replyWithContext(text, {
          contextInfo: {
            mentionedJid: meta.owner ? [meta.owner] : []
          }
        });
      }
      if (["link", "addgroup"].includes(action)) {
        if (!ctx.isOwner && !ctx.isAdmin) return replyWithContext(botMsg.admin || "–  *A D M I N  O N L Y*");
        const groupJid = args[1] || (ctx.isGroup ? ctx.chat : null);
        const communityJid = args[2] || (ctx.chat.endsWith("@g.us") ? null : args[1]);
        if (!groupJid) return replyWithContext(`Format: \`${prefix}comm link <GroupJID> [CommunityJID]\``);
        ctx.react?.("⏳");
        await sock.communityLinkGroup(groupJid, communityJid || ctx.chat);
        ctx.react?.("✅");
        return replyWithContext(`✅ Grup \`${groupJid}\` berhasil ditautkan ke dalam komunitas.`);
      }
      if (["unlink", "removegroup"].includes(action)) {
        if (!ctx.isOwner && !ctx.isAdmin) return replyWithContext(botMsg.admin || "–  *A D M I N  O N L Y*");
        const groupJid = args[1];
        if (!groupJid) return replyWithContext(`Format: \`${prefix}comm unlink <GroupJID>\``);
        ctx.react?.("⏳");
        await sock.communityUnlinkGroup(groupJid, ctx.chat);
        ctx.react?.("✅");
        return replyWithContext(`✅ Grup \`${groupJid}\` berhasil dilepas dari komunitas.`);
      }
      if (["revoke", "resetlink"].includes(action)) {
        if (!ctx.isOwner && !ctx.isAdmin) return replyWithContext(botMsg.admin || "–  *A D M I N  O N L Y*");
        const commJid = args[1] || ctx.chat;
        ctx.react?.("⏳");
        const newCode = await sock.communityRevokeInvite(commJid);
        ctx.react?.("✅");
        return replyWithContext(`🔄 Tautan undangan komunitas diperbarui:\nhttps://chat.whatsapp.com/${newCode}`);
      }
      if (action === "leave") {
        if (!ctx.isOwner) return replyWithContext(botMsg.owner || "–  *A C C E S S  D E N I E D*");
        const commJid = args[1] || ctx.chat;
        await replyWithContext("👋 Bot pamit keluar dari komunitas.");
        return await sock.communityLeave(commJid);
      }
      const helpMenu = `–  *C O M M U N I T Y  M E N U*

Kelola komunitas WhatsApp langsung menggunakan engine @whiskeysockets/baileys.

┌  ◦  *Buat Komunitas* : \`${prefix}comm create Nama | Desk\`
│  ◦  *Detail Komunitas* : \`${prefix}comm info [ID]\`
│  ◦  *Tautkan Grup* : \`${prefix}comm link <GroupJID>\`
│  ◦  *Lepas Tautan* : \`${prefix}comm unlink <GroupJID>\`
│  ◦  *Reset Link* : \`${prefix}comm revoke [CommID]\`
└  ◦  *Keluar Komunitas* : \`${prefix}comm leave [CommID]\`

_${footer}_`;
      return replyWithContext(helpMenu);
    } catch (err) {
      console.error("[COMMUNITY Error]:", err);
      ctx.react?.("❌");
      ctx.reply(`❌ Terjadi kesalahan: ${err?.message || err}`);
    }
  }
};