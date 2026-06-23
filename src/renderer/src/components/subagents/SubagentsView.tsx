import type { ReactElement } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bot, Pencil, Plus, Trash2 } from 'lucide-react'
import type { KunSubagentProfileV1, KunSubagentsSettingsV1 } from '@shared/app-settings'
import { rendererRuntimeClient } from '../../agent/runtime-client'
import { confirmDialog } from '../../lib/confirm-dialog'
import { SidebarTitlebarToggleButton } from '../sidebar/SidebarPrimitives'

const PRESET_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

const MODE_LABELS: Record<KunSubagentProfileV1['mode'], string> = {
  subagent: 'delegate',
  primary: 'persona',
  all: 'both'
}

const DEFAULT_SUBAGENTS: KunSubagentsSettingsV1 = {
  enabled: true,
  profiles: []
}

function newProfile(): KunSubagentProfileV1 {
  return {
    id: crypto.randomUUID(),
    enabled: true,
    name: '',
    mode: 'subagent',
    toolPolicy: 'readOnly'
  }
}

type DialogState = { open: false } | { open: true; profile: KunSubagentProfileV1; isNew: boolean }

type Props = {
  leftSidebarCollapsed: boolean
  onToggleLeftSidebar: () => void
}

export function SubagentsView({ leftSidebarCollapsed, onToggleLeftSidebar }: Props): ReactElement {
  const { t } = useTranslation('common')
  const [subagents, setSubagents] = useState<KunSubagentsSettingsV1>(DEFAULT_SUBAGENTS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialog, setDialog] = useState<DialogState>({ open: false })

  const load = useCallback(async (): Promise<void> => {
    try {
      const settings = await rendererRuntimeClient.getSettings({ forceRefresh: true })
      const existing = settings.agents?.kun?.subagents
      setSubagents(existing ?? DEFAULT_SUBAGENTS)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const persist = useCallback(async (next: KunSubagentsSettingsV1): Promise<void> => {
    setSubagents(next)
    const saved = await rendererRuntimeClient.setSettings({ agents: { kun: { subagents: next } } })
    const saved2 = saved.agents?.kun?.subagents
    if (saved2) setSubagents(saved2)
  }, [])

  const handleToggleEnabled = useCallback(async (id: string): Promise<void> => {
    const next: KunSubagentsSettingsV1 = {
      ...subagents,
      profiles: subagents.profiles.map((p) => p.id === id ? { ...p, enabled: !p.enabled } : p)
    }
    await persist(next)
  }, [subagents, persist])

  const handleDelete = useCallback(async (id: string): Promise<void> => {
    const profile = subagents.profiles.find((p) => p.id === id)
    const confirmed = await confirmDialog(
      `Delete agent "${profile?.name || id}"?`,
      'This cannot be undone.'
    )
    if (!confirmed) return
    await persist({ ...subagents, profiles: subagents.profiles.filter((p) => p.id !== id) })
  }, [subagents, persist])

  const openCreate = (): void => setDialog({ open: true, profile: newProfile(), isNew: true })
  const openEdit = (profile: KunSubagentProfileV1): void => setDialog({ open: true, profile: { ...profile }, isNew: false })

  const handleDialogSave = useCallback(async (profile: KunSubagentProfileV1): Promise<void> => {
    if (!dialog.open) return
    const { isNew } = dialog
    const next: KunSubagentsSettingsV1 = {
      ...subagents,
      profiles: isNew
        ? [...subagents.profiles, profile]
        : subagents.profiles.map((p) => p.id === profile.id ? profile : p)
    }
    setDialog({ open: false })
    await persist(next)
  }, [dialog, subagents, persist])

  if (loading) {
    return (
      <div className="flex h-full flex-col bg-ds-main">
        <div className="h-10 shrink-0" />
        <div className="flex flex-1 items-center justify-center text-ds-muted text-sm">{t('loading')}</div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-ds-main">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-ds-border px-3">
        {leftSidebarCollapsed ? (
          <SidebarTitlebarToggleButton onClick={onToggleLeftSidebar} />
        ) : null}
        <Bot className="h-4 w-4 text-ds-muted" strokeWidth={1.75} />
        <span className="text-sm font-medium text-ds-heading">{t('subagents', 'Agents')}</span>
        <div className="flex-1" />
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 rounded-md bg-ds-accent px-2.5 py-1 text-xs font-medium text-white hover:bg-ds-accent/90"
        >
          <Plus className="h-3.5 w-3.5" />
          {t('newAgent', 'New agent')}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
            {error}
          </div>
        ) : null}

        {subagents.profiles.length === 0 ? (
          <EmptyState onCreate={openCreate} />
        ) : (
          <div className="space-y-2">
            {subagents.profiles.map((profile) => (
              <ProfileCard
                key={profile.id}
                profile={profile}
                onEdit={openEdit}
                onDelete={handleDelete}
                onToggleEnabled={handleToggleEnabled}
              />
            ))}
          </div>
        )}
      </div>

      {dialog.open ? (
        <ProfileDialog
          profile={dialog.profile}
          isNew={dialog.isNew}
          onSave={handleDialogSave}
          onCancel={() => setDialog({ open: false })}
        />
      ) : null}
    </div>
  )
}

function EmptyState({ onCreate }: { onCreate: () => void }): ReactElement {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Bot className="mb-3 h-10 w-10 text-ds-faint" strokeWidth={1.25} />
      <p className="mb-1 text-sm font-medium text-ds-heading">No agents yet</p>
      <p className="mb-4 text-xs text-ds-muted">Create agents with custom models, tools, and personas</p>
      <button
        onClick={onCreate}
        className="flex items-center gap-1.5 rounded-md bg-ds-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-ds-accent/90"
      >
        <Plus className="h-4 w-4" />
        New agent
      </button>
    </div>
  )
}

function ProfileCard({
  profile,
  onEdit,
  onDelete,
  onToggleEnabled
}: {
  profile: KunSubagentProfileV1
  onEdit: (p: KunSubagentProfileV1) => void
  onDelete: (id: string) => Promise<void>
  onToggleEnabled: (id: string) => Promise<void>
}): ReactElement {
  const color = profile.color ?? PRESET_COLORS[0]

  return (
    <div className={`rounded-lg border border-ds-border bg-ds-raised px-4 py-3 ${!profile.enabled ? 'opacity-50' : ''}`}>
      <div className="flex items-start gap-3">
        <div
          className="mt-0.5 h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-white text-sm font-semibold"
          style={{ backgroundColor: color }}
        >
          {profile.name.charAt(0).toUpperCase() || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-ds-heading truncate">{profile.name}</span>
            <span className="rounded-full bg-ds-subtle px-2 py-0.5 text-xs text-ds-muted">
              {MODE_LABELS[profile.mode]}
            </span>
            <span className="rounded-full bg-ds-subtle px-2 py-0.5 text-xs text-ds-muted">
              {profile.toolPolicy}
            </span>
            {profile.model ? (
              <span className="rounded-full bg-ds-subtle px-2 py-0.5 text-xs text-ds-muted font-mono">
                {profile.providerId ? `${profile.providerId}:` : ''}{profile.model}
              </span>
            ) : null}
          </div>
          {profile.description ? (
            <p className="mt-0.5 text-xs text-ds-muted line-clamp-2">{profile.description}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => void onToggleEnabled(profile.id)}
            className="rounded p-1.5 text-ds-muted hover:bg-ds-subtle hover:text-ds-heading"
            title={profile.enabled ? 'Disable' : 'Enable'}
          >
            <span className="text-xs">{profile.enabled ? 'On' : 'Off'}</span>
          </button>
          <button
            onClick={() => onEdit(profile)}
            className="rounded p-1.5 text-ds-muted hover:bg-ds-subtle hover:text-ds-heading"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => void onDelete(profile.id)}
            className="rounded p-1.5 text-ds-muted hover:bg-ds-subtle hover:text-red-500"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

function ProfileDialog({
  profile: initialProfile,
  isNew,
  onSave,
  onCancel
}: {
  profile: KunSubagentProfileV1
  isNew: boolean
  onSave: (profile: KunSubagentProfileV1) => Promise<void>
  onCancel: () => void
}): ReactElement {
  const [draft, setDraft] = useState<KunSubagentProfileV1>(initialProfile)
  const [saving, setSaving] = useState(false)
  const [nameError, setNameError] = useState('')

  const set = <K extends keyof KunSubagentProfileV1>(key: K, value: KunSubagentProfileV1[K]): void =>
    setDraft((d) => ({ ...d, [key]: value }))

  const handleSave = async (): Promise<void> => {
    if (!draft.name.trim()) { setNameError('Name is required'); return }
    setSaving(true)
    try {
      await onSave({ ...draft, name: draft.name.trim() })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-ds-border bg-ds-main shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center gap-2 border-b border-ds-border px-4 py-3">
          <Bot className="h-4 w-4 text-ds-muted" />
          <span className="text-sm font-semibold text-ds-heading">
            {isNew ? 'New agent' : 'Edit agent'}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* Name */}
          <Field label="Name" required error={nameError}>
            <input
              autoFocus
              value={draft.name}
              onChange={(e) => { set('name', e.target.value); setNameError('') }}
              placeholder="e.g. Code reviewer"
              className="w-full rounded-md border border-ds-border bg-ds-raised px-3 py-1.5 text-sm text-ds-heading placeholder:text-ds-faint focus:outline-none focus:ring-1 focus:ring-ds-accent"
            />
          </Field>

          {/* Description */}
          <Field label="Description">
            <input
              value={draft.description ?? ''}
              onChange={(e) => set('description', e.target.value || undefined)}
              placeholder="When to use this agent"
              className="w-full rounded-md border border-ds-border bg-ds-raised px-3 py-1.5 text-sm text-ds-heading placeholder:text-ds-faint focus:outline-none focus:ring-1 focus:ring-ds-accent"
            />
          </Field>

          {/* Color */}
          <Field label="Color">
            <div className="flex gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => set('color', c)}
                  className="h-6 w-6 rounded-full ring-offset-1 transition-all"
                  style={{
                    backgroundColor: c,
                    outline: draft.color === c ? `2px solid ${c}` : 'none',
                    outlineOffset: '2px'
                  }}
                />
              ))}
            </div>
          </Field>

          {/* Mode */}
          <Field label="Mode">
            <select
              value={draft.mode}
              onChange={(e) => set('mode', e.target.value as KunSubagentProfileV1['mode'])}
              className="w-full rounded-md border border-ds-border bg-ds-raised px-3 py-1.5 text-sm text-ds-heading focus:outline-none focus:ring-1 focus:ring-ds-accent"
            >
              <option value="subagent">delegate — available for delegate_task only</option>
              <option value="primary">persona — session persona only</option>
              <option value="all">both — delegate and persona</option>
            </select>
          </Field>

          {/* Provider + Model */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Provider ID">
              <input
                value={draft.providerId ?? ''}
                onChange={(e) => set('providerId', e.target.value.trim() || undefined)}
                placeholder="e.g. minimax"
                className="w-full rounded-md border border-ds-border bg-ds-raised px-3 py-1.5 text-sm text-ds-heading placeholder:text-ds-faint focus:outline-none focus:ring-1 focus:ring-ds-accent font-mono"
              />
            </Field>
            <Field label="Model">
              <input
                value={draft.model ?? ''}
                onChange={(e) => set('model', e.target.value.trim() || undefined)}
                placeholder="e.g. deepseek-chat"
                className="w-full rounded-md border border-ds-border bg-ds-raised px-3 py-1.5 text-sm text-ds-heading placeholder:text-ds-faint focus:outline-none focus:ring-1 focus:ring-ds-accent font-mono"
              />
            </Field>
          </div>

          {/* Tool policy */}
          <Field label="Tool access">
            <select
              value={draft.allowedTools ? 'custom' : draft.toolPolicy}
              onChange={(e) => {
                if (e.target.value === 'custom') return
                set('toolPolicy', e.target.value as KunSubagentProfileV1['toolPolicy'])
                set('allowedTools', undefined)
              }}
              className="w-full rounded-md border border-ds-border bg-ds-raised px-3 py-1.5 text-sm text-ds-heading focus:outline-none focus:ring-1 focus:ring-ds-accent"
            >
              <option value="readOnly">read-only — read, grep, find, ls</option>
              <option value="inherit">inherit — all tools</option>
              {draft.allowedTools ? <option value="custom">custom allow-list (edit below)</option> : null}
            </select>
          </Field>

          {/* Custom allow-list */}
          <Field label="Custom tool allow-list" hint="Comma-separated tool names. Overrides tool access above.">
            <input
              value={draft.allowedTools?.join(', ') ?? ''}
              onChange={(e) => {
                const raw = e.target.value.trim()
                set('allowedTools', raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : undefined)
              }}
              placeholder="read, grep, write"
              className="w-full rounded-md border border-ds-border bg-ds-raised px-3 py-1.5 text-sm text-ds-heading placeholder:text-ds-faint focus:outline-none focus:ring-1 focus:ring-ds-accent font-mono"
            />
          </Field>

          {/* System prompt */}
          <Field label="System prompt" hint="Appended to the base kun system prompt.">
            <textarea
              value={draft.systemPrompt ?? ''}
              onChange={(e) => set('systemPrompt', e.target.value || undefined)}
              placeholder="You are a careful security reviewer…"
              rows={3}
              className="w-full rounded-md border border-ds-border bg-ds-raised px-3 py-1.5 text-sm text-ds-heading placeholder:text-ds-faint focus:outline-none focus:ring-1 focus:ring-ds-accent resize-none"
            />
          </Field>

          {/* Prompt preamble */}
          <Field label="Prompt preamble" hint="Prepended to the user's task prompt (no effect on prompt cache).">
            <textarea
              value={draft.promptPreamble ?? ''}
              onChange={(e) => set('promptPreamble', e.target.value || undefined)}
              placeholder="Review the following code for security issues only…"
              rows={2}
              className="w-full rounded-md border border-ds-border bg-ds-raised px-3 py-1.5 text-sm text-ds-heading placeholder:text-ds-faint focus:outline-none focus:ring-1 focus:ring-ds-accent resize-none"
            />
          </Field>
        </div>

        <div className="flex justify-end gap-2 border-t border-ds-border px-4 py-3">
          <button
            onClick={onCancel}
            className="rounded-md px-3 py-1.5 text-sm text-ds-muted hover:text-ds-heading"
          >
            Cancel
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="rounded-md bg-ds-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-ds-accent/90 disabled:opacity-50"
          >
            {saving ? 'Saving…' : isNew ? 'Create' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  required,
  error,
  hint,
  children
}: {
  label: string
  required?: boolean
  error?: string
  hint?: string
  children: ReactElement
}): ReactElement {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-ds-muted">
        {label}{required ? <span className="ml-0.5 text-red-500">*</span> : null}
      </label>
      {children}
      {error ? <p className="mt-1 text-xs text-red-500">{error}</p> : null}
      {hint && !error ? <p className="mt-1 text-xs text-ds-faint">{hint}</p> : null}
    </div>
  )
}
