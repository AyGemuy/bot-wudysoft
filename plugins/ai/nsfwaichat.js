import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_BASE = `${global.bot?.api?.wudysoft}/api/ai/nsfwaichat`;
const formatTemplate = (text, userName, charName) => {
  if (!text || typeof text !== "string") return text;
  return text.replace(/\{\{user\}\}/gi, userName).replace(/\{\{char\}\}/gi, charName).replace(/<USER>/gi, userName).replace(/<CHAR>/gi, charName);
};
export default {
  name: "nsfwaichat",
  aliases: ["nsfwaichat"],
  description: "Chat & Roleplay AI Karakter dengan format flag gampang",
  category: "AI",
  limit: true,
  example: "• Cari: `nsfwaichat --search subaru`\n• Detail: `nsfwaichat --detail <id>`\n• Chat: `nsfwaichat Halo apa kabar? --id <id>` (atau cukup reply pesan bot)",
  execute: async (sock, ctx, msg) => {
    try {
      const userName = ctx.pushname || ctx.getName() || "User";
      let text = ctx.args?.join(" ")?.trim() || "";
      if (!text && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (firstWord.endsWith("nsfwaichat")) {
          text = raw.slice(firstWord.length).trim();
        }
      }
      const quotedText = ctx.quoted?.text || ctx.quoted?.caption || "";
      if (!text) {
        return ctx.reply(`🎭 *NSFW AI CHARACTER CHAT*\n\n` + `*1️⃣ Cari Karakter:* \n` + `  └ \`${ctx.prefix || "."}nsfwaichat --search <nama_karakter>\`\n` + `  └ Contoh: \`${ctx.prefix || "."}nsfwaichat --search subaru\`\n\n` + `*2️⃣ Lihat Detail Karakter:* \n` + `  └ \`${ctx.prefix || "."}nsfwaichat --detail <id_karakter>\`\n\n` + `*3️⃣ Chat / Roleplay:*\n` + `  └ \`${ctx.prefix || "."}nsfwaichat <pesan_kamu> --id <id_karakter>\`\n` + `  └ *Tips Praktis:* Cukup balas/reply pesan karakter dengan \`${ctx.prefix || "."}nsfwaichat <pesan>\` tanpa perlu ketik ulang ID!`);
      }
      await ctx.react("⏳");
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      let searchQuery = "";
      let detailId = "";
      let botId = "";
      let page = 1;
      let prompt = text;
      const searchMatch = prompt.match(/--(?:search|s)\s+([^--]+)/i);
      if (searchMatch) {
        searchQuery = searchMatch[1].trim();
        prompt = prompt.replace(searchMatch[0], "").trim();
      }
      const detailMatch = prompt.match(/--(?:detail|d)\s+([^\s]+)/i);
      if (detailMatch) {
        detailId = detailMatch[1].trim();
        prompt = prompt.replace(detailMatch[0], "").trim();
      }
      const idMatch = prompt.match(/--(?:id|char|bot)\s+([^\s]+)/i);
      if (idMatch) {
        botId = idMatch[1].trim();
        prompt = prompt.replace(idMatch[0], "").trim();
      }
      const pageMatch = prompt.match(/--(?:page|p)\s+(\d+)/i);
      if (pageMatch) {
        page = parseInt(pageMatch[1]) || 1;
        prompt = prompt.replace(pageMatch[0], "").trim();
      }
      if (!botId && quotedText) {
        const idFromQuoted = quotedText.match(/🆔 (?:ID|Bot ID):\s*`([a-f0-9-]+)`/i) || quotedText.match(/--id\s+([a-f0-9-]+)/i) || quotedText.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
        if (idFromQuoted) {
          botId = idFromQuoted[1];
        }
      }
      if (detailId) {
        const {
          data
        } = await axios.get(API_BASE, {
          params: {
            action: "detail",
            id: detailId
          },
          timeout: 3e4
        });
        if (!data || !data.status || !data.result) {
          await ctx.react("❌");
          return ctx.reply("❌ Gagal mengambil detail karakter. Pastikan ID valid.");
        }
        const bot = data.result;
        const charName = bot.name || "Character";
        const desc = formatTemplate(bot.description, userName, charName);
        const personality = formatTemplate(bot.personality, userName, charName);
        const firstMsg = formatTemplate(bot.first_message, userName, charName);
        let detailText = `👤 *PROFIL KARAKTER: ${charName.toUpperCase()}*\n\n`;
        detailText += `🆔 *ID:* \`${bot.id}\`\n`;
        detailText += `👤 *Creator:* ${bot.creator_name || "-"}\n`;
        if (desc) detailText += `📝 *Deskripsi:*\n${desc}\n\n`;
        if (personality) detailText += `🎭 *Kepribadian:*\n${personality.slice(0, 450)}...\n\n`;
        if (firstMsg) detailText += `💬 *Pesan Pembuka:*\n_${firstMsg.slice(0, 350)}_\n\n`;
        detailText += `👉 *Mulai Chat:* \`${ctx.prefix || "."}nsfwaichat Halo! --id ${bot.id}\``;
        if (bot.avatar_url) {
          await sock.sendMessage(ctx.id, {
            image: {
              url: bot.avatar_url
            },
            caption: detailText.trim()
          }, {
            quoted: quotedMsg
          });
        } else {
          await sock.sendMessage(ctx.id, {
            text: detailText.trim()
          }, {
            quoted: quotedMsg
          });
        }
        await ctx.react("✅");
        return;
      }
      if (searchQuery || !botId && prompt) {
        const query = searchQuery || prompt;
        const {
          data
        } = await axios.get(API_BASE, {
          params: {
            action: "search",
            query: query,
            page: page
          },
          timeout: 3e4
        });
        if (!data || !data.status || !Array.isArray(data.result) || data.result.length === 0) {
          await ctx.react("❌");
          return ctx.reply(`❌ Tidak ditemukan karakter dengan kata kunci: *${query}*`);
        }
        let searchList = `🔍 *HASIL PENCARIAN (${query})*\n\n`;
        data.result.slice(0, 10).forEach((bot, i) => {
          const tags = bot.tags?.map(t => t.name).join(", ") || "-";
          const desc = formatTemplate(bot.description, userName, bot.name);
          searchList += `*${i + 1}. ${bot.name}*\n`;
          searchList += `🆔 *ID:* \`${bot.id}\`\n`;
          searchList += `🏷️ *Tags:* ${tags}\n`;
          if (desc) {
            searchList += `📝 *Desc:* ${desc.slice(0, 90).replace(/\n/g, " ")}...\n`;
          }
          searchList += `\n`;
        });
        searchList += `👉 *Cara Chat:* \`${ctx.prefix || "."}nsfwaichat <pesan> --id <id_karakter>\`\n`;
        searchList += `👉 *Cara Lihat Profil:* \`${ctx.prefix || "."}nsfwaichat --detail <id_karakter>\``;
        await sock.sendMessage(ctx.id, {
          text: searchList.trim()
        }, {
          quoted: quotedMsg
        });
        await ctx.react("✅");
        return;
      }
      if (!botId) {
        await ctx.react("❌");
        return ctx.reply(`❌ Masukkan ID karakter atau balas pesan karakter!\n\n` + `👉 *Format:* \`${ctx.prefix || "."}nsfwaichat <pesan_kamu> --id <id_karakter>\`\n` + `👉 *Cari ID:* \`${ctx.prefix || "."}nsfwaichat --search <nama>\``);
      }
      const {
        data: chatRes
      } = await axios.get(API_BASE, {
        params: {
          action: "chat",
          id: botId,
          prompt: prompt || "Hello"
        },
        timeout: 6e4
      });
      if (!chatRes || !chatRes.status || !chatRes.result) {
        await ctx.react("❌");
        return ctx.reply(`❌ Gagal mendapatkan balasan chat: ${chatRes?.message || "Server error"}`);
      }
      const rawReply = chatRes.result?.text || "*(Karakter tidak merespon)*";
      const botName = chatRes.result?.bot_detail?.name || "AI Character";
      const avatarUrl = chatRes.result?.bot_detail?.avatar_url;
      const cleanReply = formatTemplate(rawReply, userName, botName);
      let responseMsg = `💬 *${botName.toUpperCase()}*\n\n`;
      responseMsg += `${cleanReply.trim()}\n\n`;
      responseMsg += `─────────────────────────\n`;
      responseMsg += `🆔 *ID:* \`${botId}\`\n`;
      responseMsg += `_Balas chat ini langsung dengan \`${ctx.prefix || "."}nsfwaichat <pesan>\`_`;
      if (avatarUrl) {
        await sock.sendMessage(ctx.id, {
          image: {
            url: avatarUrl
          },
          caption: responseMsg.trim()
        }, {
          quoted: quotedMsg
        });
      } else {
        await sock.sendMessage(ctx.id, {
          text: responseMsg.trim()
        }, {
          quoted: quotedMsg
        });
      }
      await ctx.react("✨");
    } catch (error) {
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ NSFW AI Chat Error: ${errMsg}`);
    }
  }
};