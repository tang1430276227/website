import json
import logging
from typing import List, Optional

from datetime import datetime, date

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.agents import AgentsService
from dependencies.auth import get_current_user
from schemas.auth import UserResponse

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/entities/agents", tags=["agents"])


# ---------- Pydantic Schemas ----------
class AgentsData(BaseModel):
    """Entity data schema (for create/update)"""
    name: str
    description: str = None
    system_prompt: str = None
    code: str = None
    model: str = None
    config: str = None
    is_public: bool = None
    status: str = None


class AgentsUpdateData(BaseModel):
    """Update entity data (partial updates allowed)"""
    name: Optional[str] = None
    description: Optional[str] = None
    system_prompt: Optional[str] = None
    code: Optional[str] = None
    model: Optional[str] = None
    config: Optional[str] = None
    is_public: Optional[bool] = None
    status: Optional[str] = None


class AgentsResponse(BaseModel):
    """Entity response schema"""
    id: int
    user_id: str
    name: str
    description: Optional[str] = None
    system_prompt: Optional[str] = None
    code: Optional[str] = None
    model: Optional[str] = None
    config: Optional[str] = None
    is_public: Optional[bool] = None
    status: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AgentsListResponse(BaseModel):
    """List response schema"""
    items: List[AgentsResponse]
    total: int
    skip: int
    limit: int


class AgentsBatchCreateRequest(BaseModel):
    """Batch create request"""
    items: List[AgentsData]


class AgentsBatchUpdateItem(BaseModel):
    """Batch update item"""
    id: int
    updates: AgentsUpdateData


class AgentsBatchUpdateRequest(BaseModel):
    """Batch update request"""
    items: List[AgentsBatchUpdateItem]


class AgentsBatchDeleteRequest(BaseModel):
    """Batch delete request"""
    ids: List[int]


# ---------- Routes ----------
@router.get("", response_model=AgentsListResponse)
async def query_agentss(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Query agentss with filtering, sorting, and pagination (user can only see their own records)"""
    logger.debug(f"Querying agentss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")
    
    service = AgentsService(db)
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
        logger.debug(f"Found {result['total']} agentss")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.warning(f"Invalid agents query: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error querying agentss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/all", response_model=AgentsListResponse)
async def query_agentss_all(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    # Query agentss with filtering, sorting, and pagination without user limitation
    logger.debug(f"Querying agentss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")

    service = AgentsService(db)
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
        logger.debug(f"Found {result['total']} agentss")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.warning(f"Invalid agents query: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error querying agentss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{id}", response_model=AgentsResponse)
async def get_agents(
    id: int,
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single agents by ID (user can only see their own records)"""
    logger.debug(f"Fetching agents with id: {id}, fields={fields}")
    
    service = AgentsService(db)
    try:
        result = await service.get_by_id(id, user_id=str(current_user.id))
        if not result:
            logger.warning(f"Agents with id {id} not found")
            raise HTTPException(status_code=404, detail="Agents not found")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching agents {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("", response_model=AgentsResponse, status_code=201)
async def create_agents(
    data: AgentsData,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new agents"""
    logger.debug(f"Creating new agents with data: {data}")
    
    service = AgentsService(db)
    try:
        result = await service.create(data.model_dump(), user_id=str(current_user.id))
        if not result:
            raise HTTPException(status_code=400, detail="Failed to create agents")
        
        logger.info(f"Agents created successfully with id: {result.id}")
        return result
    except ValueError as e:
        logger.error(f"Validation error creating agents: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating agents: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/batch", response_model=List[AgentsResponse], status_code=201)
async def create_agentss_batch(
    request: AgentsBatchCreateRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create multiple agentss in a single request"""
    logger.debug(f"Batch creating {len(request.items)} agentss")
    
    service = AgentsService(db)
    results = []
    
    try:
        for item_data in request.items:
            result = await service.create(item_data.model_dump(), user_id=str(current_user.id))
            if result:
                results.append(result)
        
        logger.info(f"Batch created {len(results)} agentss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch create: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch create failed: {str(e)}")


@router.put("/batch", response_model=List[AgentsResponse])
async def update_agentss_batch(
    request: AgentsBatchUpdateRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update multiple agentss in a single request (requires ownership)"""
    logger.debug(f"Batch updating {len(request.items)} agentss")
    
    service = AgentsService(db)
    results = []
    
    try:
        for item in request.items:
            # Only include non-None values for partial updates
            update_dict = {k: v for k, v in item.updates.model_dump().items() if v is not None}
            result = await service.update(item.id, update_dict, user_id=str(current_user.id))
            if result:
                results.append(result)
        
        logger.info(f"Batch updated {len(results)} agentss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch update: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch update failed: {str(e)}")


@router.put("/{id}", response_model=AgentsResponse)
async def update_agents(
    id: int,
    data: AgentsUpdateData,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing agents (requires ownership)"""
    logger.debug(f"Updating agents {id} with data: {data}")

    service = AgentsService(db)
    try:
        # Only include non-None values for partial updates
        update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
        result = await service.update(id, update_dict, user_id=str(current_user.id))
        if not result:
            logger.warning(f"Agents with id {id} not found for update")
            raise HTTPException(status_code=404, detail="Agents not found")
        
        logger.info(f"Agents {id} updated successfully")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error updating agents {id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating agents {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/batch")
async def delete_agentss_batch(
    request: AgentsBatchDeleteRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete multiple agentss by their IDs (requires ownership)"""
    logger.debug(f"Batch deleting {len(request.ids)} agentss")
    
    service = AgentsService(db)
    deleted_count = 0
    
    try:
        for item_id in request.ids:
            success = await service.delete(item_id, user_id=str(current_user.id))
            if success:
                deleted_count += 1
        
        logger.info(f"Batch deleted {deleted_count} agentss successfully")
        return {"message": f"Successfully deleted {deleted_count} agentss", "deleted_count": deleted_count}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch delete: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch delete failed: {str(e)}")


@router.delete("/{id}")
async def delete_agents(
    id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a single agents by ID (requires ownership)"""
    logger.debug(f"Deleting agents with id: {id}")
    
    service = AgentsService(db)
    try:
        success = await service.delete(id, user_id=str(current_user.id))
        if not success:
            logger.warning(f"Agents with id {id} not found for deletion")
            raise HTTPException(status_code=404, detail="Agents not found")
        
        logger.info(f"Agents {id} deleted successfully")
        return {"message": "Agents deleted successfully", "id": id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting agents {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")