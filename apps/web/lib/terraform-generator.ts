import type { Node, Edge } from "@xyflow/react"
import type { ServiceNode, CloudProvider } from "@/stores/infrastructure-store"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Sanitize a string into a valid Terraform identifier */
function tfId(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
}

function indent(text: string, spaces = 2): string {
  const pad = " ".repeat(spaces)
  return text
    .split("\n")
    .map((l) => (l.trim() ? pad + l : l))
    .join("\n")
}

function hclBlock(type: string, labels: string[], body: string): string {
  const labelStr = labels.map((l) => `"${l}"`).join(" ")
  return `${type} ${labelStr} {\n${indent(body)}\n}\n`
}

function hclValue(v: unknown): string {
  if (typeof v === "string") return `"${v}"`
  if (typeof v === "boolean") return v ? "true" : "false"
  if (typeof v === "number") return String(v)
  return `"${String(v)}"`
}

// ---------------------------------------------------------------------------
// Terraform resource mapping per provider
// ---------------------------------------------------------------------------

type ResourceMapping = {
  resourceType: string
  generator: (sn: ServiceNode, id: string) => string
}

// ---- AWS resource generators ----

const awsResourceMap: Record<string, ResourceMapping> = {
  EC2: {
    resourceType: "aws_instance",
    generator: (sn, id) => {
      const cfg = sn.config
      return hclBlock("resource", ["aws_instance", id], [
        `ami           = var.ec2_ami`,
        `instance_type = ${hclValue(cfg.instanceType ?? "t3.medium")}`,
        ``,
        `tags = {`,
        `  Name = ${hclValue(sn.label)}`,
        `}`,
      ].join("\n"))
    },
  },
  S3: {
    resourceType: "aws_s3_bucket",
    generator: (sn, id) => {
      const cfg = sn.config
      const lines = [
        `bucket = "${id}-bucket"`,
        ``,
        `tags = {`,
        `  Name = ${hclValue(sn.label)}`,
        `}`,
      ]
      let block = hclBlock("resource", ["aws_s3_bucket", id], lines.join("\n"))
      if (cfg.versioning) {
        block += "\n" + hclBlock("resource", ["aws_s3_bucket_versioning", `${id}_versioning`], [
          `bucket = aws_s3_bucket.${id}.id`,
          `versioning_configuration {`,
          `  status = "Enabled"`,
          `}`,
        ].join("\n"))
      }
      if (cfg.encryption) {
        block += "\n" + hclBlock("resource", ["aws_s3_bucket_server_side_encryption_configuration", `${id}_sse`], [
          `bucket = aws_s3_bucket.${id}.id`,
          `rule {`,
          `  apply_server_side_encryption_by_default {`,
          `    sse_algorithm = "aws:kms"`,
          `  }`,
          `}`,
        ].join("\n"))
      }
      return block
    },
  },
  RDS: {
    resourceType: "aws_db_instance",
    generator: (sn, id) => {
      const cfg = sn.config
      return hclBlock("resource", ["aws_db_instance", id], [
        `identifier           = "${id}"`,
        `engine               = ${hclValue(cfg.engine?.toLowerCase() ?? "postgres")}`,
        `engine_version       = ${hclValue(cfg.version ?? "16")}`,
        `instance_class       = ${hclValue(cfg.instanceClass ?? "db.r6g.large")}`,
        `allocated_storage    = ${cfg.storageGb ?? 100}`,
        `db_name              = "appdb"`,
        `username             = var.db_username`,
        `password             = var.db_password`,
        `multi_az             = ${cfg.multiAz ? "true" : "false"}`,
        `storage_encrypted    = ${cfg.encryption ? "true" : "false"}`,
        `skip_final_snapshot  = true`,
        ``,
        `tags = {`,
        `  Name = ${hclValue(sn.label)}`,
        `}`,
      ].join("\n"))
    },
  },
  VPC: {
    resourceType: "aws_vpc",
    generator: (sn, id) => {
      const cfg = sn.config
      return hclBlock("resource", ["aws_vpc", id], [
        `cidr_block           = ${hclValue(cfg.cidrBlock ?? "10.0.0.0/16")}`,
        `enable_dns_support   = true`,
        `enable_dns_hostnames = true`,
        ``,
        `tags = {`,
        `  Name = ${hclValue(sn.label)}`,
        `}`,
      ].join("\n"))
    },
  },
  ALB: {
    resourceType: "aws_lb",
    generator: (sn, id) => {
      const cfg = sn.config
      return hclBlock("resource", ["aws_lb", id], [
        `name               = "${id}"`,
        `internal           = ${cfg.scheme === "internal" ? "true" : "false"}`,
        `load_balancer_type = ${hclValue(cfg.type === "network" ? "network" : "application")}`,
        ``,
        `tags = {`,
        `  Name = ${hclValue(sn.label)}`,
        `}`,
      ].join("\n"))
    },
  },
  Lambda: {
    resourceType: "aws_lambda_function",
    generator: (sn, id) => {
      const cfg = sn.config
      return hclBlock("resource", ["aws_lambda_function", id], [
        `function_name = "${id}"`,
        `runtime       = ${hclValue(cfg.runtime ?? "nodejs20.x")}`,
        `handler       = "index.handler"`,
        `memory_size   = ${cfg.memory ?? 256}`,
        `timeout       = ${cfg.timeout ?? 30}`,
        `role          = aws_iam_role.${id}_role.arn`,
        `filename      = "lambda_placeholder.zip"`,
        ``,
        `tags = {`,
        `  Name = ${hclValue(sn.label)}`,
        `}`,
      ].join("\n")) + "\n" + hclBlock("resource", ["aws_iam_role", `${id}_role`], [
        `name = "${id}-role"`,
        ``,
        `assume_role_policy = jsonencode({`,
        `  Version = "2012-10-17"`,
        `  Statement = [{`,
        `    Action = "sts:AssumeRole"`,
        `    Effect = "Allow"`,
        `    Principal = {`,
        `      Service = "lambda.amazonaws.com"`,
        `    }`,
        `  }]`,
        `})`,
      ].join("\n"))
    },
  },
  EKS: {
    resourceType: "aws_eks_cluster",
    generator: (sn, id) => {
      const cfg = sn.config
      return hclBlock("resource", ["aws_eks_cluster", id], [
        `name     = "${id}"`,
        `version  = ${hclValue(cfg.version ?? "1.29")}`,
        `role_arn = aws_iam_role.${id}_role.arn`,
        ``,
        `vpc_config {`,
        `  subnet_ids = var.subnet_ids`,
        `}`,
        ``,
        `tags = {`,
        `  Name = ${hclValue(sn.label)}`,
        `}`,
      ].join("\n")) + "\n" + hclBlock("resource", ["aws_iam_role", `${id}_role`], [
        `name = "${id}-role"`,
        ``,
        `assume_role_policy = jsonencode({`,
        `  Version = "2012-10-17"`,
        `  Statement = [{`,
        `    Action = "sts:AssumeRole"`,
        `    Effect = "Allow"`,
        `    Principal = {`,
        `      Service = "eks.amazonaws.com"`,
        `    }`,
        `  }]`,
        `})`,
      ].join("\n"))
    },
  },
  ElastiCache: {
    resourceType: "aws_elasticache_cluster",
    generator: (sn, id) => {
      const cfg = sn.config
      return hclBlock("resource", ["aws_elasticache_cluster", id], [
        `cluster_id      = "${id}"`,
        `engine          = ${hclValue(cfg.engine?.toLowerCase() ?? "redis")}`,
        `node_type       = ${hclValue(cfg.nodeType ?? "cache.r6g.large")}`,
        `num_cache_nodes = ${cfg.numNodes ?? 1}`,
        ``,
        `tags = {`,
        `  Name = ${hclValue(sn.label)}`,
        `}`,
      ].join("\n"))
    },
  },
  CloudFront: {
    resourceType: "aws_cloudfront_distribution",
    generator: (sn, id) => {
      const cfg = sn.config
      return hclBlock("resource", ["aws_cloudfront_distribution", id], [
        `enabled         = true`,
        `price_class     = ${hclValue(cfg.priceClass ?? "PriceClass_100")}`,
        `is_ipv6_enabled = true`,
        ``,
        `default_cache_behavior {`,
        `  allowed_methods        = ["GET", "HEAD"]`,
        `  cached_methods         = ["GET", "HEAD"]`,
        `  target_origin_id       = "default"`,
        `  viewer_protocol_policy = "redirect-to-https"`,
        `  forwarded_values {`,
        `    query_string = false`,
        `    cookies {`,
        `      forward = "none"`,
        `    }`,
        `  }`,
        `}`,
        ``,
        `origin {`,
        `  domain_name = "placeholder.example.com"`,
        `  origin_id   = "default"`,
        `}`,
        ``,
        `restrictions {`,
        `  geo_restriction {`,
        `    restriction_type = "none"`,
        `  }`,
        `}`,
        ``,
        `viewer_certificate {`,
        `  cloudfront_default_certificate = true`,
        `}`,
        ``,
        `tags = {`,
        `  Name = ${hclValue(sn.label)}`,
        `}`,
      ].join("\n"))
    },
  },
  SNS: {
    resourceType: "aws_sns_topic",
    generator: (sn, id) => {
      const cfg = sn.config
      const lines = [
        `name      = "${id}"`,
        cfg.fifo ? `fifo_topic = true` : null,
        ``,
        `tags = {`,
        `  Name = ${hclValue(sn.label)}`,
        `}`,
      ].filter(Boolean) as string[]
      return hclBlock("resource", ["aws_sns_topic", id], lines.join("\n"))
    },
  },
  SQS: {
    resourceType: "aws_sqs_queue",
    generator: (sn, id) => {
      const cfg = sn.config
      const lines = [
        `name                       = "${id}${cfg.fifo ? ".fifo" : ""}"`,
        cfg.fifo ? `fifo_queue                 = true` : null,
        `visibility_timeout_seconds = ${cfg.visibilityTimeout ?? 30}`,
        ``,
        `tags = {`,
        `  Name = ${hclValue(sn.label)}`,
        `}`,
      ].filter(Boolean) as string[]
      return hclBlock("resource", ["aws_sqs_queue", id], lines.join("\n"))
    },
  },
  DynamoDB: {
    resourceType: "aws_dynamodb_table",
    generator: (sn, id) => {
      const cfg = sn.config
      return hclBlock("resource", ["aws_dynamodb_table", id], [
        `name         = "${id}"`,
        `billing_mode = ${hclValue(cfg.billingMode ?? "PAY_PER_REQUEST")}`,
        `hash_key     = "id"`,
        ``,
        `attribute {`,
        `  name = "id"`,
        `  type = "S"`,
        `}`,
        ``,
        cfg.encryption ? `server_side_encryption {\n  enabled = true\n}` : null,
        ``,
        `tags = {`,
        `  Name = ${hclValue(sn.label)}`,
        `}`,
      ].filter((l) => l !== null).join("\n"))
    },
  },
  ECS: {
    resourceType: "aws_ecs_cluster",
    generator: (sn, id) => {
      return hclBlock("resource", ["aws_ecs_cluster", id], [
        `name = "${id}"`,
        ``,
        `tags = {`,
        `  Name = ${hclValue(sn.label)}`,
        `}`,
      ].join("\n"))
    },
  },
  "API Gateway": {
    resourceType: "aws_api_gateway_rest_api",
    generator: (sn, id) => {
      const cfg = sn.config
      return hclBlock("resource", ["aws_api_gateway_rest_api", id], [
        `name        = "${id}"`,
        `description = ${hclValue(sn.label)}`,
        ``,
        `tags = {`,
        `  Name = ${hclValue(sn.label)}`,
        `}`,
      ].join("\n"))
    },
  },
  "Route 53": {
    resourceType: "aws_route53_zone",
    generator: (sn, id) => {
      return hclBlock("resource", ["aws_route53_zone", id], [
        `name = "example.com"`,
        ``,
        `tags = {`,
        `  Name = ${hclValue(sn.label)}`,
        `}`,
      ].join("\n"))
    },
  },
  CloudWatch: {
    resourceType: "aws_cloudwatch_dashboard",
    generator: (sn, id) => {
      return hclBlock("resource", ["aws_cloudwatch_dashboard", id], [
        `dashboard_name = "${id}"`,
        `dashboard_body = jsonencode({`,
        `  widgets = []`,
        `})`,
      ].join("\n"))
    },
  },
  WAF: {
    resourceType: "aws_wafv2_web_acl",
    generator: (sn, id) => {
      const cfg = sn.config
      return hclBlock("resource", ["aws_wafv2_web_acl", id], [
        `name  = "${id}"`,
        `scope = ${hclValue(cfg.scope ?? "REGIONAL")}`,
        ``,
        `default_action {`,
        `  allow {}`,
        `}`,
        ``,
        `visibility_config {`,
        `  cloudwatch_metrics_enabled = true`,
        `  metric_name                = "${id}"`,
        `  sampled_requests_enabled   = true`,
        `}`,
      ].join("\n"))
    },
  },
  IAM: {
    resourceType: "aws_iam_policy",
    generator: (sn, id) => {
      return hclBlock("resource", ["aws_iam_policy", id], [
        `name        = "${id}"`,
        `description = ${hclValue(sn.label)}`,
        ``,
        `policy = jsonencode({`,
        `  Version = "2012-10-17"`,
        `  Statement = [{`,
        `    Action   = ["*"]`,
        `    Effect   = "Allow"`,
        `    Resource = "*"`,
        `  }]`,
        `})`,
      ].join("\n"))
    },
  },
  KMS: {
    resourceType: "aws_kms_key",
    generator: (sn, id) => {
      const cfg = sn.config
      return hclBlock("resource", ["aws_kms_key", id], [
        `description              = ${hclValue(sn.label)}`,
        `customer_master_key_spec = ${hclValue(cfg.keySpec ?? "SYMMETRIC_DEFAULT")}`,
        ``,
        `tags = {`,
        `  Name = ${hclValue(sn.label)}`,
        `}`,
      ].join("\n"))
    },
  },
  "Secrets Manager": {
    resourceType: "aws_secretsmanager_secret",
    generator: (sn, id) => {
      return hclBlock("resource", ["aws_secretsmanager_secret", id], [
        `name = "${id}"`,
        ``,
        `tags = {`,
        `  Name = ${hclValue(sn.label)}`,
        `}`,
      ].join("\n"))
    },
  },
  SageMaker: {
    resourceType: "aws_sagemaker_notebook_instance",
    generator: (sn, id) => {
      const cfg = sn.config
      return hclBlock("resource", ["aws_sagemaker_notebook_instance", id], [
        `name          = "${id}"`,
        `instance_type = ${hclValue(cfg.instanceType ?? "ml.t3.medium")}`,
        `role_arn      = var.sagemaker_role_arn`,
        ``,
        `tags = {`,
        `  Name = ${hclValue(sn.label)}`,
        `}`,
      ].join("\n"))
    },
  },
  Bedrock: {
    resourceType: "aws_bedrock_custom_model",
    generator: (sn, id) => {
      return `# Bedrock (${sn.label}) - configured via AWS Console or SDK\n# Model: ${sn.config.model ?? "anthropic.claude-3"}\n`
    },
  },
  EFS: {
    resourceType: "aws_efs_file_system",
    generator: (sn, id) => {
      const cfg = sn.config
      return hclBlock("resource", ["aws_efs_file_system", id], [
        `performance_mode = ${hclValue(cfg.performanceMode ?? "generalPurpose")}`,
        `encrypted        = ${cfg.encryption ? "true" : "false"}`,
        ``,
        `tags = {`,
        `  Name = ${hclValue(sn.label)}`,
        `}`,
      ].join("\n"))
    },
  },
  EBS: {
    resourceType: "aws_ebs_volume",
    generator: (sn, id) => {
      const cfg = sn.config
      return hclBlock("resource", ["aws_ebs_volume", id], [
        `availability_zone = "us-east-1a"`,
        `size              = ${cfg.sizeGb ?? 100}`,
        `type              = ${hclValue(cfg.volumeType ?? "gp3")}`,
        ``,
        `tags = {`,
        `  Name = ${hclValue(sn.label)}`,
        `}`,
      ].join("\n"))
    },
  },
  Redshift: {
    resourceType: "aws_redshift_cluster",
    generator: (sn, id) => {
      const cfg = sn.config
      return hclBlock("resource", ["aws_redshift_cluster", id], [
        `cluster_identifier = "${id}"`,
        `node_type          = ${hclValue(cfg.nodeType ?? "ra3.xlplus")}`,
        `number_of_nodes    = ${cfg.numberOfNodes ?? 2}`,
        `database_name      = "datawarehouse"`,
        `master_username    = var.db_username`,
        `master_password    = var.db_password`,
        ``,
        `tags = {`,
        `  Name = ${hclValue(sn.label)}`,
        `}`,
      ].join("\n"))
    },
  },
}

