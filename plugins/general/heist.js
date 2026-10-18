import db from "../../data/db.js";
import {
  simpleQuoted,
  metaQuoted
} from "../../lib/quoted.js";
const activeHeists = new Map();
const HEIST_TARGETS = [{
  id: "minimarket",
  name: "Minimarket 24 Jam",
  difficulty: "Mudah",
  minPlayers: 2,
  baseReward: 350,
  riskPenalty: 40,
  successRate: .8,
  desc: "Sasaran empuk. Keamanan minim & brankas kasir mudah dijebol."
}, {
  id: "tokoemas",
  name: "Toko Emas Pasar Senen",
  difficulty: "Menengah",
  minPlayers: 3,
  baseReward: 750,
  riskPenalty: 80,
  successRate: .65,
  desc: "Penjagaan satpam bersenjata & etalase kaca antipeluru."
}, {
  id: "bank",
  name: "Bank Sentral Metropolitan",
  difficulty: "High Risk",
  minPlayers: 4,
  baseReward: 1600,
  riskPenalty: 150,
  successRate: .45,
  desc: "Pintu brankas baja berbobot 15 ton dengan patroli Brimob 24 jam!"
}];
const HEIST_ROLES = {
  hacker: {
    id: "hacker",
    name: "Master Hacker",
    desc: "Mematikan alarm silent & memotong kamera CCTV"
  },
  driller: {
    id: "driller",
    name: "Safe Driller",
    desc: "Membobol brankas baja & kunci kombinasi"
  },
  muscle: {
    id: "muscle",
    name: "Heavy Enforcer",
    desc: "Mengendalikan sandera & baku tembak dengan aparat"
  },
  driver: {
    id: "driver",
    name: "Getaway Driver",
    desc: "Membawa kabur tim melewati kepungan mobil polisi"
  }
};

