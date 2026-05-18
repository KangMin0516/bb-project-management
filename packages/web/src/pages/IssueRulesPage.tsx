import { useState, useMemo } from 'react'
import { Navigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/store'
import { useToastStore } from '@/shared/lib/toast'
import { getErrorMessage } from '@/shared/lib/error'
import { issueRuleApi, type IssueRule, type IssueType } from '@/features/issue-rule/api'
import TabSwitcher from '@/shared/ui/atoms/TabSwitcher'
import MarkdownEditor from '@/shared/ui/markdown/MarkdownEditor'
import { confirmDialog } from '@/shared/ui/confirm-dialog'

const TYPE_TABS = [
  { value: 'TASK', label: 'Task' },
  { value: 'BUG', label: 'Bug' },
  { value: 'EPIC', label: 'Epic' },
  { value: 'SUB_TASK', label: 'Sub-task' },
] as const

const AVAILABLE_FIELDS = [
  'title',
  'description',
  'priority',
  'status',
  'assigneeId',
  'dueDate',
  'startDate',
  'labels',
]

/**
 * Empty-string placeholder used in form state — Prisma stores nulls but
 * controlled <input> elements need a string. Translate at submit time.
 */
const NULLABLE_TO_EMPTY = (v: string | null | undefined) => v ?? ''

/**
 * Superuser-only editor for global per-IssueType create rules. Rules
 * are read by the MCP `create_issue` flow (and the web create-issue
 * form, eventually) so LLM-generated tasks land in the format the
 * team expects.
 */
export default function IssueRulesPage() {
  const currentUser = useAuthStore((s) => s.user)
  const [activeType, setActiveType] = useState<IssueType>('TASK')
  const queryClient = useQueryClient()

  const rulesQuery = useQuery({
    queryKey: ['issue-rules'],
    queryFn: issueRuleApi.list,
    enabled: !!currentUser?.isSuperuser,
  })

  const activeRule = useMemo<IssueRule | undefined>(
    () => rulesQuery.data?.find((r) => r.issueType === activeType),
    [rulesQuery.data, activeType],
  )

  const upsert = useMutation({
    mutationFn: issueRuleApi.upsert,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issue-rules'] })
      useToastStore.getState().addToast('Rule saved', 'success')
    },
    onError: (err) =>
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to save rule'), 'error'),
  })

  const remove = useMutation({
    mutationFn: issueRuleApi.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issue-rules'] })
      useToastStore.getState().addToast('Rule cleared', 'success')
    },
  })

  if (!currentUser?.isSuperuser) return <Navigate to="/" replace />

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Issue Rules</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Global rules applied when any client (MCP, AI, web) creates an issue. Soft-validated —
          missing required fields surface as warnings to the caller instead of blocking creation.
        </p>
      </header>

      <TabSwitcher
        options={TYPE_TABS}
        value={activeType}
        onChange={(v) => setActiveType(v as IssueType)}
      />

      {rulesQuery.isLoading ? (
        <div className="py-8 text-center text-sm text-gray-400">Loading…</div>
      ) : (
        <RuleEditor
          key={activeType}
          issueType={activeType}
          rule={activeRule}
          isPending={upsert.isPending}
          onSubmit={(payload) => upsert.mutate(payload)}
          onClear={
            activeRule
              ? async () => {
                  const ok = await confirmDialog({
                    title: `Clear rule for ${activeType}?`,
                    description:
                      'This wipes the title pattern, description template, required fields, defaults, and enforced labels for this issue type. Existing issues are not affected.',
                    confirmLabel: 'Clear rule',
                    cancelLabel: 'Keep it',
                    destructive: true,
                  })
                  if (ok) remove.mutate(activeType)
                }
              : undefined
          }
        />
      )}
    </div>
  )
}

interface RuleEditorProps {
  issueType: IssueType
  rule: IssueRule | undefined
  isPending: boolean
  onSubmit: (payload: {
    issueType: IssueType
    titlePattern: string | null
    descriptionTemplate: string | null
    requiredFields: string[]
    defaultValues: Record<string, unknown>
    enforcedLabelNames: string[]
  }) => void
  onClear?: () => void
}

