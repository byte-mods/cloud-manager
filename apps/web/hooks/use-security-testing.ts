import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export type ComplianceFramework = {
  id: string;
  name: string;
  description: string;
  status: 'compliant' | 'non-compliant' | 'partial';
  controlsPassed: number;
  controlsFailed: number;
  controlsTotal: number;
  lastAssessed: string;
};

export type ComplianceControl = {
  id: string;
  frameworkId: string;
  name: string;
  description: string;
  status: 'passed' | 'failed' | 'not-assessed';
  severity: 'critical' | 'high' | 'medium' | 'low';
  evidence: string | null;
  lastChecked: string;
};

export type DDoSTest = {
  id: string;
  name: string;
  targetEndpoint: string;
  status: 'completed' | 'running' | 'scheduled' | 'failed';
  type: string;
  startedAt: string;
  completedAt: string | null;
  maxRps: number;
  result: 'passed' | 'failed' | 'inconclusive' | null;
};

export type PenTest = {
  id: string;
  name: string;
  scope: string;
  status: 'completed' | 'in-progress' | 'scheduled';
  startDate: string;
  endDate: string | null;
  findingsCount: number;
  criticalFindings: number;
  tester: string;
};

export type RemediationItem = {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'in-progress' | 'resolved' | 'accepted';
  source: string;
  assignee: string | null;
  dueDate: string | null;
  createdAt: string;
};

export type VAPTScan = {
  id: string;
  name: string;
  target: string;
  type: 'vulnerability' | 'penetration' | 'both';
  status: 'completed' | 'running' | 'scheduled' | 'failed';
  startedAt: string;
  completedAt: string | null;
  findingsCount: number;
  criticalCount: number;
  highCount: number;
};

export type VAPTFinding = {
  id: string;
  scanId: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  status: 'open' | 'fixed' | 'accepted' | 'false-positive';
  cveId: string | null;
  affectedAsset: string;
  remediation: string;
};

type UseSecurityTestingOptions = {
  enabled?: boolean;
};

export function useSecurityTestingOverview(options?: UseSecurityTestingOptions): UseQueryResult<{
  totalScans: number;
  openFindings: number;
  criticalFindings: number;
  complianceScore: number;
}> {
  return useQuery({
    queryKey: ['security-testing', 'overview'],
    queryFn: () => apiClient.get('/v1/security/scans/overview'),
    enabled: options?.enabled !== false,
  });
}

export function useComplianceFrameworks(options?: UseSecurityTestingOptions): UseQueryResult<{ frameworks: ComplianceFramework[] }> {
  return useQuery<{ frameworks: ComplianceFramework[] }>({
    queryKey: ['security-testing', 'compliance'],
    queryFn: () => apiClient.get<{ frameworks: ComplianceFramework[] }>('/v1/security/compliance'),
    enabled: options?.enabled !== false,
  });
}

export function useComplianceAssessment(framework: string, options?: UseSecurityTestingOptions): UseQueryResult<{ controls: ComplianceControl[] }> {
  return useQuery<{ controls: ComplianceControl[] }>({
    queryKey: ['security-testing', 'compliance', framework],
    queryFn: () => apiClient.get<{ controls: ComplianceControl[] }>(`/v1/security/compliance/${framework}`),
    enabled: options?.enabled !== false && !!framework,
  });
}

export function useDDoSTests(options?: UseSecurityTestingOptions): UseQueryResult<{ tests: DDoSTest[] }> {
  return useQuery<{ tests: DDoSTest[] }>({
    queryKey: ['security-testing', 'ddos'],
    queryFn: () => apiClient.get<{ tests: DDoSTest[] }>('/v1/security/ddos-tests'),
    enabled: options?.enabled !== false,
  });
}

export function usePenTests(options?: UseSecurityTestingOptions): UseQueryResult<{ tests: PenTest[] }> {
  return useQuery<{ tests: PenTest[] }>({
    queryKey: ['security-testing', 'pen-tests'],
    queryFn: () => apiClient.get<{ tests: PenTest[] }>('/v1/security/pen-tests'),
    enabled: options?.enabled !== false,
  });
}

export function useRemediationItems(options?: UseSecurityTestingOptions): UseQueryResult<{ items: RemediationItem[] }> {
  return useQuery<{ items: RemediationItem[] }>({
    queryKey: ['security-testing', 'remediation'],
    queryFn: () => apiClient.get<{ items: RemediationItem[] }>('/v1/security/remediation'),
    enabled: options?.enabled !== false,
  });
}

export function useVAPTScans(options?: UseSecurityTestingOptions): UseQueryResult<{ scans: VAPTScan[] }> {
  return useQuery<{ scans: VAPTScan[] }>({
    queryKey: ['security-testing', 'scans'],
    queryFn: () => apiClient.get<{ scans: VAPTScan[] }>('/v1/security/scans'),
    enabled: options?.enabled !== false,
  });
}

export function useVAPTScan(id: string, options?: UseSecurityTestingOptions): UseQueryResult<VAPTScan & { findings: VAPTFinding[] }> {
  return useQuery<VAPTScan & { findings: VAPTFinding[] }>({
    queryKey: ['security-testing', 'scan', id],
    queryFn: () => apiClient.get<VAPTScan & { findings: VAPTFinding[] }>(`/v1/security/scans/${id}`),
    enabled: options?.enabled !== false && !!id,
  });
}
