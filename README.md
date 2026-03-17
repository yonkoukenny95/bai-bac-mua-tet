# Card Score Mini App

Mini app tính điểm Tiến Lên Miền Nam chạy bằng HTML, CSS, JavaScript và phù hợp để host trên GitHub Pages.

## Tính năng chính

- Setup 5 bước
- 2 mode tính điểm: bù trừ và cộng dồn
- Cấu hình điểm tới nhất, tới nhì, tới ba, tới bét
- Cấu hình bật/tắt và chỉnh điểm cho các case đặc biệt
- Cho phép chọn nhiều case đặc biệt trên cùng một người chơi
- Lưu trận hiện tại bằng localStorage
- Reset có xác nhận
- Mobile first
- Có manifest và service worker để dùng như PWA nhẹ

## Cách chạy local

Mở trực tiếp `index.html` hoặc dùng extension Live Server.

## Cách deploy GitHub Pages

1. Tạo repo GitHub mới
2. Upload toàn bộ file trong thư mục này lên nhánh `main`
3. Vào **Settings > Pages**
4. Chọn **Deploy from a branch**
5. Chọn branch `main` và thư mục `/ (root)`
6. Lưu lại và chờ GitHub Pages build

## Ghi chú

- PWA hoạt động tốt hơn khi chạy trên domain GitHub Pages hoặc domain HTTPS.
- localStorage chỉ lưu trận hiện tại trên đúng thiết bị và đúng trình duyệt đó.
