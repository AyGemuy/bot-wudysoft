import axios from "axios";
import db from "../../data/db.js";
const DUNGEON_MONSTERS = [{
  name: "Goblin Thief",
  icon: "👺",
  hp: 110,
  atk: 18,
  def: 6,
  exp: 45,
  money: 1500,
  ore: "coal",
  crate: "common"
}, {
  name: "Orc Berserker",
  icon: "👹",
  hp: 240,
  atk: 35,
  def: 12,
  exp: 90,
  money: 3e3,
  ore: "iron",
  crate: "uncommon"
}, {
  name: "Undead Knight",
  icon: "💀",
  hp: 380,
  atk: 52,
  def: 22,
  exp: 180,
  money: 5500,
  ore: "gold",
  crate: "uncommon"
}, {
  name: "Lava Golem",
  icon: "🗿",
  hp: 600,
  atk: 72,
  def: 35,
  exp: 350,
  money: 9500,
  ore: "diamond",
  crate: "legendary"
}, {
  name: "Ancient Wyvern",
  icon: "🐉",
  hp: 1e3,
  atk: 105,
  def: 55,
  exp: 700,
  money: 25e3,
  ore: "platinum",
  crate: "mythic"
}];
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
const SESSION_TIMEOUT = 2 * 60 * 1e3;

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

function calculateFullCombatStats(user) {
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
    totalDef: totalDef,
    wpnRefine: wpnRefine,
    armRefine: armRefine
  };
}

