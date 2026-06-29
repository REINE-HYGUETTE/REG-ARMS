FROM python:3.12-slim
WORKDIR /app

# Install deps first for layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download NLTK corpora at build time so the first request isn't slow
RUN python -c "import nltk; nltk.download('punkt'); nltk.download('punkt_tab'); nltk.download('stopwords')"

COPY . .

# Host injects PORT; default 5000. Single worker keeps memory low and avoids
# each worker retraining the model. Long timeout covers the train-on-boot step.
ENV PORT=5000
EXPOSE 5000
CMD ["sh", "-c", "gunicorn ai_api:app --bind 0.0.0.0:${PORT} --workers 1 --timeout 120"]
