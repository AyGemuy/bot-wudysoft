import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "fakengl",
  aliases: ["fakeng", "nglmaker", "ngl"],
  description: "Membuat fake NGL message card",
  category: "Maker",
  limit: true,
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = (ctx.args?.join(" ") || ctx.query || ctx.quoted?.text || "").trim();
      if (!rawText) {
        return ctx.reply(`💌 *FAKE NGL GENERATOR*\n\n` + `👉 Format: *${ctx.prefix || "."}fakengl <pesan> | [warna_tema]*\n` + `👉 Pilihan Warna: \`dark\`, \`light\`, \`pink\`, \`blue\`\n\n` + `📌 *Contoh:*\n` + `• *${ctx.prefix || "."}fakengl kirim pesan rahasia*\n` + `• *${ctx.prefix || "."}fakengl kamu lucu banget | dark*`);
      }
      await ctx.react("⏳");
      const parts = rawText.split("|").map(v => v.trim());
      const text = parts[0];
      const bgColor = parts[1] || "dark";
      if (!text) {
        await ctx.react("❌");
        return ctx.reply("❌ Masukkan teks pesan NGL yang ingin dibuat.");
      }
      const response = await axios.get("https://api.termai.cc/api/maker/ngl", {
        params: {
          text: text,
          backgroundColor: bgColor,
          key: global.api?.termaiKey || "Bell409"
        },
        responseType: "arraybuffer",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 6e4
      });
      if (!response.data) {
        throw new Error("Gagal menerima hasil gambar dari server NGL.");
      }
      await sock.sendMessage(ctx.id, {
        image: Buffer.from(response.data),
        caption: `💌 *Fake NGL Card Selesai*\n📝 *Pesan:* "${text}"\n🎨 *Tema:* ${bgColor}`
      }, {
        quoted: simpleQuoted(ctx)
      });
      await ctx.react("✅");
    } catch (error) {
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Fake NGL Error: ${errMsg}`);
    }
  }
};