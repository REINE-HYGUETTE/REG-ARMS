import type { ReactNode } from 'react'
import { clsx } from 'clsx'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

type Variant = 'default' | 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'teal'

interface TrendInfo {
  value: string
  direction?: 'up' | 'down' | 'neutral'
}

interface Props {
  label:     string
  value:     string | number
  icon:      ReactNode
  trend?:    string | TrendInfo
  variant?:  Variant
  className?: string
}

const variantStyles: Record<Variant, { icon: string; accent: string; badge: string }> = {
  default: { icon: 'bg-slate-100  text-slate-500',  accent: 'from-slate-400  to-slate-300',  badge: 'text-slate-500'  },
  blue:    { icon: 'bg-blue-100   text-blue-600',   accent: 'from-blue-500   to-blue-400',   badge: 'text-blue-600'   },
  green:   { icon: 'bg-emerald-100 text-emerald-600',accent: 'from-emerald-500 to-emerald-400',badge: 'text-emerald-600'},
  amber:   { icon: 'bg-amber-100  text-amber-600',  accent: 'from-amber-500  to-amber-400',  badge: 'text-amber-600'  },
  red:     { icon: 'bg-red-100    text-red-600',    accent: 'from-red-500    to-red-400',    badge: 'text-red-600'    },
  purple:  { icon: 'bg-violet-100 text-violet-600', accent: 'from-violet-500 to-violet-400', badge: 'text-violet-600' },
  teal:    { icon: 'bg-teal-100   text-teal-600',   accent: 'from-teal-500   to-teal-400',   badge: 'text-teal-600'   },
}

export default function MetricCard({ label, value, icon, trend, variant = 'default', className }: Props) {
  const styles = variantStyles[variant]

  // Normalise trend prop
  const trendInfo: TrendInfo | null =
    trend == null     ? null
    : typeof trend === 'string' ? { value: trend, direction: 'neutral' }
    : trend

  const TrendIcon =
    trendInfo?.direction === 'up'   ? TrendingUp
    : trendInfo?.direction === 'down' ? TrendingDown
    : Minus

  const trendColor =
    trendInfo?.direction === 'up'   ? 'text-emerald-600'
    : trendInfo?.direction === 'down' ? 'text-red-500'
    : 'text-text-muted'

  return (
    <div className={clsx(
      'relative bg-white rounded-2xl border border-border/70 shadow-sm overflow-hidden',
      'transition-all duration-200 hover:shadow-md hover:-translate-y-0.5',
      className,
    )}>
      {/* Accent bar */}
      <div className={clsx('absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r', styles.accent)} />

      <div className="p-5 pt-6">
        <div className="flex items-start justify-between mb-4">
          <span className="text-[11px] font-bold text-text-muted uppercase tracking-widest leading-none">{label}</span>
          <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', styles.icon)}>
            <span className="[&>svg]:w-[18px] [&>svg]:h-[18px]">{icon}</span>
          </div>
        </div>

        <div className="text-3xl font-bold text-text tracking-tight leading-none mb-2">{value}</div>

        {trendInfo && (
          <div className={clsx('flex items-center gap-1 text-[11px] font-semibold', trendColor)}>
            <TrendIcon size={12} />
            <span>{trendInfo.value}</span>
          </div>
        )}
      </div>
    </div>
  )
}
