import db from "../../data/db.js";
const DUNGEON_MONSTERS = [{
  name: "Goblin Thief",
  hp: 110,
  atk: 18,
  def: 6,
  exp: 40,
  money: 1200,
  ore: "coal",
  crate: "common"
}, {
  name: "Orc Berserker",
  hp: 240,
  atk: 35,
  def: 12,
  exp: 85,
  money: 2500,
  ore: "iron",
  crate: "uncommon"
}, {
  name: "Undead Knight",
  hp: 380,
  atk: 52,
  def: 22,
  exp: 170,
  money: 4500,
  ore: "gold",
  crate: "uncommon"
}, {
  name: "Lava Golem",
  hp: 600,
  atk: 72,
  def: 35,
  exp: 320,
  money: 8e3,
  ore: "diamond",
  crate: "legendary"
}, {
  name: "Ancient Wyvern",
  hp: 1e3,
  atk: 105,
  def: 55,
  exp: 650,
  money: 2e4,
  ore: "platinum",
  crate: "mythic"
}];
const SESSION_TIMEOUT = 2 * 60 * 1e3;

function getEquipmentStats(user) {
  let bonusAtk = 0;
  let bonusDef = 0;
  const w = user?.equipped?.weapon;
  if (w === "sword_stone") bonusAtk += 8;
  else if (w === "sword_iron") bonusAtk += 18;
  else if (w === "sword_diamond") bonusAtk += 35;
  else if (w === "sword_light") bonusAtk += 65;
  else if (w === "sword_dark") bonusAtk += 95;
  const a = user?.equipped?.armor;
  if (a === "armor_leather") bonusDef += 6;
  else if (a === "armor_iron") bonusDef += 18;
  else if (a === "armor_crystal") bonusDef += 42;
  return {
    bonusAtk: bonusAtk,
    bonusDef: bonusDef
  };
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

function ensureUserInventory(user) {
  user.inventory = user.inventory || {};
  user.inventory.ores = user.inventory.ores || {
    stone: 0,
    coal: 0,
    iron: 0,
    gold: 0,
    diamond: 0,
    platinum: 0
  };
  user.inventory.crate = user.inventory.crate || {
    common: 0,
    uncommon: 0,
    legendary: 0,
    mythic: 0,
    secret: 0
  };
  user.inventory.nature = user.inventory.nature || {
    bait: 0,
    leather: 0
  };
  user.inventory.drink = user.inventory.drink || {
    water: 0,
    mana_potion: 0,
    herbal_tea: 0,
    elixir: 0
  };
  user.inventory.food = user.inventory.food || {
    bread: 0,
    grilled_fish: 0,
    roast_chicken: 0,
    steak: 0
  };
  user.inventory.weapon = user.inventory.weapon || {};
  user.inventory.armor = user.inventory.armor || {};
  user.equipped = user.equipped || {
    weapon: null,
    armor: null
  };
  user.cooldown = user.cooldown || {};
  user.hp = typeof user.hp === "number" ? user.hp : 100;
  user.hpMax = Number(user.hpMax) || 100;
  user.mana = typeof user.mana === "number" ? user.mana : 50;
  user.manaMax = Number(user.manaMax) || 50;
  user.atk = Number(user.atk) || 10;
  user.def = Number(user.def) || 5;
  user.level = Number(user.level) || 1;
  user.exp = Number(user.exp) || 0;
  user.money = Number(user.money) || 0;
}
async function renderAdventureUI(sock, ctx, session, battleLog = "", quotedMsg = null) {
  const prefix = ctx.prefix || ".";
  const user = global.db.user[ctx.sender];
  const botName = global.bot?.name || "WudysoftBot";
  const botFooter = global.bot?.footer || `${botName} • Dungeon Raid`;
  const bannerImage = global.bot?.media?.banner1 || "https://files.catbox.moe/g2e6i5.jpg";
  const userName = user.name || ctx.pushname || ctx.sender.split("@")[0];
  const {
    bonusAtk,
    bonusDef
  } = getEquipmentStats(user);
  const totalAtk = (user.atk || 10) + bonusAtk;
  const totalDef = (user.def || 5) + bonusDef;
  const text = `–  *D U N G E O N  R A I D*

Pertarungan aktif di Dungeon Floor ${session.floor}.

–  *P L A Y E R*

┌  ◦  *Name* : ${userName} (Lv. ${user.level})
│  ◦  *Health* : ${user.hp} / ${user.hpMax} HP
│  ◦  *Mana* : ${user.mana} / ${user.manaMax} MP
└  ◦  *Stats* : ${totalAtk} ATK | ${totalDef} DEF

–  *M O N S T E R*

┌  ◦  *Enemy* : ${session.monster.name}
│  ◦  *Health* : ${Math.max(0, session.monsterHp)} / ${session.monsterMaxHp} HP
└  ◦  *Stats* : ${session.monster.atk} ATK | ${session.monster.def} DEF

${battleLog ? `–  *B A T T L E  L O G*\n\n${battleLog}\n\n` : ""}Pilih tindakan tempur Anda melalui tombol di bawah.`;
  const buttons = [{
    name: "quick_reply",
    buttonParamsJson: JSON.stringify({
      display_text: "🗡️ Serang Fisik",
      id: `${prefix}adv serang`
    })
  }, {
    name: "quick_reply",
    buttonParamsJson: JSON.stringify({
      display_text: "🔮 Skill Sihir (20 MP)",
      id: `${prefix}adv sihir`
    })
  }, {
    name: "quick_reply",
    buttonParamsJson: JSON.stringify({
      display_text: "🧪 Minum Potion",
      id: `${prefix}adv heal`
    })
  }, {
    name: "quick_reply",
    buttonParamsJson: JSON.stringify({
      display_text: "🏃 Kabur",
      id: `${prefix}adv kabur`
    })
  }];
  const options = {
    image: bannerImage,
    title: `✦ Dungeon Floor ${session.floor} • Battle ✦`,
    params: {
      bottom_sheet: {
        in_thread_buttons_limit: 2,
        divider_indices: [2],
        list_title: `${botName} • Dungeon Battle`,
        button_title: "Aksi Bertarung"
      }
    },
    contextInfo: {
      forwardingScore: 999,
      isForwarded: true
    },
    quoted: quotedMsg || ctx.msg
  };
  if (typeof ctx.sendCta === "function") {
    return await ctx.sendCta(text, botFooter, buttons, options);
  }
  return await sock.sendMessage(ctx.id, {
    image: {
      url: bannerImage
    },
    caption: text
  }, {
    quoted: quotedMsg || ctx.msg
  });
}
export default {
  name: "adventure",
  aliases: ["adv", "dungeon", "petualang", "raid"],
  description: "Menjelajahi dungeon bersesi dan bertarung dengan monster (database session)",
  category: "RPG",
  register: true,
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const sender = ctx.sender;
      const user = global.db?.user?.[sender];
      if (!user || !user.adventureSession) return;
      const now = Date.now();
      if (user.adventureSession.expiresAt && now > user.adventureSession.expiresAt) {
        const monsterName = user.adventureSession.monster?.name || "Monster";
        delete user.adventureSession;
        db.write(global.db);
        return ctx.reply(`–  *T I M E  O U T*

Sesi dungeon telah berakhir karena tidak ada respon. *${monsterName}* telah kabur!`);
      }
      const raw = (ctx.text || ctx.body || "").toLowerCase().trim();
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • Dungeon Raid`;
      const bannerImage = global.bot?.media?.banner1 || "https://files.catbox.moe/g2e6i5.jpg";
      const userName = user.name || ctx.pushname || sender.split("@")[0];
      if (["serang", "attack", "sihir", "magic", "heal", "potion", "kabur", "run"].some(cmd => raw.endsWith(cmd))) {
        const action = raw.replace(/^[.!/#]?\s*(adv|adventure|dungeon|raid)\s*/i, "").trim();
        const session = user.adventureSession;
        ensureUserInventory(user);
        const {
          bonusAtk,
          bonusDef
        } = getEquipmentStats(user);
        const totalAtk = (user.atk || 10) + bonusAtk;
        const totalDef = (user.def || 5) + bonusDef;
        let log = "";
        if (action === "kabur" || action === "run") {
          const monsterName = session.monster.name;
          delete user.adventureSession;
          db.write(global.db);
          await ctx.react("🏃");
          return ctx.reply(`–  *E S C A P E*

Anda berhasil melarikan diri dari *${monsterName}* dengan selamat.`);
        }
        if (action === "heal" || action === "potion") {
          if ((user.inventory.drink.elixir || 0) > 0 || (user.inventory.drink.herbal_tea || 0) > 0 || (user.inventory.food.grilled_fish || 0) > 0 || (user.inventory.food.bread || 0) > 0) {
            let healVal = 40;
            if ((user.inventory.drink.elixir || 0) > 0) {
              user.inventory.drink.elixir -= 1;
              healVal = 100;
            } else if ((user.inventory.drink.herbal_tea || 0) > 0) {
              user.inventory.drink.herbal_tea -= 1;
              healVal = 60;
            } else if ((user.inventory.food.grilled_fish || 0) > 0) {
              user.inventory.food.grilled_fish -= 1;
              healVal = 50;
            } else {
              user.inventory.food.bread -= 1;
              healVal = 35;
            }
            user.hp = Math.min(user.hpMax, user.hp + healVal);
            log += `🧪 Kamu mengonsumsi bekal dan memulihkan *+${healVal} HP*! `;
          } else {
            return ctx.reply(`❌ Anda tidak memiliki makanan atau ramuan pemulih di dalam tas.`);
          }
        }
        if (action === "sihir" || action === "magic") {
          if (user.mana < 20) {
            return ctx.reply("❌ Mana tidak mencukupi untuk mantra sihir. (Dibutuhkan minimal 20 MP)");
          }
          user.mana -= 20;
          const magicDmg = Math.max(15, Math.floor(totalAtk * 1.7 + Math.random() * 25));
          session.monsterHp -= magicDmg;
          log += `🔮 Serangan Sihir Suci menghasilkan *${magicDmg} DMG*! `;
        }
        if (action === "serang" || action === "attack") {
          const dmg = Math.max(8, Math.floor(totalAtk - session.monster.def * .35 + Math.random() * 12));
          session.monsterHp -= dmg;
          log += `🗡️ Tebasan pedangmu menghasilkan *${dmg} DMG*! `;
        }
        if (session.monsterHp <= 0) {
          const m = session.monster;
          delete user.adventureSession;
          user.exp += m.exp;
          user.money += m.money;
          if (m.ore) user.inventory.ores[m.ore] = (user.inventory.ores[m.ore] || 0) + 1;
          if (m.crate) user.inventory.crate[m.crate] = (user.inventory.crate[m.crate] || 0) + 1;
          if (Math.random() < .5) user.inventory.nature.leather = (user.inventory.nature.leather || 0) + 1;
          const lvlResult = checkLevelUp(user);
          db.write(global.db);
          await ctx.react("🏆");
          let winText = `Hi ${userName}!
Selamat, musuh dungeon berhasil ditaklukkan!

–  *V I C T O R Y*

┌  ◦  *Defeated* : ${m.name}
│  ◦  *Balance* : +Rp ${m.money.toLocaleString("id-ID")}
│  ◦  *Exp* : +${m.exp} XP
│  ◦  *Ore* : +1 ${m.ore.toUpperCase()}
│  ◦  *Crate* : +1 ${m.crate.toUpperCase()} Box
└  ◦  *Material* : +1 Kulit Monster

–  *S T A T U S*

┌  ◦  *Current Level* : Lv. ${user.level} (${user.exp} / ${user.level * 100} XP)
└  ◦  *Health* : ${user.hp} / ${user.hpMax} HP\n\n`;
          if (lvlResult.isLevelUp) {
            winText += `–  *L E V E L  U P*

Selamat, level karakter naik ke *Lv. ${lvlResult.newLevel}*!
HP dan Mana telah dipulihkan penuh.\n\n`;
          }
          winText += `Gunakan tombol di bawah untuk bertualang kembali atau beristirahat.`;
          const winButtons = [{
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "⚔️ Bertualang Lagi",
              id: `${prefix}adv`
            })
          }, {
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "⛺ Berkemah (Rest)",
              id: `${prefix}rest`
            })
          }, {
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "🎒 Cek Inventory",
              id: `${prefix}inv`
            })
          }];
          const options = {
            image: bannerImage,
            title: `✦ Dungeon Victory • ${m.name} ✦`,
            params: {
              bottom_sheet: {
                in_thread_buttons_limit: 2,
                divider_indices: [1],
                list_title: `${botName} • Victory Reward`,
                button_title: "Opsi Selanjutnya"
              }
            },
            contextInfo: {
              mentionedJid: [ctx.sender],
              forwardingScore: 999,
              isForwarded: true
            },
            quoted: msg
          };
          if (typeof ctx.sendCta === "function") {
            return await ctx.sendCta(winText, botFooter, winButtons, options);
          }
          return await sock.sendMessage(ctx.id, {
            image: {
              url: bannerImage
            },
            caption: winText
          }, {
            quoted: msg
          });
        }
        const enemyDmg = Math.max(5, Math.floor(session.monster.atk - totalDef * .45 + Math.random() * 10));
        user.hp = Math.max(0, user.hp - enemyDmg);
        log += `\n👹 ${session.monster.name} membalas serangan sebesar *${enemyDmg} DMG*!`;
        if (user.hp <= 0) {
          const monsterName = session.monster.name;
          delete user.adventureSession;
          user.hp = Math.floor(user.hpMax * .25);
          const penaltyExp = Math.min(user.exp, 60);
          user.exp -= penaltyExp;
          db.write(global.db);
          await ctx.react("☠️");
          const defeatMsg = `–  *D E F E A T E D*

Karakter Anda gugur di dalam dungeon.

┌  ◦  *Enemy* : ${monsterName}
│  ◦  *Penalty* : -${penaltyExp} EXP
└  ◦  *Health* : ${user.hp} / ${user.hpMax} HP (25%)

Segera pulihkan kondisi fisikmu dengan *${prefix}rest* atau *${prefix}use*.`;
          return ctx.reply(defeatMsg);
        }
        session.expiresAt = Date.now() + SESSION_TIMEOUT;
        db.write(global.db);
        await renderAdventureUI(sock, ctx, session, log, msg);
        return true;
      }
    } catch (err) {
      console.error("[Adventure Session Error]:", err);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      db.ensureUser(ctx.sender, ctx.pushname);
      const user = global.db.user[ctx.sender];
      const prefix = ctx.prefix || ".";
      ensureUserInventory(user);
      const now = Date.now();
      if (user.adventureSession) {
        if (user.adventureSession.expiresAt && now > user.adventureSession.expiresAt) {
          delete user.adventureSession;
          db.write(global.db);
        } else {
          return await renderAdventureUI(sock, ctx, user.adventureSession, "Pertarunganmu masih aktif di dungeon!", msg);
        }
      }
      if (user.hp < 30) {
        const lowHpText = `–  *L O W  H E A L T H*

Kondisi fisikmu terlalu lemah untuk memasuki dungeon.

┌  ◦  *Health* : ${user.hp} / ${user.hpMax} HP
└  ◦  *Minimum* : 30 HP

Gunakan *${prefix}rest* untuk beristirahat atau *${prefix}use* untuk mengonsumsi bekal.`;
        return ctx.reply(lowHpText);
      }
      const COOLDOWN = 3 * 60 * 1e3;
      const lastCooldown = user.cooldown?.adventure || user.cooldown?.dungeon || 0;
      if (lastCooldown && now - lastCooldown < COOLDOWN) {
        const sisa = COOLDOWN - (now - lastCooldown);
        const m = Math.floor(sisa / 6e4);
        const s = Math.floor(sisa % 6e4 / 1e3);
        const cdText = `–  *C O O L D O W N*

Tubuhmu masih memulihkan stamina sehabis berpetualang.

┌  ◦  *Remaining* : ${m}m ${s}s
└  ◦  *Status* : Exhausted`;
        return ctx.reply(cdText);
      }
      const floorIdx = Math.min(DUNGEON_MONSTERS.length - 1, Math.floor((user.level - 1) / 3));
      const monster = DUNGEON_MONSTERS[floorIdx];
      user.adventureSession = {
        floor: floorIdx + 1,
        monster: monster,
        monsterHp: monster.hp,
        monsterMaxHp: monster.hp,
        createdAt: now,
        expiresAt: now + SESSION_TIMEOUT
      };
      user.cooldown.adventure = now;
      user.cooldown.dungeon = now;
      db.write(global.db);
      await ctx.react("⚔️");
      await renderAdventureUI(sock, ctx, user.adventureSession, `Kamu melangkah ke lantai ${floorIdx + 1} dan dihadang oleh *${monster.name}*!`, msg);
    } catch (err) {
      console.error("[Adventure Exec Error]:", err);
      ctx.reply(`❌ Terjadi kesalahan: ${err.message}`);
    }
  }
};