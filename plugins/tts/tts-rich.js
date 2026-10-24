import axios from "axios";
import {
  exec
} from "child_process";
import fs from "fs/promises";
import path from "path";
import os from "os";
import {
  promisify
} from "util";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const execAsync = promisify(exec);
const CONFIG = {
  API_URL: `${global.bot?.api?.wudysoft || "https://api.wudysoft.com"}/api/misc/tts/v54`,
  DEFAULT_VOICE: "Kore",
  DEFAULT_ANIME_VOICE: "anime-girl",
  DEFAULT_LANG: "indonesian",
  TIMEOUT: 6e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};
async function compressAudioToBase64(audioInput) {
  const tmpDir = os.tmpdir();
  const id = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const inputPath = path.join(tmpDir, `tts_in_${id}.mp3`);
  const outputPath = path.join(tmpDir, `tts_out_${id}.mp3`);
  try {
    let buffer;
    if (Buffer.isBuffer(audioInput)) {
      buffer = audioInput;
    } else if (typeof audioInput === "string" && audioInput.startsWith("http")) {
      const res = await axios.get(audioInput, {
        responseType: "arraybuffer",
        timeout: 2e4
      });
      buffer = Buffer.from(res.data);
    } else {
      throw new Error("Input audio tidak valid.");
    }
    await fs.writeFile(inputPath, buffer);
    try {
      await execAsync(`ffmpeg -y -i "${inputPath}" -vn -ar 24000 -ac 1 -b:a 32k -f mp3 "${outputPath}"`);
      const compressedBuffer = await fs.readFile(outputPath);
      return `data:audio/mp3;base64,${compressedBuffer.toString("base64")}`;
    } catch {
      return `data:audio/mp3;base64,${buffer.toString("base64")}`;
    }
  } finally {
    await fs.unlink(inputPath).catch(() => {});
    await fs.unlink(outputPath).catch(() => {});
  }
}

