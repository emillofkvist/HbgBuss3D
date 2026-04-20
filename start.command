#!/bin/bash
# macOS: dubbelklicka för att starta (kräver: chmod +x start.command)

cd "$(dirname "$0")"

echo "Startar HbgBuss 3D..."
npm run dev &
SERVER_PID=$!

# Vänta tills Vite är redo
for i in {1..20}; do
  curl -s http://localhost:5173 > /dev/null 2>&1 && break
  sleep 0.5
done

open http://localhost:5173

echo "Servern körs – stäng detta fönster för att stoppa."
wait $SERVER_PID
