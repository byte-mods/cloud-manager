use actix_web::{web, HttpResponse};
use chrono::Utc;
use cloud_common::Database;
use uuid::Uuid;

use crate::models::analytics::{CreateVisualizationRequest, Visualization};

pub async fn list_visualizations(db: web::Data<Database>) -> HttpResponse {
    let vis: Vec<Visualization> = db.list("visualizations").await.unwrap_or_default();
    HttpResponse::Ok().json(serde_json::json!({ "visualizations": vis }))
}

pub async fn create_visualization(
    db: web::Data<Database>,
    body: web::Json<CreateVisualizationRequest>,
) -> HttpResponse {
    let now = Utc::now();
    let id = Uuid::new_v4();
    let vis = Visualization {
        id,
        name: body.name.clone(),
        chart_type: body.chart_type.clone(),
        data_source: body.data_source.clone(),
        query: body.query.clone().unwrap_or_default(),
        created_at: now,
        updated_at: now,
    };

    let _: Option<Visualization> = db
        .create_with_id("visualizations", &id.to_string(), vis.clone())
        .await
        .ok()
        .flatten();

    HttpResponse::Created().json(vis)
}
