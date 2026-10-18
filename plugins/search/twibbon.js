import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "twibbon",
  aliases: ["twibbonsearch", "twibify", "frame", "caritwibbon"],
  description: "Cari frame twibbon dan template kampanye via Twibify dengan tampilan CTA interaktif",
  category: "Search",
  limit: true,
  example: "twibbon <keyword>",
  execute: async (sock, ctx, msg) => {
    try {
      const query = (ctx.query || ctx.text || "").trim();
      if (!query) {
        return ctx.reply(`🖼️ *TWIBBON SEARCH*\n\n` + `Silakan masukkan kata kunci twibbon yang ingin dicari!\n` + `👉 Contoh: \`${ctx.prefix || "."}twibbon mpls\``);
      }
      await ctx.react("⏳");
      const {
        data
      } = await axios.post(`${global.bot?.api?.wudysoft}/api/search/twibbon/v2`, {
        query: query
      }, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 3e4
      });
      if (!data || !data.results || data.results.length === 0) {
        await ctx.react("❌");
        return ctx.reply(`❌ Tidak ditemukan twibbon untuk kata kunci: *${query}*`);
      }
      const total = String(data.total || data.results.length);
      const topResult = data.results[0];
      const title = topResult.title?.trim() || "Twibbon Frame";
      const campaignUrl = topResult.url || `https://twibify.com`;
      const frameImage = topResult.image || topResult.thumbnail;
      const creatorName = topResult.creator?.name || "Twibify Creator";
      const downloads = String(topResult.stats?.downloads ?? 0);
      const createdAt = topResult.createdAt || "Baru saja";
      const hashtags = topResult.hashtags?.length ? topResult.hashtags.map(h => `#${h}`).join(" ") : "-";
      if (!frameImage) {
        throw new Error("URL gambar frame tidak ditemukan pada respon.");
      }
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const bodyText = `🖼️ *${title}*\n\n` + `👤 *Creator:* ${creatorName}\n` + `📥 *Total Download:* ${downloads} kali\n` + `📅 *Dibuat:* ${createdAt}\n` + `🏷️ *Tags:* ${hashtags}\n` + `📊 *Total Ditemukan:* ${total} frame`;
      const footerText = "Pilih tombol di bawah untuk memasang atau mencari frame lain";
      const buttons = [
        ["Pasang Twibbon", campaignUrl, "cta_url"],
        ["Salin Link Kampanye", campaignUrl, "cta_copy"]
      ];
      if (data.results.length > 1) {
        const otherRows = data.results.slice(1, 6).map((item, idx) => ({
          title: `${idx + 1}. ${item.title?.trim().slice(0, 24) || "Twibbon"}`,
          id: `${ctx.prefix || "."}twibbon ${item.title?.trim() || query}`,
          description: `By ${item.creator?.name || "Creator"} | ${item.stats?.downloads ?? 0} downloads`
        }));
        buttons.push({
          name: "single_select",
          title: "🔍 Lihat Twibbon Lainnya",
          sections: [{
            title: "Pilihan Twibbon Terkait",
            rows: otherRows
          }]
        });
      }
      await ctx.sendCta(bodyText, footerText, buttons, {
        title: `Twibbon: ${title}`,
        media: frameImage,
        quoted: quotedMsg
      });
      await ctx.react("✅");
    } catch (error) {
      await ctx.react("❌");
      ctx.reply(`❌ Twibbon Error: ${error.response?.data?.message || error.message}`);
    }
  }
};