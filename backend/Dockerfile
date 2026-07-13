FROM python:3.12-slim AS builder

RUN pip install uv
WORKDIR /app
COPY pyproject.toml .
RUN uv sync --no-dev --no-install-project

FROM python:3.12-slim

WORKDIR /app
COPY --from=builder /app/.venv /app/.venv
ENV PATH="/app/.venv/bin:$PATH"

COPY . .

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
