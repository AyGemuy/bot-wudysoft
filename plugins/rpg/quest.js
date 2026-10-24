import axios from "axios";
import db from "../../data/db.js";
const GUILD_RANKS = [{
  rank: "F",
  title: "Novice Recruit",
  repMax: 100,
  salary: 5e3,
  color: "#a0aec0"
}, {
  rank: "E",
  title: "Apprentice Scout",
  repMax: 250,
  salary: 12e3,
  color: "#48bb78"
}, {
  rank: "D",
  title: "Bronze Mercenary",
  repMax: 500,
  salary: 25e3,
  color: "#4299e1"
}, {
  rank: "C",
  title: "Silver Knight",
  repMax: 1e3,
  salary: 5e4,
  color: "#9f7aea"
}, {
  rank: "B",
  title: "Gold Vanguard",
  repMax: 2e3,
  salary: 1e5,
  color: "#ecc94b"
}, {
  rank: "A",
  title: "Platinum Champion",
  repMax: 4e3,
  salary: 2e5,
  color: "#ed8936"
}, {
  rank: "S",
  title: "Mythic Grandmaster",
  repMax: 8e3,
  salary: 45e4,
  color: "#f56565"
}, {
  rank: "SSS",
  title: "Legendary Guild Sovereign",
  repMax: 99999,
  salary: 1e6,
  color: "#ffd700"
}];
const QUEST_POOL = [{
  id: "ore_supply",
  title: "Logistik Tambang Kerajaan",
  desc: "Setor 5x Biji Besi (Iron Ore) dari hasil menambang.",
  rewardGold: 2e4,
  rewardExp: 150,
  rewardRep: 35,
  check: u => (u.inventory?.ores?.iron || 0) >= 5,
  consume: u => {
    u.inventory.ores.iron -= 5;
  }
}, {
  id: "meat_supply",
  title: "Ransum Prajurit Hutan",
  desc: "Setor 3x Daging Segar (Meat) dari hasil berburu monster.",
  rewardGold: 18e3,
  rewardExp: 120,
  rewardRep: 30,
  check: u => (u.inventory?.material?.meat || 0) >= 3,
  consume: u => {
    u.inventory.material.meat -= 3;
  }
}, {
  id: "fish_feast",
  title: "Jamuan Meja Makan Guild",
  desc: "Setor 2x Ikan Tangkapan (Catfish / Tuna / Salmon).",
  rewardGold: 22e3,
  rewardExp: 160,
  rewardRep: 40,
  check: u => (u.inventory?.fish?.catfish || 0) + (u.inventory?.fish?.tuna || 0) + (u.inventory?.fish?.salmon || 0) >= 2,
  consume: u => {
    let needed = 2;
    for (const f of ["catfish", "tuna", "salmon"]) {
      const take = Math.min(needed, u.inventory?.fish?.[f] || 0);
      u.inventory.fish[f] -= take;
      needed -= take;
      if (needed <= 0) break;
    }
  }
}, {
  id: "forge_mastery",
  title: "Tanda Kemahiran Pandai Besi",
  desc: "Miliki minimal 1 senjata/armor dengan tempaan +2 Refine.",
  rewardGold: 35e3,
  rewardExp: 250,
  rewardRep: 50,
  check: u => Object.values(u.refine || {}).some(lvl => lvl >= 2),
  consume: () => {}
}, {
  id: "beast_companion",
  title: "Ikatan Makhluk Mistis",
  desc: "Miliki peliharaan mistis yang telah mencapai Level 3+.",
  rewardGold: 4e4,
  rewardExp: 300,
  rewardRep: 60,
  check: u => Boolean(u.pet && u.pet.level >= 3),
  consume: () => {}
}];

