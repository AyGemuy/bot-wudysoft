import axios from "axios";
import fs from "fs";
import path from "path";
import os from "os";
import {
  spawn
} from "child_process";
import {
  fileURLToPath
} from "url";
import db from "../../data/db.js";
import {
  writeExifVid
} from "../../lib/exif.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = path.resolve(__dirname, "../../lib/dadu");
const API_URL = `${global.bot?.api?.wudysoft}/api/tools/html2vid/v1`;
const DEFAULT_THEME = "original";
const DEFAULT_BET = 500;
const OUT_SIZE = 512;

function initDB(jid = null, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.dice) global.db.dice = {};
  if (jid && !jid.includes("BOT") && !global.db.user[jid]) {
    global.db.user[jid] = {
      name: name || "",
      money: 1e4,
      exp: 0,
      diceTheme: DEFAULT_THEME
    };
  }
}

function saveDB() {
  if (typeof db?.write === "function" && global.db) {
    db.write(global.db);
  }
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, {
      stdio: ["ignore", "pipe", "pipe"],
      ...opts
    });
    let stdout = "";
    let stderr = "";
    p.stdout.on("data", d => stdout += d);
    p.stderr.on("data", d => stderr += d);
    p.on("error", err => reject(new Error(`Gagal menjalankan ${cmd}: ${err.message}`)));
    p.on("close", code => {
      if (code === 0) resolve({
        stdout: stdout,
        stderr: stderr
      });
      else reject(new Error(`${cmd} exit ${code}\n${stderr.slice(-800)}`));
    });
  });
}
async function probeSize(file) {
  const {
    stdout
  } = await run("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "json", file]);
  const s = JSON.parse(stdout).streams?.[0];
  if (!s) throw new Error("Stream video tidak ditemukan");
  return {
    width: s.width,
    height: s.height
  };
}
async function cropTo512(input, output) {
  const {
    width,
    height
  } = await probeSize(input);
  let vf;
  if (width >= OUT_SIZE && height >= OUT_SIZE) {
    vf = `crop=${OUT_SIZE}:${OUT_SIZE}`;
  } else {
    vf = `scale=${OUT_SIZE}:${OUT_SIZE}:force_original_aspect_ratio=increase,crop=${OUT_SIZE}:${OUT_SIZE}`;
  }
  await run("ffmpeg", ["-y", "-i", input, "-vf", vf, "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-pix_fmt", "yuv420p", "-an", "-movflags", "+faststart", output]);
}

function unlinkSafe(p) {
  try {
    if (p && fs.existsSync(p)) fs.unlinkSync(p);
  } catch {}
}

function listThemes() {
  try {
    return fs.readdirSync(TEMPLATE_DIR).filter(f => f.endsWith(".html")).map(f => f.replace(/\.html$/i, ""));
  } catch {
    return [DEFAULT_THEME];
  }
}

function loadAndInjectTemplate(themeName, number) {
  const safeName = String(themeName || DEFAULT_THEME).replace(/[^a-z0-9_-]/gi, "");
  let filePath = path.join(TEMPLATE_DIR, `${safeName}.html`);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(TEMPLATE_DIR, `${DEFAULT_THEME}.html`);
  }
  if (!fs.existsSync(filePath)) {
    throw new Error(`File template "${safeName}.html" tidak ditemukan.`);
  }
  let html = fs.readFileSync(filePath, "utf-8");
  html = html.replace(/\{\{number\}\}/gi, String(number));
  html = html.replace(/\{\{theme\}\}/gi, safeName);
  return html;
}
async function renderHtml(html) {
  const res = await axios.post(API_URL, {
    html: html
  }, {
    headers: {
      "Content-Type": "application/json"
    },
    responseType: "arraybuffer",
    timeout: 18e4,
    maxContentLength: 100 * 1024 * 1024,
    maxBodyLength: 100 * 1024 * 1024
  });
  return Buffer.from(res.data);
}
async function createDiceStickerBuffer(htmlContent, themeName) {
  const tmpDir = os.tmpdir();
  const stamp = Date.now() + "_" + Math.random().toString(36).slice(2, 8);
  const rawFile = path.join(tmpDir, `dice_raw_${stamp}.mp4`);
  const cropFile = path.join(tmpDir, `dice_crop_${stamp}.mp4`);
  try {
    const rawBuf = await renderHtml(htmlContent);
    if (!rawBuf || rawBuf.length < 2e3) {
      throw new Error("Hasil render video dadu rusak atau kosong.");
    }
    fs.writeFileSync(rawFile, rawBuf);
    await cropTo512(rawFile, cropFile);
    const finalVid = fs.readFileSync(cropFile);
    const exif = {
      packname: global.bot?.name || "Dice Master",
      author: `${themeName.toUpperCase()} • 3D Dice`,
      categories: ["🎲"]
    };
    const stickerBuf = await writeExifVid(finalVid, exif, {});
    return {
      stickerBuf: stickerBuf,
      videoBuf: finalVid
    };
  } finally {
    unlinkSafe(rawFile);
    unlinkSafe(cropFile);
  }
}
async function sendCTA(sock, ctx, targetId, {
  text,
  footer,
  buttons = [],
  mentions = [],
  quoted = null
}) {
  const botName = global.bot?.name || "Neoxr Bot";
  const finalFooter = footer || `${botName} • 3D Dice Game`;
  const formattedButtons = buttons.map(b => {
    if (b.buttonParamsJson) return b;
    return {
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: b.display_text || b.text || "Klik",
        id: b.id || b.command || ""
      })
    };
  });
  const options = {
    jid: targetId,
    to: targetId,
    contextInfo: {
      mentionedJid: mentions || []
    },
    quoted: quoted || undefined
  };
  if (typeof ctx.sendCta === "function") {
    return await ctx.sendCta(text, finalFooter, formattedButtons, options);
  } else {
    return await sock.sendMessage(targetId, {
      text: text,
      mentions: mentions,
      ...options
    });
  }
}
export default {
  name: "dice",
  aliases: ["dadu", "roll", "rolldice"],
  description: "Bermain dadu 3D dengan hasil stiker bergerak / video (Tampilan Neoxr)",
  category: "Game",
  example: ".dice | .dice 1000 | .dice solo 2000 | .dice --settheme <nama>",
  execute: async (sock, ctx, msg) => {
    const chatId = ctx.id;
    const sender = ctx.sender || ctx.author || msg?.key?.participant || msg?.key?.remoteJid;
    const senderName = ctx.pushName || "Player";
    const prefix = ctx.prefix || ".";
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
    const rawText = (ctx.query || "").trim();
    initDB(sender, senderName);
    if (rawText.startsWith("--settheme") || rawText.startsWith("--tema")) {
      const chosen = rawText.split(/\s+/)[1]?.toLowerCase();
      const themes = listThemes();
      if (!chosen || !themes.includes(chosen)) {
        let text = `– *D I C E  -  T E M A*\n\n`;
        text += `❌ File tema tidak ditemukan!\n\n`;
        text += `┌ ◦ *Tema Tersedia* :\n`;
        themes.forEach((t, i) => {
          const isLast = i === themes.length - 1;
          text += `${isLast ? "└" : "├"} ◦ \`${prefix}dice --settheme ${t}\`\n`;
        });
        text += `\n_Pilih salah satu tema dari daftar di atas._`;
        return ctx.reply(text);
      }
      global.db.user[sender].diceTheme = chosen;
      saveDB();
      return ctx.reply(`– *D I C E  -  T E M A*\n\n┌ ◦ *Status* : Sukses\n└ ◦ *Tema Aktif* : \`${chosen}.html\`\n\n_Tema berhasil disimpan!_`);
    }
    if (rawText === "--listtheme" || rawText === "--list") {
      const themes = listThemes();
      let text = `– *D I C E  -  L I S T*\n\n`;
      text += `┌ ◦ *Total* : ${themes.length} Tema\n`;
      themes.forEach((t, i) => {
        const isLast = i === themes.length - 1;
        text += `${isLast ? "└" : "├"} ◦ \`${t}\`\n`;
      });
      text += `\n_Gunakan \`${prefix}dice --settheme <nama>\` untuk memilih tema._`;
      return ctx.reply(text);
    }
    const args = rawText.split(/\s+/).filter(Boolean);
    let bet = DEFAULT_BET;
    let isSolo = false;
    let asVideo = false;
    for (const arg of args) {
      if (/^\d+$/.test(arg)) {
        bet = Math.max(100, parseInt(arg, 10));
      } else if (["solo", "bot", "single"].includes(arg.toLowerCase())) {
        isSolo = true;
      } else if (["--video", "--vid", "-v"].includes(arg.toLowerCase())) {
        asVideo = true;
      }
    }
    const userMoney = Number(global.db.user[sender].money) || 0;
    if (userMoney < bet) {
      return ctx.reply(`– *D I C E  -  E R R O R*\n\n` + `┌ ◦ *Status* : Saldo Tidak Cukup\n` + `├ ◦ *Taruhan* : Rp ${bet.toLocaleString("id-ID")}\n` + `└ ◦ *Saldo Anda* : Rp ${userMoney.toLocaleString("id-ID")}`);
    }
    const currentTheme = global.db.user[sender].diceTheme || DEFAULT_THEME;
    if (isSolo || !ctx.isGroup) {
      await ctx.react("🎲");
      const playerDice = Math.floor(Math.random() * 6) + 1;
      const botDice = Math.floor(Math.random() * 6) + 1;
      const htmlContent = loadAndInjectTemplate(currentTheme, playerDice);
      const {
        stickerBuf,
        videoBuf
      } = await createDiceStickerBuffer(htmlContent, currentTheme);
      if (asVideo) {
        await sock.sendMessage(chatId, {
          video: videoBuf,
          gifPlayback: true
        }, {
          quoted: quotedMsg
        });
      } else {
        await sock.sendMessage(chatId, {
          sticker: stickerBuf
        }, {
          quoted: quotedMsg
        });
      }
      const isWin = playerDice > botDice;
      const isDraw = playerDice === botDice;
      let resultText = `– *D I C E  -  S O L O*\n\n`;
      resultText += `┌ ◦ *Pemain* : @${sender.split("@")[0]} [ ${playerDice} ]\n`;
      resultText += `├ ◦ *Dealer* : Bot [ ${botDice} ]\n`;
      resultText += `├ ◦ *Taruhan* : Rp ${bet.toLocaleString("id-ID")}\n`;
      resultText += `└ ◦ *Tema* : \`${currentTheme}.html\`\n\n`;
      if (isWin) {
        const prizeExp = Math.floor(bet * .5);
        global.db.user[sender].money += bet;
        global.db.user[sender].exp += prizeExp;
        resultText += `*HASIL : MENANG*\n`;
        resultText += `Selamat! Anda mendapatkan *+Rp ${bet.toLocaleString("id-ID")} Money* dan *+${prizeExp} EXP*.`;
      } else if (isDraw) {
        resultText += `*HASIL : SERI*\n`;
        resultText += `Poin seimbang! Uang taruhan dikembalikan penuh.`;
      } else {
        global.db.user[sender].money -= bet;
        resultText += `*HASIL : KALAH*\n`;
        resultText += `Anda kehilangan saldo sebesar *-Rp ${bet.toLocaleString("id-ID")} Money*.`;
      }
      saveDB();
      const replayButtons = [{
        display_text: "🎲 Main Lagi",
        id: `${prefix}dice solo ${bet}`
      }, {
        display_text: "📂 Daftar Tema",
        id: `${prefix}dice --list`
      }];
      return await sendCTA(sock, ctx, chatId, {
        text: resultText,
        buttons: replayButtons,
        mentions: [sender],
        quoted: quotedMsg
      });
    }
    const activeLobby = global.db.dice[chatId];
    if (rawText.toLowerCase() === "join" || rawText.toLowerCase() === "gabung") {
      if (!activeLobby || activeLobby.state !== "LOBBY") {
        return ctx.reply(`– *D I C E*\n\n❌ Tidak ada room lobi dadu yang terbuka saat ini.`);
      }
      if (activeLobby.players.some(p => p.id === sender)) {
        return ctx.reply(`– *D I C E*\n\n⚠️ Anda sudah bergabung di dalam room ini.`);
      }
      if (userMoney < activeLobby.bet) {
        return ctx.reply(`– *D I C E*\n\n❌ Saldo Anda tidak cukup untuk taruhan *Rp ${activeLobby.bet.toLocaleString("id-ID")}*.`);
      }
      const generatedScore = Math.floor(Math.random() * 6) + 1;
      activeLobby.players.push({
        id: sender,
        name: senderName,
        theme: currentTheme,
        score: generatedScore
      });
      saveDB();
      let joinText = `– *D I C E  -  J O I N*\n\n`;
      joinText += `@${sender.split("@")[0]} berhasil bergabung ke dalam lobi!\n\n`;
      joinText += `┌ ◦ *Taruhan* : Rp ${activeLobby.bet.toLocaleString("id-ID")}\n`;
      joinText += `├ ◦ *Total Pemain* : ${activeLobby.players.length} / 4\n`;
      activeLobby.players.forEach((p, i) => {
        const isLast = i === activeLobby.players.length - 1;
        joinText += `${isLast ? "└" : "├"} ◦ @${p.id.split("@")[0]} (\`${p.theme}\`)\n`;
      });
      joinText += `\n_Klik tombol di bawah untuk berinteraksi:_`;
      const buttons = [{
        display_text: "🤝 Ikut Gabung",
        id: `${prefix}dice join`
      }, {
        display_text: "▶️ Mulai Kocok",
        id: `${prefix}dice roll`
      }, {
        display_text: "🚪 Batal",
        id: `${prefix}dice batal`
      }];
      return await sendCTA(sock, ctx, chatId, {
        text: joinText,
        buttons: buttons,
        mentions: activeLobby.players.map(p => p.id),
        quoted: quotedMsg
      });
    }
    if (rawText.toLowerCase() === "roll" || rawText.toLowerCase() === "mulai") {
      if (!activeLobby || activeLobby.state !== "LOBBY") {
        return ctx.reply(`– *D I C E*\n\n❌ Tidak ada room yang siap untuk dikocok.`);
      }
      if (activeLobby.host !== sender) {
        return ctx.reply(`– *D I C E*\n\n❌ Hanya Host (@${activeLobby.host.split("@")[0]}) yang dapat memulai kocokan!`, {
          mentions: [activeLobby.host]
        });
      }
      if (activeLobby.players.length < 2) {
        return ctx.reply(`– *D I C E*\n\n❌ Minimal 2 pemain untuk memulai pertarungan grup.`);
      }
      await ctx.react("⏳");
      const players = activeLobby.players;
      const highestScore = Math.max(...players.map(p => p.score));
      const winners = players.filter(p => p.score === highestScore);
      const totalPool = activeLobby.bet * players.length;
      const prizePerWinner = Math.floor(totalPool / winners.length);
      players.forEach(p => {
        global.db.user[p.id].money -= activeLobby.bet;
      });
      winners.forEach(w => {
        global.db.user[w.id].money += prizePerWinner;
        global.db.user[w.id].exp += 500;
      });
      const winnerDice = winners[0].score;
      const winnerTheme = winners[0].theme;
      const htmlContent = loadAndInjectTemplate(winnerTheme, winnerDice);
      const {
        stickerBuf,
        videoBuf
      } = await createDiceStickerBuffer(htmlContent, winnerTheme);
      delete global.db.dice[chatId];
      saveDB();
      if (asVideo) {
        await sock.sendMessage(chatId, {
          video: videoBuf,
          gifPlayback: true
        }, {
          quoted: quotedMsg
        });
      } else {
        await sock.sendMessage(chatId, {
          sticker: stickerBuf
        }, {
          quoted: quotedMsg
        });
      }
      let boardText = `– *D I C E  -  B A T T L E*\n\n`;
      boardText += `┌ ◦ *Taruhan* : Rp ${activeLobby.bet.toLocaleString("id-ID")}\n`;
      boardText += `├ ◦ *Total Hadiah* : Rp ${totalPool.toLocaleString("id-ID")}\n`;
      players.forEach(p => {
        const isWin = p.score === highestScore;
        boardText += `├ ◦ ${isWin ? "👑" : "•"} @${p.id.split("@")[0]} : *[ ${p.score} ]* (\`${p.theme}\`)\n`;
      });
      boardText += `└ ◦ *Pemenang* : ${winners.map(w => `@${w.id.split("@")[0]}`).join(", ")}\n\n`;
      boardText += `*Selamat kepada pemenang!*\nMasing-masing memperoleh *+Rp ${prizePerWinner.toLocaleString("id-ID")} Money* & *+500 EXP*.`;
      const endButtons = [{
        display_text: "🎲 Main Lagi",
        id: `${prefix}dice ${activeLobby.bet}`
      }, {
        display_text: "🤖 Mode Solo",
        id: `${prefix}dice solo ${activeLobby.bet}`
      }];
      return await sendCTA(sock, ctx, chatId, {
        text: boardText,
        buttons: endButtons,
        mentions: players.map(p => p.id),
        quoted: quotedMsg
      });
    }
    if (["batal", "stop", "cancel"].includes(rawText.toLowerCase())) {
      if (global.db.dice[chatId]) {
        delete global.db.dice[chatId];
        saveDB();
        return ctx.reply(`– *D I C E*\n\n🧹 Sesi room dadu berhasil dibatalkan dan dibersihkan.`);
      }
      return ctx.reply(`– *D I C E*\n\n❌ Tidak ada room aktif yang dapat dibatalkan.`);
    }
    if (activeLobby && activeLobby.state === "LOBBY") {
      return ctx.reply(`– *D I C E*\n\n⚠️ Lobi sudah ada dengan taruhan *Rp ${activeLobby.bet.toLocaleString("id-ID")}*.\nKetik \`${prefix}dice join\` untuk bergabung.`);
    }
    const hostGeneratedScore = Math.floor(Math.random() * 6) + 1;
    global.db.dice[chatId] = {
      state: "LOBBY",
      host: sender,
      bet: bet,
      players: [{
        id: sender,
        name: senderName,
        theme: currentTheme,
        score: hostGeneratedScore
      }],
      createdAt: Date.now()
    };
    saveDB();
    let lobbyText = `– *D I C E  -  L O B B Y*\n\n`;
    lobbyText += `Room dadu 3D berhasil dibuka!\n\n`;
    lobbyText += `┌ ◦ *Host* : @${sender.split("@")[0]}\n`;
    lobbyText += `├ ◦ *Taruhan* : Rp ${bet.toLocaleString("id-ID")}\n`;
    lobbyText += `├ ◦ *Tema Anda* : \`${currentTheme}.html\`\n`;
    lobbyText += `└ ◦ *Pemain* : 1 / 4 Terdaftar\n\n`;
    lobbyText += `_Klik tombol di bawah untuk ikut bertaruh:_`;
    const lobbyButtons = [{
      display_text: "🤝 Ikut Gabung",
      id: `${prefix}dice join`
    }, {
      display_text: "▶️ Mulai Kocok",
      id: `${prefix}dice roll`
    }, {
      display_text: "🚪 Batal",
      id: `${prefix}dice batal`
    }];
    await sendCTA(sock, ctx, chatId, {
      text: lobbyText,
      buttons: lobbyButtons,
      mentions: [sender],
      quoted: quotedMsg
    });
  }
};