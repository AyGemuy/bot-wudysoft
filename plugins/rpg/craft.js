import axios from "axios";
import db from "../../data/db.js";
const RECIPES = {
  sword_stone: {
    name: "Stone Sword",
    cat: "weapon",
    icon: "🗡️",
    stat: "+8 ATK Tempur",
    desc: "Pedang batu tajam untuk petualang pemula.",
    req: {
      "ores.stone": 8,
      "material.wood": 2
    }
  },
  sword_iron: {
    name: "Iron Sword",
    cat: "weapon",
    icon: "⚔️",
    stat: "+18 ATK Tempur",
    desc: "Pedang besi tempaan standar prajurit kerajaan.",
    req: {
      "ores.iron": 5,
      "ores.coal": 2,
      "material.wood": 2
    }
  },
  sword_diamond: {
    name: "Diamond Sword",
    cat: "weapon",
    icon: "💎⚔️",
    stat: "+35 ATK Tempur",
    desc: "Pedang berlian murni berkekuatan tebas tinggi.",
    req: {
      "ores.diamond": 3,
      "ores.gold": 2,
      "material.wood": 3
    }
  },
  sword_light: {
    name: "Holy Light Blade",
    cat: "weapon",
    icon: "✨🗡️",
    stat: "+60 ATK Tempur",
    desc: "Bilah pedang suci yang memancarkan aura cahaya.",
    req: {
      "ores.platinum": 2,
      "ores.diamond": 5,
      "ores.gold": 5
    }
  },
  armor_leather: {
    name: "Leather Armor",
    cat: "armor",
    icon: "🥋",
    stat: "+6 DEF Tempur",
    desc: "Baju pelindung dari kulit binatang buruan.",
    req: {
      "material.leather": 5,
      "material.wood": 2
    }
  },
  armor_iron: {
    name: "Iron Plate Armor",
    cat: "armor",
    icon: "🛡️",
    stat: "+15 DEF Tempur",
    desc: "Baju zirah pelat besi pelindung hantaman keras.",
    req: {
      "ores.iron": 8,
      "material.leather": 3
    }
  },
  armor_crystal: {
    name: "Crystal Aegis",
    cat: "armor",
    icon: "🔮🛡️",
    stat: "+32 DEF Tempur",
    desc: "Zirah kristal purba dengan pertahanan magis kokoh.",
    req: {
      "ores.diamond": 5,
      "ores.platinum": 2
    }
  },
  pickaxe_iron: {
    name: "Iron Pickaxe",
    cat: "tools",
    icon: "⛏️",
    stat: "+50% Hasil Tambang",
    desc: "Beliung besi pembuka urat mineral gua dalam.",
    req: {
      "ores.iron": 4,
      "material.wood": 3
    }
  },
  pickaxe_diamond: {
    name: "Diamond Pickaxe",
    cat: "tools",
    icon: "💎⛏️",
    stat: "+120% Hasil Tambang",
    desc: "Beliung berlian pemecah batuan terkeras.",
    req: {
      "ores.diamond": 3,
      "ores.gold": 1,
      "material.wood": 3
    }
  },
  rod_wood: {
    name: "Wood Fishing Rod",
    cat: "tools",
    icon: "🎣",
    stat: "+40% Hasil Pancing",
    desc: "Joran kayu lentur penarik ikan sungai.",
    req: {
      "material.wood": 5,
      "material.leather": 1
    }
  },
  rod_premium: {
    name: "Titanium Fishing Rod",
    cat: "tools",
    icon: "🎣✨",
    stat: "+100% Hasil Pancing",
    desc: "Joran laut dalam penakluk monster samudra.",
    req: {
      "ores.platinum": 2,
      "ores.iron": 6,
      "material.wood": 4
    }
  }
};

function getNestedValue(obj, dotKey) {
  const [cat, item] = dotKey.split(".");
  if (cat === "material") {
    return (obj?.material?.[item] || 0) + (obj?.nature?.[item] || 0);
  }
  return obj?.[cat]?.[item] || 0;
}

