"""Base service class with shared CRUD logic and type coercion.

All entity services inherit from this base to eliminate code duplication.
The coercion logic uses a dispatch map instead of if/elif chains.
Try/except is only used around DB write operations that need rollback.
"""
import logging
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Callable, Dict, List, Optional, Type

from uuid import UUID as PythonUUID

from sqlalchemy import select, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.types import Boolean, Date, DateTime, Float, Integer, Numeric

logger = logging.getLogger(__name__)


# ---------- Coercion Functions (Map-dispatched) ----------

def _coerce_datetime(value: Any, column_type: Any, field_name: str) -> Any:
    """Coerce string to datetime."""
    if not isinstance(value, str):
        return value
    normalized = value.replace("Z", "+00:00")
    parsed = _parse_datetime_str(normalized, value, field_name)
    if not getattr(column_type, "timezone", False) and parsed.tzinfo is not None:
        parsed = parsed.replace(tzinfo=None)
    return parsed


def _parse_datetime_str(normalized: str, original: str, field_name: str) -> datetime:
    """Try ISO format first, then fallback format."""
    try:
        return datetime.fromisoformat(normalized)
    except ValueError:
        pass
    try:
        return datetime.strptime(original, "%Y-%m-%d %H:%M:%S")
    except ValueError:
        raise _invalid_field_value(field_name, original)


def _coerce_date(value: Any, column_type: Any, field_name: str) -> Any:
    """Coerce value to date."""
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        try:
            return date.fromisoformat(value)
        except ValueError:
            try:
                return datetime.fromisoformat(value.replace("Z", "+00:00")).date()
            except ValueError:
                raise _invalid_field_value(field_name, value)
    return value


def _coerce_boolean(value: Any, column_type: Any, field_name: str) -> Any:
    """Coerce string to boolean."""
    if not isinstance(value, str):
        return value
    TRUTHY = {"true", "1", "t", "yes", "y", "on"}
    FALSY = {"false", "0", "f", "no", "n", "off"}
    normalized = value.strip().lower()
    if normalized in TRUTHY:
        return True
    if normalized in FALSY:
        return False
    raise _invalid_field_value(field_name, value)


def _coerce_integer(value: Any, column_type: Any, field_name: str) -> Any:
    """Coerce string to integer."""
    if not isinstance(value, str):
        return value
    try:
        return int(value)
    except ValueError:
        raise _invalid_field_value(field_name, value)


def _coerce_float(value: Any, column_type: Any, field_name: str) -> Any:
    """Coerce string to float."""
    if not isinstance(value, str):
        return value
    try:
        return float(value)
    except ValueError:
        raise _invalid_field_value(field_name, value)


def _coerce_numeric(value: Any, column_type: Any, field_name: str) -> Any:
    """Coerce string to Decimal."""
    if not isinstance(value, str):
        return value
    try:
        return Decimal(value)
    except ArithmeticError:
        raise _invalid_field_value(field_name, value)


def _coerce_uuid(value: Any, column_type: Any, field_name: str) -> Any:
    """Coerce string to UUID if column has as_uuid=True."""
    if not isinstance(value, str):
        return value
    if not getattr(column_type, "as_uuid", False):
        return value
    try:
        return PythonUUID(value)
    except ValueError:
        raise _invalid_field_value(field_name, value)


def _invalid_field_value(field_name: str, value: Any) -> ValueError:
    return ValueError(f"Invalid value for field {field_name}: {value!r}")


# Type -> coercion function dispatch map
COERCION_MAP: Dict[type, Callable] = {
    DateTime: _coerce_datetime,
    Date: _coerce_date,
    Boolean: _coerce_boolean,
    Integer: _coerce_integer,
    Float: _coerce_float,
    Numeric: _coerce_numeric,
    PG_UUID: _coerce_uuid,
}


def coerce_field_value(column: Any, value: Any, field_name: str) -> Any:
    """Coerce a value to match the column's SQLAlchemy type using dispatch map."""
    if value is None:
        return value
    column_type = _extract_column_type(column)
    if column_type is None:
        return value
    coercer = _find_coercer(column_type)
    if coercer is None:
        return value
    return coercer(value, column_type, field_name)


def _extract_column_type(column: Any):
    """Safely extract the SQLAlchemy column type."""
    try:
        return column.property.columns[0].type
    except (AttributeError, IndexError):
        return None


def _find_coercer(column_type: Any) -> Optional[Callable]:
    """Find the matching coercion function from the dispatch map."""
    for type_class, coercer in COERCION_MAP.items():
        if isinstance(column_type, type_class):
            return coercer
    return None


# ---------- Sort Helper ----------

def apply_sort(query, model: Type, sort: Optional[str]):
    """Apply sort to a query. Returns the modified query."""
    if not sort:
        return query.order_by(model.id.desc())
    desc = sort.startswith('-')
    field_name = sort[1:] if desc else sort
    if not hasattr(model, field_name):
        return query.order_by(model.id.desc())
    col = getattr(model, field_name)
    return query.order_by(col.desc() if desc else col)


