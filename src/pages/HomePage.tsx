import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import NetworkList from "@/components/NetworkList";
import { getCodexClient } from "@/lib/codex";
import { ArrowRight } from "lucide-react";

type Network = {
  id: number;
  name: string;
};

const topNetworkNames = [
  "Solana",
  "Ethereum",
  "BNB Chain",
  "Base",
  "Arbitrum",
  "Unichain",
  "Sui",
  "Tron",
  "Polygon",
  "Sonic",
  "Aptos"
];

export default function HomePage() {
  const [topNetworks, setTopNetworks] = useState<Network[]>([]);
  const [restNetworks, setRestNetworks] = useState<Network[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNetworks = async () => {
      const codexClient = getCodexClient();
      try {
        const result = await codexClient.queries.getNetworks({});
        const allNetworks = result.getNetworks?.filter(net => net != null) as Network[] || [];

        const topNetworksMap = new Map<string, Network>();
        const rest: Network[] = [];

        allNetworks.forEach(network => {
          if (topNetworkNames.includes(network.name)) {
            topNetworksMap.set(network.name, network);
          } else {
            rest.push(network);
          }
        });

        const top = topNetworkNames
          .map(name => topNetworksMap.get(name))
          .filter((network): network is Network => network !== undefined);

        rest.sort((a, b) => a.name.localeCompare(b.name));

        setTopNetworks(top);
        setRestNetworks(rest);
      } catch (err) {
        console.error("Error fetching networks:", err);
        setError("Failed to load networks.");
      } finally {
        setLoading(false);
      }
    };

    fetchNetworks();
  }, []);

  return (
    <main className="flex min-h-screen flex-col p-12 md:p-24">
      <div className="w-full max-w-md mx-auto">
        <h1 className="text-4xl font-bold mb-4 text-center">Tokedex</h1>
        <p className="text-lg text-center mb-8">
          Welcome to Tokedex! Your mini trading terminal.
          <br />
          Discover, analyze, and track tokens across various networks.
        </p>
        <div className="flex justify-center mb-6">
          <Link
            to="/tokens"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium"
          >
            Browse All Tokens
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      <div className="w-full max-w-md mx-auto flex-grow flex flex-col">
        {loading ? (
          <p className="text-center">Loading networks...</p>
        ) : (
          <NetworkList
            topNetworks={topNetworks}
            restNetworks={restNetworks}
            initialError={error}
          />
        )}
      </div>
    </main>
  );
}