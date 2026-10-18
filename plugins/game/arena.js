import axios from "axios";
import db from "../../data/db.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";

function initDB(jid = null, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.arena) global.db.arena = {};
  if (jid && !jid.includes("BOT") && !global.db.user[jid]) {
    global.db.user[jid] = {
      name: name || "",
      money: 1e4,
      exp: 0
    };
  }
}

function saveDB() {
  if (typeof db?.write === "function" && global.db) {
    db.write(global.db);
  }
}

function clearSession(chatId) {
  if (global.db?.arena?.[chatId]) {
    delete global.db.arena[chatId];
    saveDB();
  }
}

function rewardPlayer(jid, name = "", prizeMoney = 15e3, prizeExp = 450) {
  if (!jid || jid.includes("BOT")) return;
  initDB(jid, name);
  global.db.user[jid].money = (Number(global.db.user[jid].money) || 0) + prizeMoney;
  global.db.user[jid].exp = (Number(global.db.user[jid].exp) || 0) + prizeExp;
  saveDB();
}

function cleanExpiredArena(currentChatId = null) {
  if (!global.db?.arena) return;
  const now = Date.now();
  let changed = false;
  for (const [cId, session] of Object.entries(global.db.arena)) {
    const isExpired = session?.expireTime && now > session.expireTime;
    const isCorrupt = !session || !session.state || !session.players && !session.heroes;
    if (isExpired || isCorrupt) {
      delete global.db.arena[cId];
      changed = true;
    }
  }
  if (currentChatId && global.db.arena[currentChatId]) {
    const s = global.db.arena[currentChatId];
    if (s.expireTime && now > s.expireTime) {
      delete global.db.arena[currentChatId];
      changed = true;
    }
  }
  if (changed) saveDB();
}

function purgePlayerFromOtherParties(playerJid) {
  if (!global.db?.arena || !playerJid) return;
  let changed = false;
  for (const [cId, session] of Object.entries(global.db.arena)) {
    if (session.state === "LOBBY") {
      if (session.host === playerJid) {
        delete global.db.arena[cId];
        changed = true;
      } else if (Array.isArray(session.players)) {
        const idx = session.players.indexOf(playerJid);
        if (idx !== -1) {
          session.players.splice(idx, 1);
          changed = true;
        }
      }
    }
  }
  if (changed) saveDB();
}
const MONSTER_POOL = [{
  name: "Infernal Dragon",
  avatar: "🐉",
  hp: 1200,
  maxHp: 1200,
  atk: 110,
  def: 20,
  rewardMoney: 18e3,
  rewardExp: 500
}, {
  name: "Abyssal Demon King",
  avatar: "👹",
  hp: 950,
  maxHp: 950,
  atk: 125,
  def: 15,
  rewardMoney: 15e3,
  rewardExp: 420
}, {
  name: "Ancient Golem",
  avatar: "🗿",
  hp: 1500,
  maxHp: 1500,
  atk: 75,
  def: 35,
  rewardMoney: 2e4,
  rewardExp: 600
}, {
  name: "Shadow Assassin",
  avatar: "🥷",
  hp: 800,
  maxHp: 800,
  atk: 140,
  def: 10,
  rewardMoney: 14e3,
  rewardExp: 380
}];
const HERO_SKILLS = [{
  id: "strike",
  name: "🗡️ Heavy Slash",
  desc: "Serangan fisik berdaya rusak 140%",
  mpCost: 15,
  multiplier: 1.4
}, {
  id: "fireball",
  name: "🔥 Meteor Burst",
  desc: "Sihir api penghancur (180% DMG)",
  mpCost: 30,
  multiplier: 1.8
}, {
  id: "heal",
  name: "✨ Holy Light",
  desc: "Memulihkan 250 HP instan",
  mpCost: 25,
  heal: 250
}, {
  id: "shield",
  name: "🛡️ Aegis Guard",
  desc: "Kebal 50% damage selama 1 putaran",
  mpCost: 20,
  shield: true
}];
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

