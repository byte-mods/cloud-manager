use actix_web::{web, HttpResponse};
use serde::{Deserialize, Serialize};

use crate::error::SecurityError;
use crate::models::ComplianceFramework;

// ---------------------------------------------------------------------------
// Request / response types
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct GenerateCodeRequest {
    pub framework: String,
    /// Optional: limit to specific control IDs.
    #[serde(default)]
    pub controls: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct GeneratedCode {
    pub framework: String,
    pub format: String,
    pub files: Vec<GeneratedFile>,
}

#[derive(Debug, Serialize)]
pub struct GeneratedFile {
    pub path: String,
    pub content: String,
    pub description: String,
}

// ---------------------------------------------------------------------------
// Terraform generation
// ---------------------------------------------------------------------------

/// POST /api/v1/security/compliance/generate-terraform
pub async fn generate_terraform(
    body: web::Json<GenerateCodeRequest>,
) -> Result<HttpResponse, SecurityError> {
    let req = body.into_inner();

    let framework = ComplianceFramework::from_str(&req.framework).ok_or_else(|| {
        SecurityError::BadRequest(format!("Unknown compliance framework: {}", req.framework))
    })?;

    tracing::info!(framework = %framework, "Generating Terraform modules for compliance");

    let files = generate_terraform_for_framework(framework);

    Ok(HttpResponse::Ok().json(GeneratedCode {
        framework: framework.to_string(),
        format: "terraform".to_string(),
        files,
    }))
}

/// POST /api/v1/security/compliance/generate-opa
pub async fn generate_opa(
    body: web::Json<GenerateCodeRequest>,
) -> Result<HttpResponse, SecurityError> {
    let req = body.into_inner();

    let framework = ComplianceFramework::from_str(&req.framework).ok_or_else(|| {
        SecurityError::BadRequest(format!("Unknown compliance framework: {}", req.framework))
    })?;

    tracing::info!(framework = %framework, "Generating OPA Rego policies for compliance");

    let files = generate_opa_for_framework(framework);

    Ok(HttpResponse::Ok().json(GeneratedCode {
        framework: framework.to_string(),
        format: "opa".to_string(),
        files,
    }))
}

// ---------------------------------------------------------------------------
// Terraform generators per framework
// ---------------------------------------------------------------------------

fn generate_terraform_for_framework(framework: ComplianceFramework) -> Vec<GeneratedFile> {
    let mut files = Vec::new();

    // Common modules every framework needs
    files.push(GeneratedFile {
        path: format!("modules/{}/main.tf", framework_dir(framework)),
        content: generate_main_tf(framework),
        description: format!("Main Terraform module for {} compliance", framework),
    });

    files.push(GeneratedFile {
        path: format!("modules/{}/variables.tf", framework_dir(framework)),
        content: generate_variables_tf(framework),
        description: "Input variables for the compliance module".to_string(),
    });

    files.push(GeneratedFile {
        path: format!("modules/{}/outputs.tf", framework_dir(framework)),
        content: generate_outputs_tf(framework),
        description: "Output values from the compliance module".to_string(),
    });

    // Framework-specific controls
    match framework {
        ComplianceFramework::Soc2 => {
            files.push(GeneratedFile {
                path: format!("modules/{}/encryption.tf", framework_dir(framework)),
                content: soc2_encryption_tf(),
                description: "SOC2 CC6.1 - Encryption at rest controls".to_string(),
            });
            files.push(GeneratedFile {
                path: format!("modules/{}/logging.tf", framework_dir(framework)),
                content: soc2_logging_tf(),
                description: "SOC2 CC7.2 - Logging and monitoring controls".to_string(),
            });
            files.push(GeneratedFile {
                path: format!("modules/{}/access_control.tf", framework_dir(framework)),
                content: soc2_access_control_tf(),
                description: "SOC2 CC6.3 - Access control policies".to_string(),
            });
        }
        ComplianceFramework::Hipaa => {
            files.push(GeneratedFile {
                path: format!("modules/{}/encryption.tf", framework_dir(framework)),
                content: hipaa_encryption_tf(),
                description: "HIPAA 164.312(a)(2)(iv) - Encryption at rest and in transit".to_string(),
            });
            files.push(GeneratedFile {
                path: format!("modules/{}/audit_logging.tf", framework_dir(framework)),
                content: hipaa_audit_logging_tf(),
                description: "HIPAA 164.312(b) - Audit controls".to_string(),
            });
            files.push(GeneratedFile {
                path: format!("modules/{}/network.tf", framework_dir(framework)),
                content: hipaa_network_tf(),
                description: "HIPAA 164.312(e)(1) - Transmission security".to_string(),
            });
        }
        ComplianceFramework::PciDss4 => {
            files.push(GeneratedFile {
                path: format!("modules/{}/network_segmentation.tf", framework_dir(framework)),
                content: pci_network_segmentation_tf(),
                description: "PCI-DSS Req 1 - Network segmentation".to_string(),
            });
            files.push(GeneratedFile {
                path: format!("modules/{}/encryption.tf", framework_dir(framework)),
                content: pci_encryption_tf(),
                description: "PCI-DSS Req 3/4 - Protect stored/transmitted cardholder data".to_string(),
            });
            files.push(GeneratedFile {
                path: format!("modules/{}/logging.tf", framework_dir(framework)),
                content: pci_logging_tf(),
                description: "PCI-DSS Req 10 - Track and monitor all access".to_string(),
            });
        }
        ComplianceFramework::Iso27001 | ComplianceFramework::NistCsf | ComplianceFramework::Cis | ComplianceFramework::Gdpr => {
            files.push(GeneratedFile {
                path: format!("modules/{}/encryption.tf", framework_dir(framework)),
                content: generic_encryption_tf(framework),
                description: "Encryption at rest and in transit controls".to_string(),
            });
            files.push(GeneratedFile {
                path: format!("modules/{}/logging.tf", framework_dir(framework)),
                content: generic_logging_tf(framework),
                description: "Centralized logging and monitoring".to_string(),
            });
            files.push(GeneratedFile {
                path: format!("modules/{}/network.tf", framework_dir(framework)),
                content: generic_network_tf(framework),
                description: "Network security controls".to_string(),
            });
        }
    }

    files
}

fn framework_dir(f: ComplianceFramework) -> &'static str {
    match f {
        ComplianceFramework::Soc2 => "soc2",
        ComplianceFramework::Iso27001 => "iso27001",
        ComplianceFramework::Hipaa => "hipaa",
        ComplianceFramework::PciDss4 => "pci-dss",
        ComplianceFramework::Gdpr => "gdpr",
        ComplianceFramework::NistCsf => "nist-csf",
        ComplianceFramework::Cis => "cis",
    }
}

