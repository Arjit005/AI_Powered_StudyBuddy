# 📋 REMEDIATION TRACKER: V2.0 PRODUCTION HARDENING

| Defect ID | Severity | Subsystem | Description | Target Remediation | Status |
| :---: | :---: | :--- | :--- | :--- | :---: |
| **D-01** | High | Infrastructure | QStash keepalive targets `/api/chat` | Create `/api/health` and update cron schedule | In Progress |
| **D-02** | High | Analytics | Heatmap uses fake modulo math in UI | Add backend endpoint grouping real `study_sessions` by date | In Progress |
| **D-03** | Critical | Vector RAG | 64-dim local hash vs 1536-dim Pinecone | Implement genuine semantic embeddings with Pinecone upsert | In Progress |
| **D-04** | High | Database | Production silently falls back to SQLite | Add strict startup validation if `ENV=production` | In Progress |
| **D-05** | Medium | Testing | No API integration test coverage | Add Pytest test suite covering Auth, Analytics, & Health | In Progress |
