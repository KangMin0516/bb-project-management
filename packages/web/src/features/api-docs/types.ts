/** Minimal OpenAPI 3 typings — only the fields we render. */

export interface SchemaObject {
  type?: string
  properties?: Record<string, SchemaObject>
  items?: SchemaObject
  required?: string[]
  enum?: string[]
  $ref?: string
  description?: string
  example?: unknown
  format?: string
  default?: unknown
  allOf?: SchemaObject[]
  oneOf?: SchemaObject[]
  anyOf?: SchemaObject[]
  nullable?: boolean
  minimum?: number
  maximum?: number
  minLength?: number
  maxLength?: number
}

export interface Parameter {
  name: string
  in: string
  required?: boolean
  schema?: SchemaObject
  description?: string
}

export interface RequestBody {
  required?: boolean
  content?: Record<string, { schema?: SchemaObject }>
}

export interface ResponseObject {
  description?: string
  content?: Record<string, { schema?: SchemaObject }>
}

export interface Operation {
  operationId?: string
  summary?: string
  description?: string
  tags?: string[]
  parameters?: Parameter[]
  requestBody?: RequestBody
  responses?: Record<string, ResponseObject>
  security?: Array<Record<string, string[]>>
}

export interface PathItem {
  get?: Operation
  post?: Operation
  put?: Operation
  patch?: Operation
  delete?: Operation
  parameters?: Parameter[]
}

export interface OpenApiSpec {
  info?: { title?: string; version?: string; description?: string }
  paths?: Record<string, PathItem>
  components?: { schemas?: Record<string, SchemaObject> }
  tags?: Array<{ name: string; description?: string }>
}

export interface GroupedEndpoints {
  tag: string
  description?: string
  endpoints: Array<{ method: string; path: string; operation: Operation }>
}
