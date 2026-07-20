# Hướng dẫn đưa MiraiBot-Clean lên GitHub rồi deploy qua Render

## 1. Việc đã sửa sẵn trong lần này (để an toàn khi public code)

- `commands/ask.js`: đọc Gemini API key từ biến môi trường `GEMINI_API_KEY` trước, fallback về key cũ nếu chưa set (khuyên **xoá fallback + tạo key mới** vì key cũ đã từng lộ trong code).
- `commands/weather.js`: đọc `OPENWEATHER_KEY` từ biến môi trường trước, fallback `config.json`.
- `mirai.js`: đọc appstate Facebook từ biến môi trường `FB_APPSTATE` trước, fallback file `cookie.txt` (dùng khi chạy local). Việc ghi lại `cookie.txt` sau khi login được bọc `try/catch` để không crash bot nếu ổ đĩa server không lưu được lâu dài.
- `.gitignore`: loại bỏ thêm các thư mục cache/temp và các file `*-player-script.js` (cache trình phát YouTube, mỗi file ~2.4MB, không cần thiết trong repo).
- `render.yaml`: file blueprint để Render tự dựng service đúng loại (Background Worker) khi bạn kết nối repo.

## 2. Trước khi `git push` — checklist bảo mật

- [ ] **Thu hồi/tạo lại Gemini API key mới** tại https://aistudio.google.com/apikey (key cũ trong code đã lộ, coi như không an toàn nữa dù bạn xoá khỏi code).
- [ ] Xác nhận `cookie.txt` KHÔNG nằm trong `git status` (đã có trong `.gitignore`).
- [ ] Xác nhận `data/*.json` (tiền, rank, users...) không bị đẩy lên — cũng đã gitignore.
- [ ] Repo nên để **Private** trên GitHub, vì đây là bot thương mại + từng có key rò rỉ trong lịch sử code — Private giúp giảm rủi ro dù đã dọn sạch.

## 3. Đẩy code lên GitHub

```bash
cd MiraiBot-Clean
git init                                   # nếu chưa có git
git add .
git commit -m "Chuẩn bị deploy lên Render"
git branch -M main
git remote add origin https://github.com/<username>/<ten-repo>.git
git push -u origin main
```

Nếu trước đó bạn đã từng commit `cookie.txt` hoặc key thật vào lịch sử git (kể cả khi giờ đã xoá khỏi file), **lịch sử cũ vẫn còn trong repo** — cần dùng `git filter-repo` hoặc đơn giản nhất là tạo repo Git mới hoàn toàn sạch nếu nghi ngờ đã từng lộ.

## 4. Deploy trên Render

### Cách nhanh — dùng Blueprint có sẵn (`render.yaml`)
1. Vào https://dashboard.render.com → **New** → **Blueprint**.
2. Chọn repo GitHub vừa push, Render tự đọc `render.yaml` và tạo sẵn 1 service loại **Background Worker**.
3. Điền 3 biến môi trường được yêu cầu: `FB_APPSTATE`, `GEMINI_API_KEY`, `OPENWEATHER_KEY`.

### Cách thủ công (nếu không dùng Blueprint)
1. **New** → **Background Worker** (không chọn "Web Service" — bot này không mở cổng HTTP nào, chỉ giữ kết nối MQTT với Facebook).
2. Kết nối repo GitHub.
3. Build Command: `npm install`
4. Start Command: `npm start`
5. Vào tab **Environment** → thêm:
   - `FB_APPSTATE` — dán nguyên nội dung JSON appstate (mở file `cookie.txt` hiện tại, copy toàn bộ nội dung dạng mảng JSON, paste vào đây).
   - `GEMINI_API_KEY`
   - `OPENWEATHER_KEY` (nếu dùng lệnh weather)
6. Chọn gói **Starter** trở lên (xem phần 5 bên dưới — free tier không phù hợp cho loại bot này).

## 5. Vài điều cần biết về hạ tầng Render (ảnh hưởng trực tiếp đến bot)

- **Free tier trên Render không có cho Background Worker** — free tier chỉ áp dụng cho 1 Web Service (và service đó tự "ngủ" sau 15 phút không có request HTTP). Bot Messenger cần chạy 24/7 để giữ kết nối MQTT nhận tin nhắn, nên cần chọn loại **Background Worker trả phí** (gói Starter, khoảng $7/tháng tại thời điểm mình kiểm tra — Render có thể đổi giá, nên kiểm tra lại trang pricing chính thức trước khi đăng ký).
- **Ổ đĩa là ephemeral (tạm thời)**: mỗi lần bạn redeploy hoặc Render tự khởi động lại service, toàn bộ file ghi ra ổ đĩa trong lúc chạy (appstate mới, `data/*.json` — tiền, rank, users...) sẽ **mất hết**, quay về đúng những gì có trong code + biến môi trường lúc build.
  - Muốn giữ dữ liệu `data/*.json` (tiền, rank...) qua các lần redeploy, cần mua thêm **Persistent Disk** trong Render và chỉnh code trỏ đường dẫn ghi dữ liệu vào ổ đó (mình có thể làm phần này nếu bạn muốn, khá nhiều file `utils/*.js` cần sửa đường dẫn).
  - Appstate refresh cũng vậy — nếu Facebook cấp appstate mới trong lúc bot chạy, bot vẫn ghi ra `cookie.txt` (không lỗi) nhưng lần redeploy sau sẽ không dùng bản mới đó, vẫn quay lại `FB_APPSTATE` bạn khai báo ban đầu. Nếu sau một thời gian bot bị đăng xuất, cách xử lý là đăng nhập lại thủ công và cập nhật lại biến môi trường `FB_APPSTATE`.

Cho mình biết nếu bạn muốn mình làm luôn phần **Persistent Disk cho `data/`** (để tiền/rank của người dùng không bị reset mỗi lần bạn cập nhật code) — đây là việc nên làm trước khi thật sự cho thuê, vì reset tiền/rank sẽ khiến khách hàng khó chịu.
