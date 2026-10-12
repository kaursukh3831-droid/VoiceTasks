
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AudioLines,
  Bell,
  CalendarDays,
  Check,
  CheckCheck,
  Circle,
  Clock3,
  Edit3,
  Headphones,
  LayoutDashboard,
  ListTodo,
  Mic,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import "./styles.css";

const API = (
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");

const emptyTask = {
  title: "",
  description: "",
  date: "",
  time: "",
  priority: "Medium",
  category: "Personal",
  type: "Task",
  status: "Pending",
};

async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, options);
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

if (!response.ok) {
  const details =
    typeof data === "string"
      ? data
      : typeof data?.detail === "string"
        ? data.detail
        : JSON.stringify(data?.detail ?? data);

  throw new Error(
    `HTTP ${response.status}: ${details || "Request failed"}`
  );
}
  return data;
}

function normalizeTask(task = {}) {
  return {
    id: task.id ?? task.task_id ?? task._id,
    title: task.title ?? task.task_title ?? "",
    description: task.description ?? "",
    date: task.date ?? task.due_date ?? "",
    time: task.time ?? task.due_time ?? "",
    priority: capitalize(task.priority || "Medium"),
    category: task.category || "Personal",
    type: task.type || task.task_type || "Task",
    status: capitalize(task.status || "Pending"),
  };
}

function capitalize(value) {
  const text = String(value || "");
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}


function getErrorMessage(error) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (error && typeof error === "object") {
    return (
      error.message ||
      error.detail?.message ||
      (typeof error.detail === "string" ? error.detail : null) ||
      JSON.stringify(error)
    );
  }

  return "Something went wrong.";
}

