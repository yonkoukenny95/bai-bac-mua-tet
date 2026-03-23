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

## Plan:
Bổ sung 1 số điều chỉnh:
- Thêm cho tôi ràng buộc mỗi ván chỉ chặt tối đa 2 heo đen và 2 heo đỏ thôi nhé, tránh nhập thừa. 
- Trong bước 3 lúc setup trận thì chỉ cần nhập điểm thắng tự tính ra điểm thua readonly field điểm thua.
- Sửa lỗi: trong 2 trường hợp tới trắng và tới nhất 3 bích không thấy trừ điểm tất cả các nhà kia dẫn đến kết quả sai.
- Trong trường hợp tới trắng thì không cần quan tâm thứ hạng nhất nhì ba. Chỉ tính điểm ăn trắng là được.
