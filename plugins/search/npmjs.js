import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "npmjs",
  aliases: ["npm", "npmsearch", "npmdl", "npmpkg", "npms"],
  description: "Mencari package di NPM dan langsung mengunduh file tarball/source code (.tgz).",
  category: "Search",
  limit: true,
  example: "npmjs baileys\nnpmjs --download axios",
  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "WudysoftBot";
    const footer = global.footer || global.bot?.footer || `_${botName}_`;
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
    const targetJid = ctx.chat || ctx.id;
    try {
      const rawQuery = (ctx.query || ctx.text || "").trim();
      if (!rawQuery) {
        const helpText = `– *N P M J S*\n\n` + `┌ ◦ *Usage* : ${prefix}npmjs <package>\n` + `│ ◦ *Download* : ${prefix}npmjs --download <package>\n` + `└ ◦ *Function* : Mencari package & mengunduh source code (.tgz)\n\n` + `– *E X A M P L E*\n\n` + `┌ ◦ *Search* : ${prefix}npmjs baileys\n` + `└ ◦ *Download* : ${prefix}npmjs -d axios\n\n` + `${footer}`;
        return ctx.reply(helpText);
      }
      const isDownloadTrigger = rawQuery.startsWith("--download") || rawQuery.startsWith("--dl") || rawQuery.startsWith("-d");
      if (isDownloadTrigger) {
        const pkgName = rawQuery.replace(/^(--download|--dl|-d)\s*/i, "").trim();
        if (!pkgName) {
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Nama package kosong\n` + `└ ◦ *Example* : ${prefix}npmjs --download axios\n\n` + `${footer}`);
        }
        await ctx.react("⏳");
        const formattedPkg = pkgName.startsWith("@") ? `@${encodeURIComponent(pkgName.slice(1))}` : encodeURIComponent(pkgName);
        const {
          data: pkgData
        } = await axios.get(`https://registry.npmjs.org/${formattedPkg}`, {
          timeout: 3e4,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
          }
        });
        const latestVersion = pkgData["dist-tags"]?.latest || Object.keys(pkgData.versions || {}).pop();
        if (!latestVersion || !pkgData.versions?.[latestVersion]) {
          await ctx.react("❌");
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Versi rilis tidak ditemukan\n` + `└ ◦ *Package* : ${pkgName}\n\n` + `${footer}`);
        }
        const versionData = pkgData.versions[latestVersion];
        const tarballUrl = versionData.dist?.tarball;
        if (!tarballUrl) {
          await ctx.react("❌");
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Tarball (.tgz) tidak tersedia\n` + `└ ◦ *Package* : ${pkgName}\n\n` + `${footer}`);
        }
        const response = await axios.get(tarballUrl, {
          responseType: "arraybuffer",
          timeout: 6e4,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
          }
        });
        const fileBuffer = Buffer.from(response.data);
        const cleanFileName = `${pkgName.replace(/[@/]/g, "-")}-${latestVersion}.tgz`;
        const caption = `– *N P M J S*\n\n` + `┌ ◦ *Package* : ${pkgData.name}\n` + `│ ◦ *Version* : v${latestVersion}\n` + `│ ◦ *License* : ${versionData.license || pkgData.license || "MIT"}\n` + `└ ◦ *URL* : https://www.npmjs.com/package/${pkgData.name}\n\n` + `_Ekstrak arsip .tgz menggunakan WinRAR, 7-Zip, atau tar command._\n\n` + `${footer}`;
        await sock.sendMessage(targetJid, {
          document: fileBuffer,
          mimetype: "application/gzip",
          fileName: cleanFileName,
          caption: caption
        }, {
          quoted: quotedMsg
        });
        await ctx.react("📦");
        return;
      }
      await ctx.react("⏳");
      const res = await axios.get(`https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(rawQuery)}&size=10`, {
        timeout: 3e4
      });
      const list = res.data?.objects;
      if (!list?.length) {
        await ctx.react("❌");
        return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Package tidak ditemukan\n` + `└ ◦ *Query* : "${rawQuery}"\n\n` + `${footer}`);
      }
      const topItem = list[0];
      const topPkg = topItem.package;
      const authorName = topPkg.publisher?.username || topPkg.author?.name || "Unknown";
      const score = Math.round((topItem.score?.final || 0) * 100);
      const updateDate = topPkg.date ? new Date(topPkg.date).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric"
      }) : "-";
      const npmUrl = topPkg.links?.npm || `https://www.npmjs.com/package/${topPkg.name}`;
      const downloadRows = [{
        title: `Download v${topPkg.version} (.tgz)`,
        id: `${prefix}npmjs --download ${topPkg.name}`,
        description: `Unduh file arsip tarball ${topPkg.name}`
      }];
      const otherPackageRows = list.slice(1).map((item, i) => {
        const p = item.package;
        return {
          title: `${i + 2}. ${p.name.slice(0, 24)} (v${p.version})`,
          id: `${prefix}npmjs --download ${p.name}`,
          description: `Download .tgz (${p.description || "Source code"}`.slice(0, 60)
        };
      });
      const listSections = [{
        title: `UNDUH SOURCE: ${topPkg.name.toUpperCase()}`,
        rows: downloadRows
      }];
      if (otherPackageRows.length > 0) {
        listSections.push({
          title: `PACKAGE LAINNYA (${otherPackageRows.length})`,
          rows: otherPackageRows
        });
      }
      const bodyText = `– *N P M J S*\n\n` + `┌ ◦ *Package* : ${topPkg.name}\n` + `│ ◦ *Version* : v${topPkg.version}\n` + `│ ◦ *Author* : ${authorName}\n` + `│ ◦ *Quality* : ${score}%\n` + `│ ◦ *License* : ${topPkg.license || "MIT"}\n` + `│ ◦ *Updated* : ${updateDate}\n` + `└ ◦ *Install* : npm i ${topPkg.name}\n\n` + `_${topPkg.description || "Tidak ada deskripsi yang tersedia."}_\n\n` + `${footer}`;
      const npmLogo = "https://raw.githubusercontent.com/npm/logos/master/npm%20square/n-64.png";
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: "PILIH & UNDUH SOURCE (.TGZ)",
          sections: listSections
        })
      }, {
        name: "cta_copy",
        buttonParamsJson: JSON.stringify({
          display_text: "Salin Perintah Install",
          copy_code: `npm i ${topPkg.name}`
        })
      }, {
        name: "cta_url",
        buttonParamsJson: JSON.stringify({
          display_text: "Buka di Web NPM",
          url: npmUrl
        })
      }];
      await ctx.sendCta(bodyText, `${botName} • NPM Registry`, buttons, {
        media: npmLogo,
        quoted: quotedMsg
      });
      await ctx.react("✅");
    } catch (error) {
      console.error("[NPMJS Error]:", error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.message;
      ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : ${errMsg}\n` + `└ ◦ *Command* : ${ctx.command || "npmjs"}\n\n` + `${footer}`);
    }
  }
};