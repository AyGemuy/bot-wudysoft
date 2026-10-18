import db from "../../data/db.js";
const FISH_TABLE = [{
  key: "fish.anchovy",
  name: "Ikan Teri",
  emoji: "🐟",
  chance: .55,
  exp: 6
}, {
  key: "fish.shrimp",
  name: "Udang Segar",
  emoji: "🦐",
  chance: .45,
  exp: 9
}, {
  key: "fish.catfish",
  name: "Ikan Lele",
  emoji: "🐟",
  chance: .4,
  exp: 12
}, {
  key: "fish.carp",
  name: "Ikan Mas",
  emoji: "🐡",
  chance: .3,
  exp: 15
}, {
  key: "fish.squid",
  name: "Cumi-Cumi",
  emoji: "🦑",
  chance: .22,
  exp: 20
}, {
  key: "fish.tuna",
  name: "Ikan Tuna",
  emoji: "🐠",
  chance: .18,
  exp: 25
}, {
  key: "fish.salmon",
  name: "Ikan Salmon",
  emoji: "🐟",
  chance: .15,
  exp: 30
}, {
  key: "fish.clownfish",
  name: "Ikan Badut",
  emoji: "🐠",
  chance: .1,
  exp: 35
}, {
  key: "fish.swordfish",
  name: "Ikan Pedang",
  emoji: "🗡️",
  chance: .06,
  exp: 50
}, {
  key: "fish.pufferfish",
  name: "Ikan Buntal",
  emoji: "🐡",
  chance: .04,
  exp: 70
}, {
  key: "crate.uncommon",
  name: "Peti Harta Karun Laut",
  emoji: "🎁",
  chance: .08,
  exp: 20
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
  name: "fish",
  aliases: ["mancing", "fishing", "pancing"],
  description: "Memancing ikan di sungai atau laut menggunakan umpan",
  category: "RPG",
  register: true,
  execute: async (sock, ctx, msg) => {
    try {
      db.ensureUser(ctx.sender, ctx.pushname);
      const user = global.db.user[ctx.sender];
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • Fishery System`;
      const bannerImage = global.bot?.media?.banner1 || "https://files.catbox.moe/g2e6i5.jpg";
      const prefix = ctx.prefix || ".";
      const userName = ctx.pushname || ctx.sender.split("@")[0];
      const senderNum = ctx.sender.split("@")[0];
      const now = Date.now();
      const COOLDOWN_TIME = 10 * 60 * 1e3;
      if (user.cooldown?.fish && now - user.cooldown.fish < COOLDOWN_TIME) {
        const sisa = COOLDOWN_TIME - (now - user.cooldown.fish);
        const m = Math.floor(sisa / 6e4);
        const s = Math.floor(sisa % 6e4 / 1e3);
        const cdText = `Hi ${userName}!
Ikan sedang menjauhi tepi sungai, tunggu beberapa saat lagi.

–  *C O O L D O W N*

┌  ◦  *Activity* : Fishing
│  ◦  *Remaining* : ${m}m ${s}s
└  ◦  *Status* : Calming Water

Silakan tunggu hingga kondisi perairan kembali normal.`;
        const cdButtons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "⛏️ Pergi Menambang",
            id: `${prefix}mine`
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
          title: `✦ Fishing Cooldown ✦`,
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 2,
              divider_indices: [1],
              list_title: `${botName} • Fishing Cooldown`,
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
      if ((user.inventory?.nature?.bait || 0) <= 0) {
        const noBaitText = `–  *N O  B A I T*

Kamu tidak memiliki umpan cacing di dalam tas.

┌  ◦  *Item* : Umpan Cacing
└  ◦  *Stock* : 0 Pcs

Beli umpan di toko (*${prefix}shop*) atau buka peti harta karun (*${prefix}open*).`;
        const noBaitButtons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🏪 Beli di Toko",
            id: `${prefix}shop`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "📦 Buka Crate",
            id: `${prefix}open common`
          })
        }];
        const options = {
          image: bannerImage,
          title: `✦ No Bait Available ✦`,
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 2,
              divider_indices: [1],
              list_title: `${botName} • No Bait`,
              button_title: "Dapatkan Umpan"
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
          return await ctx.sendCta(noBaitText, botFooter, noBaitButtons, options);
        }
        return await sock.sendMessage(ctx.id, {
          image: {
            url: bannerImage
          },
          caption: noBaitText,
          mentions: [ctx.sender]
        }, {
          quoted: msg
        });
      }
      const hasPremRod = (user.inventory?.tools?.rod_premium || 0) > 0;
      const hasWoodRod = (user.inventory?.tools?.rod_wood || 0) > 0;
      const rodMultiplier = hasPremRod ? 2 : hasWoodRod ? 1.4 : 1;
      const rodLabel = hasPremRod ? "Joran Premium (+100%)" : hasWoodRod ? "Joran Kayu (+40%)" : "Tangan Kosong";
      user.inventory.nature.bait -= 1;
      await ctx.react("🎣");
      const catches = [];
      let totalExp = 0;
      for (const fish of FISH_TABLE) {
        if (Math.random() < fish.chance * rodMultiplier) {
          addInventoryNested(user.inventory, fish.key, 1);
          totalExp += fish.exp;
          catches.push(`${fish.emoji} ${fish.name}`);
        }
      }
      user.exp = (user.exp || 0) + totalExp;
      user.cooldown = user.cooldown || {};
      user.cooldown.fish = now;
      const lvlResult = checkLevelUp(user);
      db.write(global.db);
      const catchLines = catches.length ? catches.map((item, idx) => {
        const isLast = idx === catches.length - 1;
        const branch = isLast ? "└" : "│";
        return `${branch}  ◦  ${item}`;
      }).join("\n") : "└  ◦  Ikan memakan umpan lalu kabur...";
      let bodyText = `Hi ${userName}!
Berikut adalah hasil tangkapan memancing di sungai.

–  *F I S H I N G*

┌  ◦  *Player* : @${senderNum}
│  ◦  *Tool* : ${rodLabel}
│  ◦  *Remaining Bait* : ${user.inventory.nature.bait} Pcs
│  ◦  *Exp Gained* : +${totalExp} XP
└  ◦  *Exp Progress* : ${user.exp} / ${user.level * 100} (Lv. ${user.level})

–  *C A T C H E S*

${catchLines}\n\n`;
      if (lvlResult.isLevelUp) {
        bodyText += `–  *L E V E L  U P*

Selamat, level karakter kamu naik ke *Lv. ${lvlResult.newLevel}*!
HP dan Mana telah dipulihkan penuh.\n\n`;
      }
      bodyText += `Gunakan tombol di bawah untuk memasak hasil tangkapan atau memeriksa tas.`;
      const buttons = [{
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🍳 Masak Ikan Bakar",
          id: `${prefix}craft grilled_fish`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🎣 Mancing Lagi",
          id: `${prefix}fish`
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
        title: `✦ Fishing Result ✦`,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 2,
            divider_indices: [1],
            list_title: `${botName} • Fishing Result`,
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
      console.error("[FISH ERROR]", err);
      ctx.reply(`❌ Terjadi kesalahan saat memancing: ${err.message}`);
    }
  }
};