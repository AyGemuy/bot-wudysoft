import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "igdl",
  aliases: ["ig", "instagram", "instagramdownloader"],
  description: "Download media Instagram dengan detail & CTA",
  category: "Downloader",
  execute: async (sock, ctx, msg) => {
    const url = (ctx.args[0] || ctx.query || "").trim();
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "WudysoftBot";
    const botFooter = global.bot?.footer || `${botName} • Instagram Downloader`;
    if (!url) {
      return ctx.reply(`–  *I N S T A G R A M*

Silakan masukkan tautan postingan, reels, atau carousel Instagram yang valid.

┌  ◦  *Format* : ${prefix}ig <link>
└  ◦  *Example* : ${prefix}ig https://www.instagram.com/reel/Dc8Hd2RSl07/`);
    }
    try {
      await ctx.react("⏳");
      const res = await axios.post(`${global.bot?.api?.wudysoft}/api/download/instagram/v35`, {
        url: url
      });
      const data = res.data;
      if (!data.status || !data.result?.length) {
        await ctx.react("❌");
        return ctx.reply("❌ Media tidak ditemukan atau akun bersifat privat.");
      }
      const firstItem = data.result[0];
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const igPostUrl = firstItem.shortcode ? `https://www.instagram.com/p/${firstItem.shortcode}/` : url;
      const captionText = firstItem.caption ? firstItem.caption.trim() : "-";
      const buttons = [];
      if (data.result.length > 1) {
        const slideRows = data.result.map((item, i) => ({
          title: `[ Slide ${i + 1} ] ${item.video_url ? "Video" : "Foto"}`,
          id: `${prefix}ig ${url}`,
          description: `Tipe: ${item.video_url ? "Video" : "Foto"} (${i + 1}/${data.result.length})`
        }));
        buttons.push({
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "📷 DAFTAR SLIDE MEDIA",
            sections: [{
              title: `${botName} • Slide Media (${data.result.length})`,
              rows: slideRows
            }]
          })
        });
      }
      buttons.push({
        name: "cta_url",
        buttonParamsJson: JSON.stringify({
          display_text: "📸 Buka di Instagram",
          url: igPostUrl,
          merchant_url: igPostUrl
        })
      }, {
        name: "cta_copy",
        buttonParamsJson: JSON.stringify({
          display_text: "📋 Salin Link",
          copy_code: url
        })
      });
      const bodyText = `–  *I N S T A G R A M*

┌  ◦  *Likes* : ${firstItem.like_count || "0"}
│  ◦  *Comments* : ${firstItem.comment_count || "0"}
│  ◦  *Total* : ${data.result.length} Items
│  ◦  *Published* : ${firstItem.publish_date || "-"}
└  ◦  *Shortcode* : ${firstItem.shortcode || "-"}

–  *C A P T I O N*

${captionText}`;
      const thumb = firstItem.thumbnail_url || firstItem.image_url || firstItem.video_thumbnail_url;
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, botFooter, buttons, {
          title: `✦ Instagram Downloader ✦`,
          subtitle: firstItem.shortcode ? `@${firstItem.shortcode}` : "Instagram Media",
          media: thumb || null,
          quoted: quotedMsg
        });
      } else {
        await ctx.reply(bodyText, {
          quoted: quotedMsg
        });
      }
      for (let i = 0; i < data.result.length; i++) {
        const item = data.result[i];
        const mediaCaption = data.result.length > 1 ? `–  *I N S T A G R A M*\n\n└  ◦  Slide : ${i + 1} / ${data.result.length}` : "";
        if (item.video_url) {
          await sock.sendMessage(ctx.id, {
            video: {
              url: item.video_url
            },
            caption: mediaCaption
          }, {
            quoted: quotedMsg
          });
        } else if (item.image_url) {
          await sock.sendMessage(ctx.id, {
            image: {
              url: item.image_url
            },
            caption: mediaCaption
          }, {
            quoted: quotedMsg
          });
        }
      }
      await ctx.react("✅");
    } catch (e) {
      await ctx.react("❌");
      ctx.reply(`❌ Error: ${e.message}`);
    }
  }
};