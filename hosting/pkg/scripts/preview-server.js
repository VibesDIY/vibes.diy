#!/usr/bin/env node

import { readFileSync, watchFile } from "fs";
import { createServer } from "http";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read the template file
const templatePath = join(__dirname, "../src/apptemplate.html");
let template = readFileSync(templatePath, "utf-8");

// Watch for template file changes
watchFile(templatePath, { interval: 100 }, () => {
  console.log("📝 Template file changed, reloading...");
  try {
    template = readFileSync(templatePath, "utf-8");
    console.log("✅ Template reloaded successfully");
  } catch (error) {
    console.error("❌ Error reloading template:", error.message);
  }
});

// Sample app code for testing
const sampleAppCode = `
const { useState } = React;

function App() {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState('');

  const handleNetworkTest = async () => {
    setLoading(true);
    setResponse('');
    try {
      const res = await fetch('https://fakeresponder.com/?sleep=1000');
      const data = await res.text();
      setResponse('✅ Network test completed!');
    } catch (error) {
      setResponse(\`❌ Error: \${error.message}\`);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen relative">
      {/* Textured background with multiple layers */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500"></div>
      <div className="absolute inset-0 bg-gradient-to-tl from-blue-600/30 via-transparent to-green-500/20"></div>
      <div className="absolute inset-0" style={{
        backgroundImage: \`
          radial-gradient(circle at 25% 25%, rgba(255,255,255,0.1) 0%, transparent 50%),
          radial-gradient(circle at 75% 75%, rgba(255,255,255,0.05) 0%, transparent 50%),
          linear-gradient(45deg, transparent 25%, rgba(255,255,255,0.02) 25%, rgba(255,255,255,0.02) 50%, transparent 50%, transparent 75%, rgba(255,255,255,0.02) 75%)
        \`,
        backgroundSize: '100px 100px, 150px 150px, 30px 30px'
      }}></div>
      
      {/* Content */}
      <div className="relative z-10 flex items-center justify-center min-h-screen p-8">
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 max-w-md w-full border border-white/20">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-6 text-center">
            ✨ Sample Vibe App
          </h1>
          <div className="text-center">
            <div className="text-6xl font-bold bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent mb-4">
              {count}
            </div>
            <div className="space-x-4 mb-4">
              <button 
                onClick={() => setCount(count - 1)}
                className="bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white px-6 py-3 rounded-xl transition-all transform hover:scale-105 shadow-lg"
              >
                −
              </button>
              <button 
                onClick={() => setCount(count + 1)}
                className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white px-6 py-3 rounded-xl transition-all transform hover:scale-105 shadow-lg"
              >
                +
              </button>
            </div>
            
            {/* Network Test Button */}
            <div className="mt-6 mb-4">
              <button 
                onClick={handleNetworkTest}
                disabled={loading}
                className={\`bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 text-white px-6 py-3 rounded-xl transition-all transform hover:scale-105 shadow-lg \${loading ? 'opacity-50 cursor-not-allowed' : ''}\`}
              >
                {loading ? '🔄 Testing...' : '🌐 Test Network'}
              </button>
              {response && (
                <div className="mt-3 p-3 bg-white/50 rounded-lg text-sm font-medium">
                  {response}
                </div>
              )}
            </div>
            
            <p className="text-gray-700 mt-4 font-medium">
              🎨 Click to test the vibrant counter!
            </p>
            <div className="mt-6 p-4 bg-gradient-to-r from-yellow-100 to-orange-100 rounded-lg border border-yellow-200">
              <p className="text-yellow-800 text-sm">
                💫 This colorful background showcases the Vibes button styling
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Long article content for testing */}
      <div className="relative z-10 max-w-4xl mx-auto px-8 py-16">
        <article className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-8 border border-white/20">
          <h2 className="text-3xl font-bold text-gray-800 mb-6">The Art of Digital Creation</h2>
          
          <p className="text-gray-700 mb-4 leading-relaxed">
            In the rapidly evolving landscape of digital creativity, we find ourselves at the intersection of technology and human expression. This convergence has given birth to new forms of artistic expression that were unimaginable just a few decades ago. From generative art to interactive installations, the digital realm has become a canvas for innovation.
          </p>
          
          <p className="text-gray-700 mb-4 leading-relaxed">
            The democratization of creative tools has empowered individuals across the globe to participate in this digital renaissance. No longer confined to traditional mediums, artists now wield algorithms, data, and computational power as their brushes and paints. This transformation has not only expanded the definition of art but has also challenged our understanding of creativity itself.
          </p>
          
          <h3 className="text-2xl font-semibold text-gray-800 mb-4">The Role of Technology in Creative Expression</h3>
          
          <p className="text-gray-700 mb-4 leading-relaxed">
            Technology serves as both a tool and a medium in contemporary digital art. Machine learning algorithms can generate stunning visuals, while virtual reality creates immersive experiences that blur the line between the physical and digital worlds. These technologies don't replace human creativity; instead, they amplify it, allowing artists to explore new dimensions of expression.
          </p>
          
          <p className="text-gray-700 mb-4 leading-relaxed">
            The collaborative nature of digital creation has fostered communities of makers, developers, and artists who share knowledge and resources. Open-source software, online tutorials, and collaborative platforms have made advanced creative tools accessible to anyone with an internet connection. This accessibility has led to an explosion of creative content and innovation.
          </p>
          
          <h3 className="text-2xl font-semibold text-gray-800 mb-4">Challenges and Opportunities</h3>
          
          <p className="text-gray-700 mb-4 leading-relaxed">
            While the digital age has opened new frontiers for creativity, it has also presented unique challenges. Issues of authenticity, ownership, and the value of digital art have sparked debates within the creative community. The rise of NFTs and blockchain technology has attempted to address some of these concerns, though the conversation continues to evolve.
          </p>
          
          <p className="text-gray-700 mb-4 leading-relaxed">
            The speed of technological advancement means that creative professionals must continuously adapt and learn. What was cutting-edge yesterday may be obsolete tomorrow. This constant evolution requires a mindset of lifelong learning and experimentation. Those who embrace this challenge find themselves at the forefront of creative innovation.
          </p>
          
          <p className="text-gray-700 mb-4 leading-relaxed">
            Looking toward the future, we can expect even more revolutionary changes in how we create, consume, and interact with digital content. Artificial intelligence will likely play an increasingly important role, not as a replacement for human creativity, but as a powerful collaborator that can help us explore new possibilities.
          </p>
          
          <h3 className="text-2xl font-semibold text-gray-800 mb-4">The Future of Digital Creativity</h3>
          
          <p className="text-gray-700 mb-4 leading-relaxed">
            As we stand on the brink of new technological breakthroughs, the future of digital creativity appears boundless. Emerging technologies like quantum computing, advanced AI, and augmented reality promise to unlock new forms of expression that we can barely imagine today. The key to navigating this future lies in maintaining a balance between technological innovation and human creativity.
          </p>
          
          <p className="text-gray-700 mb-4 leading-relaxed">
            The next generation of digital creators will likely be those who can seamlessly blend technical skills with artistic vision. They will be fluent in both the language of code and the language of human emotion, creating works that resonate on both intellectual and emotional levels.
          </p>
          
          <p className="text-gray-700 mb-4 leading-relaxed">
            In conclusion, the digital age has fundamentally transformed the creative landscape, offering unprecedented opportunities for expression and innovation. While challenges remain, the potential for human creativity enhanced by technology is limitless. As we continue to push the boundaries of what's possible, we can look forward to a future where the line between imagination and reality becomes increasingly blurred.
          </p>
          
          <div className="mt-8 p-6 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-100">
            <p className="text-purple-800 text-sm italic">
              This article demonstrates how the Vibes button maintains its position and functionality even with long scrollable content. The button should remain fixed in the bottom-right corner regardless of scroll position.
            </p>
          </div>
        </article>
      </div>
      
      {/* Floating elements for visual interest */}
      <div className="absolute top-20 left-20 w-32 h-32 bg-gradient-to-br from-yellow-400/20 to-orange-400/20 rounded-full blur-xl"></div>
      <div className="absolute bottom-20 right-20 w-40 h-40 bg-gradient-to-br from-green-400/20 to-blue-400/20 rounded-full blur-xl"></div>
      <div className="absolute top-1/2 left-10 w-24 h-24 bg-gradient-to-br from-pink-400/20 to-purple-400/20 rounded-full blur-xl"></div>
    </div>
  );
}
`;

