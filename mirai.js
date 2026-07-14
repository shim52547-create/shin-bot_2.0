const fs = require("fs-extra");
const path = require("path");
const moment = require("moment-timezone");
const login = require("@dongdev/fca-unofficial");
const logger = require("./utils/log");
const { MessageCount } = require("./utils/messageCount");

global.config = require("./config.json");
global.utils = require("./utils/func");
global.client = {
  commands: new Map(),
  events: new Map(),
  timeStart: Date.now(),
  handleReply: [] // hàng đợi chờ reply cho các lệnh dạng "reply số/lựa chọn" (vd: help, sing)
};

// ==== Nạp toàn bộ lệnh trong thư mục /commands ====
function loadCommands() {
  const dir = path.join(__dirname, "commands");
  const files = fs.readdirSync(dir).filter(f => f.endsWith(".js"));
  for (const file of files) {
    try {
      const command = require(path.join(dir, file));
      if (!command.config?.name || !command.run) {
        logger.warn(`Bỏ qua "${file}": thiếu config.name hoặc hàm run`, "LOADER");
        continue;
      }
      global.client.commands.set(command.config.name.toLowerCase(), command);
    } catch (err) {
      logger.error(`Lỗi nạp lệnh "${file}": ${err.message}`, "LOADER");
    }
  }
  logger.success(`Đã nạp ${global.client.commands.size} lệnh`, "LOADER");
}

// ==== Nạp toàn bộ event trong thư mục /events ====
function loadEvents() {
  const dir = path.join(__dirname, "events");
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir).filter(f => f.endsWith(".js"));
  for (const file of files) {
    try {
      const evt = require(path.join(dir, file));
      if (!evt.config?.name || !evt.run) {
        logger.warn(`Bỏ qua "${file}": thiếu config.name hoặc hàm run`, "LOADER");
        continue;
      }
      global.client.events.set(evt.config.name.toLowerCase(), evt);
    } catch (err) {
      logger.error(`Lỗi nạp event "${file}": ${err.message}`, "LOADER");
    }
  }
  logger.success(`Đã nạp ${global.client.events.size} event`, "LOADER");
}

function readAppState() {
  // Ưu tiên đọc appstate từ biến môi trường FB_APPSTATE (dùng khi deploy Render/GitHub,
  // vì cookie.txt bị .gitignore và không tồn tại trên server). Dán nguyên nội dung JSON
  // appstate vào 1 biến môi trường duy nhất trên Render > Environment.
  if (process.env.FB_APPSTATE) {
    try {
      const parsed = JSON.parse(process.env.FB_APPSTATE);
      if (Array.isArray(parsed)) {
        logger.info("Đang đăng nhập bằng appstate từ biến môi trường FB_APPSTATE.", "LOGIN");
        return parsed;
      }
    } catch (err) {
      logger.error("FB_APPSTATE (biến môi trường) không phải JSON hợp lệ.", "LOGIN");
      process.exit(1);
    }
  }

  const cookiePath = path.join(__dirname, "cookie.txt");
  if (!fs.existsSync(cookiePath)) {
    logger.error("Không tìm thấy cookie.txt và cũng không có biến môi trường FB_APPSTATE. Hãy đăng nhập Facebook và dán cookie (JSON appstate hoặc chuỗi cookie thường) vào file cookie.txt, hoặc đặt biến môi trường FB_APPSTATE.", "LOGIN");
    process.exit(1);
  }
  const raw = fs.readFileSync(cookiePath, "utf8").trim();

  // Trường hợp 1: đã là JSON appstate (mảng object cookie) -> dùng luôn
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch (err) {
    // không phải JSON -> rơi xuống trường hợp 2
  }

  // Trường hợp 2: chuỗi cookie thường copy từ DevTools/extension (dạng "c_user=..; xs=..; datr=..")
  if (raw.includes("=") && raw.includes(";")) {
    logger.info("Phát hiện cookie.txt là chuỗi cookie thường, đang tự chuyển sang appstate...", "LOGIN");
    const converted = global.utils.parseCookies(raw);
    if (converted.length > 0) return converted;
  }

  logger.error("cookie.txt không hợp lệ. Hãy dán JSON appstate hoặc chuỗi cookie dạng \"c_user=...; xs=...; datr=...\".", "LOGIN");
  process.exit(1);
}

const COUNT_MEDAL = ["🥇", "🥈", "🥉"];

