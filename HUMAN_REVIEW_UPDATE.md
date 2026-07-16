# Human Review Update

This update adds controlled human review for AI agent runs.

## Included behavior

- Completed agent runs receive a pending review record.
- Organization owners and admins can approve or reject results with a comment.
- Approved Project Model Analyst runs can be explicitly applied.
- Applying an approved Project Model run updates `project_models` and regenerates all eight artifacts.
- Artifact version triggers preserve previous document versions.
- Other agents remain advisory and cannot change project state automatically.
- Review and application events are written to `agent_run_events`.

## Database

Apply:

```bash
npx supabase db push
```

The new migration is:

```text
0007_agent_run_human_review.sql
```

## Validation

```bash
npm run check
npm run dev
```

Then open a project, enter **Agentes de IA**, review a completed run, and test approval/rejection. To test controlled application, approve a **Project Model Analyst** run and use **Aplicar recomendaciones**.

## Stabilization follow-up

Migration `0008_stabilize_human_review_workflow.sql` supersedes the non-transactional application path described above. Approved Project Model changes and all eight document writes now execute through a locked PostgreSQL RPC, with Project Model version history and controlled restoration.
