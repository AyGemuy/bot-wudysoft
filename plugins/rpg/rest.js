import axios from "axios";
import db from "../../data/db.js";

function generateCampHTML(data) {
  const {
    playerName,
    oldHp,
    hpMax,
    oldMana,
    manaMax,
    foragedItems,
    petRestText,
    cooldownMin
  } = data;
  let foragedHTML = "";
  if (foragedItems.length === 0) {
    foragedHTML = `<span>Tidur lelap tanpa mencari bahan di semak.</span>`;
  } else {
    foragedHTML = foragedItems.map(item => `<span>${item.icon} +${item.qty} ${item.name}</span>`).join(" • ");
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
      background: #08090d;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: #fff;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .camp-frame {
      width: 960px;
      height: 540px;
      background: radial-gradient(circle at 50% 25%, #3d1c0c 0%, #170d06 65%, #070402 100%);
      border: 8px solid #281408;
      outline: 2px solid #dd6b20;
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
      border-bottom: 2px solid rgba(221, 107, 32, 0.4);
      padding-bottom: 12px;
    }
    .title {
      font-size: 24px;
      font-weight: 900;
      color: #fbd38d;
      letter-spacing: 2px;
      text-transform: uppercase;
      text-shadow: 0 0 14px rgba(221, 107, 32, 0.6);
    }
    .status-badge {
      background: rgba(0,0,0,0.7);
      border: 1.5px solid #dd6b20;
      color: #feebc8;
      padding: 5px 18px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 800;
    }

    .main-grid {
      display: grid;
      grid-template-columns: 340px 1fr;
      gap: 26px;
      align-items: center;
      margin: 10px 0;
    }

    /* Left Campfire Card */
    .bonfire-card {
      background: rgba(24, 11, 5, 0.9);
      border: 2px solid rgba(221, 107, 32, 0.45);
      border-radius: 18px;
      padding: 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.8);
      position: relative;
    }
    .bonfire-icon {
      font-size: 64px;
      filter: drop-shadow(0 0 20px rgba(221, 107, 32, 0.8));
      margin-bottom: -6px;
    }
    .camp-title { font-size: 20px; font-weight: 900; color: #fffaf0; text-align: center; }
    .camp-pill {
      background: linear-gradient(135deg, #c05621, #dd6b20);
      color: #fff;
      font-size: 11px;
      font-weight: 900;
      padding: 4px 16px;
      border-radius: 12px;
      letter-spacing: 0.8px;
    }
    .pet-companion-box {
      width: 100%;
      background: rgba(0,0,0,0.5);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 10px;
      padding: 8px 12px;
      font-size: 11px;
      color: #ecc94b;
      font-weight: 700;
      text-align: center;
    }

    /* Right Recovery Panel */
    .recovery-panel {
      background: rgba(20, 9, 4, 0.85);
      border: 1.5px solid rgba(221, 107, 32, 0.35);
      border-radius: 16px;
      padding: 22px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .panel-header { font-size: 13px; font-weight: 800; color: #fbd38d; letter-spacing: 1.2px; text-transform: uppercase; }

    .bar-box { display: flex; flex-direction: column; gap: 4px; }
    .bar-lbl { display: flex; justify-content: space-between; font-size: 11px; font-weight: 800; }
    .bar-shell {
      width: 100%;
      height: 16px;
      background: #100602;
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.15);
      overflow: hidden;
    }
    .hp-fill { height: 100%; width: 100%; background: linear-gradient(90deg, #c53030, #48bb78); border-radius: 8px; }
    .mp-fill { height: 100%; width: 100%; background: linear-gradient(90deg, #2b6cb0, #4299e1); border-radius: 8px; }

    .forage-box {
      background: rgba(0,0,0,0.55);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 10px;
      padding: 10px 14px;
      font-size: 12px;
      font-weight: 800;
      color: #9ae6b4;
    }

    .bottom-bar {
      background: rgba(0,0,0,0.7);
      border: 1px solid rgba(221, 107, 32, 0.35);
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
  <div class="camp-frame">
    <div class="top-header">
      <div class="title">⛺ NIGHT BONFIRE SANCTUARY ⛺</div>
      <div class="status-badge">STAMINA: 100% RECOVERED</div>
    </div>

    <div class="main-grid">
      <!-- Left Bonfire Card -->
      <div class="bonfire-card">
        <div class="bonfire-icon">🔥⛺</div>
        <div class="camp-title">API UNGGUN PERKEMAHAN</div>
        <div class="camp-pill">REST & RELAXATION</div>
        <div class="pet-companion-box">${petRestText}</div>
      </div>

      <!-- Right Recovery Bars -->
      <div class="recovery-panel">
        <div class="panel-header">PEMULIHAN FISIK & MENTAL</div>

        <div class="bar-box">
          <div class="bar-lbl"><span style="color: #feb2b2;">HEALTH RECOVERY</span><span style="color: #48bb78;">${oldHp} ➔ ${hpMax} HP (100%)</span></div>
          <div class="bar-shell"><div class="hp-fill"></div></div>
        </div>

        <div class="bar-box">
          <div class="bar-lbl"><span style="color: #bee3f8;">MANA RECOVERY</span><span style="color: #63b3ed;">${oldMana} ➔ ${manaMax} MP (100%)</span></div>
          <div class="bar-shell"><div class="mp-fill"></div></div>
        </div>

        <div style="font-size: 11px; font-weight: 700; color: #fbd38d; text-transform: uppercase; margin-top: 2px;">HASIL MERAMBAH HUTAN SEKITAR:</div>
        <div class="forage-box">${foragedHTML}</div>
      </div>
    </div>

    <div class="bottom-bar">
      <span>Petualang: <b>${playerName}</b></span>
      <span style="color: #ecc94b; font-weight: 800;">COOLDOWN PERKEMAHAN: ${cooldownMin} MENIT</span>
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
  name: "rest",
  aliases: ["tidur", "istirahat", "camp", "kemah"],
  description: "Mendirikan tenda perkemahan dan memulihkan seluruh HP & Mana dengan Dynamic HTML Canvas",
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
      if (/^[.#/!]?(rest|tidur|istirahat|kemah)\b/i.test(text)) {}
    } catch (e) {
      console.error("[REST BEFORE ERROR]:", e);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      db.ensureUser(ctx.sender, ctx.pushname);
      const user = global.db.user[ctx.sender];
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • Rest & Camp`;
      const prefix = ctx.prefix || ".";
      const userName = ctx.pushname || ctx.sender.split("@")[0];
      const senderNum = ctx.sender.split("@")[0];
      const now = Date.now();
      const COOLDOWN = 10 * 60 * 1e3;
      if (user.cooldown?.rest && now - user.cooldown.rest < COOLDOWN) {
        const sisa = COOLDOWN - (now - user.cooldown.rest);
        const m = Math.floor(sisa / 6e4);
        const s = Math.floor(sisa % 6e4 / 1e3);
        const cdText = `Hi ${userName}!\nKamu baru saja beristirahat di perkemahan.\n\n` + `–  *C O O L D O W N*\n\n` + `┌  ◦  *Remaining* : ${m}m ${s}s\n` + `└  ◦  *Status* : Rested & Energized\n\n` + `Tubuhmu masih terasa sangat bugar untuk menjelajah!`;
        const cdButtons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🗼 Panjat Menara",
            id: `${prefix}tower`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "⚔️ Masuk Dungeon",
            id: `${prefix}dungeon`
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
              list_title: "Rest Cooldown",
              button_title: "Aktivitas Tempur"
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
      if ((user.hp || 0) >= (user.hpMax || 100) && (user.mana || 0) >= (user.manaMax || 50)) {
        return ctx.reply(`–  *F U L L  E N E R G Y*\n\nKondisi HP dan Mana karaktermu sudah penuh (${user.hp}/${user.hpMax} HP | ${user.mana}/${user.manaMax} MP).\nKaraktermu siap bertarung di *${prefix}tower* atau *${prefix}dungeon*!`);
      }
      const oldHp = user.hp || 0;
      const oldMana = user.mana || 0;
      user.hp = user.hpMax || 100;
      user.mana = user.manaMax || 50;
      user.cooldown = user.cooldown || {};
      user.cooldown.rest = now;
      user.inventory = user.inventory || {};
      user.inventory.fruit = user.inventory.fruit || {};
      user.inventory.material = user.inventory.material || {};
      user.inventory.drink = user.inventory.drink || {};
      const foragedItems = [];
      const roll = Math.random();
      if (roll < .45) {
        user.inventory.fruit.apple = (user.inventory.fruit.apple || 0) + 2;
        foragedItems.push({
          name: "Apel Segar",
          icon: "🍎",
          qty: 2
        });
      }
      if (roll < .35) {
        user.inventory.material.wood = (user.inventory.material.wood || 0) + 3;
        foragedItems.push({
          name: "Kayu Bakar (Craft)",
          icon: "🪵",
          qty: 3
        });
      }
      if (roll < .25) {
        user.inventory.drink.water = (user.inventory.drink.water || 0) + 1;
        foragedItems.push({
          name: "Mata Air Jernih (Cook)",
          icon: "💧",
          qty: 1
        });
      }
      let petRestText = "Berkemah seorang diri di alam bebas.";
      if (user.pet) {
        user.pet.affection = Math.min(100, (user.pet.affection || 0) + 5);
        petRestText = `🐾 ${user.pet.name} tidur lelap di sisimu (+5% Sayang).`;
      }
      db.write(global.db);
      await ctx.react("⛺");
      const html = generateCampHTML({
        playerName: userName,
        oldHp: oldHp,
        hpMax: user.hpMax,
        oldMana: oldMana,
        manaMax: user.manaMax,
        foragedItems: foragedItems,
        petRestText: petRestText,
        cooldownMin: 10
      });
      const {
        buffer
      } = await renderHtmlToImage(html);
      const foragedText = foragedItems.length ? foragedItems.map(i => `${i.icon} ${i.name} *(+${i.qty})*`).join(", ") : "Tidak menemukan bahan di sekitar.";
      let restText = `Hi ${userName}!\nKamu beristirahat dengan tenang di samping hangatnya api unggun perkemahan.\n\n` + `–  *P E M U L I H A N  K A R A K T E R*\n\n` + `┌  ◦  *Player* : @${senderNum}\n` + `│  ◦  *Health* : ${oldHp} ➔ ${user.hpMax}/${user.hpMax} HP (100% Penuh)\n` + `│  ◦  *Mana* : ${oldMana} ➔ ${user.manaMax}/${user.manaMax} MP (100% Penuh)\n` + `└  ◦  *Mitra Pet* : ${petRestText}\n\n` + `–  *H A S I L  M E R A M B A H*\n\n` + `└  ◦  ${foragedText}\n\n` + `Kondisi fisikmu telah pulih sempurna. Ayo lanjutkan petualangan!`;
      const buttons = [{
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🗼 Panjat Menara (.tower)",
          id: `${prefix}tower`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "⚔️ Masuk Dungeon (.dungeon)",
          id: `${prefix}dungeon`
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
            list_title: `${botName} • Rest & Camp`,
            button_title: "Aksi Selanjutnya"
          }
        },
        mentions: [ctx.sender],
        contextInfo: {
          mentionedJid: [ctx.sender]
        }
      };
      if (typeof ctx.sendCta === "function") return await ctx.sendCta(restText, botFooter, buttons, options);
      return await sock.sendMessage(ctx.id, {
        image: buffer,
        caption: restText,
        mentions: [ctx.sender]
      }, {
        quoted: msg
      });
    } catch (err) {
      console.error("[REST ERROR]", err);
      ctx.reply(`❌ Terjadi kendala saat berkemah: ${err.message}`);
    }
  }
};