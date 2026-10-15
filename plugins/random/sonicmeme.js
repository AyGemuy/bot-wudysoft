import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "sonicmeme",
  aliases: ["sonic", "memesonic"],
  description: "Mengirim meme Sonic the Hedgehog acak",
  category: "Random",
  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
    const botName = global.bot?.name || "Paimon-bot";
    const botFooter = global.bot?.footer || `${botName} • Sonic Meme Generator`;
    try {
      if (typeof ctx.react === "function") await ctx.react("⏳");
      const n = Math.floor(Math.random() * 33) + 1;
      const url = `https://raw.githubusercontent.com/RullzFuqi/library/main/database/meme/sonic/sonic-${n}.jpg`;
      const captionText = `–  *S O N I C  M E M E*

┌  ◦  *Koleksi* : #${n} dari 33
└  ◦  *Karakter* : Sonic The Hedgehog 🌀

Berikut adalah meme Sonic acak pilihan untukmu.`;
      const buttons = [{
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🎲 Meme Lainnya",
          id: `${prefix}sonicmeme`
        })
      }];
      const options = {
        image: url,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            list_title: `${botName} • Sonic Meme`,
            button_title: "Opsi Meme"
          }
        },
        contextInfo: {
          forwardingScore: 999,
          isForwarded: true
        },
        quoted: quotedMsg
      };
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(captionText, botFooter, buttons, options);
      } else {
        await sock.sendMessage(ctx.id, {
          image: {
            url: url
          },
          caption: captionText
        }, {
          quoted: quotedMsg
        });
      }
      if (typeof ctx.react === "function") await ctx.react("✅");
    } catch (error) {
      if (typeof ctx.react === "function") await ctx.react("❌");
      ctx.reply(`❌ Gagal mengambil meme Sonic: ${error.message}`);
    }
  }
};