import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Brain, Info, CheckCircle, XCircle, AlertTriangle, TrendingUp, RefreshCw } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LineChart, Line, Legend,
} from 'recharts'
import api from '@/lib/api'
import Spinner from '@/components/ui/Spinner'
import { PriorityBadge } from '@/components/ui/Badge'

// Colour palette per priority
const PRIORITY_COLOURS: Record<string, string> = {
  Critical: '#F43F5E',
  High:     '#F97316',
  Medium:   '#F59E0B',
  Low:      '#10B981',
}
const BLUE = '#3B82F6'

// ── Types ────────────────────────────────────────────────────────────────────

interface AiSummary {
  totalPredictions: number
  manualOverrides:  number
  overrideRate:     number
  overallAccuracy:  number
  totalConfirmed:   number
  totalCorrect:     number
}

interface AccuracyRow {
  priority:   string
  total:      number
  correct:    number
  accuracy:   number
  confidence: number
}

interface ConfDist {
  range: string
  count: number
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AIPredictionsPage() {
  const [retraining, setRetraining]       = useState(false)
  const [retrainMsg, setRetrainMsg]       = useState<string | null>(null)
  const [retrainError, setRetrainError]   = useState<string | null>(null)

  const handleRetrain = async () => {
    setRetraining(true)
    setRetrainMsg(null)
    setRetrainError(null)
    try {
      const { data } = await api.post<{ message: string }>('/ai/retrain')
      setRetrainMsg(data.message ?? 'Model retrained successfully.')
    } catch (err: any) {
      setRetrainError(err?.response?.data?.message ?? 'Retrain failed. Check that the AI service is running.')
    } finally {
      setRetraining(false)
    }
  }

  // 1. Summary — uses aiPredictionRepository.count() → ALL predictions, not just confirmed
  const { data: summary, isLoading: loadingSummary } = useQuery<AiSummary>({
    queryKey: ['ai-summary'],
    queryFn: async () => {
      const { data } = await api.get<AiSummary>('/reports/ai-summary')
      return data
    },
  })

  // 2. Accuracy breakdown (only confirmed rows — WHERE actualPriority IS NOT NULL)
  const { data: aiData, isLoading: loadingAccuracy } = useQuery<AccuracyRow[]>({
    queryKey: ['ai-accuracy'],
    queryFn: async () => {
      const { data } = await api.get<
        { predictedPriority: string; total: number; correct: number; avgConfidence: number }[]
      >('/reports/ai-accuracy')
      return data.map((d) => ({
        priority:   d.predictedPriority,
        total:      Number(d.total),
        correct:    Number(d.correct),
        accuracy:   d.total > 0 ? (d.correct / d.total) * 100 : 0,
        confidence: Number(d.avgConfidence),
      }))
    },
  })

  // 3. Confidence distribution histogram
  const { data: confDist } = useQuery<ConfDist[]>({
    queryKey: ['ai-conf-dist'],
    queryFn: async () => {
      const { data } = await api.get<ConfDist[]>('/reports/ai-confidence-distribution')
      return data
    },
  })

  const isLoading = loadingSummary || loadingAccuracy

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>

  // ── Derived values ───────────────────────────────────────────────────────

  const totalPredictions = summary?.totalPredictions ?? 0
  const totalConfirmed   = summary?.totalConfirmed   ?? 0
  const overallAccuracy  = summary?.overallAccuracy  ?? 0
  const totalCorrect     = summary?.totalCorrect     ?? 0
  const manualOverrides  = summary?.manualOverrides  ?? 0
  const overrideRate     = summary?.overrideRate     ?? 0

  const hasAccuracyData  = (aiData?.length ?? 0) > 0
  const hasPredictions   = totalPredictions > 0

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h2 className="text-lg font-bold mb-0.5 flex items-center gap-2">
            <Brain size={20} /> AI Predictions Dashboard
          </h2>
          <p className="text-xs text-text-muted">
            TF-IDF + Logistic Regression + Random Forest + Naïve Bayes ensemble
          </p>
        </div>
        <div className="shrink-0 text-right">
          <button
            onClick={handleRetrain}
            disabled={retraining}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-dark transition-colors disabled:opacity-60"
          >
            <RefreshCw size={15} className={retraining ? 'animate-spin' : ''} />
            {retraining ? 'Retraining…' : 'Retrain Model'}
          </button>
          {retrainMsg && (
            <p className="text-xs text-green-600 mt-1 max-w-[220px]">{retrainMsg}</p>
          )}
          {retrainError && (
            <p className="text-xs text-red-600 mt-1 max-w-[220px]">{retrainError}</p>
          )}
        </div>
      </div>

      {/* ── Info banner when no predictions exist yet ── */}
      {!hasPredictions && (
        <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-sm text-blue-800">
          <Info size={18} className="mt-0.5 shrink-0 text-blue-500" />
          <div>
            <strong>No predictions recorded yet.</strong>
            <br />
            AI predictions are created automatically each time a customer submits a request.
            Once the first request is submitted, metrics will appear here.
          </div>
        </div>
      )}

      {/* ── Info banner when predictions exist but none are confirmed ── */}
      {hasPredictions && !hasAccuracyData && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-sm text-amber-800">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-500" />
          <div>
            <strong>{totalPredictions} prediction{totalPredictions !== 1 ? 's' : ''} made — accuracy data pending.</strong>
            <br />
            Accuracy is calculated once a staff member sets a <em>Priority Override</em> on a request
            (or after 48 hours if no override is made, the AI is implicitly marked correct).
            Charts will populate once confirmed data is available.
          </div>
        </div>
      )}

