import axios from "axios";
import db from "../../data/db.js";
const CRATE_REWARDS = {
  common: {
    name: "Common Crate",
    emoji: "📦",
    moneyMin: 1500,
    moneyMax: 3500,
    expMin: 20,
    expMax: 45,
    bait: 2
  },
  uncommon: {
    name: "Uncommon Crate",
    emoji: "🎁",
    moneyMin: 3500,
    moneyMax: 7500,
    expMin: 50,
    expMax: 90,
    bait: 4
  },
  legendary: {
    name: "Legendary Crate",
    emoji: "🏆",
    moneyMin: 1e4,
    moneyMax: 25e3,
    expMin: 150,
    expMax: 300,
    bait: 8
  },
  mythic: {
    name: "Mythic Crate",
    emoji: "👑",
    moneyMin: 35e3,
    moneyMax: 7e4,
    expMin: 500,
    expMax: 900,
    bait: 15
  },
  secret: {
    name: "Secret Crate",
    emoji: "🗝️",
    moneyMin: 1e5,
    moneyMax: 25e4,
    expMin: 1500,
    expMax: 3e3,
    bait: 30
  }
};
const WEAPON_BONUS = {
  sword_stone: 8,
  sword_iron: 18,
  sword_diamond: 35,
  sword_light: 60,
  sword_dark: 85
};
const ARMOR_BONUS = {
  armor_leather: 6,
  armor_iron: 15,
  armor_crystal: 32
};

