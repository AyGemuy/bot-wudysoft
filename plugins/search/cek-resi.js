import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const V17_URL = `${global.bot?.api?.wudysoft}/api/tools/cek-resi/v17`;
const V18_URL = `${global.bot?.api?.wudysoft}/api/tools/cek-resi/v18`;

function parseResiFlags(rawStr) {
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
export default {
  name: "cekresi",
  aliases: ["resi", "track"],
  description: "Cek resi pengiriman otomatis dengan format pesan terstruktur WhatsApp",
  category: "Tools",
  limit: true,
  example: "resi anteraja 11004324915349 atau resi --exp jne --resi 12345678",
  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "WudysoftBot";
    const footer = global.footer || global.bot?.footer || `_${botName}_`;
    const targetJid = ctx.chat || ctx.id;
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
    try {
      let rawText = (ctx.query || "").trim();
      const {
        rest,
        cleanText
      } = parseResiFlags(rawText);
      let expedisi = rest.exp || rest.expedisi || rest.courier || "";
      let resi = rest.resi || rest.no || "";
      if (!expedisi || !resi) {
        const args = cleanText.split(/\s+/);
        if (args.length >= 2) {
          if (!expedisi) expedisi = args[0].toLowerCase();
          if (!resi) resi = args[1];
        }
      }
      if (!expedisi || !resi) {
        const helpText = `– *C E K  R E S I*\n\n` + `┌ ◦ *Usage* : ${prefix}resi <ekspedisi> <no_resi>\n` + `└ ◦ *Function* : Melacak status pengiriman paket ekspedisi\n\n` + `– *E X A M P L E*\n\n` + `┌ ◦ *Basic* : ${prefix}resi anteraja 11004324915349\n` + `└ ◦ *Flags* : ${prefix}resi --exp jne --resi 12345678\n\n` + `${footer}`;
        return ctx.reply(helpText);
      }
      await ctx.react("⏳");
      let courierFormat = null;
      let useV17 = false;
      let v17Data = null;
      let v18Data = null;
      try {
        const v17ListRes = await axios.get(`${V17_URL}?action=list`, {
          timeout: 1e4
        });
        const couriersV17 = v17ListRes.data?.couriers || [];
        const matchV17 = couriersV17.find(c => c.format.toLowerCase() === expedisi.toLowerCase() || c.name.toLowerCase().includes(expedisi.toLowerCase()));
        if (matchV17) {
          courierFormat = matchV17.format;
          useV17 = true;
        }
      } catch (e) {}
      if (useV17 && courierFormat) {
        try {
          const v17Check = await axios.get(`${V17_URL}?action=check`, {
            params: {
              expedisi: courierFormat,
              resi: resi
            },
            timeout: 3e4
          });
          if (v17Check.data && v17Check.data.success) {
            v17Data = v17Check.data;
          } else {
            useV17 = false;
          }
        } catch (err) {
          useV17 = false;
        }
      }
      if (!useV17) {
        const v18Check = await axios.get(`${V18_URL}?action=check`, {
          params: {
            expedisi: expedisi,
            resi: resi
          },
          timeout: 3e4
        });
        v18Data = v18Check.data;
        if (!v18Data || !v18Data.success) {
          throw new Error(v18Data?.pesan || "Gagal melacak resi dari server v17 maupun v18.");
        }
      }
      let resultText = "";
      if (useV17 && v17Data) {
        let historyStr = "";
        if (Array.isArray(v17Data.history) && v17Data.history.length > 0) {
          historyStr = v17Data.history.map(h => `• ${h.datetime ? `[${h.datetime}] ` : ""}${h.description}`).join("\n");
        }
        resultText = `– *C E K  R E S I*\n\n` + `┌ ◦ *Waybill* : ${v17Data.resi || resi}\n` + `│ ◦ *Courier* : ${(v17Data.courier || expedisi).toUpperCase()}\n` + `└ ◦ *Status* : ${v17Data.status || "PROSES"}\n\n` + (historyStr ? `*Riwayat Perjalanan:*\n${historyStr}\n\n` : "") + `${footer}`;
      } else if (v18Data) {
        const details = v18Data.details || {};
        let historyStr = "";
        if (Array.isArray(v18Data.history) && v18Data.history.length > 0) {
          historyStr = v18Data.history.map(h => `• [${h.waktu || "-"}] ${h.keterangan}${h.tempat ? ` (${h.tempat})` : ""}`).join("\n");
        }
        resultText = `– *C E K  R E S I*\n\n` + `┌ ◦ *Waybill* : ${v18Data.resi || resi}\n` + `│ ◦ *Courier* : ${(v18Data.expedisi || expedisi).toUpperCase()}\n` + `│ ◦ *Service* : ${details.service_code || "-"}\n` + `└ ◦ *Receiver* : ${details.receiver_name || "-"}\n\n` + (historyStr ? `*Riwayat Perjalanan:*\n${historyStr}\n\n` : "") + `${footer}`;
      }
      await sock.sendMessage(targetJid, {
        text: resultText
      }, {
        quoted: quotedMsg
      });
      await ctx.react("✅");
    } catch (error) {
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.pesan || error.message;
      ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : ${errMsg}\n` + `└ ◦ *Command* : ${ctx.command || "resi"}\n\n` + `${footer}`);
    }
  }
};