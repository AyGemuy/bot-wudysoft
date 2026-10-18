import db from "../../data/db.js";
const CRATE_REWARDS = {
  common: {
    name: "Common Crate",
    emoji: "📦",
    money: [1e3, 3e3],
    exp: [50, 100],
    bonus: [{
      key: "ores.coal",
      name: "Batu Bara",
      min: 2,
      max: 5,
      chance: .6
    }, {
      key: "ores.iron",
      name: "Bijih Besi",
      min: 1,
      max: 3,
      chance: .4
    }, {
      key: "nature.bait",
      name: "Umpan Cacing",
      min: 2,
      max: 5,
      chance: .5
    }, {
      key: "drink.mana_potion",
      name: "Mana Potion",
      min: 1,
      max: 2,
      chance: .2
    }]
  },
  uncommon: {
    name: "Uncommon Crate",
    emoji: "🎁",
    money: [4e3, 1e4],
    exp: [150, 300],
    bonus: [{
      key: "ores.gold",
      name: "Bijih Emas",
      min: 1,
      max: 3,
      chance: .5
    }, {
      key: "ores.diamond",
      name: "Diamond",
      min: 1,
      max: 2,
      chance: .25
    }, {
      key: "nature.leather",
      name: "Kulit Monster",
      min: 2,
      max: 4,
      chance: .4
    }, {
      key: "drink.elixir",
      name: "Elixir Suci",
      min: 1,
      max: 1,
      chance: .15
    }]
  },
  legendary: {
    name: "Legendary Crate",
    emoji: "🏆",
    money: [2e4, 6e4],
    exp: [500, 1200],
    mcoin: [1, 5],
    bonus: [{
      key: "ores.diamond",
      name: "Diamond",
      min: 3,
      max: 6,
      chance: .8
    }, {
      key: "ores.platinum",
      name: "Platinum",
      min: 1,
      max: 3,
      chance: .4
    }, {
      key: "weapon.sword_diamond",
      name: "Pedang Berlian (+35 ATK)",
      min: 1,
      max: 1,
      chance: .15
    }, {
      key: "armor.armor_iron",
      name: "Zirah Besi (+15 DEF)",
      min: 1,
      max: 1,
      chance: .2
    }]
  },
  mythic: {
    name: "Mythic Crate",
    emoji: "👑",
    money: [8e4, 2e5],
    exp: [2e3, 5e3],
    mcoin: [10, 30],
    bonus: [{
      key: "ores.platinum",
      name: "Platinum",
      min: 5,
      max: 10,
      chance: .9
    }, {
      key: "weapon.sword_dark",
      name: "Dark Sword (+85 ATK)",
      min: 1,
      max: 1,
      chance: .25
    }, {
      key: "weapon.sword_light",
      name: "Light Sword (+60 ATK)",
      min: 1,
      max: 1,
      chance: .25
    }, {
      key: "armor.armor_crystal",
      name: "Crystal Armor (+32 DEF)",
      min: 1,
      max: 1,
      chance: .25
    }]
  },
  secret: {
    name: "Secret Ancient Crate",
    emoji: "🗝️",
    money: [25e4, 6e5],
    exp: [8e3, 15e3],
    mcoin: [50, 150],
    bonus: [{
      key: "ores.platinum",
      name: "Platinum",
      min: 15,
      max: 25,
      chance: 1
    }, {
      key: "weapon.sword_dark",
      name: "Dark Sword (+85 ATK)",
      min: 1,
      max: 1,
      chance: .5
    }, {
      key: "armor.armor_crystal",
      name: "Crystal Armor (+32 DEF)",
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
  let oldLevel = user.level;
  let expRequired = user.level * 100;
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
export default {
  name: "open",
  aliases: ["gacha", "bukabox", "opencrate", "crate"],
  description: "Membuka kotak harta karun (Common / Uncommon / Legendary / Mythic / Secret)",
  category: "RPG",
  example: "open common atau open mythic",
  register: true,
  execute: async (sock, ctx, msg) => {
    try {
      db.ensureUser(ctx.sender, ctx.pushname);
      const user = global.db.user[ctx.sender];
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • Crate Center`;
      const bannerImage = global.bot?.media?.banner1 || "https://files.catbox.moe/g2e6i5.jpg";
      const crateType = ctx.args[0]?.toLowerCase();
      const userName = ctx.pushname || ctx.sender.split("@")[0];
      const senderNum = ctx.sender.split("@")[0];
      if (!crateType || !CRATE_REWARDS[crateType]) {
        const ownedRows = [];
        for (const [key, conf] of Object.entries(CRATE_REWARDS)) {
          const count = user.inventory?.crate?.[key] || 0;
          if (count > 0) {
            ownedRows.push({
              title: `${conf.emoji} Buka ${conf.name}`.slice(0, 24),
              description: `Tersedia: ${count} buah di dalam tas`,
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
            display_text: "⚔️ Cari di Dungeon",
            id: `${prefix}adv`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "⛏️ Cari di Tambang",
            id: `${prefix}mine`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🎒 Buka Inventory",
            id: `${prefix}inv`
          })
        });
        const menuText = `Hi ${userName}!
Berikut adalah persediaan kotak harta karun (crate) di dalam tas Anda.

–  *C R A T E S*

┌  ◦  *Player* : @${senderNum}
│  ◦  *Common* : ${user.inventory?.crate?.common || 0} Box
│  ◦  *Uncommon* : ${user.inventory?.crate?.uncommon || 0} Box
│  ◦  *Legendary* : ${user.inventory?.crate?.legendary || 0} Box
│  ◦  *Mythic* : ${user.inventory?.crate?.mythic || 0} Box
└  ◦  *Secret* : ${user.inventory?.crate?.secret || 0} Box

Pilih peti dari menu di bawah atau ketik *${prefix}open <jenis_crate>*.`;
        const options = {
          image: bannerImage,
          title: `✦ Crate Center • Loot Box ✦`,
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 2,
              divider_indices: [1],
              list_title: `${botName} • Crate Center`,
              button_title: "Buka Peti Harta"
            }
          },
          mentions: [ctx.sender],
          contextInfo: {
            mentionedJid: [ctx.sender],
            forwardingScore: 999,
            isForwarded: true
          },
          quoted: msg
        };
        if (typeof ctx.sendCta === "function") {
          return await ctx.sendCta(menuText, botFooter, buttons, options);
        }
        return await sock.sendMessage(ctx.id, {
          image: {
            url: bannerImage
          },
          caption: menuText,
          mentions: [ctx.sender]
        }, {
          quoted: msg
        });
      }
      const userCrates = user.inventory?.crate?.[crateType] || 0;
      const conf = CRATE_REWARDS[crateType];
      if (userCrates < 1) {
        const emptyText = `–  *O P E N  C R A T E*

Kamu tidak memiliki peti ${conf.name} di dalam tas.

┌  ◦  *Crate* : ${conf.name}
└  ◦  *Stock* : 0 Box

Dapatkan peti ini dengan bertualang di *${prefix}adv* atau menambang di *${prefix}mine*.`;
        return ctx.reply(emptyText);
      }
      user.inventory.crate[crateType] -= 1;
      const moneyGained = Math.floor(Math.random() * (conf.money[1] - conf.money[0] + 1)) + conf.money[0];
      const expGained = Math.floor(Math.random() * (conf.exp[1] - conf.exp[0] + 1)) + conf.exp[0];
      user.money += moneyGained;
      user.exp += expGained;
      let mcoinGained = 0;
      if (conf.mcoin) {
        mcoinGained = Math.floor(Math.random() * (conf.mcoin[1] - conf.mcoin[0] + 1)) + conf.mcoin[0];
        user.mcoin = (user.mcoin || 0) + mcoinGained;
      }
      const bonusGained = [];
      for (const b of conf.bonus) {
        if (Math.random() < b.chance) {
          const qty = Math.floor(Math.random() * (b.max - b.min + 1)) + b.min;
          addNested(user.inventory, b.key, qty);
          bonusGained.push(`${b.name} *(x${qty})*`);
        }
      }
      const lvlResult = checkLevelUp(user);
      db.write(global.db);
      await ctx.react("🎁");
      const bonusLines = bonusGained.length ? bonusGained.map((b, idx) => {
        const isLast = idx === bonusGained.length - 1;
        const branch = isLast ? "└" : "│";
        return `${branch}  ◦  ${b}`;
      }).join("\n") : "";
      let resultText = `Hi ${userName}!
Berhasil membuka ${conf.name}.

–  *R E W A R D S*

┌  ◦  *Balance* : +Rp ${moneyGained.toLocaleString("id-ID")}
│  ◦  *Exp* : +${expGained} XP
${mcoinGained > 0 ? `│  ◦  *MCoin* : +${mcoinGained} MCoin\n` : ""}│  ◦  *Remaining* : ${user.inventory.crate[crateType]} Box
└  ◦  *Level* : Lv. ${user.level} (${user.exp} / ${user.level * 100} XP)\n\n`;
      if (bonusLines) {
        resultText += `–  *B O N U S*

${bonusLines}\n\n`;
      }
      if (lvlResult.isLevelUp) {
        resultText += `–  *L E V E L  U P*

Selamat, level kamu naik ke *Lv. ${lvlResult.newLevel}*!
HP dan Mana telah dipulihkan penuh.\n\n`;
      }
      resultText += `Gunakan tombol di bawah untuk membuka kembali atau memeriksa tas.`;
      const buttons = [{
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: `📦 Buka Lagi (${user.inventory.crate[crateType]})`,
          id: `${prefix}open ${crateType}`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🎒 Cek Inventory",
          id: `${prefix}inv`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "⚔️ Masuk Dungeon",
          id: `${prefix}adv`
        })
      }];
      const options = {
        image: bannerImage,
        title: `✦ Crate Unboxing • ${conf.name} ✦`,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 2,
            divider_indices: [1],
            list_title: `${botName} • Crate Unboxing`,
            button_title: "Opsi Selanjutnya"
          }
        },
        mentions: [ctx.sender],
        contextInfo: {
          mentionedJid: [ctx.sender],
          forwardingScore: 999,
          isForwarded: true
        },
        quoted: msg
      };
      if (typeof ctx.sendCta === "function") {
        return await ctx.sendCta(resultText, botFooter, buttons, options);
      }
      return await sock.sendMessage(ctx.id, {
        image: {
          url: bannerImage
        },
        caption: resultText,
        mentions: [ctx.sender]
      }, {
        quoted: msg
      });
    } catch (err) {
      console.error("[CRATE ERROR]", err);
      ctx.reply(`❌ Terjadi kesalahan saat membuka peti: ${err.message}`);
    }
  }
};