import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/tools/math`;
export default {
  name: "math",
  aliases: ["calc", "kalkulator", "hitung", "solve"],
  description: "Kalkulator pintar via MathJS API metode POST dengan tombol salin hasil",
  category: "Tools",
  limit: false,
  example: "math 25 * 4 + sqrt(144) atau reply chat dengan .math",
  execute: async (sock, ctx, msg) => {
    try {
      const prefix = ctx?.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const footer = global.footer || `_${botName}_`;
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const textFromArgs = (ctx?.query || ctx?.args?.join(" ") || "").trim();
      const textFromQuoted = (ctx?.quoted?.text || ctx?.quoted?.message?.conversation || ctx?.quoted?.message?.extendedTextMessage?.text || msg?.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation || msg?.message?.extendedTextMessage?.contextInfo?.quotedMessage?.extendedTextMessage?.text || "").trim();
      const input = textFromArgs || textFromQuoted;
      if (!input) {
        const helpText = `– *M A T H*\n\n` + `┌ ◦ *Usage* : ${prefix}math <expression>\n` + `│ ◦ *Quoted* : Balas pesan berisi rumus matematika\n` + `└ ◦ *Function* : Menghitung rumus & konversi secara instan\n\n` + `– *E X A M P L E*\n\n` + `┌ ◦ *Basic* : ${prefix}math 25000 * 12 / 2\n` + `│ ◦ *Pangkat & Akar* : ${prefix}math 2^8 + sqrt(144)\n` + `│ ◦ *Trigonometri* : ${prefix}math sin(45 deg) + cos(45 deg)\n` + `└ ◦ *Konversi* : ${prefix}math 10 inch to cm\n\n` + `${footer}`;
        return ctx.reply(helpText);
      }
      await ctx.react("⏳");
      const cleanExpr = input.replace(/×/g, "*").replace(/÷/g, "/").trim();
      const {
        data
      } = await axios.post(API_URL, {
        expr: cleanExpr
      }, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 25e3
      });
      const result = data?.result !== undefined ? data.result : data;
      if (result === undefined || result === null) {
        await ctx.react("❌");
        return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Gagal memproses perhitungan\n` + `└ ◦ *Detail* : Server tidak menemukan hasil untuk ekspresi tersebut.\n\n` + `${footer}`);
      }
      const stringResult = String(result).trim();
      const output = `– *M A T H*\n\n` + `┌ ◦ *Query* : ${input}\n` + `└ ◦ *Result* : *${stringResult}*\n\n` + `${footer}`;
      const buttons = [{
        name: "cta_copy",
        display_text: "Salin Hasil",
        copy_code: stringResult
      }];
      const options = {
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `${botName} • Math Result`,
            button_title: "Salin"
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
          await ctx.sendCta(output, `${botName} • Math Calculator`, buttons, options);
          await ctx.react("✅");
          return;
        } catch (err) {
          console.error("[Math sendCta Error]:", err.message);
        }
      }
      try {
        await sock.sendMessage(ctx.id, {
          viewOnceMessage: {
            message: {
              interactiveMessage: {
                body: {
                  text: output
                },
                footer: {
                  text: `${botName} • Math Calculator`
                },
                nativeFlowMessage: {
                  buttons: [{
                    name: "cta_copy",
                    buttonParamsJson: JSON.stringify({
                      display_text: "Salin Hasil",
                      copy_code: stringResult
                    })
                  }]
                },
                contextInfo: options.contextInfo
              }
            }
          }
        }, {
          quoted: quotedMsg
        });
        await ctx.react("✅");
        return;
      } catch (err) {}
      await sock.sendMessage(ctx.id, {
        text: output
      }, {
        quoted: quotedMsg
      });
      await ctx.react("✅");
    } catch (e) {
      console.error("[MATH CALCULATOR ERROR]:", e);
      await ctx.react("❌");
      const errMsg = e.response?.data?.error || e.response?.data?.message || (typeof e.response?.data === "string" ? e.response.data : null) || e.message;
      ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : ${errMsg}\n` + `└ ◦ *Command* : ${ctx.command || "math"}\n\n` + `${global.footer || `_${global.bot?.name || "WudysoftBot"}_`}`);
    }
  }
};