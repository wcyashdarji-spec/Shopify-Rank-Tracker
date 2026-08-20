from sqlalchemy import func
from sqlalchemy.orm import Session
from fastapi import APIRouter, Depends, HTTPException

from app.db import get_db
from app.db.models.user import User
from app.core.logger import get_logger
from app.api.auth_deps import get_current_user, verify_cron_key
from app.schemas.request import CompetitorCreateRequest
from app.db.repositories.ranking_repository import RankingRepository
from app.core.logging_route import LoggingRoute

logger = get_logger(__name__)

router = APIRouter(
    prefix="/apps",
    tags=["Apps"],
    route_class=LoggingRoute,
)


@router.post("/cron/listing-audit")
async def run_cron_listing_audits(db: Session = Depends(get_db), _cron_auth: None = Depends(verify_cron_key)):
    """
    Execute scheduled listing audits for all active applications.

    This endpoint is intended for automated cron jobs. It performs a
    fresh listing audit for every active primary application and its
    linked competitors, updates the stored audit data and history, and
    returns a summary of successful and failed audit executions.

    Raises:
        HTTPException:
            - 500: If an unexpected error occurs while executing the
              scheduled listing audit process.
    """
    try:
        from app.db.models.ranking import App as AppModel
        from app.services.audit_service import AuditService
        
        apps = db.query(AppModel).filter(
            AppModel.is_competitor == False,
            AppModel.is_deleted == False
        ).all()
        
        results = []
        for app in apps:
            try:
                logger.info(f"Cron: Auditing primary app {app.name} (id={app.id})...")
                await AuditService.run_and_save_audit(db, app.id, app.name, app.url)
                
                for competitor in app.competitors:
                    try:
                        logger.info(f"Cron: Auditing competitor {competitor.name} (id={competitor.id}) linked to {app.name}...")
                        await AuditService.run_and_save_audit(db, competitor.id, competitor.name, competitor.url)
                    except Exception as ec:
                        logger.error(f"Cron: Failed to audit competitor {competitor.name} (id={competitor.id}): {ec}")
                
                results.append({"app_id": app.id, "name": app.name, "status": "success"})
            except Exception as ea:
                logger.error(f"Cron: Failed to audit primary app {app.name} (id={app.id}): {ea}")
                results.append({"app_id": app.id, "name": app.name, "status": "failed", "error": str(ea)})
                
        return {
            "status": "completed",
            "audited_count": len(results),
            "results": results
        }
    except Exception as e:
        logger.exception(f"Cron: Failed to execute automated listing audits: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to execute automated listing audits")
    