fn generate_main_tf(framework: ComplianceFramework) -> String {
    format!(
        r#"# {framework} Compliance Module
# Auto-generated — review before applying

terraform {{
  required_version = ">= 1.5.0"
  required_providers {{
    aws = {{
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }}
  }}
}}

module "encryption" {{
  source = "./encryption.tf"
  kms_key_alias = var.kms_key_alias
  enable_s3_encryption = var.enable_s3_encryption
  enable_rds_encryption = var.enable_rds_encryption
  enable_ebs_encryption = var.enable_ebs_encryption
}}

module "logging" {{
  source = "./logging.tf"
  log_retention_days = var.log_retention_days
  enable_cloudtrail = var.enable_cloudtrail
  enable_vpc_flow_logs = var.enable_vpc_flow_logs
}}
"#,
        framework = framework
    )
}

fn generate_variables_tf(_framework: ComplianceFramework) -> String {
    r#"variable "kms_key_alias" {
  description = "Alias for the KMS key used for encryption"
  type        = string
  default     = "alias/compliance-key"
}

variable "enable_s3_encryption" {
  description = "Enable default encryption on S3 buckets"
  type        = bool
  default     = true
}

variable "enable_rds_encryption" {
  description = "Enable encryption on RDS instances"
  type        = bool
  default     = true
}

variable "enable_ebs_encryption" {
  description = "Enable default EBS encryption"
  type        = bool
  default     = true
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 365
}

variable "enable_cloudtrail" {
  description = "Enable AWS CloudTrail"
  type        = bool
  default     = true
}

variable "enable_vpc_flow_logs" {
  description = "Enable VPC Flow Logs"
  type        = bool
  default     = true
}

variable "vpc_id" {
  description = "VPC ID for network controls"
  type        = string
  default     = ""
}
"#
    .to_string()
}

fn generate_outputs_tf(_framework: ComplianceFramework) -> String {
    r#"output "kms_key_arn" {
  description = "ARN of the compliance KMS key"
  value       = aws_kms_key.compliance.arn
}

output "cloudtrail_arn" {
  description = "ARN of the CloudTrail trail"
  value       = aws_cloudtrail.compliance.arn
}

