import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/tools/sinonim`;
export default {
  name: "sinonim",
  aliases: ["persamaankata", "thesaurus", "antonim", "synonym"],
  description: "Mencari daftar sinonim dan antonim dengan visual panel gambar & tombol CTA salin",
  category: "Tools",
  limit: false,
  example: "sinonim angkat atau reply kata dengan .sinonim",
  execute: async (sock, ctx, msg) => {
    try {
      const prefix = ctx?.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const botName = global.bot?.name || "WudysoftBot";
      const textFromArgs = (ctx?.query || ctx?.args?.join(" ") || "").trim();
      const textFromQuoted = (ctx?.quoted?.text || ctx?.quoted?.message?.conversation || ctx?.quoted?.message?.extendedTextMessage?.text || msg?.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation || msg?.message?.extendedTextMessage?.contextInfo?.quotedMessage?.extendedTextMessage?.text || "").trim();
      const input = (textFromArgs || textFromQuoted).toLowerCase();
      if (!input) {
        let helpText = `📖 *PENCARI SINONIM & PERSAMAAN KATA*\n\n`;
        helpText += `Gunakan perintah ini untuk mencari padanan kata dalam bahasa Indonesia.\n\n`;
        helpText += `*Contoh Penggunaan:*\n`;
        helpText += `• Langsung: \`${prefix}sinonim angkat\`\n`;
        helpText += `• Langsung: \`${prefix}sinonim pintar\`\n`;
        helpText += `• Via Reply: Balas pesan kata dengan mengetik \`${prefix}sinonim\``;
        return ctx.reply(helpText);
      }
      await ctx.react("⏳");
      const {
        data
      } = await axios.get(API_URL, {
        params: {
          text: input
        },
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 25e3
      });
      const synonyms = Array.isArray(data?.synonyms) ? data.synonyms : [];
      const antonyms = Array.isArray(data?.antonyms) ? data.antonyms : [];
      const imageMedia = data?.imageLink || null;
      if (synonyms.length === 0 && antonyms.length === 0) {
        await ctx.react("❌");
        return ctx.reply(`❌ Tidak ditemukan sinonim atau antonim untuk kata "*${input}*".`);
      }
      let output = `╭───『 📖 *TESAURUS BAHASA INDONESIA* 』\n`;
      output += `│ 🔍 *Kata Dasar:* *${input.toUpperCase()}*\n`;
      output += `│ 📚 *Total Sinonim:* ${synonyms.length} Kata\n`;
      if (antonyms.length > 0) output += `│ ⚔️ *Total Antonim:* ${antonyms.length} Kata\n`;
      output += `╰────────────────────────\n\n`;
      if (synonyms.length > 0) {
        output += `📝 *Daftar Sinonim (Persamaan Kata):*\n`;
        synonyms.forEach(item => {
          output += `• ${item.word}\n`;
        });
      }
      if (antonyms.length > 0) {
        output += `\n⚔️ *Daftar Antonim (Lawan Kata):*\n`;
        antonyms.forEach(item => {
          output += `• ${item.word}\n`;
        });
      }
      output += `\n_Ketuk tombol di bawah untuk menyalin seluruh daftar sinonim._`;
      const copyWords = synonyms.map(s => s.word).join(", ");
      const buttons = [{
        name: "cta_copy",
        display_text: "📄 Salin Semua Sinonim",
        copy_code: copyWords
      }];
      const options = {
        image: imageMedia,
        media: imageMedia,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `${botName} • Tesaurus Indonesia`,
            button_title: "Salin Kata"
          }
        },
        contextInfo: {
          forwardingScore: 0,
          isForwarded: false
        },
        quoted: quotedMsg
      };
      if (typeof ctx?.sendCta === "function") {
        try {
          await ctx.sendCta(output, `${botName} • Sinonim Kata`, buttons, options);
          await ctx.react("✅");
          return;
        } catch (err) {
          console.error("[Sinonim sendCta Error]:", err.message);
        }
      }
      if (imageMedia) {
        try {
          await sock.sendMessage(ctx.id, {
            image: {
              url: imageMedia
            },
            caption: output
          }, {
            quoted: quotedMsg
          });
          await ctx.react("✅");
          return;
        } catch (err) {}
      }
      await sock.sendMessage(ctx.id, {
        text: output
      }, {
        quoted: quotedMsg
      });
      await ctx.react("✅");
    } catch (e) {
      console.error("[SINONIM ERROR]:", e);
      await ctx.react("❌");
      const errMsg = e.response?.data?.error || e.response?.data?.message || (typeof e.response?.data === "string" ? e.response.data : null) || e.message;
      ctx.reply(`❌ Gagal mengambil data sinonim: ${errMsg}`);
    }
  }
};