import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const CONFIG = {
  BASE_URL: "https://api.deltaku.web.id/api/stalk/youtube",
  TIMEOUT: 3e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};
export default {
  name: "ytstalk",
  aliases: ["youtubestalk", "stalkyt", "stalkyoutube", "channelstalk"],
  description: "Menampilkan informasi profil dan video terbaru channel YouTube secara lengkap.",
  category: "Stalker",
  limit: true,
  example: "ytstalk wonaaay",
  execute: async (sock, ctx, msg) => {
    try {
      const rawInput = (ctx.args?.[0] || ctx.query || "").trim();
      const username = rawInput.replace(/^@/, "");
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "Paimon-bot";
      const botFooter = global.bot?.footer || `${botName} • YouTube Stalker`;
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (!username) {
        return ctx.reply(`–  *Y O U T U B E  S T A L K*\n\n` + `Silakan masukkan username atau handle channel YouTube yang ingin Anda periksa.\n\n` + `┌  ◦  *Format* : ${prefix}ytstalk <handle/username>\n` + `└  ◦  *Contoh* : ${prefix}ytstalk wonaaay`);
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
        return ctx.reply(`❌ Channel YouTube dengan handle *"${username}"* tidak ditemukan.`);
      }
      const d = data.data;
      const ch = d.channel || {};
      const avatarUrl = ch.avatarUrl || null;
      const channelUrl = ch.channelUrl || `https://www.youtube.com/@${ch.username || username}`;
      const latestVideos = Array.isArray(d.latest_videos) ? d.latest_videos.slice(0, 3) : [];
      let latestSection = "Belum ada video yang diunggah.";
      if (latestVideos.length > 0) {
        latestSection = latestVideos.map((v, i) => {
          const title = v.title || "Untitled Video";
          const duration = v.duration || "-";
          const views = v.viewCount || "0 tayangan";
          const date = v.publishedTime || "-";
          return `┌  ◦  *Video #${i + 1}* : ${title}\n│  ◦  *Durasi* : ${duration}\n│  ◦  *Ditonton* : ${views}\n└  ◦  *Rilis* : ${date}`;
        }).join("\n\n");
      }
      const cleanDesc = (ch.description || "Tidak ada deskripsi channel.").replace(/\r?\n|\r/g, " ").slice(0, 200).trim();
      const caption = `–  *Y O U T U B E  S T A L K*

Informasi profil channel YouTube untuk *@${ch.username || username}*.

┌  ◦  *Nama Channel* : ${ch.title || "Unknown"}
│  ◦  *Handle / User* : @${ch.username || "-"}
│  ◦  *Pelanggan (Subs)* : ${ch.subscriberCount || "0"}
└  ◦  *Total Video* : ${ch.videoCount || "0"} Video

–  *D E S K R I P S I*

“${cleanDesc}${cleanDesc.length >= 200 ? "..." : ""}”

–  *V I D E O  T E R B A R U*

${latestSection}`;
      const buttons = [{
        name: "cta_url",
        buttonParamsJson: JSON.stringify({
          display_text: "📺 Kunjungi Channel",
          url: channelUrl
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🔄 Segarkan Channel",
          id: `${prefix}ytstalk ${ch.username || username}`
        })
      }];
      const options = {
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 2,
            list_title: `${botName} • YouTube Stalker`,
            button_title: "Opsi Channel"
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
      console.error("[YouTube Stalk Error]:", error?.message || error);
      if (typeof ctx.react === "function") await ctx.react("❌");
      ctx.reply(`❌ Terjadi kendala saat memeriksa channel: ${error?.message || "Internal Server Error"}`);
    }
  }
};