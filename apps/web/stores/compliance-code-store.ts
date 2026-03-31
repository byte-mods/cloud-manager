import { create } from 'zustand'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Framework =
  | 'SOC2'
  | 'ISO27001'
  | 'HIPAA'
  | 'PCI-DSS'
  | 'GDPR'
  | 'NIST CSF'
  | 'CIS'

export type PolicyFormat = 'terraform' | 'opa' | 'cloudformation'

export type ControlStatus = 'generated' | 'manual_review' | 'not_applicable'

export type Control = {
  id: string
  controlId: string
  name: string
  description: string
  status: ControlStatus
  framework: Framework
}

export type PolicyTemplate = {
  id: string
  controlId: string
  framework: Framework
  title: string
  description: string
  terraform: string
  opa: string
  cloudformation: string
}

export type GeneratedPolicy = {
  id: string
  controlId: string
  framework: Framework
  title: string
  format: PolicyFormat
  code: string
  generatedAt: Date
}

// ---------------------------------------------------------------------------
// Seed data: Controls per framework
// ---------------------------------------------------------------------------

const frameworkControls: Record<Framework, Control[]> = {
  SOC2: [
    { id: 'soc2-1', controlId: 'CC6.1', name: 'Logical and Physical Access Controls', description: 'The entity implements logical access security software, infrastructure, and architectures over protected information assets.', status: 'generated', framework: 'SOC2' },
    { id: 'soc2-2', controlId: 'CC6.6', name: 'System Boundaries', description: 'The entity implements logical access security measures to protect against threats from sources outside its system boundaries.', status: 'generated', framework: 'SOC2' },
    { id: 'soc2-3', controlId: 'CC6.7', name: 'Data Transmission Security', description: 'The entity restricts the transmission, movement, and removal of information to authorized internal and external users.', status: 'generated', framework: 'SOC2' },
    { id: 'soc2-4', controlId: 'CC7.2', name: 'System Monitoring', description: 'The entity monitors system components and the operation of those components for anomalies.', status: 'manual_review', framework: 'SOC2' },
    { id: 'soc2-5', controlId: 'CC8.1', name: 'Change Management', description: 'The entity authorizes, designs, develops, configures, documents, tests, approves, and implements changes to infrastructure, data, software, and procedures.', status: 'manual_review', framework: 'SOC2' },
    { id: 'soc2-6', controlId: 'CC9.1', name: 'Risk Mitigation', description: 'The entity identifies, selects, and develops risk mitigation activities for risks arising from potential business disruptions.', status: 'not_applicable', framework: 'SOC2' },
  ],
  ISO27001: [
    { id: 'iso-1', controlId: 'A.8.2', name: 'Privileged Access Rights', description: 'The allocation and use of privileged access rights shall be restricted and managed.', status: 'generated', framework: 'ISO27001' },
    { id: 'iso-2', controlId: 'A.8.5', name: 'Secure Authentication', description: 'Secure authentication technologies and procedures shall be established and implemented.', status: 'generated', framework: 'ISO27001' },
    { id: 'iso-3', controlId: 'A.8.9', name: 'Configuration Management', description: 'Configurations, including security configurations, of hardware, software, services, and networks shall be established, documented, and managed.', status: 'generated', framework: 'ISO27001' },
    { id: 'iso-4', controlId: 'A.8.24', name: 'Use of Cryptography', description: 'Rules for the effective use of cryptography, including cryptographic key management, shall be defined and implemented.', status: 'generated', framework: 'ISO27001' },
    { id: 'iso-5', controlId: 'A.8.25', name: 'Secure Development Lifecycle', description: 'Rules for the secure development of software and systems shall be established and applied.', status: 'manual_review', framework: 'ISO27001' },
    { id: 'iso-6', controlId: 'A.5.29', name: 'ICT Continuity', description: 'ICT readiness shall be planned, implemented, maintained and tested.', status: 'not_applicable', framework: 'ISO27001' },
  ],
  HIPAA: [
    { id: 'hipaa-1', controlId: '164.312(a)(1)', name: 'Access Control', description: 'Implement technical policies and procedures for electronic information systems that maintain ePHI.', status: 'generated', framework: 'HIPAA' },
    { id: 'hipaa-2', controlId: '164.312(a)(2)(iv)', name: 'Encryption and Decryption', description: 'Implement a mechanism to encrypt and decrypt ePHI.', status: 'generated', framework: 'HIPAA' },
    { id: 'hipaa-3', controlId: '164.312(b)', name: 'Audit Controls', description: 'Implement hardware, software, and/or procedural mechanisms that record and examine activity in information systems.', status: 'generated', framework: 'HIPAA' },
    { id: 'hipaa-4', controlId: '164.312(c)(1)', name: 'Integrity Controls', description: 'Implement policies and procedures to protect ePHI from improper alteration or destruction.', status: 'manual_review', framework: 'HIPAA' },
    { id: 'hipaa-5', controlId: '164.312(e)(1)', name: 'Transmission Security', description: 'Implement technical security measures to guard against unauthorized access to ePHI being transmitted.', status: 'generated', framework: 'HIPAA' },
    { id: 'hipaa-6', controlId: '164.308(a)(5)', name: 'Security Awareness Training', description: 'Implement a security awareness and training program for all members of its workforce.', status: 'not_applicable', framework: 'HIPAA' },
  ],
  'PCI-DSS': [
    { id: 'pci-1', controlId: '3.4', name: 'Render PAN Unreadable', description: 'Render PAN unreadable anywhere it is stored by using strong cryptography.', status: 'generated', framework: 'PCI-DSS' },
    { id: 'pci-2', controlId: '3.5', name: 'Protect Stored Account Data', description: 'Protect stored account data with encryption keys that are secured against disclosure and misuse.', status: 'generated', framework: 'PCI-DSS' },
    { id: 'pci-3', controlId: '4.1', name: 'Strong Cryptography for Transmission', description: 'Strong cryptography is used during transmission of PAN over open, public networks.', status: 'generated', framework: 'PCI-DSS' },
    { id: 'pci-4', controlId: '6.2', name: 'Secure Software Development', description: 'Bespoke and custom software are developed securely.', status: 'manual_review', framework: 'PCI-DSS' },
    { id: 'pci-5', controlId: '8.3', name: 'Strong Authentication', description: 'Strong authentication for users and administrators is established and managed.', status: 'generated', framework: 'PCI-DSS' },
    { id: 'pci-6', controlId: '10.1', name: 'Logging and Monitoring', description: 'Log and monitor all access to system components and cardholder data.', status: 'manual_review', framework: 'PCI-DSS' },
  ],
  GDPR: [
    { id: 'gdpr-1', controlId: 'Art.25', name: 'Data Protection by Design', description: 'Implement appropriate technical measures designed to implement data protection principles.', status: 'generated', framework: 'GDPR' },
    { id: 'gdpr-2', controlId: 'Art.30', name: 'Records of Processing Activities', description: 'Maintain a record of processing activities under its responsibility.', status: 'manual_review', framework: 'GDPR' },
    { id: 'gdpr-3', controlId: 'Art.32', name: 'Security of Processing', description: 'Implement appropriate technical and organisational measures to ensure security appropriate to the risk.', status: 'generated', framework: 'GDPR' },
    { id: 'gdpr-4', controlId: 'Art.33', name: 'Breach Notification', description: 'Notify the supervisory authority within 72 hours of a personal data breach.', status: 'generated', framework: 'GDPR' },
    { id: 'gdpr-5', controlId: 'Art.35', name: 'Data Protection Impact Assessment', description: 'Carry out an assessment of the impact of the envisaged processing operations.', status: 'not_applicable', framework: 'GDPR' },
    { id: 'gdpr-6', controlId: 'Art.17', name: 'Right to Erasure', description: 'The data subject shall have the right to obtain erasure of personal data.', status: 'generated', framework: 'GDPR' },
  ],
  'NIST CSF': [
    { id: 'nist-1', controlId: 'PR.AC-1', name: 'Identity and Access Management', description: 'Identities and credentials are issued, managed, verified, revoked, and audited for authorized devices, users and processes.', status: 'generated', framework: 'NIST CSF' },
    { id: 'nist-2', controlId: 'PR.DS-1', name: 'Data-at-Rest Protection', description: 'Data-at-rest is protected.', status: 'generated', framework: 'NIST CSF' },
    { id: 'nist-3', controlId: 'PR.DS-2', name: 'Data-in-Transit Protection', description: 'Data-in-transit is protected.', status: 'generated', framework: 'NIST CSF' },
    { id: 'nist-4', controlId: 'DE.CM-1', name: 'Network Monitoring', description: 'The network is monitored to detect potential cybersecurity events.', status: 'generated', framework: 'NIST CSF' },
    { id: 'nist-5', controlId: 'RS.RP-1', name: 'Response Planning', description: 'Response plan is executed during or after an incident.', status: 'manual_review', framework: 'NIST CSF' },
    { id: 'nist-6', controlId: 'RC.RP-1', name: 'Recovery Planning', description: 'Recovery plan is executed during or after a cybersecurity incident.', status: 'not_applicable', framework: 'NIST CSF' },
  ],
  CIS: [
    { id: 'cis-1', controlId: '1.1', name: 'Establish and Maintain Asset Inventory', description: 'Establish and maintain a detailed enterprise asset inventory.', status: 'generated', framework: 'CIS' },
    { id: 'cis-2', controlId: '3.1', name: 'Establish and Maintain a Data Management Process', description: 'Establish and maintain a data management process.', status: 'manual_review', framework: 'CIS' },
    { id: 'cis-3', controlId: '4.1', name: 'Establish Secure Configuration Process', description: 'Establish and maintain a secure configuration process for enterprise assets and software.', status: 'generated', framework: 'CIS' },
    { id: 'cis-4', controlId: '5.1', name: 'Establish Account Management Process', description: 'Establish and maintain an account management process.', status: 'generated', framework: 'CIS' },
    { id: 'cis-5', controlId: '8.2', name: 'Collect Audit Logs', description: 'Collect audit logs.', status: 'generated', framework: 'CIS' },
    { id: 'cis-6', controlId: '13.1', name: 'Establish Network Monitoring', description: 'Centralize security event alerting across enterprise assets.', status: 'manual_review', framework: 'CIS' },
  ],
}

