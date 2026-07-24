document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const messageDiv = document.getElementById("message");
  const teacherOnlyNote = document.getElementById("teacher-only-note");
  const userMenuButton = document.getElementById("user-menu-button");
  const userMenu = document.getElementById("user-menu");
  const loginButton = document.getElementById("login-button");
  const logoutButton = document.getElementById("logout-button");
  const loginModal = document.getElementById("login-modal");
  const loginForm = document.getElementById("login-form");
  const cancelLogin = document.getElementById("cancel-login");

  let isTeacherAuthenticated = false;
  let teacherUsername = null;
  let currentActivities = null;
  let activeSignupActivity = null;

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => {
      const replacements = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      };
      return replacements[character];
    });
  }

  function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;
    messageDiv.classList.remove("hidden");
    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  function setTeacherUiState() {
    if (isTeacherAuthenticated) {
      teacherOnlyNote.textContent = `Logged in as ${teacherUsername}. You can register and unregister students.`;
      loginButton.classList.add("hidden");
      logoutButton.classList.remove("hidden");
    } else {
      teacherOnlyNote.textContent = "Teacher login is required to register or unregister students.";
      activeSignupActivity = null;
      loginButton.classList.remove("hidden");
      logoutButton.classList.add("hidden");
    }

    renderActivities();
  }

  async function refreshAuthStatus() {
    try {
      const response = await fetch("/auth/status");
      const data = await response.json();
      isTeacherAuthenticated = Boolean(data.authenticated);
      teacherUsername = data.username || null;
    } catch (error) {
      isTeacherAuthenticated = false;
      teacherUsername = null;
      console.error("Error getting auth status:", error);
    }

    setTeacherUiState();
  }

  function renderActivities() {
    if (currentActivities === null) {
      return;
    }

    activitiesList.innerHTML = "";

    Object.entries(currentActivities).forEach(([name, details]) => {
      const activityCard = document.createElement("div");
      activityCard.className = "activity-card";

      const spotsLeft = details.max_participants - details.participants.length;
      const escapedName = escapeHtml(name);
      const registerFormHTML =
        activeSignupActivity === name && isTeacherAuthenticated
          ? `
            <form class="inline-signup-form" data-activity="${escapedName}">
              <label>Student Email</label>
              <input
                type="email"
                name="email"
                required
                placeholder="student@mergington.edu"
              />
              <div class="inline-signup-actions">
                <button type="submit">Confirm Registration</button>
                <button type="button" class="secondary-btn register-cancel-btn">Cancel</button>
              </div>
            </form>
          `
          : "";

      const participantsHTML =
        details.participants.length > 0
          ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${escapeHtml(
                        email
                      )}</span>${
                        isTeacherAuthenticated
                          ? `<button class="delete-btn" data-activity="${escapedName}" data-email="${escapeHtml(
                              email
                            )}" type="button">❌</button>`
                          : ""
                      }</li>`
                  )
                  .join("")}
              </ul>
            </div>`
          : `<p><em>No participants yet</em></p>`;

      activityCard.innerHTML = `
        <h4>${escapedName}</h4>
        <p>${escapeHtml(details.description)}</p>
        <p><strong>Schedule:</strong> ${escapeHtml(details.schedule)}</p>
        <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
        <div class="activity-card-actions">
          <button
            type="button"
            class="register-toggle-btn"
            data-activity="${escapedName}"
            ${isTeacherAuthenticated ? "" : "disabled"}
          >
            Register Student
          </button>
        </div>
        ${registerFormHTML}
        <div class="participants-container">
          ${participantsHTML}
        </div>
      `;

      activitiesList.appendChild(activityCard);
    });

    if (!activitiesList.innerHTML) {
      activitiesList.innerHTML = "<p>No activities available.</p>";
    }

    document.querySelectorAll(".delete-btn").forEach((button) => {
      button.addEventListener("click", handleUnregister);
    });

    document.querySelectorAll(".register-toggle-btn").forEach((button) => {
      button.addEventListener("click", handleRegisterToggle);
    });

    document.querySelectorAll(".register-cancel-btn").forEach((button) => {
      button.addEventListener("click", handleRegisterCancel);
    });

    document.querySelectorAll(".inline-signup-form").forEach((form) => {
      form.addEventListener("submit", handleRegisterSubmit);
    });
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      currentActivities = await response.json();
      renderActivities();
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  function handleRegisterToggle(event) {
    if (!isTeacherAuthenticated) {
      showMessage("Teacher login required", "error");
      return;
    }

    const activity = event.target.getAttribute("data-activity");
    activeSignupActivity =
      activeSignupActivity === activity ? null : activity;
    renderActivities();
  }

  function handleRegisterCancel() {
    activeSignupActivity = null;
    renderActivities();
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    if (!isTeacherAuthenticated) {
      showMessage("Teacher login required", "error");
      return;
    }

    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");

        // Refresh activities list to show updated participants
        await fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  async function handleRegisterSubmit(event) {
    event.preventDefault();

    if (!isTeacherAuthenticated) {
      showMessage("Teacher login required", "error");
      return;
    }

    const form = event.target;
    const activity = form.getAttribute("data-activity");
    const formData = new FormData(form);
    const email = String(formData.get("email") || "").trim();

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        activeSignupActivity = null;
        await fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  }

  userMenuButton.addEventListener("click", () => {
    userMenu.classList.toggle("hidden");
  });

  document.addEventListener("click", (event) => {
    const clickedInsideAuthArea =
      userMenu.contains(event.target) || userMenuButton.contains(event.target);
    if (!clickedInsideAuthArea) {
      userMenu.classList.add("hidden");
    }
  });

  loginButton.addEventListener("click", () => {
    userMenu.classList.add("hidden");
    loginModal.classList.remove("hidden");
  });

  cancelLogin.addEventListener("click", () => {
    loginModal.classList.add("hidden");
  });

  loginModal.addEventListener("click", (event) => {
    if (event.target === loginModal) {
      loginModal.classList.add("hidden");
    }
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const result = await response.json();
      if (!response.ok) {
        showMessage(result.detail || "Login failed", "error");
        return;
      }

      loginForm.reset();
      loginModal.classList.add("hidden");
      await refreshAuthStatus();
      showMessage(`Logged in as ${result.username}`, "success");
    } catch (error) {
      showMessage("Login failed. Please try again.", "error");
      console.error("Error logging in:", error);
    }
  });

  logoutButton.addEventListener("click", async () => {
    try {
      await fetch("/auth/logout", {
        method: "POST",
      });
      isTeacherAuthenticated = false;
      teacherUsername = null;
      setTeacherUiState();
      showMessage("Logged out", "success");
    } catch (error) {
      showMessage("Failed to logout. Please try again.", "error");
      console.error("Error logging out:", error);
    }
  });

  // Initialize app
  refreshAuthStatus().then(fetchActivities);
});
