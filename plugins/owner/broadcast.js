import {
  simpleQuoted
} from "../../lib/quoted.js";
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function getActiveGroups(sock) {
  const dbGroups = global.db?.group || {};
  const activeList = [];
  try {
    if (sock && typeof sock.groupFetchAllParticipating === "function") {
      const participating = await sock.groupFetchAllParticipating();
      if (participating && typeof participating === "object") {
        for (const [jid, meta] of Object.entries(participating)) {
          if (!jid.endsWith("@g.us")) continue;
          if (dbGroups[jid]?.bans === true) continue;
          activeList.push({
            jid: jid,
            subject: meta?.subject || dbGroups[jid]?.subject || "WhatsApp Group"
          });
        }
        return activeList;
      }
    }
  } catch (_) {}
  for (const [jid, data] of Object.entries(dbGroups)) {
    if (jid.endsWith("@g.us") && data?.bans !== true && (data?.subject || data?.name)) {
      activeList.push({
        jid: jid,
        subject: data?.subject || data?.name
      });
    }
  }
  return activeList;
}

function getActivePrivateUsers(sock) {
  const dbUsers = global.db?.user || {};
  const botNumber = (sock.user?.id || sock.user?.jid || "").split(":")[0].replace(/\D/g, "");
  const userList = [];
  for (const [jid, data] of Object.entries(dbUsers)) {
    const cleanJid = jid.includes("@") ? jid.split(":")[0].replace(/[^0-9]/g, "") + "@s.whatsapp.net" : jid;
    if (!cleanJid.endsWith("@s.whatsapp.net")) continue;
    if (cleanJid.includes(botNumber)) continue;
    if (data?.banned === true || data?.bans === true) continue;
    userList.push({
      jid: cleanJid,
      name: data?.name || "User"
    });
  }
  return userList;
}

