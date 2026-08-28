# Forum Backend API

Backend for the Forum application built with Express, MongoDB, Redis, and Socket.IO.

## Tech Stack
- **Node.js**: Runtime environment
- **Express**: Web framework
- **MongoDB**: Primary database
- **Redis**: Caching layer & rate limiting
- **Socket.IO**: Real-time updates for specialized panels
- **JWT**: Authentication

## Prerequisites
- MongoDB running on `mongodb://localhost:27017`
- Redis running on `redis://localhost:6379` 
- Node.js (v18+)

## Setup

1.  **Install dependencies**:
    ```bash
    npm install
    ```

2.  **Environment Variables**:
    Create a `.env` file (see `.env.example`) or use the default one provided.
    Ensure `MONGODB_URI` and `REDIS_URL` are correct.

3.  **Seed Database**:
    Populate the database with initial users, questions, and answers:
    ```bash
    npm run seed
    ```

4.  **Start Server**:
    ```bash
    npm start
    ```
    The server runs on port `5000` by default.

## API Endpoints

### Auth
- `POST /api/auth/signup`: Create a new account
- `POST /api/auth/login`: Login
- `POST /api/auth/bulk-create`: Admin bulk user creation
- `GET /api/auth/me`: Get current user info

### Questions
- `GET /api/questions`: List questions (supports filtering `tag`, `status`, `search`, `sort`)
- `POST /api/questions`: exact Create a new question
- `GET /api/questions/:id`: Get question details including answers
- `PUT /api/questions/:id`: Update a question
- `DELETE /api/questions/:id`: Delete a question

### Answers
- `POST /api/answers/:questionId`: Post an answer
- `PUT /api/answers/:id`: Edit an answer
- `DELETE /api/answers/:id`: Delete an answer
- `POST /api/answers/:id/upvote`: Upvote/unvote an answer
- `POST /api/answers/:id/best`: Mark answer as best (question author only)

### Users
- `GET /api/users/specialists`: Get all specialist profiles
- `GET /api/users/:id`: Get user profile with stats
- `PUT /api/users/profile`: Update user profile

### Moderation (Admin)
- `POST /api/moderation/report`: Report content
- `GET /api/moderation/reports`: View reports
- `POST /api/moderation/action`: Dismiss/Remove/Ban/Warn
- `GET /api/moderation/stats`: Get overview stats

## Real-time (Socket.IO)

The server emits real-time events for the Specialist Panel.
Connect your frontend client to the backend URL (e.g., `http://localhost:5000`).

**Events:**
- **Listen for:**
  - `new_question`: Emitted when a new question is posted.
  - `new_answer`: Emitted when a new answer is posted.

**Room Joining:**
To receive these events, the client must emit `join_specialist_room` after connecting:
```javascript
socket.emit('join_specialist_room');
```
