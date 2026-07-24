"""
High School Management System API

A super simple FastAPI application that allows students to view and sign up
for extracurricular activities at Mergington High School.
"""

from fastapi import FastAPI, HTTPException, Request, Response
from pydantic import BaseModel
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
import os
import json
import hashlib
import secrets
from pathlib import Path

app = FastAPI(title="Mergington High School API",
              description="API for viewing and signing up for extracurricular activities")

# Mount the static files directory
current_dir = Path(__file__).parent
app.mount("/static", StaticFiles(directory=os.path.join(Path(__file__).parent,
          "static")), name="static")

TEACHERS_FILE_PATH = current_dir / "teachers.json"
ACTIVITIES_FILE_PATH = current_dir / "activities.json"
SESSION_COOKIE_NAME = "teacher_session"
teacher_sessions = {}


class LoginRequest(BaseModel):
    username: str
    password: str


def _hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def _load_teachers() -> dict[str, str]:
    try:
        with open(TEACHERS_FILE_PATH, "r", encoding="utf-8") as file:
            data = json.load(file)
    except FileNotFoundError as exc:
        raise RuntimeError("teachers.json file is missing") from exc
    except json.JSONDecodeError as exc:
        raise RuntimeError("teachers.json contains invalid JSON") from exc

    teachers = data.get("teachers", {})
    if not isinstance(teachers, dict):
        raise RuntimeError("Invalid teachers.json format: 'teachers' must be an object")
    return teachers


def _load_activities() -> dict:
    try:
        with open(ACTIVITIES_FILE_PATH, "r", encoding="utf-8") as file:
            data = json.load(file)
    except FileNotFoundError as exc:
        raise RuntimeError("activities.json file is missing") from exc
    except json.JSONDecodeError as exc:
        raise RuntimeError("activities.json contains invalid JSON") from exc

    if not isinstance(data, dict):
        raise RuntimeError("Invalid activities.json format: root must be an object")
    return data


def _get_authenticated_teacher(request: Request) -> str | None:
    session_token = request.cookies.get(SESSION_COOKIE_NAME)
    if not session_token:
        return None
    return teacher_sessions.get(session_token)


def _require_teacher(request: Request) -> str:
    username = _get_authenticated_teacher(request)
    if not username:
        raise HTTPException(status_code=401, detail="Teacher login required")
    return username

# In-memory activity database
activities = _load_activities()


@app.get("/")
def root():
    return RedirectResponse(url="/static/index.html")


@app.get("/activities")
def get_activities():
    return activities


@app.get("/auth/status")
def auth_status(request: Request):
    username = _get_authenticated_teacher(request)
    return {
        "authenticated": bool(username),
        "username": username,
    }


@app.post("/auth/login")
def login(payload: LoginRequest, response: Response):
    teachers = _load_teachers()
    expected_password_hash = teachers.get(payload.username)

    if not expected_password_hash:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    if _hash_password(payload.password) != expected_password_hash:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    session_token = secrets.token_urlsafe(32)
    teacher_sessions[session_token] = payload.username
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session_token,
        httponly=True,
        samesite="lax",
        secure=False,
    )
    return {"message": "Login successful", "username": payload.username}


@app.post("/auth/logout")
def logout(request: Request, response: Response):
    session_token = request.cookies.get(SESSION_COOKIE_NAME)
    if session_token and session_token in teacher_sessions:
        teacher_sessions.pop(session_token, None)
    response.delete_cookie(SESSION_COOKIE_NAME)
    return {"message": "Logged out"}


@app.post("/activities/{activity_name}/signup")
def signup_for_activity(activity_name: str, email: str, request: Request):
    """Sign up a student for an activity"""
    _require_teacher(request)

    # Validate activity exists
    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    # Get the specific activity
    activity = activities[activity_name]

    # Validate student is not already signed up
    if email in activity["participants"]:
        raise HTTPException(
            status_code=400,
            detail="Student is already signed up"
        )

    # Add student
    activity["participants"].append(email)
    return {"message": f"Signed up {email} for {activity_name}"}


@app.delete("/activities/{activity_name}/unregister")
def unregister_from_activity(activity_name: str, email: str, request: Request):
    """Unregister a student from an activity"""
    _require_teacher(request)

    # Validate activity exists
    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    # Get the specific activity
    activity = activities[activity_name]

    # Validate student is signed up
    if email not in activity["participants"]:
        raise HTTPException(
            status_code=400,
            detail="Student is not signed up for this activity"
        )

    # Remove student
    activity["participants"].remove(email)
    return {"message": f"Unregistered {email} from {activity_name}"}
