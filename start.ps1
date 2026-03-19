# ORION startup script
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd E:\Projects\orion-app\client; npm start"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd E:\Projects\orion-app; uvicorn main:app --port 8080 --reload"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd E:\Projects\orion-app; claude"