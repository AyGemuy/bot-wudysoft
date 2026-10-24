import axios from "axios";
import db from "../../data/db.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const STATS_MAP = {
  cp: {
    icon: "⚡",
    label: "Combat Power",
    unit: "CP",
    calc: u => {
      const atk = (Number(u.atk) || 10) * 3.5;
      const def = (Number(u.def) || 5) * 4;
      const hp = (Number(u.hpMax) || 100) * .4;
      const mp = (Number(u.manaMax) || 50) * .3;
      return Math.round(atk + def + hp + mp + (Number(u.level) || 1) * 25);
    }
  },
  level: {
    icon: "🎖️",
    label: "Level",
    unit: "Lv."
  },
  money: {
    icon: "💰",
    label: "Money",
    unit: "Rp"
  },
  mcoin: {
    icon: "🪙",
    label: "M-Coin",
    unit: "MC"
  },
  exp: {
    icon: "✨",
    label: "EXP",
    unit: "XP"
  },
  atk: {
    icon: "⚔️",
    label: "Attack",
    unit: "ATK"
  },
  def: {
    icon: "🛡️",
    label: "Defense",
    unit: "DEF"
  },
  hp: {
    icon: "❤️",
    label: "HP",
    unit: "HP"
  },
  hpmax: {
    icon: "💖",
    label: "Max HP",
    unit: "HP",
    key: "hpMax"
  },
  mana: {
    icon: "🧪",
    label: "Mana",
    unit: "MP"
  },
  manamax: {
    icon: "🔷",
    label: "Max Mana",
    unit: "MP",
    key: "manaMax"
  },
  limit: {
    icon: "🎫",
    label: "Limit",
    unit: "Tiket"
  }
};
const ALIAS_MAP = {
  power: "cp",
  combat: "cp",
  saldo: "money",
  koin: "money",
  uang: "money",
  xp: "exp",
  lvl: "level",
  darah: "hp",
  mp: "mana",
  maxhp: "hpmax",
  maxmana: "manamax",
  damage: "atk",
  defense: "def"
};

