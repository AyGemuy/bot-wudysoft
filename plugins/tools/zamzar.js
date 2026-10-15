import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
import {
  upload
} from "../../lib/upload.js";
const API_URL = `${global.bot?.api?.wudysoft}/api/tools/zamzar`;
export default {
  name: "zamzar",
  aliases: ["convertfile", "konversi", "tofile", "fileconvert", "zamzarconvert"],
  description: "Konversi berkas apa saja secara otomatis via Zamzar Cloud API (Mendukung Reply Media & URL Langsung)",
  category: "Tools",
  example: "zamzar pdf / balas berkas / zamzar pdf https://site.com/file.docx",
  execute: async (sock, ctx, msg) => {
    const prefix = ctx?.prefix || ".";
    const botName = global.bot?.name || "WudysoftBot";
    const footer = global.footer || global.bot?.footer || `_${botName}_`;
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
    const chatId = ctx.chat || ctx.id;
    const rawText = ctx?.text || ctx?.body || (ctx?.args || []).join(" ");
    const isFromButton = rawText.includes("|");
    let targetExt = null;
    let mediaUrl = null;
    let sourceExt = "";
    if (isFromButton) {
      const parts = rawText.replace(new RegExp(`^${prefix}?zamzar\\s*`, "i"), "").split("|").map(s => s.trim());
      targetExt = parts[0]?.toLowerCase().replace(/[^a-z0-9]/g, "");
      mediaUrl = parts[1] || null;
      sourceExt = parts[2]?.toLowerCase().replace(/[^a-z0-9]/g, "") || "";
    } else {
      const args = ctx?.args || [];
      const urlRegex = /(https?:\/\/[^\s]+)/gi;
      const foundUrl = rawText.match(urlRegex)?.[0] || null;
      if (foundUrl) {
        mediaUrl = foundUrl;
        const remainingArgs = args.filter(a => !a.match(urlRegex) && a.toLowerCase() !== "to").map(a => a.toLowerCase().replace(/[^a-z0-9]/g, "")).filter(Boolean);
        targetExt = remainingArgs[0] || null;
        try {
          const parsedUrlPath = new URL(foundUrl).pathname;
          if (parsedUrlPath.includes(".")) {
            sourceExt = parsedUrlPath.split(".").pop().toLowerCase().trim();
          }
        } catch {}
      } else {
        const rawArgs = args.map(a => a.toLowerCase().replace(/[^a-z0-9]/g, "")).filter(Boolean);
        targetExt = rawArgs[0] === "to" ? rawArgs[1] : rawArgs[0] || null;
      }
    }
    const targetObj = ctx?.quoted?.isMedia ? ctx.quoted : ctx;
    const isMedia = Boolean(ctx?.isMedia || ctx?.quoted?.isMedia || msg?.message?.imageMessage || msg?.message?.documentMessage || msg?.message?.audioMessage || msg?.message?.videoMessage || ctx?.quoted?.message?.imageMessage || ctx?.quoted?.message?.documentMessage || ctx?.quoted?.message?.audioMessage || ctx?.quoted?.message?.videoMessage);
    if (!mediaUrl && !isMedia) {
      const helpText = `– *Z A M Z A R*\n\n` + `┌ ◦ *Usage* : ${prefix}zamzar <target_ext> <url / quoted>\n` + `│ ◦ *Quoted* : Balas berkas dengan ${prefix}zamzar <target>\n` + `└ ◦ *Function* : Konversi berkas otomatis via Zamzar Cloud API\n\n` + `– *E X A M P L E*\n\n` + `┌ ◦ *Quoted* : ${prefix}zamzar pdf (pada gambar/dokumen)\n` + `│ ◦ *Direct URL* : ${prefix}zamzar pdf https://site.com/file.docx\n` + `└ ◦ *Menu Format* : ${prefix}zamzar (balas berkas tanpa format)\n\n` + `${footer}`;
      return ctx.reply(helpText);
    }
    try {
      if (typeof ctx.react === "function") await ctx.react("⏳");
      if (!mediaUrl) {
        const rawFileName = targetObj?.fileName || targetObj?.msg?.fileName || "";
        if (rawFileName.includes(".")) {
          sourceExt = rawFileName.split(".").pop().toLowerCase().trim();
        }
        if (!sourceExt) {
          const mime = (targetObj?.mimetype || targetObj?.msg?.mimetype || "").toLowerCase();
          if (mime.includes("/")) {
            sourceExt = mime.split("/")[1].split(";")[0].replace("jpeg", "jpg").trim();
          }
        }
        if (!sourceExt) sourceExt = "jpg";
        const downloadFn = typeof ctx?.download === "function" ? ctx.download : ctx?.quoted?.download;
        let fileBuffer = null;
        if (typeof downloadFn === "function") {
          fileBuffer = await downloadFn().catch(() => null);
        }
        if (!fileBuffer || !Buffer.isBuffer(fileBuffer)) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Gagal mengunduh berkas\n` + `└ ◦ *Info* : Berkas tidak dapat diakses dari WhatsApp.\n\n` + `${footer}`);
        }
        const uploadRes = await upload(fileBuffer).catch(() => null);
        mediaUrl = uploadRes?.url || uploadRes?.status?.url || (typeof uploadRes === "string" ? uploadRes : null);
        if (!mediaUrl) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Gagal mengunggah berkas\n` + `└ ◦ *Info* : Server uploader sementara tidak merespons.\n\n` + `${footer}`);
        }
      }
      if (!targetExt) {
        const probeRes = await axios.post(API_URL, {
          media: mediaUrl,
          source: sourceExt || "",
          target: ""
        }, {
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0"
          }
        }).catch(err => err.response?.data || {});
        const availableTargets = probeRes?.targets || probeRes?.data?.targets || [];
        if (!availableTargets || availableTargets.length === 0) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Format Tidak Didukung\n` + `└ ◦ *Info* : Ekstensi .${(sourceExt || "file").toUpperCase()} tidak didukung untuk dikonversi.\n\n` + `${footer}`);
        }
        const bodyText = `– *Z A M Z A R*\n\n` + `┌ ◦ *Source* : .${(sourceExt || "UNKNOWN").toUpperCase()}\n` + `│ ◦ *Available* : ${availableTargets.length} Format\n` + `└ ◦ *Engine* : Zamzar Cloud API\n\n` + `_Pilih format tujuan konversi pada menu di bawah:_\n\n` + `${footer}`;
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "PILIH FORMAT TUJUAN",
            sections: [{
              title: `Opsi Konversi .${(sourceExt || "FILE").toUpperCase()}`,
              rows: availableTargets.slice(0, 20).map(tgt => ({
                title: `.${tgt.toUpperCase()}`,
                description: `Konversi langsung ke .${tgt.toUpperCase()}`,
                id: `${prefix}zamzar ${tgt}|${mediaUrl}|${sourceExt}`
              }))
            }]
          })
        }];
        const options = {
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 1,
              divider_indices: [1],
              list_title: `${botName} • Format Live`,
              button_title: "Pilih Format"
            }
          },
          quoted: quotedMsg
        };
        if (typeof ctx.sendCta === "function") {
          return await ctx.sendCta(bodyText, footer, buttons, options);
        }
        return ctx.reply(bodyText);
      }
      const {
        data
      } = await axios.post(API_URL, {
        media: mediaUrl,
        source: sourceExt || "",
        target: targetExt
      }, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0"
        },
        timeout: 18e4
      });
      if (!data || !data.status || !data.result) {
        const supportedTargets = data?.targets ? `\n\n*Format yang didukung:* ${data.targets.join(", ")}` : "";
        throw new Error((data?.result || "Gagal mengonversi berkas melalui server Zamzar.") + supportedTargets);
      }
      const downloadResultUrl = data.result;
      const resFile = await axios.get(downloadResultUrl, {
        responseType: "arraybuffer",
        timeout: 9e4
      });
      const convertedBuffer = Buffer.from(resFile.data);
      const outputFileName = `zamzar_${Date.now()}.${targetExt}`;
      const captionText = `– *Z A M Z A R*\n\n` + `┌ ◦ *From* : .${(sourceExt || "AUTO").toUpperCase()}\n` + `│ ◦ *Target* : .${targetExt.toUpperCase()}\n` + `│ ◦ *Filename* : ${outputFileName}\n` + `└ ◦ *Size* : ${(convertedBuffer.length / 1024).toFixed(2)} KB\n\n` + `${footer}`;
      if (["jpg", "jpeg", "png", "webp"].includes(targetExt)) {
        await sock.sendMessage(chatId, {
          image: convertedBuffer,
          caption: captionText
        }, {
          quoted: quotedMsg
        });
      } else if (["mp3", "wav", "m4a", "ogg", "aac", "flac"].includes(targetExt)) {
        await sock.sendMessage(chatId, {
          audio: convertedBuffer,
          mimetype: `audio/${targetExt}`,
          fileName: outputFileName
        }, {
          quoted: quotedMsg
        });
      } else if (["mp4", "3gp", "avi", "mkv", "mov", "webm"].includes(targetExt)) {
        await sock.sendMessage(chatId, {
          video: convertedBuffer,
          caption: captionText,
          mimetype: `video/${targetExt}`
        }, {
          quoted: quotedMsg
        });
      } else {
        await sock.sendMessage(chatId, {
          document: convertedBuffer,
          mimetype: "application/octet-stream",
          fileName: outputFileName,
          caption: captionText
        }, {
          quoted: quotedMsg
        });
      }
      if (typeof ctx.react === "function") await ctx.react("✅");
    } catch (e) {
      console.error("[Zamzar Error]:", e);
      if (typeof ctx.react === "function") await ctx.react("❌");
      const errMsg = e.response?.data?.error || e.response?.data?.result || e.message;
      return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : ${errMsg}\n` + `└ ◦ *Command* : ${ctx?.command || "zamzar"}\n\n` + `${footer}`);
    }
  }
};