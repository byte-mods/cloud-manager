use crate::models::chat::ChatContext;

/// Build a rich system prompt for Claude based on the provided context.
pub fn build_system_prompt(context: &Option<ChatContext>) -> String {
    let mut prompt = String::from(
        "You are an expert cloud infrastructure assistant integrated into a multi-cloud management platform. \
         You help users manage AWS, GCP, and Azure resources, write Infrastructure as Code, \
         configure security policies, optimize costs, and troubleshoot issues.\n\n",
    );

    if let Some(ctx) = context {
        prompt.push_str("## Current Context\n\n");

        if let Some(module) = &ctx.module {
            prompt.push_str(&format!("**Active Module:** {module}\n"));
            match module.as_str() {
                "compute" => prompt.push_str(
                    "The user is working with compute resources (VMs, instances, containers). \
                     Provide guidance specific to compute management.\n",
                ),
                "networking" => prompt.push_str(
                    "The user is working with networking resources (VPCs, subnets, load balancers). \
                     Provide guidance specific to network configuration.\n",
                ),
                "storage" => prompt.push_str(
                    "The user is working with storage resources (S3, GCS, Blob Storage). \
                     Provide guidance specific to storage management.\n",
                ),
                "security" => prompt.push_str(
                    "The user is working with security configurations (IAM, firewalls, policies). \
                     Prioritize security best practices.\n",
                ),
                "cost" => prompt.push_str(
                    "The user is working with cost management. Provide cost optimization guidance.\n",
                ),
                _ => {}
            }
        }

        if let Some(provider) = &ctx.provider {
            prompt.push_str(&format!("**Cloud Provider:** {provider}\n"));
        }

        if let Some(resource_type) = &ctx.resource_type {
            prompt.push_str(&format!("**Resource Type:** {resource_type}\n"));
        }

        if let Some(resource_id) = &ctx.resource_id {
            prompt.push_str(&format!("**Resource ID:** {resource_id}\n"));
        }

        if let Some(additional) = &ctx.additional {
            prompt.push_str(&format!(
                "**Additional Context:** {}\n",
                serde_json::to_string_pretty(additional).unwrap_or_default()
            ));
        }

        prompt.push('\n');
    }

    prompt.push_str(
        "Respond with clear, actionable guidance. When providing code, use proper formatting. \
         Always consider security best practices and cost implications.",
    );

    prompt
}

/// Build a context string for cost analysis prompts.
pub fn build_cost_context(cost_data: &serde_json::Value) -> String {
    let mut ctx = String::from(
        "You are analyzing cloud cost data for a multi-cloud environment. \
         Provide specific, actionable cost optimization recommendations.\n\n",
    );

    ctx.push_str("## Cost Data\n\n");
    ctx.push_str(&serde_json::to_string_pretty(cost_data).unwrap_or_default());
    ctx.push_str("\n\nAnalyze this data and provide:\n");
    ctx.push_str("1. Key cost drivers\n");
    ctx.push_str("2. Specific optimization recommendations with estimated savings\n");
    ctx.push_str("3. Priority ordering (quick wins first)\n");
    ctx.push_str("4. Any anomalies or unexpected charges\n");

    ctx
}

/// Build a context string for security remediation prompts.
pub fn build_security_context(findings: &serde_json::Value) -> String {
    let mut ctx = String::from(
        "You are a cloud security expert reviewing security findings. \
         Provide detailed remediation steps with code examples where applicable.\n\n",
    );

    ctx.push_str("## Security Findings\n\n");
    ctx.push_str(&serde_json::to_string_pretty(findings).unwrap_or_default());
    ctx.push_str("\n\nFor each finding, provide:\n");
    ctx.push_str("1. Severity assessment\n");
    ctx.push_str("2. Step-by-step remediation instructions\n");
    ctx.push_str("3. Infrastructure as Code fix (Terraform preferred)\n");
    ctx.push_str("4. Prevention measures for the future\n");

    ctx
}
