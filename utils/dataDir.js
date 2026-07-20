const fs = require("fs-extra");
const path = require("path");

// ==== Thư mục lưu dữ liệu (tiền, rank, thuê nhóm, ...) ====
// Ưu tiên biến môi trường DATA_DIR (dùng khi deploy Render + gắn Persistent Disk, ví dụ
// mount disk vào "/var/data" rồi đặt DATA_DIR=/var/data trong Environment của Render).
// Nếu không có, fallback về thư mục "data" cạnh code (dùng khi chạy local) — LƯU Ý: nếu
// chạy trên Render mà KHÔNG set DATA_DIR + KHÔNG gắn Persistent Disk, dữ liệu ghi vào đây
// sẽ mất mỗi lần bot redeploy/restart (ổ đĩa Render là ephemeral).
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, "..", "data");

fs.ensureDirSync(DATA_DIR);

module.exports = { DATA_DIR };
