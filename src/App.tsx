import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { UserProvider } from "@/context/UserContext";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Chat from "./pages/Chat";
import ProfileEdit from "./pages/ProfileEdit";
import PresetEdit from "./pages/PresetEdit";
import Presets from "./pages/Presets";
import JobSources from "./pages/JobSources";
import Premium from "./pages/Premium";
import SavedJobs from "./pages/SavedJobs";
import CV from "./pages/CV";
import CVEditor from "./pages/CVEditor";
import DailyInsights from "./pages/DailyInsights";
import Admin from "./pages/Admin";
import AdminStats from "./pages/AdminStats";
import PortalsMap from "./pages/PortalsMap";
import AdminSources from "./pages/AdminSources";
import ArchilesDashboard from "./pages/admin/ArchilesDashboard";
import ArchilesReview from "./pages/admin/ArchilesReview";
import ArchilesSources from "./pages/admin/ArchilesSources";
import ArchilesSourcesQueue from "./pages/admin/ArchilesSourcesQueue";
import ArchilesChat from "./pages/admin/ArchilesChat";
import ArchilesAutonomy from "./pages/admin/ArchilesAutonomy";
import ArchilesStatistics from "./pages/admin/ArchilesStatistics";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <UserProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/profile/edit" element={<ProfileEdit />} />
            <Route path="/preset/new" element={<PresetEdit />} />
            <Route path="/preset/edit/:id" element={<PresetEdit />} />
            <Route path="/presets" element={<Presets />} />
            <Route path="/sources" element={<JobSources />} />
            <Route path="/premium" element={<Premium />} />
            <Route path="/saved" element={<SavedJobs />} />
            <Route path="/cv" element={<CV />} />
            <Route path="/cv/:id" element={<CVEditor />} />
            <Route path="/insights" element={<DailyInsights />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/admin/stats" element={<AdminStats />} />
            <Route path="/admin/portals" element={<PortalsMap />} />
            <Route path="/admin/sources" element={<AdminSources />} />
            <Route path="/admin/archiles" element={<ArchilesDashboard />} />
            <Route path="/admin/archiles/review" element={<ArchilesReview />} />
            <Route path="/admin/archiles/sources" element={<ArchilesSources />} />
            <Route path="/admin/archiles/sources-queue" element={<ArchilesSourcesQueue />} />
            <Route path="/admin/archiles/chat" element={<ArchilesChat />} />
            <Route path="/admin/archiles/autonomy" element={<ArchilesAutonomy />} />
            <Route path="/admin/archiles/statistics" element={<ArchilesStatistics />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </UserProvider>
  </QueryClientProvider>
);

export default App;
