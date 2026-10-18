import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/search/resep/v4`;

function formatImageUrl(path) {
  if (!path || typeof path !== "string") return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `https://cdn.yummy.co.id/${path}`;
}

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /--([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1];
    let rawVal = match[2];
    let val = true;
    const lowerKey = key.toLowerCase();
    if (["id", "detail", "resep", "slug"].includes(lowerKey)) key = "slug";
    if (["q", "find", "search", "query"].includes(lowerKey)) key = "query";
    if (["related", "terkait"].includes(lowerKey)) key = "related";
    if (["trending", "home", "inspirasi"].includes(lowerKey)) key = lowerKey;
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
  name: "resep",
  aliases: ["resepmasak", "masak", "cook", "resepkoki", "yummy"],
  description: "Cari resep masakan, rincian bahan & langkah memasak, serta inspirasi menu harian",
  category: "Information",
  limit: true,
  example: "resep cilok atau resep --slug cilok-21 atau resep --trending",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["resep", "resepmasak", "masak", "cook", "resepkoki", "yummy"].some(alias => firstWord.endsWith(alias))) {
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
      const isListHome = flags.home || flags.trending || flags.inspirasi;
      if (!rawText && !flags.slug && !flags.related && !isListHome) {
        return ctx.reply(`🍳 *RESEP MASAKAN & INSPIRASI KULINER*\n\n` + `• *Cara Penggunaan:*\n` + `  👉 Cari resep: \`${prefix}resep cilok\`\n` + `  👉 Lihat detail resep: \`${prefix}resep --slug cilok-21\`\n\n` + `• *Lihat Inspirasi & Menu Trending (CTA UI):*\n` + `  👉 \`${prefix}resep --trending\` atau \`${prefix}resep --home\`\n\n` + `• *Opsi Flag Kustomisasi:*\n` + `  • \`--slug <slug_resep>\` (Detail resep berdasarkan ID/slug)\n` + `  • \`--related <slug_resep>\` (Daftar resep terkait)\n` + `  • \`--trending\` / \`--home\` (Menu trending & inspirasi harian)`);
      }
      await ctx.react("🍳");
      if (flags.slug) {
        const slug = flags.slug;
        const {
          data
        } = await axios.post(API_URL, {
          action: "detail",
          slug: slug,
          ...flags
        }, {
          headers: {
            "Content-Type": "application/json"
          },
          timeout: 6e4
        });
        const recipe = data?.data;
        if (!data || !recipe) {
          await ctx.react("❌");
          return ctx.reply("❌ Detail resep tidak ditemukan. Pastikan slug resep valid.");
        }
        const title = recipe.title || "Resep Masakan";
        const author = recipe.author?.name || "Chef Yummy";
        const rating = recipe.rating_user || recipe.rating || "5.0";
        const cookingTime = recipe.cooking_time ? `${recipe.cooking_time} Menit` : "30 Menit";
        const serving = recipe.serving_min ? `${recipe.serving_min}-${recipe.serving_max} Porsi` : "-";
        const bannerImage = formatImageUrl(recipe.original_image || recipe.cover_url) || global.bot?.media?.banner1 || "https://files.catbox.moe/g2e6i5.jpg";
        let ingredientsText = "";
        const ingTypes = recipe.ingredient_type || [];
        ingTypes.forEach(type => {
          ingredientsText += `*${type.name.toUpperCase()}:*\n`;
          (type.ingredients || []).forEach(ing => {
            ingredientsText += `• ${ing.description}\n`;
          });
          ingredientsText += "\n";
        });
        let stepsText = "";
        const steps = recipe.cooking_step || [];
        steps.forEach((st, idx) => {
          stepsText += `*${idx + 1}. ${st.title}*\n${st.text}\n\n`;
        });
        const bodyText = `🍳 *RESEP LENGKAP: ${title.toUpperCase()}*\n\n` + `• *Pembuat:* ${author}\n` + `• *Rating:* ⭐ ${rating} / 5.0\n` + `• *Waktu Masak:* ⏱️ ${cookingTime}\n` + `• *Porsi:* 🍽️ ${serving}\n\n` + `🖼️ *BAHAN-BAHAN:*\n${ingredientsText.trim()}\n\n` + `📝 *LANGKAH MEMASAK:*\n${stepsText.trim()}\n\n` + `_Klik tombol di bawah untuk menyalin seluruh resep ini!_`;
        const footerText = `${botName} • Resep Masakan Nusantara`;
        const fullRecipeCopy = `*${title.toUpperCase()}*\nOleh: ${author}\nWaktu: ${cookingTime}\n\n*BAHAN:*\n${ingredientsText}\n*LANGKAH:*\n${stepsText}`;
        const buttons = [{
          name: "cta_copy",
          display_text: "📌 Salin Resep Lengkap",
          copy_code: fullRecipeCopy
        }, {
          name: "quick_reply",
          display_text: "🍲 Resep Terkait",
          id: `${prefix}resep --related ${slug}`
        }];
        if (recipe.share_link) {
          buttons.push({
            name: "cta_url",
            display_text: "🌐 Buka di Yummy App",
            url: recipe.share_link
          });
        }
        const options = {
          image: bannerImage,
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 1,
              divider_indices: [1],
              list_title: `${botName} • Resep Masak`,
              button_title: "Lihat Resep"
            },
            limited_time_offer: {
              text: `✦ ${botName} - Resep Masakan ✦`,
              url: "",
              copy_code: "",
              expiration_time: Date.now() + 3600 * 1e3
            }
          },
          contextInfo: {
            forwardingScore: 999,
            isForwarded: true,
            forwardedAiBotMessageInfo: {
              botJid: "0@bot"
            }
          },
          quoted: quotedMsg
        };
        if (typeof ctx.sendCta === "function") {
          await ctx.sendCta(bodyText, footerText, buttons, options);
        } else {
          await sock.sendMessage(ctx.id, {
            image: {
              url: bannerImage
            },
            caption: bodyText
          }, {
            quoted: quotedMsg
          });
        }
        await ctx.react("✅");
        return;
      }
      if (flags.related) {
        const slug = flags.related;
        const {
          data
        } = await axios.post(API_URL, {
          action: "related",
          slug: slug,
          ...flags
        }, {
          headers: {
            "Content-Type": "application/json"
          },
          timeout: 6e4
        });
        const recipes = data?.data?.recipes || [];
        if (!data || recipes.length === 0) {
          await ctx.react("❌");
          return ctx.reply("❌ Tidak ada resep terkait yang ditemukan.");
        }
        const recipeRows = recipes.slice(0, 15).map(r => ({
          title: r.title.slice(0, 24),
          description: `⭐ ${r.rating || 5} • ⏱️ ${r.cooking_time || 30}m`,
          id: `${prefix}resep --slug ${r.slug}`
        }));
        const firstCover = formatImageUrl(recipes[0]?.cover_url) || global.bot?.media?.banner1 || "https://files.catbox.moe/g2e6i5.jpg";
        const bodyText = `🍲 *RESEP MASAKAN TERKAIT*\n\n` + `• *Total Rekomendasi:* ${recipes.length} Resep\n\n` + `_Pilih salah satu resep di bawah untuk melihat bahan & cara memasak!_`;
        const footerText = `${botName} • Resep Terkait`;
        const buttons = [{
          name: "single_select",
          title: `🍲 Pilih Resep Terkait (${recipes.length})`,
          sections: [{
            title: "🍲 RESEP TERKAIT",
            rows: recipeRows
          }]
        }];
        const options = {
          image: firstCover,
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 1,
              divider_indices: [1],
              list_title: `${botName} • Related Recipes`,
              button_title: "Lihat Resep"
            },
            limited_time_offer: {
              text: `✦ ${botName} - Resep Terkait ✦`,
              url: "",
              copy_code: "",
              expiration_time: Date.now() + 3600 * 1e3
            }
          },
          contextInfo: {
            forwardingScore: 999,
            isForwarded: true,
            forwardedAiBotMessageInfo: {
              botJid: "0@bot"
            }
          },
          quoted: quotedMsg
        };
        if (typeof ctx.sendCta === "function") {
          await ctx.sendCta(bodyText, footerText, buttons, options);
        } else {
          let fallbackMsg = `🍲 *RESEP TERKAIT*\n\n`;
          fallbackMsg += recipes.map(r => `• *${r.title}*\n  ID: \`${r.slug}\``).join("\n\n");
          await ctx.reply(fallbackMsg);
        }
        await ctx.react("✅");
        return;
      }
      if (!cleanPrompt || isListHome) {
        const {
          data
        } = await axios.post(API_URL, {
          action: "home",
          ...flags
        }, {
          headers: {
            "Content-Type": "application/json"
          },
          timeout: 6e4
        });
        const daily = data?.data?.daily_inspirations?.data?.recipes || [];
        const trending = data?.data?.trending?.data || [];
        const allPicks = [...trending.map(t => t.content || t), ...daily];
        if (allPicks.length === 0) {
          await ctx.react("❌");
          return ctx.reply("❌ Gagal memuat inspirasi menu harian.");
        }
        const recipeRows = allPicks.slice(0, 15).map(r => ({
          title: r.title.slice(0, 24),
          description: `⭐ ${r.rating || 5} • ⏱️ ${r.cooking_time || 30}m`,
          id: `${prefix}resep --slug ${r.slug}`
        }));
        const firstCover = formatImageUrl(allPicks[0]?.cover_url || allPicks[0]?.media_url) || global.bot?.media?.banner1 || "https://files.catbox.moe/g2e6i5.jpg";
        const bodyText = `✨ *INSPIRASI MENU HARIAN & TRENDING*\n\n` + `Bingung mau masak apa hari ini? Berikut ide masakan terpopuler untukmu!\n\n` + `• *Menu Utama:* ${allPicks[0]?.title || "-"}\n` + `• *Rating:* ⭐ ${allPicks[0]?.rating || "5.0"}\n` + `• *Waktu Masak:* ⏱️ ${allPicks[0]?.cooking_time || "30"} Menit\n\n` + `_Pilih menu di bawah untuk melihat resep selengkapnya!_`;
        const footerText = `${botName} • Inspirasi Masak`;
        const buttons = [{
          name: "single_select",
          title: `🍳 Pilih Inspirasi Resep (${allPicks.length})`,
          sections: [{
            title: "🍳 MENU TRENDING & INSPIRASI",
            rows: recipeRows
          }]
        }];
        const options = {
          image: firstCover,
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 1,
              divider_indices: [1],
              list_title: `${botName} • Inspirasi Resep`,
              button_title: "Lihat Menu"
            },
            limited_time_offer: {
              text: `✦ ${botName} - Inspirasi Harian ✦`,
              url: "",
              copy_code: "",
              expiration_time: Date.now() + 3600 * 1e3
            }
          },
          contextInfo: {
            forwardingScore: 999,
            isForwarded: true,
            forwardedAiBotMessageInfo: {
              botJid: "0@bot"
            }
          },
          quoted: quotedMsg
        };
        if (typeof ctx.sendCta === "function") {
          await ctx.sendCta(bodyText, footerText, buttons, options);
        } else {
          let fallbackMsg = `✨ *INSPIRASI RESEP HARIAN*\n\n`;
          fallbackMsg += allPicks.map(r => `• *${r.title}*\n  ID: \`${r.slug}\``).join("\n\n");
          await ctx.reply(fallbackMsg);
        }
        await ctx.react("✅");
        return;
      }
      const searchQuery = cleanPrompt;
      const {
        data
      } = await axios.post(API_URL, {
        action: "search",
        query: searchQuery,
        ...flags
      }, {
        headers: {
          "Content-Type": "application/json"
        },
        timeout: 6e4
      });
      const searchResults = data?.data?.result || [];
      if (!data || searchResults.length === 0) {
        await ctx.react("❌");
        return ctx.reply(`❌ Resep masakan dengan kata kunci "*${searchQuery}*" tidak ditemukan.`);
      }
      const recipeRows = searchResults.slice(0, 15).map(r => ({
        title: r.title.slice(0, 24),
        description: `⭐ ${r.rating || 4.5} • ⏱️ ${r.cooking_time || 30}m`,
        id: `${prefix}resep --slug ${r.slug}`
      }));
      const firstCover = formatImageUrl(searchResults[0]?.cover_url) || global.bot?.media?.banner1 || "https://files.catbox.moe/g2e6i5.jpg";
      const totalCount = data?.data?.result_count || searchResults.length;
      const bodyText = `🔍 *HASIL PENCARIAN RESEP*\n\n` + `• *Kata Kunci:* \`${searchQuery}\`\n` + `• *Total Ditemukan:* ${totalCount} Masakan\n\n` + `_Pilih resep di bawah untuk melihat bahan dan cara memasak!_`;
      const footerText = `${botName} • Resep Masakan`;
      const buttons = [{
        name: "single_select",
        title: `🍳 Pilih Resep Masakan (${searchResults.length})`,
        sections: [{
          title: `Hasil: ${searchQuery}`,
          rows: recipeRows
        }]
      }, {
        name: "quick_reply",
        display_text: "✨ Inspirasi Harian",
        id: `${prefix}resep --home`
      }];
      const options = {
        image: firstCover,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `${botName} • Search Resep`,
            button_title: "Lihat Resep"
          },
          limited_time_offer: {
            text: `✦ ${botName} - Cari Resep ✦`,
            url: "",
            copy_code: "",
            expiration_time: Date.now() + 3600 * 1e3
          }
        },
        contextInfo: {
          forwardingScore: 999,
          isForwarded: true,
          forwardedAiBotMessageInfo: {
            botJid: "0@bot"
          }
        },
        quoted: quotedMsg
      };
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, footerText, buttons, options);
      } else {
        let fallbackMsg = `🔍 *HASIL PENCARIAN RESEP: ${searchQuery}*\n\n`;
        fallbackMsg += searchResults.map(r => `• *${r.title}*\n  ID: \`${r.slug}\``).join("\n\n");
        await ctx.reply(fallbackMsg);
      }
      await ctx.react("✅");
    } catch (error) {
      await ctx.react("❌");
      let errorMessage = error.message;
      if (error.response?.data) {
        try {
          const parsed = typeof error.response.data === "string" ? JSON.parse(error.response.data) : error.response.data;
          errorMessage = parsed.message || parsed.error || errorMessage;
        } catch {}
      }
      ctx.reply(`❌ Resep Error: ${errorMessage}`);
    }
  }
};