function initDB(jid = null) {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (jid && !global.db.user[jid]) {
    global.db.user[jid] = {
      exp: 0,
      jail: 0
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
  name: "heist",
  aliases: ["rampok", "sindikat", "gasrampok", "batalrampok", "ambilrole"],
  description: "Bentuk kru sindikat, ambil peran profesional, dan rampok brankas bersama grup! (Full DB & Interactive CTA)",
  category: "Fun & RPG",
  group: true,
  before: async (msg, {
    ctx
  }) => {
    try {
      const chatId = ctx?.id || msg?.key?.remoteJid;
      const senderJid = ctx?.sender || msg?.key?.participant;
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (!chatId?.endsWith("@g.us") || !senderJid || isFromMe) return;
      initDB(senderJid);
      const jailReleaseTime = global.db.user[senderJid]?.jail || 0;
      if (jailReleaseTime > 0) {
        if (Date.now() < jailReleaseTime) {
          if (Math.random() < .25 && typeof ctx?.react === "function") {
            await ctx.react("🚨");
          }
        } else {
          global.db.user[senderJid].jail = 0;
          saveDB();
        }
      }
    } catch (err) {
      console.error("[Heist Before Error]:", err.message);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      const chatId = ctx.id;
      const senderJid = ctx.sender;
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • Heist Syndicate`;
      const userName = ctx.pushname || senderJid.split("@")[0];
      const command = (ctx.command || "").toLowerCase();
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
          title: extra.title || `✦ ${botName} • Heist Syndicate ✦`,
          subtitle: extra.subtitle || "Operasi Perampokan Sindikat",
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 2,
              divider_indices: [1],
              list_title: `${botName} • Papan Strategi`,
              button_title: extra.buttonTitle || "Aksi Operasi"
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
      const renderLobbyMessage = heist => {
        const totalCrew = Object.values(heist.roster).filter(Boolean).length;
        const remainingRoles = Object.values(HEIST_ROLES).filter(r => !heist.roster[r.id]);
        const rosterLines = Object.entries(heist.roster).map(([r, u], idx, arr) => {
          const isLast = idx === arr.length - 1;
          const branch = isLast ? "└" : "│";
          return `${branch}  ◦  *${HEIST_ROLES[r].name}* : ${u ? `@${u.split("@")[0]}` : "Kosong"}`;
        }).join("\n");
        const body = `–  *H E I S T  L O B B Y*

Papan persiapan operasi perampokan sindikat.

┌  ◦  *Target* : ${heist.target.name}
│  ◦  *Leader* : @${heist.leader.split("@")[0]}
│  ◦  *Risk* : ${heist.target.difficulty}
│  ◦  *Reward* : ~${heist.target.baseReward} EXP
└  ◦  *Crew* : ${totalCrew} / ${heist.target.minPlayers} Anggota

–  *R O S T E R*

${rosterLines}

Pilih posisi spesialis melalui menu di bawah untuk bergabung.`;
        const buttons = [];
        if (remainingRoles.length > 0) {
          const roleRows = remainingRoles.map(r => ({
            title: r.name,
            id: `${prefix}ambilrole ${r.id}`,
            description: r.desc.slice(0, 60)
          }));
          buttons.push({
            name: "single_select",
            buttonParamsJson: JSON.stringify({
              title: "👤 PILIH POSISI SPESIALIS",
              sections: [{
                title: "PERAN TERSEDIA",
                rows: roleRows
              }]
            })
          });
        }
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "⚡ Gas Eksekusi!",
            id: `${prefix}gasrampok`
          })
        });
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🏳️ Batalkan Misi",
            id: `${prefix}batalrampok`
          })
        });
        return {
          body: body,
          buttons: buttons,
          mentions: [heist.leader, ...Object.values(heist.roster).filter(Boolean)]
        };
      };
      if (command === "batalrampok") {
        if (!activeHeists.has(chatId)) {
          return ctx.reply("❌ Tidak ada rencana operasi perampokan yang sedang disiapkan di grup ini.");
        }
        const heist = activeHeists.get(chatId);
        if (heist.leader !== senderJid) {
          return ctx.reply(`❌ Hanya dalang utama (@${heist.leader.split("@")[0]}) yang berhak membatalkan rencana operasi ini.`, {
            mentions: [heist.leader]
          });
        }
        clearTimeout(heist.timer);
        activeHeists.delete(chatId);
        return ctx.reply(`–  *C A N C E L L E D*

Operasi perampokan resmi dibatalkan oleh kapten sindikat.`);
      }
      if (command === "ambilrole") {
        if (!activeHeists.has(chatId)) {
          return ctx.reply(`❌ Belum ada lobi operasi. Ketik *${prefix}heist* untuk merencanakan perampokan.`);
        }
        const jailTime = global.db.user[senderJid]?.jail || 0;
        if (jailTime > Date.now()) {
          const sisaDetik = Math.ceil((jailTime - Date.now()) / 1e3);
          return ctx.reply(`❌ Anda masih berada di dalam sel tahanan selama *${sisaDetik} detik* lagi.`);
        }
        const heist = activeHeists.get(chatId);
        const roleTarget = (ctx.args?.[0] || "").toLowerCase();
        if (!HEIST_ROLES[roleTarget]) {
          return ctx.reply(`❌ Peran tidak valid. Pilihan: hacker, driller, muscle, atau driver.`);
        }
        for (const [rKey, rUser] of Object.entries(heist.roster)) {
          if (rUser === senderJid) {
            return ctx.reply(`⚠️ Anda sudah mengisi posisi sebagai *${HEIST_ROLES[rKey].name}*.`);
          }
        }
        if (heist.roster[roleTarget]) {
          const filledUser = heist.roster[roleTarget];
          return ctx.reply(`❌ Posisi *${HEIST_ROLES[roleTarget].name}* sudah diisi oleh @${filledUser.split("@")[0]}. Silakan pilih posisi lain.`, {
            mentions: [filledUser]
          });
        }
        heist.roster[roleTarget] = senderJid;
        const {
          body,
          buttons,
          mentions
        } = renderLobbyMessage(heist);
        return await sendInteractive(body, botFooter, buttons, {
          mentions: mentions,
          title: `✦ Peran Diamankan ✦`,
          buttonTitle: "Pilih Peran Lain"
        });
      }
      if (command === "gasrampok") {
        if (!activeHeists.has(chatId)) {
          return ctx.reply("❌ Tidak ada operasi perampokan yang siap dieksekusi.");
        }
        const heist = activeHeists.get(chatId);
        if (heist.leader !== senderJid) {
          return ctx.reply(`❌ Hanya dalang operasi (@${heist.leader.split("@")[0]}) yang dapat mengeksekusi misi.`, {
            mentions: [heist.leader]
          });
        }
        const filledRoles = Object.entries(heist.roster).filter(([_, user]) => user !== null);
        if (filledRoles.length < heist.target.minPlayers) {
          return ctx.reply(`–  *H E I S T*

Personil kru belum mencukupi standar target.

┌  ◦  *Target* : ${heist.target.name}
│  ◦  *Required* : Minimal ${heist.target.minPlayers} Anggota
└  ◦  *Current* : ${filledRoles.length} Anggota Terkumpul`);
        }
        clearTimeout(heist.timer);
        activeHeists.delete(chatId);
        await sock.sendMessage(chatId, {
          text: `–  *E X E C U T I O N*

Sindikat memasuki area target ${heist.target.name}!
Alarm dinonaktifkan, seluruh kru bersiap di posisi masing-masing...`
        });
        const isSuccess = Math.random() <= heist.target.successRate;
        const allParticipants = filledRoles.map(([_, u]) => u);
        setTimeout(async () => {
          if (isSuccess) {
            const splitExp = Math.floor(heist.target.baseReward / allParticipants.length);
            allParticipants.forEach(pj => addExp(pj, splitExp));
            const crewLines = filledRoles.map(([r, u], idx, arr) => {
              const isLast = idx === arr.length - 1;
              const branch = isLast ? "└" : "│";
              return `${branch}  ◦  *${HEIST_ROLES[r].name}* : @${u.split("@")[0]}`;
            }).join("\n");
            const report = `–  *H E I S T  V I C T O R Y*

Sindikat berhasil membobol brankas dan membawa kabur jarahan!

┌  ◦  *Target* : ${heist.target.name}
│  ◦  *Total Loot* : +${heist.target.baseReward} EXP
└  ◦  *Share* : +${splitExp} EXP / anggota

–  *C R E W*

${crewLines}`;
            const successButtons = [{
              name: "quick_reply",
              buttonParamsJson: JSON.stringify({
                display_text: "🔫 Rencanakan Heist Baru",
                id: `${prefix}heist`
              })
            }];
            return await sendInteractive(report, botFooter, successButtons, {
              mentions: allParticipants,
              title: `✦ Perampokan Berhasil ✦`
            });
          } else {
            const jailDuration = 3 * 60 * 1e3;
            const penalty = heist.target.riskPenalty;
            const releaseAt = Date.now() + jailDuration;
            allParticipants.forEach(pj => {
              addExp(pj, -penalty);
              initDB(pj);
              global.db.user[pj].jail = releaseAt;
            });
            saveDB();
            const prisonerLines = allParticipants.map((u, idx, arr) => {
              const isLast = idx === arr.length - 1;
              const branch = isLast ? "└" : "│";
              return `${branch}  ◦  @${u.split("@")[0]} (-${penalty} EXP)`;
            }).join("\n");
            const failReport = `–  *B U S T E D*

Operasi perampokan gagal! Seluruh kru disergap aparat di pintu darurat!

┌  ◦  *Fine* : -${penalty} EXP / anggota
└  ◦  *Jail Time* : 3 Menit Tahanan

–  *P R I S O N E R S*

${prisonerLines}`;
            return await sock.sendMessage(chatId, {
              text: failReport,
              mentions: allParticipants
            });
          }
        }, 3500);
        return;
      }
      if (activeHeists.has(chatId)) {
        const heist = activeHeists.get(chatId);
        const {
          body,
          buttons,
          mentions
        } = renderLobbyMessage(heist);
        return await sendInteractive(body, botFooter, buttons, {
          mentions: mentions,
          title: `✦ Lobi Masih Berjalan ✦`,
          buttonTitle: "Ambil Peran"
        });
      }
      const jailTime = global.db.user[senderJid]?.jail || 0;
      if (jailTime > Date.now()) {
        const remaining = Math.ceil((jailTime - Date.now()) / 1e3);
        return ctx.reply(`❌ Anda masih berada di dalam sel tahanan selama *${remaining} detik* lagi.`);
      }
      const targetArg = (ctx.args?.[0] || "").toLowerCase();
      let chosenTarget = HEIST_TARGETS.find(t => t.id === targetArg);
      if (!chosenTarget) {
        const helpBody = `Hi ${userName}!
Bentuk kru sindikat profesional, jebol brankas, dan bagi hasil EXP jarahan.

–  *T A R G E T S*

┌  ◦  *Minimarket* : Mudah (Min 2 Orang • ~350 EXP)
│  ◦  *Toko Emas* : Menengah (Min 3 Orang • ~750 EXP)
└  ◦  *Bank* : High Risk (Min 4 Orang • ~1.600 EXP)

Pilih lokasi sasaran operasi melalui menu di bawah.`;
        const targetRows = HEIST_TARGETS.map(t => ({
          title: `${t.name}`,
          id: `${prefix}heist ${t.id}`,
          description: `Min ${t.minPlayers} Orang • Hadiah: ~${t.baseReward} EXP • Risiko: ${t.difficulty}`
        }));
        const helpButtons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "🎯 PILIH LOKASI SASARAN",
            sections: [{
              title: "TARGET OPERASI TERSEDIA",
              rows: targetRows
            }]
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🏪 Rampok Minimarket",
            id: `${prefix}heist minimarket`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🏛️ Rampok Bank",
            id: `${prefix}heist bank`
          })
        }];
        return await sendInteractive(helpBody, botFooter, helpButtons, {
          title: `✦ Rekrutmen Sindikat ✦`,
          buttonTitle: "Pilih Target"
        });
      }
      const TIMEOUT_SECONDS = 90;
      const timer = setTimeout(async () => {
        if (activeHeists.has(chatId)) {
          activeHeists.delete(chatId);
          const timeoutText = `–  *T I M E  O U T*

Waktu perekrutan kru 90 detik telah habis. Sindikat membubarkan diri.`;
          await sock.sendMessage(chatId, {
            text: timeoutText
          });
        }
      }, TIMEOUT_SECONDS * 1e3);
      const newHeist = {
        leader: senderJid,
        target: chosenTarget,
        roster: {
          hacker: senderJid,
          driller: null,
          muscle: null,
          driver: null
        },
        timer: timer
      };
      activeHeists.set(chatId, newHeist);
      const {
        body,
        buttons,
        mentions
      } = renderLobbyMessage(newHeist);
      return await sendInteractive(body, botFooter, buttons, {
        mentions: mentions,
        title: `✦ Persiapan Perampokan ✦`,
        buttonTitle: "Ambil Peran Spesialis"
      });
    } catch (err) {
      console.error("[Heist System Error]:", err);
      ctx.reply(`❌ Terjadi kendala teknis: ${err.message}`);
    }
  }
};