import {
  metaQuoted,
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "groupmanage",
  aliases: ["setgrup", "gset", "gadmin", "groupsecurity"],
  description: "Pengaturan lanjutan grup WhatsApp (Approval, Add Mode, Ephemeral, Revoke V4, Accept Invite)",
  category: "Group",
  example: ".gset approval on/off\n.gset addmode all/admin\n.gset timer 24h/off\n.gset revokev4 @user",
  execute: async (sock, ctx, msg) => {
    try {
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof metaQuoted === "function" ? metaQuoted(ctx) : typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const botMsg = global.bot?.msg || {};
      const botContext = global.bot?.utils?.contextInfo || {};
      const footer = global.bot?.footer || "– Wudysoft • Multi-Device";
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
      const value = (args[1] || "").toLowerCase();
      if (action === "join" || action === "accept") {
        if (!ctx.isOwner) return replyWithContext(botMsg.owner || "–  *A C C E S S  D E N I E D*");
        let code = args[1] || "";
        if (code.includes("chat.whatsapp.com/")) {
          code = code.split("chat.whatsapp.com/")[1]?.split(/[\/?#]/)[0];
        }
        if (!code) return replyWithContext(`Format: \`${prefix}gset join <InviteCode / Link Grup>\``);
        ctx.react?.("⏳");
        try {
          if (typeof sock.groupAcceptInvite === "function") {
            await sock.groupAcceptInvite(code);
          } else if (typeof sock.aiGroupAcceptInvite === "function") {
            await sock.aiGroupAcceptInvite(code);
          }
          ctx.react?.("✅");
          return replyWithContext("✅ Berhasil bergabung ke grup melalui kode undangan.");
        } catch (err) {
          ctx.react?.("❌");
          return replyWithContext(`❌ Gagal bergabung ke grup: ${err?.message || err}`);
        }
      }
      if (!ctx.isGroup) {
        if (typeof ctx.react === "function") await ctx.react("❌");
        return ctx.reply(botMsg.group || "–  *G R O U P  O N L Y*");
      }
      if (!ctx.isAdmin && !ctx.isOwner) {
        if (typeof ctx.react === "function") await ctx.react("🚫");
        return ctx.reply(botMsg.admin || "–  *A D M I N  O N L Y*");
      }
      if (!ctx.isBotAdmin) {
        if (typeof ctx.react === "function") await ctx.react("❌");
        return ctx.reply(botMsg.botAdmin || "–  *B O T  N O T  A D M I N*");
      }
      const chatId = ctx.id || ctx.chat;
      if (action === "approval" || action === "acc") {
        const enable = ["on", "1", "enable", "aktif"].includes(value);
        const disable = ["off", "0", "disable", "mati"].includes(value);
        if (!enable && !disable) {
          return replyWithContext(`Format: \`${prefix}gset approval on/off\``);
        }
        ctx.react?.("⏳");
        await sock.groupJoinApprovalMode(chatId, enable ? "on" : "off");
        ctx.react?.("✅");
        return replyWithContext(`–  *J O I N  A P P R O V A L*

Mode persetujuan admin untuk anggota baru:
Status: *${enable ? "Diaktifkan (Wajib di-ACC Admin) 🛡️" : "Dinonaktifkan (Bebas Masuk) 🔓"}*`);
      }
      if (action === "addmode" || action === "invitepermission") {
        const adminOnly = ["admin", "only_admin"].includes(value);
        const allMembers = ["all", "all_member", "semua"].includes(value);
        if (!adminOnly && !allMembers) {
          return replyWithContext(`Format: \`${prefix}gset addmode admin/all\``);
        }
        ctx.react?.("⏳");
        await sock.groupMemberAddMode(chatId, adminOnly ? "admin_add" : "all_member_add");
        ctx.react?.("✅");
        return replyWithContext(`–  *M E M B E R  A D D  M O D E*

Hak menambah anggota baru disetel ke:
Target: *${adminOnly ? "Hanya Admin Grup 🔒" : "Seluruh Anggota Grup 👥"}*`);
      }
      if (action === "timer" || action === "ephemeral") {
        let seconds = 0;
        if (value === "24h" || value === "1d") seconds = 86400;
        else if (value === "7d") seconds = 604800;
        else if (value === "90d") seconds = 7776e3;
        else if (value === "off" || value === "0") seconds = 0;
        else {
          return replyWithContext(`Pilih durasi pesan sementara:\n\`${prefix}gset timer 24h / 7d / 90d / off\``);
        }
        ctx.react?.("⏳");
        try {
          if (typeof sock.groupToggleEphemeral === "function") {
            await sock.groupToggleEphemeral(chatId, seconds);
          } else if (typeof sock.aiGroupToggleEphemeral === "function") {
            await sock.aiGroupToggleEphemeral(chatId, seconds);
          }
        } catch (_) {
          await sock.sendMessage(chatId, {
            disappearingMessagesInChat: seconds || false
          });
        }
        ctx.react?.("✅");
        return replyWithContext(`–  *E P H E M E R A L  T I M E R*

Fitur pesan sementara telah disetel ke:
Durasi: *${seconds === 0 ? "Nonaktif" : value.toUpperCase()}*`);
      }
      if (action === "revoke" || action === "resetlink") {
        ctx.react?.("⏳");
        let newCode = "";
        try {
          newCode = await sock.groupRevokeInvite(chatId);
        } catch {
          newCode = await sock.aiGroupRevokeInvite(chatId);
        }
        ctx.react?.("✅");
        return replyWithContext(`–  *I N V I T E  R E V O K E D*

Tautan undangan grup lama telah ditarik dan diganti baru.
Tautan Baru: https://chat.whatsapp.com/${newCode || await sock.groupInviteCode(chatId)}`);
      }
      if (action === "revokev4" || action === "cancelinvite") {
        let target = ctx.quoted?.sender || ctx.mentionedJid && ctx.mentionedJid[0];
        if (!target && args[1]) {
          target = args[1].replace(/[^0-9]/g, "") + "@s.whatsapp.net";
        }
        if (!target) return replyWithContext(`Tag atau reply user yang ingin ditarik undangan khususnya:\n\`${prefix}gset revokev4 @user\``);
        ctx.react?.("⏳");
        if (typeof sock.groupRevokeInviteV4 === "function") {
          await sock.groupRevokeInviteV4(chatId, target);
        }
        ctx.react?.("✅");
        return replyWithContext(`✅ Berhasil membatalkan undangan tertunda untuk @${target.split("@")[0]}.`, {
          contextInfo: {
            mentionedJid: [target]
          }
        });
      }
      const help = `–  *G R O U P  A D V A N C E D*

Setelan perlindungan dan tata kelola grup WhatsApp:

┌  ◦  *Approval Anggota* : \`${prefix}gset approval on/off\`
│  ◦  *Hak Tambah Member* : \`${prefix}gset addmode admin/all\`
│  ◦  *Pesan Sementara* : \`${prefix}gset timer 24h/7d/90d/off\`
│  ◦  *Tarik Tautan Grup* : \`${prefix}gset revoke\`
│  ◦  *Batal Undangan V4* : \`${prefix}gset revokev4 @user\`
└  ◦  *Masuk Grup* : \`${prefix}gset join <link/code>\`

_${footer}_`;
      return replyWithContext(help);
    } catch (error) {
      console.error("[GROUPMANAGE Error]:", error);
      ctx.react?.("❌");
      ctx.reply(`❌ Terjadi kesalahan: ${error?.message || error}`);
    }
  }
};