import axios from "axios";
import {
  makeJid
} from "../../core/tools.js";
import {
  simpleQuoted,
  metaQuoted
} from "../../lib/quoted.js";
import db from "../../data/db.js";

function createProgressBar(current, max, length = 8) {
  const safeCurrent = Math.max(0, current);
  const safeMax = Math.max(1, max);
  const percentage = Math.min(100, Math.round(safeCurrent / safeMax * 100));
  const filled = Math.round(percentage / 100 * length);
  const empty = length - filled;
  const bar = "█".repeat(filled) + "░".repeat(Math.max(0, empty));
  return `${bar} ${percentage}% (${safeCurrent}/${safeMax})`;
}
export default {
  name: "userinfo",
  aliases: ["profil", "profile", "info", "me"],
  description: "Lihat informasi profil user via Interactive ID Card Maker & CTA Sheet",
  category: "General",
  execute: async (sock, ctx, msg) => {
    try {
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || "Wudysoft • Multi-Device";
      const channelUrl = global.bot?.link || "https://whatsapp.com/channel/0029VaF5pWj59PwcGj4F4v2w";
      let targetJid = ctx.sender;
      if (ctx.args && ctx.args[0]) {
        const cleanSender = ctx.sender.replace(/\D/g, "");
        const owners = (global.bot?.owner || []).map(v => String(v).replace(/\D/g, ""));
        const isOwner = owners.includes(cleanSender) || global.db?.user?.[ctx.sender]?.ownerAcces === true;
        if (!isOwner) {
          return ctx.reply("❌ Kamu tidak memiliki izin untuk melihat profil pengguna lain!");
        }
        targetJid = ctx.mentionedJid?.[0] || makeJid(ctx.args[0]);
      }
      await ctx.react("⏳");
      if (typeof db?.ensureUser === "function") {
        db.ensureUser(targetJid, targetJid.split("@")[0]);
      }
      const user = global.db?.user?.[targetJid] || {};
      const isPremium = user.premium?.status === true;
      const isOwner = user.ownerAcces === true;
      const now = Date.now();
      let premiumText = "Free User";
      if (isOwner) {
        premiumText = "Owner";
      } else if (isPremium) {
        if (user.premium.expiredAt === Number.MAX_SAFE_INTEGER) {
          premiumText = "Premium (Lifetime)";
        } else {
          const remaining = user.premium.expiredAt - now;
          if (remaining > 0) {
            const d = Math.floor(remaining / 864e5);
            const h = Math.floor(remaining % 864e5 / 36e5);
            premiumText = `Premium (${d}d ${h}h)`;
          } else {
            premiumText = "Expired";
          }
        }
      }
      const createdDate = user.createdAt ? new Date(user.createdAt).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric"
      }) : "Baru saja";
      const hpCurrent = user.hp ?? 100;
      const hpMax = user.hpMax ?? 100;
      const manaCurrent = user.mana ?? 50;
      const manaMax = user.manaMax ?? 50;
      const userName = user.name || ctx.pushname || targetJid.split("@")[0];
      const targetNumber = targetJid.split("@")[0];
      const userLimit = isOwner || isPremium ? "Unlimited" : user.limit ?? 0;
      let profilePic = global.bot?.media?.avatar || "https://i.pravatar.cc/400?img=58";
      try {
        profilePic = await sock.profilePictureUrl(targetJid, "image");
      } catch {}
      let mediaOutput = profilePic;
      try {
        const idCardPayload = {
          header: "NEBULA MECHA",
          tooltip: isOwner ? "CLEARANCE: ROOT" : isPremium ? "CLEARANCE: VIP" : "CLEARANCE: ALPHA",
          avatar: profilePic,
          badge: `SECURITY LVL ${user.level || 1}`,
          info_pre: "✦ RPG PLAYER ID ✦",
          info_badge: isOwner ? "BOT OWNER" : isPremium ? "MECHA PRO" : "STANDARD",
          name: userName.slice(0, 20).toUpperCase(),
          badge_line: isOwner ? "SYSTEM OPERATOR" : `LEVEL ${user.level || 1} ADVENTURER`,
          role: isOwner ? "ROOT SYSTEM ADMIN" : isPremium ? "ORION RESEARCH · VIP" : "PLAYER DIVISION",
          email: `${targetNumber}@whatsapp.net`,
          phone: `+${targetNumber}`,
          pin: `EXP: ${(user.exp || 0).toLocaleString("id-ID")}`,
          valid: isOwner || isPremium && user.premium?.expiredAt === Number.MAX_SAFE_INTEGER ? "VALID: LIFETIME" : "VALID: 3025",
          clearance: isOwner ? "CLEARANCE: NEB-ROOT" : `CLEARANCE: NEB-${user.level || 1}`,
          mag: `RP ${(user.money || 0).toLocaleString("id-ID")}`,
          model: Math.floor(Math.random() * 4) + 1
        };
        const {
          data
        } = await axios.post(`${global.bot?.api?.wudysoft}/api/maker/id/v1?t=${Date.now()}`, idCardPayload, {
          responseType: "arraybuffer",
          headers: {
            "Content-Type": "application/json"
          },
          timeout: 2e4
        });
        if (data) {
          mediaOutput = Buffer.from(data);
        }
      } catch (err) {
        console.warn("[Userinfo ID Card Fail, using Avatar fallback]:", err.message);
      }
      const quotedMsg = typeof metaQuoted === "function" ? metaQuoted(ctx) : typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const bodyText = `Hi ${userName}!
Berikut adalah informasi profil dan status karakter Anda di dalam sistem.

–  *U S E R*

┌  ◦  *Name* : ${userName}
│  ◦  *Number* : @${targetNumber}
│  ◦  *Status* : ${premiumText}
└  ◦  *Joined* : ${createdDate}

–  *R P G*

┌  ◦  *Level* : Lv. ${user.level || 1}
│  ◦  *Exp* : ${(user.exp || 0).toLocaleString("id-ID")} XP
│  ◦  *Health* : ${createProgressBar(hpCurrent, hpMax)}
│  ◦  *Mana* : ${createProgressBar(manaCurrent, manaMax)}
└  ◦  *Stats* : ATK ${user.atk || 10} | DEF ${user.def || 5}

–  *I N V E N T O R Y*

┌  ◦  *Limit* : ${userLimit}
└  ◦  *Balance* : Rp ${(user.money || 0).toLocaleString("id-ID")}

Gunakan menu di bawah untuk membuka aksi karakter atau meningkatkan status.`;
      const footerText = `${botFooter}`;
      const actionRows = [{
        title: "🎁 KLAIM DAILY REWARD",
        id: `${prefix}daily`,
        description: "Ambil bonus limit, EXP, dan koin harian"
      }, {
        title: "🎒 BUKA INVENTORY",
        id: `${prefix}inv`,
        description: "Lihat koleksi item, senjata, dan potion"
      }, {
        title: "🏆 LEADERBOARD RANKING",
        id: `${prefix}lb`,
        description: "Cek peringkat pemain level & saldo tertinggi"
      }, {
        title: "🌲 MULAI ADVENTURE",
        id: `${prefix}adventure`,
        description: "Jelajahi dungeon untuk mencari item langka"
      }];
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: "⚡ MENU AKSI KARAKTER",
          sections: [{
            title: `${botName} • QUICK RPG ACTIONS`,
            rows: actionRows
          }]
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🆙 Level Up",
          id: `${prefix}levelup`
        })
      }, {
        name: "cta_copy",
        buttonParamsJson: JSON.stringify({
          display_text: "📋 Salin User JID",
          copy_code: targetJid
        })
      }];
      const baseContextInfo = {
        mentionedJid: [targetJid],
        ...global.bot?.utils?.contextInfo || {
          forwardingScore: 999,
          isForwarded: true
        }
      };
      const options = {
        image: mediaOutput,
        title: `✦ ${botName} • User Passport ✦`,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `${botName} • Menu Karakter`,
            button_title: "Aksi Karakter"
          },
          limited_time_offer: {
            text: `🎮 STATUS KARAKTER LV.${user.level || 1}: AKTIF & TERVERIFIKASI! 🎮`,
            url: channelUrl,
            copy_code: `${prefix}daily`,
            expiration_time: Date.now() + 6 * 3600 * 1e3
          }
        },
        contextInfo: baseContextInfo,
        quoted: quotedMsg
      };
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, footerText, buttons, options);
      } else {
        await sock.sendMessage(ctx.id, {
          image: Buffer.isBuffer(mediaOutput) ? mediaOutput : {
            url: mediaOutput
          },
          caption: bodyText,
          mentions: [targetJid]
        }, {
          quoted: quotedMsg
        });
      }
      await ctx.react("✅");
    } catch (e) {
      console.error("[USERINFO ERROR]:", e);
      await ctx.react("❌");
      ctx.reply(`❌ Gagal memuat profil: ${e.message}`);
    }
  }
};