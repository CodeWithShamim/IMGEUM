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
      // 1s block time means aggressive refetch is genuinely live, not wasteful.
      refetchOnWindowFocus: false,
      retry: 1,
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
