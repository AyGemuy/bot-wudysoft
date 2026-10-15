import axios from "axios";
import * as cheerio from "cheerio";
import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "komikusearch",
  aliases: ["komiku", "mangasearch"],
  description: "Mencari manga dan komik online di Komiku",
  category: "Search",
  example: "komikusearch one piece",
  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "WudysoftBot";
    const footer = global.footer || global.bot?.footer || `_${botName}_`;
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
    try {
      if (!ctx.args.length) {
        const helpText = `– *K O M I K U*\n\n` + `┌ ◦ *Usage* : ${prefix}komikusearch <judul>\n` + `│ ◦ *Detail* : ${prefix}komikusearch detail <link/slug>\n` + `└ ◦ *Function* : Mencari manga dan komik online di Komiku\n\n` + `${footer}`;
        return ctx.reply(helpText);
      }
      await ctx.react("⏳");
      if (ctx.args[0].toLowerCase() === "detail") {
        const q = ctx.args.slice(1).join(" ").trim();
        const url = q.startsWith("http") ? q : "https://komiku.org/manga/" + q.replace(/\s+/g, "-").toLowerCase() + "/";
        const res = await axios.get(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
          },
          timeout: 3e4
        });
        const $ = cheerio.load(res.data);
        const title = $("#Judul h1 span").text().trim() || "Untitled";
        const indo = $("#Judul .j2").text().trim();
        const desk = $(".desc").text().trim().slice(0, 600);
        const img = $(".ims img").attr("src");
        const info = {};
        $(".inftable tr").each((i, e) => {
          const k = $(e).find("td").eq(0).text().trim();
          const v = $(e).find("td").eq(1).text().trim();
          if (k) info[k] = v;
        });
        const genre = $(".genre span").map((i, e) => $(e).text().trim()).get().join(", ");
        const caption = `– *M A N G A  -  D E T A I L*\n\n` + `┌ ◦ *Title* : ${title}\n` + `│ ◦ *Indonesian* : ${indo || "-"}\n` + `│ ◦ *Type* : ${info["Jenis Komik"] || "-"}\n` + `│ ◦ *Concept* : ${info["Konsep Cerita"] || "-"}\n` + `│ ◦ *Author* : ${info["Pengarang"] || "-"}\n` + `│ ◦ *Status* : ${info["Status"] || "-"}\n` + `│ ◦ *Age* : ${info["Umur Pembaca"] || "-"}\n` + `│ ◦ *Genre* : ${genre || "-"}\n` + `└ ◦ *Link* : ${url}\n\n` + `*Sinopsis:*\n` + `_${desk || "Tidak ada sinopsis yang tersedia."}_\n\n` + `${footer}`;
        if (img) {
          await sock.sendMessage(ctx.id, {
            image: {
              url: img
            },
            caption: caption
          }, {
            quoted: quotedMsg
          });
        } else {
          await ctx.reply(caption, {
            quoted: quotedMsg
          });
        }
        await ctx.react("✅");
        return;
      }
      const res = await axios.get("https://api.komiku.id/", {
        params: {
          post_type: "manga",
          s: ctx.query
        },
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        },
        timeout: 3e4
      });
      const $ = cheerio.load(res.data);
      const el = $(".bge").first();
      if (!el.length) {
        await ctx.react("❌");
        return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Manga tidak ditemukan\n` + `└ ◦ *Query* : "${ctx.query}"\n\n` + `${footer}`);
      }
      const title = el.find("h3").text().trim() || "Untitled";
      const link = "https://komiku.org" + el.find("a").attr("href");
      const img = el.find("img").attr("src");
      const type = el.find(".tpe1_inf").text().trim();
      const update = el.find(".kan p").text().trim();
      const awal = el.find(".new1").eq(0).text().replace(/\s+/g, " ").trim();
      const latest = el.find(".new1").eq(1).text().replace(/\s+/g, " ").trim();
      const caption = `– *K O M I K U*\n\n` + `┌ ◦ *Title* : ${title}\n` + `│ ◦ *Type* : ${type || "-"}\n` + `│ ◦ *Updated* : ${update || "-"}\n` + `│ ◦ *First Ch* : ${awal || "-"}\n` + `│ ◦ *Latest Ch* : ${latest || "-"}\n` + `└ ◦ *Link* : ${link}\n\n` + `_Ketik \`${prefix}komikusearch detail ${link}\` untuk melihat informasi lengkap._\n\n` + `${footer}`;
      if (img) {
        await sock.sendMessage(ctx.id, {
          image: {
            url: img
          },
          caption: caption
        }, {
          quoted: quotedMsg
        });
      } else {
        await ctx.reply(caption, {
          quoted: quotedMsg
        });
      }
      await ctx.react("✅");
    } catch (error) {
      console.error("[Komiku Error]:", error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.message;
      ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : ${errMsg}\n` + `└ ◦ *Command* : ${ctx.command || "komikusearch"}\n\n` + `${footer}`);
    }
  }
};