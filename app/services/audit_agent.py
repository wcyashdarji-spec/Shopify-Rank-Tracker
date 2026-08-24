import os
import json
import logging

import logfire
from pydantic_ai import Agent, ImageUrl
from pydantic_ai.providers.openai import OpenAIProvider
from pydantic_ai.models.openai import OpenAIChatModel, OpenAIChatModelSettings

from app.schemas.request import AuditReport
from app.core.logger import get_logger
from app.core.telemetry import setup_telemetry
from app.services.prompt_template import SYSTEM_PROMPT

setup_telemetry()

logger = get_logger(__name__)

api_key = os.getenv("OPENAI_API_KEY")
provider = OpenAIProvider(api_key=api_key)
model_name = os.getenv("OPENAI_MODEL_NAME")
model = OpenAIChatModel(model_name, provider=provider)

settings = OpenAIChatModelSettings(
    openai_reasoning_effort="none",
    temperature=0.4,
    max_tokens=5000,
    top_p=1.0
)

audit_agent = Agent(
    model,
    output_type=AuditReport,
    system_prompt=SYSTEM_PROMPT,
    model_settings=settings
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
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        logger.warning("OPENAI_API_KEY not set. Falling back to the rule-based ASO engine.")
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
        input_payload = {
            "app_name": app_name,
            "app_url": app_url,
            "agent_payload": agent_payload if agent_payload is not None else scraped_data,
        }
        span_title = f"Running Pydantic AI ASO Agent for App: {app_name}"
        with logfire.span(span_title, app_name=app_name) as span:
            if hasattr(span, "_span") and hasattr(span._span, "update_name"):
                span._span.update_name(span_title)

            span.set_attribute("openinference.span.kind", "AGENT")
            span.set_attribute("app_name", app_name)
            span.set_attribute("input.value", json.dumps(input_payload, indent=2, default=str))
            span.set_attribute("input.mime_type", "application/json")

            logfire.info(f"ASO Scraped Data Input for {app_name}", scraped_data=scraped_data)
            result = audit_agent.run_sync(message_parts)

            output_dict = result.output.model_dump()
            span.set_attribute("output.value", json.dumps(output_dict, indent=2, default=str))
            span.set_attribute("output.mime_type", "application/json")

            logfire.info(f"ASO Audit Generated for {app_name}", audit_report=output_dict)
            return output_dict

    except Exception as e:
        logger.exception(f"Pydantic AI Agent execution failed: {e}")
        logfire.error("Pydantic AI Agent failed: {error}", error=str(e))
        return None
