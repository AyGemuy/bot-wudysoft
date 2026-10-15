import db from "../../data/db.js";
const USABLE_ITEMS = {
  water: {
    name: "Air Mineral",
    emoji: "💧",
    hp: 15,
    mana: 0,
    category: "drink"
  },
  juice: {
    name: "Jus Buah Segar",
    emoji: "🧃",
    hp: 30,
    mana: 10,
    category: "drink"
  },
  herbal_tea: {
    name: "Teh Herbal",
    emoji: "🍵",
    hp: 50,
    mana: 25,
    category: "drink"
  },
  mana_potion: {
    name: "Mana Potion",
    emoji: "🔵",
    hp: 0,
    mana: 80,
    category: "drink"
  },
  elixir: {
    name: "Elixir Suci",
    emoji: "✨",
    hp: 200,
    mana: 100,
    category: "drink"
  },
  bread: {
    name: "Roti Gandum",
    emoji: "🍞",
    hp: 20,
    mana: 0,
    category: "food"
  },
  rice: {
    name: "Nasi Putih",
    emoji: "🍚",
    hp: 40,
    mana: 5,
    category: "food"
  },
  grilled_fish: {
    name: "Ikan Bakar",
    emoji: "🐟",
    hp: 60,
    mana: 10,
    category: "food"
  },
  fruit_salad: {
    name: "Salad Buah Segar",
    emoji: "🥗",
    hp: 45,
    mana: 30,
    category: "food"
  },
  roast_chicken: {
    name: "Ayam Panggang",
    emoji: "🍗",
    hp: 80,
    mana: 15,
    category: "food"
  },
  steak: {
    name: "Steak Daging Sapi",
    emoji: "🥩",
    hp: 100,
    mana: 20,
    category: "food"
  }
};
export default {
  name: "use",
  aliases: ["pakai", "consume", "makan", "minum", "heal"],
  description: "Mengonsumsi makanan atau ramuan untuk memulihkan HP & Mana via Interactive CTA",
  category: "RPG",
  example: "use potion atau use steak 2",
  register: true,
  execute: async (sock, ctx, msg) => {
    try {
      db.ensureUser(ctx.sender, ctx.pushname);
      const user = global.db.user[ctx.sender];
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • Recovery Center`;
      const bannerImage = global.bot?.media?.banner1 || "https://files.catbox.moe/g2e6i5.jpg";
      const itemKey = ctx.args[0]?.toLowerCase().replace(/\s+/g, "_");
      const qty = Math.max(1, parseInt(ctx.args[1]) || 1);
      const userName = ctx.pushname || ctx.sender.split("@")[0];
      const senderNum = ctx.sender.split("@")[0];
      if (!itemKey || !USABLE_ITEMS[itemKey]) {
        const ownedRows = [];
        for (const [key, item] of Object.entries(USABLE_ITEMS)) {
          const count = user.inventory?.[item.category]?.[key] || 0;
          if (count > 0) {
            const statText = [item.hp > 0 ? `+${item.hp} HP` : "", item.mana > 0 ? `+${item.mana} MP` : ""].filter(Boolean).join(" & ");
            ownedRows.push({
              title: `${item.emoji} ${item.name} (${count}x)`.slice(0, 24),
              description: `Efek: ${statText}`,
              id: `${prefix}use ${key} 1`
            });
          }
        }
        const buttons = [];
        if (ownedRows.length > 0) {
          buttons.push({
            name: "single_select",
            buttonParamsJson: JSON.stringify({
              title: "🍽️ PILIH MAKANAN / POTION",
              sections: [{
                title: `Konsumsi Milikmu (${ownedRows.length} Jenis)`,
                rows: ownedRows
              }]
            })
          });
        }
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "⛺ Istirahat (Rest)",
            id: `${prefix}rest`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🍳 Masak di Dapur",
            id: `${prefix}craft`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🎒 Buka Inventory",
            id: `${prefix}inv`
          })
        });
        const menuText = `Hi ${userName}!
Gunakan makanan atau ramuan untuk memulihkan status karakter Anda.

–  *S T A T U S*

┌  ◦  *Player* : @${senderNum}
│  ◦  *Health* : ${user.hp} / ${user.hpMax} HP
│  ◦  *Mana* : ${user.mana} / ${user.manaMax} MP
└  ◦  *Consumable* : ${ownedRows.length} Jenis Tersedia

${ownedRows.length > 0 ? "Pilih makanan atau ramuan dari menu di bawah untuk langsung mengonsumsinya." : "Kamu tidak memiliki makanan atau ramuan pemulih di dalam tas."}`;
        const options = {
          image: bannerImage,
          title: `✦ Recovery Center • Consumables ✦`,
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 2,
              divider_indices: [1],
              list_title: `${botName} • Consumables`,
              button_title: "Menu Konsumsi"
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
      const item = USABLE_ITEMS[itemKey];
      const inv = user.inventory?.[item.category];
      if (!inv || (inv[itemKey] || 0) < qty) {
        const notEnoughText = `–  *U S E  I T E M*

Jumlah item tidak mencukupi di dalam tas.

┌  ◦  *Item* : ${item.name}
│  ◦  *Required* : ${qty} buah
└  ◦  *Owned* : ${inv?.[itemKey] || 0} buah

Masak makanan di *${prefix}craft* atau beli di *${prefix}shop*.`;
        return ctx.reply(notEnoughText);
      }
      if (user.hp >= user.hpMax && user.mana >= user.manaMax) {
        const fullStatusText = `–  *U S E  I T E M*

Kondisi HP dan Mana karakter sudah penuh.

┌  ◦  *Health* : ${user.hp} / ${user.hpMax} HP
└  ◦  *Mana* : ${user.mana} / ${user.manaMax} MP

Kondisi karakter sangat prima untuk bertarung di *${prefix}adv*.`;
        return ctx.reply(fullStatusText);
      }
      const hpBefore = user.hp;
      const manaBefore = user.mana;
      inv[itemKey] -= qty;
      const totalHpHeal = item.hp * qty;
      const totalManaHeal = item.mana * qty;
      user.hp = Math.min(user.hpMax, user.hp + totalHpHeal);
      user.mana = Math.min(user.manaMax, user.mana + totalManaHeal);
      const realHpGained = user.hp - hpBefore;
      const realManaGained = user.mana - manaBefore;
      db.write(global.db);
      await ctx.react("🧪");
      const successText = `Hi ${userName}!
Konsumsi item pemulih berhasil digunakan.

–  *R E C O V E R Y*

┌  ◦  *Player* : @${senderNum}
│  ◦  *Consumed* : ${item.name} (x${qty})
${item.hp > 0 ? `│  ◦  *Health* : ${hpBefore} ➔ ${user.hp}/${user.hpMax} (+${realHpGained})\n` : ""}${item.mana > 0 ? `│  ◦  *Mana* : ${manaBefore} ➔ ${user.mana}/${user.manaMax} (+${realManaGained})\n` : ""}└  ◦  *Remaining* : ${inv[itemKey]} buah

Tubuh karakter terasa lebih bertenaga untuk kembali bertualang.`;
      const buttons = [];
      if (inv[itemKey] > 0 && (user.hp < user.hpMax || user.mana < user.manaMax)) {
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `🧪 Pakai Lagi (${inv[itemKey]}x)`,
            id: `${prefix}use ${itemKey} 1`
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
          display_text: "🎒 Cek Inventory",
          id: `${prefix}inv`
        })
      });
      const options = {
        image: bannerImage,
        title: `✦ Recovery Center • Heal Used ✦`,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 2,
            divider_indices: [1],
            list_title: `${botName} • Heal Used`,
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
        return await ctx.sendCta(successText, botFooter, buttons, options);
      }
      return await sock.sendMessage(ctx.id, {
        image: {
          url: bannerImage
        },
        caption: successText,
        mentions: [ctx.sender]
      }, {
        quoted: msg
      });
    } catch (err) {
      console.error("[USE ERROR]", err);
      ctx.reply(`❌ Terjadi kesalahan: ${err.message}`);
    }
  }
};