// ---------------------------------------------------------------------------
// Policy templates
// ---------------------------------------------------------------------------

const policyTemplates: PolicyTemplate[] = [
  // SOC2
  {
    id: 'pt-soc2-1', controlId: 'CC6.1', framework: 'SOC2',
    title: 'Enforce Encryption at Rest',
    description: 'Ensure all S3 buckets have server-side encryption enabled using KMS.',
    terraform: `# CC6.1 - Enforce encryption at rest
resource "aws_s3_bucket_server_side_encryption_configuration" "enforce_encryption" {
  bucket = var.bucket_id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "aws:kms"
      kms_master_key_id = var.kms_key_arn
    }
  }
}

resource "aws_s3_bucket_public_access_block" "block_public" {
  bucket = var.bucket_id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}`,
    opa: `# CC6.1 - Enforce encryption at rest
package soc2.cc6_1

import rego.v1

deny contains msg if {
  resource := input.resource.aws_s3_bucket[name]
  not resource.server_side_encryption_configuration
  msg := sprintf("S3 bucket '%s' must have server-side encryption enabled", [name])
}

deny contains msg if {
  resource := input.resource.aws_s3_bucket_public_access_block[name]
  not resource.block_public_acls
  msg := sprintf("S3 bucket '%s' must block public ACLs", [name])
}`,
    cloudformation: `# CC6.1 - Enforce encryption at rest
AWSTemplateFormatVersion: "2010-09-09"
Resources:
  EncryptedBucket:
    Type: "AWS::S3::Bucket"
    Properties:
      BucketEncryption:
        ServerSideEncryptionConfiguration:
          - ServerSideEncryptionByDefault:
              SSEAlgorithm: "aws:kms"
              KMSMasterKeyID: !Ref KmsKeyArn
      PublicAccessBlockConfiguration:
        BlockPublicAcls: true
        BlockPublicPolicy: true
        IgnorePublicAcls: true
        RestrictPublicBuckets: true`,
  },
  {
    id: 'pt-soc2-2', controlId: 'CC6.6', framework: 'SOC2',
    title: 'Network Security Groups',
    description: 'Restrict inbound traffic to authorized sources only.',
    terraform: `# CC6.6 - Network boundary protection
resource "aws_security_group" "restricted" {
  name_prefix = "soc2-compliant-"
  vpc_id      = var.vpc_id

  ingress {
    description = "Allow HTTPS only"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = var.allowed_cidrs
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Compliance = "SOC2-CC6.6"
  }
}`,
    opa: `# CC6.6 - Network boundary protection
package soc2.cc6_6

import rego.v1

deny contains msg if {
  resource := input.resource.aws_security_group[name]
  rule := resource.ingress[_]
  rule.cidr_blocks[_] == "0.0.0.0/0"
  msg := sprintf("Security group '%s' must not allow unrestricted inbound access", [name])
}`,
    cloudformation: `# CC6.6 - Network boundary protection
AWSTemplateFormatVersion: "2010-09-09"
Resources:
  RestrictedSecurityGroup:
    Type: "AWS::EC2::SecurityGroup"
    Properties:
      GroupDescription: "SOC2 CC6.6 compliant security group"
      VpcId: !Ref VpcId
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: 443
          ToPort: 443
          CidrIp: !Ref AllowedCidr`,
  },
  {
    id: 'pt-soc2-3', controlId: 'CC6.7', framework: 'SOC2',
    title: 'Enforce TLS in Transit',
    description: 'Ensure all data transmission uses TLS 1.2+.',
    terraform: `# CC6.7 - Enforce TLS for data in transit
resource "aws_lb_listener" "https" {
  load_balancer_arn = var.alb_arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = var.target_group_arn
  }
}

resource "aws_lb_listener" "redirect_http" {
  load_balancer_arn = var.alb_arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}`,
    opa: `# CC6.7 - Enforce TLS in transit
package soc2.cc6_7

import rego.v1

deny contains msg if {
  resource := input.resource.aws_lb_listener[name]
  resource.protocol == "HTTP"
  not resource.default_action[_].type == "redirect"
  msg := sprintf("Load balancer listener '%s' must redirect HTTP to HTTPS", [name])
}`,
    cloudformation: `# CC6.7 - Enforce TLS in transit
AWSTemplateFormatVersion: "2010-09-09"
Resources:
  HTTPSListener:
    Type: "AWS::ElasticLoadBalancingV2::Listener"
    Properties:
      LoadBalancerArn: !Ref ALBArn
      Port: 443
      Protocol: HTTPS
      SslPolicy: "ELBSecurityPolicy-TLS13-1-2-2021-06"
      Certificates:
        - CertificateArn: !Ref CertificateArn
      DefaultActions:
        - Type: forward
          TargetGroupArn: !Ref TargetGroup`,
  },

  // PCI-DSS
  {
    id: 'pt-pci-1', controlId: '3.4', framework: 'PCI-DSS',
    title: 'Render PAN Unreadable',
    description: 'Encrypt RDS clusters at rest to protect stored cardholder data.',
    terraform: `# 3.4 - Render PAN unreadable
resource "aws_rds_cluster" "encrypted" {
  cluster_identifier = var.cluster_name
  engine             = "aurora-mysql"
  engine_version     = "8.0.mysql_aurora.3.04.0"
  storage_encrypted  = true
  kms_key_id         = var.kms_key_arn

  master_username = var.db_username
  master_password = var.db_password

  backup_retention_period = 35
  deletion_protection     = true

  tags = {
    Compliance = "PCI-DSS-3.4"
  }
}`,
    opa: `# 3.4 - Render PAN unreadable
package pcidss.req3_4

import rego.v1

deny contains msg if {
  resource := input.resource.aws_rds_cluster[name]
  not resource.storage_encrypted
  msg := sprintf("RDS cluster '%s' must have storage encryption enabled (PCI-DSS 3.4)", [name])
}

deny contains msg if {
  resource := input.resource.aws_rds_cluster[name]
  resource.storage_encrypted
  not resource.kms_key_id
  msg := sprintf("RDS cluster '%s' must use a customer-managed KMS key (PCI-DSS 3.4)", [name])
}`,
    cloudformation: `# 3.4 - Render PAN unreadable
AWSTemplateFormatVersion: "2010-09-09"
Resources:
  EncryptedRDSCluster:
    Type: "AWS::RDS::DBCluster"
    Properties:
      Engine: aurora-mysql
      StorageEncrypted: true
      KmsKeyId: !Ref KmsKeyArn
      BackupRetentionPeriod: 35
      DeletionProtection: true`,
  },
  {
    id: 'pt-pci-2', controlId: '3.5', framework: 'PCI-DSS',
    title: 'KMS Key Rotation',
    description: 'Enable automatic key rotation for KMS keys protecting cardholder data.',
    terraform: `# 3.5 - Protect cryptographic keys
resource "aws_kms_key" "cardholder_data" {
  description             = "KMS key for PCI cardholder data encryption"
  deletion_window_in_days = 30
  enable_key_rotation     = true
  rotation_period_in_days = 365

  policy = var.key_policy

  tags = {
    Compliance = "PCI-DSS-3.5"
  }
}

resource "aws_kms_alias" "cardholder_data" {
  name          = "alias/pci-cardholder-data"
  target_key_id = aws_kms_key.cardholder_data.key_id
}`,
    opa: `# 3.5 - Protect cryptographic keys
package pcidss.req3_5

import rego.v1

deny contains msg if {
  resource := input.resource.aws_kms_key[name]
  not resource.enable_key_rotation
  msg := sprintf("KMS key '%s' must have automatic rotation enabled (PCI-DSS 3.5)", [name])
}`,
    cloudformation: `# 3.5 - Protect cryptographic keys
AWSTemplateFormatVersion: "2010-09-09"
Resources:
  CardholderDataKey:
    Type: "AWS::KMS::Key"
    Properties:
      Description: "KMS key for PCI cardholder data"
      EnableKeyRotation: true
      PendingWindowInDays: 30`,
  },
  {
    id: 'pt-pci-3', controlId: '4.1', framework: 'PCI-DSS',
    title: 'TLS for Data in Transit',
    description: 'Enforce TLS 1.2+ for all data transmissions over public networks.',
    terraform: `# 4.1 - Strong cryptography for transmission
resource "aws_cloudfront_distribution" "pci_compliant" {
  enabled = true

  viewer_certificate {
    acm_certificate_arn      = var.certificate_arn
    minimum_protocol_version = "TLSv1.2_2021"
    ssl_support_method       = "sni-only"
  }

  default_cache_behavior {
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = var.origin_id
    forwarded_values {
      query_string = false
      cookies { forward = "none" }
    }
  }

  origin {
    domain_name = var.origin_domain
    origin_id   = var.origin_id
    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  restrictions {
    geo_restriction { restriction_type = "none" }
  }

  tags = {
    Compliance = "PCI-DSS-4.1"
  }
}`,
    opa: `# 4.1 - Strong cryptography for transmission
package pcidss.req4_1

import rego.v1

deny contains msg if {
  resource := input.resource.aws_cloudfront_distribution[name]
  cert := resource.viewer_certificate
  cert.minimum_protocol_version != "TLSv1.2_2021"
  msg := sprintf("CloudFront '%s' must use TLS 1.2+ (PCI-DSS 4.1)", [name])
}`,
    cloudformation: `# 4.1 - Strong cryptography for transmission
AWSTemplateFormatVersion: "2010-09-09"
Resources:
  PCICompliantDistribution:
    Type: "AWS::CloudFront::Distribution"
    Properties:
      DistributionConfig:
        ViewerCertificate:
          AcmCertificateArn: !Ref CertificateArn
          MinimumProtocolVersion: TLSv1.2_2021
          SslSupportMethod: sni-only`,
  },
  {
    id: 'pt-pci-4', controlId: '8.3', framework: 'PCI-DSS',
    title: 'MFA for Admin Access',
    description: 'Enforce multi-factor authentication for administrative access.',
    terraform: `# 8.3 - Strong authentication for administrators
resource "aws_iam_account_password_policy" "strict" {
  minimum_password_length        = 12
  require_lowercase_characters   = true
  require_uppercase_characters   = true
  require_numbers                = true
  require_symbols                = true
  max_password_age               = 90
  password_reuse_prevention      = 24
  allow_users_to_change_password = true
}

resource "aws_iam_group_policy" "require_mfa" {
  name  = "require-mfa"
  group = var.admin_group_name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "DenyAllExceptMFA"
        Effect    = "Deny"
        NotAction = ["iam:CreateVirtualMFADevice", "iam:EnableMFADevice", "iam:GetUser", "iam:ListMFADevices", "iam:ListVirtualMFADevices", "iam:ResyncMFADevice", "sts:GetSessionToken"]
        Resource  = "*"
        Condition = {
          BoolIfExists = {
            "aws:MultiFactorAuthPresent" = "false"
          }
        }
      }
    ]
  })
}`,
    opa: `# 8.3 - Strong authentication
package pcidss.req8_3

import rego.v1

deny contains msg if {
  resource := input.resource.aws_iam_account_password_policy[name]
  resource.minimum_password_length < 12
  msg := "Password policy must require minimum 12 characters (PCI-DSS 8.3)"
}`,
    cloudformation: `# 8.3 - Strong authentication
AWSTemplateFormatVersion: "2010-09-09"
Resources:
  RequireMFAPolicy:
    Type: "AWS::IAM::ManagedPolicy"
    Properties:
      PolicyDocument:
        Version: "2012-10-17"
        Statement:
          - Sid: DenyWithoutMFA
            Effect: Deny
            NotAction: ["iam:CreateVirtualMFADevice", "iam:EnableMFADevice"]
            Resource: "*"
            Condition:
              BoolIfExists:
                "aws:MultiFactorAuthPresent": "false"`,
  },

  // HIPAA
  {
    id: 'pt-hipaa-1', controlId: '164.312(a)(1)', framework: 'HIPAA',
    title: 'Access Control for ePHI',
    description: 'Restrict access to ePHI systems with IAM policies.',
    terraform: `# 164.312(a)(1) - Access control for ePHI
resource "aws_iam_policy" "hipaa_access_control" {
  name        = "hipaa-ephi-access-control"
  description = "Restrict access to ePHI data stores"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject"]
        Resource = "\${var.ephi_bucket_arn}/*"
        Condition = {
          StringEquals = {
            "aws:PrincipalTag/department" = "healthcare"
          }
          Bool = {
            "aws:MultiFactorAuthPresent" = "true"
          }
        }
      }
    ]
  })

  tags = {
    Compliance = "HIPAA-164.312(a)(1)"
  }
}`,
    opa: `# 164.312(a)(1) - Access control for ePHI
package hipaa.access_control

import rego.v1

deny contains msg if {
  resource := input.resource.aws_iam_policy[name]
  statement := json.unmarshal(resource.policy).Statement[_]
  statement.Effect == "Allow"
  contains(statement.Resource, "ephi")
  not statement.Condition
  msg := sprintf("IAM policy '%s' for ePHI must include conditions (HIPAA 164.312(a)(1))", [name])
}`,
    cloudformation: `# 164.312(a)(1) - Access control for ePHI
AWSTemplateFormatVersion: "2010-09-09"
Resources:
  HIPAAAccessPolicy:
    Type: "AWS::IAM::ManagedPolicy"
    Properties:
      PolicyDocument:
        Version: "2012-10-17"
        Statement:
          - Effect: Allow
            Action: ["s3:GetObject", "s3:PutObject"]
            Resource: !Sub "\${EphiBucketArn}/*"
            Condition:
              StringEquals:
                "aws:PrincipalTag/department": healthcare`,
  },
  {
    id: 'pt-hipaa-2', controlId: '164.312(a)(2)(iv)', framework: 'HIPAA',
    title: 'Encrypt ePHI at Rest',
    description: 'Ensure all ePHI data stores are encrypted.',
    terraform: `# 164.312(a)(2)(iv) - Encryption of ePHI
resource "aws_dynamodb_table" "ephi_data" {
  name         = var.table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PatientId"

  server_side_encryption {
    enabled     = true
    kms_key_arn = var.kms_key_arn
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Compliance  = "HIPAA-164.312(a)(2)(iv)"
    DataClass   = "ePHI"
  }
}`,
    opa: `# 164.312(a)(2)(iv) - Encryption of ePHI
package hipaa.encryption

import rego.v1

deny contains msg if {
  resource := input.resource.aws_dynamodb_table[name]
  not resource.server_side_encryption.enabled
  msg := sprintf("DynamoDB table '%s' must have encryption enabled (HIPAA)", [name])
}`,
    cloudformation: `# 164.312(a)(2)(iv) - Encryption of ePHI
AWSTemplateFormatVersion: "2010-09-09"
Resources:
  EPHITable:
    Type: "AWS::DynamoDB::Table"
    Properties:
      TableName: !Ref TableName
      BillingMode: PAY_PER_REQUEST
      SSESpecification:
        SSEEnabled: true
        SSEType: KMS
        KMSMasterKeyId: !Ref KmsKeyArn
      PointInTimeRecoverySpecification:
        PointInTimeRecoveryEnabled: true`,
  },
  {
    id: 'pt-hipaa-3', controlId: '164.312(b)', framework: 'HIPAA',
    title: 'Audit Controls for ePHI',
    description: 'Enable CloudTrail logging for ePHI access auditing.',
    terraform: `# 164.312(b) - Audit controls
resource "aws_cloudtrail" "hipaa_audit" {
  name                       = "hipaa-ephi-audit-trail"
  s3_bucket_name             = var.audit_bucket_name
  include_global_service_events = true
  is_multi_region_trail      = true
  enable_log_file_validation = true

  cloud_watch_logs_group_arn = "\${var.log_group_arn}:*"
  cloud_watch_logs_role_arn  = var.cloudwatch_role_arn

  event_selector {
    read_write_type           = "All"
    include_management_events = true
    data_resource {
      type   = "AWS::S3::Object"
      values = ["\${var.ephi_bucket_arn}/"]
    }
  }

  tags = {
    Compliance = "HIPAA-164.312(b)"
  }
}`,
    opa: `# 164.312(b) - Audit controls
package hipaa.audit

import rego.v1

deny contains msg if {
  resource := input.resource.aws_cloudtrail[name]
  not resource.enable_log_file_validation
  msg := sprintf("CloudTrail '%s' must enable log file validation (HIPAA)", [name])
}`,
    cloudformation: `# 164.312(b) - Audit controls
AWSTemplateFormatVersion: "2010-09-09"
Resources:
  HIPAAAuditTrail:
    Type: "AWS::CloudTrail::Trail"
    Properties:
      TrailName: hipaa-ephi-audit-trail
      S3BucketName: !Ref AuditBucketName
      IsMultiRegionTrail: true
      EnableLogFileValidation: true
      IncludeGlobalServiceEvents: true`,
  },
  {
    id: 'pt-hipaa-4', controlId: '164.312(e)(1)', framework: 'HIPAA',
    title: 'Transmission Security',
    description: 'Enforce TLS for ePHI data in transit.',
    terraform: `# 164.312(e)(1) - Transmission security
resource "aws_lb_listener" "hipaa_https" {
  load_balancer_arn = var.alb_arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = var.target_group_arn
  }
}`,
    opa: `# 164.312(e)(1) - Transmission security
package hipaa.transmission

import rego.v1

deny contains msg if {
  resource := input.resource.aws_lb_listener[name]
  resource.protocol != "HTTPS"
  msg := sprintf("LB listener '%s' must use HTTPS for ePHI (HIPAA)", [name])
}`,
    cloudformation: `# 164.312(e)(1) - Transmission security
AWSTemplateFormatVersion: "2010-09-09"
Resources:
  HIPAAListener:
    Type: "AWS::ElasticLoadBalancingV2::Listener"
    Properties:
      LoadBalancerArn: !Ref ALBArn
      Port: 443
      Protocol: HTTPS
      SslPolicy: ELBSecurityPolicy-TLS13-1-2-2021-06`,
  },

  // GDPR
  {
    id: 'pt-gdpr-1', controlId: 'Art.25', framework: 'GDPR',
    title: 'Data Protection by Design',
    description: 'Default encryption and access restrictions for personal data stores.',
    terraform: `# Art.25 - Data protection by design and by default
resource "aws_s3_bucket" "personal_data" {
  bucket = var.bucket_name

  tags = {
    Compliance = "GDPR-Art.25"
    DataClass  = "PersonalData"
  }
}

resource "aws_s3_bucket_versioning" "personal_data" {
  bucket = aws_s3_bucket.personal_data.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "personal_data" {
  bucket = aws_s3_bucket.personal_data.id
  rule {
    id     = "retain-and-expire"
    status = "Enabled"
    expiration {
      days = var.retention_days
    }
  }
}`,
    opa: `# Art.25 - Data protection by design
package gdpr.art25

import rego.v1

deny contains msg if {
  resource := input.resource.aws_s3_bucket[name]
  resource.tags.DataClass == "PersonalData"
  not input.resource.aws_s3_bucket_versioning[name]
  msg := sprintf("Personal data bucket '%s' must have versioning (GDPR Art.25)", [name])
}`,
    cloudformation: `# Art.25 - Data protection by design
AWSTemplateFormatVersion: "2010-09-09"
Resources:
  PersonalDataBucket:
    Type: "AWS::S3::Bucket"
    Properties:
      VersioningConfiguration:
        Status: Enabled
      LifecycleConfiguration:
        Rules:
          - Id: retain-and-expire
            Status: Enabled
            ExpirationInDays: !Ref RetentionDays`,
  },
  {
    id: 'pt-gdpr-2', controlId: 'Art.32', framework: 'GDPR',
    title: 'Security of Processing',
    description: 'Enable VPC flow logs and GuardDuty for processing security.',
    terraform: `# Art.32 - Security of processing
resource "aws_flow_log" "vpc_monitoring" {
  vpc_id               = var.vpc_id
  traffic_type         = "ALL"
  log_destination      = var.log_bucket_arn
  log_destination_type = "s3"
  max_aggregation_interval = 60

  tags = {
    Compliance = "GDPR-Art.32"
  }
}

resource "aws_guardduty_detector" "main" {
  enable = true

  datasources {
    s3_logs      { enable = true }
    kubernetes   { audit_logs { enable = true } }
    malware_protection { scan_ec2_instance_with_findings { ebs_volumes { enable = true } } }
  }
}`,
    opa: `# Art.32 - Security of processing
package gdpr.art32

import rego.v1

deny contains msg if {
  resource := input.resource.aws_vpc[name]
  not input.resource.aws_flow_log
  msg := sprintf("VPC '%s' must have flow logs enabled (GDPR Art.32)", [name])
}`,
    cloudformation: `# Art.32 - Security of processing
AWSTemplateFormatVersion: "2010-09-09"
Resources:
  VPCFlowLog:
    Type: "AWS::EC2::FlowLog"
    Properties:
      ResourceId: !Ref VpcId
      ResourceType: VPC
      TrafficType: ALL
      LogDestination: !Ref LogBucketArn
      LogDestinationType: s3`,
  },
  {
    id: 'pt-gdpr-3', controlId: 'Art.33', framework: 'GDPR',
    title: 'Breach Notification',
    description: 'Set up SNS alerting for security findings within 72-hour window.',
    terraform: `# Art.33 - Notification of a personal data breach
resource "aws_sns_topic" "breach_notification" {
  name = "gdpr-breach-notification"

  tags = {
    Compliance = "GDPR-Art.33"
  }
}

resource "aws_cloudwatch_event_rule" "security_findings" {
  name        = "gdpr-breach-detection"
  description = "Detect security findings for GDPR breach notification"

  event_pattern = jsonencode({
    source      = ["aws.guardduty", "aws.securityhub"]
    detail-type = ["GuardDuty Finding", "Security Hub Findings - Imported"]
    detail = {
      severity = [{ numeric = [">=", 7] }]
    }
  })
}

resource "aws_cloudwatch_event_target" "notify" {
  rule = aws_cloudwatch_event_rule.security_findings.name
  arn  = aws_sns_topic.breach_notification.arn
}`,
    opa: `# Art.33 - Breach notification
package gdpr.art33

import rego.v1

deny contains msg if {
  input.resource.aws_guardduty_detector
  not input.resource.aws_sns_topic
  msg := "GuardDuty must have SNS notification configured (GDPR Art.33)"
}`,
    cloudformation: `# Art.33 - Breach notification
AWSTemplateFormatVersion: "2010-09-09"
Resources:
  BreachNotificationTopic:
    Type: "AWS::SNS::Topic"
    Properties:
      TopicName: gdpr-breach-notification
  SecurityFindingsRule:
    Type: "AWS::Events::Rule"
    Properties:
      EventPattern:
        source: ["aws.guardduty"]
        detail-type: ["GuardDuty Finding"]`,
  },
  {
    id: 'pt-gdpr-4', controlId: 'Art.17', framework: 'GDPR',
    title: 'Right to Erasure',
    description: 'Lambda function for automated personal data deletion requests.',
    terraform: `# Art.17 - Right to erasure
resource "aws_lambda_function" "data_erasure" {
  function_name = "gdpr-data-erasure"
  runtime       = "python3.12"
  handler       = "index.handler"
  role          = var.lambda_role_arn
  filename      = var.lambda_zip_path
  timeout       = 300

  environment {
    variables = {
      DDB_TABLE    = var.personal_data_table
      S3_BUCKET    = var.personal_data_bucket
      AUDIT_TABLE  = var.erasure_audit_table
    }
  }

  tags = {
    Compliance = "GDPR-Art.17"
  }
}`,
    opa: `# Art.17 - Right to erasure
package gdpr.art17

import rego.v1

deny contains msg if {
  resource := input.resource.aws_lambda_function[name]
  contains(resource.function_name, "erasure")
  resource.timeout < 120
  msg := sprintf("Erasure function '%s' timeout too low (GDPR Art.17)", [name])
}`,
    cloudformation: `# Art.17 - Right to erasure
AWSTemplateFormatVersion: "2010-09-09"
Resources:
  DataErasureFunction:
    Type: "AWS::Lambda::Function"
    Properties:
      FunctionName: gdpr-data-erasure
      Runtime: python3.12
      Handler: index.handler
      Timeout: 300
      Role: !Ref LambdaRoleArn`,
  },

  // ISO27001
  {
    id: 'pt-iso-1', controlId: 'A.8.2', framework: 'ISO27001',
    title: 'Privileged Access Rights',
    description: 'Enforce least-privilege IAM policies for privileged users.',
    terraform: `# A.8.2 - Privileged access rights
resource "aws_iam_policy" "least_privilege_admin" {
  name        = "iso27001-privileged-access"
  description = "Restrict privileged access with conditions"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["ec2:*", "rds:*", "s3:*"]
        Resource = "*"
        Condition = {
          StringEquals = { "aws:RequestedRegion" = var.allowed_regions }
          Bool         = { "aws:MultiFactorAuthPresent" = "true" }
          IpAddress    = { "aws:SourceIp" = var.allowed_ips }
        }
      }
    ]
  })
}`,
    opa: `# A.8.2 - Privileged access rights
package iso27001.a8_2

import rego.v1

deny contains msg if {
  resource := input.resource.aws_iam_policy[name]
  statement := json.unmarshal(resource.policy).Statement[_]
  statement.Action[_] == "*"
  msg := sprintf("IAM policy '%s' must not use wildcard actions (ISO 27001 A.8.2)", [name])
}`,
    cloudformation: `# A.8.2 - Privileged access rights
AWSTemplateFormatVersion: "2010-09-09"
Resources:
  PrivilegedAccessPolicy:
    Type: "AWS::IAM::ManagedPolicy"
    Properties:
      PolicyDocument:
        Version: "2012-10-17"
        Statement:
          - Effect: Allow
            Action: ["ec2:Describe*", "rds:Describe*"]
            Resource: "*"
            Condition:
              Bool:
                "aws:MultiFactorAuthPresent": "true"`,
  },
  {
    id: 'pt-iso-2', controlId: 'A.8.5', framework: 'ISO27001',
    title: 'Secure Authentication',
    description: 'Configure Cognito with strong authentication requirements.',
    terraform: `# A.8.5 - Secure authentication
resource "aws_cognito_user_pool" "secure_pool" {
  name = "iso27001-secure-auth"

  password_policy {
    minimum_length                   = 14
    require_lowercase                = true
    require_uppercase                = true
    require_numbers                  = true
    require_symbols                  = true
    temporary_password_validity_days = 1
  }

  mfa_configuration = "ON"
  software_token_mfa_configuration {
    enabled = true
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }
}`,
    opa: `# A.8.5 - Secure authentication
package iso27001.a8_5

import rego.v1

deny contains msg if {
  resource := input.resource.aws_cognito_user_pool[name]
  resource.mfa_configuration != "ON"
  msg := sprintf("Cognito pool '%s' must enforce MFA (ISO 27001 A.8.5)", [name])
}`,
    cloudformation: `# A.8.5 - Secure authentication
AWSTemplateFormatVersion: "2010-09-09"
Resources:
  SecureUserPool:
    Type: "AWS::Cognito::UserPool"
    Properties:
      UserPoolName: iso27001-secure-auth
      MfaConfiguration: "ON"
      Policies:
        PasswordPolicy:
          MinimumLength: 14
          RequireLowercase: true
          RequireUppercase: true
          RequireNumbers: true
          RequireSymbols: true`,
  },
  {
    id: 'pt-iso-3', controlId: 'A.8.9', framework: 'ISO27001',
    title: 'Configuration Management',
    description: 'Enable AWS Config rules for configuration compliance.',
    terraform: `# A.8.9 - Configuration management
resource "aws_config_config_rule" "encrypted_volumes" {
  name = "iso27001-encrypted-volumes"

  source {
    owner             = "AWS"
    source_identifier = "ENCRYPTED_VOLUMES"
  }
}

resource "aws_config_config_rule" "restricted_ssh" {
  name = "iso27001-restricted-ssh"

  source {
    owner             = "AWS"
    source_identifier = "INCOMING_SSH_DISABLED"
  }
}`,
    opa: `# A.8.9 - Configuration management
package iso27001.a8_9

import rego.v1

deny contains msg if {
  resource := input.resource.aws_ebs_volume[name]
  not resource.encrypted
  msg := sprintf("EBS volume '%s' must be encrypted (ISO 27001 A.8.9)", [name])
}`,
    cloudformation: `# A.8.9 - Configuration management
AWSTemplateFormatVersion: "2010-09-09"
Resources:
  EncryptedVolumesRule:
    Type: "AWS::Config::ConfigRule"
    Properties:
      ConfigRuleName: iso27001-encrypted-volumes
      Source:
        Owner: AWS
        SourceIdentifier: ENCRYPTED_VOLUMES`,
  },
  {
    id: 'pt-iso-4', controlId: 'A.8.24', framework: 'ISO27001',
    title: 'Use of Cryptography',
    description: 'Enforce KMS encryption with defined key policies.',
    terraform: `# A.8.24 - Use of cryptography
resource "aws_kms_key" "iso_encryption" {
  description             = "ISO 27001 compliant encryption key"
  enable_key_rotation     = true
  deletion_window_in_days = 30

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "EnableRootAccount"
        Effect    = "Allow"
        Principal = { AWS = "arn:aws:iam::\${var.account_id}:root" }
        Action    = "kms:*"
        Resource  = "*"
      },
      {
        Sid       = "AllowKeyAdmin"
        Effect    = "Allow"
        Principal = { AWS = var.key_admin_arn }
        Action    = ["kms:Create*", "kms:Describe*", "kms:Enable*", "kms:List*", "kms:Put*", "kms:Update*", "kms:Revoke*", "kms:Disable*", "kms:Get*", "kms:Delete*", "kms:ScheduleKeyDeletion", "kms:CancelKeyDeletion"]
        Resource  = "*"
      }
    ]
  })
}`,
    opa: `# A.8.24 - Use of cryptography
package iso27001.a8_24

import rego.v1

deny contains msg if {
  resource := input.resource.aws_kms_key[name]
  not resource.enable_key_rotation
  msg := sprintf("KMS key '%s' must have rotation enabled (ISO 27001 A.8.24)", [name])
}`,
    cloudformation: `# A.8.24 - Use of cryptography
AWSTemplateFormatVersion: "2010-09-09"
Resources:
  ISOEncryptionKey:
    Type: "AWS::KMS::Key"
    Properties:
      EnableKeyRotation: true
      PendingWindowInDays: 30
      Description: "ISO 27001 compliant encryption key"`,
  },

  // NIST CSF
  {
    id: 'pt-nist-1', controlId: 'PR.AC-1', framework: 'NIST CSF',
    title: 'Identity Management',
    description: 'IAM identity provider configuration with federated access.',
    terraform: `# PR.AC-1 - Identity and access management
resource "aws_iam_saml_provider" "corporate_idp" {
  name                   = "corporate-sso"
  saml_metadata_document = file(var.saml_metadata_path)
}

resource "aws_iam_role" "sso_role" {
  name = "nist-sso-federated-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = { Federated = aws_iam_saml_provider.corporate_idp.arn }
      Action    = "sts:AssumeRoleWithSAML"
      Condition = {
        StringEquals = { "SAML:aud" = "https://signin.aws.amazon.com/saml" }
      }
    }]
  })

  tags = {
    Compliance = "NIST-PR.AC-1"
  }
}`,
    opa: `# PR.AC-1 - Identity management
package nist.pr_ac_1

import rego.v1

deny contains msg if {
  resource := input.resource.aws_iam_user[name]
  not input.resource.aws_iam_saml_provider
  msg := "Direct IAM users should use federated identity (NIST PR.AC-1)"
}`,
    cloudformation: `# PR.AC-1 - Identity management
AWSTemplateFormatVersion: "2010-09-09"
Resources:
  CorporateIdP:
    Type: "AWS::IAM::SAMLProvider"
    Properties:
      Name: corporate-sso
      SamlMetadataDocument: !Ref SAMLMetadata`,
  },
  {
    id: 'pt-nist-2', controlId: 'PR.DS-1', framework: 'NIST CSF',
    title: 'Data-at-Rest Protection',
    description: 'Enable default EBS encryption in all regions.',
    terraform: `# PR.DS-1 - Data-at-rest protection
resource "aws_ebs_encryption_by_default" "enabled" {
  enabled = true
}

resource "aws_ebs_default_kms_key" "custom" {
  key_arn = var.kms_key_arn
}`,
    opa: `# PR.DS-1 - Data-at-rest protection
package nist.pr_ds_1

import rego.v1

deny contains msg if {
  resource := input.resource.aws_ebs_volume[name]
  not resource.encrypted
  msg := sprintf("EBS volume '%s' must be encrypted (NIST PR.DS-1)", [name])
}`,
    cloudformation: `# PR.DS-1 - Data-at-rest protection
# Note: EBS default encryption is configured via AWS API, not CloudFormation
# Use AWS CLI: aws ec2 enable-ebs-encryption-by-default
AWSTemplateFormatVersion: "2010-09-09"
Description: "EBS encryption should be enabled by default via account settings"`,
  },
  {
    id: 'pt-nist-3', controlId: 'PR.DS-2', framework: 'NIST CSF',
    title: 'Data-in-Transit Protection',
    description: 'Enforce TLS on all API Gateway endpoints.',
    terraform: `# PR.DS-2 - Data-in-transit protection
resource "aws_api_gateway_domain_name" "secure_api" {
  domain_name              = var.api_domain
  regional_certificate_arn = var.certificate_arn

  security_policy = "TLS_1_2"

  endpoint_configuration {
    types = ["REGIONAL"]
  }
}`,
    opa: `# PR.DS-2 - Data-in-transit protection
package nist.pr_ds_2

import rego.v1

deny contains msg if {
  resource := input.resource.aws_api_gateway_domain_name[name]
  resource.security_policy != "TLS_1_2"
  msg := sprintf("API Gateway '%s' must use TLS 1.2 (NIST PR.DS-2)", [name])
}`,
    cloudformation: `# PR.DS-2 - Data-in-transit protection
AWSTemplateFormatVersion: "2010-09-09"
Resources:
  SecureAPIDomain:
    Type: "AWS::ApiGateway::DomainName"
    Properties:
      DomainName: !Ref APIDomain
      SecurityPolicy: TLS_1_2
      RegionalCertificateArn: !Ref CertificateArn`,
  },
  {
    id: 'pt-nist-4', controlId: 'DE.CM-1', framework: 'NIST CSF',
    title: 'Network Monitoring',
    description: 'Enable VPC Flow Logs and GuardDuty for network monitoring.',
    terraform: `# DE.CM-1 - Network monitoring
resource "aws_flow_log" "all_traffic" {
  vpc_id               = var.vpc_id
  traffic_type         = "ALL"
  log_destination      = var.log_bucket_arn
  log_destination_type = "s3"

  tags = {
    Compliance = "NIST-DE.CM-1"
  }
}

resource "aws_guardduty_detector" "network_monitor" {
  enable = true
}`,
    opa: `# DE.CM-1 - Network monitoring
package nist.de_cm_1

import rego.v1

deny contains msg if {
  resource := input.resource.aws_vpc[name]
  not input.resource.aws_flow_log
  msg := sprintf("VPC '%s' must have flow logs (NIST DE.CM-1)", [name])
}`,
    cloudformation: `# DE.CM-1 - Network monitoring
AWSTemplateFormatVersion: "2010-09-09"
Resources:
  VPCFlowLog:
    Type: "AWS::EC2::FlowLog"
    Properties:
      ResourceId: !Ref VpcId
      ResourceType: VPC
      TrafficType: ALL
      LogDestination: !Ref LogBucketArn`,
  },

  // CIS
  {
    id: 'pt-cis-1', controlId: '1.1', framework: 'CIS',
    title: 'Asset Inventory with AWS Config',
    description: 'Enable AWS Config recorder for full asset inventory.',
    terraform: `# CIS 1.1 - Establish asset inventory
resource "aws_config_configuration_recorder" "main" {
  name     = "cis-config-recorder"
  role_arn = var.config_role_arn

  recording_group {
    all_supported                 = true
    include_global_resource_types = true
  }
}

resource "aws_config_delivery_channel" "main" {
  name           = "cis-config-delivery"
  s3_bucket_name = var.config_bucket_name

  snapshot_delivery_properties {
    delivery_frequency = "Six_Hours"
  }
}

resource "aws_config_configuration_recorder_status" "main" {
  name       = aws_config_configuration_recorder.main.name
  is_enabled = true
}`,
    opa: `# CIS 1.1 - Asset inventory
package cis.control_1_1

import rego.v1

deny contains msg if {
  not input.resource.aws_config_configuration_recorder
  msg := "AWS Config recorder must be enabled for asset inventory (CIS 1.1)"
}`,
    cloudformation: `# CIS 1.1 - Asset inventory
AWSTemplateFormatVersion: "2010-09-09"
Resources:
  ConfigRecorder:
    Type: "AWS::Config::ConfigurationRecorder"
    Properties:
      RecordingGroup:
        AllSupported: true
        IncludeGlobalResourceTypes: true
      RoleARN: !Ref ConfigRoleArn`,
  },
  {
    id: 'pt-cis-2', controlId: '4.1', framework: 'CIS',
    title: 'Secure Configuration Baseline',
    description: 'AWS Config rules for CIS benchmark configuration checks.',
    terraform: `# CIS 4.1 - Secure configuration process
resource "aws_config_config_rule" "root_mfa" {
  name = "cis-root-account-mfa"
  source {
    owner             = "AWS"
    source_identifier = "ROOT_ACCOUNT_MFA_ENABLED"
  }
}

resource "aws_config_config_rule" "no_public_s3" {
  name = "cis-s3-bucket-public-read-prohibited"
  source {
    owner             = "AWS"
    source_identifier = "S3_BUCKET_PUBLIC_READ_PROHIBITED"
  }
}

resource "aws_config_config_rule" "encrypted_volumes" {
  name = "cis-encrypted-volumes"
  source {
    owner             = "AWS"
    source_identifier = "ENCRYPTED_VOLUMES"
  }
}`,
    opa: `# CIS 4.1 - Secure configuration
package cis.control_4_1

import rego.v1

deny contains msg if {
  resource := input.resource.aws_s3_bucket[name]
  acl := resource.acl
  acl == "public-read"
  msg := sprintf("S3 bucket '%s' must not be public (CIS 4.1)", [name])
}`,
    cloudformation: `# CIS 4.1 - Secure configuration
AWSTemplateFormatVersion: "2010-09-09"
Resources:
  RootMFARule:
    Type: "AWS::Config::ConfigRule"
    Properties:
      ConfigRuleName: cis-root-account-mfa
      Source:
        Owner: AWS
        SourceIdentifier: ROOT_ACCOUNT_MFA_ENABLED`,
  },
  {
    id: 'pt-cis-3', controlId: '5.1', framework: 'CIS',
    title: 'Account Management',
    description: 'Enforce IAM password policy and access key rotation.',
    terraform: `# CIS 5.1 - Account management process
resource "aws_iam_account_password_policy" "cis" {
  minimum_password_length        = 14
  require_lowercase_characters   = true
  require_uppercase_characters   = true
  require_numbers                = true
  require_symbols                = true
  max_password_age               = 90
  password_reuse_prevention      = 24
  allow_users_to_change_password = true
}

resource "aws_config_config_rule" "access_key_rotation" {
  name = "cis-access-key-rotation"
  source {
    owner             = "AWS"
    source_identifier = "ACCESS_KEYS_ROTATED"
  }
  input_parameters = jsonencode({
    maxAccessKeyAge = "90"
  })
}`,
    opa: `# CIS 5.1 - Account management
package cis.control_5_1

import rego.v1

deny contains msg if {
  resource := input.resource.aws_iam_account_password_policy[name]
  resource.minimum_password_length < 14
  msg := "Password policy must require min 14 characters (CIS 5.1)"
}`,
    cloudformation: `# CIS 5.1 - Account management
AWSTemplateFormatVersion: "2010-09-09"
Resources:
  AccessKeyRotationRule:
    Type: "AWS::Config::ConfigRule"
    Properties:
      ConfigRuleName: cis-access-key-rotation
      Source:
        Owner: AWS
        SourceIdentifier: ACCESS_KEYS_ROTATED
      InputParameters:
        maxAccessKeyAge: "90"`,
  },
  {
    id: 'pt-cis-4', controlId: '8.2', framework: 'CIS',
    title: 'Audit Log Collection',
    description: 'CloudTrail with multi-region and log validation.',
    terraform: `# CIS 8.2 - Collect audit logs
resource "aws_cloudtrail" "cis_audit" {
  name                       = "cis-audit-trail"
  s3_bucket_name             = var.audit_bucket_name
  is_multi_region_trail      = true
  enable_log_file_validation = true
  include_global_service_events = true

  cloud_watch_logs_group_arn = "\${var.log_group_arn}:*"
  cloud_watch_logs_role_arn  = var.cloudwatch_role_arn

  tags = {
    Compliance = "CIS-8.2"
  }
}`,
    opa: `# CIS 8.2 - Audit log collection
package cis.control_8_2

import rego.v1

deny contains msg if {
  resource := input.resource.aws_cloudtrail[name]
  not resource.is_multi_region_trail
  msg := sprintf("CloudTrail '%s' must be multi-region (CIS 8.2)", [name])
}`,
    cloudformation: `# CIS 8.2 - Audit log collection
AWSTemplateFormatVersion: "2010-09-09"
Resources:
  CISAuditTrail:
    Type: "AWS::CloudTrail::Trail"
    Properties:
      TrailName: cis-audit-trail
      S3BucketName: !Ref AuditBucketName
      IsMultiRegionTrail: true
      EnableLogFileValidation: true
      IncludeGlobalServiceEvents: true`,
  },
]

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

