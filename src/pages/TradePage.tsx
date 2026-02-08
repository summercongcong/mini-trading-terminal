import { useEffect, useState, Suspense } from "react";
import { useParams } from "react-router-dom";
import { Codex } from "@codex-data/sdk";
import { EnhancedToken } from "@codex-data/sdk/dist/sdk/generated/graphql";
import { TokenChart, ChartDataPoint } from "@/components/TokenChart";
import { FloatingTradingPanel } from "@/components/FloatingTradingPanel";
import {
  TradingPanelProvider,
  useTradingPanel,
} from "@/contexts/TradingPanelContext";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";

const CHART_RESOLUTION = "30";
const ONE_DAY_IN_SECONDS = 24 * 60 * 60;

interface GraphQLError {
  response?: {
    errors?: Array<{
      message?: string;
      extensions?: {
        code?: string;
      };
    }>;
  };
}

function TradePageContent() {
  const { networkId, token } = useParams<{ networkId: string; token: string }>();
  const { toggleVisibility, state } = useTradingPanel();
  const [details, setDetails] = useState<EnhancedToken | undefined>(undefined);
  const [bars, setBars] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("Token address is required");
      setLoading(false);
      return;
    }

    if (!networkId) {
      setError("Network ID is required");
      setLoading(false);
      return;
    }

    const networkIdNum = parseInt(networkId, 10);
    if (isNaN(networkIdNum)) {
      setError(`Invalid Network ID: ${networkId}`);
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      const apiKey = import.meta.env.VITE_CODEX_API_KEY;
      if (!apiKey) {
        console.warn("VITE_CODEX_API_KEY not set.");
      }
      const codexClient = new Codex(apiKey || "");

      const now = Math.floor(Date.now() / 1000);
      const oneDayAgo = now - ONE_DAY_IN_SECONDS;
      const symbolId = `${token}:${networkIdNum}`;

      try {
        const results = await Promise.allSettled([
          codexClient.queries.token({
            input: { networkId: networkIdNum, address: token },
          }),
          codexClient.queries.getBars({
            symbol: symbolId,
            from: oneDayAgo,
            to: now,
            resolution: CHART_RESOLUTION,
          }),
        ]);

        const [detailsResult, barsResult] = results;

        // Process token details
        if (detailsResult.status === "fulfilled") {
          const tokenData = detailsResult.value.token;
          if (tokenData) {
            setDetails(tokenData);
          } else {
            const errorMessage = extractErrorMessage(
              detailsResult.value as GraphQLError,
              token
            );
            setError(errorMessage);
          }
        } else {
          const errorMessage = extractErrorMessage(
            detailsResult.reason as GraphQLError,
            token,
            apiKey
          );
          setError(errorMessage);
        }

        // Process chart data
        if (barsResult.status === "fulfilled") {
          const barsData = barsResult.value.getBars;
          if (barsData?.t && barsData?.c) {
            const chartData = barsData.t.map((time: number, index: number) => ({
              time,
              open: barsData.o?.[index],
              high: barsData.h?.[index],
              low: barsData.l?.[index],
              close: barsData.c?.[index],
            }));
            setBars(chartData);
          }
        } else {
          console.warn("Failed to fetch chart data:", barsResult.reason);
        }
      } catch (err) {
        console.error("Error fetching token data:", err);
        const errorMessage =
          err instanceof Error ? err.message : "Failed to load token data";
        setError(`Error: ${errorMessage}`);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token, networkId]);

  // Helper function to extract error messages
  const extractErrorMessage = (
    errorData: GraphQLError | Error | string | unknown,
    tokenAddress: string,
    apiKey?: string
  ): string => {
    // Check if API key is missing
    if (!apiKey) {
      return "VITE_CODEX_API_KEY is not set. Please configure it in your .env file.";
    }

    // Handle GraphQL errors
    if (errorData && typeof errorData === "object" && "response" in errorData) {
      const response = (errorData as GraphQLError).response;
      if (response?.errors && Array.isArray(response.errors) && response.errors.length > 0) {
        const graphqlError = response.errors[0];
        if (graphqlError?.extensions?.code === "NOT_FOUND") {
          return `Token not found in Codex database: ${tokenAddress}. This token may not be indexed yet or the address may be incorrect.`;
        }
        return `API Error: ${graphqlError?.message || "Unknown error"}`;
      }
    }

    // Handle Error objects
    if (errorData instanceof Error) {
      return `Failed to load token details: ${errorData.message}`;
    }

    // Handle string errors
    if (typeof errorData === "string") {
      return `Failed to load token details: ${errorData}`;
    }

    // Default error
    return `Token not found: ${tokenAddress}. Please check the token address.`;
  };

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center p-6 md:p-12">
        <p>Loading token data...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center p-12 md:p-24">
        <div className="max-w-2xl space-y-4 text-center">
          <h1 className="text-2xl font-bold text-destructive">{error}</h1>
          <div className="text-sm text-muted-foreground space-y-2">
            <p>可能的解决方案：</p>
            <ul className="list-disc list-inside space-y-1 text-left">
              <li>
                检查{" "}
                <code className="bg-muted px-1 rounded">
                  VITE_CODEX_API_KEY
                </code>{" "}
                是否在 .env 文件中正确配置
              </li>
              <li>
                确认代币地址格式正确（Solana 地址通常是 32-44 个字符的 base58
                编码）
              </li>
              <li>
                该代币可能尚未被 Codex 索引，尝试使用其他代币地址
              </li>
              <li>
                可以从首页导航到已知的代币（如从网络页面选择代币）
              </li>
              <li>检查网络连接和 API 服务状态</li>
              <li>查看浏览器控制台获取更多错误详情</li>
            </ul>
            {token && networkId && (
              <div className="mt-4 space-y-1">
                <p>
                  网络 ID:{" "}
                  <code className="bg-muted px-1 rounded font-mono text-xs">
                    {networkId}
                  </code>
                </p>
                <p>
                  代币地址:{" "}
                  <code className="bg-muted px-1 rounded font-mono text-xs">
                    {token}
                  </code>
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    );
  }

  if (!details) {
    return (
      <main className="flex min-h-screen flex-col items-center p-12 md:p-24">
        <h1 className="text-2xl font-bold text-destructive">Token not found</h1>
      </main>
    );
  }

  const tokenName = details?.name || token;
  const tokenSymbol = details?.symbol ? `(${details.symbol})` : "";

  return (
    <main className="flex min-h-screen flex-col items-center p-6 md:p-12 space-y-6">
      <div className="w-full max-w-6xl">
        <h1 className="text-2xl md:text-3xl font-bold truncate pr-4 mb-6">
          {tokenName} {tokenSymbol}
        </h1>

        <div className="space-y-6">
          <Suspense
            fallback={
              <Card>
                <CardHeader>
                  <CardTitle>Price Chart</CardTitle>
                </CardHeader>
                <CardContent>
                  <p>Loading chart...</p>
                </CardContent>
              </Card>
            }
          >
            <div className="relative">
              <TokenChart
                data={bars}
                title={`${tokenSymbol || "Token"} Price Chart`}
              />
              {/* Toggle button below chart */}
              <div className="mt-4 flex justify-center">
                <button
                  onClick={toggleVisibility}
                  className={cn(
                    "hidden lg:flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all",
                    state.isVisible
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "bg-muted/30 text-muted-foreground hover:bg-muted/50 border border-border"
                  )}
                  aria-label="Toggle trading panel"
                >
                  <ShoppingCart className="w-4 h-4" />
                  {state.isVisible ? "Hide" : "Show"} Trading Panel
                </button>
              </div>
            </div>
          </Suspense>
        </div>
      </div>

      {/* Floating Trading Panel */}
      {details && <FloatingTradingPanel token={details} />}
    </main>
  );
}

export default function TradePage() {
  return (
    <TradingPanelProvider>
      <TradePageContent />
    </TradingPanelProvider>
  );
}