function generateBattleHTML(session) {
  const enemy = session.enemy;
  const enemyHpPct = Math.max(0, Math.min(100, Math.round(enemy.hp / enemy.maxHp * 100)));
  const isEnemyTurn = session.turn === "ENEMY";
  let heroesHTML = "";
  session.heroes.forEach(h => {
    const isTurn = h.id === session.turn;
    const hpPct = Math.max(0, Math.min(100, Math.round(h.hp / h.maxHp * 100)));
    const mpPct = Math.max(0, Math.min(100, Math.round(h.mp / h.maxMp * 100)));
    const rawName = h.name || h.id.split("@")[0];
    const cleanName = rawName.length > 12 ? rawName.slice(0, 10) + ".." : rawName;
    heroesHTML += `
      <div class="hero-pod ${isTurn ? "active-hero" : ""} ${h.hp <= 0 ? "dead-hero" : ""}">
        <div class="hero-header">
          <div class="hero-avatar">${h.hp <= 0 ? "💀" : "🧙‍♂️"}</div>
          <div class="hero-name">${cleanName}</div>
        </div>
        <div class="bar-group">
          <div class="bar-label"><span>HP</span> <span>${h.hp}/${h.maxHp}</span></div>
          <div class="bar-bg"><div class="bar-fill hp-fill" style="width: ${hpPct}%;"></div></div>
        </div>
        <div class="bar-group">
          <div class="bar-label"><span>MP</span> <span>${h.mp}/${h.maxMp}</span></div>
          <div class="bar-bg"><div class="bar-fill mp-fill" style="width: ${mpPct}%;"></div></div>
        </div>
        ${isTurn ? '<div class="turn-tag">🔥 GILIRAN</div>' : ""}
      </div>
    `;
  });
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 1040px;
      height: auto;
      background: #050207;
      font-family: 'Segoe UI', Arial, sans-serif;
    }
    .arena-frame {
      width: 100%;
      height: auto;
      min-height: 580px;
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      align-items: center;
      background: radial-gradient(circle at 50% 20%, #200f1c 0%, #0d0711 60%, #050207 100%);
      border: 14px solid #3c1e08;
      border-radius: 28px;
      padding: 24px;
      box-shadow: inset 0 0 60px rgba(0,0,0,0.9), 0 10px 30px rgba(0,0,0,0.8);
    }
    .arena-header {
      width: 100%;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid rgba(220, 150, 40, 0.3);
      padding-bottom: 14px;
    }
    .arena-title {
      font-size: 26px;
      font-weight: 900;
      color: #ffd166;
      letter-spacing: 2px;
      text-transform: uppercase;
      text-shadow: 0 0 12px rgba(255, 209, 102, 0.6);
    }
    .round-tag {
      background: rgba(0,0,0,0.6);
      border: 2px solid #ef476f;
      color: #fff;
      padding: 6px 18px;
      border-radius: 12px;
      font-size: 15px;
      font-weight: 800;
    }
    .enemy-card {
      display: flex;
      align-items: center;
      gap: 22px;
      background: rgba(20, 10, 25, 0.85);
      border: 2px solid ${isEnemyTurn ? "#ffd166" : "#ff477e"};
      border-radius: 20px;
      padding: 16px 36px;
      box-shadow: 0 0 25px ${isEnemyTurn ? "rgba(255, 209, 102, 0.6)" : "rgba(255, 71, 126, 0.4)"};
      margin: 18px 0;
      width: 80%;
      position: relative;
    }
    .enemy-turn-badge {
      position: absolute;
      top: -12px;
      right: 20px;
      background: #ff477e;
      color: #fff;
      font-size: 11px;
      font-weight: 900;
      padding: 3px 10px;
      border-radius: 8px;
      letter-spacing: 0.5px;
      box-shadow: 0 0 10px rgba(255, 71, 126, 0.8);
    }
    .enemy-avatar {
      font-size: 64px;
      filter: drop-shadow(0 0 10px rgba(255, 71, 126, 0.8));
    }
    .enemy-info { flex: 1; display: flex; flex-direction: column; gap: 8px; }
    .enemy-name { font-size: 24px; font-weight: 800; color: #fff; text-shadow: 0 2px 4px #000; }
    .battle-log {
      width: 90%;
      background: rgba(0, 0, 0, 0.55);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 12px;
      padding: 12px 20px;
      font-size: 14px;
      color: #f7eed2;
      text-align: center;
      font-style: italic;
      min-height: 44px;
      margin-bottom: 6px;
    }
    .heroes-container {
      display: flex;
      justify-content: center;
      gap: 16px;
      width: 100%;
      flex-wrap: wrap;
      margin-top: 14px;
    }
    .hero-pod {
      width: 220px;
      background: rgba(15, 25, 35, 0.85);
      border: 2px solid rgba(80, 150, 220, 0.4);
      border-radius: 16px;
      padding: 12px 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      position: relative;
      box-shadow: 0 5px 15px rgba(0,0,0,0.5);
    }
    .hero-pod.active-hero {
      border: 2px solid #ffd166;
      box-shadow: 0 0 18px rgba(255, 209, 102, 0.7);
      background: linear-gradient(145deg, rgba(30, 45, 60, 0.95), rgba(15, 25, 35, 0.95));
      transform: translateY(-4px);
    }
    .hero-pod.dead-hero {
      opacity: 0.4;
      filter: grayscale(1);
    }
    .hero-header { display: flex; align-items: center; gap: 10px; }
    .hero-avatar { font-size: 26px; }
    .hero-name { font-size: 15px; font-weight: 800; color: #fff; }
    .turn-tag {
      position: absolute;
      top: -10px;
      right: 12px;
      background: #ffd166;
      color: #000;
      font-size: 10px;
      font-weight: 900;
      padding: 2px 8px;
      border-radius: 8px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.6);
    }
    .bar-group { display: flex; flex-direction: column; gap: 3px; }
    .bar-label { display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; color: #ccc; }
    .bar-bg { width: 100%; height: 8px; background: rgba(0,0,0,0.7); border-radius: 4px; overflow: hidden; }
    .bar-fill { height: 100%; transition: width 0.3s; }
    .hp-fill { background: linear-gradient(90deg, #ff4d6d, #d90429); }
    .mp-fill { background: linear-gradient(90deg, #4ea8de, #0077b6); }
  </style>
</head>
<body>
  <div class="arena-frame">
    <div class="arena-header">
      <div class="arena-title">⚔️ DUNGEON RAID ARENA ⚔️</div>
      <div class="round-tag">ROUND: ${session.round || 1}</div>
    </div>

    <div class="enemy-card">
      ${isEnemyTurn ? '<div class="enemy-turn-badge">BOSS SERANG!</div>' : ""}
      <div class="enemy-avatar">${enemy.avatar}</div>
      <div class="enemy-info">
        <div class="enemy-name">${enemy.name}</div>
        <div class="bar-group">
          <div class="bar-label"><span>HEALTH</span> <span>${enemy.hp} / ${enemy.maxHp}</span></div>
          <div class="bar-bg" style="height: 12px;"><div class="bar-fill hp-fill" style="width: ${enemyHpPct}%;"></div></div>
        </div>
      </div>
    </div>

    <div class="battle-log">
      📢 ${session.lastLog || "Pertarungan sengit telah dimulai! Tentukan langkah seranganmu."}
    </div>

    <div class="heroes-container">
      ${heroesHTML}
    </div>
  </div>
</body>
</html>`;
}
async function sendCTA(sock, ctx, targetId, {
  text,
  footer,
  buttons = [],
  image = null,
  quoted = null,
  mentions = []
}) {
  const botName = global.bot?.name || "WudysoftBot";
  const finalFooter = footer || `${botName} • RPG Gladiator`;
  const formattedButtons = buttons.map(b => {
    if (b.buttonParamsJson) return b;
    if (b.name === "cta_url") {
      return {
        name: "cta_url",
        buttonParamsJson: JSON.stringify({
          display_text: b.display_text || b.text || "Buka Tautan",
          url: b.url || ""
        })
      };
    }
    if (b.type === "list" || b.name === "single_select") {
      return {
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: b.title || "PILIH AKSI",
          sections: b.sections || []
        })
      };
    }
    return {
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: b.display_text || b.text || "Klik",
        id: b.id || b.command || ""
      })
    };
  });
  const options = {
    image: image || undefined,
    params: {
      bottom_sheet: {
        in_thread_buttons_limit: 1,
        divider_indices: [1],
        list_title: `${botName} • Gladiator Arena`,
        button_title: "Aksi Bertarung"
      }
    },
    contextInfo: {
      forwardingScore: 999,
      isForwarded: true,
      mentionedJid: mentions || []
    },
    quoted: quoted || undefined
  };
  if (typeof ctx?.sendCta === "function" && (!targetId || targetId === ctx?.id)) {
    try {
      return await ctx.sendCta(text, finalFooter, formattedButtons, options);
    } catch (e) {
      console.error("[sendCTA ctx error]:", e?.message || e);
    }
  }
  try {
    const interactiveMessage = {
      body: {
        text: text
      },
      footer: {
        text: finalFooter
      },
      nativeFlowMessage: {
        buttons: formattedButtons
      },
      contextInfo: options.contextInfo
    };
    if (image) {
      if (Buffer.isBuffer(image)) {
        interactiveMessage.header = {
          hasMediaAttachment: true,
          imageMessage: (await sock.sendMessage(targetId, {
            image: image
          }, {
            quoted: null
          })).message.imageMessage
        };
      } else if (typeof image === "string" && /^https?:\/\//i.test(image)) {
        interactiveMessage.header = {
          hasMediaAttachment: true,
          imageMessage: {
            url: image
          }
        };
      }
    }
    return await sock.sendMessage(targetId, {
      viewOnceMessage: {
        message: {
          interactiveMessage: interactiveMessage
        }
      }
    }, {
      quoted: options.quoted
    });
  } catch (err) {
    if (image) {
      const mediaPayload = Buffer.isBuffer(image) ? {
        image: image
      } : {
        image: {
          url: image
        }
      };
      return await sock.sendMessage(targetId, {
        ...mediaPayload,
        caption: `${text}\n\n_${finalFooter}_`,
        mentions: mentions
      }, {
        quoted: options.quoted
      });
    }
    return await sock.sendMessage(targetId, {
      text: `${text}\n\n_${finalFooter}_`,
      mentions: mentions
    }, {
      quoted: options.quoted
    });
  }
}
async function announceBattleArena(sock, ctx, chatId, session, prefix = ".") {
  const {
    buffer: imgBuffer
  } = await renderHtmlToImage(generateBattleHTML(session));
  const isEnemyTurn = session.turn === "ENEMY";
  const currentHero = session.heroes.find(h => h.id === session.turn);
  const isTurnSender = currentHero ? `@${currentHero.id.split("@")[0]}` : "👹 Monster Boss";
  const skillRows = HERO_SKILLS.map(s => ({
    title: s.name,
    id: `${prefix}arena skill ${s.id} ${chatId}`,
    description: `MP: ${s.mpCost} | ${s.desc}`
  }));
  const buttons = [{
    name: "quick_reply",
    buttonParamsJson: JSON.stringify({
      display_text: "⚔️ Serang Fisik",
      id: `${prefix}arena atk ${chatId}`
    })
  }, {
    name: "single_select",
    buttonParamsJson: JSON.stringify({
      title: "🔮 PILIH SKILL / MANTRA",
      sections: [{
        title: "DAFTAR ILMU KESAKTIAN",
        rows: skillRows
      }]
    })
  }, {
    name: "quick_reply",
    buttonParamsJson: JSON.stringify({
      display_text: "🛡️ Bertahan (Defend)",
      id: `${prefix}arena def ${chatId}`
    })
  }, {
    name: "quick_reply",
    buttonParamsJson: JSON.stringify({
      display_text: "🏳️ Menyerah",
      id: `${prefix}arena surrender ${chatId}`
    })
  }];
  const captionText = `🔥 *MEDAN PERTEMPURAN BERGELORA!* 🔥\n\n` + `👹 *Boss:* ${session.enemy.name} (HP: ${session.enemy.hp}/${session.enemy.maxHp})\n` + `🎯 *Giliran Beraksi:* ${isTurnSender}\n\n` + `_Klik tombol interaktif di bawah untuk menyerang atau merapal sihir!_`;
  await sendCTA(sock, ctx, chatId, {
    text: captionText,
    buttons: buttons,
    image: imgBuffer,
    mentions: session.heroes.map(h => h.id)
  });
}
async function handleEnemyTurn(sock, ctx, chatId, session, prefix = ".") {
  const currentSessionId = session?.sessionId;
  setTimeout(async () => {
    try {
      const active = global.db.arena?.[chatId];
      if (!active || active.sessionId !== currentSessionId || active.state !== "PLAYING") {
        return;
      }
      const aliveHeroes = active.heroes.filter(h => h.hp > 0);
      if (aliveHeroes.length === 0) return;
      const targetHero = aliveHeroes[Math.floor(Math.random() * aliveHeroes.length)];
      let enemyDmg = Math.floor(active.enemy.atk * (.85 + Math.random() * .3));
      if (targetHero.isShielded) {
        enemyDmg = Math.floor(enemyDmg * .5);
        targetHero.isShielded = false;
      }
      targetHero.hp = Math.max(0, targetHero.hp - enemyDmg);
      active.lastLog = `💥 ${active.enemy.name} melancarkan serangan dahsyat dan mengenai @${targetHero.id.split("@")[0]} sebesar -${enemyDmg} DMG!`;
      const remainingHeroes = active.heroes.filter(h => h.hp > 0);
      if (remainingHeroes.length === 0) {
        clearSession(chatId);
        const retryButtons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "⚔️ Mulai Pertarungan Baru",
            id: `${prefix}arena`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "👹 Solo Boss Hunt",
            id: `${prefix}arena solo`
          })
        }];
        return await sendCTA(sock, ctx, chatId, {
          text: `💀 *DEFEAT! SEMUA PAHLAWAN GUGUR!* 💀\n\n${active.enemy.name} tertawa terbahak-bahak melihat kehancuran party kalian. Tingkatkan kekuatan dan coba lagi nanti!`,
          buttons: retryButtons
        });
      }
      active.turn = remainingHeroes[0].id;
      active.round = (active.round || 1) + 1;
      active.expireTime = Date.now() + 6e5;
      saveDB();
      await announceBattleArena(sock, ctx, chatId, active, prefix);
    } catch (e) {
      console.error("[ENEMY TURN ERROR]:", e);
    }
  }, 1800);
}
async function handleArenaAction(sock, ctx, msg, sender, rawText) {
  initDB(sender, ctx?.pushName || "");
  cleanExpiredArena();
  const parts = rawText.split(/\s+/);
  const action = (parts[1] || "").toLowerCase();
  let targetChatId = parts.find(p => p && p.endsWith("@g.us"));
  if (!targetChatId || !global.db.arena[targetChatId]) {
    for (const [cId, sess] of Object.entries(global.db.arena)) {
      if (sess.heroes?.some(h => h.id === sender) || sess.players?.includes(sender)) {
        targetChatId = cId;
        break;
      }
    }
  }
  if (!targetChatId) targetChatId = ctx?.id;
  const session = global.db.arena[targetChatId];
  if (!session) {
    return ctx?.reply ? ctx.reply("❌ Tidak ada arena bertarung aktif di room ini.") : null;
  }
  const prefix = ctx?.prefix || ".";
  if (action === "surrender" || action === "nyerah" || action === "stop") {
    clearSession(targetChatId);
    const restartButtons = [{
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: "⚔️ Mulai Ulang Arena",
        id: `${prefix}arena`
      })
    }];
    return await sendCTA(sock, ctx, targetChatId, {
      text: `🏳️ Pertarungan dihentikan karena @${sender.split("@")[0]} memutuskan untuk kabur dari medan tempur. Ruangan telah dibersihkan!`,
      buttons: restartButtons,
      mentions: [sender]
    });
  }
  if (session.state !== "PLAYING") return;
  if (session.turn === "ENEMY") {
    return sock.sendMessage(sender, {
      text: "⏳ Tunggu sebentar! Boss musuh sedang melancarkan serangan balasan..."
    });
  }
  if (session.turn !== sender) {
    return sock.sendMessage(sender, {
      text: "⏳ Bukan giliranmu untuk melancarkan serangan! Tunggu giliran kawanmu."
    });
  }
  const currentHero = session.heroes.find(h => h.id === sender);
  if (!currentHero || currentHero.hp <= 0) return;
  if (action === "atk") {
    const isCrit = Math.random() < .25;
    let dmg = Math.floor(currentHero.atk * (.9 + Math.random() * .25));
    if (isCrit) dmg = Math.floor(dmg * 1.6);
    session.enemy.hp = Math.max(0, session.enemy.hp - dmg);
    currentHero.mp = Math.min(currentHero.maxMp, currentHero.mp + 10);
    session.lastLog = `🗡️ @${sender.split("@")[0]} menebaskan pedang ${isCrit ? "🔥 *CRITICAL STRIKE!*" : ""} menghasilkan -${dmg} DMG ke ${session.enemy.name}!`;
  }
  if (action === "skill") {
    const skillId = parts[2];
    const skill = HERO_SKILLS.find(s => s.id === skillId);
    if (!skill) return;
    if (currentHero.mp < skill.mpCost) {
      return sock.sendMessage(sender, {
        text: `❌ Mana tidak cukup! Kamu membutuhkan setidaknya ${skill.mpCost} MP.`
      });
    }
    currentHero.mp -= skill.mpCost;
    if (skill.heal) {
      currentHero.hp = Math.min(currentHero.maxHp, currentHero.hp + skill.heal);
      session.lastLog = `✨ @${sender.split("@")[0]} melafalkan Holy Light dan memulihkan +${skill.heal} HP!`;
    } else if (skill.shield) {
      currentHero.isShielded = true;
      session.lastLog = `🛡️ @${sender.split("@")[0]} mengaktifkan Aegis Guard! Pertahanan meningkat 50%.`;
    } else {
      const dmg = Math.floor(currentHero.atk * skill.multiplier);
      session.enemy.hp = Math.max(0, session.enemy.hp - dmg);
      session.lastLog = `💥 @${sender.split("@")[0]} melepaskan ${skill.name} dan melibas musuh sebesar -${dmg} DMG!`;
    }
  }
  if (action === "def") {
    currentHero.isShielded = true;
    currentHero.mp = Math.min(currentHero.maxMp, currentHero.mp + 15);
    session.lastLog = `🛡️ @${sender.split("@")[0]} mengambil posisi bertahan penuh (+15 MP)!`;
  }
  session.expireTime = Date.now() + 6e5;
  saveDB();
  if (session.enemy.hp <= 0) {
    const moneyWin = session.enemy.rewardMoney || 18e3;
    const expWin = session.enemy.rewardExp || 500;
    session.heroes.forEach(h => {
      rewardPlayer(h.id, h.name, moneyWin, expWin);
    });
    clearSession(targetChatId);
    const victoryButtons = [{
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: "⚔️ Berburu Boss Lagi",
        id: `${prefix}arena solo`
      })
    }, {
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: "👥 Buka Raid Party",
        id: `${prefix}arena`
      })
    }];
    return await sendCTA(sock, ctx, targetChatId, {
      text: `🏆 *VICTORY! MONSTER BERHASIL DITUMBANGKAN!* 🏆\n\n` + `Pahlawan telah membersihkan dungeon dari amukan *${session.enemy.name}*!\n\n` + `🎁 *Hadiah Tiap Anggota:* +Rp ${moneyWin.toLocaleString("id-ID")} Money & +${expWin} EXP!`,
      buttons: victoryButtons,
      mentions: session.heroes.map(h => h.id)
    });
  }
  const aliveHeroes = session.heroes.filter(h => h.hp > 0);
  const currentIdx = aliveHeroes.findIndex(h => h.id === sender);
  if (currentIdx !== -1 && currentIdx < aliveHeroes.length - 1) {
    session.turn = aliveHeroes[currentIdx + 1].id;
    saveDB();
    await announceBattleArena(sock, ctx, targetChatId, session, prefix);
  } else {
    session.turn = "ENEMY";
    saveDB();
    await announceBattleArena(sock, ctx, targetChatId, session, prefix);
    await handleEnemyTurn(sock, ctx, targetChatId, session, prefix);
  }
}
async function startDungeonBattle(sock, ctx, chatId, playerIds, prefix = ".") {
  clearSession(chatId);
  const chosenMonster = JSON.parse(JSON.stringify(MONSTER_POOL[Math.floor(Math.random() * MONSTER_POOL.length)]));
  if (playerIds.length > 1) {
    chosenMonster.maxHp = Math.round(chosenMonster.maxHp * playerIds.length * .85);
    chosenMonster.hp = chosenMonster.maxHp;
  }
  const heroes = playerIds.map(pId => {
    initDB(pId);
    purgePlayerFromOtherParties(pId);
    return {
      id: pId,
      name: global.db?.user?.[pId]?.name || pId.split("@")[0],
      hp: 550,
      maxHp: 550,
      mp: 100,
      maxMp: 100,
      atk: 100,
      isShielded: false
    };
  });
  const now = Date.now();
  global.db.arena[chatId] = {
    sessionId: now,
    state: "PLAYING",
    enemy: chosenMonster,
    heroes: heroes,
    turn: heroes[0].id,
    round: 1,
    lastLog: "Medan perang bergetar menyambut kedatangan para gladiator!",
    expireTime: now + 6e5
  };
  saveDB();
  await announceBattleArena(sock, ctx, chatId, global.db.arena[chatId], prefix);
}
export default {
  name: "arena",
  aliases: ["gladiator", "raid", "rpgduel"],
  description: "Game RPG Dungeon Gladiator & Boss Raid Visual Full CTA",
  category: "Game",
  limit: true,
  example: ".arena | .arena solo | .arena @user",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      cleanExpiredArena();
      const sender = ctx?.sender || msg?.key?.participant || msg?.key?.remoteJid;
      const text = (ctx?.text || ctx?.query || msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "").trim();
      if (/^[.#/!]?arena\s+(atk|skill|def|surrender|stop)/i.test(text)) {
        return await handleArenaAction(sock, ctx, msg, sender, text);
      }
    } catch (e) {
      console.error("[ARENA BEFORE ERROR]:", e);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      const isGroup = Boolean(ctx?.isGroup || ctx?.id?.endsWith("@g.us"));
      if (!isGroup) {
        return ctx.reply("❌ *Gladiator Arena hanya dapat dimainkan di dalam Grup!*");
      }
      const chatId = ctx.id;
      const sender = ctx.sender;
      const senderName = ctx.pushName || "Gladiator";
      const rawText = (ctx.query || "").trim();
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const bannerImage = global.bot?.media?.banner1 || "https://files.catbox.moe/g2e6i5.jpg";
      initDB(sender, senderName);
      cleanExpiredArena(chatId);
      if (/^(atk|skill|def|surrender|stop)/i.test(rawText)) {
        return await handleArenaAction(sock, ctx, msg, sender, `${prefix}arena ${rawText}`);
      }
      if (rawText.toLowerCase() === "stop" || rawText.toLowerCase() === "reset") {
        if (global.db.arena[chatId]) {
          clearSession(chatId);
          const restartButtons = [{
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "⚔️ Mulai Arena Baru",
              id: `${prefix}arena`
            })
          }, {
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "👹 Solo Boss Hunt",
              id: `${prefix}arena solo`
            })
          }];
          return await sendCTA(sock, ctx, chatId, {
            text: "🚪 Sesi arena pertempuran telah dibersihkan secara tuntas.",
            buttons: restartButtons,
            quoted: quotedMsg
          });
        }
        return ctx.reply("❌ Tidak ada arena bertarung yang sedang aktif.");
      }
      if (rawText.toLowerCase() === "solo" || rawText.toLowerCase() === "hunt") {
        const existing = global.db.arena[chatId];
        if (existing && existing.state === "PLAYING") {
          return ctx.reply("⚠️ Masih ada pertarungan yang berjalan. Ketik `.arena stop` untuk menghentikan terlebih dahulu.");
        }
        return await startDungeonBattle(sock, ctx, chatId, [sender], prefix);
      }
      const mentioned = (ctx.mentionedJid || []).filter(id => id !== sender && !id.includes("bot"));
      if (mentioned.length > 0) {
        const existing = global.db.arena[chatId];
        if (existing && existing.state === "PLAYING") {
          return ctx.reply("⚠️ Sedang ada pertarungan di room ini. Ketik `.arena stop` terlebih dahulu.");
        }
        const party = [sender, ...new Set(mentioned)].slice(0, 4);
        return await startDungeonBattle(sock, ctx, chatId, party, prefix);
      }
      const activeSession = global.db.arena[chatId];
      if (rawText.toLowerCase() === "join" || rawText.toLowerCase() === "gabung") {
        if (!activeSession || activeSession.state !== "LOBBY") {
          return ctx.reply(`❌ Tidak ada Party Raid yang sedang terbuka. Buka lobby baru dengan \`${prefix}arena\``);
        }
        if (activeSession.players.includes(sender)) {
          return ctx.reply("⚠️ Kamu sudah bergabung di dalam party ini!");
        }
        if (activeSession.players.length >= 4) {
          return ctx.reply("❌ Party sudah penuh (Maksimal 4 Gladiator)!");
        }
        activeSession.players.push(sender);
        activeSession.expireTime = Date.now() + 12e4;
        saveDB();
        let joinText = `🤝 @${sender.split("@")[0]} bergabung ke Party Raid!\n\n*Daftar Pasukan (${activeSession.players.length}/4):*\n`;
        activeSession.players.forEach((p, idx) => {
          joinText += `${idx + 1}. @${p.split("@")[0]}\n`;
        });
        const lobbyButtons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🤝 Gabung Party",
            id: `${prefix}arena join`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "⚔️ Serbu Dungeon!",
            id: `${prefix}arena start`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🚪 Batal",
            id: `${prefix}arena stop`
          })
        }];
        return await sendCTA(sock, ctx, chatId, {
          text: joinText,
          buttons: lobbyButtons,
          mentions: activeSession.players
        });
      }
      if (rawText.toLowerCase() === "start" || rawText.toLowerCase() === "mulai") {
        if (!activeSession || activeSession.state !== "LOBBY") {
          return ctx.reply("❌ Tidak ada Party yang siap menyerang.");
        }
        if (activeSession.host !== sender) {
          return ctx.reply(`❌ Hanya Pemimpin Party (@${activeSession.host.split("@")[0]}) yang berhak memulai serangan!`, {
            mentions: [activeSession.host]
          });
        }
        return await startDungeonBattle(sock, ctx, chatId, activeSession.players, prefix);
      }
      if (activeSession) {
        if (activeSession.state === "PLAYING") {
          return ctx.reply("⚠️ Pertarungan sedang berlangsung! Ketik `.arena stop` untuk mengakhiri paksa.");
        }
        let lobbyText = `📢 *PARTY RAID ARENA MASIH TERBUKA!*\n👑 Pemimpin: @${activeSession.host.split("@")[0]}\n\n*Daftar Pasukan (${activeSession.players.length}/4):*\n`;
        activeSession.players.forEach((p, idx) => {
          lobbyText += `${idx + 1}. @${p.split("@")[0]}\n`;
        });
        lobbyText += `\n_Klik tombol di bawah untuk bergabung atau mulai!_`;
        const existingButtons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🤝 Gabung Party",
            id: `${prefix}arena join`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "⚔️ Serbu Dungeon!",
            id: `${prefix}arena start`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🚪 Batal",
            id: `${prefix}arena stop`
          })
        }];
        return await sendCTA(sock, ctx, chatId, {
          text: lobbyText,
          buttons: existingButtons,
          mentions: activeSession.players
        });
      }
      clearSession(chatId);
      purgePlayerFromOtherParties(sender);
      global.db.arena[chatId] = {
        sessionId: Date.now(),
        state: "LOBBY",
        host: sender,
        players: [sender],
        createdAt: Date.now(),
        expireTime: Date.now() + 12e4
      };
      saveDB();
      const lobbyBody = `⚔️ *LOBBY WORLD BOSS RAID (GLADIATOR ARENA)* ⚔️\n\n` + `• 👑 *Pemimpin Party:* @${sender.split("@")[0]}\n` + `• 👥 *Anggota Terkumpul:* 1/4 Pasukan\n\n` + `Ajak kawan-kawan grupmu bergabung untuk menaklukkan monster bawah tanah raksasa atau berburu solo!\n` + `_Waktu persiapan: 2 Menit._`;
      const lobbyButtons = [{
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🤝 Gabung Party (Join)",
          id: `${prefix}arena join`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "⚔️ Mulai Serbu Boss",
          id: `${prefix}arena start`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "👹 Berburu Solo (1v1)",
          id: `${prefix}arena solo`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🚪 Bubarkan Party",
          id: `${prefix}arena stop`
        })
      }];
      await sendCTA(sock, ctx, chatId, {
        text: lobbyBody,
        buttons: lobbyButtons,
        image: bannerImage,
        mentions: [sender],
        quoted: quotedMsg
      });
    } catch (err) {
      console.error("[ARENA EXECUTE ERROR]:", err);
      ctx.reply(`❌ Terjadi kesalahan: ${err.message}`);
    }
  }
};