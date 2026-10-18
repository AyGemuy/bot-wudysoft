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
      const rawText = (ctx.args?.join(" ") || ctx.query || ctx.quoted?.text || "").trim();
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (!rawText) {
        return ctx.reply(`–  *I P H O N E  Q U O T E  C H A T*

Silakan masukkan teks pesan yang ingin dibuat.

┌  ◦  *Format* : \`${prefix}iqc <pesan> | [operator]\`
│  ◦  *Operator* : \`Telkomsel\`, \`Indosat\`, \`XL\`, \`Tri\`, \`Smartfren\`
└  ◦  *Contoh* : \`${prefix}iqc selamat malam kamu | Indosat\``);
      }
      ctx.react?.("⏳");
      const [text, carrier = "Telkomsel"] = rawText.split("|").map(v => v.trim());
      if (!text) {
        ctx.react?.("❌");
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
      const captionText = `–  *I P H O N E  Q U O T E*

┌  ◦  *Pesan* : "${text}"
└  ◦  *Provider* : ${carrier}`;
      await sock.sendMessage(ctx.id, {
        image: Buffer.from(response.data),
        caption: captionText
      }, {
        quoted: quotedMsg
      });
      ctx.react?.("✅");
    } catch (error) {
      ctx.react?.("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ IQC Error: ${errMsg}`);
    }
  }
};