import db from "../../data/db.js";
import {
  simpleQuoted,
  metaQuoted
} from "../../lib/quoted.js";
const CURSE_TYPES = {
  tuyul: {
    id: "tuyul",
    name: "Santet Tuyul Gondrong",
    desc: "Menyedot 15 EXP korban setiap kali korban mengirim chat di grup.",
    cost: 150,
    durationHours: 2
  },
  bisu: {
    id: "bisu",
    name: "Santet Sumpah Bisu",
    desc: "Menyumpahi korban agar lidahnya kelu & chatnya selalu dibungkam bot.",
    cost: 100,
    durationHours: 1
  },
  apes: {
    id: "apes",
    name: "Santet Bau Kemenyan",
    desc: "Membuat korban sial, setiap chat di grup didenda 20 EXP karena aura negatif.",
    cost: 120,
    durationHours: 1.5
  }
};

function initDB(jid = null) {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.curses) global.db.curses = {};
  if (!global.db.wards) global.db.wards = {};
  if (jid && !global.db.user[jid]) {
    global.db.user[jid] = {
      exp: 0
    };
  }
}

function saveDB() {
  if (typeof db?.write === "function" && global.db) {
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

function getUserExp(jid) {
  if (!jid) return 0;
  initDB(jid);
  return global.db.user[jid].exp || 0;
}
export default {
  name: "santet",
  aliases: ["dukun", "ruqyah", "pagargaib", "jimat", "terawang", "ceksantet", "tokodukun", "buangbalak"],
  description: "Klinik Dukun Warga: Kirim santet tuyul, pasang pagar gaib, atau ruqyah kawanmu! (Full DB & Interactive CTA)",
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
      const curse = global.db.curses[senderJid];
      if (!curse) return;
      const now = Date.now();
      if (now > curse.expireAt) {
        delete global.db.curses[senderJid];
        saveDB();
        const endText = `–  *C U R S E  E N D E D*

Kutukan gaib pada @${senderJid.split("@")[0]} telah habis dan sirna.`;
        return await sock.sendMessage(chatId, {
          text: endText,
          mentions: [senderJid]
        });
      }
      if (curse.curseType === "tuyul") {
        const stealAmount = 15;
        addExp(senderJid, -stealAmount);
        addExp(curse.casterJid, stealAmount);
        curse.stolenTotal = (curse.stolenTotal || 0) + stealAmount;
        saveDB();
        if (typeof ctx?.react === "function") await ctx.react("👶");
        if (Math.random() < .2) {
          const tuyulText = `–  *T U Y U L*

Tuyul peliharaan @${curse.casterJid.split("@")[0]} berhasil mencuri 15 EXP dari @${senderJid.split("@")[0]}!`;
          await sock.sendMessage(chatId, {
            text: tuyulText,
            mentions: [curse.casterJid, senderJid]
          });
        }
      } else if (curse.curseType === "bisu") {
        if (typeof ctx?.react === "function") await ctx.react("🤐");
      } else if (curse.curseType === "apes") {
        addExp(senderJid, -20);
        if (typeof ctx?.react === "function") await ctx.react("💨");
      }
    } catch (err) {
      console.error("[Santet Before Error]:", err.message);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      const chatId = ctx.id;
      const senderJid = ctx.sender;
      const senderNum = senderJid.split("@")[0];
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • Shaman Clinic`;
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
          title: extra.title || `✦ ${botName} • Shaman Clinic ✦`,
          subtitle: extra.subtitle || "Layanan Spiritual Warga",
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 2,
              divider_indices: [1],
              list_title: `${botName} • Ritual Gaib`,
              button_title: extra.buttonTitle || "Buka Layanan"
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
      if (command === "pagargaib" || command === "jimat") {
        const WARD_COST = 200;
        const now = Date.now();
        const activeWard = global.db.wards[senderJid];
        if (activeWard && activeWard.expireAt > now) {
          const sisaMenit = Math.ceil((activeWard.expireAt - now) / 6e4);
          return ctx.reply(`–  *P A G A R  G A I B*

Perisai gaib Anda masih aktif.

┌  ◦  *Remaining* : ${sisaMenit}m
└  ◦  *Status* : Protected`);
        }
        if (getUserExp(senderJid) < WARD_COST) {
          return ctx.reply(`–  *P A G A R  G A I B*

Modal mahar tidak mencukupi.

┌  ◦  *Required* : ${WARD_COST} EXP
└  ◦  *Your EXP* : ${getUserExp(senderJid)} EXP`);
        }
        addExp(senderJid, -WARD_COST);
        const expireAt = now + 24 * 60 * 60 * 1e3;
        global.db.wards[senderJid] = {
          expireAt: expireAt,
          wardName: "Rajah Kebal Santet"
        };
        saveDB();
        const body = `Hi ${userName}!
Perisai pagar gaib berhasil diaktifkan.

–  *P A G A R  G A I B*

┌  ◦  *Owner* : @${senderNum}
│  ◦  *Protection* : Rajah Kebal Santet
│  ◦  *Duration* : 24 Jam
└  ◦  *Effect* : Memantulkan santet kembali ke pengirim`;
        const buttons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "👁️ Terawang Diri",
            id: `${prefix}terawang`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "📜 Klinik Santet",
            id: `${prefix}santet`
          })
        }];
        return await sendInteractive(body, botFooter, buttons, {
          mentions: [senderJid],
          title: `✦ Pagar Gaib Aktif ✦`
        });
      }
      if (command === "ruqyah") {
        const target = mentioned[0] || senderJid;
        const isSelf = target === senderJid;
        initDB(target);
        if (!global.db.curses[target]) {
          return ctx.reply(isSelf ? "✨ Tubuh Anda bersih, tidak ada hawa santet yang menempel." : `✨ Sahabat @${target.split("@")[0]} bersih dan tidak sedang terkena santet apapun.`, {
            mentions: [target]
          });
        }
        const RUQYAH_COST = 80;
        if (getUserExp(senderJid) < RUQYAH_COST) {
          return ctx.reply(`–  *R U Q Y A H*

Biaya infak ruqyah tidak mencukupi.

┌  ◦  *Required* : ${RUQYAH_COST} EXP
└  ◦  *Your EXP* : ${getUserExp(senderJid)} EXP`);
        }
        addExp(senderJid, -RUQYAH_COST);
        const curseData = global.db.curses[target];
        delete global.db.curses[target];
        saveDB();
        const body = `–  *R U Q Y A H*

Ritual pembersihan gaib berhasil diselesaikan.

┌  ◦  *Healer* : @${senderNum}
│  ◦  *Target* : @${target.split("@")[0]}
└  ◦  *Cleansed* : ${curseData.curseName}

Pengaruh santet telah dinetralisir sepenuhnya.`;
        const buttons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🧿 Pasang Pagar Gaib",
            id: `${prefix}pagargaib`
          })
        }];
        return await sendInteractive(body, botFooter, buttons, {
          mentions: [senderJid, target],
          title: `✦ Ruqyah Selesai ✦`
        });
      }
      if (command === "terawang" || command === "ceksantet") {
        const target = mentioned[0] || senderJid;
        const now = Date.now();
        initDB(target);
        const targetWard = global.db.wards[target];
        let statusWard = "Tidak ada";
        if (targetWard && targetWard.expireAt > now) {
          const sisaMenit = Math.ceil((targetWard.expireAt - now) / 6e4);
          statusWard = `${targetWard.wardName} (${sisaMenit}m)`;
        } else if (targetWard && targetWard.expireAt <= now) {
          delete global.db.wards[target];
          saveDB();
        }
        const targetCurse = global.db.curses[target];
        let statusCurse = "Bersih";
        if (targetCurse && targetCurse.expireAt > now) {
          const sisaMenit = Math.ceil((targetCurse.expireAt - now) / 6e4);
          statusCurse = `${targetCurse.curseName} (${sisaMenit}m)`;
        } else if (targetCurse && targetCurse.expireAt <= now) {
          delete global.db.curses[target];
          saveDB();
        }
        const body = `–  *T E R A W A N G*

┌  ◦  *Subject* : @${target.split("@")[0]}
│  ◦  *Protection* : ${statusWard}
└  ◦  *Curse Status* : ${statusCurse}

Ketik *${prefix}ruqyah* jika ada kutukan yang terdeteksi.`;
        const buttons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "📿 Lakukan Ruqyah",
            id: `${prefix}ruqyah @${target.split("@")[0]}`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🧿 Pasang Pagar Gaib",
            id: `${prefix}pagargaib`
          })
        }];
        return await sendInteractive(body, botFooter, buttons, {
          mentions: [target, ...global.db.curses[target] ? [global.db.curses[target].casterJid] : []],
          title: `✦ Penerawangan Gaib ✦`
        });
      }
      if (command === "santet" || command === "dukun" || command === "tokodukun") {
        const target = mentioned[0];
        if (!target) {
          const helpBody = `Hi ${userName}!
Klinik dukun dan layanan spiritual warga.

–  *D U K U N*

┌  ◦  *Balance* : ${getUserExp(senderJid)} EXP
│  ◦  *Cast Curse* : ${prefix}santet @user <jenis>
│  ◦  *Protection* : ${prefix}pagargaib
└  ◦  *Ruqyah* : ${prefix}ruqyah @user

Pilih layanan spiritual atau katalog kutukan melalui menu di bawah.`;
          const menuSections = [{
            title: "🛡️ LAYANAN SPIRITUAL",
            rows: [{
              title: "🧿 Pasang Pagar Gaib",
              id: `${prefix}pagargaib`,
              description: "Lindungi diri dari santet selama 24 jam (200 EXP)"
            }, {
              title: "👁️ Terawang Diri",
              id: `${prefix}terawang`,
              description: "Periksa keberadaan kutukan di tubuh Anda"
            }, {
              title: "📿 Ruqyah Diri",
              id: `${prefix}ruqyah`,
              description: "Bersihkan kutukan yang sedang menyerang (80 EXP)"
            }]
          }, {
            title: "💀 KATALOG ILMU SANTET",
            rows: Object.values(CURSE_TYPES).map(c => ({
              title: `${c.name}`,
              id: `${prefix}santet`,
              description: `Mahar: ${c.cost} EXP | Durasi: ${c.durationHours} Jam`
            }))
          }];
          const helpButtons = [{
            name: "single_select",
            buttonParamsJson: JSON.stringify({
              title: "📜 MENU LAYANAN GAIB",
              sections: menuSections
            })
          }, {
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "🧿 Pasang Pagar Gaib",
              id: `${prefix}pagargaib`
            })
          }];
          return await sendInteractive(helpBody, botFooter, helpButtons, {
            title: `✦ Klinik Dukun Warga ✦`,
            buttonTitle: "Pilih Layanan"
          });
        }
        if (target === senderJid) {
          return ctx.reply("❌ Anda tidak dapat menyantet diri Anda sendiri.");
        }
        const curseArg = (ctx.args?.[1] || "").toLowerCase();
        if (!curseArg || !CURSE_TYPES[curseArg]) {
          const targetNum = target.split("@")[0];
          const selectBody = `–  *C H O O S E  C U R S E*

┌  ◦  *Target* : @${targetNum}
└  ◦  *Your Balance* : ${getUserExp(senderJid)} EXP

Pilih jenis santet yang ingin dikirimkan ke target melalui menu di bawah.`;
          const curseRows = Object.values(CURSE_TYPES).map(c => ({
            title: `${c.name}`,
            id: `${prefix}santet @${targetNum} ${c.id}`,
            description: `Mahar: ${c.cost} EXP • ${c.desc.slice(0, 45)}...`
          }));
          const curseButtons = [{
            name: "single_select",
            buttonParamsJson: JSON.stringify({
              title: `🎯 PILIH SANTET UNTUK @${targetNum}`,
              sections: [{
                title: "JENIS SANTET TERSEDIA",
                rows: curseRows
              }]
            })
          }, {
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "👁️ Terawang Korban",
              id: `${prefix}terawang @${targetNum}`
            })
          }];
          return await sendInteractive(selectBody, botFooter, curseButtons, {
            mentions: [target],
            title: `✦ Pilih Ilmu Santet ✦`,
            buttonTitle: "Pilih Kutukan"
          });
        }
        initDB(target);
        const selectedCurse = CURSE_TYPES[curseArg];
        const userExp = getUserExp(senderJid);
        if (userExp < selectedCurse.cost) {
          return ctx.reply(`–  *S A N T E T*

Mahar tidak mencukupi untuk ${selectedCurse.name}.

┌  ◦  *Cost* : ${selectedCurse.cost} EXP
└  ◦  *Your EXP* : ${userExp} EXP`);
        }
        const now = Date.now();
        const targetWard = global.db.wards[target];
        if (targetWard && targetWard.expireAt > now) {
          addExp(senderJid, -selectedCurse.cost);
          global.db.curses[senderJid] = {
            casterJid: target,
            curseType: selectedCurse.id,
            curseName: selectedCurse.name,
            expireAt: now + selectedCurse.durationHours * 60 * 60 * 1e3,
            stolenTotal: 0
          };
          saveDB();
          const bounceButtons = [{
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "📿 Ruqyah Diri Sendiri",
              id: `${prefix}ruqyah`
            })
          }];
          const bounceBody = `–  *B O U N C E D*

Santet memantul balik karena target dilindungi Pagar Gaib!

┌  ◦  *Caster* : @${senderNum}
│  ◦  *Target* : @${target.split("@")[0]}
└  ◦  *Victim* : @${senderNum} (Senjata Makan Tuan)

Kutukan ${selectedCurse.name} kini berbalik menghantam pengirim sendiri.`;
          return await sendInteractive(bounceBody, botFooter, bounceButtons, {
            mentions: [senderJid, target],
            title: `✦ Santet Memantul Balik ✦`
          });
        }
        const targetCurse = global.db.curses[target];
        if (targetCurse && targetCurse.expireAt > now) {
          return ctx.reply(`⚠️ Target @${target.split("@")[0]} masih menanggung kutukan santet lain. Tunggu sampai masa kutukannya habis.`, {
            mentions: [target]
          });
        }
        addExp(senderJid, -selectedCurse.cost);
        global.db.curses[target] = {
          casterJid: senderJid,
          curseType: selectedCurse.id,
          curseName: selectedCurse.name,
          expireAt: now + selectedCurse.durationHours * 60 * 60 * 1e3,
          stolenTotal: 0
        };
        saveDB();
        const body = `–  *C U R S E  C A S T*

Ritual pengiriman santet berhasil diselesaikan.

┌  ◦  *Caster* : @${senderNum}
│  ◦  *Target* : @${target.split("@")[0]}
│  ◦  *Curse* : ${selectedCurse.name}
└  ◦  *Duration* : ${selectedCurse.durationHours} Jam

${selectedCurse.desc}`;
        const buttons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "📿 Tolong Ruqyah Korban",
            id: `${prefix}ruqyah @${target.split("@")[0]}`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🧿 Pasang Pagar Gaib",
            id: `${prefix}pagargaib`
          })
        }];
        return await sendInteractive(body, botFooter, buttons, {
          mentions: [senderJid, target],
          title: `✦ Ritual Santet Berhasil ✦`
        });
      }
    } catch (err) {
      console.error("[Santet System Error]:", err);
      ctx.reply(`❌ Terjadi kesalahan: ${err.message}`);
    }
  }
};