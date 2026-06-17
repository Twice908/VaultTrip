'use client'

import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { showToast } from '@/lib/toast'

interface Preferences {
  alertPassport: boolean
  alertVisa: boolean
  alertInsurance: boolean
  alertTripHealth: boolean
}

const ALERT_ITEMS: { key: keyof Preferences; label: string; description: string }[] = [
  {
    key: 'alertPassport',
    label: 'Passport expiry',
    description: 'Warn 12 months before your passport expires',
  },
  {
    key: 'alertVisa',
    label: 'Visa expiry',
    description: 'Warn 30 days before a visa expires',
  },
  {
    key: 'alertInsurance',
    label: 'Insurance coverage',
    description: 'Warn 7 days before a trip if travel insurance doesn\'t cover the full trip',
  },
  {
    key: 'alertTripHealth',
    label: 'Trip readiness',
    description: 'Warn 7 days before departure when the trip checklist is below 80% complete',
  },
]

function Toggle({
  checked,
  onChange,
  id,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  id: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      id={id}
      onClick={() => onChange(!checked)}
      className={[
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent',
        'transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2',
        'focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base',
        checked ? 'bg-accent' : 'bg-surface-border',
      ].join(' ')}
    >
      <span
        className={[
          'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0',
          'transition duration-200 ease-in-out',
          checked ? 'translate-x-5' : 'translate-x-0',
        ].join(' ')}
      />
    </button>
  )
}

export default function ProfilePage() {
  const [prefs, setPrefs] = useState<Preferences | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/users/me/preferences')
      .then((r) => r.json())
      .then((data: Preferences) => setPrefs(data))
      .catch(() => showToast.error('Failed to load preferences'))
      .finally(() => setLoading(false))
  }, [])

  function handleToggle(key: keyof Preferences, value: boolean) {
    setPrefs((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  async function handleSave() {
    if (!prefs) return
    setSaving(true)
    try {
      const res = await fetch('/api/users/me/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      })
      if (!res.ok) throw new Error('Failed to save')
      showToast.success('Preferences saved')
    } catch {
      showToast.error('Failed to save preferences')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Profile</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Manage your alert preferences and account settings.
        </p>
      </div>

      <div className="rounded-xl border border-surface-border bg-surface-elevated p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-subtle">
            <Bell className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-text-primary">Alert preferences</h2>
            <p className="text-sm text-text-secondary">
              Choose which expiry and readiness alerts you receive by email.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            {ALERT_ITEMS.map((item) => (
              <div key={item.key} className="h-14 animate-pulse rounded-lg bg-surface-overlay" />
            ))}
          </div>
        ) : prefs ? (
          <div className="space-y-4">
            {ALERT_ITEMS.map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between gap-4 rounded-lg border border-surface-border bg-surface-base px-4 py-3"
              >
                <label htmlFor={item.key} className="flex-1 cursor-pointer">
                  <p className="text-sm font-medium text-text-primary">{item.label}</p>
                  <p className="text-xs text-text-secondary mt-0.5">{item.description}</p>
                </label>
                <Toggle
                  id={item.key}
                  checked={prefs[item.key]}
                  onChange={(v) => handleToggle(item.key, v)}
                />
              </div>
            ))}

            <div className="pt-2">
              <Button onClick={handleSave} loading={saving} size="md">
                Save preferences
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-text-secondary">Could not load preferences.</p>
        )}
      </div>
    </div>
  )
}
