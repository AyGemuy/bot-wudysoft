import os from "os";
import path from "path";
import fs from "fs";
import * as Baileys from "@whiskeysockets/baileys";
const voipInstances = new WeakMap();
async function getVoip(sock) {
  let voip = voipInstances.get(sock);
  if (!voip) {
    const VoipClass = Baileys.Voip || Baileys.default?.Voip;
    if (!VoipClass) throw new Error("Class Baileys.Voip tidak tersedia!");
    voip = new VoipClass(sock, {
      voipLogLevel: "info"
    });
    voipInstances.set(sock, voip);
  }
  return voip;
}
const activeCalls = new Map();
const VIDEO_EXT_RE = /\.(mp4|mov|webm|mkv|avi|m4v|3gp)(\?|#|$)/i;
async function downloadQuotedMedia(quoted) {
  const mime = quoted?.mimetype || quoted?.msg?.mimetype || "";
  const kind = /^video/.test(mime) ? "video" : /^audio/.test(mime) ? "audio" : null;
  if (!kind) return null;
  const buffer = await quoted.download();
  if (!buffer) throw new Error(`Gagal mendownload ${kind} dari balasan pesan.`);
  const ext = kind === "video" ? ".mp4" : ".audio";
  const filePath = path.join(os.tmpdir(), `voip_${kind}_${Date.now()}${ext}`);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

function requireCall(chatId) {
  const entry = activeCalls.get(chatId);
  if (!entry) throw new Error("Tidak ada panggilan yang sedang berlangsung di chat ini.");
  return entry;
}
export default {
  name: "voipcall",
  aliases: ["call", "voip", "vcall", "voipend", "voipsilent", "voipreact"],
  description: "Melakukan Voice atau Video Call kustom ke target nomor WhatsApp.",
  category: "General",
  limit: true,
  execute: async (sock, ctx, msg) => {
    const voip = await getVoip(sock);
    const chatId = ctx.from || msg.key?.remoteJid;
    const command = (ctx.command || "").toLowerCase();
    const args = ctx.args || [];
    const usedPrefix = ctx.prefix || ".";
    if (command === "voipend") {
      await voip.end(args[0] === "force");
      activeCalls.delete(chatId);
      return ctx.reply(args[0] === "force" ? "✦ VOIP state force-reset." : "✦ Hangup requested...");
    }
    if (command === "voipreact") {
      const entry = requireCall(chatId);
      const emoji = args[0] || "👍";
      const sent = entry.call.react(emoji);
      return ctx.reply(sent ? `✦ Reaction ${emoji} sent.` : "✦ Failed to send reaction (call is not active yet).");
    }
    if (command === "voipsilent") {
      const entry = requireCall(chatId);
      const nowSilenced = await entry.call.silent();
      return ctx.reply(nowSilenced ? "✦ Muted mic and paused video." : "✦ Resumed.");
    }
    if (activeCalls.has(chatId)) {
      return ctx.reply("⚠️ Panggilan sudah berjalan di chat ini. Tunggu hingga selesai atau ketik `.voipend`.");
    }
    if (!args[0]) {
      return ctx.reply(`– *V O I P  C A L L*\n\n` + `*Penggunaan:*\n` + `\`${usedPrefix + command} <nomor_hp> [url_media ...] [240p|360p|480p|720p] [auto] [loop]\`\n\n` + `*Opsi tambahan:*\n` + `◦ Balas pesan audio/video untuk memutarnya saat menelpon.\n` + `◦ Cantumkan URL audio/video langsung di command.\n` + `◦ Tambahkan argumen \`auto\` agar otomatis mati saat media selesai.\n` + `◦ Tambahkan argumen \`loop\` agar memutar ulang media tanpa henti.\n\n` + `*Kontrol saat panggilan:*\n` + `\`${usedPrefix}voipsilent\` | \`${usedPrefix}voipreact <emoji>\` | \`${usedPrefix}voipend\``);
    }
    const phoneNumber = args[0].replace(/\D/g, "");
    if (!phoneNumber) return ctx.reply("❌ Nomor telepon tidak valid.");
    const RESOLUTION_RE = /^(240p|360p|480p|720p|1080p)$/i;
    const resolutionArg = args.find((a, i) => i > 0 && RESOLUTION_RE.test(a));
    const resolution = resolutionArg ? resolutionArg.toLowerCase() : undefined;
    const autoEndCall = args.some((a, i) => i > 0 && /^auto$/i.test(a));
    const loop = args.some((a, i) => i > 0 && /^loop$/i.test(a));
    const urls = args.filter((a, i) => i > 0 && /^https?:\/\//i.test(a));
    let media = [...urls];
    const tempFiles = [];
    if (ctx.quoted) {
      const quotedPath = await downloadQuotedMedia(ctx.quoted).catch(() => null);
      if (quotedPath) {
        tempFiles.push(quotedPath);
        media.unshift(quotedPath);
      }
    }
    const willBeVideo = media.some(src => src !== "silence" && VIDEO_EXT_RE.test(src));
    if (media.length === 0) media = "silence";
    else if (media.length === 1) media = media[0];
    const replyMsg = await ctx.reply(`✦ Calling ${phoneNumber}...${willBeVideo ? " (video)" : ""}\n(Gunakan \`${usedPrefix}voipend\` untuk menutup)`);
    const key = replyMsg?.key || msg.key;
    const cleanupTempFiles = () => {
      for (const f of tempFiles) {
        if (fs.existsSync(f)) fs.unlink(f, () => {});
      }
    };
    try {
      const call = await voip.call(phoneNumber, media, resolution, {
        autoEndCall: autoEndCall,
        loop: loop
      });
      activeCalls.set(chatId, {
        call: call,
        key: key,
        phoneNumber: phoneNumber
      });
      call.on("ringing", () => {
        sock.sendMessage(chatId, {
          text: `✦ Ringing ${phoneNumber}...`,
          edit: key
        });
      });
      call.on("connected", () => {
        sock.sendMessage(chatId, {
          text: `✦ Call connected! Use \`${usedPrefix}voipend\` to end.`,
          edit: key
        });
      });
      call.on("item", ({
        index,
        kind
      }) => {
        if (index === 0) return;
        sock.sendMessage(chatId, {
          text: `✦ Now playing item ${index + 1} (${kind}).`
        });
      });
      call.on("downgraded", () => {
        sock.sendMessage(chatId, {
          text: "✦ All cameras are off, downgraded to audio."
        });
      });
      call.on("ended", reason => {
        activeCalls.delete(chatId);
        const friendlyText = reason === "declined" ? `✦ Call to ${phoneNumber} was declined.` : `✦ Call ended for ${phoneNumber}: ${reason || "selesai"}`;
        sock.sendMessage(chatId, {
          text: friendlyText,
          edit: key
        });
        cleanupTempFiles();
      });
      call.on("error", err => {
        if (!voip.calls.includes(call)) {
          activeCalls.delete(chatId);
          cleanupTempFiles();
        }
        sock.sendMessage(chatId, {
          text: `Call error: ${err?.message || err}`
        });
      });
    } catch (e) {
      console.error("[ VOIP ] error:", e);
      activeCalls.delete(chatId);
      cleanupTempFiles();
      return ctx.reply(`❌ Failed to place call: ${e?.message || e}`);
    }
  }
};