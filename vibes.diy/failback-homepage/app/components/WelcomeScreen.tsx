import React, { memo } from "react";

// Welcome screen component shown when no messages are present
const WelcomeScreen = () => {
  return (
    <div className="text-accent-02 mx-auto flex max-w-2xl flex-col items-center space-y-4 px-12">
      <h1 className="text-2xl font-bold">Make apps with your friends</h1>
      <p className="text-center italic">Shareable in seconds</p>
    </div>
  );
};

export default memo(WelcomeScreen);
