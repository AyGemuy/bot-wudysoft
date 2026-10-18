import {
  simpleQuoted,
  metaQuoted
} from "../../lib/quoted.js";

function resolveTargetUser(ctx, msg) {
  let target = null;
  if (ctx.quoted?.sender) {
    target = ctx.quoted.sender;
  } else if (msg.message?.extendedTextMessage?.contextInfo?.participant) {
    target = msg.message.extendedTextMessage.contextInfo.participant;
  } else if (ctx.mentionedJid && ctx.mentionedJid.length > 0) {
    target = ctx.mentionedJid[0];
  } else if (ctx.args && ctx.args.length > 0) {
    const rawNumber = ctx.args.join(" ").replace(/[^0-9]/g, "");
    if (rawNumber.length >= 7 && rawNumber.length <= 16) {
      target = `${rawNumber}@s.whatsapp.net`;
    }
  }
  return target;
}
export default {
  name: "user",
  aliases: ["profile", "checkwa", "checkstatus", "bio", "setbio", "setnamebot", "ppbot", "delppbot", "block", "unblock", "blocklist", "privacy", "setprivacy", "username", "setusername", "delusername", "findusername", "suggestusername", "bizprofile", "reportuser", "reportspam", "setpin"],
  description: "Manajemen identitas WhatsApp, username v2, profiling, dan integrity check akun",
  category: "User",
  example: ".profile @user | .checkstatus 628xxx | .username set <nama> [pin]",
  execute: async (sock, ctx, msg) => {
    try {
      const prefix = ctx.prefix || ".";
      const cmd = (ctx.cmd || ctx.command || "").toLowerCase();
      const botMsg = global.bot?.msg || {};
      const botContext = global.bot?.utils?.contextInfo || {};
      const quotedMsg = typeof metaQuoted === "function" ? metaQuoted(ctx) : typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
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
      if (["checkwa", "checkstatus"].includes(cmd)) {
        const query = (ctx.query || ctx.args?.join("") || "").replace(/[^0-9]/g, "");
        if (!query) {
          return replyWithContext(`–  *C H E C K  N U M B E R*\n\nMasukkan nomor WhatsApp yang ingin dicek.\n\n┌  ◦  *Contoh* : \`${prefix + cmd} 6281234567890\``);
        }
        ctx.react?.("⏳");
        let statusResult = null;
        if (typeof sock.checkStatusWA === "function") {
          statusResult = await sock.checkStatusWA(query).catch(() => null);
        }
        const [existsResult] = await sock.onWhatsApp(query).catch(() => []) || [];
        ctx.react?.("✅");
        let resText = `–  *W H A T S A P P  S T A T U S*\n\n`;
        resText += `┌  ◦  *Nomor* : +${query}\n`;
        resText += `│  ◦  *Terdaftar* : ${existsResult?.exists ? "Ya (Aktif di WhatsApp) ✅" : "Tidak Terdaftar ❌"}\n`;
        if (existsResult?.jid) {
          resText += `│  ◦  *JID Akun* : \`${existsResult.jid}\`\n`;
        }
        if (statusResult) {
          const isBanned = statusResult.isBanned || statusResult.status === "banned";
          resText += `│  ◦  *Server State* : \`${(statusResult.status || "active").toUpperCase()}\`\n`;
          resText += `│  ◦  *Status Akun* : ${isBanned ? "Terblokir / Banned ⚠️" : "Normal & Aman 🟢"}\n`;
          if (statusResult.isNeedOfficialWa) {
            resText += `│  ◦  *Screen State* : Blocked Custom Screen (Wajib WhatsApp Resmi 📲)\n`;
          }
          if (statusResult.banInfo) {
            const b = statusResult.banInfo;
            resText += `│\n│  *Detail Pelanggaran & Banding* :\n`;
            resText += `│  ◦  *Tipe Ban* : ${b.banType ? b.banType.toUpperCase() : "PERMANENT"}\n`;
            resText += `│  ◦  *Alasan* : ${b.violationReason || b.violationType || "-"}\n`;
            resText += `│  ◦  *Dapat Banding* : ${b.canAppeal ? "Ya (Bisa Diajukan) ✅" : "Tidak (Permanen) ❌"}\n`;
            if (b.appealToken) resText += `│  ◦  *Appeal Token* : \`${b.appealToken}\`\n`;
            if (b.appealStatus) resText += `│  ◦  *Status Banding* : \`${b.appealStatus}\`\n`;
            if (b.banDate) resText += `│  ◦  *Waktu Banned* : ${new Date(b.banDate).toLocaleString("id-ID")}\n`;
          }
        }
        resText += `└  ◦  *Audited By* : ${global.bot?.name || "Wudysoft Intelligence"}`;
        return replyWithContext(resText);
      }
      if (["profile", "user", "bizprofile"].includes(cmd)) {
        const target = resolveTargetUser(ctx, msg) || ctx.sender;
        ctx.react?.("⏳");
        const numOnly = target.split("@")[0].replace(/[^0-9]/g, "");
        const ppUrl = await sock.profilePictureUrl(target, "image").catch(() => null);
        const bioData = await sock.fetchStatus(target).catch(() => null);
        const bizData = await sock.getBusinessProfile(target).catch(() => null);
        ctx.react?.("✅");
        let body = `–  *U S E R  P R O F I L E*\n\n`;
        body += `┌  ◦  *Pengguna* : @${numOnly}\n`;
        body += `│  ◦  *JID* : \`${target}\`\n`;
        body += `│  ◦  *About / Bio* : ${bioData?.status || "Tidak ada status"}\n`;
        body += `│  ◦  *Diperbarui* : ${bioData?.setAt ? new Date(bioData.setAt).toLocaleString("id-ID") : "-"}\n`;
        if (bizData) {
          body += `│\n│  *Informasi Bisnis Resmi* :\n`;
          body += `│  ◦  *Kategori* : ${bizData.category || "-"}\n`;
          body += `│  ◦  *Email* : ${bizData.email || "-"}\n`;
          body += `│  ◦  *Website* : ${bizData.website?.[0] || "-"}\n`;
          body += `│  ◦  *Deskripsi* : ${bizData.description || "-"}\n`;
        }
        body += `└  ◦  *Tipe Akun* : ${bizData ? "WhatsApp Business 💼" : "Personal User 👤"}`;
        if (ppUrl) {
          return await sock.sendMessage(ctx.id, {
            image: {
              url: ppUrl
            },
            caption: body,
            mentions: [target],
            contextInfo: {
              ...botContext,
              mentionedJid: [target]
            }
          }, {
            quoted: quotedMsg
          });
        }
        return replyWithContext(body, {
          contextInfo: {
            mentionedJid: [target]
          }
        });
      }
      if (["username", "setusername", "delusername", "findusername", "suggestusername", "setpin"].includes(cmd)) {
        const sub = (ctx.args?.[0] || "").toLowerCase();
        if (!sub || sub === "my" || cmd === "username" && !ctx.args?.length) {
          ctx.react?.("⏳");
          const myUname = typeof sock.getMyUsername === "function" ? await sock.getMyUsername().catch(() => null) : null;
          ctx.react?.("✅");
          return replyWithContext(`–  *M Y  U S E R N A M E*\n\n┌  ◦  *Bot Username* : ${myUname ? `@${myUname}` : "_Belum disetel_"}\n└  ◦  *Ketik* : \`${prefix}username set <nama> [pin]\` untuk mendaftar.`);
        }
        if (sub === "check") {
          const targetUname = ctx.args[1];
          if (!targetUname) return replyWithContext(`Contoh: \`${prefix}username check zervonex\``);
          ctx.react?.("⏳");
          const res = typeof sock.checkUsername === "function" ? await sock.checkUsername(targetUname).catch(() => null) : null;
          ctx.react?.("✅");
          if (!res) return replyWithContext("❌ Gagal memeriksa ketersediaan username.");
          return replyWithContext(`–  *U S E R N A M E  C H E C K*\n\n┌  ◦  *Username* : @${targetUname}\n└  ◦  *Status* : ${res.available ? "Tersedia ✅" : "Sudah Digunakan ❌"}${res.suggestions?.length ? `\n\n*Saran Alternatif* : ${res.suggestions.join(", ")}` : ""}`);
        }
        if (sub === "checkmulti" || sub === "multi") {
          const list = ctx.args.slice(1).join(" ").split(",").map(s => s.trim().replace(/^@/, "")).filter(Boolean);
          if (!list.length) return replyWithContext(`Contoh: \`${prefix}username checkmulti wudybot, zervonex, luna\``);
          ctx.react?.("⏳");
          let results = [];
          if (typeof sock.checkUsernameMulti === "function") {
            results = await sock.checkUsernameMulti(list).catch(() => []);
          } else {
            for (const item of list) {
              const r = await sock.checkUsername?.(item).catch(() => null);
              results.push({
                username: item,
                available: r?.available ?? false
              });
            }
          }
          ctx.react?.("✅");
          let txt = `–  *M U L T I  U S E R N A M E  C H E C K*\n\n`;
          results.forEach((r, i) => {
            txt += `┌  ◦  *${i + 1}.* @${r.username}\n└  ◦  *Status* : ${r.available ? "Tersedia ✅" : "Terpakai ❌"}\n\n`;
          });
          return replyWithContext(txt.trimEnd());
        }
        if (sub === "find" || cmd === "findusername") {
          const targetUname = (cmd === "findusername" ? ctx.args[0] : ctx.args[1])?.replace(/^@/, "");
          const targetPin = (cmd === "findusername" ? ctx.args[1] : ctx.args[2]) || undefined;
          if (!targetUname) return replyWithContext(`Contoh: \`${prefix}username find zervonex [PIN]\``);
          ctx.react?.("⏳");
          const found = typeof sock.findUserByUsername === "function" ? await sock.findUserByUsername(targetUname, targetPin).catch(() => null) : null;
          ctx.react?.("✅");
          if (!found) return replyWithContext(`❌ Pengguna dengan username *@${targetUname}* tidak ditemukan atau PIN salah.`);
          return replyWithContext(`–  *F I N D  U S E R*\n\n┌  ◦  *Username* : @${targetUname}\n│  ◦  *JID Ditemukan* : \`${found.jid || found.id}\`\n└  ◦  *Kontak Valid* : ${found.contact ? "Ya ✅" : "Bukan Kontak ❌"}`);
        }
        if (sub === "suggest" || cmd === "suggestusername") {
          ctx.react?.("⏳");
          const suggs = typeof sock.getUsernameRecommendations === "function" ? await sock.getUsernameRecommendations().catch(() => []) : [];
          ctx.react?.("✅");
          if (!suggs.length) return replyWithContext("❌ Tidak ada saran username yang tersedia dari WhatsApp.");
          return replyWithContext(`–  *U S E R N A M E  I D E A S*\n\n${suggs.map((s, i) => `┌  ◦  *${i + 1}.* @${s}`).join("\n")}\n\n_Pilih salah satu nama di atas untuk akun Anda._`);
        }
        if (sub === "set" || cmd === "setusername") {
          if (!ctx.isOwner) return replyWithContext(botMsg.owner || "–  *A C C E S S  D E N I E D*");
          const newUname = (cmd === "setusername" ? ctx.args[0] : ctx.args[1])?.replace(/^@/, "");
          const pin = (cmd === "setusername" ? ctx.args[1] : ctx.args[2]) || null;
          if (!newUname) return replyWithContext(`Contoh: \`${prefix}username set zervonex 1234\``);
          ctx.react?.("⏳");
          if (typeof sock.checkAndSetUsername === "function" && !pin) {
            await sock.checkAndSetUsername(newUname);
          } else if (typeof sock.setUsername === "function") {
            await sock.setUsername(newUname, pin ? {
              pin: pin
            } : undefined);
          } else {
            return replyWithContext("❌ Fungsi setUsername tidak tersedia di socket Baileys ini.");
          }
          ctx.react?.("✅");
          return replyWithContext(`✅ Username bot berhasil diubah menjadi *@${newUname}*${pin ? ` (PIN Keamanan: ${pin})` : ""}`);
        }
        if (sub === "pin" || cmd === "setpin") {
          if (!ctx.isOwner) return replyWithContext(botMsg.owner || "–  *A C C E S S  D E N I E D*");
          const pinVal = cmd === "setpin" ? ctx.args[0] : ctx.args[1];
          if (!pinVal) return replyWithContext(`Contoh: \`${prefix}username pin 1234\``);
          ctx.react?.("⏳");
          if (typeof sock.setUsernamePin === "function") {
            await sock.setUsernamePin(pinVal);
            ctx.react?.("✅");
            return replyWithContext(`✅ PIN keamanan untuk username bot berhasil disetel ke: *${pinVal}*`);
          }
          return replyWithContext("❌ Fungsi setUsernamePin tidak didukung.");
        }
        if (sub === "del" || cmd === "delusername") {
          if (!ctx.isOwner) return replyWithContext(botMsg.owner || "–  *A C C E S S  D E N I E D*");
          ctx.react?.("⏳");
          if (typeof sock.deleteUsername === "function") {
            await sock.deleteUsername();
            ctx.react?.("✅");
            return replyWithContext("✅ Username bot berhasil dihapus dari server WhatsApp.");
          }
          return replyWithContext("❌ Fungsi deleteUsername tidak didukung.");
        }
      }
      if (cmd === "setbio" || cmd === "bio") {
        if (!ctx.isOwner) return replyWithContext(botMsg.owner || "–  *A C C E S S  D E N I E D*");
        const newBio = ctx.args?.join(" ");
        if (!newBio) return replyWithContext(`Contoh: \`${prefix + cmd} Available 24/7\``);
        ctx.react?.("⏳");
        if (typeof sock.updateTextStatus === "function") {
          await sock.updateTextStatus(newBio, "⚡");
        } else {
          await sock.updateProfileStatus(newBio);
        }
        ctx.react?.("✅");
        return replyWithContext(`✅ Status bio bot berhasil diperbarui menjadi:\n"${newBio}"`);
      }
      if (cmd === "setnamebot") {
        if (!ctx.isOwner) return replyWithContext(botMsg.owner || "–  *A C C E S S  D E N I E D*");
        const newName = ctx.args?.join(" ");
        if (!newName) return replyWithContext(`Contoh: \`${prefix + cmd} Zervonex Bot\``);
        ctx.react?.("⏳");
        await sock.updateProfileName(newName);
        ctx.react?.("✅");
        return replyWithContext(`✅ Nama profil bot berhasil diperbarui menjadi: *${newName}*`);
      }
      if (cmd === "ppbot") {
        if (!ctx.isOwner) return replyWithContext(botMsg.owner || "–  *A C C E S S  D E N I E D*");
        const target = ctx.quoted && ctx.quoted.isMedia ? ctx.quoted : ctx;
        if (!target.isMedia && !/image/i.test(target.mtype || "")) {
          return replyWithContext(`–  *S E T  P R O F I L E  P I C T U R E*\n\nKirim atau balas gambar dengan perintah \`${prefix}ppbot\``);
        }
        ctx.react?.("⏳");
        const buffer = await target.download().catch(() => null);
        if (!Buffer.isBuffer(buffer)) {
          ctx.react?.("❌");
          return replyWithContext("❌ Gagal mengunduh gambar.");
        }
        await sock.updateProfilePicture(sock.user.id, buffer);
        ctx.react?.("✅");
        return replyWithContext("✅ Foto profil bot berhasil diperbarui (HD Quality).");
      }
      if (cmd === "delppbot") {
        if (!ctx.isOwner) return replyWithContext(botMsg.owner || "–  *A C C E S S  D E N I E D*");
        ctx.react?.("⏳");
        await sock.removeProfilePicture(sock.user.id);
        ctx.react?.("✅");
        return replyWithContext("✅ Foto profil bot berhasil dihapus.");
      }
      if (cmd === "block" || cmd === "unblock") {
        if (!ctx.isOwner) return replyWithContext(botMsg.owner || "–  *A C C E S S  D E N I E D*");
        const target = resolveTargetUser(ctx, msg);
        if (!target) return replyWithContext(`Tag atau reply nomor yang ingin di-${cmd}.`);
        ctx.react?.("⏳");
        await sock.updateBlockStatus(target, cmd === "block" ? "block" : "unblock");
        ctx.react?.("✅");
        return replyWithContext(`✅ Berhasil ${cmd === "block" ? "memblokir" : "membuka blokir"} @${target.split("@")[0]}.`, {
          contextInfo: {
            mentionedJid: [target]
          }
        });
      }
      if (cmd === "blocklist") {
        if (!ctx.isOwner) return replyWithContext(botMsg.owner || "–  *A C C E S S  D E N I E D*");
        ctx.react?.("⏳");
        const list = await sock.fetchBlocklist().catch(() => []);
        ctx.react?.("✅");
        if (!list.length) return replyWithContext("ℹ️ Tidak ada nomor yang sedang diblokir.");
        let txt = `–  *B L O C K E D  U S E R S*\n\n┌  ◦  *Total Blokir* : ${list.length} Kontak\n└  ◦  *Daftar* :\n`;
        list.forEach((jid, i) => {
          txt += `   ${i + 1}. @${jid.split("@")[0]}\n`;
        });
        return replyWithContext(txt, {
          contextInfo: {
            mentionedJid: list
          }
        });
      }
      if (cmd === "reportspam" || cmd === "reportuser") {
        if (!ctx.isOwner) return replyWithContext(botMsg.owner || "–  *A C C E S S  D E N I E D*");
        const target = resolveTargetUser(ctx, msg);
        if (!target) return replyWithContext(`Tag atau reply user yang ingin dilaporkan.`);
        ctx.react?.("⏳");
        if (cmd === "reportspam" && typeof sock.reportSpam === "function") {
          await sock.reportSpam(target, {
            spamFlow: "ACCOUNT_INFO_REPORT",
            maxMessages: 5
          });
        } else if (typeof sock.reportContact === "function") {
          await sock.reportContact(target);
        }
        ctx.react?.("✅");
        return replyWithContext(`✅ Laporan pelanggaran resmi telah terkirim ke WhatsApp untuk target @${target.split("@")[0]}.`, {
          contextInfo: {
            mentionedJid: [target]
          }
        });
      }
    } catch (error) {
      console.error("[USER Plugin Error]:", error);
      ctx.react?.("❌");
      const errText = global.bot?.msg?.error || "–  *E R R O R*\n\nTerjadi kesalahan saat memproses permintaan.";
      ctx.reply(`${errText}\n\n*Detail*: ${error?.message || error}`);
    }
  }
};