use actix_web::{web, HttpResponse};

use crate::anthropic::AnthropicClient;
use crate::context::build_cost_context;
use crate::error::AiError;
use crate::models::chat::AnthropicMessage;
use crate::models::iac::{CostRecommendationRequest, CostRecommendationResponse};

/// POST /api/v1/ai/cost-recommendations
///
/// Analyzes cost data using Claude and returns actionable optimization suggestions.
pub async fn cost_recommendations(
    client: web::Data<AnthropicClient>,
    body: web::Json<CostRecommendationRequest>,
) -> Result<HttpResponse, AiError> {
    let request = body.into_inner();

    let system_prompt = build_cost_context(&request.cost_data);

    let mut user_message = "Analyze the cost data provided and give me specific optimization recommendations.".to_string();
    if let Some(provider) = &request.provider {
        user_message.push_str(&format!(" Focus on {} resources.", provider));
    }
    if let Some(timeframe) = &request.timeframe {
        user_message.push_str(&format!(" Consider the {} timeframe.", timeframe));
    }
    user_message.push_str(
        "\n\nReturn your response as JSON with these fields:\n\
         - \"recommendations\": array of recommendation strings\n\
         - \"estimated_savings\": estimated monthly savings as a number (or null)\n\
         - \"analysis\": overall analysis summary",
    );

    let messages = vec![AnthropicMessage {
        role: "user".to_string(),
        content: user_message,
    }];

    let response = client.send_message(messages, &system_prompt, None).await?;

    let parsed: serde_json::Value =
        serde_json::from_str(&response.content).unwrap_or_else(|_| {
            serde_json::json!({
                "recommendations": [response.content],
                "estimated_savings": null,
                "analysis": response.content
            })
        });

    let cost_response = CostRecommendationResponse {
        recommendations: parsed["recommendations"]
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(String::from))
                    .collect()
            })
            .unwrap_or_else(|| vec![response.content]),
        estimated_savings: parsed["estimated_savings"].as_f64(),
        analysis: parsed["analysis"]
            .as_str()
            .unwrap_or("Cost analysis complete.")
            .to_string(),
    };

    Ok(HttpResponse::Ok().json(cost_response))
}
