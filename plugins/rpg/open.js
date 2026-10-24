import axios from "axios";
import db from "../../data/db.js";
const CRATE_REWARDS = {
  common: {
    name: "Common Wooden Crate",
    emoji: "📦",
    color: "#a0aec0",
    glow: "#718096",
    money: [1e3, 3e3],
    exp: [50, 100],
    bonus: [{
      key: "ores.coal",
      name: "Batu Bara",
      icon: "⬛",
      min: 2,
      max: 5,
      chance: .6
    }, {
      key: "ores.iron",
      name: "Bijih Besi",
      icon: "⛓️",
      min: 1,
      max: 3,
      chance: .4
    }, {
      key: "nature.bait",
      name: "Umpan Cacing",
      icon: "🪱",
      min: 2,
      max: 5,
      chance: .5
    }, {
      key: "drink.mana_potion",
      name: "Mana Potion",
      icon: "🧪",
      min: 1,
      max: 2,
      chance: .2
    }]
  },
  uncommon: {
    name: "Uncommon Forest Crate",
    emoji: "🎁",
    color: "#48bb78",
    glow: "#38a169",
    money: [4e3, 1e4],
    exp: [150, 300],
    bonus: [{
      key: "ores.gold",
      name: "Bijih Emas",
      icon: "🪙",
      min: 1,
      max: 3,
      chance: .5
    }, {
      key: "ores.diamond",
      name: "Diamond",
      icon: "💎",
      min: 1,
      max: 2,
      chance: .25
    }, {
      key: "material.leather",
      name: "Kulit Monster",
      icon: "🥋",
      min: 2,
      max: 4,
      chance: .4
    }, {
      key: "drink.mana_potion",
      name: "Elixir Suci",
      icon: "✨",
      min: 1,
      max: 2,
      chance: .2
    }]
  },
  legendary: {
    name: "Legendary Golden Crate",
    emoji: "🏆",
    color: "#ecc94b",
    glow: "#d69e2e",
    money: [2e4, 6e4],
    exp: [500, 1200],
    mcoin: [1, 5],
    bonus: [{
      key: "ores.diamond",
      name: "Diamond",
      icon: "💎",
      min: 3,
      max: 6,
      chance: .8
    }, {
      key: "ores.platinum",
      name: "Platinum",
      icon: "💠",
      min: 1,
      max: 3,
      chance: .4
    }, {
      key: "weapon.sword_diamond",
      name: "Diamond Sword (+35 ATK)",
      icon: "⚔️",
      min: 1,
      max: 1,
      chance: .15
    }, {
      key: "armor.armor_iron",
      name: "Iron Plate (+15 DEF)",
      icon: "🛡️",
      min: 1,
      max: 1,
      chance: .2
    }]
  },
  mythic: {
    name: "Mythic Royal Crate",
    emoji: "👑",
    color: "#b794f4",
    glow: "#9f7aea",
    money: [8e4, 2e5],
    exp: [2e3, 5e3],
    mcoin: [10, 30],
    bonus: [{
      key: "ores.platinum",
      name: "Platinum",
      icon: "💠",
      min: 5,
      max: 10,
      chance: .9
    }, {
      key: "weapon.sword_dark",
      name: "Dark Sword (+85 ATK)",
      icon: "🌑🗡️",
      min: 1,
      max: 1,
      chance: .25
    }, {
      key: "weapon.sword_light",
      name: "Light Sword (+60 ATK)",
      icon: "☀️🗡️",
      min: 1,
      max: 1,
      chance: .25
    }, {
      key: "armor.armor_crystal",
      name: "Crystal Aegis (+32 DEF)",
      icon: "🔮🛡️",
      min: 1,
      max: 1,
      chance: .25
    }]
  },
  secret: {
    name: "Secret Ancient Crate",
    emoji: "🗝️",
    color: "#fc8181",
    glow: "#e53e3e",
    money: [25e4, 6e5],
    exp: [8e3, 15e3],
    mcoin: [50, 150],
    bonus: [{
      key: "ores.platinum",
      name: "Platinum",
      icon: "💠",
      min: 15,
      max: 25,
      chance: 1
    }, {
      key: "weapon.sword_dark",
      name: "Dark Sword (+85 ATK)",
      icon: "🌑🗡️",
      min: 1,
      max: 1,
      chance: .5
    }, {
      key: "armor.armor_crystal",
      name: "Crystal Aegis (+32 DEF)",
      icon: "🔮🛡️",
      min: 1,
      max: 1,
      chance: .5
    }]
  }
};

