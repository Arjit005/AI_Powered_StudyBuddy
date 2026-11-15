# 📋 REMEDIATION TRACKER: V2.0 PRODUCTION HARDENING

| Defect ID | Severity | Subsystem | Description | Target Remediation | Status |
| :---: | :---: | :--- | :--- | :--- | :---: |
| **D-01** | High | Infrastructure | QStash keepalive targets `/api/chat` | Create `/api/health` and update cron schedule | **VERIFIED FIXED** |
| **D-02** | High | Analytics | Heatmap uses fake modulo math in UI | Add backend endpoint grouping real `study_sessions` by date | **VERIFIED FIXED** |
| **D-03** | Critical | Vector RAG | 64-dim local hash vs 1536-dim Pinecone | Implement genuine semantic embeddings with Pinecone upsert | **VERIFIED FIXED** |
| **D-04** | High | Database | Production silently falls back to SQLite | Add strict startup validation if `ENV=production` | **VERIFIED FIXED** |
| **D-05** | Medium | Testing | No API integration test coverage | Add Pytest test suite covering Auth, Analytics, & Health | **VERIFIED FIXED** |
| **D-06** | High | AI Services | Deprecated LiteLLM model names causing 404s & latency spikes | Update active models & optimize circuit breaker fallbacks | **VERIFIED FIXED** |
| **D-07** | High | AI Services | Chat endpoint lacks streaming (high TTFT latency) | Implement `/api/chat/stream` SSE endpoint with real-time token yield | **VERIFIED FIXED** |
| **D-08** | Medium | Frontend | Monolithic JS bundle exceeding 1.2 MB | Configure Vite code-splitting via `manualChunks` | **VERIFIED FIXED** |
| **D-09** | Low | Dependencies | Deprecation warning noise in Google Generative AI | Filter FutureWarning noise and isolate SDK deprecation | **VERIFIED FIXED** |
