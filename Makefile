.PHONY: dev backend frontend fixtures

dev:
	@echo "Starting backend (:8001) and frontend (:3000)..."
	@(cd backend && uvicorn server:app --host 0.0.0.0 --port 8001 --reload &) ; \
	 (cd frontend && yarn start)

backend:
	cd backend && uvicorn server:app --host 0.0.0.0 --port 8001 --reload

frontend:
	cd frontend && yarn start

fixtures:
	cd backend && python generate_fixtures.py
