import { useCallback, useEffect, useState } from "react";
import { createKeypair, createConnection, getSolanaBalance, getTokenBalance } from "@/lib/solana";
import Decimal from "decimal.js";

export const useBalance = (tokenAddress: string, tokenDecimals: number, nativeDecimals: number, networkId: number) => {
  const [nativeBalance, setNativeBalance] = useState<number>(0);
  const [nativeAtomicBalance, setNativeAtomicBalance] = useState<Decimal>(new Decimal(0));
  const [tokenBalance, setTokenBalance] = useState<number>(0);
  const [tokenAtomicBalance, setTokenAtomicBalance] = useState<Decimal>(new Decimal(0));
  const [loading, setLoading] = useState<boolean>(true);

  const refreshBalance = useCallback(async () => {
    try {
      // Only support Solana mainnet (networkId = 101)
      if (networkId !== 101) {
        console.warn(`[useBalance] Network ID ${networkId} is not supported. Only Solana (101) is supported for RPC queries.`);
        setLoading(false);
        return;
      }

      const privateKey = import.meta.env.VITE_SOLANA_PRIVATE_KEY;
      if (!privateKey) {
        console.error("[useBalance] ❌ VITE_SOLANA_PRIVATE_KEY is not set");
        setLoading(false);
        return;
      }

      const rpcUrl = import.meta.env.VITE_HELIUS_RPC_URL;
      if (!rpcUrl) {
        console.error("[useBalance] ❌ VITE_HELIUS_RPC_URL is not set");
        setLoading(false);
        return;
      }

      let keypair;
      let walletAddress: string;
      try {
        keypair = createKeypair(privateKey);
        walletAddress = keypair.publicKey.toBase58();
      } catch (keypairError) {
        console.error("[useBalance] ❌ Failed to create keypair:", keypairError);
        setLoading(false);
        return;
      }

      console.log("[useBalance] ===== Starting RPC balance query =====");
      console.log("[useBalance] Wallet Address:", walletAddress);
      console.log("[useBalance] Network ID:", networkId, "(Solana)");
      console.log("[useBalance] Token Address:", tokenAddress);
      console.log("[useBalance] RPC URL:", rpcUrl);
      console.log("[useBalance] Solana Explorer:", `https://explorer.solana.com/address/${walletAddress}`);

      setLoading(true);

      // Create connection
      const connection = createConnection();

      // Fetch SOL balance
      console.log("[useBalance] Fetching SOL balance from RPC...");
      const solBalanceAtomic = await getSolanaBalance(walletAddress, connection);
      const solBalanceHuman = solBalanceAtomic.div(10 ** nativeDecimals).toNumber();
      
      setNativeAtomicBalance(solBalanceAtomic);
      setNativeBalance(solBalanceHuman);
      console.log("[useBalance] ✅ SOL balance:", solBalanceHuman, "SOL");

      // Fetch token balance (only if tokenAddress is valid Solana format)
      const isSuiFormat = tokenAddress.includes("::");
      const isHexFormat = tokenAddress.startsWith("0x") && !isSuiFormat;
      const isBase58Format = /^[1-9A-HJ-NP-Za-km-z]+$/.test(tokenAddress) && tokenAddress.length >= 32 && tokenAddress.length <= 44;

      if (isSuiFormat) {
        console.warn("[useBalance] ⚠️ Token address is in Sui format, skipping token balance query");
        console.warn("[useBalance] Token address:", tokenAddress);
        setTokenAtomicBalance(new Decimal(0));
        setTokenBalance(0);
      } else if (isHexFormat) {
        console.warn("[useBalance] ⚠️ Token address is in hex format (EVM chain), skipping token balance query");
        console.warn("[useBalance] Token address:", tokenAddress);
        setTokenAtomicBalance(new Decimal(0));
        setTokenBalance(0);
      } else if (isBase58Format && tokenAddress.length >= 32) {
        console.log("[useBalance] Fetching token balance from RPC...");
        const tokenBalanceAtomic = await getTokenBalance(walletAddress, tokenAddress, connection);
        const tokenBalanceHuman = tokenBalanceAtomic.div(10 ** tokenDecimals).toNumber();
        
        setTokenAtomicBalance(tokenBalanceAtomic);
        setTokenBalance(tokenBalanceHuman);
        console.log("[useBalance] ✅ Token balance:", tokenBalanceHuman);
      } else {
        console.warn("[useBalance] ⚠️ Token address format is invalid for Solana");
        console.warn("[useBalance] Token address:", tokenAddress);
        console.warn("[useBalance] Expected: Base58 format (32-44 characters)");
        setTokenAtomicBalance(new Decimal(0));
        setTokenBalance(0);
      }

      console.log("[useBalance] ===== RPC balance query completed =====");
      setLoading(false);
    } catch (error) {
      console.error("[useBalance] ❌ Error fetching balances from RPC:", error);
      if (error instanceof Error) {
        console.error("[useBalance] Error message:", error.message);
        console.error("[useBalance] Error stack:", error.stack);
      }
      setLoading(false);
    }
  }, [tokenAddress, networkId, nativeDecimals, tokenDecimals]);

  useEffect(() => {
    refreshBalance();
  }, [refreshBalance]);

  return { nativeBalance, nativeAtomicBalance, tokenBalance, tokenAtomicBalance, loading, refreshBalance };
};