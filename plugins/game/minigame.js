import {
  getMiniGames
} from "../../lib/game.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const CONFIG = {
  PER_PAGE: 10
};

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /(?:--|-)([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1].toLowerCase();
    let rawVal = match[2];
    let val = true;
    const aliasMap = {
      id: ["i", "idx", "index", "play", "game", "no", "g"],
      search: ["s", "q", "find", "query"],
      random: ["r", "rand", "acak"],
      page: ["p", "pg"]
    };
    for (const [realKey, aliases] of Object.entries(aliasMap)) {
      if (aliases.includes(key)) key = realKey;
    }
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
  name: "minigame",
  aliases: ["game", "mg", "htmlgame", "playgame"],
  description: "Mainkan mini game HTML5 interaktif (Sorted A-Z & Realtime)",
  category: "Game",
  limit: false,
  example: "minigame atau minigame 1 atau minigame -i 5 atau minigame -r atau minigame -s flappy",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["minigame", "game", "mg", "htmlgame", "playgame"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • Mini Game Hub`;
      const userName = ctx.pushname || ctx.sender?.split("@")[0] || "User";
      const targetJid = ctx.id || msg.key?.remoteJid;
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      const rawList = typeof getMiniGames === "function" ? getMiniGames() : [];
      if (!rawList.length) {
        await ctx.react("❌");
        return ctx.reply("❌ Tidak ada game yang tersedia di folder game saat ini.");
      }
      const sortedGames = [...rawList].sort((a, b) => (a.title || "").localeCompare(b.title || "", "id", {
        sensitivity: "base"
      })).map((game, index) => ({
        ...game,
        index: index + 1
      }));
      const launchGame = async gameItem => {
        if (!gameItem || !gameItem.html) {
          await ctx.react("❌");
          return ctx.reply("❌ Data file game tidak valid atau rusak.");
        }
        await ctx.react("🎮");
        if (typeof sock.airich === "function") {
          return await sock.airich().setTitle(`🎮 ${gameItem.title || "Mini Game"}`).addHtml(gameItem.html).send(targetJid);
        } else if (typeof ctx.sendRich === "function") {
          return await ctx.sendRich({
            title: `🎮 ${gameItem.title || "Mini Game"}`,
            html: gameItem.html,
            quoted: quotedMsg
          });
        } else {
          return ctx.reply(`–  *M I N I  G A M E*\n\n` + `┌  ◦  *Judul* : ${gameItem.title.toUpperCase()}\n` + `└  ◦  *Index* : #${gameItem.index}\n\n` + `_Fitur airich/browser interaktif tidak didukung pada bot ini._`);
        }
      };
      if (flags.random) {
        const randomGame = sortedGames[Math.floor(Math.random() * sortedGames.length)];
        return await launchGame(randomGame);
      }
      const inputTarget = flags.id !== undefined ? flags.id : cleanPrompt;
      if (inputTarget !== "" && inputTarget !== undefined && !flags.search) {
        let selectedGame = null;
        if (!isNaN(inputTarget) && !isNaN(parseFloat(inputTarget))) {
          const targetIndex = Number(inputTarget);
          selectedGame = sortedGames.find(g => g.index === targetIndex);
        }
        if (!selectedGame) {
          const queryStr = String(inputTarget).toLowerCase();
          selectedGame = sortedGames.find(g => (g.title || "").toLowerCase().includes(queryStr));
        }
        if (selectedGame) {
          return await launchGame(selectedGame);
        } else if (!isNaN(inputTarget)) {
          await ctx.react("❌");
          return ctx.reply(`❌ Game dengan nomor index *#${inputTarget}* tidak ditemukan. (Tersedia: 1 - ${sortedGames.length})`);
        }
      }
      await ctx.react("⏳");
      let displayList = sortedGames;
      const searchQuery = flags.search || "";
      if (searchQuery) {
        displayList = sortedGames.filter(g => (g.title || "").toLowerCase().includes(searchQuery.toLowerCase()));
        if (!displayList.length) {
          await ctx.react("❌");
          return ctx.reply(`❌ Tidak ditemukan game dengan judul: *"${searchQuery}"*`);
        }
      }
      const perPage = CONFIG.PER_PAGE;
      const totalPages = Math.ceil(displayList.length / perPage) || 1;
      let page = Number(flags.page) || 1;
      if (page < 1) page = 1;
      if (page > totalPages) page = totalPages;
      const startIndex = (page - 1) * perPage;
      const currentItems = displayList.slice(startIndex, startIndex + perPage);
      const gameRows = currentItems.map(g => ({
        title: `[#${g.index}] ${g.title || "Untitled"}`.slice(0, 24),
        id: `${prefix}minigame -i ${g.index}`,
        description: `Buka & mainkan ${g.title}`
      }));
      const navRows = [{
        title: "🎲 Game Acak (Random)",
        id: `${prefix}minigame -r`,
        description: "Pilih dan mainkan 1 game acak"
      }];
      const sections = [{
        title: `🕹️ DAFTAR GAME (Hal ${page}/${totalPages})`,
        rows: gameRows
      }, {
        title: "⚡ PILIHAN CEPAT",
        rows: navRows
      }];
      const bannerImage = global.bot?.media?.banner1 || "https://files.catbox.moe/g2e6i5.jpg";
      const bodyText = `Hi ${userName}!
Berikut daftar game HTML5 yang siap dimainkan secara realtime.

–  *M I N I  G A M E S*

┌  ◦  *Total Game* : ${sortedGames.length} Game (A-Z)
│  ◦  *Halaman* : ${page} / ${totalPages}
${searchQuery ? `│  ◦  *Search* : "${searchQuery}"\n` : ""}└  ◦  *Status* : Ready to Play

Pilih game dari tombol menu di bawah atau ketik langsung nomor index-nya.`;
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: `🎮 Pilih Game (Hal ${page})`,
          sections: sections
        })
      }];
      let baseCmd = `${prefix}minigame`;
      if (searchQuery) baseCmd += ` -s "${searchQuery}"`;
      if (page > 1) {
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `⬅️ Hal ${page - 1}`,
            id: `${baseCmd} -p ${page - 1}`
          })
        });
      }
      if (page < totalPages) {
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `➡️ Hal ${page + 1}`,
            id: `${baseCmd} -p ${page + 1}`
          })
        });
      }
      const options = {
        image: bannerImage,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `${botName} • Game Center`,
            button_title: "Lihat Semua Game"
          }
        },
        contextInfo: {
          forwardingScore: 999,
          isForwarded: true
        },
        quoted: quotedMsg
      };
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, botFooter, buttons, options);
      } else {
        let fallback = `${bodyText}\n\n`;
        fallback += gameRows.map(r => `┌  ◦  *${r.title}*\n└  ◦  Ketik: \`${r.id}\``).join("\n\n");
        fallback += `\n\n_${botFooter}_`;
        await sock.sendMessage(targetJid, {
          image: {
            url: bannerImage
          },
          caption: fallback
        }, {
          quoted: quotedMsg
        });
      }
      await ctx.react("✅");
    } catch (error) {
      console.error("[Minigame Error]:", error?.message || error);
      await ctx.react("❌");
      ctx.reply(`❌ Terjadi kesalahan: ${error?.message || error}`);
    }
  }
};