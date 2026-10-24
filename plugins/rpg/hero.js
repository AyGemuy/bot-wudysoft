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
const GUILD_TITLES = {
  F: "Novice Recruit",
  E: "Apprentice Scout",
  D: "Bronze Mercenary",
  C: "Silver Knight",
  B: "Gold Vanguard",
  A: "Platinum Champion",
  S: "Mythic Grandmaster",
  SSS: "Legendary Guild Sovereign"
};

function generateHeroCardHTML(data) {
  const {
    playerName,
    level,
    guildTitle,
    combatPower,
    hp,
    hpMax,
    mana,
    manaMax,
    weaponName,
    weaponRefine,
    armorName,
    armorRefine,
    petName,
    petBuffText,
    stats,
    freePoints
  } = data;
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
    .hero-license {
      width: 960px;
      height: 540px;
      background: radial-gradient(circle at 30% 20%, #151924 0%, #0c0e14 70%, #050608 100%);
      border: 6px solid #1a1e2b;
      outline: 2px solid #ecc94b;
      position: relative;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 24px 30px;
      box-shadow: inset 0 0 90px rgba(0,0,0,0.95);
    }
    /* Top Header */
    .top-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid rgba(236, 201, 75, 0.4);
      padding-bottom: 12px;
    }
    .title-box { display: flex; flex-direction: column; }
    .hero-name {
      font-size: 26px;
      font-weight: 900;
      color: #f7fafc;
      letter-spacing: 1.5px;
    }
    .hero-subtitle {
      font-size: 13px;
      font-weight: 700;
      color: #ecc94b;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .cp-capsule {
      background: rgba(0,0,0,0.7);
      border: 2px solid #ff7b25;
      padding: 6px 20px;
      border-radius: 20px;
      display: flex;
      align-items: center;
      gap: 10px;
      box-shadow: 0 0 15px rgba(255, 123, 37, 0.4);
    }
    .cp-label { font-size: 11px; font-weight: 900; color: #ff9d42; letter-spacing: 1px; }
    .cp-val { font-size: 22px; font-weight: 900; color: #fff; }

    /* 3 Columns Layout */
    .main-grid {
      display: grid;
      grid-template-columns: 280px 300px 1fr;
      gap: 20px;
      align-items: center;
      margin: 10px 0;
    }

    /* Column 1: Vitals & Identity */
    .card-panel {
      background: rgba(18, 22, 33, 0.85);
      border: 1.5px solid rgba(236, 201, 75, 0.3);
      border-radius: 14px;
      padding: 18px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      box-shadow: 0 8px 20px rgba(0,0,0,0.6);
    }
    .bar-box { display: flex; flex-direction: column; gap: 4px; }
    .bar-text { display: flex; justify-content: space-between; font-size: 11px; font-weight: 800; }
    .bar-shell {
      width: 100%;
      height: 14px;
      background: #0d111a;
      border-radius: 7px;
      border: 1px solid rgba(255,255,255,0.15);
      overflow: hidden;
    }
    .hp-fill { height: 100%; background: linear-gradient(90deg, #c53030, #e53e3e); border-radius: 7px; }
    .mp-fill { height: 100%; background: linear-gradient(90deg, #2b6cb0, #4299e1); border-radius: 7px; }

    /* Column 2: Equipment & Companion */
    .slot-row {
      background: rgba(0,0,0,0.5);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 10px;
      padding: 8px 12px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .slot-icon { font-size: 24px; }
    .slot-info { display: flex; flex-direction: column; width: 100%; }
    .slot-title { font-size: 13px; font-weight: 800; color: #f7fafc; }
    .slot-sub { font-size: 11px; font-weight: 700; color: #48bb78; }

    /* Column 3: Attributes (STR, VIT, AGI, INT) */
    .attr-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: rgba(0,0,0,0.5);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 8px;
      padding: 6px 12px;
      font-size: 13px;
      font-weight: 800;
    }
    .attr-name { color: #cbd5e0; }
    .attr-num { color: #ecc94b; font-size: 15px; }

    /* Footer */
    .bottom-bar {
      background: rgba(0, 0, 0, 0.7);
      border: 1px solid rgba(236, 201, 75, 0.35);
      border-radius: 10px;
      padding: 10px 18px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 13px;
    }
    .points-badge {
      background: linear-gradient(90deg, #dd6b20, #ecc94b);
      color: #000;
      font-weight: 900;
      padding: 3px 12px;
      border-radius: 12px;
      font-size: 11px;
    }
  </style>
</head>
<body>
  <div class="hero-license">
    <div class="top-bar">
      <div class="title-box">
        <div class="hero-name">${playerName} (Lv. ${level})</div>
        <div class="hero-subtitle">🎖️ ${guildTitle}</div>
      </div>
      <div class="cp-capsule">
        <span class="cp-label">TOTAL COMBAT POWER</span>
        <span class="cp-val">⚡ ${combatPower.toLocaleString("id-ID")}</span>
      </div>
    </div>

    <div class="main-grid">
      <!-- Vitals Panel -->
      <div class="card-panel">
        <div style="font-size: 12px; font-weight: 800; color: #ecc94b; text-transform: uppercase;">KONDISI TEMPUR</div>

        <div class="bar-box">
          <div class="bar-text"><span style="color: #feb2b2;">HEALTH (HP)</span><span>${hp} / ${hpMax}</span></div>
          <div class="bar-shell"><div class="hp-fill" style="width: ${hpPct}%;"></div></div>
        </div>

        <div class="bar-box">
          <div class="bar-text"><span style="color: #bee3f8;">MANA (MP)</span><span>${mana} / ${manaMax}</span></div>
          <div class="bar-shell"><div class="mp-fill" style="width: ${mpPct}%;"></div></div>
        </div>

        <div style="font-size: 11px; color: #a0aec0; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 8px;">
          Setiap kenaikan level menganugerahi <b>3 Poin Status</b> untuk meningkatkan potensi tempur sejati.
        </div>
      </div>

      <!-- Gear & Companion Panel -->
      <div class="card-panel">
        <div style="font-size: 12px; font-weight: 800; color: #ecc94b; text-transform: uppercase;">PERLENGKAPAN & MITRA</div>

        <div class="slot-row">
          <div class="slot-icon">⚔️</div>
          <div class="slot-info">
            <span class="slot-title">${weaponName}</span>
            <span class="slot-sub">${weaponRefine > 0 ? `Tempa: +${weaponRefine} Divine` : "Belum Ditempa"}</span>
          </div>
        </div>

        <div class="slot-row">
          <div class="slot-icon">🛡️</div>
          <div class="slot-info">
            <span class="slot-title">${armorName}</span>
            <span class="slot-sub">${armorRefine > 0 ? `Tempa: +${armorRefine} Aegis` : "Belum Ditempa"}</span>
          </div>
        </div>

        <div class="slot-row">
          <div class="slot-icon">🐾</div>
          <div class="slot-info">
            <span class="slot-title">${petName}</span>
            <span class="slot-sub">${petBuffText}</span>
          </div>
        </div>
      </div>

      <!-- Attributes (STR, VIT, AGI, INT) -->
      <div class="card-panel">
        <div style="font-size: 12px; font-weight: 800; color: #ecc94b; text-transform: uppercase;">DISTRIBUSI ATRIBUT</div>

        <div class="attr-row">
          <span class="attr-name">💪 STRENGTH (STR)</span>
          <span class="attr-num">${stats.str}</span>
        </div>
        <div class="attr-row">
          <span class="attr-name">🛡️ VITALITY (VIT)</span>
          <span class="attr-num">${stats.vit}</span>
        </div>
        <div class="attr-row">
          <span class="attr-name">⚡ AGILITY (AGI)</span>
          <span class="attr-num">${stats.agi}</span>
        </div>
        <div class="attr-row">
          <span class="attr-name">🔮 INTELLIGENCE (INT)</span>
          <span class="attr-num">${stats.int}</span>
        </div>
      </div>
    </div>

    <!-- Bottom Bar -->
    <div class="bottom-bar">
      <span>Gunakan tombol di bawah untuk mengalokasikan poin atribut karakter.</span>
      <span class="points-badge">SISA POIN: ${freePoints} POIN</span>
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
  if (jid && !global.db.user[jid]) db.ensureUser(jid, name);
}

function saveDB() {
  if (typeof db?.write === "function" && global.db) db.write(global.db);
}

function ensureStats(user) {
  user.stats = user.stats || {
    str: 10,
    vit: 10,
    agi: 10,
    int: 10,
    allocated: 0
  };
  const totalEarnedPoints = (Number(user.level) || 1) * 3;
  user.stats.freePoints = Math.max(0, totalEarnedPoints - (user.stats.allocated || 0));
}

function calculateCombatPower(user) {
  const wpnKey = user.equipped?.weapon;
  const armKey = user.equipped?.armor;
  const wpnBase = WEAPON_BONUS[wpnKey] || 0;
  const armBase = ARMOR_BONUS[armKey] || 0;
  const wpnRefine = user.refine?.[wpnKey] || 0;
  const armRefine = user.refine?.[armKey] || 0;
  const totalAtk = (user.atk || 10) + wpnBase + wpnRefine * 6 + (user.stats?.str || 10) * 2;
  const totalDef = (user.def || 5) + armBase + armRefine * 4 + (user.stats?.vit || 10) * 1;
  let petMultiplier = 1;
  if (user.pet) {
    petMultiplier += user.pet.level * .05 + user.pet.stage * .1;
  }
  const cp = Math.round((totalAtk * 3.5 + totalDef * 4 + (user.hpMax || 100) * .4 + (user.manaMax || 50) * .3) * petMultiplier);
  return {
    cp: cp,
    totalAtk: totalAtk,
    totalDef: totalDef
  };
}
async function sendHeroCTA(sock, ctx, targetId, {
  text,
  footer,
  buttons = [],
  imageBuffer = null,
  mentions = []
}) {
  const botName = global.bot?.name || "WudysoftBot";
  const finalFooter = footer || `${botName} • Master Soul Card`;
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
        list_title: `${botName} • Poin Atribut`,
        button_title: "Alokasi Stat"
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
async function renderMasterHeroHUD(user, userName) {
  ensureStats(user);
  const {
    cp
  } = calculateCombatPower(user);
  const wpnKey = user.equipped?.weapon;
  const armKey = user.equipped?.armor;
  const wpnName = wpnKey ? wpnKey.replace(/_/g, " ").toUpperCase() : "Tangan Kosong";
  const armName = armKey ? armKey.replace(/_/g, " ").toUpperCase() : "Pakaian Biasa";
  const wpnRefine = user.refine?.[wpnKey] || 0;
  const armRefine = user.refine?.[armKey] || 0;
  const guildRank = user.guild?.rankIndex !== undefined ? ["F", "E", "D", "C", "B", "A", "S", "SSS"][user.guild.rankIndex] : "F";
  const guildTitle = GUILD_TITLES[guildRank] || "Adventurer Recruit";
  let petName = "Tidak Ada Peliharaan";
  let petBuffText = "Tangkap di .pet tame";
  if (user.pet) {
    petName = `${user.pet.name} (Lv. ${user.pet.level})`;
    petBuffText = `Stage ${user.pet.stage} Companion`;
  }
  const html = generateHeroCardHTML({
    playerName: userName,
    level: user.level || 1,
    guildTitle: guildTitle,
    combatPower: cp,
    hp: user.hp || 100,
    hpMax: user.hpMax || 100,
    mana: user.mana || 50,
    manaMax: user.manaMax || 50,
    weaponName: wpnName,
    weaponRefine: wpnRefine,
    armorName: armName,
    armorRefine: armRefine,
    petName: petName,
    petBuffText: petBuffText,
    stats: user.stats,
    freePoints: user.stats.freePoints || 0
  });
  return await renderHtmlToImage(html);
}
async function handleHeroAction(sock, ctx, msg, sender, rawText) {
  initDB(sender, ctx?.pushName || "");
  const user = global.db.user[sender];
  ensureStats(user);
  const parts = rawText.split(/\s+/);
  const action = (parts[1] || "").toLowerCase();
  const attr = (parts[2] || "").toLowerCase();
  const prefix = ctx.prefix || ".";
  const userName = ctx.pushName || sender.split("@")[0];
  if (action === "add" || action === "tambah") {
    if (!["str", "vit", "agi", "int"].includes(attr)) {
      return ctx.reply(`❌ Atribut tidak valid. Pilihan: STR, VIT, AGI, INT.`);
    }
    if ((user.stats.freePoints || 0) <= 0) {
      return ctx.reply(`❌ Kamu tidak memiliki sisa Poin Status gratis! Naikkan levelmu melalui ekspedisi atau pertarungan.`);
    }
    user.stats[attr] += 1;
    user.stats.allocated += 1;
    user.stats.freePoints -= 1;
    if (attr === "vit") {
      user.hpMax = (user.hpMax || 100) + 10;
      user.def = (user.def || 5) + 1;
    } else if (attr === "str") {
      user.atk = (user.atk || 10) + 2;
    } else if (attr === "int") {
      user.manaMax = (user.manaMax || 50) + 8;
    }
    saveDB();
    const hud = await renderMasterHeroHUD(user, userName);
    const buttons = [{
      display_text: "💪 +1 STR",
      id: `${prefix}hero add str`
    }, {
      display_text: "🛡️ +1 VIT",
      id: `${prefix}hero add vit`
    }, {
      display_text: "⚡ +1 AGI",
      id: `${prefix}hero add agi`
    }, {
      display_text: "🔮 +1 INT",
      id: `${prefix}hero add int`
    }];
    return await sendHeroCTA(sock, ctx, ctx.id, {
      text: `✨ *POIN STATUS BERHASIL DIALOKASIKAN!* ✨\n\n+1 Poin ditambahkan ke *${attr.toUpperCase()}*.\nSisa Poin Gratis: *${user.stats.freePoints} Poin*.`,
      buttons: buttons,
      imageBuffer: hud.buffer,
      mentions: [sender]
    });
  }
  if (action === "reset") {
    const costReset = 5e4;
    if ((user.money || 0) < costReset) {
      return ctx.reply(`❌ Biaya reset status adalah *Rp ${costReset.toLocaleString("id-ID")}* (Saldo: Rp ${(user.money || 0).toLocaleString("id-ID")}).`);
    }
    user.money -= costReset;
    user.stats.str = 10;
    user.stats.vit = 10;
    user.stats.agi = 10;
    user.stats.int = 10;
    user.stats.allocated = 0;
    user.stats.freePoints = (Number(user.level) || 1) * 3;
    saveDB();
    const hud = await renderMasterHeroHUD(user, userName);
    const buttons = [{
      display_text: "💪 +1 STR",
      id: `${prefix}hero add str`
    }, {
      display_text: "🛡️ +1 VIT",
      id: `${prefix}hero add vit`
    }, {
      display_text: "⚡ +1 AGI",
      id: `${prefix}hero add agi`
    }, {
      display_text: "🔮 +1 INT",
      id: `${prefix}hero add int`
    }];
    return await sendHeroCTA(sock, ctx, ctx.id, {
      text: `🔄 *POIN STATUS TELAH DIRESET ULANG!* 🔄\n\nSemua atribut telah dikembalikan ke angka dasar 10.\nKamu mendapatkan kembali *${user.stats.freePoints} Poin Bebas*!`,
      buttons: buttons,
      imageBuffer: hud.buffer,
      mentions: [sender]
    });
  }
}
export default {
  name: "hero",
  aliases: ["profile", "status", "stats", "soulcard"],
  description: "Master Character Sheet, Total Combat Power, dan Alokasi Poin Atribut Realtime",
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
      if (/^[.#/!]?hero\s+(add|tambah|reset)/i.test(text)) {
        return await handleHeroAction(sock, ctx, msg, sender, text);
      }
    } catch (e) {
      console.error("[HERO BEFORE ERROR]:", e);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      const sender = ctx.sender;
      const prefix = ctx.prefix || ".";
      const userName = ctx.pushName || sender.split("@")[0];
      initDB(sender, userName);
      const user = global.db.user[sender];
      const hud = await renderMasterHeroHUD(user, userName);
      const buttons = [{
        display_text: "💪 +1 STR",
        id: `${prefix}hero add str`
      }, {
        display_text: "🛡️ +1 VIT",
        id: `${prefix}hero add vit`
      }, {
        display_text: "⚡ +1 AGI",
        id: `${prefix}hero add agi`
      }, {
        display_text: "🔮 +1 INT",
        id: `${prefix}hero add int`
      }, {
        display_text: "🔄 Reset Status",
        id: `${prefix}hero reset`
      }];
      const {
        cp,
        totalAtk,
        totalDef
      } = calculateCombatPower(user);
      const bodyText = `🎖️ *MASTER HERO CHARACTER SHEET* 🎖️\n\n` + `• 👤 *Petualang:* @${userName}\n` + `• 🌟 *Level:* Lv. ${user.level} (${user.exp}/${user.level * 100} XP)\n` + `• ⚡ *Total Combat Power:* ${cp.toLocaleString("id-ID")} CP\n` + `• ⚔️ *Total Serangan:* ${totalAtk} ATK\n` + `• 🛡️ *Total Pertahanan:* ${totalDef} DEF\n` + `• 🎁 *Sisa Poin Status:* ${user.stats.freePoints || 0} Poin Bebas\n\n` + `_Ketuk tombol di bawah untuk mendistribusikan poin kekuatanmu:_`;
      await sendHeroCTA(sock, ctx, ctx.id, {
        text: bodyText,
        buttons: buttons,
        imageBuffer: hud.buffer,
        mentions: [sender]
      });
    } catch (err) {
      console.error("[HERO EXECUTE ERROR]:", err);
      ctx.reply(`❌ Terjadi kendala saat memuat kartu karakter: ${err.message}`);
    }
  }
};