      {/* ── Summary Metrics ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <MetricCard
          label="Total Predictions"
          value={totalPredictions.toLocaleString()}
          colour="text-blue-600"
          icon={<Brain size={16} />}
        />
        <MetricCard
          label="Confirmed"
          value={totalConfirmed.toLocaleString()}
          colour="text-indigo-600"
          icon={<CheckCircle size={16} />}
          sub={totalPredictions > 0 ? `${((totalConfirmed / totalPredictions) * 100).toFixed(0)}% of total` : undefined}
        />
        <MetricCard
          label="Overall Accuracy"
          value={totalConfirmed > 0 ? `${overallAccuracy.toFixed(1)}%` : '—'}
          colour="text-green-600"
          icon={<TrendingUp size={16} />}
          sub={totalConfirmed > 0 ? `${totalCorrect} correct` : 'No confirmed data'}
        />
        <MetricCard
          label="Correct"
          value={totalCorrect.toLocaleString()}
          colour="text-green-600"
          icon={<CheckCircle size={16} />}
        />
        <MetricCard
          label="Misclassified"
          value={(totalConfirmed - totalCorrect).toLocaleString()}
          colour="text-red-500"
          icon={<XCircle size={16} />}
        />
        <MetricCard
          label="Override Rate"
          value={hasPredictions ? `${overrideRate.toFixed(1)}%` : '—'}
          colour="text-amber-600"
          icon={<AlertTriangle size={16} />}
          sub={hasPredictions ? `${manualOverrides} overrides` : undefined}
        />
      </div>

      {/* ── Charts — only shown when confirmed accuracy data exists ── */}
      {hasAccuracyData && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* Accuracy by Priority */}
          <div className="bg-white rounded-xl border border-border shadow-sm">
            <div className="px-5 py-4 border-b border-border">
              <span className="text-sm font-bold">Accuracy by Priority Level</span>
              <p className="text-xs text-text-muted mt-0.5">% of confirmed predictions classified correctly</p>
            </div>
            <div className="p-5">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={aiData ?? []} barCategoryGap="35%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f5f1" />
                  <XAxis dataKey="priority" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                  <Tooltip formatter={(v) => [`${Number(v).toFixed(1)}%`, 'Accuracy']} />
                  <Bar dataKey="accuracy" name="Accuracy %" radius={[6, 6, 0, 0]}>
                    {(aiData ?? []).map((e) => (
                      <Cell key={e.priority} fill={PRIORITY_COLOURS[e.priority] ?? BLUE} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Avg Confidence by Priority */}
          <div className="bg-white rounded-xl border border-border shadow-sm">
            <div className="px-5 py-4 border-b border-border">
              <span className="text-sm font-bold">Average Confidence by Priority</span>
              <p className="text-xs text-text-muted mt-0.5">Model's self-reported certainty per class</p>
            </div>
            <div className="p-5">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={aiData ?? []} barCategoryGap="35%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f5f1" />
                  <XAxis dataKey="priority" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 1]} tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                  <Tooltip formatter={(v) => [`${(Number(v) * 100).toFixed(1)}%`, 'Confidence']} />
                  <Bar dataKey="confidence" name="Avg Confidence" radius={[4, 4, 0, 0]}>
                    {(aiData ?? []).map((e) => (
                      <Cell key={e.priority} fill={PRIORITY_COLOURS[e.priority] ?? BLUE} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ── Confidence Distribution (shown whenever there are predictions) ── */}
      {hasPredictions && (confDist?.length ?? 0) > 0 && (
        <div className="bg-white rounded-xl border border-border shadow-sm mb-6">
          <div className="px-5 py-4 border-b border-border">
            <span className="text-sm font-bold">Confidence Score Distribution</span>
            <p className="text-xs text-text-muted mt-0.5">How certain the model is across all {totalPredictions} predictions</p>
          </div>
          <div className="p-5">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={confDist} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f5f1" />
                <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" name="Predictions" fill={BLUE} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Detail Table — only when confirmed data exists ── */}
      {hasAccuracyData && (
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-border">
            <div className="text-sm font-semibold">Model Performance by Priority</div>
            <div className="text-xs text-text-muted mt-0.5">
              Based on {totalConfirmed} confirmed prediction{totalConfirmed !== 1 ? 's' : ''}
              {' '}({totalPredictions - totalConfirmed} pending confirmation)
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-alt border-b border-border">
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-text-muted uppercase">Priority</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-text-muted uppercase">Confirmed</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-text-muted uppercase">Correct</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-text-muted uppercase">Accuracy</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-text-muted uppercase">Avg Confidence</th>
                </tr>
              </thead>
              <tbody>
                {(aiData ?? []).map((row) => (
                  <tr key={row.priority} className="border-b border-border last:border-0 hover:bg-surface-alt">
                    <td className="px-4 py-3"><PriorityBadge priority={row.priority as any} /></td>
                    <td className="px-4 py-3 text-sm">{row.total}</td>
                    <td className="px-4 py-3 text-sm text-green-700 font-semibold">{row.correct}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden max-w-[80px]">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${row.accuracy}%`,
                              backgroundColor: PRIORITY_COLOURS[row.priority] ?? BLUE,
                            }}
                          />
                        </div>
                        <span className="text-xs font-mono font-semibold">{row.accuracy.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold">{(row.confidence * 100).toFixed(1)}%</td>
                  </tr>
                ))}
                {/* Totals row */}
                <tr className="bg-surface-alt font-semibold">
                  <td className="px-4 py-3 text-xs uppercase text-text-muted">Total</td>
                  <td className="px-4 py-3 text-sm">{totalConfirmed}</td>
                  <td className="px-4 py-3 text-sm text-green-700">{totalCorrect}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-mono font-semibold">
                      {totalConfirmed > 0 ? `${overallAccuracy.toFixed(1)}%` : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-text-muted">—</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── How accuracy is measured ── */}
      <div className="bg-gray-50 border border-border rounded-xl p-4 text-xs text-text-muted">
        <strong className="text-text-primary block mb-1">How accuracy is measured</strong>
        <ul className="list-disc pl-4 space-y-1">
          <li>
            <strong>Explicit confirmation:</strong> when a staff member sets a Priority Override, the AI's prediction
            is compared against that ground-truth label and marked correct or incorrect immediately.
          </li>
          <li>
            <strong>Implicit confirmation:</strong> predictions older than 48 hours with no override are automatically
            marked correct (staff reviewed and agreed with the AI).
          </li>
          <li>
            <strong>Override rate:</strong> {overrideRate > 0 ? `${overrideRate.toFixed(1)}%` : 'no overrides yet'} of predictions were manually corrected.
            A healthy rate is typically below 15%.
          </li>
        </ul>
      </div>
    </div>
  )
}

// ── Reusable metric card ──────────────────────────────────────────────────────

function MetricCard({
  label, value, colour, icon, sub,
}: {
  label: string
  value: string | number
  colour: string
  icon?: React.ReactNode
  sub?: string
}) {
  return (
    <div className="bg-white rounded-xl border border-border p-4 shadow-sm">
      <div className={`text-2xl font-bold ${colour} flex items-center gap-1.5`}>
        {icon && <span className={`opacity-60 ${colour}`}>{icon}</span>}
        {value}
      </div>
      <div className="text-xs text-text-muted mt-1">{label}</div>
      {sub && <div className="text-[10px] text-text-muted mt-0.5 opacity-75">{sub}</div>}
    </div>
  )
}
