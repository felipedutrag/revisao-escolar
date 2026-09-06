# 🚀 Revisão Escolar — Real-Time Voice AI Space Tutor for K-12 Students

<p align=center>
  <img src=https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB alt=React 19 />
  <img src=https://img.shields.io/badge/TypeScript_6-007ACC?style=for-the-badge&logo=typescript&logoColor=white alt=TypeScript 6 />
  <img src=https://img.shields.io/badge/Vite_8-646CFF?style=for-the-badge&logo=vite&logoColor=white alt=Vite 8 />
  <img src=https://img.shields.io/badge/Tailwind_CSS_4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white alt=Tailwind CSS 4 />
  <img src=https://img.shields.io/badge/Gemini_Live_WebSockets-4285F4?style=for-the-badge&logo=google&logoColor=white alt=Gemini Live />
  <img src=https://img.shields.io/badge/Web_Audio_PCM-FFA000?style=for-the-badge&logo=webrtc&logoColor=white alt=Web Audio />
  <img src=https://img.shields.io/badge/jsPDF_Report-E11D48?style=for-the-badge&logo=adobeacrobatreader&logoColor=white alt=jsPDF />
</p>

---

## 📌 Executive Overview

**Revisão Escolar** is an interactive, gamified space-themed AI educational tutor designed to help primary and middle school students master academic curriculums through bidirectional spoken conversation. 

Powered by **Google Gemini Live Multimodal WebSocket API**, the platform allows children to converse naturally with an astronaut avatar (Astro Tutor) via real-time Web Audio PCM streaming. The AI acts as a Socratic mentor: asking curriculum questions, evaluating spoken answers, tracking learning streaks, registering knowledge gaps, and exporting pedagogical progress reports via **jsPDF**.

---

## 🏗️ System Architecture

`mermaid
flowchart TD
    Student([Student Voice Input]) -->|Microphone AudioStream 16kHz PCM| WebAudio[AudioContext & AudioWorklet / ScriptProcessor]
    WebAudio -->|Base64 PCM Chunks over WebSocket| GeminiWS[Gemini Multimodal Live API]
    
    subgraph Pedagogical AI Pipeline
        GeminiWS -->|Socratic Questioning & Reasoning| Syllabus[(Curriculum Syllabus JSON)]
        GeminiWS -->|Function Calling / Tool Execution| ToolHandler[Tutor Tool Controller]
        ToolHandler -->|registrar_desempenho| ScoreLog[Progress & Mastery Log]
        ToolHandler -->|gerar_relatorio_pdf| PDFEngine[jsPDF Generator]
    end

    subgraph Audio Playback Engine
        GeminiWS -->|24kHz PCM Audio Stream| AudioQueue[AudioBuffer Queue Manager]
        AudioQueue -->|Real-time Synthesis & Interruption Cutoff| Speaker([Cosmic Orb Voice Playback])
    end

    ScoreLog --> Dashboard[Glassmorphic Mission Control HUD]
    PDFEngine --> Download([Diagnostic Learning PDF])
`

---

## ✨ Key Features & Pedagogical Capabilities

- 🧑‍🚀 **Natural Real-Time Voice Dialogue:** Direct WebSocket full-duplex communication with Gemini Live for human-like tutoring without push-to-talk delays.
- 🎯 **Structured Curriculum Mapping:** Configured with comprehensive K-12 topics (Mathematics, Portuguese, Science, History, Geography, English) following official pedagogical guidelines.
- 🔍 **Socratic Teaching Methodology:** Rather than just providing answers, the Astro Tutor guides students through cognitive scaffolding, hints, and encouraging feedback.
- 🛠️ **Real-Time Performance Tool Calling:** Automatically executes client-side functions (egistrar_desempenho, gerar_relatorio_pdf) when evaluating student responses.
- 🌌 **Gamified Cosmic HUD:** Space-themed glassmorphic UI featuring floating star fields, responsive animated energy rings during speech, and easter eggs.
- 📄 **Automated Diagnostic Study Reports:** Instant client-side PDF synthesis compiling student scores, strengths, and targeted review recommendations.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Core Framework** | React 19.2.7, Vite 8.1, TypeScript 6 |
| **Styling & Theme** | Tailwind CSS v4, Custom CSS Space & Glassmorphism Shaders |
| **Real-Time AI & Voice** | Google Gemini Multimodal Live WebSocket API |
| **Audio Processing** | Web Audio API (AudioContext, PCM 16kHz Input / 24kHz Output) |
| **Document Synthesis** | jsPDF 4.2.1 |
| **Linter & Performance** | Oxlint, Vite React Plugin |

---

## 📂 Project Structure

`
revisao-escolar/
├── public/                     # Static icons & vectors
├── src/
│   ├── assets/                 # Brand illustrations & space sprites
│   ├── config/
│   │   ├── subjects.json       # Discipline, grade level, and topic definitions
│   │   └── syllabus.json       # Detailed learning objectives and Socratic guidelines
│   ├── hooks/
│   │   └── useGeminiTutor.ts   # WebSocket connection, audio capture, and live playback queue
│   ├── App.css                 # Cosmic particle effects & animations
│   ├── App.tsx                 # Mission Control HUD & interactive tutor container
│   ├── index.css               # Tailwind CSS imports
│   └── main.tsx                # Application bootstrap
├── package.json
├── tsconfig.json
└── vite.config.ts
`

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v18.18+ or v20+
- **Google AI Gemini API Key** (with Multimodal Live API access)

### 1. Clone the Repository

`ash
git clone https://github.com/felipedutrag/revisao-escolar.git
cd revisao-escolar
`

### 2. Configure Environment

Create a .env file in the root directory:

`env
VITE_GEMINI_API_KEY=your_gemini_api_key_here
`

### 3. Install & Launch

`ash
# Install dependencies
npm install

# Start development server
npm run dev

# Open in browser: http://localhost:5173
`

---

## 👤 Author

**Felipe Dutra**  
- **GitHub:** [@felipedutrag](https://github.com/felipedutrag)  
- **Email:** [felipedutra@outlook.com](mailto:felipedutra@outlook.com)
