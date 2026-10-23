FROM python:3.12-slim
WORKDIR /srv
COPY sportsbook_service/requirements.txt /srv/requirements.txt
RUN pip install --no-cache-dir -r /srv/requirements.txt && useradd --uid 10001 --create-home league && mkdir -p /data && chown league:league /data
COPY sportsbook_service /srv/sportsbook_service
COPY scripts/collect_licensed_odds.py /srv/scripts/collect_licensed_odds.py
USER league
ENV LH_LEAGUE_DB=/data/league.sqlite3 PYTHONUNBUFFERED=1
EXPOSE 8000
CMD ["python","-m","uvicorn","sportsbook_service.app:app","--host","0.0.0.0","--port","8000","--no-proxy-headers","--workers","1"]
