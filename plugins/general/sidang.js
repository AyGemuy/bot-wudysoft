import db from "../../data/db.js";
import {
  simpleQuoted,
  metaQuoted
} from "../../lib/quoted.js";
const activeTrials = new Map();
const DEFAULT_CRIMES = [{
  id: "read_doang",
  title: "Sombong Akut (Read Doang)",
  desc: "Cuma membaca tanpa membalas chat di grup"
}, {
  id: "wibu_akut",
  title: "Wibu Meresahkan",
  desc: "Spam waifu dan bahasa jepang berlebihan"
}, {
  id: "simp_parah",
  title: "Simp Berlebihan",
  desc: "Terlalu bucin dan memuja member lain secara agresif"
}, {
  id: "stiker_garing",
  title: "Teror Stiker Garing",
  desc: "Spam stiker basi saat jam diskusi serius"
}, {
  id: "ghosting_kas",
  title: "Buron Uang Kas",
  desc: "Pura-pura offline saat giliran bayar kas atau patungan"
}, {
  id: "curhat_malam",
  title: "Curhat Tengah Malam",
  desc: "Sering curhat galau jam 2 pagi merusak suasana"
}];

function initDB(jid = null) {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
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

function addExp(jid, amount) {
  if (!jid) return;
  initDB(jid);
  const cur = global.db.user[jid].exp || 0;
  global.db.user[jid].exp = Math.max(0, cur + amount);
  saveDB();
}
export default {
  name: "sidang",
  aliases: ["adili", "tuntut", "mahkamah", "vonis", "batalinsidang"],
  description: "Sidang Pengadilan Rakyat: Seret teman ke meja hijau & seluruh grup jadi jurinya! (Full DB & Interactive CTA)",
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
      if (!activeTrials.has(chatId)) return;
      const sidang = activeTrials.get(chatId);
      const text = (ctx?.text || ctx?.query || msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "").trim().toLowerCase();
      if (!text) return;
      if (senderJid === sidang.defendant) {
        if (Math.random() < .25 && typeof ctx?.react === "function") {
          await ctx.react("🤐");
        }
      }
      if (text === "#bersalah" || text === "#bebas") {
        if (senderJid === sidang.defendant) {
          return ctx.reply("❌ Terdakwa tidak memiliki hak suara dalam menentukan vonis perkaranya sendiri.");
        }
        if (sidang.voters.has(senderJid)) {
          return ctx.reply("⚠️ Anda sudah menggunakan hak suara sebagai Dewan Juri.");
        }
        sidang.voters.add(senderJid);
        if (text === "#bersalah") {
          sidang.guiltyVotes.push(senderJid);
          if (typeof ctx?.react === "function") await ctx.react("🔨");
        } else {
          sidang.innocentVotes.push(senderJid);
          if (typeof ctx?.react === "function") await ctx.react("🕊️");
        }
        const totalVotes = sidang.guiltyVotes.length + sidang.innocentVotes.length;
        if (totalVotes % 3 === 0) {
          const tallyText = `–  *P O L L I N G*

Kotak suara sementara dewan juri:

┌  ◦  *Guilty* : ${sidang.guiltyVotes.length} Suara
│  ◦  *Innocent* : ${sidang.innocentVotes.length} Suara
└  ◦  *Total Votes* : ${totalVotes} Juri`;
          await sock.sendMessage(chatId, {
            text: tallyText
          });
        }
      }
    } catch (err) {
      console.error("[Sidang Before Error]:", err.message);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      const chatId = ctx.id;
      const senderJid = ctx.sender;
      const senderNum = senderJid.split("@")[0];
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • Courtroom`;
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
          title: extra.title || `✦ ${botName} • Courtroom ✦`,
          subtitle: extra.subtitle || "Mahkamah Keadilan Warga",
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 2,
              divider_indices: [1],
              list_title: `${botName} • Meja Sidang`,
              button_title: extra.buttonTitle || "Buka Tindakan"
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
      if (command === "batalinsidang") {
        if (!activeTrials.has(chatId)) {
          return ctx.reply("❌ Tidak ada sidang yang sedang berlangsung di grup ini.");
        }
        const s = activeTrials.get(chatId);
        if (s.accuser !== senderJid) {
          return ctx.reply(`❌ Hanya Jaksa Penuntut (@${s.accuser.split("@")[0]}) yang berhak mencabut tuntutan perkara.`, {
            mentions: [s.accuser]
          });
        }
        clearTimeout(s.timer);
        activeTrials.delete(chatId);
        return ctx.reply(`–  *C A N C E L L E D*

Tuntutan perkara resmi dicabut dan sidang pengadilan dibatalkan.`);
      }
      if (command === "vonis") {
        if (!activeTrials.has(chatId)) {
          return ctx.reply(`–  *C O U R T R O O M*

Tidak ada sidang yang sedang berlangsung saat ini.

┌  ◦  *Start* : ${prefix}sidang @user <alasan>
└  ◦  *Example* : ${prefix}sidang @user Read doang sombong`);
        }
        const sidang = activeTrials.get(chatId);
        const choice = (ctx.args?.[0] || "").toLowerCase();
        if (senderJid === sidang.defendant) {
          return ctx.reply("❌ Terdakwa tidak memiliki hak suara dalam menentukan nasib perkaranya sendiri.");
        }
        if (sidang.voters.has(senderJid)) {
          return ctx.reply("⚠️ Anda sudah menggunakan hak suara sebagai Dewan Juri.");
        }
        if (!["bersalah", "guilty", "bebas", "innocent"].includes(choice)) {
          return ctx.reply(`–  *V E R D I C T*

Format pemberian vonis:

┌  ◦  *Bersalah* : ${prefix}vonis bersalah
└  ◦  *Bebas* : ${prefix}vonis bebas`);
        }
        sidang.voters.add(senderJid);
        if (choice === "bersalah" || choice === "guilty") {
          sidang.guiltyVotes.push(senderJid);
          if (typeof ctx?.react === "function") await ctx.react("🔨");
          return ctx.reply(`–  *V E R D I C T*

@${senderNum} menetapkan vonis: *BERSALAH*.`, {
            mentions: [senderJid]
          });
        } else {
          sidang.innocentVotes.push(senderJid);
          if (typeof ctx?.react === "function") await ctx.react("🕊️");
          return ctx.reply(`–  *V E R D I C T*

@${senderNum} menetapkan vonis: *BEBAS TIDAK BERSALAH*.`, {
            mentions: [senderJid]
          });
        }
      }
      if (activeTrials.has(chatId)) {
        const active = activeTrials.get(chatId);
        return ctx.reply(`⚠️ Masih ada sidang aktif terhadap @${active.defendant.split("@")[0]}.\nGunakan tombol voting yang tersedia.`, {
          mentions: [active.defendant]
        });
      }
      const target = mentioned[0];
      if (!target) {
        const helpBody = `Hi ${userName}!
Sidang pengadilan rakyat untuk mengadili perkara antar anggota grup secara demokratis.

–  *C O U R T R O O M*

┌  ◦  *Format* : ${prefix}sidang @user <dakwaan>
└  ◦  *Example* : ${prefix}sidang @user Read doang sombong

Pelajari pasal pelanggaran perkara melalui menu di bawah.`;
        const crimeSections = [{
          title: "📋 PASAL PELANGGARAN PERKARA",
          rows: DEFAULT_CRIMES.map(c => ({
            title: c.title,
            id: `${prefix}sidang`,
            description: c.desc.slice(0, 60)
          }))
        }];
        const helpButtons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "📜 LIHAT PASAL PELANGGARAN",
            sections: crimeSections
          })
        }];
        return await sendInteractive(helpBody, botFooter, helpButtons, {
          title: `✦ Panduan Pengadilan Rakyat ✦`,
          buttonTitle: "Lihat Pasal"
        });
      }
      if (target === senderJid) {
        return ctx.reply("❌ Anda tidak bisa menuntut diri Anda sendiri.");
      }
      const rawCrimeArg = ctx.args?.slice(1).join(" ")?.trim();
      if (!rawCrimeArg) {
        const targetNum = target.split("@")[0];
        const pickCrimeBody = `–  *C O U R T R O O M*

Pilih pasal dakwaan perkara yang dituntutkan kepada terdakwa.

┌  ◦  *Accuser* : @${senderNum}
└  ◦  *Defendant* : @${targetNum}

Pilih dakwaan melalui menu di bawah untuk membuka sidang.`;
        const crimeRows = DEFAULT_CRIMES.map(c => ({
          title: c.title,
          id: `${prefix}sidang @${targetNum} ${c.desc}`,
          description: c.desc.slice(0, 60)
        }));
        const pickButtons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: `⚖️ DAKWAAN UNTUK @${targetNum}`,
            sections: [{
              title: "PILIHAN DAKWAAN WARGA",
              rows: crimeRows
            }]
          })
        }];
        return await sendInteractive(pickCrimeBody, botFooter, pickButtons, {
          mentions: [senderJid, target],
          title: `✦ Pilih Pasal Dakwaan ✦`,
          buttonTitle: "Pilih Dakwaan"
        });
      }
      initDB(target);
      const crime = rawCrimeArg;
      const DURATION_SECONDS = 60;
      const finalizeTrial = async () => {
        if (!activeTrials.has(chatId)) return;
        const finalData = activeTrials.get(chatId);
        activeTrials.delete(chatId);
        const totalGuilty = finalData.guiltyVotes.length;
        const totalInnocent = finalData.innocentVotes.length;
        const totalJury = totalGuilty + totalInnocent;
        let verdictText = "";
        if (totalJury === 0) {
          verdictText = `–  *D I S M I S S E D*

Sidang gugur karena kuorum dewan juri kosong. Terdakwa @${finalData.defendant.split("@")[0]} dinyatakan bebas demi hukum.`;
          return await sock.sendMessage(chatId, {
            text: verdictText,
            mentions: [finalData.defendant]
          });
        }
        if (totalGuilty >= totalInnocent) {
          const penaltyExp = 120;
          addExp(finalData.defendant, -penaltyExp);
          const rewardPerJury = totalGuilty > 0 ? Math.floor(penaltyExp / totalGuilty) : 10;
          finalData.guiltyVotes.forEach(juryJid => addExp(juryJid, rewardPerJury));
          verdictText = `–  *G U I L T Y*

Terdakwa terbukti bersalah berdasarkan vonis dewan juri.

┌  ◦  *Defendant* : @${finalData.defendant.split("@")[0]}
│  ◦  *Charge* : "${finalData.crime}"
│  ◦  *Votes* : ${totalGuilty} Bersalah vs ${totalInnocent} Bebas
│  ◦  *Penalty* : -${penaltyExp} EXP
└  ◦  *Jury Share* : +${rewardPerJury} EXP / juri`;
        } else {
          const defamationPenalty = 80;
          addExp(finalData.accuser, -defamationPenalty);
          addExp(finalData.defendant, 60);
          verdictText = `–  *I N N O C E N T*

Tuduhan dinyatakan fitnah dan terdakwa dinyatakan bebas murni.

┌  ◦  *Defendant* : @${finalData.defendant.split("@")[0]} (Bebas)
│  ◦  *Compensation* : +60 EXP
│  ◦  *False Accuser* : @${finalData.accuser.split("@")[0]}
│  ◦  *Defamation Fine* : -80 EXP
└  ◦  *Votes* : ${totalInnocent} Bebas vs ${totalGuilty} Bersalah`;
        }
        await sock.sendMessage(chatId, {
          text: verdictText,
          mentions: [finalData.defendant, finalData.accuser, ...finalData.guiltyVotes]
        });
      };
      const timer = setTimeout(finalizeTrial, DURATION_SECONDS * 1e3);
      activeTrials.set(chatId, {
        accuser: senderJid,
        defendant: target,
        crime: crime,
        guiltyVotes: [],
        innocentVotes: [],
        voters: new Set(),
        timer: timer
      });
      const body = `–  *C O U R T R O O M*

Sidang pengadilan terbuka warga resmi dibuka.

┌  ◦  *Accuser* : @${senderNum}
│  ◦  *Defendant* : @${target.split("@")[0]}
│  ◦  *Charge* : "${crime}"
└  ◦  *Timeout* : ${DURATION_SECONDS}s

–  *V O T I N G*

┌  ◦  *Bersalah* : Klik tombol / ketik #bersalah
└  ◦  *Bebas* : Klik tombol / ketik #bebas

Seluruh anggota grup berhak memberikan suara sebagai Dewan Juri.`;
      const buttons = [{
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🔨 Bersalah",
          id: `${prefix}vonis bersalah`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🕊️ Tidak Bersalah",
          id: `${prefix}vonis bebas`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🏳️ Cabut Perkara",
          id: `${prefix}batalinsidang`
        })
      }];
      return await sendInteractive(body, botFooter, buttons, {
        mentions: [senderJid, target],
        title: `✦ Sidang Pengadilan Terbuka ✦`
      });
    } catch (err) {
      console.error("[Sidang System Error]:", err);
      ctx.reply(`❌ Terjadi kendala teknis: ${err.message}`);
    }
  }
};