function generateQuestBoardHTML(data) {
  const {
    playerName,
    rankData,
    currentRep,
    quests
  } = data;
  const repPct = Math.max(0, Math.min(100, Math.round(currentRep / rankData.repMax * 100)));
  let parchmentsHTML = "";
  quests.forEach((q, idx) => {
    let stampClass = "";
    let stampText = "";
    if (q.claimed) {
      stampClass = "stamp-claimed";
      stampText = "CLAIMED";
    } else if (q.ready) {
      stampClass = "stamp-ready";
      stampText = "READY!";
    } else {
      stampClass = "stamp-ongoing";
      stampText = "IN PROGRESS";
    }
    parchmentsHTML += `
      <div class="parchment-card">
        <div class="pin"></div>
        <div class="seal-badge">#0${idx + 1}</div>
        <div class="quest-title">${q.title}</div>
        <div class="quest-desc">${q.desc}</div>

        <div class="quest-reward-box">
          <span>💰 Rp ${q.rewardGold.toLocaleString("id-ID")}</span>
          <span>✨ +${q.rewardExp} XP</span>
          <span>🎖️ +${q.rewardRep} REP</span>
        </div>

        <div class="stamp ${stampClass}">${stampText}</div>
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
      background: #110904;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: #fff;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .board-wood {
      width: 960px;
      height: 540px;
      background: radial-gradient(circle at 50% 50%, #3e2212 0%, #201007 70%, #0d0603 100%);
      border: 12px solid #281409;
      outline: 3px solid #8c5226;
      border-radius: 12px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 22px 28px;
      box-shadow: inset 0 0 80px rgba(0,0,0,0.9), 0 15px 35px rgba(0,0,0,0.8);
      position: relative;
    }
    /* Top Guild Banner */
    .guild-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid rgba(212, 175, 55, 0.4);
      padding-bottom: 12px;
    }
    .guild-title {
      font-size: 22px;
      font-weight: 900;
      color: #f6e27a;
      letter-spacing: 2px;
      text-transform: uppercase;
      text-shadow: 0 0 12px rgba(246, 226, 122, 0.5);
    }
    .rank-capsule {
      background: rgba(0,0,0,0.7);
      border: 2px solid ${rankData.color};
      color: ${rankData.color};
      padding: 4px 16px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 900;
      letter-spacing: 1px;
    }

    /* Rep Bar */
    .rep-container {
      width: 100%;
      height: 14px;
      background: #120904;
      border-radius: 7px;
      border: 1px solid rgba(255,255,255,0.2);
      overflow: hidden;
      margin-top: 6px;
    }
    .rep-fill {
      height: 100%;
      background: linear-gradient(90deg, #ecc94b, #f6e27a);
      border-radius: 7px;
    }

    /* Quests Grid */
    .quests-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin: 12px 0;
    }

    /* Realistic Parchment Card */
    .parchment-card {
      background: linear-gradient(135deg, #fffdf0 0%, #f7efd2 60%, #e2d2a4 100%);
      border: 1px solid #caba94;
      border-radius: 6px;
      padding: 20px 16px;
      color: #2b1708;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      height: 270px;
      box-shadow: 3px 6px 15px rgba(0,0,0,0.6);
      position: relative;
    }
    .pin {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: radial-gradient(circle at 35% 35%, #ffd700, #996515);
      border: 1px solid #4a3500;
      position: absolute;
      top: 8px;
      left: 50%;
      transform: translateX(-50%);
      box-shadow: 0 2px 4px rgba(0,0,0,0.5);
    }
    .seal-badge {
      font-size: 10px;
      font-weight: 900;
      color: #8c6808;
      letter-spacing: 1px;
      text-transform: uppercase;
      margin-top: 4px;
    }
    .quest-title {
      font-size: 16px;
      font-weight: 900;
      color: #3b1f0b;
      line-height: 1.3;
      margin-top: 4px;
    }
    .quest-desc {
      font-size: 11px;
      color: #5c4228;
      line-height: 1.4;
      font-weight: 600;
    }
    .quest-reward-box {
      background: rgba(140, 104, 8, 0.12);
      border-radius: 6px;
      padding: 6px 8px;
      display: flex;
      flex-direction: column;
      gap: 2px;
      font-size: 11px;
      font-weight: 800;
      color: #4a2800;
    }

    /* Stamp Effect */
    .stamp {
      position: absolute;
      bottom: 16px;
      right: 12px;
      font-size: 14px;
      font-weight: 900;
      padding: 4px 10px;
      border: 3px solid;
      border-radius: 6px;
      transform: rotate(-12deg);
      letter-spacing: 1.5px;
      text-transform: uppercase;
    }
    .stamp-claimed { color: #c53030; border-color: #c53030; opacity: 0.85; }
    .stamp-ready { color: #2f855a; border-color: #2f855a; animation: pulse 1.5s infinite; }
    .stamp-ongoing { color: #718096; border-color: #718096; opacity: 0.6; }

    /* Footer */
    .guild-footer {
      background: rgba(0,0,0,0.65);
      border: 1px solid rgba(212, 175, 55, 0.3);
      border-radius: 8px;
      padding: 8px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
      font-weight: 700;
      color: #e2e8f0;
    }
  </style>
</head>
<body>
  <div class="board-wood">
    <div>
      <div class="guild-header">
        <div class="guild-title">📜 ADVENTURER'S GUILD NOTICE BOARD</div>
        <div class="rank-capsule">RANK ${rankData.rank} • ${rankData.title}</div>
      </div>
      <div class="rep-container">
        <div class="rep-fill" style="width: ${repPct}%;"></div>
      </div>
    </div>

    <!-- 3 Pinned Parchments -->
    <div class="quests-grid">
      ${parchmentsHTML}
    </div>

    <!-- Guild Bottom Bar -->
    <div class="guild-footer">
      <span>Petualang: <b>${playerName}</b> (Reputasi: ${currentRep}/${rankData.repMax} REP)</span>
      <span style="color: #ecc94b;">Gaji Harian Pangkat: Rp ${rankData.salary.toLocaleString("id-ID")}</span>
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

function ensureDailyQuests(user) {
  user.guild = user.guild || {
    rankIndex: 0,
    rep: 0,
    lastReset: 0,
    activeQuests: []
  };
  const now = Date.now();
  const ONE_DAY = 24 * 60 * 60 * 1e3;
  if (now - user.guild.lastReset > ONE_DAY || user.guild.activeQuests.length === 0) {
    const shuffled = [...QUEST_POOL].sort(() => Math.random() - .5).slice(0, 3);
    user.guild.activeQuests = shuffled.map(q => ({
      id: q.id,
      claimed: false
    }));
    user.guild.lastReset = now;
    saveDB();
  }
}
async function sendQuestCTA(sock, ctx, targetId, {
  text,
  footer,
  buttons = [],
  imageBuffer = null,
  mentions = []
}) {
  const botName = global.bot?.name || "WudysoftBot";
  const finalFooter = footer || `${botName} • Adventurer's Guild`;
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
        list_title: `${botName} • Papan Misi Guild`,
        button_title: "Aksi Guild"
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
async function handleQuestAction(sock, ctx, msg, sender, rawText) {
  initDB(sender, ctx?.pushName || "");
  const user = global.db.user[sender];
  ensureDailyQuests(user);
  const parts = rawText.split(/\s+/);
  const action = (parts[1] || "").toLowerCase();
  const targetIndex = parseInt(parts[2]) - 1;
  const prefix = ctx.prefix || ".";
  const userName = ctx.pushName || sender.split("@")[0];
  if (action === "claim" || action === "klaim") {
    if (isNaN(targetIndex) || targetIndex < 0 || targetIndex >= user.guild.activeQuests.length) {
      return ctx.reply("❌ Pilihan nomor misi tidak valid.");
    }
    const questSession = user.guild.activeQuests[targetIndex];
    if (questSession.claimed) {
      return ctx.reply("⚠️ Misi ini sudah pernah kamu klaim hari ini.");
    }
    const questData = QUEST_POOL.find(q => q.id === questSession.id);
    if (!questData) return ctx.reply("❌ Misi kadaluarsa.");
    if (!questData.check(user)) {
      return ctx.reply(`❌ Syarat belum terpenuhi!\n\n📌 *Misi:* ${questData.title}\n🎯 *Tugas:* ${questData.desc}\n\nLakukan aktivitasnya terlebih dahulu melalui perintah RPG lainnya!`);
    }
    questData.consume(user);
    questSession.claimed = true;
    user.money = (Number(user.money) || 0) + questData.rewardGold;
    user.exp = (Number(user.exp) || 0) + questData.rewardExp;
    user.guild.rep = (Number(user.guild.rep) || 0) + questData.rewardRep;
    const currentRank = GUILD_RANKS[user.guild.rankIndex || 0];
    let rankUpMsg = "";
    if (user.guild.rep >= currentRank.repMax && user.guild.rankIndex < GUILD_RANKS.length - 1) {
      user.guild.rankIndex += 1;
      const newRank = GUILD_RANKS[user.guild.rankIndex];
      rankUpMsg = `\n\n🎉 *KENAIKAN PANGKAT GUILD!* 🎉\nSelamat! Reputasimu diakui oleh Guild Master!\nPangkatmu naik ke: *RANK ${newRank.rank} (${newRank.title})*! Gaji harianmu meningkat.`;
    }
    saveDB();
    const hud = await renderGuildBoardHUD(user, userName);
    const buttons = [{
      display_text: "📜 Lihat Misi Lain",
      id: `${prefix}quest`
    }, {
      display_text: "🎒 Cek Tas (.inv)",
      id: `${prefix}inv`
    }];
    const claimNotice = `✅ *MISI GUILD BERHASIL DISELESAIKAN!* ✅\n\n` + `Kamu telah menuntaskan: *${questData.title}*\n` + `• Imbalan Emas: +Rp ${questData.rewardGold.toLocaleString("id-ID")}\n` + `• Pengalaman: +${questData.rewardExp} EXP\n` + `• Reputasi Guild: +${questData.rewardRep} REP${rankUpMsg}`;
    return await sendQuestCTA(sock, ctx, ctx.id, {
      text: claimNotice,
      buttons: buttons,
      imageBuffer: hud.buffer,
      mentions: [sender]
    });
  }
  if (action === "salary" || action === "gaji") {
    const now = Date.now();
    user.guild.lastSalary = user.guild.lastSalary || 0;
    const COOLDOWN_SALARY = 24 * 60 * 60 * 1e3;
    if (now - user.guild.lastSalary < COOLDOWN_SALARY) {
      const sisa = COOLDOWN_SALARY - (now - user.guild.lastSalary);
      const h = Math.floor(sisa / 36e5);
      const m = Math.floor(sisa % 36e5 / 6e4);
      return ctx.reply(`⏳ Kamu sudah mengambil gaji hari ini. Tunggu *${h} jam ${m} menit* lagi.`);
    }
    const rank = GUILD_RANKS[user.guild.rankIndex || 0];
    user.money = (Number(user.money) || 0) + rank.salary;
    user.guild.lastSalary = now;
    saveDB();
    return ctx.reply(`🪙 *GAJI KEHORMATAN GUILD DICAIRKAN!*\n\nSebagai anggota *Rank ${rank.rank} (${rank.title})*, kamu menerima tunjangan harian sebesar *+Rp ${rank.salary.toLocaleString("id-ID")}*!`);
  }
}
async function renderGuildBoardHUD(user, userName) {
  const rankData = GUILD_RANKS[user.guild.rankIndex || 0];
  const questsWithState = user.guild.activeQuests.map(qObj => {
    const qData = QUEST_POOL.find(q => q.id === qObj.id);
    return {
      title: qData.title,
      desc: qData.desc,
      rewardGold: qData.rewardGold,
      rewardExp: qData.rewardExp,
      rewardRep: qData.rewardRep,
      claimed: qObj.claimed,
      ready: qData.check(user)
    };
  });
  const html = generateQuestBoardHTML({
    playerName: userName,
    rankData: rankData,
    currentRep: user.guild.rep || 0,
    quests: questsWithState
  });
  return await renderHtmlToImage(html);
}
export default {
  name: "quest",
  aliases: ["guild", "bounty", "misi"],
  description: "Papan Misi Guild Petualang yang menghubungkan seluruh aktivitas RPG",
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
      if (/^[.#/!]?quest\s+(claim|klaim|salary|gaji)/i.test(text)) {
        return await handleQuestAction(sock, ctx, msg, sender, text);
      }
    } catch (e) {
      console.error("[QUEST BEFORE ERROR]:", e);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      const sender = ctx.sender;
      const prefix = ctx.prefix || ".";
      const userName = ctx.pushName || sender.split("@")[0];
      initDB(sender, userName);
      const user = global.db.user[sender];
      ensureDailyQuests(user);
      const hud = await renderGuildBoardHUD(user, userName);
      const buttons = [];
      user.guild.activeQuests.forEach((q, idx) => {
        const qData = QUEST_POOL.find(item => item.id === q.id);
        if (!q.claimed) {
          const isReady = qData.check(user);
          buttons.push({
            display_text: `${isReady ? "✅" : "⏳"} Klaim Misi #${idx + 1}`,
            id: `${prefix}quest claim ${idx + 1}`
          });
        }
      });
      buttons.push({
        display_text: "🪙 Ambil Gaji Rank",
        id: `${prefix}quest salary`
      });
      const rank = GUILD_RANKS[user.guild.rankIndex || 0];
      const bodyText = `📜 *PAPAN MISI GUILD PETUALANG* 📜\n\n` + `• 👤 *Petualang:* @${userName}\n` + `• 🎖️ *Pangkat Guild:* Rank ${rank.rank} (${rank.title})\n` + `• ⭐ *Reputasi:* ${user.guild.rep}/${rank.repMax} REP\n` + `• 💰 *Gaji Harian:* Rp ${rank.salary.toLocaleString("id-ID")}\n\n` + `_Selesaikan misi di atas menggunakan hasil tambang, pancingan, buruan, tempaan, atau peliharaanmu!_`;
      await sendQuestCTA(sock, ctx, ctx.id, {
        text: bodyText,
        buttons: buttons,
        imageBuffer: hud.buffer,
        mentions: [sender]
      });
    } catch (err) {
      console.error("[QUEST EXECUTE ERROR]:", err);
      ctx.reply(`❌ Terjadi kendala pada papan guild: ${err.message}`);
    }
  }
};