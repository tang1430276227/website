import json
import logging
from typing import List, Optional

from datetime import datetime, date

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.tenants import TenantsService

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/entities/tenants", tags=["tenants"])


# ---------- Pydantic Schemas ----------
class TenantsData(BaseModel):
    """Entity data schema (for create/update)"""
    name: str
    slug: str
    owner_user_id: str
    plan: str = None
    max_tokens_per_month: int = None
    is_active: bool = None


class TenantsUpdateData(BaseModel):
    """Update entity data (partial updates allowed)"""
    name: Optional[str] = None
    slug: Optional[str] = None
    owner_user_id: Optional[str] = None
    plan: Optional[str] = None
    max_tokens_per_month: Optional[int] = None
    is_active: Optional[bool] = None


class TenantsResponse(BaseModel):
    """Entity response schema"""
    id: int
    name: str
    slug: str
    owner_user_id: str
    plan: Optional[str] = None
    max_tokens_per_month: Optional[int] = None
    is_active: Optional[bool] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TenantsListResponse(BaseModel):
    """List response schema"""
    items: List[TenantsResponse]
    total: int
    skip: int
    limit: int


class TenantsBatchCreateRequest(BaseModel):
    """Batch create request"""
    items: List[TenantsData]


class TenantsBatchUpdateItem(BaseModel):
    """Batch update item"""
    id: int
    updates: TenantsUpdateData


class TenantsBatchUpdateRequest(BaseModel):
    """Batch update request"""
    items: List[TenantsBatchUpdateItem]


class TenantsBatchDeleteRequest(BaseModel):
    """Batch delete request"""
    ids: List[int]


# ---------- Routes ----------
@router.get("", response_model=TenantsListResponse)
async def query_tenantss(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    """Query tenantss with filtering, sorting, and pagination"""
    logger.debug(f"Querying tenantss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")
    
    service = TenantsService(db)
    try:
        # Parse query JSON if provided
        query_dict = None
        if query:
            try:
                query_dict = json.loads(query)
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid query JSON format")
        
        result = await service.get_list(
            skip=skip, 
            limit=limit,
            query_dict=query_dict,
            sort=sort,
        )
        logger.debug(f"Found {result['total']} tenantss")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.warning(f"Invalid tenants query: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error querying tenantss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/all", response_model=TenantsListResponse)
async def query_tenantss_all(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    # Query tenantss with filtering, sorting, and pagination without user limitation
    logger.debug(f"Querying tenantss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")

    service = TenantsService(db)
    try:
        # Parse query JSON if provided
        query_dict = None
        if query:
            try:
                query_dict = json.loads(query)
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid query JSON format")

        result = await service.get_list(
            skip=skip,
            limit=limit,
            query_dict=query_dict,
            sort=sort
        )
        logger.debug(f"Found {result['total']} tenantss")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.warning(f"Invalid tenants query: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error querying tenantss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{id}", response_model=TenantsResponse)
async def get_tenants(
    id: int,
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    """Get a single tenants by ID"""
    logger.debug(f"Fetching tenants with id: {id}, fields={fields}")
    
    service = TenantsService(db)
    try:
        result = await service.get_by_id(id)
        if not result:
            logger.warning(f"Tenants with id {id} not found")
            raise HTTPException(status_code=404, detail="Tenants not found")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching tenants {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("", response_model=TenantsResponse, status_code=201)
async def create_tenants(
    data: TenantsData,
    db: AsyncSession = Depends(get_db),
):
    """Create a new tenants"""
    logger.debug(f"Creating new tenants with data: {data}")
    
    service = TenantsService(db)
    try:
        result = await service.create(data.model_dump())
        if not result:
            raise HTTPException(status_code=400, detail="Failed to create tenants")
        
        logger.info(f"Tenants created successfully with id: {result.id}")
        return result
    except ValueError as e:
        logger.error(f"Validation error creating tenants: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating tenants: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/batch", response_model=List[TenantsResponse], status_code=201)
async def create_tenantss_batch(
    request: TenantsBatchCreateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Create multiple tenantss in a single request"""
    logger.debug(f"Batch creating {len(request.items)} tenantss")
    
    service = TenantsService(db)
    results = []
    
    try:
        for item_data in request.items:
            result = await service.create(item_data.model_dump())
            if result:
                results.append(result)
        
        logger.info(f"Batch created {len(results)} tenantss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch create: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch create failed: {str(e)}")


@router.put("/batch", response_model=List[TenantsResponse])
async def update_tenantss_batch(
    request: TenantsBatchUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Update multiple tenantss in a single request"""
    logger.debug(f"Batch updating {len(request.items)} tenantss")
    
    service = TenantsService(db)
    results = []
    
    try:
        for item in request.items:
            # Only include non-None values for partial updates
            update_dict = {k: v for k, v in item.updates.model_dump().items() if v is not None}
            result = await service.update(item.id, update_dict)
            if result:
                results.append(result)
        
        logger.info(f"Batch updated {len(results)} tenantss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch update: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch update failed: {str(e)}")


@router.put("/{id}", response_model=TenantsResponse)
async def update_tenants(
    id: int,
    data: TenantsUpdateData,
    db: AsyncSession = Depends(get_db),
):
    """Update an existing tenants"""
    logger.debug(f"Updating tenants {id} with data: {data}")

    service = TenantsService(db)
    try:
        # Only include non-None values for partial updates
        update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
        result = await service.update(id, update_dict)
        if not result:
            logger.warning(f"Tenants with id {id} not found for update")
            raise HTTPException(status_code=404, detail="Tenants not found")
        
        logger.info(f"Tenants {id} updated successfully")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error updating tenants {id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating tenants {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/batch")
async def delete_tenantss_batch(
    request: TenantsBatchDeleteRequest,
    db: AsyncSession = Depends(get_db),
):
    """Delete multiple tenantss by their IDs"""
    logger.debug(f"Batch deleting {len(request.ids)} tenantss")
    
    service = TenantsService(db)
    deleted_count = 0
    
    try:
        for item_id in request.ids:
            success = await service.delete(item_id)
            if success:
                deleted_count += 1
        
        logger.info(f"Batch deleted {deleted_count} tenantss successfully")
        return {"message": f"Successfully deleted {deleted_count} tenantss", "deleted_count": deleted_count}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch delete: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch delete failed: {str(e)}")


@router.delete("/{id}")
async def delete_tenants(
    id: int,
    db: AsyncSession = Depends(get_db),
):
    """Delete a single tenants by ID"""
    logger.debug(f"Deleting tenants with id: {id}")
    
    service = TenantsService(db)
    try:
        success = await service.delete(id)
        if not success:
            logger.warning(f"Tenants with id {id} not found for deletion")
            raise HTTPException(status_code=404, detail="Tenants not found")
        
        logger.info(f"Tenants {id} deleted successfully")
        return {"message": "Tenants deleted successfully", "id": id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting tenants {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")