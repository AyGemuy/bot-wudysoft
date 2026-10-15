import yts from "yt-search";
import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "ytsearch",
  aliases: ["yts", "play", "yt"],
  description: "Mencari video YouTube dengan tampilan Interactive List CTA & Download",
  category: "Search",
  limit: true,
  example: "yts alan walker faded",
  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "WudysoftBot";
    const footer = global.footer || global.bot?.footer || `_${botName}_`;
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
    try {
      const query = (ctx.query || ctx.text || "").trim();
      if (!query) {
        const helpText = `– *Y O U T U B E*\n\n` + `┌ ◦ *Usage* : ${prefix}yts <query>\n` + `└ ◦ *Example* : ${prefix}yts Alan Walker Faded\n\n` + `${footer}`;
        return ctx.reply(helpText);
      }
      await ctx.react("⏳");
      const searchResult = await yts(query);
      const videos = (searchResult.videos || []).slice(0, 10);
      if (!videos.length) {
        await ctx.react("❌");
        return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Video tidak ditemukan\n` + `└ ◦ *Query* : "${query}"\n\n` + `${footer}`);
      }
      const topVideo = videos[0];
      const downloadRows = [{
        title: "Download Audio (MP3)",
        id: `${prefix}ytmp3 ${topVideo.url}`,
        description: `Unduh audio MP3 kualitas tinggi (${topVideo.timestamp || "-"})`
      }, {
        title: "Download Video (MP4)",
        id: `${prefix}ytmp4 ${topVideo.url}`,
        description: "Unduh video MP4 kualitas HD"
      }, {
        title: "Voice Note (PTT)",
        id: `${prefix}ytmp3 voice ${topVideo.url}`,
        description: "Kirim audio langsung dalam bentuk Voice Note"
      }];
      const otherVideoRows = videos.slice(1).map((v, i) => ({
        title: `${i + 2}. ${v.title}`.slice(0, 24),
        id: `${prefix}yts ${v.url}`,
        description: `⏱️ ${v.timestamp || "-"} | 👤 ${v.author?.name || "Channel"} | 👁️ ${(v.views || 0).toLocaleString("id-ID")} views`.slice(0, 60)
      }));
      const listSections = [{
        title: `DOWNLOAD: ${topVideo.title.slice(0, 24).toUpperCase()}`,
        rows: downloadRows
      }];
      if (otherVideoRows.length > 0) {
        listSections.push({
          title: `HASIL PENCARIAN LAINNYA (${otherVideoRows.length})`,
          rows: otherVideoRows
        });
      }
      const bodyText = `– *Y O U T U B E*\n\n` + `┌ ◦ *Title* : ${topVideo.title}\n` + `│ ◦ *Channel* : ${topVideo.author?.name || "-"}\n` + `│ ◦ *Duration* : ${topVideo.timestamp || "-"}\n` + `│ ◦ *Views* : ${(topVideo.views || 0).toLocaleString("id-ID")}\n` + `│ ◦ *Uploaded* : ${topVideo.ago || "-"}\n` + `└ ◦ *Link* : ${topVideo.url}\n\n` + `_Pilih format unduhan atau video lainnya pada menu di bawah:_\n\n` + `${footer}`;
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: "PILIH OPSI / VIDEO LAIN",
          sections: listSections
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "Download MP3",
          id: `${prefix}ytmp3 ${topVideo.url}`
        })
      }, {
        name: "cta_url",
        buttonParamsJson: JSON.stringify({
          display_text: "Tonton di YouTube",
          url: topVideo.url
        })
      }, {
        name: "cta_copy",
        buttonParamsJson: JSON.stringify({
          display_text: "Salin Link Video",
          copy_code: topVideo.url
        })
      }];
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, `${botName} • YouTube Search`, buttons, {
          media: topVideo.thumbnail,
          quoted: quotedMsg
        });
      } else {
        await sock.sendMessage(ctx.id, {
          image: {
            url: topVideo.thumbnail
          },
          caption: bodyText
        }, {
          quoted: quotedMsg
        });
      }
      await ctx.react("✅");
    } catch (error) {
      console.error("[YouTube Search Error]:", error);
      await ctx.react("❌");
      ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : ${error.message}\n` + `└ ◦ *Command* : ${ctx.command || "ytsearch"}\n\n` + `${footer}`);
    }
  }
};