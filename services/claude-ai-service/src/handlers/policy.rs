use actix_web::{web, HttpResponse};

use crate::anthropic::AnthropicClient;
use crate::error::AiError;
use crate::models::chat::AnthropicMessage;
use crate::models::iac::{PolicyRequest, PolicyResponse};

/// POST /api/v1/ai/generate-policy
///
/// Generates a least-privilege IAM policy from a natural-language description.
pub async fn generate_policy(
    client: web::Data<AnthropicClient>,
    body: web::Json<PolicyRequest>,
) -> Result<HttpResponse, AiError> {
    let request = body.into_inner();

    let system_prompt = format!(
        "You are a cloud security expert specializing in IAM policies for {}. \
         Generate a least-privilege IAM policy based on the user's description. \
         Follow the principle of least privilege strictly.\n\n\
         IMPORTANT: Return your response as JSON with exactly two fields:\n\
         - \"policy\": the complete IAM policy document as a string\n\
         - \"explanation\": explanation of permissions granted and why they are needed\n\n\
         Do NOT include markdown formatting. Return raw JSON only.",
        request.provider
    );

    let messages = vec![AnthropicMessage {
        role: "user".to_string(),
        content: format!(
            "Create a least-privilege {} IAM policy for: {}",
            request.provider, request.description
        ),
    }];

    let response = client.send_message(messages, &system_prompt, None).await?;

    let parsed: serde_json::Value =
        serde_json::from_str(&response.content).unwrap_or_else(|_| {
            serde_json::json!({
                "policy": response.content,
                "explanation": "Generated least-privilege IAM policy."
            })
        });

    let policy_response = PolicyResponse {
        policy: parsed["policy"]
            .as_str()
            .unwrap_or(&response.content)
            .to_string(),
        explanation: parsed["explanation"]
            .as_str()
            .unwrap_or("Generated least-privilege IAM policy.")
            .to_string(),
        provider: request.provider,
    };

    Ok(HttpResponse::Ok().json(policy_response))
}
