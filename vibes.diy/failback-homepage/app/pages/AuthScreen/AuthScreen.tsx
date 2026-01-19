import { useState } from "react";
import { VibesButton, YELLOW, RED } from "../../components/vibes/VibesButton/index.js";
import {
  getContainerStyle,
  getBackgroundStyle,
  getCardIconStyle,
  getButtonsContainerStyle,
  getCardIconAnimationStyles,
  getButtonsCenterWrapperStyle,
} from "./AuthScreen.styles.js";

const cardImages = [
  "/app/pages/AuthScreen/temporalCards/card-1.png",
  "/app/pages/AuthScreen/temporalCards/card-2.png",
  "/app/pages/AuthScreen/temporalCards/card-3.png",
  "/app/pages/AuthScreen/temporalCards/card-4.png",
];

export const AuthScreen = () => {
  const [isShredding, setIsShredding] = useState(false);
  const [selectedCard] = useState(() => {
    const randomIndex = Math.floor(Math.random() * cardImages.length);
    return cardImages[randomIndex];
  });

  const handleInstallClick = () => {
    setIsShredding(true);
  };

  return (
    <>
      <style>{getCardIconAnimationStyles()}</style>
      <div style={getContainerStyle()}>
        <div style={getBackgroundStyle(isShredding)} />
        <div style={getCardIconStyle(isShredding)}>
          <img
            src={selectedCard}
            alt="Vibes Card"
            width={200}
            height={200}
            style={{ display: "block" }}
          />
        </div>

      <div style={getButtonsContainerStyle()}>
        <div onClick={handleInstallClick}>
          <VibesButton buttonType="form" formColor="white">
            Intall 303 Synth App
          </VibesButton>
        </div>

        <div style={getButtonsCenterWrapperStyle()}>
        <VibesButton variant={YELLOW} buttonType="flat-rounded" icon="google">
          Continue with Google
        </VibesButton>

        <VibesButton variant={RED} buttonType="flat-rounded" icon="github">
          Continue with GitHub
        </VibesButton>
        </div>

        <VibesButton variant={RED} buttonType="form">
          <span style={{color: 'white'}}>Log In</span>
        </VibesButton>
      </div>
      </div>
    </>
  );
};
