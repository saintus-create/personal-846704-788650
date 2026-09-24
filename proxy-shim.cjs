try {
  const { ProxyAgent, setGlobalDispatcher } = require("undici");
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY;
  if (proxy) setGlobalDispatcher(new ProxyAgent(proxy));
} catch (e) { /* best effort */ }
