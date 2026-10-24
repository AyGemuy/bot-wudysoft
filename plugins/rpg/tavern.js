import axios from "axios";
import db from "../../data/db.js";

function generateDiceHTML(pName, pRoll, bRoll, bet, isWin) {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { width: 960px; height: 540px; background: #0e0703; font-family: 'Segoe UI', sans-serif; color: #fff; display: flex; justify-content: center; align-items: center; }
    .canvas { width: 960px; height: 540px; background: radial-gradient(circle at 50% 20%, #361705 0%, #170a02 70%, #080301 100%); border: 8px solid #281409; outline: 2px solid #d97706; padding: 24px 32px; display: flex; flex-direction: column; justify-content: space-between; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid rgba(217, 119, 6, 0.4); padding-bottom: 12px; }
    .title { font-size: 24px; font-weight: 900; color: #fbd38d; letter-spacing: 2px; }
    .duel-area { display: flex; justify-content: space-around; align-items: center; margin: 20px 0; }
    .player-box { background: rgba(22, 10, 4, 0.9); border: 2px solid rgba(217, 119, 6, 0.4); border-radius: 16px; padding: 24px; display: flex; flex-direction: column; align-items: center; gap: 10px; width: 340px; }
    .dice-icon { font-size: 64px; }
    .dice-total { font-size: 28px; font-weight: 900; color: #ecc94b; }
    .result-badge { font-size: 22px; font-weight: 900; padding: 6px 24px; border-radius: 14px; text-transform: uppercase; }
    .win { background: #2f855a; color: #fff; }
    .lose { background: #9b2c2c; color: #fff; }
    .footer { background: rgba(0,0,0,0.7); border: 1px solid rgba(217, 119, 6, 0.3); border-radius: 10px; padding: 8px 16px; font-size: 13px; display: flex; justify-content: space-between; }
  </style>
</head>
<body>
  <div class="canvas">
    <div class="header">
      <div class="title">🎲 TAVERN LIAR'S DICE ARENA 🎲</div>
      <div style="font-weight: 800; color: #fbd38d;">TARUHAN: Rp ${bet.toLocaleString("id-ID")}</div>
    </div>
    <div class="duel-area">
      <div class="player-box">
        <div style="font-weight: 800; font-size: 16px;">👤 ${pName}</div>
        <div class="dice-icon">🎲</div>
        <div class="dice-total">${pRoll} POIN</div>
      </div>
      <div class="result-badge ${isWin ? "win" : "lose"}">${isWin ? "KAMU MENANG!" : "KURCACI MENANG!"}</div>
      <div class="player-box">
        <div style="font-weight: 800; font-size: 16px;">🧔 Kurcaci Barman</div>
        <div class="dice-icon">🎲</div>
        <div class="dice-total">${bRoll} POIN</div>
      </div>
    </div>
    <div class="footer">
      <span>Hasil taruhan langsung dihitung ke pundi emas.</span>
      <span style="color: #ecc94b; font-weight: 800;">${isWin ? `+Rp ${(bet * 2).toLocaleString("id-ID")}` : `-Rp ${bet.toLocaleString("id-ID")}`}</span>
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
  name: "tavern",
  aliases: ["dice", "dadu", "judi"],
  description: "Mini-game adu dadu di kedai petualang melawan Kurcaci Bar",
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
      if (/^[.#/!]?tavern\s+(roll|kocok|bet)/i.test(text)) {
        const parts = text.split(/\s+/);
        const bet = parseInt(parts[2]) || 1e4;
        db.ensureUser(sender, ctx.pushName);
        const user = global.db.user[sender];
        const prefix = ctx.prefix || ".";
        if ((user.money || 0) < bet) {
          return ctx.reply(`❌ Uang tidak cukup untuk bertaruh *Rp ${bet.toLocaleString("id-ID")}*!`);
        }
        const pRoll = Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1;
        const bRoll = Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1;
        const isWin = pRoll >= bRoll;
        if (isWin) user.money += bet;
        else user.money -= bet;
        db.write(global.db);
        const html = generateDiceHTML(ctx.pushName || "Petualang", pRoll, bRoll, bet, isWin);
        const {
          buffer
        } = await renderHtmlToImage(html);
        const buttons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🎲 Main Lagi (10k)",
            id: `${prefix}tavern bet 10000`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🎲 Gandakan (25k)",
            id: `${prefix}tavern bet 25000`
          })
        }];
        const outText = isWin ? `🎉 *KAMU MENANG TARUHAN!* Koin dadumu lebih tinggi (${pRoll} vs ${bRoll}). Membawa pulang *+Rp ${(bet * 2).toLocaleString("id-ID")}*!` : `💀 *KURCACI MENANG!* Dadu lawan lebih perkasa (${bRoll} vs ${pRoll}). Kehilangan *Rp ${bet.toLocaleString("id-ID")}*!`;
        const options = {
          image: buffer,
          contextInfo: {
            mentionedJid: [sender]
          }
        };
        if (typeof ctx.sendCta === "function") return await ctx.sendCta(outText, "Tavern Casino", buttons, options);
        return await sock.sendMessage(ctx.id, {
          image: buffer,
          caption: outText
        }, {
          quoted: msg
        });
      }
    } catch (e) {
      console.error("[TAVERN BEFORE ERROR]:", e);
    }
  },
  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    return ctx.reply(`🎲 *KEDAI DADU KURCACI (TAVERN DICE)* 🎲\n\nPasang taruhan koin emasmu melawan sang Barman Kurcaci!\n\nFormat: *${prefix}tavern bet <jumlah>*\nContoh: *${prefix}tavern bet 20000*`);
  }
};