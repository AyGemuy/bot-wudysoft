import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
import {
  sendPTT
} from "../../lib/audio.js";
import {
  upload
} from "../../lib/upload.js";
global.voicechangerSession = global.voicechangerSession || new Map();
const CONFIG = {
  API_URL: `${global.bot?.api?.wudysoft}/api/misc/voice-changer/v2`,
  TIMEOUT: 12e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
  ITEMS_PER_PAGE: 10
};

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
async function requestVoiceChanger(payload) {
  const res = await axios.post(CONFIG.API_URL, payload, {
    headers: {
      "Content-Type": "application/json",
      "User-Agent": CONFIG.USER_AGENT
    },
    timeout: CONFIG.TIMEOUT
  });
  const data = res.data;
  if (!data || data.status === "error" || data.status === false) {
    throw new Error(data?.error || data?.result?.error_message || "Response status false dari server.");
  }
  return data;
}
export default {
  name: "voicechanger",
  aliases: ["vc", "rvc", "changevoice", "voicetone"],
  description: "AI Voice Changer (RVC) dengan Session Management & CTA Search.",
  category: "AI",
  limit: true,
  example: "voicechanger --search trump\nreply audio lalu ketik: voicechanger\nvoicechanger --info\nvoicechanger --reset",
  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "WudysoftBot";
    const footer = global.footer || global.bot?.footer || `_${botName}_`;
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
    const targetJid = ctx.chat || ctx.id;
    const senderId = ctx.sender || ctx.author || msg.key?.participant || msg.key?.remoteJid || ctx.id;
    try {
      let rawText = (ctx.query || "").trim();
      const userSession = global.voicechangerSession.get(senderId) || null;
      const {
        flags,
        cleanText
      } = parseFlags(rawText);
      if (flags.reset || rawText === "--reset") {
        global.voicechangerSession.delete(senderId);
        return ctx.reply(`– *V O I C E  C H A N G E R*\n\n` + `┌ ◦ *Status* : Sesi model suara berhasil direset\n` + `└ ◦ *Action* : Ketik ${prefix}vc --search <nama> untuk mencari model baru.\n\n` + `${footer}`);
      }
      if (flags.info || flags.status || rawText === "--info") {
        if (!userSession?.voice) {
          return ctx.reply(`– *S T A T U S*\n\n` + `┌ ◦ *Status* : Belum ada model suara aktif\n` + `└ ◦ *Action* : Cari model suara dengan ${prefix}vc --search <nama>\n\n` + `${footer}`);
        }
        return ctx.reply(`– *S T A T U S*\n\n` + `┌ ◦ *User* : @${senderId.split("@")[0]}\n` + `│ ◦ *Model* : ${userSession.name || userSession.voice}\n` + `└ ◦ *Tone ID* : ${userSession.voice}\n\n` + `_Kirim atau balas audio dengan ${prefix}vc untuk mengubah suara._\n\n` + `${footer}`, {
          mentions: [senderId]
        });
      }
      if (flags.setvoice) {
        const voiceId = String(flags.setvoice);
        const voiceName = flags.name || `Tone ${voiceId}`;
        const newSession = {
          voice: voiceId,
          name: voiceName
        };
        global.voicechangerSession.set(senderId, newSession);
        await ctx.react("✅");
        return ctx.reply(`– *V O I C E  C H A N G E R*\n\n` + `┌ ◦ *Model* : ${newSession.name}\n` + `│ ◦ *Tone ID* : ${newSession.voice}\n` + `└ ◦ *Status* : Tersimpan ke sesi pengguna\n\n` + `_Kirim atau balas audio/VN dengan ${prefix}vc untuk mulai mengubah suara._\n\n` + `${footer}`);
      }
      if (flags.search || flags.query || flags.list || rawText.startsWith("--search") || rawText.startsWith("--list") || flags.page) {
        const page = Math.max(1, Number(flags.page) || 1);
        const searchQuery = flags.search || flags.query || !flags.page && cleanText || "";
        await ctx.react("⏳");
        const data = await requestVoiceChanger({
          action: "list",
          page: page
        });
        let allVoices = Array.isArray(data?.result?.voices) ? data.result.voices : [];
        if (!allVoices.length) {
          await ctx.react("❌");
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Data kosong\n` + `└ ◦ *Info* : Tidak ada data suara pada halaman ${page}.\n\n` + `${footer}`);
        }
        if (searchQuery) {
          const filterKeyword = String(searchQuery).toLowerCase();
          allVoices = allVoices.filter(v => v.tone_name && v.tone_name.toLowerCase().includes(filterKeyword) || v.tone_id && String(v.tone_id).includes(filterKeyword));
        }
        if (!allVoices.length) {
          await ctx.react("❌");
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Model suara tidak ditemukan\n` + `└ ◦ *Query* : "${searchQuery}" (Halaman ${page})\n\n` + `${footer}`);
        }
        const pageItems = allVoices.slice(0, CONFIG.ITEMS_PER_PAGE);
        const voiceRows = pageItems.map((item, i) => {
          const globalIdx = (page - 1) * CONFIG.ITEMS_PER_PAGE + i + 1;
          const toneName = item.tone_name || `Tone ${item.tone_id}`;
          return {
            title: `${globalIdx}. ${toneName}`.slice(0, 24),
            id: `${prefix}vc --setvoice "${item.tone_id}" --name "${toneName}"`,
            description: `ID: ${item.tone_id} | Author: ${item.author_name || "Community"}`.slice(0, 60)
          };
        });
        const baseCmd = searchQuery ? `${prefix}vc --search "${searchQuery}"` : `${prefix}vc --list`;
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: `PILIH MODEL SUARA (${pageItems.length})`,
            sections: [{
              title: `DAFTAR MODEL SUARA (Hal ${page})`,
              rows: voiceRows
            }]
          })
        }];
        if (page > 1) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: `⬅️ Hal ${page - 1}`,
              id: `${baseCmd} --page ${page - 1}`
            })
          });
        }
        if (allVoices.length >= CONFIG.ITEMS_PER_PAGE) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: `➡️ Hal ${page + 1}`,
              id: `${baseCmd} --page ${page + 1}`
            })
          });
        }
        const bodyText = `– *V O I C E  C H A N G E R  -  L I B R A R Y*\n\n` + `┌ ◦ *Query* : "${searchQuery || "Semua"}"\n` + `│ ◦ *Total* : ${allVoices.length} Model\n` + `│ ◦ *Page* : ${page}\n` + `└ ◦ *Engine* : AI Voice Changer (RVC)\n\n` + `_Pilih model suara pada tombol di bawah:_\n\n` + `${footer}`;
        const options = {
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 1,
              divider_indices: [1],
              list_title: `${botName} • Voice Library`,
              button_title: `Buka Hal ${page}`
            }
          },
          quoted: quotedMsg
        };
        if (typeof ctx.sendCta === "function") {
          await ctx.sendCta(bodyText, `${botName} • Voice Changer`, buttons, options);
        } else {
          let fallback = `${bodyText}\n\n`;
          fallback += voiceRows.map(r => `• *${r.title}*\n  Pilih: \`${r.id}\``).join("\n\n");
          if (page > 1 || allVoices.length >= CONFIG.ITEMS_PER_PAGE) {
            fallback += `\n\n_Pindah Halaman: Ketik \`${baseCmd} --page ${page + 1}\`_`;
          }
          await ctx.reply(fallback);
        }
        await ctx.react("✅");
        return;
      }
      const selectedVoice = flags.voice || flags.tone_id || flags.voice_id || userSession?.voice;
      if (!selectedVoice) {
        const helpText = `– *V O I C E  C H A N G E R*\n\n` + `┌ ◦ *Status* : Model suara belum dipilih\n` + `│ ◦ *Usage* : ${prefix}vc --search <nama>\n` + `└ ◦ *Direct* : Balas audio dengan ${prefix}vc --voice <tone_id>\n\n` + `– *E X A M P L E*\n\n` + `└ ◦ ${prefix}vc --search minions\n\n` + `${footer}`;
        return ctx.reply(helpText);
      }
      const mime = (ctx.mimetype || ctx.quoted?.mimetype || "").toLowerCase();
      const mediaType = (ctx.mediaType || ctx.quoted?.mediaType || "").toLowerCase();
      const isAudio = /audio|ogg|mp3|opus|m4a|video/i.test(mime) || /audio|video|voice/i.test(mediaType);
      if (!isAudio) {
        return ctx.reply(`– *V O I C E  C H A N G E R*\n\n` + `┌ ◦ *Tone ID* : ${selectedVoice}\n` + `└ ◦ *Action* : Balas atau kirim audio/VN yang ingin diubah suaranya.\n\n` + `${footer}`);
      }
      await ctx.react("⏳");
      const downloadFn = ctx.quoted?.download || ctx.download;
      const buffer = typeof downloadFn === "function" ? await downloadFn.call(ctx.quoted || ctx) : null;
      if (!buffer || !Buffer.isBuffer(buffer)) {
        await ctx.react("❌");
        return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Gagal mengunduh audio\n` + `└ ◦ *Info* : Berkas media tidak dapat diproses dari WhatsApp.\n\n` + `${footer}`);
      }
      const uploadRes = await upload(buffer);
      if (!uploadRes?.status || !uploadRes?.url) {
        await ctx.react("❌");
        return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Gagal mengunggah media audio\n` + `└ ◦ *Info* : ${uploadRes?.message || "Upload error"}\n\n` + `${footer}`);
      }
      const audioUrl = uploadRes.url;
      const payload = {
        action: "generate",
        voice: String(selectedVoice),
        audio: audioUrl,
        filename: `audio_${Date.now()}.mp3`,
        file_type: "audio/mpeg",
        ...flags
      };
      delete payload.search;
      delete payload.query;
      delete payload.list;
      delete payload.setvoice;
      const data = await requestVoiceChanger(payload);
      const outputAudioUrl = data?.result?.output_url;
      if (!outputAudioUrl) {
        throw new Error(data?.result?.error_message || data?.error || "Gagal mendapatkan output URL audio.");
      }
      const current = global.voicechangerSession.get(senderId) || {};
      global.voicechangerSession.set(senderId, {
        ...current,
        voice: selectedVoice
      });
      await sendPTT(sock, targetJid, outputAudioUrl, quotedMsg);
      await ctx.react("🎙️");
    } catch (error) {
      console.error("[Voice Changer Error]:", error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.error || error.response?.data?.result?.error_message || error.message || "Terjadi kesalahan internal saat memproses suara.";
      ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : ${errMsg}\n` + `└ ◦ *Command* : ${ctx.command || "voicechanger"}\n\n` + `${footer}`);
    }
  }
};