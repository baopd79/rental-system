from app.services.utility_service import _prev_period


# --- Pure function tests: _prev_period ---

def test_prev_period_normal():
    assert _prev_period("2026-05") == "2026-04"


def test_prev_period_january_wraps_to_december():
    assert _prev_period("2026-01") == "2025-12"


def test_prev_period_december():
    assert _prev_period("2026-12") == "2026-11"


def test_prev_period_march():
    assert _prev_period("2026-03") == "2026-02"


def test_prev_period_preserves_zero_padding():
    assert _prev_period("2026-10") == "2026-09"
