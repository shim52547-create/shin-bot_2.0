const axios = require("axios");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

/**
 * Tải nội dung từ 1 URL và trả về dạng stream để dùng làm attachment gửi qua Messenger.
 *
 * QUAN TRỌNG: fca-unofficial dùng gói "request" để upload file (postFormData),
 * và gói này/dep "form-data" dựa vào thuộc tính `.path` của stream để tự nhận
 * diện filename + content-type. Một `Readable` tạo thủ công (new Readable())
 * KHÔNG có `.path`, khiến Facebook nhận file upload không rõ định dạng và trả
 * về metadata rỗng/undefined — gây crash "Cannot convert undefined or null to
 * object" bên trong sendMessage.js (uploadAttachment) một cách ÂM THẦM, không
 * throw ra ngoài cho code gọi bắt được.
 *
 * Vì vậy ở đây ta tải file về ổ đĩa tạm rồi trả về fs.createReadStream, loại
 * stream này luôn có `.path` hợp lệ nên tương thích chuẩn với thư viện.
 *
 * @param {string} url
 * @returns {Promise<fs.ReadStream>}
 */
async function getStreamFromURL(url) {
  const res = await axios.get(url, { responseType: "arraybuffer" });

  // Cố đoán phần đuôi file từ content-type trả về, mặc định .jpg nếu không rõ
  const contentType = res.headers["content-type"] || "";
  const extMap = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/gif": ".gif",
    "image/webp": ".webp"
  };
  const ext = extMap[contentType] || ".jpg";

  const tmpFilePath = path.join(os.tmpdir(), `stream_${Date.now()}_${crypto.randomBytes(4).toString("hex")}${ext}`);
  fs.writeFileSync(tmpFilePath, Buffer.from(res.data));

  const stream = fs.createReadStream(tmpFilePath);
  // Tự dọn file tạm ngay sau khi đã đọc xong (không chặn stream đang dùng dở)
  stream.on("close", () => fs.unlink(tmpFilePath, () => {}));

  return stream;
}

/**
 * Chuyển 1 chuỗi cookie thường (dạng "c_user=123; xs=abc; datr=xyz")
 * — kiểu copy từ DevTools/Cookie-Editor — thành mảng appstate JSON
 * mà fca-unofficial cần (mỗi cookie kèm domain/path/...).
 * @param {string} cookieString
 * @returns {Array<object>}
 */
function parseCookies(cookieString) {
  const cleaned = cookieString.includes("useragent=")
    ? cookieString.split("useragent=")[0]
    : cookieString;

  return cleaned
    .split(";")
    .map(pair => {
      const [key, value] = pair.trim().split("=");
      if (value === undefined || !key) return undefined;
      return {
        key,
        value,
        domain: "facebook.com",
        path: "/",
        hostOnly: false,
        creation: new Date().toISOString(),
        lastAccessed: new Date().toISOString()
      };
    })
    .filter(Boolean);
}

module.exports = { getStreamFromURL, parseCookies };