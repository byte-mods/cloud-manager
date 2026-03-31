use actix_web::dev::{forward_ready, Service, ServiceRequest, ServiceResponse, Transform};
use actix_web::{Error, HttpMessage};
use futures::future::{ok, LocalBoxFuture, Ready};
use jsonwebtoken::{decode, DecodingKey, Validation, Algorithm};
use serde::{Deserialize, Serialize};
use std::rc::Rc;
use uuid::Uuid;

/// Claims extracted from a valid JWT.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    pub sub: Uuid,
    pub role: String,
    pub email: String,
    pub exp: usize,
    pub iat: usize,
}

/// Middleware factory for JWT authentication.
pub struct JwtAuth {
    pub jwt_secret: String,
}

impl<S, B> Transform<S, ServiceRequest> for JwtAuth
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Transform = JwtAuthMiddleware<S>;
    type InitError = ();
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ok(JwtAuthMiddleware {
            service: Rc::new(service),
            jwt_secret: self.jwt_secret.clone(),
        })
    }
}

pub struct JwtAuthMiddleware<S> {
    service: Rc<S>,
    jwt_secret: String,
}

impl<S, B> JwtAuthMiddleware<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    B: 'static,
{
    fn should_skip_auth(path: &str) -> bool {
        path == "/health"
            || path.starts_with("/api/v1/auth/")
            || path == "/api/v1/auth"
    }
}

impl<S, B> Service<ServiceRequest> for JwtAuthMiddleware<S>
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
        let jwt_secret = self.jwt_secret.clone();

        Box::pin(async move {
            let path = req.path().to_owned();

            if Self::should_skip_auth(&path) {
                return service.call(req).await;
            }

            let auth_header = req
                .headers()
                .get("Authorization")
                .and_then(|v| v.to_str().ok())
                .map(|s| s.to_owned());

            let token = match auth_header {
                Some(ref header) if header.starts_with("Bearer ") => &header[7..],
                _ => {
                    return Err(actix_web::error::ErrorUnauthorized(
                        serde_json::json!({ "error": "authentication_required", "message": "Missing or invalid Authorization header" }),
                    ));
                }
            };

            let decoding_key = DecodingKey::from_secret(jwt_secret.as_bytes());
            let mut validation = Validation::new(Algorithm::HS256);
            validation.validate_exp = true;

            match decode::<Claims>(token, &decoding_key, &validation) {
                Ok(token_data) => {
                    req.extensions_mut().insert(token_data.claims);
                    service.call(req).await
                }
                Err(e) => {
                    tracing::warn!("JWT validation failed: {e}");
                    Err(actix_web::error::ErrorUnauthorized(
                        serde_json::json!({ "error": "invalid_token", "message": "Invalid or expired token" }),
                    ))
                }
            }
        })
    }
}
