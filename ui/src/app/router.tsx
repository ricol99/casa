import { Navigate, createBrowserRouter } from "react-router-dom";
import { AppShell } from "./AppShell";
import { RootErrorPage } from "./RootErrorPage";
import { TopologyPage } from "../features/topology/TopologyPage";
import { SourcesPage } from "../features/sources/SourcesPage";
import { SourceDetailPage } from "../features/sources/SourceDetailPage";
import { ChangesPage } from "../features/changes/ChangesPage";
import { JobsPage } from "../features/jobs/JobsPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    errorElement: <RootErrorPage />,
    children: [
      {
        index: true,
        element: <Navigate to="/topology" replace />
      },
      {
        path: "topology",
        element: <TopologyPage />
      },
      {
        path: "sources",
        element: <SourcesPage />
      },
      {
        path: "sources/:sourceUName",
        element: <SourceDetailPage />
      },
      {
        path: "changes",
        element: <ChangesPage />
      },
      {
        path: "jobs",
        element: <JobsPage />
      }
    ]
  }
]);
