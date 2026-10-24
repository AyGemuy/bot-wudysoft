import axios from "axios";
import db from "../../data/db.js";
const FISH_TABLE = [{
  key: "fish.anchovy",
  name: "Ikan Teri",
  emoji: "🐟",
  chance: .55,
  exp: 6,
  rarity: "Common"
}, {
  key: "fish.shrimp",
  name: "Udang Segar",
  emoji: "🦐",
  chance: .45,
  exp: 9,
  rarity: "Common"
}, {
  key: "fish.catfish",
  name: "Ikan Lele",
  emoji: "🐟",
  chance: .4,
  exp: 12,
  rarity: "Common"
}, {
  key: "fish.carp",
  name: "Ikan Mas",
  emoji: "🐡",
  chance: .3,
  exp: 15,
  rarity: "Uncommon"
}, {
  key: "fish.squid",
  name: "Cumi-Cumi",
  emoji: "🦑",
  chance: .22,
  exp: 20,
  rarity: "Uncommon"
}, {
  key: "fish.tuna",
  name: "Ikan Tuna",
  emoji: "🐠",
  chance: .18,
  exp: 25,
  rarity: "Rare"
}, {
  key: "fish.salmon",
  name: "Ikan Salmon",
  emoji: "🐟",
  chance: .15,
  exp: 30,
  rarity: "Rare"
}, {
  key: "fish.clownfish",
  name: "Ikan Badut",
  emoji: "🐠",
  chance: .1,
  exp: 35,
  rarity: "Rare"
}, {
  key: "fish.swordfish",
  name: "Ikan Pedang",
  emoji: "🗡️",
  chance: .06,
  exp: 50,
  rarity: "Epic"
}, {
  key: "fish.pufferfish",
  name: "Ikan Buntal",
  emoji: "🐡",
  chance: .04,
  exp: 70,
  rarity: "Epic"
}, {
  key: "crate.uncommon",
  name: "Peti Harta Karun Laut",
  emoji: "🎁",
  chance: .08,
  exp: 20,
  rarity: "Treasure"
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

function generateFishingHTML(data) {
  const {
    playerName,
    rodLabel,
    remainingBait,
    totalExp,
    catches,
    waterZone
  } = data;
  let catchCardsHTML = "";
  if (catches.length === 0) {
    catchCardsHTML = `
      <div class="empty-catch">
        <div style="font-size: 48px;">🌊</div>
        <div style="font-size: 16px; font-weight: 800; color: #cbd5e0;">Ikan Memakan Umpan Lalu Menyelam Kabur!</div>
      </div>
    `;
  } else {
    catches.forEach(c => {
      catchCardsHTML += `
        <div class="fish-card">
          <div class="rarity-badge ${c.rarity.toLowerCase()}">${c.rarity}</div>
          <div class="fish-icon">${c.emoji}</div>
          <div class="fish-name">${c.name}</div>
          <div class="fish-exp">+${c.exp} XP</div>
        </div>
      `;
    });
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
      background: #040d1a;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: #fff;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .fishery-frame {
      width: 960px;
      height: 540px;
      background: radial-gradient(circle at 50% 20%, #004b75 0%, #002238 65%, #00101c 100%);
      border: 8px solid #002742;
      outline: 2px solid #00b4d8;
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
      border-bottom: 2px solid rgba(0, 180, 216, 0.4);
      padding-bottom: 12px;
    }
    .title {
      font-size: 24px;
      font-weight: 900;
      color: #90e0ef;
      letter-spacing: 2px;
      text-transform: uppercase;
      text-shadow: 0 0 14px rgba(0, 180, 216, 0.6);
    }
    .zone-badge {
      background: rgba(0,0,0,0.7);
      border: 1.5px solid #00b4d8;
      color: #caf0f8;
      padding: 5px 18px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 800;
    }

    .main-grid {
      display: grid;
      grid-template-columns: 280px 1fr;
      gap: 24px;
      align-items: center;
      margin: 10px 0;
    }

    /* Left Angler Kit */
    .angler-panel {
      background: rgba(0, 31, 51, 0.85);
      border: 2px solid rgba(0, 180, 216, 0.4);
      border-radius: 16px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.8);
    }
    .panel-title { font-size: 12px; font-weight: 800; color: #90e0ef; text-transform: uppercase; }
    .rod-box {
      background: rgba(0,0,0,0.5);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 10px;
      padding: 10px 12px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .rod-info { display: flex; flex-direction: column; }
    .rod-name { font-size: 14px; font-weight: 800; color: #f7fafc; }
    .bait-stock {
      background: rgba(0, 119, 182, 0.25);
      border: 1px solid #0096c7;
      border-radius: 10px;
      padding: 10px 12px;
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      font-weight: 800;
      color: #caf0f8;
    }

    /* Right Catches Display */
    .catches-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 14px;
      max-height: 290px;
    }
    .fish-card {
      background: rgba(0, 21, 36, 0.9);
      border: 1.5px solid rgba(0, 180, 216, 0.35);
      border-radius: 14px;
      padding: 14px 10px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      position: relative;
      box-shadow: 0 8px 16px rgba(0,0,0,0.6);
    }
    .rarity-badge {
      font-size: 9px;
      font-weight: 900;
      padding: 2px 8px;
      border-radius: 6px;
      text-transform: uppercase;
    }
    .common { background: #4a5568; color: #fff; }
    .uncommon { background: #2f855a; color: #fff; }
    .rare { background: #2b6cb0; color: #fff; }
    .epic { background: #6b46c1; color: #fff; }
    .treasure { background: #d69e2e; color: #000; }
    .fish-icon { font-size: 38px; filter: drop-shadow(0 0 10px rgba(0, 180, 216, 0.5)); }
    .fish-name { font-size: 13px; font-weight: 800; color: #f7fafc; text-align: center; }
    .fish-exp { font-size: 11px; font-weight: 800; color: #ecc94b; }

    .empty-catch {
      grid-column: span 3;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      height: 200px;
      background: rgba(0,0,0,0.4);
      border-radius: 16px;
    }

    .bottom-bar {
      background: rgba(0,0,0,0.7);
      border: 1px solid rgba(0, 180, 216, 0.3);
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
  <div class="fishery-frame">
    <div class="top-header">
      <div class="title">🎣 ROYAL ANGLER'S HARVEST 🎣</div>
      <div class="zone-badge">${waterZone}</div>
    </div>

    <div class="main-grid">
      <!-- Angler Kit -->
      <div class="angler-panel">
        <div class="panel-title">PERLENGKAPAN MEMANCING</div>
        <div class="rod-box">
          <div style="font-size: 26px;">🎣</div>
          <div class="rod-info">
            <span class="rod-name">${rodLabel}</span>
            <span style="font-size: 11px; color: #48bb78; font-weight: 700;">Efisiensi Tarikan Aktif</span>
          </div>
        </div>

        <div class="bait-stock">
          <span>🪱 Sisa Umpan Cacing:</span>
          <span>${remainingBait} Pcs</span>
        </div>

        <div style="font-size: 11px; color: #a0aec0; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 8px;">
          Ikan tangkapan dapat dimasak menjadi santapan buff di <b>.cook</b> atau pakan peliharaan di <b>.pet feed</b>.
        </div>
      </div>

      <!-- Catches Grid -->
      <div class="catches-grid">
        ${catchCardsHTML}
      </div>
    </div>

    <!-- Bottom Bar -->
    <div class="bottom-bar">
      <span>Petualang: <b>${playerName}</b></span>
      <span style="color: #ecc94b; font-weight: 800;">EXP DIPEROLEH: +${totalExp} XP</span>
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
  name: "fish",
  aliases: ["mancing", "fishing", "pancing"],
  description: "Memancing ikan di perairan sungai dan laut dengan Dynamic HTML Canvas",
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
      if (/^[.#/!]?fish\s+(again|lagi)/i.test(text)) {
        return await ctx.reply("🎣 Melempar joran kembali ke perairan!");
      }
    } catch (e) {
      console.error("[FISH BEFORE ERROR]:", e);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      db.ensureUser(ctx.sender, ctx.pushname);
      const user = global.db.user[ctx.sender];
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • Fishery System`;
      const prefix = ctx.prefix || ".";
      const userName = ctx.pushname || ctx.sender.split("@")[0];
      const senderNum = ctx.sender.split("@")[0];
      const now = Date.now();
      const COOLDOWN_TIME = 10 * 60 * 1e3;
      if (user.cooldown?.fish && now - user.cooldown.fish < COOLDOWN_TIME) {
        const sisa = COOLDOWN_TIME - (now - user.cooldown.fish);
        const m = Math.floor(sisa / 6e4);
        const s = Math.floor(sisa % 6e4 / 1e3);
        const cdText = `Hi ${userName}!\nIkan sedang menjauhi tepi sungai, tunggu beberapa saat lagi.\n\n` + `–  *C O O L D O W N*\n\n` + `┌  ◦  *Activity* : Fishing\n` + `│  ◦  *Remaining* : ${m}m ${s}s\n` + `└  ◦  *Status* : Calming Water\n\n` + `Silakan tunggu hingga kondisi perairan kembali tenang.`;
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
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 2,
              list_title: "Fishing Cooldown",
              button_title: "Aksi Lain"
            }
          },
          contextInfo: {
            mentionedJid: [ctx.sender]
          }
        };
        if (typeof ctx.sendCta === "function") return await ctx.sendCta(cdText, botFooter, cdButtons, options);
        return await sock.sendMessage(ctx.id, {
          text: cdText,
          mentions: [ctx.sender]
        }, {
          quoted: msg
        });
      }
      if ((user.inventory?.nature?.bait || 0) <= 0) {
        const noBaitText = `–  *N O  B A I T*\n\nKamu tidak memiliki umpan cacing di dalam tas.\n\n` + `┌  ◦  *Item* : Umpan Cacing (Bait)\n` + `└  ◦  *Stock* : 0 Pcs\n\n` + `Dapatkan umpan dari hadiah harian (*${prefix}daily*) atau buka peti (*${prefix}open*).`;
        const noBaitButtons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🎁 Klaim Hadiah Harian",
            id: `${prefix}daily`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "📦 Buka Crate",
            id: `${prefix}open common`
          })
        }];
        const options = {
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 2,
              list_title: "No Bait",
              button_title: "Dapatkan Umpan"
            }
          },
          contextInfo: {
            mentionedJid: [ctx.sender]
          }
        };
        if (typeof ctx.sendCta === "function") return await ctx.sendCta(noBaitText, botFooter, noBaitButtons, options);
        return await sock.sendMessage(ctx.id, {
          text: noBaitText,
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
      const caughtItems = [];
      let totalExp = 0;
      for (const fish of FISH_TABLE) {
        if (Math.random() < fish.chance * rodMultiplier) {
          addInventoryNested(user.inventory, fish.key, 1);
          totalExp += fish.exp;
          caughtItems.push(fish);
        }
      }
      user.exp = (user.exp || 0) + totalExp;
      user.cooldown = user.cooldown || {};
      user.cooldown.fish = now;
      const lvlResult = checkLevelUp(user);
      db.write(global.db);
      const html = generateFishingHTML({
        playerName: userName,
        rodLabel: rodLabel,
        remainingBait: user.inventory.nature.bait,
        totalExp: totalExp,
        catches: caughtItems,
        waterZone: caughtItems.some(c => c.rarity === "Epic") ? "Deep Ocean Abyss" : "Crystal Blue River"
      });
      const {
        buffer
      } = await renderHtmlToImage(html);
      const catchLines = caughtItems.length ? caughtItems.map((c, i) => `${i === caughtItems.length - 1 ? "└" : "│"}  ◦  ${c.emoji} ${c.name} *(${c.rarity})*`).join("\n") : "└  ◦  Ikan memakan umpan lalu kabur...";
      let bodyText = `Hi ${userName}!\nBerikut adalah hasil tangkapan memancing di sungai.\n\n` + `–  *F I S H I N G*\n\n` + `┌  ◦  *Player* : @${senderNum}\n` + `│  ◦  *Tool* : ${rodLabel}\n` + `│  ◦  *Remaining Bait* : ${user.inventory.nature.bait} Pcs\n` + `│  ◦  *Exp Gained* : +${totalExp} XP\n` + `└  ◦  *Exp Progress* : ${user.exp} / ${user.level * 100} (Lv. ${user.level})\n\n` + `–  *C A T C H E S*\n\n` + `${catchLines}\n\n`;
      if (lvlResult.isLevelUp) {
        bodyText += `–  *L E V E L  U P*\n\nSelamat, level karakter kamu naik ke *Lv. ${lvlResult.newLevel}*!\nHP dan Mana telah dipulihkan penuh.\n\n`;
      }
      bodyText += `Gunakan tangkapan ini untuk memasak hidangan buff atau memberi makan peliharaanmu!`;
      const buttons = [{
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🍳 Masak Ikan (.cook)",
          id: `${prefix}cook make 2`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🦊 Beri Makan Pet",
          id: `${prefix}pet feed`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "📈 Jual di Bursa (.market)",
          id: `${prefix}market`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🎒 Buka Inventory",
          id: `${prefix}inv`
        })
      }];
      const options = {
        image: buffer,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 2,
            divider_indices: [1],
            list_title: `${botName} • Fishery Harvest`,
            button_title: "Opsi Tangkapan"
          }
        },
        mentions: [ctx.sender],
        contextInfo: {
          mentionedJid: [ctx.sender]
        }
      };
      if (typeof ctx.sendCta === "function") {
        return await ctx.sendCta(bodyText, botFooter, buttons, options);
      }
      return await sock.sendMessage(ctx.id, {
        image: buffer,
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