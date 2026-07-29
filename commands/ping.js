const fs = require("fs");
const fsExtra = require("fs-extra");
const path = require("path");
const os = require("os");
const { DATA_DIR } = require("../utils/dataDir");
const { Threads } = require("../utils/database");

// Thư mục chứa ảnh sẽ gửi ngẫu nhiên kèm theo lệnh - tự thêm ảnh vào đây,
// bao nhiêu ảnh cũng được, bot tự chọn ngẫu nhiên 1 ảnh mỗi lần gõ lệnh.
const IMAGE_DIR = path.join(__dirname, "..", "assets", "images", "ping");
const IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".webp", ".gif"];

function formatUptime(ms) {
  const s = Math.floor(ms / 1000) % 60;
  const m = Math.floor(ms / 60000) % 60;
  const h = Math.floor(ms / 3600000) % 24;
  const d = Math.floor(ms / 86400000);
  return (d > 0 ? `${d} ngày ` : "") + `${h} giờ ${m} phút ${s} giây`;
}

function pickRandomImage() {
  try {
    const files = fs.readdirSync(IMAGE_DIR).filter(f =>
      IMAGE_EXTS.includes(path.extname(f).toLowerCase())
    );
    if (!files.length) return null;
    const chosen = files[Math.floor(Math.random() * files.length)];
    return path.join(IMAGE_DIR, chosen);
  } catch (e) {
    return null;
  }
}

// Ước lượng % CPU đang dùng dựa trên load trung bình hệ thống (os.loadavg).
// Đây là load trung bình toàn hệ thống, không phải riêng process Node - nếu
// bot bạn đã có sẵn hàm đo CPU chính xác hơn ở đâu đó (vd dùng process.cpuUsage()
// theo dõi liên tục), thay hàm này bằng hàm đó để chính xác hơn.
function getCpuUsagePercent() {
  const cores = os.cpus().length || 1;
  const load1min = os.loadavg()[0];
  const percent = (load1min / cores) * 100;
  return percent.toFixed(1);
}

function getRamUsageMB() {
  const mb = process.memoryUsage().rss / 1024 / 1024;
  return Math.round(mb);
}

// Tổng người dùng: đọc trực tiếp data/rank.json - đây là file DUY NHẤT trong
// bot này tự động thêm 1 user mới ngay khi họ nhắn tin lần đầu (qua
// Ranks.addExpOnChat gọi ở handler.js mỗi tin nhắn). File users.json trong
// utils/database.js KHÔNG dùng được vì chỉ ghi khi có ai đó dùng lệnh
// ban/title/steal - không phản ánh đúng tổng người dùng thật.
function getTotalUsers() {
  try {
    const rankData = fsExtra.readJsonSync(path.join(DATA_DIR, "rank.json"));
    return Object.keys(rankData).length;
  } catch (e) {
    return "?";
  }
}

// Tổng nhóm: gọi thẳng Facebook API (giống cách listgroup.js đang làm) để có
// số liệu THẬT (số nhóm bot đang thực sự còn ở trong), thay vì đếm file local
// (threads.json chỉ ghi khi dùng lệnh như !anti/!prefix, không đầy đủ).
async function getTotalThreads(api) {
  try {
    const inbox = await api.getThreadList(100, null, ["INBOX"]);
    return inbox.filter(t => t.isSubscribed && t.isGroup).length;
  } catch (e) {
    return "?";
  }
}

module.exports = {
  config: {
    name: "ping",
    aliases: ["upt"],
    version: "2.1",
    role: 0,
    description: "Xem thông tin hoạt động của bot kèm 1 ảnh ngẫu nhiên",
    usage: "ping",
    category: "Hệ thống"
  },
  run: async ({ api, event }) => {
    const { threadID, messageID } = event;
    const start = Date.now();

    const now = new Date();
    const dateStr = now.toLocaleDateString("vi-VN");
    const timeStr = now.toLocaleTimeString("vi-VN", { hour12: false });

    const uptime = formatUptime(Date.now() - global.client.timeStart);
    const threadData = Threads.get(threadID);
    const prefix = threadData.prefix || (global.config && global.config.PREFIX) || "/";
    const version = module.exports.config.version;
    const totalUsers = getTotalUsers();
    const totalThreads = await getTotalThreads(api);
    const cpu = getCpuUsagePercent();
    const ram = getRamUsageMB();
    const ping = Date.now() - start;

    const body =
      `📅 Hôm nay là: ${dateStr} || ${timeStr}\n` +
      `🤖 Bot đã hoạt động được ${uptime} ❤️.\n` +
      `⚔️ Prefix: ${prefix}\n` +
      `🔥 Version: ${version}\n` +
      `🐾 Tổng người dùng: ${totalUsers}\n` +
      `🐾 Tổng Nhóm: ${totalThreads}\n` +
      `⚡ Cpu đang sử dụng: ${cpu}\n` +
      `⚠️ Ram đang sử dụng: ${ram} MB\n` +
      `🟩 Ping: ${ping}ms`;

    const imagePath = pickRandomImage();
    const messageData = imagePath
      ? { body, attachment: fs.createReadStream(imagePath) }
      : body;

    return api.sendMessage(messageData, threadID, messageID);
  }
};