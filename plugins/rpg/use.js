import axios from "axios";
import db from "../../data/db.js";
const USABLE_ITEMS = {
  water: {
    name: "Air Mineral",
    emoji: "💧",
    hp: 15,
    mana: 0,
    category: "drink",
    desc: "Mata air segar pelepas dahaga."
  },
  juice: {
    name: "Jus Buah Segar",
    emoji: "🧃",
    hp: 30,
    mana: 10,
    category: "drink",
    desc: "Sari buah manis penambah stamina."
  },
  herbal_tea: {
    name: "Teh Herbal Daun Suci",
    emoji: "🍵",
    hp: 50,
    mana: 25,
    category: "drink",
    desc: "Seduhan herba pemulih fokus tempur."
  },
  mana_potion: {
    name: "Mana Potion",
    emoji: "🧪",
    hp: 0,
    mana: 80,
    category: "drink",
    desc: "Cairan biru kental pemulih kapasitas mana."
  },
  elixir: {
    name: "Elixir Suci Dewi",
    emoji: "✨",
    hp: 200,
    mana: 100,
    category: "drink",
    desc: "Ramuan mukjizat pemulih fisik dan energi seketika."
  },
  bread: {
    name: "Roti Gandum",
    emoji: "🍞",
    hp: 20,
    mana: 0,
    category: "food",
    desc: "Ransum darurat pengganjal perut."
  },
  rice: {
    name: "Nasi Putih Hangat",
    emoji: "🍚",
    hp: 40,
    mana: 5,
    category: "food",
    desc: "Karbohidrat pengisi energi harian."
  },
  grilled_fish: {
    name: "Ikan Bakar Rempah",
    emoji: "🐟",
    hp: 60,
    mana: 10,
    category: "food",
    desc: "Hasil pancingan gurih berprotein tinggi."
  },
  fruit_salad: {
    name: "Salad Buah Hutan",
    emoji: "🥗",
    hp: 45,
    mana: 30,
    category: "food",
    desc: "Kombinasi buah pemulih stamina dan pikiran."
  },
  roast_chicken: {
    name: "Ayam Panggang Madu",
    emoji: "🍗",
    hp: 80,
    mana: 15,
    category: "food",
    desc: "Daging unggas lezat pemulih tenaga fisik."
  },
  steak: {
    name: "Steak Barbarian Daging",
    emoji: "🥩",
    hp: 100,
    mana: 20,
    category: "food",
    desc: "Daging hasil buruan berenergi padat."
  }
};

