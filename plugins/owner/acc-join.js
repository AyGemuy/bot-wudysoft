import {
  simpleQuoted
} from "../../lib/quoted.js";
import {
  decodeJid,
  extractNum
} from "../../core/serialize.js";
export default {
  name: "accjoin",
  aliases: ["approvejoin", "acclist", "listjoin", "joinreq", "acc", "approve"],
  description: "Melihat dan menyetujui atau menolak permintaan gabung (join request) anggota ke grup",
  category: "Group",
  group: true,
  admin: true,
  botAdmin: true,
  example: ".accjoin (atau .accjoin all / .accjoin reject <nomor>)",
  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "WudysoftBot";
    const footer = global.footer || global.bot?.footer || `_${botName}_`;
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
    const chatId = ctx.chat;
    try {
      await ctx.react("⏳");
      let requestList = [];
      try {
        if (typeof sock.groupRequestParticipantsList === "function") {
          requestList = await sock.groupRequestParticipantsList(chatId);
        }
      } catch (err) {
        console.error("[ACCJOIN] Gagal memuat request list:", err);
      }
      if (!Array.isArray(requestList) || requestList.length === 0) {
        await ctx.react("ℹ️");
        return ctx.reply(`– *A C C  J O I N*\n\n` + `┌ ◦ *Status* : Tidak ada permintaan\n` + `└ ◦ *Info* : Tidak ada calon anggota pending saat ini.\n\n` + `${footer}`);
      }
      const args = ctx.args || [];
      const subCmd = (args[0] || "").toLowerCase();
      const targetArg = args[1] ? args[1].trim() : "";
      if (subCmd === "all" || subCmd === "approve" && targetArg === "all") {
        const jids = requestList.map(r => r.jid);
        await sock.groupRequestParticipantsUpdate(chatId, jids, "approve");
        await ctx.react("✅");
        return ctx.reply(`– *A C C  J O I N*\n\n` + `┌ ◦ *Action* : Setujui Semua (Approve All)\n` + `│ ◦ *Total* : ${jids.length} Anggota\n` + `└ ◦ *Status* : Berhasil bergabung ke grup\n\n` + `${footer}`);
      }
      if (subCmd === "rejectall" || subCmd === "reject" && targetArg === "all") {
        const jids = requestList.map(r => r.jid);
        await sock.groupRequestParticipantsUpdate(chatId, jids, "reject");
        await ctx.react("🗑️");
        return ctx.reply(`– *A C C  J O I N*\n\n` + `┌ ◦ *Action* : Tolak Semua (Reject All)\n` + `│ ◦ *Total* : ${jids.length} Permintaan\n` + `└ ◦ *Status* : Berhasil ditolak dari grup\n\n` + `${footer}`);
      }
      if (subCmd === "approve" || subCmd === "acc" || subCmd === "yes") {
        let targetJid = null;
        if (/^\d+$/.test(targetArg) && Number(targetArg) <= requestList.length && Number(targetArg) >= 1) {
          targetJid = requestList[Number(targetArg) - 1].jid;
        } else if (targetArg) {
          const cleanNum = targetArg.replace(/\D/g, "");
          targetJid = requestList.find(r => extractNum(r.jid) === cleanNum)?.jid || `${cleanNum}@s.whatsapp.net`;
        } else if (ctx.mentionedJid?.length > 0) {
          targetJid = ctx.mentionedJid[0];
        }
        if (!targetJid) {
          return ctx.reply(`– *A C C  J O I N*\n\n` + `┌ ◦ *Usage* : ${prefix}accjoin approve <urutan/nomor>\n` + `└ ◦ *Example* : ${prefix}accjoin approve 1\n\n` + `${footer}`);
        }
        await sock.groupRequestParticipantsUpdate(chatId, [targetJid], "approve");
        await ctx.react("✅");
        return ctx.reply(`– *A C C  J O I N*\n\n` + `┌ ◦ *Action* : Setujui (Approve)\n` + `│ ◦ *Target* : @${extractNum(targetJid)}\n` + `└ ◦ *Status* : Berhasil disetujui bergabung\n\n` + `${footer}`, {
          mentions: [targetJid]
        });
      }
      if (subCmd === "reject" || subCmd === "tolak" || subCmd === "no") {
        let targetJid = null;
        if (/^\d+$/.test(targetArg) && Number(targetArg) <= requestList.length && Number(targetArg) >= 1) {
          targetJid = requestList[Number(targetArg) - 1].jid;
        } else if (targetArg) {
          const cleanNum = targetArg.replace(/\D/g, "");
          targetJid = requestList.find(r => extractNum(r.jid) === cleanNum)?.jid || `${cleanNum}@s.whatsapp.net`;
        } else if (ctx.mentionedJid?.length > 0) {
          targetJid = ctx.mentionedJid[0];
        }
        if (!targetJid) {
          return ctx.reply(`– *A C C  J O I N*\n\n` + `┌ ◦ *Usage* : ${prefix}accjoin reject <urutan/nomor>\n` + `└ ◦ *Example* : ${prefix}accjoin reject 1\n\n` + `${footer}`);
        }
        await sock.groupRequestParticipantsUpdate(chatId, [targetJid], "reject");
        await ctx.react("🗑️");
        return ctx.reply(`– *A C C  J O I N*\n\n` + `┌ ◦ *Action* : Tolak (Reject)\n` + `│ ◦ *Target* : @${extractNum(targetJid)}\n` + `└ ◦ *Status* : Permintaan gabung ditolak\n\n` + `${footer}`, {
          mentions: [targetJid]
        });
      }
      const rows = [];
      requestList.slice(0, 20).forEach((item, index) => {
        const num = extractNum(item.jid);
        const reqTime = item.request_time ? new Date(Number(item.request_time) * 1e3).toLocaleString("id-ID", {
          timeZone: "Asia/Jakarta"
        }) : "Baru saja";
        rows.push({
          title: `[${index + 1}] +${num}`,
          description: `Waktu: ${reqTime} • Setujui`,
          id: `${prefix}accjoin approve ${index + 1}`
        });
      });
      const bodyText = `– *A C C  J O I N*\n\n` + `┌ ◦ *Group* : ${ctx.groupMetadata?.subject || "Grup Ini"}\n` + `│ ◦ *Pending* : ${requestList.length} Permintaan\n` + `└ ◦ *Action* : Pilih aksi pada tombol menu di bawah\n\n` + `${footer}`;
      const bannerMedia = global.bot?.media?.banner1 || "https://files.catbox.moe/g2e6i5.jpg";
      const buttons = [{
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "Setujui Semua",
          id: `${prefix}accjoin all`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "Tolak Semua",
          id: `${prefix}accjoin reject all`
        })
      }, {
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: `PILIH MEMBER (${rows.length})`,
          sections: [{
            title: "Daftar Calon Anggota (Klik untuk ACC)",
            rows: rows
          }]
        })
      }];
      const options = {
        image: bannerMedia,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 2,
            divider_indices: [2],
            list_title: "Daftar Permintaan Gabung",
            button_title: "Pilih Calon Member"
          }
        },
        contextInfo: {
          mentionedJid: requestList.map(r => r.jid)
        },
        quoted: quotedMsg
      };
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, `${botName} • Join Manager`, buttons, options);
      } else {
        let fallbackText = `${bodyText}\n\n*DAFTAR PERMINTAAN:*\n`;
        requestList.forEach((r, i) => {
          fallbackText += `${i + 1}. @${extractNum(r.jid)} (Ketik: \`${prefix}accjoin approve ${i + 1}\`)\n`;
        });
        fallbackText += `\n_Ketik \`${prefix}accjoin all\` untuk menyetujui semua._`;
        await ctx.reply(fallbackText, {
          mentions: requestList.map(r => r.jid),
          quoted: quotedMsg
        });
      }
      await ctx.react("✅");
    } catch (error) {
      console.error("[ACCJOIN Error]:", error);
      await ctx.react("❌");
      ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : ${error?.message || error}\n` + `└ ◦ *Command* : ${ctx.command || "accjoin"}\n\n` + `${footer}`);
    }
  }
};