function deductNestedValue(obj, dotKey, qty) {
  const [cat, item] = dotKey.split(".");
  let remaining = qty;
  if (cat === "material") {
    if (obj.material && obj.material[item]) {
      const take = Math.min(remaining, obj.material[item]);
      obj.material[item] -= take;
      remaining -= take;
    }
    if (remaining > 0 && obj.nature && obj.nature[item]) {
      const take = Math.min(remaining, obj.nature[item]);
      obj.nature[item] -= take;
      remaining -= take;
    }
    return;
  }
  if (obj?.[cat]) {
    obj[cat][item] = Math.max(0, (obj[cat][item] || 0) - remaining);
  }
}

function generateCraftHTML(data) {
  const {
    playerName,
    recipe,
    isSuccess,
    inventory
  } = data;
  let reqListHTML = "";
  for (const [key, needed] of Object.entries(recipe.req)) {
    const owned = getNestedValue(inventory, key);
    const itemName = key.split(".")[1].toUpperCase();
    const isEnough = owned >= needed;
    reqListHTML += `
      <div class="req-item ${isEnough ? "enough" : "lacking"}">
        <span>📦 ${itemName}</span>
        <span>${owned} / ${needed}</span>
      </div>
    `;
  }
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 960px;
      height: 540px;
      background: #0d0704;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: #fff;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .workshop-frame {
      width: 960px;
      height: 540px;
      background: radial-gradient(circle at 50% 20%, #3d1c0e 0%, #170904 65%, #080301 100%);
      border: 8px solid #2b1307;
      outline: 2px solid #ff7b25;
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
      border-bottom: 2px solid rgba(255, 123, 37, 0.4);
      padding-bottom: 12px;
    }
    .title {
      font-size: 24px;
      font-weight: 900;
      color: #ff9d42;
      letter-spacing: 2px;
      text-transform: uppercase;
      text-shadow: 0 0 12px rgba(255, 123, 37, 0.6);
    }
    .cat-badge {
      background: rgba(0,0,0,0.7);
      border: 1.5px solid #ff7b25;
      color: #ffd08a;
      padding: 5px 18px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 800;
      text-transform: uppercase;
    }

    .main-grid {
      display: grid;
      grid-template-columns: 360px 1fr;
      gap: 26px;
      align-items: center;
      margin: 10px 0;
    }

    /* Left Blueprint Card */
    .blueprint-card {
      background: rgba(26, 12, 6, 0.9);
      border: 2px solid rgba(255, 123, 37, 0.45);
      border-radius: 18px;
      padding: 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.8);
      position: relative;
    }
    .item-icon { font-size: 64px; filter: drop-shadow(0 0 16px rgba(255, 123, 37, 0.6)); }
    .item-name { font-size: 20px; font-weight: 900; color: #fffaf0; text-align: center; }
    .stat-badge {
      background: linear-gradient(135deg, #dd6b20, #ff8c00);
      color: #fff;
      font-size: 12px;
      font-weight: 900;
      padding: 4px 16px;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(221, 107, 32, 0.5);
    }
    .item-desc { font-size: 11px; color: #cbd5e0; text-align: center; line-height: 1.5; padding: 0 10px; }

    /* Right Requirements Panel */
    .req-panel {
      background: rgba(22, 10, 5, 0.85);
      border: 1.5px solid rgba(255, 123, 37, 0.35);
      border-radius: 16px;
      padding: 22px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .req-header { font-size: 13px; font-weight: 800; color: #ff9d42; letter-spacing: 1.2px; text-transform: uppercase; }
    .req-grid { display: grid; grid-template-columns: 1fr; gap: 8px; }
    .req-item {
      background: rgba(0,0,0,0.55);
      border: 1px solid;
      border-radius: 8px;
      padding: 10px 14px;
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      font-weight: 800;
    }
    .req-item.enough { border-color: #48bb78; color: #c6f6d5; }
    .req-item.lacking { border-color: #f56565; color: #fed7d7; }

    .bottom-bar {
      background: rgba(0,0,0,0.7);
      border: 1px solid rgba(255, 123, 37, 0.35);
      border-radius: 12px;
      padding: 10px 18px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 13px;
    }
    .status-stamp { font-weight: 900; color: ${isSuccess ? "#48bb78" : "#ecc94b"}; letter-spacing: 1px; }
  </style>
</head>
<body>
  <div class="workshop-frame">
    <div class="top-header">
      <div class="title">🔨 ROYAL BLACKSMITH WORKSHOP 🔨</div>
      <div class="cat-badge">${recipe.cat}</div>
    </div>

    <div class="main-grid">
      <!-- Item Blueprint Card -->
      <div class="blueprint-card">
        <div class="item-icon">${recipe.icon}</div>
        <div class="item-name">${recipe.name}</div>
        <div class="stat-badge">${recipe.stat}</div>
        <div class="item-desc">${recipe.desc}</div>
      </div>

      <!-- Materials Check -->
      <div class="req-panel">
        <div class="req-header">BAHAN TEMPAAN DIBUTUHKAN</div>
        <div class="req-grid">
          ${reqListHTML}
        </div>
        <div style="font-size: 11px; color: #a0aec0; margin-top: 6px;">
          Mineral diperoleh dari <b>.mine / .cavern</b>. Kayu dan Kulit dari <b>.hunt</b>.
        </div>
      </div>
    </div>

    <div class="bottom-bar">
      <span>Pandai Besi: <b>${playerName}</b></span>
      <span class="status-stamp">${isSuccess ? "🎉 ITEM BERHASIL DITEMPA!" : "LANDASAN SIAP DITEMPA"}</span>
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
async function handleCraftAction(sock, ctx, msg, sender, rawText) {
  db.ensureUser(sender, ctx?.pushName);
  const user = global.db.user[sender];
  const parts = rawText.split(/\s+/);
  const targetItem = (parts[1] || "").toLowerCase();
  const prefix = ctx.prefix || ".";
  const userName = ctx.pushName || sender.split("@")[0];
  if (!RECIPES[targetItem]) return;
  const recipe = RECIPES[targetItem];
  for (const [matKey, qty] of Object.entries(recipe.req)) {
    const owned = getNestedValue(user.inventory || {}, matKey);
    if (owned < qty) {
      const matName = matKey.split(".")[1].toUpperCase();
      return ctx.reply(`❌ Bahan tidak cukup untuk membuat *${recipe.name}*!\nButuh: *${qty}x ${matName}* (Milikmu: ${owned}).`);
    }
  }
  for (const [matKey, qty] of Object.entries(recipe.req)) {
    deductNestedValue(user.inventory, matKey, qty);
  }
  user.inventory = user.inventory || {};
  user.inventory[recipe.cat] = user.inventory[recipe.cat] || {};
  user.inventory[recipe.cat][targetItem] = (user.inventory[recipe.cat][targetItem] || 0) + 1;
  user.exp = (user.exp || 0) + 40;
  db.write(global.db);
  await ctx.react("🔨");
  const html = generateCraftHTML({
    playerName: userName,
    recipe: recipe,
    isSuccess: true,
    inventory: user.inventory
  });
  const {
    buffer
  } = await renderHtmlToImage(html);
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
      display_text: "🔥 Tempa Refine (.forge)",
      id: `${prefix}forge select ${targetItem}`
    })
  }, {
    name: "quick_reply",
    buttonParamsJson: JSON.stringify({
      display_text: "🎒 Buka Inventory",
      id: `${prefix}inv`
    })
  });
  const successText = `Hi ${userName}!\nProses pembuatan item berhasil diselesaikan.\n\n` + `–  *C R A F T I N G  S U C C E S S*\n\n` + `┌  ◦  *Item* : ${recipe.name}\n` + `│  ◦  *Kategori* : ${recipe.cat.toUpperCase()}\n` + `│  ◦  *Statistik* : ${recipe.stat}\n` + `└  ◦  *Hadiah* : +40 EXP\n\n` + `Perlengkapan telah masuk ke tas (*${prefix}inv*) dan siap dipasang atau ditempa!`;
  const options = {
    image: buffer,
    params: {
      bottom_sheet: {
        in_thread_buttons_limit: 2,
        list_title: "Crafting Actions",
        button_title: "Aksi Selanjutnya"
      }
    },
    contextInfo: {
      mentionedJid: [sender]
    }
  };
  if (typeof ctx.sendCta === "function") return await ctx.sendCta(successText, "Wudysoft • Workshop", buttons, options);
  return await sock.sendMessage(ctx.id, {
    image: buffer,
    caption: successText,
    mentions: [sender]
  }, {
    quoted: msg
  });
}
export default {
  name: "craft",
  aliases: ["forgeitem", "nempa", "workshop", "bikin"],
  description: "Menempa senjata, zirah pelindung, beliung tambang, dan joran pancing dengan Dynamic HTML Canvas",
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
      if (/^[.#/!]?craft\s+[a-zA-Z0-9_]+/i.test(text)) {
        return await handleCraftAction(sock, ctx, msg, sender, text);
      }
    } catch (e) {
      console.error("[CRAFT BEFORE ERROR]:", e);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      db.ensureUser(ctx.sender, ctx.pushname);
      const user = global.db.user[ctx.sender];
      const prefix = ctx.prefix || ".";
      const targetItem = (ctx.args[0] || "").toLowerCase();
      const userName = ctx.pushname || ctx.sender.split("@")[0];
      if (targetItem && RECIPES[targetItem]) {
        return await handleCraftAction(sock, ctx, msg, ctx.sender, `${prefix}craft ${targetItem}`);
      }
      const featuredRecipe = RECIPES.sword_iron;
      const html = generateCraftHTML({
        playerName: userName,
        recipe: featuredRecipe,
        isSuccess: false,
        inventory: user.inventory || {}
      });
      const {
        buffer
      } = await renderHtmlToImage(html);
      const rows = Object.entries(RECIPES).map(([key, val]) => {
        const matList = Object.entries(val.req).map(([m, q]) => `${q}x ${m.split(".")[1]}`).join(", ");
        return {
          title: `${val.icon} ${val.name}`.slice(0, 24),
          description: `Bahan: ${matList}`,
          id: `${prefix}craft ${key}`
        };
      });
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: "🔨 KATALOG RESEP TEMPAAN",
          sections: [{
            title: "Pilih Perlengkapan Untuk Ditempa",
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
          display_text: "⛏️ Tambang Mineral",
          id: `${prefix}mine`
        })
      }];
      const bodyText = `Hi ${userName}!\nSelamat datang di Bengkel Pandai Besi & Perlengkapan Tempur Kerajaan.\n\n` + `–  *W O R K S H O P  M E N U*\n\n` + `┌  ◦  *Weapons* : Stone, Iron, Diamond, Holy Light Blade\n` + `│  ◦  *Armors* : Leather, Iron Plate, Crystal Aegis\n` + `└  ◦  *Tools* : Iron/Diamond Pickaxe, Titanium Fishing Rod\n\n` + `Buka menu dropdown di bawah untuk memilih resep yang ingin kamu buat:`;
      const options = {
        image: buffer,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: "Workshop Catalog",
            button_title: "Pilih Resep Tempaan"
          }
        },
        mentions: [ctx.sender],
        contextInfo: {
          mentionedJid: [ctx.sender]
        }
      };
      if (typeof ctx.sendCta === "function") return await ctx.sendCta(bodyText, "Wudysoft • Workshop", buttons, options);
      return await sock.sendMessage(ctx.id, {
        image: buffer,
        caption: bodyText,
        mentions: [ctx.sender]
      }, {
        quoted: msg
      });
    } catch (err) {
      console.error("[CRAFT ERROR]", err);
      ctx.reply(`❌ Terjadi kendala di workshop: ${err.message}`);
    }
  }
};