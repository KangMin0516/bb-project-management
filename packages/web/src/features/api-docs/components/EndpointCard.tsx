import { useState } from 'react'
import { ChevronDown, ChevronRight, Lock } from 'lucide-react'
import type { Operation, OpenApiSpec, Parameter } from '@/features/api-docs/types'
import { METHOD_COLORS, resolveSchema } from '@/features/api-docs/lib'
import { cn } from '@/shared/lib/utils'
import MethodBadge from './MethodBadge'
import CopyButton from './CopyButton'
import SchemaProperties from './SchemaProperties'

interface EndpointCardProps {
  method: string
  path: string
  operation: Operation
  spec: OpenApiSpec
}

export default function EndpointCard({ method, path, operation, spec }: EndpointCardProps) {
  const [expanded, setExpanded] = useState(false)
  const colors = METHOD_COLORS[method] || METHOD_COLORS.GET
  const hasAuth = !operation.security || operation.security.length > 0
  const bodySchema =
    operation.requestBody?.content?.['application/json']?.schema ??
    operation.requestBody?.content?.['multipart/form-data']?.schema
  const resolvedBody = bodySchema ? resolveSchema(bodySchema, spec) : undefined
  const pathParams = operation.parameters?.filter((p) => p.in === 'path') ?? []
  const queryParams = operation.parameters?.filter((p) => p.in === 'query') ?? []

  const curl = buildCurl(method, path, hasAuth, !!resolvedBody)

  return (
    <div className={cn('rounded-lg border transition-colors', expanded ? colors.border : 'border-gray-200 dark:border-gray-700')}>
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn('flex w-full items-center gap-3 px-4 py-3 text-left', expanded && colors.bg)}
      >
        <MethodBadge method={method} />
        <code className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-200">{path}</code>
        {hasAuth && <Lock className="h-3 w-3 text-gray-400 dark:text-gray-500" />}
        <span className="max-w-xs truncate text-xs text-gray-500 dark:text-gray-400 hidden sm:block">
          {operation.summary}
        </span>
        {expanded ? <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" /> : <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />}
      </button>

      {expanded && (
        <div className="border-t border-gray-100 dark:border-gray-700 p-4 space-y-4">
          {(operation.summary || operation.description) && (
            <div>
              {operation.summary && <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{operation.summary}</h4>}
              {operation.description && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{operation.description}</p>}
            </div>
          )}

          <CurlBlock curl={curl} method={method} path={path} hasAuth={hasAuth} hasBody={!!resolvedBody} />

          {pathParams.length > 0 && <ParamSection title="Path Parameters" params={pathParams} alwaysRequired />}
          {queryParams.length > 0 && <ParamSection title="Query Parameters" params={queryParams} />}

          {resolvedBody?.properties && (
            <Block title="Request Body">
              <div className="rounded-md border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3">
                <SchemaProperties schema={resolvedBody} spec={spec} />
              </div>
            </Block>
          )}

          {operation.responses && (
            <Block title="Responses">
              <div className="space-y-1">
                {Object.entries(operation.responses).map(([code, resp]) => (
                  <div key={code} className="flex items-start gap-2 px-1">
                    <span className={cn('rounded px-1.5 py-0.5 text-[11px] font-mono font-bold', statusClass(code))}>
                      {code}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{resp.description}</span>
                  </div>
                ))}
              </div>
            </Block>
          )}
        </div>
      )}
    </div>
  )
}

function statusClass(code: string): string {
  if (code.startsWith('2')) return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
  if (code.startsWith('4')) return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
  return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
}

function buildCurl(method: string, path: string, hasAuth: boolean, hasBody: boolean): string {
  let cmd = `curl -X ${method} '/api${path}'`
  if (hasAuth) cmd += " \\\n  -H 'Authorization: Bearer <token>'"
  if (hasBody) cmd += " \\\n  -H 'Content-Type: application/json' \\\n  -d '{}'"
  return cmd
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h5 className="mb-2 text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase">{title}</h5>
      {children}
    </div>
  )
}

function ParamSection({ title, params, alwaysRequired }: { title: string; params: Parameter[]; alwaysRequired?: boolean }) {
  return (
    <Block title={title}>
      <div className="rounded-md border border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
        {params.map((p) => (
          <div key={p.name} className="flex items-start gap-3 px-3 py-2">
            <code className="text-xs font-medium text-gray-900 dark:text-gray-100">{p.name}</code>
            {(alwaysRequired || p.required) && <span className="text-[10px] font-medium text-red-500">required</span>}
            <span className="text-[10px] text-gray-400">{p.schema?.type || 'string'}</span>
            {p.schema?.enum && (
              <div className="flex flex-wrap gap-1">
                {p.schema.enum.map((v) => (
                  <span key={v} className="rounded bg-gray-100 dark:bg-gray-700 px-1 py-0.5 text-[10px] font-mono text-gray-600 dark:text-gray-300">
                    {String(v)}
                  </span>
                ))}
              </div>
            )}
            {p.description && <span className="text-[11px] text-gray-500 dark:text-gray-400">{p.description}</span>}
          </div>
        ))}
      </div>
    </Block>
  )
}

function CurlBlock({ curl, method, path, hasAuth, hasBody }: { curl: string; method: string; path: string; hasAuth: boolean; hasBody: boolean }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase">Request</span>
        <CopyButton text={curl} />
      </div>
      <div className="rounded-md bg-gray-900 dark:bg-gray-950 p-3 font-mono text-xs text-gray-200 overflow-x-auto">
        <span className="text-emerald-400">curl</span> <span className="text-amber-300">-X {method}</span>{' '}
        <span className="text-gray-300">'/api{path}'</span>
        {hasAuth && (
          <>
            {' \\\n  '}
            <span className="text-amber-300">-H</span> <span className="text-gray-300">'Authorization: Bearer {'<token>'}'</span>
          </>
        )}
        {hasBody && (
          <>
            {' \\\n  '}
            <span className="text-amber-300">-H</span> <span className="text-gray-300">'Content-Type: application/json'</span>
            {' \\\n  '}
            <span className="text-amber-300">-d</span> <span className="text-gray-300">'{'{...}'}'</span>
          </>
        )}
      </div>
    </div>
  )
}
