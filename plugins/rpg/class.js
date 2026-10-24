import axios from "axios";
import db from "../../data/db.js";
const CLASSES = {
  warrior: {
    name: "Berserker Warrior",
    icon: "⚔️",
    desc: "Pejuang garis depan dengan tebasan fisik mematikan.",
    bonusAtk: 45,
    bonusDef: 15,
    bonusHp: 150,
    bonusMp: 0,
    skill: "Bloodlust Strike (Lifesteal 20%)"
  },
  mage: {
    name: "Archmage Elementalist",
    icon: "🔮",
    desc: "Penyihir agung pengendali elemen dan kapasitas mana raksasa.",
    bonusAtk: 60,
    bonusDef: 5,
    bonusHp: 50,
    bonusMp: 200,
    skill: "Meteor Fall (AoE Magic Burst)"
  },
  archer: {
    name: "Shadow Ranger",
    icon: "🏹",
    desc: "Penembak jitu berkecepatan tinggi dengan serangan kritikal akurat.",
    bonusAtk: 40,
    bonusDef: 10,
    bonusHp: 80,
    bonusMp: 60,
    skill: "Deadly Snipe (Critical Rate +35%)"
  },
  paladin: {
    name: "Holy Crusader",
    icon: "🛡️",
    desc: "Ksatria suci bertameng baja yang hampir mustahil ditembus musuh.",
    bonusAtk: 25,
    bonusDef: 45,
    bonusHp: 300,
    bonusMp: 80,
    skill: "Divine Barrier (Reflect 30% DMG)"
  }
};

