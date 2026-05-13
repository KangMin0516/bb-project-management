import type { OpenApiSpec, SchemaObject } from './types'

const MAX_DEPTH = 5

export const METHOD_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  GET: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800' },
  POST: { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-700 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-800' },
  PATCH: { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-800' },
  PUT: { bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-700 dark:text-orange-400', border: 'border-orange-200 dark:border-orange-800' },
  DELETE: { bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-700 dark:text-red-400', border: 'border-red-200 dark:border-red-800' },
}

/** Walks `#/components/schemas/Foo` style refs to the schema they point at. */
export function resolveRef(ref: string, spec: OpenApiSpec): SchemaObject | undefined {
  const parts = ref.replace('#/', '').split('/')
  let current: unknown = spec
  for (const part of parts) {
    if (current && typeof current === 'object') {
      current = (current as Record<string, unknown>)[part]
    } else {
      return undefined
    }
  }
  return current as SchemaObject | undefined
}

/**
 * Resolves $ref, then flattens `allOf` into a single merged schema so the
 * renderer can iterate `properties` without re-walking. Bounded by MAX_DEPTH
 * to defuse pathological circular references.
 */
export function resolveSchema(schema: SchemaObject | undefined, spec: OpenApiSpec, depth = 0): SchemaObject | undefined {
  if (!schema || depth > MAX_DEPTH) return schema
  if (schema.$ref) return resolveRef(schema.$ref, spec)
  if (schema.allOf) {
    const merged: SchemaObject = { type: 'object', properties: {}, required: [] }
    for (const sub of schema.allOf) {
      const resolved = resolveSchema(sub, spec, depth + 1)
      if (resolved?.properties) merged.properties = { ...merged.properties, ...resolved.properties }
      if (resolved?.required) merged.required = [...(merged.required || []), ...resolved.required]
    }
    return merged
  }
  return schema
}

function getSchemaName(ref?: string): string {
  if (!ref) return ''
  const parts = ref.split('/')
  return parts[parts.length - 1]
}

/** Human-readable type string for the right column of the schema table. */
export function getTypeString(schema: SchemaObject | undefined, spec: OpenApiSpec): string {
  if (!schema) return 'any'
  if (schema.$ref) return getSchemaName(schema.$ref)
  if (schema.allOf) return 'object'
  if (schema.oneOf) return schema.oneOf.map((s) => getTypeString(s, spec)).join(' | ')
  if (schema.type === 'array') {
    const itemType = schema.items ? getTypeString(schema.items, spec) : 'any'
    return `${itemType}[]`
  }
  if (schema.enum) return schema.enum.map((v) => `"${v}"`).join(' | ')
  if (schema.format) return `${schema.type} (${schema.format})`
  return schema.type || 'any'
}
