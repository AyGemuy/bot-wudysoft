import db from "../../data/db.js";
import {
  metaQuoted
} from "../../lib/quoted.js";
export default {
  name: "groupmanage",
  aliases: ["setgrup", "gset", "gadmin"],
  description: "Pengaturan Lanjutan Grup (Persetujuan Masuk, Mode Tambah Member, Ephemeral, Reset Link)",
  category: "Group",
  example: ".gset approval on/off\n.gset addmode all/admin\n.gset timer 24h/off\n.gset revoke",
  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    const quotedMsg = typeof metaQuoted === "function" ? metaQuoted(ctx) : msg;
    const botName = global.bot?.name || "Wudysoft";
    const footer = global.bot?.footer || `${botName} • Group Security`;
    if (!ctx.isGroup) {
      return ctx.reply("❌ Perintah ini hanya dapat dijalankan di dalam grup.");
    }
    if (!ctx.isAdmin && !ctx.isOwner) {
      return ctx.reply("❌ Perintah ini khusus untuk *Admin Grup* atau *Owner Bot*.");
    }
    if (!ctx.isBotAdmin) {
      return ctx.reply("❌ Jadikan bot sebagai *Admin Grup* terlebih dahulu.");
    }
    const chatId = ctx.chat;
    const args = ctx.args || [];
    const action = (args[0] || "").toLowerCase();
    const value = (args[1] || "").toLowerCase();
    if (action === "approval" || action === "acc") {
      const enable = ["on", "1", "enable", "aktif"].includes(value);
      const disable = ["off", "0", "disable", "mati"].includes(value);
      if (!enable && !disable) {
        return ctx.reply(`Format: \`${prefix}gset approval on/off\``);
      }
      await ctx.react("⏳").catch(() => {});
      try {
        await sock.groupJoinApprovalMode(chatId, enable ? "on" : "off");
        await ctx.react("✅").catch(() => {});
        return ctx.reply(`–  *J O I N  A P P R O V A L*

Mode persetujuan admin untuk anggota baru:
Status: *${enable ? "Diaktifkan (Wajib di-ACC Admin) 🛡️" : "Dinonaktifkan (Bebas Masuk) 🔓"}*`);
      } catch (err) {
        return ctx.reply(`❌ Gagal mengubah persetujuan bergabung: ${err?.message || err}`);
      }
    }
    if (action === "addmode" || action === "invitepermission") {
      const adminOnly = ["admin", "only_admin"].includes(value);
      const allMembers = ["all", "all_member", "semua"].includes(value);
      if (!adminOnly && !allMembers) {
        return ctx.reply(`Format: \`${prefix}gset addmode admin/all\``);
      }
      await ctx.react("⏳").catch(() => {});
      try {
        await sock.groupMemberAddMode(chatId, adminOnly ? "admin_add" : "all_member_add");
        await ctx.react("✅").catch(() => {});
        return ctx.reply(`–  *M E M B E R  A D D  M O D E*

Hak menambah anggota baru disetel ke:
Target: *${adminOnly ? "Hanya Admin Grup 🔒" : "Seluruh Anggota Grup 👥"}*`);
      } catch (err) {
        return ctx.reply(`❌ Gagal menyetel hak tambah anggota: ${err?.message || err}`);
      }
    }
    if (action === "timer" || action === "ephemeral") {
      let seconds = 0;
      if (value === "24h" || value === "1d") seconds = 86400;
      else if (value === "7d") seconds = 604800;
      else if (value === "90d") seconds = 7776e3;
      else if (value === "off" || value === "0") seconds = 0;
      else {
        return ctx.reply(`Pilih durasi pesan sementara:\n\`${prefix}gset timer 24h / 7d / 90d / off\``);
      }
      await ctx.react("⏳").catch(() => {});
      try {
        await sock.groupToggleEphemeral(chatId, seconds);
        await ctx.react("✅").catch(() => {});
        return ctx.reply(`–  *E P H E M E R A L  T I M E R*

Fitur pesan sementara telah disetel ke:
Durasi: *${seconds === 0 ? "Nonaktif" : value.toUpperCase()}*`);
      } catch (err) {
        return ctx.reply(`❌ Gagal menyetel ephemeral: ${err?.message || err}`);
      }
    }
    if (action === "revoke" || action === "resetlink") {
      await ctx.react("⏳").catch(() => {});
      try {
        const newCode = await sock.groupRevokeInvite(chatId);
        await ctx.react("✅").catch(() => {});
        return ctx.reply(`–  *I N V I T E  R E V O K E D*

Tautan undangan grup lama telah ditarik dan diganti baru.
Tautan Baru: https://chat.whatsapp.com/${newCode}`);
      } catch (err) {
        return ctx.reply(`❌ Gagal mereset tautan grup: ${err?.message || err}`);
      }
    }
    const help = `–  *G R O U P  A D V A N C E D*

Setelan perlindungan dan tata kelola grup WhatsApp:

┌  ◦  *Approval Anggota* : \`${prefix}gset approval on/off\`
│  ◦  *Hak Tambah Member* : \`${prefix}gset addmode admin/all\`
│  ◦  *Pesan Sementara* : \`${prefix}gset timer 24h/7d/90d/off\`
└  ◦  *Tarik Tautan Grup* : \`${prefix}gset revoke\`

_${footer}_`;
    return ctx.reply(help);
  }
};