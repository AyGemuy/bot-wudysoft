import axios from "axios";
import db from "../../data/db.js";
const BASE_STATS = {
  sword_stone: {
    name: "Stone Sword",
    type: "weapon",
    base: 8
  },
  sword_iron: {
    name: "Iron Sword",
    type: "weapon",
    base: 18
  },
  sword_diamond: {
    name: "Diamond Sword",
    type: "weapon",
    base: 35
  },
  sword_light: {
    name: "Holy Light Blade",
    type: "weapon",
    base: 60
  },
  sword_dark: {
    name: "Dark Abyss Blade",
    type: "weapon",
    base: 85
  },
  armor_leather: {
    name: "Leather Armor",
    type: "armor",
    base: 6
  },
  armor_iron: {
    name: "Iron Plate Armor",
    type: "armor",
    base: 15
  },
  armor_crystal: {
    name: "Crystal Aegis",
    type: "armor",
    base: 32
  }
};
const FORGE_TIERS = {
  1: {
    chance: 100,
    cost: 3e3,
    ores: {
      stone: 5,
      coal: 2
    },
    safe: true
  },
  2: {
    chance: 95,
    cost: 6e3,
    ores: {
      coal: 4,
      iron: 2
    },
    safe: true
  },
  3: {
    chance: 85,
    cost: 12e3,
    ores: {
      iron: 4,
      gold: 1
    },
    safe: true
  },
  4: {
    chance: 70,
    cost: 25e3,
    ores: {
      iron: 6,
      gold: 3
    },
    safe: false
  },
  5: {
    chance: 60,
    cost: 4e4,
    ores: {
      gold: 5,
      diamond: 1
    },
    safe: false
  },
  6: {
    chance: 50,
    cost: 65e3,
    ores: {
      gold: 8,
      diamond: 2
    },
    safe: false
  },
  7: {
    chance: 40,
    cost: 1e5,
    ores: {
      diamond: 4,
      platinum: 1
    },
    safe: false
  },
  8: {
    chance: 30,
    cost: 16e4,
    ores: {
      diamond: 6,
      platinum: 2
    },
    safe: false
  },
  9: {
    chance: 20,
    cost: 25e4,
    ores: {
      platinum: 4
    },
    safe: false
  },
  10: {
    chance: 10,
    cost: 5e5,
    ores: {
      platinum: 8
    },
    safe: false
  }
};

