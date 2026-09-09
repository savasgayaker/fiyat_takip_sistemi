import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppProvider } from "@/context/AppContext";
import { Layout } from "@/components/layout/Layout";
import { Toaster } from "@/components/ui/sonner";
import Dashboard from "@/pages/Dashboard";
import Breakdown from "@/pages/Breakdown";
import Basket from "@/pages/Basket";
import Quality from "@/pages/Quality";
import TuikCompare from "@/pages/TuikCompare";
import ExportPage from "@/pages/ExportPage";
import Method from "@/pages/Method";

function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/kirilim" element={<Breakdown />} />
            <Route path="/sepet" element={<Basket />} />
            <Route path="/kalite" element={<Quality />} />
            <Route path="/tuik" element={<TuikCompare />} />
            <Route path="/disa-aktar" element={<ExportPage />} />
            <Route path="/yontem" element={<Method />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </AppProvider>
  );
}

export default App;