function formatDate(date) {
  if (!date) return "No due date";

  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;

  return parsed.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(time) {
  if (!time) return "";
  const [hour, minute] = String(time).split(":").map(Number);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return time;

  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function IconButton({ label, onClick, children, className = "" }) {
  return (
    <button
      type="button"
      className={className}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function App() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All Tasks");

  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [form, setForm] = useState(emptyTask);
  const [saving, setSaving] = useState(false);

  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [voiceStatus, setVoiceStatus] = useState(
    "Tap the microphone and speak naturally."
  );

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const audioUrlRef = useRef(null);

  const showMessage = useCallback((message, isError = false) => {
    setError(isError ? message : "");
    setSuccess(isError ? "" : message);
  }, []);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await api("/api/tasks");
      const list = Array.isArray(data)
        ? data
        : data.tasks || data.items || [];

      setTasks(list.map(normalizeTask));
    } catch (err) {
      console.error("Load tasks error:", err);
      setError(`Could not load tasks: ${getErrorMessage(err)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    };
  }, []);

  const completedCount = tasks.filter(
    (task) => task.status.toLowerCase() === "completed"
  ).length;

  const pendingCount = tasks.length - completedCount;

  const visibleTasks = useMemo(() => {
    const query = search.trim().toLowerCase();

    return tasks.filter((task) => {
      const matchesSearch = [
        task.title,
        task.description,
        task.category,
        task.priority,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);

      const status = task.status.toLowerCase();
      const matchesFilter =
        filter === "All Tasks" ||
        (filter === "Pending" && status !== "completed") ||
        (filter === "Completed" && status === "completed");

      return matchesSearch && matchesFilter;
    });
  }, [tasks, search, filter]);

  function openAddTask() {
    setEditingTask(null);
    setForm({ ...emptyTask });
    setError("");
    setSuccess("");
    setTaskModalOpen(true);
  }

  function openEditTask(task) {
    setEditingTask(task);
    setForm({ ...emptyTask, ...task });
    setError("");
    setSuccess("");
    setTaskModalOpen(true);
  }

  function updateForm(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function saveTask(event) {
    event.preventDefault();

    if (!form.title.trim()) {
      setError("Please enter a task title.");
      return;
    }

    setSaving(true);
    setError("");

    const payload = {
      ...form,
      title: form.title.trim(),
      status: form.status || "Pending",
    };

    try {
      if (editingTask?.id != null) {
        await api(`/api/tasks/${editingTask.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await api("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      setTaskModalOpen(false);
      setEditingTask(null);
      setForm({ ...emptyTask });
      showMessage(editingTask ? "Task updated successfully." : "Task added successfully.");
      await loadTasks();
    } catch (err) {
      console.error("Save task error:", err);
      setError(`Could not save task: ${getErrorMessage(err)}`);
    } finally {
      setSaving(false);
    }
  }

  async function toggleComplete(task) {
    if (task.id == null) {
      setError("This task has no ID, so it cannot be updated.");
      return;
    }

    const completed = task.status.toLowerCase() !== "completed";
    const updated = {
      ...task,
      status: completed ? "Completed" : "Pending",
    };

    setTasks((current) =>
      current.map((item) => (item.id === task.id ? updated : item))
    );

    try {
      await api(`/api/tasks/${task.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
      showMessage(completed ? "Task completed!" : "Task marked as pending.");
    } catch (err) {
      console.error("Update task error:", err);
      setError(`Could not update task: ${getErrorMessage(err)}`);
      await loadTasks();
    }
  }

  async function deleteTask(task) {
    if (task.id == null) {
      setError("This task has no ID, so it cannot be deleted.");
      return;
    }

    if (!window.confirm(`Delete "${task.title}"?`)) return;

    try {
      await api(`/api/tasks/${task.id}`, { method: "DELETE" });
      setTasks((current) => current.filter((item) => item.id !== task.id));
      showMessage("Task deleted successfully.");
    } catch (err) {
      console.error("Delete task error:", err);
      setError(`Could not delete task: ${getErrorMessage(err)}`);
    }
  }

  function openVoiceAssistant() {
    setError("");
    setSuccess("");
    setTranscript("");
    setVoiceStatus("Tap the microphone and speak naturally.");
    setVoiceModalOpen(true);
  }

  function stopMicrophone() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError("Your browser does not support microphone recording. Try Chrome.");
      return;
    }

    try {
      setError("");
      setTranscript("");
      setVoiceStatus("Listening… speak your task now.");

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const preferredType = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
      ].find((type) => MediaRecorder.isTypeSupported(type));

      const recorder = preferredType
        ? new MediaRecorder(stream, { mimeType: preferredType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data?.size) chunksRef.current.push(event.data);
      };

      recorder.onerror = () => {
        setError("Recording failed. Please try again.");
        setRecording(false);
        stopMicrophone();
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });

        stopMicrophone();
        setRecording(false);

        if (!blob.size) {
          setError("No audio was recorded. Please try again.");
          return;
        }

        await sendVoiceCommand(blob);
      };

      recorder.start();
      setRecording(true);
    } catch (err) {
      console.error("Microphone error:", err);
      stopMicrophone();
      setRecording(false);
      setError(`Could not access the microphone: ${getErrorMessage(err)}`);
    }
  }

  function stopRecording() {
    const recorder = mediaRecorderRef.current;

    if (recorder && recorder.state !== "inactive") {
      setVoiceStatus("Processing your voice command…");
      recorder.stop();
    }
  }

  async function sendVoiceCommand(blob) {
    setVoiceBusy(true);
    setVoiceStatus("Understanding your task…");

    try {
      const extension = blob.type.includes("mp4") ? "m4a" : "webm";
      const audioFile = new File([blob], `voice-command.${extension}`, {
        type: blob.type || "audio/webm",
      });

      const body = new FormData();
      body.append("audio", audioFile);

      const data = await api("/api/voice-command", {
        method: "POST",
        body,
      });

      const result = data.task || data.data?.task || data.data || data;
      const parsed = normalizeTask(result);

      const spokenText =
        data.transcript ||
        data.transcription ||
        data.text ||
        result.transcript ||
        result.transcription ||
        "";

      setTranscript(spokenText);
      setForm({
        ...emptyTask,
        ...parsed,
        title: parsed.title || spokenText,
        status: parsed.status || "Pending",
      });

      setVoiceStatus("Task understood! Review the details below.");

      if (!parsed.title && !spokenText) {
        setError("The server returned no task details. Check the voice API response.");
      }
    } catch (err) {
      console.error("Voice command error:", err);
      setError(`Voice command failed: ${getErrorMessage(err)}`);
      setVoiceStatus("Couldn't process the recording. Please try again.");
    } finally {
      setVoiceBusy(false);
    }
  }

  function useVoiceTask() {
    setVoiceModalOpen(false);
    setEditingTask(null);
    setTaskModalOpen(true);
    setError("");
    setSuccess("");
  }

  function closeVoiceModal() {
    if (recording) {
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") recorder.stop();
    }

    stopMicrophone();
    setRecording(false);
    setVoiceModalOpen(false);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">
            <AudioLines size={23} />
          </div>
          <div>
            <h2>VoiceTasks</h2>
            <p>Your voice. Your productivity.</p>
          </div>
        </div>

        <p className="side-label">WORKSPACE</p>

        <button
          className={`nav-item ${filter === "All Tasks" ? "active" : ""}`}
          onClick={() => setFilter("All Tasks")}
        >
          <LayoutDashboard size={18} />
          <span>All Tasks</span>
          <span className="nav-count">{tasks.length}</span>
        </button>

        <button
          className={`nav-item ${filter === "Pending" ? "active" : ""}`}
          onClick={() => setFilter("Pending")}
        >
          <ListTodo size={18} />
          <span>Pending</span>
          <span className="nav-count">{pendingCount}</span>
        </button>

        <button
          className={`nav-item ${filter === "Completed" ? "active" : ""}`}
          onClick={() => setFilter("Completed")}
        >
          <CheckCheck size={18} />
          <span>Completed</span>
          <span className="nav-count">{completedCount}</span>
        </button>

        <div className="sidebar-bottom">
          <div className="assistant-card">
            <div className="assistant-icon">
              <Sparkles size={20} />
            </div>
            <h3>Your AI Assistant</h3>
            <p>Speak naturally in your language. Let VoiceTasks organise your day.</p>
            <button className="assistant-button" onClick={openVoiceAssistant}>
              <Mic size={15} />
              Try voice assistant
            </button>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">YOUR PERSONAL WORKSPACE</p>
            <h1>My Dashboard</h1>
            <p className="page-subtitle">
              Stay organised and make every day count.
            </p>
          </div>

          <div className="topbar-actions">
            <button className="voice-button" onClick={openVoiceAssistant}>
              <Mic size={16} />
              Speak a task
            </button>
            <button className="primary-button" onClick={openAddTask}>
              <Plus size={17} />
              Add Task
            </button>
          </div>
        </header>

        <section className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">
              <ListTodo size={22} />
            </div>
            <div>
              <p>Total Tasks</p>
              <h2>{tasks.length}</h2>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <Clock3 size={22} />
            </div>
            <div>
              <p>Pending Tasks</p>
              <h2>{pendingCount}</h2>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon completed-stat-icon">
              <CheckCheck size={22} />
            </div>
            <div>
              <p>Completed Tasks</p>
              <h2>{completedCount}</h2>
            </div>
          </div>
        </section>

        {(error || success) && (
          <div className={`message ${error ? "error-message" : "success-message"}`}>
            <span>{error || success}</span>
            <button
              onClick={() => {
                setError("");
                setSuccess("");
              }}
              aria-label="Dismiss message"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <section className="tasks-section">
          <div className="section-heading">
            <div>
              <h2>
                {filter === "All Tasks"
                  ? "Your Tasks"
                  : `${filter} Tasks`}
              </h2>
              <p>Everything you need to get done, in one place.</p>
            </div>

            <label className="search-box">
              <Search size={17} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search tasks..."
                aria-label="Search tasks"
              />
            </label>
          </div>

          {loading ? (
            <div className="empty-state">
              <div className="empty-icon"><AudioLines size={25} /></div>
              <h3>Loading your tasks</h3>
              <p>Please wait while we fetch your tasks.</p>
            </div>
          ) : visibleTasks.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon"><ListTodo size={26} /></div>
              <h3>{search ? "No matching tasks" : "Your task list is empty"}</h3>
              <p>
                {search
                  ? "Try a different search term."
                  : "Add your first task or tell your voice assistant what you need to do."}
              </p>
              {!search && (
                <button className="primary-button" onClick={openAddTask}>
                  <Plus size={16} />
                  Create your first task
                </button>
              )}
            </div>
          ) : (
            <div className="task-list">
              {visibleTasks.map((task, index) => {
                const isCompleted = task.status.toLowerCase() === "completed";

                return (
                  <article
                    className={`task-card ${isCompleted ? "task-completed" : ""}`}
                    key={task.id ?? `${task.title}-${index}`}
                  >
                    <button
                      className="complete-button"
                      onClick={() => toggleComplete(task)}
                      aria-label={isCompleted ? "Mark pending" : "Mark completed"}
                      title={isCompleted ? "Mark pending" : "Mark completed"}
                    >
                      {isCompleted ? <Check size={15} /> : <Circle size={17} />}
                    </button>

                    <div className="task-details">
                      <button
                        className="task-title"
                        onClick={() => openEditTask(task)}
                        title="Edit task"
                      >
                        {task.title || "Untitled task"}
                      </button>

                      {task.description && (
                        <p className="task-description">{task.description}</p>
                      )}

                      <div className="task-meta">
                        <span className="category-tag">{task.category}</span>
                        <span
                          className={`priority-tag priority-${task.priority.toLowerCase()}`}
                        >
                          {task.priority}
                        </span>
                        <span>
                          <CalendarDays size={13} />
                          {formatDate(task.date)}
                        </span>
                        {task.time && (
                          <span>
                            <Clock3 size={13} />
                            {formatTime(task.time)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="task-actions">
                      <IconButton
                        label="Edit task"
                        className="edit-btn"
                        onClick={() => openEditTask(task)}
                      >
                        <Edit3 size={15} />
                      </IconButton>
                      <IconButton
                        label="Delete task"
                        className="delete-btn"
                        onClick={() => deleteTask(task)}
                      >
                        <Trash2 size={15} />
                      </IconButton>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {taskModalOpen && (
        <div
          className="modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) {
              setTaskModalOpen(false);
            }
          }}
        >
          <section
            className="task-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="task-modal-title"
          >
            <div className="modal-header">
              <div>
                <h2 id="task-modal-title">
                  {editingTask ? "Edit Task" : "Create a Task"}
                </h2>
                <p>Add the details below to keep your day organised.</p>
              </div>
              <button
                className="modal-close"
                onClick={() => setTaskModalOpen(false)}
                aria-label="Close task form"
                disabled={saving}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={saveTask}>
              <label className="form-label">
                Task title *
                <input
                  name="title"
                  value={form.title}
                  onChange={updateForm}
                  placeholder="e.g. Submit DBMS assignment"
                  required
                  autoFocus
                />
              </label>

              <label className="form-label">
                Description
                <textarea
                  name="description"
                  value={form.description}
                  onChange={updateForm}
                  placeholder="Add any additional details..."
                />
              </label>

              <div className="form-row">
                <label className="form-label">
                  Due date
                  <input
                    type="date"
                    name="date"
                    value={form.date}
                    onChange={updateForm}
                  />
                </label>

                <label className="form-label">
                  Due time
                  <input
                    type="time"
                    name="time"
                    value={form.time}
                    onChange={updateForm}
                  />
                </label>
              </div>

              <div className="form-row">
                <label className="form-label">
                  Priority
                  <select
                    name="priority"
                    value={form.priority}
                    onChange={updateForm}
                  >
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                  </select>
                </label>

                <label className="form-label">
                  Category
                  <select
                    name="category"
                    value={form.category}
                    onChange={updateForm}
                  >
                    <option>Personal</option>
                    <option>College</option>
                    <option>Work</option>
                    <option>Health</option>
                    <option>Shopping</option>
                    <option>Other</option>
                  </select>
                </label>
              </div>

              <div className="form-row">
                <label className="form-label">
                  Task type
                  <select
                    name="type"
                    value={form.type}
                    onChange={updateForm}
                  >
                    <option>Task</option>
                    <option>Assignment</option>
                    <option>Meeting</option>
                    <option>Reminder</option>
                    <option>Personal</option>
                    <option>Exam</option>
                  </select>
                </label>

                <label className="form-label">
                  Status
                  <select
                    name="status"
                    value={form.status}
                    onChange={updateForm}
                  >
                    <option>Pending</option>
                    <option>Completed</option>
                  </select>
                </label>
              </div>

              {error && <p className="error-message">{error}</p>}

              <div className="modal-footer">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setTaskModalOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button type="submit" className="primary-button" disabled={saving}>
                  <Check size={16} />
                  {saving
                    ? "Saving..."
                    : editingTask
                      ? "Save Changes"
                      : "Create Task"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {voiceModalOpen && (
        <div
          className="modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !voiceBusy) {
              closeVoiceModal();
            }
          }}
        >
          <section
            className="voice-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="voice-modal-title"
          >
            <button
              className="modal-close voice-close"
              onClick={closeVoiceModal}
              aria-label="Close voice assistant"
            >
              <X size={18} />
            </button>

            <div className={`voice-circle ${recording ? "is-recording" : ""}`}>
              {recording ? <AudioLines size={34} /> : <Headphones size={34} />}
            </div>

            <h2 id="voice-modal-title">Your Voice Assistant</h2>
            <p>
              Speak naturally in your preferred language. Your task details will
              be extracted automatically.
            </p>

            <div className="voice-example">
              <Sparkles size={16} />
              {" "}Try: “Submit my DBMS assignment tomorrow at 6 PM with high priority.”
            </div>

            {transcript && (
              <div className="transcript-box">
                <strong>RECOGNISED SPEECH</strong>
                <p>{transcript}</p>
              </div>
            )}

            <p className="voice-status">
              {voiceBusy ? "Processing your voice command…" : voiceStatus}
            </p>

            <button
              className={`primary-button voice-record-button ${
                recording ? "recording-button" : ""
              }`}
              onClick={recording ? stopRecording : startRecording}
              disabled={voiceBusy}
            >
              {voiceBusy ? (
                <AudioLines size={17} />
              ) : recording ? (
                <Check size={17} />
              ) : (
                <Mic size={17} />
              )}
              {voiceBusy
                ? "Processing..."
                : recording
                  ? "Stop & Process"
                  : "Start Speaking"}
            </button>

            {form.title && (
              <button
                className="primary-button voice-record-button"
                onClick={useVoiceTask}
                disabled={voiceBusy || recording}
              >
                <Edit3 size={16} />
                Review & Edit Task
              </button>
            )}

            <button
              className="secondary-button voice-cancel-button"
              onClick={closeVoiceModal}
              disabled={voiceBusy}
            >
              Close
            </button>
          </section>
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);