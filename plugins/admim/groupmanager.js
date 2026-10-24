import {
  metaQuoted,
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "groupmanage",
  aliases: ["setgrup", "gset", "gadmin", "groupsecurity", "grup"],
  description: "Manajemen lanjutan grup WhatsApp & Meta AI Group berbasis Baileys 3.0 Full Docs",
  category: "Group",
  example: ".gset approval on/off\n.gset chat open/close\n.gset addbot\n.gset kick @user\n.gset link",
  execute: async (sock, ctx, msg) => {
    try {
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof metaQuoted === "function" ? metaQuoted(ctx) : typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const botMsg = global.bot?.msg || {};
      const botContext = global.bot?.utils?.contextInfo || {};
      const footer = global.bot?.footer || "– Wudysoft • Multi-Device v3.0";
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
      const getTargetUsers = () => {
        const users = [];
        if (ctx.mentionedJid && ctx.mentionedJid.length > 0) {
          users.push(...ctx.mentionedJid);
        }
        if (ctx.quoted?.sender) {
          users.push(ctx.quoted.sender);
        }
        const textArgs = args.slice(1).join(" ");
        const numbers = textArgs.match(/\b\d{7,16}\b/g) || [];
        for (const num of numbers) {
          const jid = `${num}@s.whatsapp.net`;
          if (!users.includes(jid)) users.push(jid);
        }
        return [...new Set(users)];
      };
      if (["join", "accept"].includes(action)) {
        if (!ctx.isOwner) return replyWithContext(botMsg.owner || "–  *A C C E S S  D E N I E D*");
        let code = args[1] || "";
        if (code.includes("chat.whatsapp.com/")) {
          code = code.split("chat.whatsapp.com/")[1]?.split(/[\/?#]/)[0];
        }
        if (!code) return replyWithContext(`Format: \`${prefix}gset join <Link/Kode Undangan>\``);
        ctx.react?.("⏳");
        try {
          if (typeof sock.groupAcceptInvite === "function") {
            await sock.groupAcceptInvite(code);
          } else if (typeof sock.aiGroupAcceptInvite === "function") {
            await sock.aiGroupAcceptInvite(code);
          }
          ctx.react?.("✅");
          return replyWithContext("✅ Berhasil bergabung ke grup melalui undangan.");
        } catch (err) {
          ctx.react?.("❌");
          return replyWithContext(`❌ Gagal bergabung: ${err?.message || err}`);
        }
      }
      if (["create", "creategroup", "buatgrup"].includes(action)) {
        if (!ctx.isOwner) return replyWithContext(botMsg.owner || "–  *A C C E S S  D E N I E D*");
        const title = args.slice(1).join(" ").trim();
        if (!title) return replyWithContext(`Format: \`${prefix}gset create <Nama Grup>\``);
        ctx.react?.("⏳");
        const targetMembers = [ctx.sender || ctx.user?.jid].filter(Boolean);
        const res = await sock.groupCreate(title, targetMembers);
        ctx.react?.("✅");
        return replyWithContext(`–  *G R O U P  C R E A T E D*

Grup WhatsApp berhasil dibuat!
┌  ◦  *Nama* : ${res.subject || title}
└  ◦  *JID* : \`${res.id}\``);
      }
      if (["createai", "buataigrup"].includes(action)) {
        if (!ctx.isOwner) return replyWithContext(botMsg.owner || "–  *A C C E S S  D E N I E D*");
        const title = args.slice(1).join(" ").trim();
        if (!title) return replyWithContext(`Format: \`${prefix}gset createai <Nama AI Grup>\``);
        ctx.react?.("⏳");
        const targetMembers = [ctx.sender || ctx.user?.jid].filter(Boolean);
        const res = await sock.aiGroupCreate(title, targetMembers);
        ctx.react?.("✅");
        return replyWithContext(`–  *A I  G R O U P  C R E A T E D*

Grup Meta AI resmi berhasil dibuat!
┌  ◦  *Nama* : ${res.subject || title}
└  ◦  *JID* : \`${res.id}\``);
      }
      if (!ctx.isGroup) {
        ctx.react?.("❌");
        return replyWithContext(botMsg.group || "–  *G R O U P  O N L Y*");
      }
      if (!ctx.isAdmin && !ctx.isOwner) {
        ctx.react?.("🚫");
        return replyWithContext(botMsg.admin || "–  *A D M I N  O N L Y*");
      }
      if (!ctx.isBotAdmin) {
        ctx.react?.("❌");
        return replyWithContext(botMsg.botAdmin || "–  *B O T  N O T  A D M I N*");
      }
      const chatId = ctx.id || ctx.chat;
      const isAiGroupChat = async () => {
        try {
          if (typeof sock.aiGroupMetadata === "function") {
            const meta = await sock.aiGroupMetadata(chatId).catch(() => null);
            return Boolean(meta?.isAiGroup);
          }
        } catch (_) {}
        return false;
      };
      if (["addbot", "metaai", "tambahbot"].includes(action)) {
        ctx.react?.("⏳");
        try {
          await sock.aiGroupAddBot(chatId);
          ctx.react?.("✅");
          return replyWithContext("✅ Bot Meta AI resmi berhasil dimasukkan ke dalam grup ini!");
        } catch (err) {
          ctx.react?.("❌");
          return replyWithContext(`❌ Gagal menambahkan Meta AI Bot: ${err?.message || "Fitur ini hanya didukung pada tipe grup AI"}`);
        }
      }
      if (["chat", "pesan"].includes(action)) {
        const isClose = ["close", "tutup", "admin"].includes(value);
        const isOpen = ["open", "buka", "all"].includes(value);
        if (!isClose && !isOpen) {
          return replyWithContext(`Format: \`${prefix}gset chat open/close\``);
        }
        ctx.react?.("⏳");
        const mode = isClose ? "announcement" : "not_announcement";
        try {
          await sock.groupSettingUpdate(chatId, mode);
        } catch {
          await sock.aiGroupSettingUpdate?.(chatId, mode);
        }
        ctx.react?.("✅");
        return replyWithContext(`–  *G R O U P  C H A T  M O D E*

Izin pengiriman pesan grup disetel ke:
Mode: *${isClose ? "Hanya Admin (Grup Ditutup) 🔒" : "Seluruh Anggota (Grup Dibuka) 🔓"}*`);
      }
      if (["infoedit", "editinfo", "lock", "unlock"].includes(action)) {
        const isLock = action === "lock" || ["lock", "kunci", "admin"].includes(value);
        const isUnlock = action === "unlock" || ["unlock", "buka", "all"].includes(value);
        if (!isLock && !isUnlock) {
          return replyWithContext(`Format: \`${prefix}gset lock\` atau \`${prefix}gset unlock\``);
        }
        ctx.react?.("⏳");
        const mode = isLock ? "locked" : "unlocked";
        try {
          await sock.groupSettingUpdate(chatId, mode);
        } catch {
          await sock.aiGroupSettingUpdate?.(chatId, mode);
        }
        ctx.react?.("✅");
        return replyWithContext(`–  *E D I T  I N F O  P E R M I S S I O N*

Izin mengubah identitas / info grup disetel ke:
Hak: *${isLock ? "Hanya Admin 🔒" : "Seluruh Anggota 👥"}*`);
      }
      if (["name", "subject", "judul"].includes(action)) {
        const newName = args.slice(1).join(" ").trim();
        if (!newName) return replyWithContext(`Format: \`${prefix}gset subject <Nama Grup Baru>\``);
        ctx.react?.("⏳");
        try {
          await sock.groupUpdateSubject(chatId, newName);
        } catch {
          await sock.aiGroupUpdateSubject?.(chatId, newName);
        }
        ctx.react?.("✅");
        return replyWithContext(`✅ Nama grup berhasil diubah menjadi:\n*${newName}*`);
      }
      if (["desc", "deskripsi"].includes(action)) {
        const newDesc = args.slice(1).join(" ").trim();
        ctx.react?.("⏳");
        await sock.groupUpdateDescription(chatId, newDesc || "");
        ctx.react?.("✅");
        return replyWithContext(newDesc ? `✅ Deskripsi grup berhasil diperbarui!` : `✅ Deskripsi grup telah dikosongkan.`);
      }
      if (["add", "tambah"].includes(action)) {
        const targets = getTargetUsers();
        if (!targets.length) return replyWithContext(`Format: \`${prefix}gset add <Nomor / Tag>\``);
        ctx.react?.("⏳");
        let res;
        try {
          res = await sock.groupParticipantsUpdate(chatId, targets, "add");
        } catch {
          res = await sock.aiGroupParticipantsUpdate?.(chatId, targets, "add");
        }
        ctx.react?.("✅");
        return replyWithContext(`✅ Berhasil memproses penambahan ${targets.length} anggota.`);
      }
      if (["kick", "remove", "tendang"].includes(action)) {
        const targets = getTargetUsers();
        if (!targets.length) return replyWithContext(`Format: \`${prefix}gset kick <@user / reply / nomor>\``);
        ctx.react?.("⏳");
        try {
          await sock.groupParticipantsUpdate(chatId, targets, "remove");
        } catch {
          await sock.aiGroupParticipantsUpdate?.(chatId, targets, "remove");
        }
        ctx.react?.("✅");
        return replyWithContext(`✅ Berhasil mengeluarkan target dari grup.`);
      }
      if (["promote", "admin"].includes(action)) {
        const targets = getTargetUsers();
        if (!targets.length) return replyWithContext(`Format: \`${prefix}gset promote <@user / reply>\``);
        ctx.react?.("⏳");
        try {
          await sock.groupParticipantsUpdate(chatId, targets, "promote");
        } catch {
          await sock.aiGroupParticipantsUpdate?.(chatId, targets, "promote");
        }
        ctx.react?.("✅");
        return replyWithContext(`✅ Pengguna terpilih kini resmi menjadi Admin grup.`);
      }
      if (["demote", "unadmin"].includes(action)) {
        const targets = getTargetUsers();
        if (!targets.length) return replyWithContext(`Format: \`${prefix}gset demote <@user / reply>\``);
        ctx.react?.("⏳");
        try {
          await sock.groupParticipantsUpdate(chatId, targets, "demote");
        } catch {
          await sock.aiGroupParticipantsUpdate?.(chatId, targets, "demote");
        }
        ctx.react?.("✅");
        return replyWithContext(`✅ Jabatan admin pengguna terpilih berhasil dicabut.`);
      }
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
      if (["link", "invitelink", "tautan"].includes(action)) {
        ctx.react?.("⏳");
        let code = "";
        try {
          code = await sock.groupInviteCode(chatId);
        } catch {
          code = await sock.aiGroupInviteCode?.(chatId);
        }
        ctx.react?.("✅");
        return replyWithContext(`–  *I N V I T E  L I N K*\n\nTautan undangan grup:\nhttps://chat.whatsapp.com/${code}`);
      }
      if (action === "revoke" || action === "resetlink") {
        ctx.react?.("⏳");
        let newCode = "";
        try {
          newCode = await sock.groupRevokeInvite(chatId);
        } catch {
          newCode = await sock.aiGroupRevokeInvite?.(chatId);
        }
        ctx.react?.("✅");
        return replyWithContext(`–  *I N V I T E  R E V O K E D*

Tautan undangan lama telah ditarik.
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
      if (["info", "metadata", "detail"].includes(action)) {
        ctx.react?.("⏳");
        let meta = null;
        try {
          meta = await sock.groupMetadata(chatId);
        } catch {
          meta = await sock.aiGroupMetadata?.(chatId);
        }
        ctx.react?.("✅");
        if (!meta) return replyWithContext("❌ Gagal mengambil metadata grup.");
        const text = `–  *G R O U P  M E T A D A T A*

┌  ◦  *Nama Grup* : ${meta.subject}
│  ◦  *ID Grup* : \`${meta.id}\`
│  ◦  *Pembuat* : @${meta.owner ? meta.owner.split("@")[0] : "-"}
│  ◦  *Total Anggota* : ${meta.participants?.length || 0} Member
│  ◦  *Mode Chat* : ${meta.announce ? "Hanya Admin 🔒" : "Semua Member 🔓"}
│  ◦  *Edit Info* : ${meta.restrict ? "Hanya Admin 🔒" : "Semua Member 🔓"}
│  ◦  *Join Approval* : ${meta.joinApprovalMode ? "Aktif 🛡️" : "Nonaktif 🔓"}
└  ◦  *Dibuat Pada* : ${new Date((meta.creation || 0) * 1e3).toLocaleDateString("id-ID")}

${meta.desc ? `–  *D E S K R I P S I*\n${meta.desc}` : ""}`;
        return replyWithContext(text, {
          contextInfo: {
            mentionedJid: [meta.owner].filter(Boolean)
          }
        });
      }
      if (["leave", "out", "keluar"].includes(action)) {
        if (!ctx.isOwner) return replyWithContext(botMsg.owner || "–  *A C C E S S  D E N I E D*");
        await replyWithContext("👋 Selamat tinggal semua! Bot pamit undur diri.");
        try {
          await sock.groupLeave(chatId);
        } catch {
          await sock.aiGroupLeave?.(chatId);
        }
        return;
      }
      const help = `–  *G R O U P  M A N A G E M E N T  3.0*

Pengaturan lengkap grup WhatsApp standar & Meta AI Group:

┌  ◦  *Buka / Tutup Chat* : \`${prefix}gset chat open/close\`
│  ◦  *Kunci / Buka Info* : \`${prefix}gset lock\` / \`${prefix}gset unlock\`
│  ◦  *Nama & Deskripsi* : \`${prefix}gset subject <Nama>\` | \`${prefix}gset desc <Teks>\`
│  ◦  *Member Management* : \`${prefix}gset add | kick | promote | demote <@user>\`
│  ◦  *Approval Anggota* : \`${prefix}gset approval on/off\`
│  ◦  *Hak Tambah Member* : \`${prefix}gset addmode admin/all\`
│  ◦  *Pesan Sementara* : \`${prefix}gset timer 24h/7d/90d/off\`
│  ◦  *Tautan Grup* : \`${prefix}gset link\` | \`${prefix}gset revoke\`
│  ◦  *Batal Undangan V4* : \`${prefix}gset revokev4 @user\`
│  ◦  *Meta AI Group* : \`${prefix}gset createai <Nama>\` | \`${prefix}gset addbot\`
│  ◦  *Info Grup* : \`${prefix}gset info\`
└  ◦  *Keluar / Join* : \`${prefix}gset join <link>\` | \`${prefix}gset leave\`

_${footer}_`;
      return replyWithContext(help);
    } catch (error) {
      console.error("[GROUPMANAGE Error]:", error);
      ctx.react?.("❌");
      ctx.reply(`❌ Terjadi kesalahan: ${error?.message || error}`);
    }
  }
};