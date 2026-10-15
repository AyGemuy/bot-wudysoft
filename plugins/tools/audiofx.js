import {
  ffmpeg
} from "../../lib/exif.js";
import {
  downloadMediaNode
} from "../../core/serialize.js";
global.audioFxSessions = global.audioFxSessions || new Map();
const FILTERS = {
  slowreverb: {
    title: "Slowed + Reverb",
    desc: "Tempo lambat santai dengan gema ruang luas",
    args: ["-vn", "-af", "asetrate=44100*0.85,aresample=44100,aecho=0.8:0.88:60:0.4", "-f", "mp3"]
  },
  eightd: {
    title: "8D Audio (Surround)",
    desc: "Efek suara berputar 360° (Gunakan Headset)",
    args: ["-vn", "-af", "apulsator=hz=0.125", "-f", "mp3"]
  },
  nightcore: {
    title: "Nightcore",
    desc: "Tempo cepat dengan nada vokal tinggi anime",
    args: ["-vn", "-af", "asetrate=44100*1.25,atempo=1.05", "-f", "mp3"]
  },
  bassboost: {
    title: "Extreme Bassboost",
    desc: "Meningkatkan dentuman bass secara maksimal",
    args: ["-vn", "-af", "equalizer=f=60:width_type=h:width=50:g=15,volume=1.3", "-f", "mp3"]
  },
  chipmunk: {
    title: "Chipmunk",
    desc: "Suara karakter tupai lucu berkecepatan tinggi",
    args: ["-vn", "-af", "asetrate=44100*1.45", "-f", "mp3"]
  },
  robot: {
    title: "Robot Synthesizer",
    desc: "Modulasi vokal robotik futuristik",
    args: ["-vn", "-af", "afftfilt=real='hypot(re,im)*sin(0)':imag='hypot(re,im)*cos(0)':win_size=512:overlap=0.75", "-f", "mp3"]
  },
  underwater: {
    title: "Under Water",
    desc: "Efek suara teredam di kedalaman air",
    args: ["-vn", "-af", "lowpass=f=450", "-f", "mp3"]
  },
  reverse: {
    title: "Reverse Audio",
    desc: "Memutar rekaman suara dari belakang ke depan",
    args: ["-vn", "-af", "areverse", "-f", "mp3"]
  },
  tovn: {
    title: "Konversi ke VN (PTT)",
    desc: "Ubah audio biasa menjadi Voice Note WhatsApp",
    args: ["-vn", "-c:a", "libopus", "-b:a", "128k", "-f", "opus"],
    isPtt: true
  }
};

