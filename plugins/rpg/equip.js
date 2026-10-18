import db from "../../data/db.js";
const WEAPON_DATA = {
  sword_stone: {
    name: "Pedang Batu",
    atk: 8,
    emoji: "🗡️"
  },
  sword_iron: {
    name: "Pedang Besi",
    atk: 18,
    emoji: "⚔️"
  },
  sword_diamond: {
    name: "Pedang Berlian",
    atk: 35,
    emoji: "💠"
  },
  sword_light: {
    name: "Pedang Cahaya Suci",
    atk: 60,
    emoji: "☀️"
  },
  sword_dark: {
    name: "Pedang Kegelapan",
    atk: 85,
    emoji: "🌑"
  }
};
const ARMOR_DATA = {
  armor_leather: {
    name: "Zirah Kulit",
    def: 6,
    emoji: "🟤"
  },
  armor_iron: {
    name: "Zirah Besi",
    def: 15,
    emoji: "🔩"
  },
  armor_crystal: {
    name: "Zirah Kristal Abadi",
    def: 32,
    emoji: "💎"
  }
};
export default {
  name: "equip",
  aliases: ["pasang", "unequip", "lepas", "equipment"],
  description: "Memasang dan melepas senjata atau baju zirah untuk meningkatkan ATK/DEF",
  category: "RPG",
  register: true,
  execute: async (sock, ctx, msg) => {
    try {
      db.ensureUser(ctx.sender, ctx.pushname);
      const user = global.db.user[ctx.sender];
      const prefix = ctx.prefix || ".";
      const cmd = (ctx.cmd || "").toLowerCase();
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • Equipment Management`;
      const bannerImage = global.bot?.media?.banner1 || "https://files.catbox.moe/g2e6i5.jpg";
      const userName = ctx.pushname || ctx.sender.split("@")[0];
      const senderNum = ctx.sender.split("@")[0];
      if (!user.equipped) {
        user.equipped = {
          weapon: null,
          armor: null
        };
      }
      if (cmd === "unequip" || cmd === "lepas") {
        const slot = (ctx.args[0] || "").toLowerCase();
        if (slot === "weapon" || slot === "senjata" || slot === "pedang") {
          if (!user.equipped.weapon) return ctx.reply(`⚠️ Anda sedang tidak memasang senjata apapun.`);
          const oldWpn = user.equipped.weapon;
          user.equipped.weapon = null;
          db.write(global.db);
          await ctx.react("🔓");
          return ctx.reply(`–  *U N E Q U I P*

Senjata *${WEAPON_DATA[oldWpn]?.name || oldWpn}* berhasil dilepas.

┌  ◦  *Slot* : Weapon
└  ◦  *Status* : Unequipped`);
        }
        if (slot === "armor" || slot === "zirah" || slot === "baju") {
          if (!user.equipped.armor) return ctx.reply(`⚠️ Anda sedang tidak memakai baju zirah apapun.`);
          const oldArm = user.equipped.armor;
          user.equipped.armor = null;
          db.write(global.db);
          await ctx.react("🔓");
          return ctx.reply(`–  *U N E Q U I P*

Baju zirah *${ARMOR_DATA[oldArm]?.name || oldArm}* berhasil dilepas.

┌  ◦  *Slot* : Armor
└  ◦  *Status* : Unequipped`);
        }
        if (slot === "all" || slot === "semua") {
          user.equipped.weapon = null;
          user.equipped.armor = null;
          db.write(global.db);
          await ctx.react("🔓");
          return ctx.reply(`–  *U N E Q U I P*

Seluruh senjata dan baju zirah telah berhasil dilepas dari slot aktif.`);
        }
        return ctx.reply(`–  *U N E Q U I P*

Format pelepasan perlengkapan:

┌  ◦  *Weapon* : ${prefix}lepas weapon
│  ◦  *Armor* : ${prefix}lepas armor
└  ◦  *All* : ${prefix}lepas all`);
      }
      const itemKey = (ctx.args[0] || "").toLowerCase().replace(/\s+/g, "_");
      if (itemKey) {
        if (WEAPON_DATA[itemKey]) {
          const wpn = WEAPON_DATA[itemKey];
          if ((user.inventory?.weapon?.[itemKey] || 0) <= 0) {
            return ctx.reply(`❌ Anda tidak memiliki *${wpn.name}* di dalam tas. Tempa di *${prefix}craft*.`);
          }
          user.equipped.weapon = itemKey;
          db.write(global.db);
          await ctx.react("⚔️");
          const equipText = `Hi ${userName}!
Senjata tempur berhasil dipasang ke slot aktif.

–  *E Q U I P M E N T*

┌  ◦  *Slot* : Weapon
│  ◦  *Item* : ${wpn.name}
│  ◦  *Bonus* : +${wpn.atk} ATK
└  ◦  *Total ATK* : ${user.atk + wpn.atk} ATK

Senjata siap digunakan untuk bertarung di *${prefix}adv*.`;
          const buttons = [{
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
            title: `✦ Weapon Equipped • ${wpn.name} ✦`,
            params: {
              bottom_sheet: {
                in_thread_buttons_limit: 2,
                divider_indices: [1],
                list_title: `${botName} • Weapon Equipped`,
                button_title: "Aksi Selanjutnya"
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
            return await ctx.sendCta(equipText, botFooter, buttons, options);
          }
          return await sock.sendMessage(ctx.id, {
            image: {
              url: bannerImage
            },
            caption: equipText
          }, {
            quoted: msg
          });
        }
        if (ARMOR_DATA[itemKey]) {
          const arm = ARMOR_DATA[itemKey];
          if ((user.inventory?.armor?.[itemKey] || 0) <= 0) {
            return ctx.reply(`❌ Anda tidak memiliki *${arm.name}* di dalam tas. Tempa di *${prefix}craft*.`);
          }
          user.equipped.armor = itemKey;
          db.write(global.db);
          await ctx.react("🛡️");
          const equipText = `Hi ${userName}!
Baju zirah pelindung berhasil dipasang ke slot pertahanan.

–  *E Q U I P M E N T*

┌  ◦  *Slot* : Armor
│  ◦  *Item* : ${arm.name}
│  ◦  *Bonus* : +${arm.def} DEF
└  ◦  *Total DEF* : ${user.def + arm.def} DEF

Pertahanan karakter meningkat untuk menahan serangan musuh.`;
          const buttons = [{
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
            title: `✦ Armor Equipped • ${arm.name} ✦`,
            params: {
              bottom_sheet: {
                in_thread_buttons_limit: 2,
                divider_indices: [1],
                list_title: `${botName} • Armor Equipped`,
                button_title: "Aksi Selanjutnya"
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
            return await ctx.sendCta(equipText, botFooter, buttons, options);
          }
          return await sock.sendMessage(ctx.id, {
            image: {
              url: bannerImage
            },
            caption: equipText
          }, {
            quoted: msg
          });
        }
        return ctx.reply(`❌ Item *"${itemKey}"* bukan senjata atau armor yang valid.`);
      }
      const curWpnKey = user.equipped.weapon;
      const curArmKey = user.equipped.armor;
      const curWpn = curWpnKey && WEAPON_DATA[curWpnKey] ? WEAPON_DATA[curWpnKey] : null;
      const curArm = curArmKey && ARMOR_DATA[curArmKey] ? ARMOR_DATA[curArmKey] : null;
      const totalAtk = user.atk + (curWpn?.atk || 0);
      const totalDef = user.def + (curArm?.def || 0);
      const ownedWeapons = Object.keys(WEAPON_DATA).filter(k => (user.inventory?.weapon?.[k] || 0) > 0);
      const ownedArmors = Object.keys(ARMOR_DATA).filter(k => (user.inventory?.armor?.[k] || 0) > 0);
      const availableRows = [];
      for (const wKey of ownedWeapons) {
        const item = WEAPON_DATA[wKey];
        const isEquipped = curWpnKey === wKey;
        availableRows.push({
          title: `${item.emoji} ${item.name} ${isEquipped ? "[DIPAKAI]" : ""}`.slice(0, 24),
          description: `+${item.atk} ATK (${user.inventory?.weapon?.[wKey]} buah)`,
          id: `${prefix}equip ${wKey}`
        });
      }
      for (const aKey of ownedArmors) {
        const item = ARMOR_DATA[aKey];
        const isEquipped = curArmKey === aKey;
        availableRows.push({
          title: `${item.emoji} ${item.name} ${isEquipped ? "[DIPAKAI]" : ""}`.slice(0, 24),
          description: `+${item.def} DEF (${user.inventory?.armor?.[aKey]} buah)`,
          id: `${prefix}equip ${aKey}`
        });
      }
      const bodyText = `Hi ${userName}!
Berikut adalah status perlengkapan tempur karakter Anda.

–  *E Q U I P M E N T*

┌  ◦  *Player* : @${senderNum}
│  ◦  *Total ATK* : ${totalAtk} ATK (${user.atk} + ${curWpn?.atk || 0})
│  ◦  *Total DEF* : ${totalDef} DEF (${user.def} + ${curArm?.def || 0})
│  ◦  *Weapon* : ${curWpn ? `${curWpn.name} (+${curWpn.atk} ATK)` : "Tangan Kosong"}
└  ◦  *Armor* : ${curArm ? `${curArm.name} (+${curArm.def} DEF)` : "Pakaian Biasa"}

Pilih perlengkapan dari menu di bawah untuk langsung memasangnya.`;
      const buttons = [];
      if (availableRows.length > 0) {
        buttons.push({
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "⚔️ PASANG PERLENGKAPAN",
            sections: [{
              title: `Perlengkapan Milikmu (${availableRows.length})`,
              rows: availableRows
            }]
          })
        });
      }
      buttons.push({
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "⚔️ Masuk Dungeon",
          id: `${prefix}adv`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🔓 Lepas Senjata",
          id: `${prefix}lepas weapon`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🔓 Lepas Zirah",
          id: `${prefix}lepas armor`
        })
      });
      const options = {
        image: bannerImage,
        title: `✦ Equipment Management ✦`,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 2,
            divider_indices: [1],
            list_title: `${botName} • Equipment Management`,
            button_title: "Kelola Perlengkapan"
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
      console.error("[EQUIP ERROR]", err);
      ctx.reply(`❌ Terjadi kesalahan: ${err.message}`);
    }
  }
};