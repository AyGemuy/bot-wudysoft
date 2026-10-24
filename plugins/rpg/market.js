import axios from "axios";
import db from "../../data/db.js";
const COMMODITIES = {
  stone: {
    name: "Batu Alam",
    base: 150,
    cat: "ores",
    icon: "🪨"
  },
  coal: {
    name: "Batu Bara",
    base: 450,
    cat: "ores",
    icon: "⬛"
  },
  iron: {
    name: "Bijih Besi",
    base: 1200,
    cat: "ores",
    icon: "⛓️"
  },
  gold: {
    name: "Bijih Emas",
    base: 3500,
    cat: "ores",
    icon: "🪙"
  },
  diamond: {
    name: "Diamond",
    base: 15e3,
    cat: "ores",
    icon: "💎"
  },
  catfish: {
    name: "Ikan Lele",
    base: 800,
    cat: "fish",
    icon: "🐟"
  },
  salmon: {
    name: "Ikan Salmon",
    base: 2800,
    cat: "fish",
    icon: "🍣"
  }
};

function getDailyMarket() {
  if (!global.db.market || Date.now() - (global.db.market.lastUpdate || 0) > 864e5) {
    const prices = {};
    for (const [key, item] of Object.entries(COMMODITIES)) {
      const multiplier = .6 + Math.random() * 1.2;
      prices[key] = {
        price: Math.round(item.base * multiplier),
        trend: multiplier >= 1 ? "UP" : "DOWN",
        pct: Math.round(Math.abs(multiplier - 1) * 100)
      };
    }
    global.db.market = {
      prices: prices,
      lastUpdate: Date.now()
    };
    if (typeof db?.write === "function") db.write(global.db);
  }
  return global.db.market.prices;
}

function generateMarketHTML(prices, userInv) {
  let rowsHTML = "";
  for (const [key, item] of Object.entries(COMMODITIES)) {
    const market = prices[key];
    const owned = userInv?.[item.cat]?.[key] || 0;
    const isUp = market.trend === "UP";
    rowsHTML += `
      <div class="market-row">
        <div class="item-id">${item.icon} ${item.name}</div>
        <div class="item-owned">${owned} Pcs</div>
        <div class="item-price">Rp ${market.price.toLocaleString("id-ID")}</div>
        <div class="item-trend ${isUp ? "up" : "down"}">${isUp ? "▲ +" : "▼ -"}${market.pct}%</div>
      </div>
    `;
  }
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { width: 960px; height: 540px; background: #0b0f14; font-family: 'Segoe UI', sans-serif; color: #fff; display: flex; justify-content: center; align-items: center; }
    .canvas { width: 960px; height: 540px; background: radial-gradient(circle at 50% 10%, #152232 0%, #0c141d 70%, #060a0f 100%); border: 8px solid #1c2b3d; outline: 2px solid #00b4d8; padding: 24px 32px; display: flex; flex-direction: column; justify-content: space-between; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid rgba(0, 180, 216, 0.4); padding-bottom: 12px; }
    .title { font-size: 24px; font-weight: 900; color: #90e0ef; letter-spacing: 2px; }
    .table { display: flex; flex-direction: column; gap: 8px; margin: 12px 0; }
    .market-row { display: grid; grid-template-columns: 2fr 1.2fr 1.5fr 1fr; align-items: center; background: rgba(16, 27, 40, 0.85); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 10px 16px; font-size: 13px; font-weight: 700; }
    .item-price { color: #f6e27a; font-weight: 900; }
    .item-trend.up { color: #48bb78; }
    .item-trend.down { color: #f56565; }
    .footer { background: rgba(0,0,0,0.7); border: 1px solid rgba(0, 180, 216, 0.3); border-radius: 10px; padding: 8px 16px; font-size: 12px; display: flex; justify-content: space-between; }
  </style>
</head>
<body>
  <div class="canvas">
    <div class="header">
      <div class="title">📈 BURSA KOMODITAS PASAR BEBAS 📉</div>
      <div style="font-weight: 800; color: #90e0ef;">UPDATE REALTIME</div>
    </div>
    <div class="table">${rowsHTML}</div>
    <div class="footer">
      <span>Gunakan <b>.market sell <item> <jumlah></b> untuk melepas barang.</span>
      <span style="color: #48bb78; font-weight: 800;">HARGA BERUBAH TIAP 24 JAM</span>
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
export default {
  name: "market",
  aliases: ["bursa", "pasar", "saham"],
  description: "Pasar komoditas fluktuatif untuk menjual mineral dan ikan hasil panen",
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
      if (/^[.#/!]?market\s+(sell|jual)/i.test(text)) {
        const parts = text.split(/\s+/);
        const itemKey = (parts[2] || "").toLowerCase();
        const qty = parts[3]?.toLowerCase() === "all" ? "all" : parseInt(parts[3]) || 1;
        if (!COMMODITIES[itemKey]) {
          return ctx.reply(`❌ Komoditas *${itemKey}* tidak terdaftar di bursa.`);
        }
        db.ensureUser(sender, ctx.pushName);
        const user = global.db.user[sender];
        const prices = getDailyMarket();
        const itemInfo = COMMODITIES[itemKey];
        const owned = user.inventory?.[itemInfo.cat]?.[itemKey] || 0;
        const sellQty = qty === "all" ? owned : qty;
        if (sellQty <= 0 || owned < sellQty) {
          return ctx.reply(`❌ Kamu tidak memiliki *${sellQty}x ${itemInfo.name}* di tas (Milikmu: ${owned}).`);
        }
        const totalPrice = prices[itemKey].price * sellQty;
        user.inventory[itemInfo.cat][itemKey] -= sellQty;
        user.money = (Number(user.money) || 0) + totalPrice;
        db.write(global.db);
        return ctx.reply(`💰 *TRANSAKSI BURSA SELESAI!*\n\nBerhasil melepas *${sellQty}x ${itemInfo.name}* seharga *Rp ${totalPrice.toLocaleString("id-ID")}*!\nSaldo telah ditambahkan.`);
      }
    } catch (e) {
      console.error("[MARKET BEFORE ERROR]:", e);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      db.ensureUser(ctx.sender, ctx.pushname);
      const user = global.db.user[ctx.sender];
      const prefix = ctx.prefix || ".";
      const prices = getDailyMarket();
      const html = generateMarketHTML(prices, user.inventory || {});
      const {
        buffer
      } = await renderHtmlToImage(html);
      const buttons = [{
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🪙 Jual Semua Besi",
          id: `${prefix}market sell iron all`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🪙 Jual Semua Emas",
          id: `${prefix}market sell gold all`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🪙 Jual Semua Batu Bara",
          id: `${prefix}market sell coal all`
        })
      }];
      const text = `📈 *PAPAN BURSA KOMODITAS REALTIME* 📉\n\nJual hasil panen tambang dan pancinganmu saat tren pasar sedang *HIJAU/NAIK* untuk melipatgandakan keuntungan!`;
      const options = {
        image: buffer,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 2,
            list_title: "Market Actions",
            button_title: "Aksi Jual Cepat"
          }
        },
        contextInfo: {
          mentionedJid: [ctx.sender]
        }
      };
      if (typeof ctx.sendCta === "function") return await ctx.sendCta(text, "Wudysoft • Commodity Exchange", buttons, options);
      return await sock.sendMessage(ctx.id, {
        image: buffer,
        caption: text
      }, {
        quoted: msg
      });
    } catch (err) {
      ctx.reply(`❌ Error: ${err.message}`);
    }
  }
};