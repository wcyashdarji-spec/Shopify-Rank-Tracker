import time
import json
from typing import Any, Callable, Dict

from fastapi.routing import APIRoute
from fastapi import Request, Response
from app.core.logger import get_logger

logger = get_logger("api_logger")

SENSITIVE_KEYS = {
    "password", "pass", "token", "access_token", "refresh_token", "secret",
    "client_secret", "api_key", "key", "authorization", "cookie", "signature",
    "hashed_password", "current_password", "new_password"
}

NOISE_REQUEST_HEADERS = {
    "connection", "sec-ch-ua", "sec-ch-ua-mobile", "sec-ch-ua-platform",
    "sec-fetch-site", "sec-fetch-mode", "sec-fetch-dest", "accept-encoding",
    "accept-language", "user-agent", "referer", "accept", "upgrade-insecure-requests"
}

NOISE_RESPONSE_HEADERS = {
    "access-control-allow-origin", "access-control-allow-credentials",
    "access-control-allow-methods", "access-control-allow-headers",
    "access-control-max-age", "vary", "date", "server"
}

def should_mask(key: str) -> bool:
    """Determine if a key (header, query, or body key) contains sensitive data."""
    key_lower = key.lower()
    if key_lower in SENSITIVE_KEYS:
        return True
    suffixes = ("_key", "_secret", "_token", "_password", "secret_key", "api_key")
    if any(key_lower.endswith(suffix) for suffix in suffixes):
        return True
    return False

def sanitize_data(data: Any) -> Any:
    """Recursively traverse data structures to mask sensitive keys."""
    if isinstance(data, dict):
        return {
            k: ("[MASKED]" if should_mask(k) else sanitize_data(v))
            for k, v in data.items()
        }
    elif isinstance(data, list):
        return [sanitize_data(item) for item in data]
    return data

def sanitize_headers(headers: Dict[str, str], is_response: bool = False) -> Dict[str, str]:
    """Sanitize and filter noise out of headers."""
    noise_set = NOISE_RESPONSE_HEADERS if is_response else NOISE_REQUEST_HEADERS
    return {
        k: ("[MASKED]" if should_mask(k) else v)
        for k, v in headers.items()
        if k.lower() not in noise_set
    }

def sanitize_query_params(params: Dict[str, Any]) -> Dict[str, Any]:
    """Sanitize query parameters."""
    return {
        k: ("[MASKED]" if should_mask(k) else v)
        for k, v in params.items()
    }

def format_body(body_data: Any, max_len: int = 500) -> str:
    """Format and truncate request/response body if too long."""
    if body_data is None:
        return "None"
    
    if isinstance(body_data, str):
        s = body_data
    else:
        try:
            s = json.dumps(body_data, ensure_ascii=False)
        except Exception:
            s = str(body_data)
            
    if len(s) > max_len:
        return s[:max_len] + f"... (truncated, total length: {len(s)})"
    return s

class LoggingRoute(APIRoute):
    """
    Custom APIRoute class that intercepts endpoint calls to perform manual logging,
    including request/response body parsing, sensitive field masking, noise reduction,
    and duration tracking.
    """
    def get_route_handler(self) -> Callable:
        original_route_handler = super().get_route_handler()

        async def custom_route_handler(request: Request) -> Response:
            if request.method == "OPTIONS":
                return await original_route_handler(request)
                
            client_host = request.client.host if request.client else "unknown"
            method = request.method
            path = request.url.path
            
            headers = sanitize_headers(dict(request.headers), is_response=False)
            query_params = sanitize_query_params(dict(request.query_params))
            
            req_body_log = None
            content_type = request.headers.get("content-type", "")
            
            try:
                body_bytes = await request.body()
                async def receive():
                    return {"type": "http.request", "body": body_bytes, "more_body": False}
                request._receive = receive
                
                if body_bytes:
                    if "application/json" in content_type:
                        try:
                            req_json = json.loads(body_bytes.decode("utf-8"))
                            req_body_log = sanitize_data(req_json)
                        except json.JSONDecodeError:
                            req_body_log = "[Invalid JSON]"
                    else:
                        req_body_log = f"[Non-JSON body, size: {len(body_bytes)} bytes]"
            except Exception as e:
                logger.error(f"Error reading request body: {str(e)}")
                req_body_log = "[Error reading body]"

            req_body_str = format_body(req_body_log)
            query_str = f" | Query: {query_params}" if query_params else ""
            
            logger.info(
                f"[API REQ] {method} {path} | Client: {client_host}{query_str} | Body: {req_body_str}"
            )
            
            start_time = time.time()
            try:
                response = await original_route_handler(request)
            except Exception as e:
                process_time = time.time() - start_time
                logger.error(
                    f"[API ERR] {method} {path} | Duration: {process_time:.4f}s | Exception: {str(e)}"
                )
                raise e
                
            process_time = time.time() - start_time
            
            resp_headers = sanitize_headers(dict(response.headers), is_response=True)
            
            resp_body_log = None
            resp_content_type = response.headers.get("content-type", "")
            
            if "application/json" in resp_content_type:
                try:
                    response_body_bytes = b""
                    if hasattr(response, "body"):
                        response_body_bytes = response.body
                    elif hasattr(response, "body_iterator"):
                        async for chunk in response.body_iterator:
                            response_body_bytes += chunk
                        
                        background = getattr(response, "background", None)
                        response = Response(
                            content=response_body_bytes,
                            status_code=response.status_code,
                            headers=dict(response.headers),
                            media_type=response.media_type
                        )
                        if background:
                            response.background = background
                    
                    if response_body_bytes:
                        try:
                            resp_json = json.loads(response_body_bytes.decode("utf-8"))
                            resp_body_log = sanitize_data(resp_json)
                        except json.JSONDecodeError:
                            resp_body_log = "[Invalid JSON]"
                except Exception as e:
                    logger.error(f"Error reading response body: {str(e)}")
                    resp_body_log = "[Error reading body]"
            else:
                content_length = response.headers.get("content-length", "unknown")
                resp_body_log = f"[Non-JSON response, Content-Type: {resp_content_type}, Size: {content_length} bytes]"
                
            resp_body_str = format_body(resp_body_log)
            logger.info(
                f"[API RESP] {method} {path} | Status: {response.status_code} | Duration: {process_time:.4f}s | Body: {resp_body_str}"
            )
            
            return response

        return custom_route_handler
