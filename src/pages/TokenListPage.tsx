import { Codex } from "@codex-data/sdk";
import { TokenRankingAttribute, RankingDirection, TokenFilterResult } from "@codex-data/sdk/dist/sdk/generated/graphql";
import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowRight, TrendingUp, Search } from "lucide-react";
import { cn } from "@/lib/utils";

// Solana mainnet network ID
const SOLANA_NETWORK_ID = 101;

export default function TokenListPage() {
  const navigate = useNavigate();
  const networkIdNum = SOLANA_NETWORK_ID; // Always use Solana

  const [tokenListItems, setTokenListItems] = useState<TokenFilterResult[]>([]);
  const [networkName, setNetworkName] = useState<string>("");
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"trending" | "volume">("trending");

  useEffect(() => {
    const fetchData = async () => {
      const apiKey = import.meta.env.VITE_CODEX_API_KEY;
      if (!apiKey) {
        console.warn("VITE_CODEX_API_KEY environment variable is not set.");
      }
      const codexClient = new Codex(apiKey || "");

      try {
        const [networksResult, tokensResponse] = await Promise.all([
          codexClient.queries
            .getNetworks({})
            .catch((err: Error) => {
              console.error(`Error fetching all networks:`, err);
              return null;
            }),
          codexClient.queries
            .filterTokens({
              filters: { network: [networkIdNum] },
              rankings: [
                {
                  attribute:
                    sortBy === "trending"
                      ? TokenRankingAttribute.TrendingScore
                      : TokenRankingAttribute.Volume24,
                  direction: RankingDirection.Desc,
                },
              ],
              limit: 100,
            })
            .catch((err: Error) => {
              console.error(`Error fetching tokens for network ${networkIdNum}:`, err);
              throw new Error(`Failed to load tokens for network ${networkIdNum}.`);
            }),
        ]);

        if (networksResult?.getNetworks) {
          const currentNetwork = networksResult.getNetworks.find((net) => net.id === networkIdNum);
          setNetworkName(currentNetwork?.name || "Solana");
        } else {
          setNetworkName("Solana");
        }

        const resultsArray = tokensResponse.filterTokens?.results;
        if (resultsArray) {
          const filteredItems = resultsArray
            .filter((item) => item != null)
            .filter((item) => item.token != null);
          setTokenListItems(filteredItems);
        }
      } catch (err: unknown) {
        console.error("Error loading token list data:", err);
        if (err instanceof Error) {
          setFetchError(err.message);
        } else {
          setFetchError("An unknown error occurred while loading token list.");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [networkIdNum, sortBy]);

  // Filter tokens by search query
  const filteredTokens = tokenListItems.filter((item) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const name = item.token?.name?.toLowerCase() || "";
    const symbol = item.token?.symbol?.toLowerCase() || "";
    const address = item.token?.address?.toLowerCase() || "";
    return name.includes(query) || symbol.includes(query) || address.includes(query);
  });

  const handleTokenClick = (tokenAddress: string) => {
    navigate(`/trade/${networkIdNum}/${tokenAddress}`);
  };

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center p-6 md:p-12">
        <p>Loading tokens...</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-6 md:p-12 space-y-6">
      <div className="w-full max-w-6xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">Solana Token List</h1>
            {networkName && (
              <p className="text-muted-foreground">Network: {networkName}</p>
            )}
          </div>
          <Link to="/" className="text-sm hover:underline">
            &lt; Back to Home
          </Link>
        </div>

        {/* Search and Sort Controls */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by name, symbol, or address..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Sort */}
              <div className="flex gap-2">
                <button
                  onClick={() => setSortBy("trending")}
                  className={cn(
                    "px-4 py-2 rounded-lg font-medium transition-all",
                    sortBy === "trending"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  <TrendingUp className="w-4 h-4 inline mr-2" />
                  Trending
                </button>
                <button
                  onClick={() => setSortBy("volume")}
                  className={cn(
                    "px-4 py-2 rounded-lg font-medium transition-all",
                    sortBy === "volume"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  Volume
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error Message */}
        {fetchError && (
          <Card className="mb-6 border-destructive">
            <CardContent className="pt-6">
              <p className="text-destructive">{fetchError}</p>
            </CardContent>
          </Card>
        )}

        {/* Token List */}
        {!fetchError && (
          <Card>
            <CardHeader>
              <CardTitle>
                {filteredTokens.length} {filteredTokens.length === 1 ? "Token" : "Tokens"}
                {searchQuery && ` matching "${searchQuery}"`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredTokens.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p>No tokens found.</p>
                  {searchQuery && (
                    <p className="mt-2 text-sm">Try adjusting your search query.</p>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[60px]">Icon</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Symbol</TableHead>
                        <TableHead>Exchanges</TableHead>
                        <TableHead className="w-[100px] text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTokens.map((item) => (
                        <TableRow
                          key={item.token?.address}
                          className="hover:bg-muted/50 cursor-pointer"
                          onClick={() => item.token?.address && handleTokenClick(item.token.address)}
                        >
                          <TableCell>
                            {item.token?.info?.imageThumbUrl ? (
                              <img
                                src={item.token.info.imageThumbUrl}
                                alt={`${item.token?.name || "Token"} icon`}
                                width={32}
                                height={32}
                                className="rounded-full"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-semibold">
                                {item.token?.symbol ? item.token.symbol[0] : "T"}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">
                            {item.token?.name || "Unknown Name"}
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-sm">
                              {item.token?.symbol || "-"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {item.token?.exchanges?.slice(0, 3).map((exchange, idx) => (
                                <span
                                  key={idx}
                                  className="text-xs px-2 py-1 bg-muted rounded"
                                >
                                  {exchange.name}
                                </span>
                              ))}
                              {item.token?.exchanges && item.token.exchanges.length > 3 && (
                                <span className="text-xs text-muted-foreground">
                                  +{item.token.exchanges.length - 3}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (item.token?.address) {
                                  handleTokenClick(item.token.address);
                                }
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium"
                            >
                              Trade
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
