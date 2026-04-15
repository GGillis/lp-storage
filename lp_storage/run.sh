#!/bin/sh
# Read add-on options from the JSON file the Supervisor writes at startup
OPTIONS=/data/options.json
if [ -f "$OPTIONS" ]; then
    export DISCOGS_TOKEN=$(python3 -c "import json; print(json.load(open('$OPTIONS')).get('discogs_token',''))")
    export DISCOGS_USER_AGENT=$(python3 -c "import json; print(json.load(open('$OPTIONS')).get('discogs_user_agent','LPStorage/0.1'))")
    export BGG_TOKEN=$(python3 -c "import json; print(json.load(open('$OPTIONS')).get('bgg_token',''))")
fi

export DATABASE_URL="sqlite:////data/records.db"
export COVERS_DIR="/data/covers"
mkdir -p /data/covers

exec uvicorn main:app --host 0.0.0.0 --port 8000