function generateInventoryHTML(data) {
  const {
    playerName,
    level,
    exp,
    expReq,
    hp,
    hpMax,
    mana,
    manaMax,
    money,
    wpnName,
    wpnRefine,
    armName,
    armRefine,
    totalAtk,
    totalDef,
    ores,
    fish,
    crates,
    baitCount,
    consumableCount
  } = data;
  const expPct = Math.max(0, Math.min(100, Math.round(exp / expReq * 100)));
  const hpPct = Math.max(0, Math.min(100, Math.round(hp / hpMax * 100)));
  const mpPct = Math.max(0, Math.min(100, Math.round(mana / manaMax * 100)));
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 960px;
      height: 540px;
      background: #08090d;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: #fff;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .bag-frame {
      width: 960px;
      height: 540px;
      background: radial-gradient(circle at 30% 20%, #151d2a 0%, #0c111a 70%, #05070a 100%);
      border: 8px solid #1c2636;
      outline: 2px solid #ecc94b;
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
      border-bottom: 2px solid rgba(236, 201, 75, 0.4);
      padding-bottom: 12px;
    }
    .title {
      font-size: 24px;
      font-weight: 900;
      color: #ecc94b;
      letter-spacing: 2px;
      text-transform: uppercase;
      text-shadow: 0 0 14px rgba(236, 201, 75, 0.6);
    }
    .wallet-badge {
      background: rgba(0,0,0,0.7);
      border: 1.5px solid #ecc94b;
      color: #fefcbf;
      padding: 5px 18px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 800;
    }

    .main-grid {
      display: grid;
      grid-template-columns: 310px 1fr;
      gap: 24px;
      align-items: center;
      margin: 10px 0;
    }

    /* Left Hero Stats Panel */
    .hero-panel {
      background: rgba(18, 26, 38, 0.9);
      border: 2px solid rgba(236, 201, 75, 0.35);
      border-radius: 16px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.8);
    }
    .hero-name { font-size: 18px; font-weight: 900; color: #f7fafc; }
    .bar-box { display: flex; flex-direction: column; gap: 3px; }
    .bar-lbl { display: flex; justify-content: space-between; font-size: 10px; font-weight: 800; }
    .bar-shell {
      width: 100%;
      height: 12px;
      background: #0a0e14;
      border-radius: 6px;
      border: 1px solid rgba(255,255,255,0.15);
      overflow: hidden;
    }
    .hp-fill { height: 100%; background: linear-gradient(90deg, #c53030, #e53e3e); border-radius: 6px; }
    .mp-fill { height: 100%; background: linear-gradient(90deg, #2b6cb0, #4299e1); border-radius: 6px; }

    .gear-card {
      background: rgba(0,0,0,0.5);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 8px;
      padding: 6px 10px;
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      font-weight: 700;
    }

    /* Right Inventory Grid */
    .storage-panel {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .cat-title { font-size: 11px; font-weight: 800; color: #ecc94b; letter-spacing: 1.2px; text-transform: uppercase; }
    .item-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
    }
    .item-pill {
      background: rgba(0,0,0,0.6);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px;
      padding: 8px 10px;
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      font-weight: 800;
      color: #e2e8f0;
    }

    .bottom-bar {
      background: rgba(0,0,0,0.7);
      border: 1px solid rgba(236, 201, 75, 0.35);
      border-radius: 12px;
      padding: 10px 18px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 13px;
    }
  </style>
</head>
<body>
  <div class="bag-frame">
    <div class="top-header">
      <div class="title">🎒 MASTER ADVENTURER BACKPACK 🎒</div>
      <div class="wallet-badge">💰 Rp ${money.toLocaleString("id-ID")}</div>
    </div>

    <div class="main-grid">
      <!-- Player Status Overview -->
      <div class="hero-panel">
        <div class="hero-name">${playerName} (Lv. ${level})</div>

        <div class="bar-box">
          <div class="bar-lbl"><span style="color: #feb2b2;">HEALTH</span><span>${hp} / ${hpMax}</span></div>
          <div class="bar-shell"><div class="hp-fill" style="width: ${hpPct}%;"></div></div>
        </div>

        <div class="bar-box">
          <div class="bar-lbl"><span style="color: #bee3f8;">MANA</span><span>${mana} / ${manaMax}</span></div>
          <div class="bar-shell"><div class="mp-fill" style="width: ${mpPct}%;"></div></div>
        </div>

        <div class="gear-card">
          <span>⚔️ ${wpnName}</span>
          <span style="color: #ecc94b;">${wpnRefine > 0 ? `+${wpnRefine}` : "Std"}</span>
        </div>

        <div class="gear-card">
          <span>🛡️ ${armName}</span>
          <span style="color: #ecc94b;">${armRefine > 0 ? `+${armRefine}` : "Std"}</span>
        </div>

        <div class="gear-card" style="border-color: #48bb78;">
          <span>OUTPUT COMBAT</span>
          <span style="color: #48bb78;">${totalAtk} ATK | ${totalDef} DEF</span>
        </div>
      </div>

      <!-- Inventory Contents -->
      <div class="storage-panel">
        <div class="cat-title">💎 MINERAL & TAMBANG (.mine / .cavern)</div>
        <div class="item-grid">
          <div class="item-pill"><span>🪨 Batu</span><span>${ores.stone || 0}</span></div>
          <div class="item-pill"><span>⬛ Coal</span><span>${ores.coal || 0}</span></div>
          <div class="item-pill"><span>⛓️ Iron</span><span>${ores.iron || 0}</span></div>
          <div class="item-pill"><span>🪙 Gold</span><span>${ores.gold || 0}</span></div>
          <div class="item-pill"><span>💎 Diamond</span><span>${ores.diamond || 0}</span></div>
          <div class="item-pill"><span>💠 Platinum</span><span>${ores.platinum || 0}</span></div>
          <div class="item-pill"><span>🪱 Bait</span><span>${baitCount}</span></div>
          <div class="item-pill"><span>🍱 Bekal</span><span>${consumableCount}</span></div>
        </div>

        <div class="cat-title" style="margin-top: 4px;">📦 CRATE & HASIL LAUT (.open / .fish)</div>
        <div class="item-grid">
          <div class="item-pill"><span>📦 Common</span><span>${crates.common || 0}</span></div>
          <div class="item-pill"><span>🎁 Uncom</span><span>${crates.uncommon || 0}</span></div>
          <div class="item-pill"><span>🏆 Legend</span><span>${crates.legendary || 0}</span></div>
          <div class="item-pill"><span>👑 Mythic</span><span>${crates.mythic || 0}</span></div>
          <div class="item-pill"><span>🐟 Teri</span><span>${fish.anchovy || 0}</span></div>
          <div class="item-pill"><span>🐟 Lele</span><span>${fish.catfish || 0}</span></div>
          <div class="item-pill"><span>🐠 Tuna</span><span>${fish.tuna || 0}</span></div>
          <div class="item-pill"><span>🍣 Salmon</span><span>${fish.salmon || 0}</span></div>
        </div>
      </div>
    </div>

    <div class="bottom-bar">
      <span>Progress EXP: <b>${exp} / ${expReq} XP (${expPct}%)</b></span>
      <span style="color: #ecc94b; font-weight: 800;">SELURUH DATA TERSINKRONISASI</span>
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
export default {
  name: "inventory",
  aliases: ["inv", "tas", "bag"],
  description: "Melihat tas inventaris, memasang perlengkapan, dan membuka peti hadiah dengan Dynamic HTML Canvas",
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
      if (/^[.#/!]?inv\s+(equip|open|pasang|buka)\s+[a-zA-Z0-9_]+/i.test(text)) {}
    } catch (e) {
      console.error("[INVENTORY BEFORE ERROR]:", e);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      db.ensureUser(ctx.sender, ctx.pushname);
      const user = global.db.user[ctx.sender];
      const prefix = ctx.prefix || ".";
      const action = (ctx.cmd || "").toLowerCase();
      const target = (ctx.args[0] || "").toLowerCase();
      const userName = ctx.pushname || ctx.sender.split("@")[0];
      user.inventory = user.inventory || {};
      user.inventory.ores = user.inventory.ores || {
        stone: 0,
        coal: 0,
        iron: 0,
        gold: 0,
        diamond: 0,
        platinum: 0
      };
      user.inventory.fish = user.inventory.fish || {
        anchovy: 0,
        catfish: 0,
        tuna: 0,
        salmon: 0,
        swordfish: 0
      };
      user.inventory.crate = user.inventory.crate || {
        common: 0,
        uncommon: 0,
        legendary: 0,
        mythic: 0,
        secret: 0
      };
      user.inventory.nature = user.inventory.nature || {
        bait: 0
      };
      user.inventory.drink = user.inventory.drink || {
        water: 0,
        mana_potion: 0
      };
      user.inventory.food = user.inventory.food || {};
      user.inventory.weapon = user.inventory.weapon || {};
      user.inventory.armor = user.inventory.armor || {};
      user.equipped = user.equipped || {
        weapon: null,
        armor: null
      };
      user.refine = user.refine || {};
      if (action === "equip" || target === "equip") {
        const itemKey = (action === "equip" ? ctx.args[0] : ctx.args[1] || "").toLowerCase();
        if (!itemKey) {
          return ctx.reply(`–  *E Q U I P*\n\nFormat: *${prefix}equip <nama_item>*\nContoh: *${prefix}equip sword_iron*`);
        }
        if ((user.inventory.weapon[itemKey] || 0) > 0) {
          user.equipped.weapon = itemKey;
          db.write(global.db);
          await ctx.react("⚔️");
          return ctx.reply(`–  *E Q U I P*\n\nSenjata tempur berhasil dipasang ke slot aktif.\n\n┌  ◦  *Slot* : Weapon\n└  ◦  *Item* : ${itemKey.replace(/_/g, " ").toUpperCase()}`);
        } else if ((user.inventory.armor[itemKey] || 0) > 0) {
          user.equipped.armor = itemKey;
          db.write(global.db);
          await ctx.react("🛡️");
          return ctx.reply(`–  *E Q U I P*\n\nBaju zirah pelindung berhasil dipakai ke slot pertahanan.\n\n┌  ◦  *Slot* : Armor\n└  ◦  *Item* : ${itemKey.replace(/_/g, " ").toUpperCase()}`);
        } else {
          return ctx.reply(`❌ Kamu tidak memiliki item *${itemKey}* di dalam tas.`);
        }
      }
      if (action === "open") {
        const crateType = target || "common";
        if (!CRATE_REWARDS[crateType]) {
          return ctx.reply(`–  *O P E N  C R A T E*\n\nJenis crate tidak valid.\nPilihan: common, uncommon, legendary, mythic, secret.\nContoh: *${prefix}open common*`);
        }
        if ((user.inventory.crate[crateType] || 0) <= 0) {
          return ctx.reply(`❌ Kamu tidak memiliki *${crateType.toUpperCase()} CRATE* di dalam tas.`);
        }
        user.inventory.crate[crateType] -= 1;
        const cfg = CRATE_REWARDS[crateType];
        const rewardMoney = Math.floor(Math.random() * (cfg.moneyMax - cfg.moneyMin + 1)) + cfg.moneyMin;
        const rewardExp = Math.floor(Math.random() * (cfg.expMax - cfg.expMin + 1)) + cfg.expMin;
        user.money = (Number(user.money) || 0) + rewardMoney;
        user.exp = (Number(user.exp) || 0) + rewardExp;
        user.inventory.nature.bait = (user.inventory.nature.bait || 0) + cfg.bait;
        db.write(global.db);
        await ctx.react("🎁");
        const openText = `–  *C R A T E  R E W A R D*\n\n` + `Berhasil membuka peti ${crateType.toUpperCase()} CRATE.\n\n` + `┌  ◦  *Balance* : +Rp ${rewardMoney.toLocaleString("id-ID")}\n` + `│  ◦  *Exp* : +${rewardExp} XP\n` + `│  ◦  *Bait* : +${cfg.bait} Pcs\n` + `└  ◦  *Remaining* : ${user.inventory.crate[crateType]} Crates\n\n` + `Gunakan tombol di bawah untuk membuka kembali atau memeriksa tas.`;
        const openButtons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🎁 Buka Crate Lagi",
            id: `${prefix}open ${crateType}`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🎒 Buka Inventory",
            id: `${prefix}inv`
          })
        }];
        const options = {
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 2,
              list_title: "Crate Rewards",
              button_title: "Opsi Crate"
            }
          },
          contextInfo: {
            mentionedJid: [ctx.sender]
          }
        };
        if (typeof ctx.sendCta === "function") return await ctx.sendCta(openText, "Wudysoft • Crate System", openButtons, options);
        return await sock.sendMessage(ctx.id, {
          text: openText,
          mentions: [ctx.sender]
        }, {
          quoted: msg
        });
      }
      const wpnKey = user.equipped.weapon;
      const armKey = user.equipped.armor;
      const wpnRef = user.refine?.[wpnKey] || 0;
      const armRef = user.refine?.[armKey] || 0;
      const totalAtk = (user.atk || 10) + (WEAPON_BONUS[wpnKey] || 0) + wpnRef * 6;
      const totalDef = (user.def || 5) + (ARMOR_BONUS[armKey] || 0) + armRef * 4;
      const consumableCount = Object.values(user.inventory.drink || {}).reduce((a, b) => a + b, 0) + Object.values(user.inventory.food || {}).reduce((a, b) => a + b, 0);
      const html = generateInventoryHTML({
        playerName: userName,
        level: user.level || 1,
        exp: user.exp || 0,
        expReq: (user.level || 1) * 100,
        hp: user.hp || 100,
        hpMax: user.hpMax || 100,
        mana: user.mana || 50,
        manaMax: user.manaMax || 50,
        money: user.money || 0,
        wpnName: wpnKey ? wpnKey.replace(/_/g, " ").toUpperCase() : "TANGAN KOSONG",
        wpnRefine: wpnRef,
        armName: armKey ? armKey.replace(/_/g, " ").toUpperCase() : "PAKAIAN BIASA",
        armRefine: armRef,
        totalAtk: totalAtk,
        totalDef: totalDef,
        ores: user.inventory.ores,
        fish: user.inventory.fish,
        crates: user.inventory.crate,
        baitCount: user.inventory.nature.bait || 0,
        consumableCount: consumableCount
      });
      const {
        buffer
      } = await renderHtmlToImage(html);
      const shortcutRows = [{
        title: "🛡️ Kelola Perlengkapan (.equip)",
        description: "Pasang atau lepas senjata & baju zirah",
        id: `${prefix}equip`
      }, {
        title: "🎁 Buka Peti Hadiah (.open)",
        description: "Buka kotak harta karun dari dalam tas",
        id: `${prefix}open`
      }, {
        title: "🔥 Tempa Senjata (.forge)",
        description: "Tingkatkan gear aktif ke +1 s/d +10",
        id: `${prefix}forge`
      }, {
        title: "🍳 Dapur & Memasak (.cook)",
        description: "Masak ikan & daging menjadi hidangan buff",
        id: `${prefix}cook`
      }, {
        title: "🏪 Pasar Saudagar (.shop)",
        description: "Jual beli mineral & perlengkapan",
        id: `${prefix}shop`
      }];
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: "🎒 MENU MANAJEMEN TAS",
          sections: [{
            title: "Aksi Tas & Perlengkapan",
            rows: shortcutRows
          }]
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🗼 Panjat Menara",
          id: `${prefix}tower`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "⛏️ Gali Gua Tambang",
          id: `${prefix}cavern`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🎖️ Profil Jiwa (.hero)",
          id: `${prefix}hero`
        })
      }];
      const bodyText = `Hi ${userName}!\nBerikut adalah visual tas ransel petualang dan rincian perbekalanmu saat ini.\n\n` + `Gunakan menu dropdown di bawah untuk mengelola barang atau ketuk tombol cepat untuk menjelajah:`;
      const options = {
        image: buffer,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 2,
            list_title: "Inventory HUD",
            button_title: "Menu Cepat Tas"
          }
        },
        contextInfo: {
          mentionedJid: [ctx.sender]
        }
      };
      if (typeof ctx.sendCta === "function") return await ctx.sendCta(bodyText, "Wudysoft • Master Backpack", buttons, options);
      return await sock.sendMessage(ctx.id, {
        image: buffer,
        caption: bodyText,
        mentions: [ctx.sender]
      }, {
        quoted: msg
      });
    } catch (err) {
      console.error("[INVENTORY ERROR]", err);
      ctx.reply(`❌ Terjadi kendala saat membuka tas: ${err.message}`);
    }
  }
};