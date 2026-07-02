import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Admin from "./pages/Admin";
import Dashboard from "./pages/Dashboard";
import Invoices from "./pages/Invoices";
import InvoiceDetail from "./pages/InvoiceDetail";
import Settings from "./pages/Settings";
import Budget from "./pages/Budget";
import Goals from "./pages/Goals";
import InvoiceManualEntry from "./pages/InvoiceManualEntry";
import InvoiceUpload from "./pages/InvoiceUpload";
import NotFound from "./pages/NotFound";
import Chat from "./pages/Chat";
import Accounts from "./pages/Accounts";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import EncryptionMigration from "./pages/EncryptionMigration";
import Setup from "./pages/Setup";
import SharedInvoice from "./pages/SharedInvoice";
import RequireAuth from "./components/auth/RequireAuth";
import { UploadJobProvider } from "@/context/UploadJobContext";
import UploadJobPopup from "@/components/uploads/UploadJobPopup";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <UploadJobProvider>
        <BrowserRouter>
          <UploadJobPopup />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/setup" element={<Setup />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/shared/token/:token" element={<SharedInvoice />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/admin" element={<Admin />} />
            <Route
              path="/migrate-encryption"
              element={
                <RequireAuth>
                  <EncryptionMigration />
                </RequireAuth>
              }
            />
            <Route
              path="/dashboard"
              element={
                <RequireAuth>
                  <Dashboard />
                </RequireAuth>
              }
            />
            <Route
              path="/invoices"
              element={
                <RequireAuth>
                  <Invoices />
                </RequireAuth>
              }
            />
            <Route
              path="/invoices/:id"
              element={
                <RequireAuth>
                  <InvoiceDetail />
                </RequireAuth>
              }
            />
            <Route
              path="/invoices/:id/edit"
              element={
                <RequireAuth>
                  <InvoiceManualEntry />
                </RequireAuth>
              }
            />
            <Route
              path="/invoices/new/manual"
              element={
                <RequireAuth>
                  <InvoiceManualEntry />
                </RequireAuth>
              }
            />
            <Route
              path="/invoices/new/upload"
              element={
                <RequireAuth>
                  <InvoiceUpload />
                </RequireAuth>
              }
            />
            <Route
              path="/settings"
              element={
                <RequireAuth>
                  <Settings />
                </RequireAuth>
              }
            />
            <Route
              path="/budget"
              element={
                <RequireAuth>
                  <Budget />
                </RequireAuth>
              }
            />
            <Route
              path="/goals"
              element={
                <RequireAuth>
                  <Goals />
                </RequireAuth>
              }
            />
            <Route
              path="/chat"
              element={
                <RequireAuth>
                  <Chat />
                </RequireAuth>
              }
            />
            <Route
              path="/accounts"
              element={
                <RequireAuth>
                  <Accounts />
                </RequireAuth>
              }
            />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </UploadJobProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
