# MiraiBot Clean

Bản viết lại **hoàn toàn mới**, gọn nhẹ, không phụ thuộc sqlite/sequelize, thay bằng lưu trữ JSON đơn giản.
Đã bỏ toàn bộ các lệnh 18+/NSFW. Chỉ giữ các lệnh cốt lõi, đã kiểm tra chạy đúng logic.

## 1. Cài đặt

```bash
npm install
```

## 2. Đăng nhập Facebook (lấy appstate)

Bot dùng `@dongdev/fca-unofficial` — cần file `cookie.txt` chứa **appstate dạng JSON** (không phải chuỗi cookie thường).

Cách lấy appstate phổ biến: dùng extension trình duyệt như "c3c-fbstate" hoặc các tool export appstate JSON có sẵn trên GitHub, đăng nhập Facebook trên trình duyệt rồi export ra JSON, dán toàn bộ nội dung vào `cookie.txt`.

⚠️ Lưu ý quan trọng:
- Nên dùng tài khoản Facebook phụ, không dùng tài khoản chính — tài khoản có thể bị Facebook khóa vì đây là API không chính thức (không được Facebook cho phép), vi phạm Điều khoản dịch vụ của Meta.
- Không chia sẻ file `cookie.txt` cho ai — ai có file này có thể đăng nhập vào tài khoản Facebook của bạn.

## 3. Cấu hình `config.json`

```json
{
  "PREFIX": "!",
  "BOT_NAME": "MiraiBot",
  "ADMIN_BOT": ["UID_CUA_BAN"],
  "OPENWEATHER_KEY": "" 
}
```

- `ADMIN_BOT`: điền UID Facebook của bạn để có toàn quyền admin bot (dùng lệnh `uid` để lấy UID).
- `OPENWEATHER_KEY`: (tuỳ chọn) lấy free tại https://openweathermap.org/api để dùng lệnh `weather`.

## 4. Chạy bot

```bash
npm start
```

`index.js` sẽ tự khởi động lại `mirai.js` tối đa 5 lần nếu bot bị crash.

## 5. Danh sách lệnh đã tạo lại (sạch, không NSFW)

| Lệnh | Quyền | Mô tả |
|---|---|---|
| help | Mọi người | Danh sách lệnh / chi tiết 1 lệnh |
| ping | Mọi người | Đo độ trễ phản hồi |
| uptime | Mọi người | Thời gian bot đã chạy |
| info | Mọi người | Thông tin bot |
| prefix | Mọi người xem / QTV đổi | Xem/đổi prefix riêng theo nhóm |
| uid | Mọi người | Lấy UID bản thân / người tag / người reply |
| gid | Mọi người | Lấy ID nhóm hiện tại |
| avatar | Mọi người | Lấy ảnh đại diện Facebook |
| rules | Mọi người xem / QTV đặt | Nội quy nhóm |
| trans | Mọi người | Dịch văn bản (Google Translate) |
| weather | Mọi người | Xem thời tiết (cần API key) |
| kick | QTV nhóm | Kick thành viên |
| add | QTV nhóm | Thêm người vào nhóm bằng UID |
| setname | QTV nhóm | Đổi tên nhóm |
| admin | Admin bot | Quản lý danh sách admin bot |

Ngoài ra có 2 event tự động: `welcome` (chào thành viên mới) và `leave` (báo khi có người rời nhóm) — có thể tắt trong `config.json` (`welcomeEvent`, `leaveEvent`).

## 6. Cách viết thêm lệnh mới

Tạo file mới trong `commands/`, theo mẫu:

```js
module.exports = {
  config: {
    name: "tenlenh",
    aliases: [],
    role: 0, // 0 = mọi người, 1 = QTV nhóm, 2 = admin bot
    description: "...",
    usage: "tenlenh <tham số>",
    category: "..."
  },
  run: async ({ api, event, args, Threads, Users }) => {
    // logic của lệnh
  }
};
```

Bot sẽ tự động nạp lại khi khởi động lại — không cần sửa file nào khác.

## 7. Vì sao bản cũ (MiraiV3-ShinBot) bị lỗi nhiều?

Bản gốc có gần 500 lệnh, phần lớn gọi API/tên miền của bên thứ 3 (glitch.me, repl.co, các domain .tk/.ga...) — nhiều dịch vụ này đã đóng cửa vĩnh viễn nên lệnh không thể hoạt động được nữa, không phải do code bot sai. Bản mới này bỏ hết các lệnh phụ thuộc domain "chết", chỉ giữ lại các lệnh dùng API còn sống (Facebook Graph API, Google Translate, OpenWeatherMap) hoặc không cần API ngoài, và viết lại toàn bộ phần xử lý lệnh/sự kiện cho gọn, dễ bảo trì và mở rộng.
