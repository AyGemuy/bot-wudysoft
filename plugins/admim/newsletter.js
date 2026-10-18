import {
  metaQuoted,
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "newsletter",
  aliases: ["saluran", "channel", "ch"],
  description: "Manajemen Saluran / Newsletter WhatsApp lengkap berbasis Baileys 3.0 (Full Docs)",
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
          if (typeof sock.newsletterRemovePicture === "function") {
            await sock.newsletterRemovePicture(targetJid);
            ctx.react?.("✅");
            return replyWithContext(`✅ Foto profil saluran berhasil dihapus.`);
          }
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
      if (["post", "send", "publish"].includes(action)) {
        if (!ctx.isOwner) return replyWithContext(botMsg.owner || "–  *A C C E S S  D E N I E D*");
        const channelJid = args[1]?.endsWith("@newsletter") ? args[1] : defaultJid;
        let textContent = (args[1]?.endsWith("@newsletter") ? args.slice(2) : args.slice(1)).join(" ");
        if (!channelJid) return replyWithContext(`Format: \`${prefix}ch post <JID@newsletter> Pesan Kamu\` atau isi default JID.`);
        const isAiContent = textContent.includes("--ai");
        textContent = textContent.replace(/--ai/gi, "").trim();
        ctx.react?.("⏳");
        let target = ctx.quoted && ctx.quoted.isMedia ? ctx.quoted : ctx;
        let sent;
        const options = isAiContent ? {
          aiContent: true
        } : {};
        if (target.isMedia || /image|video|audio/i.test(target.mtype || "")) {
          const buffer = await target.download().catch(() => null);
          const type = target.mtype || "";
          if (/image/i.test(type)) {
            sent = await sock.newsletterSendStatus(channelJid, {
              image: buffer,
              caption: textContent
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
      if (["pin", "unpin"].includes(action)) {
        if (!ctx.isOwner) return replyWithContext(botMsg.owner || "–  *A C C E S S  D E N I E D*");
        const serverId = args[1] || ctx.quoted?.id;
        const targetJid = args[2] || (ctx.id.endsWith("@newsletter") ? ctx.id : defaultJid);
        if (!serverId || !targetJid) return replyWithContext(`Format: \`${prefix}ch ${action} <ServerID> [ChannelJID]\``);
        ctx.react?.("⏳");
        if (action === "pin") await sock.newsletterPinMessages(targetJid, serverId);
        else await sock.newsletterUnpinMessages(targetJid, serverId);
        ctx.react?.("✅");
        return replyWithContext(`✅ Pesan saluran berhasil di-${action}.`);
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
        await sock.newsletterSendPollVote(targetJid, serverId, option);
        ctx.react?.("✅");
        return replyWithContext(`✅ Vote "${option}" berhasil dikirim ke polling saluran.`);
      }
      if (["subscribers", "followers"].includes(action)) {
        const targetJid = args[1] || defaultJid;
        if (!targetJid) return replyWithContext(`Format: \`${prefix}ch subscribers <ChannelJID>\``);
        ctx.react?.("⏳");
        const subs = await sock.newsletterSubscribers?.(targetJid).catch(() => []);
        ctx.react?.("✅");
        if (!subs.length) return replyWithContext("ℹ️ Tidak ada daftar subscriber publik yang dapat diakses.");
        let text = `–  *C H A N N E L  S U B S C R I B E R S*\nTotal terbaca: ${subs.length}\n\n`;
        subs.slice(0, 15).forEach((s, i) => {
          text += `┌  ◦  *${i + 1}.* ${s.displayName || s.id}\n└  ◦  *Role* : ${s.role || "Member"}\n`;
        });
        return replyWithContext(text.trimEnd());
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
      const helpMenu = `–  *N E W S L E T T E R  M A N A G E R  3.0*

Kelola Saluran WhatsApp langsung melalui fitur engine Baileys 3.0.

┌  ◦  *Info Saluran* : \`${prefix}ch info <Link/JID>\`
│  ◦  *Cari Saluran* : \`${prefix}ch search <Kata Kunci>\`
│  ◦  *Rekomendasi* : \`${prefix}ch recommended\`
│  ◦  *Saluran Saya* : \`${prefix}ch mychannels\`
│  ◦  *Buat Saluran* : \`${prefix}ch create Nama | Deskripsi\`
│  ◦  *Hapus Saluran* : \`${prefix}ch delete [JID]\`
│  ◦  *Posting Saluran* : \`${prefix}ch post [JID] <Teks> [--ai]\`
│  ◦  *Tarik Pesan* : \`${prefix}ch revoke <MsgID> [JID]\`
│  ◦  *Edit Info* : \`${prefix}ch update <name|desc|pic|delpic|reactions>\`
│  ◦  *Follow / Unfollow* : \`${prefix}ch follow/unfollow <JID>\`
│  ◦  *Mute / Unmute* : \`${prefix}ch mute/unmute [JID]\`
│  ◦  *Reaksi Tunggal* : \`${prefix}ch react <Emoji> <MsgID>\`
│  ◦  *Bulk Reaction* : \`${prefix}ch bulkreact <Emoji> <Jumlah> <MsgID>\`
│  ◦  *Pin / Unpin* : \`${prefix}ch pin/unpin <MsgID>\`
│  ◦  *Label AI / Ad* : \`${prefix}ch labelai/labelad <MsgID>\`
│  ◦  *Vote Polling* : \`${prefix}ch vote <Opsi> <MsgID>\`
│  ◦  *Subscribers* : \`${prefix}ch subscribers [JID]\`
└  ◦  *Wawasan / Analitik* : \`${prefix}ch insights [JID]\`

_${footer}_`;
      return replyWithContext(helpMenu);
    } catch (err) {
      console.error("[NEWSLETTER Error]:", err);
      ctx.react?.("❌");
      ctx.reply(`❌ Gagal: ${err?.message || err}`);
    }
  }
};