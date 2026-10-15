import React from 'react';
import {createRoot} from 'react-dom/client';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import RecommendationsScreen from '/Users/namu/Desktop/ExpiryMate/apps/mobile/app/(tabs)/recommendations';
const client=new QueryClient({defaultOptions:{queries:{enabled:false,retry:false},mutations:{retry:false}}});
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={client}><RecommendationsScreen/></QueryClientProvider>);
