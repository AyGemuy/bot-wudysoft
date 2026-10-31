import {
  spawn
} from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import axios from "axios";
import db from "../../data/db.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const CONFIG = {
  API_URL: `${global.bot?.api?.wudysoft}/api/misc/tts/v54`,
  DEFAULT_VOICE: "Kore",
  DEFAULT_ANIME_VOICE: "anime-girl",
  DEFAULT_LANG: "english",
  TIMEOUT: 6e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ...",
  FFMPEG_BITRATE: "12k",
  FFMPEG_SAMPLE_RATE: 16e3,
  FFMPEG_APP: "voip",
  FFMPEG_FRAME_MS: 60
};

function initDB(jid = null, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.anyToSpeech) global.db.anyToSpeech = {};
  if (jid && !global.db.user[jid]) {
    global.db.user[jid] = {
      name: name || "",
      money: 1e4,
      exp: 0
    };
  }
}

function saveDB() {
  if (typeof db?.write === "function" && global.db) db.write(global.db);
}

function parseFlags(rawStr = "") {
  const flags = {};
  const flagRegex = /--([a-zA-Z0-9_-]+)(?:\s+("[^"]*"|'[^']*'|[^\s--]+))?/g;
  let match;
  while ((match = flagRegex.exec(rawStr)) !== null) {
    const key = match[1].toLowerCase();
    let val = match[2] ? match[2].trim() : true;
    if (typeof val === "string" && (val.startsWith('"') || val.startsWith("'"))) {
      val = val.slice(1, -1);
    }
    flags[key] = val;
  }
  const cleanText = rawStr.replace(/--([a-zA-Z0-9_-]+)(?:\s+("[^"]*"|'[^']*'|[^\s--]+))?/g, "").trim();
  return {
    flags: flags,
    cleanText: cleanText
  };
}
async function requestTTS(payload) {
  const res = await axios.post(CONFIG.API_URL, payload, {
    headers: {
      "Content-Type": "application/json",
      "User-Agent": CONFIG.USER_AGENT
    },
    timeout: CONFIG.TIMEOUT
  });
  const data = res.data;
  if (!data?.status) {
    throw new Error(data?.error || data?.message || "Response status false");
  }
  return data;
}

function ffmpegConvert(inputPath, outputPath, opts = {}) {
  const bitrate = opts.bitrate || CONFIG.FFMPEG_BITRATE;
  const sampleRate = opts.sampleRate || CONFIG.FFMPEG_SAMPLE_RATE;
  const app = opts.application || CONFIG.FFMPEG_APP;
  const frameMs = opts.frameMs || CONFIG.FFMPEG_FRAME_MS;
  return new Promise((resolve, reject) => {
    const args = ["-y", "-i", inputPath, "-vn", "-ac", "1", "-ar", String(sampleRate), "-c:a", "libopus", "-b:a", bitrate, "-vbr", "on", "-application", app, "-frame_duration", String(frameMs), "-compression_level", "10", "-f", "webm", "-fflags", "+bitexact", "-flags:a", "+bitexact", outputPath];
    const proc = spawn("ffmpeg", args, {
      stdio: ["ignore", "ignore", "pipe"]
    });
    let stderr = "";
    proc.stderr.on("data", d => stderr += d.toString());
    proc.on("error", reject);
    proc.on("close", code => {
      if (code === 0) resolve(outputPath);
      else reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(-300)}`));
    });
  });
}

function generateVisualizerHTML({
  audioBase64,
  title,
  subtitle,
  accent = "#1ed760"
}) {
  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:100%;height:100%;overflow:hidden;
    font-family:'SF Pro Display','Inter',-apple-system,sans-serif;
    background:radial-gradient(circle at 20% 20%,#0b1220 0%,#050810 50%,#000 100%);
    color:#fff}
  .stage{position:relative;width:100%;height:100vh;
    display:flex;align-items:center;justify-content:center;padding:20px}

  /* ---- Liquid blobs ---- */
  .blob{position:absolute;border-radius:50%;filter:blur(60px);
    opacity:.55;pointer-events:none;mix-blend-mode:screen}
  .blob-1{width:320px;height:320px;background:${accent};top:-90px;left:-90px;
    animation:float1 14s ease-in-out infinite}
  .blob-2{width:280px;height:280px;background:#3b82f6;bottom:-110px;right:-90px;
    animation:float2 16s ease-in-out infinite}
  .blob-3{width:220px;height:220px;background:#a855f7;top:45%;left:60%;
    animation:float3 18s ease-in-out infinite}
  @keyframes float1{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(60px,40px) scale(1.15)}}
  @keyframes float2{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-40px,-50px) scale(1.2)}}
  @keyframes float3{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-60px,30px) scale(1.1)}}

  /* ---- Glassmorphism card ---- */
  .glass{position:relative;width:100%;max-width:420px;
    padding:32px 28px 28px;border-radius:32px;
    background:rgba(255,255,255,0.06);
    backdrop-filter:blur(30px) saturate(180%);
    -webkit-backdrop-filter:blur(30px) saturate(180%);
    border:1px solid rgba(255,255,255,0.12);
    box-shadow:0 20px 60px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.15);
    overflow:hidden;z-index:10}
  .glass::before{content:'';position:absolute;inset:0;border-radius:32px;
    background:linear-gradient(135deg,rgba(255,255,255,.12) 0%,transparent 40%,transparent 60%,rgba(255,255,255,.05) 100%);
    pointer-events:none}

  /* ---- Header ---- */
  .header{display:flex;align-items:center;gap:12px;margin-bottom:22px;position:relative}
  .mic-icon{width:48px;height:48px;border-radius:16px;
    background:linear-gradient(135deg,${accent},#0ea5e9);
    display:flex;align-items:center;justify-content:center;
    box-shadow:0 8px 24px ${accent}55;
    animation:pulse 2s ease-in-out infinite}
  .mic-icon svg{width:22px;height:22px;fill:#000}
  @keyframes pulse{
    0%,100%{transform:scale(1);box-shadow:0 8px 24px ${accent}55}
    50%{transform:scale(1.05);box-shadow:0 8px 40px ${accent}88}}
  .meta .label{font-size:11px;letter-spacing:2px;color:rgba(255,255,255,.55);
    text-transform:uppercase;font-weight:600}
  .meta .name{font-size:16px;font-weight:700;margin-top:2px}
  .meta .sub{font-size:12px;color:rgba(255,255,255,.6);margin-top:2px}

  /* ---- Visualizer ---- */
  .viz-container{position:relative;width:100%;height:160px;
    display:flex;align-items:center;justify-content:center;margin:12px 0 18px}
  .viz-bars{display:flex;align-items:center;justify-content:center;
    gap:4px;width:100%;height:100%}
  .bar{width:6px;border-radius:6px;
    background:linear-gradient(180deg,${accent} 0%,#0ea5e9 50%,#a855f7 100%);
    height:8px;transition:height .08s ease-out;
    box-shadow:0 0 12px ${accent}66}
  .orb-wrap{position:absolute;top:50%;left:50%;
    transform:translate(-50%,-50%);pointer-events:none;z-index:5}
  .orb{width:70px;height:70px;border-radius:50%;
    background:radial-gradient(circle at 30% 30%,#fff,${accent} 30%,#0ea5e9 70%,#1a1a1a);
    box-shadow:0 0 60px ${accent},inset -8px -8px 20px rgba(0,0,0,.6);
    animation:orbFloat 3s ease-in-out infinite;opacity:.9}
  @keyframes orbFloat{
    0%,100%{transform:translateY(0) scale(1)}
    50%{transform:translateY(-6px) scale(1.06)}}

  /* ---- Controls ---- */
  .controls{display:flex;align-items:center;gap:14px;position:relative}
  .btn-play{width:56px;height:56px;border-radius:50%;background:#fff;
    border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;
    box-shadow:0 8px 24px rgba(255,255,255,.3);
    transition:transform .15s;flex-shrink:0}
  .btn-play:hover{transform:scale(1.08)}
  .btn-play:active{transform:scale(.95)}
  .btn-play svg{width:22px;height:22px;fill:#000;margin-left:2px}
  .btn-play.playing .play-icon{display:none}
  .btn-play:not(.playing) .pause-icon{display:none}
  .btn-play:not(.playing) svg{margin-left:2px}
  .btn-play.playing svg{margin-left:0}
  .progress-wrap{flex:1;height:6px;background:rgba(255,255,255,.15);
    border-radius:3px;position:relative;cursor:pointer;overflow:hidden}
  .progress-fill{height:100%;width:0%;border-radius:3px;
    background:linear-gradient(90deg,${accent},#0ea5e9);
    transition:width .1s linear}
  .time{font-size:11px;color:rgba(255,255,255,.6);
    font-variant-numeric:tabular-nums;min-width:36px;text-align:right}
  audio{display:none}
</style>
</head>
<body>
<div class="stage">
  <div class="blob blob-1"></div>
  <div class="blob blob-2"></div>
  <div class="blob blob-3"></div>

  <div class="glass">
    <div class="header">
      <div class="mic-icon">
        <svg viewBox="0 0 24 24"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z"/></svg>
      </div>
      <div class="meta">
        <div class="label">AI Voice · TTS Rich</div>
        <div class="name">${title}</div>
        <div class="sub">${subtitle}</div>
      </div>
    </div>

    <div class="viz-container">
      <div class="viz-bars" id="bars"></div>
      <div class="orb-wrap"><div class="orb" id="orb"></div></div>
    </div>

    <div class="controls">
      <button class="btn-play" id="playBtn">
        <svg class="play-icon" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
        <svg class="pause-icon" viewBox="0 0 24 24"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>
      </button>
      <div class="progress-wrap" id="progressWrap">
        <div class="progress-fill" id="progressFill"></div>
      </div>
      <span class="time" id="time">0:00</span>
    </div>
  </div>

  <audio id="audio" preload="auto"></audio>
</div>

<script>
(() => {
  const BARS = 40;
  const barsEl   = document.getElementById('bars');
  const orbEl    = document.getElementById('orb');
  const audioEl  = document.getElementById('audio');
  const playBtn  = document.getElementById('playBtn');
  const progWrap = document.getElementById('progressWrap');
  const progFill = document.getElementById('progressFill');
  const timeEl   = document.getElementById('time');

  // Render waveform bars
  const bars = [];
  for (let i = 0; i < BARS; i++) {
    const b = document.createElement('div');
    b.className = 'bar';
    barsEl.appendChild(b);
    bars.push(b);
  }

  // Inject audio as data URI (opus/webm)
  audioEl.src = "data:audio/webm;codecs=opus;base64,${audioBase64}";

  let audioCtx, analyser, dataArray, source, rafId = null;

  function setupAudioGraph() {
    if (audioCtx) return;
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.8;
      source = audioCtx.createMediaElementSource(audioEl);
      source.connect(analyser);
      analyser.connect(audioCtx.destination);
      dataArray = new Uint8Array(analyser.frequencyBinCount);
    } catch (e) {
      // Fallback: WebAudio blocked → bar animasi idle
      console.warn('WebAudio unavailable:', e);
    }
  }

  function animate() {
    rafId = requestAnimationFrame(animate);
    if (!analyser) {
      // Idle animation if analyser unavailable
      const t = Date.now() / 300;
      bars.forEach((b, i) => {
        b.style.height = (12 + Math.sin(t + i * 0.4) * 8 + 8) + 'px';
      });
      return;
    }
    analyser.getByteFrequencyData(dataArray);
    const step = Math.floor(dataArray.length / BARS) || 1;
    for (let i = 0; i < BARS; i++) {
      const v = dataArray[i * step] || 0;
      bars[i].style.height = Math.max(8, (v / 255) * 140) + 'px';
    }
    const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
    orbEl.style.transform = \`translateY(\${-avg / 40}px) scale(\${1 + avg / 500})\`;
  }

  function stopAnim() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    bars.forEach(b => b.style.height = '8px');
    orbEl.style.transform = '';
  }

  function fmtTime(s) {
    if (!isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return m + ':' + sec.toString().padStart(2, '0');
  }

  playBtn.addEventListener('click', async () => {
    setupAudioGraph();
    if (audioCtx && audioCtx.state === 'suspended') {
      try { await audioCtx.resume(); } catch {}
    }
    if (audioEl.paused) {
      try { await audioEl.play(); } catch (e) { console.warn(e); }
      playBtn.classList.add('playing');
      animate();
    } else {
      audioEl.pause();
      playBtn.classList.remove('playing');
      stopAnim();
    }
  });

  audioEl.addEventListener('timeupdate', () => {
    const pct = audioEl.duration ? (audioEl.currentTime / audioEl.duration) * 100 : 0;
    progFill.style.width = pct + '%';
    timeEl.textContent = fmtTime(audioEl.currentTime);
  });

  audioEl.addEventListener('ended', () => {
    playBtn.classList.remove('playing');
    progFill.style.width = '100%';
    stopAnim();
  });

  progWrap.addEventListener('click', (e) => {
    const rect = progWrap.getBoundingClientRect();
    const pct = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    if (audioEl.duration) audioEl.currentTime = pct * audioEl.duration;
  });
})();
</script>
</body>
</html>`;
}
export default {
  name: "ttsrich",
  aliases: ["richspeech", "ttshtml", "speechrich", "ttsvisual", "vtts"],
  description: "TTS AI dengan konversi ffmpeg + visualizer HTML glass liquid premium (audioplayer interaktif).",
  category: "AI",
  limit: true,
  example: "ttsrich Halo semua, ini demo visualizer\n" + "ttsrich --anime Konnichiwa minna!\n" + "ttsrich --voice Kore --lang indonesian Selamat pagi",
  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "WudysoftBot";
    const footer = global.footer || global.bot?.footer || `_${botName}_`;
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
    const targetJid = ctx.chat || ctx.id;
    const stamp = Date.now();
    const inFile = path.join(os.tmpdir(), `ttsrich_${stamp}_in.bin`);
    const outFile = path.join(os.tmpdir(), `ttsrich_${stamp}_out.webm`);
    const cleanup = () => {
      try {
        fs.unlinkSync(inFile);
      } catch {}
      try {
        fs.unlinkSync(outFile);
      } catch {}
    };
    try {
      const senderId = ctx.sender || ctx.author || msg.key?.participant || msg.key?.remoteJid || ctx.id;
      initDB(senderId, ctx.pushName);
      let rawText = (ctx.query || "").trim();
      if (!rawText && ctx.quoted?.text) rawText = ctx.quoted.text.trim();
      const userSession = global.db.anyToSpeech[senderId] || null;
      const {
        flags,
        cleanText
      } = parseFlags(rawText);
      const isAnime = flags.anime !== undefined ? flags.anime === true || String(flags.anime) === "true" : userSession ? userSession.anime : false;
      const selectedVoice = flags.voice || flags.slug || userSession?.voice || (isAnime ? CONFIG.DEFAULT_ANIME_VOICE : CONFIG.DEFAULT_VOICE);
      const selectedLang = flags.lang || userSession?.lang || CONFIG.DEFAULT_LANG;
      const textToSpeak = cleanText || flags.text;
      if (!textToSpeak) {
        return ctx.reply(`– *T T S  R I C H*\n\n` + `┌ ◦ *Active Voice* : ${userSession?.name || selectedVoice}\n` + `│ ◦ *Mode* : ${isAnime ? "Anime" : "Standard"}\n` + `└ ◦ *Pipeline* : TTS v54 ➜ FFmpeg (opus mono 48k) ➜ HTML Glass Visualizer\n\n` + `– *U S A G E*\n\n` + `┌ ◦ ${prefix}ttsrich <teks>\n` + `│ ◦ ${prefix}ttsrich --anime <teks>\n` + `│ ◦ ${prefix}ttsrich --voice Kore <teks>\n` + `└ ◦ ${prefix}ttsrich --lang indonesian <teks>\n\n` + `_Hasil: rich HTML interaktif dengan waveform, seek bar & tombol play._\n\n` + `${footer}`);
      }
      if (textToSpeak.length > 500) {
        return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : Teks maksimal 500 karakter (saat ini ${textToSpeak.length}).\n\n${footer}`);
      }
      await ctx.react("⏳");
      const data = await requestTTS({
        action: "create",
        text: String(textToSpeak),
        anime: isAnime,
        voice: String(selectedVoice),
        slug: String(selectedVoice),
        lang: selectedLang,
        vibe: flags.vibe || userSession?.vibe || "none",
        provider: flags.provider || userSession?.provider || "gemini"
      });
      const audioUrl = data?.result?.audio_url;
      if (!audioUrl) throw new Error("Gagal mendapatkan URL audio dari API TTS.");
      await ctx.react("📥");
      const audioResp = await axios.get(audioUrl, {
        responseType: "arraybuffer",
        timeout: CONFIG.TIMEOUT,
        headers: {
          "User-Agent": CONFIG.USER_AGENT
        }
      });
      fs.writeFileSync(inFile, Buffer.from(audioResp.data));
      let ffPreset;
      if (flags.tiny) {
        ffPreset = {
          bitrate: "8k",
          sampleRate: 12e3,
          application: "voip",
          frameMs: 60
        };
      } else if (flags.hifi) {
        ffPreset = {
          bitrate: "32k",
          sampleRate: 48e3,
          application: "audio",
          frameMs: 60
        };
      } else {
        ffPreset = {};
      }
      await ctx.react("🎛️");
      await ffmpegConvert(inFile, outFile, ffPreset);
      const buf = fs.readFileSync(outFile);
      if (!buf.length) throw new Error("Hasil konversi ffmpeg kosong.");
      const base64 = buf.toString("base64");
      const sizeKb = (buf.length / 1024).toFixed(1);
      if (!global.db.anyToSpeech[senderId]) {
        global.db.anyToSpeech[senderId] = {
          voice: selectedVoice,
          name: flags.name || selectedVoice,
          anime: isAnime,
          lang: selectedLang,
          updatedAt: Date.now()
        };
      } else {
        global.db.anyToSpeech[senderId].voice = selectedVoice;
        global.db.anyToSpeech[senderId].updatedAt = Date.now();
      }
      saveDB();
      const displayName = flags.name || userSession?.name || selectedVoice;
      const subtitle = `${isAnime ? "Anime" : "Standard"} • ${selectedLang} • ${textToSpeak.length} chars • ${sizeKb}KB`;
      const html = generateVisualizerHTML({
        audioBase64: base64,
        title: displayName,
        subtitle: subtitle,
        accent: "#1ed760"
      });
      cleanup();
      await ctx.react("🎨");
      const richTitle = `🎙️ ${displayName}`;
      if (typeof ctx.sendRich === "function") {
        await ctx.sendRich({
          title: richTitle,
          html: html,
          quoted: quotedMsg
        });
      } else {
        await sock.sendMessage(targetJid, {
          document: Buffer.from(html, "utf-8"),
          mimetype: "text/html",
          fileName: `ttsrich_${stamp}.html`,
          caption: `🎙️ *${displayName}*\n` + `_${textToSpeak.slice(0, 120)}${textToSpeak.length > 120 ? "..." : ""}_`
        }, {
          quoted: quotedMsg
        });
      }
      await ctx.react("✅");
    } catch (error) {
      console.error("[TTSRich Error]:", error);
      cleanup();
      await ctx.react("❌");
      const errMsg = error.response?.data?.error || error.response?.data?.message || error.message || "Kesalahan internal.";
      ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : ${errMsg}\n` + `└ ◦ *Command* : ${ctx.command || "ttsrich"}\n\n${footer}`);
    }
  }
};