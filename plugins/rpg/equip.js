import axios from "axios";
import db from "../../data/db.js";
const WEAPON_DATA = {
  sword_stone: {
    name: "Stone Sword",
    atk: 8,
    emoji: "🗡️",
    desc: "Pedang batu tajam dasar."
  },
  sword_iron: {
    name: "Iron Sword",
    atk: 18,
    emoji: "⚔️",
    desc: "Pedang besi tempaan prajurit."
  },
  sword_diamond: {
    name: "Diamond Sword",
    atk: 35,
    emoji: "💠",
    desc: "Pedang berlian berdaya tebas tinggi."
  },
  sword_light: {
    name: "Holy Light Blade",
    atk: 60,
    emoji: "☀️",
    desc: "Pedang cahaya suci pemusnah kegelapan."
  },
  sword_dark: {
    name: "Dark Abyss Blade",
    atk: 85,
    emoji: "🌑",
    desc: "Pedang kegelapan purba berdaya rusak masif."
  }
};
const ARMOR_DATA = {
  armor_leather: {
    name: "Leather Armor",
    def: 6,
    emoji: "🟤",
    desc: "Zirah kulit binatang buruan."
  },
  armor_iron: {
    name: "Iron Plate Armor",
    def: 15,
    emoji: "🔩",
    desc: "Zirah pelat besi penahan benturan."
  },
  armor_crystal: {
    name: "Crystal Aegis",
    def: 32,
    emoji: "💎",
    desc: "Zirah kristal abadi berenergi magis."
  }
};

