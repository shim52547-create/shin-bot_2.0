# Chạy bot bằng Node thuần (đã bỏ hẳn Docker)

Bản này **không còn Docker, không còn yt-dlp/python3/ffmpeg-CLI/deno** nữa.
Lệnh `ytb` (tải audio YouTube) giờ dùng thư viện JS thuần `youtubei.js`
(client kiểu ANDROID, không cần PoToken/BotGuard) thay vì gọi ra chương
trình ngoài, nên toàn bộ bot chỉ cần Node.js — không cần cài thêm bất kỳ
gói hệ thống nào, chạy được trên Render (Web Service / Node runtime bình
thường), Railway, VPS, hay máy cá nhân.

`Dockerfile`, `entrypoint.sh`, `.dockerignore`, `render.yaml`,
`scripts/install-system-deps.sh` của bản trước đã được xoá vì không còn cần.

## 1. Cài dependency

```bash
npm install
```

Không cần cài gì thêm ở cấp hệ điều hành (không python3, không ffmpeg CLI,
không deno). Package `@ffmpeg-installer/ffmpeg` (dùng cho lệnh
`soundcloud`) đã tự mang theo binary ffmpeg qua npm, không đụng tới hệ
thống.

## 2. Cấu hình biến môi trường

- `FB_APPSTATE` — JSON appstate Facebook (khuyên dùng khi deploy server; chạy local có thể dùng file `cookie.txt` thay thế, xem `mirai.js`).
- `GEMINI_API_KEY` — dùng cho lệnh `ask`.
- `OPENWEATHER_KEY` — dùng cho lệnh `weather`.

Biến `YT_COOKIE`/`cookies.txt` của bản yt-dlp cũ **không còn cần nữa** —
`scripts/write-cookie.js` vẫn còn trong repo (vô hại, chỉ ghi file nếu bạn
lỡ đặt `YT_COOKIE`) nhưng không có gì trong code dùng tới file đó nữa.

## 3. Chạy thử

```bash
npm start
```

`index.js` mở một HTTP server nhỏ ở cổng `PORT` (mặc định 3000, chỉ để
healthcheck cho Render/UptimeRobot) và spawn `mirai.js` — tiến trình giữ
kết nối MQTT thật sự với Facebook.

## 4. Deploy lên Render (không Docker)

1. Trên Render Dashboard → **New** → **Web Service** (không phải Blueprint/Docker).
2. Kết nối repo GitHub.
3. Runtime: **Node**.
4. Build Command: `npm install`
5. Start Command: `npm start`
6. Environment → thêm `FB_APPSTATE`, `GEMINI_API_KEY`, `OPENWEATHER_KEY`.

Vì `index.js` đã tự mở HTTP server, Render sẽ coi đây là Web Service hợp lệ
(có cổng lắng nghe) — không bị coi là "ngủ" miễn có traffic/ping định kỳ
(dùng UptimeRobot ping vào URL Render cấp, giống cách bản cũ đã làm).

## 5. Chạy nền + tự restart khi crash / reboot server (nếu tự host VPS)

### Cách A — PM2 (khuyên dùng)

```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 logs mirai-bot
pm2 save
pm2 startup   # in ra lệnh sudo cần chạy để PM2 tự khởi động sau khi reboot — chạy lệnh đó
```

### Cách B — systemd

Tạo file `/etc/systemd/system/mirai-bot.service`:

```ini
[Unit]
Description=Mirai Bot (Facebook Messenger Bot)
After=network.target

[Service]
Type=simple
WorkingDirectory=/duong/dan/toi/project
ExecStart=/usr/bin/node index.js
Restart=on-failure
RestartSec=3
Environment=FB_APPSTATE=...
Environment=GEMINI_API_KEY=...
Environment=OPENWEATHER_KEY=...

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now mirai-bot
sudo journalctl -u mirai-bot -f
```

## 6. Lưu ý về lệnh `ytb` sau khi đổi sang youtubei.js

- Không cần PoToken/cookie cho phần lớn video công khai, vì dùng client
  ANDROID (giống cách bản yt-dlp cũ né việc bị đòi "Sign in to confirm
  you're not a bot").
- Với video riêng tư, giới hạn tuổi, hoặc bị YouTube siết chặn hơn trong
  tương lai, `youtubei.js` có thể cần nâng cấp lên cơ chế PoToken (dùng
  `bgutils-js` + `jsdom`, cả hai đã có sẵn trong `package.json` từ trước)
  — báo lại nếu gặp lỗi cụ thể để bổ sung.
- File audio tải về có thể là `.m4a` hoặc `.webm` tuỳ định dạng YouTube
  cung cấp cho từng video, code tự chọn đuôi file tương ứng.