function resolveAudioEffectKey(input = "") {
  if (!input || typeof input !== "string") return null;
  const clean = input.toLowerCase().trim();
  if (!clean || clean.length === 0) return null;
  if (FILTERS[clean]) return clean;
  for (const [key, val] of Object.entries(FILTERS)) {
    if (val.title.toLowerCase().includes(clean) || clean.includes(key)) {
      return key;
    }
  }
  if (clean.includes("slow") || clean.includes("reverb")) return "slowreverb";
  if (clean.includes("8d") || clean.includes("surround")) return "eightd";
  if (clean.includes("nightcore")) return "nightcore";
  if (clean.includes("bass") || clean.includes("boost")) return "bassboost";
  if (clean.includes("chipmunk") || clean.includes("alvin") || clean.includes("tupai")) return "chipmunk";
  if (clean.includes("robot")) return "robot";
  if (clean.includes("water") || clean.includes("air")) return "underwater";
  if (clean.includes("reverse") || clean.includes("mundur")) return "reverse";
  if (clean.includes("vn") || clean.includes("ptt") || clean.includes("voicenote")) return "tovn";
  return null;
}
export default {
  name: "audiofx",
  aliases: ["audiofx", "filteraudio", "vcedit"],
  description: "Audio Effect Studio & Voice Changer via Buffer FFmpeg Engine",
  category: "Media",
  execute: async (sock, ctx, msg, {
    args,
    prefix,
    query
  }) => {
    const botName = global.bot?.name || "WudysoftBot";
    const footer = global.footer || global.bot?.footer || `_${botName}_`;
    const sessionKey = `${ctx.chat}_${ctx.senderNumber || ctx.sender}`;
    const rawEffectInput = (args[0] || query || "").trim();
    let effectKey = resolveAudioEffectKey(rawEffectInput);
    let mediaTarget = null;
    let mime = "";
    const candidateNodes = [ctx.quoted?.msg || ctx.quoted, ctx.quoted?.quoted?.msg || ctx.quoted?.quoted, ctx.msg || ctx].filter(Boolean);
    for (const node of candidateNodes) {
      const candidateMime = node.mimetype || node.msg && node.msg.mimetype || "";
      if (/audio|video/.test(candidateMime)) {
        mediaTarget = node;
        mime = candidateMime;
        break;
      }
    }
    const cachedSession = global.audioFxSessions.get(sessionKey);
    const hasValidSession = cachedSession && Date.now() - cachedSession.time < 5 * 60 * 1e3;
    if (!mediaTarget && !hasValidSession) {
      const helpText = `– *A U D I O  F X*\n\n` + `┌ ◦ *Usage* : ${prefix}audiofx <filter>\n` + `│ ◦ *Quoted* : Balas audio/VN/video dengan ${prefix}audiofx\n` + `└ ◦ *Function* : Modifikasi suara dengan preset efek DSP & FFmpeg\n\n` + `– *E X A M P L E*\n\n` + `┌ ◦ *Menu* : Balas audio dengan ${prefix}audiofx\n` + `└ ◦ *Direct* : ${prefix}audiofx slowreverb (sambil balas audio)\n\n` + `${footer}`;
      return await ctx.reply(helpText);
    }
    if (!effectKey || !FILTERS[effectKey]) {
      await ctx.react("📥");
      const downloadedBuffer = await downloadMediaNode(mediaTarget);
      if (!downloadedBuffer) {
        await ctx.react("❌");
        return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Gagal mengunduh audio\n` + `└ ◦ *Info* : File media tidak dapat diproses dari WhatsApp.\n\n` + `${footer}`);
      }
      global.audioFxSessions.set(sessionKey, {
        buffer: downloadedBuffer,
        mime: mime,
        time: Date.now()
      });
      await ctx.react("🎚️");
      const rows = Object.entries(FILTERS).map(([key, val]) => ({
        title: val.title,
        description: val.desc,
        id: `${prefix}audiofx ${key}`
      }));
      const bodyText = `– *A U D I O  F X  -  S T U D I O*\n\n` + `┌ ◦ *Status* : Audio Berhasil Diunduh\n` + `│ ◦ *Format* : ${mime}\n` + `└ ◦ *Action* : Pilih preset efek suara pada tombol di bawah\n\n` + `${footer}`;
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: "PILIH EFEK SUARA",
          sections: [{
            title: "PRESET EFEK AUDIO",
            rows: rows
          }],
          has_multiple_buttons: true
        })
      }];
      if (typeof ctx.sendCta === "function") {
        return await ctx.sendCta(bodyText, `${botName} • DSP Studio`, buttons, {
          quoted: msg
        });
      }
      return await ctx.reply(bodyText);
    }
    await ctx.react("⏳");
    const selected = FILTERS[effectKey];
    const finalBuffer = hasValidSession ? cachedSession.buffer : await downloadMediaNode(mediaTarget);
    if (!finalBuffer) {
      await ctx.react("❌");
      return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Buffer audio kedaluwarsa\n` + `└ ◦ *Action* : Silakan balas ulang file audio dengan perintah.\n\n` + `${footer}`);
    }
    try {
      const outBuffer = await ffmpeg(finalBuffer, selected.args);
      await ctx.react("✅");
      await sock.sendMessage(ctx.id, {
        audio: outBuffer,
        mimetype: selected.isPtt ? "audio/ogg; codecs=opus" : "audio/mp4",
        ptt: Boolean(selected.isPtt)
      }, {
        quoted: msg
      });
      global.audioFxSessions.delete(sessionKey);
    } catch (err) {
      console.error("[FFMPEG AUDIO FX ERROR]:", err);
      await ctx.react("❌");
      ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : Gagal memproses efek audio pada media ini.\n` + `└ ◦ *Command* : ${ctx.command || "audiofx"}\n\n` + `${footer}`);
    }
  }
};