import fs from "fs";
import path from "path";
import {
  fileURLToPath
} from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const gameFolderPath = path.join(__dirname, "game");
export function getMiniGames() {
  try {
    if (!fs.existsSync(gameFolderPath)) {
      fs.mkdirSync(gameFolderPath, {
        recursive: true
      });
      return [];
    }
    const files = fs.readdirSync(gameFolderPath);
    return files.filter(file => file.endsWith(".html")).map(file => {
      const filePath = path.join(gameFolderPath, file);
      const htmlContent = fs.readFileSync(filePath, "utf-8");
      const fileName = file.replace(".html", "");
      const title = fileName.charAt(0).toUpperCase() + fileName.slice(1);
      return {
        title: title,
        html: htmlContent
      };
    });
  } catch (e) {
    console.error("[ERROR READ MINIGAME]:", e);
    return [];
  }
}