// ---- GCP resource generators ----

const gcpResourceMap: Record<string, ResourceMapping> = {
  GCE: {
    resourceType: "google_compute_instance",
    generator: (sn, id) => {
      const cfg = sn.config
      return hclBlock("resource", ["google_compute_instance", id], [
        `name         = "${id}"`,
        `machine_type = ${hclValue(cfg.instanceType ?? "e2-medium")}`,
        `zone         = "${cfg.region ?? "us-central1"}-a"`,
        ``,
        `boot_disk {`,
        `  initialize_params {`,
        `    image = "debian-cloud/debian-12"`,
        `  }`,
        `}`,
        ``,
        `network_interface {`,
        `  network = "default"`,
        `  access_config {}`,
        `}`,
        ``,
        `labels = {`,
        `  name = ${hclValue(sn.label.toLowerCase().replace(/\s+/g, "-"))}`,
        `}`,
      ].join("\n"))
    },
  },
  GCS: {
    resourceType: "google_storage_bucket",
    generator: (sn, id) => {
      const cfg = sn.config
      return hclBlock("resource", ["google_storage_bucket", id], [
        `name          = "${id}-\${var.gcp_project_id}"`,
        `location      = "US"`,
        `storage_class = ${hclValue(cfg.storageClass ?? "STANDARD")}`,
        cfg.versioning ? `\nversioning {\n  enabled = true\n}` : "",
        cfg.encryption ? `\nencryption {\n  default_kms_key_name = var.kms_key_name\n}` : "",
        ``,
        `labels = {`,
        `  name = ${hclValue(sn.label.toLowerCase().replace(/\s+/g, "-"))}`,
        `}`,
      ].join("\n"))
    },
  },
  "Cloud SQL": {
    resourceType: "google_sql_database_instance",
    generator: (sn, id) => {
      const cfg = sn.config
      return hclBlock("resource", ["google_sql_database_instance", id], [
        `name             = "${id}"`,
        `database_version = "${(cfg.engine ?? "POSTGRES").toUpperCase()}_${cfg.version ?? "16"}"`,
        `region           = "us-central1"`,
        ``,
        `settings {`,
        `  tier              = ${hclValue(cfg.tier ?? "db-custom-2-8192")}`,
        `  disk_size         = ${cfg.storageGb ?? 100}`,
        `  availability_type = ${cfg.highAvailability ? '"REGIONAL"' : '"ZONAL"'}`,
        `}`,
        ``,
        `deletion_protection = false`,
      ].join("\n"))
    },
  },
  GKE: {
    resourceType: "google_container_cluster",
    generator: (sn, id) => {
      const cfg = sn.config
      return hclBlock("resource", ["google_container_cluster", id], [
        `name               = "${id}"`,
        `location           = "us-central1"`,
        `min_master_version = ${hclValue(cfg.version ?? "1.29")}`,
        `initial_node_count = ${cfg.nodeCount ?? 3}`,
        ``,
        `node_config {`,
        `  machine_type = ${hclValue(cfg.machineType ?? "e2-medium")}`,
        `}`,
      ].join("\n"))
    },
  },
  "Cloud LB": {
    resourceType: "google_compute_forwarding_rule",
    generator: (sn, id) => {
      return hclBlock("resource", ["google_compute_forwarding_rule", id], [
        `name       = "${id}"`,
        `target     = google_compute_target_http_proxy.${id}_proxy.self_link`,
        `port_range = "80"`,
      ].join("\n")) + "\n" + hclBlock("resource", ["google_compute_target_http_proxy", `${id}_proxy`], [
        `name    = "${id}-proxy"`,
        `url_map = google_compute_url_map.${id}_url_map.self_link`,
      ].join("\n")) + "\n" + hclBlock("resource", ["google_compute_url_map", `${id}_url_map`], [
        `name            = "${id}-url-map"`,
        `default_service = "placeholder"`,
      ].join("\n"))
    },
  },
  "Cloud Run": {
    resourceType: "google_cloud_run_v2_service",
    generator: (sn, id) => {
      const cfg = sn.config
      return hclBlock("resource", ["google_cloud_run_v2_service", id], [
        `name     = "${id}"`,
        `location = "us-central1"`,
        ``,
        `template {`,
        `  containers {`,
        `    image = "gcr.io/\${var.gcp_project_id}/placeholder:latest"`,
        `    resources {`,
        `      limits = {`,
        `        cpu    = "${cfg.cpu ?? 1}"`,
        `        memory = ${hclValue(cfg.memory ?? "512Mi")}`,
        `      }`,
        `    }`,
        `  }`,
        `  scaling {`,
        `    max_instance_count = ${cfg.maxInstances ?? 10}`,
        `  }`,
        `}`,
      ].join("\n"))
    },
  },
  "Cloud Functions": {
    resourceType: "google_cloudfunctions2_function",
    generator: (sn, id) => {
      const cfg = sn.config
      return hclBlock("resource", ["google_cloudfunctions2_function", id], [
        `name     = "${id}"`,
        `location = "us-central1"`,
        ``,
        `build_config {`,
        `  runtime     = ${hclValue(cfg.runtime ?? "nodejs20")}`,
        `  entry_point = "handler"`,
        `  source {`,
        `    storage_source {`,
        `      bucket = "placeholder-source-bucket"`,
        `      object = "placeholder.zip"`,
        `    }`,
        `  }`,
        `}`,
        ``,
        `service_config {`,
        `  available_memory   = "${cfg.memory ?? 256}M"`,
        `  timeout_seconds    = ${cfg.timeout ?? 60}`,
        `}`,
      ].join("\n"))
    },
  },
  "Pub/Sub": {
    resourceType: "google_pubsub_topic",
    generator: (sn, id) => {
      return hclBlock("resource", ["google_pubsub_topic", id], [
        `name = "${id}"`,
        ``,
        `labels = {`,
        `  name = ${hclValue(sn.label.toLowerCase().replace(/\s+/g, "-"))}`,
        `}`,
      ].join("\n"))
    },
  },
  "Cloud CDN": {
    resourceType: "google_compute_backend_bucket",
    generator: (sn, id) => {
      return hclBlock("resource", ["google_compute_backend_bucket", id], [
        `name        = "${id}"`,
        `bucket_name = "placeholder-bucket"`,
        `enable_cdn  = true`,
      ].join("\n"))
    },
  },
  "Cloud DNS": {
    resourceType: "google_dns_managed_zone",
    generator: (sn, id) => {
      return hclBlock("resource", ["google_dns_managed_zone", id], [
        `name     = "${id}"`,
        `dns_name = "example.com."`,
      ].join("\n"))
    },
  },
  Memorystore: {
    resourceType: "google_redis_instance",
    generator: (sn, id) => {
      const cfg = sn.config
      return hclBlock("resource", ["google_redis_instance", id], [
        `name           = "${id}"`,
        `tier           = ${hclValue(cfg.tier ?? "BASIC")}`,
        `memory_size_gb = ${cfg.memorySizeGb ?? 1}`,
        `region         = "us-central1"`,
      ].join("\n"))
    },
  },
  Firestore: {
    resourceType: "google_firestore_database",
    generator: (sn, id) => {
      return hclBlock("resource", ["google_firestore_database", id], [
        `name        = "${id}"`,
        `location_id = "us-central1"`,
        `type        = "FIRESTORE_NATIVE"`,
      ].join("\n"))
    },
  },
  BigQuery: {
    resourceType: "google_bigquery_dataset",
    generator: (sn, id) => {
      return hclBlock("resource", ["google_bigquery_dataset", id], [
        `dataset_id = "${id}"`,
        `location   = "US"`,
        ``,
        `labels = {`,
        `  name = ${hclValue(sn.label.toLowerCase().replace(/\s+/g, "-"))}`,
        `}`,
      ].join("\n"))
    },
  },
  Filestore: {
    resourceType: "google_filestore_instance",
    generator: (sn, id) => {
      const cfg = sn.config
      return hclBlock("resource", ["google_filestore_instance", id], [
        `name     = "${id}"`,
        `location = "us-central1-a"`,
        `tier     = ${hclValue(cfg.tier ?? "BASIC_HDD")}`,
        ``,
        `file_shares {`,
        `  name       = "share"`,
        `  capacity_gb = ${cfg.capacityGb ?? 1024}`,
        `}`,
        ``,
        `networks {`,
        `  network = "default"`,
        `  modes   = ["MODE_IPV4"]`,
        `}`,
      ].join("\n"))
    },
  },
  "Persistent Disk": {
    resourceType: "google_compute_disk",
    generator: (sn, id) => {
      const cfg = sn.config
      return hclBlock("resource", ["google_compute_disk", id], [
        `name = "${id}"`,
        `type = ${hclValue(cfg.type ?? "pd-balanced")}`,
        `size = ${cfg.sizeGb ?? 100}`,
        `zone = "us-central1-a"`,
      ].join("\n"))
    },
  },
  "Cloud Monitoring": {
    resourceType: "google_monitoring_dashboard",
    generator: (sn, id) => {
      return `# Cloud Monitoring dashboard (${sn.label}) - configured via GCP Console\n`
    },
  },
  "Vertex AI": {
    resourceType: "google_vertex_ai_endpoint",
    generator: (sn, id) => {
      return hclBlock("resource", ["google_vertex_ai_endpoint", id], [
        `name         = "${id}"`,
        `display_name = ${hclValue(sn.label)}`,
        `location     = "us-central1"`,
      ].join("\n"))
    },
  },
  Apigee: {
    resourceType: "google_apigee_organization",
    generator: (sn, id) => {
      return `# Apigee (${sn.label}) - requires organization setup via GCP Console\n`
    },
  },
}

