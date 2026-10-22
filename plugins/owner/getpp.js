import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "getpp",
  aliases: ["getpic", "getavatar", "pp"],
  description: "Mengambil foto profil pengguna dari tag, reply, atau nomor (Multi-User Supported)",
  category: "Tools",
  example: ".getpp @user1 @user2 (atau reply pesan target)",
  execute: async (sock, ctx, msg) => {
    try {
      await ctx.react("⏳");
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      let targets = [];
      if (ctx.mentionedJid && ctx.mentionedJid.length > 0) {
        targets.push(...ctx.mentionedJid);
      }
      const quotedSender = ctx.quoted?.sender || ctx.quoted?.participant || msg?.message?.extendedTextMessage?.contextInfo?.participant || msg?.message?.imageMessage?.contextInfo?.participant || msg?.message?.videoMessage?.contextInfo?.participant;
      if (quotedSender) {
        targets.push(quotedSender);
      }
      const rawArgs = (ctx.query || ctx.args?.join(" ") || "").trim();
      if (rawArgs) {
        const cleanedQuery = rawArgs.replace(/[^\d+]/g, " ");
        const potentialNumbers = cleanedQuery.trim().split(/\s+/);
        for (const num of potentialNumbers) {
          const digitsOnly = num.replace(/\D/g, "");
          if (digitsOnly.length >= 7) {
            targets.push(`${digitsOnly}@s.whatsapp.net`);
          }
        }
      }
      if (targets.length === 0) {
        targets.push(ctx.sender);
      }
      targets = [...new Set(targets)];
      let successCount = 0;
      let failCount = 0;
      for (const jid of targets) {
        try {
          let ppUrl = await sock.profilePictureUrl(jid, "image").catch(() => null);
          if (!ppUrl) {
            ppUrl = await sock.profilePictureUrl(jid, "preview").catch(() => null);
          }
          const userNum = jid.split("@")[0];
          if (ppUrl) {
            await sock.sendMessage(ctx.from, {
              image: {
                url: ppUrl
              },
              caption: `📸 *P R O F I L E  P I C T U R E*\n\n┌  ◦  *User* : @${userNum}\n└  ◦  *JID* : ${jid}`,
              mentions: [jid]
            }, {
              quoted: quotedMsg
            });
            successCount++;
          } else {
            await ctx.reply(`❌ Tidak dapat mengambil PP untuk @${userNum} (Privasi / Tidak ada foto)`, {
              mentions: [jid],
              quoted: quotedMsg
            });
            failCount++;
          }
        } catch (err) {
          console.error(`[GETPP ERROR] Gagal mengambil PP untuk ${jid}:`, err);
          failCount++;
        }
      }
      await ctx.react(successCount > 0 ? "✅" : "❌");
    } catch (error) {
      console.error("[GETPP CMD ERROR]:", error);
      await ctx.react("❌");
      ctx.reply(`❌ Gagal mengambil foto profil: ${error?.message || error}`);
    }
  }
};