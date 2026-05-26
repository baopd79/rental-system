from datetime import date
from sqlalchemy.exc import IntegrityError
from sqlmodel.ext.asyncio.session import AsyncSession
from app.models.room import Room
from app.schemas.room import ActiveContractInfo, RoomCreate, RoomRead, RoomUpdate
from app.repositories.room_repo import RoomRepo
from app.repositories.property_repo import PropertyRepo
from app.repositories.contract_repo import ContractRepo
from app.repositories.invoice_repo import InvoiceRepo
from app.core.exceptions import NotFoundException, ForbiddenException, ConflictException


class RoomService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.room_repo = RoomRepo(session)
        self.property_repo = PropertyRepo(session)
        self.contract_repo = ContractRepo(session)
        self.invoice_repo = InvoiceRepo(session)

    async def _get_property_owned(self, property_id: int, clerk_user_id: str):
        """Lấy property, raise 404/403 nếu không tồn tại hoặc không thuộc user."""
        prop = await self.property_repo.get_by_id(property_id)
        if not prop:
            raise NotFoundException("Property not found")
        if prop.clerk_user_id != clerk_user_id:
            raise ForbiddenException()
        return prop

    async def _get_room_owned(self, room_id: int, clerk_user_id: str):
        """Lấy room + property, raise 404/403 nếu không tồn tại hoặc property không thuộc user."""
        room = await self.room_repo.get_by_id(room_id)
        if not room:
            raise NotFoundException("Room not found")
        prop = await self.property_repo.get_by_id(room.property_id)
        if not prop or prop.clerk_user_id != clerk_user_id:
            raise ForbiddenException()
        return room, prop

    async def list_rooms(self, property_id: int, clerk_user_id: str) -> list[RoomRead]:
        """Trả danh sách phòng kèm active contract và trạng thái hóa đơn tháng hiện tại."""
        await self._get_property_owned(property_id, clerk_user_id)
        rooms = await self.room_repo.get_all_by_property(property_id)
        active = await self.contract_repo.get_active_by_property(property_id)

        current_period = date.today().strftime("%Y-%m")
        contract_ids = [c["id"] for c in active.values()]
        invoice_status_map = await self.invoice_repo.get_status_by_contracts(
            contract_ids, current_period
        )
        room_invoice: dict[int, str] = {
            room_id: invoice_status_map[c["id"]]
            for room_id, c in active.items()
            if c["id"] in invoice_status_map
        }

        result = []
        for r in rooms:
            read = RoomRead.model_validate(r)
            if r.id in active:
                c = active[r.id]
                read.active_contract = ActiveContractInfo(
                    id=c["id"],
                    tenant_name=c["tenant_name"],
                    agreed_rent=c["agreed_rent"],
                    start_date=c["start_date"],
                    end_date=c["end_date"],
                    num_people=c["num_people"],
                )
            read.current_invoice_status = room_invoice.get(r.id)
            result.append(read)
        return result

    async def get_room(self, room_id: int, clerk_user_id: str) -> RoomRead:
        """Lấy thông tin một phòng, không kèm contract hay invoice."""
        room, _ = await self._get_room_owned(room_id, clerk_user_id)
        return RoomRead.model_validate(room)

    async def create_room(
        self, property_id: int, data: RoomCreate, clerk_user_id: str
    ) -> RoomRead:
        """Tạo phòng mới, dùng IntegrityError để chặn trùng room_number thay vì pre-check."""
        await self._get_property_owned(property_id, clerk_user_id)
        room = Room(**data.model_dump(), property_id=property_id)
        try:
            created = await self.room_repo.create(room)
            await self.session.commit()
        except IntegrityError:
            await self.session.rollback()
            raise ConflictException(
                f"Room number '{data.room_number}' already exists in this property"
            )
        await self.session.refresh(created)
        return RoomRead.model_validate(created)

    async def update_room(
        self, room_id: int, data: RoomUpdate, clerk_user_id: str
    ) -> RoomRead:
        """Cập nhật partial các field của phòng, chặn trùng room_number qua IntegrityError."""
        room, _ = await self._get_room_owned(room_id, clerk_user_id)
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(room, field, value)
        try:
            updated = await self.room_repo.update(room)
            await self.session.commit()
        except IntegrityError:
            await self.session.rollback()
            room_num = data.room_number or room.room_number
            raise ConflictException(
                f"Room number '{room_num}' already exists in this property"
            )
        await self.session.refresh(updated)
        return RoomRead.model_validate(updated)

    async def delete_room(self, room_id: int, clerk_user_id: str) -> None:
        """Xóa phòng, chặn nếu còn hợp đồng liên quan."""
        room, _ = await self._get_room_owned(room_id, clerk_user_id)
        if await self.contract_repo.count_by_room(room_id):
            raise ConflictException("Cannot delete room with existing contracts")
        await self.room_repo.delete(room)
        await self.session.commit()
