import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "fakemailinbox",
  aliases: ["fakemail-inbox", "mailinbox"],
  description: "Cek inbox fake mail",
  category: "Tools",
  example: "fakemailinbox <mail_id>",
  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "WudysoftBot";
    const footer = global.footer || global.bot?.footer || `_${botName}_`;
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
    try {
      const mailId = (ctx.query || ctx.args?.[0] || "").trim();
      if (!mailId) {
        const helpText = `– *F A K E  M A I L*\n\n` + `┌ ◦ *Usage* : ${prefix}fakemailinbox <mail_id>\n` + `└ ◦ *Example* : ${prefix}fakemailinbox 123456\n\n` + `${footer}`;
        return ctx.reply(helpText);
      }
      await ctx.react("⏳");
      const res = await axios.get("https://api.vreden.my.id/api/v1/tools/fakemail/inbox", {
        params: {
          id: mailId
        },
        timeout: 3e4
      });
      const data = res.data;
      if (!data || data.status !== true) {
        await ctx.react("❌");
        return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Gagal memuat kotak masuk\n` + `└ ◦ *Info* : Mail ID tidak ditemukan atau telah kedaluwarsa.\n\n` + `${footer}`);
      }
      const mails = data.result?.mails;
      if (!mails || mails.length === 0) {
        await ctx.react("📭");
        return ctx.reply(`– *F A K E  M A I L*\n\n` + `┌ ◦ *ID* : ${mailId}\n` + `│ ◦ *Status* : Kotak masuk masih kosong\n` + `└ ◦ *Info* : Belum ada email yang masuk ke ID ini.\n\n` + `${footer}`);
      }
      let text = `– *F A K E  M A I L  -  I N B O X*\n\n` + `┌ ◦ *ID* : ${mailId}\n` + `└ ◦ *Total* : ${mails.length} Pesan Diterima\n\n`;
      text += mails.map((mail, i) => {
        return `┌ ◦ *#${i + 1} From* : ${mail.from || "-"}\n` + `│ ◦ *Subject* : ${mail.subject || "-"}\n` + `└ ◦ *Date* : ${mail.date || "-"}`;
      }).join("\n\n");
      text += `\n\n${footer}`;
      await sock.sendMessage(ctx.id, {
        text: text
      }, {
        quoted: quotedMsg
      });
      await ctx.react("✅");
    } catch (error) {
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.message;
      ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : ${errMsg}\n` + `└ ◦ *Command* : ${ctx.command || "fakemailinbox"}\n\n` + `${footer}`);
    }
  }
};