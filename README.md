# ⚓ Maritime AI Commander

> **Production-Grade Voice Interface for Naval & Maritime Operations**

The **Maritime AI Commander** is a next-generation, multi-modal dashboard designed for ship crews, cargo operators, and naval command. It leverages the **Google Gemini Live API (WebSockets)** for low-latency, bi-directional voice interaction and utilizes the **Gemini 2.5 Flash** ecosystem for real-time visual asset generation.

## 🚀 Key Features

### 🧠 Intelligent Core
- **Real-time Voice Interaction:** Built on `gemini-2.5-flash-native-audio-preview`. Supports interruption, natural pacing, and emotive speech.
- **RAG (Retrieval-Augmented Generation):** Inject custom operational documents (PDF content, text logs, manifests) via the Admin Panel to ground the AI's answers in ship-specific data.
- **Context Awareness:** The system analyzes every interaction in the background to detect missing knowledge or potential safety alerts.

### 🎨 Multi-Modal Asset Generation
The system does not just speak; it visualizes. It autonomously determines when to generate visual aids based on the conversation:
- **Dynamic Diagrams:** Generates **Mermaid.js** flowcharts for standard operating procedures (SOPs) and checklists.
- **Live Charting:** Plots statistical data using **Recharts** for engine diagnostics, fuel levels, or cargo metrics.
- **Visuals & Video:** Generates reference images (`gemini-2.5-flash-image`) and cinematic simulations (`veo-3.1`) for training or navigation scenarios.

### 🖥️ Immersive UI
- **3D Avatar Interface:** Features a React Three Fiber (R3F) avatar with real-time lip-syncing driven by audio RMS analysis.
- **Glassmorphism Design:** Modern, dark-mode UI optimized for bridge/control room environments (low light).
- **Admin Control Plane:** Manage the Knowledge Base, view system alerts, and monitor "Out of Domain" queries.

---

## 🛠️ Technology Stack

- **Frontend:** React 19, TypeScript, Vite
- **Styling:** Tailwind CSS
- **AI Model:** Google Gemini (`@google/genai` SDK)
  - *Live API:* `gemini-2.5-flash-native-audio-preview-09-2025`
  - *Reasoning:* `gemini-2.5-flash`
  - *Video:* `veo-3.1-fast-generate-preview`
- **Visualization:**
  - `mermaid` (Diagrams)
  - `recharts` (Data)
  - `@react-three/fiber` (3D Environment)
- **Audio:** Native Web Audio API with custom PCM processing.

---

## ⚙️ Architecture Highlights

### 1. Hybrid Audio Processing
To support cross-platform compatibility (specifically iOS/macOS which enforce 44.1kHz/48kHz sample rates), the application implements a custom audio pipeline:
- **Input:** Captures microphone audio at the system's native hardware sample rate.
- **Downsampling:** A custom `downsampleTo16k` Linear PCM processor converts audio to 16kHz in real-time for the Gemini API.
- **Output:** Receives raw PCM 24kHz from Gemini, aligns bytes to `Int16Array`, and plays via the Web Audio API.

### 2. Dual-Stream Logic
The app runs two concurrent logic streams:
1.  **The "Voice" Stream:** A persistent WebSocket connection handling audio I/O for instant conversational latency.
2.  **The "Analyst" Stream:** A background text-based process that monitors the chat transcript to trigger side-effects (generating charts, logging alerts) without blocking the voice conversation.

---

## 📦 Installation & Setup

1.  **Clone the repository**
    ```bash
    git clone https://github.com/your-username/maritime-ai-commander.git
    cd maritime-ai-commander
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Configure Environment**
    You need a Google AI Studio API Key.
    
    *Create a `.env` file (or set in your deployment environment):*
    ```env
    API_KEY=your_gemini_api_key_here
    ```

4.  **Run Development Server**
    ```bash
    npm run dev
    ```

---

## 🎮 Usage Guide

### The Dashboard
1.  **Connect:** Click the **Microphone** button in the footer to initialize the neural connection.
2.  **Speak:** Ask questions like:
    - *"What is the procedure for anchor dropping?"*
    - *"Show me a chart of the fuel consumption over the last 4 hours."*
    - *"Visualize a collision avoidance scenario."*
3.  **Observe:** The Avatar will lip-sync to the response. If you requested a visual, it will appear in the right-hand panel.

### Admin Panel
1.  Click the **Settings (Gear)** icon in the header.
2.  **Knowledge Base:** Upload text files (e.g., "ShipManual.txt") to feed specific knowledge to the RAG system.
3.  **Alerts:** View queries that the system failed to answer or flagged as non-maritime.

---

## 🔧 Troubleshooting

**No Sound / Avatar not moving?**
- Ensure your browser has permission to access the Microphone.
- The system auto-detects silence. Speak clearly.
- If on macOS, the system automatically handles sample rate conversion, but ensure no other app has exclusive control of the audio input.

**"Billing Quota Exceeded"**
- The project uses `Gemini 2.5 Flash` and `Veo`. Ensure your Google Cloud project has billing enabled and quotas are sufficient for the Live API.

**Connection Errors**
- The Live API requires a stable internet connection (WebSocket). Firewalls blocking `wss://` protocols may cause connection failures.

---

## 📜 License

[MIT](LICENSE) - Free for academic and commercial use.

---

*Built with the Google Gemini API.*