function generateDungeonHTML(data) {
  const {
    floor,
    playerName,
    playerHp,
    playerHpMax,
    playerMana,
    playerManaMax,
    totalAtk,
    totalDef,
    monster,
    monsterHp,
    monsterMaxHp,
    battleLog
  } = data;
  const hpPct = Math.max(0, Math.min(100, Math.round(playerHp / playerHpMax * 100)));
  const mpPct = Math.max(0, Math.min(100, Math.round(playerMana / playerManaMax * 100)));
  const monHpPct = Math.max(0, Math.min(100, Math.round(monsterHp / monsterMaxHp * 100)));
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 960px;
      height: 540px;
      background: #0a0606;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: #fff;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .arena-frame {
      width: 960px;
      height: 540px;
      background: radial-gradient(circle at 50% 30%, #301111 0%, #150606 65%, #080202 100%);
      border: 8px solid #280d0d;
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
    .floor-badge {
      background: rgba(0,0,0,0.7);
      border: 1.5px solid #e53e3e;
      color: #fed7d7;
      padding: 5px 18px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 800;
    }

    .main-grid {
      display: grid;
      grid-template-columns: 340px 100px 340px;
      gap: 16px;
      align-items: center;
      justify-content: center;
      margin: 10px 0;
    }

    /* Combatant Card */
    .combat-card {
      background: rgba(22, 9, 9, 0.88);
      border: 2px solid rgba(229, 62, 62, 0.35);
      border-radius: 16px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.8);
    }
    .combat-card.monster { border-color: rgba(237, 137, 54, 0.5); }
    .card-title { font-size: 17px; font-weight: 900; color: #fff; }

    .bar-box { display: flex; flex-direction: column; gap: 4px; }
    .bar-lbl { display: flex; justify-content: space-between; font-size: 11px; font-weight: 800; }
    .bar-shell {
      width: 100%;
      height: 14px;
      background: #140505;
      border-radius: 7px;
      border: 1px solid rgba(255,255,255,0.15);
      overflow: hidden;
    }
    .hp-fill { height: 100%; background: linear-gradient(90deg, #c53030, #e53e3e); border-radius: 7px; }
    .mp-fill { height: 100%; background: linear-gradient(90deg, #2b6cb0, #4299e1); border-radius: 7px; }
    .mon-fill { height: 100%; background: linear-gradient(90deg, #dd6b20, #ed8936); border-radius: 7px; }

    .stat-row {
      display: flex;
      justify-content: space-between;
      border-top: 1px solid rgba(255,255,255,0.1);
      padding-top: 8px;
      font-size: 12px;
      font-weight: 800;
      color: #cbd5e0;
    }

    /* VS Emblem */
    .vs-emblem {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-size: 32px;
      font-weight: 900;
      color: #e53e3e;
      text-shadow: 0 0 16px rgba(229, 62, 62, 0.8);
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
  <div class="arena-frame">
    <div class="top-header">
      <div class="title">⚔️ DUNGEON RAID ARENA ⚔️</div>
      <div class="floor-badge">CHAMBER FLOOR ${floor}</div>
    </div>

    <div class="main-grid">
      <!-- Player Card -->
      <div class="combat-card">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="font-size: 30px;">🗡️</div>
          <div>
            <div class="card-title">${playerName}</div>
            <div style="font-size: 11px; color: #48bb78; font-weight: 700;">Player Status Ready</div>
          </div>
        </div>

        <div class="bar-box">
          <div class="bar-lbl"><span style="color: #feb2b2;">HEALTH</span><span>${playerHp} / ${playerHpMax}</span></div>
          <div class="bar-shell"><div class="hp-fill" style="width: ${hpPct}%;"></div></div>
        </div>

        <div class="bar-box">
          <div class="bar-lbl"><span style="color: #bee3f8;">MANA</span><span>${playerMana} / ${playerManaMax}</span></div>
          <div class="bar-shell"><div class="mp-fill" style="width: ${mpPct}%;"></div></div>
        </div>

        <div class="stat-row">
          <span>⚔️ ${totalAtk} ATK</span>
          <span>🛡️ ${totalDef} DEF</span>
        </div>
      </div>

      <!-- VS Sign -->
      <div class="vs-emblem">
        <span>⚔️</span>
        <span style="font-size: 20px;">VS</span>
      </div>

      <!-- Monster Card -->
      <div class="combat-card monster">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="font-size: 30px;">${monster.icon || "👹"}</div>
          <div>
            <div class="card-title">${monster.name}</div>
            <div style="font-size: 11px; color: #ed8936; font-weight: 700;">Dungeon Threat Level</div>
          </div>
        </div>

        <div class="bar-box">
          <div class="bar-lbl"><span style="color: #fbd38d;">MONSTER HEALTH</span><span>${Math.max(0, monsterHp)} / ${monsterMaxHp}</span></div>
          <div class="bar-shell"><div class="mon-fill" style="width: ${monHpPct}%;"></div></div>
        </div>

        <div style="height: 25px;"></div>

        <div class="stat-row">
          <span>⚔️ ${monster.atk} ATK</span>
          <span>🛡️ ${monster.def} DEF</span>
        </div>
      </div>
    </div>

    <!-- Battle Log Strip -->
    <div class="bottom-bar">
      <div style="color: #feb2b2; font-weight: 700;">${battleLog || "Pertarungan dungeon dimulai. Tentukan langkah tempurmu!"}</div>
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
async function renderDungeonBattleUI(sock, ctx, user, session, battleLog = "") {
  const prefix = ctx.prefix || ".";
  const userName = user.name || ctx.pushname || ctx.sender.split("@")[0];
  const {
    totalAtk,
    totalDef
  } = calculateFullCombatStats(user);
  const html = generateDungeonHTML({
    floor: session.floor,
    playerName: userName,
    playerHp: user.hp || 100,
    playerHpMax: user.hpMax || 100,
    playerMana: user.mana || 50,
    playerManaMax: user.manaMax || 50,
    totalAtk: totalAtk,
    totalDef: totalDef,
    monster: session.monster,
    monsterHp: session.monsterHp,
    monsterMaxHp: session.monsterMaxHp,
    battleLog: battleLog
  });
  const {
    buffer
  } = await renderHtmlToImage(html);
  const text = `–  *D U N G E O N  B A T T L E  F L O O R  ${session.floor}*\n\n` + `• 👤 *Player:* @${ctx.sender.split("@")[0]} (Lv. ${user.level})\n` + `• 🩸 *HP:* ${user.hp}/${user.hpMax} | 🔷 *MP:* ${user.mana}/${user.manaMax}\n` + `• 👹 *Enemy:* ${session.monster.name} (${session.monsterHp}/${session.monsterMaxHp} HP)\n\n` + `${battleLog ? `📜 *Log:* ${battleLog}\n\n` : ""}` + `_Pilih tindakan tempur Anda melalui tombol di bawah:_`;
  const buttons = [{
    name: "quick_reply",
    buttonParamsJson: JSON.stringify({
      display_text: "🗡️ Serang Fisik",
      id: `${prefix}dungeon serang`
    })
  }, {
    name: "quick_reply",
    buttonParamsJson: JSON.stringify({
      display_text: "🔮 Skill Sihir (20 MP)",
      id: `${prefix}dungeon sihir`
    })
  }, {
    name: "quick_reply",
    buttonParamsJson: JSON.stringify({
      display_text: "🧪 Minum Potion",
      id: `${prefix}dungeon heal`
    })
  }, {
    name: "quick_reply",
    buttonParamsJson: JSON.stringify({
      display_text: "🏃 Kabur",
      id: `${prefix}dungeon kabur`
    })
  }];
  const options = {
    image: buffer,
    params: {
      bottom_sheet: {
        in_thread_buttons_limit: 2,
        list_title: "Battle Actions",
        button_title: "Aksi Tempur"
      }
    },
    contextInfo: {
      mentionedJid: [ctx.sender]
    }
  };
  if (typeof ctx.sendCta === "function") return await ctx.sendCta(text, "Wudysoft • Dungeon Raid", buttons, options);
  return await sock.sendMessage(ctx.id, {
    image: buffer,
    caption: text,
    mentions: [ctx.sender]
  }, {
    quoted: ctx.msg
  });
}
export default {
  name: "dungeon",
  aliases: ["adv", "adventure", "petualang"],
  description: "Menjelajahi dungeon bersesi realtime dan mengalahkan monster dengan Dynamic HTML Canvas",
  category: "RPG",
  register: true,
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const sender = ctx.sender;
      const user = global.db?.user?.[sender];
      if (!user || !user.dungeonSession) return;
      const now = Date.now();
      if (user.dungeonSession.expiresAt && now > user.dungeonSession.expiresAt) {
        delete user.dungeonSession;
        db.write(global.db);
        return ctx.reply("⏳ Sesi pertempuran dungeon telah kadaluarsa karena tidak ada respon.");
      }
      const raw = (ctx.text || ctx.body || "").toLowerCase().trim();
      const prefix = ctx.prefix || ".";
      const userName = user.name || ctx.pushname || sender.split("@")[0];
      if (["serang", "attack", "sihir", "magic", "heal", "potion", "kabur", "run"].some(cmd => raw.endsWith(cmd))) {
        const action = raw.replace(/^[.!/#]?\s*(dungeon|adv|adventure)\s*/i, "").trim();
        const session = user.dungeonSession;
        const {
          totalAtk,
          totalDef
        } = calculateFullCombatStats(user);
        let log = "";
        if (action === "kabur" || action === "run") {
          delete user.dungeonSession;
          db.write(global.db);
          await ctx.react("🏃");
          return ctx.reply(`🏃 Anda berhasil mundur dan melarikan diri dari *${session.monster.name}*!`);
        }
        if (action === "heal" || action === "potion") {
          const hasPotion = (user.inventory?.drink?.mana_potion || 0) > 0;
          const hasFood = (user.inventory?.food?.grilled_fish || 0) > 0;
          if (hasPotion || hasFood) {
            let healVal = 50;
            if (hasFood) {
              user.inventory.food.grilled_fish -= 1;
              healVal = 60;
            } else {
              user.inventory.drink.mana_potion -= 1;
              healVal = 40;
            }
            user.hp = Math.min(user.hpMax || 100, (user.hp || 0) + healVal);
            log = `🧪 Kamu mengonsumsi perbekalan dan memulihkan *+${healVal} HP*!`;
          } else {
            return ctx.reply("❌ Kamu tidak memiliki potion atau makanan pemulih di tas!");
          }
        }
        if (action === "sihir" || action === "magic") {
          if ((user.mana || 0) < 20) {
            return ctx.reply("❌ Mana tidak cukup untuk merapal mantra! (Butuh minimal 20 MP)");
          }
          user.mana -= 20;
          const magicDmg = Math.max(25, Math.floor(totalAtk * 1.8 - session.monster.def * .2 + Math.random() * 20));
          session.monsterHp -= magicDmg;
          log = `🔮 Serangan sihir kosmikmu menghantam *${magicDmg} DMG*! (-20 MP)`;
        }
        if (action === "serang" || action === "attack") {
          const dmg = Math.max(12, Math.floor(totalAtk - session.monster.def * .35 + Math.random() * 12));
          session.monsterHp -= dmg;
          log = `🗡️ Tebasan senjatamu melukai musuh sebesar *${dmg} DMG*!`;
        }
        if (session.monsterHp <= 0) {
          const m = session.monster;
          delete user.dungeonSession;
          user.exp = (user.exp || 0) + m.exp;
          user.money = (Number(user.money) || 0) + m.money;
          user.inventory = user.inventory || {};
          user.inventory.ores = user.inventory.ores || {};
          user.inventory.crate = user.inventory.crate || {};
          if (m.ore) user.inventory.ores[m.ore] = (user.inventory.ores[m.ore] || 0) + 1;
          if (m.crate) user.inventory.crate[m.crate] = (user.inventory.crate[m.crate] || 0) + 1;
          const lvlResult = checkLevelUp(user);
          db.write(global.db);
          await ctx.react("🏆");
          let winText = `🎉 *VICTORY! ${m.name.toUpperCase()} BERHASIL DITUMBANGKAN!* 🎉\n\n` + `–  *R E W A R D*\n\n` + `┌  ◦  *Balance* : +Rp ${m.money.toLocaleString("id-ID")}\n` + `├  ◦  *Exp* : +${m.exp} XP\n` + `├  ◦  *Mineral Drop* : +1x ${m.ore.toUpperCase()}\n` + `└  ◦  *Peti Harta* : +1x ${m.crate.toUpperCase()} Crate\n\n`;
          if (lvlResult.isLevelUp) {
            winText += `🌟 *LEVEL UP!* Level karakter naik ke *Lv. ${lvlResult.newLevel}*! Darah & Mana pulih penuh.\n\n`;
          }
          const winButtons = [{
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "⚔️ Dungeon Lagi",
              id: `${prefix}dungeon`
            })
          }, {
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "🎒 Cek Inventory",
              id: `${prefix}inv`
            })
          }];
          return await sock.sendMessage(ctx.id, {
            text: winText
          }, {
            quoted: msg
          });
        }
        const enemyDmg = Math.max(6, Math.floor(session.monster.atk - totalDef * .45 + Math.random() * 8));
        user.hp = Math.max(0, (user.hp || 100) - enemyDmg);
        log += `\n💥 ${session.monster.name} membalas dan melukaimu sebesar *-${enemyDmg} HP*!`;
        if (user.hp <= 0) {
          delete user.dungeonSession;
          user.hp = Math.floor((user.hpMax || 100) * .25);
          user.exp = Math.max(0, (user.exp || 0) - 50);
          db.write(global.db);
          await ctx.react("☠️");
          return ctx.reply(`💀 *KAMU TEWAS DI DUNGEON!* 💀\n\nTubuhmu diangkut keluar dalam kondisi kritis (-50 XP). Beristirahatlah dengan *${prefix}rest*!`);
        }
        session.expiresAt = Date.now() + SESSION_TIMEOUT;
        db.write(global.db);
        await renderDungeonBattleUI(sock, ctx, user, session, log);
        return true;
      }
    } catch (err) {
      console.error("[Dungeon Before Error]:", err);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      db.ensureUser(ctx.sender, ctx.pushname);
      const user = global.db.user[ctx.sender];
      const prefix = ctx.prefix || ".";
      const now = Date.now();
      if (user.dungeonSession) {
        if (user.dungeonSession.expiresAt && now > user.dungeonSession.expiresAt) {
          delete user.dungeonSession;
          db.write(global.db);
        } else {
          return await renderDungeonBattleUI(sock, ctx, user, user.dungeonSession, "Pertarunganmu masih aktif di dungeon!");
        }
      }
      if ((user.hp || 100) < 30) {
        return ctx.reply(`❌ Tubuhmu terlalu lemah (*${user.hp}/${user.hpMax} HP*). Pulihkan diri dengan *${prefix}rest* sebelum masuk dungeon!`);
      }
      const COOLDOWN = 2 * 60 * 1e3;
      if (user.cooldown?.dungeon && now - user.cooldown.dungeon < COOLDOWN) {
        const sisa = COOLDOWN - (now - user.cooldown.dungeon);
        const m = Math.floor(sisa / 6e4);
        const s = Math.floor(sisa % 6e4 / 1e3);
        return ctx.reply(`⏳ Kamu masih kelelahan sehabis menjelajah. Tunggu *${m}m ${s}s* lagi.`);
      }
      const floorIdx = Math.min(DUNGEON_MONSTERS.length - 1, Math.floor(((user.level || 1) - 1) / 3));
      const monster = DUNGEON_MONSTERS[floorIdx];
      user.dungeonSession = {
        floor: floorIdx + 1,
        monster: monster,
        monsterHp: monster.hp,
        monsterMaxHp: monster.hp,
        createdAt: now,
        expiresAt: now + SESSION_TIMEOUT
      };
      user.cooldown = user.cooldown || {};
      user.cooldown.dungeon = now;
      db.write(global.db);
      await ctx.react("⚔️");
      await renderDungeonBattleUI(sock, ctx, user, user.dungeonSession, `Kamu memasuki lantai ${floorIdx + 1} dan berhadapan dengan *${monster.name}*!`);
    } catch (err) {
      console.error("[Dungeon Execute Error]:", err);
      ctx.reply(`❌ Terjadi kendala di dungeon: ${err.message}`);
    }
  }
};