output "log_group_name" {
  description = "Name of the CloudWatch log group"
  value       = aws_cloudwatch_log_group.compliance.name
}
"#
    .to_string()
}

// --- SOC2 ---

fn soc2_encryption_tf() -> String {
    r#"# SOC2 CC6.1 — Encryption at Rest
resource "aws_kms_key" "compliance" {
  description             = "SOC2 compliance encryption key"
  deletion_window_in_days = 30
  enable_key_rotation     = true
  tags = { compliance = "soc2", control = "CC6.1" }
}

resource "aws_ebs_encryption_by_default" "this" {
  enabled = var.enable_ebs_encryption
}

resource "aws_s3_bucket_server_side_encryption_configuration" "default" {
  count  = var.enable_s3_encryption ? 1 : 0
  bucket = var.bucket_id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.compliance.arn
    }
  }
}
"#
    .to_string()
}

fn soc2_logging_tf() -> String {
    r#"# SOC2 CC7.2 — Logging and Monitoring
resource "aws_cloudtrail" "compliance" {
  name                          = "soc2-compliance-trail"
  s3_bucket_name                = aws_s3_bucket.trail_bucket.id
  is_multi_region_trail         = true
  enable_log_file_validation    = true
  include_global_service_events = true
  tags = { compliance = "soc2", control = "CC7.2" }
}

resource "aws_cloudwatch_log_group" "compliance" {
  name              = "/compliance/soc2"
  retention_in_days = var.log_retention_days
  tags = { compliance = "soc2" }
}

resource "aws_s3_bucket" "trail_bucket" {
  bucket = "soc2-cloudtrail-logs-${data.aws_caller_identity.current.account_id}"
  tags   = { compliance = "soc2" }
}

data "aws_caller_identity" "current" {}
"#
    .to_string()
}

fn soc2_access_control_tf() -> String {
    r#"# SOC2 CC6.3 — Access Control
resource "aws_iam_account_password_policy" "strict" {
  minimum_password_length        = 14
  require_lowercase_characters   = true
  require_uppercase_characters   = true
  require_numbers                = true
  require_symbols                = true
  max_password_age               = 90
  password_reuse_prevention      = 24
  allow_users_to_change_password = true
}

resource "aws_iam_policy" "enforce_mfa" {
  name        = "soc2-enforce-mfa"
  description = "Deny all actions if MFA is not present"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "DenyWithoutMFA"
      Effect    = "Deny"
      Action    = "*"
      Resource  = "*"
      Condition = { BoolIfExists = { "aws:MultiFactorAuthPresent" = "false" } }
    }]
  })
  tags = { compliance = "soc2", control = "CC6.3" }
}
"#
    .to_string()
}

// --- HIPAA ---

fn hipaa_encryption_tf() -> String {
    r#"# HIPAA 164.312(a)(2)(iv) — Encryption at Rest and In Transit
resource "aws_kms_key" "compliance" {
  description             = "HIPAA compliance encryption key"
  deletion_window_in_days = 30
  enable_key_rotation     = true
  tags = { compliance = "hipaa", control = "164.312(a)(2)(iv)" }
}

resource "aws_ebs_encryption_by_default" "this" {
  enabled = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "default" {
  count  = var.enable_s3_encryption ? 1 : 0
  bucket = var.bucket_id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.compliance.arn
    }
  }
}

resource "aws_s3_bucket_public_access_block" "block" {
  count                   = var.enable_s3_encryption ? 1 : 0
  bucket                  = var.bucket_id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
"#
    .to_string()
}

fn hipaa_audit_logging_tf() -> String {
    r#"# HIPAA 164.312(b) — Audit Controls
resource "aws_cloudtrail" "compliance" {
  name                          = "hipaa-compliance-trail"
  s3_bucket_name                = aws_s3_bucket.trail_bucket.id
  is_multi_region_trail         = true
  enable_log_file_validation    = true
  include_global_service_events = true
  cloud_watch_logs_group_arn    = "${aws_cloudwatch_log_group.compliance.arn}:*"
  cloud_watch_logs_role_arn     = aws_iam_role.cloudtrail.arn
  tags = { compliance = "hipaa", control = "164.312(b)" }
}

resource "aws_cloudwatch_log_group" "compliance" {
  name              = "/compliance/hipaa"
  retention_in_days = var.log_retention_days
  kms_key_id        = aws_kms_key.compliance.arn
  tags = { compliance = "hipaa" }
}

resource "aws_s3_bucket" "trail_bucket" {
  bucket = "hipaa-cloudtrail-logs-${data.aws_caller_identity.current.account_id}"
  tags   = { compliance = "hipaa" }
}

data "aws_caller_identity" "current" {}
"#
    .to_string()
}

