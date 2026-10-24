import {
  metaQuoted,
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "newsletter",
  aliases: ["saluran", "channel", "ch"],
  description: "Manajemen Saluran / Newsletter WhatsApp terlengkap berbasis Baileys 3.0 (Full Docs)",
  category: "Newsletter",
  example: ".ch info <Link/JID>\n.ch post <JID> Teks\n.ch update name <Nama Baru>\n.ch bulkreact ❤️ 10 <MsgID>",
  execute: async (sock, ctx, msg) => {
    try {
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof metaQuoted === "function" ? metaQuoted(ctx) : typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const botMsg = global.bot?.msg || {};
      const botContext = global.bot?.utils?.contextInfo || {};
      const footer = global.bot?.footer || "– Wudysoft • Channel Manager v3.0";
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
      const defaultJid = global.bot?.utils?.newsletterJid || null;
      if (["info", "detail", "cek"].includes(action)) {
        const target = args[1] || ctx.query?.replace(/^(info|detail|cek)\s*/i, "").trim() || defaultJid;
        if (!target) return replyWithContext(`Format: \`${prefix}ch info <Link Saluran / JID @newsletter>\``);
        ctx.react?.("⏳");
        let meta = null;
        if (target.includes("whatsapp.com/channel/")) {
          const code = target.split("/channel/")[1]?.split(/[\/?#]/)[0];
          meta = await sock.newsletterMetadata("invite", code);
        } else if (target.endsWith("@newsletter")) {
          meta = await sock.newsletterMetadata("jid", target);
        }
        if (!meta) throw new Error("Metadata saluran tidak ditemukan.");
        let canPostText = "Tidak";
        try {
          if (typeof sock.newsletterCanPostStatus === "function") {
            const check = await sock.newsletterCanPostStatus(meta.id);
            if (check?.canPost) canPostText = "Ya (Admin/Owner)";
          }
        } catch (_) {}
        ctx.react?.("✅");
        const role = meta.viewer_metadata?.role || "GUEST";
        const isMuted = meta.viewer_metadata?.mute === "YES";
        const text = `–  *N E W S L E T T E R  I N F O*

┌  ◦  *Nama* : ${meta.name}
│  ◦  *JID* : \`${meta.id}\`
│  ◦  *Pengikut* : ${Number(meta.subscribers || 0).toLocaleString("id-ID")} Orang
│  ◦  *Verifikasi* : ${meta.verification === "VERIFIED" ? "Centang Hijau Resmi ✅" : "Standar"}
│  ◦  *Izin Posting* : ${canPostText}
│  ◦  *Peran Bot* : ${role}
│  ◦  *Mute Notif* : ${isMuted ? "Muted 🔕" : "Aktif 🔔"}
└  ◦  *Dibuat Pada* : ${new Date(Number(meta.creation_time) * 1e3).toLocaleDateString("id-ID")}

${meta.description ? `–  *D E S C R I P T I O N*\n${meta.description}\n\n` : ""}🔗 *Link Saluran*: https://whatsapp.com/channel/${meta.invite || "-"}`;
        return replyWithContext(text);
      }
      if (["create", "buat"].includes(action)) {
        if (!ctx.isOwner) return replyWithContext(botMsg.owner || "–  *A C C E S S  D E N I E D*");
        const input = args.slice(1).join(" ");
        const [name, description] = input.split("|").map(s => s?.trim());
        if (!name) return replyWithContext(`Format: \`${prefix}ch create Nama Saluran | Deskripsi Saluran\``);
        ctx.react?.("⏳");
        const res = await sock.newsletterCreate(name, description || "");
        ctx.react?.("✅");
        return replyWithContext(`–  *C H A N N E L  C R E A T E D*

Saluran WhatsApp resmi berhasil dibuat!

┌  ◦  *Nama* : ${res.name}
│  ◦  *JID* : \`${res.id}\`
└  ◦  *Link* : https://whatsapp.com/channel/${res.invite || "-"}`);
      }
      if (["delete", "hapus"].includes(action)) {
        if (!ctx.isOwner) return replyWithContext(botMsg.owner || "–  *A C C E S S  D E N I E D*");
        const targetJid = args[1] || defaultJid;
        if (!targetJid || !targetJid.endsWith("@newsletter")) {
          return replyWithContext(`Format: \`${prefix}ch delete <JID@newsletter>\``);
        }
        ctx.react?.("⏳");
        await sock.newsletterDelete(targetJid);
        ctx.react?.("✅");
        return replyWithContext(`✅ Saluran \`${targetJid}\` telah berhasil dihapus secara permanen.`);
      }
      if (["update", "set"].includes(action)) {
        if (!ctx.isOwner) return replyWithContext(botMsg.owner || "–  *A C C E S S  D E N I E D*");
        const subAction = (args[1] || "").toLowerCase();
        const targetJid = args[2]?.endsWith("@newsletter") ? args[2] : defaultJid;
        const value = (args[2]?.endsWith("@newsletter") ? args.slice(3) : args.slice(2)).join(" ");
        if (!targetJid) return replyWithContext(`❌ Tentukan JID Saluran atau isi \`global.bot.utils.newsletterJid\``);
        ctx.react?.("⏳");
        if (subAction === "name") {
          if (!value) return replyWithContext(`Format: \`${prefix}ch update name [JID] <Nama Baru>\``);
          if (typeof sock.newsletterUpdateName === "function") {
            await sock.newsletterUpdateName(targetJid, value);
          } else {
            await sock.newsletterUpdate(targetJid, {
              name: value
            });
          }
          ctx.react?.("✅");
          return replyWithContext(`✅ Nama saluran berhasil diubah menjadi: *${value}*`);
        }
        if (["desc", "description"].includes(subAction)) {
          if (!value) return replyWithContext(`Format: \`${prefix}ch update desc [JID] <Deskripsi Baru>\``);
          if (typeof sock.newsletterUpdateDescription === "function") {
            await sock.newsletterUpdateDescription(targetJid, value);
          } else {
            await sock.newsletterUpdate(targetJid, {
              description: value
            });
          }
          ctx.react?.("✅");
          return replyWithContext(`✅ Deskripsi saluran berhasil diperbarui.`);
        }
        if (["pic", "picture", "pp", "icon"].includes(subAction)) {
          const target = ctx.quoted && ctx.quoted.isMedia ? ctx.quoted : ctx;
          if (!target.isMedia && !/image/i.test(target.mtype || "")) {
            return replyWithContext("❌ Balas gambar untuk menjadikannya foto profil saluran.");
          }
          const buffer = await target.download().catch(() => null);
          if (!buffer) return replyWithContext("❌ Gagal mengunduh gambar.");
          if (typeof sock.newsletterUpdatePicture === "function") {
            await sock.newsletterUpdatePicture(targetJid, buffer);
          } else {
            await sock.newsletterUpdate(targetJid, {
              picture: buffer
            });
          }
          ctx.react?.("✅");
          return replyWithContext(`✅ Foto profil saluran berhasil diperbarui.`);
        }
        if (["delpic", "removepicture"].includes(subAction)) {
          await sock.newsletterRemovePicture(targetJid);
          ctx.react?.("✅");
          return replyWithContext(`✅ Foto profil saluran berhasil dihapus.`);
        }
        if (["reactions", "reactionmode"].includes(subAction)) {
          const mode = value.toUpperCase();
          if (!["ALL", "BASIC", "NONE", "BLOCKLIST"].includes(mode)) {
            return replyWithContext(`Pilihan mode: \`ALL\` | \`BASIC\` | \`NONE\` | \`BLOCKLIST\``);
          }
          await sock.newsletterUpdateReactions(targetJid, mode);
          ctx.react?.("✅");
          return replyWithContext(`✅ Pengaturan reaksi saluran diubah ke: *${mode}*`);
        }
        return replyWithContext(`Format: \`${prefix}ch update <name|desc|pic|delpic|reactions> [JID] <Value>\``);
      }
      if (["transferowner", "changeowner"].includes(action)) {
        if (!ctx.isOwner) return replyWithContext(botMsg.owner || "–  *A C C E S S  D E N I E D*");
        const newOwner = args[1]?.endsWith("@s.whatsapp.net") ? args[1] : `${args[1]?.replace(/\D/g, "")}@s.whatsapp.net`;
        const targetJid = args[2] || defaultJid;
        if (!newOwner || !targetJid) return replyWithContext(`Format: \`${prefix}ch transferowner <Nomor@s.whatsapp.net> [ChannelJID]\``);
        ctx.react?.("⏳");
        await sock.newsletterChangeOwner(targetJid, newOwner);
        ctx.react?.("✅");
        return replyWithContext(`✅ Kepemilikan saluran berhasil dialihkan kepada @${newOwner.split("@")[0]}`, {
          contextInfo: {
            mentionedJid: [newOwner]
          }
        });
      }
      if (["demote"].includes(action)) {
        if (!ctx.isOwner) return replyWithContext(botMsg.owner || "–  *A C C E S S  D E N I E D*");
        const targetUser = args[1]?.endsWith("@s.whatsapp.net") ? args[1] : `${args[1]?.replace(/\D/g, "")}@s.whatsapp.net`;
        const targetJid = args[2] || defaultJid;
        if (!targetUser || !targetJid) return replyWithContext(`Format: \`${prefix}ch demote <Nomor@s.whatsapp.net> [ChannelJID]\``);
        ctx.react?.("⏳");
        await sock.newsletterDemote(targetJid, targetUser);
        ctx.react?.("✅");
        return replyWithContext(`✅ Status admin @${targetUser.split("@")[0]} berhasil dicabut dari saluran.`, {
          contextInfo: {
            mentionedJid: [targetUser]
          }
        });
      }
      if (["admins", "admininfo"].includes(action)) {
        const targetJid = args[1] || defaultJid;
        if (!targetJid) return replyWithContext(`Format: \`${prefix}ch admins [ChannelJID]\``);
        ctx.react?.("⏳");
        const [count, info, caps] = await Promise.all([sock.newsletterAdminCount?.(targetJid).catch(() => 0), sock.newsletterAdminInfo?.(targetJid).catch(() => null), sock.newsletterAdminCapabilities?.(targetJid).catch(() => null)]);
        ctx.react?.("✅");
        let txt = `–  *A D M I N  I N F O*\n\n`;
        txt += `┌  ◦  *Total Admin* : ${count || info?.adminCount || 0}\n`;
        txt += `│  ◦  *Admin Profile* : ${info?.adminProfile || "-"}\n`;
        txt += `│  ◦  *Profiles Enabled* : ${info?.adminProfilesEnabled ? "Ya ✅" : "Tidak ❌"}\n`;
        txt += `└  ◦  *Capabilities* : ${Array.isArray(caps) ? caps.join(", ") : "-"}`;
        return replyWithContext(txt);
      }
      if (["inviteadmin", "addadmin"].includes(action)) {
        if (!ctx.isOwner) return replyWithContext(botMsg.owner || "–  *A C C E S S  D E N I E D*");
        const targetUser = args[1]?.endsWith("@s.whatsapp.net") ? args[1] : `${args[1]?.replace(/\D/g, "")}@s.whatsapp.net`;
        const targetJid = args[2] || defaultJid;
        if (!targetUser || !targetJid) return replyWithContext(`Format: \`${prefix}ch inviteadmin <Nomor> [ChannelJID]\``);
        ctx.react?.("⏳");
        await sock.newsletterCreateAdminInvite(targetJid, targetUser);
        ctx.react?.("✅");
        return replyWithContext(`✅ Undangan admin berhasil dikirimkan ke @${targetUser.split("@")[0]}`, {
          contextInfo: {
            mentionedJid: [targetUser]
          }
        });
      }
      if (["revokeadmininvite", "cancelinvite"].includes(action)) {
        if (!ctx.isOwner) return replyWithContext(botMsg.owner || "–  *A C C E S S  D E N I E D*");
        const targetUser = args[1]?.endsWith("@s.whatsapp.net") ? args[1] : `${args[1]?.replace(/\D/g, "")}@s.whatsapp.net`;
        const targetJid = args[2] || defaultJid;
        if (!targetUser || !targetJid) return replyWithContext(`Format: \`${prefix}ch revokeadmininvite <Nomor> [ChannelJID]\``);
        ctx.react?.("⏳");
        await sock.newsletterRevokeAdminInvite(targetJid, targetUser);
        ctx.react?.("✅");
        return replyWithContext(`✅ Undangan admin untuk @${targetUser.split("@")[0]} dibatalkan.`, {
          contextInfo: {
            mentionedJid: [targetUser]
          }
        });
      }
      if (["acceptinvite"].includes(action)) {
        const targetJid = args[1] || defaultJid;
        if (!targetJid) return replyWithContext(`Format: \`${prefix}ch acceptinvite <ChannelJID>\``);
        ctx.react?.("⏳");
        await sock.newsletterAcceptAdminInvite(targetJid);
        ctx.react?.("✅");
        return replyWithContext(`✅ Berhasil menerima undangan admin saluran \`${targetJid}\`.`);
      }
      if (["pendinginvites"].includes(action)) {
        const targetJid = args[1] || defaultJid;
        if (!targetJid) return replyWithContext(`Format: \`${prefix}ch pendinginvites [ChannelJID]\``);
        ctx.react?.("⏳");
        const pending = await sock.newsletterPendingAdminInvites(targetJid).catch(() => []);
        ctx.react?.("✅");
        if (!pending?.length) return replyWithContext("ℹ️ Tidak ada undangan admin yang tertunda.");
        let txt = `–  *P E N D I N G  A D M I N  I N V I T E S*\n\n`;
        pending.forEach((p, i) => {
          txt += `┌  ◦  *${i + 1}.* @${p.phoneNumber || p.id}\n└  ◦  *ID* : \`${p.id}\`\n\n`;
        });
        return replyWithContext(txt.trimEnd(), {
          contextInfo: {
            mentionedJid: pending.map(p => p.phoneNumber ? `${p.phoneNumber}@s.whatsapp.net` : p.id)
          }
        });
      }
      if (["post", "send", "publish"].includes(action)) {
        if (!ctx.isOwner) return replyWithContext(botMsg.owner || "–  *A C C E S S  D E N I E D*");
        const channelJid = args[1]?.endsWith("@newsletter") ? args[1] : defaultJid;
        let textContent = (args[1]?.endsWith("@newsletter") ? args.slice(2) : args.slice(1)).join(" ");
        if (!channelJid) return replyWithContext(`Format: \`${prefix}ch post <JID@newsletter> Pesan Kamu\` atau isi default JID.`);
        const isAiContent = textContent.includes("--ai");
        const isQuestion = textContent.includes("--question");
        const noAttr = textContent.includes("--noattr");
        textContent = textContent.replace(/--(ai|question|noattr)/gi, "").trim();
        ctx.react?.("⏳");
        let target = ctx.quoted && ctx.quoted.isMedia ? ctx.quoted : ctx;
        let sent;
        const options = {
          aiContent: isAiContent,
          statusAttribution: !noAttr
        };
        if (target.isMedia || /image|video|audio/i.test(target.mtype || "")) {
          const buffer = await target.download().catch(() => null);
          const type = target.mtype || "";
          if (/image/i.test(type)) {
            sent = await sock.newsletterSendStatus(channelJid, {
              image: buffer,
              caption: textContent,
              question: isQuestion || undefined
            }, options);
          } else if (/video/i.test(type)) {
            sent = await sock.newsletterSendStatus(channelJid, {
              video: buffer,
              caption: textContent
            }, options);
          } else {
            sent = await sock.newsletterSendStatus(channelJid, {
              audio: buffer
            }, options);
          }
        } else {
          if (!textContent) return replyWithContext("❌ Masukkan teks pesan yang ingin diposting ke saluran.");
          sent = await sock.newsletterSendStatus(channelJid, {
            text: textContent
          }, options);
        }
        ctx.react?.("✅");
        const serverId = sent?.newsletterStatusServerId || sent?.key?.id || "-";
        return replyWithContext(`✅ Konten berhasil dipublikasikan!\n*Server ID*: \`${serverId}\`${isAiContent ? "\n*Label*: 🤖 AI-Generated Content" : ""}`);
      }
      if (["revoke", "delpost"].includes(action)) {
        if (!ctx.isOwner) return replyWithContext(botMsg.owner || "–  *A C C E S S  D E N I E D*");
        const statusId = args[1] || ctx.quoted?.id;
        const targetJid = args[2] || defaultJid;
        if (!statusId || !targetJid) return replyWithContext(`Format: \`${prefix}ch revoke <StatusID/ServerID> [ChannelJID]\``);
        ctx.react?.("⏳");
        await sock.newsletterRevokeStatus(targetJid, statusId);
        ctx.react?.("✅");
        return replyWithContext(`✅ Pesan status saluran #${statusId} berhasil ditarik.`);
      }
      if (["follow", "unfollow"].includes(action)) {
        if (!ctx.isOwner) return replyWithContext(botMsg.owner || "–  *A C C E S S  D E N I E D*");
        const jid = args[1] || defaultJid;
        if (!jid || !jid.endsWith("@newsletter")) return replyWithContext(`Format: \`${prefix}ch ${action} <JID_SALURAN@newsletter>\``);
        ctx.react?.("⏳");
        if (action === "follow") await sock.newsletterFollow(jid);
        else await sock.newsletterUnfollow(jid);
        ctx.react?.("✅");
        return replyWithContext(`✅ Berhasil ${action === "follow" ? "mengikuti" : "berhenti mengikuti"} saluran \`${jid}\`.`);
      }
      if (["mychannels", "subscribed", "listch"].includes(action)) {
        ctx.react?.("⏳");
        const subscribed = await sock.newsletterSubscribed?.() || [];
        ctx.react?.("✅");
        if (!subscribed.length) return replyWithContext("❌ Bot belum mengikuti saluran manapun.");
        let txt = `–  *S U B S C R I B E D  C H A N N E L S*\n\n`;
        subscribed.forEach((ch, i) => {
          txt += `┌  ◦  *${i + 1}.* ${ch.name || "Saluran"}\n│  ◦  *JID* : \`${ch.id}\`\n│  ◦  *Peran* : ${ch.viewer_metadata?.role || "SUBSCRIBER"}\n└  ◦  *Link* : https://whatsapp.com/channel/${ch.invite || "-"}\n\n`;
        });
        return replyWithContext(txt.trimEnd());
      }
      if (["liveupdate", "sublive"].includes(action)) {
        const jid = args[1] || defaultJid;
        if (!jid) return replyWithContext(`Format: \`${prefix}ch liveupdate <JID@newsletter>\``);
        ctx.react?.("⏳");
        const sub = await sock.subscribeNewsletterUpdates(jid);
        ctx.react?.("✅");
        return replyWithContext(`✅ Berlangganan pembaruan langsung (Live Updates) untuk saluran \`${jid}\` selama ${sub?.duration || "N/A"} detik.`);
      }
      if (["mute", "unmute"].includes(action)) {
        if (!ctx.isOwner) return replyWithContext(botMsg.owner || "–  *A C C E S S  D E N I E D*");
        const jid = args[1] || defaultJid;
        if (!jid) return replyWithContext(`Format: \`${prefix}ch ${action} <JID@newsletter>\``);
        ctx.react?.("⏳");
        if (action === "mute") await sock.newsletterMute(jid);
        else await sock.newsletterUnmute(jid);
        ctx.react?.("✅");
        return replyWithContext(`✅ Notifikasi saluran \`${jid}\` berhasil di-${action}.`);
      }
      if (["notif", "usersetting"].includes(action)) {
        const type = (args[1] || "").toUpperCase();
        const enable = args[2] === "on" || args[2] === "true";
        const targetJid = args[3] || defaultJid;
        if (!["FOLLOWER_NOTIFICATIONS", "ADMIN_NOTIFICATIONS"].includes(type) || !targetJid) {
          return replyWithContext(`Format: \`${prefix}ch notif <FOLLOWER_NOTIFICATIONS|ADMIN_NOTIFICATIONS> <on/off> [ChannelJID]\``);
        }
        ctx.react?.("⏳");
        await sock.newsletterUpdateUserSetting(targetJid, type, enable);
        ctx.react?.("✅");
        return replyWithContext(`✅ Pengaturan \`${type}\` diubah ke *${enable ? "ON" : "OFF"}* untuk saluran \`${targetJid}\`.`);
      }
      if (["fetchmsg", "messages"].includes(action)) {
        const count = Number(args[1]) || 10;
        const targetJid = args[2] || defaultJid;
        if (!targetJid) return replyWithContext(`Format: \`${prefix}ch messages [Count] [ChannelJID]\``);
        ctx.react?.("⏳");
        const list = await sock.newsletterFetchMessages(targetJid, count);
        ctx.react?.("✅");
        if (!list?.length) return replyWithContext("ℹ️ Tidak ada pesan yang ditemukan.");
        let txt = `–  *L A T E S T  M E S S A G E S*\nTotal: ${list.length}\n\n`;
        list.slice(0, 10).forEach((m, i) => {
          const body = m.message?.conversation || m.message?.extendedTextMessage?.text || "[Media/Lainnya]";
          txt += `┌  ◦  *${i + 1}. ServerID* : \`${m.server_id || m.key?.id}\`\n│  ◦  *Waktu* : ${new Date((m.messageTimestamp || 0) * 1e3).toLocaleString("id-ID")}\n└  ◦  *Pesan* : ${body.slice(0, 60)}\n\n`;
        });
        return replyWithContext(txt.trimEnd());
      }
      if (["fetchstatus", "statuses"].includes(action)) {
        const count = Number(args[1]) || 10;
        const targetJid = args[2] || defaultJid;
        if (!targetJid) return replyWithContext(`Format: \`${prefix}ch statuses [Count] [ChannelJID]\``);
        ctx.react?.("⏳");
        const list = await sock.newsletterFetchStatus(targetJid, {
          count: count
        });
        ctx.react?.("✅");
        if (!list?.length) return replyWithContext("ℹ️ Tidak ada status ditemukan.");
        let txt = `–  *P U B L I S H E D  S T A T U S E S*\n\n`;
        list.forEach((s, i) => {
          txt += `┌  ◦  *${i + 1}. ID* : \`${s.id || s.serverId}\`\n└  ◦  *Views* : ${s.views || 0}\n\n`;
        });
        return replyWithContext(txt.trimEnd());
      }
      if (["react", "bulkreact"].includes(action)) {
        const emoji = args[1];
        const serverMsgId = args[2] || ctx.quoted?.id;
        const targetJid = args[3] || (ctx.id.endsWith("@newsletter") ? ctx.id : defaultJid);
        if (!emoji || !serverMsgId || !targetJid) {
          return replyWithContext(`Format: \`${prefix}ch ${action} <Emoji> <ServerID> [ChannelJID]\`\nContoh Bulk: \`${prefix}ch bulkreact ❤️,🔥 20 <MsgID>\``);
        }
        ctx.react?.("⏳");
        if (action === "bulkreact" && typeof sock.newsletterBulkReactions === "function") {
          const emojis = emoji.includes(",") ? emoji.split(",").map(e => e.trim()) : emoji;
          const count = Number(args[2]) || 10;
          const realServerId = args[3] || ctx.quoted?.id;
          const finalJid = args[4] || targetJid;
          await sock.newsletterBulkReactions(finalJid, realServerId, emojis, count);
        } else {
          await sock.newsletterReactMessage(targetJid, serverMsgId, emoji === "null" ? null : emoji);
        }
        ctx.react?.("✅");
        return replyWithContext(`✅ Reaksi ${emoji} berhasil diproses ke pesan #${serverMsgId}.`);
      }
      if (["reactstatus"].includes(action)) {
        const emoji = args[1];
        const serverId = args[2] || ctx.quoted?.id;
        const targetJid = args[3] || defaultJid;
        if (!emoji || !serverId || !targetJid) return replyWithContext(`Format: \`${prefix}ch reactstatus <Emoji/null> <ServerID> [ChannelJID]\``);
        ctx.react?.("⏳");
        await sock.newsletterReactStatus(targetJid, serverId, emoji === "null" ? null : emoji);
        ctx.react?.("✅");
        return replyWithContext(`✅ Reaksi status saluran berhasil diperbarui.`);
      }
      if (["reactsenders"].includes(action)) {
        const serverId = args[1] || ctx.quoted?.id;
        const targetJid = args[2] || defaultJid;
        if (!serverId || !targetJid) return replyWithContext(`Format: \`${prefix}ch reactsenders <ServerID> [ChannelJID]\``);
        ctx.react?.("⏳");
        const senders = await sock.newsletterReactionSenders(targetJid, serverId).catch(() => []);
        ctx.react?.("✅");
        if (!senders?.length) return replyWithContext("ℹ️ Belum ada pengirim reaksi pada pesan ini.");
        let txt = `–  *R E A C T I O N  S E N D E R S*\n\n`;
        senders.forEach((s, i) => {
          txt += `┌  ◦  *${i + 1}.* @${s.id?.split("@")[0] || s.phoneNumber}\n└  ◦  *Emoji* : ${s.reaction || "-"}\n\n`;
        });
        return replyWithContext(txt.trimEnd(), {
          contextInfo: {
            mentionedJid: senders.map(s => s.id).filter(Boolean)
          }
        });
      }
      if (["pin", "unpin"].includes(action)) {
        if (!ctx.isOwner) return replyWithContext(botMsg.owner || "–  *A C C E S S  D E N I E D*");
        const serverId = args[1] || ctx.quoted?.id;
        const targetJid = args[2] || (ctx.id.endsWith("@newsletter") ? ctx.id : defaultJid);
        if (!serverId || !targetJid) return replyWithContext(`Format: \`${prefix}ch ${action} <ServerID> [ChannelJID]\``);
        ctx.react?.("⏳");
        if (action === "pin") await sock.newsletterPinMessages(targetJid, serverId);
        else await sock.newsletterUnpinMessages(targetJid, serverId);
        ctx.react?.("✅");
        return replyWithContext(`✅ Pesan saluran #${serverId} berhasil di-${action}.`);
      }
      if (["labelai", "labelad"].includes(action)) {
        if (!ctx.isOwner) return replyWithContext(botMsg.owner || "–  *A C C E S S  D E N I E D*");
        const serverId = args[1] || ctx.quoted?.id;
        const targetJid = args[2] || defaultJid;
        if (!serverId || !targetJid) return replyWithContext(`Format: \`${prefix}ch ${action} <ServerID> [ChannelJID]\``);
        ctx.react?.("⏳");
        if (action === "labelai") await sock.newsletterLabelAiContent(targetJid, serverId);
        else await sock.newsletterLabelPaidPartnership(targetJid, serverId);
        ctx.react?.("✅");
        return replyWithContext(`✅ Label ${action === "labelai" ? "AI Content" : "Paid Partnership"} berhasil disematkan.`);
      }
      if (["pollvote", "vote"].includes(action)) {
        const option = args[1];
        const serverId = args[2] || ctx.quoted?.id;
        const targetJid = args[3] || defaultJid;
        if (!option || !serverId || !targetJid) return replyWithContext(`Format: \`${prefix}ch vote <NamaOpsi> <ServerID> [ChannelJID]\``);
        ctx.react?.("⏳");
        const options = option.includes(",") ? option.split(",").map(o => o.trim()) : option;
        await sock.newsletterSendPollVote(targetJid, serverId, options);
        ctx.react?.("✅");
        return replyWithContext(`✅ Vote "${option}" berhasil dikirim ke polling saluran.`);
      }
      if (["pollvoters"].includes(action)) {
        const serverId = args[1] || ctx.quoted?.id;
        const targetJid = args[2] || defaultJid;
        if (!serverId || !targetJid) return replyWithContext(`Format: \`${prefix}ch pollvoters <ServerID> [ChannelJID]\``);
        ctx.react?.("⏳");
        const voters = await sock.newsletterPollVoters(targetJid, serverId, {
          limit: 100
        }).catch(() => []);
        ctx.react?.("✅");
        if (!voters?.length) return replyWithContext("ℹ️ Belum ada voter pada polling ini.");
        let txt = `–  *P O L L  V O T E R S*\n\n`;
        voters.slice(0, 20).forEach((v, i) => {
          txt += `┌  ◦  *${i + 1}.* @${v.id?.split("@")[0] || v.phoneNumber}\n└  ◦  *Pilihan* : ${v.option || "-"}\n\n`;
        });
        return replyWithContext(txt.trimEnd());
      }
      if (["responses", "questionanswers"].includes(action)) {
        const serverId = args[1] || ctx.quoted?.id;
        const targetJid = args[2] || defaultJid;
        if (!serverId || !targetJid) return replyWithContext(`Format: \`${prefix}ch responses <ServerID> [ChannelJID]\``);
        ctx.react?.("⏳");
        const responses = await sock.newsletterQuestionResponses(targetJid, serverId, {
          count: 20
        }).catch(() => []);
        ctx.react?.("✅");
        if (!responses?.length) return replyWithContext("ℹ️ Belum ada respon untuk pertanyaan ini.");
        let txt = `–  *Q U E S T I O N  R E S P O N S E S*\n\n`;
        responses.forEach((r, i) => {
          txt += `┌  ◦  *${i + 1}. ID* : \`${r.serverId || r.id}\`\n│  ◦  *Dari* : ${r.author || "User"}\n└  ◦  *Respon* : ${r.text || "-"}\n\n`;
        });
        return replyWithContext(txt.trimEnd());
      }
      if (["subscribers", "subs"].includes(action)) {
        const targetJid = args[1] || defaultJid;
        if (!targetJid) return replyWithContext(`Format: \`${prefix}ch subscribers <ChannelJID>\``);
        ctx.react?.("⏳");
        const subs = await sock.newsletterSubscribers?.(targetJid).catch(() => []);
        ctx.react?.("✅");
        if (!subs?.length) return replyWithContext("ℹ️ Tidak ada daftar subscriber publik yang dapat diakses.");
        let text = `–  *C H A N N E L  S U B S C R I B E R S*\nTotal terbaca: ${subs.length}\n\n`;
        subs.slice(0, 15).forEach((s, i) => {
          text += `┌  ◦  *${i + 1}.* ${s.displayName || s.id}\n└  ◦  *Role* : ${s.role || "Member"}\n`;
        });
        return replyWithContext(text.trimEnd());
      }
      if (["followers"].includes(action)) {
        const targetJid = args[1] || defaultJid;
        const count = Number(args[2]) || 50;
        if (!targetJid) return replyWithContext(`Format: \`${prefix}ch followers <ChannelJID> [Count]\``);
        ctx.react?.("⏳");
        const list = await sock.newsletterFollowers?.(targetJid, {
          count: count
        }).catch(() => []);
        ctx.react?.("✅");
        if (!list?.length) return replyWithContext("ℹ️ Tidak ada pengikut publik yang ditemukan.");
        let text = `–  *C H A N N E L  F O L L O W E R S*\nTotal: ${list.length}\n\n`;
        list.slice(0, 15).forEach((f, i) => {
          text += `┌  ◦  *${i + 1}.* ${f.displayName || f.phoneNumber || f.id}\n└  ◦  *Waktu Ikut* : ${new Date((f.followTime || 0) * 1e3).toLocaleDateString("id-ID")}\n`;
        });
        return replyWithContext(text.trimEnd());
      }
      if (["myaddons"].includes(action)) {
        ctx.react?.("⏳");
        const [generalAddons, statusAddons] = await Promise.all([sock.newsletterMyAddOns?.().catch(() => null), sock.newsletterStatusMyAddOns?.().catch(() => null)]);
        ctx.react?.("✅");
        return replyWithContext(`–  *M Y  A D D - O N S*

┌  ◦  *Reaksi/Vote Saluran* : ${Array.isArray(generalAddons) ? generalAddons.length : 0} item
└  ◦  *Reaksi Status* : ${Array.isArray(statusAddons) ? statusAddons.length : 0} item`);
      }
      if (["insights", "analitik"].includes(action)) {
        const targetJid = args[1] || defaultJid;
        if (!targetJid) return replyWithContext(`Format: \`${prefix}ch insights <ChannelJID>\``);
        ctx.react?.("⏳");
        const data = await sock.newsletterInsights?.(targetJid).catch(() => null);
        ctx.react?.("✅");
        if (!data) return replyWithContext("❌ Gagal mengambil data wawasan saluran (hanya tersedia untuk admin/owner).");
        return replyWithContext(`–  *C H A N N E L  I N S I G H T S*

┌  ◦  *Net Follows* : ${data.netFollows || 0}
│  ◦  *Unfollows* : ${data.unfollows || 0}
│  ◦  *Impressions* : ${data.impressions || 0}
└  ◦  *Views* : ${data.views || 0}`);
      }
      if (["enforcements", "pelanggaran"].includes(action)) {
        const targetJid = args[1] || defaultJid;
        if (!targetJid) return replyWithContext(`Format: \`${prefix}ch enforcements <ChannelJID>\``);
        ctx.react?.("⏳");
        const enf = await sock.newsletterEnforcements(targetJid).catch(() => null);
        ctx.react?.("✅");
        if (!enf) return replyWithContext("✅ Tidak ada data pelanggaran atau pembatasan pada saluran ini.");
        return replyWithContext(`–  *E N F O R C E M E N T S*

┌  ◦  *Admin Profiles* : ${enf.adminProfiles || "Aman"}
│  ◦  *Hapus Foto Profil* : ${enf.profilePictureDeletions ? "Ya ⚠️" : "Tidak"}
│  ◦  *Suspensi* : ${enf.suspensions || "Tidak Ada"}
│  ◦  *Pesan Melanggar* : ${Array.isArray(enf.violatingMessages) ? enf.violatingMessages.length : 0} Pesan
└  ◦  *Geo-Suspensions* : ${enf.geoSuspensions || "None"}`);
      }
      if (["reports"].includes(action)) {
        if (!ctx.isOwner) return replyWithContext(botMsg.owner || "–  *A C C E S S  D E N I E D*");
        ctx.react?.("⏳");
        const reports = await sock.newsletterReports().catch(() => []);
        ctx.react?.("✅");
        if (!reports?.length) return replyWithContext("✅ Tidak ada laporan aktif pada saluran Anda.");
        let txt = `–  *C H A N N E L  R E P O R T S*\n\n`;
        reports.forEach((r, i) => {
          txt += `┌  ◦  *${i + 1}. Report ID* : \`${r.id || r.reportId}\`\n└  ◦  *Alasan* : ${r.reason || "-"}\n\n`;
        });
        return replyWithContext(txt.trimEnd());
      }
      if (["appeal"].includes(action)) {
        if (!ctx.isOwner) return replyWithContext(botMsg.owner || "–  *A C C E S S  D E N I E D*");
        const reportId = args[1];
        const reason = args.slice(2).join(" ");
        if (!reportId || !reason) return replyWithContext(`Format: \`${prefix}ch appeal <ReportID> <Alasan Banding>\``);
        ctx.react?.("⏳");
        await sock.newsletterAppealReport(reportId, reason);
        ctx.react?.("✅");
        return replyWithContext(`✅ Banding atas laporan #${reportId} telah dikirimkan.`);
      }
      if (["search", "cari"].includes(action)) {
        const q = args.slice(1).join(" ");
        if (!q) return replyWithContext(`Format: \`${prefix}ch search <Kata Kunci>\``);
        ctx.react?.("⏳");
        const results = await sock.newsletterDirectorySearch(q, {
          limit: 10
        }).catch(() => []);
        ctx.react?.("✅");
        if (!results.length) return replyWithContext("❌ Tidak ditemukan saluran yang cocok.");
        let txt = `–  *S E A R C H  R E S U L T S*\n\n`;
        results.forEach((ch, i) => {
          txt += `┌  ◦  *${i + 1}.* ${ch.name}\n│  ◦  *Followers* : ${Number(ch.subscribers || 0).toLocaleString("id-ID")}\n└  ◦  *Link* : https://whatsapp.com/channel/${ch.invite}\n\n`;
        });
        return replyWithContext(txt.trimEnd());
      }
      if (["recommended", "rekomendasi"].includes(action)) {
        ctx.react?.("⏳");
        const rec = await sock.newsletterRecommended?.({
          limit: 10
        }).catch(() => []);
        ctx.react?.("✅");
        if (!rec.length) return replyWithContext("❌ Belum ada saluran yang direkomendasikan.");
        let txt = `–  *R E C O M M E N D E D  C H A N N E L S*\n\n`;
        rec.forEach((ch, i) => {
          txt += `┌  ◦  *${i + 1}.* ${ch.name}\n│  ◦  *Followers* : ${Number(ch.subscribers || 0).toLocaleString("id-ID")}\n└  ◦  *Link* : https://whatsapp.com/channel/${ch.invite}\n\n`;
        });
        return replyWithContext(txt.trimEnd());
      }
      if (["directory"].includes(action)) {
        ctx.react?.("⏳");
        const directory = await sock.newsletterDirectoryList?.({
          view: "RECOMMENDED",
          limit: 10
        }).catch(() => []);
        ctx.react?.("✅");
        if (!directory?.length) return replyWithContext("❌ Gagal memuat direktori saluran.");
        let txt = `–  *D I R E C T O R Y  L I S T*\n\n`;
        directory.forEach((ch, i) => {
          txt += `┌  ◦  *${i + 1}.* ${ch.name}\n│  ◦  *JID* : \`${ch.id}\`\n└  ◦  *Link* : https://whatsapp.com/channel/${ch.invite}\n\n`;
        });
        return replyWithContext(txt.trimEnd());
      }
      if (["categories"].includes(action)) {
        ctx.react?.("⏳");
        const cats = await sock.newsletterDirectoryCategories?.({
          perCategoryLimit: 5
        }).catch(() => []);
        ctx.react?.("✅");
        if (!cats?.length) return replyWithContext("❌ Gagal memuat kategori direktori.");
        let txt = `–  *D I R E C T O R Y  C A T E G O R I E S*\n\n`;
        cats.forEach((c, i) => {
          txt += `┌  ◦  *${i + 1}. Kategori* : *${c.category || c.name}*\n└  ◦  *Total Channels* : ${c.channels?.length || 0}\n\n`;
        });
        return replyWithContext(txt.trimEnd());
      }
      if (["similar"].includes(action)) {
        const targetJid = args[1] || defaultJid;
        if (!targetJid) return replyWithContext(`Format: \`${prefix}ch similar <ChannelJID>\``);
        ctx.react?.("⏳");
        const similar = await sock.newsletterSimilar?.(targetJid, {
          limit: 10
        }).catch(() => []);
        ctx.react?.("✅");
        if (!similar?.length) return replyWithContext("❌ Tidak ada saluran serupa yang ditemukan.");
        let txt = `–  *S I M I L A R  C H A N N E L S*\n\n`;
        similar.forEach((ch, i) => {
          txt += `┌  ◦  *${i + 1}.* ${ch.name}\n└  ◦  *Link* : https://whatsapp.com/channel/${ch.invite}\n\n`;
        });
        return replyWithContext(txt.trimEnd());
      }
      const helpMenu = `–  *N E W S L E T T E R  M A N A G E R  3.0*

Kelola Saluran WhatsApp langsung dengan Baileys 3.0 Full Suite.

┌  ◦  *Info Saluran* : \`${prefix}ch info <Link/JID>\`
│  ◦  *Buat / Hapus* : \`${prefix}ch create | delete\`
│  ◦  *Edit Saluran* : \`${prefix}ch update <name|desc|pic|delpic|reactions>\`
│  ◦  *Owner & Demote* : \`${prefix}ch transferowner | demote\`
│  ◦  *Kelola Admin* : \`${prefix}ch admins | inviteadmin | cancelinvite | acceptinvite\`
│  ◦  *Posting Saluran* : \`${prefix}ch post [JID] <Teks> [--ai|--question|--noattr]\`
│  ◦  *Tarik Pesan* : \`${prefix}ch revoke <MsgID> [JID]\`
│  ◦  *Follow / Sub* : \`${prefix}ch follow | unfollow | mychannels | liveupdate\`
│  ◦  *Notifikasi* : \`${prefix}ch mute | unmute | notif <ADMIN|FOLLOWER> <on/off>\`
│  ◦  *Pesan & Status* : \`${prefix}ch messages | statuses | reactstatus\`
│  ◦  *Reaksi Pesan* : \`${prefix}ch react | bulkreact | reactsenders\`
│  ◦  *Semat / Label* : \`${prefix}ch pin | unpin | labelai | labelad\`
│  ◦  *Polling & Tanya* : \`${prefix}ch vote | pollvoters | responses\`
│  ◦  *Pengikut* : \`${prefix}ch subscribers | followers\`
│  ◦  *Statistik & Addon* : \`${prefix}ch insights | myaddons\`
│  ◦  *Moderasi & Banding* : \`${prefix}ch enforcements | reports | appeal\`
└  ◦  *Eksplorasi* : \`${prefix}ch search | recommended | directory | categories | similar\`

_${footer}_`;
      return replyWithContext(helpMenu);
    } catch (err) {
      console.error("[NEWSLETTER Error]:", err);
      ctx.react?.("❌");
      ctx.reply(`❌ Gagal: ${err?.message || err}`);
    }
  }
};