function addNested(obj, path, qty) {
  const parts = path.split(".");
  if (parts.length === 1) {
    obj[parts[0]] = (obj[parts[0]] || 0) + qty;
  } else {
    if (!obj[parts[0]]) obj[parts[0]] = {};
    obj[parts[0]][parts[1]] = (obj[parts[0]][parts[1]] || 0) + qty;
  }
}

function checkLevelUp(user) {
  let isLevelUp = false;
  let oldLevel = user.level || 1;
  let expRequired = oldLevel * 100;
  while (user.exp >= expRequired) {
    user.exp -= expRequired;
    user.level += 1;
    user.hpMax += 15;
    user.manaMax += 10;
    user.atk += 4;
    user.def += 2;
    user.hp = user.hpMax;
    user.mana = user.manaMax;
    isLevelUp = true;
    expRequired = user.level * 100;
  }
  return {
    isLevelUp: isLevelUp,
    oldLevel: oldLevel,
    newLevel: user.level
  };
}

function generateUnboxHTML(data) {
  const {
    playerName,
    crateName,
    crateIcon,
    crateColor,
    moneyGained,
    expGained,
    mcoinGained,
    bonusLoot,
    remainingCrates
  } = data;
  let lootCardsHTML = "";
  if (bonusLoot.length === 0) {
    lootCardsHTML = `<div class="empty-loot">Peti hanya berisi koin emas dan energi pengalaman.</div>`;
  } else {
    bonusLoot.forEach(item => {
      lootCardsHTML += `
        <div class="loot-card">
          <div class="loot-icon">${item.icon}</div>
          <div class="loot-name">${item.name}</div>
          <div class="loot-qty">+${item.qty}</div>
        </div>
      `;
    });
  }
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 960px;
      height: 540px;
      background: #0a0709;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: #fff;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .vault-frame {
      width: 960px;
      height: 540px;
      background: radial-gradient(circle at 50% 25%, #24131b 0%, #12070e 65%, #050204 100%);
      border: 8px solid #230f1a;
      outline: 2px solid ${crateColor};
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
      border-bottom: 2px solid rgba(255, 255, 255, 0.15);
      padding-bottom: 12px;
    }
    .title {
      font-size: 24px;
      font-weight: 900;
      color: ${crateColor};
      letter-spacing: 2px;
      text-transform: uppercase;
      text-shadow: 0 0 14px ${crateColor};
    }
    .tier-badge {
      background: rgba(0,0,0,0.7);
      border: 1.5px solid ${crateColor};
      color: #fff;
      padding: 5px 18px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 800;
    }

    .main-grid {
      display: grid;
      grid-template-columns: 360px 1fr;
      gap: 26px;
      align-items: center;
      margin: 10px 0;
    }

    /* Left Chest & Currency Card */
    .chest-card {
      background: rgba(26, 12, 21, 0.9);
      border: 2px solid rgba(255, 255, 255, 0.15);
      border-radius: 18px;
      padding: 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.8);
      position: relative;
    }
    .chest-glow {
      font-size: 68px;
      filter: drop-shadow(0 0 25px ${crateColor});
      margin-bottom: -6px;
    }
    .chest-name { font-size: 20px; font-weight: 900; color: #fffaf0; text-align: center; }

    .currency-box {
      width: 100%;
      background: rgba(0,0,0,0.6);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px;
      padding: 10px 16px;
      display: flex;
      justify-content: space-between;
      margin-top: 4px;
    }
    .cur-col { display: flex; flex-direction: column; }
    .cur-lbl { font-size: 10px; color: #a0aec0; font-weight: 700; text-transform: uppercase; }
    .cur-val { font-size: 16px; font-weight: 900; color: #ecc94b; }

    /* Right Obtained Loot Grid */
    .loot-panel {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .panel-header { font-size: 13px; font-weight: 800; color: ${crateColor}; letter-spacing: 1.2px; text-transform: uppercase; }
    .loot-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
    }
    .loot-card {
      background: rgba(22, 9, 17, 0.88);
      border: 1.5px solid rgba(255, 255, 255, 0.15);
      border-radius: 14px;
      padding: 12px 14px;
      display: flex;
      align-items: center;
      gap: 12px;
      box-shadow: 0 8px 16px rgba(0,0,0,0.6);
    }
    .loot-icon { font-size: 30px; }
    .loot-name { font-size: 12px; font-weight: 800; color: #f7fafc; }
    .loot-qty { font-size: 15px; font-weight: 900; color: #48bb78; margin-left: auto; }

    .empty-loot {
      grid-column: span 2;
      background: rgba(0,0,0,0.4);
      border-radius: 12px;
      padding: 30px;
      text-align: center;
      font-size: 13px;
      color: #a0aec0;
      font-style: italic;
    }

    .bottom-bar {
      background: rgba(0,0,0,0.7);
      border: 1px solid rgba(255, 255, 255, 0.15);
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
  <div class="vault-frame">
    <div class="top-header">
      <div class="title">🎁 MYSTICAL TREASURE UNBOXING 🎁</div>
      <div class="tier-badge">SISA PETI: ${remainingCrates} BOX</div>
    </div>

    <div class="main-grid">
      <!-- Left Chest Card -->
      <div class="chest-card">
        <div class="chest-glow">${crateIcon}</div>
        <div class="chest-name">${crateName}</div>

        <div class="currency-box">
          <div class="cur-col">
            <span class="cur-lbl">GOLD COINS</span>
            <span class="cur-val">+Rp ${moneyGained.toLocaleString("id-ID")}</span>
          </div>
          <div class="cur-col" style="text-align: right;">
            <span class="cur-lbl">EXPERIENCE</span>
            <span class="cur-val" style="color: #63b3ed;">+${expGained} XP</span>
          </div>
          ${mcoinGained > 0 ? `
          <div class="cur-col" style="text-align: right;">
            <span class="cur-lbl">MCOIN</span>
            <span class="cur-val" style="color: #f6ad55;">+${mcoinGained} MC</span>
          </div>` : ""}
        </div>
      </div>

      <!-- Right Loot Grid -->
      <div class="loot-panel">
        <div class="panel-header">BARANG & PERLENGKAPAN BERHASIL DIDAPATKAN</div>
        <div class="loot-grid">
          ${lootCardsHTML}
        </div>
      </div>
    </div>

    <div class="bottom-bar">
      <span>Petualang: <b>${playerName}</b></span>
      <span style="color: #48bb78; font-weight: 800;">SELURUH JARAHAN MASUK KE TAS INVENTARIS</span>
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
async function handleOpenAction(sock, ctx, msg, sender, rawText) {
  db.ensureUser(sender, ctx?.pushName);
  const user = global.db.user[sender];
  const parts = rawText.split(/\s+/);
  const crateType = (parts[1] || "").toLowerCase();
  const prefix = ctx.prefix || ".";
  const userName = ctx.pushName || sender.split("@")[0];
  if (!CRATE_REWARDS[crateType]) return;
  const conf = CRATE_REWARDS[crateType];
  const userCrates = user.inventory?.crate?.[crateType] || 0;
  if (userCrates < 1) {
    return ctx.reply(`❌ Kamu tidak memiliki *${conf.name}* di dalam tas.\nDapatkan peti ini dari bertualang di *${prefix}dungeon*, menambang di *${prefix}mine*, atau memanjat *${prefix}tower*!`);
  }
  user.inventory.crate[crateType] -= 1;
  const moneyGained = Math.floor(Math.random() * (conf.money[1] - conf.money[0] + 1)) + conf.money[0];
  const expGained = Math.floor(Math.random() * (conf.exp[1] - conf.exp[0] + 1)) + conf.exp[0];
  user.money = (Number(user.money) || 0) + moneyGained;
  user.exp = (Number(user.exp) || 0) + expGained;
  let mcoinGained = 0;
  if (conf.mcoin) {
    mcoinGained = Math.floor(Math.random() * (conf.mcoin[1] - conf.mcoin[0] + 1)) + conf.mcoin[0];
    user.mcoin = (user.mcoin || 0) + mcoinGained;
  }
  const bonusLootList = [];
  for (const b of conf.bonus) {
    if (Math.random() < b.chance) {
      const qty = Math.floor(Math.random() * (b.max - b.min + 1)) + b.min;
      addNested(user.inventory, b.key, qty);
      bonusLootList.push({
        name: b.name,
        icon: b.icon || "🎁",
        qty: qty
      });
    }
  }
  const lvlResult = checkLevelUp(user);
  db.write(global.db);
  await ctx.react("🎁");
  const html = generateUnboxHTML({
    playerName: userName,
    crateName: conf.name,
    crateIcon: conf.emoji,
    crateColor: conf.color,
    moneyGained: moneyGained,
    expGained: expGained,
    mcoinGained: mcoinGained,
    bonusLoot: bonusLootList,
    remainingCrates: user.inventory.crate[crateType]
  });
  const {
    buffer
  } = await renderHtmlToImage(html);
  const bonusLines = bonusLootList.length ? bonusLootList.map((b, i) => `${i === bonusLootList.length - 1 ? "└" : "│"}  ◦  ${b.icon} ${b.name} *(x${b.qty})*`).join("\n") : "└  ◦  Hanya koin emas dan exp...";
  let resultText = `Hi ${userName}!\nPeti harta karun *${conf.name}* berhasil dibuka!\n\n` + `–  *P E R O L E H A N  H A R T A*\n\n` + `┌  ◦  *Balance* : +Rp ${moneyGained.toLocaleString("id-ID")}\n` + `│  ◦  *Exp* : +${expGained} XP\n` + `${mcoinGained > 0 ? `│  ◦  *MCoin* : +${mcoinGained} MCoin\n` : ""}` + `│  ◦  *Sisa Peti Ini* : ${user.inventory.crate[crateType]} Box\n` + `└  ◦  *Level Karakter* : Lv. ${user.level} (${user.exp} / ${user.level * 100} XP)\n\n` + `–  *B O N U S  I T E M*\n\n` + `${bonusLines}\n\n`;
  if (lvlResult.isLevelUp) {
    resultText += `🌟 *LEVEL UP!* Level karakter naik ke *Lv. ${lvlResult.newLevel}*! Darah & Mana pulih penuh.\n\n`;
  }
  const buttons = [];
  if (user.inventory.crate[crateType] > 0) {
    buttons.push({
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: `📦 Buka Lagi (${user.inventory.crate[crateType]})`,
        id: `${prefix}open ${crateType}`
      })
    });
  }
  buttons.push({
    name: "quick_reply",
    buttonParamsJson: JSON.stringify({
      display_text: "🎒 Cek Inventory",
      id: `${prefix}inv`
    })
  }, {
    name: "quick_reply",
    buttonParamsJson: JSON.stringify({
      display_text: "🛡️ Pasang Gear (.equip)",
      id: `${prefix}equip`
    })
  });
  const options = {
    image: buffer,
    params: {
      bottom_sheet: {
        in_thread_buttons_limit: 2,
        list_title: "Crate Unboxing",
        button_title: "Aksi Selanjutnya"
      }
    },
    contextInfo: {
      mentionedJid: [sender]
    }
  };
  if (typeof ctx.sendCta === "function") return await ctx.sendCta(resultText, "Wudysoft • Crate Center", buttons, options);
  return await sock.sendMessage(ctx.id, {
    image: buffer,
    caption: resultText,
    mentions: [sender]
  }, {
    quoted: msg
  });
}
export default {
  name: "open",
  aliases: ["gacha", "bukabox", "opencrate", "crate"],
  description: "Membuka kotak harta karun (Common s/d Secret) dengan Dynamic HTML Canvas",
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
      if (/^[.#/!]?(open|gacha|bukabox|opencrate|crate)\s+[a-zA-Z0-9_]+/i.test(text)) {
        return await handleOpenAction(sock, ctx, msg, sender, text);
      }
    } catch (e) {
      console.error("[OPEN BEFORE ERROR]:", e);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      db.ensureUser(ctx.sender, ctx.pushname);
      const user = global.db.user[ctx.sender];
      const prefix = ctx.prefix || ".";
      const crateType = ctx.args[0]?.toLowerCase();
      const userName = ctx.pushname || ctx.sender.split("@")[0];
      if (crateType && CRATE_REWARDS[crateType]) {
        return await handleOpenAction(sock, ctx, msg, ctx.sender, `${prefix}open ${crateType}`);
      }
      const ownedRows = [];
      for (const [key, conf] of Object.entries(CRATE_REWARDS)) {
        const count = user.inventory?.crate?.[key] || 0;
        if (count > 0) {
          ownedRows.push({
            title: `${conf.emoji} Buka ${conf.name}`.slice(0, 24),
            description: `Tersedia: ${count} Box di dalam tas`,
            id: `${prefix}open ${key}`
          });
        }
      }
      const buttons = [];
      if (ownedRows.length > 0) {
        buttons.push({
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "🎁 PILIH CRATE UNTUK DIBUKA",
            sections: [{
              title: `Peti Milikmu (${ownedRows.length} Jenis)`,
              rows: ownedRows
            }]
          })
        });
      }
      buttons.push({
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🗼 Cari di Menara",
          id: `${prefix}tower`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "⚔️ Cari di Dungeon",
          id: `${prefix}dungeon`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🎒 Buka Inventory",
          id: `${prefix}inv`
        })
      });
      const menuText = `Hi ${userName}!\nBerikut adalah persediaan peti harta karun (Crate) di dalam tas Anda.\n\n` + `–  *P E R S E D I A A N  C R A T E*\n\n` + `┌  ◦  *Common* : ${user.inventory?.crate?.common || 0} Box\n` + `│  ◦  *Uncommon* : ${user.inventory?.crate?.uncommon || 0} Box\n` + `│  ◦  *Legendary* : ${user.inventory?.crate?.legendary || 0} Box\n` + `│  ◦  *Mythic* : ${user.inventory?.crate?.mythic || 0} Box\n` + `└  ◦  *Secret* : ${user.inventory?.crate?.secret || 0} Box\n\n` + `Pilih peti dari menu dropdown di bawah untuk membukanya:`;
      const options = {
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 2,
            list_title: "Crate Center",
            button_title: "Buka Peti Harta"
          }
        },
        contextInfo: {
          mentionedJid: [ctx.sender]
        }
      };
      if (typeof ctx.sendCta === "function") return await ctx.sendCta(menuText, "Wudysoft • Crate Center", buttons, options);
      return await sock.sendMessage(ctx.id, {
        text: menuText,
        mentions: [ctx.sender]
      }, {
        quoted: msg
      });
    } catch (err) {
      console.error("[CRATE ERROR]", err);
      ctx.reply(`❌ Terjadi kendala saat membuka peti: ${err.message}`);
    }
  }
};