import axios from "axios";
import db from "../../data/db.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/game/brainrot/v3?mode=random`;
async function renderHtmlToImage(htmlContent) {
  const rawApi = global.bot?.api?.wudysoft || "";
  const cleanApi = rawApi.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  const baseUrl = `https://${cleanApi}/api/tools/html2img/`;
  const headers = {
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
  };
  const payload = {
    html: htmlContent,
    fullPage: true,
    quality: 100
  };
  const versions = ["v5", "v1", "v2", "v3", "v4", "v6", "v7", "v8", "v9", "v10"];
  for (const ver of versions) {
    try {
      const res = await axios.post(`${baseUrl}${ver}`, payload, {
        headers: headers,
        timeout: 15e3
      });
      const imgUrl = res.data?.url || res.data?.result || (typeof res.data === "string" ? res.data : null);
      if (imgUrl && /^https?:\/\//i.test(imgUrl)) {
        let buffer = null;
        try {
          const imgRes = await axios.get(imgUrl, {
            responseType: "arraybuffer",
            timeout: 12e3
          });
          if (imgRes.data) buffer = Buffer.from(imgRes.data);
        } catch {}
        return {
          url: imgUrl,
          buffer: buffer
        };
      }
    } catch {
      continue;
    }
  }
  return {
    url: null,
    buffer: null
  };
}

