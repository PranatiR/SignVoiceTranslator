import React, { useState, useEffect, useRef } from 'react';

const API_BASE = 'http://127.0.0.1:5000';

function App() {
  // UI & Active Section states
  const [activeTab, setActiveTab] = useState('home'); // home, sign-rec, speech-rec, voice-sign, convo, dashboard
  const [userMode, setUserMode] = useState('full'); // deaf, hearing, blind, full
  const [backendStatus, setBackendStatus] = useState('Disconnected');
  
  // Sign Recognition states
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const [webcamStream, setWebcamStream] = useState(null);
  const [recognizedText, setRecognizedText] = useState('');
  const [currentPrediction, setCurrentPrediction] = useState('None');
  const [confidence, setConfidence] = useState(0.0);
  const detectionIntervalRef = useRef(null);
  const lastPredictedRef = useRef('');

  // Speech Transcription states
  const [isListening, setIsListening] = useState(false);
  const [speechTranscript, setSpeechTranscript] = useState('');
  const [convoHistory, setConvoHistory] = useState([
    { sender: 'System', text: 'Welcome to Inclusive Communication Bridge.', time: '12:00 PM' }
  ]);
  const recognitionRef = useRef(null);

  // Voice to Sign states
  const [voiceToSignText, setVoiceToSignText] = useState('');
  const [signImages, setSignImages] = useState([]);
  const [currentSignIndex, setCurrentSignIndex] = useState(0);
  const [isSignPlaying, setIsSignPlaying] = useState(false);
  const signAnimationRef = useRef(null);

  // Audio Playback
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);

  // Verify backend connectivity
  useEffect(() => {
    const checkBackend = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/ping`);
        if (response.ok) {
          setBackendStatus('Connected');
        } else {
          setBackendStatus('Error');
        }
      } catch (error) {
        setBackendStatus('Disconnected');
      }
    };

    checkBackend();
    const interval = setInterval(checkBackend, 5000);
    return () => clearInterval(interval);
  }, []);

  // Web Speech API Initialization
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;

      recognitionRef.current.onresult = (event) => {
        const resultText = event.results[0][0].transcript;
        setSpeechTranscript(resultText);
        addMessage('Hearing User (Speech)', resultText);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  // Helpers to add message in Conversation Mode
  const addMessage = (sender, text) => {
    if (!text.trim()) return;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setConvoHistory(prev => [...prev, { sender, text, time }]);
    
    // Automatically trigger speech read-out in Blind mode
    if (userMode === 'blind') {
      speakTextViaBackend(text);
    }
  };

  // Start Webcam stream
  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 485 }
      });
      setWebcamStream(stream);
      setIsWebcamActive(true);
    } catch (error) {
      alert('Camera access denied. Please allow camera permissions.');
    }
  };

  // Attach stream to video element once it exists in the DOM
  useEffect(() => {
    if (isWebcamActive && webcamStream && videoRef.current) {
      videoRef.current.srcObject = webcamStream;
      videoRef.current.play().catch((err) => {
        console.error('Error playing video stream:', err);
      });
    }
  }, [isWebcamActive, webcamStream, activeTab, userMode]);

  // Stop Webcam stream
  const stopWebcam = () => {
    if (webcamStream) {
      webcamStream.getTracks().forEach(track => track.stop());
    }
    setIsWebcamActive(false);
    setWebcamStream(null);
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
    }
    setCurrentPrediction('None');
    setConfidence(0.0);
  };

  // Toggle Continuous Hand Sign Detection
  useEffect(() => {
    if (isWebcamActive && videoRef.current) {
      detectionIntervalRef.current = setInterval(sendFrameToBackend, 1000);
    } else {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
    }
    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWebcamActive]);

  // Send frames to predict sign endpoint
  const sendFrameToBackend = async () => {
    if (!canvasRef.current || !videoRef.current || !isWebcamActive) return;
    if (videoRef.current.readyState < 2) return; // Ensure video has loaded frames

    const context = canvasRef.current.getContext('2d');
    context.drawImage(videoRef.current, 0, 0, 640, 480);
    const imageData = canvasRef.current.toDataURL('image/jpeg');

    try {
      const response = await fetch(`${API_BASE}/api/predict_sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageData })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.text) {
          setCurrentPrediction(data.text);
          setConfidence(data.confidence);

          // Append letter if confident and different from last predicted character
          if (data.text !== 'wave' && data.confidence > 0.6) {
            // Avoid repeating the exact letter rapidly unless intended
            if (lastPredictedRef.current !== data.text) {
              setRecognizedText(prev => prev + data.text);
              lastPredictedRef.current = data.text;
            }
          } else if (data.text === 'wave') {
            lastPredictedRef.current = ''; // Reset when hand is lowered
          }
        }
      }
    } catch (error) {
      console.error('Prediction network error:', error);
    }
  };

  // Convert text to sign representation
  const handleVoiceToSign = async (textToConvert) => {
    const query = textToConvert || voiceToSignText;
    if (!query.trim()) return;

    try {
      const response = await fetch(`${API_BASE}/api/voice_to_sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: query })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.signs && data.signs.length > 0) {
          setSignImages(data.signs);
          setCurrentSignIndex(0);
          setIsSignPlaying(true);
        } else {
          alert('No visual signs found for this query.');
        }
      }
    } catch (error) {
      alert('Error fetching sign visual representation.');
    }
  };

  // Play animation sequence of sign cards
  useEffect(() => {
    if (isSignPlaying && signImages.length > 0) {
      signAnimationRef.current = setInterval(() => {
        setCurrentSignIndex(prevIndex => {
          if (prevIndex >= signImages.length - 1) {
            // Stop playing at end of phrase
            clearInterval(signAnimationRef.current);
            setIsSignPlaying(false);
            return prevIndex;
          }
          return prevIndex + 1;
        });
      }, 1200); // 1.2s delay per sign card
    }

    return () => {
      if (signAnimationRef.current) {
        clearInterval(signAnimationRef.current);
      }
    };
  }, [isSignPlaying, signImages]);

  // Convert text to speech via backend
  const speakTextViaBackend = async (text) => {
    if (!text.trim()) return;
    setIsAudioPlaying(true);
    try {
      const response = await fetch(`${API_BASE}/api/text_to_speech`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });

      if (response.ok) {
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        audio.onended = () => setIsAudioPlaying(false);
        audio.play();
      } else {
        setIsAudioPlaying(false);
      }
    } catch (error) {
      console.error('TTS execution error:', error);
      setIsAudioPlaying(false);
    }
  };

  // Native Speech recognition start/stop
  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert('Browser speech recognition is not supported in this environment.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setSpeechTranscript('');
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  // Apply Accessibility Modes Preset Filters
  const handleModeChange = (mode) => {
    setUserMode(mode);
    if (mode === 'hearing') {
      stopWebcam();
    } else if (mode === 'deaf') {
      startWebcam();
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Header bar */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('home')}>
            <span className="text-2xl">🤝</span>
            <h1 className="text-lg font-bold tracking-tight text-white sm:text-xl">
              Inclusive Communication Bridge
            </h1>
          </div>

          <div className="flex items-center space-x-4">
            <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 border border-slate-700">
              <span className={`h-2 w-2 rounded-full mr-1.5 ${backendStatus === 'Connected' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></span>
              Backend: {backendStatus}
            </span>

            {/* Quick dashboard selector */}
            <select
              value={userMode}
              onChange={(e) => handleModeChange(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="full">Mode: Full Suite</option>
              <option value="deaf">Mode: Deaf User</option>
              <option value="hearing">Mode: Hearing User</option>
              <option value="blind">Mode: Blind / Low Vision</option>
            </select>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex flex-col">
        {/* Navigation Tabs */}
        <nav className="flex space-x-2 p-1 bg-slate-800/60 rounded-xl mb-8 border border-slate-800/80 overflow-x-auto">
          {[
            { id: 'home', label: '🏠 Overview', desc: 'Project specs' },
            { id: 'sign-rec', label: '🤟 Sign Recognition', desc: 'Translate gestures' },
            { id: 'speech-rec', label: '🎤 Speech Transcription', desc: 'Listen & text' },
            { id: 'voice-sign', label: '🖼️ Voice to Sign', desc: 'Visual signs representation' },
            { id: 'convo', label: '💬 Conversation Board', desc: 'Interactive chat hub' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center px-4 py-2 text-sm font-semibold rounded-lg transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Tab 1: Home / Landing page */}
        {activeTab === 'home' && (
          <div className="space-y-12 animate-fade-in">
            {/* Hero Section */}
            <div className="text-center py-12 px-4 bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl border border-slate-800 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 h-48 w-48 bg-blue-500/10 rounded-full blur-3xl"></div>
              <div className="absolute bottom-0 left-0 h-48 w-48 bg-emerald-500/10 rounded-full blur-3xl"></div>
              
              <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mb-4">
                Inclusive Communication Bridge
              </h2>
              <p className="max-w-2xl mx-auto text-lg text-slate-300 mb-8 leading-relaxed">
                A production-ready accessible prototype bridging communication gaps between Deaf, Blind, Speech-Impaired, and Hearing users through AI hand landmark processing and real-time translation pipelines.
              </p>
              
              <div className="flex flex-wrap gap-4 justify-center">
                <button
                  onClick={() => setActiveTab('convo')}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg transition-all"
                >
                  🚀 Open Conversation Board
                </button>
                <button
                  onClick={() => setActiveTab('sign-rec')}
                  className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl border border-slate-700 shadow-md transition-all"
                >
                  🎥 Test Sign Recognition
                </button>
              </div>
            </div>

            {/* Accessibility presets showcase */}
            <div>
              <h3 className="text-2xl font-extrabold text-white mb-6">Accessibility User Profiles</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  {
                    title: 'Deaf User Profile',
                    icon: '🤟',
                    description: 'Optimizes for camera-based sign outputs, visual text transcriptions, and speech converted directly into sign animation slides.',
                    action: 'deaf'
                  },
                  {
                    title: 'Hearing User Profile',
                    icon: '🔊',
                    description: 'Maximizes speech input recognition, with incoming sign language text spoken aloud using integrated TTS pipelines.',
                    action: 'hearing'
                  },
                  {
                    title: 'Blind / Low Vision Profile',
                    icon: '😎',
                    description: 'Enables high contrast panels, screen reader alerts, and reads all recognized translations aloud automatically.',
                    action: 'blind'
                  }
                ].map((profile) => (
                  <div
                    key={profile.title}
                    className="p-6 bg-slate-800/40 border border-slate-850 rounded-2xl flex flex-col justify-between hover:border-slate-700 transition-all cursor-pointer group"
                    onClick={() => handleModeChange(profile.action)}
                  >
                    <div>
                      <span className="text-4xl mb-4 block group-hover:scale-110 transition-transform duration-250">{profile.icon}</span>
                      <h4 className="text-lg font-bold text-white mb-2">{profile.title}</h4>
                      <p className="text-sm text-slate-400 leading-relaxed mb-4">{profile.description}</p>
                    </div>
                    <button className="text-blue-500 text-sm font-semibold hover:text-blue-400 mt-2 block text-left">
                      Activate Profile preset →
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Technical Specifications */}
            <div className="bg-slate-800/30 border border-slate-800/80 rounded-2xl p-6 sm:p-8">
              <h3 className="text-xl font-bold text-white mb-4">Core Technology Stack & Pipeline</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                <div className="space-y-2">
                  <h4 className="font-bold text-blue-500">Backend</h4>
                  <ul className="text-sm text-slate-400 space-y-1">
                    <li>• Python 3.10</li>
                    <li>• Flask REST Server</li>
                    <li>• TensorFlow / Keras</li>
                    <li>• OpenCV Image Decoders</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="font-bold text-emerald-500">AI / ML Pipelines</h4>
                  <ul className="text-sm text-slate-400 space-y-1">
                    <li>• MediaPipe Landmark models</li>
                    <li>• 63 Hand Sign Coordinates</li>
                    <li>• 26-Class MLP Neural Net</li>
                    <li>• Dynamic fallback rendering</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="font-bold text-indigo-500">Audio / Speech</h4>
                  <ul className="text-sm text-slate-400 space-y-1">
                    <li>• Google Web Speech API</li>
                    <li>• SpeechRecognition lib</li>
                    <li>• Google TTS (gTTS)</li>
                    <li>• Audio blobs transport</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="font-bold text-amber-500">Frontend</h4>
                  <ul className="text-sm text-slate-400 space-y-1">
                    <li>• React 19 Engine</li>
                    <li>• Tailwind CSS framework</li>
                    <li>• Custom animations</li>
                    <li>• Canvas frames processor</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Sign Recognition Page */}
        {activeTab === 'sign-rec' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in">
            {/* Webcam viewport card */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-850 flex flex-col items-center">
                <h3 className="text-lg font-bold text-white self-start mb-4">📷 Webcam Camera Input</h3>

                <div className="w-full relative aspect-video bg-slate-950 rounded-xl overflow-hidden flex items-center justify-center border border-slate-800">
                  {isWebcamActive ? (
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center p-8">
                      <span className="text-5xl block mb-3 opacity-60">📹</span>
                      <p className="text-slate-400 text-sm mb-4">Webcam feed is currently inactive.</p>
                      <button
                        onClick={startWebcam}
                        className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-lg transition-all"
                      >
                        Start Webcam Feed
                      </button>
                    </div>
                  )}

                  <canvas ref={canvasRef} width="640" height="480" className="hidden" />
                </div>

                {/* Camera Actions */}
                {isWebcamActive && (
                  <div className="mt-4 flex space-x-3 w-full">
                    <button
                      onClick={stopWebcam}
                      className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-sm transition-all"
                    >
                      Stop Webcam
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Translation Output Card */}
            <div className="space-y-6">
              {/* Prediction details */}
              <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-850 space-y-4">
                <h3 className="text-lg font-bold text-white">✨ Current Gesture Inference</h3>
                
                <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 text-center relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-2 text-xs text-slate-500 font-mono">
                    26-class (A-Z)
                  </div>
                  <span className="text-xs text-slate-400 uppercase tracking-widest block mb-1">Detected Character</span>
                  <span className="text-6xl font-extrabold text-blue-500">{currentPrediction}</span>
                </div>

                {/* Confidence bar */}
                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-400 mb-1">
                    <span>Confidence Score</span>
                    <span>{(confidence * 100).toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className="bg-gradient-to-r from-blue-600 to-indigo-500 h-full transition-all duration-200"
                      style={{ width: `${confidence * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Transcript list */}
              <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-850 space-y-4 flex flex-col h-72">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold text-white">📝 Spelled Transcript</h3>
                  <button
                    onClick={() => setRecognizedText('')}
                    disabled={!recognizedText}
                    className="text-xs text-slate-400 hover:text-white disabled:opacity-50"
                  >
                    Clear text
                  </button>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex-1 overflow-y-auto text-slate-200 font-mono text-sm leading-relaxed break-words whitespace-pre-wrap">
                  {recognizedText || <span className="text-slate-500 italic">No signs predicted yet. Spell by placing hands in front of camera.</span>}
                </div>

                <div className="flex space-x-2">
                  <button
                    onClick={() => speakTextViaBackend(recognizedText)}
                    disabled={!recognizedText || isAudioPlaying}
                    className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs transition-all disabled:opacity-50"
                  >
                    {isAudioPlaying ? '🔊 Reading...' : '🔊 Read Aloud'}
                  </button>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(recognizedText);
                      alert('Copied to clipboard!');
                    }}
                    disabled={!recognizedText}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg text-xs transition-all disabled:opacity-50"
                  >
                    📋 Copy
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Speech Transcription */}
        {activeTab === 'speech-rec' && (
          <div className="max-w-3xl mx-auto w-full bg-slate-800/50 rounded-2xl p-6 sm:p-8 border border-slate-850 space-y-6 animate-fade-in">
            <h3 className="text-xl font-bold text-white">🎤 Speech to Text Translator</h3>

            {/* Transcript box */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 h-48 overflow-y-auto flex flex-col justify-between">
              <div className="text-lg font-medium text-slate-100 leading-relaxed">
                {speechTranscript || <span className="text-slate-500 italic">Start speaking to transcribe speech to text in real time.</span>}
              </div>
              {speechTranscript && (
                <div className="flex justify-end mt-4">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(speechTranscript);
                      alert('Text copied!');
                    }}
                    className="text-xs text-blue-500 hover:text-blue-400 font-semibold"
                  >
                    Copy transcript
                  </button>
                </div>
              )}
            </div>

            <div className="flex justify-center">
              <button
                onClick={toggleListening}
                className={`px-8 py-4 rounded-full font-bold shadow-lg flex items-center space-x-3 transition-all ${
                  isListening
                    ? 'bg-rose-600 hover:bg-rose-500 animate-pulse text-white'
                    : 'bg-blue-600 hover:bg-blue-500 text-white'
                }`}
              >
                <span>{isListening ? '⏹️ Stop Listening' : '🎤 Start Speech Input'}</span>
              </button>
            </div>

            {/* Convo history snapshot */}
            <div className="space-y-3">
              <h4 className="font-bold text-sm text-slate-400 uppercase tracking-widest">Transcription History</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                {convoHistory.slice().reverse().map((item, idx) => (
                  <div key={idx} className="bg-slate-900/40 p-3 rounded-lg border border-slate-800/50 flex justify-between items-start text-sm">
                    <div>
                      <span className="font-bold text-xs text-blue-400 block mb-0.5">{item.sender}</span>
                      <span className="text-slate-200">{item.text}</span>
                    </div>
                    <span className="text-xs text-slate-500 whitespace-nowrap ml-4">{item.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Voice to Sign Representation */}
        {activeTab === 'voice-sign' && (
          <div className="max-w-3xl mx-auto w-full bg-slate-800/50 rounded-2xl p-6 sm:p-8 border border-slate-850 space-y-6 animate-fade-in">
            <h3 className="text-xl font-bold text-white">🖼️ Voice to Sign Representation</h3>

            <div className="space-y-4">
              <label className="text-sm font-semibold text-slate-400">Type or Speak a phrase to generate visual sign translations:</label>
              
              <div className="flex space-x-2">
                <input
                  type="text"
                  placeholder="e.g. hello, yes, no..."
                  value={voiceToSignText}
                  onChange={(e) => setVoiceToSignText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleVoiceToSign();
                  }}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
                
                <button
                  onClick={() => handleVoiceToSign()}
                  disabled={!voiceToSignText.trim()}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow transition-all disabled:opacity-50 text-sm"
                >
                  Generate Sign Cards
                </button>
              </div>

              {/* Sample Quick Commands */}
              <div className="flex items-center space-x-2 text-xs">
                <span className="text-slate-500">Quick test phrases:</span>
                {['hello', 'yes', 'no', 'hello no'].map(phrase => (
                  <button
                    key={phrase}
                    onClick={() => {
                      setVoiceToSignText(phrase);
                      handleVoiceToSign(phrase);
                    }}
                    className="px-2.5 py-1 bg-slate-900 border border-slate-850 rounded-md text-slate-400 hover:text-white"
                  >
                    "{phrase}"
                  </button>
                ))}
              </div>
            </div>

            {/* Animation viewer */}
            {signImages.length > 0 && (
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 flex flex-col items-center space-y-4 relative overflow-hidden">
                <h4 className="text-sm font-bold text-slate-400">Signs Playback Sequence</h4>
                
                <div className="w-52 h-52 bg-slate-900 rounded-xl border border-slate-800/80 overflow-hidden flex items-center justify-center shadow-inner relative">
                  <img
                    src={`${API_BASE}${signImages[currentSignIndex]}`}
                    alt={`Sign index ${currentSignIndex}`}
                    className="max-w-full max-h-full object-contain"
                  />
                  
                  {/* Playing Overlay Indicator */}
                  {isSignPlaying && (
                    <div className="absolute bottom-2 right-2 bg-blue-600/80 text-white text-[10px] px-2 py-0.5 rounded-full font-mono flex items-center">
                      <span className="inline-block w-1.5 h-1.5 bg-white rounded-full mr-1 animate-ping"></span>
                      PLAYING
                    </div>
                  )}
                </div>

                {/* Progress Indicators */}
                <div className="flex space-x-1 justify-center max-w-full overflow-x-auto py-1">
                  {signImages.map((_, idx) => (
                    <span
                      key={idx}
                      className={`h-2 rounded-full transition-all duration-200 ${
                        idx === currentSignIndex ? 'w-6 bg-blue-500' : 'w-2 bg-slate-700'
                      }`}
                    ></span>
                  ))}
                </div>

                {/* Controls */}
                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      setIsSignPlaying(false);
                      setCurrentSignIndex(0);
                    }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-lg text-xs"
                  >
                    ⏮️ Reset
                  </button>
                  
                  <button
                    onClick={() => {
                      if (isSignPlaying) {
                        setIsSignPlaying(false);
                      } else {
                        if (currentSignIndex >= signImages.length - 1) {
                          setCurrentSignIndex(0);
                        }
                        setIsSignPlaying(true);
                      }
                    }}
                    className={`px-6 py-2 text-white font-bold rounded-lg text-xs ${
                      isSignPlaying ? 'bg-amber-600 hover:bg-amber-500' : 'bg-blue-600 hover:bg-blue-500'
                    }`}
                  >
                    {isSignPlaying ? '⏸️ Pause' : '▶️ Play Sign Sequence'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 5: Conversation Board */}
        {activeTab === 'convo' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1 items-stretch animate-fade-in">
            {/* Left side: Chat panels */}
            <div className="lg:col-span-2 bg-slate-800/40 border border-slate-850 rounded-2xl p-6 flex flex-col h-[600px]">
              <div className="flex justify-between items-center border-b border-slate-800/80 pb-4 mb-4">
                <h3 className="text-lg font-bold text-white">💬 Real-Time Conversation Bridge</h3>
                <button
                  onClick={() => setConvoHistory([{ sender: 'System', text: 'Chat cleared.', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }])}
                  className="text-xs text-slate-500 hover:text-slate-300"
                >
                  Clear conversation
                </button>
              </div>

              {/* Message flow */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-2 mb-4 scrollbar-thin">
                {convoHistory.map((item, idx) => {
                  const isSystem = item.sender === 'System';
                  const isDeaf = item.sender.includes('Deaf') || item.sender.includes('Sign');
                  return (
                    <div
                      key={idx}
                      className={`flex flex-col ${isSystem ? 'items-center' : isDeaf ? 'items-start' : 'items-end'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-xl p-3.5 ${
                          isSystem
                            ? 'bg-slate-900/60 text-slate-500 text-xs py-1 border border-slate-800'
                            : isDeaf
                            ? 'bg-slate-800 border border-slate-700 text-slate-100'
                            : 'bg-blue-600 text-white'
                        }`}
                      >
                        {!isSystem && (
                          <span className="block text-[10px] font-bold uppercase tracking-wider mb-0.5 opacity-60">
                            {item.sender}
                          </span>
                        )}
                        <span className="text-sm leading-relaxed">{item.text}</span>
                        {!isSystem && (
                          <div className="flex justify-end items-center space-x-1.5 mt-1.5">
                            <span className="text-[9px] opacity-40">{item.time}</span>
                            <button
                              onClick={() => speakTextViaBackend(item.text)}
                              className="text-[10px] opacity-60 hover:opacity-100 transition-opacity"
                              title="Read out"
                            >
                              🔊
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Chat inputs footer */}
              <div className="border-t border-slate-800/80 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Voice Input (For Hearing User) */}
                <div className="bg-slate-900/40 p-3 rounded-xl border border-slate-850 flex items-center justify-between space-x-3">
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-0.5">Hearing Input</span>
                    <span className="text-xs text-slate-300 truncate block">
                      {isListening ? '🎙️ Recording voice...' : 'Speech-to-Text inactive'}
                    </span>
                  </div>
                  <button
                    onClick={toggleListening}
                    className={`h-10 px-4 rounded-lg font-bold text-xs shadow flex items-center space-x-1.5 transition-all ${
                      isListening ? 'bg-rose-600 hover:bg-rose-500 animate-pulse text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'
                    }`}
                  >
                    <span>🎤 {isListening ? 'Stop' : 'Speak'}</span>
                  </button>
                </div>

                {/* Sign Text Submitter (For Deaf User to submit typed text if camera is off) */}
                <div className="bg-slate-900/40 p-3 rounded-xl border border-slate-850 flex items-center justify-between space-x-3">
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-0.5">Deaf/Signer Input</span>
                    <input
                      type="text"
                      placeholder="Type letters/words..."
                      value={recognizedText}
                      onChange={(e) => setRecognizedText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && recognizedText.trim()) {
                          addMessage('Deaf User (Signed)', recognizedText);
                          setRecognizedText('');
                        }
                      }}
                      className="bg-transparent border-none focus:ring-0 text-xs text-slate-200 placeholder-slate-650 w-full p-0"
                    />
                  </div>
                  <button
                    onClick={() => {
                      if (recognizedText.trim()) {
                        addMessage('Deaf User (Signed)', recognizedText);
                        setRecognizedText('');
                      }
                    }}
                    disabled={!recognizedText.trim()}
                    className="h-10 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs shadow transition-all disabled:opacity-50"
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>

            {/* Right side: Accessibility Assist cards */}
            <div className="space-y-6 flex flex-col justify-between">
              {/* Deaf Assistant: Webcam Sign translation feed */}
              {userMode !== 'hearing' && (
                <div className="bg-slate-800/40 border border-slate-850 rounded-2xl p-5 space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-white text-sm">🤟 Deaf Sign Translator Feed</h4>
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping"></span>
                  </div>

                  <div className="aspect-video w-full bg-slate-950 rounded-xl overflow-hidden relative border border-slate-800">
                    {isWebcamActive ? (
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                        <span className="text-3xl block mb-2 opacity-50">📹</span>
                        <button
                          onClick={startWebcam}
                          className="px-4 py-1.5 bg-blue-600 text-white text-[10px] font-bold rounded-lg shadow"
                        >
                          Enable Cam Translate
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="bg-slate-950 border border-slate-850 rounded-xl p-3 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase tracking-widest block">Live Gesture</span>
                      <span className="text-xl font-bold text-blue-500">{currentPrediction}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 uppercase tracking-widest block">Accuracy</span>
                      <span className="text-xs text-slate-300">{(confidence * 100).toFixed(0)}%</span>
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <button
                      onClick={() => {
                        if (currentPrediction !== 'None' && currentPrediction !== 'wave') {
                          setRecognizedText(prev => prev + currentPrediction);
                        }
                      }}
                      disabled={currentPrediction === 'None' || currentPrediction === 'wave'}
                      className="flex-1 py-1.5 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg text-[10px] disabled:opacity-50"
                    >
                      ➕ Append Gesture
                    </button>
                    <button
                      onClick={() => {
                        if (recognizedText.trim()) {
                          addMessage('Deaf User (Signed)', recognizedText);
                          setRecognizedText('');
                        }
                      }}
                      disabled={!recognizedText.trim()}
                      className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-[10px] disabled:opacity-50"
                    >
                      📤 Post Translation
                    </button>
                  </div>
                </div>
              )}

              {/* Hearing Assistant: Speaks text when new message arrives */}
              <div className="bg-slate-800/40 border border-slate-850 rounded-2xl p-5 space-y-3">
                <h4 className="font-bold text-white text-sm">🔊 Voice Output Control</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Converts text transcripts to synthetic audio readouts. Click any message voice icon to read, or toggle automatic speaker reading.
                </p>

                <div className="flex space-x-2">
                  <button
                    onClick={() => speakTextViaBackend(convoHistory[convoHistory.length - 1]?.text)}
                    disabled={convoHistory.length <= 1 || isAudioPlaying}
                    className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs transition-all disabled:opacity-50"
                  >
                    {isAudioPlaying ? '🔊 Reading last message...' : '🔊 Read last message'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-900/60 py-6 text-center text-xs text-slate-500">
        <p className="mb-1">Inclusive Communication Bridge — AI-Powered Multimodal Accessibility Framework</p>
        <p>Created for seamless interaction between Hearing, Deaf, Speech, and Visually Impaired individuals.</p>
      </footer>
    </div>
  );
}

export default App;
