import axios from "axios";
import {
  randomUUID
} from "crypto";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = "https://api.silatech.site/api/downloader/download-youtube5";
const formatNumber = num => typeof num === "number" ? num.toLocaleString("id-ID") : num || "0";

function esc(v) {
  return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
async function fetchYouTube(targetUrl) {
  try {
    const res = await axios.get(API_URL, {
      params: {
        url: targetUrl
      },
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      },
      timeout: 45e3
    });
    if (res.data && res.data.status) {
      const result = res.data.result || res.data.data || res.data;
      return {
        success: true,
        result: {
          title: result.title || "YouTube Video",
          channel: result.channel || result.author || "YouTube",
          duration: result.duration || "-",
          thumbnail: result.thumbnail || result.thumb || "",
          audio: result.audio || result.audioUrl || result.mp3 || "",
          video: result.video || result.videoUrl || result.mp4 || "",
          quality: result.quality || "HD",
          views: result.views || "0",
          likes: result.likes || "0",
          description: result.description || ""
        }
      };
    }
  } catch (e) {
    console.error("[YouTube API Error]:", e?.message || e);
  }
  return {
    success: false,
    message: "Gagal mengambil data dari server YouTube."
  };
}

function buildPlayerHtml({
  title,
  channel,
  duration,
  audioUrl,
  thumbnail,
  quality,
  views
}) {
  return `<style>
    *{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
    :root{--a:#ff0000}
    body{background:transparent;font-family:system-ui,-apple-system,Arial,sans-serif;color:#fff}
    .p{max-width:430px;margin:auto;padding:14px}
    .card{background:rgba(16,17,21,.95);border:1px solid rgba(255,255,255,.1);border-radius:20px;padding:16px;box-shadow:0 12px 30px rgba(0,0,0,.6)}
    .top{display:flex;gap:12px;align-items:center}
    .cv{width:88px;height:88px;border-radius:12px;object-fit:cover;background:#222;flex-shrink:0}
    .tt{font-size:14px;font-weight:700;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
    .ar{font-size:12px;opacity:.6;margin-top:4px}
    .row{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap}
    .chip{font-size:10px;padding:3px 8px;border-radius:99px;background:rgba(255,255,255,.08);color:#fff;border:1px solid rgba(255,255,255,.05)}
    .ctl{display:flex;align-items:center;justify-content:center;gap:16px;margin-top:16px}
    .btn{width:54px;height:54px;border:0;border-radius:50%;background:var(--a);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;box-shadow:0 4px 16px rgba(255,0,0,.35)}
    .btn svg{width:24px;height:24px;fill:#fff}
    .skip{width:38px;height:38px;border:0;border-radius:50%;background:rgba(255,255,255,.1);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer}
    .skip svg{width:16px;height:16px;fill:#fff}
    .prog{width:100%;height:4px;-webkit-appearance:none;appearance:none;background:rgba(255,255,255,.15);border-radius:99px;margin-top:16px;cursor:pointer}
    .prog::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:12px;border-radius:50%;background:var(--a)}
    .times{display:flex;justify-content:space-between;font-size:10px;opacity:.55;margin-top:6px}
    .vol{display:flex;align-items:center;gap:8px;margin-top:12px}
    .vol input{flex:1;height:4px;-webkit-appearance:none;appearance:none;background:rgba(255,255,255,.15);border-radius:99px}
    .vol input::-webkit-slider-thumb{-webkit-appearance:none;width:10px;height:10px;border-radius:50%;background:var(--a)}
  </style>
  <body><div class="p"><div class="card"><div class="top">
    <img class="cv" src="${thumbnail || ""}" onerror="this.style.display='none'">
    <div>
      <div class="tt">${esc(title || "Unknown Video")}</div>
      <div class="ar">${esc(channel || "YouTube")}</div>
      <div class="row">
        ${quality ? `<span class="chip">◉ ${esc(quality)}</span>` : ""}
        ${views ? `<span class="chip">👁 ${esc(formatNumber(views))}</span>` : ""}
        ${duration ? `<span class="chip">⏱ ${esc(duration)}</span>` : ""}
      </div>
    </div>
  </div>
  <div class="ctl">
    <button class="skip" onclick="sk(-10)"><svg viewBox="0 0 24 24"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6 8.5 6V6l-8.5 6z"/></svg></button>
    <button class="btn" id="pp" onclick="tg()"><svg id="pi" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg><svg id="pu" style="display:none" viewBox="0 0 24 24"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg></button>
    <button class="skip" onclick="sk(10)"><svg viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM10 6v12l8.5-6L10 6z"/></svg></button>
  </div>
  <input class="prog" id="pr" type="range" min="0" max="100" value="0" step="0.1" oninput="sv(this.value)">
  <div class="times"><span id="ct">0:00</span><span id="dt">${esc(duration || "0:00")}</span></div>
  <div class="vol">
    <svg viewBox="0 0 24 24" width="14" height="14" fill="rgba(255,255,255,.6)"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>
    <input type="range" id="vo" min="0" max="1" step="0.01" value="1" oninput="a.volume=this.value">
  </div>
  </div></div>
  <audio id="a" preload="auto" src="${audioUrl}"></audio>
  <script>
    var a=document.getElementById("a"),pr=document.getElementById("pr"),ct=document.getElementById("ct"),dt=document.getElementById("dt"),pi=document.getElementById("pi"),pu=document.getElementById("pu");
    function fm(s){if(!isFinite(s))return"0:00";var m=Math.floor(s/60),x=Math.floor(s%60);return m+":"+(x<10?"0":"")+x}
    function up(){if(a.paused){pi.style.display="block";pu.style.display="none"}else{pi.style.display="none";pu.style.display="block"}}
    function tg(){a.paused?a.play():a.pause();up()}
    function sk(v){if(isFinite(a.duration))a.currentTime=Math.max(0,Math.min(a.duration,a.currentTime+v))}
    function sv(v){if(!isFinite(a.duration))return;a.currentTime=v/100*a.duration}
    a.addEventListener("loadedmetadata",function(){dt.textContent=fm(a.duration)});
    a.addEventListener("timeupdate",function(){if(!isFinite(a.duration))return;pr.value=a.currentTime/a.duration*100;ct.textContent=fm(a.currentTime)});
    a.addEventListener("play",up);a.addEventListener("pause",up);
    a.addEventListener("ended",function(){pr.value=0;ct.textContent="0:00";a.currentTime=0;up()});
    up();
  </script></body>`;
}

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /(?:^|\s)(?:--([a-zA-Z0-9_-]+)|-([a-zA-Z]))(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = (match[1] || match[2]).toLowerCase();
    let rawVal = match[3];
    let val = true;
    if (["url", "link", "u", "l"].includes(key)) key = "url";
    if (["audio", "mp3", "a", "sound", "music"].includes(key)) key = "audio";
    if (["video", "mp4", "v"].includes(key)) key = "video";
    if (["player", "p", "rich"].includes(key)) key = "player";
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
  const cleanPrompt = input.replace(flagRegex, "").replace(/\s+/g, " ").trim();
  return {
    flags: flags,
    cleanPrompt: cleanPrompt
  };
}
export default {
  name: "yttest",
  aliases: ["ytplay", "ytplayer", "ytmp3", "ytmp4", "youtubetest"],
  description: "Download audio/video YouTube lengkap dengan pemutar interaktif HTML player",
  category: "Downloader",
  limit: true,
  example: "yttest https://youtu.be/xxxxx",
  execute: async (sock, ctx, msg) => {
    try {
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      let rawText = (ctx.query || ctx.args?.join(" ") || "").trim();
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      const targetUrl = flags.url || cleanPrompt.match(/https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/[^\s]+/i)?.[0] || (cleanPrompt.includes("youtu") ? cleanPrompt : null);
      if (!targetUrl || !/(youtube\.com|youtu\.be)/i.test(targetUrl)) {
        return ctx.reply(`🎬 *YOUTUBE DOWNLOADER & HTML PLAYER*\n\n` + `• *Cara Penggunaan:*\n` + `  👉 Format Standar: \`${prefix}yttest <link_youtube>\`\n` + `  👉 Audio Saja: \`${prefix}yttest <link_youtube> --audio\`\n` + `  👉 Video Saja: \`${prefix}yttest <link_youtube> --video\`\n\n` + `• *Opsi Flags:*\n` + `  • \`--audio\` / \`-a\` (Kirim audio MP3 saja)\n` + `  • \`--video\` / \`-v\` (Kirim video MP4 saja)`);
      }
      await ctx.react("⏳");
      const result = await fetchYouTube(targetUrl);
      if (!result?.success) {
        throw new Error(result?.message || "Gagal mengambil data video dari YouTube.");
      }
      const d = result.result;
      const htmlPayload = buildPlayerHtml({
        title: d.title,
        channel: d.channel,
        duration: d.duration,
        audioUrl: d.audio,
        thumbnail: d.thumbnail,
        quality: d.quality,
        views: d.views
      });
      const fullHtml = `<!DOCTYPE html>\n${htmlPayload}`;
      await sock.relayMessage(ctx.chat, {
        messageContextInfo: {
          deviceListMetadata: {},
          deviceListMetadataVersion: 2,
          botMetadata: {
            messageDisclaimerText: `YouTube Media Player • ${d.channel}`
          }
        },
        botForwardedMessage: {
          message: {
            richResponseMessage: {
              messageType: 1,
              submessages: [{
                messageType: 2,
                messageText: `> ${d.title}`
              }],
              unifiedResponse: {
                data: Buffer.from(JSON.stringify({
                  response_id: randomUUID(),
                  sections: [{
                    view_model: {
                      primitive: {
                        __typename: "GenAIaeacdsnwHtmlPrimitive",
                        payload: fullHtml,
                        url: "https://www.youtube.com",
                        trusted_sources: ["youtube.com"]
                      },
                      __typename: "GenAISingleLayoutViewModel"
                    }
                  }]
                })).toString("base64")
              },
              contextInfo: {
                forwardingScore: 1,
                isForwarded: true,
                forwardedAiBotMessageInfo: {
                  botJid: "0@bot"
                },
                forwardOrigin: 4
              }
            }
          }
        }
      }, {}).catch(() => {});
      const onlyVideo = Boolean(flags.video);
      const onlyAudio = Boolean(flags.audio);
      if ((!onlyVideo || onlyAudio) && d.audio) {
        try {
          await sock.sendMessage(ctx.chat, {
            audio: {
              url: d.audio
            },
            mimetype: "audio/mpeg",
            fileName: `${d.title}.mp3`,
            ptt: false
          }, {
            quoted: quotedMsg
          });
        } catch (audioErr) {
          console.error("[YT AUDIO ERROR]:", audioErr.message);
        }
      }
      if ((!onlyAudio || onlyVideo) && d.video) {
        try {
          const caption = `🎬 *${d.title}*\n\n` + `• *Channel:* ${d.channel}\n` + `• *Durasi:* ${d.duration || "-"}\n` + `• *Kualitas:* ${d.quality}\n` + `• *Tayangan:* ${formatNumber(d.views)}`;
          await sock.sendMessage(ctx.chat, {
            video: {
              url: d.video
            },
            mimetype: "video/mp4",
            fileName: `${d.title}.mp4`,
            caption: caption
          }, {
            quoted: quotedMsg
          });
        } catch (videoErr) {
          console.error("[YT VIDEO ERROR]:", videoErr.message);
        }
      }
      await ctx.react("✅");
    } catch (error) {
      await ctx.react("❌");
      let errMsg = error.message;
      if (error.response?.data) {
        errMsg = error.response.data?.message || error.response.data?.error || errMsg;
      }
      ctx.reply(`❌ YouTube Error: ${errMsg}`);
    }
  }
};