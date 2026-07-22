import json
import logging
from typing import List, Optional

from datetime import datetime, date

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.tenant_members import Tenant_membersService

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/entities/tenant_members", tags=["tenant_members"])


# ---------- Pydantic Schemas ----------
class Tenant_membersData(BaseModel):
    """Entity data schema (for create/update)"""
    tenant_id: int
    role: str = None


class Tenant_membersUpdateData(BaseModel):
    """Update entity data (partial updates allowed)"""
    tenant_id: Optional[int] = None
    role: Optional[str] = None


class Tenant_membersResponse(BaseModel):
    """Entity response schema"""
    id: int
    tenant_id: int
    role: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class Tenant_membersListResponse(BaseModel):
    """List response schema"""
    items: List[Tenant_membersResponse]
    total: int
    skip: int
    limit: int


class Tenant_membersBatchCreateRequest(BaseModel):
    """Batch create request"""
    items: List[Tenant_membersData]


class Tenant_membersBatchUpdateItem(BaseModel):
    """Batch update item"""
    id: int
    updates: Tenant_membersUpdateData


class Tenant_membersBatchUpdateRequest(BaseModel):
    """Batch update request"""
    items: List[Tenant_membersBatchUpdateItem]


class Tenant_membersBatchDeleteRequest(BaseModel):
    """Batch delete request"""
    ids: List[int]


# ---------- Routes ----------
@router.get("", response_model=Tenant_membersListResponse)
async def query_tenant_memberss(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    """Query tenant_memberss with filtering, sorting, and pagination"""
    logger.debug(f"Querying tenant_memberss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")
    
    service = Tenant_membersService(db)
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
        logger.debug(f"Found {result['total']} tenant_memberss")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.warning(f"Invalid tenant_members query: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error querying tenant_memberss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/all", response_model=Tenant_membersListResponse)
async def query_tenant_memberss_all(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    # Query tenant_memberss with filtering, sorting, and pagination without user limitation
    logger.debug(f"Querying tenant_memberss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")

    service = Tenant_membersService(db)
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
        logger.debug(f"Found {result['total']} tenant_memberss")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.warning(f"Invalid tenant_members query: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error querying tenant_memberss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{id}", response_model=Tenant_membersResponse)
async def get_tenant_members(
    id: int,
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    """Get a single tenant_members by ID"""
    logger.debug(f"Fetching tenant_members with id: {id}, fields={fields}")
    
    service = Tenant_membersService(db)
    try:
        result = await service.get_by_id(id)
        if not result:
            logger.warning(f"Tenant_members with id {id} not found")
            raise HTTPException(status_code=404, detail="Tenant_members not found")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching tenant_members {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("", response_model=Tenant_membersResponse, status_code=201)
async def create_tenant_members(
    data: Tenant_membersData,
    db: AsyncSession = Depends(get_db),
):
    """Create a new tenant_members"""
    logger.debug(f"Creating new tenant_members with data: {data}")
    
    service = Tenant_membersService(db)
    try:
        result = await service.create(data.model_dump())
        if not result:
            raise HTTPException(status_code=400, detail="Failed to create tenant_members")
        
        logger.info(f"Tenant_members created successfully with id: {result.id}")
        return result
    except ValueError as e:
        logger.error(f"Validation error creating tenant_members: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating tenant_members: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/batch", response_model=List[Tenant_membersResponse], status_code=201)
async def create_tenant_memberss_batch(
    request: Tenant_membersBatchCreateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Create multiple tenant_memberss in a single request"""
    logger.debug(f"Batch creating {len(request.items)} tenant_memberss")
    
    service = Tenant_membersService(db)
    results = []
    
    try:
        for item_data in request.items:
            result = await service.create(item_data.model_dump())
            if result:
                results.append(result)
        
        logger.info(f"Batch created {len(results)} tenant_memberss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch create: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch create failed: {str(e)}")


@router.put("/batch", response_model=List[Tenant_membersResponse])
async def update_tenant_memberss_batch(
    request: Tenant_membersBatchUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Update multiple tenant_memberss in a single request"""
    logger.debug(f"Batch updating {len(request.items)} tenant_memberss")
    
    service = Tenant_membersService(db)
    results = []
    
    try:
        for item in request.items:
            # Only include non-None values for partial updates
            update_dict = {k: v for k, v in item.updates.model_dump().items() if v is not None}
            result = await service.update(item.id, update_dict)
            if result:
                results.append(result)
        
        logger.info(f"Batch updated {len(results)} tenant_memberss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch update: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch update failed: {str(e)}")


@router.put("/{id}", response_model=Tenant_membersResponse)
async def update_tenant_members(
    id: int,
    data: Tenant_membersUpdateData,
    db: AsyncSession = Depends(get_db),
):
    """Update an existing tenant_members"""
    logger.debug(f"Updating tenant_members {id} with data: {data}")

    service = Tenant_membersService(db)
    try:
        # Only include non-None values for partial updates
        update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
        result = await service.update(id, update_dict)
        if not result:
            logger.warning(f"Tenant_members with id {id} not found for update")
            raise HTTPException(status_code=404, detail="Tenant_members not found")
        
        logger.info(f"Tenant_members {id} updated successfully")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error updating tenant_members {id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating tenant_members {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/batch")
async def delete_tenant_memberss_batch(
    request: Tenant_membersBatchDeleteRequest,
    db: AsyncSession = Depends(get_db),
):
    """Delete multiple tenant_memberss by their IDs"""
    logger.debug(f"Batch deleting {len(request.ids)} tenant_memberss")
    
    service = Tenant_membersService(db)
    deleted_count = 0
    
    try:
        for item_id in request.ids:
            success = await service.delete(item_id)
            if success:
                deleted_count += 1
        
        logger.info(f"Batch deleted {deleted_count} tenant_memberss successfully")
        return {"message": f"Successfully deleted {deleted_count} tenant_memberss", "deleted_count": deleted_count}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch delete: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch delete failed: {str(e)}")


@router.delete("/{id}")
async def delete_tenant_members(
    id: int,
    db: AsyncSession = Depends(get_db),
):
    """Delete a single tenant_members by ID"""
    logger.debug(f"Deleting tenant_members with id: {id}")
    
    service = Tenant_membersService(db)
    try:
        success = await service.delete(id)
        if not success:
            logger.warning(f"Tenant_members with id {id} not found for deletion")
            raise HTTPException(status_code=404, detail="Tenant_members not found")
        
        logger.info(f"Tenant_members {id} deleted successfully")
        return {"message": "Tenant_members deleted successfully", "id": id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting tenant_members {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")