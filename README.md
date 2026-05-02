# 🔒 Escape Room 3D

Interactive 3D Escape Room puzzle game built with Three.js. Runs in the browser with support for both desktop (AZERTY controls) and mobile (virtual joystick).

## Features

- **3D First-Person Environment** built with Three.js
- **Cross-Platform Controls**: AZERTY keyboard (Z/S/Q/D) + mouse on PC, virtual joystick on mobile
- **6 Unique Puzzles**: Paper & lighter, UV phone camera, abstract painting with red filter, thermal cup, shadow sculpture, radio frequency
- **Mirror Activation System**: Find and place 3 mirrors to activate the lock screen
- **Inventory System**: Pick up and combine items
- **Count-Up Timer**: Tracks your escape time
- **Admin Panel**: Access with username `admin-louai` to view all player results
- **Red Herrings**: Decoy objects to increase difficulty

## Running Locally

```bash
pip install fastapi[standard] uvicorn httpx
uvicorn main:app --reload --port 8000
```

Then open http://localhost:8000

## Tech Stack

- **Frontend**: Three.js (vanilla JS), HTML5, CSS3
- **Backend**: FastAPI (Python) for serving static files and storing results
