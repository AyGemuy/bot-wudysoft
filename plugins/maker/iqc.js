import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "iqc",
  aliases: ["iphonequote", "iqchat"],
  description: "Membuat gambar gelembung chat ala iPhone (iOS)",
  category: "Maker",
  limit: true,
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = (ctx.args?.join(" ") || ctx.query || ctx.quoted?.text || "").trim();
      if (!rawText) {
        return ctx.reply(`📱 *IPHONE QUOTE CHAT (IQC)*\n\n` + `👉 Format: *${ctx.prefix || "."}iqc <pesan> | [operator]*\n` + `👉 Pilihan Operator (Opsional): \`Telkomsel\`, \`Indosat\`, \`XL\`, \`Tri\`, \`Smartfren\`\n\n` + `📌 *Contoh:*\n` + `• *${ctx.prefix || "."}iqc halo semuanya apa kabar?*\n` + `• *${ctx.prefix || "."}iqc selamat malam kamu | Indosat*`);
      }
      await ctx.react("⏳");
      const [text, carrier = "Telkomsel"] = rawText.split("|").map(v => v.trim());
      if (!text) {
        await ctx.react("❌");
        return ctx.reply("❌ Masukkan teks pesan yang ingin dibuat.");
      }
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, "0");
      const minutes = String(now.getMinutes()).padStart(2, "0");
      const currentTime = `${hours}:${minutes}`;
      const response = await axios.get("https://api.termai.cc/api/maker/iqc", {
        params: {
          text: text,
          timestamp: currentTime,
          emojiType: "ios",
          statusBarTime: currentTime,
          signal: 4,
          battery: "85",
          carrier: carrier,
          key: global.api?.termaiKey || "Bell409"
        },
        responseType: "arraybuffer",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 6e4
      });
      if (!response.data) {
        throw new Error("Gagal menerima hasil render iPhone Quote Chat.");
      }
      await sock.sendMessage(ctx.id, {
        image: Buffer.from(response.data),
        caption: `📱 *iPhone Quote Selesai*\n📝 *Pesan:* "${text}"\n📶 *Provider:* ${carrier}`
      }, {
        quoted: simpleQuoted(ctx)
      });
      await ctx.react("✅");
    } catch (error) {
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ IQC Error: ${errMsg}`);
    }
  }
};