function generateArmoryHTML(data) {
  const {
    playerName,
    wpnName,
    wpnIcon,
    wpnBaseAtk,
    wpnRefine,
    wpnTotalAtk,
    armName,
    armIcon,
    armBaseDef,
    armRefine,
    armTotalDef,
    playerAtk,
    playerDef,
    finalAtk,
    finalDef,
    statusText
  } = data;
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 960px;
      height: 540px;
      background: #090a0f;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: #fff;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .armory-frame {
      width: 960px;
      height: 540px;
      background: radial-gradient(circle at 50% 20%, #151d2a 0%, #0c111a 65%, #05070a 100%);
      border: 8px solid #1c2636;
      outline: 2px solid #4299e1;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 24px 30px;
      box-shadow: inset 0 0 100px rgba(0,0,0,0.95);
      position: relative;
    }
    .top-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid rgba(66, 153, 225, 0.4);
      padding-bottom: 12px;
    }
    .title {
      font-size: 24px;
      font-weight: 900;
      color: #63b3ed;
      letter-spacing: 2px;
      text-transform: uppercase;
      text-shadow: 0 0 14px rgba(66, 153, 225, 0.6);
    }
    .hero-badge {
      background: rgba(0,0,0,0.7);
      border: 1.5px solid #4299e1;
      color: #bee3f8;
      padding: 5px 18px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 800;
    }

    .main-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      align-items: center;
      margin: 10px 0;
    }

    /* Slot Card (Weapon / Armor) */
    .slot-card {
      background: rgba(18, 26, 38, 0.9);
      border: 2px solid rgba(66, 153, 225, 0.35);
      border-radius: 18px;
      padding: 22px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.8);
      position: relative;
    }
    .slot-badge {
      position: absolute;
      top: -12px;
      left: 20px;
      background: #2b6cb0;
      color: #fff;
      font-size: 10px;
      font-weight: 900;
      padding: 3px 12px;
      border-radius: 8px;
      letter-spacing: 1px;
    }
    .slot-header {
      display: flex;
      align-items: center;
      gap: 14px;
      margin-top: 4px;
    }
    .item-icon {
      font-size: 48px;
      filter: drop-shadow(0 0 14px rgba(66, 153, 225, 0.5));
    }
    .item-details { display: flex; flex-direction: column; }
    .item-name { font-size: 18px; font-weight: 900; color: #f7fafc; }
    .refine-tag { font-size: 12px; font-weight: 800; color: #ecc94b; }

    .stat-comparison-box {
      background: rgba(0,0,0,0.55);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 10px;
      padding: 10px 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .stat-col { display: flex; flex-direction: column; }
    .stat-lbl { font-size: 10px; font-weight: 700; color: #a0aec0; text-transform: uppercase; }
    .stat-val { font-size: 16px; font-weight: 900; color: #63b3ed; }
    .total-stat { color: #48bb78; }

    .bottom-bar {
      background: rgba(0,0,0,0.7);
      border: 1px solid rgba(66, 153, 225, 0.3);
      border-radius: 12px;
      padding: 10px 18px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 13px;
    }
    .status-msg { font-weight: 800; color: #90cdf4; }
    .overall-stats { font-weight: 800; color: #ecc94b; }
  </style>
</head>
<body>
  <div class="armory-frame">
    <div class="top-header">
      <div class="title">⚔️ ROYAL ARMORY & EQUIPMENT 🛡️</div>
      <div class="hero-badge">PLAYER: ${playerName}</div>
    </div>

    <div class="main-grid">
      <!-- Weapon Slot Card -->
      <div class="slot-card">
        <div class="slot-badge">SLOT SENJATA TEMPUR</div>
        <div class="slot-header">
          <div class="item-icon">${wpnIcon}</div>
          <div class="item-details">
            <div class="item-name">${wpnName}</div>
            <div class="refine-tag">${wpnRefine > 0 ? `★ +${wpnRefine} Refine Forge` : "Belum Ditempa (Standard)"}</div>
          </div>
        </div>

        <div class="stat-comparison-box">
          <div class="stat-col">
            <span class="stat-lbl">ATK DASAR ITEM</span>
            <span class="stat-val">+${wpnBaseAtk} ATK</span>
          </div>
          <div class="stat-col" style="text-align: right;">
            <span class="stat-lbl">TOTAL OUTPUT SENJATA</span>
            <span class="stat-val total-stat">+${wpnTotalAtk} ATK</span>
          </div>
        </div>
      </div>

      <!-- Armor Slot Card -->
      <div class="slot-card">
        <div class="slot-badge">SLOT ZIRAH PERTAHANAN</div>
        <div class="slot-header">
          <div class="item-icon">${armIcon}</div>
          <div class="item-details">
            <div class="item-name">${armName}</div>
            <div class="refine-tag">${armRefine > 0 ? `★ +${armRefine} Refine Forge` : "Belum Ditempa (Standard)"}</div>
          </div>
        </div>

        <div class="stat-comparison-box">
          <div class="stat-col">
            <span class="stat-lbl">DEF DASAR ITEM</span>
            <span class="stat-val">+${armBaseDef} DEF</span>
          </div>
          <div class="stat-col" style="text-align: right;">
            <span class="stat-lbl">TOTAL OUTPUT ZIRAH</span>
            <span class="stat-val total-stat">+${armTotalDef} DEF</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom Bar -->
    <div class="bottom-bar">
      <div class="status-msg">${statusText || "Perlengkapan aktif siap digunakan untuk ekspedisi dungeon."}</div>
      <div class="overall-stats">⚔️ ${finalAtk} TOTAL ATK | 🛡️ ${finalDef} TOTAL DEF</div>
    </div>
  </div>
</body>
</html>`;
}
async function renderHtmlToImage(htmlContent) {
  const rawApi = global.bot?.api?.wudysoft || "";
  const cleanApi = rawApi.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  const baseUrl = `https://${cleanApi}/api/tools/html2img/`;
  const headers = {
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0"
  };
  const payload = {
    html: htmlContent,
    fullPage: true,
    quality: 100
  };
  const versions = ["v5", "v1", "v2", "v3", "v4", "v6", "v7", "v8", "v9", "v10"];
  for (const ver of versions) {
    try {
      const res = await axios.post(`${baseUrl}${ver}`, payload, {
        headers: headers,
        timeout: 15e3
      });
      const imgUrl = res.data?.url || res.data?.result || (typeof res.data === "string" ? res.data : null);
      if (imgUrl && /^https?:\/\//i.test(imgUrl)) {
        let buffer = null;
        try {
          const imgRes = await axios.get(imgUrl, {
            responseType: "arraybuffer",
            timeout: 12e3
          });
          if (imgRes.data) buffer = Buffer.from(imgRes.data);
        } catch {}
        return {
          url: imgUrl,
          buffer: buffer
        };
      }
    } catch {
      continue;
    }
  }
  return {
    url: null,
    buffer: null
  };
}

function calculateEquipmentStats(user) {
  const wpnKey = user.equipped?.weapon;
  const armKey = user.equipped?.armor;
  const wpnData = wpnKey && WEAPON_DATA[wpnKey] ? WEAPON_DATA[wpnKey] : null;
  const armData = armKey && ARMOR_DATA[armKey] ? ARMOR_DATA[armKey] : null;
  const wpnRefine = user.refine?.[wpnKey] || 0;
  const armRefine = user.refine?.[armKey] || 0;
  const wpnTotalBonus = wpnData ? wpnData.atk + wpnRefine * 6 : 0;
  const armTotalBonus = armData ? armData.def + armRefine * 4 : 0;
  const finalAtk = (user.atk || 10) + wpnTotalBonus;
  const finalDef = (user.def || 5) + armTotalBonus;
  return {
    wpnKey: wpnKey,
    armKey: armKey,
    wpnData: wpnData,
    armData: armData,
    wpnRefine: wpnRefine,
    armRefine: armRefine,
    wpnTotalBonus: wpnTotalBonus,
    armTotalBonus: armTotalBonus,
    finalAtk: finalAtk,
    finalDef: finalDef
  };
}
async function renderArmoryHUD(user, userName, statusMsg = "") {
  const stats = calculateEquipmentStats(user);
  const html = generateArmoryHTML({
    playerName: userName,
    wpnName: stats.wpnData ? stats.wpnData.name : "Tangan Kosong",
    wpnIcon: stats.wpnData ? stats.wpnData.emoji : "👊",
    wpnBaseAtk: stats.wpnData ? stats.wpnData.atk : 0,
    wpnRefine: stats.wpnRefine,
    wpnTotalAtk: stats.wpnTotalBonus,
    armName: stats.armData ? stats.armData.name : "Pakaian Biasa",
    armIcon: stats.armData ? stats.armData.emoji : "👕",
    armBaseDef: stats.armData ? stats.armData.def : 0,
    armRefine: stats.armRefine,
    armTotalDef: stats.armTotalBonus,
    playerAtk: user.atk || 10,
    playerDef: user.def || 5,
    finalAtk: stats.finalAtk,
    finalDef: stats.finalDef,
    statusText: statusMsg
  });
  return await renderHtmlToImage(html);
}
async function handleEquipAction(sock, ctx, msg, sender, rawText) {
  db.ensureUser(sender, ctx?.pushName);
  const user = global.db.user[sender];
  user.equipped = user.equipped || {
    weapon: null,
    armor: null
  };
  user.refine = user.refine || {};
  const parts = rawText.split(/\s+/);
  const action = (parts[0] || "").toLowerCase().replace(/^[.#/!]/, "");
  const target = (parts[1] || "").toLowerCase();
  const prefix = ctx.prefix || ".";
  const userName = ctx.pushName || sender.split("@")[0];
  if (action === "unequip" || action === "lepas") {
    if (target === "weapon" || target === "senjata") {
      if (!user.equipped.weapon) return ctx.reply("⚠️ Kamu sedang tidak memasang senjata apapun.");
      const old = user.equipped.weapon;
      user.equipped.weapon = null;
      db.write(global.db);
      const hud = await renderArmoryHUD(user, userName, `Senjata ${WEAPON_DATA[old]?.name || old} berhasil dilepas.`);
      return ctx.reply(`🔓 Senjata *${WEAPON_DATA[old]?.name || old}* telah dilepas kembali ke tas.`);
    }
    if (target === "armor" || target === "zirah") {
      if (!user.equipped.armor) return ctx.reply("⚠️ Kamu sedang tidak memakai baju zirah apapun.");
      const old = user.equipped.armor;
      user.equipped.armor = null;
      db.write(global.db);
      const hud = await renderArmoryHUD(user, userName, `Baju zirah ${ARMOR_DATA[old]?.name || old} berhasil dilepas.`);
      return ctx.reply(`🔓 Zirah *${ARMOR_DATA[old]?.name || old}* telah dilepas kembali ke tas.`);
    }
    if (target === "all" || target === "semua") {
      user.equipped.weapon = null;
      user.equipped.armor = null;
      db.write(global.db);
      return ctx.reply("🔓 Seluruh senjata dan baju zirah telah berhasil dilepas dari slot aktif.");
    }
  }
  if (action === "equip" || action === "pasang") {
    if (WEAPON_DATA[target]) {
      if ((user.inventory?.weapon?.[target] || 0) <= 0) {
        return ctx.reply(`❌ Kamu tidak memiliki *${WEAPON_DATA[target].name}* di dalam tas. Tempa di *${prefix}craft*!`);
      }
      user.equipped.weapon = target;
      db.write(global.db);
      await ctx.react("⚔️");
      const stats = calculateEquipmentStats(user);
      const hud = await renderArmoryHUD(user, userName, `Senjata ${WEAPON_DATA[target].name} dipasang (+${stats.wpnTotalBonus} ATK).`);
      const buttons = [{
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🗼 Uji di Menara (.tower)",
          id: `${prefix}tower`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🔥 Tempa di Pandai Besi",
          id: `${prefix}forge select ${target}`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🎒 Cek Inventory",
          id: `${prefix}inv`
        })
      }];
      const text = `Hi ${userName}!\nSenjata tempur berhasil dipasang ke slot aktif.\n\n` + `–  *W E A P O N  E Q U I P P E D*\n\n` + `┌  ◦  *Item* : ${WEAPON_DATA[target].name}\n` + `│  ◦  *Tempaan* : +${stats.wpnRefine} Refine Forge\n` + `│  ◦  *Total Output* : +${stats.wpnTotalBonus} ATK\n` + `└  ◦  *Total Serangan Karakter* : ${stats.finalAtk} ATK\n\n` + `Senjata siap dipakai untuk bertarung di Menara atau Boss Raid!`;
      const options = {
        image: hud.buffer,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 2,
            list_title: "Weapon Equipped",
            button_title: "Aksi Selanjutnya"
          }
        },
        contextInfo: {
          mentionedJid: [sender]
        }
      };
      if (typeof ctx.sendCta === "function") return await ctx.sendCta(text, "Wudysoft • Armory", buttons, options);
      return await sock.sendMessage(ctx.id, {
        image: hud.buffer,
        caption: text,
        mentions: [sender]
      }, {
        quoted: msg
      });
    }
    if (ARMOR_DATA[target]) {
      if ((user.inventory?.armor?.[target] || 0) <= 0) {
        return ctx.reply(`❌ Kamu tidak memiliki *${ARMOR_DATA[target].name}* di dalam tas. Tempa di *${prefix}craft*!`);
      }
      user.equipped.armor = target;
      db.write(global.db);
      await ctx.react("🛡️");
      const stats = calculateEquipmentStats(user);
      const hud = await renderArmoryHUD(user, userName, `Baju zirah ${ARMOR_DATA[target].name} dipakai (+${stats.armTotalBonus} DEF).`);
      const buttons = [{
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🗼 Uji di Menara (.tower)",
          id: `${prefix}tower`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🔥 Tempa di Pandai Besi",
          id: `${prefix}forge select ${target}`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🎒 Cek Inventory",
          id: `${prefix}inv`
        })
      }];
      const text = `Hi ${userName}!\nBaju zirah pelindung berhasil dipakai ke slot pertahanan.\n\n` + `–  *A R M O R  E Q U I P P E D*\n\n` + `┌  ◦  *Item* : ${ARMOR_DATA[target].name}\n` + `│  ◦  *Tempaan* : +${stats.armRefine} Refine Forge\n` + `│  ◦  *Total Output* : +${stats.armTotalBonus} DEF\n` + `└  ◦  *Total Pertahanan Karakter* : ${stats.finalDef} DEF\n\n` + `Ketahanan fisikmu meningkat untuk mereduksi damage musuh!`;
      const options = {
        image: hud.buffer,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 2,
            list_title: "Armor Equipped",
            button_title: "Aksi Selanjutnya"
          }
        },
        contextInfo: {
          mentionedJid: [sender]
        }
      };
      if (typeof ctx.sendCta === "function") return await ctx.sendCta(text, "Wudysoft • Armory", buttons, options);
      return await sock.sendMessage(ctx.id, {
        image: hud.buffer,
        caption: text,
        mentions: [sender]
      }, {
        quoted: msg
      });
    }
  }
}
export default {
  name: "equip",
  aliases: ["pasang", "unequip", "lepas", "equipment", "armory"],
  description: "Memasang dan melepas senjata atau zirah dengan sinkronisasi Refine Forge & Dynamic HTML Canvas",
  category: "RPG",
  register: true,
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      const sender = ctx?.sender || msg?.key?.participant || msg?.key?.remoteJid;
      const text = (ctx?.text || ctx?.query || msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "").trim();
      if (/^[.#/!]?(equip|pasang|unequip|lepas)\s+[a-zA-Z0-9_]+/i.test(text)) {
        return await handleEquipAction(sock, ctx, msg, sender, text);
      }
    } catch (e) {
      console.error("[EQUIP BEFORE ERROR]:", e);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      db.ensureUser(ctx.sender, ctx.pushname);
      const user = global.db.user[ctx.sender];
      const prefix = ctx.prefix || ".";
      const cmd = (ctx.cmd || "").toLowerCase();
      const targetItem = (ctx.args[0] || "").toLowerCase().replace(/\s+/g, "_");
      const userName = ctx.pushname || ctx.sender.split("@")[0];
      user.equipped = user.equipped || {
        weapon: null,
        armor: null
      };
      user.refine = user.refine || {};
      if (cmd === "unequip" || cmd === "lepas") {
        return await handleEquipAction(sock, ctx, msg, ctx.sender, `${prefix}unequip ${targetItem || "all"}`);
      }
      if (targetItem) {
        return await handleEquipAction(sock, ctx, msg, ctx.sender, `${prefix}equip ${targetItem}`);
      }
      const stats = calculateEquipmentStats(user);
      const hud = await renderArmoryHUD(user, userName, "Ruang ganti perlengkapan kerajaan.");
      const ownedWeapons = Object.keys(WEAPON_DATA).filter(k => (user.inventory?.weapon?.[k] || 0) > 0);
      const ownedArmors = Object.keys(ARMOR_DATA).filter(k => (user.inventory?.armor?.[k] || 0) > 0);
      const availableRows = [];
      for (const wKey of ownedWeapons) {
        const item = WEAPON_DATA[wKey];
        const isEquipped = user.equipped.weapon === wKey;
        const ref = user.refine?.[wKey] || 0;
        availableRows.push({
          title: `${item.emoji} ${item.name} ${ref > 0 ? `(+${ref})` : ""}`.slice(0, 24),
          description: `${isEquipped ? "● DIPAKAI | " : ""}+${item.atk + ref * 6} ATK`,
          id: `${prefix}equip ${wKey}`
        });
      }
      for (const aKey of ownedArmors) {
        const item = ARMOR_DATA[aKey];
        const isEquipped = user.equipped.armor === aKey;
        const ref = user.refine?.[aKey] || 0;
        availableRows.push({
          title: `${item.emoji} ${item.name} ${ref > 0 ? `(+${ref})` : ""}`.slice(0, 24),
          description: `${isEquipped ? "● DIPAKAI | " : ""}+${item.def + ref * 4} DEF`,
          id: `${prefix}equip ${aKey}`
        });
      }
      const buttons = [];
      if (availableRows.length > 0) {
        buttons.push({
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "⚔️ PILIH PERLENGKAPAN DARI TAS",
            sections: [{
              title: `Perlengkapan Milikmu (${availableRows.length} Buah)`,
              rows: availableRows
            }]
          })
        });
      }
      buttons.push({
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🔓 Lepas Senjata",
          id: `${prefix}lepas weapon`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🔓 Lepas Zirah",
          id: `${prefix}lepas armor`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🔥 Tempa (.forge)",
          id: `${prefix}forge`
        })
      });
      const bodyText = `Hi ${userName}!\nBerikut adalah status perlengkapan tempur karakter Anda saat ini.\n\n` + `–  *E Q U I P M E N T  S T A T U S*\n\n` + `┌  ◦  *Senjata Aktif* : ${stats.wpnData ? `${stats.wpnData.name} (+${stats.wpnTotalBonus} ATK)` : "Tangan Kosong"}\n` + `│  ◦  *Tempaan Senjata* : +${stats.wpnRefine} Refine Stars\n` + `│  ◦  *Zirah Aktif* : ${stats.armData ? `${stats.armData.name} (+${stats.armTotalBonus} DEF)` : "Pakaian Biasa"}\n` + `│  ◦  *Tempaan Zirah* : +${stats.armRefine} Refine Stars\n` + `├  ◦  *Total Serangan Karakter* : ${stats.finalAtk} ATK\n` + `└  ◦  *Total Pertahanan Karakter* : ${stats.finalDef} DEF\n\n` + `Pilih perlengkapan dari daftar tas di bawah untuk mengganti perlengkapan aktif:`;
      const options = {
        image: hud.buffer,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 2,
            divider_indices: [1],
            list_title: "Equipment Management",
            button_title: "Kelola Perlengkapan"
          }
        },
        mentions: [ctx.sender],
        contextInfo: {
          mentionedJid: [ctx.sender]
        }
      };
      if (typeof ctx.sendCta === "function") return await ctx.sendCta(bodyText, "Wudysoft • Armory Management", buttons, options);
      return await sock.sendMessage(ctx.id, {
        image: hud.buffer,
        caption: bodyText,
        mentions: [ctx.sender]
      }, {
        quoted: msg
      });
    } catch (err) {
      console.error("[EQUIP ERROR]", err);
      ctx.reply(`❌ Terjadi kendala pada armory: ${err.message}`);
    }
  }
};