function generatePlayerHTML({
  title,
  voiceName,
  text,
  audioBase64,
  isAnime,
  lang
}) {
  const safeText = String(text || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-tap-highlight-color: transparent;
      user-select: none;
    }
    body {
      background: radial-gradient(circle at 50% 0%, #1e1b4b 0%, #09090b 70%);
      font-family: 'Plus Jakarta Sans', sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      color: #f8fafc;
      overflow-x: hidden;
    }
    .player-card {
      background: rgba(255, 255, 255, 0.03);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 28px;
      width: 100%;
      max-width: 440px;
      padding: 28px 24px;
      box-shadow: 0 30px 60px -12px rgba(0, 0, 0, 0.7), 0 0 40px -10px rgba(99, 102, 241, 0.15);
      position: relative;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 24px;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      background: rgba(99, 102, 241, 0.12);
      border: 1px solid rgba(99, 102, 241, 0.3);
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #818cf8;
    }
    .pulse-dot {
      width: 6px;
      height: 6px;
      background: #818cf8;
      border-radius: 50%;
      box-shadow: 0 0 10px #818cf8;
      animation: pulse 1.8s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.8); }
    }
    .mode-tag {
      font-size: 11px;
      color: #94a3b8;
      font-weight: 500;
    }
    .visualizer-container {
      height: 70px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      margin: 10px 0 24px 0;
    }
    .bar {
      width: 4px;
      height: 8px;
      border-radius: 99px;
      background: linear-gradient(180deg, #818cf8 0%, #c084fc 100%);
      transition: height 0.1s ease;
      transform-origin: bottom;
    }
    .playing .bar {
      animation: wave 1.2s ease-in-out infinite alternate;
    }
    @keyframes wave {
      0% { height: 8px; }
      50% { height: 46px; }
      100% { height: 14px; }
    }
    .bar:nth-child(2) { animation-delay: 0.1s; }
    .bar:nth-child(3) { animation-delay: 0.25s; }
    .bar:nth-child(4) { animation-delay: 0.4s; }
    .bar:nth-child(5) { animation-delay: 0.15s; }
    .bar:nth-child(6) { animation-delay: 0.35s; }
    .bar:nth-child(7) { animation-delay: 0.5s; }
    .bar:nth-child(8) { animation-delay: 0.2s; }
    .bar:nth-child(9) { animation-delay: 0.3s; }
    .bar:nth-child(10) { animation-delay: 0.45s; }

    .track-meta {
      text-align: center;
      margin-bottom: 20px;
    }
    .track-meta h2 {
      font-size: 20px;
      font-weight: 800;
      color: #fff;
      letter-spacing: -0.02em;
    }
    .track-meta p {
      font-size: 13px;
      color: #a1a1aa;
      margin-top: 4px;
    }
    .text-box {
      background: rgba(0, 0, 0, 0.35);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 16px;
      padding: 14px 16px;
      font-size: 13.5px;
      line-height: 1.6;
      color: #e4e4e7;
      max-height: 110px;
      overflow-y: auto;
      margin-bottom: 24px;
      text-align: center;
      font-weight: 400;
    }
    .text-box::-webkit-scrollbar {
      width: 4px;
    }
    .text-box::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.15);
      border-radius: 4px;
    }
    .timeline {
      width: 100%;
      margin-bottom: 8px;
    }
    .progress-bar {
      width: 100%;
      height: 6px;
      background: rgba(255, 255, 255, 0.08);
      border-radius: 99px;
      cursor: pointer;
      position: relative;
      overflow: hidden;
    }
    .progress-fill {
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 0%;
      background: linear-gradient(90deg, #6366f1, #a855f7);
      border-radius: 99px;
      transition: width 0.1s linear;
    }
    .time-info {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      font-family: 'JetBrains Mono', monospace;
      color: #71717a;
      margin-bottom: 20px;
      font-weight: 500;
    }
    .controls {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 20px;
    }
    .btn {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.08);
      color: #e4e4e7;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .btn:active {
      transform: scale(0.92);
    }
    .play-btn {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      border: none;
      box-shadow: 0 10px 25px -4px rgba(99, 102, 241, 0.5);
      color: #ffffff;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .play-btn:active {
      transform: scale(0.94);
    }
    .play-btn svg {
      width: 26px;
      height: 26px;
      fill: currentColor;
    }
    .autoplay-banner {
      display: none;
      margin-top: 18px;
      font-size: 11px;
      text-align: center;
      color: #a1a1aa;
    }
  </style>
