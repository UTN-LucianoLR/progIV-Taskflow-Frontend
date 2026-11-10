# TaskFlow Frontend

Frontend mínimo y desacoplado (Single Page Application - SPA) desarrollado en HTML, CSS y JavaScript Vanilla (sin frameworks externos) para consumir la API de **TaskFlow**.

## Características
- **Autenticación JWT:** Inicio de sesión contra `/api/token/` con almacenamiento seguro en `sessionStorage` y control de límite de intentos (HTTP 429).
- **Proyectos y Tareas:** Carga dinámica de proyectos en base a la membresía del usuario y listado paginado de tareas.
- **Seguridad:** Renderizado de contenido mediante `textContent` para mitigación estricta de ataques Cross-Site Scripting (XSS).
- **Control de Roles:** Creación de tareas con captura y visualización de errores de permisos (HTTP 403 Forbidden).
- **Tiempo Real (WebSockets):** Conexión en vivo al WebSocket de Django Channels (`/ws/projects/{id}/?token=...`) para sincronizar tareas instantáneamente ante eventos `task_created`, `task_updated` o `task_completed`.
- **Compatibilidad Dual:** Puede apuntar tanto al backend en desarrollo (`http://127.0.0.1:8000/api`) como al backend en producción desplegado en Render.

## Ejecución local
Para servir la aplicación localmente en el puerto 5500:
```bash
python -m http.server 5500 --bind 127.0.0.1
```
Luego abrir [http://127.0.0.1:5500](http://127.0.0.1:5500) en el navegador.
