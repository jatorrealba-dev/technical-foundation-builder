# Production Hardening v10.1 Hotfix

## Problem

The organization AI settings route rendered two `ProgressValue` components from a
Server Component using function children. React Server Components cannot serialize
functions into Client Component props, producing:

`Functions are not valid as a child of Client Components.`

## Resolution

Both progress values now receive serializable text children calculated on the
server. No database, dependency, environment, or API changes are required.

## Regression coverage

`tests/ai-settings-rsc-boundary.test.mjs` verifies that the AI settings page does
not pass render functions to `ProgressValue`.
