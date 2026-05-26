from decimal import Decimal


def strip_required(v: str) -> str:
    """Strip whitespace; raise if blank — dùng cho required string field."""
    v = v.strip()
    if not v:
        raise ValueError("must not be blank")
    return v


def strip_optional(v: str | None) -> str | None:
    """Strip whitespace; raise if blank — field bắt buộc có giá trị khi được gửi lên."""
    if v is None:
        return v
    v = v.strip()
    if not v:
        raise ValueError("must not be blank")
    return v


def strip_to_none(v: str | None) -> str | None:
    """Strip whitespace; chuyển blank/empty thành None — dùng cho truly optional field."""
    if v is None:
        return None
    v = v.strip()
    return v if v else None


def non_negative(v: object) -> object:
    """Reject giá trị âm — dùng cho tiền tệ (rent, deposit, rate)."""
    if v is not None and Decimal(str(v)) < 0:
        raise ValueError("must be >= 0")
    return v


def positive(v: object) -> object:
    """Reject giá trị <= 0 — dùng cho đại lượng phải dương (diện tích)."""
    if v is not None and Decimal(str(v)) <= 0:
        raise ValueError("must be > 0")
    return v
