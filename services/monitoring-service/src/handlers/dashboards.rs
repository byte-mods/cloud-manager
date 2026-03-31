use actix_web::{web, HttpResponse};
use chrono::Utc;
use uuid::Uuid;

use crate::models::monitoring::{CreateDashboardRequest, Dashboard};

pub async fn list_dashboards(db: web::Data<cloud_common::Database>) -> HttpResponse {
    let dashboards: Vec<Dashboard> = db.list("dashboards").await.unwrap_or_default();
    HttpResponse::Ok().json(serde_json::json!({ "dashboards": dashboards }))
}

pub async fn create_dashboard(
    db: web::Data<cloud_common::Database>,
    body: web::Json<CreateDashboardRequest>,
) -> HttpResponse {
    let now = Utc::now();
    let id = Uuid::new_v4();
    let dashboard = Dashboard {
        id,
        name: body.name.clone(),
        description: body.description.clone().unwrap_or_default(),
        widgets: 0,
        created_at: now,
        updated_at: now,
    };

    let _: Option<Dashboard> = db
        .create_with_id("dashboards", &id.to_string(), dashboard.clone())
        .await
        .unwrap_or(None);

    HttpResponse::Created().json(dashboard)
}
