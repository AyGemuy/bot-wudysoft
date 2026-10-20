import axios from "axios";
import { simpleQuoted } from "../../lib/quoted.js";

const API_URL = `${global.bot?.api?.wudysoft}/api/tools/sinonim`;

export default {
  name: "sinonim",
  aliases: ["persamaankata", "thesaurus", "antonim", "synonym"],
  description: "Mencari daftar sinonim dan antonim kata bahasa Indonesia (Tampilan Neoxr).",
  category: "Tools",
  limit: false,
  example: "sinonim angkat atau reply kata dengan .sinonim",

  execute: async (sock, ctx, msg) => {
    const prefix = ctx?.prefix || ".";
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
    const botName = global.bot?.name || "WudysoftBot";
    const footer = global.footer || global.bot?.footer || `_${botName}_`;
    const targetJid = ctx.chat || ctx.id;

    try {
      const textFromArgs = (ctx?.query || ctx?.args?.join(" ") || "").trim();
      const textFromQuoted = (
        ctx?.quoted?.text ||
        ctx?.quoted?.message?.conversation ||
        ctx?.quoted?.message?.extendedTextMessage?.text ||
        msg?.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation ||
        msg?.message?.extendedTextMessage?.contextInfo?.quotedMessage?.extendedTextMessage?.text ||
        ""
      ).trim();

      const input = (textFromArgs || textFromQuoted).toLowerCase();

      if (!input) {
        const guideText = `–  *S I N O N I M  &  A N T O N I M*

Cari padanan kata (sinonim) dan lawan kata (antonim) resmi bahasa Indonesia.

┌  ◦  *Langsung* : \`${prefix}sinonim pintar\`
│  ◦  *Langsung* : \`${prefix}sinonim angkat\`
└  ◦  *Via Balas/Reply* : Balas pesan target lalu ketik \`${prefix}sinonim\`

${footer}`;
        return ctx.reply(guideText, { quoted: quotedMsg });
      }

      await ctx.react("⏳");

      const { data } = await axios.get(API_URL, {
        params: { text: input },
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        },
        timeout: 25e3
      });

      const synonyms = Array.isArray(data?.synonyms) ? data.synonyms : [];
      const antonyms = Array.isArray(data?.antonyms) ? data.antonyms : [];
      const imageMedia = data?.imageLink || null;

      if (synonyms.length === 0 && antonyms.length === 0) {
        await ctx.react("❌");
        return ctx.reply(
          `–  *S I N O N I M  N O T  F O U N D*\n\n` +
          `┌  ◦  *Kata* : "${input}"\n` +
          `└  ◦  *Status* : Tidak ditemukan data padanan kata.\n\n` +
          `${footer}`,
          { quoted: quotedMsg }
        );
      }

      // Format Neoxr Style
      let output = `–  *S I N O N I M  -  K A T A*\n\n`;
      output += `┌  ◦  *Kata Dasar* : ${input.toUpperCase()}\n`;
      output += `│  ◦  *Total Sinonim* : ${synonyms.length} Kata\n`;
      if (antonyms.length > 0) {
        output += `│  ◦  *Total Antonim* : ${antonyms.length} Kata\n`;
      }
      output += `└  ◦  *Sumber* : Tesaurus Bahasa Indonesia\n\n`;

      if (synonyms.length > 0) {
        output += `┌  ◦  *Sinonim (Persamaan Kata)* :\n`;
        const synList = synonyms.map(s => s.word).join(", ");
        output += `│  └ ${synList}\n`;
        output += `└  ◦\n\n`;
      }

      if (antonyms.length > 0) {
        output += `┌  ◦  *Antonim (Lawan Kata)* :\n`;
        const antList = antonyms.map(a => a.word).join(", ");
        output += `│  └ ${antList}\n`;
        output += `└  ◦\n\n`;
      }

      output += `${footer}`;

      const copyWords = synonyms.map(s => s.word).join(", ");
      const buttons = [{
        name: "cta_copy",
        display_text: "📄 Salin Semua Sinonim",
        copy_code: copyWords || input
      }];

      if (typeof ctx?.sendCta === "function") {
        try {
          await ctx.sendCta(output, "", buttons, {
            media: imageMedia || null,
            quoted: quotedMsg
          });
          await ctx.react("✅");
          return;
        } catch (err) {
          console.error("[Sinonim sendCta Error]:", err.message);
        }
      }

      if (imageMedia) {
        try {
          await sock.sendMessage(targetJid, {
            image: { url: imageMedia },
            caption: output
          }, { quoted: quotedMsg });
          await ctx.react("✅");
          return;
        } catch {}
      }

      await sock.sendMessage(targetJid, { text: output }, { quoted: quotedMsg });
      await ctx.react("✅");
    } catch (e) {
      console.error("[SINONIM ERROR]:", e);
      await ctx.react("❌");
      const errMsg = e.response?.data?.error || e.response?.data?.message || (typeof e.response?.data === "string" ? e.response.data : null) || e.message;
      ctx.reply(`–  *E R R O R*\n\n┌  ◦  *Info* : ${errMsg}\n└  ◦  *Command* : ${ctx.command || "sinonim"}\n\n${footer}`);
    }
  }
};