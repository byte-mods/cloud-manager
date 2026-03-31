use actix_web::{web, HttpResponse};

use crate::anthropic::AnthropicClient;
use crate::context::build_security_context;
use crate::error::AiError;
use crate::models::chat::AnthropicMessage;
use crate::models::iac::{SecurityRemediationRequest, SecurityRemediationResponse};

/// POST /api/v1/ai/security-remediation
///
/// Takes a security finding and returns detailed remediation steps and code fixes.
pub async fn security_remediation(
    client: web::Data<AnthropicClient>,
    body: web::Json<SecurityRemediationRequest>,
) -> Result<HttpResponse, AiError> {
    let request = body.into_inner();

    let system_prompt = build_security_context(&request.finding);

    let mut user_message =
        "Provide detailed remediation steps for the security finding described above.".to_string();
    if let Some(provider) = &request.provider {
        user_message.push_str(&format!(" The resource is on {}.", provider));
    }
    if let Some(resource_type) = &request.resource_type {
        user_message.push_str(&format!(" Resource type: {}.", resource_type));
    }
    user_message.push_str(
        "\n\nReturn your response as JSON with these fields:\n\
         - \"remediation_steps\": array of step strings\n\
         - \"code_fix\": IaC code to fix the issue (or null)\n\
         - \"explanation\": detailed explanation\n\
         - \"severity\": assessed severity (critical/high/medium/low)",
    );

    let messages = vec![AnthropicMessage {
        role: "user".to_string(),
        content: user_message,
    }];

    let response = client.send_message(messages, &system_prompt, None).await?;

    let parsed: serde_json::Value =
        serde_json::from_str(&response.content).unwrap_or_else(|_| {
            serde_json::json!({
                "remediation_steps": [response.content],
                "code_fix": null,
                "explanation": response.content,
                "severity": "medium"
            })
        });

    let remediation_response = SecurityRemediationResponse {
        remediation_steps: parsed["remediation_steps"]
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(String::from))
                    .collect()
            })
            .unwrap_or_else(|| vec![response.content]),
        code_fix: parsed["code_fix"].as_str().map(String::from),
        explanation: parsed["explanation"]
            .as_str()
            .unwrap_or("Remediation analysis complete.")
            .to_string(),
        severity: parsed["severity"]
            .as_str()
            .unwrap_or("medium")
            .to_string(),
    };

    Ok(HttpResponse::Ok().json(remediation_response))
}
