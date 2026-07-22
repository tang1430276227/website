import json
import logging
from typing import List, Optional

from datetime import datetime, date

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.mcp_tools import Mcp_toolsService
from dependencies.auth import get_current_user
from schemas.auth import UserResponse

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/entities/mcp_tools", tags=["mcp_tools"])


# ---------- Pydantic Schemas ----------
class Mcp_toolsData(BaseModel):
    """Entity data schema (for create/update)"""
    name: str
    description: str = None
    server_url: str
    auth_type: str = None
    auth_config: str = None
    tools_schema: str = None
    is_active: bool = None


class Mcp_toolsUpdateData(BaseModel):
    """Update entity data (partial updates allowed)"""
    name: Optional[str] = None
    description: Optional[str] = None
    server_url: Optional[str] = None
    auth_type: Optional[str] = None
    auth_config: Optional[str] = None
    tools_schema: Optional[str] = None
    is_active: Optional[bool] = None


class Mcp_toolsResponse(BaseModel):
    """Entity response schema"""
    id: int
    user_id: str
    name: str
    description: Optional[str] = None
    server_url: str
    auth_type: Optional[str] = None
    auth_config: Optional[str] = None
    tools_schema: Optional[str] = None
    is_active: Optional[bool] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class Mcp_toolsListResponse(BaseModel):
    """List response schema"""
    items: List[Mcp_toolsResponse]
    total: int
    skip: int
    limit: int


class Mcp_toolsBatchCreateRequest(BaseModel):
    """Batch create request"""
    items: List[Mcp_toolsData]


class Mcp_toolsBatchUpdateItem(BaseModel):
    """Batch update item"""
    id: int
    updates: Mcp_toolsUpdateData


class Mcp_toolsBatchUpdateRequest(BaseModel):
    """Batch update request"""
    items: List[Mcp_toolsBatchUpdateItem]


class Mcp_toolsBatchDeleteRequest(BaseModel):
    """Batch delete request"""
    ids: List[int]


# ---------- Routes ----------
@router.get("", response_model=Mcp_toolsListResponse)
async def query_mcp_toolss(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Query mcp_toolss with filtering, sorting, and pagination (user can only see their own records)"""
    logger.debug(f"Querying mcp_toolss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")
    
    service = Mcp_toolsService(db)
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
            user_id=str(current_user.id),
        )
        logger.debug(f"Found {result['total']} mcp_toolss")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.warning(f"Invalid mcp_tools query: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error querying mcp_toolss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/all", response_model=Mcp_toolsListResponse)
async def query_mcp_toolss_all(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    # Query mcp_toolss with filtering, sorting, and pagination without user limitation
    logger.debug(f"Querying mcp_toolss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")

    service = Mcp_toolsService(db)
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
        logger.debug(f"Found {result['total']} mcp_toolss")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.warning(f"Invalid mcp_tools query: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error querying mcp_toolss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{id}", response_model=Mcp_toolsResponse)
async def get_mcp_tools(
    id: int,
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single mcp_tools by ID (user can only see their own records)"""
    logger.debug(f"Fetching mcp_tools with id: {id}, fields={fields}")
    
    service = Mcp_toolsService(db)
    try:
        result = await service.get_by_id(id, user_id=str(current_user.id))
        if not result:
            logger.warning(f"Mcp_tools with id {id} not found")
            raise HTTPException(status_code=404, detail="Mcp_tools not found")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching mcp_tools {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("", response_model=Mcp_toolsResponse, status_code=201)
async def create_mcp_tools(
    data: Mcp_toolsData,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new mcp_tools"""
    logger.debug(f"Creating new mcp_tools with data: {data}")
    
    service = Mcp_toolsService(db)
    try:
        result = await service.create(data.model_dump(), user_id=str(current_user.id))
        if not result:
            raise HTTPException(status_code=400, detail="Failed to create mcp_tools")
        
        logger.info(f"Mcp_tools created successfully with id: {result.id}")
        return result
    except ValueError as e:
        logger.error(f"Validation error creating mcp_tools: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating mcp_tools: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/batch", response_model=List[Mcp_toolsResponse], status_code=201)
async def create_mcp_toolss_batch(
    request: Mcp_toolsBatchCreateRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create multiple mcp_toolss in a single request"""
    logger.debug(f"Batch creating {len(request.items)} mcp_toolss")
    
    service = Mcp_toolsService(db)
    results = []
    
    try:
        for item_data in request.items:
            result = await service.create(item_data.model_dump(), user_id=str(current_user.id))
            if result:
                results.append(result)
        
        logger.info(f"Batch created {len(results)} mcp_toolss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch create: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch create failed: {str(e)}")


@router.put("/batch", response_model=List[Mcp_toolsResponse])
async def update_mcp_toolss_batch(
    request: Mcp_toolsBatchUpdateRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update multiple mcp_toolss in a single request (requires ownership)"""
    logger.debug(f"Batch updating {len(request.items)} mcp_toolss")
    
    service = Mcp_toolsService(db)
    results = []
    
    try:
        for item in request.items:
            # Only include non-None values for partial updates
            update_dict = {k: v for k, v in item.updates.model_dump().items() if v is not None}
            result = await service.update(item.id, update_dict, user_id=str(current_user.id))
            if result:
                results.append(result)
        
        logger.info(f"Batch updated {len(results)} mcp_toolss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch update: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch update failed: {str(e)}")


@router.put("/{id}", response_model=Mcp_toolsResponse)
async def update_mcp_tools(
    id: int,
    data: Mcp_toolsUpdateData,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing mcp_tools (requires ownership)"""
    logger.debug(f"Updating mcp_tools {id} with data: {data}")

    service = Mcp_toolsService(db)
    try:
        # Only include non-None values for partial updates
        update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
        result = await service.update(id, update_dict, user_id=str(current_user.id))
        if not result:
            logger.warning(f"Mcp_tools with id {id} not found for update")
            raise HTTPException(status_code=404, detail="Mcp_tools not found")
        
        logger.info(f"Mcp_tools {id} updated successfully")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error updating mcp_tools {id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating mcp_tools {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/batch")
async def delete_mcp_toolss_batch(
    request: Mcp_toolsBatchDeleteRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete multiple mcp_toolss by their IDs (requires ownership)"""
    logger.debug(f"Batch deleting {len(request.ids)} mcp_toolss")
    
    service = Mcp_toolsService(db)
    deleted_count = 0
    
    try:
        for item_id in request.ids:
            success = await service.delete(item_id, user_id=str(current_user.id))
            if success:
                deleted_count += 1
        
        logger.info(f"Batch deleted {deleted_count} mcp_toolss successfully")
        return {"message": f"Successfully deleted {deleted_count} mcp_toolss", "deleted_count": deleted_count}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch delete: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch delete failed: {str(e)}")


@router.delete("/{id}")
async def delete_mcp_tools(
    id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a single mcp_tools by ID (requires ownership)"""
    logger.debug(f"Deleting mcp_tools with id: {id}")
    
    service = Mcp_toolsService(db)
    try:
        success = await service.delete(id, user_id=str(current_user.id))
        if not success:
            logger.warning(f"Mcp_tools with id {id} not found for deletion")
            raise HTTPException(status_code=404, detail="Mcp_tools not found")
        
        logger.info(f"Mcp_tools {id} deleted successfully")
        return {"message": "Mcp_tools deleted successfully", "id": id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting mcp_tools {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")