fn hipaa_network_tf() -> String {
    r#"# HIPAA 164.312(e)(1) — Transmission Security
resource "aws_vpc" "hipaa" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true
  tags = { compliance = "hipaa", control = "164.312(e)(1)" }
}

resource "aws_flow_log" "hipaa" {
  vpc_id          = aws_vpc.hipaa.id
  traffic_type    = "ALL"
  iam_role_arn    = aws_iam_role.flow_log.arn
  log_destination = aws_cloudwatch_log_group.compliance.arn
  tags = { compliance = "hipaa" }
}

resource "aws_security_group" "restrict_all" {
  name_prefix = "hipaa-default-deny-"
  vpc_id      = aws_vpc.hipaa.id
  description = "Default deny all — HIPAA transmission security"
  tags = { compliance = "hipaa" }
}
"#
    .to_string()
}

// --- PCI-DSS ---

fn pci_network_segmentation_tf() -> String {
    r#"# PCI-DSS Requirement 1 — Network Segmentation
resource "aws_vpc" "cardholder" {
  cidr_block           = "10.1.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true
  tags = { compliance = "pci-dss", control = "req-1", environment = "cardholder" }
}

resource "aws_subnet" "cardholder_private" {
  vpc_id                  = aws_vpc.cardholder.id
  cidr_block              = "10.1.1.0/24"
  map_public_ip_on_launch = false
  tags = { compliance = "pci-dss", zone = "cardholder-data" }
}

resource "aws_network_acl" "cardholder" {
  vpc_id = aws_vpc.cardholder.id
  tags   = { compliance = "pci-dss", control = "req-1" }

  ingress {
    protocol   = "-1"
    rule_no    = 100
    action     = "deny"
    cidr_block = "0.0.0.0/0"
    from_port  = 0
    to_port    = 0
  }

  egress {
    protocol   = "-1"
    rule_no    = 100
    action     = "deny"
    cidr_block = "0.0.0.0/0"
    from_port  = 0
    to_port    = 0
  }
}
"#
    .to_string()
}

fn pci_encryption_tf() -> String {
    r#"# PCI-DSS Requirement 3/4 — Protect Cardholder Data
resource "aws_kms_key" "compliance" {
  description             = "PCI-DSS compliance encryption key"
  deletion_window_in_days = 30
  enable_key_rotation     = true
  tags = { compliance = "pci-dss", control = "req-3" }
}

resource "aws_ebs_encryption_by_default" "this" {
  enabled = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "pci" {
  count  = var.enable_s3_encryption ? 1 : 0
  bucket = var.bucket_id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.compliance.arn
    }
  }
}
"#
    .to_string()
}

fn pci_logging_tf() -> String {
    r#"# PCI-DSS Requirement 10 — Track and Monitor Access
resource "aws_cloudtrail" "compliance" {
  name                          = "pci-dss-compliance-trail"
  s3_bucket_name                = aws_s3_bucket.trail_bucket.id
  is_multi_region_trail         = true
  enable_log_file_validation    = true
  include_global_service_events = true
  tags = { compliance = "pci-dss", control = "req-10" }
}

resource "aws_cloudwatch_log_group" "compliance" {
  name              = "/compliance/pci-dss"
  retention_in_days = var.log_retention_days
  tags = { compliance = "pci-dss" }
}

resource "aws_cloudwatch_metric_alarm" "unauthorized_api" {
  alarm_name          = "pci-unauthorized-api-calls"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "UnauthorizedAttemptCount"
  namespace           = "CloudTrailMetrics"
  period              = 300
  statistic           = "Sum"
  threshold           = 5
  alarm_description   = "PCI-DSS Req 10: Alert on unauthorized API calls"
  tags = { compliance = "pci-dss", control = "req-10" }
}

resource "aws_s3_bucket" "trail_bucket" {
  bucket = "pci-dss-cloudtrail-logs-${data.aws_caller_identity.current.account_id}"
  tags   = { compliance = "pci-dss" }
}

data "aws_caller_identity" "current" {}
"#
    .to_string()
}

// --- Generic (ISO27001, NIST-CSF, CIS, GDPR) ---

