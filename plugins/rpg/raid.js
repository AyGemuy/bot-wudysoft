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
const RAID_BOSSES = [{
  name: "Infernal Dragon",
  icon: "🐉",
  hpMax: 2e3,
  atk: 45,
  def: 15,
  expReward: 1e3,
  goldReward: 6e4,
  crate: "legendary"
}, {
  name: "Abyssal Behemoth",
  icon: "👹",
  hpMax: 3500,
  atk: 65,
  def: 25,
  expReward: 2e3,
  goldReward: 12e4,
  crate: "mythic"
}, {
  name: "Demon King Malgor",
  icon: "👿",
  hpMax: 6e3,
  atk: 90,
  def: 35,
  expReward: 4e3,
  goldReward: 3e5,
  crate: "secret"
}];

function initDB(jid = null, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.raid) global.db.raid = {};
  if (jid && !jid.includes("BOT") && !global.db.user[jid]) {
    db.ensureUser(jid, name);
  }
}

function saveDB() {
  if (typeof db?.write === "function" && global.db) db.write(global.db);
}

function clearSession(chatId) {
  if (global.db?.raid?.[chatId]) {
    delete global.db.raid[chatId];
    saveDB();
  }
}

function checkAndCleanExpiredSessions(currentChatId = null) {
  if (!global.db?.raid) return;
  const now = Date.now();
  let changed = false;
  for (const [cId, session] of Object.entries(global.db.raid)) {
    const isExpired = session?.expireTime && now > session.expireTime;
    const isCorrupt = !session || !session.state || !session.players && !session.host;
    if (isExpired || isCorrupt) {
      delete global.db.raid[cId];
      changed = true;
    }
  }
  if (currentChatId && global.db.raid[currentChatId]) {
    const s = global.db.raid[currentChatId];
    if (s.expireTime && now > s.expireTime) {
      delete global.db.raid[currentChatId];
      changed = true;
    }
  }
  if (changed) saveDB();
}

function calculateRaidCombatStats(user) {
  const wpnKey = user.equipped?.weapon;
  const armKey = user.equipped?.armor;
  const wpnBase = WEAPON_BONUS[wpnKey] || 0;
  const armBase = ARMOR_BONUS[armKey] || 0;
  const wpnRefine = user.refine?.[wpnKey] || 0;
  const armRefine = user.refine?.[armKey] || 0;
  const strBonus = (user.stats?.str || 10) * 2;
  const vitBonus = (user.stats?.vit || 10) * 1;
  const now = Date.now();
  let foodAtkBonus = 0;
  let foodDefBonus = 0;
  if (user.buffs?.atk && user.buffs.atk.expireTime > now) foodAtkBonus = user.buffs.atk.val || 0;
  if (user.buffs?.def && user.buffs.def.expireTime > now) foodDefBonus = user.buffs.def.val || 0;
  let petAtkBonus = 0;
  if (user.pet && user.pet.type === "wolf") petAtkBonus = 8 + user.pet.level * 2;
  const totalAtk = (user.atk || 10) + wpnBase + wpnRefine * 6 + strBonus + foodAtkBonus + petAtkBonus;
  const totalDef = (user.def || 5) + armBase + armRefine * 4 + vitBonus + foodDefBonus;
  return {
    totalAtk: totalAtk,
    totalDef: totalDef
  };
}

