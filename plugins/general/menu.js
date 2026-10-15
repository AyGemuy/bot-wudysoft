import axios from "axios";
import {
  runtime
} from "../../core/tools.js";
import {
  simpleQuoted,
  metaQuoted
} from "../../lib/quoted.js";
export default {
  name: "menu",
  aliases: ["main", "help", "list"],
  description: "Menampilkan menu utama bot via Interactive List CTA UI Neoxr Theme",
  category: "General",
  execute: async (sock, ctx, msg) => {
    try {
      await ctx.react("⏳");
      const prefix = typeof ctx.prefix === "string" ? ctx.prefix : ".";
      const categories = global.loader?.getCommandsByCategory?.() || {};
      const categoryNames = Object.keys(categories).sort();
      const totalFitur = Object.values(categories).flat().length;
      const botName = global.bot?.name || "Wudysoft";
      const version = global.bot?.versions || global.bot?.version || "2.0.0";
      const botFooter = global.bot?.footer || "Wudysoft • Multi-Device";
      const botUptime = runtime(process.uptime());
      const channelUrl = global.bot?.link || "https://whatsapp.com/channel/0029VaF5pWj59PwcGj4F4v2w";
      const userData = global.db?.user?.[ctx.sender];
      const userNumber = ctx.sender.split("@")[0];
      const isOwner = userData?.ownerAcces === true || (global.bot?.owner || []).some(o => String(o).replace(/\D/g, "") === userNumber);
      const isPremium = userData?.premium?.status === true || isOwner;
      const userStatus = isOwner ? "Owner" : isPremium ? "Premium" : "Free User";
      const userLimit = isOwner || isPremium ? "Unlimited" : userData?.limit ?? global.bot?.defaultLimit ?? 20;
      const userLevel = userData?.level || 1;
      const hours = new Date().getHours();
      const greeting = hours < 4 ? "Selamat Malam" : hours < 11 ? "Selamat Pagi" : hours < 15 ? "Selamat Siang" : hours < 18 ? "Selamat Sore" : "Selamat Malam";
      const quotedMsg = typeof metaQuoted === "function" ? metaQuoted(ctx) : typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      let profilePic = global.bot?.media?.avatar || "https://i.pravatar.cc/400?img=58";
      try {
        profilePic = await sock.profilePictureUrl(ctx.sender, "image");
      } catch {}
      let mediaOutput = global.bot?.media?.banner1 || global.bot?.media?.thumb || global.bot?.media?.banner2;
      try {
        const idCardPayload = {
          header: "NEBULA MECHA",
          tooltip: isOwner ? "CLEARANCE: ROOT" : isPremium ? "CLEARANCE: VIP" : "CLEARANCE: ALPHA",
          avatar: profilePic,
          badge: isOwner ? "OWNER 👑" : isPremium ? "PREMIUM ⭐" : `LEVEL ${userLevel} 🎮`,
          info_pre: "✦ BOT ENGINE ✦",
          info_badge: `${totalFitur} CMDS`,
          name: (ctx.pushname || userNumber).slice(0, 20).toUpperCase(),
          badge_line: `${botName} v${version}`,
          role: isOwner ? "ROOT SYSTEM ADMIN" : isPremium ? "VIP RESEARCHER" : "STANDARD CITIZEN",
          email: `${userNumber}@whatsapp.net`,
          phone: `+${userNumber}`,
          pin: `UPTIME: ${botUptime.slice(0, 15)}`,
          valid: isOwner || isPremium ? "VALID: LIFETIME" : "VALID: 3025",
          clearance: isOwner ? "CLEARANCE: ROOT" : `CLEARANCE: NEB-${userLevel}`,
          mag: isOwner || isPremium ? "LIMIT: INF" : `LIMIT: ${userLimit}`,
          model: Math.floor(Math.random() * 4) + 1
        };
        const {
          data
        } = await axios({
          method: "POST",
          url: `${global.bot?.api?.wudysoft}/api/maker/id/v1`,
          data: idCardPayload,
          responseType: "arraybuffer",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0"
          },
          timeout: 15e3
        });
        if (data) {
          mediaOutput = Buffer.from(data);
        }
      } catch (err) {
        console.warn("[Menu ID Card Maker Fail, fallback to default banner]:", err.message);
      }
      const baseContextInfo = {
        mentionedJid: [ctx.sender],
        ...global.bot?.utils?.contextInfo || {
          forwardingScore: 999,
          isForwarded: true
        }
      };
      const bodyText = `“Hi @${userNumber}, ${greeting}!
Saya adalah sistem otomatis (WhatsApp Bot) yang siap membantu Anda mempermudah aktivitas dan mencari informasi melalui WhatsApp.”

–  *I N F O*

┌  ◦  *Name* : ${botName}
│  ◦  *Version* : v${version}
│  ◦  *Prefix* : [ ${prefix} ]
│  ◦  *Runtime* : ${botUptime}
│  ◦  *Category* : ${categoryNames.length} Kategori
└  ◦  *Commands* : ${totalFitur} Fitur

–  *U S E R*

┌  ◦  *User* : @${userNumber}
│  ◦  *Limit* : ${userLimit}
│  ◦  *Level* : Lv. ${userLevel}
└  ◦  *Status* : ${userStatus}

–  *N O T E*

┌  ◦  Gunakan bot secara bijak & hindari spam.
└  ◦  Ketik *${prefix}owner* jika menemukan kendala.`;
      const footerText = `${botFooter}`;
      const categoryRows = categoryNames.map(cat => {
        const cmdCount = categories[cat]?.length || 0;
        return {
          title: `📁 ${cat.toUpperCase()}`,
          description: `Koleksi ${cmdCount} menu perintah`,
          id: `${prefix}allmenu ${cat}`
        };
      });
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: `📂 PILIH KATEGORI (${categoryNames.length})`,
          sections: [{
            title: `${botName} • LIST MENU`,
            rows: categoryRows
          }]
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "📜 Semua Menu",
          id: `${prefix}allmenu`
        })
      }];
      const options = {
        image: mediaOutput,
        title: `✦ ${botName} • Dashboard ✦`,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `${botName} • Main Menu`,
            button_title: "Lihat Kategori"
          },
          limited_time_offer: {
            text: `🎉 DISKON UPGRADE VIP & LIMIT RESET SEGERA HADIR! 🎉`,
            url: channelUrl,
            copy_code: `${prefix}allmenu`,
            expiration_time: Date.now() + 3 * 3600 * 1e3
          }
        },
        contextInfo: baseContextInfo,
        quoted: quotedMsg
      };
      await ctx.sendCta(bodyText, footerText, buttons, options);
      await ctx.react("✅");
    } catch (e) {
      console.error("[MENU ERROR]", e);
      await ctx.react("❌");
      ctx.reply(global.bot?.msg?.error || `❌ Gagal menampilkan menu: ${e.message}`);
    }
  }
};