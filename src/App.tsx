import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "./pages/Home";
import Editor from "./pages/Editor";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const RootFallback = () => (
  <main className="min-h-screen paper-plain flex items-center justify-center p-6">
    <div className="w-full max-w-lg text-center space-y-3">
      <p className="text-sm text-ink-soft">App Loaded</p>
      <h1 className="font-display text-4xl">Rendering is working.</h1>
      <p className="text-ink-soft">
        Auth guards are temporarily disabled so the preview can render safely.
      </p>
    </div>
  </main>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RootFallback />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/app" element={<Home />} />
          <Route path="/editor/:id" element={<Editor />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
