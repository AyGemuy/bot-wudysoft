import db from "../../data/db.js";
const ORE_TABLE = [{
  key: "ores.stone",
  name: "Batu Alam",
  emoji: "🪨",
  chance: .85,
  qty: [2, 5],
  exp: 4
}, {
  key: "ores.coal",
  name: "Batu Bara",
  emoji: "⬛",
  chance: .65,
  qty: [1, 3],
  exp: 8
}, {
  key: "ores.iron",
  name: "Bijih Besi",
  emoji: "⛓️",
  chance: .45,
  qty: [1, 3],
  exp: 16
}, {
  key: "ores.gold",
  name: "Bijih Emas",
  emoji: "🪙",
  chance: .22,
  qty: [1, 2],
  exp: 32
}, {
  key: "ores.diamond",
  name: "Diamond",
  emoji: "💎",
  chance: .08,
  qty: [1, 1],
  exp: 75
}, {
  key: "ores.platinum",
  name: "Platinum",
  emoji: "💠",
  chance: .03,
  qty: [1, 1],
  exp: 150
}, {
  key: "crate.common",
  name: "Common Crate",
  emoji: "📦",
  chance: .25,
  qty: [1, 1],
  exp: 10
}, {
  key: "crate.uncommon",
  name: "Uncommon Crate",
  emoji: "🎁",
  chance: .1,
  qty: [1, 1],
  exp: 25
}, {
  key: "crate.legendary",
  name: "Legendary Crate",
  emoji: "🏆",
  chance: .02,
  qty: [1, 1],
  exp: 60
}];

function addInventoryNested(inv, dotKey, qty) {
  const [cat, item] = dotKey.split(".");
  if (inv && inv[cat]) {
    inv[cat][item] = (inv[cat][item] || 0) + qty;
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
  name: "mine",
  aliases: ["mining", "tambang", "gali"],
  description: "Menambang mineral dan bijih berharga di dalam gua",
  category: "RPG",
  register: true,
  execute: async (sock, ctx, msg) => {
    try {
      db.ensureUser(ctx.sender, ctx.pushname);
      const user = global.db.user[ctx.sender];
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • RPG Mining`;
      const bannerImage = global.bot?.media?.banner1 || "https://files.catbox.moe/g2e6i5.jpg";
      const prefix = ctx.prefix || ".";
      const userName = ctx.pushname || ctx.sender.split("@")[0];
      const senderNum = ctx.sender.split("@")[0];
      const now = Date.now();
      const COOLDOWN_TIME = 15 * 60 * 1e3;
      if (user.cooldown?.mine && now - user.cooldown.mine < COOLDOWN_TIME) {
        const sisa = COOLDOWN_TIME - (now - user.cooldown.mine);
        const m = Math.floor(sisa / 6e4);
        const s = Math.floor(sisa % 6e4 / 1e3);
        const cdText = `Hi ${userName}!
Kamu masih kelelahan sehabis menambang di dalam gua.

–  *C O O L D O W N*

┌  ◦  *Activity* : Mining
│  ◦  *Remaining* : ${m}m ${s}s
└  ◦  *Status* : Exhausted

Silakan istirahat sejenak sebelum menambang kembali.`;
        const cdButtons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "⚔️ Masuk Dungeon",
            id: `${prefix}adv`
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
          title: `✦ Mining Cooldown ✦`,
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 2,
              divider_indices: [1],
              list_title: `${botName} • Mining Cooldown`,
              button_title: "Aksi Lainnya"
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
          return await ctx.sendCta(cdText, botFooter, cdButtons, options);
        }
        return await sock.sendMessage(ctx.id, {
          image: {
            url: bannerImage
          },
          caption: cdText,
          mentions: [ctx.sender]
        }, {
          quoted: msg
        });
      }
      const hasDiaPickaxe = (user.inventory?.tools?.pickaxe_diamond || 0) > 0;
      const hasIronPickaxe = (user.inventory?.tools?.pickaxe_iron || 0) > 0;
      const toolMultiplier = hasDiaPickaxe ? 2.2 : hasIronPickaxe ? 1.5 : 1;
      const toolLabel = hasDiaPickaxe ? "Diamond Pickaxe (+120%)" : hasIronPickaxe ? "Iron Pickaxe (+50%)" : "Tangan Kosong";
      await ctx.react("⛏️");
      const minedLoot = [];
      let totalExp = 0;
      for (const item of ORE_TABLE) {
        if (Math.random() < item.chance * toolMultiplier) {
          const qty = Math.floor(Math.random() * (item.qty[1] - item.qty[0] + 1)) + item.qty[0];
          addInventoryNested(user.inventory, item.key, qty);
          totalExp += item.exp * qty;
          minedLoot.push(`${item.emoji} ${item.name} *(x${qty})*`);
        }
      }
      user.exp += totalExp;
      user.cooldown = user.cooldown || {};
      user.cooldown.mine = now;
      const lvlResult = checkLevelUp(user);
      db.write(global.db);
      const lootLines = minedLoot.length ? minedLoot.map((item, idx) => {
        const isLast = idx === minedLoot.length - 1;
        const branch = isLast ? "└" : "│";
        return `${branch}  ◦  ${item}`;
      }).join("\n") : "└  ◦  Hanya menemukan debu gua...";
      let bodyText = `Hi ${userName}!
Berikut adalah hasil eksplorasi tambang mineral gua.

–  *M I N I N G*

┌  ◦  *Player* : @${senderNum}
│  ◦  *Tool* : ${toolLabel}
│  ◦  *Exp Gained* : +${totalExp} XP
└  ◦  *Exp Progress* : ${user.exp} / ${user.level * 100} (Lv. ${user.level})

–  *L O O T*

${lootLines}\n\n`;
      if (lvlResult.isLevelUp) {
        bodyText += `–  *L E V E L  U P*

Selamat, level karakter kamu naik ke *Lv. ${lvlResult.newLevel}*!
HP dan Mana telah dipulihkan penuh.\n\n`;
      }
      bodyText += `Gunakan tombol di bawah untuk menempa hasil tambang atau memeriksa tas.`;
      const buttons = [{
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🔨 Tempa (Craft)",
          id: `${prefix}craft`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "⚔️ Masuk Dungeon",
          id: `${prefix}adv`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🎒 Buka Inventory",
          id: `${prefix}inv`
        })
      }];
      const options = {
        image: bannerImage,
        title: `✦ Mining Expedition ✦`,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 2,
            divider_indices: [1],
            list_title: `${botName} • Mining System`,
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
        return await ctx.sendCta(bodyText, botFooter, buttons, options);
      }
      return await sock.sendMessage(ctx.id, {
        image: {
          url: bannerImage
        },
        caption: bodyText,
        mentions: [ctx.sender]
      }, {
        quoted: msg
      });
    } catch (err) {
      console.error("[MINE ERROR]", err);
      ctx.reply(`❌ Terjadi kesalahan saat menambang: ${err.message}`);
    }
  }
};