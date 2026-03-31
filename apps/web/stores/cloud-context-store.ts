import { create } from 'zustand';

type CloudProvider = 'aws' | 'gcp' | 'azure';

type CloudContextState = {
  provider: CloudProvider;
  region: string;
  accountId: string;
  accountName: string;
  availableAccounts: Array<{ id: string; name: string; provider: CloudProvider }>;
  setProvider: (provider: CloudProvider) => void;
  setRegion: (region: string) => void;
  setAccount: (accountId: string, accountName: string) => void;
  setAvailableAccounts: (accounts: Array<{ id: string; name: string; provider: CloudProvider }>) => void;
};

const defaultRegions: Record<CloudProvider, string> = {
  aws: 'us-east-1',
  gcp: 'us-central1',
  azure: 'eastus',
};

export const useCloudContextStore = create<CloudContextState>((set) => ({
  provider: 'aws',
  region: defaultRegions.aws,
  accountId: '',
  accountName: '',
  availableAccounts: [],

  setProvider: (provider) =>
    set({ provider, region: defaultRegions[provider] }),

  setRegion: (region) => set({ region }),

  setAccount: (accountId, accountName) => set({ accountId, accountName }),

  setAvailableAccounts: (accounts) => set({ availableAccounts: accounts }),
}));

export type { CloudProvider, CloudContextState };
