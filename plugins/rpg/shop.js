import db from "../../data/db.js";
const SHOP_ITEMS = {
  bait: {
    name: "Umpan Cacing",
    category: "nature",
    emoji: "🪱",
    price: 200,
    sell: 50
  },
  water: {
    name: "Air Mineral",
    category: "drink",
    emoji: "💧",
    price: 100,
    sell: 30
  },
  juice: {
    name: "Jus Buah Segar",
    category: "drink",
    emoji: "🧃",
    price: 500,
    sell: 150
  },
  herbal_tea: {
    name: "Teh Herbal",
    category: "drink",
    emoji: "🍵",
    price: 800,
    sell: 250
  },
  mana_potion: {
    name: "Mana Potion",
    category: "drink",
    emoji: "🔵",
    price: 2e3,
    sell: 600
  },
  elixir: {
    name: "Elixir Suci",
    category: "drink",
    emoji: "✨",
    price: 5e3,
    sell: 1500
  },
  bread: {
    name: "Roti Gandum",
    category: "food",
    emoji: "🍞",
    price: 300,
    sell: 80
  },
  rice: {
    name: "Nasi Putih",
    category: "food",
    emoji: "🍚",
    price: 400,
    sell: 100
  },
  pickaxe_iron: {
    name: "Pickaxe Besi",
    category: "tools",
    emoji: "⛏️",
    price: 5e3,
    sell: 1500
  },
  pickaxe_diamond: {
    name: "Pickaxe Berlian",
    category: "tools",
    emoji: "💎",
    price: 2e4,
    sell: 6e3
  },
  rod_wood: {
    name: "Joran Kayu",
    category: "tools",
    emoji: "🎣",
    price: 3e3,
    sell: 900
  },
  rod_premium: {
    name: "Joran Premium",
    category: "tools",
    emoji: "🌟",
    price: 15e3,
    sell: 4500
  },
  sword_stone: {
    name: "Pedang Batu",
    category: "weapon",
    emoji: "🗡️",
    price: 3e3,
    sell: 800
  },
  sword_iron: {
    name: "Pedang Besi",
    category: "weapon",
    emoji: "⚔️",
    price: 8e3,
    sell: 2400
  },
  sword_diamond: {
    name: "Pedang Berlian",
    category: "weapon",
    emoji: "💠",
    price: 25e3,
    sell: 7500
  },
  sword_light: {
    name: "Pedang Cahaya",
    category: "weapon",
    emoji: "☀️",
    price: 6e4,
    sell: 18e3
  },
  sword_dark: {
    name: "Pedang Kegelapan",
    category: "weapon",
    emoji: "🌑",
    price: 8e4,
    sell: 24e3
  },
  armor_leather: {
    name: "Armor Kulit",
    category: "armor",
    emoji: "🟤",
    price: 4e3,
    sell: 1200
  },
  armor_iron: {
    name: "Armor Besi",
    category: "armor",
    emoji: "🔩",
    price: 12e3,
    sell: 3600
  },
  armor_crystal: {
    name: "Armor Kristal",
    category: "armor",
    emoji: "💎",
    price: 35e3,
    sell: 10500
  }
};
export default {
  name: "shop",
  aliases: ["toko", "store", "beli", "buy", "jual", "sell", "pasar"],
  description: "Toko dan pasar jual-beli item RPG lengkap via Menu List CTA",
  category: "RPG",
  register: true,
  execute: async (sock, ctx, msg) => {
    try {
      db.ensureUser(ctx.sender, ctx.pushname);
      const user = global.db.user[ctx.sender];
      const prefix = ctx.prefix || ".";
      const cmd = (ctx.cmd || "").toLowerCase();
      const args = ctx.args || [];
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • RPG Marketplace`;
      const bannerImage = global.bot?.media?.banner1 || "https://files.catbox.moe/g2e6i5.jpg";
      const userName = ctx.pushname || ctx.sender.split("@")[0];
      const senderNum = ctx.sender.split("@")[0];
      if (cmd === "jual" || cmd === "sell" || args[0]?.toLowerCase() === "jual") {
        const itemKey = (cmd === "jual" || cmd === "sell" ? args[0] : args[1])?.toLowerCase();
        const qty = parseInt(cmd === "jual" || cmd === "sell" ? args[1] : args[2]) || 1;
        if (!itemKey || !SHOP_ITEMS[itemKey]) {
          const invalidSellText = `–  *S H O P  S E L L*

Format penjualan tidak valid atau item tidak ditemukan.

┌  ◦  *Format* : ${prefix}jual <nama_item> <jumlah>
└  ◦  *Example* : ${prefix}jual bait 10

Cek katalog barang yang tersedia di *${prefix}shop*.`;
          return ctx.reply(invalidSellText);
        }
        const item = SHOP_ITEMS[itemKey];
        const inv = user.inventory?.[item.category];
        if (!inv || (inv[itemKey] || 0) < qty) {
          const notEnoughText = `–  *S H O P  S E L L*

Jumlah item di dalam tas tidak mencukupi.

┌  ◦  *Item* : ${item.name}
│  ◦  *Required* : ${qty} buah
└  ◦  *Owned* : ${inv?.[itemKey] || 0} buah`;
          return ctx.reply(notEnoughText);
        }
        inv[itemKey] -= qty;
        const totalSell = item.sell * qty;
        user.money += totalSell;
        db.write(global.db);
        await ctx.react("💰");
        const sellText = `Hi ${userName}!
Penjualan barang berhasil diproses.

–  *S H O P  S E L L*

┌  ◦  *Item* : ${item.name} (x${qty})
│  ◦  *Income* : +Rp ${totalSell.toLocaleString("id-ID")}
└  ◦  *Balance* : Rp ${user.money.toLocaleString("id-ID")}

Gunakan tombol di bawah untuk kembali ke toko atau mengecek tas.`;
        const buttons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🏪 Ke Toko",
            id: `${prefix}shop`
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
          title: `✦ Shop • Sell Success ✦`,
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 2,
              divider_indices: [1],
              list_title: `${botName} • Shop Sell`,
              button_title: "Opsi Cepat"
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
          return await ctx.sendCta(sellText, botFooter, buttons, options);
        }
        return await sock.sendMessage(ctx.id, {
          image: {
            url: bannerImage
          },
          caption: sellText
        }, {
          quoted: msg
        });
      }
      if (cmd === "beli" || cmd === "buy" || args[0]?.toLowerCase() === "beli") {
        const itemKey = (cmd === "beli" || cmd === "buy" ? args[0] : args[1])?.toLowerCase();
        const qty = parseInt(cmd === "beli" || cmd === "buy" ? args[1] : args[2]) || 1;
        if (!itemKey || !SHOP_ITEMS[itemKey]) {
          const invalidBuyText = `–  *S H O P  B U Y*

Format pembelian tidak valid atau item tidak ditemukan.

┌  ◦  *Format* : ${prefix}beli <nama_item> <jumlah>
└  ◦  *Example* : ${prefix}beli bait 5

Cek katalog barang yang tersedia di *${prefix}shop*.`;
          return ctx.reply(invalidBuyText);
        }
        const item = SHOP_ITEMS[itemKey];
        const totalPrice = item.price * qty;
        if (user.money < totalPrice) {
          const noMoneyText = `–  *S H O P  B U Y*

Saldo uang tidak mencukupi untuk melakukan pembelian.

┌  ◦  *Item* : ${item.name} (x${qty})
│  ◦  *Total Price* : Rp ${totalPrice.toLocaleString("id-ID")}
└  ◦  *Your Balance* : Rp ${user.money.toLocaleString("id-ID")}`;
          return ctx.reply(noMoneyText);
        }
        user.money -= totalPrice;
        user.inventory = user.inventory || {};
        user.inventory[item.category] = user.inventory[item.category] || {};
        user.inventory[item.category][itemKey] = (user.inventory[item.category][itemKey] || 0) + qty;
        db.write(global.db);
        await ctx.react("🛒");
        const successText = `Hi ${userName}!
Pembelian barang berhasil diselesaikan.

–  *S H O P  B U Y*

┌  ◦  *Item* : ${item.name} (x${qty})
│  ◦  *Total Paid* : -Rp ${totalPrice.toLocaleString("id-ID")}
└  ◦  *Balance* : Rp ${user.money.toLocaleString("id-ID")}

Barang yang dibeli telah dimasukkan ke dalam tas inventaris.`;
        const buttons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🎒 Cek Inventory",
            id: `${prefix}inv`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🏪 Toko Lainnya",
            id: `${prefix}shop`
          })
        }];
        const options = {
          image: bannerImage,
          title: `✦ Shop • Buy Success ✦`,
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 2,
              divider_indices: [1],
              list_title: `${botName} • Shop Buy`,
              button_title: "Opsi Cepat"
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
          caption: successText
        }, {
          quoted: msg
        });
      }
      const grouped = {};
      for (const [key, val] of Object.entries(SHOP_ITEMS)) {
        if (!grouped[val.category]) grouped[val.category] = [];
        grouped[val.category].push({
          key: key,
          ...val
        });
      }
      const catLabels = {
        nature: "🌿 ALAM & UMPAN",
        drink: "🧃 MINUMAN & POTION",
        food: "🍱 MAKANAN",
        tools: "🔧 ALAT & PERKAKAS",
        weapon: "⚔️ SENJATA TEMPUR",
        armor: "🛡️ BAJU ZIRAH & ARMOR"
      };
      const sections = Object.entries(grouped).map(([cat, items]) => ({
        title: catLabels[cat] || cat.toUpperCase(),
        rows: items.map(item => ({
          title: `${item.emoji} ${item.name}`.slice(0, 24),
          description: `Beli: Rp ${item.price.toLocaleString("id-ID")} | Jual: Rp ${item.sell.toLocaleString("id-ID")}`,
          id: `${prefix}beli ${item.key} 1`
        }))
      }));
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: "🛒 BUKA KATALOG BELANJA",
          sections: sections
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
      const bodyText = `Hi ${userName}!
Selamat datang di pasar & toko perlengkapan petualang.

–  *M A R K E T P L A C E*

┌  ◦  *Player* : @${senderNum}
│  ◦  *Balance* : Rp ${user.money.toLocaleString("id-ID")}
└  ◦  *Catalog* : ${Object.keys(SHOP_ITEMS).length} Barang Tersedia

–  *C O M M A N D S*

┌  ◦  *Beli Banyak* : ${prefix}beli <nama_item> <jumlah>
└  ◦  *Jual Barang* : ${prefix}jual <nama_item> <jumlah>

Pilih barang pada menu di bawah untuk pembelian langsung (1x).`;
      const options = {
        image: bannerImage,
        title: `✦ ${botName} • Marketplace ✦`,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `${botName} • Shop Catalog`,
            button_title: "Buka Katalog Belanja"
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
      console.error("[SHOP ERROR]", err);
      ctx.reply(`❌ Terjadi kesalahan pada toko: ${err.message}`);
    }
  }
};