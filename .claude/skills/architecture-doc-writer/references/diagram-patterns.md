# Diagram Patterns

Copy-adapt these snippets. They are all proven in the reference corpus.

---

## 1. C4 Context (Mermaid)

```mermaid
graph TB
    User([User])
    FE[Frontend SPA]
    BE[Backend Service<br/>Control Plane]
    MQ[(Message Broker)]
    DB[(Primary Database)]
    Cache[(Redis<br/>idempotency + rate limit)]
    Workers[Worker Pool<br/>horizontally scalable]
    External[Third-party API]

    User -->|HTTPS| FE
    FE -->|REST/GraphQL| BE
    BE <-->|ORM| DB
    BE -->|publish| MQ
    MQ --> Workers
    Workers -->|HTTP| External
    Workers --> DB
    Workers <--> Cache

    classDef external fill:#dadada,stroke:#666
    classDef new fill:#ffe6cc,stroke:#d79b00
    class External external
    class MQ,Cache,Workers new
```

**Legend convention:**
- Orange (`#ffe6cc`) = new component to build
- Grey (`#dadada`) = existing external system
- White = existing internal component being refactored

---

## 2. Container diagram (Mermaid `graph LR` with subgraphs)

```mermaid
graph LR
    subgraph "Backend"
        API[REST API]
        SVC[Domain Service]
        OB[Outbox Publisher]
    end

    subgraph "Workers"
        SW[Submission Worker]
        SY[Sync Worker]
    end

    subgraph "Message Broker"
        QSub[orders.submit<br/>prefetch=4]
        QSync[orders.sync<br/>prefetch=10]
    end

    API --> SVC
    SVC --> OB
    OB --> QSub
    SW -->|consume| QSub
    SY -->|consume| QSync
```

Use subgraphs to mark deployment boundaries (a subgraph ≈ a process / pod / VM group).

---

## 3. ASCII boxed topology (when column alignment matters)

```
┌───────────────────────────────────────────────────────────────────┐
│                     CONTROL PLANE                                 │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ REST API    │  │ Domain Svc   │  │ Domain Event Publisher   │  │
│  │             │─▶│              │─▶│ (Outbox Pattern)         │  │
│  └─────────────┘  └──────┬───────┘  └──────────┬───────────────┘  │
│         │                │                     │                  │
│         ▼                ▼                     ▼                  │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  PostgreSQL (source of truth + outbox table)               │   │
│  └────────────────────────────────────────────────────────────┘   │
└───────────────────────────┬───────────────────────────────────────┘
                            │ publish
                            ▼
┌───────────────────────────────────────────────────────────────────┐
│                  MESSAGE BROKER (cluster)                         │
│   Exchange: <domain>.events  (topic)                              │
│       ├──▶ Queue: workers.jobs.pending                            │
│       │       └─ DLQ: workers.jobs.dead                           │
│       ├──▶ Queue: audit                                           │
│       └──▶ Queue: scaler.signals                                  │
└───────────┬─────────────────────────────────────┬─────────────────┘
            │ consume                             │ inspect depth
            ▼                                     ▼
┌──────────────────────────────┐  ┌─────────────────────────────────┐
│   WORKER POOL                │  │   AUTOSCALER CONTROLLER         │
└──────────────────────────────┘  └─────────────────────────────────┘
```

**Box-drawing kit:** `┌ ┐ └ ┘ ─ │ ├ ┤ ┬ ┴ ┼ ▶ ▼ ◀ ▲`

---

## 4. Sequence diagram (Mermaid)

```mermaid
sequenceDiagram
    actor User
    participant FE
    participant API as BE: API
    participant SVC as DomainService
    participant DB
    participant MQ as MessageBroker
    participant W as Worker
    participant Ext as ExternalAPI

    User->>FE: Click "Start"
    FE->>API: POST /resource
    API->>SVC: create()

    SVC->>DB: BEGIN TX
    SVC->>DB: INSERT main_row
    SVC->>DB: INSERT outbox_event
    SVC->>DB: COMMIT
    SVC-->>API: id
    API-->>FE: 201 Created
    FE-->>User: "Pending"

    Note over MQ,W: Async processing
    MQ->>W: deliver job
    W->>Ext: HTTP call
    alt success
        Ext-->>W: 200 OK
        W->>DB: UPDATE status=PROCESSING
        W->>MQ: publish success event
    else failure
        Ext--xW: 5xx
        W->>MQ: nack (retry with delay)
    end
    W->>MQ: ack
```

