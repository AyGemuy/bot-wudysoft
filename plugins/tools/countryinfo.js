import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "countryinfo",
  aliases: ["country", "negara"],
  description: "Menampilkan informasi lengkap suatu negara",
  category: "Tools",
  example: "countryinfo Indonesia",
  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "WudysoftBot";
    const footer = global.footer || global.bot?.footer || `_${botName}_`;
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
    try {
      const countryInput = (ctx.query || ctx.args?.join(" ") || "").trim();
      if (!countryInput) {
        const helpText = `– *C O U N T R Y  I N F O*\n\n` + `┌ ◦ *Usage* : ${prefix}countryinfo <nama_negara>\n` + `└ ◦ *Example* : ${prefix}countryinfo Indonesia\n\n` + `${footer}`;
        return ctx.reply(helpText);
      }
      await ctx.react("⏳");
      const res = await axios.get("https://api.siputzx.my.id/api/tools/countryInfo", {
        params: {
          name: countryInput
        },
        timeout: 3e4
      });
      const data = res.data;
      if (!data || data.status !== true || !data.data) {
        await ctx.react("❌");
        return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Negara tidak ditemukan\n` + `└ ◦ *Query* : "${countryInput}"\n\n` + `${footer}`);
      }
      const c = data.data;
      const neighbors = c.neighbors?.length ? c.neighbors.map(v => v.name).join(", ") : "-";
      const languages = c.languages?.native?.join(", ") || c.languages?.official?.join(", ") || "-";
      const area = c.area?.squareKilometers ? `${c.area.squareKilometers.toLocaleString("id-ID")} km²` : "-";
      const caption = `– *C O U N T R Y  I N F O*\n\n` + `┌ ◦ *Name* : ${c.name}\n` + `│ ◦ *Capital* : ${c.capital || "-"}\n` + `│ ◦ *Continent* : ${c.continent?.name || "-"} ${c.continent?.emoji || ""}\n` + `│ ◦ *Calling Code* : ${c.phoneCode || "-"}\n` + `│ ◦ *Currency* : ${c.currency || "-"}\n` + `│ ◦ *Language* : ${languages}\n` + `│ ◦ *Area* : ${area}\n` + `│ ◦ *Driving Side* : ${c.drivingSide || "-"}\n` + `│ ◦ *Domain* : ${c.internetTLD || "-"}\n` + `│ ◦ *Government* : ${c.constitutionalForm || "-"}\n` + `│ ◦ *Famous For* : ${c.famousFor || "-"}\n` + `│ ◦ *Neighbors* : ${neighbors}\n` + `└ ◦ *Google Maps* : ${c.googleMapsLink || "-"}\n\n` + `${footer}`;
      await sock.sendMessage(ctx.id, {
        image: {
          url: c.flag
        },
        caption: caption
      }, {
        quoted: quotedMsg
      });
      await ctx.react("✅");
    } catch (error) {
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.message;
      ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : ${errMsg}\n` + `└ ◦ *Command* : ${ctx.command || "countryinfo"}\n\n` + `${footer}`);
    }
  }
};