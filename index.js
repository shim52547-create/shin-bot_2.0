const { spawn } = require("child_process");
const http = require("http");
const logger = require("./utils/log");

let restartCount = 0;
const MAX_RESTART = 5;
let botReady = false; // sẽ set true khi mirai.js in ra log "READY" (dò qua stdout)

// ==== HTTP server "ảo" chỉ để Render coi đây là Web Service + UptimeRobot có chỗ ping ====
// Server này KHÔNG liên quan gì tới việc bot nhận tin nhắn Messenger (bot vẫn chạy
// qua kết nối MQTT riêng trong mirai.js) — nó chỉ tồn tại để giữ service không bị
// Render coi là "không hoạt động" và bị spin down.
const PORT = process.env.PORT || 3000;
http
  .createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(botReady ? "MiraiBot dang chay OK" : "MiraiBot dang khoi dong...");
  })
  .listen(PORT, () => {
    logger.info(`HTTP ping server đang lắng nghe ở cổng ${PORT} (dùng cho UptimeRobot).`, "SUPERVISOR");
  });

function startBot() {
  const child = spawn("node", ["mirai.js"], {
    cwd: __dirname,
    stdio: ["inherit", "pipe", "inherit"], // "pipe" ở stdout để dò dòng log READY
    shell: true
  });

  child.stdout.on("data", chunk => {
    const text = chunk.toString();
    process.stdout.write(text); // vẫn in ra log bình thường như trước
    if (text.includes("đã sẵn sàng")) botReady = true;
  });

  child.on("close", code => {
    botReady = false;
    if (code !== 0 && restartCount < MAX_RESTART) {
      restartCount++;
      logger.warn(`Bot dừng với mã lỗi ${code}. Khởi động lại (${restartCount}/${MAX_RESTART})...`, "SUPERVISOR");
      setTimeout(startBot, 2000);
    } else if (restartCount >= MAX_RESTART) {
      logger.error("Đã khởi động lại quá nhiều lần. Dừng hẳn, vui lòng kiểm tra log lỗi phía trên.", "SUPERVISOR");
    }
  });

  child.on("error", err => {
    logger.error(`Không thể khởi động mirai.js: ${err.message}`, "SUPERVISOR");
  });
}

startBot();
