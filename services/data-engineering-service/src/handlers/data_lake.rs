use std::sync::Arc;

use actix_web::{web, HttpResponse, ResponseError};

use crate::models::data_engineering::RegisterDatasetRequest;
use crate::traits::DataPipelineProvider;

pub async fn list_datasets(
    provider: web::Data<Arc<dyn DataPipelineProvider>>,
) -> HttpResponse {
    match provider.list_datasets().await {
        Ok(datasets) => HttpResponse::Ok().json(serde_json::json!({ "datasets": datasets })),
        Err(e) => e.error_response(),
    }
}

pub async fn register_dataset(
    provider: web::Data<Arc<dyn DataPipelineProvider>>,
    body: web::Json<RegisterDatasetRequest>,
) -> HttpResponse {
    match provider.register_dataset(body.into_inner()).await {
        Ok(dataset) => HttpResponse::Created().json(dataset),
        Err(e) => e.error_response(),
    }
}
