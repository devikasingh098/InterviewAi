# InterviewAI Architecture

## System Overview

InterviewAI is a voice-based AI interview coach that combines
speech-to-text processing, AI-generated interview interactions,
real-time coaching, and post-interview analysis.

## Architecture Flow

User
  ↓
React + TypeScript Frontend
  ↓
Voice Input
  ↓
AssemblyAI Streaming Speech-to-Text
  ↓
Interview Session
  ↓
Supabase Edge Functions
  ↓
Gemini
  ↓
AI Interview Questions / Analysis
  ↓
Interview Report
  ↓
User

## Frontend

- React
- TypeScript
- Vite
- Tailwind CSS
- Lucide React

## AI / Speech Processing

- AssemblyAI
- Gemini

## Backend / Secure API Layer

- Supabase Edge Functions

The frontend communicates with secure backend functions rather
than exposing sensitive API credentials in the client.

## Interview Flow

1. User selects an interview category.
2. InterviewAI starts a mock interview.
3. AI asks interview questions.
4. User answers using voice.
5. Speech is converted into text.
6. The conversation is processed by the AI system.
7. The interview continues for multiple questions.
8. The completed session is analyzed.
9. A performance report is generated.

## Interview Categories

- Software Engineering
- Product Management
- Data Science
- Behavioral & Leadership

## Evaluation

The final report evaluates:

- Communication
- Relevance
- Clarity
- Confidence
- Technical / Content Quality

Additional coaching signals include:

- Filler words
- Hedging
- Answer length
- STAR structure
- Measurable outcomes
- Explanation of personal contribution
