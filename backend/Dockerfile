FROM python:3.10-slim

WORKDIR /app

# Install system compilation dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Optimize layer caching for python packages
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# Run with Daphne ASGI engine to process standard WebSockets
CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "core.asgi:application"]
