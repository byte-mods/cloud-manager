use std::sync::Arc;

use actix_web::{web, HttpResponse, ResponseError};
use uuid::Uuid;

use crate::models::data_engineering::{CreateEtlPipelineRequest, UpdateEtlPipelineRequest};
use crate::traits::DataPipelineProvider;

pub async fn list_pipelines(
    provider: web::Data<Arc<dyn DataPipelineProvider>>,
) -> HttpResponse {
    match provider.list_pipelines().await {
        Ok(pipelines) => HttpResponse::Ok().json(serde_json::json!({ "pipelines": pipelines })),
        Err(e) => e.error_response(),
    }
}

pub async fn create_pipeline(
    provider: web::Data<Arc<dyn DataPipelineProvider>>,
    body: web::Json<CreateEtlPipelineRequest>,
) -> HttpResponse {
    match provider.create_pipeline(body.into_inner()).await {
        Ok(pipeline) => HttpResponse::Created().json(pipeline),
        Err(e) => e.error_response(),
    }
}

pub async fn get_pipeline(
    provider: web::Data<Arc<dyn DataPipelineProvider>>,
    path: web::Path<Uuid>,
) -> HttpResponse {
    let id = path.into_inner();
    match provider.get_pipeline(&id.to_string()).await {
        Ok(pipeline) => HttpResponse::Ok().json(pipeline),
        Err(e) => e.error_response(),
    }
}

/// Update is a mock-only operation (patch the in-memory store directly).
/// When using real SDK, this would map to Glue UpdateJob.
pub async fn update_pipeline(
    provider: web::Data<Arc<dyn DataPipelineProvider>>,
    path: web::Path<Uuid>,
    body: web::Json<UpdateEtlPipelineRequest>,
) -> HttpResponse {
    let id = path.into_inner();
    // For now, get + field override. The trait can be extended later for update ops.
    match provider.get_pipeline(&id.to_string()).await {
        Ok(mut pipeline) => {
            if let Some(ref name) = body.name {
                pipeline.name = name.clone();
            }
            if let Some(ref schedule) = body.schedule {
                pipeline.schedule = schedule.clone();
            }
            if let Some(ref status) = body.status {
                pipeline.status = status.clone();
            }
            pipeline.updated_at = chrono::Utc::now();
            HttpResponse::Ok().json(pipeline)
        }
        Err(e) => e.error_response(),
    }
}

pub async fn delete_pipeline(
    provider: web::Data<Arc<dyn DataPipelineProvider>>,
    path: web::Path<Uuid>,
) -> HttpResponse {
    let id = path.into_inner();
    match provider.delete_pipeline(&id.to_string()).await {
        Ok(()) => HttpResponse::NoContent().finish(),
        Err(e) => e.error_response(),
    }
}

pub async fn trigger_run(
    provider: web::Data<Arc<dyn DataPipelineProvider>>,
    path: web::Path<Uuid>,
) -> HttpResponse {
    let id = path.into_inner();
    match provider.trigger_pipeline_run(&id.to_string()).await {
        Ok(pipeline) => HttpResponse::Ok().json(serde_json::json!({
            "message": format!("Pipeline '{}' triggered successfully", pipeline.name),
            "pipeline": pipeline,
        })),
        Err(e) => e.error_response(),
    }
}

