import { cn } from '@/shared/lib/utils'
import type { OpenApiSpec, SchemaObject } from '@/features/api-docs/types'
import { resolveSchema, getTypeString } from '@/features/api-docs/lib'

const MAX_NESTING = 3

interface SchemaPropertiesProps {
  schema: SchemaObject
  spec: OpenApiSpec
  depth?: number
}

export default function SchemaProperties({ schema, spec, depth = 0 }: SchemaPropertiesProps) {
  const resolved = resolveSchema(schema, spec, depth)
  if (!resolved?.properties) return null

  return (
    <div className={cn('space-y-1', depth > 0 && 'ml-4 border-l-2 border-gray-100 dark:border-gray-700 pl-3')}>
      {Object.entries(resolved.properties).map(([name, prop]) => {
        const propResolved = resolveSchema(prop, spec, depth + 1)
        const isRequired = resolved.required?.includes(name)
        const typeStr = getTypeString(prop, spec)

        return (
          <div key={name} className="py-1">
            <div className="flex items-center gap-2">
              <code className="text-xs font-medium text-gray-900 dark:text-gray-100">{name}</code>
              {isRequired && <span className="text-[10px] font-medium text-red-500">required</span>}
              <span className="text-[10px] text-gray-400 dark:text-gray-500">{typeStr}</span>
            </div>
            {prop.description && (
              <p className="text-[11px] text-gray-500 dark:text-gray-400">{prop.description}</p>
            )}
            {prop.enum && (
              <div className="mt-0.5 flex flex-wrap gap-1">
                {prop.enum.map((v) => (
                  <span key={v} className="rounded bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 text-[10px] font-mono text-gray-600 dark:text-gray-300">
                    {String(v)}
                  </span>
                ))}
              </div>
            )}
            {propResolved?.properties && depth < MAX_NESTING && (
              <SchemaProperties schema={propResolved} spec={spec} depth={depth + 1} />
            )}
          </div>
        )
      })}
    </div>
  )
}
