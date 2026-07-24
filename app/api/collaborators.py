from sqlalchemy.orm import Session
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks


from app.db import get_db
from app.db.models.user import User
from app.core.logger import get_logger
from app.api.auth_deps import get_current_user
from app.utils.email import send_invitation_email
from app.db.models.ranking import App, AppInvitation
from app.schemas.request import InviteCollaboratorRequest
from app.db.repositories.ranking_repository import RankingRepository

logger = get_logger(__name__)

router = APIRouter(
    prefix="/collaborators",
    tags=["Collaborators"],
)

@router.post("/apps/{app_id}/invite")
def invite_collaborator(
    app_id: int,
    request: InviteCollaboratorRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Invite a user to collaborate on an application.

    This endpoint allows the application owner to send a collaboration
    invitation to another registered or unregistered user via email.
    An invitation record is created, and an email notification is sent
    asynchronously to the specified recipient.

    Raises:
        HTTPException:
            - 400: If the user is already a collaborator or attempts to invite themselves.
            - 403: If the authenticated user is not the application owner.
            - 404: If the application cannot be found.
            - 500: If an unexpected error occurs while creating the invitation.
    """
    try:

        app = db.query(App).filter(App.id == app_id, App.is_deleted == False).first()
        if not app:
            raise HTTPException(status_code=404, detail="App not found")
        
        if app.user_id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="Only the application owner can invite collaborators"
            )

        email = request.email.strip().lower()
        if email == current_user.email:
            raise HTTPException(
                status_code=400,
                detail="You cannot invite yourself as a collaborator"
            )

        invitee = db.query(User).filter(User.email == email).first()
        if invitee and invitee in app.collaborators:
            raise HTTPException(
                status_code=400,
                detail="User is already a collaborator on this application"
            )

        invitation = RankingRepository.create_invitation(db, app_id, current_user.id, email)

        background_tasks.add_task(
            send_invitation_email,
            to_email=email,
            app_name=app.name,
            inviter_email=current_user.email
        )

        return {
            "message": "Collaborator invitation sent successfully",
            "invitation": {
                "id": invitation.id,
                "email": invitation.email,
                "status": invitation.status
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to invite collaborator to app {app_id}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to invite collaborator"
        )


@router.get("/invitations/pending")
def get_pending_invitations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve all pending collaboration invitations for the authenticated user.

    This endpoint returns every active invitation associated with the
    current user's email address, including the application details,
    inviter information, and invitation creation timestamp.

    Raises:
        HTTPException:
            - 500: If an unexpected error occurs while retrieving invitations.
    """
    try:
        invites = RankingRepository.get_pending_invitations(db, current_user.email)
        return {
            "invitations": [
                {
                    "id": invite.id,
                    "app": {
                        "id": invite.app.id,
                        "name": invite.app.name,
                        "url": invite.app.url
                    },
                    "inviter": invite.inviter.email,
                    "created_at": invite.created_at.isoformat() if invite.created_at else None
                }
                for invite in invites if invite.app and not invite.app.is_deleted
            ]
        }
    except Exception as e:
        logger.exception(f"Failed to fetch pending invitations: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to fetch pending invitations"
        )


@router.post("/invitations/{invite_id}/accept")
def accept_invitation(
    invite_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Accept a pending collaboration invitation.

    This endpoint validates that the invitation belongs to the
    authenticated user and is still pending. Upon successful
    validation, the user is added as a collaborator to the
    associated application.

    Raises:
        HTTPException:
            - 403: If the invitation does not belong to the authenticated user.
            - 404: If the invitation is not found or is no longer active.
            - 500: If an unexpected error occurs while accepting the invitation.
    """
    try:
        invite = RankingRepository.get_invitation_by_id(db, invite_id)
        if not invite or invite.status != "pending":
            raise HTTPException(status_code=404, detail="Active invitation not found")

        if invite.email.strip().lower() != current_user.email.strip().lower():
            raise HTTPException(status_code=403, detail="This invitation is not for your email account")

        RankingRepository.accept_invitation(db, invite, current_user)
        return {"message": f"Successfully joined as collaborator for '{invite.app.name}'"}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to accept invitation: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to accept invitation"
        )


@router.post("/invitations/{invite_id}/decline")
def decline_invitation(
    invite_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Decline a pending collaboration invitation.

    This endpoint verifies that the invitation belongs to the
    authenticated user and marks the invitation as declined
    without granting access to the associated application.

    Raises:
        HTTPException:
            - 403: If the invitation does not belong to the authenticated user.
            - 404: If the invitation is not found or is no longer active.
            - 500: If an unexpected error occurs while declining the invitation.
    """
    try:
        invite = RankingRepository.get_invitation_by_id(db, invite_id)
        if not invite or invite.status != "pending":
            raise HTTPException(status_code=404, detail="Active invitation not found")

        if invite.email.strip().lower() != current_user.email.strip().lower():
            raise HTTPException(status_code=403, detail="This invitation is not for your email account")

        RankingRepository.decline_invitation(db, invite)
        return {"message": "Invitation declined successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to decline invitation: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to decline invitation"
        )


@router.get("/apps/{app_id}/collaborators")
def get_app_collaborators(
    app_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve collaborator information for a specific application.

    This endpoint returns the application owner's email, the list
    of active collaborators, and any pending collaboration
    invitations. Access is restricted to the application owner
    and authorized collaborators.

    Raises:
        HTTPException:
            - 403: If the authenticated user does not have access to the application.
            - 404: If the application cannot be found.
            - 500: If an unexpected error occurs while retrieving collaborator information.
    """
    try:
        app = db.query(App).filter(App.id == app_id, App.is_deleted == False).first()
        if not app:
            raise HTTPException(status_code=404, detail="App not found")
        
        if app.user_id != current_user.id and current_user not in app.collaborators:
            raise HTTPException(status_code=403, detail="You do not have access to this application")

        pending = db.query(AppInvitation).filter(
            AppInvitation.app_id == app_id,
            AppInvitation.status == "pending"
        ).all()

        return {
            "owner": app.user.email if app.user else None,
            "collaborators": [u.email for u in app.collaborators],
            "pending_invitations": [p.email for p in pending]
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to fetch collaborators for app {app_id}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to fetch collaborators"
        )
