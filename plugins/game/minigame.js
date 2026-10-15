import {
  miniGame
} from "../../lib/game.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /--([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1];
    let rawVal = match[2];
    let val = true;
    const lowerKey = key.toLowerCase();
    if (["play", "game", "id", "index", "no", "g"].includes(lowerKey)) key = "id";
    if (["search", "q", "find", "s"].includes(lowerKey)) key = "search";
    if (["random", "rand", "r"].includes(lowerKey)) key = "random";
    if (["page", "pg", "p"].includes(lowerKey)) key = "page";
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
  description: "Mainkan mini game HTML5 interaktif (Sorted A-Z & Pilih Index)",
  category: "Game",
  limit: false,
  example: "minigame atau minigame 1 atau minigame --id 5 atau minigame --random",
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
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      const rawList = Array.isArray(miniGame) ? miniGame : [];
      if (!rawList.length) {
        await ctx.react("❌");
        return ctx.reply("❌ Tidak ada game yang tersedia saat ini.");
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
          return ctx.reply("❌ Data file game tidak valid atau tidak ditemukan.");
        }
        await ctx.react("🎮");
        if (typeof ctx.sendRich === "function") {
          return await ctx.sendRich({
            title: `🎮 ${gameItem.title || "Mini Game"}`,
            html: gameItem.html,
            tabTitle: gameItem.title || "Mini Game",
            buttonTitle: `Mainkan Game #${gameItem.index} 🕹️`,
            trustedSources: ["https://cdn.jsdelivr.net", "https://unpkg.com", "https://cdnjs.cloudflare.com"],
            sourceUrl: "https://html5games.com",
            botJid: sock.user?.id || "0@s.whatsapp.net",
            disclaimer: "Game berjalan langsung pada browser interaktif WhatsApp.",
            quoted: quotedMsg
          });
        } else {
          return ctx.reply(`🎮 *${gameItem.title.toUpperCase()} (Index: #${gameItem.index})*\n\n` + `_Fitur rich browser tidak didukung pada bot ini._`);
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
          return ctx.reply(`❌ Game dengan nomor urut index *#${inputTarget}* tidak ditemukan. (Tersedia: 1 - ${sortedGames.length})`);
        }
      }
      let displayList = sortedGames;
      const searchQuery = flags.search || "";
      if (searchQuery) {
        displayList = sortedGames.filter(g => (g.title || "").toLowerCase().includes(searchQuery.toLowerCase()));
        if (!displayList.length) {
          await ctx.react("❌");
          return ctx.reply(`❌ Tidak ditemukan game dengan judul: *"${searchQuery}"*`);
        }
      }
      const perPage = 10;
      const totalPages = Math.ceil(displayList.length / perPage) || 1;
      let page = Number(flags.page) || 1;
      if (page < 1) page = 1;
      if (page > totalPages) page = totalPages;
      const startIndex = (page - 1) * perPage;
      const currentItems = displayList.slice(startIndex, startIndex + perPage);
      const gameRows = currentItems.map(g => ({
        title: `[#${g.index}] ${g.title || "Untitled"}`.slice(0, 24),
        description: `Buka & mainkan ${g.title}`,
        id: `${prefix}minigame --id ${g.index}`
      }));
      const navRows = [{
        title: "🎲 Game Acak (Random)",
        description: "Pilih dan mainkan 1 game acak",
        id: `${prefix}minigame --random`
      }];
      const sections = [{
        title: `🕹️ DAFTAR GAME (A-Z) • Hal ${page}/${totalPages}`,
        rows: gameRows
      }, {
        title: "⚡ PILIHAN CEPAT",
        rows: navRows
      }];
      const bodyText = `🕹️ *INTERACTIVE MINI GAMES (A-Z)*\n\n` + `• *Total Game:* ${sortedGames.length} Game (Urut A-Z)\n` + `• *Halaman:* ${page} dari ${totalPages}\n` + (searchQuery ? `• *Hasil Pencarian:* "${searchQuery}"\n` : "") + `\n*Cara Memilih:*\n` + `👉 Ketik: \`${prefix}minigame <nomor index>\` (Contoh: \`${prefix}minigame 1\`)\n` + `👉 Atau pilih langsung melalui menu tombol di bawah ini:`;
      const footerText = `${botName} • Mini Game Hub`;
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: `🎮 Pilih Game (Hal ${page})`,
          sections: sections
        })
      }];
      let baseCmd = `${prefix}minigame`;
      if (searchQuery) baseCmd += ` --search "${searchQuery}"`;
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
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `${botName} • Game Center`,
            button_title: "Lihat Semua Game"
          }
        },
        quoted: quotedMsg
      };
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, footerText, buttons, options);
      } else {
        let fallback = `🕹️ *DAFTAR MINI GAME (A-Z)*\n\n`;
        fallback += gameRows.map(r => `• *${r.title}*\n  Ketik: \`${r.id}\``).join("\n\n");
        fallback += `\n\n_Ketik \`${prefix}minigame <nomor>\` untuk memainkan game._`;
        await ctx.reply(fallback);
      }
      await ctx.react("✅");
    } catch (error) {
      await ctx.react("❌");
      ctx.reply(`❌ Minigame Error: ${error?.message || error}`);
    }
  }
};