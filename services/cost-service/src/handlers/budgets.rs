use actix_web::{web, HttpResponse};
use cloud_common::Database;
use uuid::Uuid;

use crate::error::CostError;
use crate::models::cost::{Budget, CreateBudgetRequest};

/// GET /api/v1/cost/budgets
///
/// Returns all configured budgets with current spend status.
pub async fn list_budgets(
    db: web::Data<Database>,
) -> Result<HttpResponse, CostError> {
    let budgets: Vec<Budget> = db
        .list("budgets")
        .await
        .unwrap_or_default();
    Ok(HttpResponse::Ok().json(budgets))
}

/// POST /api/v1/cost/budgets
///
/// Creates a new budget with alert threshold.
pub async fn create_budget(
    body: web::Json<CreateBudgetRequest>,
    db: web::Data<Database>,
) -> Result<HttpResponse, CostError> {
    let request = body.into_inner();

    if request.amount <= 0.0 {
        return Err(CostError::BadRequest("Budget amount must be positive".into()));
    }
    if !(0.0..=1.0).contains(&request.alert_threshold) {
        return Err(CostError::BadRequest(
            "Alert threshold must be between 0.0 and 1.0".into(),
        ));
    }

    let id = Uuid::new_v4();
    let budget = Budget {
        id,
        name: request.name,
        amount: request.amount,
        current_spend: 0.0,
        alert_threshold: request.alert_threshold,
        period: request.period,
    };

    let _: Option<Budget> = db
        .create_with_id("budgets", &id.to_string(), budget.clone())
        .await
        .map_err(|e| CostError::Internal(e))?;

    Ok(HttpResponse::Created().json(budget))
}