fn generic_encryption_tf(framework: ComplianceFramework) -> String {
    let dir = framework_dir(framework);
    format!(
        r#"# {framework} — Encryption at Rest and In Transit
resource "aws_kms_key" "compliance" {{
  description             = "{framework} compliance encryption key"
  deletion_window_in_days = 30
  enable_key_rotation     = true
  tags = {{ compliance = "{dir}" }}
}}

resource "aws_ebs_encryption_by_default" "this" {{
  enabled = true
}}

resource "aws_s3_bucket_server_side_encryption_configuration" "default" {{
  count  = var.enable_s3_encryption ? 1 : 0
  bucket = var.bucket_id
  rule {{
    apply_server_side_encryption_by_default {{
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.compliance.arn
    }}
  }}
}}
"#,
        framework = framework,
        dir = dir,
    )
}

fn generic_logging_tf(framework: ComplianceFramework) -> String {
    let dir = framework_dir(framework);
    format!(
        r#"# {framework} — Centralized Logging
resource "aws_cloudtrail" "compliance" {{
  name                          = "{dir}-compliance-trail"
  s3_bucket_name                = aws_s3_bucket.trail_bucket.id
  is_multi_region_trail         = true
  enable_log_file_validation    = true
  include_global_service_events = true
  tags = {{ compliance = "{dir}" }}
}}

resource "aws_cloudwatch_log_group" "compliance" {{
  name              = "/compliance/{dir}"
  retention_in_days = var.log_retention_days
  tags = {{ compliance = "{dir}" }}
}}

resource "aws_s3_bucket" "trail_bucket" {{
  bucket = "{dir}-cloudtrail-logs-${{data.aws_caller_identity.current.account_id}}"
  tags   = {{ compliance = "{dir}" }}
}}

data "aws_caller_identity" "current" {{}}
"#,
        framework = framework,
        dir = dir,
    )
}

fn generic_network_tf(framework: ComplianceFramework) -> String {
    let dir = framework_dir(framework);
    format!(
        r#"# {framework} — Network Security Controls
resource "aws_flow_log" "compliance" {{
  vpc_id          = var.vpc_id
  traffic_type    = "ALL"
  iam_role_arn    = aws_iam_role.flow_log.arn
  log_destination = aws_cloudwatch_log_group.compliance.arn
  tags = {{ compliance = "{dir}" }}
}}

resource "aws_security_group" "default_deny" {{
  name_prefix = "{dir}-default-deny-"
  vpc_id      = var.vpc_id
  description = "Default deny all — {framework} network controls"
  tags = {{ compliance = "{dir}" }}
}}
"#,
        framework = framework,
        dir = dir,
    )
}

// ---------------------------------------------------------------------------
// OPA / Rego generation
// ---------------------------------------------------------------------------

fn generate_opa_for_framework(framework: ComplianceFramework) -> Vec<GeneratedFile> {
    let dir = framework_dir(framework);
    let mut files = Vec::new();

    files.push(GeneratedFile {
        path: format!("policies/{}/encryption.rego", dir),
        content: opa_encryption_policy(framework),
        description: "OPA policy: validate encryption controls".to_string(),
    });

    files.push(GeneratedFile {
        path: format!("policies/{}/logging.rego", dir),
        content: opa_logging_policy(framework),
        description: "OPA policy: validate logging controls".to_string(),
    });

    files.push(GeneratedFile {
        path: format!("policies/{}/network.rego", dir),
        content: opa_network_policy(framework),
        description: "OPA policy: validate network security controls".to_string(),
    });

    files.push(GeneratedFile {
        path: format!("policies/{}/main.rego", dir),
        content: opa_main_policy(framework),
        description: "OPA entrypoint: aggregate all compliance checks".to_string(),
    });

    files
}