type ComplianceCodeState = {
  selectedFramework: Framework
  controls: Record<Framework, Control[]>
  policyTemplates: PolicyTemplate[]
  generatedPolicies: GeneratedPolicy[]
  activeFormat: PolicyFormat

  selectFramework: (framework: Framework) => void
  setActiveFormat: (format: PolicyFormat) => void
  generatePolicy: (controlId: string) => void
  exportPolicies: () => { filename: string; content: string }[]
}

export const useComplianceCodeStore = create<ComplianceCodeState>((set, get) => ({
  selectedFramework: 'SOC2',
  controls: frameworkControls,
  policyTemplates,
  generatedPolicies: [],
  activeFormat: 'terraform',

  selectFramework: (framework) => set({ selectedFramework: framework }),

  setActiveFormat: (format) => set({ activeFormat: format }),

  generatePolicy: (controlId) => {
    const { selectedFramework, policyTemplates, generatedPolicies, activeFormat } = get()
    const template = policyTemplates.find(
      (t) => t.controlId === controlId && t.framework === selectedFramework,
    )
    if (!template) return

    const code =
      activeFormat === 'terraform'
        ? template.terraform
        : activeFormat === 'opa'
          ? template.opa
          : template.cloudformation

    const existing = generatedPolicies.find(
      (p) => p.controlId === controlId && p.framework === selectedFramework && p.format === activeFormat,
    )
    if (existing) return

    const policy: GeneratedPolicy = {
      id: `gen-${Date.now()}`,
      controlId,
      framework: selectedFramework,
      title: template.title,
      format: activeFormat,
      code,
      generatedAt: new Date(),
    }

    set({ generatedPolicies: [...generatedPolicies, policy] })
  },

  exportPolicies: () => {
    const { generatedPolicies } = get()
    return generatedPolicies.map((p) => {
      const ext = p.format === 'terraform' ? 'tf' : p.format === 'opa' ? 'rego' : 'yaml'
      return {
        filename: `${p.framework.toLowerCase()}-${p.controlId.replace(/[^a-zA-Z0-9]/g, '-')}.${ext}`,
        content: p.code,
      }
    })
  },
}))
