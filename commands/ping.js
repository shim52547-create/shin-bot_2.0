const fs = require("fs");
const path = require("path");

const VIDEO_DIR = path.join(__dirname, "..", "assets", "pingvideo");
const VIDEO_EXTS = [".mp4", ".mov", ".mkv", ".webm", ".avi"];

const QUOTES = [
  "Nếu anh là kẹo, em xin ngọt cả đời.",
  "Gặp bạn là điều may mắn nhất hôm nay của mình.",
  "Chúc bạn một ngày tràn đầy năng lượng nha!",
  "Hôm nay bạn cười chưa? Cười lên cho đời thêm vui!",
  "Bot đang online, có bạn ghé qua là vui rồi.",
  "Chúc bạn luôn giữ được nụ cười như hôm nay."
];

function formatUptime(ms) {
  const s = Math.floor(ms / 1000) % 60;
  const m = Math.floor(ms / 60000) % 60;
  const h = Math.floor(ms / 3600000) % 24;
  const d = Math.floor(ms / 86400000);
  return (d > 0 ? `${d}d ` : "") + `${h}h ${m}m ${s}s`;
}

function pickRandomVideo() {
  try {
    const files = fs.readdirSync(VIDEO_DIR).filter(f =>
      VIDEO_EXTS.includes(path.extname(f).toLowerCase())
    );
    if (!files.length) return null;
    const chosen = files[Math.floor(Math.random() * files.length)];
    return path.join(VIDEO_DIR, chosen);
  } catch (e) {
    return null;
  }
}

module.exports = {
  config: {
    name: "ping",
    aliases: [],
    version: "2.0",
    role: 0,
    description: "Chào bạn, xem thời gian bot đã chạy và gửi 1 video ngẫu nhiên",
    usage: "ping",
    category: "Hệ thống"
  },
  run: async ({ api, event }) => {
    const { threadID, messageID, senderID } = event;
    const start = Date.now();

    let name = "bạn";
    try {
      const info = await api.getUserInfo(senderID);
      if (info?.[senderID]?.name) name = info[senderID].name;
    } catch (e) {
      // giữ nguyên tên mặc định nếu không lấy được
    }

    const uptime = formatUptime(Date.now() - global.client.timeStart);
    const quote = QUOTES[Math.floor(Math.random() * QUOTES.length)];
    const ping = Date.now() - start;

    const body =
      `🌸 Xin chào ${name}\n\n` +
      `⏰ Time: ${uptime}\n` +
      `🏓 Ping: ${ping}ms\n\n` +
      `💐 Thính: ${quote}`;

    const videoPath = pickRandomVideo();
    const messageData = videoPath
      ? { body, attachment: fs.createReadStream(videoPath) }
      : body;

    return api.sendMessage(messageData, threadID, messageID);
  }
};
