import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const CONFIG = {
  TIMEOUT: 2e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};

function formatDate(timestamp) {
  if (!timestamp || isNaN(timestamp)) return "-";
  try {
    const num = Number(timestamp);
    const date = new Date(num > 1e11 ? num : num * 1e3);
    return date.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }) + " WIB";
  } catch {
    return "-";
  }
}

function formatNumber(num) {
  if (num === undefined || num === null || isNaN(num)) return "0";
  return Number(num).toLocaleString("id-ID");
}
export default {
  name: "stalkff",
  aliases: ["ffstalk", "epep", "stalkfreefire", "ffinfo", "ffcheck"],
  description: "Melihat detail informasi, guild, pet, dan statistik rank akun Free Fire via UID.",
  category: "Stalker",
  limit: true,
  example: "stalkff 12345678",
  execute: async (sock, ctx, msg) => {
    try {
      const text = ctx.args?.join(" ")?.trim() || ctx.text?.trim() || "";
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "Paimon-bot";
      const botFooter = global.bot?.footer || `${botName} • Free Fire Stalker`;
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const uidMatch = text.match(/\b\d{6,12}\b/);
      const uid = uidMatch ? uidMatch[0] : null;
      if (!uid) {
        return ctx.reply(`–  *F R E E  F I R E  S T A L K*\n\n` + `Silakan masukkan UID Free Fire akun target yang ingin diperiksa.\n\n` + `┌  ◦  *Format* : ${prefix}stalkff <uid>\n` + `└  ◦  *Contoh* : ${prefix}stalkff 12345678`);
      }
      if (typeof ctx.react === "function") await ctx.react("⏳");
      const apiUrl = `${global.bot?.api?.wudysoft}/api/stalker/free-fire/v4?uid=${encodeURIComponent(uid)}`;
      const {
        data: res
      } = await axios.get(apiUrl, {
        headers: {
          "User-Agent": CONFIG.USER_AGENT
        },
        timeout: CONFIG.TIMEOUT
      });
      if (!res || !res.status || !res.result) {
        if (typeof ctx.react === "function") await ctx.react("❌");
        return ctx.reply(`❌ Akun Free Fire dengan UID *${uid}* tidak ditemukan atau server sedang gangguan.`);
      }
      const {
        basic_info = {},
          clan_basic_info = {},
          pet_info = {},
          credit_score_info = {},
          social_info = {},
          diamond_cost_res = {},
          verified = false
      } = res.result;
      const nickname = basic_info.nickname || "Unknown";
      const level = basic_info.level || "-";
      const exp = formatNumber(basic_info.exp);
      const likes = formatNumber(basic_info.liked);
      const region = basic_info.region || "-";
      const badges = formatNumber(basic_info.badge_cnt);
      const elitePass = basic_info.has_elite_pass ? "Aktif / Memiliki EP ✅" : "Tidak Ada ❌";
      const brRank = basic_info.rank || "-";
      const brPoints = formatNumber(basic_info.ranking_points);
      const brMaxRank = basic_info.max_rank || "-";
      const csRank = basic_info.cs_rank || "-";
      const csPoints = formatNumber(basic_info.cs_ranking_points);
      const csMaxRank = basic_info.cs_max_rank || "-";
      const hasClan = Boolean(clan_basic_info.clan_name);
      const clanName = clan_basic_info.clan_name || "-";
      const clanId = clan_basic_info.clan_id || "-";
      const clanLevel = clan_basic_info.clan_level || "-";
      const clanMembers = `${clan_basic_info.current_members || 0}/${clan_basic_info.max_members || 0}`;
      const hasPet = Boolean(pet_info.pet_name);
      const petName = pet_info.pet_name || "-";
      const petLevel = pet_info.level || "-";
      const petExp = formatNumber(pet_info.exp);
      const bio = (social_info.social_highlight || "-").trim();
      const language = (social_info.language || "-").replace("LANGUAGE_", "");
      const creditScore = credit_score_info.score ?? "-";
      const diamondCost = formatNumber(diamond_cost_res.diamond_cost);
      const createdAt = formatDate(basic_info.create_at);
      const lastLogin = formatDate(basic_info.last_login_at);
      let caption = `–  *F R E E  F I R E  S T A L K*

Informasi profil pemain untuk *${nickname}* ${verified ? "☑️" : ""}.

┌  ◦  *Nickname* : ${nickname} ${verified ? "(Verified ☑️)" : ""}
│  ◦  *UID* : ${basic_info.account_id || uid}
│  ◦  *Level* : ${level} (EXP: ${exp})
│  ◦  *Likes* : 👍 ${likes}
│  ◦  *Region* : ${region}
│  ◦  *Badge Season* : 🎖️ ${badges}
└  ◦  *Elite Pass* : ${elitePass}

–  *P E R I N G K A T  ( R A N K )*

┌  ◦  *Battle Royale* : Poin ${brPoints} (Rank: ${brRank} | Max: ${brMaxRank})
└  ◦  *Clash Squad* : Poin ${csPoints} (Rank: ${csRank} | Max: ${csMaxRank})

–  *G U I L D  /  C L A N*

${hasClan ? `┌  ◦  *Nama Guild* : ${clanName}\n│  ◦  *Guild ID* : ${clanId}\n│  ◦  *Level Guild* : ${clanLevel}\n└  ◦  *Anggota* : ${clanMembers} Member` : `_Pemain belum terdaftar dalam Guild apapun._`}

–  *P E T  C O M P A N I O N*

${hasPet ? `┌  ◦  *Nama Pet* : ${petName}\n│  ◦  *Level Pet* : ${petLevel}\n└  ◦  *EXP Pet* : ${petExp}` : `_Pemain tidak membawa pet companion._`}

–  *A K T I V I T A S  &  A K U N*

┌  ◦  *Skor Kredit* : 💯 ${creditScore}/100
│  ◦  *Total Diamond* : 💎 ${diamondCost}
│  ◦  *Bahasa Akun* : ${language}
│  ◦  *Dibuat Pada* : 📅 ${createdAt}
└  ◦  *Terakhir Online* : ⏱️ ${lastLogin}

–  *B I O G R A F I*

“${bio}”`;
      const buttons = [{
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🔄 Segarkan Data",
          id: `${prefix}stalkff ${uid}`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "📋 Salin UID",
          id: `${prefix}copy ${uid}`
        })
      }];
      const options = {
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 2,
            list_title: `${botName} • Free Fire Stalker`,
            button_title: "Opsi Akun"
          }
        },
        contextInfo: {
          forwardingScore: 999,
          isForwarded: true
        },
        quoted: quotedMsg
      };
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(caption, botFooter, buttons, options);
      } else {
        await sock.sendMessage(ctx.id, {
          text: caption
        }, {
          quoted: quotedMsg
        });
      }
      if (typeof ctx.react === "function") await ctx.react("✅");
    } catch (error) {
      console.error("[FF Stalk Error]:", error?.message || error);
      if (typeof ctx.react === "function") await ctx.react("❌");
      ctx.reply(`❌ Terjadi kesalahan saat memeriksa akun FF: ${error?.message || "Internal Server Error"}`);
    }
  }
};