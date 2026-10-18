import db from "../../data/db.js";
import {
  simpleQuoted,
  metaQuoted
} from "../../lib/quoted.js";
const pendingOffers = new Map();
const FOOD_MENU = [{
  id: "sandal",
  name: "Sandal Swallow Bekas",
  cost: 10,
  fill: 15,
  desc: "Pakan hemat darurat • Kenyang +15%"
}, {
  id: "nasbung",
  name: "Nasi Bungkus Karet Dua",
  cost: 25,
  fill: 35,
  desc: "Penuh karbohidrat & lauk • Kenyang +35%"
}, {
  id: "seblak",
  name: "Seblak Pedas Level 100",
  cost: 40,
  fill: 50,
  desc: "Paling bikin melek • Kenyang +50%"
}, {
  id: "kobokan",
  name: "Air Kobokan Warteg",
  cost: 5,
  fill: 10,
  desc: "Penghilang dahaga kilat • Kenyang +10%"
}];

function initDB(jid = null) {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.pets) global.db.pets = {};
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

function getUserExp(jid) {
  if (!jid) return 0;
  initDB(jid);
  return global.db.user[jid].exp || 0;
}
export default {
  name: "adopsi",
  aliases: ["babu", "pelihara", "kasihmakan", "gigit", "suruhkerja", "kabur", "cekpeliharaan", "terimababu", "tolakbabu"],
  description: "Fitur adopsi teman jadi babu/peliharaan interaktif di grup (Full DB & Interactive CTA)",
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
      const petData = global.db.pets[senderJid];
      if (!petData || petData.groupId !== chatId) return;
      const text = (ctx?.text || ctx?.query || msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "").trim();
      if (!text) return;
      if (petData.hunger <= 15) {
        if (typeof ctx?.react === "function") await ctx.react("💀");
        if (Math.random() < .2) {
          const starveText = `–  *S T A R V I N G*

Peliharaan @${senderJid.split("@")[0]} lemas kelaparan!
Majikan @${petData.ownerJid.split("@")[0]} tolong beri makan (*${ctx.prefix || "."}kasihmakan*).`;
          await sock.sendMessage(chatId, {
            text: starveText,
            mentions: [senderJid, petData.ownerJid]
          });
        }
        return;
      }
      if (text.toLowerCase().includes("majikan") || text.includes(petData.ownerJid.split("@")[0])) {
        petData.loyalty = Math.min(100, (petData.loyalty || 0) + 2);
        saveDB();
        addExp(senderJid, 10);
        if (typeof ctx?.react === "function") await ctx.react("🐕");
      }
    } catch (e) {
      console.error("[Adopsi Before Error]:", e.message);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      const chatId = ctx.id;
      const senderJid = ctx.sender;
      const senderNum = senderJid.split("@")[0];
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • Pet & Babu Care`;
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
          title: extra.title || `✦ ${botName} • Pet Care ✦`,
          subtitle: extra.subtitle || "Simulasi Babu & Majikan",
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 2,
              divider_indices: [1],
              list_title: `${botName} • Aksi Babu`,
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
      if ((command === "adopsi" || command === "babu") && (!ctx.args || ctx.args.length === 0) && mentioned.length === 0) {
        let isOwner = false;
        let petTarget = null;
        for (const [pJid, data] of Object.entries(global.db.pets)) {
          if (data.ownerJid === senderJid && data.groupId === chatId) {
            isOwner = true;
            petTarget = pJid;
            break;
          }
        }
        const isPet = Boolean(global.db.pets[senderJid]);
        let statusText = "Warga Bebas";
        if (isOwner) statusText = `Majikan dari @${petTarget.split("@")[0]}`;
        if (isPet) statusText = `Babu peliharaan dari @${global.db.pets[senderJid].ownerJid.split("@")[0]}`;
        const body = `Hi ${userName}!
Simulasi babu dan peliharaan interaktif grup.

–  *A D O P T I O N*

┌  ◦  *User* : @${senderNum}
│  ◦  *Status* : ${statusText}
└  ◦  *Action* : Ketik ${prefix}adopsi @user untuk mengadopsi

Pilih tindakan yang ingin Anda lakukan melalui menu di bawah.`;
        const sections = [{
          title: "👑 MENU MAJIKAN",
          rows: [{
            title: "📋 Cek Status Peliharaan",
            id: `${prefix}cekpeliharaan`,
            description: "Periksa level lapar & loyalitas peliharaan"
          }, {
            title: "🍖 Beri Makan Peliharaan",
            id: `${prefix}kasihmakan`,
            description: "Pilih menu pakan agar peliharaan kenyang"
          }, {
            title: "🧹 Perintahkan Kerja Bakti",
            id: `${prefix}suruhkerja`,
            description: "Suruh babu membersihkan grup demi setoran EXP"
          }]
        }, {
          title: "🐾 MENU BABU / PELIHARAAN",
          rows: [{
            title: "🦷 Gigit Majikan",
            id: `${prefix}gigit`,
            description: "Berontak & coba curi 40 EXP dari majikanmu"
          }, {
            title: "🏃‍♂️ Kabur dari Kandang",
            id: `${prefix}kabur`,
            description: "Melarikan diri untuk menjadi orang merdeka kembali"
          }]
        }];
        const helpButtons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "🐾 MENU BABU & MAJIKAN",
            sections: sections
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "📋 Cek Status Peliharaan",
            id: `${prefix}cekpeliharaan`
          })
        }];
        return await sendInteractive(body, botFooter, helpButtons, {
          mentions: [petTarget, global.db.pets[senderJid]?.ownerJid].filter(Boolean),
          title: `✦ Menu Adopsi & Babu ✦`,
          buttonTitle: "Pilih Aksi"
        });
      }
      if (command === "adopsi" || command === "babu" || command === "pelihara") {
        const target = mentioned[0];
        if (!target) {
          return ctx.reply(`–  *A D O P T I O N*

Silakan tag teman yang ingin Anda jadikan babu/peliharaan.

┌  ◦  *Format* : ${prefix}adopsi @user [panggilan]
└  ◦  *Example* : ${prefix}adopsi @user Kucing Garong`);
        }
        if (target === senderJid) {
          return ctx.reply("❌ Anda tidak bisa mengadopsi diri Anda sendiri.");
        }
        if (global.db.pets[target]) {
          const owner = global.db.pets[target].ownerJid;
          return ctx.reply(`❌ Target sudah menjadi peliharaan resmi dari @${owner.split("@")[0]}.`, {
            mentions: [owner]
          });
        }
        if (pendingOffers.has(target)) {
          return ctx.reply("⏳ Sedang ada kontrak adopsi lain yang ditujukan padanya.");
        }
        const petAlias = ctx.args?.slice(1).join(" ") || "Babu Pengabdi";
        const timer = setTimeout(async () => {
          if (pendingOffers.has(target)) {
            pendingOffers.delete(target);
            const expireText = `–  *E X P I R E D*

Tawaran adopsi dari @${senderNum} kepada @${target.split("@")[0]} telah kedaluwarsa.`;
            await sock.sendMessage(chatId, {
              text: expireText,
              mentions: [senderJid, target]
            });
          }
        }, 6e4);
        pendingOffers.set(target, {
          ownerJid: senderJid,
          groupId: chatId,
          petName: petAlias,
          timer: timer
        });
        const body = `–  *P R O P O S A L*

Proposal kontrak adopsi resmi diajukan.

┌  ◦  *Owner* : @${senderNum}
│  ◦  *Pet* : @${target.split("@")[0]}
│  ◦  *Role* : ${petAlias}
└  ◦  *Timeout* : 60s

Pilihan di bawah khusus ditujukan untuk @${target.split("@")[0]}.`;
        const buttons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🤝 Terima Kontrak",
            id: `${prefix}terimababu`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🖕 Tolak Kontrak",
            id: `${prefix}tolakbabu`
          })
        }];
        return await sendInteractive(body, botFooter, buttons, {
          mentions: [senderJid, target],
          title: `✦ Proposal Adopsi ✦`
        });
      }
      if (command === "terimababu") {
        if (!pendingOffers.has(senderJid)) {
          let activePet = null;
          for (const [tJid, oData] of pendingOffers.entries()) {
            if (oData.groupId === chatId) {
              activePet = tJid;
              break;
            }
          }
          if (activePet) {
            return ctx.reply(`❌ Kontrak adopsi ini ditujukan untuk @${activePet.split("@")[0]}.`, {
              mentions: [activePet]
            });
          }
          return ctx.reply("❌ Tidak ada proposal adopsi yang ditujukan kepada Anda.");
        }
        const offer = pendingOffers.get(senderJid);
        clearTimeout(offer.timer);
        pendingOffers.delete(senderJid);
        global.db.pets[senderJid] = {
          ownerJid: offer.ownerJid,
          groupId: chatId,
          petName: offer.petName,
          hunger: 80,
          loyalty: 50,
          adoptedAt: Date.now()
        };
        saveDB();
        addExp(senderJid, 50);
        addExp(offer.ownerJid, 75);
        const body = `–  *A D O P T E D*

Kontrak adopsi resmi disahkan kedua belah pihak.

┌  ◦  *Owner* : @${offer.ownerJid.split("@")[0]}
│  ◦  *Pet* : @${senderNum} (${offer.petName})
│  ◦  *Hunger* : 80%
└  ◦  *Loyalty* : 50%

Majikan wajib memberi makan berkala (*${prefix}kasihmakan*).`;
        const buttons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🍖 Beri Makan",
            id: `${prefix}kasihmakan`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🧹 Perintahkan Kerja",
            id: `${prefix}suruhkerja`
          })
        }];
        return await sendInteractive(body, botFooter, buttons, {
          mentions: [offer.ownerJid, senderJid],
          title: `✦ Resmi Diadopsi ✦`
        });
      }
      if (command === "tolakbabu") {
        if (!pendingOffers.has(senderJid)) {
          let activePet = null;
          for (const [tJid, oData] of pendingOffers.entries()) {
            if (oData.groupId === chatId) {
              activePet = tJid;
              break;
            }
          }
          if (activePet) {
            return ctx.reply(`❌ Opsi penolakan ini khusus untuk @${activePet.split("@")[0]}.`, {
              mentions: [activePet]
            });
          }
          return ctx.reply("❌ Tidak ada kontrak adopsi aktif yang dapat Anda tolak.");
        }
        const offer = pendingOffers.get(senderJid);
        clearTimeout(offer.timer);
        pendingOffers.delete(senderJid);
        addExp(offer.ownerJid, -25);
        const rejectText = `–  *R E J E C T E D*

@${senderNum} menolak keras tawaran adopsi dari @${offer.ownerJid.split("@")[0]} (-25 EXP Calon Majikan).`;
        return await sock.sendMessage(chatId, {
          text: rejectText,
          mentions: [senderJid, offer.ownerJid]
        });
      }
      if (command === "kasihmakan") {
        let targetPetJid = null;
        for (const [pJid, data] of Object.entries(global.db.pets)) {
          if (data.ownerJid === senderJid && data.groupId === chatId) {
            targetPetJid = pJid;
            break;
          }
        }
        if (!targetPetJid) {
          if (global.db.pets[senderJid]) {
            return ctx.reply("❌ Anda berstatus sebagai peliharaan. Minta makan ke majikanmu!");
          }
          return ctx.reply(`❌ Anda belum memiliki peliharaan di grup ini. Ketik *${prefix}adopsi @user* terlebih dahulu.`);
        }
        const petData = global.db.pets[targetPetJid];
        const foodArg = (ctx.args?.[0] || "").toLowerCase();
        if (!foodArg || !FOOD_MENU.some(f => f.id === foodArg)) {
          const foodBody = `–  *F E E D I N G*

Pilih menu pakan bernutrisi untuk peliharaan Anda.

┌  ◦  *Pet* : @${targetPetJid.split("@")[0]} (${petData.petName})
│  ◦  *Hunger* : ${petData.hunger}%
└  ◦  *Balance* : ${getUserExp(senderJid)} EXP

Pilih menu makanan melalui menu di bawah.`;
          const foodRows = FOOD_MENU.map(f => ({
            title: f.name,
            id: `${prefix}kasihmakan ${f.id}`,
            description: `Biaya: ${f.cost} EXP • ${f.desc}`
          }));
          const foodButtons = [{
            name: "single_select",
            buttonParamsJson: JSON.stringify({
              title: "🍖 PILIH PAKAN PELIHARAAN",
              sections: [{
                title: "DAFTAR PAKAN TERSEDIA",
                rows: foodRows
              }]
            })
          }, {
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "📋 Cek Status",
              id: `${prefix}cekpeliharaan`
            })
          }];
          return await sendInteractive(foodBody, botFooter, foodButtons, {
            mentions: [targetPetJid],
            title: `✦ Warung Pakan Babu ✦`,
            buttonTitle: "Pilih Menu Makanan"
          });
        }
        const chosenFood = FOOD_MENU.find(f => f.id === foodArg) || FOOD_MENU[0];
        const userExp = getUserExp(senderJid);
        if (userExp < chosenFood.cost) {
          return ctx.reply(`–  *F E E D I N G*

Saldo EXP tidak mencukupi untuk membeli ${chosenFood.name}.

┌  ◦  *Cost* : ${chosenFood.cost} EXP
└  ◦  *Your EXP* : ${userExp} EXP`);
        }
        addExp(senderJid, -chosenFood.cost);
        petData.hunger = Math.min(100, petData.hunger + chosenFood.fill);
        petData.loyalty = Math.min(100, petData.loyalty + 5);
        saveDB();
        addExp(senderJid, 15);
        addExp(targetPetJid, 25);
        const body = `–  *F E E D I N G*

Peliharaan berhasil diberi makan sepiring *${chosenFood.name}*.

┌  ◦  *Owner* : @${senderNum}
│  ◦  *Pet* : @${targetPetJid.split("@")[0]}
│  ◦  *Hunger* : +${chosenFood.fill}% (${petData.hunger}%)
└  ◦  *Loyalty* : +5% (${petData.loyalty}%)

Kedua belah pihak mendapatkan bonus EXP interaksi.`;
        const buttons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🧹 Perintahkan Kerja",
            id: `${prefix}suruhkerja`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🍖 Beri Makan Lagi",
            id: `${prefix}kasihmakan`
          })
        }];
        return await sendInteractive(body, botFooter, buttons, {
          mentions: [senderJid, targetPetJid],
          title: `✦ Makan Siang Babu ✦`
        });
      }
      if (command === "suruhkerja") {
        let targetPetJid = null;
        for (const [pJid, data] of Object.entries(global.db.pets)) {
          if (data.ownerJid === senderJid && data.groupId === chatId) {
            targetPetJid = pJid;
            break;
          }
        }
        if (!targetPetJid) {
          if (global.db.pets[senderJid]) {
            return ctx.reply("❌ Anda adalah peliharaan. Hanya majikan yang berhak memerintah kerja!");
          }
          return ctx.reply("❌ Anda belum memiliki peliharaan untuk diperintah kerja.");
        }
        const petData = global.db.pets[targetPetJid];
        if (petData.hunger < 25) {
          return ctx.reply(`❌ Peliharaan @${targetPetJid.split("@")[0]} sedang kelaparan berat (${petData.hunger}%).\nBeri makan dulu (*${prefix}kasihmakan*) sebelum disuruh kerja.`, {
            mentions: [targetPetJid]
          });
        }
        petData.hunger = Math.max(0, petData.hunger - 20);
        saveDB();
        const earnedExp = Math.floor(Math.random() * 40) + 30;
        addExp(senderJid, earnedExp);
        addExp(targetPetJid, Math.floor(earnedExp / 2));
        const body = `–  *W O R K*

Peliharaan berhasil diperintahkan kerja bakti membersihkan grup.

┌  ◦  *Owner* : @${senderNum} (+${earnedExp} EXP)
│  ◦  *Pet* : @${targetPetJid.split("@")[0]} (+${Math.floor(earnedExp / 2)} EXP)
└  ◦  *Hunger* : -20% (${petData.hunger}%)`;
        const buttons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🍖 Beri Makan",
            id: `${prefix}kasihmakan`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "📋 Cek Status",
            id: `${prefix}cekpeliharaan`
          })
        }];
        return await sendInteractive(body, botFooter, buttons, {
          mentions: [senderJid, targetPetJid],
          title: `✦ Kerja Bakti Selesai ✦`
        });
      }
      if (command === "gigit") {
        if (!global.db.pets[senderJid]) {
          return ctx.reply("❌ Anda bukan peliharaan siapa pun.");
        }
        const petData = global.db.pets[senderJid];
        const ownerJid = petData.ownerJid;
        const isSuccess = Math.random() < .5;
        if (isSuccess) {
          addExp(ownerJid, -40);
          addExp(senderJid, 40);
          petData.loyalty = Math.max(0, petData.loyalty - 10);
          saveDB();
          const biteSuccess = `–  *B I T E*

Gigitan maut berhasil! @${senderNum} menggigit paha majikan @${ownerJid.split("@")[0]}!

┌  ◦  *Stolen* : +40 EXP
└  ◦  *Loyalty* : ${petData.loyalty}%`;
          return await sock.sendMessage(chatId, {
            text: biteSuccess,
            mentions: [senderJid, ownerJid]
          });
        } else {
          addExp(senderJid, -20);
          const biteFail = `–  *B I T E*

Gigitan gagal! @${senderNum} dihadiahi tendangan sandal jepit dari majikan (-20 EXP).`;
          return await sock.sendMessage(chatId, {
            text: biteFail,
            mentions: [senderJid, ownerJid]
          });
        }
      }
      if (command === "kabur") {
        if (!global.db.pets[senderJid]) {
          return ctx.reply("❌ Anda bukan peliharaan siapa pun.");
        }
        const petData = global.db.pets[senderJid];
        const ownerJid = petData.ownerJid;
        delete global.db.pets[senderJid];
        saveDB();
        addExp(senderJid, -30);
        const body = `–  *E S C A P E*

@${senderNum} berhasil melarikan diri dari majikan @${ownerJid.split("@")[0]} dan kembali merdeka.`;
        const buttons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🐕 Adopsi Lagi",
            id: `${prefix}adopsi @${senderNum}`
          })
        }];
        return await sendInteractive(body, botFooter, buttons, {
          mentions: [senderJid, ownerJid],
          title: `✦ Peliharaan Kabur ✦`
        });
      }
      if (command === "cekpeliharaan" || command === "cekbabu") {
        let isOwner = false;
        let petTarget = null;
        let petData = null;
        for (const [pJid, data] of Object.entries(global.db.pets)) {
          if (data.ownerJid === senderJid && data.groupId === chatId) {
            isOwner = true;
            petTarget = pJid;
            petData = data;
            break;
          }
        }
        if (!isOwner && global.db.pets[senderJid]) {
          petTarget = senderJid;
          petData = global.db.pets[senderJid];
        }
        if (!petData) {
          return ctx.reply(`❌ Anda belum terdaftar sebagai majikan maupun peliharaan. Ketik *${prefix}adopsi @user*.`);
        }
        const body = `–  *P E T  S T A T U S*

┌  ◦  *Owner* : @${petData.ownerJid.split("@")[0]}
│  ◦  *Pet* : @${petTarget.split("@")[0]}
│  ◦  *Alias* : ${petData.petName}
│  ◦  *Hunger* : ${petData.hunger}%
└  ◦  *Loyalty* : ${petData.loyalty}%

Peliharaan kelaparan (< 15%) akan lemas di obrolan grup.`;
        const buttons = isOwner ? [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🍖 Beri Makan",
            id: `${prefix}kasihmakan`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🧹 Suruh Kerja",
            id: `${prefix}suruhkerja`
          })
        }] : [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🦷 Gigit Majikan",
            id: `${prefix}gigit`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🏃 Kabur",
            id: `${prefix}kabur`
          })
        }];
        return await sendInteractive(body, botFooter, buttons, {
          mentions: [petData.ownerJid, petTarget],
          title: `✦ Status Peliharaan ✦`
        });
      }
    } catch (err) {
      console.error("[Adopsi System Error]:", err);
      ctx.reply(`❌ Terjadi kendala teknis: ${err.message}`);
    }
  }
};