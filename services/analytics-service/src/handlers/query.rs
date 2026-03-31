use std::sync::Arc;

use actix_web::{web, HttpResponse, ResponseError};

use crate::models::analytics::QueryRequest;
use crate::traits::QueryEngineProvider;

pub async fn execute_query(
    provider: web::Data<Arc<dyn QueryEngineProvider>>,
    body: web::Json<QueryRequest>,
) -> HttpResponse {
    match provider.execute_query(&body).await {
        Ok(result) => HttpResponse::Ok().json(result),
        Err(e) => e.error_response(),
    }
}