**Rules:**
- `actor` for humans, `participant` for systems
- `participant X as Long Label` for renaming
- `-->>` for response, `->>` for sync call, `--x` for failure/timeout
- `Note over X,Y: text` for narration
- `alt`/`else`/`end`, `loop`/`end`, `par`/`and`/`end`, `opt`/`end`

---

## 5. State machine (Mermaid)

```mermaid
stateDiagram-v2
    [*] --> PENDING: create
    PENDING --> PROCESSING: worker claim
    PENDING --> SCHEDULED: if scheduled_at > now
    SCHEDULED --> PROCESSING: scheduler tick
    PROCESSING --> RUNNING: external confirms
    PROCESSING --> FAILED: external rejects
    PROCESSING --> PROVIDER_UNAVAILABLE: circuit open
    PROVIDER_UNAVAILABLE --> PROCESSING: retry after cooldown
    RUNNING --> COMPLETED: all done
    RUNNING --> PARTIAL: some delivered
    PARTIAL --> COMPLETED: rest delivered
    PARTIAL --> FAILED: timeout
    COMPLETED --> [*]
    FAILED --> [*]
    FAILED --> REFUNDED: quota refund
    REFUNDED --> [*]

    note right of PROVIDER_UNAVAILABLE
        Circuit breaker OPEN.
        Will retry automatically.
    end note
```

---

## 6. Queue topology (Mermaid `graph TB` with subgraphs)

```mermaid
graph TB
    subgraph "Exchanges"
        XEvents{domain.events<br/>topic}
        XDLX{domain.dlx<br/>fanout}
    end

    subgraph "Work Queues"
        QSubmit[(jobs.submit<br/>prefetch=4<br/>TTL=1h)]
        QSync[(jobs.sync<br/>prefetch=10)]
        QDelay[(jobs.delayed<br/>x-message-ttl)]
    end

    subgraph "Event Queues"
        QAudit[(audit)]
        QNotif[(notifications)]
    end

    subgraph "DLQ"
        DLQSub[(jobs.submit.dead)]
        DLQSync[(jobs.sync.dead)]
    end

    XEvents -->|routing.key.pattern| QSubmit
    XEvents -->|domain.# fanout| QAudit
    XEvents -->|notify.*| QNotif
    QSubmit -.->|nack/expire| XDLX
    QSync -.->|nack| XDLX
    XDLX --> DLQSub
    XDLX --> DLQSync
```

---

## 7. ER diagram (Mermaid)

```mermaid
erDiagram
    PARENT ||--o{ CHILD : "1-to-many"
    CHILD ||--|| CHILD_STATUS : "1-to-1 hot table"
    CHILD }o--o| OTHER : "optional ref"

    PARENT {
        uuid id PK
        varchar status "PENDING|RUNNING|COMPLETED"
        timestamptz created_at
        uuid owner_id FK
    }

    CHILD {
        uuid id PK
        uuid parent_id FK
        varchar kind "[NEW] kind enum"
        jsonb payload
        int attempt_count "[CHG] now nullable"
    }
```

Annotate columns with `[NEW]`, `[CHG]`, `[DEL]` in the comment field to show migration deltas.

---

## 8. Gantt timeline (Mermaid)

```mermaid
gantt
    title <Domain> Migration Timeline
    dateFormat YYYY-MM-DD
    axisFormat %d/%m

    section Foundation
    M0 Audit & Setup            :m0, 2026-05-12, 3d
    M1 Outbox + Broker          :m1, after m0, 7d

    section Workers
    M2 SubmissionWorker         :m2, after m1, 7d
    M3 StatusSyncWorker         :m3, after m2, 5d

    section Resilience
    M4 Circuit Breaker          :m4, after m3, 4d
    M5 Multi-provider router    :m5, after m4, 7d

    section Hardening
    M6 Observability + Load Test:m6, after m5, 5d
```

**Rule:** the section names and `M<n>` IDs must match the phase table that follows.

---

## 9. Class diagram (Mermaid) — for adapter / registry patterns

```mermaid
classDiagram
    class IProvider {
        <<interface>>
        +name: string
        +submit(payload): Promise~Result~
        +getStatus(id): Promise~Status~
    }

    class ProviderA {
        -httpClient
        -apiKey
        +submit()
        +getStatus()
    }

    class ProviderRegistry {
        -providers: Map~string, IProvider~
        +register(p)
        +get(name): IProvider
        +pickByCapability(cap): IProvider
    }

    IProvider <|.. ProviderA
    ProviderRegistry --> IProvider
```

---

## 10. Captioning rules

- One short line **above** the diagram naming what it shows.
- One short paragraph **below** explaining the non-obvious parts or the legend.
- For decision-rich diagrams, follow with a bulleted list of "what to notice".