function generateLeaderboardHTML(data) {
  const {
    statLabel,
    unit,
    topFive,
    myRank,
    myVal,
    page,
    totalPages
  } = data;
  let podiumCardsHTML = "";
  topFive.forEach((p, idx) => {
    const isFirst = idx === 0;
    const badge = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`;
    podiumCardsHTML += `
      <div class="rank-card ${isFirst ? "first-place" : ""}">
        <div class="medal-slot">${badge}</div>
        <div class="player-meta">
          <div class="player-name">${p.name}</div>
          <div class="player-sub">${p.sub}</div>
        </div>
        <div class="score-badge">${p.val} ${unit}</div>
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
      background: #0d0803;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: #fff;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .hof-frame {
      width: 960px;
      height: 540px;
      background: radial-gradient(circle at 50% 15%, #3d2309 0%, #170d03 65%, #080401 100%);
      border: 8px solid #2b1704;
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
    .page-badge {
      background: rgba(0,0,0,0.7);
      border: 1.5px solid #ecc94b;
      color: #fefcbf;
      padding: 5px 18px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 800;
    }

    /* Podium List */
    .podium-container {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin: 10px 0;
    }
    .rank-card {
      background: rgba(26, 15, 5, 0.88);
      border: 1.5px solid rgba(236, 201, 75, 0.25);
      border-radius: 12px;
      padding: 10px 18px;
      display: flex;
      align-items: center;
      gap: 16px;
      box-shadow: 0 6px 16px rgba(0,0,0,0.6);
    }
    .rank-card.first-place {
      background: rgba(48, 28, 7, 0.95);
      border-color: #ecc94b;
      box-shadow: 0 0 20px rgba(236, 201, 75, 0.4);
    }
    .medal-slot { font-size: 22px; font-weight: 900; width: 34px; text-align: center; }
    .player-meta { display: flex; flex-direction: column; flex: 1; }
    .player-name { font-size: 15px; font-weight: 900; color: #fffaf0; }
    .player-sub { font-size: 11px; color: #a0aec0; font-weight: 700; }
    .score-badge { font-size: 16px; font-weight: 900; color: #ecc94b; }

    .bottom-bar {
      background: rgba(0,0,0,0.7);
      border: 1px solid rgba(236, 201, 75, 0.35);
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
  <div class="hof-frame">
    <div class="top-header">
      <div class="title">🏆 MMORPG HALL OF FAME • ${statLabel.toUpperCase()} 🏆</div>
      <div class="page-badge">HALAMAN ${page} / ${totalPages}</div>
    </div>

    <!-- Podium Entries -->
    <div class="podium-container">
      ${podiumCardsHTML}
    </div>

    <div class="bottom-bar">
      <span>Peringkat Karaktermu: <b>#${myRank > 0 ? myRank : "-"} (${myVal} ${unit})</b></span>
      <span style="color: #ecc94b; font-weight: 800;">MONUMEN KEHORMATAN REALTIME</span>
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
  name: "leaderboard",
  aliases: ["lb", "top", "ranking", "topplayer", "fame"],
  description: "Papan peringkat Hall of Fame lengkap dengan Dynamic HTML Canvas Podium",
  category: "RPG",
  example: ".lb atau .lb money atau .lb cp -p 2",
  register: true,
  execute: async (sock, ctx, msg) => {
    try {
      await ctx.react?.("⏳");
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • RPG Engine`;
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const userName = ctx.pushname || ctx.sender.split("@")[0];
      const rawInput = (ctx.args?.join(" ") || ctx.text || "").trim();
      const pageMatch = rawInput.match(/(?:--page|-p)\s+(\d+)/i);
      let page = pageMatch ? parseInt(pageMatch[1], 10) : 1;
      const cleanArgs = rawInput.replace(/(?:--page|-p)\s+\d+/gi, "").trim().split(/\s+/).filter(Boolean);
      let inputCategory = (cleanArgs[0] || "level").toLowerCase();
      if (ALIAS_MAP[inputCategory]) inputCategory = ALIAS_MAP[inputCategory];
      if (!STATS_MAP[inputCategory]) inputCategory = "level";
      const currentStat = STATS_MAP[inputCategory];
      const targetDbKey = currentStat.key || inputCategory;
      const usersData = global.db?.user || global.db?.data?.user || {};
      const allUsers = Object.entries(usersData).filter(([, u]) => u && typeof u === "object");
      if (allUsers.length === 0) {
        await ctx.react?.("❌");
        return ctx.reply("❌ Belum ada data pemain yang tersimpan di database.");
      }
      const sorted = allUsers.map(([jid, u]) => {
        let val = 0;
        if (typeof currentStat.calc === "function") {
          val = currentStat.calc(u);
        } else {
          val = Number(u[targetDbKey]) || 0;
        }
        return {
          jid: jid,
          user: u,
          val: val
        };
      }).sort((a, b) => b.val - a.val);
      const itemsPerPage = 5;
      const totalPages = Math.ceil(sorted.length / itemsPerPage) || 1;
      if (page < 1) page = 1;
      if (page > totalPages) page = totalPages;
      const startIndex = (page - 1) * itemsPerPage;
      const currentPageItems = sorted.slice(startIndex, startIndex + itemsPerPage);
      const topFiveData = currentPageItems.map((item, index) => {
        const realRank = startIndex + index + 1;
        const phone = item.jid.split("@")[0];
        const name = String(item.user.name || phone).slice(0, 18);
        return {
          rank: realRank,
          name: name,
          sub: `Level ${item.user.level || 1} • ${item.user.jobClass ? item.user.jobClass.toUpperCase() : "Adventurer"}`,
          val: item.val.toLocaleString("id-ID")
        };
      });
      const myRank = sorted.findIndex(item => item.jid === ctx.sender) + 1;
      const myObj = sorted.find(item => item.jid === ctx.sender);
      const myVal = (myObj ? myObj.val : 0).toLocaleString("id-ID");
      const html = generateLeaderboardHTML({
        statLabel: currentStat.label,
        unit: currentStat.unit,
        topFive: topFiveData,
        myRank: myRank,
        myVal: myVal,
        page: page,
        totalPages: totalPages
      });
      const {
        buffer
      } = await renderHtmlToImage(html);
      const topListText = currentPageItems.map((item, index) => {
        const realRank = startIndex + index + 1;
        const isLast = index === currentPageItems.length - 1;
        const branch = isLast ? "└" : "│";
        const phone = item.jid.split("@")[0];
        const name = String(item.user.name || phone).slice(0, 18);
        return `${branch}  ◦  *#${realRank}.* ${name} : ${item.val.toLocaleString("id-ID")} ${currentStat.unit}`;
      }).join("\n");
      const categoryRows = Object.entries(STATS_MAP).map(([catKey, info]) => ({
        title: `${info.icon} Top ${info.label}`,
        id: `${prefix}lb ${catKey}`,
        description: `Lihat peringkat petualang dengan ${info.label} tertinggi`
      }));
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: "🏆 PILIH KATEGORI STATISTIK",
          sections: [{
            title: "Kategori Peringkat MMORPG",
            rows: categoryRows
          }]
        })
      }];
      if (page > 1) {
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `⬅️ Hal ${page - 1}`,
            id: `${prefix}lb ${inputCategory} -p ${page - 1}`
          })
        });
      }
      if (page < totalPages) {
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `➡️ Hal ${page + 1}`,
            id: `${prefix}lb ${inputCategory} -p ${page + 1}`
          })
        });
      }
      const bodyText = `Hi ${userName}!\nBerikut adalah daftar petualang terhormat dengan *${currentStat.label}* tertinggi.\n\n` + `–  *H A L L  O F  F A M E*\n\n` + `┌  ◦  *Statistik* : ${currentStat.label}\n` + `│  ◦  *Halaman* : ${page} / ${totalPages}\n` + `│  ◦  *Total Petualang* : ${sorted.length} Akun\n` + `└  ◦  *Peringkat Karaktermu* : #${myRank > 0 ? myRank : "-"} (${myVal} ${currentStat.unit})\n\n` + `–  *T O P  P L A Y E R S*\n\n` + `${topListText}\n\n` + `_Pilih kategori peringkat lain pada menu dropdown di bawah:_`;
      const options = {
        image: buffer,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 2,
            divider_indices: [1],
            list_title: `${botName} • Hall of Fame`,
            button_title: "Kategori Juara"
          }
        },
        contextInfo: {
          mentionedJid: [ctx.sender],
          forwardingScore: 999,
          isForwarded: true
        },
        quoted: quotedMsg
      };
      await ctx.react?.("✅");
      if (typeof ctx.sendCta === "function") {
        return await ctx.sendCta(bodyText, botFooter, buttons, options);
      }
      return await sock.sendMessage(ctx.id, {
        image: buffer,
        caption: bodyText,
        mentions: [ctx.sender]
      }, {
        quoted: quotedMsg
      });
    } catch (err) {
      console.error("[LEADERBOARD ERROR]", err);
      await ctx.react?.("❌");
      ctx.reply(`❌ Terjadi kendala saat memuat peringkat: ${err.message}`);
    }
  }
};