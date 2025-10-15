export const testAppData = {
  slug: "immense-shrimp-9469",
  title: "Funky Reality Distortion",
  name: "Funky Reality Distortion",
  code: `import React, { useState, useEffect } from "react";
import { useFireproof } from 'use-fireproof';
import { callAI } from 'call-ai';

export default function App() {
  const { useLiveQuery, database } = useFireproof("reality-distortion-db");
  const { docs: phrases } = useLiveQuery("type", { key: "distortion", descending: true });
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [displayed, setDisplayed] = useState({});
  const [error, setError] = useState("");
  const [speechSupported, setSpeechSupported] = useState(false);
  const [speaking, setSpeaking] = useState("");
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);
  
  useEffect(() => {
    if ('speechSynthesis' in window) {
      setSpeechSupported(true);
    }
    
    return () => {
      if (window.speechSynthesis) {
        speechSynthesis.cancel();
      }
    };
  }, []);
  
  const speakTextWordByWord = (text, id) => {
    if (!speechSupported || speaking === id) return;
    speechSynthesis.cancel();
    const words = text.split(/\\s+/);
    setSpeaking(id);
    setCurrentWordIndex(0);
    
    const speakWord = (word, index) => {
      if (index >= words.length) {
        setSpeaking("");
        setCurrentWordIndex(-1);
        return;
      }
      
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.pitch = 0.8 + Math.random() * 0.6;
      utterance.rate = 0.7 + Math.random() * 0.6;
      utterance.volume = 0.8 + Math.random() * 0.2;
      
      utterance.onend = () => {
        setCurrentWordIndex(index + 1);
        speakWord(words[index + 1], index + 1);
      };
      
      utterance.onerror = () => {
        setSpeaking("");
        setCurrentWordIndex(-1);
      };
      
      speechSynthesis.speak(utterance);
    };
    
    speakWord(words[0], 0);
  };
  
  async function generatePhrases(e) {
    e.preventDefault();
    if (!topic.trim()) return;
    
    setLoading(true);
    setError("");
    
    try {
      const gen = await callAI(
        \`Create 3 funky, bold claims about '\${topic}' in the style of Steve Jobs' "reality distortion field". Each phrase should be inspirational and future-focused. Give as JSON: phrases: [{claim, impact}] where claim is the bold statement and impact is how it will change everything.\`,
        {
          stream: true,
          schema: {
            properties: {
              phrases: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    claim: { type: "string" },
                    impact: { type: "string" },
                  },
                },
              },
            },
          },
        }
      );
      
      let final = "";
      for await (const part of gen) final = part;
      
      const json = JSON.parse(final);
      await Promise.all(
        (json.phrases || []).map((p) =>
          database.put({
            ...p,
            type: "distortion",
            topic,
            createdAt: Date.now(),
          })
        )
      );
      
      setTopic("");
    } catch (err) {
      setError("Failed to generate statements. Try again!");
    }
    
    setLoading(false);
  }

  const addDemoData = async () => {
    setLoading(true);
    
    const demo = [
      { 
        claim: "This radical product will change how we see technology forever.", 
        impact: "Everyone will question what they thought was possible.", 
        topic: "Future Tech" 
      },
      { 
        claim: "We're creating a whole new language for digital interaction.", 
        impact: "Communication barriers will dissolve between humans and machines.", 
        topic: "Interface Design" 
      },
      { 
        claim: "This is the most insanely great thing we've ever built.", 
        impact: "It will make everything else seem obsolete overnight.", 
        topic: "Innovation" 
      },
    ];
    
    for (const p of demo) {
      await database.put({
        ...p,
        type: "distortion",
        createdAt: Date.now(),
      });
    }
    
    setLoading(false);
  };

  function toggleDisplay(p) {
    const id = p._id;
    const isDisplayed = displayed[id];
    
    if (isDisplayed) {
      speakTextWordByWord(p.claim, id);
    } else {
      speakTextWordByWord(p.impact, id);
    }
    
    setDisplayed(prev => ({ ...prev, [id]: !prev[id] }));
  }

  function handleDelete(id) {
    database.del(id);
  }

  function renderSpeakingText(text, docId) {
    if (speaking !== docId || currentWordIndex === -1) {
      return <span>{text}</span>;
    }
    
    const words = text.split(/\\s+/);
    return (
      <span>
        {words.map((word, index) => (
          <span 
            key={index} 
            className={currentWordIndex === index ? "bg-[#e9ff70] font-black animate-pulse" : ""}
            style={currentWordIndex === index ? {textShadow: "1px 1px 0px #242424"} : {}}
          >
            {word}{' '}
          </span>
        ))}
      </span>
    );
  }

  return (
    <div className="min-h-screen p-4" style={{
      backgroundColor: "#ffffff",
      backgroundImage: "radial-gradient(#ff70a6 2px, transparent 2px), radial-gradient(#70d6ff 2px, transparent 2px)",
      backgroundSize: "30px 30px",
      backgroundPosition: "0 0, 15px 15px"
    }}>
      <div className="max-w-2xl mx-auto py-6">
        <div className="mb-8 border-4 border-[#242424] bg-white shadow-lg p-6 flex flex-col items-center gap-4">
          <h1 className="text-3xl font-black text-[#242424] mb-2 text-center">
            FUNKY REALITY DISTORTION
          </h1>
          
          <p className="text-base text-[#242424] font-medium max-w-md text-center italic">
            <span className="font-bold">*Create visionary statements with a funky twist!*</span>  
            <br />
            Enter any topic to generate bold claims. Click cards to hear each word spoken with a unique voice.
            <br />
            <span className="text-[#ff70a6] font-bold">Each word gets its own voice - weird and wonderful!</span>
          </p>
          
          <form className="flex gap-2 w-full max-w-md" onSubmit={generatePhrases}>
            <input
              className="flex-1 p-3 border-4 border-[#242424] focus:outline-none bg-white"
              placeholder="Enter funky topic"
              disabled={loading}
              value={topic}
              onChange={e => setTopic(e.target.value)}
            />
            <button
              type="submit"
              className="bg-[#242424] text-white px-4 py-1 font-bold border-4 border-[#242424] hover:bg-[#70d6ff] hover:text-[#242424]"
              disabled={loading}
            >
              {loading ? "..." : "GET FUNKY"}
            </button>
          </form>
          
          <button
            className="px-4 py-2 border-4 border-[#242424] bg-white font-bold text-[#242424] hover:bg-[#e9ff70]"
            onClick={addDemoData}
            disabled={loading}
          >
            DEMO FUNK
          </button>
          
          {error && <div className="text-[#ff70a6] font-bold p-2">{error}</div>}
          
          {!speechSupported && (
            <div className="text-[#242424] bg-white p-2 border-2 border-[#242424] text-sm italic">
              Speech synthesis not available - no funk for you!
            </div>
          )}
        </div>
        
        <div className="grid gap-4">
          {phrases.length === 0 ? (
            <div className="text-center font-bold text-xl text-[#242424] bg-white p-4 border-4 border-[#242424]">
              GET FUNKY WITH SOME STATEMENTS!
            </div>
          ) : (
            phrases.map((p) => (
              <div
                key={p._id}
                className="relative border-4 border-[#242424] shadow-lg flex flex-col cursor-pointer hover:scale-[1.01]"
                onClick={() => toggleDisplay(p)}
                style={{
                  background: displayed[p._id] ? "#70d6ff" : "#ffffff",
                  transition: "all 0.3s ease"
                }}
              >
                <button
                  onClick={e => { e.stopPropagation(); handleDelete(p._id); }}
                  className="absolute top-2 right-2 text-white bg-[#242424] border-2 border-[#242424] w-8 h-8 flex items-center justify-center font-bold hover:bg-[#ff70a6] z-10"
                >×</button>
                
                {speaking === p._id && (
                  <div className="absolute top-2 left-2 bg-[#242424] text-white px-2 py-1 text-xs font-bold">
                    FUNKING OUT
                  </div>
                )}
                
                <div className="w-full flex-1 p-6">
                  {displayed[p._id] ? (
                    <>
                      <div className="text-xs font-bold mb-2 bg-[#242424] text-white px-2 py-1 inline-block">IMPACT</div>
                      <p className="text-center font-medium text-lg text-[#242424]">
                        "{renderSpeakingText(p.impact, p._id)}"
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="text-xs font-bold mb-2 bg-[#242424] text-white px-2 py-1 inline-block">FUNKY CLAIM</div>
                      <p className="text-center font-black text-xl text-[#242424]">
                        "{renderSpeakingText(p.claim, p._id)}"
                      </p>
                    </>
                  )}
                  <div className="mt-3 text-xs bg-[#e9ff70] px-2 py-1 font-bold border-2 border-[#242424] inline-block">
                    {p.topic}
                  </div>
                </div>
                
                <div className="w-full text-center text-xs text-white font-bold bg-[#242424] p-2 flex items-center justify-center">
                  {displayed[p._id] ? "CLICK FOR FUNKY CLAIM" : "CLICK FOR FUNKY IMPACT"}
                  {speechSupported && (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-2 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    </svg>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}`,
  hasScreenshot: true,
  userId: "test-user",
};
