import db from "../../data/db.js";
const CRATE_REWARDS = {
  common: {
    moneyMin: 1500,
    moneyMax: 3500,
    expMin: 20,
    expMax: 45,
    bait: 2
  },
  uncommon: {
    moneyMin: 3500,
    moneyMax: 7500,
    expMin: 50,
    expMax: 90,
    bait: 4
  },
  legendary: {
    moneyMin: 1e4,
    moneyMax: 25e3,
    expMin: 150,
    expMax: 300,
    bait: 8
  },
  mythic: {
    moneyMin: 35e3,
    moneyMax: 7e4,
    expMin: 500,
    expMax: 900,
    bait: 15
  },
  secret: {
    moneyMin: 1e5,
    moneyMax: 25e4,
    expMin: 1500,
    expMax: 3e3,
    bait: 30
  }
};
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
export default {
  name: "inventory",
  aliases: ["inv", "tas", "bag"],
  description: "Melihat tas inventaris, memasang perlengkapan, dan membuka peti hadiah",
  category: "RPG",
  register: true,
  execute: async (sock, ctx, msg) => {
    try {
      db.ensureUser(ctx.sender, ctx.pushname);
      const user = global.db.user[ctx.sender];
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • RPG Adventure`;
      const bannerImage = global.bot?.media?.banner1 || "https://files.catbox.moe/g2e6i5.jpg";
      const action = (ctx.cmd || "").toLowerCase();
      const target = (ctx.args[0] || "").toLowerCase();
      const userName = ctx.pushname || ctx.sender.split("@")[0];
      const senderNum = ctx.sender.split("@")[0];
      user.inventory = user.inventory || {};
      user.inventory.ores = user.inventory.ores || {
        stone: 0,
        coal: 0,
        iron: 0,
        gold: 0,
        diamond: 0,
        platinum: 0
      };
      user.inventory.fish = user.inventory.fish || {
        anchovy: 0,
        catfish: 0,
        tuna: 0,
        salmon: 0,
        swordfish: 0
      };
      user.inventory.crate = user.inventory.crate || {
        common: 0,
        uncommon: 0,
        legendary: 0,
        mythic: 0,
        secret: 0
      };
      user.inventory.nature = user.inventory.nature || {
        bait: 0
      };
      user.inventory.weapon = user.inventory.weapon || {};
      user.inventory.armor = user.inventory.armor || {};
      user.equipped = user.equipped || {
        weapon: null,
        armor: null
      };
      if (action === "equip" || target === "equip") {
        const itemKey = (action === "equip" ? ctx.args[0] : ctx.args[1] || "").toLowerCase();
        if (!itemKey) {
          return ctx.reply(`–  *E Q U I P*

Format perintah tidak lengkap.

┌  ◦  *Format* : ${prefix}equip <nama_item>
└  ◦  *Example* : ${prefix}equip sword_iron`);
        }
        if ((user.inventory.weapon[itemKey] || 0) > 0) {
          user.equipped.weapon = itemKey;
          db.write(global.db);
          await ctx.react("⚔️");
          return ctx.reply(`–  *E Q U I P*

Senjata tempur berhasil dipasang ke slot aktif.

┌  ◦  *Slot* : Weapon
└  ◦  *Item* : ${itemKey.replace(/_/g, " ").toUpperCase()}`);
        } else if ((user.inventory.armor[itemKey] || 0) > 0) {
          user.equipped.armor = itemKey;
          db.write(global.db);
          await ctx.react("🛡️");
          return ctx.reply(`–  *E Q U I P*

Baju zirah pelindung berhasil dipakai ke slot pertahanan.

┌  ◦  *Slot* : Armor
└  ◦  *Item* : ${itemKey.replace(/_/g, " ").toUpperCase()}`);
        } else {
          return ctx.reply(`❌ Kamu tidak memiliki item *${itemKey}* di dalam tas.`);
        }
      }
      if (action === "open") {
        const crateType = target || "common";
        if (!CRATE_REWARDS[crateType]) {
          return ctx.reply(`–  *O P E N  C R A T E*

Jenis crate tidak valid.

┌  ◦  *Options* : common, uncommon, legendary, mythic, secret
└  ◦  *Example* : ${prefix}open common`);
        }
        if ((user.inventory.crate[crateType] || 0) <= 0) {
          return ctx.reply(`❌ Kamu tidak memiliki *${crateType.toUpperCase()} CRATE* di dalam tas.`);
        }
        user.inventory.crate[crateType] -= 1;
        const cfg = CRATE_REWARDS[crateType];
        const rewardMoney = Math.floor(Math.random() * (cfg.moneyMax - cfg.moneyMin + 1)) + cfg.moneyMin;
        const rewardExp = Math.floor(Math.random() * (cfg.expMax - cfg.expMin + 1)) + cfg.expMin;
        user.money += rewardMoney;
        user.exp += rewardExp;
        user.inventory.nature.bait = (user.inventory.nature.bait || 0) + cfg.bait;
        db.write(global.db);
        await ctx.react("🎁");
        const openText = `–  *C R A T E  R E W A R D*

Berhasil membuka peti ${crateType.toUpperCase()} CRATE.

┌  ◦  *Balance* : +Rp ${rewardMoney.toLocaleString("id-ID")}
│  ◦  *Exp* : +${rewardExp} XP
│  ◦  *Bait* : +${cfg.bait} Pcs
└  ◦  *Remaining* : ${user.inventory.crate[crateType]} Crates

Gunakan tombol di bawah untuk membuka kembali atau memeriksa tas.`;
        const buttons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🎁 Buka Crate Lagi",
            id: `${prefix}open ${crateType}`
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
          title: `✦ Crate Rewards • ${crateType.toUpperCase()} ✦`,
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 2,
              divider_indices: [1],
              list_title: `${botName} • Crate Rewards`,
              button_title: "Opsi Crate"
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
          return await ctx.sendCta(openText, botFooter, buttons, options);
        }
        return await sock.sendMessage(ctx.id, {
          image: {
            url: bannerImage
          },
          caption: openText,
          mentions: [ctx.sender]
        }, {
          quoted: msg
        });
      }
      const inv = user.inventory;
      const totalAtk = (user.atk || 10) + (WEAPON_BONUS[user.equipped?.weapon] || 0);
      const totalDef = (user.def || 5) + (ARMOR_BONUS[user.equipped?.armor] || 0);
      const weaponName = user.equipped.weapon ? user.equipped.weapon.replace(/_/g, " ").toUpperCase() : "Tangan Kosong";
      const armorName = user.equipped.armor ? user.equipped.armor.replace(/_/g, " ").toUpperCase() : "Pakaian Biasa";
      const bodyText = `Hi ${userName}!
Berikut adalah rincian status karakter dan isi tas inventaris Anda.

–  *S T A T U S*

┌  ◦  *Player* : @${senderNum}
│  ◦  *Level* : Lv. ${user.level} (${user.exp} / ${user.level * 100} XP)
│  ◦  *Health* : ${user.hp} / ${user.hpMax} HP
│  ◦  *Mana* : ${user.mana} / ${user.manaMax} MP
│  ◦  *Attack* : ${totalAtk} ATK
│  ◦  *Defense* : ${totalDef} DEF
│  ◦  *Balance* : Rp ${(user.money || 0).toLocaleString("id-ID")}
│  ◦  *Weapon* : ${weaponName}
└  ◦  *Armor* : ${armorName}

–  *M I N E R A L S*

┌  ◦  *Stone* : ${inv.ores.stone || 0}
│  ◦  *Iron* : ${inv.ores.iron || 0}
│  ◦  *Gold* : ${inv.ores.gold || 0}
│  ◦  *Diamond* : ${inv.ores.diamond || 0}
└  ◦  *Platinum* : ${inv.ores.platinum || 0}

–  *F I S H*

┌  ◦  *Anchovy* : ${inv.fish.anchovy || 0}
│  ◦  *Catfish* : ${inv.fish.catfish || 0}
│  ◦  *Tuna* : ${inv.fish.tuna || 0}
│  ◦  *Salmon* : ${inv.fish.salmon || 0}
└  ◦  *Swordfish* : ${inv.fish.swordfish || 0}

–  *C R A T E S*

┌  ◦  *Common* : ${inv.crate.common || 0}
│  ◦  *Uncommon* : ${inv.crate.uncommon || 0}
│  ◦  *Legendary* : ${inv.crate.legendary || 0}
│  ◦  *Mythic* : ${inv.crate.mythic || 0}
└  ◦  *Bait* : ${inv.nature.bait || 0} Pcs

Gunakan menu di bawah untuk mengelola perlengkapan atau bertualang.`;
      const shortcutRows = [{
        title: "⚔️ Kelola Perlengkapan (.equip)",
        description: "Pasang atau lepas senjata & baju zirah tempur",
        id: `${prefix}equip`
      }, {
        title: "🎁 Buka Peti Hadiah (.open)",
        description: "Buka kotak harta karun Crate dari dalam tas",
        id: `${prefix}open common`
      }, {
        title: "🏪 Pasar & Toko RPG (.shop)",
        description: "Jual beli mineral, tangkapan, dan perlengkapan",
        id: `${prefix}shop`
      }];
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: "🎒 MENU MANAJEMEN TAS",
          sections: [{
            title: `${botName} • Navigasi Inventory`,
            rows: shortcutRows
          }]
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
          display_text: "⛏️ Pergi Menambang",
          id: `${prefix}mine`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🎣 Pergi Mancing",
          id: `${prefix}fish`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🔨 Buka Blacksmith",
          id: `${prefix}craft`
        })
      }];
      const options = {
        image: bannerImage,
        title: `✦ ${botName} • Character Sheet ✦`,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 2,
            divider_indices: [1],
            list_title: `${botName} • Inventory & Status`,
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
      console.error("[INVENTORY ERROR]", err);
      ctx.reply(`❌ Terjadi kesalahan: ${err.message}`);
    }
  }
};