import {
  simpleQuoted
} from "../../lib/quoted.js";
import {
  decodeJid,
  extractNum,
  resolveLidToJid
} from "../../core/serialize.js";
export default {
  name: "getpp",
  aliases: ["getpic", "getavatar", "pp"],
  description: "Mengambil foto profil pengguna dari tag, reply, atau nomor (Multi-User Supported)",
  category: "Tools",
  example: ".getpp @user1 @user2\n.getpp (reply pesan)\n.getpp me",
  execute: async (sock, ctx, msg) => {
    try {
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const prefix = ctx.prefix || ".";
      let targets = [];
      if (Array.isArray(ctx.mentionedJid) && ctx.mentionedJid.length > 0) {
        targets.push(...ctx.mentionedJid);
      }
      const quotedSender = ctx.quoted?.sender || ctx.quoted?.participant;
      if (quotedSender) {
        targets.push(quotedSender);
      }
      const rawArgs = (ctx.query || ctx.args?.join(" ") || "").trim().toLowerCase();
      if (targets.length === 0 && (rawArgs === "me" || rawArgs === "self" || rawArgs === "saya")) {
        targets.push(ctx.sender);
      }
      if (targets.length === 0 && rawArgs && !["help", "--help", "-h", "bantuan"].includes(rawArgs)) {
        const potentialNumbers = rawArgs.match(/\b\d{7,16}\b/g) || [];
        for (const num of potentialNumbers) {
          targets.push(`${num}@s.whatsapp.net`);
        }
      }
      if (targets.length === 0 || ["help", "--help", "-h", "bantuan"].includes(rawArgs)) {
        await ctx.react("ℹ️");
        const guideText = `–  *G E T   P R O F I L E   P I C T U R E*

Fitur untuk mengambil foto profil WhatsApp dalam resolusi tinggi/asli.

┌  ◦  *Ambil PP Target (Tag/Mention)* :
│  └ \`${prefix}getpp @user\`
│
├  ◦  *Multi-Target (Banyak Akun Sekaligus)* :
│  └ \`${prefix}getpp @user1 @user2 @user3\`
│
├  ◦  *Ambil PP Lewat Reply Pesan* :
│  └ Balas (reply) pesan target lalu ketik: \`${prefix}getpp\`
│
├  ◦  *Ambil PP Lewat Nomor HP* :
│  └ \`${prefix}getpp 628xxxxxxxxxx\`
│
└  ◦  *Ambil PP Akun Sendiri* :
   └ \`${prefix}getpp me\` atau tag akun sendiri`;
        return ctx.reply(guideText, {
          quoted: quotedMsg
        });
      }
      await ctx.react("⏳");
      const targetMap = new Map();
      for (let raw of targets) {
        let clean = decodeJid(String(raw || "").trim());
        if (!clean) continue;
        if (clean.endsWith("@lid")) {
          const lidNum = clean.split("@")[0].split(":")[0];
          const cached = global.lidPhoneCache?.get(lidNum);
          if (cached) {
            clean = `${cached}@s.whatsapp.net`;
          } else if (typeof resolveLidToJid === "function") {
            clean = await resolveLidToJid(clean, sock);
          }
        }
        const userKey = clean.split("@")[0].split(":")[0].replace(/\D/g, "") || clean.split("@")[0];
        if (!userKey) continue;
        const server = clean.split("@")[1] || "s.whatsapp.net";
        const formattedJid = `${userKey}@${server}`;
        if (targetMap.has(userKey)) {
          if (server === "bot") {
            targetMap.set(userKey, formattedJid);
          }
        } else {
          targetMap.set(userKey, formattedJid);
        }
      }
      const uniqueTargets = Array.from(targetMap.values());
      let successCount = 0;
      for (let jid of uniqueTargets) {
        try {
          const userNum = extractNum(jid) || jid.split("@")[0];
          let ppUrl = await sock.profilePictureUrl(jid, "image").catch(() => null) || await sock.profilePictureUrl(jid, "preview").catch(() => null);
          if (!ppUrl && jid.endsWith("@s.whatsapp.net")) {
            const botJid = `${userNum}@bot`;
            ppUrl = await sock.profilePictureUrl(botJid, "image").catch(() => null) || await sock.profilePictureUrl(botJid, "preview").catch(() => null);
            if (ppUrl) jid = botJid;
          }
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
          }
        } catch (err) {
          console.error(`[GETPP ERROR] Gagal mengambil PP untuk ${jid}:`, err.message);
        }
      }
      await ctx.react(successCount > 0 ? "✅" : "❌");
    } catch (error) {
      console.error("[GETPP CMD ERROR]:", error);
      await ctx.react("❌");
      ctx.reply(`❌ Gagal memproses: ${error?.message || error}`);
    }
  }
};