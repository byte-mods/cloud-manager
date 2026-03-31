use actix_web::{web, HttpResponse};
use cloud_common::Database;

// ── Teams ─────────────────────────────────────────────────────────────────

/// GET /organizations/teams
pub async fn list_teams(db: web::Data<Database>) -> HttpResponse {
    match db.list::<serde_json::Value>("teams").await {
        Ok(items) => HttpResponse::Ok().json(serde_json::json!({
            "teams": items,
            "total": items.len(),
        })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": e.to_string(),
        })),
    }
}

/// POST /organizations/teams
pub async fn create_team(
    db: web::Data<Database>,
    body: web::Json<serde_json::Value>,
) -> HttpResponse {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let mut data = body.into_inner();

    if let Some(obj) = data.as_object_mut() {
        obj.insert("id".into(), serde_json::json!(id));
        obj.insert("created_at".into(), serde_json::json!(now));
        obj.insert("updated_at".into(), serde_json::json!(now));
    }

    match db.create_with_id::<serde_json::Value>("teams", &id, data).await {
        Ok(_) => HttpResponse::Created().json(serde_json::json!({
            "id": id,
            "message": "Team created",
        })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": e.to_string(),
        })),
    }
}

/// PUT /organizations/teams/{id}
pub async fn update_team(
    db: web::Data<Database>,
    path: web::Path<String>,
    body: web::Json<serde_json::Value>,
) -> HttpResponse {
    let id = path.into_inner();
    let mut data = body.into_inner();

    if let Some(obj) = data.as_object_mut() {
        obj.insert("updated_at".into(), serde_json::json!(chrono::Utc::now().to_rfc3339()));
    }

    match db.update::<serde_json::Value>("teams", &id, data).await {
        Ok(Some(_)) => HttpResponse::Ok().json(serde_json::json!({
            "message": "Team updated",
        })),
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({
            "error": "Team not found",
        })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": e.to_string(),
        })),
    }
}

/// DELETE /organizations/teams/{id}
pub async fn delete_team(
    db: web::Data<Database>,
    path: web::Path<String>,
) -> HttpResponse {
    let id = path.into_inner();
    match db.delete("teams", &id).await {
        Ok(_) => HttpResponse::Ok().json(serde_json::json!({
            "message": "Team deleted",
        })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": e.to_string(),
        })),
    }
}

// ── Projects ──────────────────────────────────────────────────────────────

/// GET /organizations/projects
pub async fn list_projects(db: web::Data<Database>) -> HttpResponse {
    match db.list::<serde_json::Value>("projects").await {
        Ok(items) => HttpResponse::Ok().json(serde_json::json!({
            "projects": items,
            "total": items.len(),
        })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": e.to_string(),
        })),
    }
}

/// POST /organizations/projects
pub async fn create_project(
    db: web::Data<Database>,
    body: web::Json<serde_json::Value>,
) -> HttpResponse {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let mut data = body.into_inner();

    if let Some(obj) = data.as_object_mut() {
        obj.insert("id".into(), serde_json::json!(id));
        obj.insert("created_at".into(), serde_json::json!(now));
        obj.insert("updated_at".into(), serde_json::json!(now));
    }

    match db.create_with_id::<serde_json::Value>("projects", &id, data).await {
        Ok(_) => HttpResponse::Created().json(serde_json::json!({
            "id": id,
            "message": "Project created",
        })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": e.to_string(),
        })),
    }
}

/// PUT /organizations/projects/{id}
pub async fn update_project(
    db: web::Data<Database>,
    path: web::Path<String>,
    body: web::Json<serde_json::Value>,
) -> HttpResponse {
    let id = path.into_inner();
    let mut data = body.into_inner();

    if let Some(obj) = data.as_object_mut() {
        obj.insert("updated_at".into(), serde_json::json!(chrono::Utc::now().to_rfc3339()));
    }

    match db.update::<serde_json::Value>("projects", &id, data).await {
        Ok(Some(_)) => HttpResponse::Ok().json(serde_json::json!({
            "message": "Project updated",
        })),
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({
            "error": "Project not found",
        })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": e.to_string(),
        })),
    }
}

/// DELETE /organizations/projects/{id}
pub async fn delete_project(
    db: web::Data<Database>,
    path: web::Path<String>,
) -> HttpResponse {
    let id = path.into_inner();
    match db.delete("projects", &id).await {
        Ok(_) => HttpResponse::Ok().json(serde_json::json!({
            "message": "Project deleted",
        })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": e.to_string(),
        })),
    }
}

// ── Members ───────────────────────────────────────────────────────────────

/// GET /organizations/members
pub async fn list_members(db: web::Data<Database>) -> HttpResponse {
    match db.list::<serde_json::Value>("members").await {
        Ok(items) => HttpResponse::Ok().json(serde_json::json!({
            "members": items,
            "total": items.len(),
        })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": e.to_string(),
        })),
    }
}

/// POST /organizations/members
pub async fn create_member(
    db: web::Data<Database>,
    body: web::Json<serde_json::Value>,
) -> HttpResponse {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let mut data = body.into_inner();

    if let Some(obj) = data.as_object_mut() {
        obj.insert("id".into(), serde_json::json!(id));
        obj.insert("joined_at".into(), serde_json::json!(now));
    }

    match db.create_with_id::<serde_json::Value>("members", &id, data).await {
        Ok(_) => HttpResponse::Created().json(serde_json::json!({
            "id": id,
            "message": "Member added",
        })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": e.to_string(),
        })),
    }
}

/// PUT /organizations/members/{id}
pub async fn update_member(
    db: web::Data<Database>,
    path: web::Path<String>,
    body: web::Json<serde_json::Value>,
) -> HttpResponse {
    let id = path.into_inner();
    match db.update::<serde_json::Value>("members", &id, body.into_inner()).await {
        Ok(Some(_)) => HttpResponse::Ok().json(serde_json::json!({
            "message": "Member updated",
        })),
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({
            "error": "Member not found",
        })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": e.to_string(),
        })),
    }
}

/// DELETE /organizations/members/{id}
pub async fn delete_member(
    db: web::Data<Database>,
    path: web::Path<String>,
) -> HttpResponse {
    let id = path.into_inner();
    match db.delete("members", &id).await {
        Ok(_) => HttpResponse::Ok().json(serde_json::json!({
            "message": "Member removed",
        })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": e.to_string(),
        })),
    }
}
