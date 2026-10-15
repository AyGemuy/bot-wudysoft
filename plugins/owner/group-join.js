import {
  simpleQuoted,
  metaQuoted
} from "../../lib/quoted.js";
import db from "../../data/db.js";
const LINK_REGEX = /(?:https?:\/\/)?chat\.whatsapp\.com\/([0-9A-Za-z]{20,24})/i;
export default {
  name: "join",
  aliases: ["joingc", "masuk", "gabung"],
  description: "Memasukkan bot ke dalam grup WhatsApp melalui tautan undangan",
  category: "Owner",
  owner: true,
  execute: async (sock, ctx, msg) => {
    try {
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • Group Manager`;
      const quotedMsg = typeof metaQuoted === "function" ? metaQuoted(ctx) : typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const input = (ctx.args?.[0] || ctx.query || "").trim();
      const match = input.match(LINK_REGEX);
      if (!match) {
        await ctx.react("❓");
        const guideText = `–  *J O I N*

Silakan masukkan tautan undangan grup WhatsApp yang valid.

┌  ◦  *Format* : ${prefix}join <link_grup>
└  ◦  *Example* : ${prefix}join https://chat.whatsapp.com/ABCdefGHIjk123456789`;
        const guideButtons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "📜 Menu Utama",
            id: `${prefix}menu`
          })
        }, {
          name: "cta_copy",
          buttonParamsJson: JSON.stringify({
            display_text: "📋 Salin Format",
            copy_code: `${prefix}join https://chat.whatsapp.com/`
          })
        }];
        if (typeof ctx.sendCta === "function") {
          return await ctx.sendCta(guideText, botFooter, guideButtons, {
            title: `✦ ${botName} • Join Guide ✦`,
            contextInfo: {
              mentionedJid: [ctx.sender],
              isForwarded: true
            },
            quoted: quotedMsg
          });
        }
        return await ctx.reply(guideText, {
          quoted: quotedMsg
        });
      }
      await ctx.react("⏳");
      const inviteCode = match[1];
      let inviteInfo;
      try {
        inviteInfo = await sock.groupGetInviteInfo(inviteCode);
      } catch (err) {
        await ctx.react("❌");
        const errMsg = String(err?.message || "");
        let reason = "Tautan undangan tidak valid atau format salah.";
        if (errMsg.includes("410") || errMsg.includes("gone") || errMsg.includes("expired")) {
          reason = "Tautan undangan sudah kedaluwarsa atau di-reset oleh admin grup.";
        } else if (errMsg.includes("401") || errMsg.includes("not-authorized")) {
          reason = "Bot telah dikeluarkan dan diblokir dari grup tersebut.";
        } else if (errMsg.includes("404")) {
          reason = "Grup tidak ditemukan atau telah dibubarkan.";
        }
        return ctx.reply(`–  *I N V A L I D*

Tautan undangan grup tidak dapat digunakan.

┌  ◦  *Reason* : ${reason}
└  ◦  *Action* : Minta tautan undangan baru dari admin grup`);
      }
      const groupName = inviteInfo?.subject || "Grup WhatsApp";
      const groupJid = inviteInfo?.id ? `${inviteInfo.id}@g.us` : null;
      const memberCount = inviteInfo?.size || inviteInfo?.participants?.length || 0;
      const isApprovalMode = Boolean(inviteInfo?.membershipApprovalMode);
      if (groupJid) {
        const isAlreadyInGroup = Boolean(ctx.db?.group?.[groupJid]) || ctx.isGroup && ctx.id === groupJid;
        if (isAlreadyInGroup) {
          await ctx.react("ℹ️");
          return ctx.reply(`–  *A L R E A D Y  J O I N E D*

Bot sudah terdaftar dan aktif di dalam grup tersebut.

┌  ◦  *Subject* : ${groupName}
│  ◦  *ID* : ${groupJid}
└  ◦  *Members* : ${memberCount} Anggota`);
        }
      }
      try {
        const joinResult = await sock.groupAcceptInvite(inviteCode);
        const resolvedChatId = joinResult || groupJid;
        if (resolvedChatId) {
          if (ctx.db?.group) {
            ctx.db.group[resolvedChatId] = ctx.db.group[resolvedChatId] || {};
            ctx.db.group[resolvedChatId].subject = groupName;
          }
          if (typeof db.ensureGroup === "function") {
            db.ensureGroup(resolvedChatId);
            await db.write?.(global.db).catch(() => {});
          }
          sock.sendMessage(resolvedChatId, {
            text: `Hi everyone!
Terima kasih telah mengundang *${botName}* ke dalam grup *${groupName}*.

–  *I N F O*

┌  ◦  *Prefix* : [ ${prefix} ]
│  ◦  *Menu* : ${prefix}menu
└  ◦  *Status* : Active

Jadikan bot sebagai admin agar fitur proteksi grup berfungsi maksimal.`
          }).catch(() => {});
        }
        const successText = `–  *J O I N E D*

Bot berhasil bergabung ke dalam grup WhatsApp.

┌  ◦  *Subject* : ${groupName}
│  ◦  *ID* : ${resolvedChatId || "Terkoneksi"}
│  ◦  *Members* : ${memberCount} Anggota
└  ◦  *Approval* : ${isApprovalMode ? "Wajib ACC Admin" : "Langsung Masuk"}

Bot telah aktif dan siap digunakan di grup tersebut.`;
        const successButtons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "⚙️ KELOLA SETELAN GRUP",
            sections: [{
              title: `${botName} • Opsi Grup`,
              rows: [{
                title: "📜 Buka Menu Bot",
                description: "Lihat semua perintah",
                id: `${prefix}menu`
              }, {
                title: "⚡ Cek Status Bot",
                description: "Periksa kecepatan respon bot",
                id: `${prefix}ping`
              }]
            }]
          })
        }, {
          name: "cta_url",
          buttonParamsJson: JSON.stringify({
            display_text: "🔗 Buka Tautan Grup",
            url: `https://chat.whatsapp.com/${inviteCode}`,
            merchant_url: `https://chat.whatsapp.com/${inviteCode}`
          })
        }];
        if (typeof ctx.sendCta === "function") {
          await ctx.sendCta(successText, botFooter, successButtons, {
            quoted: quotedMsg,
            contextInfo: {
              mentionedJid: [ctx.sender]
            }
          });
        } else {
          await ctx.reply(successText, {
            quoted: quotedMsg
          });
        }
        await ctx.react("✅");
      } catch (err) {
        const errorMsg = String(err?.message || "");
        if (isApprovalMode || errorMsg.includes("approval") || errorMsg.includes("403")) {
          await ctx.react("📩");
          return ctx.reply(`–  *R E Q U E S T  S E N T*

Permintaan bergabung berhasil dikirim ke grup *${groupName}*.
Grup mengaktifkan mode persetujuan anggota (Approval Mode).`);
        }
        if (errorMsg.includes("409") || errorMsg.includes("already-in-group")) {
          await ctx.react("ℹ️");
          return ctx.reply(`–  *A L R E A D Y  J O I N E D*

Bot sudah berada di dalam grup tersebut.`);
        }
        await ctx.react("❌");
        return ctx.reply(`❌ Gagal bergabung ke grup: ${errorMsg || "Tidak diketahui"}`);
      }
    } catch (e) {
      console.error("[JOIN ERROR]:", e);
      await ctx.react("❌");
      ctx.reply(`❌ Terjadi kesalahan: ${e.message}`);
    }
  }
};