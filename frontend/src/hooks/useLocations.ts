import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

export interface IdName { id: number; name: string }

const fetch = async <T>(url: string, params?: Record<string, unknown>): Promise<T> => {
  const { data } = await api.get<T>(url, { params })
  return data
}

export function useProvinces() {
  return useQuery<IdName[]>({
    queryKey: ['loc-provinces'],
    queryFn: () => fetch('/locations/provinces'),
    staleTime: Infinity,
  })
}

export function useDistricts(provinceId: number | null) {
  return useQuery<IdName[]>({
    queryKey: ['loc-districts', provinceId],
    queryFn: () => fetch('/locations/districts', { provinceId }),
    enabled: provinceId != null,
    staleTime: Infinity,
  })
}

export function useSectors(districtId: number | null) {
  return useQuery<IdName[]>({
    queryKey: ['loc-sectors', districtId],
    queryFn: () => fetch('/locations/sectors', { districtId }),
    enabled: districtId != null,
    staleTime: Infinity,
  })
}

export function useCells(sectorId: number | null) {
  return useQuery<IdName[]>({
    queryKey: ['loc-cells', sectorId],
    queryFn: () => fetch('/locations/cells', { sectorId }),
    enabled: sectorId != null,
    staleTime: Infinity,
  })
}

export function useVillages(cellId: number | null) {
  return useQuery<IdName[]>({
    queryKey: ['loc-villages', cellId],
    queryFn: () => fetch('/locations/villages', { cellId }),
    enabled: cellId != null,
    staleTime: Infinity,
  })
}