// ---- Azure resource generators ----

const azureResourceMap: Record<string, ResourceMapping> = {
  "Azure VM": {
    resourceType: "azurerm_linux_virtual_machine",
    generator: (sn, id) => {
      const cfg = sn.config
      return hclBlock("resource", ["azurerm_linux_virtual_machine", id], [
        `name                = "${id}"`,
        `resource_group_name = azurerm_resource_group.main.name`,
        `location            = azurerm_resource_group.main.location`,
        `size                = ${hclValue(cfg.instanceType ?? "Standard_B2s")}`,
        `admin_username      = "adminuser"`,
        ``,
        `admin_ssh_key {`,
        `  username   = "adminuser"`,
        `  public_key = var.ssh_public_key`,
        `}`,
        ``,
        `os_disk {`,
        `  caching              = "ReadWrite"`,
        `  storage_account_type = "Standard_LRS"`,
        `}`,
        ``,
        `source_image_reference {`,
        `  publisher = "Canonical"`,
        `  offer     = "0001-com-ubuntu-server-jammy"`,
        `  sku       = "22_04-lts"`,
        `  version   = "latest"`,
        `}`,
        ``,
        `network_interface_ids = []`,
        ``,
        `tags = {`,
        `  Name = ${hclValue(sn.label)}`,
        `}`,
      ].join("\n"))
    },
  },
  "Blob Storage": {
    resourceType: "azurerm_storage_account",
    generator: (sn, id) => {
      const cfg = sn.config
      return hclBlock("resource", ["azurerm_storage_account", id], [
        `name                     = "${id.replace(/_/g, "").slice(0, 24)}"`,
        `resource_group_name      = azurerm_resource_group.main.name`,
        `location                 = azurerm_resource_group.main.location`,
        `account_tier             = "Standard"`,
        `account_replication_type = "LRS"`,
        ``,
        `tags = {`,
        `  Name = ${hclValue(sn.label)}`,
        `}`,
      ].join("\n"))
    },
  },
  "Azure SQL": {
    resourceType: "azurerm_mssql_server",
    generator: (sn, id) => {
      const cfg = sn.config
      return hclBlock("resource", ["azurerm_mssql_server", `${id}_server`], [
        `name                         = "${id}-server"`,
        `resource_group_name          = azurerm_resource_group.main.name`,
        `location                     = azurerm_resource_group.main.location`,
        `version                      = "12.0"`,
        `administrator_login          = var.db_username`,
        `administrator_login_password = var.db_password`,
        ``,
        `tags = {`,
        `  Name = ${hclValue(sn.label)}`,
        `}`,
      ].join("\n")) + "\n" + hclBlock("resource", ["azurerm_mssql_database", id], [
        `name      = "${id}"`,
        `server_id = azurerm_mssql_server.${id}_server.id`,
        `sku_name  = "GP_Gen5_2"`,
        ``,
        `tags = {`,
        `  Name = ${hclValue(sn.label)}`,
        `}`,
      ].join("\n"))
    },
  },
  VNet: {
    resourceType: "azurerm_virtual_network",
    generator: (sn, id) => {
      const cfg = sn.config
      return hclBlock("resource", ["azurerm_virtual_network", id], [
        `name                = "${id}"`,
        `resource_group_name = azurerm_resource_group.main.name`,
        `location            = azurerm_resource_group.main.location`,
        `address_space       = [${hclValue(cfg.cidrBlock ?? "10.0.0.0/16")}]`,
        ``,
        `tags = {`,
        `  Name = ${hclValue(sn.label)}`,
        `}`,
      ].join("\n"))
    },
  },
  "Azure LB": {
    resourceType: "azurerm_lb",
    generator: (sn, id) => {
      const cfg = sn.config
      return hclBlock("resource", ["azurerm_lb", id], [
        `name                = "${id}"`,
        `resource_group_name = azurerm_resource_group.main.name`,
        `location            = azurerm_resource_group.main.location`,
        `sku                 = ${hclValue(cfg.sku ?? "Standard")}`,
        ``,
        `tags = {`,
        `  Name = ${hclValue(sn.label)}`,
        `}`,
      ].join("\n"))
    },
  },
  "Azure Functions": {
    resourceType: "azurerm_linux_function_app",
    generator: (sn, id) => {
      const cfg = sn.config
      return hclBlock("resource", ["azurerm_linux_function_app", id], [
        `name                = "${id}"`,
        `resource_group_name = azurerm_resource_group.main.name`,
        `location            = azurerm_resource_group.main.location`,
        `service_plan_id     = var.service_plan_id`,
        ``,
        `storage_account_name       = var.storage_account_name`,
        `storage_account_access_key = var.storage_account_access_key`,
        ``,
        `site_config {}`,
        ``,
        `tags = {`,
        `  Name = ${hclValue(sn.label)}`,
        `}`,
      ].join("\n"))
    },
  },
  "Container Apps": {
    resourceType: "azurerm_container_app",
    generator: (sn, id) => {
      const cfg = sn.config
      return hclBlock("resource", ["azurerm_container_app", id], [
        `name                         = "${id}"`,
        `resource_group_name          = azurerm_resource_group.main.name`,
        `container_app_environment_id = var.container_app_env_id`,
        `revision_mode                = "Single"`,
        ``,
        `template {`,
        `  container {`,
        `    name   = "${id}"`,
        `    image  = "mcr.microsoft.com/azuredocs/containerapps-helloworld:latest"`,
        `    cpu    = ${cfg.cpu ?? 0.5}`,
        `    memory = ${hclValue(cfg.memory ?? "1Gi")}`,
        `  }`,
        `  max_replicas = ${cfg.maxReplicas ?? 10}`,
        `}`,
        ``,
        `tags = {`,
        `  Name = ${hclValue(sn.label)}`,
        `}`,
      ].join("\n"))
    },
  },
  AKS: {
    resourceType: "azurerm_kubernetes_cluster",
    generator: (sn, id) => {
      const cfg = sn.config
      return hclBlock("resource", ["azurerm_kubernetes_cluster", id], [
        `name                = "${id}"`,
        `resource_group_name = azurerm_resource_group.main.name`,
        `location            = azurerm_resource_group.main.location`,
        `dns_prefix          = "${id}"`,
        `kubernetes_version  = ${hclValue(cfg.version ?? "1.29")}`,
        ``,
        `default_node_pool {`,
        `  name       = "default"`,
        `  node_count = ${cfg.nodeCount ?? 3}`,
        `  vm_size    = ${hclValue(cfg.vmSize ?? "Standard_B2s")}`,
        `}`,
        ``,
        `identity {`,
        `  type = "SystemAssigned"`,
        `}`,
        ``,
        `tags = {`,
        `  Name = ${hclValue(sn.label)}`,
        `}`,
      ].join("\n"))
    },
  },
  CosmosDB: {
    resourceType: "azurerm_cosmosdb_account",
    generator: (sn, id) => {
      const cfg = sn.config
      return hclBlock("resource", ["azurerm_cosmosdb_account", id], [
        `name                = "${id}"`,
        `resource_group_name = azurerm_resource_group.main.name`,
        `location            = azurerm_resource_group.main.location`,
        `offer_type          = "Standard"`,
        `kind                = "GlobalDocumentDB"`,
        ``,
        `consistency_policy {`,
        `  consistency_level = "Session"`,
        `}`,
        ``,
        `geo_location {`,
        `  location          = azurerm_resource_group.main.location`,
        `  failover_priority = 0`,
        `}`,
        ``,
        `tags = {`,
        `  Name = ${hclValue(sn.label)}`,
        `}`,
      ].join("\n"))
    },
  },
  "Azure Cache": {
    resourceType: "azurerm_redis_cache",
    generator: (sn, id) => {
      const cfg = sn.config
      return hclBlock("resource", ["azurerm_redis_cache", id], [
        `name                = "${id}"`,
        `resource_group_name = azurerm_resource_group.main.name`,
        `location            = azurerm_resource_group.main.location`,
        `capacity            = ${cfg.capacity ?? 1}`,
        `family              = ${hclValue(cfg.family ?? "C")}`,
        `sku_name            = ${hclValue(cfg.sku ?? "Standard")}`,
        ``,
        `tags = {`,
        `  Name = ${hclValue(sn.label)}`,
        `}`,
      ].join("\n"))
    },
  },
  "Front Door": {
    resourceType: "azurerm_cdn_frontdoor_profile",
    generator: (sn, id) => {
      const cfg = sn.config
      return hclBlock("resource", ["azurerm_cdn_frontdoor_profile", id], [
        `name                = "${id}"`,
        `resource_group_name = azurerm_resource_group.main.name`,
        `sku_name            = "Standard_AzureFrontDoor"`,
        ``,
        `tags = {`,
        `  Name = ${hclValue(sn.label)}`,
        `}`,
      ].join("\n"))
    },
  },
  "Azure DNS": {
    resourceType: "azurerm_dns_zone",
    generator: (sn, id) => {
      return hclBlock("resource", ["azurerm_dns_zone", id], [
        `name                = "example.com"`,
        `resource_group_name = azurerm_resource_group.main.name`,
        ``,
        `tags = {`,
        `  Name = ${hclValue(sn.label)}`,
        `}`,
      ].join("\n"))
    },
  },
  APIM: {
    resourceType: "azurerm_api_management",
    generator: (sn, id) => {
      const cfg = sn.config
      return hclBlock("resource", ["azurerm_api_management", id], [
        `name                = "${id}"`,
        `resource_group_name = azurerm_resource_group.main.name`,
        `location            = azurerm_resource_group.main.location`,
        `publisher_name      = "My Company"`,
        `publisher_email     = "admin@example.com"`,
        `sku_name            = "${cfg.sku ?? "Developer"}_1"`,
        ``,
        `tags = {`,
        `  Name = ${hclValue(sn.label)}`,
        `}`,
      ].join("\n"))
    },
  },
  "Service Bus": {
    resourceType: "azurerm_servicebus_namespace",
    generator: (sn, id) => {
      const cfg = sn.config
      return hclBlock("resource", ["azurerm_servicebus_namespace", id], [
        `name                = "${id}"`,
        `resource_group_name = azurerm_resource_group.main.name`,
        `location            = azurerm_resource_group.main.location`,
        `sku                 = ${hclValue(cfg.tier ?? "Standard")}`,
        ``,
        `tags = {`,
        `  Name = ${hclValue(sn.label)}`,
        `}`,
      ].join("\n"))
    },
  },
  "Event Grid": {
    resourceType: "azurerm_eventgrid_topic",
    generator: (sn, id) => {
      return hclBlock("resource", ["azurerm_eventgrid_topic", id], [
        `name                = "${id}"`,
        `resource_group_name = azurerm_resource_group.main.name`,
        `location            = azurerm_resource_group.main.location`,
        ``,
        `tags = {`,
        `  Name = ${hclValue(sn.label)}`,
        `}`,
      ].join("\n"))
    },
  },
  "Azure Files": {
    resourceType: "azurerm_storage_share",
    generator: (sn, id) => {
      const cfg = sn.config
      return hclBlock("resource", ["azurerm_storage_share", id], [
        `name                 = "${id}"`,
        `storage_account_name = var.storage_account_name`,
        `quota                = ${cfg.sizeGb ?? 100}`,
      ].join("\n"))
    },
  },
  "Managed Disk": {
    resourceType: "azurerm_managed_disk",
    generator: (sn, id) => {
      const cfg = sn.config
      return hclBlock("resource", ["azurerm_managed_disk", id], [
        `name                 = "${id}"`,
        `resource_group_name  = azurerm_resource_group.main.name`,
        `location             = azurerm_resource_group.main.location`,
        `storage_account_type = ${hclValue(cfg.sku ?? "Premium_LRS")}`,
        `disk_size_gb         = ${cfg.sizeGb ?? 128}`,
        `create_option        = "Empty"`,
        ``,
        `tags = {`,
        `  Name = ${hclValue(sn.label)}`,
        `}`,
      ].join("\n"))
    },
  },
  "Azure ML": {
    resourceType: "azurerm_machine_learning_workspace",
    generator: (sn, id) => {
      return hclBlock("resource", ["azurerm_machine_learning_workspace", id], [
        `name                    = "${id}"`,
        `resource_group_name     = azurerm_resource_group.main.name`,
        `location                = azurerm_resource_group.main.location`,
        `application_insights_id = var.app_insights_id`,
        `key_vault_id            = var.key_vault_id`,
        `storage_account_id      = var.storage_account_id`,
        ``,
        `identity {`,
        `  type = "SystemAssigned"`,
        `}`,
        ``,
        `tags = {`,
        `  Name = ${hclValue(sn.label)}`,
        `}`,
      ].join("\n"))
    },
  },
  "Azure OpenAI": {
    resourceType: "azurerm_cognitive_account",
    generator: (sn, id) => {
      return hclBlock("resource", ["azurerm_cognitive_account", id], [
        `name                = "${id}"`,
        `resource_group_name = azurerm_resource_group.main.name`,
        `location            = azurerm_resource_group.main.location`,
        `kind                = "OpenAI"`,
        `sku_name            = "S0"`,
        ``,
        `tags = {`,
        `  Name = ${hclValue(sn.label)}`,
        `}`,
      ].join("\n"))
    },
  },
  "Azure Monitor": {
    resourceType: "azurerm_log_analytics_workspace",
    generator: (sn, id) => {
      return hclBlock("resource", ["azurerm_log_analytics_workspace", id], [
        `name                = "${id}"`,
        `resource_group_name = azurerm_resource_group.main.name`,
        `location            = azurerm_resource_group.main.location`,
        `sku                 = "PerGB2018"`,
        ``,
        `tags = {`,
        `  Name = ${hclValue(sn.label)}`,
        `}`,
      ].join("\n"))
    },
  },
  Synapse: {
    resourceType: "azurerm_synapse_workspace",
    generator: (sn, id) => {
      return hclBlock("resource", ["azurerm_synapse_workspace", id], [
        `name                                 = "${id}"`,
        `resource_group_name                  = azurerm_resource_group.main.name`,
        `location                             = azurerm_resource_group.main.location`,
        `storage_data_lake_gen2_filesystem_id = var.adls_filesystem_id`,
        `sql_administrator_login              = var.db_username`,
        `sql_administrator_login_password     = var.db_password`,
        ``,
        `identity {`,
        `  type = "SystemAssigned"`,
        `}`,
        ``,
        `tags = {`,
        `  Name = ${hclValue(sn.label)}`,
        `}`,
      ].join("\n"))
    },
  },
}

