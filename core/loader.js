import fs from "fs";
import path from "path";
import {
  pathToFileURL
} from "url";
import chokidar from "chokidar";
import chalk from "chalk";
export class CommandLoader {
  constructor(opts = {}) {
    this.pluginsDir = path.resolve(opts.dir || path.join(process.cwd(), "plugins"));
    this.logger = opts.logger || console;
    this.commandMap = new Map();
    this.fileMap = new Map();
    this.beforeHandlers = [];
    this.watcher = null;
    this._timers = new Map();
    global.loader = this;
    global.cmd = this;
    this._ensureDir();
  }
  _ensureDir() {
    try {
      if (!fs.existsSync(this.pluginsDir)) {
        fs.mkdirSync(this.pluginsDir, {
          recursive: true
        });
      }
    } catch (_) {}
  }
  get commands() {
    return this.commandMap;
  }
  async _importFresh(filePath) {
    const href = pathToFileURL(filePath).href + `?t=${Date.now()}`;
    return import(href);
  }
  _normalize(exported, filePath) {
    if (!exported) return [];
    if (typeof exported === "function") {
      const fn = exported;
      const folderName = path.basename(path.dirname(filePath));
      const helpNames = Array.isArray(fn.help) ? fn.help : fn.help ? [fn.help] : [];
      const primaryName = helpNames[0] || (typeof fn.command === "string" ? fn.command : fn.command || fn.help ? path.basename(filePath, ".js") : null);
      const isOwnerCmd = Boolean(fn.owner || fn.rowner);
      return [{
        name: primaryName ? String(primaryName).toLowerCase() : null,
        aliases: helpNames.slice(1).map(a => String(a).toLowerCase()),
        description: fn.description || "",
        example: fn.example || "",
        category: fn.tags?.[0] || fn.category || (folderName !== "plugins" ? folderName : "General"),
        tags: fn.tags || [],
        help: helpNames,
        cooldown: Number(fn.cooldown) || 0,
        limit: Boolean(fn.limit),
        premium: Boolean(fn.premium),
        register: Boolean(fn.register),
        owner: isOwnerCmd,
        group: Boolean(fn.group),
        private: Boolean(fn.private),
        admin: Boolean(fn.admin),
        botAdmin: Boolean(fn.botAdmin),
        nsfw: Boolean(fn.nsfw),
        command: fn.command || null,
        before: fn.before || null,
        execute: async (sock, ctx, msg) => {
          const cleanSenderNumber = String(ctx.senderNumber || ctx.sender || "").split("@")[0].split(":")[0].replace(/\D/g, "");
          const rawOwners = [...Array.isArray(global.bot?.owner) ? global.bot.owner.flat(Infinity) : [global.bot?.owner], global.bot?.author?.number].filter(Boolean);
          const owners = rawOwners.map(v => String(v).split("@")[0].split(":")[0].replace(/\D/g, ""));
          const isOwner = ctx.isOwner === true || msg.key?.fromMe || ctx.isFromMe || owners.includes(cleanSenderNumber) || global.db?.user?.[ctx.sender]?.ownerAcces === true;
          if (fn.command instanceof RegExp) {
            const withoutPrefix = ctx.prefix ? (ctx.text || "").slice(ctx.prefix.length).trim() : (ctx.text || "").trim();
            fn.command.lastIndex = 0;
            if (!fn.command.test(withoutPrefix.split(" ")[0])) return;
            fn.command.lastIndex = 0;
          }
          await fn(msg, {
            sock: sock,
            ctx: ctx,
            db: {
              data: global.db?.cmd || {}
            },
            args: ctx.args || [],
            text: ctx.query || "",
            command: ctx.cmd,
            usedPrefix: ctx.prefix || "",
            isOwner: isOwner,
            isROwner: isOwner
          });
        },
        _raw: fn,
        filePath: filePath
      }];
    }
    if (typeof exported === "object" && !Array.isArray(exported)) {
      const cmd = exported;
      const folderName = path.basename(path.dirname(filePath));
      const category = cmd.category || (folderName !== "plugins" ? folderName : "General");
      const isOwnerCmd = Boolean(cmd.owner || cmd.rowner);
      const executeFn = typeof cmd.execute === "function" ? cmd.execute : typeof cmd.run === "function" ? cmd.run : null;
      const beforeFn = typeof cmd.before === "function" ? cmd.before : null;
      if (!executeFn && !beforeFn) return [];
      const name = cmd.name ? String(cmd.name).toLowerCase() : executeFn ? path.basename(filePath, ".js").toLowerCase() : null;
      const rawAliases = Array.isArray(cmd.aliases) ? cmd.aliases : cmd.aliases ? [cmd.aliases] : [];
      const aliases = rawAliases.map(a => String(a).toLowerCase());
      return [{
        name: name,
        aliases: aliases,
        description: cmd.description || "",
        example: cmd.example || "",
        category: category,
        tags: cmd.tags || [],
        help: cmd.help || (name ? [name] : []),
        cooldown: Number(cmd.cooldown) || 0,
        limit: Boolean(cmd.limit),
        premium: Boolean(cmd.premium),
        register: Boolean(cmd.register),
        owner: isOwnerCmd,
        group: Boolean(cmd.group),
        private: Boolean(cmd.private),
        admin: Boolean(cmd.admin),
        botAdmin: Boolean(cmd.botAdmin),
        nsfw: Boolean(cmd.nsfw),
        command: cmd.command || null,
        before: beforeFn,
        execute: executeFn,
        _raw: cmd,
        filePath: filePath
      }];
    }
    if (Array.isArray(exported)) {
      return exported.flatMap(e => this._normalize(e, filePath));
    }
    return [];
  }
  async loadPlugin(filePath) {
    filePath = path.resolve(filePath);
    try {
      const mod = await this._importFresh(filePath);
      const exported = mod?.default ?? mod;
      await this.unloadPlugin(filePath);
      const cmds = this._normalize(exported, filePath);
      if (!cmds.length) return;
      const registeredKeys = [];
      for (const cmd of cmds) {
        if (typeof cmd.before === "function") {
          this.beforeHandlers.push({
            filePath: filePath,
            fn: cmd.before
          });
        }
        if (cmd.name && typeof cmd.execute === "function") {
          const name = cmd.name;
          if (!this.commandMap.has(name)) {
            this.commandMap.set(name, cmd);
            registeredKeys.push(name);
          }
          for (const al of cmd.aliases) {
            if (!this.commandMap.has(al)) {
              this.commandMap.set(al, cmd);
              registeredKeys.push(al);
            }
          }
        }
      }
      this.fileMap.set(filePath, registeredKeys);
      const label = registeredKeys.length ? registeredKeys.join(", ") : "before/middleware";
      this.logger.log(chalk.hex("#10B981")(`[✓ LOADED] `) + chalk.hex("#94A3B8")(path.relative(this.pluginsDir, filePath)) + chalk.hex("#F59E0B")(` (${label})`));
    } catch (e) {
      this.logger.error(chalk.redBright(`[✗ ERROR] ${path.relative(this.pluginsDir, filePath)}: ${e.message}`));
    }
  }
  async unloadPlugin(filePath) {
    filePath = path.resolve(filePath);
    const keys = this.fileMap.get(filePath);
    if (keys) {
      for (const key of keys) {
        const entry = this.commandMap.get(key);
        if (entry?.filePath === filePath) {
          this.commandMap.delete(key);
        }
      }
    }
    this.beforeHandlers = this.beforeHandlers.filter(b => b.filePath !== filePath);
    this.fileMap.delete(filePath);
  }
  async reloadPlugin(filePath) {
    filePath = path.resolve(filePath);
    await this.unloadPlugin(filePath);
    await this.loadPlugin(filePath);
  }
  _walkDir(dir) {
    const results = [];
    if (!fs.existsSync(dir)) return results;
    try {
      const entries = fs.readdirSync(dir, {
        withFileTypes: true
      });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results.push(...this._walkDir(full));
        } else if (entry.isFile() && entry.name.endsWith(".js")) {
          results.push(full);
        }
      }
    } catch (_) {}
    return results;
  }
  async loadAll() {
    this._ensureDir();
    const files = this._walkDir(this.pluginsDir);
    for (const f of files) {
      await this.loadPlugin(f);
    }
  }
  _debounce(key, fn, ms = 200) {
    if (this._timers.has(key)) clearTimeout(this._timers.get(key));
    const t = setTimeout(() => {
      this._timers.delete(key);
      fn();
    }, ms);
    this._timers.set(key, t);
  }
  watch() {
    if (this.watcher) return;
    this._ensureDir();
    this.watcher = chokidar.watch(this.pluginsDir, {
      ignoreInitial: true,
      persistent: true,
      depth: 5,
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100
      }
    });
    this.watcher.on("add", fp => {
      if (fp.endsWith(".js")) this._debounce(fp, () => this.loadPlugin(fp));
    }).on("change", fp => {
      if (fp.endsWith(".js")) this._debounce(fp, () => this.reloadPlugin(fp));
    }).on("unlink", fp => {
      if (fp.endsWith(".js")) this._debounce(fp, () => this.unloadPlugin(fp));
    });
  }
  getCommand(name) {
    if (!name) return undefined;
    return this.commandMap.get(String(name).toLowerCase());
  }
  getCommandByRegex(text) {
    for (const [, cmd] of this.commandMap) {
      if (cmd.command instanceof RegExp) {
        cmd.command.lastIndex = 0;
        if (cmd.command.test(text)) return cmd;
      }
    }
    return undefined;
  }
  listCommands() {
    return [...new Set(this.commandMap.keys())];
  }
  getCommandsByCategory() {
    const cats = {};
    const seen = new Set();
    for (const [, cmd] of this.commandMap) {
      if (!cmd.name || seen.has(cmd.name)) continue;
      seen.add(cmd.name);
      const cat = cmd.category || "General";
      if (!cats[cat]) cats[cat] = [];
      cats[cat].push({
        name: cmd.name,
        aliases: cmd.aliases || [],
        description: cmd.description,
        example: cmd.example,
        premium: cmd.premium,
        limit: cmd.limit
      });
    }
    return cats;
  }
  getBeforeHandlers() {
    return this.beforeHandlers;
  }
}