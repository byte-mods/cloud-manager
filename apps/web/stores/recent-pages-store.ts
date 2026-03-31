import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type RecentPage = {
  href: string
  title: string
  icon: string
}

type RecentPagesState = {
  recentPages: RecentPage[]
  addRecentPage: (page: { href: string; title: string; icon: string }) => void
}

export const useRecentPagesStore = create<RecentPagesState>()(
  persist(
    (set) => ({
      recentPages: [],
      addRecentPage: (page) =>
        set((state) => {
          const filtered = state.recentPages.filter((p) => p.href !== page.href)
          return { recentPages: [page, ...filtered].slice(0, 5) }
        }),
    }),
    {
      name: 'cloud-manager-recent-pages',
    },
  ),
)

export type { RecentPage, RecentPagesState }