fn opa_encryption_policy(framework: ComplianceFramework) -> String {
    let dir = framework_dir(framework);
    format!(
        r#"package {pkg}.encryption

import rego.v1

# Deny S3 buckets without server-side encryption
deny contains msg if {{
    resource := input.planned_values.root_module.resources[_]
    resource.type == "aws_s3_bucket"
    not has_encryption(resource)
    msg := sprintf("{framework}: S3 bucket '%s' must have server-side encryption enabled", [resource.values.bucket])
}}

has_encryption(bucket) if {{
    enc := input.planned_values.root_module.resources[_]
    enc.type == "aws_s3_bucket_server_side_encryption_configuration"
    enc.values.bucket == bucket.values.bucket
}}

# Deny EBS volumes without encryption
deny contains msg if {{
    resource := input.planned_values.root_module.resources[_]
    resource.type == "aws_ebs_volume"
    resource.values.encrypted != true
    msg := sprintf("{framework}: EBS volume must be encrypted", [])
}}

# Deny RDS instances without encryption
deny contains msg if {{
    resource := input.planned_values.root_module.resources[_]
    resource.type == "aws_db_instance"
    resource.values.storage_encrypted != true
    msg := sprintf("{framework}: RDS instance '%s' must have storage encryption enabled", [resource.values.identifier])
}}

# Require KMS key rotation
deny contains msg if {{
    resource := input.planned_values.root_module.resources[_]
    resource.type == "aws_kms_key"
    resource.values.enable_key_rotation != true
    msg := sprintf("{framework}: KMS key must have automatic key rotation enabled", [])
}}
"#,
        pkg = dir.replace('-', "_"),
        framework = framework,
    )
}

fn opa_logging_policy(framework: ComplianceFramework) -> String {
    let dir = framework_dir(framework);
    format!(
        r#"package {pkg}.logging

import rego.v1

# Require CloudTrail with log file validation
deny contains msg if {{
    resource := input.planned_values.root_module.resources[_]
    resource.type == "aws_cloudtrail"
    resource.values.enable_log_file_validation != true
    msg := sprintf("{framework}: CloudTrail '%s' must have log file validation enabled", [resource.values.name])
}}

# Require multi-region CloudTrail
deny contains msg if {{
    resource := input.planned_values.root_module.resources[_]
    resource.type == "aws_cloudtrail"
    resource.values.is_multi_region_trail != true
    msg := sprintf("{framework}: CloudTrail '%s' must be multi-region", [resource.values.name])
}}

# Require log retention >= 365 days
deny contains msg if {{
    resource := input.planned_values.root_module.resources[_]
    resource.type == "aws_cloudwatch_log_group"
    resource.values.retention_in_days < 365
    msg := sprintf("{framework}: Log group '%s' retention must be >= 365 days (got %d)", [resource.values.name, resource.values.retention_in_days])
}}
"#,
        pkg = dir.replace('-', "_"),
        framework = framework,
    )
}

fn opa_network_policy(framework: ComplianceFramework) -> String {
    let dir = framework_dir(framework);
    format!(
        r#"package {pkg}.network

import rego.v1

# Deny security groups with unrestricted ingress (0.0.0.0/0)
deny contains msg if {{
    resource := input.planned_values.root_module.resources[_]
    resource.type == "aws_security_group"
    ingress := resource.values.ingress[_]
    ingress.cidr_blocks[_] == "0.0.0.0/0"
    msg := sprintf("{framework}: Security group '%s' must not allow unrestricted ingress (0.0.0.0/0)", [resource.values.name])
}}

# Require VPC flow logs
deny contains msg if {{
    vpc := input.planned_values.root_module.resources[_]
    vpc.type == "aws_vpc"
    not has_flow_log(vpc)
    msg := sprintf("{framework}: VPC '%s' must have flow logging enabled", [vpc.values.tags.Name])
}}

has_flow_log(vpc) if {{
    fl := input.planned_values.root_module.resources[_]
    fl.type == "aws_flow_log"
    fl.values.vpc_id == vpc.values.id
}}

# Deny public subnets in sensitive zones
deny contains msg if {{
    resource := input.planned_values.root_module.resources[_]
    resource.type == "aws_subnet"
    resource.values.map_public_ip_on_launch == true
    contains(resource.values.tags.zone, "cardholder")
    msg := sprintf("{framework}: Subnet in cardholder zone must not have public IP mapping", [])
}}
"#,
        pkg = dir.replace('-', "_"),
        framework = framework,
    )
}

fn opa_main_policy(framework: ComplianceFramework) -> String {
    let dir = framework_dir(framework);
    format!(
        r#"package {pkg}

import rego.v1

import data.{pkg}.encryption
import data.{pkg}.logging
import data.{pkg}.network

# Aggregate all deny messages from sub-policies
violations contains msg if {{
    msg := encryption.deny[_]
}}

violations contains msg if {{
    msg := logging.deny[_]
}}

violations contains msg if {{
    msg := network.deny[_]
}}

compliant if {{
    count(violations) == 0
}}

report := {{
    "framework": "{framework}",
    "compliant": compliant,
    "violation_count": count(violations),
    "violations": violations,
}}
"#,
        pkg = dir.replace('-', "_"),
        framework = framework,
    )
}