</head>
<body>
  <div class="player-card">
    <div class="header">
      <div class="badge">
        <span class="pulse-dot"></span>
        <span>${isAnime ? "Anime Character" : "Standard Voice"}</span>
      </div>
      <div class="mode-tag">${lang.toUpperCase()}</div>
    </div>

    <div class="visualizer-container" id="visualizer">
      <div class="bar"></div>
      <div class="bar"></div>
      <div class="bar"></div>
      <div class="bar"></div>
      <div class="bar"></div>
      <div class="bar"></div>
      <div class="bar"></div>
      <div class="bar"></div>
      <div class="bar"></div>
      <div class="bar"></div>
    </div>

    <div class="track-meta">
      <h2>${voiceName}</h2>
      <p>AnyToSpeech AI Audio Engine</p>
    </div>

    <div class="text-box">
      "${safeText}"
    </div>

    <div class="timeline">
      <div class="progress-bar" id="progressBar">
        <div class="progress-fill" id="progressFill"></div>
      </div>
    </div>
    <div class="time-info">
      <span id="currentTime">00:00</span>
      <span id="duration">00:00</span>
    </div>

    <div class="controls">
      <button class="btn" id="rewindBtn" title="-5 Detik">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="11 19 2 12 11 5 11 19"></polygon>
          <polygon points="22 19 13 12 22 5 22 19"></polygon>
        </svg>
      </button>

      <button class="play-btn" id="playBtn">
        <svg id="playIcon" viewBox="0 0 24 24">
          <polygon points="5 3 19 12 5 21 5 3"></polygon>
        </svg>
      </button>

      <button class="btn" id="replayBtn" title="Replay">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
        </svg>
      </button>
    </div>

    <div class="autoplay-banner" id="bannerNotice">
      Ketuk tombol Play jika browser memblokir auto-play audio.
    </div>

    <audio id="audioEl" preload="auto" src="${audioBase64}"></audio>
  </div>

  <script>
    const audio = document.getElementById('audioEl');
    const playBtn = document.getElementById('playBtn');
    const playIcon = document.getElementById('playIcon');
    const visualizer = document.getElementById('visualizer');
    const progressFill = document.getElementById('progressFill');
    const progressBar = document.getElementById('progressBar');
    const currentTimeEl = document.getElementById('currentTime');
    const durationEl = document.getElementById('duration');
    const rewindBtn = document.getElementById('rewindBtn');
    const replayBtn = document.getElementById('replayBtn');
    const bannerNotice = document.getElementById('bannerNotice');

    function fmt(s) {
      if (isNaN(s)) return '00:00';
      const m = Math.floor(s / 60);
      const sec = Math.floor(s % 60);
      return (m < 10 ? '0' + m : m) + ':' + (sec < 10 ? '0' + sec : sec);
    }

    function togglePlay() {
      if (audio.paused) {
        audio.play().then(() => {
          bannerNotice.style.display = 'none';
        }).catch(() => {
          bannerNotice.style.display = 'block';
        });
      } else {
        audio.pause();
      }
    }

    playBtn.addEventListener('click', togglePlay);

    audio.addEventListener('play', () => {
      visualizer.classList.add('playing');
      playIcon.innerHTML = '<rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect>';
    });

    audio.addEventListener('pause', () => {
      visualizer.classList.remove('playing');
      playIcon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"></polygon>';
    });

    audio.addEventListener('timeupdate', () => {
      const pct = (audio.currentTime / audio.duration) * 100 || 0;
      progressFill.style.width = pct + '%';
      currentTimeEl.textContent = fmt(audio.currentTime);
    });

    audio.addEventListener('loadedmetadata', () => {
      durationEl.textContent = fmt(audio.duration);
    });

    audio.addEventListener('ended', () => {
      visualizer.classList.remove('playing');
      progressFill.style.width = '0%';
      playIcon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"></polygon>';
    });

    progressBar.addEventListener('click', (e) => {
      const rect = progressBar.getBoundingClientRect();
      const pos = (e.clientX - rect.left) / rect.width;
      audio.currentTime = pos * audio.duration;
    });

    rewindBtn.addEventListener('click', () => {
      audio.currentTime = Math.max(0, audio.currentTime - 5);
    });

    replayBtn.addEventListener('click', () => {
      audio.currentTime = 0;
      audio.play();
    });

    // Coba Auto Play saat DOM siap
    window.addEventListener('DOMContentLoaded', () => {
      const promise = audio.play();
      if (promise !== undefined) {
        promise.then(() => {
          bannerNotice.style.display = 'none';
        }).catch(() => {
          bannerNotice.style.display = 'block';
        });
      }
    });
  </script>
