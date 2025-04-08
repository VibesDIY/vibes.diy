// Welcome screen component shown when no messages are present
import VibesDIYLogo from './VibesDIYLogo';

const WelcomeScreen = () => {
  return (
    <div className="text-accent-01 mx-auto max-w-2xl space-y-4 px-12 pt-8 text-center">
      <VibesDIYLogo className="scale-[3] font-bold text-[rgb(86,86,86)] sm:scale-[6] dark:text-[rgb(212,212,212)]" />
      <p className="pt-24 italic">Generate apps in seconds.</p>
    </div>
  );
};

export default WelcomeScreen;
