import axios from "axios";
import db from "../../data/db.js";
const RECIPES = [{
  id: "roast_meat",
  name: "Steak Panggang Barbarian",
  icon: "🥩",
  desc: "Daging bakar lezat penambah kekuatan otot.",
  ingredients: {
    "material.meat": 2,
    "ores.coal": 1
  },
  buff: {
    type: "atk",
    val: 35,
    duration: 36e5,
    label: "+35 ATK Power (1 Jam)"
  }
}, {
  id: "grilled_fish",
  name: "Ikan Bakar Rempah Laut",
  icon: "🐟",
  desc: "Ikan bakar kaya vitamin yang mempercepat respon indra.",
  ingredients: {
    "fish.catfish": 2,
    "ores.coal": 1
  },
  buff: {
    type: "def",
    val: 25,
    duration: 36e5,
    label: "+25 DEF Shield (1 Jam)"
  }
}, {
  id: "tuna_sashimi",
  name: "Golden Tuna Sashimi",
  icon: "🍣",
  desc: "Irisan ikan tuna segar pelipatganda penyerapan energi.",
  ingredients: {
    "fish.tuna": 2,
    "drink.water": 1
  },
  buff: {
    type: "exp",
    val: 50,
    duration: 36e5,
    label: "+50% Bonus EXP (1 Jam)"
  }
}, {
  id: "dragon_broth",
  name: "Sup Kaldu Purba Abadi",
  icon: "🍲",
  desc: "Sup legendaris yang langsung memulihkan penuh HP & Mana.",
  ingredients: {
    "material.meat": 3,
    "fish.salmon": 2,
    "drink.water": 2,
    "ores.coal": 2
  },
  buff: {
    type: "regen",
    val: 100,
    duration: 0,
    label: "Full HP & Mana Restore (Instan)"
  }
}];

