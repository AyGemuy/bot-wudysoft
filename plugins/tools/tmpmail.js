import axios from "axios";
import * as cheerio from "cheerio";
import {
  simpleQuoted,
  metaQuoted
} from "../../lib/quoted.js";
const BASE_URL = `${global.bot?.api?.wudysoft}/api/mails/v40`;
const formatSize = bytes => {
  if (!bytes || isNaN(bytes)) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};
export default {
  name: "tempmail",
  aliases: ["tmail", "tempemail"],
  description: "Layanan Temp Mail (Buat Email Kustom & Cek Kotak Masuk)",
  category: "Tools",
  execute: async (sock, ctx, msg) => {
    const rawText = (ctx.args || []).join(" ").trim();
    const prefix = typeof ctx.prefix === "string" ? ctx.prefix : ".";
    const botName = global.bot?.name || "WudysoftBot";
    const footer = global.footer || global.bot?.footer || `_${botName}_`;
    const channelUrl = global.bot?.link || "https://whatsapp.com/channel/0029VaF5pWj59PwcGj4F4v2w";
    const bannerMedia = global.bot?.media?.banner1 || global.bot?.media?.thumb || "https://picsum.photos/seed/email/800/400";
    const quotedMsg = typeof metaQuoted === "function" ? metaQuoted(ctx) : typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
    const baseContextInfo = {
      mentionedJid: [ctx.sender],
      ...global.bot?.utils?.contextInfo || {
        forwardingScore: 999,
        isForwarded: true
      }
    };
    try {
      const messageMatch = rawText.match(/^--message(?:\s+([^\s]+))?(?:\s+([^\s]+))?/i);
      if (messageMatch) {
        const email = messageMatch[1];
        const messageId = messageMatch[2];
        if (!email) {
          return ctx.reply(`– *T E M P  M A I L*\n\n` + `┌ ◦ *Usage* : ${prefix}tempmail --message <email>\n` + `└ ◦ *Example* : ${prefix}tempmail --message user@domain.com\n\n` + `${footer}`);
        }
        await ctx.react("⏳");
        const res = await axios.post(BASE_URL, {
          action: "message",
          email: email
        });
        const mails = Array.isArray(res.data?.result) ? res.data.result : res.data?.result?.mails || [];
        if (messageId) {
          const target = mails.find(m => m.id === messageId);
          if (!target) {
            await ctx.react("❌");
            return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Pesan Tidak Ditemukan\n` + `└ ◦ *Info* : Surat sudah kedaluwarsa atau ID pesan salah.\n\n` + `${footer}`);
          }
          const dateStr = target.created_at ? new Date(target.created_at).toLocaleString("id-ID") : target.date ? new Date(target.date).toLocaleString("id-ID") : "-";
          let cleanContent = target.text?.trim();
          if (!cleanContent && target.html) {
            const $ = cheerio.load(target.html);
            $("script, style").remove();
            $("br").replaceWith("\n");
            $("p, div").each((_, el) => {
              $(el).append("\n");
            });
            cleanContent = $("body").text().replace(/\n\s*\n\s*\n/g, "\n\n").trim();
          }
          cleanContent = cleanContent || "(Pesan Kosong)";
          const otpMatch = cleanContent.match(/\b([0-9]{4,8})\b/);
          const detectedOtp = otpMatch ? otpMatch[1] : null;
          let attachmentText = "";
          if (Array.isArray(target.attachment_info) && target.attachment_info.length > 0) {
            attachmentText = `\n\n┌ ◦ *Lampiran (${target.attachment_info.length})*\n` + target.attachment_info.map((att, idx) => `│ ◦ ${idx + 1}. ${att.filename} (${formatSize(att.size)})`).join("\n") + `\n└ ◦ [Selesai]`;
          }
          const readBody = `– *M E S S A G E*\n\n` + `┌ ◦ *From* : ${target.from_text || target.from || "-"}\n` + `│ ◦ *Subject* : ${target.subject || "(Tanpa Subjek)"}\n` + `│ ◦ *Date* : ${dateStr}\n` + `│ ◦ *Attachments* : ${target.attachments || target.attachment_info?.length || 0}\n` + `${detectedOtp ? `│ ◦ *OTP Code* : *${detectedOtp}*\n` : ""}` + `└ ◦ *Content* :\n\n` + `\`\`\`\n${cleanContent}\n\`\`\`` + `${attachmentText}\n\n` + `${footer}`;
          const readButtons = [];
          if (detectedOtp) {
            readButtons.push({
              name: "cta_copy",
              buttonParamsJson: JSON.stringify({
                display_text: "Salin Kode OTP",
                copy_code: detectedOtp
              })
            });
          }
          readButtons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "Kembali ke Kotak Masuk",
              id: `${prefix}tempmail --message ${email}`
            })
          });
          readButtons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "Buat Email Baru",
              id: `${prefix}tempmail`
            })
          });
          const readOptions = {
            image: bannerMedia,
            params: {
              bottom_sheet: {
                in_thread_buttons_limit: 1,
                divider_indices: [1],
                list_title: `${botName} • Message Reader`,
                button_title: "Opsi Pesan"
              },
              limited_time_offer: {
                text: `SUBJEK: ${(target.subject || "Pesan Masuk").slice(0, 32)}`,
                url: channelUrl,
                copy_code: detectedOtp || email,
                expiration_time: Date.now() + 3600 * 1e3
              }
            },
            contextInfo: baseContextInfo,
            quoted: quotedMsg
          };
          await ctx.sendCta(readBody, footer, readButtons, readOptions);
          await ctx.react("✅");
          return;
        }
        if (mails.length === 0) {
          await ctx.react("📭");
          const emptyBody = `– *I N B O X*\n\n` + `┌ ◦ *Email* : ${email}\n` + `│ ◦ *Status* : Kotak masuk masih kosong\n` + `└ ◦ *Action* : Silakan tunggu beberapa saat lalu ketuk tombol refresh.\n\n` + `${footer}`;
          const emptyButtons = [{
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "Refresh Inbox",
              id: `${prefix}tempmail --message ${email}`
            })
          }, {
            name: "cta_copy",
            buttonParamsJson: JSON.stringify({
              display_text: "Salin Email",
              copy_code: email
            })
          }, {
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "Buat Email Baru",
              id: `${prefix}tempmail`
            })
          }];
          const emptyOptions = {
            image: bannerMedia,
            params: {
              bottom_sheet: {
                in_thread_buttons_limit: 1,
                divider_indices: [1],
                list_title: `${botName} • Kotak Masuk`,
                button_title: "Tindakan Inbox"
              },
              limited_time_offer: {
                text: `MENUNGGU PESAN MASUK KE ${email}...`,
                url: channelUrl,
                copy_code: `${prefix}tempmail --message ${email}`,
                expiration_time: Date.now() + 1800 * 1e3
              }
            },
            contextInfo: baseContextInfo,
            quoted: quotedMsg
          };
          await ctx.sendCta(emptyBody, footer, emptyButtons, emptyOptions);
          return;
        }
        const mailRows = mails.map((m, i) => {
          const hasAttach = m.attachments > 0 || m.attachment_info?.length > 0 ? " 📎" : "";
          return {
            title: `${i + 1}. ${(m.subject || "Tanpa Subjek").slice(0, 24)}${hasAttach}`,
            id: `${prefix}tempmail --message ${email} ${m.id}`,
            description: `Dari: ${(m.from_text || m.from || "Unknown").slice(0, 30)}`
          };
        });
        const listBody = `– *I N B O X*\n\n` + `┌ ◦ *Email* : ${email}\n` + `└ ◦ *Total* : ${mails.length} Pesan Diterima\n\n` + `_Pilih pesan pada menu di bawah untuk membuka isi surat._\n\n` + `${footer}`;
        const listButtons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: `BUKA PESAN (${mails.length})`,
            sections: [{
              title: `${botName} • Pesan Masuk`,
              rows: mailRows
            }]
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "Refresh Inbox",
            id: `${prefix}tempmail --message ${email}`
          })
        }, {
          name: "cta_copy",
          buttonParamsJson: JSON.stringify({
            display_text: "Salin Email",
            copy_code: email
          })
        }];
        const listOptions = {
          image: bannerMedia,
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 1,
              divider_indices: [1],
              list_title: `${botName} • Pesan Masuk`,
              button_title: "Pilih Pesan"
            },
            limited_time_offer: {
              text: `${mails.length} PESAN BARU DITERIMA!`,
              url: channelUrl,
              copy_code: `${prefix}tempmail --message ${email}`,
              expiration_time: Date.now() + 3600 * 1e3
            }
          },
          contextInfo: baseContextInfo,
          quoted: quotedMsg
        };
        await ctx.sendCta(listBody, footer, listButtons, listOptions);
        await ctx.react("✅");
        return;
      }
      await ctx.react("⏳");
      let customName = null;
      const nameFlagMatch = rawText.match(/--(?:name|create)\s+([^\s]+)/i);
      if (nameFlagMatch) {
        customName = nameFlagMatch[1];
      } else if (rawText && !rawText.startsWith("--")) {
        customName = rawText.split(/\s+/)[0];
      }
      if (customName && customName.includes("@")) {
        customName = customName.split("@")[0];
      }
      const payload = {
        action: "create",
        ...customName && {
          name: customName
        }
      };
      const res = await axios.post(BASE_URL, payload);
      const email = res.data?.result?.email;
      if (!email) {
        await ctx.react("❌");
        return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Gagal membuat email\n` + `└ ◦ *Info* : Coba gunakan nama lain.\n\n` + `${footer}`);
      }
      const createBody = `– *T E M P  M A I L*\n\n` + `┌ ◦ *Email* : ${email}\n` + `│ ◦ *Type* : ${customName ? `Custom (${customName})` : "Random"}\n` + `└ ◦ *Status* : Active\n\n` + `_Salin email untuk verifikasi atau periksa kotak masuk melalui tombol di bawah:_\n\n` + `${footer}`;
      const createButtons = [{
        name: "cta_copy",
        buttonParamsJson: JSON.stringify({
          display_text: "Salin Alamat Email",
          copy_code: email
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "Cek Kotak Masuk",
          id: `${prefix}tempmail --message ${email}`
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "Buat Email Baru",
          id: `${prefix}tempmail`
        })
      }];
      const createOptions = {
        image: bannerMedia,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `${botName} • Temp Mail Generator`,
            button_title: "Aksi Email"
          },
          limited_time_offer: {
            text: `EMAIL AKTIF: ${email}`,
            url: channelUrl,
            copy_code: email,
            expiration_time: Date.now() + 3600 * 1e3
          }
        },
        contextInfo: baseContextInfo,
        quoted: quotedMsg
      };
      await ctx.sendCta(createBody, footer, createButtons, createOptions);
      await ctx.react("✅");
    } catch (e) {
      console.error("[TEMPMAIL ERROR]:", e);
      await ctx.react("❌");
      ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : ${e.message}\n` + `└ ◦ *Command* : ${ctx.command || "tempmail"}\n\n` + `${footer}`);
    }
  }
};