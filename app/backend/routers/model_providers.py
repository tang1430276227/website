import json
import logging
from typing import List, Optional

from datetime import datetime, date

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.model_providers import Model_providersService

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/entities/model_providers", tags=["model_providers"])


# ---------- Pydantic Schemas ----------
class Model_providersData(BaseModel):
    """Entity data schema (for create/update)"""
    name: str
    api_type: str
    base_url: str
    api_key_encrypted: str = None
    models: str = None
    is_active: bool = None
    config: str = None


class Model_providersUpdateData(BaseModel):
    """Update entity data (partial updates allowed)"""
    name: Optional[str] = None
    api_type: Optional[str] = None
    base_url: Optional[str] = None
    api_key_encrypted: Optional[str] = None
    models: Optional[str] = None
    is_active: Optional[bool] = None
    config: Optional[str] = None


class Model_providersResponse(BaseModel):
    """Entity response schema"""
    id: int
    name: str
    api_type: str
    base_url: str
    api_key_encrypted: Optional[str] = None
    models: Optional[str] = None
    is_active: Optional[bool] = None
    config: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class Model_providersListResponse(BaseModel):
    """List response schema"""
    items: List[Model_providersResponse]
    total: int
    skip: int
    limit: int


class Model_providersBatchCreateRequest(BaseModel):
    """Batch create request"""
    items: List[Model_providersData]


class Model_providersBatchUpdateItem(BaseModel):
    """Batch update item"""
    id: int
    updates: Model_providersUpdateData


class Model_providersBatchUpdateRequest(BaseModel):
    """Batch update request"""
    items: List[Model_providersBatchUpdateItem]


class Model_providersBatchDeleteRequest(BaseModel):
    """Batch delete request"""
    ids: List[int]


# ---------- Routes ----------
@router.get("", response_model=Model_providersListResponse)
async def query_model_providerss(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    """Query model_providerss with filtering, sorting, and pagination"""
    logger.debug(f"Querying model_providerss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")
    
    service = Model_providersService(db)
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
        logger.debug(f"Found {result['total']} model_providerss")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.warning(f"Invalid model_providers query: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error querying model_providerss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/all", response_model=Model_providersListResponse)
async def query_model_providerss_all(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    # Query model_providerss with filtering, sorting, and pagination without user limitation
    logger.debug(f"Querying model_providerss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")

    service = Model_providersService(db)
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
        logger.debug(f"Found {result['total']} model_providerss")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.warning(f"Invalid model_providers query: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error querying model_providerss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{id}", response_model=Model_providersResponse)
async def get_model_providers(
    id: int,
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    """Get a single model_providers by ID"""
    logger.debug(f"Fetching model_providers with id: {id}, fields={fields}")
    
    service = Model_providersService(db)
    try:
        result = await service.get_by_id(id)
        if not result:
            logger.warning(f"Model_providers with id {id} not found")
            raise HTTPException(status_code=404, detail="Model_providers not found")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching model_providers {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("", response_model=Model_providersResponse, status_code=201)
async def create_model_providers(
    data: Model_providersData,
    db: AsyncSession = Depends(get_db),
):
    """Create a new model_providers"""
    logger.debug(f"Creating new model_providers with data: {data}")
    
    service = Model_providersService(db)
    try:
        result = await service.create(data.model_dump())
        if not result:
            raise HTTPException(status_code=400, detail="Failed to create model_providers")
        
        logger.info(f"Model_providers created successfully with id: {result.id}")
        return result
    except ValueError as e:
        logger.error(f"Validation error creating model_providers: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating model_providers: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/batch", response_model=List[Model_providersResponse], status_code=201)
async def create_model_providerss_batch(
    request: Model_providersBatchCreateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Create multiple model_providerss in a single request"""
    logger.debug(f"Batch creating {len(request.items)} model_providerss")
    
    service = Model_providersService(db)
    results = []
    
    try:
        for item_data in request.items:
            result = await service.create(item_data.model_dump())
            if result:
                results.append(result)
        
        logger.info(f"Batch created {len(results)} model_providerss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch create: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch create failed: {str(e)}")


@router.put("/batch", response_model=List[Model_providersResponse])
async def update_model_providerss_batch(
    request: Model_providersBatchUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Update multiple model_providerss in a single request"""
    logger.debug(f"Batch updating {len(request.items)} model_providerss")
    
    service = Model_providersService(db)
    results = []
    
    try:
        for item in request.items:
            # Only include non-None values for partial updates
            update_dict = {k: v for k, v in item.updates.model_dump().items() if v is not None}
            result = await service.update(item.id, update_dict)
            if result:
                results.append(result)
        
        logger.info(f"Batch updated {len(results)} model_providerss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch update: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch update failed: {str(e)}")


@router.put("/{id}", response_model=Model_providersResponse)
async def update_model_providers(
    id: int,
    data: Model_providersUpdateData,
    db: AsyncSession = Depends(get_db),
):
    """Update an existing model_providers"""
    logger.debug(f"Updating model_providers {id} with data: {data}")

    service = Model_providersService(db)
    try:
        # Only include non-None values for partial updates
        update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
        result = await service.update(id, update_dict)
        if not result:
            logger.warning(f"Model_providers with id {id} not found for update")
            raise HTTPException(status_code=404, detail="Model_providers not found")
        
        logger.info(f"Model_providers {id} updated successfully")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error updating model_providers {id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating model_providers {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/batch")
async def delete_model_providerss_batch(
    request: Model_providersBatchDeleteRequest,
    db: AsyncSession = Depends(get_db),
):
    """Delete multiple model_providerss by their IDs"""
    logger.debug(f"Batch deleting {len(request.ids)} model_providerss")
    
    service = Model_providersService(db)
    deleted_count = 0
    
    try:
        for item_id in request.ids:
            success = await service.delete(item_id)
            if success:
                deleted_count += 1
        
        logger.info(f"Batch deleted {deleted_count} model_providerss successfully")
        return {"message": f"Successfully deleted {deleted_count} model_providerss", "deleted_count": deleted_count}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch delete: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch delete failed: {str(e)}")


@router.delete("/{id}")
async def delete_model_providers(
    id: int,
    db: AsyncSession = Depends(get_db),
):
    """Delete a single model_providers by ID"""
    logger.debug(f"Deleting model_providers with id: {id}")
    
    service = Model_providersService(db)
    try:
        success = await service.delete(id)
        if not success:
            logger.warning(f"Model_providers with id {id} not found for deletion")
            raise HTTPException(status_code=404, detail="Model_providers not found")
        
        logger.info(f"Model_providers {id} deleted successfully")
        return {"message": "Model_providers deleted successfully", "id": id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting model_providers {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")