// ---------------------------------------------------------------------------
// Provider map selector
// ---------------------------------------------------------------------------

function getResourceMap(provider: CloudProvider): Record<string, ResourceMapping> {
  switch (provider) {
    case "aws":
      return awsResourceMap
    case "gcp":
      return gcpResourceMap
    case "azure":
      return azureResourceMap
    default:
      return { ...awsResourceMap, ...gcpResourceMap, ...azureResourceMap }
  }
}

// ---------------------------------------------------------------------------
// Extract ServiceNode from ReactFlow Node
// ---------------------------------------------------------------------------

function extractServiceNode(node: Node): ServiceNode | null {
  return (node.data as any)?.serviceNode ?? null
}

// ---------------------------------------------------------------------------
// Provider block generation
// ---------------------------------------------------------------------------

function generateProviderBlock(provider: CloudProvider, region?: string): string {
  switch (provider) {
    case "aws":
      return [
        `terraform {`,
        `  required_version = ">= 1.0"`,
        ``,
        `  required_providers {`,
        `    aws = {`,
        `      source  = "hashicorp/aws"`,
        `      version = "~> 5.0"`,
        `    }`,
        `  }`,
        `}`,
        ``,
        `provider "aws" {`,
        `  region = var.aws_region`,
        `}`,
      ].join("\n")

    case "gcp":
      return [
        `terraform {`,
        `  required_version = ">= 1.0"`,
        ``,
        `  required_providers {`,
        `    google = {`,
        `      source  = "hashicorp/google"`,
        `      version = "~> 5.0"`,
        `    }`,
        `  }`,
        `}`,
        ``,
        `provider "google" {`,
        `  project = var.gcp_project_id`,
        `  region  = var.gcp_region`,
        `}`,
      ].join("\n")

    case "azure":
      return [
        `terraform {`,
        `  required_version = ">= 1.0"`,
        ``,
        `  required_providers {`,
        `    azurerm = {`,
        `      source  = "hashicorp/azurerm"`,
        `      version = "~> 3.0"`,
        `    }`,
        `  }`,
        `}`,
        ``,
        `provider "azurerm" {`,
        `  features {}`,
        `}`,
        ``,
        `resource "azurerm_resource_group" "main" {`,
        `  name     = var.resource_group_name`,
        `  location = var.azure_location`,
        `}`,
      ].join("\n")

    case "multi": {
      const parts: string[] = []
      parts.push(`terraform {`)
      parts.push(`  required_version = ">= 1.0"`)
      parts.push(``)
      parts.push(`  required_providers {`)
      parts.push(`    aws = {`)
      parts.push(`      source  = "hashicorp/aws"`)
      parts.push(`      version = "~> 5.0"`)
      parts.push(`    }`)
      parts.push(`    google = {`)
      parts.push(`      source  = "hashicorp/google"`)
      parts.push(`      version = "~> 5.0"`)
      parts.push(`    }`)
      parts.push(`    azurerm = {`)
      parts.push(`      source  = "hashicorp/azurerm"`)
      parts.push(`      version = "~> 3.0"`)
      parts.push(`    }`)
      parts.push(`  }`)
      parts.push(`}`)
      parts.push(``)
      parts.push(`provider "aws" {`)
      parts.push(`  region = var.aws_region`)
      parts.push(`}`)
      parts.push(``)
      parts.push(`provider "google" {`)
      parts.push(`  project = var.gcp_project_id`)
      parts.push(`  region  = var.gcp_region`)
      parts.push(`}`)
      parts.push(``)
      parts.push(`provider "azurerm" {`)
      parts.push(`  features {}`)
      parts.push(`}`)
      parts.push(``)
      parts.push(`resource "azurerm_resource_group" "main" {`)
      parts.push(`  name     = var.resource_group_name`)
      parts.push(`  location = var.azure_location`)
      parts.push(`}`)
      return parts.join("\n")
    }
  }
}

