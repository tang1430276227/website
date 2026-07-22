import json
import logging
from typing import List, Optional

from datetime import datetime, date

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.usage_records import Usage_recordsService

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/entities/usage_records", tags=["usage_records"])


# ---------- Pydantic Schemas ----------
class Usage_recordsData(BaseModel):
    """Entity data schema (for create/update)"""
    tenant_id: int = None
    conversation_id: int = None
    model: str
    provider: str = None
    prompt_tokens: int = None
    completion_tokens: int = None
    total_tokens: int = None
    cost_credits: float = None


class Usage_recordsUpdateData(BaseModel):
    """Update entity data (partial updates allowed)"""
    tenant_id: Optional[int] = None
    conversation_id: Optional[int] = None
    model: Optional[str] = None
    provider: Optional[str] = None
    prompt_tokens: Optional[int] = None
    completion_tokens: Optional[int] = None
    total_tokens: Optional[int] = None
    cost_credits: Optional[float] = None


class Usage_recordsResponse(BaseModel):
    """Entity response schema"""
    id: int
    tenant_id: Optional[int] = None
    conversation_id: Optional[int] = None
    model: str
    provider: Optional[str] = None
    prompt_tokens: Optional[int] = None
    completion_tokens: Optional[int] = None
    total_tokens: Optional[int] = None
    cost_credits: Optional[float] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class Usage_recordsListResponse(BaseModel):
    """List response schema"""
    items: List[Usage_recordsResponse]
    total: int
    skip: int
    limit: int


class Usage_recordsBatchCreateRequest(BaseModel):
    """Batch create request"""
    items: List[Usage_recordsData]


class Usage_recordsBatchUpdateItem(BaseModel):
    """Batch update item"""
    id: int
    updates: Usage_recordsUpdateData


class Usage_recordsBatchUpdateRequest(BaseModel):
    """Batch update request"""
    items: List[Usage_recordsBatchUpdateItem]


class Usage_recordsBatchDeleteRequest(BaseModel):
    """Batch delete request"""
    ids: List[int]


# ---------- Routes ----------
@router.get("", response_model=Usage_recordsListResponse)
async def query_usage_recordss(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    """Query usage_recordss with filtering, sorting, and pagination"""
    logger.debug(f"Querying usage_recordss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")
    
    service = Usage_recordsService(db)
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
        logger.debug(f"Found {result['total']} usage_recordss")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.warning(f"Invalid usage_records query: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error querying usage_recordss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/all", response_model=Usage_recordsListResponse)
async def query_usage_recordss_all(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    # Query usage_recordss with filtering, sorting, and pagination without user limitation
    logger.debug(f"Querying usage_recordss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")

    service = Usage_recordsService(db)
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
        logger.debug(f"Found {result['total']} usage_recordss")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.warning(f"Invalid usage_records query: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error querying usage_recordss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{id}", response_model=Usage_recordsResponse)
async def get_usage_records(
    id: int,
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    """Get a single usage_records by ID"""
    logger.debug(f"Fetching usage_records with id: {id}, fields={fields}")
    
    service = Usage_recordsService(db)
    try:
        result = await service.get_by_id(id)
        if not result:
            logger.warning(f"Usage_records with id {id} not found")
            raise HTTPException(status_code=404, detail="Usage_records not found")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching usage_records {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("", response_model=Usage_recordsResponse, status_code=201)
async def create_usage_records(
    data: Usage_recordsData,
    db: AsyncSession = Depends(get_db),
):
    """Create a new usage_records"""
    logger.debug(f"Creating new usage_records with data: {data}")
    
    service = Usage_recordsService(db)
    try:
        result = await service.create(data.model_dump())
        if not result:
            raise HTTPException(status_code=400, detail="Failed to create usage_records")
        
        logger.info(f"Usage_records created successfully with id: {result.id}")
        return result
    except ValueError as e:
        logger.error(f"Validation error creating usage_records: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating usage_records: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/batch", response_model=List[Usage_recordsResponse], status_code=201)
async def create_usage_recordss_batch(
    request: Usage_recordsBatchCreateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Create multiple usage_recordss in a single request"""
    logger.debug(f"Batch creating {len(request.items)} usage_recordss")
    
    service = Usage_recordsService(db)
    results = []
    
    try:
        for item_data in request.items:
            result = await service.create(item_data.model_dump())
            if result:
                results.append(result)
        
        logger.info(f"Batch created {len(results)} usage_recordss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch create: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch create failed: {str(e)}")


@router.put("/batch", response_model=List[Usage_recordsResponse])
async def update_usage_recordss_batch(
    request: Usage_recordsBatchUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Update multiple usage_recordss in a single request"""
    logger.debug(f"Batch updating {len(request.items)} usage_recordss")
    
    service = Usage_recordsService(db)
    results = []
    
    try:
        for item in request.items:
            # Only include non-None values for partial updates
            update_dict = {k: v for k, v in item.updates.model_dump().items() if v is not None}
            result = await service.update(item.id, update_dict)
            if result:
                results.append(result)
        
        logger.info(f"Batch updated {len(results)} usage_recordss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch update: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch update failed: {str(e)}")


@router.put("/{id}", response_model=Usage_recordsResponse)
async def update_usage_records(
    id: int,
    data: Usage_recordsUpdateData,
    db: AsyncSession = Depends(get_db),
):
    """Update an existing usage_records"""
    logger.debug(f"Updating usage_records {id} with data: {data}")

    service = Usage_recordsService(db)
    try:
        # Only include non-None values for partial updates
        update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
        result = await service.update(id, update_dict)
        if not result:
            logger.warning(f"Usage_records with id {id} not found for update")
            raise HTTPException(status_code=404, detail="Usage_records not found")
        
        logger.info(f"Usage_records {id} updated successfully")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error updating usage_records {id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating usage_records {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/batch")
async def delete_usage_recordss_batch(
    request: Usage_recordsBatchDeleteRequest,
    db: AsyncSession = Depends(get_db),
):
    """Delete multiple usage_recordss by their IDs"""
    logger.debug(f"Batch deleting {len(request.ids)} usage_recordss")
    
    service = Usage_recordsService(db)
    deleted_count = 0
    
    try:
        for item_id in request.ids:
            success = await service.delete(item_id)
            if success:
                deleted_count += 1
        
        logger.info(f"Batch deleted {deleted_count} usage_recordss successfully")
        return {"message": f"Successfully deleted {deleted_count} usage_recordss", "deleted_count": deleted_count}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch delete: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch delete failed: {str(e)}")


@router.delete("/{id}")
async def delete_usage_records(
    id: int,
    db: AsyncSession = Depends(get_db),
):
    """Delete a single usage_records by ID"""
    logger.debug(f"Deleting usage_records with id: {id}")
    
    service = Usage_recordsService(db)
    try:
        success = await service.delete(id)
        if not success:
            logger.warning(f"Usage_records with id {id} not found for deletion")
            raise HTTPException(status_code=404, detail="Usage_records not found")
        
        logger.info(f"Usage_records {id} deleted successfully")
        return {"message": "Usage_records deleted successfully", "id": id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting usage_records {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")