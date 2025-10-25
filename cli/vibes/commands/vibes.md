---
description: Generate a Fireproof/Vibes.diy codebase with AI-powered component generation
---

# Generate Vibes Codebase

You will help the user create a complete Fireproof and Vibes.diy application.

## Process

1. **Get User Input**: Ask the user to describe the application they want to build. Be encouraging and explain that you'll create a complete, working React application with Fireproof data persistence and AI integration.

2. **Get Output Directory**: Ask where they want the project created. Default to `./vibes-app` if not specified. Make sure to get the absolute path.

3. **Invoke the Skill**: Use the `vibes-generator` Skill to:
   - Generate an augmented system prompt based on the vibes.diy prompt patterns
   - Create the React component code
   - Set up the complete Vite project structure
   - Write all necessary files

4. **Next Steps**: After generation, provide clear instructions:
   ```bash
   cd [output-directory]
   npm install
   npm run dev
   ```

   Explain that the app will open at `http://localhost:5173` and includes:
   - Fireproof for local-first data persistence
   - callAI for AI/LLM integration
   - Tailwind CSS for styling
   - Hot module reloading for development

## Important Notes

- The generated app is a single-page application in `src/App.jsx`
- All dependencies are already configured in package.json
- The app uses modern React patterns with hooks
- Data persists locally via Fireproof
- The vibes-generator Skill handles all the system prompt augmentation and code generation logic
