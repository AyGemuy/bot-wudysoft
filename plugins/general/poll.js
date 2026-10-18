import {
  metaQuoted,
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "poll",
  aliases: ["polling", "vote", "quizpoll"],
  description: "Membuat polling reguler, kuis tebak jawaban, atau polling berbatas waktu",
  category: "Tools",
  example: ".poll Siapa karakter favoritmu? | Arlecchino | Furina | Nahida\n.poll quiz Ibukota Indonesia? | Jakarta | IKN | Bandung | 2",
  execute: async (sock, ctx, msg) => {
    try {
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof metaQuoted === "function" ? metaQuoted(ctx) : typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const botFooter = global.bot?.footer || "– Wudysoft • Multi-Device";
      const botContext = global.bot?.utils?.contextInfo || {};
      const rawInput = ctx.query || ctx.args?.join(" ") || "";
      const args = ctx.args || [];
      const mode = (args[0] || "").toLowerCase();
      if (mode === "quiz") {
        const input = rawInput.replace(/^quiz\s*/i, "");
        const parts = input.split("|").map(s => s?.trim()).filter(Boolean);
        if (parts.length < 4) {
          return ctx.reply(`–  *Q U I Z  P O L L*

Format:
\`${prefix}poll quiz Pertanyaan | Opsi 1 | Opsi 2 | Opsi 3 | Nomor Jawaban Benar\`

Contoh:
\`${prefix}poll quiz Siapakah pengembang bot ini? | Google | Wudysoft | Microsoft | 2\``);
        }
        const question = parts[0];
        const answerIndex = parseInt(parts[parts.length - 1]) - 1;
        const options = parts.slice(1, parts.length - 1);
        const correctAnswer = options[answerIndex] || options[0];
        ctx.react?.("⏳");
        if (typeof sock.poll === "function") {
          await sock.poll().name(`🎯 [QUIZ] ${question}`).options(options).quiz(correctAnswer).hideVoter().send(ctx.id);
        } else {
          await sock.sendMessage(ctx.id, {
            poll: {
              name: `🎯 [QUIZ] ${question}`,
              values: options,
              selectableOptionsCount: 1,
              pollType: 1,
              correctAnswer: correctAnswer
            }
          }, {
            quoted: quotedMsg
          });
        }
        return ctx.react?.("✅");
      }
      if (mode === "timed") {
        const input = rawInput.replace(/^timed\s*/i, "");
        const parts = input.split("|").map(s => s?.trim()).filter(Boolean);
        if (parts.length < 3) {
          return ctx.reply(`Format: \`${prefix}poll timed <menit> | Pertanyaan | Opsi 1 | Opsi 2\``);
        }
        const minutes = parseInt(parts[0]) || 10;
        const question = parts[1];
        const options = parts.slice(2);
        const endTime = Math.floor(Date.now() / 1e3) + minutes * 60;
        ctx.react?.("⏳");
        if (typeof sock.poll === "function") {
          await sock.poll().name(`⏱️ (${minutes} Menit) ${question}`).options(options).setEndTime(endTime).hideParticipantName().send(ctx.id);
        } else {
          await sock.sendMessage(ctx.id, {
            poll: {
              name: `⏱️ (${minutes} Menit) ${question}`,
              values: options,
              selectableOptionsCount: 1,
              endTime: endTime,
              hideParticipantName: true
            }
          }, {
            quoted: quotedMsg
          });
        }
        return ctx.react?.("✅");
      }
      const parts = rawInput.split("|").map(s => s?.trim()).filter(Boolean);
      if (parts.length < 3) {
        return ctx.reply(`–  *P O L L  M A N A G E R*

Cara membuat polling interaktif:

┌  ◦  *Polling Biasa* :
│  \`${prefix}poll Judul Pertanyaan | Opsi 1 | Opsi 2 | Opsi 3\`
│
│  ◦  *Kuis Interaktif* :
│  \`${prefix}poll quiz Pertanyaan | Opsi 1 | Opsi 2 | 2\`
│
└  ◦  *Batas Waktu* :
   \`${prefix}poll timed 15 | Pertanyaan | Opsi A | Opsi B\`

_${botFooter}_`);
      }
      const question = parts[0];
      const options = parts.slice(1);
      ctx.react?.("⏳");
      if (typeof sock.poll === "function") {
        await sock.poll().name(question).options(options).multiSelect(1).send(ctx.id);
      } else {
        await sock.sendMessage(ctx.id, {
          poll: {
            name: question,
            values: options,
            selectableOptionsCount: 1,
            toAnnouncementGroup: false
          }
        }, {
          quoted: quotedMsg
        });
      }
      return ctx.react?.("✅");
    } catch (err) {
      console.error("[POLL Error]:", err);
      ctx.react?.("❌");
      ctx.reply(`❌ Gagal membuat polling: ${err?.message || err}`);
    }
  }
};