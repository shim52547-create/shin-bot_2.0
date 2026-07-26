/**
 * scripts/write-cookie.js
 *
 * Thay thế phần logic ghi cookies.txt trong entrypoint.sh (bản Docker cũ).
 * Nếu có biến môi trường YT_COOKIE (nội dung cookie YouTube dạng Netscape
 * cookie file, dùng cho yt-dlp), ghi nó ra file cookies.txt ở thư mục gốc
 * project. Nếu không có thì bỏ qua — lệnh "ytb" vẫn chạy được nhưng không
 * có cookie (dễ bị YouTube trả 403 hơn khi tải nhạc).
 *
 * Chạy tự động trước khi start (xem "prestart" trong package.json), và
 * cũng được require() ở đầu index.js để chắc chắn chạy dù bạn khởi động
 * app bằng cách nào (node index.js, pm2, systemd, ...).
 */

const fs = require("fs");
const path = require("path");

const COOKIES_PATH = path.join(__dirname, "..", "cookies.txt");

function writeCookieFromEnv() {
  const ytCookie = process.env.YT_COOKIE;

  if (ytCookie && ytCookie.trim().length > 0) {
    fs.writeFileSync(COOKIES_PATH, ytCookie.endsWith("\n") ? ytCookie : `${ytCookie}\n`, "utf8");
    console.log(`[write-cookie] Đã ghi YT_COOKIE ra ${COOKIES_PATH}`);
  } else {
    console.log("[write-cookie] Không có biến môi trường YT_COOKIE, bỏ qua.");
  }
}

writeCookieFromEnv();

module.exports = { writeCookieFromEnv, COOKIES_PATH };
