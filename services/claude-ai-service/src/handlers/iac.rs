use actix_web::{web, HttpResponse};

use crate::anthropic::AnthropicClient;
use crate::error::AiError;
use crate::models::chat::AnthropicMessage;
use crate::models::iac::{IacRequest, IacResponse};

/// POST /api/v1/ai/generate-iac
///
/// Takes a natural-language description and generates Infrastructure as Code
/// in the requested format (Terraform, CloudFormation, Pulumi, or Bicep).
pub async fn generate_iac(
    client: web::Data<AnthropicClient>,
    body: web::Json<IacRequest>,
) -> Result<HttpResponse, AiError> {
    let request = body.into_inner();

    let system_prompt = format!(
        "You are an Infrastructure as Code expert. Generate production-ready {} code for {} (provider: {}). \
         \n\nIMPORTANT: Return your response as JSON with exactly two fields:\n\
         - \"code\": the complete IaC code as a string\n\
         - \"explanation\": a brief explanation of what the code does\n\n\
         Do NOT include markdown formatting. Return raw JSON only.",
        request.format, request.description, request.provider
    );

    let messages = vec![AnthropicMessage {
        role: "user".to_string(),
        content: format!(
            "Generate {} code for the following: {}",
            request.format, request.description
        ),
    }];

    let response = client.send_message(messages, &system_prompt, None).await?;

    // Parse the structured response from Claude.
    let parsed: serde_json::Value =
        serde_json::from_str(&response.content).unwrap_or_else(|_| {
            serde_json::json!({
                "code": response.content,
                "explanation": "Generated infrastructure code."
            })
        });

    let iac_response = IacResponse {
        code: parsed["code"]
            .as_str()
            .unwrap_or(&response.content)
            .to_string(),
        format: request.format,
        explanation: parsed["explanation"]
            .as_str()
            .unwrap_or("Generated infrastructure code.")
            .to_string(),
    };

    Ok(HttpResponse::Ok().json(iac_response))
}