function buildBrainrotCanvasHtml(charImage, characters = [], status = "GUESS THE MEME") {
  const botName = global.bot?.name || "WudysoftBot";
  const isSolved = status === "SOLVED";
  const optionsHtml = characters.map((c, i) => `
    <div class="opt-card">
      <div class="opt-num">${i + 1}</div>
      <div class="opt-name">${c.name}</div>
    </div>
  `).join("");
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=Rajdhani:wght@600;700&display=swap');
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        width: 750px;
        height: 480px;
        background: #080a0f;
        font-family: 'Rajdhani', sans-serif;
        display: flex;
        justify-content: center;
        align-items: center;
        overflow: hidden;
      }
      .card {
        position: relative;
        width: 710px;
        height: 440px;
        background: radial-gradient(circle at 75% 25%, rgba(139, 92, 246, 0.25) 0%, rgba(10, 12, 18, 0.98) 75%);
        border: 2px solid #252b3b;
        border-radius: 20px;
        box-shadow: 0 25px 60px rgba(0,0,0,0.85);
        padding: 24px;
        display: flex;
        gap: 24px;
      }
      .left-frame {
        width: 300px;
        height: 100%;
        background: #0f131c;
        border-radius: 14px;
        border: 2px solid #333d52;
        box-shadow: inset 0 0 20px rgba(0,0,0,0.8), 0 10px 25px rgba(0,0,0,0.5);
        position: relative;
        overflow: hidden;
        display: flex;
        justify-content: center;
        align-items: center;
      }
      .char-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .watermark-badge {
        position: absolute;
        top: 12px;
        left: 12px;
        background: rgba(15, 23, 42, 0.85);
        border: 1px solid #3b82f6;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 11px;
        font-weight: 700;
        color: #60a5fa;
        letter-spacing: 1.5px;
        text-transform: uppercase;
        backdrop-filter: blur(4px);
      }
      .right-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }
      .header-tag {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .quiz-title {
        font-family: 'Orbitron', monospace;
        font-size: 24px;
        font-weight: 900;
        color: #f1f5f9;
        letter-spacing: 1.5px;
      }
      .quiz-title span {
        color: #ec4899;
      }
      .badge-status {
        background: ${isSolved ? "rgba(34, 197, 94, 0.2)" : "rgba(236, 72, 153, 0.2)"};
        color: ${isSolved ? "#4ade80" : "#f472b6"};
        border: 1px solid ${isSolved ? "#22c55e" : "#ec4899"};
        padding: 5px 12px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 2px;
      }
      .desc-banner {
        color: #94a3b8;
        font-size: 14px;
        margin-top: 4px;
      }
      .options-container {
        display: grid;
        grid-template-columns: 1fr;
        gap: 10px;
        margin: 10px 0;
      }
      .opt-card {
        background: #111520;
        border: 1px solid #232c3f;
        padding: 10px 14px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        gap: 12px;
        box-shadow: 0 4px 10px rgba(0,0,0,0.3);
      }
      .opt-num {
        width: 28px;
        height: 28px;
        background: linear-gradient(135deg, #ec4899, #8b5cf6);
        color: #fff;
        border-radius: 6px;
        display: flex;
        justify-content: center;
        align-items: center;
        font-weight: 900;
        font-size: 14px;
      }
      .opt-name {
        font-size: 16px;
        font-weight: 700;
        color: #e2e8f0;
      }
      .footer-meta {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-top: 1px solid #1e293b;
        padding-top: 10px;
        font-size: 13px;
        color: #64748b;
      }
      .footer-meta b {
        color: #a855f7;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="left-frame">
        <div class="watermark-badge">MEME IDENTITY</div>
        <img class="char-img" src="${charImage || "https://files.catbox.moe/g2e6i5.jpg"}" alt="Brainrot">
      </div>
      <div class="right-content">
        <div>
          <div class="header-tag">
            <div class="quiz-title">BRAINROT <span>RIVALS</span></div>
            <div class="badge-status">${status}</div>
          </div>
          <div class="desc-banner">Tebak karakter meme Italian Brainrot berdasarkan visual di samping.</div>
        </div>
        <div class="options-container">
          ${optionsHtml}
        </div>
        <div class="footer-meta">
          <div>REWARD : <b>+200 EXP</b></div>
          <div>SYSTEM : <b>${botName}</b></div>
        </div>
      </div>
    </div>
  </body>
  </html>
  `;
}

function initDB(jid = null, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.brainrot) global.db.brainrot = {};
  if (jid && !global.db.user[jid]) {
    global.db.user[jid] = {
      name: name || "",
      money: 1e4,
      exp: 0
    };
  }
}

function saveDB() {
  if (typeof db?.write === "function" && global.db) {
    db.write(global.db);
  }
}

function cleanMediaUrl(url) {
  if (!url || typeof url !== "string") return null;
  return url.replace(/\\+/g, "/");
}

function normalizeText(str) {
  return (str || "").toLowerCase().replace(/[^\w\s]/gi, "").replace(/\s+/g, " ").trim();
}
async function fetchMediaBuffer(url) {
  if (!url || typeof url !== "string" || !/^https?:\/\//i.test(url)) return null;
  try {
    const res = await axios.get(url, {
      responseType: "arraybuffer",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      },
      timeout: 15e3
    });
    if (res.data) return Buffer.from(res.data);
  } catch (err) {
    console.error("[Fetch Media Buffer Error]:", err.message);
  }
  return null;
}
export default {
  name: "brainrot",
  aliases: ["rotquiz", "tebakbrainrot", "brainrotquiz", "rotrivals"],
  description: "Game kuis tebak karakter meme Italian Brainrot dengan canvas realistis bertema Neoxr",
  category: "Game",
  limit: true,
  example: "brainrot atau brainrot 1 (untuk menjawab)",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const chatId = ctx?.id || msg?.key?.remoteJid;
      if (!chatId) return;
      initDB();
      if (!global.db.brainrot[chatId]) return;
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      const session = global.db.brainrot[chatId];
      if (Date.now() > session.expireTime) {
        delete global.db.brainrot[chatId];
        saveDB();
        return;
      }
      const quotedStanzaId = ctx?.quoted?.id || msg?.message?.extendedTextMessage?.contextInfo?.stanzaId;
      const isReplyingToQuiz = quotedStanzaId && (quotedStanzaId === session.questionMsgId || quotedStanzaId === session.audioMsgId);
      if (!isReplyingToQuiz) return;
      const userText = (ctx?.text || ctx?.query || msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "").trim().toLowerCase();
      const prefixList = [".", "#", "!", "/", ctx?.prefix].filter(Boolean);
      if (prefixList.some(p => userText.startsWith(p)) && !userText.startsWith(`${ctx?.prefix || "."}brainrot`)) return;
      let selectedIndex = -1;
      const cleanUser = normalizeText(userText.replace(`${ctx?.prefix || "."}brainrot`, "").trim());
      if (["1", "2", "3", "4"].includes(cleanUser)) {
        selectedIndex = parseInt(cleanUser, 10) - 1;
      } else {
        selectedIndex = session.characters.findIndex(c => {
          const charName = normalizeText(c.name);
          return charName === cleanUser || cleanUser.includes(charName) || charName.includes(cleanUser) && cleanUser.length >= 4;
        });
      }
      if (selectedIndex === -1) return;
      const isCorrect = selectedIndex === session.correctIndex;
      const targetChar = session.characters[session.correctIndex];
      if (isCorrect) {
        const duration = ((Date.now() - session.startTime) / 1e3).toFixed(1);
        const senderName = ctx?.pushname || ctx?.pushName || "Pemain";
        const senderJid = ctx?.sender;
        delete global.db.brainrot[chatId];
        if (senderJid) {
          initDB(senderJid, senderName);
          global.db.user[senderJid].exp = (global.db.user[senderJid].exp || 0) + 200;
        }
        saveDB();
        if (typeof ctx?.react === "function") await ctx.react("🎉");
        const winMessage = `Hi ${senderName}!
Jawaban kamu tepat sasaran! Tebakan meme Brainrot benar.

–  *B R A I N R O T  C L E A R E D*

┌  ◦  *Penebak* : ${senderName}
│  ◦  *Karakter* : ${targetChar.name}
${targetChar.description ? `│  ◦  *Deskripsi* : ${targetChar.description}\n` : ""}\
│  ◦  *Waktu Jawab* : ${duration} Detik
└  ◦  *Reward* : +200 EXP

_Ketik \`${ctx?.prefix || "."}brainrot\` untuk melanjutkan ronde berikutnya._`;
        await sock.sendMessage(chatId, {
          text: winMessage,
          mentions: senderJid ? [senderJid] : []
        }, {
          quoted: msg
        });
        return true;
      } else {
        const chosenChar = session.characters[selectedIndex];
        if (typeof ctx?.react === "function") await ctx.react("❌");
        const failText = `Hi ${ctx?.pushname || "Pemain"}!
Tebakanmu masih kurang tepat.

–  *W R O N G  A N S W E R*

┌  ◦  *Pilihanmu* : ${chosenChar.name}
└  ◦  *Keterangan* : Karakter bukan yang dimaksud

_Silakan dengarkan audio kembali dan coba tebak karakter lainnya!_`;
        await sock.sendMessage(chatId, {
          text: failText
        }, {
          quoted: msg
        });
        return true;
      }
    } catch (e) {
      console.error("[BRAINROT BEFORE ERROR]:", e.message);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      const rawText = (ctx.query || ctx.text || "").trim().toLowerCase();
      const botName = global.bot?.name || "WudysoftBot";
      const footerText = `${global.bot?.footer || botName}`;
      const prefix = ctx.prefix || ".";
      const userName = ctx.pushname || ctx.pushName || ctx.sender.split("@")[0];
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const chatId = ctx.id;
      initDB();
      if (rawText.includes("end") || rawText.includes("batal") || rawText.includes("nyerah") || rawText.includes("surrender")) {
        if (global.db.brainrot[chatId]) {
          const session = global.db.brainrot[chatId];
          const targetChar = session.characters[session.correctIndex];
          delete global.db.brainrot[chatId];
          saveDB();
          const surrenderText = `Hi ${userName}!
Kamu telah menyerah pada ronde kuis ini.

–  *S U R R E N D E R*

┌  ◦  *Jawaban Asli* : ${targetChar.name}
${targetChar.description ? `│  ◦  *Info* : ${targetChar.description}\n` : ""}\
└  ◦  *Status* : Sesi Dihentikan

_Gunakan perintah \`${prefix}brainrot\` untuk memulai game baru._`;
          return await sock.sendMessage(chatId, {
            text: surrenderText
          }, {
            quoted: quotedMsg
          });
        }
        return ctx.reply("❌ Tidak ada sesi game Brainrot yang sedang aktif di chat ini.");
      }
      if (global.db.brainrot[chatId] && ["1", "2", "3", "4"].includes(rawText)) {
        const session = global.db.brainrot[chatId];
        const selectedIndex = parseInt(rawText, 10) - 1;
        const targetChar = session.characters[session.correctIndex];
        if (selectedIndex === session.correctIndex) {
          const duration = ((Date.now() - session.startTime) / 1e3).toFixed(1);
          delete global.db.brainrot[chatId];
          initDB(ctx.sender, userName);
          global.db.user[ctx.sender].exp = (global.db.user[ctx.sender].exp || 0) + 200;
          saveDB();
          await ctx.react("🎉");
          const winMessage = `Hi ${userName}!
Tebakanmu berhasil! Karakter Brainrot tertebak dengan benar.

–  *B R A I N R O T  C L E A R E D*

┌  ◦  *Penebak* : ${userName}
│  ◦  *Karakter* : ${targetChar.name}
${targetChar.description ? `│  ◦  *Deskripsi* : ${targetChar.description}\n` : ""}\
│  ◦  *Waktu Jawab* : ${duration} Detik
└  ◦  *Reward* : +200 EXP

_Ketik \`${prefix}brainrot\` untuk ronde berikutnya._`;
          return await sock.sendMessage(chatId, {
            text: winMessage
          }, {
            quoted: quotedMsg
          });
        } else {
          const chosenChar = session.characters[selectedIndex];
          await ctx.react("❌");
          return await sock.sendMessage(chatId, {
            text: `Hi ${userName}!\nPilihanmu [${rawText}] *${chosenChar.name}* salah. Coba dengarkan audio dan pilih opsi lain!`
          }, {
            quoted: quotedMsg
          });
        }
      }
      if (global.db.brainrot[chatId]) {
        const warningBody = `Hi ${userName}!
Masih ada sesi tebak karakter Brainrot yang sedang aktif.

–  *S E S S I O N  A C T I V E*

┌  ◦  *Sistem* : 4 Pilihan Karakter
│  ◦  *Panduan* : Reply pesan soal dengan angka 1 - 4
└  ◦  *Aksi* : Pilih tombol menyerah jika ingin menghentikan

_Silakan selesaikan sesi ini terlebih dahulu._`;
        const warningButtons = [{
          name: "quick_reply",
          display_text: "🏳️ Menyerah",
          id: `${prefix}brainrot surrender`
        }];
        if (typeof ctx.sendCta === "function") {
          return await ctx.sendCta(warningBody, footerText, warningButtons, {
            title: `✦ ${botName} • Game Sedang Berjalan ✦`,
            quoted: quotedMsg
          });
        }
        return ctx.reply(warningBody, {
          quoted: quotedMsg
        });
      }
      await ctx.react("⏳");
      const {
        data
      } = await axios.get(API_URL, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 3e4
      });
      if (!data || data.error || !data.result?.characters?.length) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal memuat database kuis Brainrot dari server.");
      }
      const characters = data.result.characters;
      const selection = data.result.selection ?? 0;
      const targetChar = characters[selection] || characters[0];
      const targetImage = cleanMediaUrl(targetChar.image);
      const targetAudio = cleanMediaUrl(targetChar.short_audio);
      const TIMEOUT_SECONDS = 90;
      const canvasHtml = buildBrainrotCanvasHtml(targetImage, characters, "GUESS THE MEME");
      const {
        buffer: cardBuffer,
        url: cardUrl
      } = await renderHtmlToImage(canvasHtml);
      const imagePayload = cardBuffer || (cardUrl ? {
        url: cardUrl
      } : targetImage ? {
        url: targetImage
      } : null);
      const choiceRows = characters.map((c, i) => ({
        title: `[${i + 1}] ${c.name}`.slice(0, 24),
        id: `${prefix}brainrot ${i + 1}`,
        description: c.description ? c.description.slice(0, 60) : `Tebak karakter ${c.name}`
      }));
      const bodyText = `Hi Survivors!
Siapakah identitas karakter meme Italian Brainrot berikut?

–  *B R A I N R O T  Q U I Z*

┌  ◦  *Countdown* : ${TIMEOUT_SECONDS} Detik
│  ◦  *Audio Clue* : VN Suara Terlampir
│  ◦  *Reward* : +200 EXP
└  ◦  *Status* : Waiting for Answer

–  *C H A R A C T E R  L I S T*

${characters.map((c, i) => `┌  ◦  [${i + 1}] ${c.name}`).join("\n")}

_Balas pesan gambar/audio ini dengan angka (1 - 4) atau klik tombol jawaban!_`;
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: "🎯 PILIH JAWABAN",
          sections: [{
            title: `${botName} • PILIHAN KARAKTER`,
            rows: choiceRows
          }]
        })
      }, {
        name: "quick_reply",
        display_text: "🏳️ Menyerah",
        id: `${prefix}brainrot surrender`
      }];
      const ctaOptions = {
        image: imagePayload,
        title: `✦ ${botName} • Italian Brainrot Rivals ✦`,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 2,
            divider_indices: [1],
            list_title: `${botName} • Tebak Karakter`,
            button_title: "🎯 Pilih Jawaban"
          }
        },
        contextInfo: {
          mentionedJid: [ctx.sender],
          forwardingScore: 999,
          isForwarded: true
        },
        quoted: quotedMsg
      };
      let sentMsg = null;
      if (typeof ctx.sendCta === "function") {
        sentMsg = await ctx.sendCta(bodyText, footerText, buttons, ctaOptions);
      } else if (imagePayload) {
        sentMsg = await sock.sendMessage(chatId, {
          image: typeof imagePayload === "object" ? imagePayload : {
            url: imagePayload
          },
          caption: `${bodyText}\n\n_${footerText}_`
        }, {
          quoted: quotedMsg
        });
      } else {
        sentMsg = await ctx.reply(bodyText, {
          quoted: quotedMsg
        });
      }
      const questionMsgId = sentMsg?.key?.id;
      let sentAudioMsg = null;
      if (targetAudio) {
        const audioBuffer = await fetchMediaBuffer(targetAudio);
        if (audioBuffer) {
          sentAudioMsg = await sock.sendMessage(chatId, {
            audio: audioBuffer,
            mimetype: "audio/mp4",
            ptt: true
          }, {
            quoted: sentMsg || quotedMsg
          });
        }
      }
      global.db.brainrot[chatId] = {
        questionMsgId: questionMsgId,
        audioMsgId: sentAudioMsg?.key?.id || null,
        characters: characters,
        correctIndex: selection,
        startTime: Date.now(),
        expireTime: Date.now() + TIMEOUT_SECONDS * 1e3
      };
      saveDB();
      setTimeout(async () => {
        initDB();
        if (global.db.brainrot[chatId] && Date.now() >= global.db.brainrot[chatId].expireTime) {
          const current = global.db.brainrot[chatId];
          const ans = current.characters[current.correctIndex];
          delete global.db.brainrot[chatId];
          saveDB();
          const timeoutText = `Hi All!
Waktu tebak karakter Brainrot telah habis! ⌛

–  *T I M E O U T*

┌  ◦  *Jawaban Asli* : ${ans?.name}
${ans?.description ? `│  ◦  *Info* : ${ans.description}\n` : ""}\
└  ◦  *Status* : Tidak Terjawab Tepat Waktu

_Gunakan perintah \`${prefix}brainrot\` untuk mencoba kuis kembali._`;
          await sock.sendMessage(chatId, {
            text: timeoutText
          });
        }
      }, TIMEOUT_SECONDS * 1e3);
      await ctx.react("🧠");
    } catch (error) {
      console.error("[Brainrot Quiz Error]:", error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Brainrot Quiz Error: ${errMsg}`);
    }
  }
};