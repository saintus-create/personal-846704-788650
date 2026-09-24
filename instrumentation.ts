export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const proxy = process.env.HTTPS_PROXY || process.env.HTTPS_PROXY || process.env.https_proxy || process.env.http_proxy;
  if (!proxy) return;
  try {
    const { ProxyAgent, setGlobalDispatcher } = await import("undici");
    setGlobalDispatcher(new ProxyAgent(proxy));
  } catch {
    // proxy wiring is best-effort (sandbox only; Vercel has no outbound proxy)
  }
}
