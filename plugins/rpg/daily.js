import db from "../../data/db.js";

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
  name: "daily",
  aliases: ["hadiahHarian", "claimdaily", "claim", "harian"],
  description: "Klaim hadiah harian (Uang, EXP, Potion, Umpan & Crate) via Rich Interactive UI",
  category: "RPG",
  register: true,
  execute: async (sock, ctx, msg) => {
    try {
      db.ensureUser(ctx.sender, ctx.pushname);
      const user = global.db.user[ctx.sender];
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • Daily Reward`;
      const bannerImage = global.bot?.media?.banner1 || "https://files.catbox.moe/g2e6i5.jpg";
      const prefix = ctx.prefix || ".";
      const userName = ctx.pushname || ctx.sender.split("@")[0];
      const senderNum = ctx.sender.split("@")[0];
      const now = Date.now();
      const COOLDOWN_DAILY = 24 * 60 * 60 * 1e3;
      user.cooldown = user.cooldown || {};
      user.inventory = user.inventory || {};
      user.inventory.drink = user.inventory.drink || {
        water: 0,
        mana_potion: 0
      };
      user.inventory.nature = user.inventory.nature || {
        bait: 0
      };
      user.inventory.crate = user.inventory.crate || {
        common: 0,
        uncommon: 0
      };
      user.money = Number(user.money) || 0;
      user.exp = Number(user.exp) || 0;
      if (user.cooldown.daily && now - user.cooldown.daily < COOLDOWN_DAILY) {
        const sisa = COOLDOWN_DAILY - (now - user.cooldown.daily);
        const h = Math.floor(sisa / 36e5);
        const m = Math.floor(sisa % 36e5 / 6e4);
        const s = Math.floor(sisa % 6e4 / 1e3);
        const cdText = `Hi ${userName}!
Kamu sudah mengklaim jatah hadiah harian sebelumnya.

–  *C O O L D O W N*

┌  ◦  *Remaining* : ${h}h ${m}m ${s}s
│  ◦  *Reset* : Setiap 24 jam
└  ◦  *Status* : Claimed

Silakan kembali lagi nanti untuk mengambil jatah hadiah harian berikutnya.`;
        const cdButtons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "⚔️ Masuk Dungeon",
            id: `${prefix}adv`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "⛏️ Pergi Menambang",
            id: `${prefix}mine`
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
          title: `✦ Daily Cooldown ✦`,
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 2,
              divider_indices: [1],
              list_title: `${botName} • Daily Cooldown`,
              button_title: "Aktivitas Lain"
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
      await ctx.react("🎁");
      const isPremium = Boolean(user.premium?.status);
      const mult = isPremium ? 2 : 1;
      const moneyGained = Math.floor((5e3 + Math.floor(Math.random() * 1e4)) * mult);
      const expGained = Math.floor((25 + Math.floor(Math.random() * 35)) * mult);
      const bonusItems = [];
      const roll = Math.random();
      if (roll < .3) {
        user.inventory.drink.water = (user.inventory.drink.water || 0) + 2;
        bonusItems.push("Air Mineral (x2)");
      } else if (roll < .55) {
        user.inventory.nature.bait = (user.inventory.nature.bait || 0) + 4;
        bonusItems.push("Umpan Cacing (x4)");
      } else if (roll < .7) {
        user.inventory.drink.mana_potion = (user.inventory.drink.mana_potion || 0) + 1;
        bonusItems.push("Mana Potion (x1)");
      } else if (roll < .85) {
        user.inventory.crate.common = (user.inventory.crate.common || 0) + 1;
        bonusItems.push("Common Crate (x1)");
      } else {
        user.inventory.crate.uncommon = (user.inventory.crate.uncommon || 0) + 1;
        bonusItems.push("Uncommon Crate (x1)");
      }
      if (isPremium) {
        user.inventory.nature.bait = (user.inventory.nature.bait || 0) + 3;
        bonusItems.push("+3x Umpan (VIP)");
      }
      user.money += moneyGained;
      user.exp += expGained;
      user.cooldown.daily = now;
      const lvlResult = checkLevelUp(user);
      db.write(global.db);
      let bodyText = `Hi ${userName}!
Klaim hadiah harian Anda berhasil diproses.

–  *D A I L Y  C L A I M*

┌  ◦  *Player* : @${senderNum}
│  ◦  *Status* : ${isPremium ? "Premium" : "Free User"}
│  ◦  *Balance* : +Rp ${moneyGained.toLocaleString("id-ID")}
│  ◦  *Exp* : +${expGained} XP
└  ◦  *Item* : ${bonusItems.join(", ")}

–  *A C C O U N T*

┌  ◦  *Total Balance* : Rp ${user.money.toLocaleString("id-ID")}
└  ◦  *Current Level* : Lv. ${user.level} (${user.exp} / ${user.level * 100} XP)\n\n`;
      if (lvlResult.isLevelUp) {
        bodyText += `–  *L E V E L  U P*

Selamat, level kamu naik ke *Lv. ${lvlResult.newLevel}*!
HP dan Mana telah dipulihkan penuh.\n\n`;
      }
      bodyText += `Hadiah harian berikutnya dapat diklaim dalam 24 jam ke depan.`;
      const buttons = [{
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "⚔️ Masuk Dungeon",
          id: `${prefix}adv`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "⛏️ Pergi Menambang",
          id: `${prefix}mine`
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
        title: `✦ Daily Rewards ✦`,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 2,
            divider_indices: [1],
            list_title: `${botName} • Daily Rewards`,
            button_title: "Aksi Petualang"
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
      console.error("[DAILY ERROR]", err);
      ctx.reply(`❌ Terjadi kesalahan saat klaim harian: ${err.message}`);
    }
  }
};