function generateKitchenHTML(data) {
  const {
    playerName,
    recipes,
    activeBuffs,
    inventory
  } = data;
  let recipesHTML = "";
  recipes.forEach((r, idx) => {
    let ingList = [];
    let isCanCook = true;
    for (const [key, need] of Object.entries(r.ingredients)) {
      const [cat, item] = key.split(".");
      const owned = inventory?.[cat]?.[item] || 0;
      if (owned < need) isCanCook = false;
      ingList.push(`<span style="color: ${owned >= need ? "#48bb78" : "#f56565"}">${item.toUpperCase()}: ${owned}/${need}</span>`);
    }
    recipesHTML += `
      <div class="dish-card ${isCanCook ? "cookable" : ""}">
        <div class="dish-badge">RESEP #${idx + 1}</div>
        <div class="dish-icon">${r.icon}</div>
        <div class="dish-name">${r.name}</div>
        <div class="dish-buff">✨ ${r.buff.label}</div>
        <div class="ing-box">${ingList.join(" • ")}</div>
      </div>
    `;
  });
  let activeBuffText = activeBuffs.length > 0 ? activeBuffs.map(b => `<span class="buff-chip">⚡ ${b.label} (${b.remain}m)</span>`).join(" ") : "<i>Tidak ada hidangan aktif yang sedang dicerna tubuh.</i>";
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 960px;
      height: 540px;
      background: #0d0703;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: #fff;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .kitchen-canvas {
      width: 960px;
      height: 540px;
      background: radial-gradient(circle at 50% 20%, #3a1c0d 0%, #1a0b04 65%, #080301 100%);
      border: 8px solid #2a1206;
      outline: 2px solid #dd6b20;
      position: relative;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 24px 30px;
      box-shadow: inset 0 0 100px rgba(0,0,0,0.95);
    }
    .top-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid rgba(221, 107, 32, 0.4);
      padding-bottom: 12px;
    }
    .header-title {
      font-size: 24px;
      font-weight: 900;
      color: #fbd38d;
      letter-spacing: 2px;
      text-transform: uppercase;
      text-shadow: 0 0 12px rgba(221, 107, 32, 0.6);
    }
    .chef-badge {
      background: rgba(0,0,0,0.7);
      border: 1.5px solid #dd6b20;
      color: #feebc8;
      padding: 5px 18px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 800;
    }

    .dishes-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
      margin: 10px 0;
    }
    .dish-card {
      background: rgba(26, 12, 5, 0.9);
      border: 1.5px solid rgba(221, 107, 32, 0.35);
      border-radius: 14px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      position: relative;
      box-shadow: 0 8px 20px rgba(0,0,0,0.7);
    }
    .dish-card.cookable {
      border-color: #48bb78;
      box-shadow: 0 0 15px rgba(72, 187, 120, 0.25);
    }
    .dish-badge {
      position: absolute;
      top: 12px;
      right: 14px;
      font-size: 10px;
      font-weight: 900;
      color: #dd6b20;
      letter-spacing: 1px;
    }
    .dish-icon { font-size: 32px; }
    .dish-name { font-size: 16px; font-weight: 900; color: #fffaf0; }
    .dish-buff { font-size: 12px; font-weight: 800; color: #ecc94b; }
    .ing-box {
      font-size: 11px;
      font-weight: 700;
      background: rgba(0,0,0,0.5);
      border-radius: 6px;
      padding: 6px 10px;
      margin-top: 4px;
    }

    .bottom-bar {
      background: rgba(0,0,0,0.7);
      border: 1px solid rgba(221, 107, 32, 0.35);
      border-radius: 12px;
      padding: 10px 18px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
    }
    .buff-chip {
      background: rgba(72, 187, 120, 0.2);
      border: 1px solid #48bb78;
      color: #9ae6b4;
      padding: 3px 10px;
      border-radius: 10px;
      font-weight: 800;
    }
  </style>
</head>
<body>
  <div class="kitchen-canvas">
    <div class="top-header">
      <div class="header-title">🍳 ROYAL TAVERN KITCHEN 🍳</div>
      <div class="chef-badge">CHEF: ${playerName}</div>
    </div>

    <!-- 4 Recipes Grid -->
    <div class="dishes-grid">
      ${recipesHTML}
    </div>

    <!-- Active Consumed Buffs Bar -->
    <div class="bottom-bar">
      <div><b>STATUS PENCERNAAN:</b> ${activeBuffText}</div>
      <div style="color: #dd6b20; font-weight: 800;">DAPUR SIAP MEMASAK</div>
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
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
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

function initDB(jid, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (jid && !global.db.user[jid]) db.ensureUser(jid, name);
}

function saveDB() {
  if (typeof db?.write === "function" && global.db) db.write(global.db);
}

function cleanExpiredBuffs(user) {
  if (!user.buffs) return;
  const now = Date.now();
  for (const [key, b] of Object.entries(user.buffs)) {
    if (b.expireTime && now > b.expireTime) {
      delete user.buffs[key];
    }
  }
  saveDB();
}
async function sendCookCTA(sock, ctx, targetId, {
  text,
  footer,
  buttons = [],
  imageBuffer = null,
  mentions = []
}) {
  const botName = global.bot?.name || "WudysoftBot";
  const finalFooter = footer || `${botName} • Tavern Kitchen`;
  const formattedButtons = buttons.map(b => {
    if (b.buttonParamsJson) return b;
    return {
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: b.display_text || b.text || "Pilih",
        id: b.id || b.command || ""
      })
    };
  });
  const destJid = targetId || ctx?.id;
  const options = {
    jid: destJid,
    to: destJid,
    image: imageBuffer || undefined,
    params: {
      bottom_sheet: {
        in_thread_buttons_limit: 2,
        divider_indices: [1],
        list_title: `${botName} • Menu Dapur`,
        button_title: "Aksi Masak"
      }
    },
    contextInfo: {
      forwardingScore: 999,
      isForwarded: true,
      mentionedJid: mentions || []
    }
  };
  if (typeof ctx?.sendCta === "function") {
    return await ctx.sendCta(text, finalFooter, formattedButtons, options);
  }
  return await sock.sendMessage(destJid, {
    image: imageBuffer || undefined,
    caption: text,
    mentions: mentions
  });
}
async function renderKitchenHUD(user, userName) {
  cleanExpiredBuffs(user);
  const now = Date.now();
  const activeBuffList = [];
  for (const [k, b] of Object.entries(user.buffs || {})) {
    const sisaMenit = Math.ceil((b.expireTime - now) / 6e4);
    activeBuffList.push({
      label: b.label,
      remain: sisaMenit
    });
  }
  const html = generateKitchenHTML({
    playerName: userName,
    recipes: RECIPES,
    activeBuffs: activeBuffList,
    inventory: user.inventory || {}
  });
  return await renderHtmlToImage(html);
}
async function handleCookAction(sock, ctx, msg, sender, rawText) {
  initDB(sender, ctx?.pushName || "");
  const user = global.db.user[sender];
  user.buffs = user.buffs || {};
  user.inventory = user.inventory || {};
  const parts = rawText.split(/\s+/);
  const action = (parts[1] || "").toLowerCase();
  const recipeIdx = parseInt(parts[2]) - 1;
  const prefix = ctx.prefix || ".";
  const userName = ctx.pushName || sender.split("@")[0];
  if (action === "make" || action === "masak") {
    if (isNaN(recipeIdx) || recipeIdx < 0 || recipeIdx >= RECIPES.length) {
      return ctx.reply("❌ Nomor resep masakan tidak valid.");
    }
    const recipe = RECIPES[recipeIdx];
    for (const [key, need] of Object.entries(recipe.ingredients)) {
      const [cat, item] = key.split(".");
      const owned = user.inventory?.[cat]?.[item] || 0;
      if (owned < need) {
        return ctx.reply(`❌ Bahan tidak cukup untuk memasak *${recipe.name}*!\nKamu butuh *${need}x ${item.toUpperCase()}* (Milikmu: ${owned}).`);
      }
    }
    for (const [key, need] of Object.entries(recipe.ingredients)) {
      const [cat, item] = key.split(".");
      user.inventory[cat][item] -= need;
    }
    if (recipe.buff.type === "regen") {
      user.hp = user.hpMax || 100;
      user.mana = user.manaMax || 50;
    } else {
      user.buffs[recipe.buff.type] = {
        val: recipe.buff.val,
        label: recipe.buff.label,
        expireTime: Date.now() + recipe.buff.duration
      };
    }
    saveDB();
    const hud = await renderKitchenHUD(user, userName);
    const buttons = [{
      display_text: "🍳 Masak Hidangan Lain",
      id: `${prefix}cook`
    }, {
      display_text: "🗼 Uji Buff di Menara",
      id: `${prefix}tower`
    }];
    const cookNotice = `🍽️ *HIDANGAN SELESAI DIMASAK & DISANTAP!* 🍽️\n\n` + `Kamu baru saja menikmati: *${recipe.name}*\n` + `• Efek Aktif: *${recipe.buff.label}*\n\n` + `Tubuhmu terasa dipenuhi energi magis luar biasa!`;
    return await sendCookCTA(sock, ctx, ctx.id, {
      text: cookNotice,
      buttons: buttons,
      imageBuffer: hud.buffer,
      mentions: [sender]
    });
  }
}
export default {
  name: "cook",
  aliases: ["masak", "kitchen", "dapur", "kuliner"],
  description: "Memasak hidangan buff tempur menggunakan ikan, daging, air, dan batu bara",
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
      if (/^[.#/!]?cook\s+(make|masak)/i.test(text)) {
        return await handleCookAction(sock, ctx, msg, sender, text);
      }
    } catch (e) {
      console.error("[COOK BEFORE ERROR]:", e);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      const sender = ctx.sender;
      const prefix = ctx.prefix || ".";
      const userName = ctx.pushName || sender.split("@")[0];
      initDB(sender, userName);
      const user = global.db.user[sender];
      const hud = await renderKitchenHUD(user, userName);
      const buttons = [{
        display_text: "🥩 Masak Steak (#1)",
        id: `${prefix}cook make 1`
      }, {
        display_text: "🐟 Masak Ikan (#2)",
        id: `${prefix}cook make 2`
      }, {
        display_text: "🍣 Masak Sashimi (#3)",
        id: `${prefix}cook make 3`
      }, {
        display_text: "🍲 Masak Sup (#4)",
        id: `${prefix}cook make 4`
      }];
      const bodyText = `🍳 *ROYAL TAVERN KITCHEN & FEAST* 🍳\n\n` + `Olah hasil buruan (*Meat*), pancingan (*Fish*), mineral (*Coal*), dan air (*Water*) menjadi santapan magis!\n\n` + `_Ketuk tombol di bawah untuk memasak hidangan pilihanmu:_`;
      await sendCookCTA(sock, ctx, ctx.id, {
        text: bodyText,
        buttons: buttons,
        imageBuffer: hud.buffer,
        mentions: [sender]
      });
    } catch (err) {
      console.error("[COOK EXECUTE ERROR]:", err);
      ctx.reply(`❌ Terjadi kendala di dapur: ${err.message}`);
    }
  }
};