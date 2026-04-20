#!/bin/bash
# Linux: kör med  ./start.sh  eller dubbelklicka i filhanteraren

cd "$(dirname "$0")"

echo "Startar HbgBuss 3D..."
npm run dev &
SERVER_PID=$!

for i in {1..20}; do
  curl -s http://localhost:5173 > /dev/null 2>&1 && break
  sleep 0.5
done

# Öppna webbläsare (försöker flera kommandon)
xdg-open http://localhost:5173 2>/dev/null \
  || sensible-browser http://localhost:5173 2>/dev/null \
  || firefox http://localhost:5173 2>/dev/null \
  || google-chrome http://localhost:5173 2>/dev/null

echo "Servern körs – Ctrl+C för att stoppa."
wait $SERVER_PID
