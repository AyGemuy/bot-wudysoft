import {
  simpleQuoted
} from "../../lib/quoted.js";
async function sendSmartCodeBlock(sock, ctx, jid, code, language = "javascript", options = {}) {
  const {
    header = "",
      footer = "",
      title = "Code Snippet",
      quoted = null
  } = options;
  if (typeof sock?.sendCodeBlockV2 === "function") {
    try {
      return await sock.sendCodeBlockV2(jid, code, quoted, {
        language: language,
        title: title,
        text: header,
        footer: footer
      });
    } catch (_) {}
  }
  if (typeof sock?.sendCodeBlock === "function") {
    try {
      return await sock.sendCodeBlock(jid, code, quoted, {
        language: language,
        title: title,
        footer: footer
      });
    } catch (_) {}
  }
  if (typeof sock?.airich === "function") {
    try {
      const builder = sock.airich();
      if (typeof builder.setTitle === "function" && title) builder.setTitle(title);
      if (typeof builder.addText === "function" && header) builder.addText(header);
      if (typeof builder.addCode === "function") builder.addCode(language, code);
      if (typeof builder.addText === "function" && footer) builder.addText(`\n${footer}`);
      if (typeof builder.send === "function") {
        return await builder.send(jid, {
          quoted: quoted
        });
      }
    } catch (_) {}
  }
  try {
    return await sock.sendMessage(jid, {
      aiRich: {
        language: language,
        code: code,
        header: header ? header.trim() : undefined,
        footer: footer ? footer.trim() : undefined
      }
    }, {
      quoted: quoted
    });
  } catch (_) {}
  if (typeof ctx?.sendCode === "function") {
    try {
      return await ctx.sendCode(code, language, {
        jid: jid,
        quoted: quoted,
        header: header,
        footer: footer,
        title: title
      });
    } catch (_) {}
  }
  const fallbackText = `${header ? `${header}\n\n` : ""}*\`\`\`${language}\n${code}\n\`\`\`*${footer ? `\n\n_${footer}_` : ""}`;
  return await sock.sendMessage(jid, {
    text: fallbackText
  }, {
    quoted: quoted
  });
}
export default {
  name: "code",
  aliases: ["snippet", "highlight", "codesnippet", "js"],
  description: "Format dan tampilkan blok kode dengan syntax highlighting (NOVA / Meta AI)",
  category: "Developer",
  execute: async (sock, ctx, msg) => {
    try {
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • Syntax Highlighter`;
      const supportedLanguages = ["javascript", "js", "typescript", "ts", "python", "py", "html", "css", "json", "php", "java", "cpp", "c", "csharp", "go", "golang", "rust", "sql", "bash", "sh", "markdown"];
      let language = "javascript";
      let codeContent = "";
      const quotedRaw = ctx.quoted?.text || ctx.quoted?.caption || ctx.quoted?.body;
      const quotedText = typeof quotedRaw === "string" ? quotedRaw.trim() : "";
      if (quotedText) {
        const firstArg = (ctx.args?.[0] || "").toLowerCase();
        if (supportedLanguages.includes(firstArg)) {
          language = firstArg;
        }
        codeContent = quotedText;
      } else if (ctx.query) {
        const lines = ctx.query.trim().split("\n");
        const firstWord = (lines[0].split(/\s+/)[0] || "").toLowerCase();
        if (supportedLanguages.includes(firstWord)) {
          language = firstWord;
          if (lines.length > 1) {
            codeContent = lines.slice(1).join("\n").trim();
          } else {
            codeContent = ctx.query.slice(firstWord.length).trim();
          }
        } else {
          codeContent = ctx.query.trim();
        }
      }
      if (!codeContent) {
        return ctx.reply(`–  *C O D E  S N I P P E T*

Format dan tampilkan blok kode dengan penyorotan sintaksis.

┌  ◦  *Format* : \`${prefix}code <bahasa> <kode>\`
│  ◦  *Reply Teks* : Balas pesan kode dengan \`${prefix}code [bahasa]\`
└  ◦  *Example* : \`${prefix}code js console.log("Hello World!");\`

–  *D A F T A R  B A H A S A*

js, ts, python, html, css, json, php, java, cpp, go, rust, sql, bash, markdown`);
      }
      await ctx.react?.("⏳");
      const langMap = {
        js: "javascript",
        ts: "typescript",
        py: "python",
        sh: "bash",
        golang: "go"
      };
      if (langMap[language]) language = langMap[language];
      codeContent = codeContent.replace(/^```[a-zA-Z]*\n?/, "").replace(/```$/, "").trim();
      const lineCount = codeContent.split("\n").length;
      const charCount = codeContent.length;
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
      const targetJid = ctx.chat || ctx.id;
      const headerText = `–  *${language.toUpperCase()}  S N I P P E T*

┌  ◦  *Language* : ${language}
│  ◦  *Lines* : ${lineCount} Baris
└  ◦  *Size* : ${charCount} Karakter`;
      await sendSmartCodeBlock(sock, ctx, targetJid, codeContent, language, {
        title: `${language.toUpperCase()} Code Snippet`,
        header: headerText,
        footer: `💡 ${botFooter}`,
        quoted: quotedMsg
      });
      await ctx.react?.("✨");
    } catch (error) {
      console.error("[Code Command Error]:", error);
      await ctx.react?.("❌");
      await ctx.reply(`❌ Code Highlighter Error: ${error?.message || error}`);
    }
  }
};