import db from "../../data/db.js";
import {
  simpleQuoted,
  metaQuoted
} from "../../lib/quoted.js";
const activeRaids = new Map();
const VEHICLE_CATALOG = [{
  id: "onthel",
  name: "Sepeda Onthel Tua Kuno",
  type: "Sepeda",
  price: 60,
  topSpeed: 30,
  fuelConsumption: 0,
  immuneRaid: true,
  desc: "Bebas tilang, ramah lingkungan, tapi bikin betis berotot."
}, {
  id: "beat",
  name: "Honda Beat Karbu Getar",
  type: "Motor",
  price: 350,
  topSpeed: 95,
  fuelConsumption: 5,
  immuneRaid: false,
  desc: "Motor sejuta umat. Lincah selap-selip di gang sempit."
}, {
  id: "rxking",
  name: "Yamaha RX-King Jet Darat",
  type: "Motor",
  price: 850,
  topSpeed: 140,
  fuelConsumption: 9,
  immuneRaid: false,
  desc: "Motor sangar 2-tak, tarikan jambret, knalpot berasap kencang."
}, {
  id: "vespa",
  name: "Vespa Tua Klasik 1985",
  type: "Motor",
  price: 550,
  topSpeed: 85,
  fuelConsumption: 6,
  immuneRaid: false,
  desc: "Gayanya anak retro, sesekali mogok di lampu merah."
}, {
  id: "innova",
  name: "Innova Diesel Cumi-Cumi",
  type: "Mobil",
  price: 2200,
  topSpeed: 180,
  fuelConsumption: 12,
  immuneRaid: false,
  desc: "Raja jalan tol, semburan asap hitam legam menutupi pandangan."
}];

