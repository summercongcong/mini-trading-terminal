import { Connection, PublicKey, Keypair, VersionedTransaction } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import Decimal from "decimal.js";
import bs58 from "bs58";

export const createConnection = () => {
  return new Connection(import.meta.env.VITE_HELIUS_RPC_URL);
};

export const createKeypair = (privateKey: string) => {
  if (!privateKey) {
    throw new Error("Private key is required. Please set VITE_SOLANA_PRIVATE_KEY in your .env file.");
  }

  // Clean the private key: remove whitespace, newlines, quotes
  const cleanedKey = privateKey.trim().replace(/['"]/g, '').replace(/\s+/g, '');

  if (!cleanedKey) {
    throw new Error("Private key is empty after cleaning. Please check your VITE_SOLANA_PRIVATE_KEY in .env file.");
  }

  // Try base58 decoding first (most common format)
  try {
    const secretKey = bs58.decode(cleanedKey);
    if (secretKey.length === 64) {
      return Keypair.fromSecretKey(secretKey);
    }
    throw new Error(`Base58 decoded key length is ${secretKey.length}, expected 64 bytes`);
  } catch (base58Error) {
    // If base58 fails, try parsing as JSON array (another common format)
    try {
      // Try to parse as JSON array
      const parsed = JSON.parse(cleanedKey);
      if (Array.isArray(parsed)) {
        if (parsed.length === 64) {
          const secretKey = Uint8Array.from(parsed);
          return Keypair.fromSecretKey(secretKey);
        }
        throw new Error(`JSON array length is ${parsed.length}, expected 64 numbers`);
      }
    } catch (jsonError) {
      // JSON parsing failed, continue to next format
    }

    // If both fail, try hex format
    try {
      // Remove '0x' prefix if present
      let hexString = cleanedKey.startsWith('0x') || cleanedKey.startsWith('0X') 
        ? cleanedKey.slice(2) 
        : cleanedKey;
      
      // Validate hex string
      if (!/^[0-9a-fA-F]+$/.test(hexString)) {
        throw new Error('Invalid hex characters');
      }

      // Convert hex to Uint8Array
      const bytes = [];
      for (let i = 0; i < hexString.length; i += 2) {
        bytes.push(parseInt(hexString.substr(i, 2), 16));
      }
      
      if (bytes.length === 64) {
        const secretKey = Uint8Array.from(bytes);
        return Keypair.fromSecretKey(secretKey);
      }
      throw new Error(`Hex decoded key length is ${bytes.length}, expected 64 bytes (128 hex characters)`);
    } catch (hexError) {
      // Hex parsing also failed
    }

    // All formats failed - provide helpful error message
    const errorDetails = base58Error instanceof Error ? base58Error.message : String(base58Error);
    throw new Error(
      `Invalid private key format. The private key must be in one of these formats:\n\n` +
      `1. Base58 encoded string (most common, ~88 characters)\n` +
      `   Example: 5JRaypasxMx1L97ZUX7YuK5pk9rZk3fx8NwXg5V8b3nK...\n\n` +
      `2. JSON array of 64 numbers\n` +
      `   Example: [123,45,67,89,...] (64 numbers total)\n\n` +
      `3. Hexadecimal string (128 hex characters = 64 bytes)\n` +
      `   Example: 0x7b2d3f4e... or 7b2d3f4e...\n\n` +
      `Original error: ${errorDetails}\n\n` +
      `Your private key length: ${cleanedKey.length} characters\n` +
      `First 20 characters: ${cleanedKey.substring(0, 20)}...\n\n` +
      `Please check your VITE_SOLANA_PRIVATE_KEY in .env file.\n` +
      `Make sure there are no extra spaces, quotes, or newlines.`
    );
  }
};

export const getSolanaBalance = async (publicKey: string, connection: Connection): Promise<Decimal> => {
  const balance = await connection.getBalance(new PublicKey(publicKey));
  return new Decimal(balance);
};

export const getTokenBalance = async (
  publicKey: string,
  tokenAddress: string,
  connection: Connection,
): Promise<Decimal> => {
  try {
    // Validate addresses before creating PublicKey
    if (!publicKey || !tokenAddress) {
      console.warn("[getTokenBalance] Missing publicKey or tokenAddress");
      return new Decimal(0);
    }

    // Validate address format (basic check)
    const isValidBase58 = (str: string): boolean => {
      const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
      return base58Regex.test(str) && str.length >= 32 && str.length <= 44;
    };

    if (!isValidBase58(publicKey)) {
      console.error(`[getTokenBalance] Invalid publicKey format: ${publicKey.substring(0, 20)}...`);
      return new Decimal(0);
    }

    if (!isValidBase58(tokenAddress)) {
      console.error(`[getTokenBalance] Invalid tokenAddress format: ${tokenAddress.substring(0, 20)}...`);
      return new Decimal(0);
    }

    const mint = new PublicKey(tokenAddress);
    const owner = new PublicKey(publicKey);

    // Get the associated token account address
    // This is the standard way to get token account for a wallet and token mint
    const tokenAccountPubkey = getAssociatedTokenAddressSync(
      mint,
      owner,
      false, // allowOwnerOffCurve is false by default
    );

    console.log(`[getTokenBalance] Token account address: ${tokenAccountPubkey.toBase58()}`);

    try {
      const response = await connection.getTokenAccountBalance(tokenAccountPubkey);
      return new Decimal(response.value.amount);
    } catch (error) {
      // Token account might not exist if balance is 0
      console.log(`[getTokenBalance] Token account not found or has zero balance`);
      return new Decimal(0);
    }
  } catch (error) {
    console.error(`[getTokenBalance] Error fetching Solana token balance:`, error);
    if (error instanceof Error) {
      console.error(`[getTokenBalance] Error details:`, error.message);
    }
    return new Decimal(0);
  }
};

export const signTransaction = (keypair: Keypair, transaction: VersionedTransaction): VersionedTransaction => {
  transaction.sign([keypair]);
  return transaction;
};

export const sendTransaction = async (transaction: VersionedTransaction, connection: Connection) => {
  const signature = await connection.sendTransaction(transaction);
  return signature;
};

export const confirmTransaction = async (signature: string, connection: Connection) => {
  const blockHash = await connection.getLatestBlockhash();
  const confirmation = await connection.confirmTransaction({
    signature,
    blockhash: blockHash.blockhash,
    lastValidBlockHeight: blockHash.lastValidBlockHeight,
  }, "confirmed");
  return confirmation;
};