import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/tools/translate/v11`;

function parseTranslateFlags(rawStr) {
  const rest = {};
  let cleanText = rawStr;
  const flagRegex = /--([a-zA-Z0-9_-]+)(?:\s+("[^"]*"|'[^']*'|([^-\s]+(?:\s+[^-\s]+)*?(?=\s+--|$))))?/g;
  const matches = [...rawStr.matchAll(flagRegex)];
  for (const match of matches) {
    const key = match[1].toLowerCase();
    let val = match[2] || match[3] || true;
    if (typeof val === "string") {
      val = val.trim();
      if (val.startsWith('"') && val.endsWith('"') || val.startsWith("'") && val.endsWith("'")) {
        val = val.slice(1, -1);
      }
    }
    rest[key] = val;
    cleanText = cleanText.replace(match[0], "");
  }
  return {
    rest: rest,
    cleanText: cleanText.trim()
  };
}

function cleanQuotedCommand(text) {
  if (!text) return "";
  const commandRegex = /^[./#!][a-zA-Z0-9_-]+(?:\s+[a-zA-Z]{2,4})?\s+/;
  return text.replace(commandRegex, "").trim();
}
export default {
  name: "translate",
  aliases: ["tr", "translasi"],
  description: "Terjemahan teks ke berbagai bahasa menggunakan Wudysoft API v11 (POST)",
  category: "Tools",
  limit: true,
  example: 'translate en Halo dunia atau translate --to en --text "Halo dunia"',
  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "WudysoftBot";
    const footer = global.footer || global.bot?.footer || `_${botName}_`;
    const targetJid = ctx.chat || ctx.id;
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
    try {
      let rawText = (ctx.query || "").trim();
      let quotedText = "";
      if (ctx.quoted?.text) {
        quotedText = ctx.quoted.text.trim();
      } else if (quotedMsg?.message?.conversation) {
        quotedText = quotedMsg.message.conversation.trim();
      } else if (quotedMsg?.message?.extendedTextMessage?.text) {
        quotedText = quotedMsg.message.extendedTextMessage.text.trim();
      }
      if (quotedText) {
        quotedText = cleanQuotedCommand(quotedText);
      }
      const {
        rest,
        cleanText
      } = parseTranslateFlags(rawText);
      let targetLang = rest.to || rest.lang || rest.target || "";
      let sourceLang = rest.from || rest.source || "auto";
      let textToTranslate = rest.text || cleanText || "";
      if (!targetLang && textToTranslate) {
        const args = textToTranslate.split(/\s+/);
        if (args.length > 0 && args.length >= 2 && args[0].length >= 2 && args[0].length <= 4 && /^[a-zA-Z]+$/.test(args[0])) {
          targetLang = args[0].toLowerCase();
          textToTranslate = args.slice(1).join(" ").trim();
        }
      }
      if (!textToTranslate && quotedText) {
        textToTranslate = quotedText;
      }
      if (!targetLang) {
        targetLang = "id";
      }
      if (!textToTranslate) {
        const helpText = `– *T R A N S L A T E*\n\n` + `┌ ◦ *Usage* : ${prefix}translate <kode_bahasa> <teks>\n` + `│ ◦ *Quoted* : Balas pesan teks dengan ${prefix}translate <kode_bahasa>\n` + `└ ◦ *Function* : Menerjemahkan bahasa ke berbagai bahasa dunia\n\n` + `– *E X A M P L E*\n\n` + `┌ ◦ *English (EN)* : ${prefix}translate en Halo dunia\n` + `│ ◦ *Indonesian (ID)* : ${prefix}translate id Good morning\n` + `└ ◦ *Japanese (JA)* : ${prefix}translate ja Selamat siang\n\n` + `${footer}`;
        return ctx.reply(helpText);
      }
      await ctx.react("⏳");
      const {
        data
      } = await axios.post(API_URL, {
        text: textToTranslate,
        to: targetLang,
        from: sourceLang
      }, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 3e4
      });
      const translatedText = Array.isArray(data?.result) ? data.result[0] : data?.result;
      if (!translatedText) {
        throw new Error(data?.raw?.message || data?.message || "Gagal mendapatkan hasil terjemahan dari server.");
      }
      const outputText = `– *T R A N S L A T E*\n\n` + `┌ ◦ *From* : ${sourceLang.toUpperCase()}\n` + `└ ◦ *To* : ${targetLang.toUpperCase()}\n\n` + `${translatedText}\n\n` + `${footer}`;
      await sock.sendMessage(targetJid, {
        text: outputText
      }, {
        quoted: quotedMsg
      });
      await ctx.react("✅");
    } catch (error) {
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || error.message;
      ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : ${errMsg}\n` + `└ ◦ *Command* : ${ctx.command || "translate"}\n\n` + `${footer}`);
    }
  }
};