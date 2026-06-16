import { config } from 'dotenv'

// Load .env.local so modules that validate env at import time (src/env.ts)
// have the required variables available during tests.
config({ path: '.env.local' })
