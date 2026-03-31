use actix_web::dev::{forward_ready, Service, ServiceRequest, ServiceResponse, Transform};
use actix_web::Error;
use futures::future::{ok, LocalBoxFuture, Ready};
use std::collections::HashMap;
use std::rc::Rc;
use std::sync::Mutex;

/// In-memory sliding-window rate limiter.
/// No external dependencies — counters stored in a shared HashMap.
pub struct RateLimiter {
    /// Maximum requests allowed within the window.
    pub max_requests: u64,
    /// Window size in seconds.
    pub window_secs: u64,
}

/// Shared state for rate limit counters.
struct RateLimitState {
    /// Map of key -> (count, window_reset_timestamp)
    counters: HashMap<String, (u64, u64)>,
}

lazy_static::lazy_static! {
    static ref RATE_LIMIT_STATE: Mutex<RateLimitState> = Mutex::new(RateLimitState {
        counters: HashMap::new(),
    });
}

impl<S, B> Transform<S, ServiceRequest> for RateLimiter
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Transform = RateLimiterMiddleware<S>;
    type InitError = ();
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ok(RateLimiterMiddleware {
            service: Rc::new(service),
            max_requests: self.max_requests,
            window_secs: self.window_secs,
        })
    }
}

pub struct RateLimiterMiddleware<S> {
    service: Rc<S>,
    max_requests: u64,
    window_secs: u64,
}

impl<S, B> Service<ServiceRequest> for RateLimiterMiddleware<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Future = LocalBoxFuture<'static, Result<Self::Response, Self::Error>>;

    forward_ready!(service);

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let service = Rc::clone(&self.service);
        let max_requests = self.max_requests;
        let window_secs = self.window_secs;

        Box::pin(async move {
            let client_ip = req
                .connection_info()
                .realip_remote_addr()
                .unwrap_or("unknown")
                .to_owned();
            let key = format!("rl:{}", client_ip);
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs();

            let allowed = {
                let mut state = RATE_LIMIT_STATE.lock().unwrap_or_else(|e| e.into_inner());
                let entry = state.counters.entry(key.clone()).or_insert((0, now + window_secs));

                if now >= entry.1 {
                    // Window expired, reset
                    *entry = (1, now + window_secs);
                    true
                } else if entry.0 < max_requests {
                    entry.0 += 1;
                    true
                } else {
                    false
                }
            };

            if !allowed {
                tracing::warn!(client_ip, "Rate limit exceeded");
                return Err(actix_web::error::InternalError::from_response(
                    "Rate limit exceeded",
                    actix_web::HttpResponse::TooManyRequests()
                        .insert_header(("Retry-After", window_secs.to_string()))
                        .json(serde_json::json!({
                            "error": "rate_limit_exceeded",
                            "message": "Too many requests",
                            "retry_after": window_secs,
                        })),
                )
                .into());
            }

            service.call(req).await
        })
    }
}
