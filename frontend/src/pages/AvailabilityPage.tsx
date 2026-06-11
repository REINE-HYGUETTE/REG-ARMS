import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Save, Clock, Zap, CalendarDays, CheckCircle2, BriefcaseBusiness } from 'lucide-react'
import api from '@/lib/api'
import { useAuth } from '@/lib/auth'
import Spinner from '@/components/ui/Spinner'
import type { Technician, ScheduleEntry } from '@/types'

const DAY_ORDER = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']
const DAY_LABELS: Record<string, string> = {
  MONDAY: 'Monday', TUESDAY: 'Tuesday', WEDNESDAY: 'Wednesday',
  THURSDAY: 'Thursday', FRIDAY: 'Friday', SATURDAY: 'Saturday', SUNDAY: 'Sunday',
}

const DEFAULT_SCHEDULE: ScheduleEntry[] = DAY_ORDER.map((day) => ({
  dayOfWeek: day,
  startTime: '08:00',
  endTime: '17:00',
  isWorking: !['SATURDAY', 'SUNDAY'].includes(day),
}))

export default function AvailabilityPage() {
  const { role } = useAuth()
  const queryClient = useQueryClient()
  const isTech = role === 'TECHNICIAN'

  const [schedule, setSchedule] = useState<ScheduleEntry[]>(DEFAULT_SCHEDULE)
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null)

  /* ── Load technician status ── */
  const { data: tech, isLoading: techLoading } = useQuery({
    queryKey: ['technician-me'],
    queryFn: async () => (await api.get<Technician>('/technicians/me')).data,
    enabled: isTech,
  })

  /* ── Load schedule ── */
  const { data: scheduleData, isLoading: schedLoading } = useQuery({
    queryKey: ['technician-schedule'],
    queryFn: async () => (await api.get<ScheduleEntry[]>('/technicians/schedule')).data,
    enabled: isTech,
  })

  /* ── Sync loaded schedule into local state ── */
  useEffect(() => {
    if (scheduleData && scheduleData.length > 0) {
      const merged = DAY_ORDER.map((day) => {
        const found = scheduleData.find((e) => e.dayOfWeek === day)
        return found ?? { dayOfWeek: day, startTime: '08:00', endTime: '17:00', isWorking: false }
      })
      setSchedule(merged)
    }
  }, [scheduleData])

  /* ── Toggle availability ── */
  const toggleMutation = useMutation({
    mutationFn: async () => { await api.patch('/technicians/toggle-availability') },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['technician-me'] }),
  })

  /* ── Save schedule ── */
  const saveMutation = useMutation({
    mutationFn: async () => {
      await api.put('/technicians/schedule', schedule)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['technician-schedule'] })
      setSaveMsg({ ok: true, text: 'Schedule saved successfully' })
      setTimeout(() => setSaveMsg(null), 3000)
    },
    onError: () => setSaveMsg({ ok: false, text: 'Failed to save schedule' }),
  })

  const updateDay = (day: string, field: keyof ScheduleEntry, value: string | boolean) => {
    setSchedule((prev) =>
      prev.map((e) => (e.dayOfWeek === day ? { ...e, [field]: value } : e))
    )
    setSaveMsg(null)
  }

  if (isTech && (techLoading || schedLoading)) {
    return <div className="flex justify-center py-16"><Spinner /></div>
  }

  const available   = tech?.isAvailable ?? true
  const workingDays = schedule.filter((e) => e.isWorking).length
  const weeklyHours = schedule
    .filter((e) => e.isWorking)
    .reduce((sum, e) => {
      const [sh, sm] = e.startTime.split(':').map(Number)
      const [eh, em] = e.endTime.split(':').map(Number)
      return sum + (eh * 60 + em - (sh * 60 + sm))
    }, 0) / 60

  return (
    <div className="w-full flex gap-6 items-start">

      {/* ── Left column ── */}
      <div className="w-72 shrink-0 space-y-4">

        {/* Availability toggle card */}
        <div className="bg-white rounded-2xl border border-border/70 p-5 shadow-sm">
          <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-4 flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${available ? 'bg-emerald-500' : 'bg-red-400'}`} />
            Availability
          </h3>

          <div className={`p-4 rounded-xl border mb-4 ${
            available ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center gap-3 mb-2">
              <button
                onClick={() => isTech && toggleMutation.mutate()}
                disabled={toggleMutation.isPending || !isTech}
                className={`relative w-11 h-6 rounded-full transition-colors focus:outline-none shrink-0 ${
                  available ? 'bg-emerald-500' : 'bg-gray-300'
                } ${!isTech ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
              >
                <div className={`absolute top-[3px] left-[3px] w-[18px] h-[18px] bg-white rounded-full shadow transition-transform ${
                  available ? 'translate-x-5' : ''
                }`} />
              </button>
              <p className={`text-sm font-bold ${available ? 'text-emerald-700' : 'text-red-600'}`}>
                {toggleMutation.isPending
                  ? <span className="flex items-center gap-1.5"><Loader2 size={13} className="animate-spin" />Updating…</span>
                  : available ? 'Available' : 'Unavailable'}
              </p>
            </div>
            <p className="text-[11px] text-text-muted leading-relaxed">
              {available
                ? 'You are accepting new request assignments.'
                : 'You will not receive new assignments.'}
            </p>
          </div>

          {!isTech && (
            <p className="text-xs text-text-muted italic">Only technicians can toggle availability.</p>
          )}
        </div>

        {/* Workload stats card */}
        {isTech && tech && (
          <div className="bg-white rounded-2xl border border-border/70 p-5 shadow-sm">
            <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-4">Workload</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-text-secondary">
                  <BriefcaseBusiness size={13} className="text-text-muted" /> Active tasks
                </div>
                <span className="text-sm font-bold text-text tabular-nums">
                  {tech.currentWorkload} / {tech.maxWorkload}
                </span>
              </div>
              <div className="h-2 bg-surface-alt rounded-full overflow-hidden border border-border/40">
                <div
                  className={`h-full rounded-full transition-all ${
                    tech.currentWorkload / tech.maxWorkload > 0.8 ? 'bg-red-400'
                    : tech.currentWorkload / tech.maxWorkload > 0.5 ? 'bg-amber-400'
                    : 'bg-emerald-400'
                  }`}
                  style={{ width: `${Math.min(100, (tech.currentWorkload / tech.maxWorkload) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Schedule summary card */}
        <div className="bg-white rounded-2xl border border-border/70 p-5 shadow-sm">
          <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-4">Schedule Summary</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-text-secondary">
                <CalendarDays size={13} className="text-text-muted" /> Working days
              </div>
              <span className="text-sm font-bold text-text tabular-nums">{workingDays} / 7</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-text-secondary">
                <Clock size={13} className="text-text-muted" /> Hours/week
              </div>
              <span className="text-sm font-bold text-text tabular-nums">{weeklyHours}h</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-text-secondary">
                <Zap size={13} className="text-text-muted" /> Weekend days
              </div>
              <span className="text-sm font-bold text-text tabular-nums">
                {schedule.filter(e => (e.dayOfWeek === 'SATURDAY' || e.dayOfWeek === 'SUNDAY') && e.isWorking).length}
              </span>
            </div>
          </div>

          {/* Days preview */}
          <div className="mt-4 flex gap-1">
            {schedule.map((e) => (
              <div
                key={e.dayOfWeek}
                title={DAY_LABELS[e.dayOfWeek]}
                className={`flex-1 h-1.5 rounded-full ${e.isWorking ? 'bg-primary' : 'bg-border'}`}
              />
            ))}
          </div>
          <div className="flex gap-1 mt-1">
            {schedule.map((e) => (
              <div key={e.dayOfWeek} className="flex-1 text-center text-[8px] text-text-muted font-bold">
                {DAY_LABELS[e.dayOfWeek][0]}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right column — Work schedule ── */}
      <div className="flex-1 min-w-0 bg-white rounded-2xl border border-border/70 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-sm font-bold flex items-center gap-2">
              <CheckCircle2 size={15} className="text-primary" /> Work Schedule
            </h3>
            <p className="text-xs text-text-muted mt-0.5">
              {isTech ? 'Set your working hours for each day of the week.' : "Your team's standard working hours."}
            </p>
          </div>
          {isTech && (
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-primary-dark transition-colors disabled:opacity-50 shadow-sm"
            >
              {saveMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save Schedule
            </button>
          )}
        </div>

        {/* Header row */}
        <div className="grid grid-cols-[1fr_140px_140px_72px] gap-3 px-3 mb-2">
          <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Day</span>
          <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Start Time</span>
          <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">End Time</span>
          <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest text-center">On</span>
        </div>

        <div className="space-y-2">
          {schedule.map((entry) => {
            const isWeekend = entry.dayOfWeek === 'SATURDAY' || entry.dayOfWeek === 'SUNDAY'
            return (
              <div
                key={entry.dayOfWeek}
                className={`grid grid-cols-[1fr_140px_140px_72px] gap-3 items-center px-3 py-3 rounded-xl border transition-colors ${
                  entry.isWorking
                    ? 'bg-white border-border/60 hover:border-border'
                    : 'bg-surface-alt/60 border-border/40 opacity-55'
                }`}
              >
                {/* Day name */}
                <div className="flex items-center gap-2.5">
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${entry.isWorking ? 'bg-primary' : 'bg-border'}`} />
                  <span className={`text-sm font-semibold ${isWeekend ? 'text-text-muted' : 'text-text'}`}>
                    {DAY_LABELS[entry.dayOfWeek]}
                  </span>
                  {isWeekend && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-400 rounded-full font-medium">Weekend</span>
                  )}
                </div>

                {/* Start time */}
                <input
                  type="time"
                  value={entry.startTime}
                  onChange={(e) => updateDay(entry.dayOfWeek, 'startTime', e.target.value)}
                  disabled={!entry.isWorking || !isTech}
                  className="px-2.5 py-1.5 border-[1.5px] border-border rounded-lg text-sm focus:border-primary outline-none disabled:opacity-40 disabled:cursor-not-allowed bg-surface-alt w-full"
                />

                {/* End time */}
                <input
                  type="time"
                  value={entry.endTime}
                  onChange={(e) => updateDay(entry.dayOfWeek, 'endTime', e.target.value)}
                  disabled={!entry.isWorking || !isTech}
                  className="px-2.5 py-1.5 border-[1.5px] border-border rounded-lg text-sm focus:border-primary outline-none disabled:opacity-40 disabled:cursor-not-allowed bg-surface-alt w-full"
                />

                {/* Working toggle */}
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => isTech && updateDay(entry.dayOfWeek, 'isWorking', !entry.isWorking)}
                    disabled={!isTech}
                    className={`relative w-10 h-5 rounded-full transition-colors focus:outline-none ${
                      entry.isWorking ? 'bg-primary' : 'bg-gray-300'
                    } ${!isTech ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                  >
                    <div className={`absolute top-[2px] left-[2px] w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      entry.isWorking ? 'translate-x-5' : ''
                    }`} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {saveMsg && (
          <p className={`text-xs mt-4 font-medium ${saveMsg.ok ? 'text-emerald-600' : 'text-red-600'}`}>
            {saveMsg.text}
          </p>
        )}
      </div>
    </div>
  )
}