</body>
</html>`;
}

function parseFlags(rawStr = "") {
  const flags = {};
  const flagRegex = /(?:--|-)([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(rawStr)) !== null) {
    let key = match[1].toLowerCase();
    let val = match[2] ? match[2].trim() : true;
    if (typeof val === "string" && (val.startsWith('"') || val.startsWith("'"))) {
      val = val.slice(1, -1);
    }
    const aliasMap = {
      voice: ["v", "model", "speaker"],
      anime: ["a", "chara"],
      lang: ["l", "bahasa"],
      vibe: ["tone", "emotion"]
    };
    for (const [realKey, aliases] of Object.entries(aliasMap)) {
      if (aliases.includes(key)) key = realKey;
    }
    flags[key] = val;
  }
  const cleanText = rawStr.replace(/(?:--|-)([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g, "").trim();
  return {
    flags: flags,
    cleanText: cleanText
  };
}
export default {
  name: "ttsrich",
  aliases: ["richaudio", "ttsvoice", "playerai", "ttsplayer"],
  description: "Text-to-Speech interaktif dengan Rich HTML Audio Player & Auto-Play (Base64 Compressed)",
  category: "AI",
  limit: true,
  example: 'ttsrich Halo semuanya! Selamat malam --voice "Kore"\nttsrich Konnichiwa! --anime --voice "anime-girl"',
  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    const targetJid = ctx.chat || ctx.id;
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
    try {
      const senderId = ctx.sender || ctx.author || msg.key?.participant || msg.key?.remoteJid;
      let rawText = (ctx.query || "").trim();
      if (!rawText && ctx.quoted?.text) rawText = ctx.quoted.text.trim();
      const {
        flags,
        cleanText
      } = parseFlags(rawText);
      const textToSpeak = cleanText || flags.text;
      if (!textToSpeak) {
        return ctx.reply(`–  *T T S  R I C H  P L A Y E R*\n\n` + `┌  ◦  *Deskripsi* : Render suara TTS ke Rich UI Player realtime\n` + `│  ◦  *Fitur* : Base64 Auto-Play, Waveform, Timeline scrub\n` + `└  ◦  *Format* : \`${prefix}ttsrich <teks> [--voice <model>] [--anime]\`\n\n` + `*Contoh:* \`${prefix}ttsrich Halo dunia! Selamat datang di WhatsApp Web interaktif.\``);
      }
      if (textToSpeak.length > 450) {
        return ctx.reply("❌ Panjang teks maksimal adalah 450 karakter agar performa player tetap optimal.");
      }
      await ctx.react("⏳");
      const userSession = global.db?.anyToSpeech?.[senderId];
      const isAnime = flags.anime !== undefined ? flags.anime === true || String(flags.anime) === "true" : Boolean(userSession?.anime);
      const selectedVoice = flags.voice || userSession?.voice || (isAnime ? CONFIG.DEFAULT_ANIME_VOICE : CONFIG.DEFAULT_VOICE);
      const selectedLang = flags.lang || userSession?.lang || CONFIG.DEFAULT_LANG;
      const response = await axios.post(CONFIG.API_URL, {
        action: "create",
        text: textToSpeak,
        anime: isAnime,
        voice: String(selectedVoice),
        slug: String(selectedVoice),
        lang: selectedLang,
        vibe: flags.vibe || "none",
        provider: "gemini"
      }, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": CONFIG.USER_AGENT
        },
        timeout: CONFIG.TIMEOUT
      });
      const audioUrl = response.data?.result?.audio_url;
      if (!audioUrl) {
        throw new Error(response.data?.message || "Server tidak mengembalikan URL audio.");
      }
      const compressedBase64 = await compressAudioToBase64(audioUrl);
      const htmlPayload = generatePlayerHTML({
        title: `🎙️ Voice: ${selectedVoice}`,
        voiceName: selectedVoice,
        text: textToSpeak,
        audioBase64: compressedBase64,
        isAnime: isAnime,
        lang: selectedLang
      });
      await ctx.react("🎵");
      if (typeof sock.airich === "function") {
        return await sock.airich().setTitle(`🎙️ ${selectedVoice} - Voice Player`).addHtml(htmlPayload).send(targetJid);
      } else if (typeof ctx.sendRich === "function") {
        return await ctx.sendRich({
          title: `🎙️ ${selectedVoice} - Voice Player`,
          html: htmlPayload,
          quoted: quotedMsg
        });
      } else {
        await sock.sendMessage(targetJid, {
          audio: {
            url: audioUrl
          },
          mimetype: "audio/mp4",
          ptt: true
        }, {
          quoted: quotedMsg
        });
        return ctx.reply(`–  *T T S  R I C H*\n\n` + `┌  ◦  *Voice* : ${selectedVoice}\n` + `│  ◦  *Mode* : ${isAnime ? "Anime" : "Standard"}\n` + `└  ◦  *Audio* : Dikirim via VN biasa (fitur airich/browser interaktif tidak aktif).`);
      }
    } catch (error) {
      console.error("[TTSRich Error]:", error);
      await ctx.react("❌");
      const err = error.response?.data?.message || error.message || "Gagal memproses audio player.";
      return ctx.reply(`❌ *Gagal memuat TTS Rich:* ${err}`);
    }
  }
};