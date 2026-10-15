import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const CONFIG = {
  BASE_URL: "https://api.deltaku.web.id/api/stalk/roblox",
  TIMEOUT: 3e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};
export default {
  name: "robloxstalk",
  aliases: ["rblxstalk", "stalkroblox", "robloxuser"],
  description: "Menampilkan informasi profil akun Roblox secara lengkap dan mendalam.",
  category: "Stalker",
  limit: true,
  example: "robloxstalk lelia_liyaa",
  execute: async (sock, ctx, msg) => {
    try {
      const username = (ctx.query || ctx.args?.join(" ") || "").trim();
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "Paimon-bot";
      const botFooter = global.bot?.footer || `${botName} • Roblox Stalker`;
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (!username) {
        return ctx.reply(`–  *R O B L O X  S T A L K*\n\n` + `Silakan masukkan username Roblox yang ingin Anda periksa.\n\n` + `┌  ◦  *Format* : ${prefix}robloxstalk <username>\n` + `└  ◦  *Contoh* : ${prefix}robloxstalk lelia_liyaa`);
      }
      if (typeof ctx.react === "function") await ctx.react("⏳");
      const {
        data
      } = await axios.get(`${CONFIG.BASE_URL}?q=${encodeURIComponent(username)}`, {
        headers: {
          "User-Agent": CONFIG.USER_AGENT
        },
        timeout: CONFIG.TIMEOUT
      });
      if (!data?.status || !data?.data) {
        if (typeof ctx.react === "function") await ctx.react("❌");
        return ctx.reply(`❌ Pengguna Roblox dengan username *"${username}"* tidak ditemukan.`);
      }
      const d = data.data;
      const basic = d.basic_info || {};
      const avatarUrl = d.avatar?.image_url || null;
      let caption = `–  *R O B L O X  S T A L K*

Informasi profil Roblox untuk *@${basic.username || username}*.

┌  ◦  *Username* : ${basic.username || "-"}
│  ◦  *Display Name* : ${basic.display_name || "-"}
│  ◦  *User ID* : ${basic.user_id || "-"}
│  ◦  *Dibuat Pada* : ${basic.created_formatted || "-"}
│  ◦  *Verified Badge* : ${basic.has_verified_badge ? "Terverifikasi (Centang)" : "Tidak"}
└  ◦  *Status Akun* : ${basic.is_banned ? "Banned / Ditangguhkan 🚫" : "Aktif / Normal ✅"}

–  *S T A T I S T I K*

┌  ◦  *Teman (Friends)* : ${(d.friends?.count ?? 0).toLocaleString("id-ID")}
│  ◦  *Pengikut (Followers)* : ${(d.followers?.count ?? 0).toLocaleString("id-ID")}
│  ◦  *Mengikuti (Following)* : ${(d.following?.count ?? 0).toLocaleString("id-ID")}
│  ◦  *Grup* : ${(d.groups?.count ?? 0).toLocaleString("id-ID")}
│  ◦  *Lencana (Badges)* : ${(d.badges?.count ?? 0).toLocaleString("id-ID")}
└  ◦  *Game Dibuat* : ${(d.games?.count ?? 0).toLocaleString("id-ID")}

–  *B I O G R A F I*

“${(basic.description || "Tidak ada bio yang dicantumkan.").trim()}”`;
      const buttons = [{
        name: "cta_url",
        buttonParamsJson: JSON.stringify({
          display_text: "🌐 Kunjungi Profil",
          url: basic.profile_url || `https://www.roblox.com/users/${basic.user_id}/profile`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🔄 Segarkan Profil",
          id: `${prefix}robloxstalk ${basic.username || username}`
        })
      }];
      const options = {
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 2,
            list_title: `${botName} • Roblox Stalker`,
            button_title: "Opsi Profil"
          }
        },
        contextInfo: {
          forwardingScore: 999,
          isForwarded: true
        },
        quoted: quotedMsg
      };
      if (avatarUrl) {
        options.image = avatarUrl;
      }
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(caption, botFooter, buttons, options);
      } else {
        if (avatarUrl) {
          await sock.sendMessage(ctx.id, {
            image: {
              url: avatarUrl
            },
            caption: caption
          }, {
            quoted: quotedMsg
          });
        } else {
          await sock.sendMessage(ctx.id, {
            text: caption
          }, {
            quoted: quotedMsg
          });
        }
      }
      if (typeof ctx.react === "function") await ctx.react("✅");
    } catch (error) {
      console.error("[Roblox Stalk Error]:", error?.message || error);
      if (typeof ctx.react === "function") await ctx.react("❌");
      ctx.reply(`❌ Terjadi kendala saat memeriksa profil: ${error?.message || "Internal Server Error"}`);
    }
  }
};