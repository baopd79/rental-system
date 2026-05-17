# Import all models here so Alembic can detect them for autogenerate
from app.models.property import Property  # noqa: F401
from app.models.room import Room  # noqa: F401
from app.models.tenant import Tenant  # noqa: F401
from app.models.contract import Contract  # noqa: F401
from app.models.utility import UtilityReading  # noqa: F401
from app.models.surcharge import SurchargeTemplate  # noqa: F401
from app.models.invoice import Invoice, InvoiceItem  # noqa: F401
