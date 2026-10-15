import axios from "axios";
import FormData from "form-data";
import {
  fileTypeFromBuffer
} from "file-type";
export function formatBytes(bytes) {
  try {
    if (!bytes || bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + (sizes?.[i] || "Bytes");
  } catch {
    return "0 Bytes";
  }
}
export async function upload(buffer) {
  if (!Buffer.isBuffer(buffer)) {
    return {
      status: false,
      message: "Input harus berupa Buffer."
    };
  }
  const type = await fileTypeFromBuffer(buffer);
  const ext = type?.ext || "jpg";
  const mime = type?.mime || "image/jpeg";
  const filename = `upload_${Date.now()}.${ext}`;
  try {
    const form = new FormData();
    form.append("files[]", buffer, {
      filename: filename,
      contentType: mime
    });
    const response = await axios.post("https://pone.rs/upload.php", form, {
      headers: {
        ...form.getHeaders(),
        Origin: "https://pone.rs",
        Referer: "https://pone.rs/",
        "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36"
      },
      timeout: 25e3
    });
    const fileData = response?.data?.files?.[0] || null;
    const directUrl = fileData?.url || null;
    if (response?.data?.success && directUrl) {
      return {
        status: true,
        url: directUrl,
        filename: fileData.filename || filename,
        hash: fileData.hash || null,
        size: fileData.size || buffer.length,
        formattedSize: formatBytes(fileData.size || buffer.length),
        ext: ext,
        mime: mime
      };
    }
  } catch (err) {}
  try {
    const fallbackRes = await axios.put("https://put.icu/upload/", buffer, {
      headers: {
        Accept: "application/json",
        "Content-Type": mime,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
      },
      timeout: 25e3
    });
    const directUrl = fallbackRes.data?.direct_url || fallbackRes.data?.url || null;
    if (directUrl) {
      return {
        status: true,
        url: directUrl,
        filename: filename,
        hash: null,
        size: buffer.length,
        formattedSize: formatBytes(buffer.length),
        ext: ext,
        mime: mime
      };
    }
  } catch (err) {}
  return {
    status: false,
    message: "Gagal mengunggah media ke server hosting."
  };
}
export default upload;