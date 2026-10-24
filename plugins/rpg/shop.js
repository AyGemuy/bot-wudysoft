import axios from "axios";
import db from "../../data/db.js";
const SHOP_ITEMS = {
  bait: {
    name: "Umpan Cacing",
    category: "nature",
    emoji: "🪱",
    price: 200,
    sell: 50,
    desc: "Umpan mancing & pakan pet."
  },
  water: {
    name: "Air Mineral",
    category: "drink",
    emoji: "💧",
    price: 100,
    sell: 30,
    desc: "Bahan masak & pemulih 15 HP."
  },
  juice: {
    name: "Jus Buah Segar",
    category: "drink",
    emoji: "🧃",
    price: 500,
    sell: 150,
    desc: "Pemulih 30 HP & 10 MP."
  },
  herbal_tea: {
    name: "Teh Herbal",
    category: "drink",
    emoji: "🍵",
    price: 800,
    sell: 250,
    desc: "Pemulih 50 HP & 25 MP."
  },
  mana_potion: {
    name: "Mana Potion",
    category: "drink",
    emoji: "🧪",
    price: 2e3,
    sell: 600,
    desc: "Pemulih instan 80 Mana."
  },
  elixir: {
    name: "Elixir Suci",
    category: "drink",
    emoji: "✨",
    price: 5e3,
    sell: 1500,
    desc: "Pemulih 200 HP & 100 MP."
  },
  bread: {
    name: "Roti Gandum",
    category: "food",
    emoji: "🍞",
    price: 300,
    sell: 80,
    desc: "Ransum darurat +20 HP."
  },
  rice: {
    name: "Nasi Putih",
    category: "food",
    emoji: "🍚",
    price: 400,
    sell: 100,
    desc: "Makanan pokok +40 HP."
  },
  pickaxe_iron: {
    name: "Iron Pickaxe",
    category: "tools",
    emoji: "⛏️",
    price: 5e3,
    sell: 1500,
    desc: "+50% Hasil Tambang di Gua."
  },
  pickaxe_diamond: {
    name: "Diamond Pickaxe",
    category: "tools",
    emoji: "💎⛏️",
    price: 2e4,
    sell: 6e3,
    desc: "+120% Hasil Tambang Langka."
  },
  rod_wood: {
    name: "Wood Fishing Rod",
    category: "tools",
    emoji: "🎣",
    price: 3e3,
    sell: 900,
    desc: "+40% Peluang Ikan Sungai."
  },
  rod_premium: {
    name: "Titanium Fishing Rod",
    category: "tools",
    emoji: "🎣✨",
    price: 15e3,
    sell: 4500,
    desc: "+100% Peluang Ikan Langka."
  },
  sword_stone: {
    name: "Stone Sword",
    category: "weapon",
    emoji: "🗡️",
    price: 3e3,
    sell: 800,
    desc: "+8 ATK Tempur Dasar."
  },
  sword_iron: {
    name: "Iron Sword",
    category: "weapon",
    emoji: "⚔️",
    price: 8e3,
    sell: 2400,
    desc: "+18 ATK Tempur Standar."
  },
  sword_diamond: {
    name: "Diamond Sword",
    category: "weapon",
    emoji: "💠",
    price: 25e3,
    sell: 7500,
    desc: "+35 ATK Tempur Tinggi."
  },
  sword_light: {
    name: "Holy Light Blade",
    category: "weapon",
    emoji: "☀️",
    price: 6e4,
    sell: 18e3,
    desc: "+60 ATK Cahaya Suci."
  },
  sword_dark: {
    name: "Dark Abyss Blade",
    category: "weapon",
    emoji: "🌑",
    price: 8e4,
    sell: 24e3,
    desc: "+85 ATK Daya Rusak Masif."
  },
  armor_leather: {
    name: "Leather Armor",
    category: "armor",
    emoji: "🟤",
    price: 4e3,
    sell: 1200,
    desc: "+6 DEF Pertahanan Ringan."
  },
  armor_iron: {
    name: "Iron Plate Armor",
    category: "armor",
    emoji: "🔩",
    price: 12e3,
    sell: 3600,
    desc: "+15 DEF Pelindung Baja."
  },
  armor_crystal: {
    name: "Crystal Aegis",
    category: "armor",
    emoji: "🔮🛡️",
    price: 35e3,
    sell: 10500,
    desc: "+32 DEF Pertahanan Magis."
  }
};

