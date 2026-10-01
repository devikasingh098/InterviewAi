# InterviewAI 🎙️

### Your AI Voice Interview Coach

InterviewAI is an AI-powered voice interview coach that helps users prepare for real interviews through realistic mock interview sessions, live transcription, AI-powered coaching, and detailed post-interview performance analysis.

Instead of simply practicing interview questions, InterviewAI lets users experience a conversational interview and then understand how they performed, what they did well, and what they should improve.

---

## 🚀 Overview

InterviewAI provides a realistic interview-practice environment where users can:

- Choose an interview category
- Participate in a voice-based mock interview
- Answer questions naturally using their voice
- View their responses through live transcription
- Receive AI-powered coaching during the session
- Complete a structured interview session
- Receive a detailed performance report
- Identify strengths and areas for improvement

The goal is simple:

> **Practice. Analyze. Improve.**

---

## 🎯 Problem

Interview preparation often relies on reading questions or practicing alone.

This creates several problems:

- Candidates may not get realistic interview practice.
- There is no interviewer to dynamically continue the conversation.
- Candidates may not notice issues with their communication.
- It can be difficult to identify weak areas in an answer.
- Generic practice does not provide personalized feedback.
- Candidates may know the technical answer but struggle to communicate it effectively.

InterviewAI addresses these challenges by combining voice-based interview practice with AI-powered analysis and feedback.

---

## 💡 Solution

InterviewAI acts as an AI interviewer and interview coach.

A user selects an interview category and starts a session. The AI interviewer asks questions, the candidate answers using their voice, and the response is transcribed and processed during the session.

After the interview, InterviewAI generates a structured report covering important aspects of interview performance.

### The experience

```text
Choose Interview Type
        ↓
Start Mock Interview
        ↓
AI Asks Interview Question
        ↓
Candidate Answers by Voice
        ↓
Live Speech-to-Text Transcription
        ↓
AI Coaching & Interview Progression
        ↓
Complete Interview
        ↓
Performance Analysis
        ↓
Detailed Session Report
````

---

## ✨ Key Features

### 🎤 Voice-Based Mock Interviews

Users can practice interviews through natural voice interaction instead of typing answers.

### 🤖 AI Interviewer

The AI conducts the interview by asking role-specific questions and continuing the interview based on the session.

### 📝 Live Transcription

Candidate responses are converted into text during the interview, allowing users to review what was said.

### 💬 AI Coaching

InterviewAI provides coaching signals during the session to help candidates recognize areas such as:

* Filler words
* Hedging
* Answer structure
* Answer length
* Measurable outcomes
* Personal contribution
* STAR-style response structure

### 📊 Performance Report

After completing the interview, the application generates a structured report covering:

* Communication
* Relevance
* Clarity
* Confidence
* Technical / Content quality

### 💪 Strengths

The report identifies aspects of the candidate's performance that were handled effectively.

### 🔧 Areas for Improvement

The system identifies weaknesses and provides actionable recommendations.

### 🔄 Retry & Practice Again

Users can retry report generation when necessary and start another interview session for continued practice.

---

## 👥 Interview Categories

InterviewAI supports multiple interview preparation categories:

* **Software Engineering**
* **Product Management**
* **Data Science**
* **Behavioral & Leadership**

Each category provides a different interview context so users can practice according to the type of interview they are preparing for.

---

## 🧠 Interview Evaluation

InterviewAI evaluates interview responses using multiple dimensions.

### Communication

Evaluates how effectively the candidate communicates their answer.

### Relevance

Evaluates whether the response addresses the question being asked.

### Clarity

Evaluates how clearly the candidate explains their thoughts.

### Confidence

Evaluates confidence-related aspects of the response and delivery.

### Technical / Content Quality

Evaluates the quality and substance of the candidate's answer, particularly for technical or role-specific questions.

The final report combines these signals into an overall performance assessment along with strengths and recommendations.

---

## 🏗️ Architecture

The high-level architecture of InterviewAI is:

```text
                    ┌─────────────────────┐
                    │       User          │
                    │  Voice Interview    │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   React Frontend    │
                    │ React + TypeScript   │
                    │       + Vite        │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │     AssemblyAI      │
                    │ Streaming Speech-   │
                    │    to-Text          │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │  Secure Edge Layer  │
                    │  Backend Functions  │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │       Gemini        │
                    │   AI Interview &    │
                    │    Analysis Logic   │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │  Interview Report  │
                    │ Scores + Strengths │
                    │ + Improvements      │
                    └─────────────────────┘
