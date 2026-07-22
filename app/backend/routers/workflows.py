import json
import logging
from typing import List, Optional

from datetime import datetime, date

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.workflows import WorkflowsService
from dependencies.auth import get_current_user
from schemas.auth import UserResponse

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/entities/workflows", tags=["workflows"])


# ---------- Pydantic Schemas ----------
class WorkflowsData(BaseModel):
    """Entity data schema (for create/update)"""
    name: str
    description: str = None
    nodes: str = None
    edges: str = None
    config: str = None
    status: str = None


class WorkflowsUpdateData(BaseModel):
    """Update entity data (partial updates allowed)"""
    name: Optional[str] = None
    description: Optional[str] = None
    nodes: Optional[str] = None
    edges: Optional[str] = None
    config: Optional[str] = None
    status: Optional[str] = None


class WorkflowsResponse(BaseModel):
    """Entity response schema"""
    id: int
    user_id: str
    name: str
    description: Optional[str] = None
    nodes: Optional[str] = None
    edges: Optional[str] = None
    config: Optional[str] = None
    status: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class WorkflowsListResponse(BaseModel):
    """List response schema"""
    items: List[WorkflowsResponse]
    total: int
    skip: int
    limit: int


class WorkflowsBatchCreateRequest(BaseModel):
    """Batch create request"""
    items: List[WorkflowsData]


class WorkflowsBatchUpdateItem(BaseModel):
    """Batch update item"""
    id: int
    updates: WorkflowsUpdateData


class WorkflowsBatchUpdateRequest(BaseModel):
    """Batch update request"""
    items: List[WorkflowsBatchUpdateItem]


class WorkflowsBatchDeleteRequest(BaseModel):
    """Batch delete request"""
    ids: List[int]


# ---------- Routes ----------
@router.get("", response_model=WorkflowsListResponse)
async def query_workflowss(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Query workflowss with filtering, sorting, and pagination (user can only see their own records)"""
    logger.debug(f"Querying workflowss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")
    
    service = WorkflowsService(db)
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
        logger.debug(f"Found {result['total']} workflowss")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.warning(f"Invalid workflows query: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error querying workflowss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/all", response_model=WorkflowsListResponse)
async def query_workflowss_all(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    # Query workflowss with filtering, sorting, and pagination without user limitation
    logger.debug(f"Querying workflowss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")

    service = WorkflowsService(db)
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
        logger.debug(f"Found {result['total']} workflowss")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.warning(f"Invalid workflows query: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error querying workflowss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{id}", response_model=WorkflowsResponse)
async def get_workflows(
    id: int,
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single workflows by ID (user can only see their own records)"""
    logger.debug(f"Fetching workflows with id: {id}, fields={fields}")
    
    service = WorkflowsService(db)
    try:
        result = await service.get_by_id(id, user_id=str(current_user.id))
        if not result:
            logger.warning(f"Workflows with id {id} not found")
            raise HTTPException(status_code=404, detail="Workflows not found")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching workflows {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("", response_model=WorkflowsResponse, status_code=201)
async def create_workflows(
    data: WorkflowsData,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new workflows"""
    logger.debug(f"Creating new workflows with data: {data}")
    
    service = WorkflowsService(db)
    try:
        result = await service.create(data.model_dump(), user_id=str(current_user.id))
        if not result:
            raise HTTPException(status_code=400, detail="Failed to create workflows")
        
        logger.info(f"Workflows created successfully with id: {result.id}")
        return result
    except ValueError as e:
        logger.error(f"Validation error creating workflows: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating workflows: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/batch", response_model=List[WorkflowsResponse], status_code=201)
async def create_workflowss_batch(
    request: WorkflowsBatchCreateRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create multiple workflowss in a single request"""
    logger.debug(f"Batch creating {len(request.items)} workflowss")
    
    service = WorkflowsService(db)
    results = []
    
    try:
        for item_data in request.items:
            result = await service.create(item_data.model_dump(), user_id=str(current_user.id))
            if result:
                results.append(result)
        
        logger.info(f"Batch created {len(results)} workflowss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch create: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch create failed: {str(e)}")


@router.put("/batch", response_model=List[WorkflowsResponse])
async def update_workflowss_batch(
    request: WorkflowsBatchUpdateRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update multiple workflowss in a single request (requires ownership)"""
    logger.debug(f"Batch updating {len(request.items)} workflowss")
    
    service = WorkflowsService(db)
    results = []
    
    try:
        for item in request.items:
            # Only include non-None values for partial updates
            update_dict = {k: v for k, v in item.updates.model_dump().items() if v is not None}
            result = await service.update(item.id, update_dict, user_id=str(current_user.id))
            if result:
                results.append(result)
        
        logger.info(f"Batch updated {len(results)} workflowss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch update: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch update failed: {str(e)}")


@router.put("/{id}", response_model=WorkflowsResponse)
async def update_workflows(
    id: int,
    data: WorkflowsUpdateData,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing workflows (requires ownership)"""
    logger.debug(f"Updating workflows {id} with data: {data}")

    service = WorkflowsService(db)
    try:
        # Only include non-None values for partial updates
        update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
        result = await service.update(id, update_dict, user_id=str(current_user.id))
        if not result:
            logger.warning(f"Workflows with id {id} not found for update")
            raise HTTPException(status_code=404, detail="Workflows not found")
        
        logger.info(f"Workflows {id} updated successfully")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error updating workflows {id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating workflows {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/batch")
async def delete_workflowss_batch(
    request: WorkflowsBatchDeleteRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete multiple workflowss by their IDs (requires ownership)"""
    logger.debug(f"Batch deleting {len(request.ids)} workflowss")
    
    service = WorkflowsService(db)
    deleted_count = 0
    
    try:
        for item_id in request.ids:
            success = await service.delete(item_id, user_id=str(current_user.id))
            if success:
                deleted_count += 1
        
        logger.info(f"Batch deleted {deleted_count} workflowss successfully")
        return {"message": f"Successfully deleted {deleted_count} workflowss", "deleted_count": deleted_count}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch delete: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch delete failed: {str(e)}")


@router.delete("/{id}")
async def delete_workflows(
    id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a single workflows by ID (requires ownership)"""
    logger.debug(f"Deleting workflows with id: {id}")
    
    service = WorkflowsService(db)
    try:
        success = await service.delete(id, user_id=str(current_user.id))
        if not success:
            logger.warning(f"Workflows with id {id} not found for deletion")
            raise HTTPException(status_code=404, detail="Workflows not found")
        
        logger.info(f"Workflows {id} deleted successfully")
        return {"message": "Workflows deleted successfully", "id": id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting workflows {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")