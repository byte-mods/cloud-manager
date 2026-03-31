use std::sync::Arc;

use actix_web::{web, HttpResponse, ResponseError};

use crate::traits::QueryEngineProvider;

pub async fn list_query_engines(
    provider: web::Data<Arc<dyn QueryEngineProvider>>,
) -> HttpResponse {
    match provider.list_query_engines().await {
        Ok(engines) => HttpResponse::Ok().json(serde_json::json!({ "query_engines": engines })),
        Err(e) => e.error_response(),
    }
}