function generateUseHTML(data) {
  const {
    playerName,
    itemName,
    itemIcon,
    qtyUsed,
    hpBefore,
    hpAfter,
    hpMax,
    manaBefore,
    manaAfter,
    manaMax,
    realHpGained,
    realManaGained,
    remainingQty
  } = data;
  const hpPct = Math.max(0, Math.min(100, Math.round(hpAfter / hpMax * 100)));
  const mpPct = Math.max(0, Math.min(100, Math.round(manaAfter / manaMax * 100)));
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 960px;
      height: 540px;
      background: #06120e;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: #fff;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .apothecary-frame {
      width: 960px;
      height: 540px;
      background: radial-gradient(circle at 50% 20%, #0e3025 0%, #071712 65%, #020705 100%);
      border: 8px solid #0f3d2f;
      outline: 2px solid #38b2ac;
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
      border-bottom: 2px solid rgba(56, 178, 172, 0.4);
      padding-bottom: 12px;
    }
    .title {
      font-size: 24px;
      font-weight: 900;
      color: #81e6d9;
      letter-spacing: 2px;
      text-transform: uppercase;
      text-shadow: 0 0 14px rgba(56, 178, 172, 0.6);
    }
    .status-badge {
      background: rgba(0,0,0,0.7);
      border: 1.5px solid #38b2ac;
      color: #e6fffa;
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

    /* Left Item Card */
    .item-card {
      background: rgba(10, 31, 24, 0.9);
      border: 2px solid rgba(56, 178, 172, 0.45);
      border-radius: 18px;
      padding: 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.8);
      position: relative;
    }
    .item-glow {
      font-size: 64px;
      filter: drop-shadow(0 0 20px rgba(72, 187, 120, 0.7));
      margin-bottom: -6px;
    }
    .item-title { font-size: 20px; font-weight: 900; color: #f0fff4; text-align: center; }
    .item-pill {
      background: linear-gradient(135deg, #285e61, #319795);
      color: #fff;
      font-size: 11px;
      font-weight: 900;
      padding: 4px 16px;
      border-radius: 12px;
      letter-spacing: 0.8px;
    }
    .stock-chip {
      background: rgba(0,0,0,0.5);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 10px;
      padding: 8px 14px;
      font-size: 12px;
      font-weight: 800;
      color: #b2f5ea;
      margin-top: 4px;
    }

    /* Right Recovery Progress */
    .recovery-panel {
      background: rgba(9, 27, 21, 0.85);
      border: 1.5px solid rgba(56, 178, 172, 0.35);
      border-radius: 16px;
      padding: 22px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .panel-header { font-size: 13px; font-weight: 800; color: #81e6d9; letter-spacing: 1.2px; text-transform: uppercase; }

    .bar-box { display: flex; flex-direction: column; gap: 4px; }
    .bar-lbl { display: flex; justify-content: space-between; font-size: 11px; font-weight: 800; }
    .bar-shell {
      width: 100%;
      height: 16px;
      background: #06140f;
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.15);
      overflow: hidden;
    }
    .hp-fill { height: 100%; background: linear-gradient(90deg, #e53e3e, #48bb78); border-radius: 8px; }
    .mp-fill { height: 100%; background: linear-gradient(90deg, #3182ce, #63b3ed); border-radius: 8px; }

    .gain-pill-row {
      display: flex;
      gap: 12px;
      margin-top: 4px;
    }
    .gain-pill {
      background: rgba(0,0,0,0.55);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 10px;
      padding: 10px 14px;
      font-size: 13px;
      font-weight: 900;
    }
    .gain-hp { color: #68d391; border-color: #38a169; }
    .gain-mp { color: #63b3ed; border-color: #3182ce; }

    .bottom-bar {
      background: rgba(0,0,0,0.7);
      border: 1px solid rgba(56, 178, 172, 0.35);
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
  <div class="apothecary-frame">
    <div class="top-header">
      <div class="title">🧪 APOTHECARY & RECOVERY VAULT 🧪</div>
      <div class="status-badge">KONSUMSI SUKSES</div>
    </div>

    <div class="main-grid">
      <!-- Left Item Card -->
      <div class="item-card">
        <div class="item-glow">${itemIcon}</div>
        <div class="item-title">${itemName}</div>
        <div class="item-pill">DIKONSUMSI: ${qtyUsed} BUAH</div>
        <div class="stock-chip">📦 Sisa di Tas: ${remainingQty} Buah</div>
      </div>

      <!-- Right Recovery Bars -->
      <div class="recovery-panel">
        <div class="panel-header">PEMULIHAN STATUS VITAL</div>

        <div class="bar-box">
          <div class="bar-lbl"><span style="color: #feb2b2;">HEALTH (HP)</span><span>${hpBefore} ➔ ${hpAfter} / ${hpMax} (${hpPct}%)</span></div>
          <div class="bar-shell"><div class="hp-fill" style="width: ${hpPct}%;"></div></div>
        </div>

        <div class="bar-box">
          <div class="bar-lbl"><span style="color: #bee3f8;">MANA (MP)</span><span>${manaBefore} ➔ ${manaAfter} / ${manaMax} (${mpPct}%)</span></div>
          <div class="bar-shell"><div class="mp-fill" style="width: ${mpPct}%;"></div></div>
        </div>

        <div class="gain-pill-row">
          <div class="gain-pill gain-hp">💖 +${realHpGained} HP Dipulihkan</div>
          <div class="gain-pill gain-mp">🔷 +${realManaGained} MP Dipulihkan</div>
        </div>
      </div>
    </div>

    <div class="bottom-bar">
      <span>Petualang: <b>${playerName}</b></span>
      <span style="color: #68d391; font-weight: 800;">TUBUH KEMBALI PRIMA UNTUK BERTARUNG</span>
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
async function handleUseAction(sock, ctx, msg, sender, rawText) {
  db.ensureUser(sender, ctx?.pushName);
  const user = global.db.user[sender];
  const parts = rawText.split(/\s+/);
  const itemKey = (parts[1] || "").toLowerCase().replace(/\s+/g, "_");
  const qty = Math.max(1, parseInt(parts[2]) || 1);
  const prefix = ctx.prefix || ".";
  const userName = ctx.pushName || sender.split("@")[0];
  if (!USABLE_ITEMS[itemKey]) return;
  const item = USABLE_ITEMS[itemKey];
  const inv = user.inventory?.[item.category];
  if (!inv || (inv[itemKey] || 0) < qty) {
    return ctx.reply(`❌ Persediaan *${item.name}* tidak mencukupi (Milikmu: ${inv?.[itemKey] || 0} buah).\nMasak makanan di *${prefix}cook* atau *${prefix}craft*!`);
  }
  if ((user.hp || 0) >= (user.hpMax || 100) && (user.mana || 0) >= (user.manaMax || 50)) {
    return ctx.reply(`–  *F U L L  V I T A L I T Y*\n\nKondisi HP dan Mana karaktermu sudah 100% penuh (${user.hp}/${user.hpMax} HP | ${user.mana}/${user.manaMax} MP)!\nSimpan bekalmu untuk bertarung di *${prefix}tower* atau *${prefix}dungeon*.`);
  }
  const hpBefore = user.hp || 0;
  const manaBefore = user.mana || 0;
  inv[itemKey] -= qty;
  const totalHpHeal = item.hp * qty;
  const totalManaHeal = item.mana * qty;
  user.hp = Math.min(user.hpMax || 100, (user.hp || 0) + totalHpHeal);
  user.mana = Math.min(user.manaMax || 50, (user.mana || 0) + totalManaHeal);
  const realHpGained = user.hp - hpBefore;
  const realManaGained = user.mana - manaBefore;
  db.write(global.db);
  await ctx.react("🧪");
  const html = generateUseHTML({
    playerName: userName,
    itemName: item.name,
    itemIcon: item.emoji,
    qtyUsed: qty,
    hpBefore: hpBefore,
    hpAfter: user.hp,
    hpMax: user.hpMax || 100,
    manaBefore: manaBefore,
    manaAfter: user.mana,
    manaMax: user.manaMax || 50,
    realHpGained: realHpGained,
    realManaGained: realManaGained,
    remainingQty: inv[itemKey]
  });
  const {
    buffer
  } = await renderHtmlToImage(html);
  const buttons = [];
  if (inv[itemKey] > 0 && (user.hp < user.hpMax || user.mana < user.manaMax)) {
    buttons.push({
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: `🧪 Konsumsi Lagi (${inv[itemKey]}x)`,
        id: `${prefix}use ${itemKey} 1`
      })
    });
  }
  buttons.push({
    name: "quick_reply",
    buttonParamsJson: JSON.stringify({
      display_text: "🗼 Uji Stamina di Menara",
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
  });
  const successText = `Hi ${userName}!\nKonsumsi bekal pemulih berhasil digunakan.\n\n` + `–  *P E M U L I H A N  V I T A L*\n\n` + `┌  ◦  *Item Dikonsumsi* : ${item.name} (x${qty})\n` + `${item.hp > 0 ? `│  ◦  *Health (HP)* : ${hpBefore} ➔ ${user.hp}/${user.hpMax} (+${realHpGained})\n` : ""}` + `${item.mana > 0 ? `│  ◦  *Mana (MP)* : ${manaBefore} ➔ ${user.mana}/${user.manaMax} (+${realManaGained})\n` : ""}` + `└  ◦  *Sisa di Tas* : ${inv[itemKey]} Buah\n\n` + `Tenaga karakter terasa kembali segar untuk melanjutkan pertempuran!`;
  const options = {
    image: buffer,
    params: {
      bottom_sheet: {
        in_thread_buttons_limit: 2,
        list_title: "Recovery Actions",
        button_title: "Aksi Selanjutnya"
      }
    },
    contextInfo: {
      mentionedJid: [sender]
    }
  };
  if (typeof ctx.sendCta === "function") return await ctx.sendCta(successText, "Wudysoft • Vitality Recovery", buttons, options);
  return await sock.sendMessage(ctx.id, {
    image: buffer,
    caption: successText,
    mentions: [sender]
  }, {
    quoted: msg
  });
}
export default {
  name: "use",
  aliases: ["pakai", "consume", "makan", "minum", "heal"],
  description: "Mengonsumsi makanan, hidangan dapur, atau ramuan pemulih HP & Mana dengan Dynamic HTML Canvas",
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
      if (/^[.#/!]?(use|pakai|consume|makan|minum|heal)\s+[a-zA-Z0-9_]+/i.test(text)) {
        return await handleUseAction(sock, ctx, msg, sender, text);
      }
    } catch (e) {
      console.error("[USE BEFORE ERROR]:", e);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      db.ensureUser(ctx.sender, ctx.pushname);
      const user = global.db.user[ctx.sender];
      const prefix = ctx.prefix || ".";
      const itemKey = ctx.args[0]?.toLowerCase().replace(/\s+/g, "_");
      const qty = Math.max(1, parseInt(ctx.args[1]) || 1);
      const userName = ctx.pushname || ctx.sender.split("@")[0];
      if (itemKey && USABLE_ITEMS[itemKey]) {
        return await handleUseAction(sock, ctx, msg, ctx.sender, `${prefix}use ${itemKey} ${qty}`);
      }
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
            title: "🍽️ PILIH MAKANAN / RAMUAN DARI TAS",
            sections: [{
              title: `Bekal Milikmu (${ownedRows.length} Jenis)`,
              rows: ownedRows
            }]
          })
        });
      }
      buttons.push({
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "⛺ Istirahat (.rest)",
          id: `${prefix}rest`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🍳 Masak di Dapur (.cook)",
          id: `${prefix}cook`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🎒 Buka Inventory",
          id: `${prefix}inv`
        })
      });
      const menuText = `Hi ${userName}!\nKonsumsi perbekalan makanan atau ramuan untuk memulihkan daya tahan karaktermu.\n\n` + `–  *K O N D I S I  V I T A L*\n\n` + `┌  ◦  *Player* : @${ctx.sender.split("@")[0]}\n` + `│  ◦  *Health* : ${user.hp || 100} / ${user.hpMax || 100} HP\n` + `│  ◦  *Mana* : ${user.mana || 50} / ${user.manaMax || 50} MP\n` + `└  ◦  *Bekal Tersedia* : ${ownedRows.length} Jenis di dalam Tas\n\n` + `${ownedRows.length > 0 ? "Pilih makanan atau ramuan dari menu dropdown di bawah untuk langsung mengonsumsinya:" : "Kamu tidak memiliki makanan atau ramuan pemulih di dalam tas. Masak di *.cook* atau belanja di *.shop*!"}`;
      const options = {
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 2,
            list_title: "Consumable Inventory",
            button_title: "Pilih Makanan / Potion"
          }
        },
        contextInfo: {
          mentionedJid: [ctx.sender]
        }
      };
      if (typeof ctx.sendCta === "function") return await ctx.sendCta(menuText, "Wudysoft • Recovery Center", buttons, options);
      return await sock.sendMessage(ctx.id, {
        text: menuText,
        mentions: [ctx.sender]
      }, {
        quoted: msg
      });
    } catch (err) {
      console.error("[USE ERROR]", err);
      ctx.reply(`❌ Terjadi kendala saat menggunakan item: ${err.message}`);
    }
  }
};