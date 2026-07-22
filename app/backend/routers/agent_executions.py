import json
import logging
from typing import List, Optional

from datetime import datetime, date

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.agent_executions import Agent_executionsService
from dependencies.auth import get_current_user
from schemas.auth import UserResponse

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/entities/agent_executions", tags=["agent_executions"])


# ---------- Pydantic Schemas ----------
class Agent_executionsData(BaseModel):
    """Entity data schema (for create/update)"""
    agent_id: int
    input_text: str
    output_text: str = None
    status: str = None
    error_message: str = None
    execution_time_ms: int = None


class Agent_executionsUpdateData(BaseModel):
    """Update entity data (partial updates allowed)"""
    agent_id: Optional[int] = None
    input_text: Optional[str] = None
    output_text: Optional[str] = None
    status: Optional[str] = None
    error_message: Optional[str] = None
    execution_time_ms: Optional[int] = None


class Agent_executionsResponse(BaseModel):
    """Entity response schema"""
    id: int
    user_id: str
    agent_id: int
    input_text: str
    output_text: Optional[str] = None
    status: Optional[str] = None
    error_message: Optional[str] = None
    execution_time_ms: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class Agent_executionsListResponse(BaseModel):
    """List response schema"""
    items: List[Agent_executionsResponse]
    total: int
    skip: int
    limit: int


class Agent_executionsBatchCreateRequest(BaseModel):
    """Batch create request"""
    items: List[Agent_executionsData]


class Agent_executionsBatchUpdateItem(BaseModel):
    """Batch update item"""
    id: int
    updates: Agent_executionsUpdateData


class Agent_executionsBatchUpdateRequest(BaseModel):
    """Batch update request"""
    items: List[Agent_executionsBatchUpdateItem]


class Agent_executionsBatchDeleteRequest(BaseModel):
    """Batch delete request"""
    ids: List[int]


# ---------- Routes ----------
@router.get("", response_model=Agent_executionsListResponse)
async def query_agent_executionss(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Query agent_executionss with filtering, sorting, and pagination (user can only see their own records)"""
    logger.debug(f"Querying agent_executionss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")
    
    service = Agent_executionsService(db)
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
        logger.debug(f"Found {result['total']} agent_executionss")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.warning(f"Invalid agent_executions query: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error querying agent_executionss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/all", response_model=Agent_executionsListResponse)
async def query_agent_executionss_all(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    # Query agent_executionss with filtering, sorting, and pagination without user limitation
    logger.debug(f"Querying agent_executionss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")

    service = Agent_executionsService(db)
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
        logger.debug(f"Found {result['total']} agent_executionss")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.warning(f"Invalid agent_executions query: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error querying agent_executionss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{id}", response_model=Agent_executionsResponse)
async def get_agent_executions(
    id: int,
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single agent_executions by ID (user can only see their own records)"""
    logger.debug(f"Fetching agent_executions with id: {id}, fields={fields}")
    
    service = Agent_executionsService(db)
    try:
        result = await service.get_by_id(id, user_id=str(current_user.id))
        if not result:
            logger.warning(f"Agent_executions with id {id} not found")
            raise HTTPException(status_code=404, detail="Agent_executions not found")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching agent_executions {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("", response_model=Agent_executionsResponse, status_code=201)
async def create_agent_executions(
    data: Agent_executionsData,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new agent_executions"""
    logger.debug(f"Creating new agent_executions with data: {data}")
    
    service = Agent_executionsService(db)
    try:
        result = await service.create(data.model_dump(), user_id=str(current_user.id))
        if not result:
            raise HTTPException(status_code=400, detail="Failed to create agent_executions")
        
        logger.info(f"Agent_executions created successfully with id: {result.id}")
        return result
    except ValueError as e:
        logger.error(f"Validation error creating agent_executions: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating agent_executions: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/batch", response_model=List[Agent_executionsResponse], status_code=201)
async def create_agent_executionss_batch(
    request: Agent_executionsBatchCreateRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create multiple agent_executionss in a single request"""
    logger.debug(f"Batch creating {len(request.items)} agent_executionss")
    
    service = Agent_executionsService(db)
    results = []
    
    try:
        for item_data in request.items:
            result = await service.create(item_data.model_dump(), user_id=str(current_user.id))
            if result:
                results.append(result)
        
        logger.info(f"Batch created {len(results)} agent_executionss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch create: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch create failed: {str(e)}")


@router.put("/batch", response_model=List[Agent_executionsResponse])
async def update_agent_executionss_batch(
    request: Agent_executionsBatchUpdateRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update multiple agent_executionss in a single request (requires ownership)"""
    logger.debug(f"Batch updating {len(request.items)} agent_executionss")
    
    service = Agent_executionsService(db)
    results = []
    
    try:
        for item in request.items:
            # Only include non-None values for partial updates
            update_dict = {k: v for k, v in item.updates.model_dump().items() if v is not None}
            result = await service.update(item.id, update_dict, user_id=str(current_user.id))
            if result:
                results.append(result)
        
        logger.info(f"Batch updated {len(results)} agent_executionss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch update: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch update failed: {str(e)}")


@router.put("/{id}", response_model=Agent_executionsResponse)
async def update_agent_executions(
    id: int,
    data: Agent_executionsUpdateData,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing agent_executions (requires ownership)"""
    logger.debug(f"Updating agent_executions {id} with data: {data}")

    service = Agent_executionsService(db)
    try:
        # Only include non-None values for partial updates
        update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
        result = await service.update(id, update_dict, user_id=str(current_user.id))
        if not result:
            logger.warning(f"Agent_executions with id {id} not found for update")
            raise HTTPException(status_code=404, detail="Agent_executions not found")
        
        logger.info(f"Agent_executions {id} updated successfully")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error updating agent_executions {id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating agent_executions {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/batch")
async def delete_agent_executionss_batch(
    request: Agent_executionsBatchDeleteRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete multiple agent_executionss by their IDs (requires ownership)"""
    logger.debug(f"Batch deleting {len(request.ids)} agent_executionss")
    
    service = Agent_executionsService(db)
    deleted_count = 0
    
    try:
        for item_id in request.ids:
            success = await service.delete(item_id, user_id=str(current_user.id))
            if success:
                deleted_count += 1
        
        logger.info(f"Batch deleted {deleted_count} agent_executionss successfully")
        return {"message": f"Successfully deleted {deleted_count} agent_executionss", "deleted_count": deleted_count}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch delete: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch delete failed: {str(e)}")


@router.delete("/{id}")
async def delete_agent_executions(
    id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a single agent_executions by ID (requires ownership)"""
    logger.debug(f"Deleting agent_executions with id: {id}")
    
    service = Agent_executionsService(db)
    try:
        success = await service.delete(id, user_id=str(current_user.id))
        if not success:
            logger.warning(f"Agent_executions with id {id} not found for deletion")
            raise HTTPException(status_code=404, detail="Agent_executions not found")
        
        logger.info(f"Agent_executions {id} deleted successfully")
        return {"message": "Agent_executions deleted successfully", "id": id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting agent_executions {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")