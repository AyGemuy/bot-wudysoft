import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const CONFIG = {
  BASE_URL: "https://api.deltaku.web.id/api/stalk/tiktok",
  TIMEOUT: 3e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};
export default {
  name: "ttstalk",
  aliases: ["tiktokstalk", "stalktt", "stalktiktok"],
  description: "Menampilkan informasi profil akun TikTok secara lengkap dan mendalam.",
  category: "Stalker",
  limit: true,
  example: "ttstalk fitya_taa",
  execute: async (sock, ctx, msg) => {
    try {
      const rawInput = (ctx.args?.[0] || ctx.query || "").trim();
      const username = rawInput.replace(/^@/, "");
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "Paimon-bot";
      const botFooter = global.bot?.footer || `${botName} • TikTok Stalker`;
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (!username) {
        return ctx.reply(`–  *T I K T O K  S T A L K*\n\n` + `Silakan masukkan username TikTok yang ingin Anda telusuri.\n\n` + `┌  ◦  *Format* : ${prefix}ttstalk <username>\n` + `└  ◦  *Contoh* : ${prefix}ttstalk fitya_taa`);
      }
      if (typeof ctx.react === "function") await ctx.react("⏳");
      const {
        data
      } = await axios.get(`${CONFIG.BASE_URL}?username=${encodeURIComponent(username)}`, {
        headers: {
          "User-Agent": CONFIG.USER_AGENT
        },
        timeout: CONFIG.TIMEOUT
      });
      if (!data?.status || !data?.data) {
        if (typeof ctx.react === "function") await ctx.react("❌");
        return ctx.reply(`❌ Akun TikTok dengan username *"${username}"* tidak ditemukan.`);
      }
      const resData = data.data;
      const user = resData.user || {};
      const stats = resData.statistics || {};
      const avatarUrl = user.avatar || user.avatar_larger || user.avatar_medium || null;
      const profileUrl = resData.profile_url || `https://www.tiktok.com/@${user.unique_id || username}`;
      let caption = `–  *T I K T O K  S T A L K*

Informasi profil kreator untuk *@${user.unique_id || username}*.

┌  ◦  *Nama Pengguna* : @${user.unique_id || "-"}
│  ◦  *Nama Panggilan* : ${user.nickname || "-"}
│  ◦  *User ID* : ${user.id || "-"}
│  ◦  *Verifikasi* : ${user.verified ? "Terverifikasi (Centang Biru) ✅" : "Belum Terverifikasi ❌"}
└  ◦  *Privasi Akun* : ${user.private_account ? "Akun Privat 🔒" : "Akun Publik 🌍"}

–  *S T A T I S T I K*

┌  ◦  *Pengikut (Followers)* : ${(stats.followers ?? 0).toLocaleString("id-ID")}
│  ◦  *Mengikuti (Following)* : ${(stats.following ?? 0).toLocaleString("id-ID")}
│  ◦  *Suka (Likes / Hearts)* : ${(stats.hearts ?? 0).toLocaleString("id-ID")}
└  ◦  *Total Video* : ${(stats.videos ?? 0).toLocaleString("id-ID")} Postingan

–  *B I O G R A F I*

“${(user.signature || "Tidak ada bio yang dicantumkan.").trim()}”`;
      const buttons = [{
        name: "cta_url",
        buttonParamsJson: JSON.stringify({
          display_text: "🌐 Buka di TikTok",
          url: profileUrl
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🔄 Segarkan Profil",
          id: `${prefix}ttstalk ${user.unique_id || username}`
        })
      }];
      const options = {
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 2,
            list_title: `${botName} • TikTok Stalker`,
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
      console.error("[TikTok Stalk Error]:", error?.message || error);
      if (typeof ctx.react === "function") await ctx.react("❌");
      ctx.reply(`❌ Terjadi kendala saat memeriksa akun: ${error?.message || "Internal Server Error"}`);
    }
  }
};