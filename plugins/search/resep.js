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
  description: "Cari resep masakan, rincian bahan & langkah memasak (Tampilan Neoxr).",
  category: "Information",
  limit: true,
  example: "resep cilok atau resep --slug cilok-21 atau resep --trending",
  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "WudysoftBot";
    const footer = global.footer || global.bot?.footer || `_${botName}_`;
    const targetJid = ctx.chat || ctx.id;
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["resep", "resepmasak", "masak", "cook", "resepkoki", "yummy"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      const isListHome = flags.home || flags.trending || flags.inspirasi;
      if (!rawText && !flags.slug && !flags.related && !isListHome) {
        const guideText = `–  *R E S E P  M A S A K A N*

Cari panduan memasak, takaran bahan, dan inspirasi menu harian nusantara.

┌  ◦  *Cari Resep* : \`${prefix}resep cilok kuah\`
│  ◦  *Detail Resep* : \`${prefix}resep --slug cilok-21\`
│  ◦  *Menu Terkait* : \`${prefix}resep --related cilok-21\`
└  ◦  *Inspirasi Harian* : \`${prefix}resep --trending\` atau \`${prefix}resep --home\`

${footer}`;
        return ctx.reply(guideText, {
          quoted: quotedMsg
        });
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
          return ctx.reply(`–  *R E S E P  N O T  F O U N D*\n\n` + `┌  ◦  *Slug* : "${slug}"\n` + `└  ◦  *Status* : Resep tidak ditemukan.\n\n` + `${footer}`, {
            quoted: quotedMsg
          });
        }
        const title = recipe.title || "Resep Masakan";
        const author = recipe.author?.name || "Chef Yummy";
        const rating = recipe.rating_user || recipe.rating || "5.0";
        const cookingTime = recipe.cooking_time ? `${recipe.cooking_time} Menit` : "30 Menit";
        const serving = recipe.serving_min ? `${recipe.serving_min}-${recipe.serving_max} Porsi` : "-";
        const bannerImage = formatImageUrl(recipe.original_image || recipe.cover_url);
        let ingredientsText = "";
        const ingTypes = recipe.ingredient_type || [];
        ingTypes.forEach(type => {
          ingredientsText += `*${type.name.toUpperCase()}*\n`;
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
        const bodyText = `–  *R E S E P  M A S A K A N*\n\n` + `┌  ◦  *Judul* : ${title.toUpperCase()}\n` + `├  ◦  *Koki* : ${author}\n` + `├  ◦  *Rating* : ⭐ ${rating} / 5.0\n` + `├  ◦  *Waktu* : ⏱️ ${cookingTime}\n` + `└  ◦  *Porsi* : 🍽️ ${serving}\n\n` + `┌  ◦  *B A H A N - B A H A N* :\n` + ingredientsText.trim().split("\n").map(l => l ? `│  ${l}` : "│").join("\n") + "\n" + `└  ◦\n\n` + `┌  ◦  *L A N G K A H  M E M A S A K* :\n` + stepsText.trim().split("\n").map(l => l ? `│  ${l}` : "│").join("\n") + "\n" + `└  ◦\n\n` + `${footer}`;
        const fullRecipeCopy = `*${title.toUpperCase()}*\nOleh: ${author}\nWaktu: ${cookingTime}\n\n*BAHAN:*\n${ingredientsText}\n*LANGKAH:*\n${stepsText}`;
        const buttons = [{
          name: "cta_copy",
          display_text: "📄 Salin Resep",
          copy_code: fullRecipeCopy
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🍲 Resep Terkait",
            id: `${prefix}resep --related ${slug}`
          })
        }];
        if (recipe.share_link) {
          buttons.push({
            name: "cta_url",
            display_text: "🌐 Buka di Yummy App",
            url: recipe.share_link
          });
        }
        if (typeof ctx.sendCta === "function") {
          await ctx.sendCta(bodyText, "", buttons, {
            media: bannerImage || null,
            quoted: quotedMsg
          });
        } else if (bannerImage) {
          await sock.sendMessage(targetJid, {
            image: {
              url: bannerImage
            },
            caption: bodyText
          }, {
            quoted: quotedMsg
          });
        } else {
          await sock.sendMessage(targetJid, {
            text: bodyText
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
          return ctx.reply(`–  *E R R O R*\n\n┌  ◦  *Info* : Tidak ada resep terkait yang ditemukan.\n\n${footer}`);
        }
        const recipeRows = recipes.slice(0, 15).map((r, i) => ({
          title: `${i + 1}. ${r.title}`.slice(0, 24),
          id: `${prefix}resep --slug ${r.slug}`,
          description: `⭐ ${r.rating || 5} • ⏱️ ${r.cooking_time || 30}m`.slice(0, 60)
        }));
        const firstCover = formatImageUrl(recipes[0]?.cover_url);
        const bodyText = `–  *R E S E P  T E R K A I T*\n\n` + `┌  ◦  *Total Ditemukan* : ${recipes.length} Resep\n` + `└  ◦  *Kategori* : Variasi Masakan Sejenis\n\n` + `_Pilih resep pada tombol menu di bawah untuk membuka panduan lengkap:_`;
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: `PILIH RESEP (${recipes.length})`,
            sections: [{
              title: "RESEP MASAKAN TERKAIT",
              rows: recipeRows
            }]
          })
        }];
        if (typeof ctx.sendCta === "function") {
          await ctx.sendCta(bodyText, footer, buttons, {
            media: firstCover || null,
            quoted: quotedMsg
          });
        } else {
          let fallbackMsg = `${bodyText}\n\n`;
          fallbackMsg += recipes.map(r => `• *${r.title}*\n  Perintah: \`${prefix}resep --slug ${r.slug}\``).join("\n\n");
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
          return ctx.reply(`–  *E R R O R*\n\n┌  ◦  *Info* : Gagal memuat inspirasi menu harian.\n\n${footer}`);
        }
        const recipeRows = allPicks.slice(0, 15).map((r, i) => ({
          title: `${i + 1}. ${r.title}`.slice(0, 24),
          id: `${prefix}resep --slug ${r.slug}`,
          description: `⭐ ${r.rating || 5} • ⏱️ ${r.cooking_time || 30}m`.slice(0, 60)
        }));
        const firstCover = formatImageUrl(allPicks[0]?.cover_url || allPicks[0]?.media_url);
        const bodyText = `–  *I N S P I R A S I  M E N U*\n\n` + `┌  ◦  *Rekomendasi Utama* : ${allPicks[0]?.title || "-"}\n` + `├  ◦  *Rating* : ⭐ ${allPicks[0]?.rating || "5.0"}\n` + `├  ◦  *Estimasi Waktu* : ⏱️ ${allPicks[0]?.cooking_time || "30"} Menit\n` + `└  ◦  *Total Menu* : ${allPicks.length} Pilihan\n\n` + `_Pilih resep pada tombol menu di bawah untuk membuka panduan lengkap:_`;
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: `PILIH INSPIRASI (${allPicks.length})`,
            sections: [{
              title: "TRENDING & INSPIRASI HARIAN",
              rows: recipeRows
            }]
          })
        }];
        if (typeof ctx.sendCta === "function") {
          await ctx.sendCta(bodyText, footer, buttons, {
            media: firstCover || null,
            quoted: quotedMsg
          });
        } else {
          let fallbackMsg = `${bodyText}\n\n`;
          fallbackMsg += allPicks.map(r => `• *${r.title}*\n  Perintah: \`${prefix}resep --slug ${r.slug}\``).join("\n\n");
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
        return ctx.reply(`–  *R E S E P  N O T  F O U N D*\n\n` + `┌  ◦  *Query* : "${searchQuery}"\n` + `└  ◦  *Status* : Resep masakan tidak ditemukan.\n\n` + `${footer}`, {
          quoted: quotedMsg
        });
      }
      const recipeRows = searchResults.slice(0, 15).map((r, i) => ({
        title: `${i + 1}. ${r.title}`.slice(0, 24),
        id: `${prefix}resep --slug ${r.slug}`,
        description: `⭐ ${r.rating || 4.5} • ⏱️ ${r.cooking_time || 30}m`.slice(0, 60)
      }));
      const firstCover = formatImageUrl(searchResults[0]?.cover_url);
      const totalCount = data?.data?.result_count || searchResults.length;
      const bodyText = `–  *H A S I L  P E N C A R I A N*\n\n` + `┌  ◦  *Kata Kunci* : "${searchQuery}"\n` + `├  ◦  *Total Ditemukan* : ${totalCount} Masakan\n` + `└  ◦  *Penyedia* : Yummy App Official\n\n` + `_Pilih resep pada tombol menu di bawah untuk membuka panduan lengkap:_`;
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: `PILIH RESEP (${searchResults.length})`,
          sections: [{
            title: `HASIL: ${searchQuery.toUpperCase()}`,
            rows: recipeRows
          }]
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "✨ Menu Trending",
          id: `${prefix}resep --home`
        })
      }];
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, footer, buttons, {
          media: firstCover || null,
          quoted: quotedMsg
        });
      } else {
        let fallbackMsg = `${bodyText}\n\n`;
        fallbackMsg += searchResults.map(r => `• *${r.title}*\n  Perintah: \`${prefix}resep --slug ${r.slug}\``).join("\n\n");
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
      ctx.reply(`–  *E R R O R*\n\n┌  ◦  *Info* : ${errorMessage}\n└  ◦  *Command* : ${ctx.command || "resep"}\n\n${footer}`);
    }
  }
};