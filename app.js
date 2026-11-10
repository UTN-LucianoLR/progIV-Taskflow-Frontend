// TaskFlow Frontend SPA (Clase 13)
let API_URL = "https://taskflow-api-progiv.onrender.com/api";
let accessToken = null;
let currentProject = null;
let nextUrl = null;
let prevUrl = null;
let socket = null;

function getApiUrl() {
  const custom = document.getElementById("api-url");
  return (custom && custom.value.trim()) || API_URL;
}

function authHeaders() {
  return {
    "Authorization": `Bearer ${accessToken}`,
    "Content-Type": "application/json"
  };
}

// E4-03: Login y manejo del token
async function login() {
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  const errorElement = document.getElementById("login-error");
  errorElement.textContent = "";

  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  if (!username || !password) {
    errorElement.textContent = "Por favor completá usuario y contraseña.";
    return;
  }

  API_URL = getApiUrl().replace(/\/+$/, "");

  try {
    const response = await fetch(`${API_URL}/token/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    if (!response.ok) {
      if (response.status === 429) {
        errorElement.textContent = "Demasiados intentos. Esperen un minuto.";
      } else {
        errorElement.textContent = "Usuario o contraseña incorrectos.";
      }
      return;
    }

    const data = await response.json();
    accessToken = data.access;
    sessionStorage.setItem("taskflow_token", accessToken);
    sessionStorage.setItem("taskflow_username", username);
    sessionStorage.setItem("taskflow_api", API_URL);

    showApp(username);
  } catch (err) {
    errorElement.textContent = "Error de conexión con el servidor. Verificá la URL de la API y CORS.";
  }
}

// E4-08: Cerrar sesión
function logout() {
  accessToken = null;
  sessionStorage.removeItem("taskflow_token");
  sessionStorage.removeItem("taskflow_username");
  if (socket) {
    socket.close();
    socket = null;
  }
  document.getElementById("app-box").style.display = "none";
  document.getElementById("login-box").style.display = "block";
  document.getElementById("password").value = "";
  document.getElementById("tasks").innerHTML = "";
  document.getElementById("project").innerHTML = "";
}

function showApp(username) {
  document.getElementById("login-box").style.display = "none";
  document.getElementById("app-box").style.display = "block";
  const userInfo = document.getElementById("user-info");
  if (userInfo) userInfo.textContent = `Usuario: ${username}`;

  loadProjects();
}

// E4-04: Cargar proyectos en el desplegable
async function loadProjects() {
  const select = document.getElementById("project");
  select.innerHTML = "";

  try {
    const response = await fetch(`${API_URL}/projects/`, {
      headers: authHeaders()
    });

    if (!response.ok) {
      if (response.status === 401) return logout();
      return;
    }

    const data = await response.json();
    const projects = data.results || data;

    if (!projects || projects.length === 0) {
      const opt = document.createElement("option");
      opt.textContent = "No pertenecés a ningún proyecto";
      opt.value = "";
      select.appendChild(opt);
      document.getElementById("tasks").innerHTML = "";
      return;
    }

    projects.forEach((proj) => {
      const opt = document.createElement("option");
      opt.value = proj.id;
      opt.textContent = proj.name; // Seguro contra XSS (textContent)
      select.appendChild(opt);
    });

    currentProject = select.value;
    loadTasks();
    connectWebSocket(currentProject);
  } catch (err) {
    console.error("Error al cargar proyectos:", err);
  }
}

function onProjectSelected() {
  const select = document.getElementById("project");
  currentProject = select.value;
  loadTasks();
  connectWebSocket(currentProject);
}

// E4-04: Cargar tareas paginadas
async function loadTasks(url = null) {
  const taskUrl = url || `${API_URL}/tasks/?project=${currentProject}`;
  const list = document.getElementById("tasks");
  const prevBtn = document.getElementById("prev-btn");
  const nextBtn = document.getElementById("next-btn");
  const pageInfo = document.getElementById("page-info");

  try {
    const response = await fetch(taskUrl, {
      headers: authHeaders()
    });

    if (!response.ok) {
      if (response.status === 401) return logout();
      return;
    }

    const data = await response.json();
    const tasks = data.results !== undefined ? data.results : data;

    list.innerHTML = "";
    nextUrl = data.next || null;
    prevUrl = data.previous || null;

    prevBtn.disabled = !prevUrl;
    nextBtn.disabled = !nextUrl;
    if (pageInfo) {
      pageInfo.textContent = data.count !== undefined ? `Total: ${data.count} tarea(s)` : "";
    }

    if (!tasks || tasks.length === 0) {
      const li = document.createElement("li");
      li.textContent = "No hay tareas en este proyecto.";
      list.appendChild(li);
      return;
    }

    tasks.forEach((task) => {
      const li = document.createElement("li");
      if (task.status === "completada") {
        li.className = "completada";
      }

      // Uso de textContent para prevenir vulnerabilidades XSS
      const titleSpan = document.createElement("span");
      titleSpan.textContent = task.title;

      const badge = document.createElement("span");
      badge.className = "status-badge meta-tag";
      badge.textContent = task.status;

      li.appendChild(titleSpan);
      li.appendChild(badge);
      list.appendChild(li);
    });
  } catch (err) {
    console.error("Error al cargar tareas:", err);
  }
}

function nextPage() {
  if (nextUrl) loadTasks(nextUrl);
}

function prevPage() {
  if (prevUrl) loadTasks(prevUrl);
}

// E4-05: Crear tarea con manejo de permisos
async function createTask() {
  const titleInput = document.getElementById("new-title");
  const errorBox = document.getElementById("app-error");
  errorBox.textContent = "";

  const title = titleInput.value.trim();
  const select = document.getElementById("project");
  const projectId = select ? select.value : currentProject;

  if (!title) {
    errorBox.textContent = "El título de la tarea no puede estar vacío.";
    return;
  }
  if (!projectId) {
    errorBox.textContent = "Seleccioná un proyecto válido.";
    return;
  }

  try {
    const response = await fetch(`${API_URL}/tasks/`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        title: title,
        project: Number(projectId)
      })
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      if (response.status === 403) {
        errorBox.textContent = data.detail || "Solo un admin del proyecto puede crear tareas en él (403 Prohibido).";
      } else {
        errorBox.textContent = data.detail || JSON.stringify(data);
      }
      return;
    }

    titleInput.value = "";
    loadTasks(); // Refrescar lista de tareas
  } catch (err) {
    errorBox.textContent = "Error al intentar crear la tarea.";
  }
}

// E4-08 / Clase 10: Conexión WebSocket para notificaciones en vivo
function connectWebSocket(projectId) {
  if (!projectId) return;

  if (socket) {
    socket.close();
    socket = null;
  }

  const indicator = document.getElementById("ws-indicator");

  // Determinar protocolo ws:// o wss:// según origen
  const isHttps = API_URL.startsWith("https://");
  const wsProtocol = isHttps ? "wss://" : "ws://";
  const host = API_URL.replace(/^https?:\/\//, "").replace(/\/api$/, "");
  const wsUrl = `${wsProtocol}${host}/ws/projects/${projectId}/?token=${accessToken}`;

  try {
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      if (indicator) {
        indicator.textContent = "WebSocket: conectado (en vivo)";
        indicator.style.color = "#28a745";
      }
    };

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        // Si se crea, edita o completa una tarea, refrescar la lista sin recargar
        if (payload.event === "task_created" || payload.event === "task_updated" || payload.event === "task_completed") {
          loadTasks();
        }
      } catch (e) {
        console.error("Error al procesar mensaje WS:", e);
      }
    };

    socket.onclose = () => {
      if (indicator) {
        indicator.textContent = "WebSocket: desconectado";
        indicator.style.color = "#586069";
      }
    };

    socket.onerror = (err) => {
      console.warn("WebSocket no disponible o cerrado:", err);
    };
  } catch (e) {
    console.warn("No se pudo inicializar WebSocket:", e);
  }
}

// Restauración de sesión si ya había token guardado (E4-08)
window.addEventListener("DOMContentLoaded", () => {
  const savedToken = sessionStorage.getItem("taskflow_token");
  const savedUser = sessionStorage.getItem("taskflow_username");
  const savedApi = sessionStorage.getItem("taskflow_api");

  if (savedApi) {
    const apiInput = document.getElementById("api-url");
    if (apiInput) apiInput.value = savedApi;
    API_URL = savedApi;
  }

  if (savedToken && savedUser) {
    accessToken = savedToken;
    showApp(savedUser);
  }
});