@router.get("/apps")
async def get_all_apps(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get all tracked apps for the authenticated user.

    Args:
        db: Database session.
        current_user: Authenticated user.

    Returns:
        List of all user's apps with their tracking history count.
    """
    try:
        from app.db.models.ranking import RankingHistory

        apps = RankingRepository.get_all_apps(db, user_id=current_user.id)

        app_ids = [app.id for app in apps]
        counts_query = (
            db.query(RankingHistory.app_id, func.count(RankingHistory.id).label("cnt"))
            .filter(RankingHistory.app_id.in_(app_ids))
            .group_by(RankingHistory.app_id)
            .all()
        )
        history_counts = {row.app_id: row.cnt for row in counts_query}

        return {
            "apps": [
                {
                    "id": app.id,
                    "user_id": app.user_id,
                    "name": app.name,
                    "url": app.url,
                    "created_at": app.created_at.isoformat(),
                    "history_count": history_counts.get(app.id, 0),
                    "keywords": [{"id": k.id, "name": k.name} for k in app.keywords],
                    "audit_last_synced_at": app.audit_last_synced_at.isoformat() if app.audit_last_synced_at else None,
                    "last_synced_at": app.last_synced_at.isoformat() if app.last_synced_at else None,
                    "sync_status": app.sync_status,
                }
                for app in apps
            ]
        }

    except Exception as e:
        logger.exception(f"Failed to retrieve apps for user={current_user.email}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve apps")


@router.delete("/apps/{app_id}")
async def delete_app(
    app_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Delete an application and all of its associated rankings and keyword mappings if owned by the user.

    Args:
        app_id: App ID.
        db: Database session.
        current_user: Authenticated user.

    Returns:
        Confirmation message.
    """
    try:
        app = RankingRepository.get_app_by_id(db, app_id, user_id=current_user.id)
        if not app:
            raise HTTPException(status_code=404, detail="App not found")

        RankingRepository.delete_app(db, app)

        return {
            "message": "Application deleted successfully",
            "app": {
                "id": app.id,
                "name": app.name,
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to delete app_id={app_id} for user={current_user.email}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete application")


@router.get("/{app_id}/competitors")
async def get_competitors(
    app_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve all competitors associated with a primary application.

    This endpoint verifies that the requested application belongs to the
    authenticated user and returns the list of linked competitor apps.
    Each competitor includes its basic information along with the total
    number of ranking history records available.

    Uses a single bulk query to fetch the latest audit record for the
    primary app and all competitors instead of one query per app.

    Raises:
        HTTPException:
            - 404: If the requested application does not exist.
            - 500: If an unexpected error occurs while retrieving competitors.
    """
    try:
        app = RankingRepository.get_app_by_id(db, app_id, user_id=current_user.id)
        if not app:
            raise HTTPException(status_code=404, detail="App not found")

        import json
        from sqlalchemy import text
        from app.db.models.ranking import AppAuditHistory

        all_app_ids = [app.id] + [c.id for c in app.competitors]

        subq = (
            db.query(
                AppAuditHistory.app_id,
                func.max(AppAuditHistory.created_at).label("max_created_at"),
            )
            .filter(AppAuditHistory.app_id.in_(all_app_ids))
            .group_by(AppAuditHistory.app_id)
            .subquery()
        )
        latest_audits = (
            db.query(AppAuditHistory)
            .join(
                subq,
                (AppAuditHistory.app_id == subq.c.app_id)
                & (AppAuditHistory.created_at == subq.c.max_created_at),
            )
            .all()
        )
        audit_by_app = {a.app_id: a for a in latest_audits}

        def _get_parsed_data(target_app):
            """Return parsed JSON dict for the app's latest audit, or None."""
            audit = audit_by_app.get(target_app.id)
            if audit:
                try:
                    return json.loads(audit.scraped_data)
                except Exception:
                    pass
            if target_app.audit_data:
                try:
                    return json.loads(target_app.audit_data)
                except Exception:
                    pass
            return None

        def get_starting_price(target_app):
            data = _get_parsed_data(target_app)
            if not data:
                return "Not found"
            plans = data.get("raw_pricing_plans", [])
            if not plans:
                return "Not found"
            first_plan = plans[0].replace("\n", "").replace("  ", " ").strip()
            if len(plans) > 1:
                return f"{first_plan} + more"
            return first_plan

        def get_rating_and_reviews(target_app):
            data = _get_parsed_data(target_app)
            if not data:
                return 4.5, "0 reviews"
            rating = data.get("rating_val", 4.5)
            reviews = data.get("reviews_text", "0 reviews")
            return rating, reviews

        main_rating, main_reviews = get_rating_and_reviews(app)

        return {
            "main_app": {
                "id": app.id,
                "name": app.name,
                "price_text": get_starting_price(app),
                "rating": main_rating,
                "reviews_count": main_reviews
            },
            "competitors": [
                {
                    "id": c.id,
                    "name": c.name,
                    "url": c.url,
                    "created_at": c.created_at.isoformat(),
                    "history_count": len(c.rankings),
                    "rating": get_rating_and_reviews(c)[0],
                    "reviews_count": get_rating_and_reviews(c)[1],
                    "price_text": get_starting_price(c)
                }
                for c in app.competitors
            ]
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to get competitors for app_id={app_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve competitors")


@router.post("/{app_id}/competitors")
async def add_competitor(
    app_id: int,
    request: CompetitorCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Add a competitor application to a primary application.

    This endpoint validates ownership of the primary application,
    creates or associates the specified competitor, and links it to
    the selected application. The response includes the newly added
    competitor's basic information.

    Raises:
        HTTPException:
            - 404: If the requested application does not exist.
            - 500: If an unexpected error occurs while adding the competitor.
    """
    try:
        app = RankingRepository.get_app_by_id(db, app_id, user_id=current_user.id)
        if not app:
            raise HTTPException(status_code=404, detail="App not found")

        competitor = RankingRepository.add_competitor_to_app(db, app, request.name, str(request.url))

        return {
            "message": "Competitor added successfully",
            "competitor": {
                "id": competitor.id,
                "name": competitor.name,
                "url": competitor.url,
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to add competitor to app_id={app_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to add competitor")


@router.delete("/{app_id}/competitors/{competitor_id}")
async def delete_competitor(
    app_id: int,
    competitor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Remove a competitor from a primary application.

    This endpoint verifies ownership of both the primary application
    and the competitor, removes the association between them, and
    returns a confirmation message upon successful deletion.

    Raises:
        HTTPException:
            - 404: If the application or competitor cannot be found.
            - 500: If an unexpected error occurs while removing the competitor.
    """
    try:
        app = RankingRepository.get_app_by_id(db, app_id, user_id=current_user.id)
        if not app:
            raise HTTPException(status_code=404, detail="App not found")

        competitor = db.query(User.apps.mapper.class_).filter(
            User.apps.mapper.class_.id == competitor_id,
            User.apps.mapper.class_.user_id == current_user.id,
            User.apps.mapper.class_.is_competitor == True
        ).first()
        
        if not competitor:

            from app.db.models.ranking import App as AppModel
            competitor = db.query(AppModel).filter(
                AppModel.id == competitor_id,
                AppModel.user_id == current_user.id,
                AppModel.is_competitor == True
            ).first()

        if not competitor:
            raise HTTPException(status_code=404, detail="Competitor not found")

        RankingRepository.remove_competitor_from_app(db, app, competitor)

        return {
            "message": "Competitor removed successfully",
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to delete competitor_id={competitor_id} from app_id={app_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to remove competitor")


@router.get("/{app_id}/listing-audit")
async def get_listing_audit(
    app_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve the listing audit for a specific application.

    This endpoint returns the most recent cached listing audit for the
    specified application. If no cached audit is available, a new audit
    is executed, stored, and returned. Access is restricted to
    applications owned by the authenticated user.

    Raises:
        HTTPException:
            - 404: If the requested application cannot be found.
            - 500: If an unexpected error occurs while retrieving the audit.
    """
    try:
        app = RankingRepository.get_app_by_id(db, app_id, user_id=current_user.id)
        if not app:
            raise HTTPException(status_code=404, detail="App not found")

        from datetime import datetime
        from app.core.config import DAILY_AUDIT_LIMIT

        app_limit = DAILY_AUDIT_LIMIT

        today_utc = datetime.utcnow().date()
        last_sync_date = app.audit_last_synced_at.date() if app.audit_last_synced_at else None
        
        if last_sync_date == today_utc:
            todays_audits_count = app.audit_run_count or 0
        else:
            todays_audits_count = 0
            if app.audit_run_count != 0:
                app.audit_run_count = 0
                db.commit()

        if app_limit is not None:
            remaining_audits = max(0, app_limit - todays_audits_count)
        else:
            remaining_audits = None

        if not app.audit_data:
            audit_result = {"status": "not_run"}
        else:
            import json
            try:
                audit_result = json.loads(app.audit_data)
            except Exception as e:
                logger.error(f"Failed to parse database audit data for app {app.id}: {e}")
                audit_result = {"status": "not_run"}

        audit_result["audit_last_synced_at"] = app.audit_last_synced_at.isoformat() if app.audit_last_synced_at else None
        audit_result["daily_audit_limit"] = app_limit
        audit_result["todays_audits_count"] = todays_audits_count
        audit_result["remaining_audits"] = remaining_audits

        return audit_result
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to retrieve listing audit for app_id={app_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve listing audit")


@router.post("/{app_id}/listing-audit")
async def run_listing_audit(
    app_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Execute a new listing audit for a specific application.

    This endpoint bypasses any cached audit data, performs a fresh
    analysis of the application's listing, stores the updated audit
    results, and returns the latest findings to the client.

    Raises:
        HTTPException:
            - 404: If the requested application cannot be found.
            - 500: If an unexpected error occurs while executing the audit.
    """
    try:
        app = RankingRepository.get_app_by_id(db, app_id, user_id=current_user.id)
        if not app:
            raise HTTPException(status_code=404, detail="App not found")

        from datetime import datetime
        from app.core.config import DAILY_AUDIT_LIMIT

        app_limit = DAILY_AUDIT_LIMIT

        today_utc = datetime.utcnow().date()
        last_sync_date = app.audit_last_synced_at.date() if app.audit_last_synced_at else None
        
        if last_sync_date == today_utc:
            todays_audits_count = app.audit_run_count or 0
        else:
            todays_audits_count = 0
            if app.audit_run_count != 0:
                app.audit_run_count = 0
                db.commit()

        if app_limit is not None and todays_audits_count >= app_limit:
            raise HTTPException(
                status_code=429,
                detail=f"Daily re-audit limit of {app_limit} runs reached for this application. Please try again tomorrow."
            )

        from app.services.audit_service import AuditService
        
        audit_result = await AuditService.run_and_save_audit(db, app.id, app.name, app.url)

        db.refresh(app)
        
        last_sync_date_new = app.audit_last_synced_at.date() if app.audit_last_synced_at else None
        if last_sync_date_new == today_utc:
            updated_todays_audits = app.audit_run_count or 0
        else:
            updated_todays_audits = 0
        
        for competitor in app.competitors:
            try:
                logger.info(f"Auto-running listing audit for competitor {competitor.name} (id={competitor.id}) because primary app optimizer is run.")
                await AuditService.run_and_save_audit(db, competitor.id, competitor.name, competitor.url)
            except Exception as e:
                logger.error(f"Failed to run listing audit for competitor {competitor.name}: {e}")
                
        audit_result["audit_last_synced_at"] = app.audit_last_synced_at.isoformat() if app.audit_last_synced_at else None
        audit_result["daily_audit_limit"] = app_limit
        audit_result["todays_audits_count"] = updated_todays_audits
        audit_result["remaining_audits"] = max(0, app_limit - updated_todays_audits) if app_limit is not None else None

        return audit_result
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to execute listing audit for app_id={app_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to execute listing audit")


@router.get("/{app_id}/competitors-activity")
async def get_competitors_activity(
    app_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve activity logs for an application and its competitors.

    This endpoint compares historical audit records to identify
    day-over-day changes in reviews, pricing, listing metadata,
    feature tags, and integrations for both the selected application
    and its linked competitors. Activities are returned in reverse
    chronological order with detailed change information where
    applicable.

    Raises:
        HTTPException:
            - 404: If the requested application cannot be found.
            - 500: If an unexpected error occurs while generating the
              activity log.
    """
    try:
        import re
        import json
        from datetime import datetime
        from app.db.models.ranking import App as AppModel, AppAuditHistory
        from app.services.audit_service import AuditService

        app = RankingRepository.get_app_by_id(db, app_id, user_id=current_user.id)
        if not app:
            raise HTTPException(status_code=404, detail="App not found")

        apps_to_check = [app] + app.competitors

        for a in apps_to_check:
            existing = db.query(AppAuditHistory).filter(AppAuditHistory.app_id == a.id).count()
            if existing == 0:
                try:
                    logger.info(f"Auto-scraping ASO data for {a.name} (app_id={a.id}) on activity fetch...")
                    await AuditService.get_audit(db, a.id, a.name, a.url)
                except Exception as ex:
                    logger.error(f"Failed to auto-scrape activity data for {a.name}: {ex}")

        activity_logs = []

        for a in apps_to_check:
            history_entries = (
                db.query(AppAuditHistory)
                .filter(AppAuditHistory.app_id == a.id)
                .order_by(AppAuditHistory.created_at.asc())
                .all()
            )

            for idx in range(1, len(history_entries)):
                prev_entry = history_entries[idx - 1]
                curr_entry = history_entries[idx]

                try:
                    prev_data = json.loads(prev_entry.scraped_data)
                    curr_data = json.loads(curr_entry.scraped_data)
                except Exception as parse_err:
                    logger.error(f"Failed to parse audit history data for {a.name}: {parse_err}")
                    continue

                date_str = curr_entry.created_at.strftime("%m/%d/%Y")

                prev_rev_match = re.search(r"(\d+)", prev_entry.reviews_text or "0")
                curr_rev_match = re.search(r"(\d+)", curr_entry.reviews_text or "0")
                prev_revs = int(prev_rev_match.group(1)) if prev_rev_match else 0
                curr_revs = int(curr_rev_match.group(1)) if curr_rev_match else 0

                if prev_revs != curr_revs:
                    diff = curr_revs - prev_revs
                    activity_logs.append({
                        "id": f"rev_{curr_entry.id}",
                        "app_name": a.name,
                        "is_competitor": a.is_competitor,
                        "type": "REVIEW",
                        "text": f"Reviews: {prev_revs} → {curr_revs} ({'+' if diff >= 0 else ''}{diff})",
                        "date": date_str,
                        "has_details": False,
                        "details": {}
                    })

                prev_plans = prev_data.get("raw_pricing_plans", [])
                curr_plans = curr_data.get("raw_pricing_plans", [])
                if prev_plans != curr_plans:
                    activity_logs.append({
                        "id": f"price_{curr_entry.id}",
                        "app_name": a.name,
                        "is_competitor": a.is_competitor,
                        "type": "PRICE",
                        "text": "Pricing changed — click for details",
                        "date": date_str,
                        "has_details": True,
                        "details": {
                            "title": "Pricing Change",
                            "subtitle": "Pricing plans updated",
                            "previous": prev_plans,
                            "current": curr_plans
                        }
                    })

                prev_title = prev_data.get("title", "")
                curr_title = curr_data.get("title", "")
                prev_meta = prev_data.get("meta_description", "")
                curr_meta = curr_data.get("meta_description", "")
                prev_desc = prev_data.get("description_text", "")
                curr_desc = curr_data.get("description_text", "")

                if prev_title != curr_title:
                    activity_logs.append({
                        "id": f"title_{curr_entry.id}",
                        "app_name": a.name,
                        "is_competitor": a.is_competitor,
                        "type": "LISTING",
                        "text": "App title updated",
                        "date": date_str,
                        "has_details": True,
                        "details": {
                            "title": "Title Change",
                            "subtitle": "Title",
                            "previous": [prev_title] if prev_title else [],
                            "current": [curr_title] if curr_title else []
                        }
                    })

                if prev_meta != curr_meta:
                    activity_logs.append({
                        "id": f"meta_{curr_entry.id}",
                        "app_name": a.name,
                        "is_competitor": a.is_competitor,
                        "type": "LISTING",
                        "text": "Meta description updated",
                        "date": date_str,
                        "has_details": True,
                        "details": {
                            "title": "Meta Description Change",
                            "subtitle": "Meta Description",
                            "previous": [prev_meta] if prev_meta else [],
                            "current": [curr_meta] if curr_meta else []
                        }
                    })

                if prev_desc != curr_desc:
                    activity_logs.append({
                        "id": f"desc_{curr_entry.id}",
                        "app_name": a.name,
                        "is_competitor": a.is_competitor,
                        "type": "LISTING",
                        "text": "Description text updated",
                        "date": date_str,
                        "has_details": True,
                        "details": {
                            "title": "Description Change",
                            "subtitle": "Description",
                            "previous": [prev_desc] if prev_desc else [],
                            "current": [curr_desc] if curr_desc else []
                        }
                    })

                prev_feats = prev_data.get("key_features", [])
                curr_feats = curr_data.get("key_features", [])
                if prev_feats != curr_feats:
                    activity_logs.append({
                        "id": f"feats_{curr_entry.id}",
                        "app_name": a.name,
                        "is_competitor": a.is_competitor,
                        "type": "LISTING",
                        "text": "Feature list updated",
                        "date": date_str,
                        "has_details": True,
                        "details": {
                            "title": "Feature List Change",
                            "subtitle": "Feature List",
                            "previous": prev_feats,
                            "current": curr_feats
                        }
                    })

                prev_langs = prev_data.get("languages", [])
                curr_langs = curr_data.get("languages", [])
                added_langs = [l for l in curr_langs if l not in prev_langs]
                removed_langs = [l for l in prev_langs if l not in curr_langs]
                if added_langs or removed_langs:
                    lang_desc = "Languages updated"
                    if added_langs:
                        lang_desc += f" (added: {', '.join(added_langs)})"
                    if removed_langs:
                        lang_desc += f" (removed: {', '.join(removed_langs)})"
                    activity_logs.append({
                        "id": f"lang_{curr_entry.id}",
                        "app_name": a.name,
                        "is_competitor": a.is_competitor,
                        "type": "LANGUAGE",
                        "text": lang_desc,
                        "date": date_str,
                        "has_details": True,
                        "details": {
                            "title": "Language Change",
                            "subtitle": "Supported languages updated",
                            "previous": prev_langs,
                            "current": curr_langs
                        }
                    })

                prev_tags = prev_data.get("raw_feature_tags", [])
                curr_tags = curr_data.get("raw_feature_tags", [])
                added_tags = [t for t in curr_tags if t not in prev_tags]
                removed_tags = [t for t in prev_tags if t not in curr_tags]
                if added_tags or removed_tags:
                    desc_text = "Feature tags updated"
                    if added_tags:
                        desc_text += f" (added: {', '.join(added_tags)})"
                    activity_logs.append({
                        "id": f"cat_{curr_entry.id}",
                        "app_name": a.name,
                        "is_competitor": a.is_competitor,
                        "type": "CATEGORY",
                        "text": desc_text,
                        "date": date_str,
                        "has_details": True,
                        "details": {
                            "title": "Category Change",
                            "subtitle": "Feature tags updated",
                            "previous": prev_tags,
                            "current": curr_tags
                        }
                    })

                prev_integ = prev_data.get("raw_integrations", [])
                curr_integ = curr_data.get("raw_integrations", [])
                added_integ = [i for i in curr_integ if i not in prev_integ]
                removed_integ = [i for i in prev_integ if i not in curr_integ]
                if added_integ or removed_integ:
                    desc_text = "Integrations changed"
                    if added_integ:
                        desc_text += f": {', '.join(added_integ)}"
                    activity_logs.append({
                        "id": f"tech_{curr_entry.id}",
                        "app_name": a.name,
                        "is_competitor": a.is_competitor,
                        "type": "TECHNICAL",
                        "text": desc_text,
                        "date": date_str,
                        "has_details": True,
                        "details": {
                            "title": "Technical Change",
                            "subtitle": "Integrations (Works With) updated",
                            "previous": prev_integ,
                            "current": curr_integ
                        }
                    })

        def parse_date(d_str):
            try:
                return datetime.strptime(d_str, "%m/%d/%Y")
            except:
                return datetime.min

        activity_logs.sort(key=lambda x: parse_date(x["date"]), reverse=True)

        return {
            "app_id": app_id,
            "activity_count": len(activity_logs),
            "activities": activity_logs
        }
    except Exception as e:
        logger.exception(f"Failed to generate competitors activity log: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve competitor activity log")


@router.get("/{app_id}/head-to-head/{competitor_id}")
async def get_head_to_head(
    app_id: int,
    competitor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generate a side-by-side comparison between an application and a competitor.

    This endpoint compares the latest audit metrics for the selected
    application and competitor, including reviews, ratings, pricing,
    Built for Shopify status, screenshots, supported languages,
    features, and keyword rankings. The comparison is built using the
    most recent audit and ranking history available for each
    application.

    Raises:
        HTTPException:
            - 404: If the application or competitor cannot be found.
            - 500: If an unexpected error occurs while generating the
              comparison.
    """
    try:
        from app.db.models.ranking import App as AppModel, AppAuditHistory, RankingHistory
        import json
        import re

        app = RankingRepository.get_app_by_id(db, app_id, user_id=current_user.id)
        if not app:
            raise HTTPException(status_code=404, detail="App not found")

        competitor = db.query(AppModel).filter(
            AppModel.id == competitor_id,
            AppModel.is_deleted == False
        ).first()
        if not competitor:
            raise HTTPException(status_code=404, detail="Competitor not found")

        def get_audit_details(target_app):
            history = (
                db.query(AppAuditHistory)
                .filter(AppAuditHistory.app_id == target_app.id)
                .order_by(AppAuditHistory.created_at.desc())
                .first()
            )
            
            data = None
            if history:
                try:
                    data = json.loads(history.scraped_data)
                except:
                    pass
            elif target_app.audit_data:
                try:
                    data = json.loads(target_app.audit_data)
                except:
                    pass
            
            if not data:
                return {
                    "reviews": "0",
                    "rating": "4.5",
                    "price": "Not found",
                    "bfs_badge": "No",
                    "screenshots": "7",
                    "video": "No",
                    "languages": "4",
                    "features": "5"
                }

            revs_match = re.search(r"(\d[\d,]*)", data.get("reviews_text", "0"))
            reviews = revs_match.group(1) if revs_match else "0"
            rating = str(data.get("rating_val", 4.5))
            
            plans = data.get("raw_pricing_plans", [])
            price = "Not found"
            if plans:
                first_plan = plans[0].replace("\n", "").replace("  ", " ").strip()
                if len(plans) > 1:
                    price = f"{first_plan} + more"
                else:
                    price = first_plan
            
            bfs = "Yes" if data.get("built_for_shopify") else "No"
            
            screenshots = str(data.get("screenshot_count", 7))
            
            video = "Yes" if data.get("has_video") else "No"
            
            langs = data.get("languages", ["English"])
            languages = str(len(langs))
            
            feat_list = data.get("raw_feature_tags", [])
            features = str(len(feat_list)) if feat_list else "5"
            
            return {
                "reviews": reviews,
                "rating": rating,
                "price": price,
                "bfs_badge": bfs,
                "screenshots": screenshots,
                "video": video,
                "languages": languages,
                "features": features
            }

        you_details = get_audit_details(app)
        them_details = get_audit_details(competitor)

        keyword_rankings = []
        for keyword in app.keywords:

            you_history = (
                db.query(RankingHistory)
                .filter(RankingHistory.app_id == app.id, RankingHistory.keyword_id == keyword.id)
                .order_by(RankingHistory.tracked_date.desc())
                .first()
            )
            you_rank = f"#{you_history.rank}" if (you_history and you_history.found and you_history.rank) else "-"

            them_history = (
                db.query(RankingHistory)
                .filter(RankingHistory.app_id == competitor.id, RankingHistory.keyword_id == keyword.id)
                .order_by(RankingHistory.tracked_date.desc())
                .first()
            )
            them_rank = f"#{them_history.rank}" if (them_history and them_history.found and them_history.rank) else "-"

            keyword_rankings.append({
                "keyword": keyword.name,
                "you_rank": you_rank,
                "them_rank": them_rank
            })

        return {
            "you": you_details,
            "them": them_details,
            "keyword_rankings": keyword_rankings
        }

    except Exception as e:
        logger.exception(f"Failed to generate head-to-head comparison: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve head-to-head comparison")