// ---------------------------------------------------------------------------
// Variables block generation
// ---------------------------------------------------------------------------

function generateVariablesBlock(
  provider: CloudProvider,
  nodes: Node[],
): string {
  const lines: string[] = []
  const seen = new Set<string>()

  function addVar(name: string, description: string, defaultVal?: string, type = "string") {
    if (seen.has(name)) return
    seen.add(name)
    lines.push(`variable "${name}" {`)
    lines.push(`  description = "${description}"`)
    lines.push(`  type        = ${type}`)
    if (defaultVal !== undefined) {
      lines.push(`  default     = ${defaultVal}`)
    }
    lines.push(`}\n`)
  }

  // Provider-specific variables
  if (provider === "aws" || provider === "multi") {
    addVar("aws_region", "AWS region", `"us-east-1"`)
  }
  if (provider === "gcp" || provider === "multi") {
    addVar("gcp_project_id", "GCP project ID")
    addVar("gcp_region", "GCP region", `"us-central1"`)
  }
  if (provider === "azure" || provider === "multi") {
    addVar("resource_group_name", "Azure resource group name", `"infra-designer-rg"`)
    addVar("azure_location", "Azure region", `"eastus"`)
  }

  // Service-specific variables
  const serviceNodes = nodes
    .map(extractServiceNode)
    .filter((sn): sn is ServiceNode => sn !== null)

  const serviceNames = new Set(serviceNodes.map((sn) => sn.serviceName))

  if (serviceNames.has("EC2")) {
    addVar("ec2_ami", "AMI ID for EC2 instances", `"ami-0c55b159cbfafe1f0"`)
  }
  if (
    serviceNames.has("RDS") ||
    serviceNames.has("Azure SQL") ||
    serviceNames.has("Redshift") ||
    serviceNames.has("Synapse")
  ) {
    addVar("db_username", "Database master username", `"dbadmin"`)
    addVar("db_password", "Database master password", undefined)
    lines.push("")
  }
  if (serviceNames.has("EKS")) {
    addVar("subnet_ids", "Subnet IDs for EKS", `[]`, "list(string)")
  }
  if (serviceNames.has("Azure VM")) {
    addVar("ssh_public_key", "SSH public key for Azure VMs")
  }
  if (serviceNames.has("SageMaker")) {
    addVar("sagemaker_role_arn", "IAM role ARN for SageMaker")
  }
  if (serviceNames.has("Azure Functions")) {
    addVar("service_plan_id", "Azure service plan ID for Functions")
    addVar("storage_account_name", "Storage account for Azure Functions")
    addVar("storage_account_access_key", "Storage account access key")
  }
  if (serviceNames.has("Azure ML")) {
    addVar("app_insights_id", "Application Insights ID")
    addVar("key_vault_id", "Key Vault ID")
    addVar("storage_account_id", "Storage Account ID for ML workspace")
  }
  if (serviceNames.has("Synapse")) {
    addVar("adls_filesystem_id", "ADLS Gen2 filesystem ID for Synapse")
  }
  if (serviceNames.has("GCS") && serviceNodes.some((sn) => sn.serviceName === "GCS" && sn.config.encryption)) {
    addVar("kms_key_name", "KMS key name for GCS encryption")
  }

  addVar("environment", "Environment name", `"production"`)
  addVar("project_name", "Project name for tagging", `"infra-designer"`)

  return lines.join("\n")
}

