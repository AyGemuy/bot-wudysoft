import db from "../../data/db.js";
import {
  simpleQuoted,
  metaQuoted
} from "../../lib/quoted.js";
import {
  badwordList
} from "../../lib/badword.js";
const pendingProposals = new Map();
const validBadwords = Array.isArray(badwordList) ? badwordList : [];

function initDB(jid = null) {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.couples) global.db.couples = {};
  if (jid && !global.db.user[jid]) {
    global.db.user[jid] = {
      exp: 0
    };
  }
}

function saveDB() {
  if (typeof db?.write === "function") {
    db.write(global.db);
  }
}

function checkIsBadword(text) {
  if (!text || validBadwords.length === 0) return false;
  const lower = text.toLowerCase();
  return validBadwords.some(bad => {
    const reg = new RegExp(`\\b${bad}\\b`, "i");
    return reg.test(lower);
  });
}

function addExp(jid, amount) {
  if (!jid) return;
  initDB(jid);
  const cur = global.db.user[jid].exp || 0;
  global.db.user[jid].exp = Math.max(0, cur + amount);
  saveDB();
}

function createLoveBar(current, max = 100, length = 8) {
  const safeCurrent = Math.max(0, current);
  const percentage = Math.min(100, Math.round(safeCurrent / max * 100));
  const filled = Math.round(percentage / 100 * length);
  const empty = length - filled;
  const bar = "❤️".repeat(filled) + "🤍".repeat(Math.max(0, empty));
  return `${bar} ${percentage}% (${safeCurrent} Pts)`;
}
export default {
  name: "jodoh",
  aliases: ["tembak", "nembak", "terima", "tolak", "putus", "cerai", "cekjodoh", "jodohku"],
  description: "Sistem Asmara Interaktif: Nembak, Terima, Tolak, Putus, Reward Interaksi & Anti-Toxic (Full DB & Interactive CTA)",
  category: "Fun & RPG",
  group: true,
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const chatId = ctx?.id || msg?.key?.remoteJid;
      const senderJid = ctx?.sender || msg?.key?.participant;
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (!chatId?.endsWith("@g.us") || !senderJid || isFromMe) return;
      initDB(senderJid);
      const session = global.db.couples[senderJid];
      if (!session || session.groupId !== chatId) return;
      const partnerJid = session.partner;
      const text = (ctx?.text || ctx?.query || msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "").trim();
      if (!text) return;
      if (checkIsBadword(text)) {
        session.lovePoints = Math.max(0, (session.lovePoints || 0) - 10);
        if (global.db.couples[partnerJid]) {
          global.db.couples[partnerJid].lovePoints = session.lovePoints;
        }
        saveDB();
        addExp(senderJid, -25);
        if (typeof ctx?.react === "function") await ctx.react("💔");
        if (session.lovePoints <= 0) {
          delete global.db.couples[senderJid];
          delete global.db.couples[partnerJid];
          saveDB();
          addExp(senderJid, -50);
          addExp(partnerJid, -50);
          const bodyText = `–  *B R O K E N  U P*

Hubungan resmi dibatalkan karena poin kemesraan habis (0).

┌  ◦  *Partner 1* : @${senderJid.split("@")[0]}
│  ◦  *Partner 2* : @${partnerJid.split("@")[0]}
└  ◦  *Penalty* : -50 EXP masing-masing`;
          return await sock.sendMessage(chatId, {
            text: bodyText,
            mentions: [senderJid, partnerJid]
          });
        }
        const warningToxic = `–  *P E N A L T Y*

Terdeteksi kata kasar dari pasangan.

┌  ◦  *User* : @${senderJid.split("@")[0]}
│  ◦  *Penalty* : -10 Love Points | -25 EXP
└  ◦  *Love Points* : ${session.lovePoints} Pts`;
        return await sock.sendMessage(chatId, {
          text: warningToxic,
          mentions: [senderJid]
        });
      }
      const quotedSender = ctx?.quoted?.sender || msg?.message?.extendedTextMessage?.contextInfo?.participant;
      const mentionedJids = ctx?.mentionedJid || msg?.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      const isReplying = quotedSender === partnerJid;
      const isMentioning = mentionedJids.includes(partnerJid);
      if (isReplying || isMentioning) {
        const now = Date.now();
        if (now - (session.lastReward || 0) < 1e4) return;
        session.lovePoints = (session.lovePoints || 0) + 2;
        session.lastReward = now;
        if (global.db.couples[partnerJid]) {
          global.db.couples[partnerJid].lovePoints = session.lovePoints;
          global.db.couples[partnerJid].lastReward = now;
        }
        saveDB();
        addExp(senderJid, 15);
        if (session.lovePoints % 25 === 0) {
          addExp(senderJid, 50);
          addExp(partnerJid, 50);
          const lvlUpText = `–  *C O U P L E  L E V E L  U P*

Hubungan asmara semakin harmonis.

┌  ◦  *Partner 1* : @${senderJid.split("@")[0]}
│  ◦  *Partner 2* : @${partnerJid.split("@")[0]}
│  ◦  *Love Points* : ${session.lovePoints} Pts
└  ◦  *Bonus* : +50 EXP masing-masing`;
          await sock.sendMessage(chatId, {
            text: lvlUpText,
            mentions: [senderJid, partnerJid]
          });
        } else if (typeof ctx?.react === "function") {
          await ctx.react("❤️");
        }
      }
    } catch (err) {
      console.error("[Jodoh Before Error]:", err.message);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      const chatId = ctx.id;
      const senderJid = ctx.sender;
      const senderNum = senderJid.split("@")[0];
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • Relationship`;
      const userName = ctx.pushname || senderNum;
      const command = (ctx.command || "").toLowerCase();
      const mentioned = ctx.mentionedJid || [];
      const quotedMsg = typeof metaQuoted === "function" ? metaQuoted(ctx) : typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      initDB(senderJid);
      const sendInteractive = async (body, footer, buttons, extra = {}) => {
        const baseContextInfo = {
          mentionedJid: extra.mentions || [],
          ...global.bot?.utils?.contextInfo || {
            forwardingScore: 999,
            isForwarded: true
          }
        };
        const options = {
          title: extra.title || `✦ ${botName} • Relationship ✦`,
          subtitle: extra.subtitle || "Love & Relationship System",
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 2,
              divider_indices: [1],
              list_title: `${botName} • Menu Asmara`,
              button_title: extra.buttonTitle || "Buka Aksi"
            }
          },
          contextInfo: baseContextInfo,
          quoted: quotedMsg
        };
        if (typeof ctx.sendCta === "function") {
          return await ctx.sendCta(body, footer, buttons, options);
        } else {
          return await sock.sendMessage(chatId, {
            text: `${body}\n\n_${footer}_`,
            mentions: extra.mentions || []
          }, {
            quoted: quotedMsg
          });
        }
      };
      if (command === "jodoh" && (!ctx.args || ctx.args.length === 0)) {
        const isCoupled = Boolean(global.db.couples[senderJid]);
        const partnerJid = global.db.couples[senderJid]?.partner;
        const body = `Hi ${userName}!
Sistem asmara & perjodohan grup.

–  *R E L A T I O N S H I P*

┌  ◦  *Status* : ${isCoupled ? `Berpacaran dengan @${partnerJid.split("@")[0]}` : "Jomblo Mandiri"}
${isCoupled ? `│  ◦  *Love Points* : ${global.db.couples[senderJid].lovePoints || 0} Pts\n` : ""}└  ◦  *Action* : Ketik ${prefix}cekjodoh untuk melihat kartu cinta

Gunakan menu di bawah untuk mengelola hubungan asmara Anda.`;
        const menuSections = [{
          title: "👩‍❤️‍👨 STATUS & HUBUNGAN",
          rows: [{
            title: "👩‍❤️‍👨 Cek Status Pasangan",
            id: `${prefix}cekjodoh`,
            description: "Lihat kartu cinta, love bar, dan durasi jadian"
          }, {
            title: "🔮 Radar Jodoh Acak",
            id: `${prefix}jodohku`,
            description: "Cari calon gebetan jomblo yang cocok di grup"
          }, {
            title: "💔 Putuskan Hubungan",
            id: `${prefix}putus`,
            description: "Akhiri hubungan pacaran saat ini (Denda -30 EXP)"
          }]
        }, {
          title: "💌 RESPON LAMARAN",
          rows: [{
            title: "🌹 Terima Lamaran Cinta",
            id: `${prefix}terima`,
            description: "Terima ajakan pacaran yang sedang ditujukan padamu"
          }, {
            title: "🥀 Tolak Lamaran Cinta",
            id: `${prefix}tolak`,
            description: "Tolak ajakan pacaran dari orang yang melamarmu"
          }]
        }];
        const helpButtons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "💘 MENU ASMARA",
            sections: menuSections
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: isCoupled ? "👩‍❤️‍👨 Kartu Pasangan" : "🔮 Ramal Jodoh",
            id: isCoupled ? `${prefix}cekjodoh` : `${prefix}jodohku`
          })
        }];
        return await sendInteractive(body, botFooter, helpButtons, {
          mentions: isCoupled ? [partnerJid] : [],
          title: `✦ Menu Asmara Grup ✦`,
          buttonTitle: "Pilih Menu Asmara"
        });
      }
      if (command === "cekjodoh") {
        if (!global.db.couples[senderJid]) {
          const body = `–  *R E L A T I O N S H I P*

Anda belum memiliki pasangan aktif.

┌  ◦  *Status* : Jomblo Mandiri
└  ◦  *Action* : Ketik ${prefix}jodohku untuk mencari calon pasangan`;
          const buttons = [{
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "🔮 Ramal Jodoh Acak",
              id: `${prefix}jodohku`
            })
          }];
          return await sendInteractive(body, botFooter, buttons);
        }
        const session = global.db.couples[senderJid];
        const partnerJid = session.partner;
        const durasiHari = Math.floor((Date.now() - (session.createdAt || Date.now())) / 864e5);
        const body = `Hi ${userName}!
Berikut adalah data hubungan asmara Anda.

–  *R E L A T I O N S H I P*

┌  ◦  *You* : @${senderNum}
│  ◦  *Partner* : @${partnerJid.split("@")[0]}
│  ◦  *Duration* : ${durasiHari} Hari
│  ◦  *Love Points* : ${createLoveBar(session.lovePoints || 0)}
└  ◦  *Status* : ${(session.lovePoints || 0) >= 50 ? "Siap Pelaminan" : "Tahap Penjajakan"}

Tingkatkan interaksi dengan membalas pesan pasangan di grup untuk memperoleh bonus EXP.`;
        const buttons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "💔 Putus Hubungan",
            id: `${prefix}putus`
          })
        }];
        return await sendInteractive(body, botFooter, buttons, {
          mentions: [senderJid, partnerJid],
          title: `✦ Kartu Status Pasangan ✦`
        });
      }
      if (command === "tembak" || command === "nembak") {
        if (global.db.couples[senderJid]) {
          const curPartner = global.db.couples[senderJid].partner;
          return ctx.reply(`⚠️ Anda sudah berpacaran dengan @${curPartner.split("@")[0]}.\nPutuskan hubungan terlebih dahulu (*${prefix}putus*) jika ingin berganti pasangan.`, {
            mentions: [curPartner]
          });
        }
        const target = mentioned[0];
        if (!target) {
          return ctx.reply(`–  *C O N F E S S I O N*

Silakan tag orang yang ingin Anda jadikan pasangan.

┌  ◦  *Format* : ${prefix}tembak @user
└  ◦  *Example* : ${prefix}tembak @user`);
        }
        if (target === senderJid) {
          return ctx.reply("❌ Anda tidak bisa menyatakan cinta pada diri sendiri.");
        }
        if (global.db.couples[target]) {
          const theirPartner = global.db.couples[target].partner;
          return ctx.reply(`❌ Target sudah menjadi pasangan resmi dari @${theirPartner.split("@")[0]}.`, {
            mentions: [theirPartner]
          });
        }
        if (pendingProposals.has(target)) {
          return ctx.reply("⏳ Sedang ada lamaran lain yang ditujukan padanya. Tunggu keputusan doi.");
        }
        const timer = setTimeout(async () => {
          if (pendingProposals.has(target)) {
            pendingProposals.delete(target);
            const expireText = `–  *E X P I R E D*

Lamaran cinta dari @${senderNum} kepada @${target.split("@")[0]} telah kedaluwarsa.`;
            await sock.sendMessage(chatId, {
              text: expireText,
              mentions: [senderJid, target]
            });
          }
        }, 6e4);
        pendingProposals.set(target, {
          proposer: senderJid,
          groupId: chatId,
          timer: timer,
          createdAt: Date.now()
        });
        const body = `–  *C O N F E S S I O N*

Surat pernyataan cinta resmi dikirimkan.

┌  ◦  *Proposer* : @${senderNum}
│  ◦  *Target* : @${target.split("@")[0]}
│  ◦  *Reward* : +100 EXP & 20 Love Points
└  ◦  *Timeout* : 60s

Pilih opsi di bawah untuk menerima atau menolak lamaran cinta.`;
        const buttons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🌹 Terima Lamaran",
            id: `${prefix}terima`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🥀 Tolak Lamaran",
            id: `${prefix}tolak`
          })
        }];
        return await sendInteractive(body, botFooter, buttons, {
          mentions: [senderJid, target],
          title: `✦ Pernyataan Cinta ✦`
        });
      }
      if (command === "terima") {
        if (!pendingProposals.has(senderJid)) {
          let activeTarget = null;
          for (const [tJid, pData] of pendingProposals.entries()) {
            if (pData.groupId === chatId) {
              activeTarget = tJid;
              break;
            }
          }
          if (activeTarget) {
            return ctx.reply(`❌ Lamaran ini ditujukan khusus untuk @${activeTarget.split("@")[0]}.`, {
              mentions: [activeTarget]
            });
          }
          return ctx.reply(`❌ Saat ini tidak ada yang sedang menyatakan cinta kepada Anda. Ketik *${prefix}jodohku* untuk mencari.`);
        }
        const proposal = pendingProposals.get(senderJid);
        if (proposal.groupId !== chatId) {
          return ctx.reply("❌ Lamaran tersebut diajukan di grup obrolan lain.");
        }
        clearTimeout(proposal.timer);
        pendingProposals.delete(senderJid);
        const proposer = proposal.proposer;
        const coupleBase = {
          groupId: chatId,
          lovePoints: 20,
          createdAt: Date.now(),
          lastReward: 0
        };
        global.db.couples[senderJid] = {
          ...coupleBase,
          partner: proposer
        };
        global.db.couples[proposer] = {
          ...coupleBase,
          partner: senderJid
        };
        saveDB();
        addExp(senderJid, 100);
        addExp(proposer, 100);
        const body = `–  *A C C E P T E D*

Selamat! Pernyataan cinta resmi diterima.

┌  ◦  *Partner 1* : @${proposer.split("@")[0]}
│  ◦  *Partner 2* : @${senderNum}
│  ◦  *Love Points* : 20 Pts
└  ◦  *Reward* : +100 EXP masing-masing

Rajinlah berinteraksi di grup untuk merawat hubungan asmara kalian.`;
        const buttons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "👩‍❤️‍👨 Cek Kartu Pasangan",
            id: `${prefix}cekjodoh`
          })
        }];
        return await sendInteractive(body, botFooter, buttons, {
          mentions: [proposer, senderJid],
          title: `✦ Resmi Jadian ✦`
        });
      }
      if (command === "tolak") {
        if (!pendingProposals.has(senderJid)) {
          let activeTarget = null;
          for (const [tJid, pData] of pendingProposals.entries()) {
            if (pData.groupId === chatId) {
              activeTarget = tJid;
              break;
            }
          }
          if (activeTarget) {
            return ctx.reply(`❌ Opsi ini hanya untuk @${activeTarget.split("@")[0]} yang sedang dilamar.`, {
              mentions: [activeTarget]
            });
          }
          return ctx.reply("❌ Tidak ada lamaran cinta aktif yang perlu Anda tolak.");
        }
        const proposal = pendingProposals.get(senderJid);
        clearTimeout(proposal.timer);
        pendingProposals.delete(senderJid);
        const proposer = proposal.proposer;
        addExp(proposer, -50);
        if (typeof ctx?.react === "function") await ctx.react("🥀");
        const body = `–  *R E J E C T E D*

Pernyataan cinta ditolak (Friendzone).

┌  ◦  *Rejected* : @${proposer.split("@")[0]}
│  ◦  *Rejecter* : @${senderNum}
└  ◦  *Penalty* : -50 EXP

Tetap tegar, masih banyak kesempatan lain menantimu.`;
        const buttons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🔮 Ramal Jodoh Lain",
            id: `${prefix}jodohku`
          })
        }];
        return await sendInteractive(body, botFooter, buttons, {
          mentions: [proposer, senderJid],
          title: `✦ Penolakan Asmara ✦`
        });
      }
      if (command === "putus" || command === "cerai") {
        if (!global.db.couples[senderJid]) {
          return ctx.reply(`❌ Anda sedang tidak berpacaran dengan siapa pun. Ketik *${prefix}tembak @user* untuk mengajak seseorang.`);
        }
        const session = global.db.couples[senderJid];
        const partner = session.partner;
        delete global.db.couples[senderJid];
        delete global.db.couples[partner];
        saveDB();
        addExp(senderJid, -30);
        addExp(partner, -30);
        const body = `–  *B R E A K U P*

Hubungan asmara resmi berakhir.

┌  ◦  *Initiator* : @${senderNum}
│  ◦  *Ex-Partner* : @${partner.split("@")[0]}
└  ◦  *Penalty* : -30 EXP masing-masing

Status kalian berdua kembali menjadi jomblo mandiri.`;
        const buttons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🔮 Cari Gebetan Baru",
            id: `${prefix}jodohku`
          })
        }];
        return await sendInteractive(body, botFooter, buttons, {
          mentions: [senderJid, partner],
          title: `✦ Hubungan Berakhir ✦`
        });
      }
      if (command === "jodohku") {
        if (global.db.couples[senderJid]) {
          const partner = global.db.couples[senderJid].partner;
          return ctx.reply(`❌ Kamu sudah berpacaran dengan @${partner.split("@")[0]}. Ketik *${prefix}cekjodoh* untuk melihat status asmara.`, {
            mentions: [partner]
          });
        }
        const metadata = await sock.groupMetadata(chatId);
        const candidates = metadata.participants.map(p => p.id).filter(id => id !== senderJid && !id.includes("bot") && !global.db.couples[id]);
        if (candidates.length === 0) {
          return ctx.reply("❌ Semua anggota di grup ini sudah memiliki pasangan atau tidak tersedia.");
        }
        const chosen = candidates[Math.floor(Math.random() * candidates.length)];
        const candidateSlice = candidates.slice(0, 5);
        const body = `Hi ${userName}!
Sensor kecocokan mendeteksi tingkat harmoni tinggi.

–  *M A T C H  R A D A R*

┌  ◦  *Seeker* : @${senderNum}
└  ◦  *Top Candidate* : @${chosen.split("@")[0]}

Pilih kandidat jomblo dari menu di bawah untuk menyatakan cinta.`;
        const candidateRows = candidateSlice.map((candId, idx) => ({
          title: `💘 Tembak Calon #${idx + 1}`,
          id: `${prefix}tembak @${candId.split("@")[0]}`,
          description: `@${candId.split("@")[0]} • Status Jomblo Aktif`
        }));
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "💘 PILIH CALON GEBETAN",
            sections: [{
              title: "KANDIDAT JOMBLO GRUP",
              rows: candidateRows
            }]
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `💘 Tembak @${chosen.split("@")[0]}!`,
            id: `${prefix}tembak @${chosen.split("@")[0]}`
          })
        }];
        return await sendInteractive(body, botFooter, buttons, {
          mentions: [senderJid, chosen, ...candidateSlice],
          title: `✦ Radar Jodoh Acak ✦`,
          buttonTitle: "Pilih Target Gebetan"
        });
      }
    } catch (err) {
      console.error("[Jodoh System Error]:", err);
      ctx.reply(`❌ Terjadi kendala teknis: ${err.message}`);
    }
  }
};