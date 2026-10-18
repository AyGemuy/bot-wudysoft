import db from "../../data/db.js";
const RECIPES = {
  sword_stone: {
    name: "Pedang Batu (Stone Sword)",
    cat: "weapon",
    stat: "+8 ATK Tempur",
    req: {
      "ores.stone": 8,
      "nature.wood": 2
    }
  },
  sword_iron: {
    name: "Pedang Besi (Iron Sword)",
    cat: "weapon",
    stat: "+18 ATK Tempur",
    req: {
      "ores.iron": 5,
      "ores.coal": 2,
      "nature.wood": 2
    }
  },
  sword_diamond: {
    name: "Pedang Berlian (Diamond Sword)",
    cat: "weapon",
    stat: "+35 ATK Tempur",
    req: {
      "ores.diamond": 3,
      "ores.gold": 2,
      "nature.wood": 3
    }
  },
  sword_light: {
    name: "Pedang Cahaya Suci (Light Sword)",
    cat: "weapon",
    stat: "+60 ATK Tempur",
    req: {
      "ores.platinum": 2,
      "ores.diamond": 5,
      "ores.gold": 5
    }
  },
  armor_leather: {
    name: "Baju Zirah Kulit (Leather Armor)",
    cat: "armor",
    stat: "+6 DEF Tempur",
    req: {
      "nature.leather": 5,
      "nature.wood": 2
    }
  },
  armor_iron: {
    name: "Baju Zirah Besi (Iron Armor)",
    cat: "armor",
    stat: "+15 DEF Tempur",
    req: {
      "ores.iron": 8,
      "nature.leather": 3
    }
  },
  armor_crystal: {
    name: "Zirah Kristal Abadi (Crystal Armor)",
    cat: "armor",
    stat: "+32 DEF Tempur",
    req: {
      "ores.diamond": 5,
      "ores.platinum": 2
    }
  },
  pickaxe_iron: {
    name: "Beliung Besi (Iron Pickaxe)",
    cat: "tools",
    stat: "+50% Hasil Tambang",
    req: {
      "ores.iron": 4,
      "nature.wood": 3
    }
  },
  pickaxe_diamond: {
    name: "Beliung Berlian (Diamond Pickaxe)",
    cat: "tools",
    stat: "+120% Hasil Tambang",
    req: {
      "ores.diamond": 3,
      "ores.gold": 1,
      "nature.wood": 3
    }
  },
  rod_wood: {
    name: "Joran Kayu Halus (Wood Rod)",
    cat: "tools",
    stat: "+40% Hasil Pancingan",
    req: {
      "nature.wood": 5,
      "nature.leather": 1
    }
  },
  grilled_fish: {
    name: "Ikan Bakar Rempah",
    cat: "food",
    stat: "Pulihkan +50 HP",
    req: {
      "fish.catfish": 2,
      "nature.spice": 1,
      "nature.wood": 1
    }
  },
  fruit_salad: {
    name: "Salad Buah Segar",
    cat: "food",
    stat: "Pulihkan +40 HP & +20 Mana",
    req: {
      "fruit.apple": 2,
      "fruit.banana": 2,
      "fruit.strawberry": 1
    }
  },
  mana_potion: {
    name: "Ramuan Mana Murni",
    cat: "drink",
    stat: "Pulihkan +30 Mana",
    req: {
      "drink.water": 1,
      "nature.spice": 2
    }
  }
};

function getNestedValue(obj, dotKey) {
  const [cat, item] = dotKey.split(".");
  return obj?.[cat]?.[item] || 0;
}

