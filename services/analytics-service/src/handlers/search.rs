use actix_web::{web, HttpResponse};
use cloud_common::Database;

use crate::models::analytics::SearchIndex;

pub async fn get_search_status(db: web::Data<Database>) -> HttpResponse {
    let indices: Vec<SearchIndex> = db.list("search_indices").await.unwrap_or_default();
    HttpResponse::Ok().json(serde_json::json!({ "indices": indices }))
}