// ---------------------------------------------------------------------------
// Outputs block generation
// ---------------------------------------------------------------------------

function generateOutputsBlock(
  provider: CloudProvider,
  nodes: Node[],
): string {
  const lines: string[] = []
  const serviceNodes = nodes
    .map(extractServiceNode)
    .filter((sn): sn is ServiceNode => sn !== null)

  for (const sn of serviceNodes) {
    const id = tfId(sn.id)
    const resMap = getResourceMap(sn.provider)
    const mapping = resMap[sn.serviceName]
    if (!mapping) continue

    const rt = mapping.resourceType

    switch (sn.serviceName) {
      case "EC2":
        lines.push(hclBlock("output", [`${id}_public_ip`], [
          `description = "Public IP of ${sn.label}"`,
          `value       = ${rt}.${id}.public_ip`,
        ].join("\n")))
        break
      case "S3":
        lines.push(hclBlock("output", [`${id}_bucket_arn`], [
          `description = "ARN of ${sn.label} bucket"`,
          `value       = ${rt}.${id}.arn`,
        ].join("\n")))
        break
      case "RDS":
        lines.push(hclBlock("output", [`${id}_endpoint`], [
          `description = "Endpoint of ${sn.label}"`,
          `value       = ${rt}.${id}.endpoint`,
        ].join("\n")))
        break
      case "ALB":
      case "Cloud LB":
      case "Azure LB":
        lines.push(hclBlock("output", [`${id}_dns_name`], [
          `description = "DNS name of ${sn.label}"`,
          `value       = ${rt}.${id}.dns_name`,
        ].join("\n")))
        break
      case "EKS":
        lines.push(hclBlock("output", [`${id}_endpoint`], [
          `description = "Endpoint of ${sn.label}"`,
          `value       = ${rt}.${id}.endpoint`,
        ].join("\n")))
        break
      case "GKE":
        lines.push(hclBlock("output", [`${id}_endpoint`], [
          `description = "Endpoint of ${sn.label}"`,
          `value       = ${rt}.${id}.endpoint`,
        ].join("\n")))
        break
      case "AKS":
        lines.push(hclBlock("output", [`${id}_kube_config`], [
          `description = "Kube config of ${sn.label}"`,
          `value       = ${rt}.${id}.kube_config_raw`,
          `sensitive   = true`,
        ].join("\n")))
        break
      case "Lambda":
        lines.push(hclBlock("output", [`${id}_arn`], [
          `description = "ARN of ${sn.label}"`,
          `value       = ${rt}.${id}.arn`,
        ].join("\n")))
        break
      case "VPC":
        lines.push(hclBlock("output", [`${id}_id`], [
          `description = "ID of ${sn.label}"`,
          `value       = ${rt}.${id}.id`,
        ].join("\n")))
        break
      default:
        // Generic output
        break
    }
  }

  if (lines.length === 0) {
    lines.push(`# No outputs generated - add resources to see outputs here\n`)
  }

  return lines.join("\n")
}

