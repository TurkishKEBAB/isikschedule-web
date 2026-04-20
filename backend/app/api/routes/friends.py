from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from typing import List, Dict, Any

from app.models.database import get_db, User, Friendship
from app.core.auth import get_current_user
from pydantic import BaseModel, EmailStr

router = APIRouter()

class FriendRequestCreate(BaseModel):
    email: EmailStr

class FriendResponse(BaseModel):
    id: int
    user_id: int
    friend_id: int
    status: str
    friend_email: str

    class Config:
        from_attributes = True

@router.post("/friends/request", response_model=Dict[str, Any])
async def send_friend_request(
    request: FriendRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Send a friend request to a user by email."""
    if current_user.email == request.email:
        raise HTTPException(status_code=400, detail="Cannot send friend request to yourself")

    friend = db.query(User).filter(User.email == request.email).first()
    if not friend:
        raise HTTPException(status_code=404, detail="User not found")

    # Check if a friendship already exists
    existing = db.query(Friendship).filter(
        or_(
            and_(Friendship.user_id == current_user.id, Friendship.friend_id == friend.id),
            and_(Friendship.user_id == friend.id, Friendship.friend_id == current_user.id)
        )
    ).first()

    if existing:
        if existing.status == "accepted":
            raise HTTPException(status_code=400, detail="Already friends")
        elif existing.status == "pending":
            raise HTTPException(status_code=400, detail="Friend request already exists")
        elif existing.status == "rejected":
            # If previously rejected, could update status back to pending, but for simplicity:
            existing.status = "pending"
            existing.user_id = current_user.id
            existing.friend_id = friend.id
            db.commit()
            return {"message": "Friend request sent", "status": "pending"}

    # Create new friendship request
    new_request = Friendship(
        user_id=current_user.id,
        friend_id=friend.id,
        status="pending"
    )
    db.add(new_request)
    db.commit()

    return {"message": "Friend request sent", "status": "pending"}

@router.post("/friends/{request_id}/accept")
async def accept_friend_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Accept a pending friend request."""
    friendship = db.query(Friendship).filter(
        Friendship.id == request_id,
        Friendship.friend_id == current_user.id,
        Friendship.status == "pending"
    ).first()

    if not friendship:
        raise HTTPException(status_code=404, detail="Friend request not found or not pending")

    friendship.status = "accepted"
    db.commit()

    return {"message": "Friend request accepted"}

@router.post("/friends/{request_id}/reject")
async def reject_friend_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Reject a pending friend request."""
    friendship = db.query(Friendship).filter(
        Friendship.id == request_id,
        Friendship.friend_id == current_user.id,
        Friendship.status == "pending"
    ).first()

    if not friendship:
        raise HTTPException(status_code=404, detail="Friend request not found or not pending")

    friendship.status = "rejected"
    db.commit()

    return {"message": "Friend request rejected"}

@router.get("/friends", response_model=List[Dict[str, Any]])
async def list_friends(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all accepted friends."""
    friendships = db.query(Friendship).filter(
        or_(
            Friendship.user_id == current_user.id,
            Friendship.friend_id == current_user.id
        ),
        Friendship.status == "accepted"
    ).all()

    result = []
    for f in friendships:
        is_sender = f.user_id == current_user.id
        other_user = f.friend if is_sender else f.user
        result.append({
            "friendship_id": f.id,
            "friend_id": other_user.id,
            "friend_email": other_user.email,
            "status": f.status
        })

    return result

@router.get("/friends/requests", response_model=Dict[str, List[Dict[str, Any]]])
async def list_friend_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List pending friend requests (sent and received)."""
    received = db.query(Friendship).filter(
        Friendship.friend_id == current_user.id,
        Friendship.status == "pending"
    ).all()

    sent = db.query(Friendship).filter(
        Friendship.user_id == current_user.id,
        Friendship.status == "pending"
    ).all()

    return {
        "received": [
            {
                "request_id": f.id,
                "user_id": f.user_id,
                "user_email": f.user.email,
                "status": f.status
            } for f in received
        ],
        "sent": [
            {
                "request_id": f.id,
                "friend_id": f.friend_id,
                "friend_email": f.friend.email,
                "status": f.status
            } for f in sent
        ]
    }
