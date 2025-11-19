export const styles = `
  .vibes-panel-container {
    position: relative;
    display: inline-flex;
    align-items: stretch;
    width: auto;
    margin-bottom: 40px;
  }

  .vibes-panel-label {
    background: #e5e5e5;
    border: 2px solid #000;
    border-left: none;
    border-top-right-radius: 8px;
    border-bottom-right-radius: 8px;
    padding: 12px 8px;
    font-weight: 700;
    font-size: 14px;
    text-transform: uppercase;
    letter-spacing: 1px;
    white-space: nowrap;
    color: #000;
    writing-mode: vertical-rl;
    text-orientation: mixed;
    transform: rotate(180deg);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin: 32px 0px;
  }

  .vibes-panel-button-wrapper {
    background: #e5e5e5;
    border: 2px solid #000;
    border-radius: 8px;
    padding: 24px 24px 32px 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: auto;
  }

  @media (max-width: 768px) {
    .vibes-panel-container {
      flex-direction: column;
      width: 100%;
    }

    .vibes-panel-label {
      display: none;
    }

    .vibes-panel-button-wrapper {
      background: transparent;
      border: none;
      border-radius: 0;
      padding: 0;
      padding-bottom: 24px;
    }
  }
`;