function generateForgeHTML(data) {
  const {
    itemKey,
    itemName,
    itemType,
    currentLevel,
    targetLevel,
    currentStat,
    nextStat,
    chance,
    costMoney,
    playerMoney,
    reqOres,
    playerOres,
    statusText,
    statusColor
  } = data;
  const hasEnoughMoney = playerMoney >= costMoney;
  let oresHTML = "";
  for (const [ore, needed] of Object.entries(reqOres)) {
    const owned = playerOres[ore] || 0;
    const isEnough = owned >= needed;
    oresHTML += `
      <div class="ore-item ${isEnough ? "enough" : "lacking"}">
        <span class="ore-name">💎 ${ore.toUpperCase()}</span>
        <span class="ore-qty">${owned} / ${needed}</span>
      </div>
    `;
  }
  const statLabel = itemType === "weapon" ? "ATTACK POWER" : "DEFENSE POWER";
  const statIcon = itemType === "weapon" ? "⚔️" : "🛡️";
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 960px;
      height: 540px;
      background: #0d0705;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: #fff;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .forge-canvas {
      width: 960px;
      height: 540px;
      background: radial-gradient(circle at 50% 15%, #3d1409 0%, #170703 65%, #080302 100%);
      border: 6px solid #2a1107;
      outline: 2px solid #ff7b25;
      position: relative;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 24px 32px;
      box-shadow: inset 0 0 100px rgba(0,0,0,0.95);
    }
    /* Top Header */
    .top-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid rgba(255, 123, 37, 0.4);
      padding-bottom: 12px;
    }
    .header-title {
      font-size: 24px;
      font-weight: 900;
      color: #ff9d42;
      letter-spacing: 2.5px;
      text-transform: uppercase;
      text-shadow: 0 0 14px rgba(255, 123, 37, 0.6);
    }
    .tier-badge {
      background: rgba(0,0,0,0.7);
      border: 1.5px solid #ff7b25;
      color: #ffd08a;
      padding: 5px 18px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 1px;
    }

    /* Main Grid */
    .forge-grid {
      display: grid;
      grid-template-columns: 420px 1fr;
      gap: 30px;
      align-items: center;
      margin: 10px 0;
    }

    /* Left Card: Item Anvil */
    .anvil-card {
      background: rgba(22, 10, 6, 0.9);
      border: 2px solid rgba(255, 123, 37, 0.45);
      border-radius: 18px;
      padding: 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 14px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.8), inset 0 0 20px rgba(255, 77, 0, 0.15);
      position: relative;
    }
    .glow-item-icon {
      font-size: 60px;
      filter: drop-shadow(0 0 20px #ff6600);
      margin-bottom: -6px;
    }
    .item-title {
      font-size: 22px;
      font-weight: 900;
      color: #fff2d6;
      letter-spacing: 1px;
    }
    .level-pill {
      background: linear-gradient(135deg, #ff4500, #ff8c00);
      color: #fff;
      font-size: 12px;
      font-weight: 900;
      padding: 3px 14px;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(255, 69, 0, 0.5);
    }
    .stat-comparison {
      width: 100%;
      background: rgba(0,0,0,0.5);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px;
      padding: 10px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 4px;
    }
    .stat-col { display: flex; flex-direction: column; }
    .stat-label { font-size: 10px; color: #a38d82; font-weight: 700; text-transform: uppercase; }
    .stat-val { font-size: 16px; font-weight: 800; color: #e2e8f0; }
    .stat-arrow { font-size: 20px; color: #ff9d42; font-weight: 900; }
    .next-val { color: #48bb78; }

    /* Right Panel: Requirements & Furnace */
    .furnace-card {
      background: rgba(22, 10, 6, 0.9);
      border: 2px solid rgba(255, 123, 37, 0.45);
      border-radius: 18px;
      padding: 22px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .section-title { font-size: 13px; font-weight: 800; color: #ff9d42; letter-spacing: 1.2px; text-transform: uppercase; }
    .ores-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .ore-item {
      background: rgba(0,0,0,0.6);
      border: 1px solid;
      border-radius: 10px;
      padding: 8px 12px;
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      font-weight: 700;
    }
    .ore-item.enough { border-color: #48bb78; color: #c6f6d5; }
    .ore-item.lacking { border-color: #f56565; color: #fed7d7; }

    /* Rate & Cost Box */
    .rate-box {
      background: rgba(0,0,0,0.55);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px;
      padding: 12px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .rate-chip {
      font-size: 22px;
      font-weight: 900;
      color: ${chance >= 70 ? "#48bb78" : chance >= 40 ? "#ecc94b" : "#f56565"};
      text-shadow: 0 0 10px rgba(0,0,0,0.8);
    }
    .cost-chip { font-size: 13px; font-weight: 700; color: ${hasEnoughMoney ? "#ecc94b" : "#f56565"}; text-align: right; }

    /* Bottom Bar */
    .bottom-bar {
      background: rgba(0,0,0,0.7);
      border: 1px solid rgba(255, 123, 37, 0.3);
      border-radius: 12px;
      padding: 10px 18px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 13px;
    }
    .status-msg { font-weight: 800; color: ${statusColor || "#ffd08a"}; letter-spacing: 0.8px; }
    .wallet-info { font-weight: 700; color: #ecc94b; }
  </style>
</head>
<body>
  <div class="forge-canvas">
    <div class="top-header">
      <div class="header-title">🔥 ROYAL BLACKSMITH FORGE 🔥</div>
      <div class="tier-badge">TARGET TEMPA: +${targetLevel}</div>
    </div>

    <div class="forge-grid">
      <!-- Item Info -->
      <div class="anvil-card">
        <div class="glow-item-icon">${itemType === "weapon" ? "⚔️" : "🛡️"}</div>
        <div class="item-title">${itemName}</div>
        <div class="level-pill">LEVEL SAAT INI: +${currentLevel}</div>

        <div class="stat-comparison">
          <div class="stat-col">
            <span class="stat-label">STAT SEKARANG</span>
            <span class="stat-val">${statIcon} ${currentStat}</span>
          </div>
          <div class="stat-arrow">➜</div>
          <div class="stat-col" style="text-align: right;">
            <span class="stat-label">SETELAH DITEMPA</span>
            <span class="stat-val next-val">${statIcon} ${nextStat}</span>
          </div>
        </div>
      </div>

      <!-- Materials Panel -->
      <div class="furnace-card">
        <div class="section-title">📦 BAHAN MINERAL DIBUTUHKAN</div>
        <div class="ores-grid">
          ${oresHTML}
        </div>

        <div class="section-title" style="margin-top: 4px;">🎯 PELUANG KEBERHASILAN & BIAYA</div>
        <div class="rate-box">
          <div>
            <div style="font-size: 10px; color: #a38d82; font-weight: 700;">CHANCE SUKSES</div>
            <div class="rate-chip">${chance}%</div>
          </div>
          <div>
            <div style="font-size: 10px; color: #a38d82; font-weight: 700; text-align: right;">BIAYA TEMPA</div>
            <div class="cost-chip">🪙 Rp ${costMoney.toLocaleString("id-ID")}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="bottom-bar">
      <div class="status-msg">${statusText || "Landasan tempa menyala membara. Siap untuk dipukul!"}</div>
      <div class="wallet-info">💰 Saldo: Rp ${playerMoney.toLocaleString("id-ID")}</div>
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
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
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

function initDB(jid, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.forge) global.db.forge = {};
  if (jid && !global.db.user[jid]) db.ensureUser(jid, name);
}

function saveDB() {
  if (typeof db?.write === "function" && global.db) db.write(global.db);
}

function cleanExpiredSessions(sender = null) {
  if (!global.db?.forge) return;
  const now = Date.now();
  for (const [id, s] of Object.entries(global.db.forge)) {
    if (s?.expireTime && now > s.expireTime) delete global.db.forge[id];
  }
  if (sender && global.db.forge[sender] && now > global.db.forge[sender].expireTime) {
    delete global.db.forge[sender];
  }
  saveDB();
}
async function sendForgeCTA(sock, ctx, targetId, {
  text,
  footer,
  buttons = [],
  imageBuffer = null,
  mentions = []
}) {
  const botName = global.bot?.name || "WudysoftBot";
  const finalFooter = footer || `${botName} • Blacksmith Workshop`;
  const formattedButtons = buttons.map(b => {
    if (b.buttonParamsJson) return b;
    return {
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: b.display_text || b.text || "Pilih",
        id: b.id || b.command || ""
      })
    };
  });
  const destJid = targetId || ctx?.id;
  const options = {
    jid: destJid,
    to: destJid,
    image: imageBuffer || undefined,
    params: {
      bottom_sheet: {
        in_thread_buttons_limit: 2,
        divider_indices: [1],
        list_title: `${botName} • Pandai Besi`,
        button_title: "Opsi Tempa"
      }
    },
    contextInfo: {
      forwardingScore: 999,
      isForwarded: true,
      mentionedJid: mentions || []
    }
  };
  if (typeof ctx?.sendCta === "function") {
    return await ctx.sendCta(text, finalFooter, formattedButtons, options);
  }
  return await sock.sendMessage(destJid, {
    image: imageBuffer || undefined,
    caption: text,
    mentions: mentions
  });
}
async function handleForgeAction(sock, ctx, msg, sender, rawText) {
  initDB(sender, ctx?.pushName || "");
  cleanExpiredSessions(sender);
  const session = global.db.forge[sender];
  if (!session) return;
  const parts = rawText.split(/\s+/);
  const action = (parts[1] || "").toLowerCase();
  const prefix = ctx.prefix || ".";
  const user = global.db.user[sender];
  user.refine = user.refine || {};
  user.inventory = user.inventory || {};
  user.inventory.ores = user.inventory.ores || {};
  user.money = Number(user.money) || 0;
  session.expireTime = Date.now() + 18e4;
  const itemKey = session.selectedItem;
  const itemInfo = BASE_STATS[itemKey];
  const curLvl = user.refine[itemKey] || 0;
  if (action === "select" || action === "pilih") {
    const newItem = parts[2]?.toLowerCase();
    if (!BASE_STATS[newItem]) {
      return ctx.reply("❌ Jenis item tersebut tidak dapat ditempa.");
    }
    session.selectedItem = newItem;
    saveDB();
    const nLvl = user.refine[newItem] || 0;
    const tLvl = Math.min(10, nLvl + 1);
    const tierCfg = FORGE_TIERS[tLvl];
    const curStat = BASE_STATS[newItem].base + nLvl * (BASE_STATS[newItem].type === "weapon" ? 6 : 4);
    const nxtStat = BASE_STATS[newItem].base + tLvl * (BASE_STATS[newItem].type === "weapon" ? 6 : 4);
    const hud = await renderHtmlToImage(generateForgeHTML({
      itemKey: newItem,
      itemName: BASE_STATS[newItem].name,
      itemType: BASE_STATS[newItem].type,
      currentLevel: nLvl,
      targetLevel: tLvl,
      currentStat: curStat,
      nextStat: nxtStat,
      chance: tierCfg.chance,
      costMoney: tierCfg.cost,
      playerMoney: user.money,
      reqOres: tierCfg.ores,
      playerOres: user.inventory.ores,
      statusText: `Senjata ${BASE_STATS[newItem].name} diletakkan di atas landasan.`,
      statusColor: "#48bb78"
    }));
    const buttons = [{
      display_text: "🔨 Pukul Palu (Mulai Tempa)",
      id: `${prefix}forge hammer`
    }, {
      display_text: "🚪 Tinggalkan Bengkel",
      id: `${prefix}forge exit`
    }];
    return await sendForgeCTA(sock, ctx, ctx.id, {
      text: `🔥 *LANDASAN PANDAI BESI DIPERBARUI!*\n\nKamu memilih untuk meningkatkan *${BASE_STATS[newItem].name} (+${nLvl})*.\nTekan tombol di bawah untuk menempa.`,
      buttons: buttons,
      imageBuffer: hud.buffer,
      mentions: [sender]
    });
  }
  if (action === "hammer" || action === "tempa") {
    if (curLvl >= 10) {
      return ctx.reply("✨ Perlengkapan ini telah mencapai tingkat tempa maksimal (+10 DIVINE)!");
    }
    const targetLvl = curLvl + 1;
    const tier = FORGE_TIERS[targetLvl];
    if (user.money < tier.cost) {
      return ctx.reply(`❌ Uang tidak cukup! Biaya tempa adalah *Rp ${tier.cost.toLocaleString("id-ID")}* (Saldo: Rp ${user.money.toLocaleString("id-ID")}).`);
    }
    for (const [ore, needed] of Object.entries(tier.ores)) {
      if ((user.inventory.ores[ore] || 0) < needed) {
        return ctx.reply(`❌ Mineral tidak mencukupi! Kamu butuh *${needed}x ${ore.toUpperCase()}* (Milikmu: ${user.inventory.ores[ore] || 0}).\nCari mineral di tambang dengan *${prefix}mine*!`);
      }
    }
    user.money -= tier.cost;
    for (const [ore, needed] of Object.entries(tier.ores)) {
      user.inventory.ores[ore] -= needed;
    }
    const roll = Math.random() * 100;
    const isSuccess = roll <= tier.chance;
    let statusMsg = "";
    let statusColor = "";
    if (isSuccess) {
      user.refine[itemKey] = targetLvl;
      statusMsg = `DENTINGAN EMAS! Tempaan berhasil naik ke +${targetLvl}!`;
      statusColor = "#48bb78";
    } else {
      if (tier.safe) {
        statusMsg = `TEMPAAN MELESET! Tempaan gagal namun level item aman (+${curLvl}).`;
        statusColor = "#ecc94b";
      } else {
        user.refine[itemKey] = Math.max(0, curLvl - 1);
        statusMsg = `LOGAM RETAK! Tempaan gagal dan level turun ke +${user.refine[itemKey]}!`;
        statusColor = "#f56565";
      }
    }
    saveDB();
    const newCurLvl = user.refine[itemKey] || 0;
    const newTgtLvl = Math.min(10, newCurLvl + 1);
    const nextCfg = FORGE_TIERS[newTgtLvl] || FORGE_TIERS[10];
    const curStat = itemInfo.base + newCurLvl * (itemInfo.type === "weapon" ? 6 : 4);
    const nxtStat = itemInfo.base + newTgtLvl * (itemInfo.type === "weapon" ? 6 : 4);
    const hud = await renderHtmlToImage(generateForgeHTML({
      itemKey: itemKey,
      itemName: itemInfo.name,
      itemType: itemInfo.type,
      currentLevel: newCurLvl,
      targetLevel: newTgtLvl,
      currentStat: curStat,
      nextStat: nxtStat,
      chance: nextCfg.chance,
      costMoney: nextCfg.cost,
      playerMoney: user.money,
      reqOres: nextCfg.ores,
      playerOres: user.inventory.ores,
      statusText: statusMsg,
      statusColor: statusColor
    }));
    const resultButtons = [{
      display_text: "🔨 Tempa Lagi",
      id: `${prefix}forge hammer`
    }, {
      display_text: "🎒 Cek Tas (.inv)",
      id: `${prefix}inv`
    }, {
      display_text: "🚪 Selesai",
      id: `${prefix}forge exit`
    }];
    let caption = isSuccess ? `🎉 *DENTINGAN PALU BERHASIL!* 🎉\n\nSelamat! *${itemInfo.name}* berhasil ditingkatkan menjadi *+${newCurLvl}*!\nStat tempurmu meningkat pesat!` : `💥 *TEMPAAN GAGAL!* 💥\n\n${statusMsg}\nBahan mineral dan biaya telah terpakai oleh pandai besi.`;
    return await sendForgeCTA(sock, ctx, ctx.id, {
      text: caption,
      buttons: resultButtons,
      imageBuffer: hud.buffer,
      mentions: [sender]
    });
  }
  if (action === "exit" || action === "keluar") {
    delete global.db.forge[sender];
    saveDB();
    return ctx.reply("🚪 Kamu telah meninggalkan bengkel pandai besi. Senjatamu telah disimpan kembali ke tas.");
  }
}
export default {
  name: "forge",
  aliases: ["tempa", "blacksmith", "refine"],
  description: "Menempa senjata dan baju zirah ke +1 hingga +10 dengan Dynamic Realistic HTML Canvas",
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
      if (/^[.#/!]?forge\s+(hammer|tempa|select|pilih|exit|keluar)/i.test(text)) {
        return await handleForgeAction(sock, ctx, msg, sender, text);
      }
    } catch (e) {
      console.error("[FORGE BEFORE ERROR]:", e);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      const sender = ctx.sender;
      const prefix = ctx.prefix || ".";
      const userName = ctx.pushName || sender.split("@")[0];
      initDB(sender, userName);
      cleanExpiredSessions(sender);
      const user = global.db.user[sender];
      user.refine = user.refine || {};
      user.equipped = user.equipped || {
        weapon: "sword_stone",
        armor: null
      };
      user.inventory = user.inventory || {};
      user.inventory.ores = user.inventory.ores || {};
      user.money = Number(user.money) || 0;
      const defaultItem = user.equipped.weapon || "sword_stone";
      const itemInfo = BASE_STATS[defaultItem];
      const curLvl = user.refine[defaultItem] || 0;
      const targetLvl = Math.min(10, curLvl + 1);
      const tier = FORGE_TIERS[targetLvl];
      const curStat = itemInfo.base + curLvl * (itemInfo.type === "weapon" ? 6 : 4);
      const nxtStat = itemInfo.base + targetLvl * (itemInfo.type === "weapon" ? 6 : 4);
      global.db.forge[sender] = {
        sessionId: Date.now(),
        selectedItem: defaultItem,
        expireTime: Date.now() + 18e4
      };
      saveDB();
      const hud = await renderHtmlToImage(generateForgeHTML({
        itemKey: defaultItem,
        itemName: itemInfo.name,
        itemType: itemInfo.type,
        currentLevel: curLvl,
        targetLevel: targetLvl,
        currentStat: curStat,
        nextStat: nxtStat,
        chance: tier.chance,
        costMoney: tier.cost,
        playerMoney: user.money,
        reqOres: tier.ores,
        playerOres: user.inventory.ores,
        statusText: "Bengkel siap. Masukkan bahan dan ketuk palu tempa!",
        statusColor: "#ffd08a"
      }));
      const startButtons = [{
        display_text: "🔨 Pukul Palu (Tempa)",
        id: `${prefix}forge hammer`
      }, {
        display_text: "🛡️ Tempa Armor Iron",
        id: `${prefix}forge select armor_iron`
      }, {
        display_text: "🚪 Batal",
        id: `${prefix}forge exit`
      }];
      const introText = `🔥 *SELAMAT DATANG DI BENGKEL PANDAI BESI KERAJAAN!* 🔥\n\n` + `Pandai Besi siap menempa perlengkapanmu hingga *+10 DIVINE*!\n` + `• Target Item: *${itemInfo.name} (+${curLvl})*\n` + `• Target Tingkat: *+${targetLvl}*\n` + `• Peluang Sukses: *${tier.chance}%*\n` + `• Biaya Jasa: *Rp ${tier.cost.toLocaleString("id-ID")}*\n\n` + `_Pastikan kantong mineralmu mencukupi sebelum memukul palu!_`;
      await sendForgeCTA(sock, ctx, ctx.id, {
        text: introText,
        buttons: startButtons,
        imageBuffer: hud.buffer,
        mentions: [sender]
      });
    } catch (err) {
      console.error("[FORGE EXECUTE ERROR]:", err);
      ctx.reply(`❌ Terjadi kendala di bengkel pandai besi: ${err.message}`);
    }
  }
};