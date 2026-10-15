import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "fbdl",
  aliases: ["fb", "facebook", "facebookdownloader"],
  description: "Download video Facebook dengan detail & CTA",
  category: "Downloader",
  execute: async (sock, ctx, msg) => {
    const url = (ctx.args[0] || ctx.query || "").trim();
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "WudysoftBot";
    const botFooter = global.bot?.footer || `${botName} • Facebook Downloader`;
    if (!url) {
      return ctx.reply(`–  *F A C E B O O K*

Silakan masukkan tautan video Facebook yang valid.

┌  ◦  *Format* : ${prefix}fb <link>
└  ◦  *Example* : ${prefix}fb https://www.facebook.com/reel/1011488218194125/`);
    }
    try {
      await ctx.react("⏳");
      const res = await axios.post(`${global.bot?.api?.wudysoft}/api/download/facebook/v1`, {
        url: url
      });
      const data = res.data;
      if (!data?.links?.length) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal mengunduh video Facebook atau tautan bersifat privat.");
      }
      const selectedVideo = data.links.find(v => v.quality.includes("HD") || v.quality.includes("720p")) || data.links[0];
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const qualityRows = data.links.map((v, i) => ({
        title: `[ Kualitas ${v.quality.toUpperCase()} ]`,
        id: `${prefix}fb ${url}`,
        description: `Resolusi video: ${v.quality}`
      }));
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: "🎞️ PILIH RESOLUSI",
          sections: [{
            title: `${botName} • Kualitas Video`,
            rows: qualityRows
          }]
        })
      }, {
        name: "cta_url",
        buttonParamsJson: JSON.stringify({
          display_text: "📥 Direct Download",
          url: selectedVideo.url,
          merchant_url: selectedVideo.url
        })
      }, {
        name: "cta_copy",
        buttonParamsJson: JSON.stringify({
          display_text: "📋 Salin Link Unduhan",
          copy_code: selectedVideo.url
        })
      }];
      const bodyText = `–  *F A C E B O O K*

┌  ◦  *Title* : ${data.title || "Facebook Video"}
│  ◦  *Duration* : ${data.duration || "-"}
└  ◦  *Quality* : ${selectedVideo.quality}

Video sedang dikirimkan ke chat. Anda juga dapat mengunduh langsung melalui tombol di bawah.`;
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, botFooter, buttons, {
          title: `✦ Facebook Downloader ✦`,
          subtitle: data.title || "Facebook Video",
          media: data.img || null,
          quoted: quotedMsg
        });
      } else {
        await ctx.reply(bodyText, {
          quoted: quotedMsg
        });
      }
      const videoCaption = `–  *F A C E B O O K*

┌  ◦  *Title* : ${data.title || "Facebook Video"}
└  ◦  *Quality* : ${selectedVideo.quality}`;
      await sock.sendMessage(ctx.id, {
        video: {
          url: selectedVideo.url
        },
        caption: videoCaption
      }, {
        quoted: quotedMsg
      });
      await ctx.react("✅");
    } catch (e) {
      await ctx.react("❌");
      ctx.reply(`❌ Error: ${e.message}`);
    }
  }
};