function deductNestedValue(obj, dotKey, qty) {
  const [cat, item] = dotKey.split(".");
  if (obj?.[cat]) {
    obj[cat][item] = Math.max(0, (obj[cat][item] || 0) - qty);
  }
}
export default {
  name: "craft",
  aliases: ["forge", "masak", "cooking", "nempa", "blacksmith"],
  description: "Menempa senjata, zirah, alat, dan memasak makanan via Menu List CTA",
  category: "RPG",
  register: true,
  execute: async (sock, ctx, msg) => {
    try {
      db.ensureUser(ctx.sender, ctx.pushname);
      const user = global.db.user[ctx.sender];
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • Blacksmith & Workshop`;
      const bannerImage = global.bot?.media?.banner1 || "https://files.catbox.moe/g2e6i5.jpg";
      const targetItem = (ctx.args[0] || "").toLowerCase();
      const userName = ctx.pushname || ctx.sender.split("@")[0];
      if (targetItem && RECIPES[targetItem]) {
        const recipe = RECIPES[targetItem];
        for (const [matKey, qty] of Object.entries(recipe.req)) {
          const owned = getNestedValue(user.inventory, matKey);
          if (owned < qty) {
            const matName = matKey.split(".")[1];
            const failText = `–  *C R A F T I N G*

Bahan material tidak mencukupi untuk membuat *${recipe.name}*.

┌  ◦  *Required* : ${qty}x ${matName}
└  ◦  *Owned* : ${owned}x ${matName}`;
            return ctx.reply(failText);
          }
        }
        for (const [matKey, qty] of Object.entries(recipe.req)) {
          deductNestedValue(user.inventory, matKey, qty);
        }
        user.inventory = user.inventory || {};
        user.inventory[recipe.cat] = user.inventory[recipe.cat] || {};
        user.inventory[recipe.cat][targetItem] = (user.inventory[recipe.cat][targetItem] || 0) + 1;
        user.exp = (user.exp || 0) + 35;
        db.write(global.db);
        await ctx.react("🔨");
        const successText = `Hi ${userName}!
Proses pembuatan item berhasil diselesaikan.

–  *C R A F T I N G*

┌  ◦  *Item* : ${recipe.name}
│  ◦  *Category* : ${recipe.cat.toUpperCase()}
│  ◦  *Effect* : ${recipe.stat}
└  ◦  *Reward* : +35 EXP

Ketik *${prefix}equip ${targetItem}* untuk memasang perlengkapan atau gunakan tombol di bawah.`;
        const buttons = [];
        if (recipe.cat === "weapon" || recipe.cat === "armor") {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: `🗡️ Pasang (${targetItem})`,
              id: `${prefix}equip ${targetItem}`
            })
          });
        }
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🎒 Buka Inventory",
            id: `${prefix}inv`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "⚔️ Masuk Dungeon",
            id: `${prefix}adv`
          })
        });
        const options = {
          image: bannerImage,
          title: `✦ Workshop • Craft Success ✦`,
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 2,
              divider_indices: [1],
              list_title: `${botName} • Workshop`,
              button_title: "Lihat Opsi"
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
      }
      const rows = Object.entries(RECIPES).map(([key, val]) => {
        const matList = Object.entries(val.req).map(([m, q]) => `${q}x ${m.split(".")[1]}`).join(", ");
        return {
          title: `🔨 ${val.name}`.slice(0, 24),
          description: `Bahan: ${matList}`,
          id: `${prefix}craft ${key}`
        };
      });
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: "🔨 KATALOG RESEP CRAFTING",
          sections: [{
            title: `${botName} • Blacksmith & Kitchen`,
            rows: rows
          }]
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🎒 Buka Inventory",
          id: `${prefix}inv`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "⚔️ Masuk Dungeon",
          id: `${prefix}adv`
        })
      }];
      const bodyText = `Hi ${userName}!
Tempa senjata, zirah, alat tambang, serta buat makanan pemulih dari hasil petualanganmu.

–  *W O R K S H O P*

┌  ◦  *Weapon* : Pedang Batu, Besi, Berlian, Cahaya
│  ◦  *Armor* : Zirah Kulit, Besi, Kristal
│  ◦  *Tools* : Beliung Besi, Beliung Berlian, Joran Kayu
└  ◦  *Consumable* : Ikan Bakar, Salad Buah, Ramuan Mana

Pilih salah satu resep melalui menu di bawah untuk langsung membuatnya.`;
      const options = {
        image: bannerImage,
        title: `✦ ${botName} • Workshop ✦`,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `${botName} • Crafting Menu`,
            button_title: "Pilih Resep"
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
      console.error("[CRAFT ERROR]", err);
      ctx.reply(`❌ Terjadi kesalahan: ${err.message}`);
    }
  }
};