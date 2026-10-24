import axios from "axios";
import db from "../../data/db.js";
const VEIN_TYPES = [{
  id: "iron_cluster",
  name: "Urat Besi Murni",
  icon: "⛓️",
  drop: "iron",
  qty: [2, 5],
  exp: 25,
  danger: 0
}, {
  id: "gold_seam",
  name: "Lapisan Emas Berkilau",
  icon: "🪙",
  drop: "gold",
  qty: [2, 4],
  exp: 50,
  danger: 10
}, {
  id: "geode_diamond",
  name: "Geoda Berlian Purba",
  icon: "💎",
  drop: "diamond",
  qty: [1, 2],
  exp: 120,
  danger: 25
}, {
  id: "platinum_fossil",
  name: "Batuan Inti Platinum",
  icon: "💠",
  drop: "platinum",
  qty: [1, 1],
  exp: 250,
  danger: 35
}, {
  id: "ancient_chest",
  name: "Peti Harta Karun Tertimbun",
  icon: "📦",
  drop: "crate",
  crateType: "uncommon",
  exp: 80,
  danger: 15
}];

function generateCavernHTML(data) {
  const {
    playerName,
    depth,
    pickaxeName,
    pickaxeBonus,
    stamina,
    veins,
    minecart,
    coalCount,
    statusText
  } = data;
  let veinsHTML = "";
  veins.forEach((v, idx) => {
    veinsHTML += `
      <div class="vein-card">
        <div class="vein-badge">URAT #${idx + 1}</div>
        <div class="vein-icon">${v.icon}</div>
        <div class="vein-name">${v.name}</div>
        <div class="vein-meta">
          <span>Kedalaman: ${depth * 45}m</span>
          <span style="color: ${v.danger > 20 ? "#f56565" : "#ecc94b"};">Bahaya: ${v.danger}%</span>
        </div>
      </div>
    `;
  });
  const oresDisplay = Object.entries(minecart.ores || {}).filter(([_, q]) => q > 0).map(([k, q]) => `<span>💎 ${q}x ${k.toUpperCase()}</span>`).join(" ") || "<i>(Gerobak Kosong)</i>";
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 960px;
      height: 540px;
      background: #090605;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: #fff;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .cavern-frame {
      width: 960px;
      height: 540px;
      background: radial-gradient(circle at 50% 25%, #2a1b12 0%, #150c07 65%, #080402 100%);
      border: 8px solid #281409;
      outline: 2px solid #b7791f;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 24px 30px;
      box-shadow: inset 0 0 100px rgba(0,0,0,0.95);
      position: relative;
    }
    /* Top Header */
    .top-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid rgba(183, 121, 31, 0.4);
      padding-bottom: 12px;
    }
    .cavern-title {
      font-size: 24px;
      font-weight: 900;
      color: #ecc94b;
      letter-spacing: 2px;
      text-transform: uppercase;
      text-shadow: 0 0 12px rgba(236, 201, 75, 0.6);
    }
    .depth-badge {
      background: rgba(0,0,0,0.7);
      border: 1.5px solid #d69e2e;
      color: #fefcbf;
      padding: 5px 18px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 800;
    }

    /* Main Grid */
    .main-grid {
      display: grid;
      grid-template-columns: 280px 1fr;
      gap: 24px;
      align-items: center;
      margin: 10px 0;
    }

    /* Left Panel: Miner Kit */
    .miner-panel {
      background: rgba(21, 12, 7, 0.85);
      border: 2px solid rgba(183, 121, 31, 0.4);
      border-radius: 16px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.8);
    }
    .panel-header { font-size: 12px; font-weight: 800; color: #d69e2e; letter-spacing: 1.2px; text-transform: uppercase; }
    .tool-box {
      background: rgba(0,0,0,0.6);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 10px;
      padding: 10px 12px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .tool-icon { font-size: 28px; }
    .tool-meta { display: flex; flex-direction: column; }
    .tool-name { font-size: 14px; font-weight: 800; color: #fff; }
    .tool-bonus { font-size: 11px; font-weight: 700; color: #48bb78; }

    .stamina-container { display: flex; flex-direction: column; gap: 4px; }
    .stamina-label { display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; color: #cbd5e0; }
    .bar-shell {
      width: 100%;
      height: 14px;
      background: #100804;
      border-radius: 7px;
      border: 1px solid rgba(255,255,255,0.15);
      overflow: hidden;
    }
    .bar-fill {
      height: 100%;
      background: linear-gradient(90deg, #dd6b20, #ecc94b);
      border-radius: 7px;
    }

    .dynamite-stock {
      background: rgba(197, 48, 48, 0.2);
      border: 1px solid #e53e3e;
      border-radius: 10px;
      padding: 8px 12px;
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      font-weight: 800;
      color: #feb2b2;
    }

    /* Vein Targets Grid */
    .veins-container {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
    }
    .vein-card {
      background: rgba(26, 15, 9, 0.9);
      border: 2px solid rgba(183, 121, 31, 0.4);
      border-radius: 16px;
      padding: 20px 14px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      box-shadow: 0 8px 20px rgba(0,0,0,0.7);
      position: relative;
    }
    .vein-badge {
      background: #b7791f;
      color: #000;
      font-size: 9px;
      font-weight: 900;
      padding: 2px 10px;
      border-radius: 8px;
      letter-spacing: 0.8px;
    }
    .vein-icon { font-size: 42px; filter: drop-shadow(0 0 14px rgba(236, 201, 75, 0.4)); }
    .vein-name { font-size: 13px; font-weight: 800; color: #f7fafc; text-align: center; height: 34px; }
    .vein-meta {
      width: 100%;
      border-top: 1px solid rgba(255,255,255,0.1);
      padding-top: 8px;
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      font-weight: 700;
      color: #a0aec0;
    }

    /* Minecart Tray */
    .cart-tray {
      background: rgba(0, 0, 0, 0.7);
      border: 1px solid rgba(183, 121, 31, 0.35);
      border-radius: 12px;
      padding: 10px 18px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 13px;
    }
    .cart-title { font-weight: 800; color: #ecc94b; letter-spacing: 1px; }
    .cart-loot { display: flex; gap: 14px; font-weight: 700; color: #e2e8f0; }
  </style>
</head>
<body>
  <div class="cavern-frame">
    <div class="top-header">
      <div class="cavern-title">⛏️ DEEP CAVERN EXCAVATION ⛏️</div>
      <div class="depth-badge">KEDALAMAN: ${depth * 45} METER</div>
    </div>

    <div class="main-grid">
      <!-- Miner Kit -->
      <div class="miner-panel">
        <div class="panel-header">PERLENGKAPAN TAMBANG</div>
        <div class="tool-box">
          <div class="tool-icon">⛏️</div>
          <div class="tool-meta">
            <span class="tool-name">${pickaxeName}</span>
            <span class="tool-bonus">${pickaxeBonus}</span>
          </div>
        </div>

        <div class="stamina-container">
          <div class="stamina-label">
            <span>OKSIGEN / STAMINA</span>
            <span>${stamina}%</span>
          </div>
          <div class="bar-shell"><div class="bar-fill" style="width: ${stamina}%;"></div></div>
        </div>

        <div class="dynamite-stock">
          <span>🧨 Amunisi Dinamit:</span>
          <span>${coalCount >= 2 ? "✅ Siap Racik" : `❌ Butuh 2 Coal (${coalCount}/2)`}</span>
        </div>
      </div>

      <!-- 3 Mining Veins -->
      <div class="veins-container">
        ${veinsHTML}
      </div>
    </div>

    <!-- Minecart Tray -->
    <div class="cart-tray">
      <div class="cart-title">🛒 GEROBAK TAMBANG SEMENTARA</div>
      <div class="cart-loot">
        ${oresDisplay}
      </div>
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
  if (!global.db.cavern) global.db.cavern = {};
  if (jid && !global.db.user[jid]) db.ensureUser(jid, name);
}

function saveDB() {
  if (typeof db?.write === "function" && global.db) db.write(global.db);
}

function cleanExpiredSessions(sender = null) {
  if (!global.db?.cavern) return;
  const now = Date.now();
  for (const [id, s] of Object.entries(global.db.cavern)) {
    if (s?.expireTime && now > s.expireTime) delete global.db.cavern[id];
  }
  if (sender && global.db.cavern[sender] && now > global.db.cavern[sender].expireTime) {
    delete global.db.cavern[sender];
  }
  saveDB();
}

function generateThreeVeins(depth) {
  const pool = [...VEIN_TYPES];
  return [0, 1, 2].map(() => {
    const roll = Math.random();
    if (depth >= 4 && roll < .25) return pool[3];
    if (depth >= 2 && roll < .45) return pool[2];
    if (roll < .7) return pool[1];
    return pool[0];
  });
}
async function renderCavernHUD(user, session, userName, statusMsg = "") {
  const hasDiaPickaxe = (user.inventory?.tools?.pickaxe_diamond || 0) > 0;
  const hasIronPickaxe = (user.inventory?.tools?.pickaxe_iron || 0) > 0;
  const pickaxeName = hasDiaPickaxe ? "Diamond Pickaxe" : hasIronPickaxe ? "Iron Pickaxe" : "Tangan Kosong";
  const pickaxeBonus = hasDiaPickaxe ? "+120% Bonus Yield" : hasIronPickaxe ? "+50% Bonus Yield" : "Yield Dasar (1x)";
  const html = generateCavernHTML({
    playerName: userName,
    depth: session.depth,
    pickaxeName: pickaxeName,
    pickaxeBonus: pickaxeBonus,
    stamina: session.stamina,
    veins: session.veins,
    minecart: session.minecart,
    coalCount: user.inventory?.ores?.coal || 0,
    statusText: statusMsg
  });
  return await renderHtmlToImage(html);
}
async function sendCavernCTA(sock, ctx, targetId, {
  text,
  footer,
  buttons = [],
  imageBuffer = null,
  mentions = []
}) {
  const botName = global.bot?.name || "WudysoftBot";
  const finalFooter = footer || `${botName} • Deep Mine Cavern`;
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
        list_title: `${botName} • Aksi Penggalian`,
        button_title: "Opsi Galian"
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
async function handleCavernAction(sock, ctx, msg, sender, rawText) {
  initDB(sender, ctx?.pushName || "");
  cleanExpiredSessions(sender);
  const session = global.db.cavern[sender];
  if (!session || session.state !== "DIGGING") return;
  const parts = rawText.split(/\s+/);
  const action = (parts[1] || "").toLowerCase();
  const targetVein = parseInt(parts[2]) - 1;
  const prefix = ctx.prefix || ".";
  const user = global.db.user[sender];
  const userName = ctx.pushName || sender.split("@")[0];
  session.expireTime = Date.now() + 18e4;
  const hasDiaPickaxe = (user.inventory?.tools?.pickaxe_diamond || 0) > 0;
  const hasIronPickaxe = (user.inventory?.tools?.pickaxe_iron || 0) > 0;
  const toolMultiplier = hasDiaPickaxe ? 2.2 : hasIronPickaxe ? 1.5 : 1;
  if (action === "dig" || action === "gali") {
    if (isNaN(targetVein) || targetVein < 0 || targetVein > 2) {
      return ctx.reply("❌ Pilih nomor urat yang valid (1, 2, atau 3).");
    }
    const vein = session.veins[targetVein];
    session.stamina = Math.max(0, session.stamina - 20);
    const baseQty = Math.floor(Math.random() * (vein.qty[1] - vein.qty[0] + 1)) + vein.qty[0];
    const finalQty = Math.max(1, Math.round(baseQty * toolMultiplier));
    session.minecart.ores[vein.drop] = (session.minecart.ores[vein.drop] || 0) + finalQty;
    session.minecart.exp += vein.exp;
    let log = `⛏️ *@${sender.split("@")[0]}* menghantam ${vein.name}!\n` + `📦 Diperoleh: *+${finalQty}x ${vein.drop.toUpperCase()}* & +${vein.exp} XP ke dalam gerobak.\n`;
    if (Math.random() * 100 < vein.danger) {
      const dmg = 15;
      user.hp = Math.max(1, (user.hp || 100) - dmg);
      log += `⚠️ *Gua Runtuh!* Serpihan stalaktit menimpamu sebesar -${dmg} HP (Sisa: ${user.hp}/${user.hpMax}).\n`;
    }
    if (session.stamina <= 0) {
      return await claimMinecart(sock, ctx, sender, user, session, prefix, userName, "Oksigen dan stamina telah menipis. Kamu otomatis kembali ke permukaan membawa muatan!");
    }
    session.depth += 1;
    session.veins = generateThreeVeins(session.depth);
    saveDB();
    const hud = await renderCavernHUD(user, session, userName, `Berhasil menambang urat #${targetVein + 1}. Masuk ke kedalaman ${session.depth * 45}m!`);
    const buttons = [{
      display_text: "⛏️ Gali Urat #1",
      id: `${prefix}cavern dig 1`
    }, {
      display_text: "⛏️ Gali Urat #2",
      id: `${prefix}cavern dig 2`
    }, {
      display_text: "⛏️ Gali Urat #3",
      id: `${prefix}cavern dig 3`
    }, {
      display_text: "🧨 Ledakkan Dinamit",
      id: `${prefix}cavern dynamite`
    }, {
      display_text: "🛒 Angkut ke Permukaan",
      id: `${prefix}cavern claim`
    }];
    return await sendCavernCTA(sock, ctx, ctx.id, {
      text: `${log}\nKedalaman bertambah menjadi *${session.depth * 45} Meter*.\nPilih urat galian berikutnya atau angkut hasil galian:`,
      buttons: buttons,
      imageBuffer: hud.buffer,
      mentions: [sender]
    });
  }
  if (action === "dynamite" || action === "ledakkan") {
    const coalOwned = user.inventory?.ores?.coal || 0;
    if (coalOwned < 2) {
      return ctx.reply(`❌ Batu bara tidak cukup! Butuh *2x Coal* untuk meracik dinamit (Milikmu: ${coalOwned}x).\nDapatkan batu bara dari tambang biasa via *${prefix}mine*!`);
    }
    user.inventory.ores.coal -= 2;
    let dynamiteLog = `💥 *KABOOOM!* Dinamit berdaya ledak tinggi menghancurkan seluruh dinding gua!\n`;
    session.veins.forEach(v => {
      const qty = Math.max(1, Math.round(v.qty[1] * toolMultiplier));
      session.minecart.ores[v.drop] = (session.minecart.ores[v.drop] || 0) + qty;
      session.minecart.exp += v.exp;
      dynamiteLog += `• +${qty}x ${v.drop.toUpperCase()}\n`;
    });
    session.stamina = Math.max(0, session.stamina - 15);
    session.depth += 2;
    session.veins = generateThreeVeins(session.depth);
    saveDB();
    const hud = await renderCavernHUD(user, session, userName, "Ledakan dahsyat membuka lorong gua sedalam 90 meter lebih dalam!");
    const buttons = [{
      display_text: "⛏️ Lanjut Gali Urat #1",
      id: `${prefix}cavern dig 1`
    }, {
      display_text: "⛏️ Lanjut Gali Urat #2",
      id: `${prefix}cavern dig 2`
    }, {
      display_text: "🛒 Angkut ke Permukaan",
      id: `${prefix}cavern claim`
    }];
    return await sendCavernCTA(sock, ctx, ctx.id, {
      text: `${dynamiteLog}\nLorong terbuka menembus kedalaman *${session.depth * 45} Meter*!`,
      buttons: buttons,
      imageBuffer: hud.buffer,
      mentions: [sender]
    });
  }
  if (action === "claim" || action === "angkut" || action === "keluar") {
    return await claimMinecart(sock, ctx, sender, user, session, prefix, userName, "Ekspedisi selesai! Seluruh mineral berhasil dibawa keluar dengan selamat.");
  }
}
async function claimMinecart(sock, ctx, sender, user, session, prefix, userName, reasonText) {
  const cart = session.minecart;
  user.exp = (Number(user.exp) || 0) + cart.exp;
  user.inventory = user.inventory || {};
  user.inventory.ores = user.inventory.ores || {};
  for (const [ore, qty] of Object.entries(cart.ores || {})) {
    user.inventory.ores[ore] = (user.inventory.ores[ore] || 0) + qty;
  }
  const depthReached = session.depth * 45;
  delete global.db.cavern[sender];
  saveDB();
  const mineralsList = Object.entries(cart.ores).map(([k, v]) => `• ${v}x ${k.toUpperCase()}`).join("\n") || "• Tidak ada mineral terkumpul.";
  const exitText = `🛒 *HASIL EKSPEDISI GUA BAWAH TANAH* 🛒\n\n` + `${reasonText}\n\n` + `┌  ◦  *Kedalaman Akhir* : ${depthReached} Meter\n` + `├  ◦  *Total EXP Didapat* : +${cart.exp} XP\n` + `└  ◦  *Mineral Terangkut* :\n${mineralsList}\n\n` + `Semua mineral telah tersimpan di tas inventaris (*${prefix}inv*) dan siap ditempa di pandai besi (*${prefix}forge*)!`;
  const exitButtons = [{
    display_text: "🎒 Buka Inventory",
    id: `${prefix}inv`
  }, {
    display_text: "🔥 Tempa Mineral (.forge)",
    id: `${prefix}forge`
  }];
  return await sendCavernCTA(sock, ctx, ctx.id, {
    text: exitText,
    buttons: exitButtons,
    mentions: [sender]
  });
}
export default {
  name: "cavern",
  aliases: ["goa", "deepmine", "ekspedisi"],
  description: "Menggali terowongan tambang bawah tanah interaktif dengan Dynamic HTML Canvas",
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
      if (/^[.#/!]?cavern\s+(dig|gali|dynamite|ledakkan|claim|angkut|keluar)/i.test(text)) {
        return await handleCavernAction(sock, ctx, msg, sender, text);
      }
    } catch (e) {
      console.error("[CAVERN BEFORE ERROR]:", e);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      const sender = ctx.sender;
      const prefix = ctx.prefix || ".";
      const userName = ctx.pushName || sender.split("@")[0];
      initDB(sender, userName);
      cleanExpiredSessions(sender);
      const user = global.db.user[sender];
      if ((user.hp || 0) < 20) {
        return ctx.reply(`❌ Darahmu terlalu sekarat (*${user.hp}/${user.hpMax} HP*). Beristirahatlah dengan *${prefix}rest* sebelum masuk ke gua berbahaya!`);
      }
      if (global.db.cavern[sender]) {
        return ctx.reply(`⚠️ Kamu sedang berada di dalam gua tambang! Ketik *${prefix}cavern dig 1* untuk menggali atau *${prefix}cavern claim* untuk naik ke permukaan.`);
      }
      global.db.cavern[sender] = {
        sessionId: Date.now(),
        state: "DIGGING",
        depth: 1,
        stamina: 100,
        veins: generateThreeVeins(1),
        minecart: {
          ores: {},
          exp: 0
        },
        expireTime: Date.now() + 18e4
      };
      saveDB();
      const hud = await renderCavernHUD(user, global.db.cavern[sender], userName, "Memasuki pintu masuk gua bawah tanah...");
      const startButtons = [{
        display_text: "⛏️ Gali Urat #1",
        id: `${prefix}cavern dig 1`
      }, {
        display_text: "⛏️ Gali Urat #2",
        id: `${prefix}cavern dig 2`
      }, {
        display_text: "⛏️ Gali Urat #3",
        id: `${prefix}cavern dig 3`
      }, {
        display_text: "🛒 Angkut Keluar",
        id: `${prefix}cavern claim`
      }];
      const introText = `⛏️ *PINTU GUA TAMBANG PURBA TERBUKA!* ⛏️\n\n` + `Petualang @${userName} menyalakan lentera dan melangkah masuk ke dalam perut bumi.\n` + `• Kedalaman Awal: 45 Meter\n` + `• Stamina/Oksigen: 100%\n\n` + `_Pilih urat mineral di hadapanmu untuk mulai menggali:_`;
      await sendCavernCTA(sock, ctx, ctx.id, {
        text: introText,
        buttons: startButtons,
        imageBuffer: hud.buffer,
        mentions: [sender]
      });
    } catch (err) {
      console.error("[CAVERN EXECUTE ERROR]:", err);
      ctx.reply(`❌ Terjadi kendala saat memasuki gua: ${err.message}`);
    }
  }
};