function RuleEditor({ issueType, rule, isPending, onSubmit, onClear }: RuleEditorProps) {
  const [titlePattern, setTitlePattern] = useState(NULLABLE_TO_EMPTY(rule?.titlePattern))
  const [descriptionTemplate, setDescriptionTemplate] = useState(
    NULLABLE_TO_EMPTY(rule?.descriptionTemplate),
  )
  const [requiredFields, setRequiredFields] = useState<string[]>(rule?.requiredFields ?? [])
  const [defaultsText, setDefaultsText] = useState(
    rule?.defaultValues ? JSON.stringify(rule.defaultValues, null, 2) : '{}',
  )
  const [enforcedLabelsText, setEnforcedLabelsText] = useState(
    (rule?.enforcedLabelNames ?? []).join(', '),
  )
  const [defaultsError, setDefaultsError] = useState<string | null>(null)

  const toggleField = (field: string) => {
    setRequiredFields((prev) =>
      prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field],
    )
  }

  const submit = () => {
    let defaultValues: Record<string, unknown> = {}
    try {
      defaultValues = defaultsText.trim() ? JSON.parse(defaultsText) : {}
      setDefaultsError(null)
    } catch {
      setDefaultsError('Defaults must be valid JSON.')
      return
    }
    onSubmit({
      issueType,
      titlePattern: titlePattern.trim() || null,
      descriptionTemplate: descriptionTemplate.trim() || null,
      requiredFields,
      defaultValues,
      enforcedLabelNames: enforcedLabelsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    })
  }

  return (
    <section className="space-y-5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
      <Field
        label="Title pattern"
        hint="Optional. Wrap with /…/ to enforce as a regex (e.g. /^\[BUG\]/). Plain text is shown as a hint only."
      >
        <input
          value={titlePattern}
          onChange={(e) => setTitlePattern(e.target.value)}
          placeholder="/^\\[BUG\\]/"
          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
        />
      </Field>

      <Field
        label="Description template"
        hint="Skeleton the LLM uses to start the description. Use the toolbar for headings/lists/code — the underlying value is markdown."
      >
        <MarkdownEditor
          value={descriptionTemplate}
          onChange={setDescriptionTemplate}
          placeholder={'Write the issue description skeleton here…\n\nE.g. ## Steps to reproduce'}
          minRows={6}
        />
      </Field>

      <Field label="Required fields" hint="Soft — missing fields surface as warnings to the caller.">
        <div className="flex flex-wrap gap-2">
          {AVAILABLE_FIELDS.map((f) => {
            const active = requiredFields.includes(f)
            return (
              <button
                key={f}
                type="button"
                onClick={() => toggleField(f)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  active
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                    : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                {f}
              </button>
            )
          })}
        </div>
      </Field>

      <Field
        label="Default values (JSON)"
        hint={'Merged into the create payload when the caller omits the field.\nExample: { "priority": "MEDIUM", "status": "TODO" }'}
      >
        <textarea
          value={defaultsText}
          onChange={(e) => setDefaultsText(e.target.value)}
          rows={4}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 font-mono text-xs focus:border-primary-500 focus:outline-none"
        />
        {defaultsError && (
          <p className="text-xs text-red-500">{defaultsError}</p>
        )}
      </Field>

      <Field
        label="Enforced labels"
        hint="Comma-separated label names — auto-attached to every issue. Missing labels are created in the target project."
      >
        <input
          value={enforcedLabelsText}
          onChange={(e) => setEnforcedLabelsText(e.target.value)}
          placeholder="needs-triage, ai-generated"
          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
        />
      </Field>

      <div className="flex items-center justify-end gap-3 pt-2">
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="text-sm text-red-500 hover:text-red-600"
          >
            Clear rule
          </button>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={isPending}
          className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {isPending ? 'Saving…' : rule ? 'Save changes' : 'Create rule'}
        </button>
      </div>
    </section>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
      {children}
      {hint && (
        <p className="whitespace-pre-line text-xs text-gray-400 dark:text-gray-500">{hint}</p>
      )}
    </div>
  )
}
