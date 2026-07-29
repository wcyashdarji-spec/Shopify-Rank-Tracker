import os
import json
import logging

import logfire
from pydantic_ai import Agent, ImageUrl
from pydantic_ai.models.google import GoogleModel
from pydantic_ai.providers.google import GoogleProvider

from app.schemas.request import AuditReport
from app.services.prompt_template import SYSTEM_PROMPT

logfire.configure()

logger = logging.getLogger(__name__)


api_key = os.getenv("GEMINI_API_KEY")
provider = GoogleProvider(api_key=api_key)
model_name = os.getenv("MODEL_NAME")
model = GoogleModel(model_name, provider=provider)

audit_agent = Agent(
    model,
    output_type=AuditReport,
    system_prompt=SYSTEM_PROMPT
)

logfire.instrument_pydantic_ai(audit_agent)

def run_agent_audit(app_name: str, app_url: str, scraped_data: dict, agent_payload: dict | None = None) -> dict:
    """
    Execute the AI-powered ASO audit for a Shopify application.

    This function prepares the scraped application data, including
    listing details and supported images, and submits it to the
    configured Pydantic AI agent for analysis. The generated audit is
    returned as a structured report matching the expected schema.
    Logfire is used to trace inputs, outputs, and execution details
    for monitoring and debugging.

    Args:
        app_name: Name of the Shopify application.
        app_url: Shopify App Store URL of the application.
        scraped_data: Flat dictionary containing scraped metadata; used
            to attach multimodal images (icon, screenshots) to the prompt.
        agent_payload: Optional structured nested payload to include as
            the primary JSON context in the prompt. When omitted, falls
            back to the raw scraped_data dict.

    Returns:
        dict | None:
            - A structured audit report if the analysis completes
              successfully.
            - None if the AI service is unavailable or an error occurs
              during execution.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        logger.warning("GEMINI_API_KEY not set. Falling back to the rule-based ASO engine.")
        return None

    prompt_text = f"""
    App Name: {app_name}
    App Store URL: {app_url}

    Scraped listing components:
    {json.dumps(agent_payload if agent_payload is not None else scraped_data, indent=2)}

    Perform a complete ASO audit now and return a structured validation JSON matching the result schema.
    """

    message_parts = [prompt_text]

    icon_url = scraped_data.get("app_icon_url")
    if icon_url:
        if icon_url.startswith("//"):
            icon_url = "https:" + icon_url
        if icon_url.startswith("http") and not ".svg" in icon_url.lower():
            message_parts.append(ImageUrl(url=icon_url))

    screenshot_urls = scraped_data.get("screenshot_urls", [])
    for idx, scr_url in enumerate(screenshot_urls):
        if idx >= 3:
            break
        if scr_url.startswith("//"):
            scr_url = "https:" + scr_url
        if scr_url.startswith("http") and not ".svg" in scr_url.lower():
            message_parts.append(ImageUrl(url=scr_url))

    try:
        with logfire.span("Running Pydantic AI ASO Agent for App: {app_name}", app_name=app_name):
            logfire.info("ASO Scraped Data Input: {scraped_data}", scraped_data=scraped_data)
            result = audit_agent.run_sync(message_parts)
            
            logfire.info("ASO Audit Generated: {audit_report}", audit_report=result.output.model_dump())
            
            return result.output.model_dump()
            
    except Exception as e:
        logger.exception(f"Pydantic AI Agent execution failed: {e}")
        logfire.error("Pydantic AI Agent failed: {error}", error=str(e))
        return None
