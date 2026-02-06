import { useRef, useCallback, useState, useEffect } from "react";
import { CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { EnhancedToken } from "@codex-data/sdk/dist/sdk/generated/graphql";
import { useBalance } from "@/hooks/use-balance";
import { useTrade } from "@/hooks/use-trade";
import { useTradingPanel } from "@/contexts/TradingPanelContext";
import { useDraggable } from "@/hooks/use-draggable";
import { useResizable } from "@/hooks/use-resizable";
import { confirmTransaction, createConnection, createKeypair, sendTransaction, signTransaction } from "@/lib/solana";
import { Keypair, Connection } from "@solana/web3.js";
import { X, GripVertical } from "lucide-react";
import { toast as Toast } from "sonner"


interface FloatingTradingPanelProps {
  token: EnhancedToken;
}

export function FloatingTradingPanel({ token }: FloatingTradingPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const { state, setPosition, setSize, toggleVisibility } = useTradingPanel();
  const tokenSymbol = token.symbol;
  const [tradeMode, setTradeMode] = useState<"buy" | "sell">("buy");
  const [buyAmount, setBuyAmount] = useState("");
  const [sellPercentage, setSellPercentage] = useState("");

  const { nativeBalance: solanaBalance, tokenBalance, tokenAtomicBalance, loading, refreshBalance } = useBalance(
    token.address,
    Number(token.decimals),
    9,
    Number(token.networkId)
  );
  const { createTransaction } = useTrade(token.address, tokenAtomicBalance);

  // Get keypair with error handling
  let keypair: Keypair | undefined;
  let connection: Connection | undefined;
  try {
    const privateKey = import.meta.env.VITE_SOLANA_PRIVATE_KEY;
    if (!privateKey) {
      console.warn("VITE_SOLANA_PRIVATE_KEY is not set. Trading functionality will be disabled.");
    } else {
      keypair = createKeypair(privateKey);
      connection = createConnection();
    }
  } catch (error) {
    console.error("Failed to initialize keypair:", error);
    // keypair and connection will remain undefined
  }

  // Handle dragging - only on header
  useDraggable(headerRef, {
    onDrag: setPosition,
    onDragEnd: setPosition,
    enabled: state.isVisible,
  });

  // Handle resizing
  useResizable(panelRef, {
    onResize: setSize,
    onResizeEnd: setSize,
    enabled: state.isVisible,
    minWidth: 300,
    minHeight: 400,
    maxWidth: 800,
    maxHeight: 900,
  });

  const handleTrade = useCallback(async () => {
    if (!keypair || !connection) {
      Toast.error("Wallet not initialized. Please check your VITE_SOLANA_PRIVATE_KEY configuration.");
      return;
    }

    const toastId = Toast.loading("Submitting trade request...");
    try {
      const transaction = await createTransaction({
        direction: tradeMode,
        value: tradeMode === "buy" ? parseFloat(buyAmount) : parseFloat(sellPercentage),
        signer: keypair.publicKey,
      });

      Toast.loading("Signing transaction...", { id: toastId });
      const signedTransaction = signTransaction(keypair, transaction);

      Toast.loading("Sending transaction...", { id: toastId });
      const signature = await sendTransaction(signedTransaction, connection);

      Toast.loading("Confirming transaction...", { id: toastId });
      const confirmation = await confirmTransaction(signature, connection);

      if (confirmation.value.err) {
        throw new Error("Trade failed");
      }
      Toast.success(`Trade successful! TX: ${signature.slice(0, 8)}...`, { id: toastId });

      // Refresh balance after 1 second
      setTimeout(refreshBalance, 1000);

      // Reset form
      setBuyAmount("");
      setSellPercentage("");
    } catch (error) {
      Toast.error((error as Error).message, { id: toastId });
    }
  }, [tradeMode, buyAmount, sellPercentage, createTransaction, keypair, connection, refreshBalance]);

  const solBuyAmountPresets = [0.0001, 0.001, 0.01, 0.1];
  const percentagePresets = [25, 50, 75, 100];

  // Check if desktop device
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    checkDesktop();
    window.addEventListener("resize", checkDesktop);
    return () => window.removeEventListener("resize", checkDesktop);
  }, []);

  if (!isDesktop) {
    return null;
  }

  if (!state.isVisible) {
    return null;
  }

  if (!import.meta.env.VITE_SOLANA_PRIVATE_KEY || !import.meta.env.VITE_HELIUS_RPC_URL || !import.meta.env.VITE_JUPITER_REFERRAL_ACCOUNT) {
    return null;
  }

  return (
    <div
      ref={panelRef}
      className="fixed z-50 bg-background border border-border rounded-lg shadow-2xl"
      style={{
        left: `${state.position.x}px`,
        top: `${state.position.y}px`,
        width: `${state.size.width}px`,
        height: `${state.size.height}px`,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header with drag handle */}
      <div ref={headerRef} className="flex items-center justify-between p-3 border-b border-border cursor-move select-none bg-muted/30">
        <div className="flex items-center gap-2">
          <GripVertical className="w-4 h-4 text-muted-foreground" />
          <CardTitle className="text-lg">Trade {tokenSymbol || "Token"}</CardTitle>
        </div>
        <button
          onClick={toggleVisibility}
          className="p-1 hover:bg-muted rounded transition-colors"
          aria-label="Close panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="flex justify-between p-3 bg-muted/30 rounded-lg">
          <span className="text-sm text-muted-foreground">SOL Balance:</span>
          <span className="font-semibold">{solanaBalance.toFixed(4)} SOL</span>
        </div>

        {tokenSymbol && (
          <div className="flex justify-between p-3 bg-muted/30 rounded-lg">
            <span className="text-sm text-muted-foreground">{tokenSymbol} Balance:</span>
            <span className="font-semibold">{tokenBalance.toLocaleString()} {tokenSymbol}</span>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => setTradeMode("buy")}
            className={cn(
              "flex-1 py-2 px-4 rounded-lg font-medium transition-all border",
              tradeMode === "buy"
                ? "bg-green-500/20 text-green-500 border border-green-500/50"
                : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
            )}
          >
            Buy
          </button>
          <button
            onClick={() => setTradeMode("sell")}
            className={cn(
              "flex-1 py-2 px-4 rounded-lg font-medium transition-all",
              tradeMode === "sell"
                ? "bg-red-500/20 text-red-500 border border-red-500/50"
                : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
            )}
          >
            Sell
          </button>
        </div>

        {tradeMode === "buy" ? (
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Amount in SOL</label>
            <div className="flex gap-2">
              {solBuyAmountPresets.map((preset) => (
                <button
                  key={preset}
                  onClick={() => setBuyAmount(preset.toString())}
                  className={cn(
                    "flex-1 py-1.5 px-2 rounded-md text-sm font-medium transition-all",
                    buyAmount === preset.toString()
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  {preset}
                </button>
              ))}
            </div>
            <Input
              type="number"
              placeholder="0.00"
              value={buyAmount}
              onChange={(e) => setBuyAmount(e.target.value)}
              min="0"
              step="0.01"
            />
            <div className="text-xs text-muted-foreground">
              Available: {solanaBalance.toFixed(4)} SOL
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <label className="text-sm text-muted-foreground">Sell Percentage</label>
            <div className="flex gap-2">
              {percentagePresets.map((preset) => (
                <button
                  key={preset}
                  onClick={() => setSellPercentage(preset.toString())}
                  className={cn(
                    "flex-1 py-1.5 px-2 rounded-md text-sm font-medium transition-all",
                    sellPercentage === preset.toString()
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  {preset}%
                </button>
              ))}
            </div>
            <Input
              type="number"
              placeholder="0"
              value={sellPercentage}
              onChange={(e) => setSellPercentage(e.target.value)}
              min="0"
              max="100"
              step="1"
            />
            {sellPercentage && tokenBalance > 0 && (
              <div className="text-xs text-muted-foreground">
                Selling: {((tokenBalance * parseFloat(sellPercentage)) / 100).toLocaleString()} {tokenSymbol}
              </div>
            )}
          </div>
        )}

        <button
          onClick={handleTrade}
          disabled={
            loading ||
            (tradeMode === "buy" && (!buyAmount || parseFloat(buyAmount) <= 0)) ||
            (tradeMode === "sell" && (!sellPercentage || parseFloat(sellPercentage) <= 0))
          }
          className={cn(
            "w-full py-3 px-4 rounded-lg font-semibold transition-all",
            tradeMode === "buy"
              ? "bg-green-500 hover:bg-green-600 text-white disabled:bg-green-500/30 disabled:text-green-500/50"
              : "bg-red-500 hover:bg-red-600 text-white disabled:bg-red-500/30 disabled:text-red-500/50",
            "disabled:cursor-not-allowed"
          )}
        >
          {tradeMode === "buy" ? "Buy" : "Sell"} {tokenSymbol || "Token"}
        </button>
      </div>

      {/* Resize handle */}
      <div
        className="resize-handle absolute bottom-0 right-0 w-5 h-5 cursor-se-resize bg-border/30 hover:bg-border/60 transition-colors flex items-end justify-end p-1"
        style={{
          clipPath: 'polygon(100% 0, 100% 100%, 0 100%)',
        }}
      >
        <div className="w-2 h-2 border-r-2 border-b-2 border-border/60" />
      </div>
    </div>
  );
}
