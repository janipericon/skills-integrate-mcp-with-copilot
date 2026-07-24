# Mergington High School Activities API

A super simple FastAPI application that allows students to view and sign up for extracurricular activities.

## Features

- View all available extracurricular activities
- Teacher login/logout for admin mode
- Register and unregister students for activities (teacher only)

## Getting Started

1. Install the dependencies:

   ```
   pip install fastapi uvicorn
   ```

2. Run the application:

   ```
   python app.py
   ```

3. Open your browser and go to:
   - API documentation: http://localhost:8000/docs
   - Alternative documentation: http://localhost:8000/redoc

## API Endpoints

| Method | Endpoint                                                          | Description                                                         |
| ------ | ----------------------------------------------------------------- | ------------------------------------------------------------------- |
| GET    | `/activities`                                                     | Get all activities with their details and current participant count |
| GET    | `/auth/status`                                                    | Get current teacher authentication state                            |
| POST   | `/auth/login`                                                     | Log in as teacher and start authenticated session                   |
| POST   | `/auth/logout`                                                    | Log out teacher session                                             |
| POST   | `/activities/{activity_name}/signup?email=student@mergington.edu` | Register a student for an activity (teacher only)                  |
| DELETE | `/activities/{activity_name}/unregister?email=student@mergington.edu` | Unregister a student from an activity (teacher only)           |

### Default teacher credentials

- Username: `teacher1`
- Password: `teacher123`

Teacher credentials are stored in `teachers.json` and checked by the backend.

## Data Model

The application uses a simple data model with meaningful identifiers:

1. **Activities** - Uses activity name as identifier:

   - Description
   - Schedule
   - Maximum number of participants allowed
   - List of student emails who are signed up

2. **Students** - Uses email as identifier:
   - Name
   - Grade level

All data is stored in memory, which means data will be reset when the server restarts.
