import axios from "axios";
import db from "../../data/db.js";

function initClanDB() {
  if (!global.db) global.db = {};
  if (!global.db.clans) global.db.clans = {};
}

function generateClanHTML(clan) {
  let membersList = (clan.members || []).slice(0, 5).map(m => `<span>• @${m.split("@")[0]}</span>`).join("<br>");
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { width: 960px; height: 540px; background: #0c080e; font-family: 'Segoe UI', sans-serif; color: #fff; display: flex; justify-content: center; align-items: center; }
    .canvas { width: 960px; height: 540px; background: radial-gradient(circle at 50% 20%, #2b1130 0%, #130717 70%, #060208 100%); border: 8px solid #230d29; outline: 2px solid #b794f4; padding: 24px 32px; display: flex; flex-direction: column; justify-content: space-between; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid rgba(183, 148, 244, 0.4); padding-bottom: 12px; }
    .title { font-size: 24px; font-weight: 900; color: #d6bcfa; letter-spacing: 2px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 16px 0; }
    .panel { background: rgba(22, 10, 27, 0.85); border: 1.5px solid rgba(183, 148, 244, 0.3); border-radius: 14px; padding: 18px; display: flex; flex-direction: column; gap: 8px; font-size: 13px; }
    .treasury { font-size: 26px; font-weight: 900; color: #ecc94b; }
    .footer { background: rgba(0,0,0,0.7); border: 1px solid rgba(183, 148, 244, 0.3); border-radius: 10px; padding: 8px 16px; font-size: 12px; display: flex; justify-content: space-between; }
  </style>
</head>
<body>
  <div class="canvas">
    <div class="header">
      <div class="title">🏰 BENTENG KLAN: ${clan.name.toUpperCase()} 🏰</div>
      <div style="font-weight: 800; color: #d6bcfa;">LEVEL BENTENG: ${clan.level}</div>
    </div>
    <div class="grid">
      <div class="panel">
        <span style="font-weight: 800; color: #b794f4;">KAS BENDARA KLAN</span>
        <span class="treasury">🪙 Rp ${clan.treasury.toLocaleString("id-ID")}</span>
        <span style="color: #a0aec0; font-size: 11px;">Semakin banyak donasi, level benteng akan naik dan melipatgandakan buff anggota.</span>
      </div>
      <div class="panel">
        <span style="font-weight: 800; color: #b794f4;">ANGGOTA AKTIF (${clan.members.length}/10)</span>
        <div style="font-size: 12px; color: #e2e8f0; line-height: 1.6;">${membersList}</div>
      </div>
    </div>
    <div class="footer">
      <span>Pemimpin: @${clan.leader.split("@")[0]}</span>
      <span style="color: #b794f4; font-weight: 800;">BUFF KLAN: +${clan.level * 10}% EXP & GOLD DROP</span>
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
  name: "clan",
  aliases: ["klan", "guildwar", "benteng"],
  description: "Mendirikan klan bersama teman dan menaikkan level kas benteng aliansi",
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
      if (/^[.#/!]?clan\s+(create|donate|donasi)/i.test(text)) {
        initClanDB();
        db.ensureUser(sender, ctx.pushName);
        const user = global.db.user[sender];
        const parts = text.split(/\s+/);
        const action = parts[1].toLowerCase();
        if (action === "create") {
          const clanName = parts[2]?.toLowerCase();
          if (!clanName) return ctx.reply("Format: .clan create <NamaKlan>");
          if (user.clan) return ctx.reply("❌ Kamu sudah terdaftar di klan lain!");
          if ((user.money || 0) < 25e4) return ctx.reply("❌ Butuh Rp 250.000 untuk mendirikan bendera klan.");
          if (global.db.clans[clanName]) return ctx.reply("❌ Nama klan tersebut sudah dipakai!");
          user.money -= 25e4;
          user.clan = clanName;
          global.db.clans[clanName] = {
            name: clanName,
            leader: sender,
            level: 1,
            treasury: 0,
            members: [sender]
          };
          db.write(global.db);
          return ctx.reply(`🏰 *KLAN BERHASIL DIDIRIKAN!*\n\nKlan *${clanName.toUpperCase()}* resmi berdiri dengan @${sender.split("@")[0]} sebagai komandan!`, {
            mentions: [sender]
          });
        }
        if (action === "donate" || action === "donasi") {
          const amount = parseInt(parts[2]);
          if (!user.clan) return ctx.reply("❌ Kamu belum bergabung di klan manapun!");
          if (isNaN(amount) || amount <= 0 || (user.money || 0) < amount) {
            return ctx.reply("❌ Saldo tidak mencukupi untuk jumlah donasi tersebut.");
          }
          user.money -= amount;
          const clan = global.db.clans[user.clan];
          clan.treasury += amount;
          if (clan.treasury >= clan.level * 5e5) {
            clan.level += 1;
          }
          db.write(global.db);
          return ctx.reply(`🪙 *DONASI BENTENG BERHASIL!*\n\nMenyetor *Rp ${amount.toLocaleString("id-ID")}* ke kas klan *${clan.name.toUpperCase()}*!`);
        }
      }
    } catch (e) {
      console.error("[CLAN BEFORE ERROR]:", e);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      initClanDB();
      db.ensureUser(ctx.sender, ctx.pushname);
      const user = global.db.user[ctx.sender];
      const prefix = ctx.prefix || ".";
      if (!user.clan || !global.db.clans[user.clan]) {
        return ctx.reply(`🏰 *ALIANSI & KLAN RPG* 🏰\n\nKamu belum memiliki klan!\n• Buat Klan Baru (Rp 250k): *${prefix}clan create <NamaKlan>*\n• Donasi Kas: *${prefix}clan donate <Jumlah>*`);
      }
      const clan = global.db.clans[user.clan];
      const html = generateClanHTML(clan);
      const {
        buffer
      } = await renderHtmlToImage(html);
      const buttons = [{
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🪙 Donasi 50k",
          id: `${prefix}clan donate 50000`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🪙 Donasi 100k",
          id: `${prefix}clan donate 100000`
        })
      }];
      const text = `🏰 *INFORMASI MARKAS BENTENG KLAN* 🏰\n\n• Nama: *${clan.name.toUpperCase()}*\n• Level: Benteng Lv. ${clan.level}\n• Total Kas: Rp ${clan.treasury.toLocaleString("id-ID")}\n• Anggota: ${clan.members.length}/10 Petualang`;
      const options = {
        image: buffer,
        contextInfo: {
          mentionedJid: clan.members
        }
      };
      if (typeof ctx.sendCta === "function") return await ctx.sendCta(text, "Wudysoft • Clan System", buttons, options);
      return await sock.sendMessage(ctx.id, {
        image: buffer,
        caption: text
      }, {
        quoted: msg
      });
    } catch (err) {
      ctx.reply(`❌ Error: ${err.message}`);
    }
  }
};