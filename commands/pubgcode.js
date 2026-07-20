const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const { JSDOM } = require("jsdom");
const logger = require("../utils/log");

// ==== Lưu trữ: danh sách code đã biết + danh sách nhóm đã bật thông báo ====
const { DATA_DIR } = require("../utils/dataDir");
const FILE = path.join(DATA_DIR, "pubgCodes.json");

fs.ensureDirSync(DATA_DIR);
if (!fs.existsSync(FILE)) fs.writeJsonSync(FILE, { codes: {}, subs: [] });

function readData() {
  try { return fs.readJsonSync(FILE); } catch (e) { return { codes: {}, subs: [] }; }
}
function writeData(data) {
  fs.writeJsonSync(FILE, data, { spaces: 2 });
}

// ==== Cấu hình nguồn ====
// Sửa/thêm bớt trong config.json field "PUBG_CODE_SOURCES" (mảng URL) nếu muốn.
// Mặc định để tạm 1-2 nguồn — BẠN NÊN TỰ KIỂM TRA VÀ THAY BẰNG NGUỒN BẠN THẤY ĐÁNG TIN,
// vì các trang tổng hợp tiếng Việt hay lẫn code cũ/hết hạn/code PUBG Mobile vào chung.
const DEFAULT_SOURCES = [
  "https://vnesports.net/giftcode-pubg-pc"
];

function getSources() {
  const cfg = global.config.PUBG_CODE_SOURCES;
  return Array.isArray(cfg) && cfg.length ? cfg : DEFAULT_SOURCES;
}

// Chu kỳ kiểm tra (phút) — chỉnh qua config.json "PUBG_CODE_CHECK_MINUTES"
function getIntervalMs() {
  const mins = Number(global.config.PUBG_CODE_CHECK_MINUTES) || 30;
  return Math.max(mins, 5) * 60 * 1000; // tối thiểu 5 phút để tránh spam nguồn
}

// Regex nhận diện chuỗi giống "code": chữ hoa + số, 6-20 ký tự, không toàn số, không phải từ thường gặp
const CODE_RE = /^[A-Z0-9]{6,20}$/;
const BLOCKLIST = new Set(["PUBG", "STEAM", "BATTLEGROUNDS", "REDEEM"]);

function looksLikeCode(token) {
  const t = token.trim();
  if (!CODE_RE.test(t)) return false;
  if (BLOCKLIST.has(t)) return false;
  if (/^\d+$/.test(t)) return false; // toàn số thì bỏ
  if (!/[0-9]/.test(t) && t.length < 8) return false; // toàn chữ mà ngắn thì dễ bị nhầm với từ thường
  return true;
}

async function fetchCandidateCodes(url) {
  const res = await axios.get(url, {
    timeout: 15000,
    headers: { "User-Agent": "Mozilla/5.0 (compatible; MiraiBot/1.0)" }
  });
  const dom = new JSDOM(res.data);
  const doc = dom.window.document;

  // Code thường được in đậm (<strong>/<b>) hoặc nằm trong <li>, <code>
  const nodes = [...doc.querySelectorAll("strong, b, code, li")];
  const found = new Set();
  for (const node of nodes) {
    const text = node.textContent || "";
    // Tách theo dấu câu/khoảng trắng để bắt riêng phần trông giống code
    const tokens = text.split(/[\s,:;()\/]+/).filter(Boolean);
    for (const tok of tokens) {
      const clean = tok.replace(/[*_.]/g, "");
      if (looksLikeCode(clean)) found.add(clean);
    }
  }
  return [...found];
}

async function checkForNewCodes({ manual = false } = {}) {
  const data = readData();
  const newlyFound = [];

  for (const url of getSources()) {
    try {
      const candidates = await fetchCandidateCodes(url);
      for (const code of candidates) {
        if (!data.codes[code]) {
          data.codes[code] = { source: url, addedAt: Date.now() };
          newlyFound.push(code);
        }
      }
    } catch (err) {
      logger.warn(`[pubgcode] Lỗi lấy dữ liệu từ ${url}: ${err.message}`, "PUBGCODE");
    }
  }

  if (newlyFound.length) writeData(data);

  if (newlyFound.length && global.client.api) {
    const msg =
      `🎮 PUBG (Steam) vừa có ${newlyFound.length} code mới:\n` +
      newlyFound.map(c => `• ${c}`).join("\n") +
      `\n\nNhập tại: https://redeem.pubg.com (đăng nhập tài khoản Steam của bạn rồi dán code vào).`;

    for (const threadID of data.subs) {
      global.client.api.sendMessage(msg, threadID).catch(() => {});
    }
  }

  return newlyFound;
}

