import {
  runtime
} from "../../core/tools.js";
import {
  simpleQuoted,
  metaQuoted
} from "../../lib/quoted.js";
export default {
  name: "allmenu",
  aliases: ["all", "fitur", "helpall"],
  description: "Menampilkan semua command atau kategori spesifik via Centered A2UI Card & Footer Info",
  category: "General",
  execute: async (sock, ctx, msg) => {
    try {
      await ctx.react("⏳");
      const prefix = typeof ctx.prefix === "string" ? ctx.prefix : ".";
      const categories = global.loader?.getCommandsByCategory?.() || {};
      const categoryNames = Object.keys(categories).sort();
      const totalCommands = Object.values(categories).flat().length;
      const catName = (ctx.args?.[0] || ctx.query || "").trim().toLowerCase();
      const botName = global.bot?.name || "Wudysoft";
      const version = global.bot?.versions || global.bot?.version || "2.0.0";
      const botFooter = global.bot?.footer || "Wudysoft • Multi-Device";
      const botUptime = runtime(process.uptime());
      const userData = global.db?.user?.[ctx.sender];
      const userNumber = ctx.sender.split("@")[0];
      const isOwner = userData?.ownerAcces === true || (global.bot?.owner || []).some(o => String(o).replace(/\D/g, "") === userNumber);
      const isPremium = userData?.premium?.status === true || isOwner;
      const userStatus = isOwner ? "Owner" : isPremium ? "Premium" : "Free User";
      const userLimit = isOwner || isPremium ? "Unlimited" : userData?.limit ?? global.bot?.defaultLimit ?? 20;
      const userLevel = userData?.level || 1;
      const quotedMsg = typeof metaQuoted === "function" ? metaQuoted(ctx) : typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      let profilePic = global.bot?.media?.avatar || "https://i.pravatar.cc/400?img=58";
      try {
        profilePic = await sock.profilePictureUrl(ctx.sender, "image");
      } catch {}
      const userNameClean = (ctx.pushname || userNumber).slice(0, 20).toUpperCase();
      const badgeRole = isOwner ? "OWNER 👑" : isPremium ? "PREMIUM ⭐" : `LEVEL ${userLevel} 🎮`;
      const clearanceVal = isOwner ? "CLEARANCE: ROOT" : `CLEARANCE: NEB-${userLevel}`;
      const limitVal = isOwner || isPremium ? "LIMIT: INF" : `LIMIT: ${userLimit}`;
      const randomModel = Math.floor(Math.random() * 4) + 1;
      const params = new URLSearchParams({
        header: "NEBULA MECHA",
        tooltip: isOwner ? "CLEARANCE: ROOT" : isPremium ? "CLEARANCE: VIP" : "CLEARANCE: ALPHA",
        avatar: profilePic,
        badge: badgeRole,
        info_pre: "✦ CATALOG ENGINE ✦",
        info_badge: `${totalCommands} CMDS`,
        name: userNameClean,
        badge_line: catName ? `CAT: ${catName.toUpperCase()}` : `${botName} CATALOG`,
        role: isOwner ? "ROOT SYSTEM ADMIN" : isPremium ? "VIP RESEARCHER" : "STANDARD CITIZEN",
        email: `${userNumber}@whatsapp.net`,
        phone: `+${userNumber}`,
        pin: `UPTIME: ${botUptime.slice(0, 15)}`,
        valid: isOwner || isPremium ? "VALID: LIFETIME" : "VALID: 3025",
        clearance: clearanceVal,
        mag: limitVal,
        model: String(randomModel)
      });
      const bannerApiUrl = `${global.bot?.api?.wudysoft || "https://api.wudysoft.com"}/api/maker/id/v1?${params.toString()}`;
      const a2ui = typeof ctx.a2ui === "function" ? ctx.a2ui() : null;
      if (a2ui) {
        const imageId = a2ui.raw("Image", {
          url: bannerApiUrl,
          fit: "scale-down",
          variant: "mediumFeature"
        });
        const centeredColId = a2ui.raw("Column", {
          children: [imageId],
          align: "center",
          justify: "center"
        });
        const cardId = a2ui.card(centeredColId);
        a2ui.root([cardId]);
      }
      const bodyText = "\0";
      let footerText = "";
      let buttons = [];
      const matchedCategory = catName ? Object.keys(categories).find(k => k.toLowerCase() === catName) : null;
      if (matchedCategory) {
        const cmds = categories[matchedCategory] || [];
        const cmdLines = cmds.map((c, idx) => {
          const isLast = idx === cmds.length - 1;
          const branch = isLast ? "└" : "│";
          const cmdObj = typeof c === "object" ? c : {
            name: c
          };
          const badges = [cmdObj.limit ? "Ⓛ" : "", cmdObj.owner ? "Ⓞ" : "", cmdObj.premium ? "Ⓟ" : ""].filter(Boolean).join("");
          const badgeStr = badges ? ` ${badges}` : "";
          return `${branch}  ◦  ${prefix}${cmdObj.name}${badgeStr}`;
        }).join("\n");
        const categoryTitle = matchedCategory.toUpperCase().split("").join(" ");
        footerText = `“Hi @${userNumber}!
Berikut adalah daftar perintah untuk kategori *${matchedCategory.toUpperCase()}*.”

–  *I N F O*

┌  ◦  *Category* : ${matchedCategory.toUpperCase()}
│  ◦  *Total* : ${cmds.length} Perintah
└  ◦  *Prefix* : [ ${prefix} ]

–  *${categoryTitle}*

${cmdLines}

–  *N O T E*

┌  ◦  Keterangan badge: Ⓛ = Limit, Ⓟ = Premium, Ⓞ = Owner.
└  ◦  Ketik *${prefix}allmenu* untuk melihat seluruh kategori.

–  ${botFooter}`;
        const commandRows = cmds.map(cmd => {
          const cmdObj = typeof cmd === "object" ? cmd : {
            name: cmd
          };
          const badges = [cmdObj.limit ? "[LIMIT]" : "", cmdObj.owner ? "[OWNER]" : "", cmdObj.premium ? "[PREM]" : ""].filter(Boolean).join(" ");
          return {
            title: `${prefix}${cmdObj.name} ${badges}`.trim(),
            description: cmdObj.description || "Ketuk untuk menjalankan perintah ini",
            id: `${prefix}${cmdObj.name}`
          };
        });
        buttons = [{
          name: "",
          params: {}
        }, {
          name: "single_select",
          params: {
            title: "\0",
            sections: [{
              title: `${botName} • ${matchedCategory.toUpperCase()}`,
              rows: commandRows
            }],
            icon: "DEFAULT"
          }
        }, {
          name: "single_select",
          params: {
            title: "\0",
            sections: [{
              title: `${botName} • NAVIGASI`,
              rows: [{
                title: "All Menu",
                description: "Lihat semua kategori perintah",
                id: `${prefix}allmenu`
              }, {
                title: "Menu Utama",
                description: "Kembali ke beranda menu utama",
                id: `${prefix}menu`
              }]
            }],
            icon: "REVIEW"
          }
        }, {
          name: "quick_reply",
          params: {
            display_text: "\0",
            id: `${prefix}menu`
          }
        }];
      } else {
        const sortedEntries = Object.entries(categories).sort();
        let catalogText = "";
        for (const [cat, cmds] of sortedEntries) {
          if (!cmds || cmds.length === 0) continue;
          const cmdLines = cmds.map((c, idx) => {
            const isLast = idx === cmds.length - 1;
            const branch = isLast ? "└" : "│";
            const cmdObj = typeof c === "object" ? c : {
              name: c
            };
            const badges = [cmdObj.limit ? "Ⓛ" : "", cmdObj.owner ? "Ⓞ" : "", cmdObj.premium ? "Ⓟ" : ""].filter(Boolean).join("");
            const badgeStr = badges ? ` ${badges}` : "";
            return `${branch}  ◦  ${prefix}${cmdObj.name}${badgeStr}`;
          }).join("\n");
          const catTitle = cat.toUpperCase().split("").join(" ");
          catalogText += `–  *${catTitle}*\n\n${cmdLines}\n\n`;
        }
        footerText = `“Hi @${userNumber}!
Berikut adalah seluruh katalog perintah yang tersedia di sistem kami.”

–  *I N F O*

┌  ◦  *Name* : ${botName}
│  ◦  *Version* : v${version}
│  ◦  *Prefix* : [ ${prefix} ]
│  ◦  *Runtime* : ${botUptime}
│  ◦  *Category* : ${categoryNames.length} Kategori
└  ◦  *Commands* : ${totalCommands} Fitur

–  *U S E R*

┌  ◦  *User* : @${userNumber}
│  ◦  *Limit* : ${userLimit}
│  ◦  *Level* : Lv. ${userLevel}
└  ◦  *Status* : ${userStatus}

${catalogText.trim()}

–  *N O T E*

┌  ◦  Keterangan badge: Ⓛ = Limit, Ⓟ = Premium, Ⓞ = Owner.
└  ◦  Ketik *${prefix}owner* jika menemukan kendala.

–  ${botFooter}`;
        const categoryRows = categoryNames.map(cat => {
          const cmdCount = categories[cat]?.length || 0;
          return {
            title: `📁 ${cat.toUpperCase()}`,
            description: `Buka daftar ${cmdCount} fitur di kategori ini`,
            id: `${prefix}allmenu ${cat}`
          };
        });
        buttons = [{
          name: "",
          params: {}
        }, {
          name: "single_select",
          params: {
            title: "\0",
            sections: [{
              title: `${botName} • PILIH KATEGORI`,
              rows: categoryRows
            }],
            icon: "DEFAULT"
          }
        }, {
          name: "single_select",
          params: {
            title: "\0",
            sections: [{
              title: `${botName} • MENU UTAMA`,
              rows: [{
                title: "Main Menu",
                description: "Kembali ke beranda utama bot",
                id: `${prefix}menu`
              }, {
                title: "Speed Test",
                description: "Cek kecepatan respon bot",
                id: `${prefix}ping`
              }, {
                title: "Owner Bot",
                description: "Hubungi pemilik bot",
                id: `${prefix}owner`
              }]
            }],
            icon: "REVIEW"
          }
        }, {
          name: "quick_reply",
          params: {
            display_text: "\0",
            id: `${prefix}ping`
          }
        }];
      }
      const baseContextInfo = {
        mentionedJid: [ctx.sender],
        ...global.bot?.utils?.contextInfo || {
          forwardingScore: 999,
          isForwarded: true
        }
      };
      if (a2ui && typeof a2ui.send === "function") {
        await a2ui.send(sock, ctx.id, {
          bodyText: bodyText,
          footer: footerText,
          buttons: buttons,
          header: {},
          contextInfo: baseContextInfo,
          quoted: quotedMsg
        });
      } else {
        const ctaButtons = buttons.map(b => ({
          name: b.name,
          buttonParamsJson: JSON.stringify(b.params ?? {})
        }));
        await ctx.sendCta(bodyText, footerText, ctaButtons, {
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 1,
              divider_indices: [1],
              list_title: `${botName} • All Menu`,
              button_title: "Buka Menu"
            }
          },
          contextInfo: baseContextInfo,
          quoted: quotedMsg
        });
      }
      await ctx.react("✅");
    } catch (e) {
      console.error("[ALLMENU ERROR]", e);
      await ctx.react("❌");
      ctx.reply(global.bot?.msg?.error || `❌ Terjadi kesalahan: ${e.message}`);
    }
  }
};