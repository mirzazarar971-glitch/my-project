import { create } from 'zustand'
import { useMemo } from 'react'
import { tools } from '../tools/catalog'

type Availability = {
  enabledSlugs: string[] | null
  setEnabledSlugs: (slugs: string[]) => void
  setToolEnabled: (slug: string, isActive: boolean) => void
  isEnabled: (slug: string) => boolean
  activeTools: () => typeof tools
}

export const useAvailability = create<Availability>((set, get) => ({
  enabledSlugs: null,
  setEnabledSlugs: (slugs) => set({ enabledSlugs: [...new Set(slugs)] }),
  setToolEnabled: (slug, isActive) => set((state) => ({
    enabledSlugs: isActive
      ? [...new Set([...(state.enabledSlugs ?? tools.map((tool) => tool.slug)), slug])]
      : (state.enabledSlugs ?? tools.map((tool) => tool.slug)).filter((item) => item !== slug),
  })),
  isEnabled: (slug) => get().enabledSlugs?.includes(slug) ?? true,
  activeTools: () => {
    const enabled = get().enabledSlugs
    return enabled ? tools.filter((tool) => enabled.includes(tool.slug)) : tools
  },
}))

export function useActiveTools() {
  const enabledSlugs = useAvailability((state) => state.enabledSlugs)
  return useMemo(
    () => enabledSlugs ? tools.filter((tool) => enabledSlugs.includes(tool.slug)) : tools,
    [enabledSlugs],
  )
}
