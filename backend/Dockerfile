FROM python:3.12-slim

# Copy uv binary from official image (nhanh hơn install từ pip)
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# Copy dependency files trước để Docker cache layer này
# (nếu code thay đổi mà deps không đổi → không cần reinstall)
COPY pyproject.toml uv.lock ./

# Install dependencies (bỏ dev deps như pytest)
RUN uv sync --frozen --no-dev

# Copy toàn bộ source code
COPY . .

EXPOSE 8000

# Render inject biến PORT tự động; fallback về 8000 khi chạy local
CMD ["sh", "-c", "uv run alembic upgrade head && uv run uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
