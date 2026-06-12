import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Upload, X, Brain, Loader2, AlertTriangle, Send, RotateCcw, Sparkles, Info } from 'lucide-react'
import api from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { PriorityBadge } from '@/components/ui/Badge'
import LocationSelector, { type LocationValue } from '@/components/ui/LocationSelector'
import type { AIPrediction, Category, CategorySuggestion, PriorityLevel, SimilarRequest } from '@/types'

const emptyLocation: LocationValue = { province: '', district: '', sector: '', cell: '', village: '' }

export default function SubmitRequestPage() {
  const navigate = useNavigate()
  const { fullName, userId } = useAuth()
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    title: '',
    categoryId: '',
    phone: '',
    description: '',
  })
  const [location, setLocation] = useState<LocationValue>(emptyLocation)

  // Pre-fill location and phone from the customer's registered profile
  const { data: profileData } = useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      const { data } = await api.get('/profile')
      return data
    },
    enabled: !!userId,
    staleTime: 5 * 60_000,
  })

  useEffect(() => {
    if (!profileData) return
    // Pre-fill phone if the form field is still empty
    if (!form.phone && profileData.phone) {
      setForm(prev => ({ ...prev, phone: profileData.phone }))
    }
    // Pre-fill location only if the user hasn't started filling it in yet
    if (!location.province && profileData.province) {
      setLocation({
        province: profileData.province ?? '',
        district: profileData.district ?? '',
        sector:   profileData.sector   ?? '',
        cell:     profileData.cell     ?? '',
        village:  profileData.village  ?? '',
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileData])
  const [files, setFiles] = useState<File[]>([])
  const [prediction, setPrediction] = useState<AIPrediction | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiVisible, setAiVisible] = useState(false)

  // Feature 5: category suggestions
  const [categorySuggestions, setCategorySuggestions] = useState<CategorySuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const suggestTimer = useRef<ReturnType<typeof setTimeout>>(null)

  // Feature 3: pre-submit duplicate check — warns (not blocks) when the customer
  // already has an open request in the same category
  const [preSubmitDuplicates, setPreSubmitDuplicates] = useState<SimilarRequest[]>([])
  const [duplicateAcknowledged, setDuplicateAcknowledged] = useState(false)
  const duplicateTimer = useRef<ReturnType<typeof setTimeout>>(null)

  const aiTimer = useRef<ReturnType<typeof setTimeout>>(null)

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await api.get<Category[]>('/categories')
      return data
    },
  })

  // Feature 3: pre-submit duplicate check — fires when category is selected.
  // Scoped to the authenticated user on the backend — no userId/province needed here.
  const triggerDuplicateCheck = useCallback((categoryId: string) => {
    if (!categoryId) {
      setPreSubmitDuplicates([])
      setDuplicateAcknowledged(false)
      return
    }
    setDuplicateAcknowledged(false)
    if (duplicateTimer.current) clearTimeout(duplicateTimer.current)
    duplicateTimer.current = setTimeout(async () => {
      try {
        const { data } = await api.get<SimilarRequest[]>('/requests/check-duplicates', {
          params: { categoryId: Number(categoryId) },
        })
        setPreSubmitDuplicates(data)
      } catch {
        // silently ignore — the backend will catch genuine duplicates on submit anyway
      }
    }, 600)
  }, [])

  const handleLocationChange = useCallback((loc: LocationValue) => {
    setLocation(loc)
  }, [])

  // Feature 5: trigger category suggestion when title + description change
  const triggerCategorySuggestion = useCallback((title: string, description: string) => {
    if (title.length < 5) {
      setCategorySuggestions([])
      return
    }
    if (suggestTimer.current) clearTimeout(suggestTimer.current)
    suggestTimer.current = setTimeout(async () => {
      try {
        const { data } = await api.get<{ suggestions: CategorySuggestion[] }>('/requests/suggest-category', {
          params: { title, description: description || '' },
        })
        setCategorySuggestions(data.suggestions ?? [])
        setShowSuggestions(data.suggestions?.length > 0)
      } catch {
        // silently ignore
      }
    }, 800)
  }, [])

  const triggerAI = useCallback(
    (title: string, description: string, categoryId: string) => {
      if ((title.length > 10 || description.length > 20) && categoryId) {
        setAiVisible(true)
        setAiLoading(true)
        if (aiTimer.current) clearTimeout(aiTimer.current)
        aiTimer.current = setTimeout(async () => {
          try {
            const { data } = await api.post<AIPrediction>('/requests/predict', {
              title,
              description,
              categoryId: Number(categoryId),
            })
            setPrediction(data)
          } catch {
            // AI service unavailable — show a clear notice instead of fake data
            setPrediction({
              priority: 'Medium',
              confidence: 0,
              keywords: [],
            })
          } finally {
            setAiLoading(false)
          }
        }, 1200)
      }
    },
    []
  )

  const submitMutation = useMutation({
    mutationFn: async () => {
      const fd = new FormData()
      fd.append('title', form.title)
      fd.append('description', form.description)
      fd.append('categoryId', form.categoryId)
      fd.append('phone', form.phone)
      fd.append('province', location.province)
      fd.append('district', location.district)
      fd.append('sector', location.sector)
      fd.append('cell', location.cell)
      if (location.village) fd.append('village', location.village)
      files.forEach((f) => fd.append('attachments', f))
      const { data } = await api.post('/requests', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-requests'] })
      navigate('/my-requests')
    },
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setForm((prev) => {
      const next = { ...prev, [name]: value }
      if (name === 'title' || name === 'description') {
        triggerCategorySuggestion(
          name === 'title' ? value : next.title,
          name === 'description' ? value : next.description
        )
      }
      if (name === 'title' || name === 'description' || name === 'categoryId') {
        triggerAI(
          name === 'title' ? value : next.title,
          name === 'description' ? value : next.description,
          name === 'categoryId' ? value : next.categoryId
        )
        if (name === 'categoryId') {
          setShowSuggestions(false)
          triggerDuplicateCheck(value)
        }
      }
      return next
    })
  }

  const applySuggestion = (suggestion: CategorySuggestion) => {
    const catId = String(suggestion.categoryId)
    setForm((prev) => ({ ...prev, categoryId: catId }))
    setShowSuggestions(false)
    triggerAI(form.title, form.description, catId)
    triggerDuplicateCheck(catId)
  }

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFiles((prev) => [...prev, ...Array.from(e.target.files!)])
  }

  const removeFile = (idx: number) => setFiles((prev) => prev.filter((_, i) => i !== idx))

  const clearForm = () => {
    setForm({ title: '', categoryId: '', phone: '', description: '' })
    setLocation(emptyLocation)
    setFiles([])
    setPrediction(null)
    setAiVisible(false)
    setCategorySuggestions([])
    setPreSubmitDuplicates([])
    setDuplicateAcknowledged(false)
  }

  const locationComplete = location.province && location.district && location.sector && location.cell

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!locationComplete) return
    submitMutation.mutate()
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="bg-white rounded-xl border border-border p-7 shadow-sm">
        <h2 className="text-lg font-bold text-text mb-1">Submit a Service Request</h2>
        <p className="text-sm text-text-muted mb-6">
          Fill in the form below. Our AI system will automatically predict priority and suggest the best technician.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wide mb-1.5">
              Request Title *
            </label>
            <input
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder="Brief description of your issue..."
              required
              className="w-full px-3.5 py-2.5 border-[1.5px] border-border rounded-lg text-sm bg-surface-alt focus:border-primary focus:ring-2 focus:ring-primary/10 focus:bg-white outline-none transition-all"
            />
          </div>

          {/* Category with AI suggestions */}
          <div className="relative">
            <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wide mb-1.5">
              Category *
            </label>
            <select
              name="categoryId"
              value={form.categoryId}
              onChange={handleChange}
              required
              className="w-full px-3.5 py-2.5 border-[1.5px] border-border rounded-lg text-sm bg-surface-alt focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all"
            >
              <option value="">Select category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            {/* Feature 5: AI category suggestions */}
            {showSuggestions && categorySuggestions.length > 0 && !form.categoryId && (
              <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-white border border-primary/30 rounded-lg shadow-lg overflow-hidden">
                <div className="flex items-center gap-1.5 px-3 py-2 bg-primary-light border-b border-primary/15">
                  <Sparkles size={13} className="text-primary" />
                  <span className="text-[11px] font-semibold text-primary">AI Suggestions</span>
                </div>
                {categorySuggestions.map((s) => (
                  <button
                    key={s.categoryId}
                    type="button"
                    onClick={() => applySuggestion(s)}
                    className="w-full text-left px-3 py-2.5 hover:bg-surface-alt transition-colors border-b border-border last:border-0"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-text">{s.categoryName}</span>
                      <span className="text-[11px] text-text-muted ml-2">{Math.round(s.score * 100)}% match</span>
                    </div>
                    <span className="text-[11px] text-text-muted">{s.reason}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wide mb-1.5">
              Phone Number *
            </label>
            <input
              name="phone"
              value={form.phone}
              onChange={handleChange}
              type="tel"
              placeholder="+250 7xx xxx xxx"
              required
              className="w-full px-3.5 py-2.5 border-[1.5px] border-border rounded-lg text-sm bg-surface-alt focus:border-primary focus:ring-2 focus:ring-primary/10 focus:bg-white outline-none transition-all"
            />
          </div>

          {/* Location — spans full width */}
          <div className="md:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
                Location *
              </p>
              {profileData?.province && location.province === profileData.province && (
                <span className="text-[10px] text-primary bg-primary-light px-2 py-0.5 rounded-full border border-primary/20">
                  Pre-filled from your profile · Edit if different
                </span>
              )}
            </div>
            <LocationSelector value={location} onChange={handleLocationChange} />
            {!locationComplete && submitMutation.isError && (
              <p className="text-xs text-red-600 mt-1">Please complete all required location fields.</p>
            )}
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wide mb-1.5">
              Detailed Description *
            </label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder="Describe your issue in detail. Include when it started, how many people are affected, and any relevant details..."
              required
              rows={5}
              className="w-full px-3.5 py-2.5 border-[1.5px] border-border rounded-lg text-sm bg-surface-alt focus:border-primary focus:ring-2 focus:ring-primary/10 focus:bg-white outline-none transition-all resize-y"
            />
          </div>
        </div>

        {/* File Upload */}
        <div
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-border rounded-xl p-7 text-center cursor-pointer hover:border-primary hover:bg-primary-light transition-colors"
        >
          <input ref={fileRef} type="file" multiple className="hidden" onChange={handleFiles} />
          <Upload className="mx-auto mb-2 text-text-muted" size={28} />
          <h4 className="text-sm font-semibold text-text mb-1">Attach supporting files</h4>
          <p className="text-xs text-text-muted">Photos, documents, or videos (max 10MB each)</p>
        </div>

        {files.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {files.map((f, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-3 py-1.5 bg-primary-light border border-primary rounded-md text-xs text-primary"
              >
                <span className="truncate max-w-[150px]">{f.name}</span>
                <button type="button" onClick={() => removeFile(i)} className="opacity-60 hover:opacity-100">
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* AI Prediction Panel */}
        {aiVisible && (
          <div className="mt-5 bg-gradient-to-br from-primary-light to-white border-[1.5px] border-primary rounded-xl p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <Brain size={20} className="text-primary" />
              <h3 className="text-[15px] font-bold text-primary">AI Priority Prediction</h3>
              {aiLoading && <Loader2 size={16} className="text-primary animate-spin" />}
              {!aiLoading && prediction && prediction.confidence > 0 && (
                <span className="text-xs text-primary ml-1">Analysis complete</span>
              )}
            </div>

            {/* Show previous prediction (dimmed) while a re-prediction is in flight */}
            {prediction && (
              <div className={aiLoading ? 'opacity-50 pointer-events-none' : ''}>
                {/* AI unavailable — backend fallback returned zero confidence */}
                {prediction.confidence === 0 ? (
                  <div className="flex items-center gap-2 px-3 py-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-amber-700">AI analysis temporarily unavailable</p>
                      <p className="text-[11px] text-amber-600 mt-0.5">
                        The prediction model could not be reached. Your request will still be submitted and staff will manually assign a priority.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Low-confidence warning */}
                    {prediction.isUncertain && (
                      <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
                        <AlertTriangle size={13} className="text-amber-500 flex-shrink-0" />
                        <span className="text-xs text-amber-700 font-medium">
                          Low confidence ({(prediction.confidence * 100).toFixed(0)}%) — AI is uncertain. Staff will verify the priority.
                        </span>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white border border-primary/15 rounded-lg p-3.5 text-center">
                        <div className="mb-1">
                          <PriorityBadge priority={prediction.priority} />
                        </div>
                        <div className="text-[11px] text-text-muted">Predicted Priority</div>
                        {prediction.isUncertain && (
                          <span className="text-[10px] text-amber-500 font-semibold mt-0.5 block">Uncertain</span>
                        )}
                      </div>
                      <div className="bg-white border border-primary/15 rounded-lg p-3.5 text-center">
                        <div className={`text-xl font-bold mb-1 ${prediction.isUncertain ? 'text-amber-500' : 'text-primary'}`}>
                          {(prediction.confidence * 100).toFixed(1)}%
                        </div>
                        <div className="text-[11px] text-text-muted">Confidence Score</div>
                        <div className="h-2 bg-surface-alt rounded-full overflow-hidden mt-2">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${prediction.isUncertain ? 'bg-amber-400' : 'bg-primary'}`}
                            style={{ width: `${prediction.confidence * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {prediction.keywords.length > 0 && (
                      <div className="mt-3 px-3 py-2.5 bg-red-50 rounded-lg border-l-[3px] border-red-500">
                        <p className="text-xs font-medium text-red-600 flex items-center gap-1.5">
                          <AlertTriangle size={13} />
                          Urgency signals detected: <strong>{prediction.keywords.join(', ')}</strong> — priority elevated
                        </p>
                      </div>
                    )}

                    {prediction.topFeatures && prediction.topFeatures.length > 0 && (
                      <div className="mt-2 px-3 py-2 bg-surface-alt rounded-md flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] text-text-muted shrink-0">Key signals:</span>
                        {prediction.topFeatures.slice(0, 6).map((f) => (
                          <span key={f} className="text-[11px] text-primary bg-primary-light px-1.5 py-0.5 rounded">
                            {f}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="mt-2.5 px-3 py-2 bg-primary-light rounded-md text-xs text-text-muted">
                      AI Priority Analysis · Your request will be handled based on urgency and impact
                    </div>
                  </>
                )}
              </div>
            )}

            {/* First-time loading skeleton — no previous prediction to show yet */}
            {!prediction && aiLoading && (
              <div className="space-y-2 animate-pulse">
                <div className="h-8 bg-primary/10 rounded-lg w-2/3" />
                <div className="grid grid-cols-3 gap-3">
                  <div className="h-20 bg-primary/10 rounded-lg" />
                  <div className="h-20 bg-primary/10 rounded-lg" />
                  <div className="h-20 bg-primary/10 rounded-lg" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Feature 3: Pre-submit duplicate warning (dismissable, not blocking) */}
        {preSubmitDuplicates.length > 0 && !duplicateAcknowledged && (
          <div className="mt-5 bg-amber-50 border-2 border-amber-300 rounded-xl p-5">
            <div className="flex items-start gap-3 mb-3">
              <Info size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-amber-900 mb-1">
                  You have an open request in this category
                </p>
                <p className="text-sm text-amber-800">
                  If this is the <strong>same issue</strong>, you can track it in <strong>My Requests</strong> instead of submitting again.
                  If it's a <strong>different problem</strong>, you can still submit.
                </p>
              </div>
            </div>

            {/* Show the open request(s) so the user can identify them */}
            <div className="space-y-2 mt-3">
              {preSubmitDuplicates.map((r) => (
                <div key={r.id} className="flex items-center gap-3 p-3 bg-white border border-amber-200 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <PriorityBadge priority={r.finalPriority} />
                      <span className="text-[11px] text-text-muted px-1.5 py-0.5 bg-amber-50 border border-amber-200 rounded">
                        {r.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-sm text-text font-medium truncate">{r.title}</p>
                    <p className="text-xs text-text-muted mt-0.5">{r.categoryName}</p>
                  </div>
                  <span className="text-xs text-text-muted whitespace-nowrap">
                    {new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex gap-3 mt-4">
              <button
                type="button"
                onClick={() => navigate('/my-requests')}
                className="px-4 py-2 bg-amber-600 text-white text-xs font-semibold rounded-lg hover:bg-amber-700 transition-colors"
              >
                Go to My Requests
              </button>
              <button
                type="button"
                onClick={() => setDuplicateAcknowledged(true)}
                className="px-4 py-2 border border-amber-300 text-amber-800 text-xs font-semibold rounded-lg hover:bg-amber-100 transition-colors"
              >
                This is a different issue — continue
              </button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 mt-5">
          <button
            type="submit"
            disabled={submitMutation.isPending || !locationComplete || (preSubmitDuplicates.length > 0 && !duplicateAcknowledged)}
            className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-lg text-sm font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            Submit Request
          </button>
          <button
            type="button"
            onClick={clearForm}
            className="flex items-center gap-2 border-[1.5px] border-border px-6 py-3 rounded-lg text-sm font-medium text-text-secondary hover:border-primary hover:text-primary transition-colors"
          >
            <RotateCcw size={16} />
            Clear Form
          </button>
        </div>

        {submitMutation.isError && (
          <p className="mt-3 text-sm text-red-600">
            Failed to submit request. Please check all fields and try again.
          </p>
        )}
      </div>
    </form>
  )
}
