import { createContext, useContext, useState, ReactNode } from "react";

interface TradingPanelState {
  isVisible: boolean;
  position: { x: number; y: number };
  size: { width: number; height: number };
}

interface TradingPanelContextType {
  state: TradingPanelState;
  toggleVisibility: () => void;
  setPosition: (position: { x: number; y: number }) => void;
  setSize: (size: { width: number; height: number }) => void;
  resetPosition: () => void;
}

const TradingPanelContext = createContext<TradingPanelContextType | undefined>(undefined);

const defaultState: TradingPanelState = {
  isVisible: false,
  position: { x: window.innerWidth - 420, y: 100 },
  size: { width: 400, height: 500 },
};

export function TradingPanelProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TradingPanelState>(defaultState);

  const toggleVisibility = () => {
    setState((prev) => ({ ...prev, isVisible: !prev.isVisible }));
  };

  const setPosition = (position: { x: number; y: number }) => {
    setState((prev) => ({ ...prev, position }));
  };

  const setSize = (size: { width: number; height: number }) => {
    setState((prev) => ({ ...prev, size }));
  };

  const resetPosition = () => {
    setState(defaultState);
  };

  return (
    <TradingPanelContext.Provider
      value={{
        state,
        toggleVisibility,
        setPosition,
        setSize,
        resetPosition,
      }}
    >
      {children}
    </TradingPanelContext.Provider>
  );
}

export function useTradingPanel() {
  const context = useContext(TradingPanelContext);
  if (context === undefined) {
    throw new Error("useTradingPanel must be used within a TradingPanelProvider");
  }
  return context;
}
