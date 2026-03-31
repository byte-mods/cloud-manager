use std::sync::Arc;

use actix_web::{web, HttpResponse, ResponseError};

use crate::models::data_engineering::CreateStreamingJobRequest;
use crate::traits::DataPipelineProvider;

pub async fn list_streaming_jobs(
    provider: web::Data<Arc<dyn DataPipelineProvider>>,
) -> HttpResponse {
    match provider.list_streaming_jobs().await {
        Ok(jobs) => HttpResponse::Ok().json(serde_json::json!({ "streaming_jobs": jobs })),
        Err(e) => e.error_response(),
    }
}

pub async fn create_streaming_job(
    provider: web::Data<Arc<dyn DataPipelineProvider>>,
    body: web::Json<CreateStreamingJobRequest>,
) -> HttpResponse {
    match provider.create_streaming_job(body.into_inner()).await {
        Ok(job) => HttpResponse::Created().json(job),
        Err(e) => e.error_response(),
    }
}
