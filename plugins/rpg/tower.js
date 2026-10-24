import axios from "axios";
import db from "../../data/db.js";
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

function getZoneInfo(floor) {
  if (floor <= 5) return {
    name: "Ancient Ruins",
    color: "#48bb78",
    bg: "#0a1f14"
  };
  if (floor <= 10) return {
    name: "Magma Crypt",
    color: "#f56565",
    bg: "#2d0f0e"
  };
  if (floor <= 15) return {
    name: "Abyssal Nether",
    color: "#9f7aea",
    bg: "#170f2d"
  };
  return {
    name: "Celestial Dragon Spire",
    color: "#ecc94b",
    bg: "#2b2207"
  };
}

function generateTowerHTML(data) {
  const {
    floor,
    zone,
    playerName,
    playerHp,
    playerHpMax,
    playerMana,
    playerManaMax,
    weaponName,
    armorName,
    totalAtk,
    totalDef,
    event,
    loot
  } = data;
  const hpPct = Math.max(0, Math.min(100, Math.round(playerHp / playerHpMax * 100)));
  const mpPct = Math.max(0, Math.min(100, Math.round(playerMana / playerManaMax * 100)));
  let eventHTML = "";
  if (event.type === "MONSTER") {
    const monHpPct = Math.max(0, Math.min(100, Math.round(event.hp / event.hpMax * 100)));
    eventHTML = `
      <div class="encounter-card monster">
        <div class="card-badge">ENEMY GUARDIAN</div>
        <div class="entity-avatar">👹</div>
        <div class="entity-name">${event.title}</div>
        <div class="bar-container">
          <div class="bar-fill hp-enemy" style="width: ${monHpPct}%;"></div>
          <span class="bar-text">${event.hp} / ${event.hpMax} HP</span>
        </div>
        <div class="stat-pills">
          <span class="pill atk">⚔️ ${event.atk} ATK</span>
          <span class="pill reward">💰 +${event.rewardGold.toLocaleString()}</span>
        </div>
      </div>
    `;
  } else if (event.type === "CHEST") {
    eventHTML = `
      <div class="encounter-card chest">
        <div class="card-badge gold">TREASURE CHEST</div>
        <div class="entity-avatar chest-glow">📦</div>
        <div class="entity-name">${event.title}</div>
        <div class="chest-desc">Peti terpatri segel magis kuno. Simpan mineral langka dan berkantung-kantung emas!</div>
        <div class="stat-pills">
          <span class="pill reward">💰 +${event.rewardGold.toLocaleString()}</span>
          <span class="pill ore">💎 Rare Ore</span>
        </div>
      </div>
    `;
  } else if (event.type === "SHRINE") {
    eventHTML = `
      <div class="encounter-card shrine">
        <div class="card-badge cyan">HOLY SANCTUARY</div>
        <div class="entity-avatar shrine-glow">🕊️</div>
        <div class="entity-name">${event.title}</div>
        <div class="chest-desc">Mata air suci Dewi memancarkan aura murni. Seluruh luka dan tenaga dipulihkan!</div>
        <div class="stat-pills">
          <span class="pill hp-pill">💖 +${event.healHp} HP</span>
          <span class="pill mp-pill">🔷 +${event.healMp} MP</span>
        </div>
      </div>
    `;
  }
  const oresDisplay = Object.entries(loot.ores || {}).filter(([_, q]) => q > 0).map(([k, q]) => `<span>💎 ${q}x ${k.toUpperCase()}</span>`).join(" ") || "<i>Kosong</i>";
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 960px;
      height: 540px;
      background: #080c10;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: #fff;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .hud-frame {
      width: 960px;
      height: 540px;
      background: radial-gradient(circle at 50% 30%, ${zone.bg} 0%, #080b0f 85%);
      border: 6px solid #23180d;
      outline: 2px solid #d4af37;
      position: relative;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 24px 30px;
      box-shadow: inset 0 0 80px rgba(0,0,0,0.9);
    }
    /* Top Bar */
    .top-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid rgba(212, 175, 55, 0.35);
      padding-bottom: 12px;
    }
    .floor-tag {
      font-size: 26px;
      font-weight: 900;
      color: #ecc94b;
      letter-spacing: 2px;
      text-shadow: 0 0 10px rgba(236, 201, 75, 0.5);
    }
    .zone-badge {
      background: rgba(0,0,0,0.6);
      border: 1px solid ${zone.color};
      color: ${zone.color};
      padding: 4px 16px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1.5px;
    }

    /* Main Grid */
    .main-grid {
      display: grid;
      grid-template-columns: 360px 1fr;
      gap: 30px;
      align-items: center;
      margin: 10px 0;
    }

    /* Player Profile Panel */
    .player-panel {
      background: rgba(13, 17, 23, 0.85);
      border: 2px solid rgba(212, 175, 55, 0.4);
      border-radius: 16px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.7);
    }
    .player-header {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .player-avatar {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: #1a2433;
      border: 2px solid #ecc94b;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
    }
    .player-name {
      font-size: 18px;
      font-weight: 800;
      color: #f7eed2;
    }
    .gear-info {
      font-size: 11px;
      color: #a0aec0;
    }
    .bar-container {
      width: 100%;
      height: 22px;
      background: #14171c;
      border-radius: 11px;
      border: 1px solid rgba(255,255,255,0.15);
      position: relative;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: inset 0 2px 4px rgba(0,0,0,0.8);
    }
    .bar-fill {
      position: absolute;
      left: 0;
      top: 0;
      height: 100%;
      border-radius: 11px;
      transition: width 0.3s;
    }
    .hp-fill { background: linear-gradient(90deg, #c53030 0%, #e53e3e 100%); }
    .mp-fill { background: linear-gradient(90deg, #2b6cb0 0%, #3182ce 100%); }
    .hp-enemy { background: linear-gradient(90deg, #9b2c2c 0%, #dd6b20 100%); }
    .bar-text {
      position: relative;
      font-size: 11px;
      font-weight: 900;
      color: #fff;
      text-shadow: 0 1px 3px rgba(0,0,0,0.9);
      z-index: 2;
    }
    .player-stats-row {
      display: flex;
      justify-content: space-between;
      border-top: 1px solid rgba(255,255,255,0.1);
      padding-top: 10px;
    }
    .stat-box { font-size: 12px; font-weight: 700; color: #cbd5e0; }

    /* Encounter Panel */
    .encounter-card {
      background: rgba(18, 22, 31, 0.9);
      border: 2px solid rgba(229, 62, 62, 0.4);
      border-radius: 18px;
      padding: 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      box-shadow: 0 0 30px rgba(0,0,0,0.8);
      position: relative;
    }
    .encounter-card.chest { border-color: rgba(236, 201, 75, 0.6); }
    .encounter-card.shrine { border-color: rgba(56, 178, 172, 0.6); }
    .card-badge {
      position: absolute;
      top: -12px;
      background: #c53030;
      color: #fff;
      font-size: 10px;
      font-weight: 900;
      padding: 2px 12px;
      border-radius: 10px;
      letter-spacing: 1px;
    }
    .card-badge.gold { background: #d69e2e; color: #000; }
    .card-badge.cyan { background: #319795; }
    .entity-avatar { font-size: 54px; filter: drop-shadow(0 0 12px rgba(255,0,0,0.4)); }
    .chest-glow { filter: drop-shadow(0 0 14px rgba(236, 201, 75, 0.6)); }
    .shrine-glow { filter: drop-shadow(0 0 14px rgba(56, 178, 172, 0.7)); }
    .entity-name { font-size: 20px; font-weight: 900; color: #f7fafc; letter-spacing: 1px; }
    .chest-desc { font-size: 12px; color: #cbd5e0; text-align: center; line-height: 1.5; padding: 0 16px; }
    .stat-pills { display: flex; gap: 10px; margin-top: 4px; }
    .pill {
      padding: 4px 12px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 800;
    }
    .pill.atk { background: rgba(229, 62, 62, 0.25); color: #feb2b2; border: 1px solid #e53e3e; }
    .pill.reward { background: rgba(236, 201, 75, 0.2); color: #fefcbf; border: 1px solid #ecc94b; }
    .pill.ore { background: rgba(66, 153, 225, 0.2); color: #bee3f8; border: 1px solid #4299e1; }
    .pill.hp-pill { background: rgba(72, 187, 120, 0.2); color: #9ae6b4; border: 1px solid #48bb78; }
    .pill.mp-pill { background: rgba(49, 130, 206, 0.2); color: #bee3f8; border: 1px solid #3182ce; }

    /* Bottom Loot Bar */
    .loot-tray {
      background: rgba(0, 0, 0, 0.7);
      border: 1px solid rgba(212, 175, 55, 0.3);
      border-radius: 12px;
      padding: 10px 18px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 13px;
    }
    .loot-title { font-weight: 800; color: #ecc94b; letter-spacing: 1px; }
    .loot-items { display: flex; gap: 16px; font-weight: 700; color: #e2e8f0; }
  </style>
</head>
<body>
  <div class="hud-frame">
    <div class="top-bar">
      <div class="floor-tag">CELESTIAL SPIRE • FLOOR ${floor}</div>
      <div class="zone-badge">${zone.name}</div>
    </div>

    <div class="main-grid">
      <!-- Player Card -->
      <div class="player-panel">
        <div class="player-header">
          <div class="player-avatar">🗡️</div>
          <div>
            <div class="player-name">${playerName}</div>
            <div class="gear-info">${weaponName} • ${armorName}</div>
          </div>
        </div>

        <div class="bar-container">
          <div class="bar-fill hp-fill" style="width: ${hpPct}%;"></div>
          <span class="bar-text">HEALTH: ${playerHp} / ${playerHpMax}</span>
        </div>

        <div class="bar-container">
          <div class="bar-fill mp-fill" style="width: ${mpPct}%;"></div>
          <span class="bar-text">MANA: ${playerMana} / ${playerManaMax}</span>
        </div>

        <div class="player-stats-row">
          <span class="stat-box">⚔️ ${totalAtk} ATK</span>
          <span class="stat-box">🛡️ ${totalDef} DEF</span>
        </div>
      </div>

      <!-- Encounter Display -->
      <div>${eventHTML}</div>
    </div>

    <!-- Bottom Loot Bag -->
    <div class="loot-tray">
      <div class="loot-title">🎒 TEMPORARY LOOT POUCH</div>
      <div class="loot-items">
        <span>💰 Rp ${loot.gold.toLocaleString("id-ID")}</span>
        <span>✨ +${loot.exp} EXP</span>
        <span>${oresDisplay}</span>
      </div>
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
  if (!global.db.tower) global.db.tower = {};
  if (jid && !global.db.user[jid]) db.ensureUser(jid, name);
}

function saveDB() {
  if (typeof db?.write === "function" && global.db) db.write(global.db);
}

function cleanExpiredSessions(sender = null) {
  if (!global.db?.tower) return;
  const now = Date.now();
  for (const [id, s] of Object.entries(global.db.tower)) {
    if (s?.expireTime && now > s.expireTime) delete global.db.tower[id];
  }
  if (sender && global.db.tower[sender] && now > global.db.tower[sender].expireTime) {
    delete global.db.tower[sender];
  }
  saveDB();
}

function generateFloorEvent(floor) {
  const roll = Math.random();
  if (roll < .6) {
    const hpMon = 65 + floor * 32;
    const atkMon = 14 + floor * 6;
    return {
      type: "MONSTER",
      title: floor % 5 === 0 ? `Boss Penjaga Lantai ${floor}` : `Monster Lv. ${floor}`,
      hp: hpMon,
      hpMax: hpMon,
      atk: atkMon,
      rewardExp: 40 + floor * 18,
      rewardGold: 2e3 + floor * 800
    };
  } else if (roll < .85) {
    return {
      type: "CHEST",
      title: `Peti Harta Lantai ${floor}`,
      rewardGold: 3500 + floor * 1200,
      rewardOre: floor > 8 ? "diamond" : floor > 4 ? "gold" : "iron"
    };
  } else {
    return {
      type: "SHRINE",
      title: `Altar Dewi Lantai ${floor}`,
      healHp: 45 + floor * 6,
      healMp: 25 + floor * 4
    };
  }
}
async function renderCurrentStateHUD(user, session, userName) {
  const weaponName = user.equipped?.weapon ? user.equipped.weapon.replace(/_/g, " ").toUpperCase() : "Tangan Kosong";
  const armorName = user.equipped?.armor ? user.equipped.armor.replace(/_/g, " ").toUpperCase() : "Pakaian Biasa";
  const userWpn = WEAPON_BONUS[user.equipped?.weapon] || 0;
  const userArm = ARMOR_BONUS[user.equipped?.armor] || 0;
  const html = generateTowerHTML({
    floor: session.floor,
    zone: getZoneInfo(session.floor),
    playerName: userName,
    playerHp: user.hp || 100,
    playerHpMax: user.hpMax || 100,
    playerMana: user.mana || 50,
    playerManaMax: user.manaMax || 50,
    weaponName: weaponName,
    armorName: armorName,
    totalAtk: (user.atk || 10) + userWpn,
    totalDef: (user.def || 5) + userArm,
    event: session.event || {
      type: "NONE"
    },
    loot: session.loot
  });
  return await renderHtmlToImage(html);
}
async function sendTowerCTA(sock, ctx, targetId, {
  text,
  footer,
  buttons = [],
  imageBuffer = null,
  mentions = []
}) {
  const botName = global.bot?.name || "WudysoftBot";
  const finalFooter = footer || `${botName} • Menara Langit`;
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
        list_title: `${botName} • Aksi Ekspedisi`,
        button_title: "Opsi Lantai"
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
async function handleTowerAction(sock, ctx, msg, sender, rawText) {
  initDB(sender, ctx?.pushName || "");
  cleanExpiredSessions(sender);
  const session = global.db.tower[sender];
  if (!session || session.state !== "EXPLORING") return;
  const parts = rawText.split(/\s+/);
  const action = (parts[1] || "").toLowerCase();
  const prefix = ctx.prefix || ".";
  const user = global.db.user[sender];
  const userName = ctx.pushName || sender.split("@")[0];
  session.expireTime = Date.now() + 18e4;
  const userWpn = WEAPON_BONUS[user.equipped?.weapon] || 0;
  const userArm = ARMOR_BONUS[user.equipped?.armor] || 0;
  const totalAtk = (user.atk || 10) + userWpn;
  const totalDef = (user.def || 5) + userArm;
  if (action === "attack" || action === "serang") {
    if (session.event?.type !== "MONSTER") return ctx.reply("❌ Tidak ada musuh di hadapanmu.");
    const ev = session.event;
    const pDmg = Math.max(12, Math.floor(totalAtk + Math.random() * 12));
    ev.hp = Math.max(0, ev.hp - pDmg);
    let log = `⚔️ *@${sender.split("@")[0]}* melancarkan tebasan mematikan sebesar *${pDmg} DMG*!\n`;
    if (ev.hp <= 0) {
      session.loot.gold += ev.rewardGold;
      session.loot.exp += ev.rewardExp;
      session.event = {
        type: "NONE"
      };
      saveDB();
      log += `🎉 *${ev.title}* tumbang berkalang tanah!\n💰 +Rp ${ev.rewardGold.toLocaleString("id-ID")} | ✨ +${ev.rewardExp} EXP aman di tas sementara.`;
      const hud = await renderCurrentStateHUD(user, session, userName);
      const winButtons = [{
        display_text: "⬆️ Naik ke Lantai Berikutnya",
        id: `${prefix}tower next`
      }, {
        display_text: "🚪 Evakuasi (Bawa Pulang Loot)",
        id: `${prefix}tower claim`
      }];
      return await sendTowerCTA(sock, ctx, ctx.id, {
        text: `–  *L A N T A I  ${session.floor}  C L E A R*\n\n${log}\n\nLanjut ke lantai lebih tinggi atau mundur membawa jarahan?`,
        buttons: winButtons,
        imageBuffer: hud.buffer,
        mentions: [sender]
      });
    }
    const mDmg = Math.max(6, Math.floor(ev.atk - totalDef * .4 + Math.random() * 6));
    user.hp = Math.max(0, (user.hp || 100) - mDmg);
    if (user.hp <= 0) {
      user.hp = 1;
      const lostGold = Math.floor(session.loot.gold * .5);
      delete global.db.tower[sender];
      saveDB();
      return ctx.reply(`💀 *KAMU TEWAS DI LANTAI ${session.floor}!* 💀\n\nTubuhmu dihempas keluar dari Menara. Kamu kehilangan 50% jarahan (-Rp ${lostGold.toLocaleString("id-ID")}).\nGunakan *${prefix}rest* untuk memulihkan diri!`);
    }
    log += `💥 Monster membalas serbuan sebesar *-${mDmg} HP*!\n🩸 Kondisimu: ${user.hp}/${user.hpMax} HP.`;
    saveDB();
    const hud = await renderCurrentStateHUD(user, session, userName);
    const combatButtons = [{
      display_text: "⚔️ Serang Lagi",
      id: `${prefix}tower attack`
    }, {
      display_text: "🏃 Mundur & Evakuasi",
      id: `${prefix}tower claim`
    }];
    return await sendTowerCTA(sock, ctx, ctx.id, {
      text: `–  *T E M P U R  L A N T A I  ${session.floor}*\n\n${log}`,
      buttons: combatButtons,
      imageBuffer: hud.buffer,
      mentions: [sender]
    });
  }
  if (action === "chest" || action === "buka") {
    if (session.event?.type !== "CHEST") return ctx.reply("❌ Tidak ada peti di lantai ini.");
    const ev = session.event;
    session.loot.gold += ev.rewardGold;
    session.loot.ores[ev.rewardOre] = (session.loot.ores[ev.rewardOre] || 0) + 1;
    session.event = {
      type: "NONE"
    };
    saveDB();
    const hud = await renderCurrentStateHUD(user, session, userName);
    const nextButtons = [{
      display_text: "⬆️ Lanjut Naik Lantai",
      id: `${prefix}tower next`
    }, {
      display_text: "🚪 Evakuasi Bawa Loot",
      id: `${prefix}tower claim`
    }];
    return await sendTowerCTA(sock, ctx, ctx.id, {
      text: `📦 *PETI KUNO TERBUKA!*\n\n• +Rp ${ev.rewardGold.toLocaleString("id-ID")} Gold\n• +1x ${ev.rewardOre.toUpperCase()} Ore\n\nHarta telah dimasukkan ke kantong sementara.`,
      buttons: nextButtons,
      imageBuffer: hud.buffer,
      mentions: [sender]
    });
  }
  if (action === "next" || action === "naik") {
    session.floor += 1;
    session.event = generateFloorEvent(session.floor);
    if (session.event.type === "SHRINE") {
      user.hp = Math.min(user.hpMax || 100, (user.hp || 0) + session.event.healHp);
      user.mana = Math.min(user.manaMax || 50, (user.mana || 0) + session.event.healMp);
    }
    saveDB();
    const hud = await renderCurrentStateHUD(user, session, userName);
    const ev = session.event;
    const actBtns = [];
    if (ev.type === "MONSTER") {
      actBtns.push({
        display_text: "⚔️ Tebas Monster",
        id: `${prefix}tower attack`
      });
    } else if (ev.type === "CHEST") {
      actBtns.push({
        display_text: "📦 Buka Peti",
        id: `${prefix}tower chest`
      });
    } else {
      actBtns.push({
        display_text: "⬆️ Lanjut Naik",
        id: `${prefix}tower next`
      });
    }
    actBtns.push({
      display_text: "🚪 Keluar & Amankan Loot",
      id: `${prefix}tower claim`
    });
    return await sendTowerCTA(sock, ctx, ctx.id, {
      text: `🗼 *TIBA DI LANTAI ${session.floor}*\nZona: *${getZoneInfo(session.floor).name}*\n\nTentukan langkahmu berikutnya melalui tombol di bawah:`,
      buttons: actBtns,
      imageBuffer: hud.buffer,
      mentions: [sender]
    });
  }
  if (action === "claim" || action === "keluar") {
    const l = session.loot;
    user.money = (Number(user.money) || 0) + l.gold;
    user.exp = (Number(user.exp) || 0) + l.exp;
    user.inventory = user.inventory || {};
    user.inventory.ores = user.inventory.ores || {};
    for (const [ore, q] of Object.entries(l.ores || {})) {
      user.inventory.ores[ore] = (user.inventory.ores[ore] || 0) + q;
    }
    let bonus = "";
    if (session.floor >= 10) {
      user.inventory.crate = user.inventory.crate || {};
      user.inventory.crate.mythic = (user.inventory.crate.mythic || 0) + 1;
      bonus = "\n📦 *Bonus Ekspedisi Tinggi:* +1x MYTHIC CRATE!";
    }
    const reach = session.floor;
    delete global.db.tower[sender];
    saveDB();
    const claimText = `🎉 *EVAKUASI MENARA BERHASIL!* 🎉\n\n` + `Petualang @${userName} mundur dengan selamat dari *Lantai ${reach}*.\n\n` + `–  *H A S I L  J A R A H A N*\n\n` + `┌  ◦  *Total Gold* : +Rp ${l.gold.toLocaleString("id-ID")}\n` + `├  ◦  *Total EXP* : +${l.exp} XP\n` + `└  ◦  *Mineral* : ${Object.entries(l.ores).map(([ k, v ]) => `${v}x ${k.toUpperCase()}`).join(", ") || "Tidak ada"}` + `${bonus}\n\nSeluruh jarahan telah diamankan ke tas inventaris Anda.`;
    const exitButtons = [{
      display_text: "🎒 Cek Tas (.inv)",
      id: `${prefix}inv`
    }, {
      display_text: "🗼 Panjat Lagi",
      id: `${prefix}tower`
    }];
    return await sendTowerCTA(sock, ctx, ctx.id, {
      text: claimText,
      buttons: exitButtons,
      mentions: [sender]
    });
  }
}
export default {
  name: "tower",
  aliases: ["menara", "spire", "climb"],
  description: "Mendaki Menara Langit dengan Dynamic Realistic HTML Canvas HUD",
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
      if (/^[.#/!]?tower\s+(attack|serang|chest|buka|next|naik|claim|keluar)/i.test(text)) {
        return await handleTowerAction(sock, ctx, msg, sender, text);
      }
    } catch (e) {
      console.error("[TOWER BEFORE ERROR]:", e);
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
      if ((user.hp || 0) < 25) {
        return ctx.reply(`❌ Tubuhmu terlalu sekarat (*${user.hp}/${user.hpMax} HP*). Istirahatlah dengan *${prefix}rest* sebelum mendaki!`);
      }
      if (global.db.tower[sender]) {
        const s = global.db.tower[sender];
        return ctx.reply(`⚠️ Kamu sedang bertualang di *Lantai ${s.floor}* Menara Langit! Ketik *${prefix}tower next* untuk melangkah atau *${prefix}tower claim* untuk evakuasi.`);
      }
      const firstEvent = generateFloorEvent(1);
      global.db.tower[sender] = {
        sessionId: Date.now(),
        state: "EXPLORING",
        floor: 1,
        event: firstEvent,
        loot: {
          gold: 0,
          exp: 0,
          ores: {}
        },
        expireTime: Date.now() + 18e4
      };
      saveDB();
      const hud = await renderCurrentStateHUD(user, global.db.tower[sender], userName);
      const startButtons = [];
      if (firstEvent.type === "MONSTER") {
        startButtons.push({
          display_text: "⚔️ Serang Musuh",
          id: `${prefix}tower attack`
        });
      } else if (firstEvent.type === "CHEST") {
        startButtons.push({
          display_text: "📦 Buka Peti",
          id: `${prefix}tower chest`
        });
      } else {
        startButtons.push({
          display_text: "⬆️ Lanjut Naik",
          id: `${prefix}tower next`
        });
      }
      startButtons.push({
        display_text: "🚪 Putar Balik",
        id: `${prefix}tower claim`
      });
      await sendTowerCTA(sock, ctx, ctx.id, {
        text: `🗼 *GERBANG MENARA LANGIT DIBUKA!* 🗼\n\nSelamat datang petualang @${userName}!\nKamu memasuki *Lantai 1*.\nLawan rintangan di hadapanmu atau putar balik!`,
        buttons: startButtons,
        imageBuffer: hud.buffer,
        mentions: [sender]
      });
    } catch (err) {
      console.error("[TOWER EXECUTE ERROR]:", err);
      ctx.reply(`❌ Terjadi kendala di menara: ${err.message}`);
    }
  }
};