// ==== Vòng lặp kiểm tra định kỳ ====
// Guard bằng global để tránh bị nạp lại nhiều lần setInterval nếu file được require lại.
if (!global.__pubgCodeIntervalStarted) {
  global.__pubgCodeIntervalStarted = true;
  // Chờ 20s đầu để chắc chắn bot đã login xong (global.client.api sẵn sàng) rồi mới bắt đầu vòng lặp.
  setTimeout(() => {
    checkForNewCodes().catch(err => logger.error(`[pubgcode] ${err.message}`, "PUBGCODE"));
    setInterval(() => {
      checkForNewCodes().catch(err => logger.error(`[pubgcode] ${err.message}`, "PUBGCODE"));
    }, getIntervalMs());
  }, 20000);
}

module.exports = {
  config: {
    name: "pubgcode",
    aliases: ["codepubg", "pubg"],
    version: "1.0",
    role: 0,
    description: "Tổng hợp code PUBG (Steam) và tự động báo khi có code mới",
    usage: "pubgcode | pubgcode on | pubgcode off | pubgcode check (admin bot)",
    category: "Tiện ích"
  },
  run: async ({ api, event, args }) => {
    const { threadID, messageID, senderID } = event;
    const sub = (args[0] || "").toLowerCase();
    const data = readData();

    if (sub === "on" || sub === "off") {
      // Chỉ QTV nhóm hoặc admin bot mới được bật/tắt thông báo cho cả nhóm
      const threadInfo = await api.getThreadInfo(threadID).catch(() => null);
      const isGroupAdmin =
        threadInfo?.adminIDs?.some(a => a.id === senderID) ||
        global.config.ADMIN_BOT.includes(senderID);
      if (!isGroupAdmin) {
        return api.sendMessage("⛔ Chỉ quản trị viên nhóm mới được bật/tắt thông báo code PUBG.", threadID, messageID);
      }

      const already = data.subs.includes(threadID);
      if (sub === "on") {
        if (!already) data.subs.push(threadID);
        writeData(data);
        return api.sendMessage("✅ Đã bật thông báo code PUBG (Steam) mới cho nhóm này.", threadID, messageID);
      } else {
        data.subs = data.subs.filter(id => id !== threadID);
        writeData(data);
        return api.sendMessage("🔕 Đã tắt thông báo code PUBG (Steam) cho nhóm này.", threadID, messageID);
      }
    }

    if (sub === "check") {
      if (!global.config.ADMIN_BOT.includes(senderID)) {
        return api.sendMessage("⛔ Lệnh này chỉ dành cho admin bot.", threadID, messageID);
      }
      api.sendMessage("🔄 Đang kiểm tra code mới...", threadID, messageID);
      const found = await checkForNewCodes({ manual: true });
      return api.sendMessage(
        found.length ? `✅ Tìm thấy ${found.length} code mới: ${found.join(", ")}` : "ℹ️ Không có code mới nào.",
        threadID, messageID
      );
    }

    // Mặc định: liệt kê các code đang biết (mới nhất trước), tối đa 15 mã
    const list = Object.entries(data.codes)
      .sort((a, b) => b[1].addedAt - a[1].addedAt)
      .slice(0, 15)
      .map(([code]) => `• ${code}`);

    if (!list.length) {
      return api.sendMessage(
        "ℹ️ Chưa có code PUBG (Steam) nào được ghi nhận. Dùng \"pubgcode on\" để nhóm này nhận thông báo khi có code mới.",
        threadID, messageID
      );
    }

    return api.sendMessage(
      `🎮 Code PUBG (Steam) gần đây:\n${list.join("\n")}\n\nNhập tại: https://redeem.pubg.com\n\n` +
      `Bật thông báo tự động cho nhóm: pubgcode on`,
      threadID, messageID
    );
  }
};
