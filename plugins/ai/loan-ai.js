import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/ai/loan-ai`;
const CONFIG = {
  TIMEOUT: 6e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /--([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1];
    let rawVal = match[2];
    let val = true;
    if (rawVal !== undefined) {
      if (rawVal.startsWith('"') && rawVal.endsWith('"') || rawVal.startsWith("'") && rawVal.endsWith("'")) {
        rawVal = rawVal.slice(1, -1);
      }
      if (rawVal === "true") val = true;
      else if (rawVal === "false") val = false;
      else if (!isNaN(rawVal) && rawVal.trim() !== "") val = Number(rawVal);
      else val = rawVal;
    }
    flags[key] = val;
  }
  const cleanPrompt = input.replace(flagRegex, "").trim();
  return {
    flags: flags,
    cleanPrompt: cleanPrompt
  };
}
export default {
  name: "loanai",
  aliases: ["loan", "loan-ai"],
  description: "Chat percakapan cerdas dengan Loan AI Assistant.",
  category: "AI",
  limit: true,
  example: "loanai jelaskan apa itu black hole",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["loanai", "loan", "loan-ai"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (!rawText) {
        const guideText = `–  *L O A N  A I*

Layanan asisten obrolan cerdas untuk menjawab berbagai pertanyaan dan analisis teks.

┌  ◦  *Format* : \`${prefix}loanai <pertanyaan>\`
└  ◦  *Contoh* : \`${prefix}loanai jelaskan konsep dasar machine learning\``;
        return ctx.reply(guideText, {
          quoted: quotedMsg
        });
      }
      await ctx.react("💭");
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      const prompt = flags.prompt || cleanPrompt;
      const payload = {
        prompt: prompt,
        ...flags
      };
      const {
        data
      } = await axios.post(API_URL, payload, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": CONFIG.USER_AGENT
        },
        timeout: CONFIG.TIMEOUT
      });
      if (!data || !data.status || !data.result) {
        throw new Error(data?.message || "Gagal mendapatkan respon dari server.");
      }
      const resObj = data.result;
      const content = resObj.content || resObj.messages?.[resObj.messages.length - 1]?.content || "Tidak ada respon.";
      const responseText = `–  *L O A N  A I*

${content.trim()}`;
      await sock.sendMessage(ctx.id, {
        text: responseText
      }, {
        quoted: quotedMsg
      });
      await ctx.react("✨");
    } catch (error) {
      console.error("[LoanAI Error]:", error?.message || error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Terjadi kendala pada Loan AI: ${errMsg}`);
    }
  }
};