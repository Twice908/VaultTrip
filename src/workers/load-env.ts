import { config } from 'dotenv'

// The worker runs as a standalone process (not under Next.js), so it must load
// `.env.local` itself before any module that validates env at import time
// (e.g. `@/env`). Imported first in `document-processor.ts`. In production,
// platform-provided env vars take precedence and the missing file is a no-op.
config({ path: '.env.local' })