// Import map from shared JSON config
import importMapData from "../src/config/library-import-map.json" with { type: "json" };
const libraryImportMap = importMapData.imports;

// Replace template placeholders with sample data
function renderTemplate() {
  // Generate the import map JSON
  const importMapJson = JSON.stringify({ imports: libraryImportMap }, null, 2);

  return (
    template
      .replace(/{{APP_SLUG}}/g, "sample-app")
      .replace(/{{APP_CODE}}/g, sampleAppCode)
      .replace(/{{API_KEY}}/g, "sample-api-key")
      .replace(/{{REMIX_BUTTON}}/g, '<a href="https://vibes.diy" class="remix-link">🧬</a>')
      .replace("{{IMPORT_MAP}}", importMapJson)
      // Add React to global scope before the app code
      .replace(
        "// APP_CODE placeholder will be replaced with actual code",
        `
      // Make React available globally for Babel
      import React from 'react';
      window.React = React;
      
      // APP_CODE placeholder will be replaced with actual code
    `
      )
  );
}

const server = createServer((req, res) => {
  // Handle favicon requests
  if (req.url === "/favicon.ico" || req.url === "/favicon.svg") {
    res.writeHead(404);
    res.end();
    return;
  }

  // Serve the template for all other requests
  res.writeHead(200, {
    "Content-Type": "text/html",
    "Cache-Control": "no-cache",
  });

  const html = renderTemplate();
  res.end(html);
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`🌟 Preview server running at http://localhost:${PORT}`);
  console.log("📱 This shows the updated Vibes button styling");
  console.log("🔄 Refresh the page to see changes after editing the template");
});