// ==== Lên lịch thông báo bảng xếp hạng nhắn tin lúc 0h hàng ngày ====
function scheduleDailyCountAnnouncement(api) {
  function msUntilNextMidnight() {
    const now = moment.tz("Asia/Ho_Chi_Minh");
    const next = now.clone().add(1, "day").startOf("day");
    return next.diff(now);
  }

  async function announceAndReset() {
    try {
      // Lấy top của TỪNG nhóm dựa trên dữ liệu ngày vừa kết thúc, đồng thời reset về ngày mới
      const results = MessageCount.snapshotAndResetAll(10);
      for (const { threadID, top } of results) {
        try {
          let userInfo = {};
          try {
            userInfo = await api.getUserInfo(top.map(t => t.userID));
          } catch (e) {
            userInfo = {};
          }

          let msg = `📊 TOP NHẮN TIN HÔM QUA\n——————————————\n`;
          top.forEach((entry, i) => {
            const name = userInfo[entry.userID]?.name || `UID ${entry.userID}`;
            const rankIcon = COUNT_MEDAL[i] || `${i + 1}.`;
            msg += `${rankIcon} ${name} — ${entry.count} tin nhắn\n`;
          });
          msg += `——————————————\n🔄 Bảng xếp hạng đã được làm mới cho ngày hôm nay.`;

          await api.sendMessage(msg.trim(), threadID);
        } catch (err) {
          logger.error(`Lỗi gửi thông báo top count cho nhóm ${threadID}: ${err.message}`, "COUNT_JOB");
        }
      }
      logger.success(`Đã thông báo top nhắn tin cho ${results.length} nhóm.`, "COUNT_JOB");
    } catch (err) {
      logger.error(`Lỗi chạy job thông báo top count: ${err.message}`, "COUNT_JOB");
    } finally {
      // Hẹn giờ lại cho lần 0h kế tiếp (tránh lệch giờ tích lũy do dùng setInterval cố định)
      setTimeout(announceAndReset, msUntilNextMidnight());
    }
  }

  setTimeout(announceAndReset, msUntilNextMidnight());
  logger.info("Đã lên lịch thông báo top nhắn tin vào 0h hàng ngày.", "COUNT_JOB");
}

function start() {
  loadCommands();
  loadEvents();

  const appState = readAppState();

  login({ appState }, (err, api) => {
    if (err) {
      logger.error(`Đăng nhập thất bại: ${JSON.stringify(err)}`, "LOGIN");
      return process.exit(1);
    }

    api.setOptions(global.config.FCAOption || {});
    global.client.api = api;

    // Lưu lại appstate mới nhất để tránh bị đăng xuất (chỉ có tác dụng lâu dài khi chạy
    // local hoặc khi Render có gắn Persistent Disk — ổ đĩa mặc định của Render là ephemeral,
    // ghi vẫn thành công nhưng sẽ mất sau mỗi lần redeploy/restart. Nếu bạn chạy bằng
    // FB_APPSTATE, thỉnh thoảng nên lấy lại appstate mới và cập nhật lại biến môi trường đó).
    try {
      fs.writeFileSync(path.join(__dirname, "cookie.txt"), JSON.stringify(api.getAppState(), null, 2));
    } catch (err) {
      logger.warn(`Không ghi được cookie.txt (bình thường nếu ổ đĩa chỉ đọc): ${err.message}`, "LOGIN");
    }

    const handleMessage = require("./includes/handler")({ api });
    const handleEventLog = require("./includes/eventHandler")({ api });

    function mqttCallback(err, event) {
      if (err) {
        logger.error(err.message || String(err), "LISTEN");
        return;
      }

      // Debug: bật "debug": true trong config.json để xem MỌI event nhận được
      // (hữu ích khi bot có vẻ "im lặng" không phản hồi lệnh gì cả)
      if (global.config.debug) {
        logger.info(
          `type=${event.type} threadID=${event.threadID} senderID=${event.senderID} body=${JSON.stringify(event.body || "").slice(0, 80)}`,
          "DEBUG"
        );
      }

      if (event.type === "message" || event.type === "message_reply") {
        handleMessage(event);
      } else if (event.type === "event") {
        handleEventLog(event);
      }
    }

    function connectMqtt() {
      // MQTT của fca-unofficial có thể âm thầm rớt kết nối mà không báo lỗi gì cả
      // (bot vẫn hiện "READY" nhưng không nhận tin nhắn mới nữa).
      // Nên chủ động ngắt và kết nối lại định kỳ mỗi 1 giờ để phòng trường hợp này.
      if (global.client.stopListening) global.client.stopListening();
      global.client.stopListening = api.listenMqtt(mqttCallback);
      global.client.mqttTimer = setTimeout(connectMqtt, 60 * 60 * 1000);
      logger.success("Đã kết nối MQTT, bắt đầu lắng nghe tin nhắn.", "MQTT");
    }

    connectMqtt();
    scheduleDailyCountAnnouncement(api);

    logger.success(`Bot "${global.config.BOT_NAME}" đã sẵn sàng!`, "READY");
  });
}

start();