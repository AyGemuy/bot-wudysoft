import axios from "axios";
import db from "../../data/db.js";

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

function generateDailyHTML(data) {
  const {
    playerName,
    isPremium,
    streak,
    moneyGained,
    expGained,
    bonusItems,
    totalBalance,
    level,
    exp,
    expReq
  } = data;
  const expPct = Math.max(0, Math.min(100, Math.round(exp / expReq * 100)));
  let bonusCardsHTML = "";
  bonusItems.forEach(item => {
    bonusCardsHTML += `
      <div class="bonus-card">
        <div class="bonus-icon">${item.icon}</div>
        <div class="bonus-name">${item.name}</div>
        <div class="bonus-qty">+${item.qty}</div>
      </div>
    `;
  });
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 960px;
      height: 540px;
      background: #0f0a04;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: #fff;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .vault-frame {
      width: 960px;
      height: 540px;
      background: radial-gradient(circle at 50% 20%, #362208 0%, #170d02 65%, #080400 100%);
      border: 8px solid #281703;
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
    .status-badge {
      background: rgba(0,0,0,0.7);
      border: 1.5px solid ${isPremium ? "#9f7aea" : "#ecc94b"};
      color: ${isPremium ? "#d6bcfa" : "#fefcbf"};
      padding: 5px 18px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 800;
    }

    .main-grid {
      display: grid;
      grid-template-columns: 380px 1fr;
      gap: 24px;
      align-items: center;
      margin: 10px 0;
    }

    /* Left Vault Panel */
    .vault-panel {
      background: rgba(22, 13, 3, 0.85);
      border: 2px solid rgba(236, 201, 75, 0.4);
      border-radius: 16px;
      padding: 22px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.8);
      position: relative;
    }
    .chest-avatar {
      font-size: 64px;
      filter: drop-shadow(0 0 20px rgba(236, 201, 75, 0.5));
      margin-bottom: -6px;
    }
    .vault-title { font-size: 20px; font-weight: 900; color: #fffaf0; }
    .streak-pill {
      background: linear-gradient(135deg, #d69e2e, #ecc94b);
      color: #000;
      font-size: 11px;
      font-weight: 900;
      padding: 3px 14px;
      border-radius: 12px;
      letter-spacing: 0.8px;
    }
    .primary-rewards {
      width: 100%;
      background: rgba(0,0,0,0.5);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px;
      padding: 10px 16px;
      display: flex;
      justify-content: space-between;
      margin-top: 4px;
    }
    .reward-col { display: flex; flex-direction: column; }
    .reward-label { font-size: 10px; color: #a38d82; font-weight: 700; text-transform: uppercase; }
    .reward-val { font-size: 16px; font-weight: 800; color: #ecc94b; }

    /* Right Bonus Items Panel */
    .bonus-panel {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .bonus-header { font-size: 12px; font-weight: 800; color: #ecc94b; text-transform: uppercase; letter-spacing: 1.2px; }
    .bonus-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
    }
    .bonus-card {
      background: rgba(26, 15, 4, 0.9);
      border: 1.5px solid rgba(236, 201, 75, 0.35);
      border-radius: 14px;
      padding: 14px;
      display: flex;
      align-items: center;
      gap: 12px;
      box-shadow: 0 8px 16px rgba(0,0,0,0.6);
    }
    .bonus-icon { font-size: 32px; }
    .bonus-name { font-size: 13px; font-weight: 800; color: #f7fafc; }
    .bonus-qty { font-size: 15px; font-weight: 900; color: #48bb78; margin-left: auto; }

    /* Level Progress Box */
    .exp-box {
      background: rgba(0,0,0,0.5);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 10px;
      padding: 10px 14px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-top: 6px;
    }
    .exp-label { display: flex; justify-content: space-between; font-size: 11px; font-weight: 800; color: #cbd5e0; }
    .bar-shell {
      width: 100%;
      height: 12px;
      background: #100802;
      border-radius: 6px;
      border: 1px solid rgba(255,255,255,0.15);
      overflow: hidden;
    }
    .bar-fill {
      height: 100%;
      background: linear-gradient(90deg, #dd6b20, #ecc94b);
      border-radius: 6px;
    }

    .bottom-bar {
      background: rgba(0,0,0,0.7);
      border: 1px solid rgba(236, 201, 75, 0.3);
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
  <div class="vault-frame">
    <div class="top-header">
      <div class="title">🎁 ROYAL TREASURY • DAILY CLAIM 🎁</div>
      <div class="status-badge">${isPremium ? "VIP PETUALANG (2X REWARD)" : "FREE USER"}</div>
    </div>

    <div class="main-grid">
      <!-- Left Vault Summary -->
      <div class="vault-panel">
        <div class="chest-avatar">👑📦</div>
        <div class="vault-title">KAS BESAR KERAJAAN</div>
        <div class="streak-pill">🔥 DAY ${streak} STREAK</div>

        <div class="primary-rewards">
          <div class="reward-col">
            <span class="reward-label">GOLD COIN</span>
            <span class="reward-val">+Rp ${moneyGained.toLocaleString("id-ID")}</span>
          </div>
          <div class="reward-col" style="text-align: right;">
            <span class="reward-label">EXPERIENCE</span>
            <span class="reward-val" style="color: #63b3ed;">+${expGained} XP</span>
          </div>
        </div>
      </div>

      <!-- Right Bonus Items & Progress -->
      <div class="bonus-panel">
        <div class="bonus-header">📦 HADIAH TAMBAHAN PERBEKALAN</div>
        <div class="bonus-grid">
          ${bonusCardsHTML}
        </div>

        <div class="exp-box">
          <div class="exp-label">
            <span>PROGRESS LEVEL: LV. ${level}</span>
            <span>${exp} / ${expReq} XP (${expPct}%)</span>
          </div>
          <div class="bar-shell"><div class="bar-fill" style="width: ${expPct}%;"></div></div>
        </div>
      </div>
    </div>

    <div class="bottom-bar">
      <span>Pemilik Akun: <b>${playerName}</b></span>
      <span style="color: #ecc94b; font-weight: 800;">TOTAL SALDO: Rp ${totalBalance.toLocaleString("id-ID")}</span>
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
  name: "daily",
  aliases: ["hadiahHarian", "claimdaily", "claim", "harian"],
  description: "Klaim hadiah harian (Uang, EXP, Potion, Umpan & Crate) dengan Dynamic HTML Canvas",
  category: "RPG",
  register: true,
  execute: async (sock, ctx, msg) => {
    try {
      db.ensureUser(ctx.sender, ctx.pushname);
      const user = global.db.user[ctx.sender];
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • Daily Reward`;
      const prefix = ctx.prefix || ".";
      const userName = ctx.pushname || ctx.sender.split("@")[0];
      const senderNum = ctx.sender.split("@")[0];
      const now = Date.now();
      const COOLDOWN_DAILY = 24 * 60 * 60 * 1e3;
      const ONE_DAY_MARGIN = 48 * 60 * 60 * 1e3;
      user.cooldown = user.cooldown || {};
      user.inventory = user.inventory || {};
      user.inventory.drink = user.inventory.drink || {
        water: 0,
        mana_potion: 0
      };
      user.inventory.nature = user.inventory.nature || {
        bait: 0
      };
      user.inventory.crate = user.inventory.crate || {
        common: 0,
        uncommon: 0
      };
      user.money = Number(user.money) || 0;
      user.exp = Number(user.exp) || 0;
      user.dailyStreak = Number(user.dailyStreak) || 1;
      if (user.cooldown.daily && now - user.cooldown.daily < COOLDOWN_DAILY) {
        const sisa = COOLDOWN_DAILY - (now - user.cooldown.daily);
        const h = Math.floor(sisa / 36e5);
        const m = Math.floor(sisa % 36e5 / 6e4);
        const s = Math.floor(sisa % 6e4 / 1e3);
        const cdText = `Hi ${userName}!\nKamu sudah mengklaim jatah hadiah harian sebelumnya.\n\n` + `–  *C O O L D O W N*\n\n` + `┌  ◦  *Remaining* : ${h}h ${m}m ${s}s\n` + `│  ◦  *Streak* : 🔥 Day ${user.dailyStreak}\n` + `└  ◦  *Status* : Claimed\n\n` + `Silakan kembali lagi nanti untuk mengambil jatah hadiah harian berikutnya.`;
        const cdButtons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🗼 Panjat Menara",
            id: `${prefix}tower`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "⛏️ Gali Gua Tambang",
            id: `${prefix}cavern`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🎒 Buka Inventory",
            id: `${prefix}inv`
          })
        }];
        const options = {
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 2,
              list_title: "Daily Cooldown",
              button_title: "Aktivitas Lain"
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
      await ctx.react("🎁");
      if (user.cooldown.daily && now - user.cooldown.daily > ONE_DAY_MARGIN) {
        user.dailyStreak = 1;
      } else {
        user.dailyStreak = (user.dailyStreak || 0) + 1;
      }
      const isPremium = Boolean(user.premium?.status);
      const mult = isPremium ? 2 : 1;
      const streakBonus = Math.min(2, 1 + user.dailyStreak * .05);
      const moneyGained = Math.floor((6e3 + Math.floor(Math.random() * 8e3)) * mult * streakBonus);
      const expGained = Math.floor((30 + Math.floor(Math.random() * 30)) * mult * streakBonus);
      const bonusItems = [];
      const roll = Math.random();
      if (roll < .3) {
        user.inventory.drink.water = (user.inventory.drink.water || 0) + 2;
        bonusItems.push({
          name: "Air Mineral (Cook)",
          icon: "💧",
          qty: 2
        });
      } else if (roll < .55) {
        user.inventory.nature.bait = (user.inventory.nature.bait || 0) + 5;
        bonusItems.push({
          name: "Umpan Cacing (Fish/Pet)",
          icon: "🪱",
          qty: 5
        });
      } else if (roll < .7) {
        user.inventory.drink.mana_potion = (user.inventory.drink.mana_potion || 0) + 1;
        bonusItems.push({
          name: "Mana Potion",
          icon: "🧪",
          qty: 1
        });
      } else if (roll < .85) {
        user.inventory.crate.common = (user.inventory.crate.common || 0) + 1;
        bonusItems.push({
          name: "Common Crate",
          icon: "📦",
          qty: 1
        });
      } else {
        user.inventory.crate.uncommon = (user.inventory.crate.uncommon || 0) + 1;
        bonusItems.push({
          name: "Uncommon Crate",
          icon: "🎁",
          qty: 1
        });
      }
      if (isPremium) {
        user.inventory.nature.bait = (user.inventory.nature.bait || 0) + 3;
        bonusItems.push({
          name: "Umpan VIP Bonus",
          icon: "👑",
          qty: 3
        });
      }
      user.money += moneyGained;
      user.exp += expGained;
      user.cooldown.daily = now;
      const lvlResult = checkLevelUp(user);
      db.write(global.db);
      const html = generateDailyHTML({
        playerName: userName,
        isPremium: isPremium,
        streak: user.dailyStreak,
        moneyGained: moneyGained,
        expGained: expGained,
        bonusItems: bonusItems,
        totalBalance: user.money,
        level: user.level,
        exp: user.exp,
        expReq: user.level * 100
      });
      const {
        buffer
      } = await renderHtmlToImage(html);
      const itemsText = bonusItems.map(i => `${i.icon} ${i.name} *(+${i.qty})*`).join(", ");
      let bodyText = `Hi ${userName}!\nKlaim hadiah harian Anda berhasil diproses.\n\n` + `–  *D A I L Y  C L A I M*\n\n` + `┌  ◦  *Player* : @${senderNum}\n` + `│  ◦  *Status* : ${isPremium ? "Premium (2x Mult)" : "Free User"}\n` + `│  ◦  *Streak* : 🔥 Day ${user.dailyStreak} (Bonus x${streakBonus.toFixed(2)})\n` + `│  ◦  *Balance* : +Rp ${moneyGained.toLocaleString("id-ID")}\n` + `│  ◦  *Exp* : +${expGained} XP\n` + `└  ◦  *Loot Perbekalan* : ${itemsText}\n\n` + `–  *A C C O U N T*\n\n` + `┌  ◦  *Total Balance* : Rp ${user.money.toLocaleString("id-ID")}\n` + `└  ◦  *Current Level* : Lv. ${user.level} (${user.exp} / ${user.level * 100} XP)\n\n`;
      if (lvlResult.isLevelUp) {
        bodyText += `–  *L E V E L  U P*\n\nSelamat, level karakter kamu naik ke *Lv. ${lvlResult.newLevel}*!\nHP dan Mana telah dipulihkan penuh.\n\n`;
      }
      bodyText += `Gunakan perbekalan ini untuk memasak, memancing, atau menjelajahi dungeon!`;
      const buttons = [{
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🗼 Panjat Menara (.tower)",
          id: `${prefix}tower`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "⛏️ Gali Gua (.cavern)",
          id: `${prefix}cavern`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🍳 Masak Santapan (.cook)",
          id: `${prefix}cook`
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
            list_title: `${botName} • Daily Claim`,
            button_title: "Aksi Petualang"
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
      console.error("[DAILY ERROR]", err);
      ctx.reply(`❌ Terjadi kesalahan saat klaim harian: ${err.message}`);
    }
  }
};