function initDB(jid = null) {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.garages) global.db.garages = {};
  if (!global.db.licenses) global.db.licenses = {};
  if (jid) {
    if (!global.db.user[jid]) {
      global.db.user[jid] = {
        exp: 0
      };
    }
    if (!global.db.garages[jid]) {
      global.db.garages[jid] = {
        currentVehicle: null,
        vehicles: [],
        fuel: 100,
        hasBrong: false,
        tuneStage: 0
      };
    }
    if (!global.db.licenses[jid]) {
      global.db.licenses[jid] = {
        simC: false,
        simA: false
      };
    }
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

function getUserExp(jid) {
  if (!jid) return 0;
  initDB(jid);
  return global.db.user[jid].exp || 0;
}
export default {
  name: "kendaraan",
  aliases: ["garasi", "dealer", "belimotor", "belimobil", "bikinsim", "isibensin", "knalpotbrong", "balap", "dragrace", "razia", "pakaikendaraan"],
  description: "Simulasi Otomotif & Satlantas: Koleksi kendaraan, pasang knalpot mberr, ujian SIM, dan razia polisi! (Full DB & Interactive CTA)",
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
      const userGarage = global.db.garages[senderJid];
      if (!userGarage?.currentVehicle) return;
      if (userGarage.hasBrong && Math.random() < .25 && typeof ctx?.react === "function") {
        await ctx.react("💨");
      }
      const activeRaid = activeRaids.get(chatId);
      if (activeRaid && !activeRaid.fineList.has(senderJid)) {
        const vehicle = userGarage.currentVehicle;
        if (vehicle.immuneRaid) return;
        const userSim = global.db.licenses[senderJid] || {
          simC: false,
          simA: false
        };
        const needSimC = vehicle.type === "Motor" && !userSim.simC;
        const needSimA = vehicle.type === "Mobil" && !userSim.simA;
        const isIllegalExhaust = userGarage.hasBrong;
        if (needSimC || needSimA || isIllegalExhaust) {
          activeRaid.fineList.add(senderJid);
          const fineExp = isIllegalExhaust ? 150 : 80;
          addExp(senderJid, -fineExp);
          let reason = "";
          if (isIllegalExhaust && (needSimC || needSimA)) {
            reason = "Knalpot Brong Bising & Tidak Memiliki SIM Sah";
          } else if (isIllegalExhaust) {
            reason = "Knalpot Brong Tidak Standar";
          } else {
            reason = `Berkendara tanpa ${vehicle.type === "Motor" ? "SIM C" : "SIM A"}`;
          }
          const ticketText = `–  *P O L I C E  T I C K E T*

Anda terjaring dalam Operasi Patuh Satlantas.

┌  ◦  *Driver* : @${senderJid.split("@")[0]}
│  ◦  *Vehicle* : ${vehicle.name}
│  ◦  *Violation* : ${reason}
└  ◦  *Fine (ETLE)* : -${fineExp} EXP

Segera buat SIM di kantor Samsat (*.bikinsim*) dan gunakan knalpot standar.`;
          await sock.sendMessage(chatId, {
            text: ticketText,
            mentions: [senderJid]
          });
        }
      }
    } catch (err) {
      console.error("[Kendaraan Before Error]:", err.message);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      const chatId = ctx.id;
      const senderJid = ctx.sender;
      const senderNum = senderJid.split("@")[0];
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • Satlantas & Garage`;
      const userName = ctx.pushname || senderNum;
      const command = (ctx.command || "").toLowerCase();
      const mentioned = ctx.mentionedJid || [];
      const quotedMsg = typeof metaQuoted === "function" ? metaQuoted(ctx) : typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      initDB(senderJid);
      const myGarage = global.db.garages[senderJid];
      const mySim = global.db.licenses[senderJid];
      const sendInteractive = async (body, footer, buttons, extra = {}) => {
        const baseContextInfo = {
          mentionedJid: extra.mentions || [],
          ...global.bot?.utils?.contextInfo || {
            forwardingScore: 999,
            isForwarded: true
          }
        };
        const options = {
          title: extra.title || `✦ ${botName} • Garage & Traffic ✦`,
          subtitle: extra.subtitle || "Satlantas & Perhubungan",
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 2,
              divider_indices: [1],
              list_title: `${botName} • Panel Otomotif`,
              button_title: extra.buttonTitle || "Buka Menu"
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
      if (command === "kendaraan") {
        const activeName = myGarage.currentVehicle ? myGarage.currentVehicle.name : "Belum Ada";
        const userExp = getUserExp(senderJid);
        const body = `Hi ${userName}!
Selamat datang di panel otomotif & layanan Satlantas.

–  *V E H I C L E*

┌  ◦  *Driver* : @${senderNum}
│  ◦  *Active* : ${activeName}
│  ◦  *Balance* : ${userExp} EXP
└  ◦  *License* : SIM C [ ${mySim.simC ? "Active" : "None"} ] | SIM A [ ${mySim.simA ? "Active" : "None"} ]

Kelola garasi, beli kendaraan baru, atau ikuti ujian SIM melalui menu di bawah.`;
        const menuSections = [{
          title: "🏠 GARASI & KENDARAAN",
          rows: [{
            title: "🏠 Cek Isi Garasi",
            id: `${prefix}garasi`,
            description: "Lihat status bensin, top speed, dan unit kendaraan"
          }, {
            title: "🏪 Showroom Dealer",
            id: `${prefix}dealer`,
            description: "Katalog unit motor dan mobil baru"
          }, {
            title: "⛽ Isi Bensin Pertalite",
            id: `${prefix}isibensin`,
            description: "Isi penuh tangki bahan bakar kendaraan (50 EXP)"
          }, {
            title: "🔊 Knalpot Brong Racing",
            id: `${prefix}knalpotbrong`,
            description: "Pasang atau copot knalpot bising (+20 km/h)"
          }]
        }, {
          title: "🪪 SATLANTAS & POLISI",
          rows: [{
            title: "🪪 Loket Ujian SIM",
            id: `${prefix}bikinsim`,
            description: "Buat SIM C Motor atau SIM A Mobil (Resmi/Calo)"
          }, {
            title: "🚨 Mulai Operasi Razia",
            id: `${prefix}razia`,
            description: "Gelar razia polisi 60 detik di grup"
          }]
        }];
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "📂 PILIH MENU OTOMOTIF",
            sections: menuSections
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🏪 Showroom Dealer",
            id: `${prefix}dealer`
          })
        }];
        return await sendInteractive(body, botFooter, buttons, {
          mentions: [senderJid],
          title: `✦ Otomotif & Satlantas ✦`,
          buttonTitle: "Menu Otomotif"
        });
      }
      if (command === "dealer") {
        const body = `Hi ${userName}!
Berikut adalah katalog kendaraan resmi dealer yang tersedia.

–  *D E A L E R*

┌  ◦  *Customer* : @${senderNum}
│  ◦  *Balance* : ${getUserExp(senderJid)} EXP
└  ◦  *Catalog* : ${VEHICLE_CATALOG.length} Unit Tersedia

Pilih unit kendaraan yang ingin dibeli melalui menu di bawah.`;
        const catalogRows = VEHICLE_CATALOG.map(v => ({
          title: `${v.name}`.slice(0, 24),
          id: `${prefix}belimotor ${v.id}`,
          description: `Harga: ${v.price} EXP • Top Speed: ${v.topSpeed} km/h • ${v.type}`
        }));
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "🛒 PILIH KENDARAAN",
            sections: [{
              title: "KATALOG KENDARAAN RESMI",
              rows: catalogRows
            }]
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🏠 Cek Garasi",
            id: `${prefix}garasi`
          })
        }];
        return await sendInteractive(body, botFooter, buttons, {
          title: `✦ Showroom Dealer Resmi ✦`,
          buttonTitle: "Pilih Unit"
        });
      }
      if (command === "belimotor" || command === "belimobil") {
        const targetId = (ctx.args?.[0] || "").toLowerCase();
        if (!targetId) {
          return ctx.reply(`–  *D E A L E R*

Silakan tentukan kode kendaraan yang ingin dibeli.

┌  ◦  *Format* : ${prefix}belimotor <id>
└  ◦  *Example* : ${prefix}belimotor beat`);
        }
        const vehicle = VEHICLE_CATALOG.find(v => v.id === targetId);
        if (!vehicle) {
          return ctx.reply(`❌ Kendaraan [${targetId}] tidak ditemukan di dealer. Ketik *${prefix}dealer* untuk melihat katalog.`);
        }
        const userExp = getUserExp(senderJid);
        if (userExp < vehicle.price) {
          return ctx.reply(`–  *D E A L E R*

Saldo EXP Anda tidak mencukupi untuk unit ini.

┌  ◦  *Price* : ${vehicle.price} EXP
└  ◦  *Your EXP* : ${userExp} EXP`);
        }
        const isOwned = myGarage.vehicles.some(v => v.id === vehicle.id);
        if (isOwned) {
          return ctx.reply("❌ Anda sudah memiliki unit kendaraan ini di dalam garasi.");
        }
        addExp(senderJid, -vehicle.price);
        myGarage.vehicles.push(vehicle);
        myGarage.currentVehicle = vehicle;
        myGarage.fuel = 100;
        saveDB();
        const body = `Hi ${userName}!
Pembelian unit kendaraan berhasil diselesaikan.

–  *R E G I S T R A T I O N*

┌  ◦  *Owner* : @${senderNum}
│  ◦  *Unit* : ${vehicle.name}
│  ◦  *Top Speed* : ${vehicle.topSpeed} km/h
└  ◦  *Fuel Tank* : 100% Pertalite

Pastikan Anda memiliki SIM (*${prefix}bikinsim*) agar bebas dari tilang razia polisi.`;
        const buttons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🏠 Cek Garasi",
            id: `${prefix}garasi`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🪪 Bikin SIM",
            id: `${prefix}bikinsim`
          })
        }];
        return await sendInteractive(body, botFooter, buttons, {
          mentions: [senderJid],
          title: `✦ Kendaraan Terdaftar ✦`
        });
      }
      if (command === "pakaikendaraan") {
        const switchId = (ctx.args?.[0] || "").toLowerCase();
        const found = myGarage.vehicles.find(v => v.id === switchId);
        if (!found) {
          return ctx.reply("❌ Kendaraan tersebut tidak ada di dalam garasi Anda.");
        }
        myGarage.currentVehicle = found;
        saveDB();
        return ctx.reply(`–  *G A R A G E*

Kendaraan aktif berhasil diganti menjadi *${found.name}*.`);
      }
      if (command === "garasi") {
        if (!myGarage.currentVehicle) {
          const emptyBody = `–  *G A R A G E*

Garasi Anda masih kosong.

┌  ◦  *Owner* : @${senderNum}
└  ◦  *Status* : Belum memiliki kendaraan

Kunjungi dealer resmi (*${prefix}dealer*) untuk membeli kendaraan pertamamu.`;
          const buttons = [{
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "🏪 Showroom Dealer",
              id: `${prefix}dealer`
            })
          }];
          return await sendInteractive(emptyBody, botFooter, buttons, {
            mentions: [senderJid],
            title: `✦ Garasi Kosong ✦`
          });
        }
        const v = myGarage.currentVehicle;
        const speedBonus = (myGarage.hasBrong ? 20 : 0) + (myGarage.tuneStage || 0) * 15;
        const finalSpeed = v.topSpeed + speedBonus;
        const body = `Hi ${userName}!
Berikut adalah data kendaraan yang terparkir di garasi Anda.

–  *G A R A G E*

┌  ◦  *Owner* : @${senderNum}
│  ◦  *Active* : ${v.name}
│  ◦  *Max Speed* : ${finalSpeed} km/h ${speedBonus > 0 ? `(+${speedBonus} Modif)` : ""}
│  ◦  *Fuel* : ${v.fuelConsumption > 0 ? `${myGarage.fuel}%` : "Tanpa Bensin"}
│  ◦  *Exhaust* : ${myGarage.hasBrong ? "Knalpot Brong (Racing)" : "Standar Pabrik"}
│  ◦  *SIM C* : ${mySim.simC ? "Active" : "None"}
└  ◦  *SIM A* : ${mySim.simA ? "Active" : "None"}

Koleksi kendaraan Anda: ${myGarage.vehicles.length} unit di garasi.`;
        const buttons = [];
        if (myGarage.vehicles.length > 1) {
          const switchRows = myGarage.vehicles.map(veh => ({
            title: `Kendarai ${veh.name}`.slice(0, 24),
            id: `${prefix}pakaikendaraan ${veh.id}`,
            description: `Tipe: ${veh.type} | Top Speed: ${veh.topSpeed} km/h`
          }));
          buttons.push({
            name: "single_select",
            buttonParamsJson: JSON.stringify({
              title: "🔄 GANTI KENDARAAN",
              sections: [{
                title: "UNIT DI GARASI ANDA",
                rows: switchRows
              }]
            })
          });
        }
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "⛽ Isi Bensin",
            id: `${prefix}isibensin`
          })
        });
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🔊 Knalpot Brong",
            id: `${prefix}knalpotbrong`
          })
        });
        return await sendInteractive(body, botFooter, buttons, {
          mentions: [senderJid],
          title: `✦ Garasi Pribadi ✦`,
          buttonTitle: "Ganti Unit"
        });
      }
      if (command === "bikinsim") {
        const simType = (ctx.args?.[0] || "").toUpperCase();
        const jalur = (ctx.args?.[1] || "").toLowerCase();
        if (!simType || !["C", "A"].includes(simType)) {
          const simBody = `–  *S A M S A T*

Layanan permohonan Surat Izin Mengemudi (SIM).

┌  ◦  *Driver* : @${senderNum}
│  ◦  *SIM C* : ${mySim.simC ? "Active" : "None"}
└  ◦  *SIM A* : ${mySim.simA ? "Active" : "None"}

Pilih jenis SIM dan metode ujian melalui menu di bawah.`;
          const simRows = [{
            title: "🛵 SIM C Motor (Jalur Tes)",
            id: `${prefix}bikinsim C tes`,
            description: "Biaya: 75 EXP • Lulus tes angka 8 tanpa jatuh kaki"
          }, {
            title: "🛵 SIM C Motor (Jalur Calo)",
            id: `${prefix}bikinsim C nembak`,
            description: "Biaya: 300 EXP • 100% Terbit kilat dibantu ordal"
          }, {
            title: "🏎️ SIM A Mobil (Jalur Tes)",
            id: `${prefix}bikinsim A tes`,
            description: "Biaya: 75 EXP • Lulus tes tanjakan & parkir paralel"
          }, {
            title: "🏎️ SIM A Mobil (Jalur Calo)",
            id: `${prefix}bikinsim A nembak`,
            description: "Biaya: 300 EXP • 100% Terbit kilat tanpa tes"
          }];
          const simButtons = [{
            name: "single_select",
            buttonParamsJson: JSON.stringify({
              title: "🪪 PILIH JALUR SIM",
              sections: [{
                title: "LOKET SATPAS RESMI",
                rows: simRows
              }]
            })
          }, {
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "🏠 Cek Garasi",
              id: `${prefix}garasi`
            })
          }];
          return await sendInteractive(simBody, botFooter, simButtons, {
            mentions: [senderJid],
            title: `✦ Satpas SIM Satlantas ✦`,
            buttonTitle: "Pilih Jalur SIM"
          });
        }
        if (simType === "C" && mySim.simC) {
          return ctx.reply("✅ Anda sudah memiliki SIM C Motor yang sah.");
        }
        if (simType === "A" && mySim.simA) {
          return ctx.reply("✅ Anda sudah memiliki SIM A Mobil yang sah.");
        }
        if (jalur === "nembak" || jalur === "calo") {
          const CALO_COST = 300;
          if (getUserExp(senderJid) < CALO_COST) {
            return ctx.reply(`❌ Saldo EXP Anda kurang untuk jalur calo (*${CALO_COST} EXP*).`);
          }
          addExp(senderJid, -CALO_COST);
          if (simType === "C") mySim.simC = true;
          if (simType === "A") mySim.simA = true;
          saveDB();
          const caloBody = `–  *L I C E N S E*

Penerbitan SIM ${simType} kilat berhasil diselesaikan.

┌  ◦  *Owner* : @${senderNum}
│  ◦  *Type* : SIM ${simType}
│  ◦  *Fee* : -${CALO_COST} EXP
└  ◦  *Status* : Resmi Terbit (Jalur Calo)`;
          const buttons = [{
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "🏠 Masuk Garasi",
              id: `${prefix}garasi`
            })
          }];
          return await sendInteractive(caloBody, botFooter, buttons, {
            mentions: [senderJid],
            title: `✦ SIM Resmi Terbit ✦`
          });
        }
        const RESMI_COST = 75;
        if (getUserExp(senderJid) < RESMI_COST) {
          return ctx.reply(`❌ Biaya pendaftaran ujian SIM resmi adalah *${RESMI_COST} EXP*.`);
        }
        addExp(senderJid, -RESMI_COST);
        const isPassed = Math.random() < .65;
        if (isPassed) {
          if (simType === "C") mySim.simC = true;
          if (simType === "A") mySim.simA = true;
          saveDB();
          const passBody = `–  *L I C E N S E*

Selamat, Anda dinyatakan lulus ujian praktik SIM ${simType}!

┌  ◦  *Driver* : @${senderNum}
│  ◦  *Type* : SIM ${simType}
└  ◦  *Status* : Resmi Terbit`;
          const buttons = [{
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "🏠 Cek Garasi",
              id: `${prefix}garasi`
            })
          }];
          return await sendInteractive(passBody, botFooter, buttons, {
            mentions: [senderJid],
            title: `✦ Lulus Ujian Praktik ✦`
          });
        } else {
          return ctx.reply(`–  *F A I L E D*

Anda gagal dalam ujian praktik SIM ${simType} (-${RESMI_COST} EXP).
Silakan coba lagi nanti atau gunakan jalur nembak calo (*${prefix}bikinsim ${simType} nembak*).`, {
            mentions: [senderJid]
          });
        }
      }
      if (command === "isibensin") {
        if (!myGarage.currentVehicle) {
          return ctx.reply("❌ Anda tidak memiliki kendaraan untuk diisi bensin.");
        }
        if (myGarage.currentVehicle.fuelConsumption === 0) {
          return ctx.reply("🚲 Sepeda onthel bertenaga fisik, tidak membutuhkan bensin.");
        }
        if (myGarage.fuel >= 100) {
          return ctx.reply("⛽ Tangki bensin kendaraan Anda sudah penuh (100%).");
        }
        const FUEL_COST = 50;
        if (getUserExp(senderJid) < FUEL_COST) {
          return ctx.reply(`❌ Saldo EXP Anda tidak cukup untuk membeli Pertalite (*${FUEL_COST} EXP*).`);
        }
        addExp(senderJid, -FUEL_COST);
        myGarage.fuel = 100;
        saveDB();
        const fuelBody = `–  *S P B U*

Pengisian bahan bakar Pertalite telah selesai.

┌  ◦  *Vehicle* : ${myGarage.currentVehicle.name}
│  ◦  *Cost* : -${FUEL_COST} EXP
└  ◦  *Fuel Tank* : 100% Penuh`;
        const buttons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🏠 Buka Garasi",
            id: `${prefix}garasi`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🏁 Mulai Balapan",
            id: `${prefix}balap`
          })
        }];
        return await sendInteractive(fuelBody, botFooter, buttons, {
          mentions: [senderJid],
          title: `✦ Tangki Bensin Penuh ✦`
        });
      }
      if (command === "knalpotbrong") {
        if (!myGarage.currentVehicle || myGarage.currentVehicle.type === "Sepeda") {
          return ctx.reply("❌ Hanya motor atau mobil bermesin yang dapat dipasangi knalpot racing.");
        }
        myGarage.hasBrong = !myGarage.hasBrong;
        saveDB();
        if (myGarage.hasBrong) {
          const brongBody = `–  *E X H A U S T*

Knalpot racing brong berhasil dipasang.

┌  ◦  *Sound* : BBRRR BLARRR! Menggeber saat chat di grup
│  ◦  *Performance* : +20 km/h Top Speed
└  ◦  *Risk* : Rawan razia Satlantas

Ketik *${prefix}knalpotbrong* lagi jika ingin mengembalikan ke knalpot standar.`;
          const buttons = [{
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "🏠 Cek Garasi",
              id: `${prefix}garasi`
            })
          }, {
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "🔇 Copot Knalpot",
              id: `${prefix}knalpotbrong`
            })
          }];
          return await sendInteractive(brongBody, botFooter, buttons, {
            title: `✦ Knalpot Racing Dipasang ✦`
          });
        } else {
          return ctx.reply(`–  *E X H A U S T*

Knalpot standar pabrik kembali dipasang. Suara mesin kembali halus dan bebas razia.`);
        }
      }
      if (command === "razia") {
        if (activeRaids.has(chatId)) {
          return ctx.reply("🚨 Operasi Patuh Satlantas sedang berlangsung di grup ini.");
        }
        const RAID_DURATION = 60;
        const timer = setTimeout(async () => {
          if (activeRaids.has(chatId)) {
            const raidData = activeRaids.get(chatId);
            const count = raidData.fineList.size;
            activeRaids.delete(chatId);
            const raidEndText = `–  *R A I D  E N D E D*

Operasi razia kepolisian telah berakhir.
Total pelanggar lalu lintas yang terjaring tilang: ${count} orang.`;
            await sock.sendMessage(chatId, {
              text: raidEndText
            });
          }
        }, RAID_DURATION * 1e3);
        activeRaids.set(chatId, {
          startTime: Date.now(),
          fineList: new Set(),
          timer: timer
        });
        const raidBody = `–  *P O L I C E  R A I D*

Operasi Patuh Zebra Satlantas sedang berlangsung di grup!

┌  ◦  *Duration* : 60 Detik Siaga
│  ◦  *Target 1* : Pengendara tanpa SIM C / SIM A sah
└  ◦  *Target 2* : Pengendara knalpot brong

Anggota yang mengirim chat tanpa kelengkapan surat akan langsung dijatuhi denda tilang ETLE!`;
        const buttons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🪪 Bikin SIM",
            id: `${prefix}bikinsim`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🏠 Ke Garasi",
            id: `${prefix}garasi`
          })
        }];
        return await sendInteractive(raidBody, botFooter, buttons, {
          title: `✦ Operasi Razia Dimulai ✦`
        });
      }
      if (command === "balap" || command === "dragrace") {
        if (!myGarage.currentVehicle) {
          return ctx.reply("❌ Anda tidak memiliki kendaraan untuk diajak balapan.");
        }
        const target = mentioned[0];
        if (!target) {
          return ctx.reply(`–  *D R A G  R A C E*

Tantang kawan Anda adu cepat di jalan tol.

┌  ◦  *Format* : ${prefix}balap @user [taruhan]
└  ◦  *Example* : ${prefix}balap @user 100`);
        }
        if (target === senderJid) {
          return ctx.reply("❌ Anda tidak bisa balapan melawan diri sendiri.");
        }
        initDB(target);
        const opponentGarage = global.db.garages[target];
        if (!opponentGarage?.currentVehicle) {
          return ctx.reply("❌ Lawan yang Anda tantang belum memiliki kendaraan di garasinya.");
        }
        const betAmount = Math.max(20, parseInt(ctx.args?.[1], 10) || 50);
        if (getUserExp(senderJid) < betAmount) {
          return ctx.reply(`❌ Saldo EXP Anda tidak cukup untuk taruhan sebesar *${betAmount} EXP*.`);
        }
        if (getUserExp(target) < betAmount) {
          return ctx.reply(`❌ Lawan tidak memiliki cukup EXP (*${betAmount} EXP*) untuk taruhan ini.`);
        }
        if (myGarage.fuel < 10) return ctx.reply("⛽ Bensin Anda sekarat. Silakan isi bensin di SPBU.");
        if (opponentGarage.fuel < 10) return ctx.reply("⛽ Bensin lawan sedang tiris untuk tancap gas.");
        myGarage.fuel -= 10;
        opponentGarage.fuel -= 10;
        saveDB();
        const mySpeed = myGarage.currentVehicle.topSpeed + (myGarage.hasBrong ? 20 : 0) + Math.floor(Math.random() * 30);
        const oppSpeed = opponentGarage.currentVehicle.topSpeed + (opponentGarage.hasBrong ? 20 : 0) + Math.floor(Math.random() * 30);
        const isUserWinner = mySpeed >= oppSpeed;
        const winnerJid = isUserWinner ? senderJid : target;
        const loserJid = isUserWinner ? target : senderJid;
        addExp(winnerJid, betAmount);
        addExp(loserJid, -betAmount);
        const resultText = `–  *D R A G  R A C E*

Hasil adu balap jalan tol malam hari:

┌  ◦  *Player 1* : @${senderNum} (${mySpeed} km/h)
│  ◦  *Player 2* : @${target.split("@")[0]} (${oppSpeed} km/h)
│  ◦  *Winner* : @${winnerJid.split("@")[0]}
└  ◦  *Prize* : +${betAmount} EXP

Selamat kepada pemenang balapan!`;
        await sock.sendMessage(chatId, {
          text: resultText,
          mentions: [senderJid, target, winnerJid]
        });
      }
    } catch (err) {
      console.error("[Kendaraan System Error]:", err);
      ctx.reply(`❌ Terjadi kendala teknis lalu lintas: ${err.message}`);
    }
  }
};