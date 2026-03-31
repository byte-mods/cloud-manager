use std::sync::Arc;

use actix_web::{web, HttpResponse, ResponseError};

use crate::traits::DataPipelineProvider;

pub async fn get_overview(
    provider: web::Data<Arc<dyn DataPipelineProvider>>,
) -> HttpResponse {
    match provider.get_overview().await {
        Ok(overview) => HttpResponse::Ok().json(overview),
        Err(e) => e.error_response(),
    }
}
