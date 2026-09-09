# Test Kimlik Bilgileri

Bu uygulamada **kimlik doğrulama yoktur** (local-first, offline, tek makine).
Giriş/hesap/parola gerekmez. Tüm ekranlar doğrudan erişilebilir.

- Backend: FastAPI, `/api` önekli, salt-okunur fixture verisi
- Frontend: React + TypeScript (CRA), port 3000
- Veri: `backend/fixtures/*.json` (60 gün, 13 bölüm, 59 sınıf, ~188 kalem)

## Smoke Test

```bash
cd backend && python -m pytest tests/test_smoke.py -q
```
