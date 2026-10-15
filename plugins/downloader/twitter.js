import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "twitterdl",
  aliases: ["twitter", "twtdl", "twdl", "x", "xdl"],
  description: "Download video atau foto dari Twitter / X dengan detail & CTA",
  category: "Downloader",
  execute: async (sock, ctx, msg) => {
    const rawArgs = ctx.args || [];
    const url = rawArgs.find(arg => /https?:\/\/(www\.)?(twitter\.com|x\.com)/i.test(arg)) || "";
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "WudysoftBot";
    const botFooter = global.bot?.footer || `${botName} • Twitter Downloader`;
    if (!url) {
      return ctx.reply(`–  *T W I T T E R*

Silakan masukkan tautan status atau video Twitter / X yang valid.

┌  ◦  *Format* : ${prefix}twitter <link>
└  ◦  *Example* : ${prefix}twitter https://x.com/sssirxn/status/2096752371321721287`);
    }
    try {
      if (typeof ctx.react === "function") await ctx.react("⏳");
      const res = await axios.post(`${global.bot?.api?.wudysoft}/api/download/twitter/v6`, {
        url: url
      });
      const json = res.data;
      if (!json || json.code !== 200 || !json.tweet) {
        if (typeof ctx.react === "function") await ctx.react("❌");
        return ctx.reply("❌ Gagal mengunduh media atau tweet tidak ditemukan.");
      }
      const tweet = json.tweet;
      const author = tweet.author || {};
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const videos = tweet.media?.videos || [];
      const photos = tweet.media?.photos || [];
      const listSections = [];
      let topVideoUrl = null;
      let topThumbnail = author.avatar_url || null;
      if (videos.length > 0) {
        const videoObj = videos[0];
        topThumbnail = videoObj.thumbnail_url || topThumbnail;
        const sortedUrls = (videoObj.video_urls || []).sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
        topVideoUrl = sortedUrls[0]?.url;
        const videoRows = sortedUrls.map((v, i) => {
          const resMatch = v.url.match(/\/vid\/[^\/]+\/(\d+x\d+)\//);
          const resolution = resMatch ? resMatch[1] : `Kualitas ${i + 1}`;
          const bitrateText = v.bitrate ? `${Math.round(v.bitrate / 1e3)} kbps` : "Standard";
          return {
            title: `[ Video ${resolution} ]`,
            id: `${prefix}twitter ${url}`,
            description: `Bitrate: ${bitrateText} | Format: MP4`
          };
        });
        if (videoRows.length > 0) {
          listSections.push({
            title: `${botName} • Kualitas Video`,
            rows: videoRows
          });
        }
      }
      const bodyText = `–  *T W I T T E R*

┌  ◦  *Author* : ${author.name || "-"} (@${author.screen_name || "-"})
│  ◦  *Likes* : ${tweet.likes?.toLocaleString("id-ID") || 0}
│  ◦  *Retweets* : ${tweet.retweets?.toLocaleString("id-ID") || 0}
│  ◦  *Replies* : ${tweet.replies?.toLocaleString("id-ID") || 0}
└  ◦  *Created* : ${tweet.created_at || "-"}

–  *C O N T E N T*

${tweet.text ? tweet.text.trim() : "-"}`;
      const buttons = [];
      if (listSections.length > 0) {
        buttons.push({
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "🎞️ PILIH KUALITAS VIDEO",
            sections: listSections
          })
        });
      }
      buttons.push({
        name: "cta_url",
        buttonParamsJson: JSON.stringify({
          display_text: "🐦 Buka di Twitter / X",
          url: tweet.url || url,
          merchant_url: tweet.url || url
        })
      });
      if (topVideoUrl) {
        buttons.push({
          name: "cta_url",
          buttonParamsJson: JSON.stringify({
            display_text: "📥 Direct Download Link",
            url: topVideoUrl,
            merchant_url: topVideoUrl
          })
        }, {
          name: "cta_copy",
          buttonParamsJson: JSON.stringify({
            display_text: "📋 Salin Link Unduhan",
            copy_code: topVideoUrl
          })
        });
      }
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, botFooter, buttons, {
          title: `✦ Twitter / X Downloader ✦`,
          subtitle: `@${author.screen_name || "Twitter"} Post`,
          media: topThumbnail,
          quoted: quotedMsg
        });
      } else {
        await ctx.reply(bodyText, {
          quoted: quotedMsg
        });
      }
      const mediaCaption = `–  *T W I T T E R*

┌  ◦  *Author* : @${author.screen_name || "Twitter"}
└  ◦  *Status* : Downloaded`;
      if (topVideoUrl) {
        await sock.sendMessage(ctx.id, {
          video: {
            url: topVideoUrl
          },
          caption: mediaCaption
        }, {
          quoted: quotedMsg
        });
      }
      if (photos.length > 0) {
        for (const photo of photos) {
          const photoUrl = photo.url || photo;
          await sock.sendMessage(ctx.id, {
            image: {
              url: photoUrl
            },
            caption: mediaCaption
          }, {
            quoted: quotedMsg
          });
        }
      }
      if (typeof ctx.react === "function") await ctx.react("✅");
    } catch (e) {
      if (typeof ctx.react === "function") await ctx.react("❌");
      ctx.reply(`❌ Twitter Download Error: ${e.message}`);
    }
  }
};