function generateShopHTML(data) {
  const {
    playerName,
    type,
    item,
    qty,
    totalPrice,
    balance,
    statusText
  } = data;
  const isBuy = type === "BUY";
  const isSell = type === "SELL";
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 960px;
      height: 540px;
      background: #0d0905;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: #fff;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .bazaar-frame {
      width: 960px;
      height: 540px;
      background: radial-gradient(circle at 50% 20%, #3a220d 0%, #170d04 65%, #070301 100%);
      border: 8px solid #2b1706;
      outline: 2px solid #ecc94b;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 24px 30px;
      box-shadow: inset 0 0 100px rgba(0,0,0,0.95);
      position: relative;
    }
    .top-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid rgba(236, 201, 75, 0.4);
      padding-bottom: 12px;
    }
    .title {
      font-size: 24px;
      font-weight: 900;
      color: #ecc94b;
      letter-spacing: 2px;
      text-transform: uppercase;
      text-shadow: 0 0 14px rgba(236, 201, 75, 0.6);
    }
    .wallet-badge {
      background: rgba(0,0,0,0.7);
      border: 1.5px solid #ecc94b;
      color: #fefcbf;
      padding: 5px 18px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 800;
    }

    .main-grid {
      display: grid;
      grid-template-columns: 360px 1fr;
      gap: 26px;
      align-items: center;
      margin: 10px 0;
    }

    /* Left Receipt Card */
    .receipt-card {
      background: rgba(26, 15, 6, 0.9);
      border: 2px solid rgba(236, 201, 75, 0.45);
      border-radius: 18px;
      padding: 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.8);
      position: relative;
    }
    .receipt-icon {
      font-size: 64px;
      filter: drop-shadow(0 0 18px rgba(236, 201, 75, 0.6));
      margin-bottom: -6px;
    }
    .receipt-title { font-size: 20px; font-weight: 900; color: #fffaf0; text-align: center; }
    .type-pill {
      background: ${isBuy ? "linear-gradient(135deg, #c53030, #e53e3e)" : isSell ? "linear-gradient(135deg, #2f855a, #48bb78)" : "#b7791f"};
      color: #fff;
      font-size: 11px;
      font-weight: 900;
      padding: 4px 16px;
      border-radius: 12px;
      letter-spacing: 1px;
      text-transform: uppercase;
    }

    .invoice-box {
      width: 100%;
      background: rgba(0,0,0,0.55);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px;
      padding: 10px 16px;
      display: flex;
      justify-content: space-between;
      margin-top: 4px;
    }
    .inv-col { display: flex; flex-direction: column; }
    .inv-lbl { font-size: 10px; color: #a0aec0; font-weight: 700; text-transform: uppercase; }
    .inv-val { font-size: 16px; font-weight: 900; color: #ecc94b; }

    /* Right Showcase Panel */
    .catalog-panel {
      background: rgba(22, 12, 4, 0.85);
      border: 1.5px solid rgba(236, 201, 75, 0.35);
      border-radius: 16px;
      padding: 22px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .panel-header { font-size: 13px; font-weight: 800; color: #ecc94b; letter-spacing: 1.2px; text-transform: uppercase; }
    .deals-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
    }
    .deal-card {
      background: rgba(0,0,0,0.55);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 10px;
      padding: 10px 12px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .deal-icon { font-size: 24px; }
    .deal-info { display: flex; flex-direction: column; }
    .deal-name { font-size: 12px; font-weight: 800; color: #f7fafc; }
    .deal-price { font-size: 11px; font-weight: 700; color: #ecc94b; }

    .bottom-bar {
      background: rgba(0,0,0,0.7);
      border: 1px solid rgba(236, 201, 75, 0.35);
      border-radius: 12px;
      padding: 10px 18px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 13px;
    }
  </style>
</head>
<body>
  <div class="bazaar-frame">
    <div class="top-header">
      <div class="title">🏪 ROYAL MERCHANT BAZAAR 🏪</div>
      <div class="wallet-badge">SALDO: Rp ${balance.toLocaleString("id-ID")}</div>
    </div>

    <div class="main-grid">
      <!-- Left Receipt Card -->
      <div class="receipt-card">
        <div class="receipt-icon">${item ? item.emoji : "⚖️"}</div>
        <div class="receipt-title">${item ? item.name : "Kios Saudagar Kerajaan"}</div>
        <div class="type-pill">${type}</div>

        <div class="invoice-box">
          <div class="inv-col">
            <span class="inv-lbl">JUMLAH TRANSAKSI</span>
            <span class="inv-val">${qty || 1} Pcs</span>
          </div>
          <div class="inv-col" style="text-align: right;">
            <span class="inv-lbl">TOTAL NOMINAL</span>
            <span class="inv-val" style="color: ${isBuy ? "#fc8181" : "#68d391"};">${isBuy ? "-Rp " : "+Rp "}${(totalPrice || 0).toLocaleString("id-ID")}</span>
          </div>
        </div>
      </div>

      <!-- Right Featured Highlights -->
      <div class="catalog-panel">
        <div class="panel-header">BARANG REKOMENDASI PETUALANG</div>
        <div class="deals-grid">
          <div class="deal-card"><span class="deal-icon">🪱</span><div class="deal-info"><span class="deal-name">Umpan Cacing</span><span class="deal-price">Rp 200</span></div></div>
          <div class="deal-card"><span class="deal-icon">🧪</span><div class="deal-info"><span class="deal-name">Mana Potion</span><span class="deal-price">Rp 2.000</span></div></div>
          <div class="deal-card"><span class="deal-icon">💎⛏️</span><div class="deal-info"><span class="deal-name">Diamond Pickaxe</span><span class="deal-price">Rp 20.000</span></div></div>
          <div class="deal-card"><span class="deal-icon">⚔️</span><div class="deal-info"><span class="deal-name">Iron Sword</span><span class="deal-price">Rp 8.000</span></div></div>
        </div>

        <div style="font-size: 11px; color: #a0aec0; margin-top: 4px;">
          Beli barang lewat menu dropdown di bawah atau ketik <b>.beli &lt;item&gt; &lt;jumlah&gt;</b>.
        </div>
      </div>
    </div>

    <div class="bottom-bar">
      <span>Pelanggan: <b>${playerName}</b></span>
      <span style="color: #ecc94b; font-weight: 800;">${statusText || "TRANSAKSI TUNAI AMAN & RESMI"}</span>
    </div>
  </div>
</body>
</html>`;
}
async function renderHtmlToImage(htmlContent) {
  const rawApi = global.bot?.api?.wudysoft || "";
  const cleanApi = rawApi.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  const baseUrl = `https://${cleanApi}/api/tools/html2img/`;
  const headers = {
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0"
  };
  const payload = {
    html: htmlContent,
    fullPage: true,
    quality: 100
  };
  const versions = ["v5", "v1", "v2", "v3", "v4", "v6", "v7", "v8", "v9", "v10"];
  for (const ver of versions) {
    try {
      const res = await axios.post(`${baseUrl}${ver}`, payload, {
        headers: headers,
        timeout: 15e3
      });
      const imgUrl = res.data?.url || res.data?.result || (typeof res.data === "string" ? res.data : null);
      if (imgUrl && /^https?:\/\//i.test(imgUrl)) {
        let buffer = null;
        try {
          const imgRes = await axios.get(imgUrl, {
            responseType: "arraybuffer",
            timeout: 12e3
          });
          if (imgRes.data) buffer = Buffer.from(imgRes.data);
        } catch {}
        return {
          url: imgUrl,
          buffer: buffer
        };
      }
    } catch {
      continue;
    }
  }
  return {
    url: null,
    buffer: null
  };
}
async function handleShopAction(sock, ctx, msg, sender, rawText) {
  db.ensureUser(sender, ctx?.pushName);
  const user = global.db.user[sender];
  const parts = rawText.split(/\s+/);
  const action = (parts[0] || "").toLowerCase().replace(/^[.#/!]/, "");
  const itemKey = (parts[1] || "").toLowerCase();
  const qty = parts[2]?.toLowerCase() === "all" ? "all" : Math.max(1, parseInt(parts[2]) || 1);
  const prefix = ctx.prefix || ".";
  const userName = ctx.pushName || sender.split("@")[0];
  if (action === "jual" || action === "sell") {
    if (!SHOP_ITEMS[itemKey]) return ctx.reply(`❌ Barang *${itemKey}* tidak dapat dijual ke toko.`);
    const item = SHOP_ITEMS[itemKey];
    const inv = user.inventory?.[item.category];
    const owned = inv?.[itemKey] || 0;
    const finalQty = qty === "all" ? owned : qty;
    if (finalQty <= 0 || owned < finalQty) {
      return ctx.reply(`❌ Persediaan di tas tidak mencukupi!\nBarang: *${item.name}*\nButuh: ${finalQty}x (Milikmu: ${owned}x).`);
    }
    inv[itemKey] -= finalQty;
    const totalSell = item.sell * finalQty;
    user.money = (Number(user.money) || 0) + totalSell;
    db.write(global.db);
    await ctx.react("💰");
    const html = generateShopHTML({
      playerName: userName,
      type: "SELL",
      item: item,
      qty: finalQty,
      totalPrice: totalSell,
      balance: user.money,
      statusText: "BARANG DITERIMA SAUDAGAR KERAJAAN"
    });
    const {
      buffer
    } = await renderHtmlToImage(html);
    const buttons = [{
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: "🏪 Belanja Lagi",
        id: `${prefix}shop`
      })
    }, {
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: "🎒 Buka Inventory",
        id: `${prefix}inv`
      })
    }];
    const sellText = `Hi ${userName}!\nPenjualan barang berhasil diproses ke kasir.\n\n` + `–  *S H O P  S E L L*\n\n` + `┌  ◦  *Barang Terjual* : ${item.name} (x${finalQty})\n` + `│  ◦  *Pemasukan* : +Rp ${totalSell.toLocaleString("id-ID")}\n` + `└  ◦  *Sisa Saldo Emas* : Rp ${user.money.toLocaleString("id-ID")}\n\n` + `Uang hasil penjualan telah dimasukkan ke pundi emasmu!`;
    const options = {
      image: buffer,
      params: {
        bottom_sheet: {
          in_thread_buttons_limit: 2,
          list_title: "Shop Actions",
          button_title: "Aksi Selanjutnya"
        }
      },
      contextInfo: {
        mentionedJid: [sender]
      }
    };
    if (typeof ctx.sendCta === "function") return await ctx.sendCta(sellText, "Wudysoft • Shop System", buttons, options);
    return await sock.sendMessage(ctx.id, {
      image: buffer,
      caption: sellText,
      mentions: [sender]
    }, {
      quoted: msg
    });
  }
  if (action === "beli" || action === "buy") {
    if (!SHOP_ITEMS[itemKey]) return ctx.reply(`❌ Barang *${itemKey}* tidak tersedia di katalog belanja.`);
    const item = SHOP_ITEMS[itemKey];
    const finalQty = typeof qty === "number" ? qty : 1;
    const totalPrice = item.price * finalQty;
    if ((user.money || 0) < totalPrice) {
      return ctx.reply(`❌ Saldo emas tidak mencukupi!\nBarang: *${item.name}* (x${finalQty})\nTotal Harga: Rp ${totalPrice.toLocaleString("id-ID")}\nSaldo Milikmu: Rp ${(user.money || 0).toLocaleString("id-ID")}.`);
    }
    user.money -= totalPrice;
    user.inventory = user.inventory || {};
    user.inventory[item.category] = user.inventory[item.category] || {};
    user.inventory[item.category][itemKey] = (user.inventory[item.category][itemKey] || 0) + finalQty;
    db.write(global.db);
    await ctx.react("🛒");
    const html = generateShopHTML({
      playerName: userName,
      type: "BUY",
      item: item,
      qty: finalQty,
      totalPrice: totalPrice,
      balance: user.money,
      statusText: "PEMBAYARAN DITERIMA & BARANG DIKIRIM"
    });
    const {
      buffer
    } = await renderHtmlToImage(html);
    const buttons = [{
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: "🎒 Cek Inventory",
        id: `${prefix}inv`
      })
    }, {
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: "🏪 Belanja Lagi",
        id: `${prefix}shop`
      })
    }];
    if (item.category === "weapon" || item.category === "armor") {
      buttons.unshift({
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: `🛡️ Pasang (${itemKey})`,
          id: `${prefix}equip ${itemKey}`
        })
      });
    }
    const buyText = `Hi ${userName}!\nPembelian barang berhasil diselesaikan.\n\n` + `–  *S H O P  B U Y*\n\n` + `┌  ◦  *Barang Dibeli* : ${item.name} (x${finalQty})\n` + `│  ◦  *Total Bayar* : -Rp ${totalPrice.toLocaleString("id-ID")}\n` + `└  ◦  *Sisa Saldo Emas* : Rp ${user.money.toLocaleString("id-ID")}\n\n` + `Barang pesanan telah dimasukkan ke tas inventaris (*${prefix}inv*)!`;
    const options = {
      image: buffer,
      params: {
        bottom_sheet: {
          in_thread_buttons_limit: 2,
          list_title: "Shop Actions",
          button_title: "Aksi Selanjutnya"
        }
      },
      contextInfo: {
        mentionedJid: [sender]
      }
    };
    if (typeof ctx.sendCta === "function") return await ctx.sendCta(buyText, "Wudysoft • Shop System", buttons, options);
    return await sock.sendMessage(ctx.id, {
      image: buffer,
      caption: buyText,
      mentions: [sender]
    }, {
      quoted: msg
    });
  }
}
export default {
  name: "shop",
  aliases: ["toko", "store", "beli", "buy", "jual", "sell"],
  description: "Pasar dan toko perlengkapan petualang lengkap dengan Dynamic HTML Canvas",
  category: "RPG",
  register: true,
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      const sender = ctx?.sender || msg?.key?.participant || msg?.key?.remoteJid;
      const text = (ctx?.text || ctx?.query || msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "").trim();
      if (/^[.#/!]?(beli|buy|jual|sell)\s+[a-zA-Z0-9_]+/i.test(text)) {
        return await handleShopAction(sock, ctx, msg, sender, text);
      }
    } catch (e) {
      console.error("[SHOP BEFORE ERROR]:", e);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      db.ensureUser(ctx.sender, ctx.pushname);
      const user = global.db.user[ctx.sender];
      const prefix = ctx.prefix || ".";
      const cmd = (ctx.cmd || "").toLowerCase();
      const args = ctx.args || [];
      const userName = ctx.pushname || ctx.sender.split("@")[0];
      if (cmd === "beli" || cmd === "buy" || cmd === "jual" || cmd === "sell") {
        return await handleShopAction(sock, ctx, msg, ctx.sender, `${prefix}${cmd} ${args.join(" ")}`);
      }
      const html = generateShopHTML({
        playerName: userName,
        type: "BROWSE",
        item: null,
        qty: 0,
        totalPrice: 0,
        balance: user.money || 0,
        statusText: "SAUDAGAR SIAP MELAYANI JUAL-BELI"
      });
      const {
        buffer
      } = await renderHtmlToImage(html);
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
        drink: "🧪 MINUMAN & POTION",
        food: "🍱 MAKANAN",
        tools: "🔧 PERKAKAS & ALAT",
        weapon: "⚔️ SENJATA TEMPUR",
        armor: "🛡️ BAJU ZIRAH"
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
          title: "🛒 BUKA KATALOG BELANJA TOKO",
          sections: sections
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
          display_text: "📈 Bursa Pasar (.market)",
          id: `${prefix}market`
        })
      }];
      const bodyText = `Hi ${userName}!\nSelamat datang di Kios Saudagar & Pasar Perlengkapan Kerajaan.\n\n` + `–  *M A R K E T P L A C E*\n\n` + `┌  ◦  *Player* : @${ctx.sender.split("@")[0]}\n` + `│  ◦  *Saldo Emas* : Rp ${(user.money || 0).toLocaleString("id-ID")}\n` + `└  ◦  *Katalog* : ${Object.keys(SHOP_ITEMS).length} Macam Barang Tersedia\n\n` + `–  *F O R M A T  P E R I N T A H*\n\n` + `┌  ◦  *Beli Barang* : ${prefix}beli <nama_item> <jumlah>\n` + `└  ◦  *Jual Barang* : ${prefix}jual <nama_item> <jumlah / all>\n\n` + `Pilih barang dari menu dropdown di bawah untuk membeli langsung 1 pcs:`;
      const options = {
        image: buffer,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: "Shop Catalog",
            button_title: "Katalog Belanja"
          }
        },
        mentions: [ctx.sender],
        contextInfo: {
          mentionedJid: [ctx.sender]
        }
      };
      if (typeof ctx.sendCta === "function") return await ctx.sendCta(bodyText, "Wudysoft • Shop System", buttons, options);
      return await sock.sendMessage(ctx.id, {
        image: buffer,
        caption: bodyText,
        mentions: [ctx.sender]
      }, {
        quoted: msg
      });
    } catch (err) {
      console.error("[SHOP ERROR]", err);
      ctx.reply(`❌ Terjadi kendala di toko: ${err.message}`);
    }
  }
};