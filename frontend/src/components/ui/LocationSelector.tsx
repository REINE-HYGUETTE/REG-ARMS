import { useEffect, useState } from 'react'
import {
  useProvinces,
  useDistricts,
  useSectors,
  useCells,
  useVillages,
} from '@/hooks/useLocations'

export interface LocationValue {
  province: string
  district: string
  sector: string
  cell: string
  village: string
}

interface Props {
  value: LocationValue
  onChange: (val: LocationValue) => void
  /** When true the component renders compact inline labels (for profile forms) */
  compact?: boolean
  disabled?: boolean
}

const selectCls =
  'w-full px-3 py-2 border-[1.5px] border-border rounded-lg text-sm bg-surface-alt focus:border-primary outline-none disabled:opacity-50 disabled:cursor-not-allowed'

const labelCls =
  'block text-xs font-semibold text-text-secondary uppercase tracking-wide mb-1.5'

export default function LocationSelector({ value, onChange, compact = false, disabled = false }: Props) {
  // Internal IDs — drive the child queries without exposing IDs to parent
  const [provinceId, setProvinceId] = useState<number | null>(null)
  const [districtId, setDistrictId] = useState<number | null>(null)
  const [sectorId,   setSectorId]   = useState<number | null>(null)
  const [cellId,     setCellId]     = useState<number | null>(null)

  const { data: provinces = [] } = useProvinces()
  const { data: districts = [] } = useDistricts(provinceId)
  const { data: sectors   = [] } = useSectors(districtId)
  const { data: cells     = [] } = useCells(sectorId)
  const { data: villages  = [] } = useVillages(cellId)

  // When pre-existing text values arrive (e.g. editing a saved profile),
  // resolve them back to IDs so child dropdowns are populated.
  useEffect(() => {
    if (value.province && provinces.length) {
      const match = provinces.find((p) => p.name === value.province)
      if (match && match.id !== provinceId) setProvinceId(match.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.province, provinces])

  useEffect(() => {
    if (value.district && districts.length) {
      const match = districts.find((d) => d.name === value.district)
      if (match && match.id !== districtId) setDistrictId(match.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.district, districts])

  useEffect(() => {
    if (value.sector && sectors.length) {
      const match = sectors.find((s) => s.name === value.sector)
      if (match && match.id !== sectorId) setSectorId(match.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.sector, sectors])

  useEffect(() => {
    if (value.cell && cells.length) {
      const match = cells.find((c) => c.name === value.cell)
      if (match && match.id !== cellId) setCellId(match.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.cell, cells])

  const handleProvince = (name: string) => {
    const item = provinces.find((p) => p.name === name) ?? null
    setProvinceId(item?.id ?? null)
    setDistrictId(null)
    setSectorId(null)
    setCellId(null)
    onChange({ province: name, district: '', sector: '', cell: '', village: '' })
  }

  const handleDistrict = (name: string) => {
    const item = districts.find((d) => d.name === name) ?? null
    setDistrictId(item?.id ?? null)
    setSectorId(null)
    setCellId(null)
    onChange({ ...value, district: name, sector: '', cell: '', village: '' })
  }

  const handleSector = (name: string) => {
    const item = sectors.find((s) => s.name === name) ?? null
    setSectorId(item?.id ?? null)
    setCellId(null)
    onChange({ ...value, sector: name, cell: '', village: '' })
  }

  const handleCell = (name: string) => {
    const item = cells.find((c) => c.name === name) ?? null
    setCellId(item?.id ?? null)
    onChange({ ...value, cell: name, village: '' })
  }

  const handleVillage = (name: string) => {
    onChange({ ...value, village: name })
  }

  const wrapClass = compact ? 'grid grid-cols-2 gap-3' : 'space-y-4'

  return (
    <div className={wrapClass}>
      {/* Province */}
      <div>
        <label className={labelCls}>Province *</label>
        <select
          value={value.province}
          onChange={(e) => handleProvince(e.target.value)}
          disabled={disabled}
          className={selectCls}
        >
          <option value="">Select province…</option>
          {provinces.map((p) => (
            <option key={p.id} value={p.name}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* District */}
      <div>
        <label className={labelCls}>District *</label>
        <select
          value={value.district}
          onChange={(e) => handleDistrict(e.target.value)}
          disabled={disabled || !value.province}
          className={selectCls}
        >
          <option value="">Select district…</option>
          {districts.map((d) => (
            <option key={d.id} value={d.name}>{d.name}</option>
          ))}
        </select>
      </div>

      {/* Sector */}
      <div>
        <label className={labelCls}>Sector *</label>
        <select
          value={value.sector}
          onChange={(e) => handleSector(e.target.value)}
          disabled={disabled || !value.district}
          className={selectCls}
        >
          <option value="">Select sector…</option>
          {sectors.map((s) => (
            <option key={s.id} value={s.name}>{s.name}</option>
          ))}
        </select>
      </div>

      {/* Cell */}
      <div>
        <label className={labelCls}>Cell *</label>
        <select
          value={value.cell}
          onChange={(e) => handleCell(e.target.value)}
          disabled={disabled || !value.sector}
          className={selectCls}
        >
          <option value="">Select cell…</option>
          {cells.map((c) => (
            <option key={c.id} value={c.name}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Village (optional, spans full width) */}
      <div className={compact ? 'col-span-2' : ''}>
        <label className={labelCls}>Village <span className="font-normal normal-case text-text-muted">(optional)</span></label>
        <select
          value={value.village}
          onChange={(e) => handleVillage(e.target.value)}
          disabled={disabled || !value.cell}
          className={selectCls}
        >
          <option value="">Select village…</option>
          {villages.map((v) => (
            <option key={v.id} value={v.name}>{v.name}</option>
          ))}
        </select>
      </div>
    </div>
  )
}