// ---------------------------------------------------------------------------
// Security group / connection generation from edges
// ---------------------------------------------------------------------------

function generateConnectionResources(
  nodes: Node[],
  edges: Edge[],
  provider: CloudProvider,
): string {
  if (edges.length === 0) return ""

  const lines: string[] = [
    `# ---------------------------------------------------------------`,
    `# Connection / Security Group Rules (derived from canvas edges)`,
    `# ---------------------------------------------------------------`,
    ``,
  ]

  // For AWS: generate security group + rules
  if (provider === "aws" || provider === "multi") {
    const awsEdges = edges.filter((e) => {
      const srcNode = nodes.find((n) => n.id === e.source)
      const sn = srcNode ? extractServiceNode(srcNode) : null
      return sn?.provider === "aws" || provider === "aws"
    })

    if (awsEdges.length > 0) {
      lines.push(hclBlock("resource", ["aws_security_group", "infra_designer_sg"], [
        `name        = "infra-designer-sg"`,
        `description = "Security group for infrastructure designer resources"`,
        ``,
        `tags = {`,
        `  Name = "infra-designer-sg"`,
        `}`,
      ].join("\n")))

      for (const edge of awsEdges) {
        const edgeData = edge.data as any
        const port = edgeData?.port ?? 443
        const protocol = edgeData?.protocol ?? "TCP"
        const ruleId = tfId(edge.id)

        lines.push(hclBlock("resource", ["aws_security_group_rule", ruleId], [
          `type              = "ingress"`,
          `from_port         = ${port}`,
          `to_port           = ${port}`,
          `protocol          = "tcp"`,
          `cidr_blocks       = ["0.0.0.0/0"]`,
          `security_group_id = aws_security_group.infra_designer_sg.id`,
          `description       = "${protocol} from ${edge.source} to ${edge.target}"`,
        ].join("\n")))
      }
    }
  }

  // For GCP: generate firewall rules
  if (provider === "gcp" || provider === "multi") {
    const gcpEdges = edges.filter((e) => {
      const srcNode = nodes.find((n) => n.id === e.source)
      const sn = srcNode ? extractServiceNode(srcNode) : null
      return sn?.provider === "gcp" || (provider === "gcp" && !sn)
    })

    for (const edge of gcpEdges) {
      const edgeData = edge.data as any
      const port = edgeData?.port ?? 443
      const ruleId = tfId(edge.id)

      lines.push(hclBlock("resource", ["google_compute_firewall", ruleId], [
        `name    = "${ruleId}"`,
        `network = "default"`,
        ``,
        `allow {`,
        `  protocol = "tcp"`,
        `  ports    = ["${port}"]`,
        `}`,
        ``,
        `source_ranges = ["0.0.0.0/0"]`,
        `description   = "Allow traffic from ${edge.source} to ${edge.target}"`,
      ].join("\n")))
    }
  }

  // For Azure: generate NSG rules
  if (provider === "azure" || provider === "multi") {
    const azureEdges = edges.filter((e) => {
      const srcNode = nodes.find((n) => n.id === e.source)
      const sn = srcNode ? extractServiceNode(srcNode) : null
      return sn?.provider === "azure" || (provider === "azure" && !sn)
    })

    if (azureEdges.length > 0) {
      lines.push(hclBlock("resource", ["azurerm_network_security_group", "infra_designer_nsg"], [
        `name                = "infra-designer-nsg"`,
        `resource_group_name = azurerm_resource_group.main.name`,
        `location            = azurerm_resource_group.main.location`,
        ``,
        `tags = {`,
        `  Name = "infra-designer-nsg"`,
        `}`,
      ].join("\n")))

      azureEdges.forEach((edge, idx) => {
        const edgeData = edge.data as any
        const port = edgeData?.port ?? 443
        const ruleId = tfId(edge.id)

        lines.push(hclBlock("resource", ["azurerm_network_security_rule", ruleId], [
          `name                        = "${ruleId}"`,
          `priority                    = ${100 + idx}`,
          `direction                   = "Inbound"`,
          `access                      = "Allow"`,
          `protocol                    = "Tcp"`,
          `source_port_range           = "*"`,
          `destination_port_range      = "${port}"`,
          `source_address_prefix       = "*"`,
          `destination_address_prefix  = "*"`,
          `resource_group_name         = azurerm_resource_group.main.name`,
          `network_security_group_name = azurerm_network_security_group.infra_designer_nsg.name`,
        ].join("\n")))
      })
    }
  }

  return lines.join("\n")
}

