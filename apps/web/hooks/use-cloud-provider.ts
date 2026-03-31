import { useCloudContextStore, type CloudProvider } from '@/stores/cloud-context-store';

type CloudProviderContext = {
  provider: CloudProvider;
  region: string;
  accountId: string;
  accountName: string;
};

export function useCloudProvider(): CloudProviderContext {
  const provider = useCloudContextStore((s) => s.provider);
  const region = useCloudContextStore((s) => s.region);
  const accountId = useCloudContextStore((s) => s.accountId);
  const accountName = useCloudContextStore((s) => s.accountName);

  return { provider, region, accountId, accountName };
}
