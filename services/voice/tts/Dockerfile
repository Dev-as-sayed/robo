FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1
ENV TTS_DATA_DIR=/models

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py download_voice.py entrypoint.sh ./
RUN chmod +x entrypoint.sh

EXPOSE 8002
CMD ["/app/entrypoint.sh"]
