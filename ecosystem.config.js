/**
 * ecosystem.config.js
 *
 * Cấu hình PM2 — dùng để giữ bot chạy nền, tự khởi động lại khi crash,
 * và tự chạy lại sau khi reboot server. Đây là phần thay thế cho việc
 * Docker/Render tự restart container khi trước đây bot chạy trong Docker.
 *
 * Cài PM2 (một lần, toàn cục):
 *   npm install -g pm2
 *
 * Chạy bot:
 *   pm2 start ecosystem.config.js
 *   pm2 logs mirai-bot        # xem log
 *   pm2 restart mirai-bot     # khởi động lại thủ công
 *   pm2 stop mirai-bot        # dừng
 *
 * Tự chạy lại sau khi server reboot:
 *   pm2 startup      # làm theo hướng dẫn nó in ra (chạy lệnh sudo được gợi ý)
 *   pm2 save         # lưu lại danh sách process hiện tại
 */

module.exports = {
  apps: [
    {
      name: "mirai-bot",
      script: "index.js",
      cwd: __dirname,
      // index.js tự spawn mirai.js và tự restart nội bộ khi mirai.js crash
      // (xem MAX_RESTART trong index.js), nên PM2 chỉ cần restart khi cả
      // tiến trình index.js chết hẳn.
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      watch: false,
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