# ---------- Base Service ----------

class BaseService:
    """Generic CRUD service base class.

    Subclasses only need to set `model` class attribute.
    Ownership-aware: passes user_id for row-level filtering when provided.
    """

    model: Type = None  # Override in subclass

    def __init__(self, db: AsyncSession):
        self.db = db

    @property
    def _name(self) -> str:
        return self.model.__tablename__

    def _has_user_id(self) -> bool:
        return hasattr(self.model, 'user_id')

    async def create(self, data: Dict[str, Any], user_id: Optional[str] = None):
        """Create a new record. Rollback on failure."""
        if user_id and self._has_user_id():
            data['user_id'] = user_id
        obj = self.model(**data)
        self.db.add(obj)
        try:
            await self.db.commit()
            await self.db.refresh(obj)
        except Exception:
            await self.db.rollback()
            raise
        logger.info(f"Created {self._name} id={obj.id}")
        return obj

    async def get_by_id(self, obj_id: int, user_id: Optional[str] = None):
        """Get record by ID with optional ownership filter."""
        query = select(self.model).where(self.model.id == obj_id)
        if user_id and self._has_user_id():
            query = query.where(self.model.user_id == user_id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def check_ownership(self, obj_id: int, user_id: str) -> bool:
        """Check if user owns this record."""
        obj = await self.get_by_id(obj_id, user_id=user_id)
        return obj is not None

    async def get_list(
        self, skip: int = 0, limit: int = 20,
        user_id: Optional[str] = None,
        query_dict: Optional[Dict[str, Any]] = None,
        sort: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get paginated list with optional filters and sorting."""
        query = select(self.model)
        count_query = select(func.count(self.model.id))

        query, count_query = self._apply_ownership_filter(query, count_query, user_id)
        query, count_query = self._apply_query_filters(query, count_query, query_dict)

        total = (await self.db.execute(count_query)).scalar()
        query = apply_sort(query, self.model, sort)
        items = (await self.db.execute(query.offset(skip).limit(limit))).scalars().all()

        return {"items": items, "total": total, "skip": skip, "limit": limit}

    async def update(self, obj_id: int, update_data: Dict[str, Any], user_id: Optional[str] = None):
        """Update record. Rollback on failure."""
        obj = await self.get_by_id(obj_id, user_id=user_id)
        if not obj:
            return None
        protected = {'user_id', 'id'}
        for key, value in update_data.items():
            if hasattr(obj, key) and key not in protected:
                setattr(obj, key, value)
        try:
            await self.db.commit()
            await self.db.refresh(obj)
        except Exception:
            await self.db.rollback()
            raise
        logger.info(f"Updated {self._name} id={obj_id}")
        return obj

    async def delete(self, obj_id: int, user_id: Optional[str] = None) -> bool:
        """Delete record. Rollback on failure."""
        obj = await self.get_by_id(obj_id, user_id=user_id)
        if not obj:
            return False
        try:
            await self.db.delete(obj)
            await self.db.commit()
        except Exception:
            await self.db.rollback()
            raise
        logger.info(f"Deleted {self._name} id={obj_id}")
        return True

    async def get_by_field(self, field_name: str, field_value: Any):
        """Get single record by arbitrary field."""
        column = self._get_column(field_name)
        field_value = coerce_field_value(column, field_value, field_name)
        result = await self.db.execute(select(self.model).where(column == field_value))
        return result.scalar_one_or_none()

    async def list_by_field(
        self, field_name: str, field_value: Any, skip: int = 0, limit: int = 20
    ) -> List:
        """Get list of records filtered by field."""
        column = self._get_column(field_name)
        field_value = coerce_field_value(column, field_value, field_name)
        result = await self.db.execute(
            select(self.model).where(column == field_value)
            .offset(skip).limit(limit).order_by(self.model.id.desc())
        )
        return result.scalars().all()

    # ---------- Private Helpers ----------

    def _get_column(self, field_name: str):
        """Get column attribute or raise ValueError."""
        if not hasattr(self.model, field_name):
            raise ValueError(f"Field {field_name} does not exist on {self.model.__name__}")
        return getattr(self.model, field_name)

    def _apply_ownership_filter(self, query, count_query, user_id: Optional[str]):
        """Apply user_id filter if applicable."""
        if user_id and self._has_user_id():
            query = query.where(self.model.user_id == user_id)
            count_query = count_query.where(self.model.user_id == user_id)
        return query, count_query

    def _apply_query_filters(self, query, count_query, query_dict: Optional[Dict[str, Any]]):
        """Apply field-level filters from query_dict."""
        if not query_dict:
            return query, count_query
        for field, value in query_dict.items():
            if not hasattr(self.model, field):
                continue
            column = getattr(self.model, field)
            value = coerce_field_value(column, value, field)
            query = query.where(column == value)
            count_query = count_query.where(column == value)
        return query, count_query