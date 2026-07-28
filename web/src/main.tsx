import React from 'react';
import ReactDOM from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import {WagmiProvider} from 'wagmi';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';

import './i18n';
import './styles/global.css';
import {wagmiConfig} from './config/wagmi';
import {ErrorBoundary} from './components/layout/ErrorBoundary';
import {App} from './App';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // On by default in react-query, and it was switched off here on the theory that the 1s
      // polls made it redundant. They do not: react-query PAUSES `refetchInterval` while the
      // document is unfocused, and the one moment this app is reliably unfocused is while the
      // wallet popup is open for a signature. So the polls stopped for the whole transaction
      // and, with focus refetching off, nothing restarted them on the way back — the user
      // returned to a confirmed transaction and pre-transaction numbers.
      refetchOnWindowFocus: true,
      // Public RPC endpoints are rate-limited and blip. One retry was leaving reads to fail on
      // a single hiccup, which for the batched reads means a vault silently vanishing from the
      // list rather than rendering stale.
      retry: 2,
      retryDelay: (attempt) => Math.min(250 * 2 ** attempt, 2_000),
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* Outside the providers: a throw from wagmi's or react-query's own setup has to be caught
        too, and this shell needs nothing from them. */}
    <ErrorBoundary>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </QueryClientProvider>
      </WagmiProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
