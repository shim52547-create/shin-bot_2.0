const { spawn } = require("child_process");
const logger = require("./utils/log");

let restartCount = 0;
const MAX_RESTART = 5;

function startBot() {
  const child = spawn("node", ["mirai.js"], {
    cwd: __dirname,
    stdio: "inherit",
    shell: true
  });

  child.on("close", code => {
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
