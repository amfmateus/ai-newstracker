FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
# We need these for some python packages and potentially for playwright dependencies to be installed correctly
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .


RUN pip install --no-cache-dir --default-timeout=100 -r requirements.txt

# Install Playwright browsers (and their massive dependencies)
RUN playwright install-deps
RUN playwright install chromium

COPY . .

# Expose port
EXPOSE 8000

# Run the application
CMD ["python", "run.py"]