function getRawQuotedMessage(sock, ctx, msg) {
  if (!ctx.quoted) return null;
  if (ctx.quoted.fakeObj) return ctx.quoted.fakeObj;
  if (ctx.quoted.vM) return ctx.quoted.vM;
  if (ctx.quoted.message && ctx.quoted.key) return ctx.quoted;
  const rawMsg = msg?.message;
  const firstKey = rawMsg ? Object.keys(rawMsg)[0] : null;
  const contextInfo = rawMsg?.extendedTextMessage?.contextInfo || (firstKey ? rawMsg[firstKey]?.contextInfo : null);
  if (contextInfo?.quotedMessage) {
    const botJid = (sock?.user?.id || sock?.user?.jid || "").split(":")[0] + "@s.whatsapp.net";
    return {
      key: {
        remoteJid: ctx.chat,
        id: contextInfo.stanzaId || ctx.quoted.id,
        fromMe: contextInfo.participant === botJid,
        participant: contextInfo.participant || ctx.quoted.sender
      },
      message: contextInfo.quotedMessage
    };
  }
  return ctx.quoted;
}
export default {
  name: "broadcast",
  aliases: ["bc", "bcgc", "bcpc", "bcall"],
  description: "Menyiarkan pesan massal ke Grup, Private Chat, atau Keduanya",
  category: "Owner",
  owner: true,
  example: ".bc gc <teks> | .bc pc <teks> | .bc all <teks>",
  execute: async (sock, ctx, msg) => {
    const footerText = global.bot?.footer || global.bot?.watermark || "– Wudysoft • Multi-Device";
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
    const prefix = ctx.prefix || ".";
    const invoked = (ctx.command || "").toLowerCase();
    const inAppButtons = [{
      name: "inapp_signup",
      buttonParamsJson: "{}"
    }];
    const replyInApp = async (text, title = "B R O A D C A S T  M E S S A G E") => {
      try {
        return await ctx.reply(text, {
          title: title,
          footer: footerText,
          interactiveButtons: inAppButtons,
          mentions: [ctx.sender]
        });
      } catch (_) {
        const fallback = `–  *${title}*\n\n${text.replace(/^–\s+\*[^*]+\*\s*/, "").trim()}\n\n_${footerText}_`;
        try {
          return await sock.sendMessage(ctx.chat || ctx.id, {
            text: fallback,
            mentions: [ctx.sender]
          }, {
            quoted: quotedMsg
          });
        } catch (_) {
          return null;
        }
      }
    };
    if (!ctx.isOwner) {
      if (typeof ctx.react === "function") await ctx.react("🚫");
      return replyInApp(`Fitur ini dibatasi khusus untuk *Owner Bot*.\n` + `Anda tidak memiliki izin otoritas untuk menyiarkan pesan massal.`, "A C C E S S  D E N I E D");
    }
    try {
      const args = ctx.args || [];
      let targetScope = "gc";
      let contentQuery = "";
      if (invoked === "bcgc") {
        targetScope = "gc";
        contentQuery = args.join(" ").trim();
      } else if (invoked === "bcpc") {
        targetScope = "pc";
        contentQuery = args.join(" ").trim();
      } else if (invoked === "bcall") {
        targetScope = "all";
        contentQuery = args.join(" ").trim();
      } else {
        const firstArg = (args[0] || "").toLowerCase();
        if (["gc", "group", "grup"].includes(firstArg)) {
          targetScope = "gc";
          contentQuery = args.slice(1).join(" ").trim();
        } else if (["pc", "pm", "private", "user", "users"].includes(firstArg)) {
          targetScope = "pc";
          contentQuery = args.slice(1).join(" ").trim();
        } else if (["all", "semua"].includes(firstArg)) {
          targetScope = "all";
          contentQuery = args.slice(1).join(" ").trim();
        } else {
          if (typeof ctx.react === "function") await ctx.react("❓");
          return replyInApp(`Silakan tentukan tujuan broadcast:\n\n` + `┌  ◦  \`${prefix}bc gc <pesan>\` : Siaran ke semua Grup (Aktif)\n` + `│  ◦  \`${prefix}bc pc <pesan>\` : Siaran ke semua Private Chat (Personal)\n` + `└  ◦  \`${prefix}bc all <pesan>\` : Siaran ke Grup & Private Chat\n\n` + `_Dapat me-reply jenis pesan apapun (Stiker/Audio/Media/Poll/Dokumen) untuk di-copy langsung._`, "B R O A D C A S T  M E N U");
        }
      }
      let targetMsg = null;
      if (ctx.quoted) {
        targetMsg = getRawQuotedMessage(sock, ctx, msg);
      } else if (contentQuery) {
        targetMsg = await replyInApp(contentQuery, "B R O A D C A S T  M E S S A G E");
      }
      if (!targetMsg) {
        if (typeof ctx.react === "function") await ctx.react("❓");
        return ctx.reply(`❌ Silakan sertakan teks siaran atau *reply pesan* (stiker, foto, video, polling, audio, dll.) yang ingin di-broadcast.\n` + `Contoh: \`${prefix}bc ${targetScope} Halo semua!\` atau reply pesan lalu ketik \`${prefix}bc ${targetScope}\``, {
          quoted: quotedMsg
        });
      }
      if (typeof ctx.react === "function") await ctx.react("⏳");
      const targets = [];
      if (targetScope === "gc" || targetScope === "all") {
        const groups = await getActiveGroups(sock);
        for (const g of groups) {
          targets.push({
            jid: g.jid,
            type: "Grup",
            name: g.subject
          });
        }
      }
      if (targetScope === "pc" || targetScope === "all") {
        const users = getActivePrivateUsers(sock);
        for (const u of users) {
          targets.push({
            jid: u.jid,
            type: "Private",
            name: u.name
          });
        }
      }
      if (!targets.length) {
        if (typeof ctx.react === "function") await ctx.react("❌");
        return ctx.reply(`❌ Tidak ditemukan target penerima yang valid untuk kategori *${targetScope.toUpperCase()}*.`);
      }
      const totalDelaySec = Math.ceil(targets.length * 600 / 1e3);
      await ctx.reply(`🔄 *Memulai broadcast ke ${targets.length} penerima (${targetScope.toUpperCase()})...*\n` + `_Metode: copyNForward (forward: false)_\n` + `_Estimasi waktu: ~${totalDelaySec} detik._`, {
        quoted: quotedMsg
      });
      let successCount = 0;
      let failCount = 0;
      for (const item of targets) {
        try {
          if (typeof sock.copyNForward === "function") {
            await sock.copyNForward(item.jid, targetMsg, false);
          } else {
            await sock.sendMessage(item.jid, {
              forward: targetMsg,
              force: false
            });
          }
          successCount++;
          await sleep(600);
        } catch (err) {
          console.error(`[BC ERROR] Gagal mengirim ke ${item.jid}:`, err?.message);
          failCount++;
        }
      }
      if (typeof ctx.react === "function") await ctx.react("✅");
      const reportText = `Pengiriman siaran pesan telah selesai diproses.\n\n` + `┌  ◦  *Kategori* : ${targetScope.toUpperCase()}\n` + `│  ◦  *Total Target* : ${targets.length} Chat\n` + `│  ◦  *Berhasil* : ${successCount} Terkirim 🟢\n` + `│  ◦  *Gagal* : ${failCount} Chat 🔴\n` + `└  ◦  *Tipe* : Direct Copy (Non-Forwarded)`;
      return replyInApp(reportText, "B R O A D C A S T  S U C C E S S");
    } catch (error) {
      console.error("[BC Fatal Error]:", error);
      if (typeof ctx.react === "function") await ctx.react("❌");
      ctx.reply(`❌ Terjadi kesalahan saat memproses siaran: ${error?.message || error}`);
    }
  }
};