function generateClassHTML(data) {
  const {
    playerName,
    currentClass,
    classes
  } = data;
  let cardsHTML = "";
  for (const [key, c] of Object.entries(classes)) {
    const isSelected = currentClass === key;
    cardsHTML += `
      <div class="class-card ${isSelected ? "selected" : ""}">
        <div class="class-badge">${isSelected ? "AKTIF SAAT INI" : "TERSEDIA"}</div>
        <div class="class-icon">${c.icon}</div>
        <div class="class-name">${c.name}</div>
        <div class="class-desc">${c.desc}</div>
        <div class="stat-pills">
          <span>⚔️ +${c.bonusAtk} ATK</span>
          <span>🛡️ +${c.bonusDef} DEF</span>
          <span>🩸 +${c.bonusHp} HP</span>
          <span>🔷 +${c.bonusMp} MP</span>
        </div>
        <div class="skill-tag">⚡ ${c.skill}</div>
      </div>
    `;
  }
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { width: 960px; height: 540px; background: #08090e; font-family: 'Segoe UI', Tahoma, sans-serif; color: #fff; display: flex; justify-content: center; align-items: center; }
    .canvas { width: 960px; height: 540px; background: radial-gradient(circle at 50% 20%, #171c2b 0%, #090c13 70%, #040508 100%); border: 8px solid #1a233a; outline: 2px solid #4299e1; padding: 24px 30px; display: flex; flex-direction: column; justify-content: space-between; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid rgba(66, 153, 225, 0.4); padding-bottom: 12px; }
    .title { font-size: 24px; font-weight: 900; color: #63b3ed; letter-spacing: 2px; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin: 12px 0; }
    .class-card { background: rgba(18, 24, 38, 0.85); border: 1.5px solid rgba(66, 153, 225, 0.3); border-radius: 14px; padding: 14px 12px; display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; position: relative; }
    .class-card.selected { border-color: #ecc94b; box-shadow: 0 0 20px rgba(236, 201, 75, 0.4); }
    .class-badge { font-size: 9px; font-weight: 900; background: #2b6cb0; padding: 2px 8px; border-radius: 8px; }
    .class-card.selected .class-badge { background: #d69e2e; color: #000; }
    .class-icon { font-size: 38px; margin: 2px 0; }
    .class-name { font-size: 13px; font-weight: 900; color: #fff; }
    .class-desc { font-size: 10px; color: #a0aec0; height: 32px; }
    .stat-pills { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 9px; font-weight: 800; color: #bee3f8; width: 100%; }
    .skill-tag { background: rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 4px; font-size: 9px; font-weight: 700; color: #ecc94b; width: 100%; margin-top: 4px; }
    .footer { background: rgba(0,0,0,0.7); border: 1px solid rgba(66, 153, 225, 0.3); border-radius: 10px; padding: 8px 16px; font-size: 12px; display: flex; justify-content: space-between; }
  </style>
</head>
<body>
  <div class="canvas">
    <div class="header">
      <div class="title">⚔️ AWAKENING CLASS HALL ⚔️</div>
      <div style="font-weight: 800; color: #bee3f8;">HERO: ${playerName}</div>
    </div>
    <div class="grid">${cardsHTML}</div>
    <div class="footer">
      <span>Ganti job class membutuhkan biaya <b>Rp 100.000</b>.</span>
      <span style="color: #63b3ed; font-weight: 800;">STATUS PASIF PERMANEN</span>
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
  name: "class",
  aliases: ["job", "awakening", "profesi"],
  description: "Memilih spesialisasi Class karakter RPG untuk memperoleh buff stat masif",
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
      if (/^[.#/!]?class\s+(pick|pilih|warrior|mage|archer|paladin)/i.test(text)) {
        const parts = text.split(/\s+/);
        const target = (parts[2] || parts[1]).toLowerCase();
        if (!CLASSES[target]) return;
        db.ensureUser(sender, ctx.pushName);
        const user = global.db.user[sender];
        const prefix = ctx.prefix || ".";
        if (user.jobClass === target) {
          return ctx.reply(`⚠️ Kamu sudah mengemban profesi *${CLASSES[target].name}*!`);
        }
        const cost = user.jobClass ? 1e5 : 0;
        if (user.money < cost) {
          return ctx.reply(`❌ Biaya ganti class adalah *Rp ${cost.toLocaleString("id-ID")}* (Saldo: Rp ${(user.money || 0).toLocaleString("id-ID")}).`);
        }
        user.money -= cost;
        user.jobClass = target;
        db.write(global.db);
        const c = CLASSES[target];
        return ctx.reply(`🎉 *CLASS AWAKENING BERHASIL!* 🎉\n\nKamu kini resmi menjadi *${c.name}*!\n• +${c.bonusAtk} ATK | +${c.bonusDef} DEF\n• +${c.bonusHp} Max HP | +${c.bonusMp} Max MP\n• Skill Pasif: *${c.skill}*!`);
      }
    } catch (e) {
      console.error("[CLASS BEFORE ERROR]:", e);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      db.ensureUser(ctx.sender, ctx.pushname);
      const user = global.db.user[ctx.sender];
      const prefix = ctx.prefix || ".";
      const userName = ctx.pushname || ctx.sender.split("@")[0];
      const html = generateClassHTML({
        playerName: userName,
        currentClass: user.jobClass || null,
        classes: CLASSES
      });
      const {
        buffer
      } = await renderHtmlToImage(html);
      const buttons = [{
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "⚔️ Warrior",
          id: `${prefix}class warrior`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🔮 Mage",
          id: `${prefix}class mage`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🏹 Archer",
          id: `${prefix}class archer`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🛡️ Paladin",
          id: `${prefix}class paladin`
        })
      }];
      const text = `⚔️ *AULA SPESIALISASI CLASS KARAKTER* ⚔️\n\n` + `• 👤 *Player:* @${userName}\n` + `• 🎖️ *Class Aktif:* ${user.jobClass ? CLASSES[user.jobClass].name : "Belum Memilih Class"}\n\n` + `_Pilih class di bawah untuk mengaktifkan pohon kekuatanmu:_`;
      const options = {
        image: buffer,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 2,
            list_title: "Class List",
            button_title: "Opsi Profesi"
          }
        },
        contextInfo: {
          mentionedJid: [ctx.sender]
        }
      };
      if (typeof ctx.sendCta === "function") return await ctx.sendCta(text, "Wudysoft • Class System", buttons, options);
      return await sock.sendMessage(ctx.id, {
        image: buffer,
        caption: text,
        mentions: [ctx.sender]
      }, {
        quoted: msg
      });
    } catch (err) {
      ctx.reply(`❌ Error: ${err.message}`);
    }
  }
};