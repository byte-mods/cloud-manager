import type { Node, Edge } from "@xyflow/react"
import type { ServiceNode, CloudProvider } from "@/stores/infrastructure-store"

function bicepName(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9]/g, "").replace(/^[^a-zA-Z]/, "r")
}

const azureResourceMap: Record<string, { type: string; apiVersion: string; propsGen: (sn: ServiceNode) => string }> = {
  EC2: {
    type: "Microsoft.Compute/virtualMachines",
    apiVersion: "2024-03-01",
    propsGen: (sn) => `  properties: {
    hardwareProfile: { vmSize: '${sn.config?.instanceType ?? "Standard_D2s_v3"}' }
    osProfile: {
      computerName: '${sn.label}'
      adminUsername: adminUsername
      adminPassword: adminPassword
    }
    storageProfile: {
      imageReference: {
        publisher: 'Canonical'
        offer: '0001-com-ubuntu-server-jammy'
        sku: '22_04-lts-gen2'
        version: 'latest'
      }
      osDisk: { createOption: 'FromImage', managedDisk: { storageAccountType: 'Premium_LRS' } }
    }
    networkProfile: { networkInterfaces: [{ id: nic.id }] }
  }`,
  },
  S3: {
    type: "Microsoft.Storage/storageAccounts",
    apiVersion: "2023-01-01",
    propsGen: (sn) => `  kind: 'StorageV2'
  sku: { name: 'Standard_LRS' }
  properties: {
    supportsHttpsTrafficOnly: true
    encryption: { services: { blob: { enabled: true } }, keySource: 'Microsoft.Storage' }
    minimumTlsVersion: 'TLS1_2'
  }`,
  },
  VPC: {
    type: "Microsoft.Network/virtualNetworks",
    apiVersion: "2023-09-01",
    propsGen: (sn) => `  properties: {
    addressSpace: { addressPrefixes: ['${sn.config?.cidr ?? "10.0.0.0/16"}'] }
    subnets: [
      { name: 'default', properties: { addressPrefix: '10.0.1.0/24' } }
      { name: 'backend', properties: { addressPrefix: '10.0.2.0/24' } }
    ]
  }`,
  },
  RDS: {
    type: "Microsoft.Sql/servers",
    apiVersion: "2023-05-01-preview",
    propsGen: (sn) => `  properties: {
    administratorLogin: adminUsername
    administratorLoginPassword: adminPassword
    version: '12.0'
    minimalTlsVersion: '1.2'
  }`,
  },
  Lambda: {
    type: "Microsoft.Web/sites",
    apiVersion: "2023-01-01",
    propsGen: (sn) => `  kind: 'functionapp'
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      appSettings: [
        { name: 'FUNCTIONS_WORKER_RUNTIME', value: '${sn.config?.runtime?.includes("node") ? "node" : "dotnet"}' }
        { name: 'FUNCTIONS_EXTENSION_VERSION', value: '~4' }
      ]
    }
    httpsOnly: true
  }`,
  },
  EKS: {
    type: "Microsoft.ContainerService/managedClusters",
    apiVersion: "2024-01-01",
    propsGen: (sn) => `  properties: {
    kubernetesVersion: '${sn.config?.version ?? "1.30"}'
    dnsPrefix: '${sn.label}-dns'
    agentPoolProfiles: [{
      name: 'default'
      count: 3
      vmSize: 'Standard_D2s_v3'
      mode: 'System'
    }]
    identity: { type: 'SystemAssigned' }
  }`,
  },
  ALB: {
    type: "Microsoft.Network/loadBalancers",
    apiVersion: "2023-09-01",
    propsGen: (sn) => `  sku: { name: 'Standard' }
  properties: {
    frontendIPConfigurations: [{
      name: 'frontend'
      properties: { publicIPAddress: { id: publicIp.id } }
    }]
  }`,
  },
  DynamoDB: {
    type: "Microsoft.DocumentDB/databaseAccounts",
    apiVersion: "2023-11-15",
    propsGen: (sn) => `  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    locations: [{ locationName: location, failoverPriority: 0 }]
    consistencyPolicy: { defaultConsistencyLevel: 'Session' }
  }`,
  },
  ElastiCache: {
    type: "Microsoft.Cache/redis",
    apiVersion: "2023-08-01",
    propsGen: (sn) => `  properties: {
    sku: { name: 'Standard', family: 'C', capacity: 1 }
    enableNonSslPort: false
    minimumTlsVersion: '1.2'
  }`,
  },
  EFS: {
    type: "Microsoft.Storage/storageAccounts/fileServices/shares",
    apiVersion: "2023-01-01",
    propsGen: () => `  properties: { shareQuota: 100 }`,
  },
  SQS: {
    type: "Microsoft.ServiceBus/namespaces/queues",
    apiVersion: "2022-10-01-preview",
    propsGen: (sn) => `  properties: {
    maxSizeInMegabytes: 5120
    defaultMessageTimeToLive: 'P14D'
  }`,
  },
  SNS: {
    type: "Microsoft.ServiceBus/namespaces/topics",
    apiVersion: "2022-10-01-preview",
    propsGen: (sn) => `  properties: {
    maxSizeInMegabytes: 5120
    defaultMessageTimeToLive: 'P14D'
  }`,
  },
  WAF: {
    type: "Microsoft.Network/FrontDoorWebApplicationFirewallPolicies",
    apiVersion: "2022-05-01",
    propsGen: (sn) => `  sku: { name: 'Premium_AzureFrontDoor' }
  properties: {
    policySettings: { enabledState: 'Enabled', mode: 'Prevention' }
  }`,
  },
  "API Gateway": {
    type: "Microsoft.ApiManagement/service",
    apiVersion: "2023-05-01-preview",
    propsGen: (sn) => `  sku: { name: 'Developer', capacity: 1 }
  properties: {
    publisherEmail: 'admin@example.com'
    publisherName: '${sn.label}'
  }`,
  },
}

export function generateBicep(
  nodes: Node[],
  edges: Edge[],
  provider: CloudProvider,
  projectName: string,
): Record<string, string> {
  let params = `// Parameters\nparam location string = resourceGroup().location\nparam environment string = 'production'\nparam adminUsername string\n@secure()\nparam adminPassword string\n\n`
  let resources = ""

  for (const node of nodes) {
    const sn = node.data as ServiceNode
    if (!sn?.type) continue
    const mapping = azureResourceMap[sn.type]
    if (!mapping) continue
    const name = bicepName(sn.label || sn.type)
    const nameStr = sn.label.toLowerCase().replace(/[^a-z0-9-]/g, "-")

    resources += `resource ${name} '${mapping.type}@${mapping.apiVersion}' = {\n`
    resources += `  name: '${nameStr}'\n`
    resources += `  location: location\n`
    resources += mapping.propsGen(sn) + "\n"
    resources += `}\n\n`
  }

  const main = `// ${projectName} - Generated by Cloud Manager\ntargetScope = 'resourceGroup'\n\n${params}${resources}`

  return { "main.bicep": main }
}

export function downloadBicepFile(content: string, projectName: string) {
  const blob = new Blob([content], { type: "text/plain" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${projectName}-main.bicep`
  a.click()
  URL.revokeObjectURL(url)
}
