import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/nsfw/nhentai`;
const THUMB_CDN = "https://t1.nhentai.net/";
const formatNumber = num => typeof num === "number" ? num.toLocaleString("id-ID") : num || "0";

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /--([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1];
    let rawVal = match[2];
    let val = true;
    const lowerKey = key.toLowerCase();
    if (["id", "code", "g", "detail", "read"].includes(lowerKey)) key = "id";
    if (["search", "q", "find", "s", "query"].includes(lowerKey)) key = "search";
    if (["popular", "pop", "p", "top"].includes(lowerKey)) key = "popular";
    if (["random", "rand", "r"].includes(lowerKey)) key = "random";
    if (["related", "rel"].includes(lowerKey)) key = "related";
    if (["tagged", "tag"].includes(lowerKey)) key = "tagged";
    if (["sort", "order"].includes(lowerKey)) key = "sort";
    if (["page", "pg"].includes(lowerKey)) key = "page";
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
  name: "nhentai",
  aliases: ["nh", "nhent", "doujin", "doujinshi"],
  description: "Cari dan baca doujinshi nHentai (CTA Media List & Bottom Sheet)",
  category: "NSFW",
  limit: true,
  example: "nhentai yume atau nhentai --random atau nhentai --id 201603",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["nhentai", "nh", "nhent", "doujin", "doujinshi"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      const sendDoujinDetail = async doujin => {
        if (!doujin || !doujin.id) {
          await ctx.react("❌");
          return ctx.reply("❌ Detail doujin tidak ditemukan.");
        }
        const titleEng = doujin.title?.english || doujin.english_title || doujin.title?.pretty || `Doujin #${doujin.id}`;
        const titleJp = doujin.title?.japanese || doujin.japanese_title || "-";
        const totalPages = doujin.num_pages || "-";
        const favorites = formatNumber(doujin.num_favorites);
        const allTags = doujin.tags || [];
        const artists = allTags.filter(t => t.type === "artist").map(t => t.name).join(", ") || "-";
        const parodies = allTags.filter(t => t.type === "parody").map(t => t.name).join(", ") || "-";
        const characters = allTags.filter(t => t.type === "character").map(t => t.name).join(", ") || "-";
        const languages = allTags.filter(t => t.type === "language").map(t => t.name).join(", ") || "-";
        const tags = allTags.filter(t => t.type === "tag").map(t => `#${t.name}`).slice(0, 10).join(" ") || "-";
        const webUrl = `https://nhentai.net/g/${doujin.id}/`;
        const coverPath = doujin.cover?.path || doujin.thumbnail?.path || doujin.thumbnail;
        const coverUrl = coverPath ? coverPath.startsWith("http") ? coverPath : `${THUMB_CDN}${coverPath}` : null;
        const caption = `📖 *NHENTAI DOUJIN DETAIL*\n\n` + `• *Judul:* ${titleEng}\n` + `• *Romaji/Jp:* ${titleJp}\n` + `• *Kode ID:* \`${doujin.id}\`\n` + `• *Artist:* ${artists}\n` + `• *Parodi:* ${parodies}\n` + `• *Karakter:* ${characters}\n` + `• *Bahasa:* ${languages}\n` + `• *Total Halaman:* ${totalPages} Halaman\n` + `• *Disukai:* ${favorites} Pengguna\n` + `• *Tags:* ${tags}\n\n` + `🔗 *Tautan Online:*\n${webUrl}`;
        const buttons = [{
          name: "cta_url",
          display_text: "🌐 Baca di Browser (nhentai.net)",
          url: webUrl
        }, {
          name: "quick_reply",
          display_text: "🔗 Doujin Terkait",
          id: `${prefix}nhentai --related ${doujin.id}`
        }, {
          name: "quick_reply",
          display_text: "🎲 Doujin Acak Lainnya",
          id: `${prefix}nhentai --random`
        }];
        const options = {
          image: coverUrl || undefined,
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 1,
              divider_indices: [1],
              list_title: `${botName} • nHentai Reader`,
              button_title: "Opsi Membaca"
            }
          },
          quoted: quotedMsg
        };
        if (typeof ctx.sendCta === "function") {
          await ctx.sendCta(caption, `${botName} • nHentai Reader`, buttons, options);
        } else if (coverUrl) {
          await sock.sendMessage(ctx.id, {
            image: {
              url: coverUrl
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
      };
      if (flags.random) {
        await ctx.react("⏳");
        const {
          data: res
        } = await axios.post(API_URL, {
          action: "random"
        }, {
          headers: {
            "Content-Type": "application/json"
          },
          timeout: 3e4
        });
        const randId = res?.id;
        if (!randId) {
          await ctx.react("❌");
          return ctx.reply("❌ Gagal mendapatkan doujin acak.");
        }
        const {
          data: detailRes
        } = await axios.post(API_URL, {
          action: "detail",
          id: randId
        }, {
          headers: {
            "Content-Type": "application/json"
          },
          timeout: 3e4
        });
        return await sendDoujinDetail(detailRes);
      }
      const doujinId = flags.id || null;
      if (doujinId) {
        await ctx.react("⏳");
        const {
          data: res
        } = await axios.post(API_URL, {
          action: "detail",
          id: Number(doujinId) || doujinId
        }, {
          headers: {
            "Content-Type": "application/json"
          },
          timeout: 3e4
        });
        return await sendDoujinDetail(res);
      }
      if (!rawText && !flags.popular && !flags.related && !flags.tagged) {
        return ctx.reply(`📖 *NHENTAI DOUJIN READER*\n\n` + `• *Cara Penggunaan:*\n` + `  👉 Cari doujin: \`${prefix}nhentai yume\`\n` + `  👉 Doujin acak: \`${prefix}nhentai --random\`\n` + `  👉 Buka detail: \`${prefix}nhentai --id 201603\`\n\n` + `• *Menu & Filter Cepat:*\n` + `  👉 \`${prefix}nhentai --popular\` (Doujin terpopuler)\n` + `  👉 \`${prefix}nhentai --related 681139\` (Doujin terkait)\n` + `  👉 \`${prefix}nhentai --tagged 370\` (Berdasarkan Tag ID)\n\n` + `• *Opsi Flags:*\n` + `  • \`--sort <date/popular>\` (Urutan hasil)\n` + `  • \`--page <nomor>\` (Navigasi halaman)`);
      }
      await ctx.react("⏳");
      let actionType = "galleries";
      const postBody = {
        action: actionType,
        page: Number(flags.page) || 1
      };
      if (flags.search || cleanPrompt) {
        actionType = "search";
        postBody.action = "search";
        postBody.query = flags.search || cleanPrompt;
        if (flags.sort) postBody.sort = flags.sort;
      } else if (flags.popular) {
        actionType = "popular";
        postBody.action = "popular";
      } else if (flags.related) {
        actionType = "related";
        postBody.action = "related";
        postBody.id = Number(flags.related) || flags.related;
      } else if (flags.tagged) {
        actionType = "tagged";
        postBody.action = "tagged";
        postBody.tag_id = Number(flags.tagged) || flags.tagged;
        if (flags.sort) postBody.sort = flags.sort;
      }
      const {
        data: res
      } = await axios.post(API_URL, postBody, {
        headers: {
          "Content-Type": "application/json"
        },
        timeout: 3e4
      });
      const doujinList = res?.result || res?.results || [];
      if (!doujinList.length) {
        await ctx.react("❌");
        return ctx.reply(`❌ Tidak ditemukan doujin untuk: *"${postBody.query || actionType}"*`);
      }
      const page = postBody.page;
      const totalPages = res?.num_pages || Math.ceil(doujinList.length / 15) || 1;
      const firstThumb = doujinList[0]?.thumbnail;
      const headerCover = firstThumb ? firstThumb.startsWith("http") ? firstThumb : `${THUMB_CDN}${firstThumb}` : null;
      const doujinRows = doujinList.slice(0, 15).map(d => {
        const title = d.english_title || d.japanese_title || `Doujin #${d.id}`;
        return {
          title: title.slice(0, 24),
          description: `Hal: ${d.num_pages} • ❤️ ${formatNumber(d.num_favorites)} (Lihat Detail)`,
          id: `${prefix}nhentai --id ${d.id}`
        };
      });
      const navRows = [{
        title: "🎲 Doujin Acak (Random)",
        description: "Buka 1 doujin acak secara langsung",
        id: `${prefix}nhentai --random`
      }, {
        title: "🔥 Doujin Terpopuler",
        description: "Koleksi doujinshi paling populer",
        id: `${prefix}nhentai --popular`
      }];
      const sections = [{
        title: `📖 DAFTAR DOUJIN (Hal ${page}/${totalPages})`,
        rows: doujinRows
      }, {
        title: "📂 NAVIGASI CEPAT",
        rows: navRows
      }];
      const filterTitle = postBody.query ? `Cari: "${postBody.query}"` : actionType.toUpperCase();
      const bodyText = `📖 *NHENTAI EXPLORER*\n\n` + `• *Filter:* ${filterTitle}\n` + `• *Halaman:* ${page} dari ${totalPages}\n` + `• *Total Hasil:* ${formatNumber(res?.total || doujinList.length)}\n\n` + `_Pilih doujin pada daftar di bawah untuk melihat rincian & tautan membaca!_`;
      const footerText = `${botName} • nHentai Doujinshi`;
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: `📖 Pilih Doujin (${doujinRows.length})`,
          sections: sections
        })
      }];
      let baseCmd = `${prefix}nhentai`;
      if (actionType === "search") baseCmd += ` --search "${postBody.query}"`;
      else if (actionType === "popular") baseCmd += ` --popular`;
      else if (actionType === "tagged") baseCmd += ` --tagged ${postBody.tag_id}`;
      if (page > 1) {
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `⬅️ Hal ${page - 1}`,
            id: `${baseCmd} --page ${page - 1}`
          })
        });
      }
      if (page < totalPages) {
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `➡️ Hal ${page + 1}`,
            id: `${baseCmd} --page ${page + 1}`
          })
        });
      }
      const options = {
        image: headerCover || undefined,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `${botName} • nHentai Explorer`,
            button_title: "Lihat Doujin"
          }
        },
        quoted: quotedMsg
      };
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, footerText, buttons, options);
      } else {
        let fallback = `📖 *DAFTAR DOUJIN (${filterTitle})*\n\n`;
        fallback += doujinRows.map(r => `• *${r.title}*\n  Perintah: \`${r.id}\``).join("\n\n");
        await ctx.reply(fallback);
      }
      await ctx.react("✅");
    } catch (error) {
      await ctx.react("❌");
      let errMsg = error.message;
      if (error.response?.data) {
        errMsg = error.response.data?.message || error.response.data?.error || errMsg;
      }
      ctx.reply(`❌ nHentai Error: ${errMsg}`);
    }
  }
};