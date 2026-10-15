import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "groupinfo",
  aliases: ["ginfo", "infogrup", "infogroup", "gcinfo"],
  description: "Menampilkan informasi detail grup lengkap dengan banner dan tombol salin link",
  category: "Group",
  example: "groupinfo (di dalam grup) atau groupinfo https://chat.whatsapp.com/xxx",
  execute: async (sock, ctx, msg) => {
    try {
      await ctx.react("⏳");
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • Group Intelligence`;
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      let targetJid = ctx.id;
      let inviteCode = "";
      let inviteInfo = null;
      const inputArg = (ctx.args?.[0] || "").trim();
      if (inputArg) {
        if (inputArg.includes("chat.whatsapp.com/")) {
          inviteCode = inputArg.split("chat.whatsapp.com/")[1]?.split(/[\s?]/)[0] || "";
        } else if (inputArg.endsWith("@g.us")) {
          targetJid = inputArg;
        }
      }
      if (!inviteCode && !targetJid.endsWith("@g.us")) {
        await ctx.react("❌");
        return ctx.reply(`–  *G R O U P  I N F O*

Perintah ini hanya dapat digunakan di dalam grup atau dengan menyertakan link/JID grup.

┌  ◦  *Format* : ${prefix}ginfo <link/jid>
└  ◦  *Example* : ${prefix}ginfo https://chat.whatsapp.com/GoHmb4noThh92L8FFf79Bh`);
      }
      let metadata = null;
      let groupPp = null;
      if (inviteCode) {
        try {
          inviteInfo = await sock.groupGetInviteInfo(inviteCode);
          if (inviteInfo?.id) targetJid = inviteInfo.id;
        } catch (e) {}
      }
      if (targetJid.endsWith("@g.us")) {
        try {
          metadata = await sock.groupMetadata(targetJid);
        } catch (e) {}
        if (!inviteCode) {
          try {
            inviteCode = await sock.groupInviteCode(targetJid);
            if (!inviteInfo && inviteCode) {
              inviteInfo = await sock.groupGetInviteInfo(inviteCode).catch(() => null);
            }
          } catch (e) {}
        }
        try {
          groupPp = await sock.profilePictureUrl(targetJid, "image");
        } catch (e) {
          groupPp = global.bot?.media?.banner1 || global.bot?.media?.banner2 || "https://files.catbox.moe/nurea0.jpg";
        }
      }
      const info = inviteInfo || metadata;
      if (!info) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal memuat informasi grup. Pastikan tautan atau ID grup valid.");
      }
      const subject = info.subject || metadata?.subject || "Tidak Diketahui";
      const groupId = info.id || targetJid;
      const memberCount = info.size || metadata?.participants?.length || 0;
      const participants = metadata?.participants || info.participants || [];
      const adminCount = participants.filter(p => p.admin === "admin" || p.admin === "superadmin").length;
      const rawOwner = info.ownerPn || info.owner || metadata?.owner || "-";
      const ownerNumber = rawOwner.split("@")[0].replace(/[^0-9]/g, "");
      const ownerText = ownerNumber ? `+${ownerNumber}` : "-";
      const creationTimestamp = info.creation || metadata?.creation;
      const createdDate = creationTimestamp ? new Date(creationTimestamp * 1e3).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric"
      }) : "-";
      const isRestricted = info.restrict ?? metadata?.restrict ?? false;
      const isAnnounce = info.announce ?? metadata?.announce ?? false;
      const isApproval = info.joinApprovalMode ?? metadata?.joinApprovalMode ?? false;
      const isCommunity = info.isCommunity ?? metadata?.isCommunity ?? false;
      const groupDesc = (info.desc || metadata?.desc || "Tidak ada deskripsi grup.").trim();
      const groupLink = inviteCode ? `https://chat.whatsapp.com/${inviteCode}` : "";
      const bodyText = `–  *G R O U P*

┌  ◦  *Subject* : ${subject}
│  ◦  *ID* : ${groupId}
│  ◦  *Owner* : ${ownerText}
│  ◦  *Members* : ${memberCount} Anggota
│  ◦  *Admins* : ${adminCount || "-"} Admin
│  ◦  *Created* : ${createdDate}
└  ◦  *Type* : ${isCommunity ? "Komunitas" : "Standar"}

–  *S E T T I N G S*

┌  ◦  *Edit Info* : ${isRestricted ? "Hanya Admin" : "Semua Anggota"}
│  ◦  *Send Messages* : ${isAnnounce ? "Hanya Admin" : "Semua Anggota"}
└  ◦  *Approval Mode* : ${isApproval ? "Aktif" : "Nonaktif"}

–  *D E S C R I P T I O N*

${groupDesc}`;
      const buttons = [];
      if (groupLink) {
        buttons.push({
          name: "cta_copy",
          buttonParamsJson: JSON.stringify({
            display_text: "🔗 Salin Link Grup",
            copy_code: groupLink
          })
        });
      }
      buttons.push({
        name: "cta_copy",
        buttonParamsJson: JSON.stringify({
          display_text: "📋 Salin ID Grup",
          copy_code: groupId
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🏠 Menu Utama",
          id: `${prefix}menu`
        })
      });
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, botFooter, buttons, {
          title: `✦ Group Info • ${subject} ✦`,
          subtitle: `Members: ${memberCount}`,
          media: groupPp,
          quoted: quotedMsg
        });
      } else if (groupPp) {
        await sock.sendMessage(ctx.id, {
          image: {
            url: groupPp
          },
          caption: bodyText
        }, {
          quoted: quotedMsg
        });
      } else {
        await sock.sendMessage(ctx.id, {
          text: bodyText
        }, {
          quoted: quotedMsg
        });
      }
      await ctx.react("✅");
    } catch (error) {
      console.error("[GroupInfo Error]:", error);
      await ctx.react("❌");
      ctx.reply(`❌ Terjadi kesalahan saat mengambil info grup: ${error.message}`);
    }
  }
};