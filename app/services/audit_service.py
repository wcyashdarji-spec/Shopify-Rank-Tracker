import re
import json
import asyncio
from datetime import datetime
from urllib.parse import urlsplit
from sqlalchemy.orm import Session

from app.db.models.ranking import App
from app.core.logger import get_logger
from app.services.browser import BrowserManager
from app.services.audit_agent import run_agent_audit

logger = get_logger(__name__)

CURRENTLY_SCRAPING = set()


def clean_string_list(items: list) -> list:
    """Normalize whitespace, remove literal newlines, and filter duplicates."""
    try:
        import re
        cleaned = []
        for item in items:
            if not item or not isinstance(item, str):
                continue
            txt = item.replace("\\n", " ").replace("\n", " ").replace("\r", " ")
            txt = re.sub(r"\s+", " ", txt).strip()
            if txt and txt not in cleaned:
                cleaned.append(txt)
        return cleaned
    except Exception as e:
        logger.error(f"Error cleaning string list: {e}")
        return []

class AuditService:
    """
    Provide services for scraping, auditing, and managing Shopify App
    Store listing audit data.

    This service retrieves cached audits, executes fresh listing
    analyses, persists audit results and history, and generates
    comparison data for application listings.
    """

    @staticmethod
    async def get_audit(db: Session, app_id: int, app_name: str, app_url: str) -> dict:
        """
        Retrieve the listing audit for a specific application.

        This method returns the cached audit data stored in the database
        when available. If no valid audit exists or the cached data cannot
        be parsed, a new listing audit is executed, stored, and returned.

        Raises:
            Exception:
                Propagates any unexpected errors encountered while
                retrieving or generating the audit.
        """
        try:
            app = db.query(App).filter(App.id == app_id).first()
            if app and app.audit_data:
                try:
                    return json.loads(app.audit_data)
                except Exception as e:
                    logger.error(f"Failed to parse database audit data for app {app_id}: {e}")
        except Exception as e:
            logger.error(f"Failed to read database audit for app {app_id}: {e}")

        return await AuditService.run_and_save_audit(db, app_id, app_name, app_url)


    @staticmethod
    async def run_and_save_audit(db: Session, app_id: int, app_name: str, app_url: str) -> dict:
        """
        Execute a fresh listing audit and persist the results.

        This method scrapes the Shopify App Store listing, generates an
        audit report, stores the latest audit on the application record,
        creates a historical audit entry, and seeds sample historical data
        when required for activity tracking.

        Raises:
            Exception:
                Propagates any unexpected errors encountered during audit
                generation or persistence.
        """
        if app_id in CURRENTLY_SCRAPING:
            logger.info(f"Audit for app {app_id} is already in progress. Waiting for concurrent run to finish...")
            import time
            for _ in range(30):
                await asyncio.sleep(1.0)
                if app_id not in CURRENTLY_SCRAPING:
                    app = db.query(App).filter(App.id == app_id).first()
                    if app and app.audit_data:
                        try:
                            return json.loads(app.audit_data)
                        except:
                            pass
                    break
            logger.warning(f"Timeout waiting for concurrent audit of app {app_id}.")
            return {}

        try:
            CURRENTLY_SCRAPING.add(app_id)
            audit_data = await asyncio.to_thread(
                AuditService.execute_scrape_and_rules,
                app_name,
                app_url,
            )
            audit_data["app_id"] = app_id
            
            try:
                app = db.query(App).filter(App.id == app_id).first()
                if app:
                    app.audit_data = json.dumps(audit_data, ensure_ascii=False)
                    
                    today_utc = datetime.utcnow().date()
                    last_sync_date = app.audit_last_synced_at.date() if app.audit_last_synced_at else None
                    if last_sync_date == today_utc:
                        app.audit_run_count = (app.audit_run_count or 0) + 1
                    else:
                        app.audit_run_count = 1
                        
                    app.audit_last_synced_at = datetime.utcnow()
                    db.commit()
                    logger.info(f"Saved listing audit to database for app {app_id} ({app_name}).")
                else:
                    logger.error(f"App {app_id} not found in database when saving audit.")
            except Exception as e:
                db.rollback()
                logger.error(f"Failed to save database audit for app {app_id}: {e}")

            try:
                from app.db.models.ranking import AppAuditHistory
                
                if not audit_data.get("raw_integrations"):
                    # audit_data["raw_integrations"] = ["Sales channels", "Finding products", "Selling products", "Orders and shipping", "Store design", "Marketing and conversion", "Checkout"]
                    audit_data["raw_integrations"] = []
                    
                if not audit_data.get("raw_feature_tags"):
                    # audit_data["raw_feature_tags"] = ["Auto-alerts", "Batch send", "Back in stock", "Multi-language", "Email", "SMS", "Out of stock", "Price drop", "Custom alerts", "Alert settings", "Notification templates", "Notification button", "Pop-ups", "Waitlists", "Customer demand", "Inventory reports", "Performance reports", "Analytics", "Checkout"]
                    audit_data["raw_feature_tags"] = []

                if not audit_data.get("raw_pricing_plans"):
                    audit_data["raw_pricing_plans"] = []
                    
                history = AppAuditHistory(
                    app_id=app_id,
                    overall_score=audit_data.get("overall_score", 0),
                    reviews_text=audit_data.get("reviews_text", "0 reviews"),
                    rating_val=audit_data.get("rating_val", 4.5),
                    scraped_data=json.dumps(audit_data, ensure_ascii=False)
                )
                db.add(history)
                db.commit()
                logger.info(f"Saved Listing Audit History entry for app {app_id}.")
                
            except Exception as eh:
                db.rollback()
                logger.error(f"Failed to save Listing Audit History entry for app {app_id}: {eh}")
                
            return audit_data
        finally:
            CURRENTLY_SCRAPING.discard(app_id)


    @staticmethod
    def _build_agent_payload(scraped: dict) -> dict:
        """
        Convert the flat scraped dict into a clean, nested structure
        that is passed to the AI audit agent as its primary JSON payload.

        The flat keys (screenshot_urls, app_icon_url, etc.) remain on
        the scraped dict so audit_agent.py can still attach them as
        multimodal ImageUrl objects.
        """
        
        urls = scraped.get("screenshot_urls", [])
        alts = scraped.get("screenshot_alts", [])
        screenshots = [
            {"url": u, "alt": alts[i] if i < len(alts) else ""}
            for i, u in enumerate(urls)
        ]

        _FEATURE_GROUPS = {
            "notifications": {"auto-alerts", "low stock", "back in stock", "email", "sms",
                              "out of stock", "price drop", "custom alerts"},
            "customization":  {"alert settings", "notification templates", "notification button",
                              "pop-ups", "popups"},
            "analytics":      {"inventory reports", "performance reports", "analytics",
                              "inventory tracking"},
            "wishlist":       {"guest wishlist", "multiple lists", "public wishlist",
                              "share links", "email sharing", "conversion analytics",
                              "dashboard", "waitlists"},
        }
        features: dict = {k: [] for k in _FEATURE_GROUPS}
        features["other"] = []
        for tag in scraped.get("feature_tags", []):
            placed = False
            for group, keywords in _FEATURE_GROUPS.items():
                if tag.lower() in keywords:
                    features[group].append(tag)
                    placed = True
                    break
            if not placed:
                features["other"].append(tag)

        features = {k: v for k, v in features.items() if v}

        pricing_plans = scraped.get("pricing_plans", [])

        return {
            "app": {
                "title":           scraped.get("title", ""),
                "built_for_shopify": scraped.get("built_for_shopify", False),
                "icon_url":        scraped.get("app_icon_url"),
            },
            "rating": {
                "score":   scraped.get("rating_val", 0.0),
                "reviews": scraped.get("reviews_text", "0 reviews"),
            },
            "pricing": {
                "plans":            pricing_plans,
                "feature_slots_used": scraped.get("price_slots_used", 0),
            },
            "description": {
                "full_text":        scraped.get("description_text", ""),
                "meta_description": scraped.get("meta_description", ""),
                "key_features":     scraped.get("key_features", []),
            },
            "media": {
                "video_available": scraped.get("has_video", False),
                "screenshots":     screenshots,
            },
            "links": {
                "demo_store":    scraped.get("demo_link"),
                "privacy_policy": scraped.get("privacy_link"),
                "faq":           scraped.get("faq_link"),
                "documentation": scraped.get("docs_link"),
                "tutorial":      scraped.get("tutorial_link"),
            },
            "languages":    scraped.get("languages", ["English"]),
            "categories":   scraped.get("categories", []),
            "features":     features,
            "integrations": scraped.get("integrations", []),
            "feature_tags": scraped.get("feature_tags", []),
        }

    @staticmethod
    def execute_scrape_and_rules(app_name: str, app_url: str) -> dict:
        """
        Scrape a Shopify App Store listing and generate an audit report.

        This method extracts listing metadata, ratings, reviews,
        screenshots, pricing, integrations, feature tags, languages, and
        other application details using Playwright. The collected data is
        then submitted to the AI audit engine to produce a structured ASO
        audit report.

        Returns:
            dict:
                A structured listing audit containing the extracted
                application data and AI-generated audit results.

        Raises:
            Exception:
                Propagates any unexpected errors encountered during
                scraping or audit generation.
        """
        scraped = {
            "title": app_name,
            "reviews_text": "0 reviews",
            "rating_val": 0.0,
            "built_for_shopify": False,
            "screenshot_count": 0,
            "screenshot_alts": [],
            "screenshot_urls": [],
            "app_icon_url": None,
            "has_video": False,
            "privacy_link": None,
            "faq_link": None,
            "docs_link": None,
            "tutorial_link": None,
            "demo_link": None,
            "categories": [],
            "integrations": [],
            "languages": ["English"],
            "meta_description": "",
            "description_text": "",
            "price_slots_used": 0,
            "feature_tags_count": 0,
        }

        try:
            with BrowserManager(headless=True) as page:
                logger.info(f"Scraping Shopify App listing: {app_url}")
                page.set_extra_http_headers({
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                })
                page.goto(app_url, wait_until="domcontentloaded", timeout=45000)
                
                page.wait_for_timeout(3000)
                
                title_loc = page.locator("h1")
                if title_loc.count() > 0:
                    scraped["title"] = title_loc.first.inner_text().strip()
                
                _ICON_EXCLUDES = ("story-pages", "assets/merchant", "guide-built-for-shopify", "hero-")
                _icon_selectors = [
                    "img.app-listing__icon",
                    ".app-header__logo img",
                    "[data-testid='app-logo'] img",
                    "img.wt-app-icon",
                    "img[src*='listing_images']",
                    "header img[alt]",
                    "img[src*='cdn.shopify.com'][src*='icon']",
                ]
                for _icon_sel in _icon_selectors:
                    _icon_loc = page.locator(_icon_sel).first
                    if _icon_loc.count() > 0:
                        _icon_src = _icon_loc.get_attribute("src") or ""
   
                        if _icon_src and not any(x in _icon_src for x in _ICON_EXCLUDES):
                            scraped["app_icon_url"] = _icon_src
                            break
                
                rating_val = 0.0
                reviews_text = ""

                try:
                    page_text = page.locator("body").inner_text()

                    match = re.search(r"\b(\d\.\d)\s*(?:★|star|stars)?\s*\(([\d,]+)\)", page_text)
                    if match:
                        rating_val = float(match.group(1))
                        reviews_text = f"{match.group(2).strip()} reviews"
                except:
                    pass

                if not rating_val:
                    rating_selectors = [
                        "span:has-text('of 5 stars')",
                        "span.wt-text-caption:has-text('star')",
                        ".app-header__rating span",
                        "div.app-header__rating",
                        "span:has-text('stars')"
                    ]
                    for sel in rating_selectors:
                        try:
                            loc = page.locator(sel).first
                            if loc.count() > 0:
                                txt = loc.inner_text().strip()
                                match = re.search(r"(\d+(\.\d+)?)", txt)
                                if match:
                                    rating_val = float(match.group(1))
                                    break
                        except:
                            pass

                if not reviews_text or reviews_text.lower() in ["reviews", "ratings"] or "%" in reviews_text or "ratings are" in reviews_text.lower() or "of ratings" in reviews_text.lower():
                    reviews_selectors = [
                        "a[href='#reviews']",
                        "span:has-text('reviews')",
                        "span:has-text('ratings')",
                        "a:has-text('reviews')",
                        "a:has-text('ratings')"
                    ]
                    for sel in reviews_selectors:
                        try:
                            loc = page.locator(sel).first
                            if loc.count() > 0:
                                txt = loc.inner_text().strip()
                                if txt and txt.lower() != "reviews" and txt.lower() != "ratings":
                                    if "%" not in txt and "ratings are" not in txt.lower() and "of ratings" not in txt.lower() and len(txt) < 25:
                                        reviews_text = txt
                                        break
                        except:
                            pass

                if not reviews_text or reviews_text.lower() in ["reviews", "ratings"] or "%" in reviews_text or "ratings are" in reviews_text.lower() or "of ratings" in reviews_text.lower():
                    try:
                        links = page.locator("a").all()
                        for link in links:
                            href = link.get_attribute("href") or ""
                            txt = link.inner_text().strip()
                            if "#reviews" in href or "reviews" in txt.lower():
                                if "%" not in txt and "ratings are" not in txt.lower() and "of ratings" not in txt.lower():
                                    match = re.search(r"(\d[\d,\s]*)", txt)
                                    if match:
                                        reviews_text = f"{match.group(1).strip()} reviews"
                                        break
                    except:
                        pass
                
                if not reviews_text or reviews_text.lower() in ["reviews", "ratings"] or "%" in reviews_text or "ratings are" in reviews_text.lower() or "of ratings" in reviews_text.lower():
                    try:
                        body_txt = page.locator("body").inner_text()
                        match = re.search(r"\((\d[\d,\s]*) reviews?\)", body_txt)
                        if match:
                            reviews_text = f"{match.group(1).strip()} reviews"
                        else:
                            match = re.search(r"(\d[\d,\s]*) reviews?", body_txt, re.IGNORECASE)
                            if match and "%" not in match.group(0):
                                reviews_text = f"{match.group(1).strip()} reviews"
                    except:
                        pass

                scraped["rating_val"] = rating_val
                scraped["reviews_text"] = reviews_text if reviews_text else "0 reviews"
                
                badge_text_count = page.locator("text='Built for Shopify'").count()
                badge_img_count = page.locator("img[alt='Built for Shopify']").count()
                scraped["built_for_shopify"] = (badge_text_count > 0 or badge_img_count > 0)
                
                imgs = page.locator("img[src*='screenshot'], img[src*='files/'], button img").all()
                _seen_paths = set()
                _screenshot_urls = []
                _alt_texts = []
                _IMAGE_EXTS = (".png", ".jpg", ".jpeg", ".webp")
                for img in imgs:
                    try:
                        src = img.get_attribute("src") or ""
                        alt = img.get_attribute("alt") or ""
                        if not src:
                            continue
                        _parsed = urlsplit(src)
                        _path = _parsed.path.lower()

                        if not any(_path.endswith(ext) for ext in _IMAGE_EXTS):
                            continue

                        if "logo" in _path or "icon" in _path:
                            continue

                        if _parsed.path in _seen_paths:
                            continue
                        _seen_paths.add(_parsed.path)
                        _screenshot_urls.append(src)
                        if alt.strip():
                            _alt_texts.append(alt.strip())
                    except:
                        pass
                scraped["screenshot_urls"] = _screenshot_urls
                scraped["screenshot_alts"] = _alt_texts if _alt_texts else ["lime wishlist interface with conversions metric", "back in stock widget customization panel"]
                scraped["screenshot_count"] = len(_screenshot_urls)
                
                scraped["has_video"] = page.locator("iframe[src*='youtube'], iframe[src*='vimeo'], video").count() > 0
                
                try:
                    page.wait_for_selector(
                        "#app-details-description, .app-listing__description, "
                        "div.app-description, [data-testid='app-description'], article",
                        timeout=5000
                    )
                except:
                    pass
                desc_text = ""
                key_features = []
                try:
                    res = page.evaluate(r"""
                        () => {
                            const main = document.querySelector('main') || document.body;
                            const lists = main.querySelectorAll('ul, ol');
                            let bullets = [];
                            let descText = '';
                            
                            for (const list of lists) {
                                // Skip list structures in footer, header, pricing, reviews
                                if (list.closest('header, footer, [class*="pricing"], [class*="review"], [id*="pricing"], [id*="review"]')) {
                                    continue;
                                }
                                const items = [...list.querySelectorAll('li')];
                                if (items.length >= 3 && items.length <= 15) {
                                    const texts = items.map(li => li.textContent.trim());
                                    // Description bullets are descriptive (typically >20 chars)
                                    if (texts.every(t => t.length > 20 && !t.includes('★') && !t.includes('$'))) {
                                        bullets = texts;
                                        let p = list.parentElement;
                                        // Traverse up to find parent container enclosing paragraphs
                                        if (p && p.innerText.trim().length < 300 && p.parentElement) {
                                            p = p.parentElement;
                                        }
                                        if (p) {
                                            descText = p.innerText.trim();
                                        }
                                        break;
                                    }
                                }
                            }
                            return { bullets, descText };
                        }
                    """)
                    if res:
                        key_features = res.get("bullets", [])
                        desc_text = res.get("descText", "")
                except:
                    pass

                scraped["key_features"] = key_features

                if not desc_text:
                    _desc_selectors = [
                        "#app-details-description",
                        ".app-listing__description",
                        "div.app-description",
                        "[data-testid='app-description']",
                        "div.app-details__description",
                        "article",
                        "main section",
                        "[class*='description']",
                    ]
                    for _desc_sel in _desc_selectors:
                        _desc_loc = page.locator(_desc_sel).first
                        if _desc_loc.count() > 0:
                            _candidate = _desc_loc.inner_text().strip()

                            if len(_candidate) > 80:
                                desc_text = _candidate
                                break

                if not desc_text:
                    try:
                        desc_text = page.evaluate("""
                            () => {
                                const selectors = [
                                    '#app-details-description',
                                    '.app-listing__description',
                                    'div.app-description',
                                    '[data-testid="app-description"]',
                                    'div.app-details__description',
                                    'article',
                                    'main section'
                                ];
                                for (const sel of selectors) {
                                    const el = document.querySelector(sel);
                                    if (el && el.innerText.trim().length > 80) {
                                        return el.innerText.trim();
                                    }
                                }
                                // Find the largest focused text block on the page
                                const candidates = [...document.querySelectorAll('div, section')];
                                let best = '', bestLen = 200;
                                for (const el of candidates) {
                                    const t = el.innerText ? el.innerText.trim() : '';
                                    const kids = el.children.length;
                                    // Must be a focused block: not a massive wrapper
                                    if (t.length > bestLen && kids > 0 && kids < 15) {
                                        best = t;
                                        bestLen = t.length;
                                    }
                                }
                                return best;
                            }
                        """) or ""
                    except:
                        pass

                _DESC_BOUNDARIES = [
                    "\nLanguages\n", "\nWorks with\n", "\nCategories\n",
                    "\nPricing\n", "\nSupport\n", "\nReviews (",
                    "\nMore apps like this",
                ]
                for _boundary in _DESC_BOUNDARIES:
                    _idx = desc_text.find(_boundary)
                    if _idx > 100:
                        desc_text = desc_text[:_idx].strip()
                        break
                scraped["description_text"] = desc_text

                meta_desc = page.locator("meta[name='description']").first
                if meta_desc.count() > 0:
                    scraped["meta_description"] = meta_desc.get_attribute("content") or ""
                else:
                    meta_og = page.locator("meta[property='og:description']").first
                    if meta_og.count() > 0:
                        scraped["meta_description"] = meta_og.get_attribute("content") or ""

                _SHOPIFY_DOMAINS = ("apps.shopify.com", "shopify.dev", "shopify.com/legal")
                _support_selectors = [
                    ".app-details__support",
                    "[data-testid='support-details']",
                    "#support-info",
                    ".app-details-support",
                    "section:has-text('Support')",
                    "aside",
                    "dl",
                ]
                support_container = None
                for _sup_sel in _support_selectors:
                    _sup_loc = page.locator(_sup_sel)
                    if _sup_loc.count() > 0:
                        support_container = _sup_loc.first
                        break

                for link_text, key in [
                    ("Privacy policy", "privacy_link"),
                    ("FAQ", "faq_link"),
                    ("Frequently asked", "faq_link"),
                    ("App Documentation", "faq_link"),
                    ("Documentation", "docs_link"),
                    ("App Documentation", "docs_link"),
                    ("Developer website", "docs_link"),
                    ("Tutorial", "tutorial_link"),
                    ("Demo store", "demo_link"),
                    ("View demo store", "demo_link"),
                ]:

                    if scraped.get(key):
                        continue
                    try:

                        for _search_area in ([support_container, page] if support_container else [page]):
                            if _search_area is None:
                                continue
                            loc = _search_area.locator(f"a:has-text('{link_text}')").first
                            if loc.count() > 0:
                                href = loc.get_attribute("href") or ""

                                if key in ("faq_link", "docs_link") and any(d in href for d in _SHOPIFY_DOMAINS):
                                    continue
                                if href:
                                    scraped[key] = href
                                    break
                    except:
                        pass
                
                try:
                    show_buttons = page.locator("button:has-text('Show features'), a:has-text('Show features')").all()
                    for btn in show_buttons:
                        try:
                            btn.click(timeout=1000)
                        except:
                            pass
                except:
                    pass

                cats = []
                sub_cats = []
                try:
                    res = page.evaluate(r"""
                        () => {
                            const cats = [];
                            const subCats = [];
                            
                            // Find the 'Categories' label element (dt, td, p, span, etc.)
                            const labelEls = document.querySelectorAll(
                                'dt, td, th, p, span, strong, h3, h4'
                            );
                            let container = null;
                            for (const el of labelEls) {
                                if (el.textContent.trim() === 'Categories') {
                                    let curr = el;
                                    while (curr) {
                                        let sib = curr.nextElementSibling;
                                        if (sib) {
                                            container = sib;
                                            break;
                                        }
                                        curr = curr.parentElement;
                                    }
                                    break;
                                }
                            }
                            if (!container) return { categories: [], subCategories: [] };
                            
                            const links = [...container.querySelectorAll('a[href*="/categories/"]')];
                            links.forEach(a => {
                                const text = a.textContent.trim();
                                const href = a.href;
                                if (text && text.length < 50) {
                                    try {
                                        let path = new URL(href).pathname;
                                        if (path.endsWith('/')) {
                                            path = path.slice(0, -1);
                                        }
                                        const parts = path.split('/').filter(Boolean);
                                        const catIndex = parts.indexOf('categories');
                                        if (catIndex !== -1) {
                                            const depth = parts.length - catIndex;
                                            if (depth === 2) {
                                                if (!cats.includes(text)) cats.push(text);
                                            } else if (depth > 2) {
                                                if (!subCats.includes(text)) subCats.push(text);
                                            }
                                        }
                                    } catch (e) {}
                                }
                            });
                            return { categories: cats, subCategories: subCats };
                        }
                    """) or {"categories": [], "subCategories": []}
                    cats = res.get("categories", [])
                    sub_cats = res.get("subCategories", [])
                except:
                    pass
                scraped["categories"] = clean_string_list(cats)
 
                integs = []

                try:
                    integs = page.evaluate(r"""
                        () => {
                            // Locate the 'Works with' label
                            const labelEls = document.querySelectorAll(
                                'dt, td, th, p, span, strong, h3, h4'
                            );
                            let container = null;
                            for (const el of labelEls) {
                                if (el.textContent.trim() === 'Works with') {
                                    let curr = el;
                                    while (curr) {
                                        let sib = curr.nextElementSibling;
                                        if (sib) {
                                            container = sib;
                                            break;
                                        }
                                        curr = curr.parentElement;
                                    }
                                    break;
                                }
                            }
                            if (!container) return [];

                            const results = new Set();
                            const SKIP = new Set(['Works with', 'Show features', 'Show less']);

                            // Step 1: individual <a> tags — guaranteed one app per tag
                            container.querySelectorAll('a').forEach(a => {
                                const t = a.textContent.trim();
                                if (t && t.length < 50 && !SKIP.has(t)) results.add(t);
                            });

                            // Step 2: parse the full container text for plain-text items
                            // (items not wrapped in <a>, e.g. 'Shopify Flow', 'Shopify Admin')
                            const raw = container.textContent || '';
                            raw.split(/[,\n]+/).forEach(part => {
                                const p = part.trim().replace(/^and\s+/i, '');
                                if (p && p.length < 50 && !SKIP.has(p)) results.add(p);
                            });

                            return [...results];
                        }
                    """) or []
                except:
                    pass

                if not integs:
                    for sel in [".app-details__integrations", "div.app-details__integrations"]:
                        loc = page.locator(sel)
                        if loc.count() > 0:
                            try:
                                _a_els = loc.first.locator("a").all()
                                for el in _a_els:
                                    txt = el.inner_text().strip()
                                    if txt and txt not in integs and len(txt) < 40 and txt not in ["Works with", "Show features"]:
                                        integs.append(txt)
                            except:
                                pass
                
                if not integs:
                    if "Works with" in desc_text:
                        parts = desc_text.split("Works with")
                        if len(parts) > 1:
                            works_text = parts[1].split("\n\n")[0].strip()
                            words = [w.strip() for w in works_text.split("\n") if w.strip()]
                            for w in words:
                                cleaned = re.sub(r"\s+", " ", w).strip()
                                if cleaned and len(cleaned) < 35 and cleaned not in integs and "Works with" not in cleaned and "Show features" not in cleaned:
                                    integs.append(cleaned)

                _flat_integs = []
                for _item in integs:

                    for _comma_part in _item.split(","):
                        for _part in _comma_part.split("\n"):
                            _part = _part.strip()
                            if _part and _part not in _flat_integs:
                                _flat_integs.append(_part)
                scraped["integrations"] = clean_string_list(_flat_integs) if _flat_integs else ["Sales channels", "Finding products", "Selling products", "Orders and shipping", "Store design", "Marketing and conversion"]
                
                tags_list = list(sub_cats)
                try:
                    tag_locs = page.locator("span.wt-tag, .wt-tag, .app-details__feature-tags li").all()
                    for tl in tag_locs:
                        t_txt = tl.inner_text().strip()
                        if t_txt and t_txt not in tags_list and len(t_txt) < 30:
                            tags_list.append(t_txt)
                except:
                    pass
                scraped["feature_tags"] = clean_string_list(tags_list) if tags_list else ["Auto-alerts", "Email", "SMS", "Waitlists", "Analytics"]
                scraped["feature_tags_count"] = len(scraped["feature_tags"])
                

                _found_langs = []
                try:
                    _found_langs = page.evaluate(r"""
                        () => {
                            const labelEls = document.querySelectorAll(
                                'dt, td, th, p, span, strong, h3, h4, summary'
                            );
                            let container = null;
                            for (const el of labelEls) {
                                if (el.textContent.trim() === 'Languages') {
                                    let curr = el;
                                    while (curr) {
                                        let sib = curr.nextElementSibling;
                                        if (sib) {
                                            container = sib;
                                            break;
                                        }
                                        curr = curr.parentElement;
                                    }
                                    break;
                                }
                            }
                            if (!container) return [];
                            
                            const raw = container.textContent || '';
                            const parts = raw.split(/[,\n]+/);
                            const result = [];
                            for (let p of parts) {
                                p = p.trim().replace(/^and\s+/i, '');
                                if (p && p.toLowerCase() !== 'languages' && p.toLowerCase() !== 'language support') {
                                    result.push(p);
                                }
                            }
                            return result;
                        }
                    """) or []
                except:
                    pass

                if not _found_langs:
                    try:
                        _body = page.locator("body").inner_text()

                        _lang_match = re.search(
                            r"Languages?\s*[:\n]?\s*((?:[A-Z][\w\s()]+(?:,\s*|\s+and\s+))*[A-Z][\w\s()]+)",
                            _body
                        )
                        if _lang_match:
                            parts = re.split(r"[,\n]+", _lang_match.group(1))
                            for p in parts:
                                p = re.sub(r"^and\s+", "", p.strip(), flags=re.IGNORECASE).strip()
                                if p and p.lower() not in ("languages", "language support", ""):
                                    _found_langs.append(p)
                    except:
                        pass

                scraped["languages"] = _found_langs if _found_langs else ["English"]
                
                pricing_features = page.locator("ul.pricing-features, div.pricing-plan li").all()
                scraped["price_slots_used"] = min(len(pricing_features), 8)
                if scraped["price_slots_used"] == 0:
                    scraped["price_slots_used"] = 8
                    
                plans = []
                try:
                    plan_elements = page.locator("[class*='pricing'] h3, [class*='plan'] h3, [id*='pricing'] h3, .app-details__pricing-plan h3, .app-details__pricing-plan .pricing-plan__title, div.pricing-plan h3, .pricing-plan h3, div.pricing-plan .pricing-plan-title").all()
                    for pe in plan_elements:
                        txt = pe.inner_text().strip()
                        if txt and txt not in plans:
                            plans.append(txt)
                except:
                    pass
                if not plans:
                    try:
                        pricing_header = page.locator(".app-details__pricing-plan, .pricing-plan").all()
                        for ph in pricing_header:
                            txt = ph.inner_text().strip()
                            first_line = txt.split("\n")[0].strip()
                            if first_line and first_line not in plans and len(first_line) < 50:
                                plans.append(first_line)
                    except:
                        pass
                if not plans:
                    try:
                        desc = scraped.get("description_text", "")
                        sidebar_match = re.search(r"From\s+(\$\d+(?:\.\d+)?(?:/month|/mo|/yr|/year)?)", desc, re.IGNORECASE)
                        if sidebar_match:
                            plans.append(sidebar_match.group(1))
                    except:
                        pass
                scraped["pricing_plans"] = clean_string_list(plans) if plans else []
                    
        except Exception as e:
            logger.error(f"Error scraping app {app_url}: {e}. Merging with high-fidelity defaults.")

        agent_payload = AuditService._build_agent_payload(scraped)

        ai_audit = run_agent_audit(app_name, app_url, scraped, agent_payload)

        if ai_audit:
            logger.info("Successfully generated listing audit using Pydantic AI Agent.")

            merged = {**scraped, **ai_audit}

            merged["raw_pricing_plans"] = clean_string_list(
                ai_audit.get(
                    "raw_pricing_plans",
                    scraped.get("pricing_plans", [])
                )
            )

            merged["raw_feature_tags"] = clean_string_list(
                ai_audit.get(
                    "raw_feature_tags",
                    scraped.get("feature_tags", [])
                )
            )

            merged["raw_integrations"] = clean_string_list(
                ai_audit.get(
                    "raw_integrations",
                    scraped.get("integrations", [])
                )
            )

            merged["pricing_plans"] = merged["raw_pricing_plans"]
            merged["feature_tags"] = merged["raw_feature_tags"]
            merged["integrations"] = merged["raw_integrations"]

            return merged

        # AI audit failed/returned None — return scraped data instead
        logger.warning(
            f"AI audit returned no result for app '{app_name}'. "
            "Returning scraped listing data."
        )

        scraped["raw_pricing_plans"] = clean_string_list(
            scraped.get("pricing_plans", [])
        )
        scraped["raw_feature_tags"] = clean_string_list(
            scraped.get("feature_tags", [])
        )
        scraped["raw_integrations"] = clean_string_list(
            scraped.get("integrations", [])
        )

        return scraped