// ---------------------------------------------------------------------------
// Main generation entry point
// ---------------------------------------------------------------------------

export type TerraformFiles = {
  "providers.tf": string
  "main.tf": string
  "variables.tf": string
  "outputs.tf": string
}

export function generateTerraform(
  nodes: Node[],
  edges: Edge[],
  provider: CloudProvider,
  projectName?: string,
): TerraformFiles {
  // Determine effective provider from nodes if multi
  const providers = new Set(
    nodes
      .map(extractServiceNode)
      .filter((sn): sn is ServiceNode => sn !== null)
      .map((sn) => sn.provider),
  )
  const effectiveProvider =
    provider === "multi" || providers.size > 1 ? "multi" : provider

  // --- providers.tf ---
  const providersTf = [
    `# =============================================================`,
    `# Terraform Configuration - ${projectName ?? "Infrastructure Designer"}`,
    `# Generated by Cloud Manager Infrastructure Designer`,
    `# =============================================================`,
    ``,
    generateProviderBlock(effectiveProvider),
    ``,
  ].join("\n")

  // --- main.tf ---
  const mainLines: string[] = [
    `# =============================================================`,
    `# Resources - ${projectName ?? "Infrastructure Designer"}`,
    `# Generated by Cloud Manager Infrastructure Designer`,
    `# =============================================================`,
    ``,
  ]

  const serviceNodes = nodes
    .map((n) => ({ node: n, sn: extractServiceNode(n) }))
    .filter((x): x is { node: Node; sn: ServiceNode } => x.sn !== null)

  // Group by category for readability
  const grouped = new Map<string, { node: Node; sn: ServiceNode }[]>()
  for (const item of serviceNodes) {
    const cat = item.sn.type
    if (!grouped.has(cat)) grouped.set(cat, [])
    grouped.get(cat)!.push(item)
  }

  for (const [category, items] of grouped) {
    mainLines.push(`# --- ${category.charAt(0).toUpperCase() + category.slice(1)} ---\n`)
    for (const { sn } of items) {
      const id = tfId(sn.id)
      const resMap = getResourceMap(sn.provider)
      const mapping = resMap[sn.serviceName]
      if (mapping) {
        mainLines.push(mapping.generator(sn, id))
      } else {
        mainLines.push(
          `# Unsupported service: ${sn.serviceName} (${sn.provider})\n# Configure manually or add a custom resource block.\n`,
        )
      }
    }
  }

  // Connection-derived resources
  const connectionResources = generateConnectionResources(nodes, edges, effectiveProvider)
  if (connectionResources) {
    mainLines.push(connectionResources)
  }

  const mainTf = mainLines.join("\n")

  // --- variables.tf ---
  const variablesTf = [
    `# =============================================================`,
    `# Variables`,
    `# =============================================================`,
    ``,
    generateVariablesBlock(effectiveProvider, nodes),
  ].join("\n")

  // --- outputs.tf ---
  const outputsTf = [
    `# =============================================================`,
    `# Outputs`,
    `# =============================================================`,
    ``,
    generateOutputsBlock(effectiveProvider, nodes),
  ].join("\n")

  return {
    "providers.tf": providersTf,
    "main.tf": mainTf,
    "variables.tf": variablesTf,
    "outputs.tf": outputsTf,
  }
}

// ---------------------------------------------------------------------------
// Download helpers
// ---------------------------------------------------------------------------

export function downloadTerraformFile(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/plain" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function downloadTerraformZip(files: TerraformFiles, projectName: string) {
  // We create a simple tar-like concatenation since we don't have JSZip.
  // Instead, download each file individually or use a combined approach.
  // For a better UX we'll download as a single combined .tf file or use individual downloads.
  const combined = Object.entries(files)
    .map(([name, content]) => [
      `# ${"=".repeat(60)}`,
      `# File: ${name}`,
      `# ${"=".repeat(60)}`,
      ``,
      content,
      ``,
    ].join("\n"))
    .join("\n")

  downloadTerraformFile(combined, `${projectName.replace(/\s+/g, "_")}_terraform.tf`)
}

export function downloadIndividualFiles(files: TerraformFiles, projectName: string) {
  const prefix = projectName.replace(/\s+/g, "_")
  for (const [name, content] of Object.entries(files)) {
    downloadTerraformFile(content, `${prefix}_${name}`)
  }
}
