# HTTP Status Cheatsheet

Cheatsheet các HTTP status thường gặp khi thiết kế REST API/FastAPI.

## 2xx Success

### 200 OK

Dùng khi request thành công và có response body.

Thường gặp:

- `GET /properties` trả danh sách nhà trọ.
- `GET /properties/{property_id}` trả chi tiết nhà trọ.
- `PATCH /properties/{property_id}` trả object sau khi update.

```python
@router.get("/{property_id}", response_model=PropertyRead)
```

### 201 Created

Dùng khi tạo mới resource thành công.

Thường gặp:

- `POST /properties` tạo nhà trọ mới.
- `POST /rooms` tạo phòng mới.
- `POST /invoices/generate` tạo hóa đơn mới.

```python
from fastapi import status

@router.post("", response_model=PropertyRead, status_code=status.HTTP_201_CREATED)
```

### 204 No Content

Dùng khi request thành công nhưng không trả response body.

Thường gặp:

- `DELETE /properties/{property_id}` xóa thành công.
- `DELETE /rooms/{room_id}` xóa thành công.

```python
from fastapi import status

@router.delete("/{property_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_property(...):
    await service.delete_property(...)
```

Lưu ý: endpoint `204` không nên `return` data.

## 3xx Redirection

### 301 Moved Permanently

Dùng khi URL cũ đã chuyển vĩnh viễn sang URL mới.

Ít dùng trong backend API nội bộ, thường gặp hơn ở web server/reverse proxy.

### 302 Found

Dùng khi redirect tạm thời.

Thường gặp:

- OAuth/login flow.
- Redirect user từ URL public sang trang thanh toán/portal.

### 304 Not Modified

Dùng cho caching. Server báo client rằng resource chưa thay đổi, client có thể dùng cache.

Thường gặp với static assets hoặc endpoint có ETag/Last-Modified.

## 4xx Client Errors

### 400 Bad Request

Dùng khi request sai về mặt logic hoặc format chung, server không xử lý được.

Thường gặp:

- Query params sai combination.
- Body hợp lệ về schema nhưng sai business input tổng quát.

Ví dụ:

```text
GET /invoices?from_date=2026-06-01&to_date=2026-05-01
```

### 401 Unauthorized

Dùng khi user chưa xác thực hoặc token không hợp lệ.

Thường gặp:

- Thiếu `Authorization` header.
- Access token expired.
- Token signature sai.

Ý nghĩa thực tế: "Bạn cần đăng nhập lại."

### 403 Forbidden

Dùng khi user đã xác thực nhưng không có quyền truy cập resource.

Thường gặp:

- User A truy cập property của User B.
- Tenant/user không có role admin nhưng gọi endpoint admin.

```python
if prop.clerk_user_id != clerk_user_id:
    raise ForbiddenException()
```

Ý nghĩa thực tế: "Bạn đã đăng nhập, nhưng không được phép làm việc này."

### 404 Not Found

Dùng khi resource không tồn tại.

Thường gặp:

- `GET /properties/999` nhưng property không tồn tại.
- `GET /rooms/999` nhưng room không tồn tại.

```python
if not prop:
    raise NotFoundException("Property not found")
```

### 405 Method Not Allowed

Dùng khi path tồn tại nhưng HTTP method không được hỗ trợ.

Ví dụ API chỉ có:

```text
GET /properties/{property_id}
```

Nhưng client gọi:

```text
POST /properties/{property_id}
```

FastAPI thường tự trả lỗi này.

### 409 Conflict

Dùng khi request hợp lệ nhưng xung đột với trạng thái hiện tại của hệ thống.

Thường gặp:

- Tạo property trùng tên trong cùng user.
- Xóa property khi vẫn còn rooms.
- Tạo contract cho room đang có contract active.

```python
if await repo.get_by_name(clerk_user_id, data.name):
    raise ConflictException("Tên nhà trọ đã tồn tại")
```

### 422 Unprocessable Entity

Dùng khi request body/query/path không pass validation schema.

Thường gặp trong FastAPI:

- `property_id` cần `int` nhưng client gửi `abc`.
- Field required bị thiếu.
- Decimal/rate bị gửi sai kiểu.
- Validator Pydantic raise `ValueError`.

Ví dụ:

```json
{
  "name": "",
  "default_elec_rate": -1
}
```

FastAPI/Pydantic thường tự trả `422`.

### 429 Too Many Requests

Dùng khi client bị rate limit.

Thường gặp:

- Gửi quá nhiều request login.
- Gọi API public quá tần suất cho phép.
- Spam endpoint report payment.

## 5xx Server Errors

### 500 Internal Server Error

Dùng khi server gặp lỗi không mong đợi.

Thường gặp:

- Bug trong code.
- Unhandled exception.
- Data state không được xử lý đúng.

Không nên chủ động raise `500` cho business error. Hãy dùng `400`, `403`, `404`, `409`, hoặc `422` nếu phù hợp.

### 502 Bad Gateway

Dùng khi gateway/proxy nhận response lỗi từ upstream service.

Thường gặp:

- Nginx/Load balancer không nối được backend.
- Backend crash hoặc response invalid.

### 503 Service Unavailable

Dùng khi service tạm thời không sẵn sàng.

Thường gặp:

- Bảo trì hệ thống.
- Database/downstream service đang down.
- Server quá tải tạm thời.

### 504 Gateway Timeout

Dùng khi gateway/proxy chờ upstream quá lâu và timeout.

Thường gặp:

- Query database quá chậm.
- Gọi service ngoài quá lâu.
- Generate report/invoice batch bị treo.

## Quick Decision Table

| Tình huống | Status |
| --- | --- |
| Lấy data thành công | `200 OK` |
| Tạo resource thành công | `201 Created` |
| Xóa thành công, không trả body | `204 No Content` |
| Chưa đăng nhập/token sai | `401 Unauthorized` |
| Đã đăng nhập nhưng không có quyền | `403 Forbidden` |
| Không tìm thấy resource | `404 Not Found` |
| Trùng dữ liệu/xung đột trạng thái | `409 Conflict` |
| Sai validation schema | `422 Unprocessable Entity` |
| Quá nhiều request | `429 Too Many Requests` |
| Bug server/lỗi không mong đợi | `500 Internal Server Error` |

## FastAPI Conventions

- SHOULD import `status` từ FastAPI thay vì dùng raw numbers.
- SHOULD set `response_model` cho successful responses.
- MUST không return response body từ endpoint `204 No Content`.
- SHOULD để Pydantic/FastAPI xử lý validation errors thành `422`.
- SHOULD dùng domain exceptions cho các business errors thường gặp:
  - `NotFoundException` -> `404`
  - `ForbiddenException` -> `403`
  - `ConflictException` -> `409`