function generateRaidBattleHTML(data) {
  const {
    boss,
    bossHp,
    bossMaxHp,
    players,
    battleLog
  } = data;
  const bossHpPct = Math.max(0, Math.min(100, Math.round(bossHp / bossMaxHp * 100)));
  let playersListHTML = "";
  players.forEach((p, idx) => {
    const u = global.db?.user?.[p.id] || {};
    const pName = u.name || p.id.split("@")[0];
    const dmgPct = Math.min(100, Math.round((p.damageDealt || 0) / bossMaxHp * 100));
    playersListHTML += `
      <div class="player-row">
        <div class="p-meta">
          <span class="p-rank">#${idx + 1}</span>
          <span class="p-name">${pName}</span>
          <span class="p-dmg">${(p.damageDealt || 0).toLocaleString()} DMG</span>
        </div>
        <div class="bar-shell"><div class="bar-fill" style="width: ${dmgPct}%;"></div></div>
      </div>
    `;
  });
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 960px;
      height: 540px;
      background: #0d0404;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: #fff;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .colosseum-frame {
      width: 960px;
      height: 540px;
      background: radial-gradient(circle at 50% 20%, #3d0d0d 0%, #1a0505 65%, #080202 100%);
      border: 8px solid #2b0b0b;
      outline: 2px solid #e53e3e;
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
      border-bottom: 2px solid rgba(229, 62, 62, 0.4);
      padding-bottom: 12px;
    }
    .title {
      font-size: 24px;
      font-weight: 900;
      color: #feb2b2;
      letter-spacing: 2px;
      text-transform: uppercase;
      text-shadow: 0 0 14px rgba(229, 62, 62, 0.6);
    }
    .tier-badge {
      background: rgba(0,0,0,0.7);
      border: 1.5px solid #e53e3e;
      color: #fed7d7;
      padding: 5px 18px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 800;
    }

    /* Giant Boss Section */
    .boss-section {
      background: rgba(26, 8, 8, 0.9);
      border: 2px solid rgba(229, 62, 62, 0.45);
      border-radius: 18px;
      padding: 18px 24px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.8);
    }
    .boss-header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .boss-identity { display: flex; align-items: center; gap: 12px; }
    .boss-icon { font-size: 38px; filter: drop-shadow(0 0 16px rgba(229, 62, 62, 0.8)); }
    .boss-name { font-size: 22px; font-weight: 900; color: #fffaf0; }
    .boss-stats { font-size: 13px; font-weight: 800; color: #feb2b2; }

    .boss-bar-shell {
      width: 100%;
      height: 22px;
      background: #140404;
      border-radius: 11px;
      border: 1.5px solid rgba(255,255,255,0.15);
      position: relative;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .boss-bar-fill {
      position: absolute;
      left: 0;
      top: 0;
      height: 100%;
      background: linear-gradient(90deg, #c53030, #e53e3e, #f56565);
      border-radius: 11px;
      transition: width 0.3s;
    }
    .boss-bar-text {
      position: relative;
      font-size: 11px;
      font-weight: 900;
      color: #fff;
      text-shadow: 0 1px 3px rgba(0,0,0,0.9);
      z-index: 2;
    }

    /* Party Damage Leaderboard */
    .party-panel {
      background: rgba(18, 6, 6, 0.85);
      border: 1.5px solid rgba(229, 62, 62, 0.35);
      border-radius: 14px;
      padding: 14px 20px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .panel-title { font-size: 11px; font-weight: 800; color: #ecc94b; letter-spacing: 1.2px; text-transform: uppercase; }

    .player-row { display: flex; flex-direction: column; gap: 3px; }
    .p-meta { display: flex; justify-content: space-between; font-size: 12px; font-weight: 800; }
    .p-rank { color: #ecc94b; width: 24px; }
    .p-name { color: #f7fafc; flex: 1; }
    .p-dmg { color: #feb2b2; }

    .bar-shell {
      width: 100%;
      height: 8px;
      background: #0d0303;
      border-radius: 4px;
      overflow: hidden;
    }
    .bar-fill {
      height: 100%;
      background: linear-gradient(90deg, #dd6b20, #ecc94b);
      border-radius: 4px;
    }

    .bottom-bar {
      background: rgba(0,0,0,0.7);
      border: 1px solid rgba(229, 62, 62, 0.35);
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
  <div class="colosseum-frame">
    <div class="top-header">
      <div class="title">🔥 WORLD BOSS RAID COLOSSEUM 🔥</div>
      <div class="tier-badge">REWARD: ${boss.crate.toUpperCase()} CRATE</div>
    </div>

    <!-- Giant Boss Card -->
    <div class="boss-section">
      <div class="boss-header-row">
        <div class="boss-identity">
          <div class="boss-icon">${boss.icon || "🐉"}</div>
          <div class="boss-name">${boss.name}</div>
        </div>
        <div class="boss-stats">⚔️ ${boss.atk} ATK | 🛡️ ${boss.def} DEF</div>
      </div>

      <div class="boss-bar-shell">
        <div class="boss-bar-fill" style="width: ${bossHpPct}%;"></div>
        <span class="boss-bar-text">DARAH BOSS: ${Math.max(0, bossHp).toLocaleString()} / ${bossMaxHp.toLocaleString()} HP (${bossHpPct}%)</span>
      </div>
    </div>

    <!-- Party Members Contribution Leaderboard -->
    <div class="party-panel">
      <div class="panel-title">KONTRIBUSI DAMAGE PARTY AKTIF</div>
      ${playersListHTML}
    </div>

    <div class="bottom-bar">
      <div style="color: #feb2b2; font-weight: 700;">${battleLog || "Pertempuran epik dimulai! Satukan serangan bersama party!"}</div>
      <div style="color: #ecc94b; font-weight: 900;">BATTLE IN PROGRESS</div>
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
async function sendRaidCTA(sock, ctx, targetId, {
  text,
  footer,
  buttons = [],
  imageBuffer = null,
  mentions = []
}) {
  const botName = global.bot?.name || "WudysoftBot";
  const finalFooter = footer || `${botName} • World Boss Raid`;
  const formattedButtons = buttons.map(b => {
    if (b.buttonParamsJson) return b;
    return {
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: b.display_text || b.text || "Klik",
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
        list_title: "Raid Actions",
        button_title: "Aksi Tempur"
      }
    },
    contextInfo: {
      forwardingScore: 999,
      isForwarded: true,
      mentionedJid: mentions || []
    }
  };
  if (typeof ctx?.sendCta === "function") return await ctx.sendCta(text, finalFooter, formattedButtons, options);
  return await sock.sendMessage(destJid, {
    image: imageBuffer || undefined,
    caption: text,
    mentions: mentions
  });
}
async function handleRaidAction(sock, ctx, msg, sender, rawText) {
  initDB(sender, ctx?.pushName || "");
  checkAndCleanExpiredSessions();
  const chatId = ctx.id;
  const session = global.db.raid[chatId];
  if (!session || session.state !== "BATTLE") return;
  const playerObj = session.players.find(p => p.id === sender);
  if (!playerObj) return;
  const parts = rawText.split(/\s+/);
  const action = (parts[1] || "").toLowerCase();
  const prefix = ctx.prefix || ".";
  const user = global.db.user[sender];
  session.expireTime = Date.now() + 3e5;
  const {
    totalAtk,
    totalDef
  } = calculateRaidCombatStats(user);
  if (action === "serang" || action === "attack") {
    const dmg = Math.max(18, Math.floor(totalAtk - session.boss.def * .3 + Math.random() * 14));
    session.boss.hp = Math.max(0, session.boss.hp - dmg);
    playerObj.damageDealt = (playerObj.damageDealt || 0) + dmg;
    user.mana = Math.min(user.manaMax || 50, (user.mana || 0) + 5);
    let battleLog = `⚔️ *@${sender.split("@")[0]}* melancarkan tebasan fisik sebesar *${dmg} DMG*!`;
    if (session.boss.hp > 0) {
      const bossDmg = Math.max(8, Math.floor(session.boss.atk - totalDef * .4 + Math.random() * 8));
      user.hp = Math.max(0, (user.hp || 100) - bossDmg);
      battleLog += ` | 💥 ${session.boss.name} membalas -${bossDmg} HP!`;
    }
    return await checkBattleOutcome(sock, ctx, chatId, session, battleLog, prefix);
  }
  if (action === "skill" || action === "magic") {
    if ((user.mana || 0) < 20) {
      return ctx.reply(`❌ Mana tidak mencukupi untuk Ultimate Skill! (Sisa MP: ${user.mana || 0}/${user.manaMax || 50}).`);
    }
    user.mana -= 20;
    const dmg = Math.max(35, Math.floor(totalAtk * 2.2 - session.boss.def * .2 + Math.random() * 22));
    session.boss.hp = Math.max(0, session.boss.hp - dmg);
    playerObj.damageDealt = (playerObj.damageDealt || 0) + dmg;
    let battleLog = `🔮 *@${sender.split("@")[0]}* meledakkan *Ultimate Skill* sebesar *${dmg} DMG*! (-20 MP)`;
    if (session.boss.hp > 0) {
      const bossDmg = Math.max(8, Math.floor(session.boss.atk - totalDef * .4 + Math.random() * 8));
      user.hp = Math.max(0, (user.hp || 100) - bossDmg);
      battleLog += ` | 💥 ${session.boss.name} menyerang balik -${bossDmg} HP!`;
    }
    return await checkBattleOutcome(sock, ctx, chatId, session, battleLog, prefix);
  }
  if (action === "heal" || action === "rest") {
    if ((user.mana || 0) < 15) {
      return ctx.reply(`❌ Mana tidak cukup untuk menyembuhkan diri! Butuh minimal 15 MP.`);
    }
    user.mana -= 15;
    const healVal = Math.floor((user.hpMax || 100) * .35);
    user.hp = Math.min(user.hpMax || 100, (user.hp || 0) + healVal);
    saveDB();
    return ctx.reply(`✨ *@${sender.split("@")[0]}* melafalkan mantra suci dan memulihkan *+${healVal} HP*! (Sisa: ${user.hp}/${user.hpMax} HP).`, {
      mentions: [sender]
    });
  }
  if (action === "run" || action === "kabur") {
    session.players = session.players.filter(p => p.id !== sender);
    saveDB();
    await ctx.reply(`🏃 *@${sender.split("@")[0]}* melarikan diri dari medan Boss Raid!`, {
      mentions: [sender]
    });
    if (session.players.length === 0) {
      clearSession(chatId);
      return ctx.reply("💀 Semua petualang telah mundur. World Boss kembali ke sarangnya!");
    }
  }
}
async function checkBattleOutcome(sock, ctx, chatId, session, battleLog, prefix) {
  if (session.boss.hp <= 0) {
    const b = session.boss;
    const mentions = session.players.map(p => p.id);
    session.players.sort((a, b) => (b.damageDealt || 0) - (a.damageDealt || 0));
    let winText = `🎊 *WORLD BOSS BERHASIL DITUMBANGKAN!* 🎊\n\n` + `👹 *Target:* ${b.name} berhasil dimusnahkan oleh pasukan party!\n\n` + `🏆 *KONTRIBUSI DAMAGE PARTY:*\n`;
    session.players.forEach((p, idx) => {
      const u = global.db.user[p.id];
      if (u) {
        u.money = (Number(u.money) || 0) + b.goldReward;
        u.exp = (Number(u.exp) || 0) + b.expReward;
        u.inventory = u.inventory || {};
        u.inventory.crate = u.inventory.crate || {};
        u.inventory.crate[b.crate] = (u.inventory.crate[b.crate] || 0) + 1;
      }
      winText += `${idx + 1}. @${p.id.split("@")[0]} ➔ ${(p.damageDealt || 0).toLocaleString()} DMG\n`;
    });
    winText += `\n🎁 *REWARD MASING-MASING ANGGOTA:*\n` + `• +Rp ${b.goldReward.toLocaleString("id-ID")} Balance\n` + `• +${b.expReward} EXP Tempur\n` + `• +1x ${b.crate.toUpperCase()} CRATE 📦\n`;
    clearSession(chatId);
    saveDB();
    const endButtons = [{
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: "🎒 Buka Peti Hadiah (.open)",
        id: `${prefix}open ${b.crate}`
      })
    }, {
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: "⚔️ Buka Raid Baru",
        id: `${prefix}raid`
      })
    }];
    return await sendRaidCTA(sock, ctx, chatId, {
      text: winText,
      buttons: endButtons,
      mentions: mentions
    });
  }
  saveDB();
  const html = generateRaidBattleHTML({
    boss: session.boss,
    bossHp: session.boss.hp,
    bossMaxHp: session.boss.hpMax,
    players: session.players,
    battleLog: battleLog
  });
  const {
    buffer
  } = await renderHtmlToImage(html);
  const statusText = `–  *W O R L D  B O S S  R A I D*\n\n` + `• 👹 *Boss:* ${session.boss.name}\n` + `• 🩸 *Darah Boss:* ${session.boss.hp.toLocaleString()} / ${session.boss.hpMax.toLocaleString()} HP\n\n` + `📜 *Log:* ${battleLog}\n\n` + `_Lanjutkan serangan serempak party melalui tombol di bawah:_`;
  const combatButtons = [{
    name: "quick_reply",
    buttonParamsJson: JSON.stringify({
      display_text: "⚔️ Serang (Normal)",
      id: `${prefix}raid serang`
    })
  }, {
    name: "quick_reply",
    buttonParamsJson: JSON.stringify({
      display_text: "🔮 Skill (20 MP)",
      id: `${prefix}raid skill`
    })
  }, {
    name: "quick_reply",
    buttonParamsJson: JSON.stringify({
      display_text: "✨ Heal (15 MP)",
      id: `${prefix}raid heal`
    })
  }, {
    name: "quick_reply",
    buttonParamsJson: JSON.stringify({
      display_text: "🏃 Kabur",
      id: `${prefix}raid run`
    })
  }];
  const mentions = session.players.map(p => p.id);
  return await sendRaidCTA(sock, ctx, chatId, {
    text: statusText,
    buttons: combatButtons,
    imageBuffer: buffer,
    mentions: mentions
  });
}
export default {
  name: "raid",
  aliases: ["boss", "worldboss", "bossraid"],
  description: "Membuka lobi pertempuran party menaklukkan World Boss dengan Dynamic HTML Canvas",
  category: "RPG",
  group: true,
  register: true,
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      checkAndCleanExpiredSessions();
      const sender = ctx?.sender || msg?.key?.participant || msg?.key?.remoteJid;
      const text = (ctx?.text || ctx?.query || msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "").trim();
      if (/^[.#/!]?raid\s+(serang|attack|skill|magic|heal|rest|run|kabur)/i.test(text)) {
        return await handleRaidAction(sock, ctx, msg, sender, text);
      }
    } catch (e) {
      console.error("[RAID BEFORE ERROR]:", e);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      const chatId = ctx.id;
      const sender = ctx.sender;
      const prefix = ctx.prefix || ".";
      const rawText = (ctx.query || "").trim().toLowerCase();
      initDB(sender, ctx.pushName || "");
      checkAndCleanExpiredSessions(chatId);
      const activeSession = global.db.raid[chatId];
      if (rawText === "stop" || rawText === "batal") {
        if (!activeSession) return ctx.reply("❌ Tidak ada sesi Raid yang aktif di grup ini.");
        if (activeSession.host !== sender) {
          return ctx.reply(`❌ Hanya Party Leader (@${activeSession.host.split("@")[0]}) yang bisa membatalkan!`, {
            mentions: [activeSession.host]
          });
        }
        clearSession(chatId);
        return ctx.reply("🚪 Sesi Boss Raid telah dibubarkan oleh Host.");
      }
      if (rawText === "join" || rawText === "gabung") {
        if (!activeSession || activeSession.state !== "LOBBY") {
          return ctx.reply("❌ Tidak ada lobi Raid yang sedang dibuka.");
        }
        if (activeSession.players.some(p => p.id === sender)) {
          return ctx.reply("⚠️ Kamu sudah terdaftar di dalam party Raid!");
        }
        if (activeSession.players.length >= 5) {
          return ctx.reply("❌ Party Raid sudah penuh (Maksimal 5 Petualang)!");
        }
        activeSession.players.push({
          id: sender,
          damageDealt: 0
        });
        activeSession.expireTime = Date.now() + 18e4;
        saveDB();
        let joinMsg = `🤝 *@${sender.split("@")[0]}* bergabung ke Party Raid!\n\n*Petualang Terkumpul (${activeSession.players.length}/5):*\n`;
        activeSession.players.forEach((p, i) => {
          joinMsg += `${i + 1}. @${p.id.split("@")[0]}\n`;
        });
        const lobbyButtons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🤝 Gabung Party",
            id: `${prefix}raid join`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "⚔️ Mulai Serbu",
            id: `${prefix}raid start`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🚪 Batal",
            id: `${prefix}raid stop`
          })
        }];
        return await sendRaidCTA(sock, ctx, chatId, {
          text: joinMsg,
          buttons: lobbyButtons,
          mentions: activeSession.players.map(p => p.id)
        });
      }
      if (rawText === "start" || rawText === "mulai") {
        if (!activeSession || activeSession.state !== "LOBBY") {
          return ctx.reply("❌ Lobi belum dibuka atau pertempuran sedang berlangsung.");
        }
        if (activeSession.host !== sender) {
          return ctx.reply(`❌ Hanya Party Leader (@${activeSession.host.split("@")[0]}) yang berhak memulai penyerbuan!`, {
            mentions: [activeSession.host]
          });
        }
        const chosenBoss = {
          ...RAID_BOSSES[Math.floor(Math.random() * RAID_BOSSES.length)]
        };
        activeSession.state = "BATTLE";
        activeSession.boss = {
          name: chosenBoss.name,
          icon: chosenBoss.icon,
          hp: chosenBoss.hpMax,
          hpMax: chosenBoss.hpMax,
          atk: chosenBoss.atk,
          def: chosenBoss.def,
          expReward: chosenBoss.expReward,
          goldReward: chosenBoss.goldReward,
          crate: chosenBoss.crate
        };
        activeSession.expireTime = Date.now() + 3e5;
        saveDB();
        const html = generateRaidBattleHTML({
          boss: activeSession.boss,
          bossHp: activeSession.boss.hp,
          bossMaxHp: activeSession.boss.hpMax,
          players: activeSession.players,
          battleLog: "Gerbang dimensi terbuka! World Boss telah muncul di arena!"
        });
        const {
          buffer
        } = await renderHtmlToImage(html);
        const battleStartText = `🚨 *WORLD BOSS TELAH BANGKIT DARI GERBANG DIMENSI!* 🚨\n\n` + `• 👹 *Boss:* ${chosenBoss.name}\n` + `• 🩸 *Darah Boss:* ${chosenBoss.hpMax.toLocaleString()} HP\n` + `• ⚔️ *Kekuatan Serangan:* ${chosenBoss.atk} ATK | 🛡️ ${chosenBoss.def} DEF\n` + `• 👥 *Pasukan Party:* ${activeSession.players.length} Petualang\n\n` + `_Lancarkan serangan serentak melalui tombol tindakan di bawah:_`;
        const combatButtons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "⚔️ Serang (Normal)",
            id: `${prefix}raid serang`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🔮 Skill (20 MP)",
            id: `${prefix}raid skill`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "✨ Heal (15 MP)",
            id: `${prefix}raid heal`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🏃 Kabur",
            id: `${prefix}raid run`
          })
        }];
        return await sendRaidCTA(sock, ctx, chatId, {
          text: battleStartText,
          buttons: combatButtons,
          imageBuffer: buffer,
          mentions: activeSession.players.map(p => p.id)
        });
      }
      if (activeSession) {
        return ctx.reply(`⚠️ Sedang ada ekspedisi Raid aktif di grup ini (${activeSession.state}). Ketik *${prefix}raid join* untuk bergabung!`);
      }
      clearSession(chatId);
      global.db.raid[chatId] = {
        sessionId: Date.now(),
        state: "LOBBY",
        host: sender,
        players: [{
          id: sender,
          damageDealt: 0
        }],
        createdAt: Date.now(),
        expireTime: Date.now() + 18e4
      };
      saveDB();
      const lobbyBody = `🏰 *LOBBY DUNGEON WORLD BOSS RAID* 🏰\n\n` + `• 👑 *Party Leader:* @${sender.split("@")[0]}\n` + `• 👥 *Anggota Party:* 1/5 Terdaftar\n` + `• ⏳ *Waktu Persiapan:* 3 Menit\n\n` + `Ajak petualang lain di grup untuk bergabung mengalahkan Monster Legendaris dan membawa pulang peti harta karun langka!`;
      const lobbyButtons = [{
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🤝 Gabung Party",
          id: `${prefix}raid join`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "⚔️ Mulai Serbu",
          id: `${prefix}raid start`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🚪 Batalkan",
          id: `${prefix}raid stop`
        })
      }];
      await sendRaidCTA(sock, ctx, chatId, {
        text: lobbyBody,
        buttons: lobbyButtons,
        mentions: [sender]
      });
    } catch (err) {
      console.error("[RAID EXECUTE ERROR]:", err);
      ctx.reply(`❌ Terjadi kendala pada sistem raid: ${err.message}`);
    }
  }
};