```

---

## 🛠️ Technology Stack

### Frontend

* React
* TypeScript
* Vite
* Tailwind CSS
* Lucide React

### AI & Voice

* AssemblyAI Streaming Speech-to-Text
* Gemini
* AI-powered interview analysis
* Voice-based interaction

### Backend / Secure Processing

* Supabase Edge Functions
* Secure server-side handling of AI-related operations

### Development

* Node.js
* npm
* Git
* GitHub

---

## 📁 Project Structure

```text
InterviewAi/
│
├── public/
│
├── scripts/
│
├── src/
│   ├── components/
│   ├── hooks/
│   ├── ...
│   │
│   └── App.tsx
│
├── .gitignore
├── index.html
├── package.json
├── package-lock.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## ⚙️ Getting Started

### Prerequisites

Make sure you have:

* Node.js installed
* npm installed
* Git installed

### 1. Clone the repository

```bash
git clone https://github.com/devikasingh098/InterviewAi.git
```

### 2. Open the project

```bash
cd InterviewAi
```

### 3. Install dependencies

```bash
npm install
```

### 4. Configure environment variables

Create the required environment configuration for the services used by the application.

Do not commit API keys or other secrets to GitHub.

Example:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

> The exact environment variables required may depend on the backend/edge-function configuration used for the deployed application.

### 5. Start the development server

```bash
npm run dev
```

The application will be available through the local Vite development URL shown in the terminal.

---

## 🔐 Security

InterviewAI is designed so that sensitive AI credentials are not exposed directly in the client application.

AI-related operations that require protected credentials are handled through secure backend/edge-function infrastructure.

### Important

Never commit:

```text
.env
.env.local
API keys
private tokens
service-role keys
```

to the public repository.

---

## 📊 Session Report

At the end of an interview session, InterviewAI generates a report containing:

```text
Overall Performance
        │
        ├── Communication
        ├── Relevance
        ├── Clarity
        ├── Confidence
        └── Technical / Content
                │
                ▼
          Strengths
                │
                ▼
       Areas to Improve
                │
                ▼
        Recommendations
```

This allows candidates to move from simply practicing interviews to understanding how they can improve.

---

## 🎥 Demo

A demonstration of InterviewAI shows the complete workflow:

1. Select an interview category
2. Start a mock interview
3. Interact with the AI interviewer using voice
4. View live transcription
5. Receive AI coaching
6. Complete the interview
7. Review the generated performance report

**Demo Video:**
https://drive.google.com/file/d/1_wPbtZX2tfr3b9M2TiNdnvpJYfjqiYaz/view?usp=drivesdk

---

## 🌐 Live Application

**Live Demo:**
https://interview-ai-five-beta.vercel.app/

---

## 🧪 Example Use Case

A candidate preparing for a Software Engineering interview can:

1. Select **Software Engineering**
2. Start a mock interview
3. Answer technical and behavioral questions using their voice
4. Review the live transcript
5. Complete the interview
6. Receive an evaluation of communication, relevance, clarity, confidence, and technical/content quality
7. Review strengths and improvement recommendations
8. Practice again with another session

---

## 🎯 Project Goals

InterviewAI is designed to help candidates:

* Practice interviews in a realistic conversational format
* Improve communication skills
* Identify weak areas in their responses
* Understand how their answers can be improved
* Build confidence through repeated practice
* Prepare for different interview formats

---

## 🔮 Future Improvements

Potential future improvements include:

* More interview roles and industries
* More advanced conversational follow-up questions
* Personalized interview difficulty
* Interview history and progress tracking
* Comparison between multiple interview sessions
* More detailed communication analytics
* Additional voice and language options
* Improved personalization based on target job descriptions
* Resume-based interview generation
* More advanced performance trends over time

---

## 👩‍💻 Project

**InterviewAI – Your AI Voice Interview Coach**

Built as an AI-powered interview preparation application.

**Repository:**
[https://github.com/devikasingh098/InterviewAi](https://github.com/devikasingh098/InterviewAi)



