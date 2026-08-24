import os
import logging
import threading

import logfire
from pydantic_ai import Agent
from phoenix.otel import register
import opentelemetry.trace as trace
from openinference.instrumentation.openai import OpenAIInstrumentor
from openinference.instrumentation.pydantic_ai import OpenInferenceSpanProcessor

from app.core.logger import get_logger

logger = get_logger(__name__)

_telemetry_lock = threading.Lock()
_telemetry_initialized = False


def setup_telemetry() -> None:
    """
    Initialize telemetry for both Pydantic Logfire and Arize Phoenix.

    This function configures Logfire as the primary tracer and integrates
    Arize Phoenix via OpenTelemetry to capture:
    - Input & output system prompts
    - Input & output token counts
    - AI model metadata and derived cost metrics
    """
    global _telemetry_initialized

    if _telemetry_initialized:
        return

    with _telemetry_lock:
        if _telemetry_initialized:
            return

        logfire.configure()
        logger.info("Logfire telemetry configured.")

        collector_endpoint = os.getenv("PHOENIX_COLLECTOR_ENDPOINT")
        project_name = os.getenv("PHOENIX_PROJECT_NAME")
        api_key = os.getenv("PHOENIX_API_KEY") or None

        headers = {}
        if project_name:
            headers["x-project-name"] = project_name

        try:
            phx_tp = register(
                endpoint=collector_endpoint,
                project_name=project_name,
                api_key=api_key,
                headers=headers,
                set_global_tracer_provider=False,
                auto_instrument=True,
                batch=True,
                verbose=False,
            )

            global_tp = trace.get_tracer_provider()
            raw_tp = getattr(global_tp, "provider", global_tp)

            if project_name and hasattr(raw_tp, "_resource"):
                from opentelemetry.sdk.resources import Resource
                project_resource = Resource.create(
                    {
                        "openinference.project.name": project_name,
                        "project.name": project_name,
                    }
                )
                raw_tp._resource = raw_tp.resource.merge(project_resource)

            if hasattr(phx_tp, "_active_span_processor") and hasattr(
                phx_tp._active_span_processor, "_span_processors"
            ):
                for proc in phx_tp._active_span_processor._span_processors:
                    raw_tp.add_span_processor(proc)

            raw_tp.add_span_processor(OpenInferenceSpanProcessor())

            OpenAIInstrumentor().instrument(tracer_provider=global_tp)
            Agent.instrument_all()

            logger.info(
                "Arize Phoenix telemetry initialized for project '%s' -> %s",
                project_name,
                collector_endpoint,
            )
        except Exception as err:
            logger.warning("Failed to initialize Arize Phoenix telemetry: %s", err)

        _telemetry_initialized = True
