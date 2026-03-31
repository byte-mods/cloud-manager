use actix_web::{web, HttpResponse};
use chrono::Utc;
use cloud_common::Database;
use uuid::Uuid;

use crate::models::analytics::{CreateReportRequest, Report};

pub async fn list_reports(db: web::Data<Database>) -> HttpResponse {
    let reports: Vec<Report> = db.list("reports").await.unwrap_or_default();
    HttpResponse::Ok().json(serde_json::json!({ "reports": reports }))
}

pub async fn create_report(
    db: web::Data<Database>,
    body: web::Json<CreateReportRequest>,
) -> HttpResponse {
    let now = Utc::now();
    let id = Uuid::new_v4();
    let report = Report {
        id,
        name: body.name.clone(),
        schedule: body.schedule.clone(),
        format: body.format.clone(),
        status: "scheduled".into(),
        last_run_at: None,
        next_run_at: Some(now + chrono::Duration::days(1)),
        created_at: now,
        recipients: body.recipients.clone().unwrap_or_default(),
    };

    let _: Option<Report> = db
        .create_with_id("reports", &id.to_string(), report.clone())
        .await
        .ok()
        .flatten();

    HttpResponse::Created().json(report)
}

pub async fn get_report(
    db: web::Data<Database>,
    path: web::Path<Uuid>,
) -> HttpResponse {
    let report_id = path.into_inner();

    match db.get::<Report>("reports", &report_id.to_string()).await {
        Ok(Some(report)) => HttpResponse::Ok().json(report),
        _ => HttpResponse::NotFound().json(serde_json::json!({
            "error": "not_found",
            "message": format!("Report '{}' not found", report_id),
        })),
    }
}
